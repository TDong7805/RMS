package com.rms.website;

import com.rms.common.Ids;
import com.rms.common.Vi;
import com.rms.ordering.MenuAssistant;
import com.rms.ordering.MenuAssistant.Ask;
import com.rms.ordering.MenuAssistant.Intro;
import com.rms.ordering.MenuAssistant.Reply;
import com.rms.ordering.MenuAssistant.Suggestion;
import com.rms.ordering.QrOrderingService;
import com.rms.ordering.QrOrderingService.MenuDish;
import com.rms.settings.SettingsService;
import com.rms.settings.SettingsService.OpeningDay;
import com.rms.settings.SettingsService.RestaurantInfo;
import com.rms.website.PublicSiteService.Item;
import com.rms.website.PublicSiteService.PublicMenu;
import com.rms.website.PublicSiteService.SetMenu;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;

/**
 * Chatbot tư vấn trên website khách hàng (V27). Bộ não dùng chung với trợ lý gọi món tại bàn (MenuAssistant: Gemini → theo luật,
 * FAQ, cấu hình Quản lý Chatbot), khác ở chỗ:
 *  - không có bàn / giỏ món; chỉ gợi ý món đang hiện trên website (show_on_website của món và danh mục);
 *  - trả lời địa chỉ, giờ mở cửa, hotline từ Cấu hình hệ thống; kèm nút "Đặt bàn" / "Liên hệ" khi phù hợp;
 *  - món gợi ý trả thành thẻ theo id của thực đơn website (món, hoặc "g" + id nhóm khi món thuộc nhóm nhiều loại)
 *    để bấm vào là mở sách thực đơn tới đúng món.
 * Công tắc: chatbot_config.is_active VÀ website_enabled.
 */
@Service
public class SiteAssistantService {
    static final String[] DAY_NAMES = {"Chủ nhật", "Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7"};

    /** kind: dish | set; id: id trên thực đơn website; note: lý do gợi ý; qty: số phần gợi ý (thực đơn cho nhóm). */
    public record Card(String kind, String id, String name, long price, boolean priceFrom, String image, String note, int qty,
                       boolean soldOut) {}

    /** actions: "reservation" (nút Đặt bàn), "contact" (nút Liên hệ). */
    public record Answer(String text, List<Card> cards, List<String> chips, List<String> actions, String source) {}

    public record Question(String message, List<String> history, List<String> shown, String sessionId) {}

    private final MenuAssistant assistant;
    private final PublicSiteService site;
    private final QrOrderingService ordering;
    private final SettingsService settings;
    private final JdbcClient jdbc;

    public SiteAssistantService(MenuAssistant assistant, PublicSiteService site, QrOrderingService ordering, SettingsService settings,
                                JdbcClient jdbc) {
        this.assistant = assistant;
        this.site = site;
        this.ordering = ordering;
        this.settings = settings;
        this.jdbc = jdbc;
    }

    public Intro intro() {
        return assistant.introWebsite();
    }

    public Answer ask(Question in, String clientKey) {
        PublicMenu menu = site.menu("", "");
        // Món (id thật) → mục trên thực đơn website; món thuộc nhóm nhiều loại → thẻ của nhóm.
        Map<String, Item> itemById = new HashMap<>();
        menu.items().forEach((i) -> itemById.put(i.id(), i));
        Map<String, Item> byDish = new HashMap<>();
        Set<String> visible = new HashSet<>();
        Set<String> hidden = hiddenDishIds();
        for (MenuDish d : ordering.menu().dishes()) {
            Item item = itemById.containsKey(d.id()) ? itemById.get(d.id()) : d.groupId() == null ? null : itemById.get("g" + d.groupId());
            if (item == null || hidden.contains(d.id())) continue;
            byDish.put(d.id(), item);
            visible.add(d.id());
        }
        Map<String, SetMenu> sets = new HashMap<>();
        menu.sets().forEach((s) -> sets.put(s.id(), s));

        RestaurantInfo info = settings.getInfo();
        MenuAssistant.Site ctx = new MenuAssistant.Site(info.name(), Vi.trim(info.phone()), Vi.trim(info.address()),
            hours(settings.getOpeningHours()), visible);
        Ask ask = new Ask(in == null ? null : in.message(), in == null ? null : in.history(),
            in == null ? null : toDishIds(in.shown(), menu), List.of(), in == null ? null : in.sessionId());
        Reply r = assistant.replyWebsite(ask, clientKey, ctx);

        List<Card> cards = new ArrayList<>();
        Set<String> seen = new HashSet<>();
        for (Suggestion s : r.items()) {
            if ("set".equals(s.kind())) {
                SetMenu m = sets.get(s.id());
                if (m != null && seen.add("set:" + m.id()))
                    cards.add(new Card("set", m.id(), m.name(), m.price(), false, m.image(), s.note(), s.qty(), false));
            } else {
                Item i = byDish.get(s.id());
                if (i != null && seen.add("dish:" + i.id()))
                    cards.add(new Card("dish", i.id(), i.name(), i.price(), i.priceFrom(), i.image(), s.note(), s.qty(), i.soldOut()));
            }
        }
        return new Answer(r.text(), cards, r.chips(), r.actions(), r.source());
    }

    /** Thẻ đã hiện (id website, "g…" = nhóm) → id món thật, để bộ theo luật gợi ý món khác khi khách hỏi "món khác". */
    private List<String> toDishIds(List<String> shown, PublicMenu menu) {
        if (shown == null) return List.of();
        List<String> out = new ArrayList<>();
        Set<String> groupIds = new HashSet<>();
        for (String id : shown) {
            if (id == null) continue;
            if (id.startsWith("g")) groupIds.add(id.substring(1));
            else out.add(id);
        }
        if (!groupIds.isEmpty())
            ordering.menu().dishes().stream().filter((d) -> d.groupId() != null && groupIds.contains(d.groupId())).forEach((d) -> out.add(d.id()));
        return out.stream().limit(60).toList();
    }

    private Set<String> hiddenDishIds() {
        return new HashSet<>(jdbc.sql("SELECT id FROM dishes WHERE show_on_website = 0").query((rs, n) -> Ids.str(rs.getLong("id"))).list());
    }

    /** "Thứ 2 – Thứ 6: 10:00–22:00\nThứ 7 – Chủ nhật: 09:00–23:00" (gộp ngày liền nhau cùng giờ; thứ hai trước). */
    static String hours(List<OpeningDay> days) {
        List<OpeningDay> sorted = new ArrayList<>(days);
        sorted.sort((a, b) -> Integer.compare((a.day() + 6) % 7, (b.day() + 6) % 7));
        List<String> lines = new ArrayList<>();
        int i = 0;
        while (i < sorted.size()) {
            OpeningDay first = sorted.get(i);
            String label = label(first);
            int j = i;
            while (j + 1 < sorted.size() && label(sorted.get(j + 1)).equals(label)) j++;
            String range = i == j ? DAY_NAMES[first.day()] : DAY_NAMES[first.day()] + " – " + DAY_NAMES[sorted.get(j).day()];
            lines.add("• " + range + ": " + label);
            i = j + 1;
        }
        return String.join("\n", lines);
    }

    private static String label(OpeningDay d) {
        if (!d.open()) return "nghỉ";
        return shortTime(d.openTime()) + "–" + shortTime(d.closeTime());
    }

    private static String shortTime(String t) {
        return t == null ? "" : t.length() > 5 ? t.substring(0, 5) : t;
    }
}
