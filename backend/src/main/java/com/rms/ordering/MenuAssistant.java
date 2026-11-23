package com.rms.ordering;

import com.rms.chatbot.ChatbotConfigService;
import com.rms.chatbot.ChatbotConfigService.Config;
import com.rms.common.BusinessException;
import com.rms.common.Vi;
import com.rms.ordering.QrOrderingService.Menu;
import com.rms.ordering.QrOrderingService.MenuCategory;
import com.rms.ordering.QrOrderingService.MenuDish;
import com.rms.ordering.QrOrderingService.MenuSet;
import java.text.NumberFormat;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.function.Predicate;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;

/**
 * Trợ lý gọi món trên trang QR — DỰA TRÊN LUẬT (không gọi AI bên ngoài, không tốn phí).
 *
 * <p>Đọc câu khách gõ (có dấu hoặc không dấu), rút ra các điều kiện: ngân sách, số người, cay / không cay, chay,
 * trẻ em, món nhẹ, dị ứng, loại món, từ khóa nguyên liệu, tên món cụ thể; rồi lọc thực đơn thật (món đang bán, chưa
 * hết hôm nay) và trả lời kèm danh sách món để khách bấm "Thêm". Không tự thêm vào giỏ — khách luôn bấm xác nhận.
 *
 * <p>Sau này muốn dùng mô hình AI thật (Claude), chỉ cần thay phần thân {@link #reply}: đầu vào / đầu ra giữ nguyên.
 */
@Service
public class MenuAssistant {

    /** history: tối đa 4 câu khách hỏi trước (để hiểu "rẻ hơn", "món khác"); shown: id món đã gợi ý; cart: id món trong giỏ. */
    public record Ask(String message, List<String> history, List<String> shown, List<String> cart, String sessionId) {}

    /** kind = dish | set; qty = số phần gợi ý; note = lý do ngắn hiện dưới tên món. */
    public record Suggestion(String kind, String id, int qty, String note) {}

    /** addAll = hiện nút "Thêm tất cả" (thực đơn đề xuất cho cả bàn); source = ai (Gemini) | rules (theo luật). */
    public record Reply(String text, List<Suggestion> items, List<String> chips, boolean addAll, String source) {}

    static final int MAX_MESSAGE = 300;
    static final int MAX_ITEMS = 5;
    static final List<String> START_CHIPS = List.of("Món bán chạy", "Nhóm 4 người", "Không ăn cay", "Dưới 200k", "Cho trẻ em", "Món nhẹ");

    /** Thông tin hiện ở khung chat — lấy từ Quản lý Chatbot (tên, ảnh đại diện, lời chào, câu gợi ý nhanh, bật / tắt). */
    public record Intro(boolean active, String botName, String avatar, String greeting, List<String> chips) {}

    private record Faq(long id, String question, String answer, Set<String> tokens) {}

    private final QrOrderingService qr;
    private final ChatbotConfigService chatbot;
    private final JdbcClient jdbc;
    private final GeminiAssistant gemini;
    private final ChatLogService chatLog;
    /** Lượt trả lời hiện tại có câu bot không trả lời được (đánh dấu bởi logUnanswered) → lưu hội thoại "fallback". */
    private static final ThreadLocal<Boolean> UNANSWERED = ThreadLocal.withInitial(() -> false);

    public MenuAssistant(QrOrderingService qr, ChatbotConfigService chatbot, JdbcClient jdbc, GeminiAssistant gemini, ChatLogService chatLog) {
        this.chatLog = chatLog;
        this.gemini = gemini;
        this.qr = qr;
        this.chatbot = chatbot;
        this.jdbc = jdbc;
    }

    public Intro intro(String token) {
        qr.info(token);
        Config c = chatbot.config();
        return new Intro(c.active(), c.botName(), c.avatar(), c.greeting(), chips(c));
    }

    public Reply reply(String token, Ask in) {
        UNANSWERED.set(false);
        try {
            Reply r = answer(token, in);
            String q = Vi.collapse(in.message());
            chatLog.record(qr.table(token).id(), in.sessionId(), q.length() > MAX_MESSAGE ? q.substring(0, MAX_MESSAGE) : q, r, UNANSWERED.get());
            return r;
        } finally {
            UNANSWERED.remove();
        }
    }

    private Reply answer(String token, Ask in) {
        String message = Vi.collapse(in == null ? "" : in.message());
        if (message.isEmpty()) throw new BusinessException("Bạn hãy nhập câu hỏi");
        if (message.length() > MAX_MESSAGE) message = message.substring(0, MAX_MESSAGE);
        Menu menu = qr.menu(token);
        Config config = chatbot.config();
        if (!config.active()) throw new BusinessException("Trợ lý gọi món đang tạm tắt — bạn bấm chuông để gọi nhân viên nhé", HttpStatus.CONFLICT);
        // Chỉ gợi ý món Quản lý đã bật "cho AI gợi ý" (Quản lý Chatbot → Thực đơn)
        Set<String> aiIds = new HashSet<>(jdbc.sql("SELECT id FROM dishes WHERE ai_enabled = 1").query(Long.class).list()
            .stream().map(String::valueOf).toList());
        List<Faq> faqs = jdbc.sql("SELECT id, question, answer FROM faqs WHERE is_active = 1")
            .query((rs, n) -> new Faq(rs.getLong("id"), rs.getString("question"), rs.getString("answer"), faqTokens(rs.getString("question"))))
            .list();
        // Có Gemini (đang bật + có key) → hỏi Gemini; không dùng được / lỗi → trả lời theo luật như cũ.
        List<QrOrderingService.MenuDish> available = menu.dishes().stream().filter((d) -> !d.soldOut() && aiIds.contains(d.id())).toList();
        List<String> history = safe(in.history()).stream().limit(4).toList();
        GeminiAssistant.AiResult ai = gemini.answer(token, menu, available,
            faqs.stream().map((f) -> new GeminiAssistant.FaqPair(f.question(), f.answer())).toList(), config, message,
            history, safe(in.cart()), budgetOf(message, history));
        if (ai != null) {
            if (!ai.answered()) logUnanswered(message);
            return ai.reply();
        }
        return new Turn(menu, message, safe(in.history()), safe(in.shown()), safe(in.cart()), config, aiIds, faqs).answer();
    }

    /**
     * Ngân sách khách nêu (tổng tiền tối đa, đ) — đọc bằng bộ phân tích câu theo luật: câu hiện tại, không có thì câu trước gần nhất.
     * "mỗi người 200k" + "4 người" → 800.000đ. null = không nêu.
     */
    static Long budgetOf(String message, List<String> history) {
        List<String> texts = new ArrayList<>(List.of(message));
        for (int i = history.size() - 1; i >= 0; i--) texts.add(history.get(i));
        Integer party = null;
        for (String t : texts) {
            Need n = parse(t);
            if (party == null) party = n.party;
            if (n.maxPrice != null) {
                Integer p = n.party != null ? n.party : party;
                return n.perPerson && p != null ? n.maxPrice * p : n.maxPrice;
            }
        }
        return null;
    }

    private static List<String> chips(Config c) {
        return c.quickReplies() == null || c.quickReplies().isEmpty() ? START_CHIPS : c.quickReplies();
    }

    /** Câu khách không trả lời được → "Câu hỏi chưa giải đáp" (Quản lý Chatbot), cùng câu thì cộng số lần hỏi. */
    private void logUnanswered(String message) {
        UNANSWERED.set(true);
        String q = message.length() > 300 ? message.substring(0, 300) : message;
        int n = jdbc.sql("UPDATE unanswered_questions SET asked_count = asked_count + 1, last_asked_at = NOW() WHERE status = 'open' AND question = ?")
            .param(q).update();
        if (n == 0) jdbc.sql("INSERT INTO unanswered_questions (question) VALUES (?)").param(q).update();
    }

    /* ----------------------------------------------------------------------- FAQ */

    private static final Set<String> FAQ_GENERIC = Set.of("nha", "hang", "co", "khong", "the", "duoc", "la", "gi", "nao", "toi", "minh",
        "cho", "em", "anh", "chi", "oi", "vay", "ha", "khach", "quy", "mon", "an", "a", "u", "nhe", "voi", "va", "hay", "ko", "k");

    static Set<String> faqTokens(String s) {
        Set<String> t = new LinkedHashSet<>();
        for (String w : norm(s).trim().split(" ")) if (w.length() >= 2 && !FAQ_GENERIC.contains(w)) t.add(w);
        return t;
    }

    private static List<String> safe(List<String> l) {
        return l == null ? List.of() : l.stream().filter(Objects::nonNull).limit(30).toList();
    }

    /* ======================================================================= Hiểu câu hỏi */

    /** Điều kiện rút ra từ câu khách. null / false = không nói tới. */
    static final class Need {
        Long maxPrice;
        Long minPrice;
        boolean perPerson;
        Integer party;
        Boolean spicy;          // true = muốn cay, false = không / ít cay
        boolean veg, kids, light, premium, best, combo, noBeef;
        final Set<String> allergens = new LinkedHashSet<>();
        final Set<String> cats = new LinkedHashSet<>();   // tiền tố tên danh mục đã bỏ dấu
        final List<String> words = new ArrayList<>();     // từ khóa nguyên liệu / tên

        boolean hasFilter() {
            return maxPrice != null || minPrice != null || spicy != null || veg || kids || light || noBeef || !allergens.isEmpty();
        }

        boolean hasSubject() {
            return hasCoreSubject() || !words.isEmpty();
        }

        boolean hasCoreSubject() {
            return party != null || premium || best || combo || !cats.isEmpty();
        }

        /** Gộp điều kiện câu trước vào (câu hiện tại được ưu tiên). */
        void inherit(Need old) {
            if (maxPrice == null) maxPrice = old.maxPrice;
            if (minPrice == null) minPrice = old.minPrice;
            if (party == null) { party = old.party; perPerson = perPerson || old.perPerson; }
            if (spicy == null) spicy = old.spicy;
            veg |= old.veg; kids |= old.kids; light |= old.light; noBeef |= old.noBeef;
            allergens.addAll(old.allergens);
            if (!hasCoreSubject()) {
                premium = old.premium; best = old.best; combo = old.combo;
                cats.addAll(old.cats);
                words.addAll(old.words);
            }
        }
    }

    private static final Map<String, Integer> NUMBER_WORDS = Map.ofEntries(
        Map.entry("mot", 1), Map.entry("hai", 2), Map.entry("ba", 3), Map.entry("bon", 4), Map.entry("tu", 4),
        Map.entry("nam", 5), Map.entry("sau", 6), Map.entry("bay", 7), Map.entry("tam", 8), Map.entry("chin", 9),
        Map.entry("muoi", 10));

    private static final Pattern MONEY = Pattern.compile("(\\d+(?:[.,]\\d+)?)\\s*(k|ka|nghin|ngan|tr|trieu|cu|d|dong|vnd|000)?(?![a-z0-9])");
    private static final Pattern PARTY = Pattern.compile("(\\d+|mot|hai|ba|bon|tu|nam|sau|bay|tam|chin|muoi)\\s*(nguoi|khach|dua|thanh vien)(?![a-z])");

    /** Danh mục: tiền tố tên danh mục (bỏ dấu) ← từ khóa trong câu. Thứ tự quan trọng: đồ uống xét trước tráng miệng. */
    private static final Map<String, List<String>> CATEGORY_WORDS = new LinkedHashMap<>();

    static {
        CATEGORY_WORDS.put("do uong", List.of("do uong", "nuoc uong", "thuc uong", "uong gi", "uong", "bia", "vang", "ruou", "nuoc ngot",
            "soda", "coca", "pepsi", "tra", "nuoc ep", "giai khat", "nuoc suoi", "sprite", "fanta"));
        CATEGORY_WORDS.put("lau", List.of("lau", "shabu", "nhung"));
        CATEGORY_WORDS.put("bit tet", List.of("bit tet", "bittet", "beefsteak", "steak", "bo bit", "tomahawk", "ribeye", "t bone", "tbone",
            "tenderloin", "striploin", "than ngoai", "than noi"));
        CATEGORY_WORDS.put("bo nuong", List.of("nuong", "ap chao", "bbq", "luc lac"));
        CATEGORY_WORDS.put("mon nuoc", List.of("mon nuoc", "pho", "bun bo", "bun", "hu tieu", "bo kho", "nuoc dung"));
        CATEGORY_WORDS.put("com", List.of("com", "mi", "my", "burger", "hamburger", "spaghetti", "mi y", "my y", "no bung"));
        CATEGORY_WORDS.put("trang mieng", List.of("trang mieng", "dessert", "do ngot", "mon ngot", "kem", "flan", "che", "banh ngot"));
        CATEGORY_WORDS.put("khai vi", List.of("khai vi", "mon dau", "an choi", "appetizer", "sup", "salad", "goi bo", "an vat"));
    }

    /** Dị ứng: tên dị ứng trong CSDL (bỏ dấu, tiền tố) ← từ khóa. */
    private static final Map<String, List<String>> ALLERGEN_WORDS = new LinkedHashMap<>();

    static {
        ALLERGEN_WORDS.put("dau phong", List.of("dau phong", "lac"));
        ALLERGEN_WORDS.put("dau nanh", List.of("dau nanh", "dau hu", "dau phu", "tau hu", "tuong"));
        ALLERGEN_WORDS.put("gluten", List.of("gluten", "lua mi", "bot mi"));
        ALLERGEN_WORDS.put("hai san", List.of("hai san", "tom", "cua", "so", "oc", "muc", "ghe"));
        ALLERGEN_WORDS.put("hat cay", List.of("hat", "oc cho", "hanh nhan", "dieu", "macca"));
        ALLERGEN_WORDS.put("me", List.of("me", "vung"));
        ALLERGEN_WORDS.put("sua", List.of("sua", "lactose", "pho mai", "phomai", "bo sua", "kem sua"));
        ALLERGEN_WORDS.put("trung", List.of("trung"));
        ALLERGEN_WORDS.put("ca", List.of("ca"));
    }

    private static final Pattern AVOID = Pattern.compile("(di ung|khong an duoc|khong an|kieng|tranh|khong dung duoc|khong co|bi ung|ky)\\s+((?:\\S+\\s*){1,3})");

    private static final Set<String> STOP = Set.copyOf(List.of(
        "toi", "minh", "em", "anh", "chi", "ban", "cho", "muon", "can", "goi", "mon", "mon an", "an", "gi", "nao", "co", "khong", "duoc",
        "nhe", "nha", "a", "ah", "oi", "voi", "va", "hay", "la", "de", "nay", "kia", "do", "thi", "ma", "nhung", "cac", "nhieu", "it",
        "hon", "rat", "qua", "lam", "mot", "the", "sao", "vay", "nhi", "ha", "u", "dang", "con", "khac", "nua", "them", "lay", "dat",
        "xin", "giup", "goi y", "tu van", "quan", "nha hang", "hom nay", "ngon", "nguoi", "bao", "nhieu", "tien", "gia", "duoi", "tren",
        "khoang", "tam", "tren", "k", "nghin", "ngan", "dong", "ok", "oke", "uh", "um", "vang", "da", "chao", "hello", "hi", "xin chao",
        "biet", "xem", "thu", "nhat", "loai", "kieu", "thoi", "luon", "di", "duoc khong", "giup minh", "minh voi", "cung", "deu", "chut", "tot", "nen", "dac", "biet", "ve", "phan", "suat", "dia", "to", "ly", "chai", "lon", "nao", "dau", "ai", "khi",
        // từ đã dùng cho điều kiện khác (tiền, cay, chay, trẻ em, dị ứng, gọi nhân viên…)
        "trieu", "cu", "vnd", "moi", "cay", "chay", "ot", "nhe", "tre", "nit", "be", "chau", "sua", "di", "ung", "kieng", "tranh",
        "nhom", "dinh", "nhan", "vien", "phuc", "thanh", "toan", "hai", "bon", "nam", "sau", "bay", "muoi", "vo", "chong", "re", "dat",
        "sang", "trong", "cao", "cap", "set", "combo", "menu", "thuc", "nhat", "tet", "bit", "uong", "an", "ngon", "hon", "tuoi"));

    /** Bỏ dấu, đổi dấu câu thành khoảng trắng, đệm hai đầu để so khớp cả từ: " kw ". */
    static String norm(String s) {
        return " " + Vi.normalize(s).replaceAll("[^a-z0-9]+", " ").trim() + " ";
    }

    static boolean has(String n, String kw) {
        return n.contains(" " + kw + " ");
    }

    static boolean any(String n, String... kws) {
        for (String k : kws) if (has(n, k)) return true;
        return false;
    }

    static Need parse(String raw) {
        Need need = new Need();
        String lower = raw.toLowerCase(Locale.ROOT);
        String n = norm(raw);
        // "bán chạy" bỏ dấu = "ban chay" — trùng chữ "chay"; tách ra trước.
        if (any(n, "ban chay", "chay nhat", "chay hang", "hot", "noi tieng", "best seller", "ngon nhat", "pho bien", "nhieu nguoi goi",
            "duoc yeu thich", "dac san", "signature", "mon tu", "mon ruot", "ngon")) need.best = true;
        n = n.replace(" ban chay ", " ").replace(" chay nhat ", " ").replace(" chay hang ", " ");

        // Số người
        Matcher pm = PARTY.matcher(n);
        if (pm.find()) {
            String v = pm.group(1);
            int p = v.chars().allMatch(Character::isDigit) ? Integer.parseInt(v) : NUMBER_WORDS.getOrDefault(v, 0);
            if (p > 0 && p <= 40) need.party = p;
        } else if (any(n, "gia dinh", "ca nha")) need.party = 4;
        else if (any(n, "cap doi", "hen ho", "vo chong", "hai dua", "hai vo chong")) need.party = 2;
        else if (any(n, "mot minh", "an mot minh")) need.party = 1;
        else if (any(n, "nhom", "ban be", "tiec", "lien hoan", "dong nguoi")) need.party = 4;
        need.perPerson = any(n, "moi nguoi", "dau nguoi", "1 nguoi", "mot nguoi");

        // Ngân sách: số có đơn vị tiền, hoặc số đứng sau "dưới / khoảng / tầm / giá"
        // Chuỗi riêng cho tiền: giữ dấu chấm / phẩy giữa các chữ số ("1.500.000", "1,5 triệu").
        String money = " " + Vi.normalize(raw).replaceAll("(\\d)[.,](?=\\d{3}(\\D|$))", "$1").replaceAll("[^a-z0-9.,]+", " ").trim() + " ";
        Matcher mm = MONEY.matcher(money);
        while (mm.find()) {
            String unit = mm.group(2);
            double v;
            try { v = Double.parseDouble(mm.group(1).replace(',', '.')); } catch (NumberFormatException e) { continue; }
            String after = money.substring(mm.end());
            if (after.matches("^\\s*(nguoi|khach|g|gr|gram|kg|ml|lit|phan|suat|mon|dia|to|ly|chai|lon|cai|ban|dua|thanh vien|lan|tieng|phut|gio|nam|tuoi).*")) continue;
            String before = money.substring(0, mm.start());
            boolean below = before.matches(".*\\s(duoi|re hon|it hon|khong qua|toi da|chi|khoang|tam|gia|ngan sach|co|bo ra|max)\\s$");
            boolean above = !below && before.matches(".*\\s(tren|hon|tu|it nhat|min)\\s$");
            long amount;
            if (unit == null) {
                if (v >= 10_000) amount = (long) v;
                else if ((below || above) && v >= 10 && v < 10_000) amount = (long) (v * 1000);
                else continue;
            } else if (unit.equals("tr") || unit.equals("trieu") || unit.equals("cu")) amount = (long) (v * 1_000_000);
            else if (unit.equals("d") || unit.equals("dong") || unit.equals("vnd")) amount = v < 10_000 ? (long) (v * 1000) : (long) v;
            else amount = (long) (v * 1000);
            if (amount < 5_000 || amount > 100_000_000) continue;
            if (above) need.minPrice = amount;
            else need.maxPrice = amount;
        }
        if (need.maxPrice == null && !any(n, "re hon") && any(n, "re", "binh dan", "tiet kiem", "it tien", "sinh vien", "hop tui")) need.maxPrice = 150_000L;

        // Cay
        if (any(n, "khong cay", "it cay", "khong an cay", "so cay", "khong an duoc cay", "cay nhe", "khong qua cay", "khong biet an cay")) need.spicy = false;
        else if (any(n, "cay", "sa te", "ot")) need.spicy = true;

        // Chay: tránh "chạy" / "cháy" (khách gõ có dấu); không dấu thì coi "chay" là món chay.
        if (has(n, "chay") && !lower.contains("chạy") && !lower.contains("cháy") || any(n, "an chay", "mon chay", "do chay", "thuan chay", "vegan", "vegetarian"))
            need.veg = true;
        if (any(n, "khong an thit", "khong thit")) need.veg = true;
        if (any(n, "khong an bo", "khong an thit bo", "kieng bo", "khong bo")) need.noBeef = true;

        need.kids = any(n, "tre em", "tre con", "con nit", "em be", "be", "cac be", "chau", "con toi", "con minh", "thieu nhi", "kid", "kids", "nho tuoi");
        need.light = any(n, "an nhe", "mon nhe", "nhe bung", "it dau mo", "it beo", "giam can", "an kieng", "healthy", "lanh manh", "thanh dam", "khong ngan", "it calo", "eat clean");
        need.premium = any(n, "sang trong", "sang chanh", "cao cap", "dac biet", "xin xo", "mon xin", "wagyu", "dang tien", "dat nhat", "thuong hang", "ky niem", "sinh nhat", "chieu dai", "vip");
        need.combo = any(n, "set", "combo", "thuc don", "menu", "goi chung", "tron goi");

        // Dị ứng / kiêng
        Matcher am = AVOID.matcher(n.trim());
        while (am.find()) {
            String tail = " " + am.group(2).trim() + " ";
            ALLERGEN_WORDS.forEach((name, kws) -> kws.forEach((k) -> { if (has(tail, k)) need.allergens.add(name); }));
            if (any(tail, "bo", "thit bo")) need.noBeef = true;
        }

        // Danh mục
        String forCats = n.replace(" nuoc ngot ", " do uong ");
        CATEGORY_WORDS.forEach((cat, kws) -> {
            for (String k : kws) if (has(forCats, k)) { need.cats.add(cat); break; }
        });
        // "món nước" (phở) khác "nước" (đồ uống); "ăn nhẹ" không phải đồ uống
        if (any(n, "an kem", "kem theo", "di kem")) need.cats.remove("trang mieng");
        if (has(n, "mon nuoc")) need.cats.remove("do uong");

        // Từ khóa còn lại (nguyên liệu: wagyu, tôm, nấm…) — bỏ từ dừng, số, từ đã dùng cho danh mục
        Set<String> used = new HashSet<>();
        CATEGORY_WORDS.values().forEach((l) -> l.forEach((k) -> used.addAll(List.of(k.split(" ")))));
        for (String w : n.trim().split(" ")) {
            if (w.length() < 3 || STOP.contains(w) || used.contains(w) || w.chars().anyMatch(Character::isDigit)) continue;
            need.words.add(w);
        }
        return need;
    }

    /* ======================================================================= Trả lời */

    private static final NumberFormat VND = NumberFormat.getIntegerInstance(Locale.forLanguageTag("vi-VN"));

    static String vnd(long v) {
        return VND.format(v) + "đ";
    }

    private final class Turn {
        final Menu menu;
        final String raw;
        final String n;
        final List<String> history;
        final Set<String> shown;
        final List<String> cart;
        final Config config;
        final List<Faq> faqs;
        final List<String> startChips;
        final Map<String, String> catName = new HashMap<>();       // id → tên
        final Map<String, String> catKey = new HashMap<>();        // id → tên bỏ dấu
        final Map<String, Integer> rank = new HashMap<>();
        /** Món được gợi ý: đang bán, chưa hết hôm nay, Quản lý bật "cho AI gợi ý". */
        final List<MenuDish> available;

        Turn(Menu menu, String raw, List<String> history, List<String> shown, List<String> cart, Config config, Set<String> aiIds, List<Faq> faqs) {
            this.menu = menu;
            this.raw = raw;
            this.n = norm(raw);
            this.history = history;
            this.shown = new HashSet<>(shown);
            this.cart = cart;
            this.config = config;
            this.faqs = faqs;
            this.startChips = chips(config);
            for (MenuCategory c : menu.categories()) { catName.put(c.id(), c.name()); catKey.put(c.id(), Vi.normalize(c.name())); }
            List<String> best = menu.bestSellers();
            for (int i = 0; i < best.size(); i++) rank.put(best.get(i), i);
            available = menu.dishes().stream().filter((d) -> !d.soldOut() && aiIds.contains(d.id())).toList();
        }

        /** FAQ khớp nhất: ≥ 2 từ chung và ≥ 50% từ của câu FAQ (≥ 75% khi câu đang nói về món ăn). */
        Faq matchFaq(boolean aboutFood) {
            Set<String> mine = faqTokens(raw);
            Faq best = null;
            double bestScore = 0;
            for (Faq f : faqs) {
                if (f.tokens().isEmpty()) continue;
                long hit = f.tokens().stream().filter(mine::contains).count();
                double score = (double) hit / f.tokens().size();
                if (hit >= 2 && score >= (aboutFood ? 0.75 : 0.5) && score > bestScore) { best = f; bestScore = score; }
            }
            return best;
        }

        Reply fallback() {
            logUnanswered(raw);
            return reply(config.fallbackMessage() + "\nBạn cũng có thể hỏi kiểu: *\"2 người dưới 500k\"*, *\"món không cay cho bé\"*, *\"lẩu nào ngon\"*.", List.of(), startChips);
        }

        int rankOf(MenuDish d) {
            Integer r = rank.get(d.id());
            if (r == null && d.groupId() != null) r = rank.get("g" + d.groupId());
            if (r == null && d.tags().stream().anyMatch((t) -> Vi.normalize(t).equals("ban chay"))) r = 50;
            return r == null ? 100 : r;
        }

        boolean inCat(MenuDish d, String prefix) {
            return catKey.getOrDefault(d.categoryId(), "").startsWith(prefix);
        }

        boolean tagged(MenuDish d, String tag) {
            return d.tags().stream().anyMatch((t) -> Vi.normalize(t).equals(tag));
        }

        String text(MenuDish d) {
            return norm(d.name() + " " + d.description() + " " + d.ingredients());
        }

        boolean isBeef(MenuDish d) {
            String t = norm(d.name() + " " + d.ingredients());
            return any(t, "bo", "wagyu", "ribeye", "tomahawk", "t bone", "striploin", "tenderloin", "patty");
        }

        boolean isAddon(MenuDish d) {
            return inCat(d, "goi them");
        }

        boolean isDrink(MenuDish d) {
            return inCat(d, "do uong");
        }

        boolean isMain(MenuDish d) {
            return inCat(d, "bit tet") || inCat(d, "bo nuong") || inCat(d, "lau") || inCat(d, "mon nuoc") || inCat(d, "com");
        }

        Predicate<MenuDish> filter(Need need) {
            return (d) -> {
                if (need.maxPrice != null && d.price() > need.maxPrice) return false;
                if (need.minPrice != null && d.price() < need.minPrice) return false;
                if (Boolean.TRUE.equals(need.spicy) && d.spicyLevel() < 1 && !tagged(d, "cay")) return false;
                if (Boolean.FALSE.equals(need.spicy) && (d.spicyLevel() > 1 || tagged(d, "cay"))) return false;
                if (need.veg && !tagged(d, "chay")) return false;
                if (need.noBeef && isBeef(d)) return false;
                if (need.kids && !tagged(d, "tre em thich") && !(d.spicyLevel() == 0 && (inCat(d, "trang mieng") || inCat(d, "com")))) return false;
                if (need.light && !tagged(d, "mon nhe") && !tagged(d, "it dau mo")) return false;
                for (String a : need.allergens)
                    if (d.allergens().stream().anyMatch((x) -> Vi.normalize(x).startsWith(a))) return false;
                return true;
            };
        }

        /** Phân tích câu + chỉ giữ từ khóa có xuất hiện trong thực đơn (bỏ chữ thừa như "giúp", "với"). */
        Need parseHere(String text) {
            Need x = parse(text);
            x.words.removeIf((w) -> menu.dishes().stream().noneMatch((d) -> has(text(d), w)));
            return x;
        }

        Reply answer() {
            Need need = parseHere(raw);

            // 0) Câu hỏi thường gặp do Quản lý nhập (giờ mở cửa, đậu xe, VAT…)
            Faq faq = matchFaq(need.hasCoreSubject() || namedDish() != null);
            if (faq != null) return reply(faq.answer(), List.of(), startChips);

            if (any(n, "goi nhan vien", "nhan vien", "phuc vu", "ho tro", "giup do") && !need.hasCoreSubject() && !need.hasFilter())
                return reply("Bạn bấm nút **chuông** ở góc trên trang để gọi nhân viên nhé — nhân viên khu vực của bàn sẽ tới ngay.", List.of(), startChips);
            if (any(n, "thanh toan", "tinh tien", "hoa don", "tra tien", "chuyen khoan") && !need.hasCoreSubject())
                return reply("Khi dùng bữa xong, bạn mở **Món của tôi** → **Thanh toán** để chọn tiền mặt, thẻ hoặc chuyển khoản. Thu ngân sẽ mang hóa đơn tới bàn.", List.of(), startChips);
            if (any(n, "wifi", "mat khau", "pass"))
                return reply("Mình chưa có thông tin WiFi — bạn bấm chuông gọi nhân viên để được hỗ trợ nhé.", List.of(), startChips);
            if (any(n, "di ung", "bi ung") && need.allergens.isEmpty() && !need.hasCoreSubject())
                return reply("Bạn bị dị ứng với thành phần nào ạ? Mình sẽ lọc các món có chứa thành phần đó.\n_" + config.allergyDisclaimer() + "_",
                    List.of(), List.of("Dị ứng đậu phộng", "Dị ứng hải sản", "Dị ứng sữa", "Dị ứng trứng", "Dị ứng gluten", "Dị ứng mè"));
            if (any(n, "cam on", "thanks", "thank"))
                return reply("Dạ không có gì! Chúc bạn ngon miệng. Cần gợi ý thêm cứ hỏi mình nhé.", List.of(), List.of("Tráng miệng", "Đồ uống", "Ăn kèm gì?"));

            // 1) Hỏi về một món cụ thể
            MenuDish named = namedDish();
            if (named != null && !any(n, "giong", "tuong tu")) return about(named, need);
            MenuSet namedSet = namedSet();
            if (namedSet != null) return aboutSet(namedSet);

            // 2) Ăn kèm theo giỏ
            if (any(n, "an kem", "kem theo", "di kem", "hop voi", "goi them gi", "them gi", "uong gi hop", "nen goi them", "thieu gi", "du chua", "gio hang", "gio cua"))
                return pairing();

            // 3) Chào / không rõ ý
            boolean refine = any(n, "re hon", "mon khac", "khac", "con gi", "con mon", "nua", "them mon", "doi mon", "dat hon", "it tien hon");
            if (!need.hasSubject() && !need.hasFilter() && !refine) {
                if (any(n, "chao", "hello", "hi", "alo", "xin chao", "hey") || n.isBlank() || any(n, "goi y", "tu van", "an gi", "nen an", "giup"))
                    return bestReply(need, config.greeting() + "\nĐây là các món được gọi nhiều — hoặc bạn cho mình biết **số người, ngân sách, khẩu vị** để mình gợi ý sát hơn nhé.");
                return fallback();
            }

            // Câu nối tiếp ("rẻ hơn", "không cay", "món khác") → giữ điều kiện các câu trước
            if ((refine || !need.hasCoreSubject()) && !history.isEmpty()) {
                for (int i = history.size() - 1; i >= 0; i--) need.inherit(parseHere(history.get(i)));  // mới nhất trước
            }
            boolean cheaper = any(n, "re hon", "it tien hon", "mem hon");
            boolean pricier = any(n, "dat hon", "sang hon", "ngon hon");
            boolean other = refine;

            // 4) Thực đơn cho cả bàn
            if (need.party != null && need.party >= 2 && need.cats.isEmpty() && need.words.isEmpty() && !need.combo)
                return planFor(need);

            // 5) Lọc thực đơn
            if (cheaper) {
                long min = shownPrices().stream().mapToLong(Long::longValue).min().orElse(0);
                if (min > 0) need.maxPrice = Math.min(need.maxPrice == null ? Long.MAX_VALUE : need.maxPrice, min - 1);
            }
            if (pricier) {
                long max = shownPrices().stream().mapToLong(Long::longValue).max().orElse(0);
                if (max > 0) { need.minPrice = max + 1; need.maxPrice = null; }
            }
            return listReply(need, other);
        }

        List<Long> shownPrices() {
            return available.stream().filter((d) -> shown.contains(d.id())).map(MenuDish::price).toList();
        }

        /* ------------------------------------------------ Tên món cụ thể */

        static String core(String name) {
            return norm(name.replaceAll("\\(.*?\\)", " ").replaceAll("\\d+(?:[.,]\\d+)?\\s*(g|kg|ml|l)\\b", " "));
        }

        /** Món mà câu khách nhắc tên (khớp ≥ 75% các chữ trong tên, ít nhất 2 chữ hoặc tên riêng 1 chữ dài). */
        MenuDish namedDish() {
            MenuDish best = null;
            double bestScore = 0;
            for (MenuDish d : menu.dishes()) {
                String[] parts = core(d.name()).trim().split(" ");
                if (parts.length == 0) continue;
                long hit = java.util.Arrays.stream(parts).filter((p) -> has(n, p)).count();
                double score = (double) hit / parts.length;
                boolean ok = parts.length == 1 ? hit == 1 && parts[0].length() >= 5 : hit >= 2 && score >= 0.6 || hit >= 3 && score >= 0.5;
                if (n.contains(core(d.name()))) { score = 2; ok = true; }
                if (ok && (score > bestScore || score == bestScore && best != null && d.name().length() < best.name().length())) { best = d; bestScore = score; }
            }
            return best;
        }

        MenuSet namedSet() {
            for (MenuSet s : menu.sets()) {
                String c = core(s.name());
                if (c.trim().length() >= 4 && n.contains(c)) return s;
            }
            return null;
        }

        Reply about(MenuDish d, Need need) {
            StringBuilder sb = new StringBuilder();
            sb.append("**").append(d.name()).append("** — ").append(vnd(d.price())).append(" (").append(catName.getOrDefault(d.categoryId(), "")).append(").");
            if (d.soldOut()) sb.append("\n⚠️ Món này **tạm hết hôm nay** rồi ạ.");
            if (!d.description().isBlank()) sb.append("\n").append(d.description());
            if (!d.ingredients().isBlank()) sb.append("\nThành phần: ").append(d.ingredients()).append('.');
            sb.append("\nĐộ cay: ").append(List.of("không cay", "cay nhẹ", "cay vừa", "rất cay").get(Math.max(0, Math.min(3, d.spicyLevel())))).append('.');
            sb.append(d.allergens().isEmpty() ? " Không ghi nhận chất gây dị ứng phổ biến." : " Có chứa: " + String.join(", ", d.allergens()) + '.');
            for (String a : need.allergens)
                if (d.allergens().stream().anyMatch((x) -> Vi.normalize(x).startsWith(a)))
                    sb.append("\n⚠️ Món này **có thành phần bạn cần tránh** — bạn cân nhắc nhé.");
            if (rankOf(d) < 10) sb.append("\n🔥 Đang nằm trong top bán chạy tuần này.");
            List<Suggestion> items = new ArrayList<>();
            if (!d.soldOut()) items.add(new Suggestion("dish", d.id(), askedQty(), null));
            List<MenuDish> similar = available.stream()
                .filter((x) -> !x.id().equals(d.id()) && x.categoryId().equals(d.categoryId()) && filter(need).test(x))
                .sorted(Comparator.comparingInt(this::rankOf)).limit(d.soldOut() ? 3 : 2).toList();
            similar.forEach((x) -> items.add(new Suggestion("dish", x.id(), 1, "Cùng loại")));
            if (d.soldOut() && !similar.isEmpty()) sb.append("\nBạn có thể thử các món cùng loại bên dưới.");
            return reply(sb.toString(), items, List.of("Ăn kèm gì?", "Món bán chạy", "Rẻ hơn"));
        }

        int askedQty() {
            Matcher m = Pattern.compile("(?:^|\\s)(\\d{1,2}|mot|hai|ba|bon|nam|sau)\\s+(phan|dia|to|ly|chai|lon|suat|cai)(?:\\s|$)").matcher(n);
            if (!m.find()) return 1;
            String v = m.group(1);
            int q = v.chars().allMatch(Character::isDigit) ? Integer.parseInt(v) : NUMBER_WORDS.getOrDefault(v, 1);
            return Math.max(1, Math.min(20, q));
        }

        Reply aboutSet(MenuSet s) {
            StringBuilder sb = new StringBuilder("**").append(s.name()).append("** — ").append(vnd(s.price()));
            if (s.originalPrice() > s.price()) sb.append(" (gọi lẻ ").append(vnd(s.originalPrice())).append(", tiết kiệm ").append(vnd(s.originalPrice() - s.price())).append(')');
            sb.append(".\nGồm: ");
            sb.append(String.join(", ", s.items().stream().map((i) -> i.qty() + " " + i.name()).toList())).append('.');
            if (!Vi.blank(s.description())) sb.append("\n").append(s.description());
            return reply(sb.toString(), List.of(new Suggestion("set", s.id(), 1, null)), List.of("Set khác", "Đồ uống", "Tráng miệng"));
        }

        /* ------------------------------------------------ Ăn kèm theo giỏ */

        Reply pairing() {
            Map<String, MenuDish> byId = new HashMap<>();
            menu.dishes().forEach((d) -> byId.put(d.id(), d));
            List<MenuDish> inCart = cart.stream().map(byId::get).filter(Objects::nonNull).toList();
            Set<String> cartIds = new HashSet<>(cart);
            List<Suggestion> items = new ArrayList<>();
            List<String> lines = new ArrayList<>();
            Predicate<MenuDish> fresh = (d) -> !cartIds.contains(d.id()) && !d.soldOut();
            Map<String, String> addonNote = new LinkedHashMap<>();

            boolean steak = inCart.stream().anyMatch((d) -> inCat(d, "bit tet"));
            boolean hotpot = inCart.stream().anyMatch((d) -> inCat(d, "lau"));
            boolean soup = inCart.stream().anyMatch((d) -> any(norm(d.name()), "sup", "bo kho"));
            if (steak) {
                lines.add("Bít tết ngon hơn với **sốt thêm, khoai nghiền / bánh mì bơ tỏi** và một ly **vang đỏ**.");
                addonNote.put("khoai tay nghien", "Ăn kèm bít tết");
                addonNote.put("sot tieu den", "Thêm sốt");
                addonNote.put("vang do uc ly", "Hợp bít tết");
            }
            if (hotpot) {
                lines.add("Gọi lẩu thì nhiều bàn gọi thêm **đĩa bò nhúng, rau nấm và bún**.");
                addonNote.put("dia bo uc nhung them", "Thêm cho lẩu");
                addonNote.put("dia rau nam them", "Thêm cho lẩu");
                addonNote.put("bun tuoi them", "Thêm cho lẩu");
            }
            if (soup) addonNote.put("banh mi bo toi", "Chấm súp / bò kho");
            addonNote.forEach((key, note) -> available.stream().filter(fresh).filter((d) -> core(d.name()).contains(" " + key))
                .findFirst().ifPresent((d) -> items.add(new Suggestion("dish", d.id(), 1, note))));

            if (inCart.stream().noneMatch(this::isDrink)) {
                lines.add("Bàn mình **chưa có đồ uống**.");
                available.stream().filter(fresh).filter(this::isDrink).sorted(Comparator.comparingInt(this::rankOf).thenComparingLong(MenuDish::price))
                    .filter((d) -> any(norm(d.name()), "tra", "bia", "nuoc ep", "coca")).limit(2)
                    .forEach((d) -> items.add(new Suggestion("dish", d.id(), 1, "Đồ uống")));
            }
            if (inCart.stream().noneMatch((d) -> inCat(d, "trang mieng")) && !inCart.isEmpty()) {
                lines.add("Kết thúc bữa bằng một món **tráng miệng** nhé.");
                available.stream().filter(fresh).filter((d) -> inCat(d, "trang mieng")).sorted(Comparator.comparingInt(this::rankOf)).limit(1)
                    .forEach((d) -> items.add(new Suggestion("dish", d.id(), 1, "Tráng miệng")));
            }
            if (inCart.isEmpty()) {
                return bestReply(new Need(), "Giỏ của bạn đang trống. Bạn chọn món chính trước, rồi hỏi lại *\"ăn kèm gì\"* để mình gợi ý món đi kèm nhé. Gợi ý vài món được gọi nhiều:");
            }
            if (inCart.stream().noneMatch(this::isMain)) {
                lines.add(0, "Giỏ chưa có **món chính** — bạn xem thử vài món bên dưới.");
                available.stream().filter(fresh).filter(this::isMain).sorted(Comparator.comparingInt(this::rankOf)).limit(2)
                    .forEach((d) -> items.add(new Suggestion("dish", d.id(), 1, "Món chính")));
            }
            if (items.isEmpty()) return reply("Giỏ của bạn đã khá đầy đủ rồi 👍 Bấm **Xác nhận gọi món** ở dưới để gửi nhé.", List.of(), List.of("Tráng miệng", "Đồ uống"));
            return reply(String.join(" ", lines), items.stream().limit(MAX_ITEMS + 1).toList(), List.of("Đồ uống", "Tráng miệng", "Món bán chạy"));
        }

        /* ------------------------------------------------ Thực đơn cho cả bàn */

        Reply planFor(Need need) {
            int p = need.party;
            Long total = need.maxPrice == null ? null : need.perPerson ? need.maxPrice * p : need.maxPrice;
            Need dishNeed = copyFilters(need);
            Predicate<MenuDish> ok = filter(dishNeed);
            List<Suggestion> items = new ArrayList<>();
            long sum = 0;
            Comparator<MenuDish> byRank = Comparator.comparingInt(this::rankOf);

            // Set vừa ngân sách (nếu có) — gợi ý riêng, không cộng vào thực đơn
            List<MenuSet> sets = menu.sets().stream().filter((s) -> total == null || s.price() * Math.max(1, p / 2) <= total).limit(1).toList();

            List<MenuDish> picks = new ArrayList<>();
            Map<String, Integer> qty = new LinkedHashMap<>();
            // Bàn ≥ 3 người: một nồi lẩu (2–3 người) cho mỗi 3 người — trừ khi khách không ăn bò / muốn món nhẹ
            if (p >= 3) {
                int pots = Math.max(1, p / 3);
                MenuDish pot = available.stream().filter((d) -> inCat(d, "lau")).filter(ok).sorted(byRank).findFirst().orElse(null);
                if (pot != null && (total == null || sum + pot.price() * pots <= total)) {
                    picks.add(pot); qty.put(pot.id(), pots); sum += pot.price() * pots;
                }
            }
            int pots = qty.values().stream().mapToInt(Integer::intValue).sum();
            int mains = pots > 0 ? Math.max(1, p - 2 * pots) : p;
            List<String> mainCats = List.of("bit tet", "bo nuong", "com", "mon nuoc");
            List<MenuDish> mainPool = available.stream().filter(ok).filter((d) -> mainCats.stream().anyMatch((c) -> inCat(d, c)))
                .sorted(byRank.thenComparingLong(MenuDish::price)).toList();
            Set<String> usedCats = new HashSet<>();
            for (int round = 0; round < 2 && countMains(picks) < mains; round++) {
                for (MenuDish d : mainPool) {
                    if (countMains(picks) >= mains) break;
                    if (qty.containsKey(d.id()) || round == 0 && usedCats.contains(d.categoryId())) continue;
                    long price = d.price();
                    if (total != null && sum + price > total * 0.85) continue;
                    picks.add(d); qty.put(d.id(), 1); sum += price; usedCats.add(d.categoryId());
                }
            }
            int starters = Math.max(1, p / 3);
            for (MenuDish d : available.stream().filter(ok).filter((d) -> inCat(d, "khai vi")).sorted(byRank).toList()) {
                if (starters == 0) break;
                if (total != null && sum + d.price() > total) continue;
                picks.add(d); qty.put(d.id(), 1); sum += d.price(); starters--;
            }
            MenuDish drink = available.stream().filter(this::isDrink).filter((d) -> any(norm(d.name()), "tra dao", "nuoc ep", "coca"))
                .filter(ok).sorted(byRank).findFirst().orElse(null);
            if (drink != null && (total == null || sum + drink.price() * p <= total)) {
                picks.add(drink); qty.put(drink.id(), p); sum += drink.price() * p;
            }
            for (MenuDish d : picks) {
                String note = inCat(d, "lau") ? "Cho 2–3 người" : inCat(d, "khai vi") ? "Khai vị" : isDrink(d) ? "Mỗi người 1 phần" : "Món chính";
                items.add(new Suggestion("dish", d.id(), qty.get(d.id()), note));
            }
            if (items.isEmpty())
                return reply("Mình chưa ghép được thực đơn phù hợp với điều kiện này 😥 — bạn thử nới ngân sách hoặc bỏ bớt yêu cầu nhé.", List.of(), startChips);
            StringBuilder sb = new StringBuilder("Gợi ý thực đơn cho **").append(p).append(" người**");
            if (total != null) sb.append(" (ngân sách ").append(vnd(total)).append(')');
            sb.append(": tổng khoảng **").append(vnd(sum)).append("**");
            if (p > 1) sb.append(" — ~").append(vnd(Math.round(sum / (double) p / 1000) * 1000)).append("/người");
            sb.append(". Bấm **Thêm tất cả** hoặc chọn từng món.");
            describeFilters(sb, dishNeed);
            if (!sets.isEmpty()) {
                MenuSet s = sets.get(0);
                sb.append("\nNhà hàng cũng có set **").append(s.name()).append("** — ").append(vnd(s.price())).append(" (bấm \"Set menu\" để xem).");
            }
            return new Reply(sb.toString(), items, List.of("Rẻ hơn", "Không ăn cay", "Thêm tráng miệng", "Set menu"), items.size() > 1, "rules");
        }

        int countMains(List<MenuDish> picks) {
            return (int) picks.stream().filter((d) -> isMain(d) && !inCat(d, "lau")).count();
        }

        Need copyFilters(Need need) {
            Need x = new Need();
            x.spicy = need.spicy; x.veg = need.veg; x.kids = need.kids; x.light = need.light; x.noBeef = need.noBeef;
            x.allergens.addAll(need.allergens);
            return x;
        }

        /* ------------------------------------------------ Danh sách món theo điều kiện */

        Reply listReply(Need need, boolean other) {
            Predicate<MenuDish> ok = filter(need);
            List<MenuDish> pool = available.stream().filter(ok).toList();
            if (!need.cats.isEmpty()) pool = pool.stream().filter((d) -> need.cats.stream().anyMatch((c) -> inCat(d, c))).toList();
            else if (!need.combo) pool = pool.stream().filter((d) -> !isAddon(d)).toList();

            // Từ khóa nguyên liệu: chỉ lọc khi có món khớp (tránh "không tìm thấy" vì một chữ thừa)
            if (!need.words.isEmpty()) {
                List<MenuDish> byWord = pool.stream().filter((d) -> { String t = text(d); return need.words.stream().anyMatch((w) -> has(t, w)); }).toList();
                if (!byWord.isEmpty()) pool = byWord;
                else if (need.cats.isEmpty() && !need.hasFilter() && !need.best && !need.premium && !need.combo) {
                    logUnanswered(raw);
                    return bestReply(need, "Mình chưa tìm thấy món có \"" + String.join(" ", need.words) + "\" trong thực đơn hôm nay. Bạn xem thử các món được gọi nhiều nhé:");
                }
            }
            Comparator<MenuDish> order = need.premium ? Comparator.comparingLong(MenuDish::price).reversed()
                : need.maxPrice != null && need.best ? Comparator.comparingInt(this::rankOf).thenComparingLong(MenuDish::price)
                : Comparator.comparingInt(this::rankOf).thenComparing(Comparator.comparingLong(MenuDish::price).reversed());
            List<MenuDish> sorted = pool.stream().sorted(order).toList();
            List<MenuDish> fresh = other ? sorted.stream().filter((d) -> !shown.contains(d.id())).toList() : sorted;
            if (other && fresh.isEmpty() && !sorted.isEmpty())
                return reply("Mình đã gợi ý hết các món phù hợp rồi ạ. Bạn đổi điều kiện (ngân sách, loại món…) để xem thêm nhé.", List.of(), startChips);

            List<Suggestion> items = new ArrayList<>();
            boolean wantSets = need.combo || need.party != null && need.party >= 2;
            if (wantSets) {
                menu.sets().stream().filter((s) -> need.maxPrice == null || s.price() <= (need.perPerson && need.party != null ? need.maxPrice * need.party : need.maxPrice))
                    .filter((s) -> !other || !shown.contains(s.id())).limit(3)
                    .forEach((s) -> items.add(new Suggestion("set", s.id(), 1, s.originalPrice() > s.price() ? "Tiết kiệm " + vnd(s.originalPrice() - s.price()) : "Set menu")));
            }
            boolean onlySets = need.combo && !items.isEmpty() && need.cats.isEmpty() && need.words.isEmpty();
            if (onlySets)
                return reply("Các set menu đang bán — gọi theo set rẻ hơn gọi lẻ. Bấm **Xem set** để chọn món trong set:", items, List.of("Nhóm 4 người", "Món bán chạy", "Đồ uống"));
            fresh.stream().limit(MAX_ITEMS - Math.min(items.size(), 2)).forEach((d) -> items.add(new Suggestion("dish", d.id(), 1, noteFor(d, need))));

            if (items.isEmpty() && any(n, "re hon", "it tien hon") && !need.cats.isEmpty())
                return reply("Các món mình vừa gợi ý đã là rẻ nhất trong nhóm này rồi ạ. Bạn thử loại món khác, ví dụ *\"món nước\"* hoặc *\"cơm, mì\"* nhé.", List.of(), List.of("Món nước", "Cơm, mì & burger", "Dưới 150k"));
            if (items.isEmpty()) {
                StringBuilder sb = new StringBuilder("Tiếc quá, hôm nay chưa có món nào ");
                describeShort(sb, need);
                sb.append(" 😥");
                if (need.veg) sb.append("\nNhà hàng chuyên về bò nên món chay còn ít — bạn có thể gọi salad, khoai tây hoặc tráng miệng, và ghi chú \"không thịt\" cho bếp.");
                List<MenuDish> near = available.stream().filter((d) -> !isAddon(d)).filter(copyAllergyOnly(need)).sorted(Comparator.comparingInt(this::rankOf)).limit(3).toList();
                List<Suggestion> alt = near.stream().map((d) -> new Suggestion("dish", d.id(), 1, "Gợi ý khác")).toList();
                return reply(sb.toString(), alt, startChips);
            }
            StringBuilder sb = new StringBuilder(other ? "Thêm vài món " : need.best ? "Các món được gọi nhiều nhất " : need.premium ? "Các món đặc biệt " : "Mình gợi ý các món ");
            describeShort(sb, need);
            sb.append(':');
            if (need.combo && menu.sets().isEmpty()) sb.append(" (hiện chưa có set menu đang bán)");
            describeFilters(sb, need);
            List<String> chips = new ArrayList<>(List.of("Món khác", "Rẻ hơn", "Ăn kèm gì?"));
            if (need.party == null) chips.add("Nhóm 4 người");
            return reply(sb.toString(), items, chips);
        }

        Predicate<MenuDish> copyAllergyOnly(Need need) {
            Need x = new Need();
            x.allergens.addAll(need.allergens);
            x.noBeef = need.noBeef;
            return filter(x);
        }

        String noteFor(MenuDish d, Need need) {
            List<String> parts = new ArrayList<>();
            int r = rankOf(d);
            if (r < 10) parts.add("Top " + (r + 1) + " bán chạy");
            if (inCat(d, "lau") || norm(d.name()).contains(" nguoi ")) parts.add("Cho 2–3 người");
            if (Boolean.TRUE.equals(need.spicy)) parts.add(List.of("Không cay", "Cay nhẹ", "Cay vừa", "Rất cay").get(Math.min(3, d.spicyLevel())));
            if (need.kids && tagged(d, "tre em thich")) parts.add("Trẻ em thích");
            if (need.light && tagged(d, "it dau mo")) parts.add("Ít dầu mỡ");
            if (need.veg) parts.add("Món chay");
            return parts.isEmpty() ? null : String.join(" · ", parts);
        }

        void describeShort(StringBuilder sb, Need need) {
            List<String> p = new ArrayList<>();
            if (!need.cats.isEmpty()) {
                List<String> names = new ArrayList<>();
                for (String c : need.cats)
                    catKey.entrySet().stream().filter((e) -> e.getValue().startsWith(c)).findFirst().ifPresent((e) -> names.add(catName.get(e.getKey()).toLowerCase(Locale.ROOT)));
                if (!names.isEmpty()) p.add("thuộc " + String.join(", ", names));
            }
            if (need.veg) p.add("chay");
            if (Boolean.FALSE.equals(need.spicy)) p.add("không cay");
            if (Boolean.TRUE.equals(need.spicy)) p.add("cay");
            if (need.kids) p.add("hợp với trẻ em");
            if (need.light) p.add("nhẹ bụng");
            if (need.noBeef) p.add("không có bò");
            if (need.maxPrice != null) p.add("dưới " + vnd((need.maxPrice + 999) / 1000 * 1000));
            if (need.minPrice != null) p.add("từ " + vnd(need.minPrice));
            if (!need.allergens.isEmpty()) p.add("không chứa " + String.join(", ", allergenNames(need)));
            if (!need.words.isEmpty() && need.cats.isEmpty()) p.add("có \"" + String.join(" ", need.words) + "\"");
            sb.append(String.join(", ", p));
            if (sb.charAt(sb.length() - 1) == ' ') sb.setLength(sb.length() - 1);
        }

        List<String> allergenNames(Need need) {
            List<String> names = new ArrayList<>();
            for (String a : need.allergens) {
                String label = switch (a) {
                    case "dau phong" -> "đậu phộng"; case "dau nanh" -> "đậu nành"; case "gluten" -> "gluten";
                    case "hai san" -> "hải sản có vỏ"; case "hat cay" -> "hạt cây"; case "me" -> "mè";
                    case "sua" -> "sữa"; case "trung" -> "trứng"; case "ca" -> "cá"; default -> a;
                };
                names.add(label);
            }
            return names;
        }

        void describeFilters(StringBuilder sb, Need need) {
            if (!need.allergens.isEmpty())
                sb.append("\n_Lưu ý: ").append(config.allergyDisclaimer()).append("_");
        }

        Reply bestReply(Need need, String text) {
            List<MenuDish> best = available.stream().filter(filter(need)).filter((d) -> !isAddon(d) && !isDrink(d))
                .sorted(Comparator.comparingInt(this::rankOf)).limit(MAX_ITEMS).toList();
            List<Suggestion> items = best.stream().map((d) -> new Suggestion("dish", d.id(), 1, noteFor(d, need))).toList();
            return reply(text, items, startChips);
        }

        Reply reply(String text, List<Suggestion> items, List<String> chips) {
            return new Reply(text, items, chips, false, "rules");
        }
    }
}
