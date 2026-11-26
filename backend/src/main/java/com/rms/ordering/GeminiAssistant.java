package com.rms.ordering;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.rms.chatbot.AiModelService;
import com.rms.chatbot.AiModelService.AiConfig;
import com.rms.chatbot.ChatbotConfigService.Config;
import com.rms.chatbot.GeminiClient;
import com.rms.ordering.MenuAssistant.Reply;
import com.rms.ordering.MenuAssistant.Suggestion;
import com.rms.ordering.QrOrderingService.Menu;
import com.rms.ordering.QrOrderingService.MenuDish;
import com.rms.ordering.QrOrderingService.MenuSet;
import java.time.Duration;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * Trợ lý gọi món bằng Google Gemini. Gửi kèm thực đơn HÔM NAY (chỉ món đang bán, chưa hết, được bật "cho AI gợi ý"),
 * FAQ, giỏ món và vài câu hỏi trước; Gemini trả JSON {text, items[{id, qty, note}], chips, plan, answered}.
 *
 * <p>An toàn: món Gemini nêu mà không có trong thực đơn gửi đi thì bỏ; giá luôn lấy từ CSDL (khung chat tra theo id).
 * Trả null khi không dùng được (tắt, thiếu key, quá số câu / phút của bàn, lỗi mạng, JSON sai) → dùng bộ trả lời theo luật.
 */
@Component
public class GeminiAssistant {
    private static final Logger log = LoggerFactory.getLogger(GeminiAssistant.class);
    static final int PER_TABLE_PER_MINUTE = 8;
    static final Duration TIMEOUT = Duration.ofSeconds(12);

    record FaqPair(String question, String answer) {}

    /** Kết quả từ Gemini; answered = false → nên ghi "Câu hỏi chưa giải đáp". */
    record AiResult(Reply reply, boolean answered) {}

    private final AiModelService ai;
    private final GeminiClient gemini;
    private final ObjectMapper json;
    private final Map<String, Deque<Long>> calls = new ConcurrentHashMap<>();

    public GeminiAssistant(AiModelService ai, GeminiClient gemini, ObjectMapper json) {
        this.ai = ai;
        this.gemini = gemini;
        this.json = json;
    }

    /** Quá {@value #PER_TABLE_PER_MINUTE} câu / phút cho một bàn → không gọi Gemini (tránh bị phá làm cạn lượt miễn phí). */
    private boolean allow(String token) {
        long now = System.currentTimeMillis();
        Deque<Long> q = calls.computeIfAbsent(token, k -> new ArrayDeque<>());
        synchronized (q) {
            while (!q.isEmpty() && now - q.peekFirst() > 60_000) q.pollFirst();
            if (q.size() >= PER_TABLE_PER_MINUTE) return false;
            q.addLast(now);
            return true;
        }
    }

    AiResult answer(String token, Menu menu, List<MenuDish> available, List<FaqPair> faqs, Config bot, String message,
                    List<String> history, List<String> cart, Long budget, MenuAssistant.Site site) {
        AiConfig cfg = ai.get();
        if (!ai.usable(cfg) || !allow(token)) return null;
        String key = ai.key(cfg.apiKeyRef()).orElse(null);
        if (key == null) return null;
        try {
            String raw = gemini.generate(key, cfg.modelName(), system(bot, cfg, menu, site), user(menu, available, faqs, message, history, cart, budget, site),
                // Tối thiểu 2048: mô hình Gemini mới có phần "suy nghĩ" tính vào giới hạn, 1024 dễ bị cắt cụt JSON.
                cfg.temperature(), Math.max(cfg.maxTokens(), 2048), schema(), TIMEOUT);
            AiResult res = parse(raw, menu, available, site != null);
            // Mô hình hay cộng sai: máy chủ tự cộng; vượt ngân sách khách nêu → dùng bộ theo luật (luôn đúng ngân sách).
            if (res != null && budget != null) {
                long total = total(res.reply().items(), menu);
                if (total > budget) {
                    log.info("Gemini gợi ý {}đ > ngân sách {}đ — dùng trả lời theo luật", total, budget);
                    return null;
                }
            }
            return res;
        } catch (GeminiClient.GeminiException e) {
            log.warn("Gemini lỗi ({}): {} — dùng trả lời theo luật", e.status(), e.getMessage());
            return null;
        } catch (Exception e) {
            log.warn("Gemini trả kết quả không đọc được: {} — dùng trả lời theo luật", e.getMessage());
            return null;
        }
    }

    /* ----------------------------------------------------------------------- Lời nhắn hệ thống */

    private static String system(Config bot, AiConfig cfg, Menu menu, MenuAssistant.Site site) {
        String tone = switch (bot.tone() == null ? "" : bot.tone()) {
            case "professional" -> "lịch sự, chuyên nghiệp";
            case "playful" -> "vui vẻ, dí dỏm, có thể dùng emoji vừa phải";
            default -> "thân thiện, gần gũi";
        };
        StringBuilder sb = new StringBuilder();
        if (site != null) {
            // Website khách hàng: khách đang tham khảo trước khi tới quán — không có bàn, không có giỏ món.
            sb.append("Bạn là ").append(bot.botName()).append(", trợ lý tư vấn trên website của nhà hàng ").append(site.name())
                .append(". Khách đang xem thực đơn trước khi tới quán.\n");
            sb.append("Giọng điệu: ").append(tone).append(". Luôn trả lời bằng tiếng Việt, ngắn gọn (tối đa khoảng 80 từ).\n");
            if (bot.personality() != null && !bot.personality().isBlank()) sb.append("Tính cách: ").append(bot.personality()).append('\n');
            sb.append("""
                QUY TẮC BẮT BUỘC:
                1. Chỉ gợi ý món có trong THỰC ĐƠN ở tin nhắn; dùng đúng "id" của món. Không bịa món, không bịa giá, không hứa khuyến mãi.
                   Set menu có id dạng "set:<số>". Giá có thể thay đổi tại quán.
                2. Trên website KHÔNG gọi món được: khách bấm thẻ món để xem trong thực đơn. Tại quán, khách quét mã QR trên bàn để gọi món và thanh toán.
                3. Khi khách tính tới quán (hỏi đặt bàn, đi nhóm, tiệc, sinh nhật, thực đơn cho cả nhóm): mời đặt bàn và đặt booking = true.
                4. Khi khách nhắc dị ứng: loại món có chất đó (xem trường "a") và nhắc thêm câu: "%s"
                5. Câu hỏi về nhà hàng (địa chỉ, giờ mở cửa, điện thoại, đậu xe…): dùng THÔNG TIN NHÀ HÀNG và FAQ; không có thông tin thì nói thật và mời gọi hotline.
                6. Câu ngoài phạm vi nhà hàng / ăn uống: từ chối nhẹ nhàng theo ý: "%s".
                7. Khách nêu ngân sách (vd. "dưới 1 triệu", "mỗi người 200k"): TỔNG (giá × qty của mọi món gợi ý) KHÔNG được vượt ngân sách;
                   tự cộng kiểm tra trước khi trả lời và ghi tổng tiền ước tính. Khách xin "rẻ hơn" thì tổng phải thấp hơn lần gợi ý trước.
                8. Gợi ý cho nhóm: nêu số phần hợp lý (lẩu thường cho 2–3 người); có trẻ em thì tránh món cay (trường "s").
                ĐỊNH DẠNG: trả JSON đúng schema.
                  text: câu trả lời (có thể dùng **đậm**, xuống dòng).
                  items: tối đa 6 món gợi ý {id, qty (số phần, mặc định 1), note (lý do ngắn ≤ 6 từ)}; không gợi ý món thì để mảng rỗng.
                  chips: 2–4 câu gợi ý ngắn (≤ 4 từ) khách có thể bấm hỏi tiếp.
                  plan: true nếu bạn đang đưa ra cả một thực đơn cho cả nhóm.
                  booking: true nếu nên hiện nút "Đặt bàn".
                  answered: false nếu bạn không trả lời được câu hỏi.
                """.formatted(bot.allergyDisclaimer(), bot.fallbackMessage()));
            if (!cfg.systemPrompt().isBlank()) sb.append("Hướng dẫn thêm của quản lý: ").append(cfg.systemPrompt()).append('\n');
            return sb.toString();
        }
        sb.append("Bạn là ").append(bot.botName()).append(", trợ lý gọi món của nhà hàng trên trang gọi món tại bàn (khách quét mã QR).\n");
        sb.append("Giọng điệu: ").append(tone).append(". Luôn trả lời bằng tiếng Việt, ngắn gọn (tối đa khoảng 80 từ).\n");
        if (bot.personality() != null && !bot.personality().isBlank()) sb.append("Tính cách: ").append(bot.personality()).append('\n');
        sb.append("""
            QUY TẮC BẮT BUỘC:
            1. Chỉ gợi ý món có trong THỰC ĐƠN HÔM NAY ở tin nhắn; dùng đúng "id" của món. Không bịa món, không bịa giá, không hứa khuyến mãi.
               Set menu có id dạng "set:<số>".
            2. Không tự đặt món: khách tự bấm "Thêm" trên thẻ món bạn gợi ý. Đặt món xong vẫn cần bấm "Xác nhận gọi món".
            3. Khi khách nhắc dị ứng: loại món có chất đó (xem trường "a") và nhắc thêm câu: "%s"
            4. Câu hỏi về nhà hàng (giờ mở cửa, đậu xe, thanh toán…): trả lời theo FAQ nếu có; không có thông tin thì nói thật và gợi ý bấm chuông gọi nhân viên.
            5. Gọi nhân viên: bấm nút chuông ở đầu trang. Thanh toán: "Món của tôi" → "Thanh toán".
            6. Câu ngoài phạm vi nhà hàng / ăn uống: từ chối nhẹ nhàng theo ý: "%s".
            7. Khách nêu ngân sách (vd. "dưới 1 triệu", "mỗi người 200k"): TỔNG (giá × qty của mọi món gợi ý) KHÔNG được vượt ngân sách;
               tự cộng kiểm tra trước khi trả lời và ghi tổng tiền ước tính. Khách xin "rẻ hơn" thì tổng phải thấp hơn lần gợi ý trước.
            8. Gợi ý cho nhóm: nêu số phần hợp lý (lẩu thường cho 2–3 người); có trẻ em thì tránh món cay (trường "s").
            ĐỊNH DẠNG: trả JSON đúng schema.
              text: câu trả lời (có thể dùng **đậm**, xuống dòng).
              items: tối đa 6 món gợi ý {id, qty (số phần, mặc định 1), note (lý do ngắn ≤ 6 từ)}; không gợi ý món thì để mảng rỗng.
              chips: 2–4 câu gợi ý ngắn (≤ 4 từ) khách có thể bấm hỏi tiếp.
              plan: true nếu bạn đang đưa ra cả một thực đơn cho cả bàn (để hiện nút "Thêm tất cả").
              answered: false nếu bạn không trả lời được câu hỏi.
            """.formatted(bot.allergyDisclaimer(), bot.fallbackMessage()));
        if (!cfg.systemPrompt().isBlank()) sb.append("Hướng dẫn thêm của quản lý: ").append(cfg.systemPrompt()).append('\n');
        return sb.toString();
    }

    /* ----------------------------------------------------------------------- Dữ liệu gửi kèm */

    /** Tổng tiền các món gợi ý (giá từ thực đơn, không tin số AI viết). */
    static long total(List<Suggestion> items, Menu menu) {
        Map<String, Long> price = new HashMap<>();
        menu.dishes().forEach((d) -> price.put("dish" + d.id(), d.price()));
        menu.sets().forEach((x) -> price.put("set" + x.id(), x.price()));
        return items.stream().mapToLong((i) -> price.getOrDefault(i.kind() + i.id(), 0L) * i.qty()).sum();
    }

    private String user(Menu menu, List<MenuDish> available, List<FaqPair> faqs, String message, List<String> history, List<String> cart,
                        Long budget, MenuAssistant.Site site) throws Exception {
        Map<String, String> catName = new HashMap<>();
        menu.categories().forEach((c) -> catName.put(c.id(), c.name()));
        Map<String, Integer> rank = new HashMap<>();
        for (int i = 0; i < menu.bestSellers().size(); i++) rank.put(menu.bestSellers().get(i), i + 1);
        List<Map<String, Object>> dishes = new ArrayList<>();
        for (MenuDish d : available) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", d.id());
            m.put("n", d.name());
            m.put("c", catName.getOrDefault(d.categoryId(), ""));
            m.put("p", d.price());
            if (d.spicyLevel() > 0) m.put("s", d.spicyLevel());
            if (!d.tags().isEmpty()) m.put("t", d.tags());
            if (!d.allergens().isEmpty()) m.put("a", d.allergens());
            Integer r = rank.getOrDefault(d.id(), d.groupId() == null ? null : rank.get("g" + d.groupId()));
            if (r != null) m.put("top", r);
            String desc = d.description() == null ? "" : d.description();
            if (!desc.isBlank()) m.put("d", desc.length() > 90 ? desc.substring(0, 90) + "…" : desc);
            dishes.add(m);
        }
        List<Map<String, Object>> sets = new ArrayList<>();
        for (MenuSet s : menu.sets())
            sets.add(Map.of("id", "set:" + s.id(), "n", s.name(), "p", s.price(),
                "gom", s.items().stream().map((i) -> i.qty() + " " + i.name()).toList()));
        Map<String, String> byId = new HashMap<>();
        menu.dishes().forEach((d) -> byId.put(d.id(), d.name()));
        StringBuilder sb = new StringBuilder();
        sb.append("THỰC ĐƠN HÔM NAY (giá VNĐ; s = độ cay 1–3; t = nhãn; a = chất gây dị ứng; top = hạng bán chạy 7 ngày):\n")
            .append(json.writeValueAsString(dishes)).append('\n');
        if (!sets.isEmpty()) sb.append("SET MENU:\n").append(json.writeValueAsString(sets)).append('\n');
        if (!faqs.isEmpty()) {
            sb.append("FAQ CỦA NHÀ HÀNG:\n");
            faqs.forEach((f) -> sb.append("- H: ").append(f.question()).append(" | Đ: ").append(f.answer()).append('\n'));
        }
        if (site != null) {
            sb.append("THÔNG TIN NHÀ HÀNG: tên ").append(site.name());
            if (site.address() != null && !site.address().isBlank()) sb.append("; địa chỉ ").append(site.address());
            if (site.phone() != null && !site.phone().isBlank()) sb.append("; hotline ").append(site.phone());
            if (site.hours() != null && !site.hours().isBlank()) sb.append("; giờ mở cửa: ").append(site.hours().replace('\n', ';'));
            sb.append('\n');
        } else {
            List<String> inCart = cart.stream().map(byId::get).filter(java.util.Objects::nonNull).distinct().toList();
            sb.append("GIỎ MÓN CỦA KHÁCH: ").append(inCart.isEmpty() ? "(trống)" : String.join(", ", inCart)).append('\n');
        }
        if (!history.isEmpty()) sb.append("CÁC CÂU KHÁCH HỎI TRƯỚC (cũ → mới): ").append(String.join(" | ", history)).append('\n');
        if (budget != null)
            sb.append("NGÂN SÁCH TỐI ĐA CỦA KHÁCH: ").append(budget).append(" đ — tổng (giá × qty) mọi món gợi ý phải ≤ con số này.").append('\n');
        sb.append("CÂU HỎI CỦA KHÁCH: ").append(message);
        return sb.toString();
    }

    private static Map<String, Object> schema() {
        Map<String, Object> item = Map.of("type", "OBJECT",
            "properties", Map.of("id", Map.of("type", "STRING"), "qty", Map.of("type", "INTEGER"), "note", Map.of("type", "STRING")),
            "required", List.of("id"));
        return Map.of("type", "OBJECT",
            "properties", Map.of(
                "text", Map.of("type", "STRING"),
                "items", Map.of("type", "ARRAY", "items", item),
                "chips", Map.of("type", "ARRAY", "items", Map.of("type", "STRING")),
                "plan", Map.of("type", "BOOLEAN"),
                "booking", Map.of("type", "BOOLEAN"),
                "answered", Map.of("type", "BOOLEAN")),
            "required", List.of("text", "items", "chips"));
    }

    /* ----------------------------------------------------------------------- Đọc + kiểm tra kết quả */

    private AiResult parse(String raw, Menu menu, List<MenuDish> available, boolean website) throws Exception {
        String s = raw.trim();
        if (s.startsWith("```")) s = s.replaceAll("^```(json)?", "").replaceAll("```$", "").trim();
        JsonNode root = json.readTree(s);
        String text = root.path("text").asText("").trim();
        if (text.isEmpty()) return null;
        if (text.length() > 1500) text = text.substring(0, 1500) + "…";
        Set<String> dishIds = new java.util.HashSet<>(available.stream().map(MenuDish::id).toList());
        Set<String> setIds = new java.util.HashSet<>(menu.sets().stream().map(MenuSet::id).toList());
        List<Suggestion> items = new ArrayList<>();
        Set<String> seen = new java.util.HashSet<>();
        for (JsonNode it : root.path("items")) {
            if (items.size() >= 6) break;
            String id = it.path("id").asText("").trim();
            int qty = Math.max(1, Math.min(20, it.path("qty").asInt(1)));
            String note = it.path("note").asText("").trim();
            if (note.length() > 40) note = note.substring(0, 40);
            if (id.startsWith("set:") && setIds.contains(id.substring(4)) && seen.add(id))
                items.add(new Suggestion("set", id.substring(4), qty, note.isEmpty() ? null : note));
            else if (dishIds.contains(id) && seen.add(id))
                items.add(new Suggestion("dish", id, qty, note.isEmpty() ? null : note));
        }
        List<String> chips = new ArrayList<>();
        for (JsonNode c : root.path("chips")) {
            String v = c.asText("").trim();
            if (!v.isEmpty() && v.length() <= 30 && chips.size() < 4) chips.add(v);
        }
        boolean plan = root.path("plan").asBoolean(false) && items.size() > 1;
        boolean answered = root.path("answered").asBoolean(true);
        List<String> actions = website && root.path("booking").asBoolean(false) ? List.of("reservation") : List.of();
        return new AiResult(new Reply(text, items, chips, plan, "ai", actions), answered);
    }
}
