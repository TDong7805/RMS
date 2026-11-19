package com.rms.chatbot;

import com.rms.audit.AuditService;
import com.rms.common.BusinessException;
import com.rms.common.CurrentUserService;
import com.rms.common.Db;
import com.rms.common.Ids;
import com.rms.common.Times;
import com.rms.common.ValidationException;
import com.rms.common.Vi;
import com.rms.dish.DishService;
import com.rms.dish.DishService.Dish;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Quản lý Chatbot AI — luồng "Quản lý thực đơn": đồng bộ món từ phân hệ Món ăn, bật/tắt gợi ý từng món,
 * gắn thẻ phân loại, combo gợi ý. Dữ liệu món dùng chung bảng dishes với UC Quản lý món ăn.
 *
 * Nguyên tắc: món "Ngừng bán" không bao giờ được AI gợi ý (trigger CSDL + kiểm tra ở đây);
 * món thiếu thành phần/mô tả được cảnh báo để AI không khẳng định thông tin chưa có.
 */
@Service
public class ChatbotMenuService {
    public record Missing(String id, String name, List<String> missing) {}

    public record MenuSync(String syncedAt, int total, int enabled, List<Missing> missingData) {}

    public record Menu(List<Dish> dishes, MenuSync lastSync) {}

    public record AiPatch(Boolean aiEnabled, List<String> aiTags) {}

    /** Một món trong set: số lượng, allowVariant = khách được đổi sang loại khác cùng nhóm (vd. nước ngọt). */
    public record ComboItem(String dishId, int qty, boolean allowVariant) {}

    /**
     * Set menu (trước là "combo gợi ý" của Chatbot): Chatbot dùng để gợi ý; onMenu = bán trên thực đơn với giá set.
     * dishIds giữ để tương thích (các món trong set, theo thứ tự). originalPrice = tổng giá gọi lẻ hiện tại.
     */
    public record Combo(String id, String name, List<String> dishIds, String note, boolean active, String description,
                        Long price, long originalPrice, String image, boolean onMenu, String sellFrom, String sellTo,
                        int sortOrder, List<ComboItem> items) {}

    /** items: món + số lượng (bỏ trống thì lấy dishIds, mỗi món 1 phần). image: null = giữ, "" = bỏ, data URL = ảnh mới. */
    public record ComboInput(String name, List<String> dishIds, String note, Boolean active, String description,
                             java.math.BigDecimal price, String image, Boolean onMenu, String sellFrom, String sellTo,
                             List<ComboItem> items) {}

    static final String SET_IMAGE_FOLDER = "sets";

    private final JdbcClient jdbc;
    private final DishService dishes;
    private final AuditService audit;
    private final CurrentUserService currentUser;

    private final com.rms.storage.ImageStore images;

    public ChatbotMenuService(JdbcClient jdbc, DishService dishes, AuditService audit, CurrentUserService currentUser,
                              com.rms.storage.ImageStore images) {
        this.jdbc = jdbc;
        this.dishes = dishes;
        this.audit = audit;
        this.currentUser = currentUser;
        this.images = images;
    }

    /* ------------------------------------------------------------------ Thực đơn cho AI */

    public Menu menu() {
        List<Dish> all = dishes.all();
        MenuSync last = jdbc.sql("SELECT synced_at, total_dishes, enabled_dishes FROM menu_sync_logs ORDER BY id DESC LIMIT 1")
            .query((rs, n) -> new MenuSync(Times.iso(Db.dateTime(rs, "synced_at")), rs.getInt("total_dishes"),
                rs.getInt("enabled_dishes"), missing(all)))
            .optional().orElse(null);
        return new Menu(all, last);
    }

    @Transactional
    public MenuSync sync() {
        jdbc.sql("UPDATE dishes SET ai_enabled = 0 WHERE status = 'stopped' AND ai_enabled = 1").update();
        List<Dish> all = dishes.all();
        int enabled = (int) all.stream().filter(Dish::aiEnabled).count();
        List<Missing> missing = missing(all);
        jdbc.sql("INSERT INTO menu_sync_logs (total_dishes, enabled_dishes, missing_count, synced_by) VALUES (?, ?, ?, ?)")
            .params(all.size(), enabled, missing.size(), currentUser.get().id())
            .update();
        audit.log("chatbot", "Đồng bộ thực đơn", enabled + "/" + all.size() + " món được AI sử dụng");
        return new MenuSync(Times.iso(Times.now()), all.size(), enabled, missing);
    }

    private static List<Missing> missing(List<Dish> all) {
        List<Missing> out = new ArrayList<>();
        for (Dish d : all) {
            if (!"selling".equals(d.status())) continue;
            List<String> m = new ArrayList<>();
            if (d.ingredients().isBlank()) m.add("thành phần");
            if (d.description().isBlank()) m.add("mô tả");
            if (!m.isEmpty()) out.add(new Missing(d.id(), d.name(), m));
        }
        return out;
    }

    @Transactional
    public Dish updateAi(String dishIdText, AiPatch patch) {
        long dishId = Ids.parse(dishIdText, "Món ăn không tồn tại");
        Dish dish = dishes.find(dishId);
        if (patch.aiEnabled() != null) {
            if (patch.aiEnabled() && "stopped".equals(dish.status()))
                throw new BusinessException("Món đang \"Ngừng bán\", AI không được gợi ý món này");
            jdbc.sql("UPDATE dishes SET ai_enabled = ? WHERE id = ?").params(patch.aiEnabled(), dishId).update();
            audit.log("chatbot", patch.aiEnabled() ? "Bật gợi ý món" : "Tắt gợi ý món", dish.name(), "dishes", dishId);
        }
        if (patch.aiTags() != null) {
            Map<String, Long> known = tagIds();
            List<String> tags = patch.aiTags().stream().map(Vi::trim).filter(s -> !s.isEmpty()).distinct().toList();
            List<String> unknown = tags.stream().filter(t -> !known.containsKey(t)).toList();
            if (!unknown.isEmpty()) throw new ValidationException("aiTags", "Thẻ không hợp lệ: " + String.join(", ", unknown));
            jdbc.sql("DELETE FROM dish_ai_tags WHERE dish_id = ?").param(dishId).update();
            for (String t : tags) {
                jdbc.sql("INSERT INTO dish_ai_tags (dish_id, tag_id) VALUES (?, ?)").params(dishId, known.get(t)).update();
            }
            audit.log("chatbot", "Gắn thẻ món", dish.name() + ": " + (tags.isEmpty() ? "(không thẻ)" : String.join(", ", tags)),
                "dishes", dishId);
        }
        return dishes.find(dishId);
    }

    public List<String> aiTags() {
        return jdbc.sql("SELECT name FROM ai_tags ORDER BY id").query(String.class).list();
    }

    private Map<String, Long> tagIds() {
        Map<String, Long> m = new HashMap<>();
        jdbc.sql("SELECT id, name FROM ai_tags").query((rs, n) -> m.put(rs.getString("name"), rs.getLong("id"))).list();
        return m;
    }

    /* ------------------------------------------------------------------ Set menu (combo) */

    public List<Combo> combos() {
        Map<Long, List<ComboItem>> items = new HashMap<>();
        Map<Long, Long> original = new HashMap<>();
        jdbc.sql("""
                SELECT ci.combo_id, ci.dish_id, ci.quantity, ci.allow_variant, d.price
                FROM combo_items ci JOIN dishes d ON d.id = ci.dish_id ORDER BY ci.sort_order, d.code
                """)
            .query((rs, n) -> {
                long combo = rs.getLong("combo_id");
                items.computeIfAbsent(combo, k -> new ArrayList<>())
                    .add(new ComboItem(Ids.str(rs.getLong("dish_id")), rs.getInt("quantity"), rs.getBoolean("allow_variant")));
                original.merge(combo, rs.getBigDecimal("price").longValue() * rs.getInt("quantity"), Long::sum);
                return combo;
            })
            .list();
        return jdbc.sql("""
                SELECT id, name, note, is_active, description, price, image_url, on_menu, sell_from, sell_to, sort_order
                FROM combos ORDER BY sort_order, id
                """)
            .query((rs, n) -> {
                long id = rs.getLong("id");
                List<ComboItem> its = items.getOrDefault(id, List.of());
                java.time.LocalTime from = com.rms.common.Db.time(rs, "sell_from");
                java.time.LocalTime to = com.rms.common.Db.time(rs, "sell_to");
                return new Combo(Ids.str(id), rs.getString("name"), its.stream().map(ComboItem::dishId).toList(),
                    Vi.trim(rs.getString("note")), rs.getBoolean("is_active"), Vi.trim(rs.getString("description")),
                    rs.getBigDecimal("price") == null ? null : rs.getBigDecimal("price").longValue(), original.getOrDefault(id, 0L),
                    images.url(rs.getString("image_url")), rs.getBoolean("on_menu"),
                    from == null ? null : from.toString(), to == null ? null : to.toString(), rs.getInt("sort_order"), its);
            })
            .list();
    }

    @Transactional
    public Combo saveCombo(String idText, ComboInput in) {
        Long id = idText == null ? null : Ids.parse(idText, "Set không tồn tại");
        String currentName = null;
        String currentImage = null;
        if (id != null) {
            String[] cur = jdbc.sql("SELECT name, image_url FROM combos WHERE id = ?").param(id)
                .query((rs, n) -> new String[] {rs.getString(1), rs.getString(2)}).optional()
                .orElseThrow(() -> BusinessException.notFound("Set không tồn tại"));
            currentName = cur[0];
            currentImage = cur[1];
        }

        var v = new ValidationException.Collector();
        String name = Vi.collapse(in.name());
        if (name.isEmpty()) v.add("name", "Vui lòng nhập tên set");
        else if (name.length() > 100) v.add("name", "Tên set tối đa 100 ký tự");
        else if (jdbc.sql("SELECT COUNT(*) FROM combos WHERE name = ? AND id <> ?").params(name, id == null ? 0 : id)
            .query(Long.class).single() > 0) v.add("name", "Tên set đã tồn tại");

        List<ComboItem> wanted = in.items() != null && !in.items().isEmpty() ? in.items()
            : (in.dishIds() == null ? List.<String>of() : in.dishIds()).stream().map(d -> new ComboItem(d, 1, false)).toList();
        List<Long> dishIds = wanted.stream().map(i -> Ids.parseOrNull(i.dishId())).toList();
        Map<Long, String[]> found = new LinkedHashMap<>();
        if (!dishIds.contains(null) && !dishIds.isEmpty()) {
            String ids = String.join(",", dishIds.stream().map(String::valueOf).distinct().toList());
            jdbc.sql("SELECT id, name, status, group_id FROM dishes WHERE id IN (" + ids + ")")
                .query((rs, n) -> found.put(rs.getLong("id"), new String[] {rs.getString("name"), rs.getString("status"),
                    rs.getString("group_id")}))
                .list();
        }
        int totalQty = wanted.stream().mapToInt(ComboItem::qty).sum();
        if (wanted.isEmpty() || totalQty < 2) v.add("dishIds", "Set cần ít nhất 2 món");
        else if (dishIds.contains(null) || found.size() != new java.util.HashSet<>(dishIds).size()) v.add("dishIds", "Có món không tồn tại hoặc đã bị xóa");
        else if (new java.util.HashSet<>(dishIds).size() != dishIds.size()) v.add("dishIds", "Mỗi món chỉ chọn một lần, tăng số lượng nếu cần nhiều phần");
        else if (wanted.stream().anyMatch(i -> i.qty() < 1 || i.qty() > 20)) v.add("dishIds", "Số lượng mỗi món từ 1 đến 20");
        else {
            List<String> stopped = found.values().stream().filter(d -> "stopped".equals(d[1])).map(d -> d[0]).toList();
            if (!stopped.isEmpty()) v.add("dishIds", "Có món đang ngừng bán: " + String.join(", ", stopped));
            List<String> noGroup = wanted.stream().filter(ComboItem::allowVariant)
                .map(i -> found.get(Ids.parseOrNull(i.dishId()))).filter(d -> d[2] == null).map(d -> d[0]).toList();
            if (!noGroup.isEmpty()) v.add("dishIds", "Chỉ món thuộc nhóm mới cho đổi loại: " + String.join(", ", noGroup));
        }
        String note = Vi.trim(in.note());
        if (note.length() > 300) v.add("note", "Ghi chú tối đa 300 ký tự");
        String description = Vi.trim(in.description());
        if (description.length() > 500) v.add("description", "Mô tả tối đa 500 ký tự");
        boolean onMenu = Boolean.TRUE.equals(in.onMenu());
        Long price = null;
        if (in.price() != null) {
            if (in.price().signum() <= 0) v.add("price", "Giá set phải lớn hơn 0");
            else if (in.price().stripTrailingZeros().scale() > 0) v.add("price", "Giá tính theo VND, không có phần lẻ");
            else if (in.price().compareTo(java.math.BigDecimal.valueOf(100_000_000L)) > 0) v.add("price", "Giá vượt quá giới hạn cho phép");
            else price = in.price().longValueExact();
        } else if (onMenu) {
            v.add("price", "Nhập giá set để bán trên thực đơn");
        }
        java.time.LocalTime from = time(in.sellFrom(), "sellFrom", v);
        java.time.LocalTime to = time(in.sellTo(), "sellTo", v);
        if ((from == null) != (to == null) && !v.has("sellFrom") && !v.has("sellTo")) v.add("sellTo", "Nhập đủ giờ bắt đầu và kết thúc, hoặc bỏ trống cả hai");
        else if (from != null && !from.isBefore(to)) v.add("sellTo", "Giờ kết thúc phải sau giờ bắt đầu");
        v.throwIfAny();

        boolean active = in.active() == null || in.active();
        String imageKey = in.image() == null ? currentImage : images.apply(SET_IMAGE_FOLDER, in.image(), currentImage, "image");
        if (id == null) {
            jdbc.sql("""
                    INSERT INTO combos (name, description, price, image_url, note, is_active, on_menu, sell_from, sell_to, sort_order)
                    SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(MAX(sort_order), 0) + 1 FROM combos
                    """)
                .params(name, description.isEmpty() ? null : description, price, imageKey, note.isEmpty() ? null : note, active,
                    onMenu, from, to).update();
            id = jdbc.sql("SELECT LAST_INSERT_ID()").query(Long.class).single();
            audit.log("chatbot", "Thêm set", name, "combos", id);
        } else {
            jdbc.sql("""
                    UPDATE combos SET name = ?, description = ?, price = ?, image_url = ?, note = ?, is_active = ?, on_menu = ?,
                                      sell_from = ?, sell_to = ? WHERE id = ?
                    """)
                .params(name, description.isEmpty() ? null : description, price, imageKey, note.isEmpty() ? null : note, active,
                    onMenu, from, to, id).update();
            jdbc.sql("DELETE FROM combo_items WHERE combo_id = ?").param(id).update();
            audit.log("chatbot", "Cập nhật set", currentName.equals(name) ? name : currentName + " → " + name, "combos", id);
        }
        int order = 0;
        for (ComboItem it : wanted) {
            jdbc.sql("INSERT INTO combo_items (combo_id, dish_id, quantity, allow_variant, sort_order) VALUES (?, ?, ?, ?, ?)")
                .params(id, Ids.parseOrNull(it.dishId()), it.qty(), it.allowVariant(), ++order).update();
        }
        String savedId = Ids.str(id);
        return combos().stream().filter(c -> c.id().equals(savedId)).findFirst().orElseThrow();
    }

    private static java.time.LocalTime time(String text, String field, ValidationException.Collector v) {
        if (Vi.blank(text)) return null;
        try {
            return java.time.LocalTime.parse(text.trim().length() == 5 ? text.trim() + ":00" : text.trim());
        } catch (java.time.format.DateTimeParseException e) {
            v.add(field, "Giờ không hợp lệ (HH:mm)");
            return null;
        }
    }

    @Transactional
    public void deleteCombo(String idText) {
        long id = Ids.parse(idText, "Set không tồn tại");
        String[] cur = jdbc.sql("SELECT name, image_url FROM combos WHERE id = ?").param(id)
            .query((rs, n) -> new String[] {rs.getString(1), rs.getString(2)}).optional()
            .orElseThrow(() -> BusinessException.notFound("Set không tồn tại"));
        jdbc.sql("DELETE FROM combos WHERE id = ?").param(id).update();
        if (cur[1] != null) images.deleteAfterCommit(cur[1]);
        audit.log("chatbot", "Xóa set", cur[0], "combos", id);
    }
}
