package com.rms.warehouse;

import com.rms.audit.AuditService;
import com.rms.common.BusinessException;
import com.rms.common.CurrentUserService;
import com.rms.common.Db;
import com.rms.common.Ids;
import com.rms.common.Paged;
import com.rms.common.Times;
import com.rms.common.ValidationException;
import com.rms.common.Vi;
import java.math.BigDecimal;
import java.text.Collator;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * UC-KHO-02..06: danh sách, thêm, sửa, ngừng / sử dụng lại / xóa nguyên liệu, chi tiết + thẻ kho.
 *
 * Quy tắc chính (đặc tả):
 *  - Tên duy nhất (so không phân biệt hoa thường, dấu); nhóm và đơn vị kho chọn từ danh sách cố định.
 *  - Đơn vị kho khóa khi nguyên liệu đã có sổ kho, phiếu mua, liên kết nhà cung cấp hoặc công thức món;
 *    cùng điều kiện đó thì không xóa được (chỉ ngừng sử dụng).
 *  - Tồn kho và giá vốn không sửa tay: chỉ đổi qua nhập, xuất, kiểm kê (StockLedger). Khi thêm mới có thể khai
 *    tồn ban đầu → hệ thống lập phiếu nhập "Tồn đầu kỳ" (PN…).
 */
@Service
public class IngredientService {
    public static final int PAGE_SIZE = 10;
    public static final List<String> GROUPS = List.of("meat", "seafood", "produce", "spice", "dry", "dairy", "drink", "other");
    public static final List<String> STOCK_UNITS = List.of("kg", "g", "lít", "ml", "cái", "quả", "bó", "hộp", "chai", "lon", "gói", "túi");
    static final int NAME_MIN = 2;
    static final int NAME_MAX = 100;
    static final int NOTE_MAX = 300;
    private static final Collator VI = Collator.getInstance(Locale.forLanguageTag("vi-VN"));

    public record Ingredient(String id, String code, String name, String group, String unit, double minLevel, double onHand,
                             Double avgCost, String status, String note, String stockLevel, boolean deletable,
                             boolean unitLocked, int openPurchaseCount, List<String> dishNames, String createdAt,
                             String createdBy, String updatedAt) {}

    public record SupplierRow(String supplierId, String supplierCode, String supplierName, boolean supplierActive,
                              String purchaseUnit, double factor, double price, Double minOrder, boolean linkActive) {}

    public record Dish(String code, String name, double qty) {}

    public record IngredientDetail(String id, String code, String name, String group, String unit, double minLevel,
                                   double onHand, Double avgCost, String status, String note, String stockLevel,
                                   boolean deletable, boolean unitLocked, int openPurchaseCount, List<String> dishNames,
                                   String createdAt, String createdBy, String updatedAt, double pendingQty,
                                   List<SupplierRow> suppliers, List<Dish> dishes) {}

    public record Option(String id, String code, String name, String unit, boolean active, Double avgCost, double onHand) {}

    public record Move(String id, String ingredientId, String at, String type, String docCode, double qtyChange,
                       double balanceAfter, double unitCost, String by) {}

    public record IngredientInput(String name, String group, String unit, BigDecimal minLevel, String note,
                                  BigDecimal openingQty, BigDecimal openingCost) {}

    public record StatusInput(String status) {}

    private record Row(long id, String code, String name, String group, String unit, BigDecimal min, BigDecimal qty,
                       BigDecimal avgCost, boolean active, String note, boolean used, int openPo, String createdAt,
                       String createdBy, String updatedAt) {
        String level() {
            if (!active) return null;
            if (qty.signum() <= 0) return "out";
            if (qty.compareTo(min) <= 0) return "low";
            return "ok";
        }
    }

    private final JdbcClient jdbc;
    private final AuditService audit;
    private final CurrentUserService currentUser;
    private final WarehouseCodes codes;
    private final StockLedger ledger;
    private final ReceiptService receipts;

    public IngredientService(JdbcClient jdbc, AuditService audit, CurrentUserService currentUser, WarehouseCodes codes,
                             StockLedger ledger, ReceiptService receipts) {
        this.jdbc = jdbc;
        this.audit = audit;
        this.currentUser = currentUser;
        this.codes = codes;
        this.ledger = ledger;
        this.receipts = receipts;
    }

    /* ------------------------------------------------------------------ Đọc */

    private List<Row> rows(String where, Object... params) {
        return jdbc.sql("""
                SELECT i.id, i.code, i.name, i.group_key, i.unit, i.min_level, i.stock_qty, i.avg_cost, i.is_active, i.note,
                       i.created_at, i.updated_at, u.full_name AS created_by_name,
                       (EXISTS (SELECT 1 FROM stock_transactions t WHERE t.ingredient_id = i.id)
                        OR EXISTS (SELECT 1 FROM purchase_order_items p WHERE p.ingredient_id = i.id)
                        OR EXISTS (SELECT 1 FROM supplier_ingredients s WHERE s.ingredient_id = i.id)
                        OR EXISTS (SELECT 1 FROM dish_ingredients d WHERE d.ingredient_id = i.id)) AS used,
                       (SELECT COUNT(DISTINCT po.id) FROM purchase_orders po
                          JOIN purchase_order_items poi ON poi.purchase_order_id = po.id
                         WHERE po.status = 'ordered' AND po.receive_status IN ('not_received','partial')
                           AND poi.ingredient_id = i.id AND poi.qty_received < poi.qty_ordered) AS open_po
                FROM ingredients i LEFT JOIN users u ON u.id = i.created_by
                %s
                ORDER BY i.code
                """.formatted(where))
            .params(params)
            .query((rs, n) -> new Row(rs.getLong("id"), rs.getString("code"), rs.getString("name"), rs.getString("group_key"),
                rs.getString("unit"), rs.getBigDecimal("min_level"), rs.getBigDecimal("stock_qty"), rs.getBigDecimal("avg_cost"),
                rs.getBoolean("is_active"), Vi.trim(rs.getString("note")), rs.getBoolean("used"), rs.getInt("open_po"),
                Times.iso(Db.dateTime(rs, "created_at")), Vi.trim(rs.getString("created_by_name")),
                Times.iso(Db.dateTime(rs, "updated_at"))))
            .list();
    }

    private Map<Long, List<String>> dishNames() {
        Map<Long, List<String>> out = new LinkedHashMap<>();
        jdbc.sql("SELECT di.ingredient_id, d.name FROM dish_ingredients di JOIN dishes d ON d.id = di.dish_id ORDER BY d.name")
            .query((rs, n) -> Map.entry(rs.getLong("ingredient_id"), rs.getString("name")))
            .list()
            .forEach(e -> out.computeIfAbsent(e.getKey(), k -> new ArrayList<>()).add(e.getValue()));
        return out;
    }

    private static Ingredient toDto(Row r, List<String> dishes) {
        return new Ingredient(Ids.str(r.id()), r.code(), r.name(), r.group(), r.unit(), r.min().doubleValue(),
            r.qty().doubleValue(), r.avgCost() == null ? null : r.avgCost().doubleValue(), r.active() ? "active" : "inactive",
            r.note(), r.level(), !r.used(), r.used(), r.openPo(), dishes == null ? List.of() : dishes, r.createdAt(),
            r.createdBy(), r.updatedAt());
    }

    private Row row(long id) {
        return rows("WHERE i.id = ?", id).stream().findFirst()
            .orElseThrow(() -> BusinessException.notFound("Không tìm thấy nguyên liệu"));
    }

    public Paged<Ingredient> list(String keyword, String group, String status, String stock, int page) {
        Map<Long, List<String>> dishes = dishNames();
        List<Ingredient> all = rows("").stream()
            .filter(r -> Vi.blank(keyword) || Vi.matches(r.name(), keyword) || Vi.matches(r.code(), keyword))
            .filter(r -> Vi.blank(group) || r.group().equals(group))
            .filter(r -> Vi.blank(status) || "all".equals(status) || (r.active() ? "active" : "inactive").equals(status))
            .filter(r -> Vi.blank(stock) || "all".equals(stock) || stock.equals(r.level()))
            .map(r -> toDto(r, dishes.get(r.id())))
            .toList();
        return Paged.of(all, page, PAGE_SIZE);
    }

    public Ingredient one(String idText) {
        Row r = row(Ids.parse(idText, "Không tìm thấy nguyên liệu"));
        return toDto(r, dishNames().get(r.id()));
    }

    public IngredientDetail detail(String idText) {
        long id = Ids.parse(idText, "Không tìm thấy nguyên liệu");
        Ingredient i = toDto(row(id), dishNames().get(id));
        // Phần còn chờ nhận của các phiếu "Đã đặt", quy ra đơn vị kho theo hệ số đã chốt trên từng dòng.
        BigDecimal pending = jdbc.sql("""
                SELECT COALESCE(SUM((poi.qty_ordered - poi.qty_received) * poi.factor), 0)
                FROM purchase_order_items poi JOIN purchase_orders po ON po.id = poi.purchase_order_id
                WHERE po.status = 'ordered' AND po.receive_status IN ('not_received','partial') AND poi.ingredient_id = ?
                  AND poi.qty_received < poi.qty_ordered
                """).param(id).query(BigDecimal.class).single();
        List<SupplierRow> suppliers = jdbc.sql("""
                SELECT s.id, s.code, s.name, s.is_active AS sup_active, si.purchase_unit, si.factor, si.price, si.min_order,
                       si.is_active AS link_active
                FROM supplier_ingredients si JOIN suppliers s ON s.id = si.supplier_id
                WHERE si.ingredient_id = ? ORDER BY s.code
                """).param(id)
            .query((rs, n) -> new SupplierRow(Ids.str(rs.getLong("id")), rs.getString("code"), rs.getString("name"),
                rs.getBoolean("sup_active"), rs.getString("purchase_unit"), rs.getBigDecimal("factor").doubleValue(),
                rs.getBigDecimal("price").doubleValue(),
                rs.getBigDecimal("min_order") == null ? null : rs.getBigDecimal("min_order").doubleValue(),
                rs.getBoolean("link_active")))
            .list();
        List<Dish> dishes = jdbc.sql("""
                SELECT d.code, d.name, di.quantity FROM dish_ingredients di JOIN dishes d ON d.id = di.dish_id
                WHERE di.ingredient_id = ? ORDER BY d.code
                """).param(id)
            .query((rs, n) -> new Dish(rs.getString("code"), rs.getString("name"), rs.getBigDecimal("quantity").doubleValue()))
            .list();
        return new IngredientDetail(i.id(), i.code(), i.name(), i.group(), i.unit(), i.minLevel(), i.onHand(), i.avgCost(),
            i.status(), i.note(), i.stockLevel(), i.deletable(), i.unitLocked(), i.openPurchaseCount(), i.dishNames(),
            i.createdAt(), i.createdBy(), i.updatedAt(), pending.doubleValue(), suppliers, dishes);
    }

    /** Ô chọn nguyên liệu trong các form (liên kết nhà cung cấp, phiếu mua, xuất kho…): sắp theo tên tiếng Việt. */
    public List<Option> options() {
        return jdbc.sql("SELECT id, code, name, unit, is_active, avg_cost, stock_qty FROM ingredients")
            .query((rs, n) -> new Option(Ids.str(rs.getLong("id")), rs.getString("code"), rs.getString("name"),
                rs.getString("unit"), rs.getBoolean("is_active"),
                rs.getBigDecimal("avg_cost") == null ? null : rs.getBigDecimal("avg_cost").doubleValue(),
                rs.getBigDecimal("stock_qty").doubleValue()))
            .list().stream()
            .sorted(Comparator.comparing(Option::name, VI))
            .toList();
    }

    /**
     * Thẻ kho: mới nhất trước; "Tồn sau" tính theo thứ tự ghi sổ.
     * type: all | in (nhập) | out (xuất) | adjust (kiểm kê, hủy phiếu nhập).
     */
    public Paged<Move> stockCard(String idText, String from, String to, String type, int page) {
        long id = Ids.parse(idText, "Không tìm thấy nguyên liệu");
        row(id);
        LocalDate fromDate = Vi.blank(from) ? null : Times.parseDate(from);
        LocalDate toDate = Vi.blank(to) ? null : Times.parseDate(to);
        if (fromDate != null && toDate != null && fromDate.isAfter(toDate)) {
            throw new ValidationException("to", "Ngày kết thúc phải sau hoặc bằng ngày bắt đầu");
        }
        List<Move> all = jdbc.sql("""
                SELECT t.id, t.created_at, t.txn_type, t.move_type, t.doc_code, t.quantity_change, t.unit_cost,
                       u.full_name, SUM(t.quantity_change) OVER (ORDER BY t.created_at, t.id) AS balance
                FROM stock_transactions t LEFT JOIN users u ON u.id = t.created_by
                WHERE t.ingredient_id = ?
                ORDER BY t.created_at DESC, t.id DESC
                """).param(id)
            .query((rs, n) -> {
                var at = Db.dateTime(rs, "created_at");
                String moveType = rs.getString("move_type");
                if (moveType == null) {
                    moveType = switch (rs.getString("txn_type")) {
                        case "import" -> "opening";
                        case "export" -> "issue_other";
                        default -> "stocktake";
                    };
                }
                BigDecimal cost = rs.getBigDecimal("unit_cost");
                return Map.entry(at.toLocalDate(), new Move(Ids.str(rs.getLong("id")), Ids.str(id), Times.iso(at), moveType,
                    Vi.trim(rs.getString("doc_code")), rs.getBigDecimal("quantity_change").doubleValue(),
                    rs.getBigDecimal("balance").doubleValue(), cost == null ? 0 : cost.doubleValue(),
                    Vi.trim(rs.getString("full_name"))));
            })
            .list().stream()
            .filter(e -> fromDate == null || !e.getKey().isBefore(fromDate))
            .filter(e -> toDate == null || !e.getKey().isAfter(toDate))
            .map(Map.Entry::getValue)
            .filter(m -> typeMatches(m.type(), type))
            .toList();
        return Paged.of(all, page, PAGE_SIZE);
    }

    private static boolean typeMatches(String moveType, String filter) {
        if (Vi.blank(filter) || "all".equals(filter)) return true;
        return switch (filter) {
            case "in" -> StockLedger.RECEIPT_TYPES.contains(moveType);
            case "out" -> moveType.startsWith("issue_");
            case "adjust" -> "stocktake".equals(moveType) || "receipt_cancel".equals(moveType);
            default -> true;
        };
    }

    /* ------------------------------------------------------------------ Ghi */

    private record Clean(String name, String group, String unit, BigDecimal min, String note, BigDecimal openingQty,
                         BigDecimal openingCost) {}

    private Clean validate(IngredientInput in, Row current) {
        var v = new ValidationException.Collector();
        String name = Vi.collapse(in.name());
        if (name.isEmpty()) v.add("name", "Vui lòng nhập tên nguyên liệu");
        else if (name.length() < NAME_MIN || name.length() > NAME_MAX) v.add("name", "Tên nguyên liệu dài từ 2 đến 100 ký tự");
        else {
            String key = Vi.normalize(name);
            jdbc.sql("SELECT id, code, name FROM ingredients")
                .query((rs, n) -> new String[] {Long.toString(rs.getLong("id")), rs.getString("code"), rs.getString("name")})
                .list().stream()
                .filter(r -> current == null || Long.parseLong(r[0]) != current.id())
                .filter(r -> Vi.normalize(r[2]).equals(key))
                .findFirst()
                .ifPresent(r -> v.add("name", "Nguyên liệu " + r[2] + " đã tồn tại (" + r[1] + ")"));
        }
        String group = Vi.trim(in.group());
        if (!GROUPS.contains(group)) v.add("group", "Vui lòng chọn nhóm nguyên liệu");
        String unit = Vi.trim(in.unit());
        if (!STOCK_UNITS.contains(unit)) v.add("unit", "Vui lòng chọn đơn vị kho");
        else if (current != null && !current.unit().equals(unit) && current.used()) {
            v.add("unit", "Không thể đổi đơn vị kho của nguyên liệu đã có giao dịch");
        }
        BigDecimal min = in.minLevel() == null ? BigDecimal.ZERO : in.minLevel();
        if (!WarehouseFormat.validQty(min)) v.add("minLevel", "Số lượng phải là số không âm, tối đa 3 chữ số thập phân");
        BigDecimal openingQty = BigDecimal.ZERO;
        BigDecimal openingCost = null;
        if (current == null) {
            openingQty = in.openingQty() == null ? BigDecimal.ZERO : in.openingQty();
            if (!WarehouseFormat.validQty(openingQty)) v.add("openingQty", "Số lượng phải là số không âm, tối đa 3 chữ số thập phân");
            else if (openingQty.signum() > 0) {
                openingCost = in.openingCost();
                if (!WarehouseFormat.validMoney(openingCost)) v.add("openingCost", "Vui lòng nhập giá vốn ban đầu lớn hơn 0");
            }
        }
        String note = Vi.trim(in.note());
        if (note.length() > NOTE_MAX) v.add("note", "Ghi chú tối đa 300 ký tự");
        v.throwIfAny();
        return new Clean(name, group, unit, min, note, openingQty, openingCost);
    }

    @Transactional
    public Ingredient create(IngredientInput in) {
        Clean c = validate(in, null);
        String code = codes.catalog("NL");
        // Mức cảnh báo ban đầu = mức tồn sau khi nhập tồn đầu kỳ: nguyên liệu mới không phát thông báo
        // "sắp hết / hết hàng" — thông báo chỉ gửi khi tồn giảm xuống qua các mức (UC-KHO-27).
        String level = c.openingQty().signum() <= 0 ? "out" : c.openingQty().compareTo(c.min()) <= 0 ? "low" : "ok";
        jdbc.sql("""
                INSERT INTO ingredients (code, name, group_key, unit, min_level, avg_cost, note, alert_level, created_by)
                VALUES (?, ?, ?, ?, ?, NULL, ?, ?, ?)
                """)
            .params(code, c.name(), c.group(), c.unit(), c.min(), c.note().isEmpty() ? null : c.note(), level,
                currentUser.get().id())
            .update();
        long id = jdbc.sql("SELECT LAST_INSERT_ID()").query(Long.class).single();
        if (c.openingQty().signum() > 0) receipts.createOpening(id, c.unit(), c.openingQty(), c.openingCost());
        audit.log("warehouse", "Thêm nguyên liệu", "Thêm " + c.name() + " (" + code + ")", "ingredients", id);
        return one(Ids.str(id));
    }

    @Transactional
    public Ingredient update(String idText, IngredientInput in) {
        long id = Ids.parse(idText, "Không tìm thấy nguyên liệu");
        Row current = row(id);
        Clean c = validate(in, current);
        jdbc.sql("UPDATE ingredients SET name = ?, group_key = ?, unit = ?, min_level = ?, note = ? WHERE id = ?")
            .params(c.name(), c.group(), c.unit(), c.min(), c.note().isEmpty() ? null : c.note(), id)
            .update();
        // Tồn tối thiểu mới có thể làm nguyên liệu chuyển sang "Sắp hết" → thông báo (UC-KHO-04, 6a).
        ledger.checkAlert(id);
        audit.log("warehouse", "Sửa nguyên liệu", "Cập nhật " + c.name() + " (" + current.code() + ")", "ingredients", id);
        return one(Ids.str(id));
    }

    @Transactional
    public Ingredient setStatus(String idText, String status) {
        long id = Ids.parse(idText, "Không tìm thấy nguyên liệu");
        Row r = row(id);
        if (!Set.of("active", "inactive").contains(status)) throw new ValidationException("status", "Trạng thái không hợp lệ");
        boolean active = "active".equals(status);
        if (r.active() == active) {
            throw new BusinessException("Nguyên liệu đã ở trạng thái " + (active ? "Đang sử dụng" : "Ngừng sử dụng"));
        }
        jdbc.sql("UPDATE ingredients SET is_active = ? WHERE id = ?").params(active, id).update();
        audit.log("warehouse", active ? "Sử dụng lại nguyên liệu" : "Ngừng sử dụng nguyên liệu",
            (active ? "Sử dụng lại " : "Ngừng sử dụng ") + r.name() + " (" + r.code() + ")", "ingredients", id);
        return one(Ids.str(id));
    }

    @Transactional
    public void delete(String idText) {
        long id = Ids.parse(idText, "Không tìm thấy nguyên liệu");
        Row r = row(id);
        if (r.used()) {
            throw new BusinessException("Nguyên liệu đã có giao dịch kho, phiếu mua, liên kết nhà cung cấp hoặc nằm trong "
                + "công thức món nên không thể xóa. Bạn có thể ngừng sử dụng nguyên liệu này.");
        }
        jdbc.sql("DELETE FROM ingredients WHERE id = ?").param(id).update();
        audit.log("warehouse", "Xóa nguyên liệu", "Xóa " + r.name() + " (" + r.code() + ")", "ingredients", id);
    }
}
