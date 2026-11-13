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

    public record Combo(String id, String name, List<String> dishIds, String note, boolean active) {}

    public record ComboInput(String name, List<String> dishIds, String note, Boolean active) {}

    private final JdbcClient jdbc;
    private final DishService dishes;
    private final AuditService audit;
    private final CurrentUserService currentUser;

    public ChatbotMenuService(JdbcClient jdbc, DishService dishes, AuditService audit, CurrentUserService currentUser) {
        this.jdbc = jdbc;
        this.dishes = dishes;
        this.audit = audit;
        this.currentUser = currentUser;
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

    /* ------------------------------------------------------------------ Combo gợi ý */

    public List<Combo> combos() {
        Map<Long, List<String>> items = new HashMap<>();
        jdbc.sql("SELECT ci.combo_id, ci.dish_id FROM combo_items ci JOIN dishes d ON d.id = ci.dish_id ORDER BY d.code")
            .query((rs, n) -> items.computeIfAbsent(rs.getLong(1), k -> new ArrayList<>()).add(Ids.str(rs.getLong(2))))
            .list();
        return jdbc.sql("SELECT id, name, note, is_active FROM combos ORDER BY id")
            .query((rs, n) -> new Combo(Ids.str(rs.getLong("id")), rs.getString("name"),
                items.getOrDefault(rs.getLong("id"), List.of()), Vi.trim(rs.getString("note")), rs.getBoolean("is_active")))
            .list();
    }

    @Transactional
    public Combo saveCombo(String idText, ComboInput in) {
        Long id = idText == null ? null : Ids.parse(idText, "Combo không tồn tại");
        String currentName = id == null ? null
            : jdbc.sql("SELECT name FROM combos WHERE id = ?").param(id).query(String.class).optional()
                .orElseThrow(() -> BusinessException.notFound("Combo không tồn tại"));

        var v = new ValidationException.Collector();
        String name = Vi.collapse(in.name());
        if (name.isEmpty()) v.add("name", "Vui lòng nhập tên combo");
        else if (name.length() > 100) v.add("name", "Tên combo tối đa 100 ký tự");
        else if (jdbc.sql("SELECT COUNT(*) FROM combos WHERE name = ? AND id <> ?").params(name, id == null ? 0 : id)
            .query(Long.class).single() > 0) v.add("name", "Tên combo đã tồn tại");

        List<Long> dishIds = (in.dishIds() == null ? List.<String>of() : in.dishIds()).stream()
            .map(Ids::parseOrNull).distinct().toList();
        Map<Long, String[]> found = new LinkedHashMap<>();
        if (!dishIds.contains(null) && !dishIds.isEmpty()) {
            String ids = String.join(",", dishIds.stream().map(String::valueOf).toList());
            jdbc.sql("SELECT id, name, status FROM dishes WHERE id IN (" + ids + ")")
                .query((rs, n) -> found.put(rs.getLong("id"), new String[] {rs.getString("name"), rs.getString("status")}))
                .list();
        }
        if (dishIds.size() < 2) v.add("dishIds", "Combo cần ít nhất 2 món");
        else if (dishIds.contains(null) || found.size() != dishIds.size()) v.add("dishIds", "Có món không tồn tại hoặc đã bị xóa");
        else {
            List<String> stopped = found.values().stream().filter(d -> "stopped".equals(d[1])).map(d -> d[0]).toList();
            if (!stopped.isEmpty()) v.add("dishIds", "Có món đang ngừng bán: " + String.join(", ", stopped));
        }
        String note = Vi.trim(in.note());
        if (note.length() > 300) v.add("note", "Ghi chú tối đa 300 ký tự");
        v.throwIfAny();

        boolean active = in.active() == null || in.active();
        if (id == null) {
            jdbc.sql("INSERT INTO combos (name, note, is_active) VALUES (?, ?, ?)").params(name, note.isEmpty() ? null : note, active).update();
            id = jdbc.sql("SELECT LAST_INSERT_ID()").query(Long.class).single();
            audit.log("chatbot", "Thêm combo gợi ý", name, "combos", id);
        } else {
            jdbc.sql("UPDATE combos SET name = ?, note = ?, is_active = ? WHERE id = ?")
                .params(name, note.isEmpty() ? null : note, active, id).update();
            jdbc.sql("DELETE FROM combo_items WHERE combo_id = ?").param(id).update();
            audit.log("chatbot", "Cập nhật combo gợi ý", currentName.equals(name) ? name : currentName + " → " + name, "combos", id);
        }
        for (Long dishId : dishIds) {
            jdbc.sql("INSERT INTO combo_items (combo_id, dish_id) VALUES (?, ?)").params(id, dishId).update();
        }
        String savedId = Ids.str(id);
        return combos().stream().filter(c -> c.id().equals(savedId)).findFirst().orElseThrow();
    }

    @Transactional
    public void deleteCombo(String idText) {
        long id = Ids.parse(idText, "Combo không tồn tại");
        String name = jdbc.sql("SELECT name FROM combos WHERE id = ?").param(id).query(String.class).optional()
            .orElseThrow(() -> BusinessException.notFound("Combo không tồn tại"));
        jdbc.sql("DELETE FROM combos WHERE id = ?").param(id).update();
        audit.log("chatbot", "Xóa combo gợi ý", name, "combos", id);
    }
}
