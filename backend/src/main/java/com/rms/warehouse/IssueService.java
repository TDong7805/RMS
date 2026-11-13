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
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * UC-KHO-20 (tạo phiếu xuất) và UC-KHO-21 (lịch sử xuất kho).
 * Phiếu xuất không sửa, không xóa, không hủy; giá trị xuất = SL × giá vốn lúc xuất; xuất không đổi giá vốn.
 * Xuất được nguyên liệu đã ngừng sử dụng (còn tồn). Xuất hủy bắt buộc ghi chú, tính vào "Hao hụt" của Dashboard.
 */
@Service
public class IssueService {
    static final int PAGE_SIZE = IngredientService.PAGE_SIZE;
    static final Set<String> REASONS = Set.of("kitchen", "damaged", "expired", "other");
    private static final Map<String, String> MOVE = Map.of("kitchen", "issue_kitchen", "damaged", "issue_waste",
        "expired", "issue_waste", "other", "issue_other");
    private static final Map<String, String> LABEL = Map.of("kitchen", "Xuất cho bếp", "damaged", "Hủy – hư hỏng",
        "expired", "Hủy – hết hạn", "other", "Khác");
    private static final String NOT_FOUND = "Không tìm thấy phiếu xuất";

    public record IssueRow(String id, String code, String at, String reason, String receiver, int itemCount, double value,
                           String by, String itemNames) {}

    public record IssuePage(List<IssueRow> items, int total, int page, int pageCount, double totalValue) {}

    public record IssueLine(String id, String ingredientId, String ingredientCode, String ingredientName, String unit,
                            double qty, Double unitCost, double value) {}

    public record IssueDetail(String id, String code, String at, String reason, String receiver, String note, double value,
                              String by, List<IssueLine> lines) {}

    public record Employee(String id, String fullName, String role) {}

    public record LineInput(String ingredientId, BigDecimal qty) {}

    public record IssueInput(String reason, String receiverId, String note, List<LineInput> lines) {}

    private final JdbcClient jdbc;
    private final AuditService audit;
    private final CurrentUserService currentUser;
    private final WarehouseCodes codes;
    private final StockLedger ledger;

    public IssueService(JdbcClient jdbc, AuditService audit, CurrentUserService currentUser, WarehouseCodes codes,
                        StockLedger ledger) {
        this.jdbc = jdbc;
        this.audit = audit;
        this.currentUser = currentUser;
        this.codes = codes;
        this.ledger = ledger;
    }

    /** Nhân viên đang hoạt động (chọn người nhận khi xuất cho bếp). */
    public List<Employee> employees() {
        return jdbc.sql("""
                SELECT u.id, u.full_name, r.code FROM users u JOIN roles r ON r.id = u.role_id
                WHERE u.deleted_at IS NULL AND u.status = 'active' ORDER BY (r.code = 'kitchen') DESC, u.full_name
                """)
            .query((rs, n) -> new Employee(Ids.str(rs.getLong("id")), rs.getString("full_name"), rs.getString("code")))
            .list();
    }

    @Transactional
    public IssueDetail create(IssueInput in) {
        var v = new ValidationException.Collector();
        String reason = Vi.trim(in.reason());
        String note = Vi.trim(in.note());
        if (!REASONS.contains(reason)) v.add("reason", "Vui lòng chọn lý do xuất");
        else if (note.isEmpty() && !"kitchen".equals(reason)) {
            v.add("note", "other".equals(reason) ? "Vui lòng nhập ghi chú" : "Vui lòng nhập ghi chú cho phiếu xuất hủy");
        }
        if (note.length() > 500) v.add("note", "Ghi chú tối đa 500 ký tự");
        Long receiverId = "kitchen".equals(reason) ? Ids.parseOrNull(in.receiverId()) : null;
        if (receiverId != null) {
            boolean ok = jdbc.sql("SELECT COUNT(*) FROM users WHERE id = ? AND deleted_at IS NULL AND status = 'active'")
                .param(receiverId).query(Integer.class).single() > 0;
            if (!ok) v.add("receiverId", "Người nhận không còn hoạt động");
        }
        List<LineInput> inputs = in.lines() == null ? List.of() : in.lines();
        if (inputs.isEmpty()) v.add("lines", "Phiếu xuất cần ít nhất một nguyên liệu");
        record Line(long ingredientId, String name, BigDecimal qty) {}
        List<Line> lines = new ArrayList<>();
        Set<Long> seen = new HashSet<>();
        for (int i = 0; i < inputs.size(); i++) {
            LineInput l = inputs.get(i);
            String key = "lines." + i + ".";
            Long ingId = Ids.parseOrNull(l.ingredientId());
            var ing = ingId == null ? null : jdbc.sql("SELECT name, unit, stock_qty FROM ingredients WHERE id = ? FOR UPDATE").param(ingId)
                .query((rs, n) -> new Object[] {rs.getString("name"), rs.getString("unit"), rs.getBigDecimal("stock_qty")})
                .optional().orElse(null);
            if (ing == null) {
                v.add(key + "ingredientId", "Vui lòng chọn nguyên liệu");
                continue;
            }
            if (!seen.add(ingId)) v.add(key + "ingredientId", "Nguyên liệu bị chọn trùng");
            BigDecimal qty = l.qty();
            if (qty == null || qty.signum() <= 0 || !WarehouseFormat.validQty(qty)) {
                v.add(key + "qty", "Số lượng phải lớn hơn 0");
                continue;
            }
            BigDecimal onHand = (BigDecimal) ing[2];
            if (qty.compareTo(onHand) > 0) {
                v.add(key + "qty", "Tồn hiện tại chỉ còn " + WarehouseFormat.qty(onHand) + " " + ing[1]);
                continue;
            }
            lines.add(new Line(ingId, (String) ing[0], qty));
        }
        v.throwIfAny();

        String code = codes.document("PX", Times.today());
        jdbc.sql("INSERT INTO stock_issues (code, reason, receiver_id, note, created_by) VALUES (?, ?, ?, ?, ?)")
            .params(code, reason, receiverId, note.isEmpty() ? null : note, currentUser.get().id()).update();
        long issueId = jdbc.sql("SELECT LAST_INSERT_ID()").query(Long.class).single();
        BigDecimal total = BigDecimal.ZERO;
        for (Line l : lines) {
            BigDecimal cost = ledger.qtyAndCost(l.ingredientId())[1];
            BigDecimal value = cost == null ? BigDecimal.ZERO : PurchaseMath.money(l.qty().multiply(cost));
            total = total.add(value);
            jdbc.sql("INSERT INTO stock_issue_items (issue_id, ingredient_id, qty, unit_cost, value) VALUES (?, ?, ?, ?, ?)")
                .params(issueId, l.ingredientId(), l.qty(), cost, value).update();
            ledger.record(l.ingredientId(), MOVE.get(reason), l.qty().negate(), null, code,
                LABEL.get(reason) + (note.isEmpty() ? "" : ": " + note), null, null, issueId, null);
        }
        jdbc.sql("UPDATE stock_issues SET total_value = ? WHERE id = ?").params(total, issueId).update();
        audit.log("warehouse", "Xuất kho", "Xuất kho " + code + " (" + LABEL.get(reason) + "), " + lines.size()
            + " nguyên liệu, " + WarehouseFormat.money(total), "stock_issues", issueId);
        return detail(Ids.str(issueId));
    }

    private record Head(long id, String code, LocalDateTime at, String reason, String receiver, String note, BigDecimal value,
                        String by, int itemCount, String itemNames) {}

    private List<Head> heads(String where, Object... params) {
        return jdbc.sql("""
                SELECT i.*, ru.full_name AS receiver_name, u.full_name AS by_name,
                       (SELECT COUNT(*) FROM stock_issue_items x WHERE x.issue_id = i.id) AS item_count,
                       (SELECT GROUP_CONCAT(g.name SEPARATOR '|') FROM stock_issue_items x JOIN ingredients g ON g.id = x.ingredient_id
                         WHERE x.issue_id = i.id) AS item_names
                FROM stock_issues i LEFT JOIN users ru ON ru.id = i.receiver_id LEFT JOIN users u ON u.id = i.created_by
                %s ORDER BY i.created_at DESC, i.id DESC
                """.formatted(where))
            .params(params)
            .query((rs, n) -> new Head(rs.getLong("id"), rs.getString("code"), Db.dateTime(rs, "created_at"), rs.getString("reason"),
                Vi.trim(rs.getString("receiver_name")), Vi.trim(rs.getString("note")), rs.getBigDecimal("total_value"),
                Vi.trim(rs.getString("by_name")), rs.getInt("item_count"), Vi.trim(rs.getString("item_names"))))
            .list();
    }

    public IssuePage list(String keyword, String reason, String from, String to, int page) {
        LocalDate today = Times.today();
        LocalDate fromDate = Vi.blank(from) ? today.minusDays(29) : Times.parseDate(from);
        LocalDate toDate = Vi.blank(to) ? today : Times.parseDate(to);
        if (fromDate.isAfter(toDate)) throw new ValidationException("to", "Khoảng thời gian không hợp lệ");
        if (ChronoUnit.DAYS.between(fromDate, toDate) >= ReceiptService.MAX_RANGE_DAYS) {
            throw new ValidationException("to", "Khoảng thời gian tối đa 366 ngày");
        }
        String k = Vi.trim(keyword);
        List<IssueRow> rows = heads("WHERE i.created_at >= ? AND i.created_at < ?", fromDate.atStartOfDay(), toDate.plusDays(1).atStartOfDay())
            .stream()
            .filter(h -> Vi.blank(reason) || "all".equals(reason) || h.reason().equals(reason))
            .filter(h -> k.isEmpty() || Vi.matches(h.code(), k) || Vi.matches(h.itemNames(), k))
            .map(h -> new IssueRow(Ids.str(h.id()), h.code(), Times.iso(h.at()), h.reason(), h.receiver(), h.itemCount(),
                h.value().doubleValue(), h.by(), h.itemNames().replace("|", ", ")))
            .toList();
        double total = rows.stream().mapToDouble(IssueRow::value).sum();
        Paged<IssueRow> p = Paged.of(rows, page, PAGE_SIZE);
        return new IssuePage(p.items(), p.total(), p.page(), p.pageCount(), total);
    }

    public IssueDetail detail(String idText) {
        long id = Ids.parse(idText, NOT_FOUND);
        Head h = heads("WHERE i.id = ?", id).stream().findFirst().orElseThrow(() -> BusinessException.notFound(NOT_FOUND));
        List<IssueLine> lines = jdbc.sql("""
                SELECT x.*, g.code, g.name, g.unit FROM stock_issue_items x JOIN ingredients g ON g.id = x.ingredient_id
                WHERE x.issue_id = ? ORDER BY x.id
                """).param(id)
            .query((rs, n) -> new IssueLine(Ids.str(rs.getLong("id")), Ids.str(rs.getLong("ingredient_id")), rs.getString("code"),
                rs.getString("name"), rs.getString("unit"), rs.getBigDecimal("qty").doubleValue(),
                rs.getBigDecimal("unit_cost") == null ? null : rs.getBigDecimal("unit_cost").doubleValue(),
                rs.getBigDecimal("value").doubleValue()))
            .list();
        return new IssueDetail(Ids.str(h.id()), h.code(), Times.iso(h.at()), h.reason(), h.receiver(), h.note(),
            h.value().doubleValue(), h.by(), lines);
    }
}
