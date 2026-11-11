package com.rms.dish;

import com.rms.audit.AuditService;
import com.rms.common.BusinessException;
import com.rms.common.Db;
import com.rms.common.Ids;
import com.rms.common.Paged;
import com.rms.common.Times;
import com.rms.common.ValidationException;
import com.rms.common.Vi;
import com.rms.storage.ImageStore;
import java.math.BigDecimal;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * UC-MON-01 Quản lý món ăn: xem danh sách, tìm/lọc, xem chi tiết, thêm, sửa, đổi trạng thái bán, xóa; quản lý danh mục.
 *
 * Quy tắc (theo đặc tả):
 *  - Mã món MAxxx do hệ thống sinh, duy nhất, không sửa được.
 *  - Tên không trống, gộp khoảng trắng thừa, không trùng trong cùng danh mục (CSDL có UNIQUE(category_id, name)).
 *  - Chỉ chọn danh mục đang hoạt động; danh mục đã tắt thì món trong đó chỉ được ở trạng thái "Ngừng bán".
 *  - Đơn giá là số nguyên VND không âm. Đơn hàng lưu bản chụp giá (order_items.unit_price) nên sửa giá
 *    không làm đổi đơn cũ.
 *  - Món đã có trong đơn hàng thì không xóa (FK RESTRICT) — hướng dẫn chuyển "Ngừng bán".
 *  - Ngừng bán: trigger trg_dish_status_time ghi thời điểm đổi trạng thái và tắt gợi ý AI.
 *  - Mọi thao tác ghi nhật ký (module "dish").
 */
@Service
public class DishService {
    public static final int PAGE_SIZE = 10;
    static final int NAME_MAX = 120;
    static final int TEXT_MAX = 500;
    static final long PRICE_MAX = 100_000_000L;
    static final String IMAGE_FOLDER = "dishes";

    public record Dish(String id, String code, String name, String categoryId, long price, String description,
                       String image, String status, String ingredients, List<String> allergens, int spicyLevel,
                       List<String> aiTags, boolean aiEnabled, boolean usedInOrders, String createdAt,
                       String updatedAt, String statusUpdatedAt) {}

    public record DishInput(String name, String categoryId, BigDecimal price, String description, String image,
                            String status, String ingredients, List<String> allergens, Integer spicyLevel) {}

    public record Category(String id, String name, boolean active, int sortOrder, int dishCount) {}

    public record CategoryInput(String name, Boolean active) {}

    /** Một dòng bảng dishes (chưa kèm dị nguyên / thẻ AI). */
    private record Row(long id, String code, String name, long categoryId, long price, String description,
                       String imageKey, String status, String ingredients, int spicyLevel, boolean aiEnabled,
                       boolean usedInOrders, java.time.LocalDateTime createdAt, java.time.LocalDateTime updatedAt,
                       java.time.LocalDateTime statusUpdatedAt) {}

    private record Cat(long id, String name, boolean active) {}

    private record Clean(String name, long categoryId, long price, String description, String status,
                         String ingredients, List<Long> allergenIds, int spicyLevel) {}

    private static final String SELECT = """
        SELECT d.id, d.code, d.name, d.category_id, d.price, d.description, d.image_url, d.status, d.ingredients_text,
               d.spicy_level, d.ai_enabled, d.created_at, d.updated_at, d.status_updated_at,
               EXISTS (SELECT 1 FROM order_items oi WHERE oi.dish_id = d.id) AS used_in_orders
        FROM dishes d
        """;

    private final JdbcClient jdbc;
    private final AuditService audit;
    private final ImageStore images;

    public DishService(JdbcClient jdbc, AuditService audit, ImageStore images) {
        this.jdbc = jdbc;
        this.audit = audit;
        this.images = images;
    }

    /* ------------------------------------------------------------------ Đọc */

    public Paged<Dish> list(String keyword, String categoryId, String status, int page) {
        String kw = Vi.trim(keyword);
        Long cat = Ids.parseOrNull(categoryId);
        List<Row> rows = rows(null).stream()
            .filter(r -> Vi.blank(categoryId) || "all".equals(categoryId) || (cat != null && r.categoryId() == cat))
            .filter(r -> Vi.blank(status) || "all".equals(status) || r.status().equals(status))
            .filter(r -> kw.isEmpty() || Vi.matches(r.name(), kw) || Vi.matches(r.code(), kw))
            .sorted(Comparator.comparing(Row::updatedAt).reversed().thenComparing(Row::id, Comparator.reverseOrder()))
            .toList();
        Paged<Row> paged = Paged.of(rows, page, PAGE_SIZE);
        return paged.map(attach(paged.items()));
    }

    /** Toàn bộ món (theo mã) — dùng cho thực đơn của Chatbot AI. */
    public List<Dish> all() {
        List<Row> rows = rows(null).stream().sorted(Comparator.comparing(Row::code)).toList();
        return rows.stream().map(attach(rows)).toList();
    }

    public Dish get(String id) {
        return find(Ids.parse(id, notFound()));
    }

    public Dish find(long id) {
        Row row = row(id);
        return attach(List.of(row)).apply(row);
    }

    private Row row(long id) {
        List<Row> found = rows(id);
        if (found.isEmpty()) throw BusinessException.notFound(notFound());
        return found.get(0);
    }

    private List<Row> rows(Long id) {
        String sql = id == null ? SELECT : SELECT + " WHERE d.id = ?";
        var q = jdbc.sql(sql);
        if (id != null) q = q.param(id);
        return q.query(DishService::mapRow).list();
    }

    private static Row mapRow(ResultSet rs, int n) throws SQLException {
        return new Row(rs.getLong("id"), rs.getString("code"), rs.getString("name"), rs.getLong("category_id"),
            rs.getBigDecimal("price").longValue(), Objects.toString(rs.getString("description"), ""),
            rs.getString("image_url"), rs.getString("status"), Objects.toString(rs.getString("ingredients_text"), ""),
            rs.getInt("spicy_level"), rs.getBoolean("ai_enabled"), rs.getBoolean("used_in_orders"),
            Db.dateTime(rs, "created_at"), Db.dateTime(rs, "updated_at"), Db.dateTime(rs, "status_updated_at"));
    }

    /** Gắn dị nguyên và thẻ AI cho các dòng (2 câu truy vấn cho cả danh sách, không truy vấn từng món). */
    private java.util.function.Function<Row, Dish> attach(List<Row> rows) {
        Map<Long, List<String>> allergens = new HashMap<>();
        Map<Long, List<String>> tags = new HashMap<>();
        if (!rows.isEmpty()) {
            String ids = String.join(",", rows.stream().map(r -> Long.toString(r.id())).toList());
            jdbc.sql("SELECT da.dish_id, a.name FROM dish_allergens da JOIN allergens a ON a.id = da.allergen_id "
                    + "WHERE da.dish_id IN (" + ids + ") ORDER BY a.id")
                .query((rs, n) -> allergens.computeIfAbsent(rs.getLong(1), k -> new ArrayList<>()).add(rs.getString(2)))
                .list();
            jdbc.sql("SELECT dt.dish_id, t.name FROM dish_ai_tags dt JOIN ai_tags t ON t.id = dt.tag_id "
                    + "WHERE dt.dish_id IN (" + ids + ") ORDER BY t.id")
                .query((rs, n) -> tags.computeIfAbsent(rs.getLong(1), k -> new ArrayList<>()).add(rs.getString(2)))
                .list();
        }
        return r -> new Dish(Ids.str(r.id()), r.code(), r.name(), Ids.str(r.categoryId()), r.price(), r.description(),
            images.url(r.imageKey()), r.status(), r.ingredients(), allergens.getOrDefault(r.id(), List.of()),
            r.spicyLevel(), tags.getOrDefault(r.id(), List.of()), r.aiEnabled(), r.usedInOrders(),
            Times.iso(r.createdAt()), Times.iso(r.updatedAt()), Times.iso(r.statusUpdatedAt()));
    }

    private static String notFound() {
        return "Món ăn không tồn tại hoặc đã bị xóa";
    }

    /* ------------------------------------------------------------------ Thêm / sửa */

    @Transactional
    public Dish create(DishInput in) {
        Clean c = validate(in, null, null);
        String code = nextCode();
        String imageKey = images.apply(IMAGE_FOLDER, in.image(), null, "image");
        jdbc.sql("""
                INSERT INTO dishes (code, name, category_id, price, description, image_url, status, ingredients_text,
                                    spicy_level, ai_enabled)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """)
            .params(code, c.name(), c.categoryId(), c.price(), emptyToNull(c.description()), imageKey, c.status(),
                emptyToNull(c.ingredients()), c.spicyLevel(), "selling".equals(c.status()))
            .update();
        long id = jdbc.sql("SELECT LAST_INSERT_ID()").query(Long.class).single();
        saveAllergens(id, c.allergenIds());
        audit.log("dish", "Thêm món ăn", "Thêm món " + c.name() + " (" + money(c.price()) + ")", "dishes", id);
        return find(id);
    }

    @Transactional
    public Dish update(String idText, DishInput in) {
        long id = Ids.parse(idText, notFound());
        Row current = row(id);
        Clean c = validate(in, id, current.categoryId());
        String imageKey = images.apply(IMAGE_FOLDER, in.image(), current.imageKey(), "image");
        // status_updated_at và tắt AI khi ngừng bán do trigger trg_dish_status_time lo.
        jdbc.sql("""
                UPDATE dishes SET name = ?, category_id = ?, price = ?, description = ?, image_url = ?, status = ?,
                                  ingredients_text = ?, spicy_level = ?
                WHERE id = ?
                """)
            .params(c.name(), c.categoryId(), c.price(), emptyToNull(c.description()), imageKey, c.status(),
                emptyToNull(c.ingredients()), c.spicyLevel(), id)
            .update();
        saveAllergens(id, c.allergenIds());
        String priceNote = current.price() != c.price()
            ? " (giá " + money(current.price()) + " → " + money(c.price()) + ")" : "";
        String statusNote = current.status().equals(c.status())
            ? "" : " (" + statusLabel(current.status()) + " → " + statusLabel(c.status()) + ")";
        audit.log("dish", "Cập nhật món ăn", current.code() + " " + c.name() + priceNote + statusNote, "dishes", id);
        return find(id);
    }

    private Clean validate(DishInput in, Long editingId, Long currentCategoryId) {
        var v = new ValidationException.Collector();
        String name = Vi.collapse(in.name());
        if (name.isEmpty()) v.add("name", "Vui lòng nhập tên món");
        else if (name.length() > NAME_MAX) v.add("name", "Tên món tối đa " + NAME_MAX + " ký tự");

        String status = in.status() == null || in.status().isBlank() ? "selling" : in.status();
        if (!"selling".equals(status) && !"stopped".equals(status)) v.add("status", "Trạng thái bán không hợp lệ");

        Long categoryId = Ids.parseOrNull(in.categoryId());
        Cat cat = categoryId == null ? null : category(categoryId);
        if (cat == null) {
            v.add("categoryId", "Vui lòng chọn danh mục món");
        } else if (!cat.active()) {
            boolean keepsOldCategory = currentCategoryId != null && currentCategoryId == cat.id();
            if (!keepsOldCategory) v.add("categoryId", "Danh mục đang ngừng hoạt động, hãy chọn danh mục khác");
            else if (!"stopped".equals(status))
                v.add("categoryId", "Danh mục \"" + cat.name() + "\" đang ngừng hoạt động: món chỉ được ở trạng thái Ngừng bán");
        }

        long price = 0;
        BigDecimal p = in.price();
        if (p == null || p.signum() < 0) v.add("price", "Đơn giá phải là số không âm");
        else if (p.stripTrailingZeros().scale() > 0) v.add("price", "Đơn giá tính theo VND, không có phần lẻ");
        else if (p.compareTo(BigDecimal.valueOf(PRICE_MAX)) > 0) v.add("price", "Đơn giá vượt quá giới hạn cho phép");
        else price = p.longValueExact();

        String description = Vi.trim(in.description());
        if (description.length() > TEXT_MAX) v.add("description", "Mô tả tối đa " + TEXT_MAX + " ký tự");
        String ingredients = Vi.trim(in.ingredients());
        if (ingredients.length() > TEXT_MAX) v.add("ingredients", "Thành phần tối đa " + TEXT_MAX + " ký tự");

        int spicy = in.spicyLevel() == null ? 0 : in.spicyLevel();
        if (spicy < 0 || spicy > 3) v.add("spicyLevel", "Mức cay không hợp lệ");

        List<Long> allergenIds = new ArrayList<>();
        if (in.allergens() != null && !in.allergens().isEmpty()) {
            Map<String, Long> known = new HashMap<>();
            jdbc.sql("SELECT id, name FROM allergens").query((rs, n) -> known.put(rs.getString("name"), rs.getLong("id"))).list();
            List<String> unknown = new ArrayList<>();
            for (String a : in.allergens().stream().map(Vi::trim).distinct().toList()) {
                Long aid = known.get(a);
                if (aid == null) unknown.add(a);
                else allergenIds.add(aid);
            }
            if (!unknown.isEmpty()) v.add("allergens", "Dị nguyên không hợp lệ: " + String.join(", ", unknown));
        }

        if (!v.has("name") && cat != null) {
            // So sánh theo collation của CSDL (không phân biệt hoa thường, dấu) — đúng như ràng buộc UNIQUE.
            var dup = jdbc.sql("SELECT code, name FROM dishes WHERE category_id = ? AND name = ? AND id <> ?")
                .params(cat.id(), name, editingId == null ? 0 : editingId)
                .query((rs, n) -> new String[] {rs.getString("code"), rs.getString("name")})
                .optional();
            dup.ifPresent(d -> v.add("name", "Đã có món \"" + d[1] + "\" (" + d[0] + ") trong danh mục này"));
        }
        v.throwIfAny();
        return new Clean(name, cat.id(), price, description, status, ingredients, allergenIds, spicy);
    }

    private void saveAllergens(long dishId, List<Long> allergenIds) {
        jdbc.sql("DELETE FROM dish_allergens WHERE dish_id = ?").param(dishId).update();
        for (Long aid : allergenIds) {
            jdbc.sql("INSERT INTO dish_allergens (dish_id, allergen_id) VALUES (?, ?)").params(dishId, aid).update();
        }
    }

    /** MA001, MA002... — số lớn nhất hiện có + 1 (khóa bảng dishes trong transaction để hai người thêm cùng lúc không trùng). */
    private String nextCode() {
        Integer max = jdbc.sql("""
                SELECT MAX(CAST(SUBSTRING(code, 3) AS UNSIGNED)) FROM dishes WHERE code REGEXP '^MA[0-9]+$' FOR UPDATE
                """).query(Integer.class).optional().orElse(null);
        return String.format("MA%03d", (max == null ? 0 : max) + 1);
    }

    /* ------------------------------------------------------------------ Trạng thái / xóa */

    @Transactional
    public Dish setStatus(String idText, String status) {
        long id = Ids.parse(idText, notFound());
        if (!"selling".equals(status) && !"stopped".equals(status))
            throw new ValidationException("status", "Trạng thái bán không hợp lệ");
        Row current = row(id);
        if (current.status().equals(status)) return find(id);
        if ("selling".equals(status)) {
            Cat cat = category(current.categoryId());
            if (cat != null && !cat.active())
                throw new BusinessException("Danh mục \"" + cat.name() + "\" đang ngừng hoạt động, hãy bật danh mục trước");
        }
        jdbc.sql("UPDATE dishes SET status = ? WHERE id = ?").params(status, id).update();
        audit.log("dish", "Đổi trạng thái món",
            current.name() + ": " + statusLabel(current.status()) + " → " + statusLabel(status), "dishes", id);
        return find(id);
    }

    @Transactional
    public void delete(String idText) {
        long id = Ids.parse(idText, notFound());
        Row current = row(id);
        if (current.usedInOrders()) {
            throw new BusinessException("Món đã xuất hiện trong đơn hàng/hóa đơn nên không thể xóa. "
                + "Hãy chuyển sang \"Ngừng bán\" để bảo toàn lịch sử giao dịch.");
        }
        jdbc.sql("DELETE FROM dishes WHERE id = ?").param(id).update();
        images.deleteAfterCommit(current.imageKey());
        audit.log("dish", "Xóa món ăn", "Xóa món " + current.code() + " " + current.name(), "dishes", id);
    }

    /* ------------------------------------------------------------------ Danh mục */

    public List<Category> categories() {
        return jdbc.sql("""
                SELECT c.id, c.name, c.is_active, c.sort_order,
                       (SELECT COUNT(*) FROM dishes d WHERE d.category_id = c.id) AS dish_count
                FROM dish_categories c ORDER BY c.sort_order, c.id
                """)
            .query((rs, n) -> new Category(Ids.str(rs.getLong("id")), rs.getString("name"), rs.getBoolean("is_active"),
                rs.getInt("sort_order"), rs.getInt("dish_count")))
            .list();
    }

    @Transactional
    public Category saveCategory(String idText, CategoryInput in) {
        String name = Vi.collapse(in.name());
        boolean active = in.active() == null || in.active();
        if (name.isEmpty()) throw new ValidationException("name", "Vui lòng nhập tên danh mục");
        if (name.length() > 50) throw new ValidationException("name", "Tên danh mục tối đa 50 ký tự");
        Long id = idText == null ? null : Ids.parse(idText, "Danh mục không tồn tại");
        Cat current = id == null ? null : category(id);
        if (id != null && current == null) throw BusinessException.notFound("Danh mục không tồn tại");
        boolean dup = jdbc.sql("SELECT COUNT(*) FROM dish_categories WHERE name = ? AND id <> ?")
            .params(name, id == null ? 0 : id).query(Long.class).single() > 0;
        if (dup) throw new ValidationException("name", "Tên danh mục đã tồn tại");

        if (current == null) {
            jdbc.sql("""
                    INSERT INTO dish_categories (name, is_active, sort_order)
                    SELECT ?, ?, COALESCE(MAX(sort_order), 0) + 1 FROM dish_categories
                    """).params(name, active).update();
            id = jdbc.sql("SELECT LAST_INSERT_ID()").query(Long.class).single();
            audit.log("dish", "Thêm danh mục", name, "dish_categories", id);
        } else {
            jdbc.sql("UPDATE dish_categories SET name = ?, is_active = ? WHERE id = ?").params(name, active, id).update();
            String note = current.active() == active ? "" : (active ? " (bật)" : " (tắt)");
            String rename = current.name().equals(name) ? "" : current.name() + " → ";
            audit.log("dish", "Cập nhật danh mục", rename + name + note, "dish_categories", id);
        }
        long savedId = id;
        return categories().stream().filter(c -> c.id().equals(Ids.str(savedId))).findFirst().orElseThrow();
    }

    private Cat category(long id) {
        return jdbc.sql("SELECT id, name, is_active FROM dish_categories WHERE id = ?").param(id)
            .query((rs, n) -> new Cat(rs.getLong("id"), rs.getString("name"), rs.getBoolean("is_active")))
            .optional().orElse(null);
    }

    public List<String> allergens() {
        return jdbc.sql("SELECT name FROM allergens ORDER BY id").query(String.class).list();
    }

    /* ------------------------------------------------------------------ Tiện ích */

    static String statusLabel(String status) {
        return "stopped".equals(status) ? "Ngừng bán" : "Đang bán";
    }

    /** 35000 → "35.000 ₫" (giống formatCurrency ở frontend). */
    static String money(long vnd) {
        return String.format(Locale.GERMANY, "%,d", vnd) + " ₫";
    }

    private static String emptyToNull(String s) {
        return s == null || s.isEmpty() ? null : s;
    }
}
