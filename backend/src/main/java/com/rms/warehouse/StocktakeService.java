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
import com.rms.notification.NotificationService;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * UC-KHO-22 (danh sách), UC-KHO-23 (lập phiếu, đếm, gửi duyệt, xóa nháp, hủy phiếu bị từ chối),
 * UC-KHO-24 (Quản lý nhà hàng duyệt / từ chối).
 *
 * - Tồn sổ sách chụp theo từng dòng, lúc nhập số đếm; chênh lệch = thực tế − sổ sách lúc đếm.
 * - Chỉ điều chỉnh tồn khi duyệt: cộng / trừ đúng phần chênh lệch vào tồn hiện tại (không ghi đè), tất cả hoặc không gì;
 *   giá trị chốt theo giá vốn lúc duyệt; nguyên liệu chưa có giá vốn mà tăng thì lấy đơn giá ước tính làm giá vốn.
 * - Mỗi nguyên liệu chỉ nằm trong một phiếu đang mở (Nháp, Chờ duyệt, Bị từ chối).
 */
@Service
public class StocktakeService {
    static final int PAGE_SIZE = IngredientService.PAGE_SIZE;
    static final Set<String> OPEN = Set.of("draft", "pending", "rejected");
    static final Set<String> REASONS = Set.of("natural", "damaged", "wrong_entry", "lost", "other");
    private static final String NOT_FOUND = "Không tìm thấy phiếu kiểm kê";

    public record StocktakeRow(String id, String code, String createdAt, String scope, int itemCount, int countedCount,
                               int diffCount, double increaseValue, double decreaseValue, boolean provisional, String status,
                               String rejectReason, String createdBy, String approvedBy, String submittedAt) {}

    public record Line(String id, String ingredientId, String code, String name, String group, String unit, boolean active,
                       double onHand, Double avgCost, Double bookQty, Double actualQty, String countedAt, Double diff,
                       String reason, String note, Double estUnitCost, Double suggestedCost, Double value) {}

    public record EventDto(String id, String event, String note, String by, String at) {}

    public record StocktakeDetail(String id, String code, String scope, List<String> groups, String note, String status,
                                  String rejectReason, String cancelReason, String createdBy, String createdAt,
                                  String submittedAt, String approvedBy, String approvedAt, int itemCount, int countedCount,
                                  int diffCount, double increaseValue, double decreaseValue, boolean provisional,
                                  List<Line> lines, List<EventDto> events, String message) {}

    public record CreateInput(String scope, List<String> groups, List<String> ingredientIds, String note) {}

    public record LineInput(BigDecimal actualQty, String reason, String note, BigDecimal estUnitCost) {}

    public record AddLineInput(String ingredientId) {}

    public record ReasonInput(String reason) {}

    private final JdbcClient jdbc;
    private final AuditService audit;
    private final CurrentUserService currentUser;
    private final WarehouseCodes codes;
    private final StockLedger ledger;
    private final NotificationService notifications;

    public StocktakeService(JdbcClient jdbc, AuditService audit, CurrentUserService currentUser, WarehouseCodes codes,
                            StockLedger ledger, NotificationService notifications) {
        this.jdbc = jdbc;
        this.audit = audit;
        this.currentUser = currentUser;
        this.codes = codes;
        this.ledger = ledger;
        this.notifications = notifications;
    }

    private long userId() {
        return currentUser.get().id();
    }

    /* ------------------------------------------------------------------ Đọc */

    private record Head(long id, String code, String scope, String groups, String note, String status, String rejectReason,
                        String cancelReason, long createdById, String createdBy, LocalDateTime createdAt,
                        LocalDateTime submittedAt, String approvedBy, LocalDateTime approvedAt) {}

    private List<Head> heads(String where, Object... params) {
        return jdbc.sql("""
                SELECT s.*, cu.full_name AS created_name, au.full_name AS approved_name
                FROM stocktakes s LEFT JOIN users cu ON cu.id = s.created_by LEFT JOIN users au ON au.id = s.approved_by
                %s ORDER BY s.created_at DESC, s.id DESC
                """.formatted(where))
            .params(params)
            .query((rs, n) -> new Head(rs.getLong("id"), rs.getString("code"), rs.getString("scope"), rs.getString("scope_groups"),
                Vi.trim(rs.getString("note")), rs.getString("status"), rs.getString("reject_reason"), rs.getString("cancel_reason"),
                rs.getLong("created_by"), Vi.trim(rs.getString("created_name")), Db.dateTime(rs, "created_at"),
                Db.dateTime(rs, "submitted_at"), Vi.trim(rs.getString("approved_name")), Db.dateTime(rs, "approved_at")))
            .list();
    }

    private Head head(long id) {
        return heads("WHERE s.id = ?", id).stream().findFirst().orElseThrow(() -> BusinessException.notFound(NOT_FOUND));
    }

    private record Item(long id, long stocktakeId, long ingredientId, String code, String name, String group, String unit,
                        boolean active, BigDecimal onHand, BigDecimal avgCost, BigDecimal bookQty, BigDecimal actualQty,
                        LocalDateTime countedAt, String reason, String note, BigDecimal estUnitCost, BigDecimal adjustValue,
                        BigDecimal suggested) {
        BigDecimal diff() {
            return actualQty == null || bookQty == null ? null : actualQty.subtract(bookQty);
        }

        /** Giá trị chênh lệch: chốt lúc duyệt, nếu chưa duyệt thì tạm tính theo giá vốn hiện tại / đơn giá ước tính. */
        BigDecimal value() {
            if (adjustValue != null) return adjustValue;
            BigDecimal d = diff();
            if (d == null || d.signum() == 0) return d == null ? null : BigDecimal.ZERO;
            BigDecimal cost = avgCost != null ? avgCost : estUnitCost;
            return cost == null ? BigDecimal.ZERO : PurchaseMath.money(d.multiply(cost));
        }
    }

    private List<Item> items(String where, Object... params) {
        return jdbc.sql("""
                SELECT si.*, g.code, g.name, g.group_key, g.unit, g.is_active, g.stock_qty, g.avg_cost,
                       (SELECT MIN(l.price / l.factor) FROM supplier_ingredients l WHERE l.ingredient_id = g.id AND l.is_active = 1) AS suggested
                FROM stocktake_items si JOIN ingredients g ON g.id = si.ingredient_id
                %s ORDER BY g.group_key, g.name
                """.formatted(where))
            .params(params)
            .query((rs, n) -> new Item(rs.getLong("id"), rs.getLong("stocktake_id"), rs.getLong("ingredient_id"), rs.getString("code"),
                rs.getString("name"), rs.getString("group_key"), rs.getString("unit"), rs.getBoolean("is_active"),
                rs.getBigDecimal("stock_qty"), rs.getBigDecimal("avg_cost"), rs.getBigDecimal("book_qty"),
                rs.getBigDecimal("actual_qty"), Db.dateTime(rs, "counted_at"), rs.getString("reason"), Vi.trim(rs.getString("note")),
                rs.getBigDecimal("est_unit_cost"), rs.getBigDecimal("adjust_value"),
                rs.getBigDecimal("suggested") == null ? null : rs.getBigDecimal("suggested").setScale(0, RoundingMode.HALF_UP)))
            .list();
    }

    private static Double d(BigDecimal v) {
        return v == null ? null : v.doubleValue();
    }

    private record Sums(int count, int counted, int diffs, BigDecimal inc, BigDecimal dec) {}

    private static Sums sums(List<Item> its) {
        int counted = 0, diffs = 0;
        BigDecimal inc = BigDecimal.ZERO, dec = BigDecimal.ZERO;
        for (Item i : its) {
            if (i.actualQty() != null) counted++;
            BigDecimal diff = i.diff();
            if (diff != null && diff.signum() != 0) {
                diffs++;
                BigDecimal v = i.value();
                if (v.signum() > 0) inc = inc.add(v);
                else dec = dec.add(v.negate());
            }
        }
        return new Sums(its.size(), counted, diffs, inc, dec);
    }

    private StocktakeRow row(Head h, List<Item> its) {
        Sums s = sums(its);
        return new StocktakeRow(Ids.str(h.id()), h.code(), Times.iso(h.createdAt()), h.scope(), s.count(), s.counted(), s.diffs(),
            s.inc().doubleValue(), s.dec().doubleValue(), !"approved".equals(h.status()), h.status(), h.rejectReason(),
            h.createdBy(), h.approvedBy().isEmpty() ? null : h.approvedBy(), h.submittedAt() == null ? null : Times.iso(h.submittedAt()));
    }

    /** status: all | draft | pending | approved | matched | rejected | cancelled. */
    public Paged<StocktakeRow> list(String keyword, String status, String from, String to, int page) {
        LocalDate fromDate = Vi.blank(from) ? null : Times.parseDate(from);
        LocalDate toDate = Vi.blank(to) ? null : Times.parseDate(to);
        if (fromDate != null && toDate != null && fromDate.isAfter(toDate)) throw new ValidationException("to", "Khoảng thời gian không hợp lệ");
        Map<Long, List<Item>> byStk = new HashMap<>();
        items("").forEach(i -> byStk.computeIfAbsent(i.stocktakeId(), k -> new ArrayList<>()).add(i));
        String k = Vi.trim(keyword);
        List<StocktakeRow> rows = heads("").stream()
            .filter(h -> k.isEmpty() || Vi.matches(h.code(), k))
            .filter(h -> Vi.blank(status) || "all".equals(status) || h.status().equals(status))
            .filter(h -> fromDate == null || !h.createdAt().toLocalDate().isBefore(fromDate))
            .filter(h -> toDate == null || !h.createdAt().toLocalDate().isAfter(toDate))
            .map(h -> row(h, byStk.getOrDefault(h.id(), List.of())))
            .toList();
        return Paged.of(rows, page, PAGE_SIZE);
    }

    public StocktakeDetail detail(String idText) {
        return detail(Ids.parse(idText, NOT_FOUND), null);
    }

    private StocktakeDetail detail(long id, String message) {
        Head h = head(id);
        List<Item> its = items("WHERE si.stocktake_id = ?", id);
        Sums s = sums(its);
        List<Line> lines = its.stream().map(i -> new Line(Ids.str(i.id()), Ids.str(i.ingredientId()), i.code(), i.name(), i.group(),
            i.unit(), i.active(), i.onHand().doubleValue(), d(i.avgCost()), d(i.bookQty()), d(i.actualQty()),
            i.countedAt() == null ? null : Times.iso(i.countedAt()), d(i.diff()), i.reason(), i.note(), d(i.estUnitCost()),
            d(i.suggested()), d(i.value()))).toList();
        List<EventDto> events = jdbc.sql("""
                SELECT e.id, e.event, e.note, e.created_at, u.full_name FROM stocktake_events e LEFT JOIN users u ON u.id = e.created_by
                WHERE e.stocktake_id = ? ORDER BY e.created_at DESC, e.id DESC
                """).param(id)
            .query((rs, n) -> new EventDto(Ids.str(rs.getLong("id")), rs.getString("event"), Vi.trim(rs.getString("note")),
                Vi.trim(rs.getString("full_name")), Times.iso(Db.dateTime(rs, "created_at"))))
            .list();
        List<String> groups = Vi.blank(h.groups()) ? List.of() : List.of(h.groups().split(","));
        return new StocktakeDetail(Ids.str(h.id()), h.code(), h.scope(), groups, h.note(), h.status(), h.rejectReason(),
            h.cancelReason(), h.createdBy(), Times.iso(h.createdAt()), h.submittedAt() == null ? null : Times.iso(h.submittedAt()),
            h.approvedBy().isEmpty() ? null : h.approvedBy(), h.approvedAt() == null ? null : Times.iso(h.approvedAt()), s.count(),
            s.counted(), s.diffs(), s.inc().doubleValue(), s.dec().doubleValue(), !"approved".equals(h.status()), lines, events, message);
    }

    /* ------------------------------------------------------------------ UC-KHO-23: lập phiếu */

    private void event(long id, String event, String note) {
        jdbc.sql("INSERT INTO stocktake_events (stocktake_id, event, note, created_by) VALUES (?, ?, ?, ?)")
            .params(id, event, note == null || note.isEmpty() ? null : note, userId()).update();
    }

    /** Nguyên liệu đang nằm trong phiếu mở khác: id nguyên liệu → mã phiếu. */
    private Map<Long, String> lockedIngredients(Long exceptStocktakeId) {
        Map<Long, String> out = new LinkedHashMap<>();
        jdbc.sql("""
                SELECT si.ingredient_id, s.code FROM stocktake_items si JOIN stocktakes s ON s.id = si.stocktake_id
                WHERE s.status IN ('draft','pending','rejected') AND s.id <> ?
                """).param(exceptStocktakeId == null ? 0L : exceptStocktakeId)
            .query((rs, n) -> Map.entry(rs.getLong("ingredient_id"), rs.getString("code")))
            .list().forEach(e -> out.put(e.getKey(), e.getValue()));
        return out;
    }

    @Transactional
    public StocktakeDetail create(CreateInput in) {
        String scope = Vi.trim(in.scope());
        String note = Vi.trim(in.note());
        var v = new ValidationException.Collector();
        if (!Set.of("all", "group", "pick").contains(scope)) v.add("scope", "Vui lòng chọn phạm vi kiểm kê");
        List<String> groups = in.groups() == null ? List.of() : in.groups().stream().filter(IngredientService.GROUPS::contains).distinct().toList();
        if ("group".equals(scope) && groups.isEmpty()) v.add("groups", "Vui lòng chọn ít nhất một nhóm nguyên liệu");
        List<Long> picked = in.ingredientIds() == null ? List.of() : in.ingredientIds().stream().map(Ids::parseOrNull)
            .filter(java.util.Objects::nonNull).distinct().toList();
        if ("pick".equals(scope) && picked.isEmpty()) v.add("ingredientIds", "Vui lòng chọn ít nhất một nguyên liệu");
        if (note.length() > 500) v.add("note", "Ghi chú tối đa 500 ký tự");
        v.throwIfAny();

        // Nguyên liệu đang sử dụng + nguyên liệu ngừng sử dụng còn tồn.
        List<long[]> candidates = new ArrayList<>();
        jdbc.sql("SELECT id, group_key FROM ingredients WHERE is_active = 1 OR stock_qty > 0 ORDER BY group_key, name")
            .query((rs, n) -> new Object[] {rs.getLong("id"), rs.getString("group_key")})
            .list().forEach(r -> {
                long id = (Long) r[0];
                boolean in1 = switch (scope) {
                    case "group" -> groups.contains((String) r[1]);
                    case "pick" -> picked.contains(id);
                    default -> true;
                };
                if (in1) candidates.add(new long[] {id});
            });
        if (candidates.isEmpty()) throw new ValidationException("scope", "Phạm vi kiểm kê không có nguyên liệu nào");
        Map<Long, String> locked = lockedIngredients(null);
        List<Long> ids = candidates.stream().map(c -> c[0]).filter(id -> !locked.containsKey(id)).toList();
        long skipped = candidates.size() - ids.size();
        String lockedCode = candidates.stream().map(c -> locked.get(c[0])).filter(java.util.Objects::nonNull).findFirst().orElse(null);
        if (ids.isEmpty()) {
            throw new BusinessException(skipped + " nguyên liệu đang nằm trong phiếu " + lockedCode + " nên không được đưa vào phiếu này");
        }
        String code = codes.document("KK", Times.today());
        jdbc.sql("INSERT INTO stocktakes (code, scope, scope_groups, note, created_by) VALUES (?, ?, ?, ?, ?)")
            .params(code, scope, "group".equals(scope) ? String.join(",", groups) : null, note.isEmpty() ? null : note, userId()).update();
        long id = jdbc.sql("SELECT LAST_INSERT_ID()").query(Long.class).single();
        for (Long ing : ids) {
            jdbc.sql("INSERT INTO stocktake_items (stocktake_id, ingredient_id) VALUES (?, ?)").params(id, ing).update();
        }
        event(id, "create", null);
        audit.log("warehouse", "Lập phiếu kiểm kê", "Lập " + code + ", " + ids.size() + " nguyên liệu", "stocktakes", id);
        String message = skipped > 0 ? skipped + " nguyên liệu đang nằm trong phiếu " + lockedCode + " nên không được đưa vào phiếu này" : null;
        return detail(id, message);
    }

    private Head editable(long id) {
        jdbc.sql("SELECT id FROM stocktakes WHERE id = ? FOR UPDATE").param(id).query(Long.class).optional();
        Head h = head(id);
        if (!Set.of("draft", "rejected").contains(h.status())) {
            throw new BusinessException("Phiếu kiểm kê đang chờ duyệt hoặc đã xử lý, không sửa được");
        }
        return h;
    }

    /** Tự lưu một dòng khi đếm: đổi SL thực tế thì chốt lại tồn sổ sách + thời điểm đếm theo lần nhập này. */
    @Transactional
    public Line saveLine(String idText, String lineIdText, LineInput in) {
        long id = Ids.parse(idText, NOT_FOUND);
        long lineId = Ids.parse(lineIdText, "Không tìm thấy dòng kiểm kê");
        editable(id);
        Item cur = items("WHERE si.stocktake_id = ? AND si.id = ?", id, lineId).stream().findFirst()
            .orElseThrow(() -> BusinessException.notFound("Không tìm thấy dòng kiểm kê"));
        var v = new ValidationException.Collector();
        BigDecimal actual = in.actualQty();
        if (actual != null && !WarehouseFormat.validQty(actual)) v.add("actualQty", "Số lượng không hợp lệ");
        String reason = Vi.blank(in.reason()) ? null : in.reason().trim();
        if (reason != null && !REASONS.contains(reason)) v.add("reason", "Lý do không hợp lệ");
        String note = Vi.trim(in.note());
        if (note.length() > 200) v.add("note", "Ghi chú tối đa 200 ký tự");
        BigDecimal est = in.estUnitCost();
        if (est != null && !WarehouseFormat.validMoney(est)) v.add("estUnitCost", "Vui lòng nhập đơn giá ước tính lớn hơn 0");
        v.throwIfAny();
        boolean qtyChanged = actual == null ? cur.actualQty() != null
            : cur.actualQty() == null || actual.compareTo(cur.actualQty()) != 0;
        if (qtyChanged) {
            BigDecimal book = actual == null ? null : ledger.qtyAndCost(cur.ingredientId())[0];
            jdbc.sql("UPDATE stocktake_items SET actual_qty = ?, book_qty = ?, counted_at = ? WHERE id = ?")
                .params(actual, book, actual == null ? null : Times.now(), lineId).update();
        }
        jdbc.sql("UPDATE stocktake_items SET reason = ?, note = ?, est_unit_cost = ? WHERE id = ?")
            .params(reason, note.isEmpty() ? null : note, est, lineId).update();
        Item i = items("WHERE si.id = ?", lineId).get(0);
        return new Line(Ids.str(i.id()), Ids.str(i.ingredientId()), i.code(), i.name(), i.group(), i.unit(), i.active(),
            i.onHand().doubleValue(), d(i.avgCost()), d(i.bookQty()), d(i.actualQty()),
            i.countedAt() == null ? null : Times.iso(i.countedAt()), d(i.diff()), i.reason(), i.note(), d(i.estUnitCost()),
            d(i.suggested()), d(i.value()));
    }

    /** "Khớp sổ sách" cho mọi dòng chưa đếm: SL thực tế = tồn hiện tại. */
    @Transactional
    public StocktakeDetail matchAll(String idText) {
        long id = Ids.parse(idText, NOT_FOUND);
        editable(id);
        for (Item i : items("WHERE si.stocktake_id = ? AND si.actual_qty IS NULL", id)) {
            BigDecimal book = ledger.qtyAndCost(i.ingredientId())[0];
            jdbc.sql("UPDATE stocktake_items SET actual_qty = ?, book_qty = ?, counted_at = ? WHERE id = ?")
                .params(book, book, Times.now(), i.id()).update();
        }
        return detail(id, null);
    }

    /** Phạm vi "Chọn từng nguyên liệu": thêm dòng trước khi gửi duyệt. */
    @Transactional
    public StocktakeDetail addLine(String idText, AddLineInput in) {
        long id = Ids.parse(idText, NOT_FOUND);
        Head h = editable(id);
        if (!"pick".equals(h.scope())) throw new BusinessException("Chỉ thêm / bỏ dòng với phạm vi Chọn từng nguyên liệu");
        Long ing = Ids.parseOrNull(in.ingredientId());
        if (ing == null) throw new ValidationException("ingredientId", "Vui lòng chọn nguyên liệu");
        String lockedIn = lockedIngredients(id).get(ing);
        if (lockedIn != null) throw new ValidationException("ingredientId", "Nguyên liệu đang nằm trong phiếu " + lockedIn);
        boolean exists = jdbc.sql("SELECT COUNT(*) FROM stocktake_items WHERE stocktake_id = ? AND ingredient_id = ?")
            .params(id, ing).query(Integer.class).single() > 0;
        if (exists) throw new ValidationException("ingredientId", "Nguyên liệu đã có trong phiếu");
        jdbc.sql("INSERT INTO stocktake_items (stocktake_id, ingredient_id) VALUES (?, ?)").params(id, ing).update();
        return detail(id, null);
    }

    @Transactional
    public StocktakeDetail removeLine(String idText, String lineIdText) {
        long id = Ids.parse(idText, NOT_FOUND);
        Head h = editable(id);
        if (!"pick".equals(h.scope())) throw new BusinessException("Chỉ thêm / bỏ dòng với phạm vi Chọn từng nguyên liệu");
        int count = jdbc.sql("SELECT COUNT(*) FROM stocktake_items WHERE stocktake_id = ?").param(id).query(Integer.class).single();
        if (count <= 1) throw new BusinessException("Phiếu kiểm kê cần ít nhất một nguyên liệu");
        jdbc.sql("DELETE FROM stocktake_items WHERE id = ? AND stocktake_id = ?").params(Ids.parse(lineIdText, "Không tìm thấy dòng"), id).update();
        return detail(id, null);
    }

    @Transactional
    public StocktakeDetail submit(String idText) {
        long id = Ids.parse(idText, NOT_FOUND);
        Head h = editable(id);
        List<Item> its = items("WHERE si.stocktake_id = ?", id);
        var v = new ValidationException.Collector();
        long missing = its.stream().filter(i -> i.actualQty() == null).count();
        if (missing > 0) throw new BusinessException("Còn " + missing + " nguyên liệu chưa nhập số lượng thực tế");
        for (Item i : its) {
            BigDecimal diff = i.diff();
            if (diff.signum() == 0) continue;
            String key = "lines." + i.id() + ".";
            if (i.reason() == null) v.add(key + "reason", "Vui lòng chọn lý do chênh lệch");
            else if ("other".equals(i.reason()) && i.note().isEmpty()) v.add(key + "note", "Vui lòng nhập ghi chú cho lý do Khác");
            if (diff.signum() > 0 && i.avgCost() == null && i.estUnitCost() == null) {
                v.add(key + "estUnitCost", "Vui lòng nhập đơn giá ước tính lớn hơn 0");
            }
        }
        v.throwIfAny("Còn dòng chênh lệch chưa đủ thông tin");
        Sums s = sums(its);
        if (s.diffs() == 0) {
            jdbc.sql("UPDATE stocktakes SET status = 'matched', submitted_at = ? WHERE id = ?").params(Times.now(), id).update();
            event(id, "matched", null);
            audit.log("warehouse", "Kiểm kê khớp sổ sách", h.code() + " khớp sổ sách, đã hoàn tất", "stocktakes", id);
            return detail(id, "Phiếu kiểm kê " + h.code() + " khớp sổ sách, đã hoàn tất");
        }
        jdbc.sql("UPDATE stocktakes SET status = 'pending', submitted_at = ?, reject_reason = NULL WHERE id = ?").params(Times.now(), id).update();
        event(id, "submit", null);
        notifications.sendToRoles("stocktake", "Phiếu kiểm kê " + h.code() + " chờ duyệt",
            s.diffs() + " dòng chênh lệch: tăng " + WarehouseFormat.money(s.inc()) + ", giảm " + WarehouseFormat.money(s.dec())
                + " (tạm tính).", "stocktakes", id, List.of("manager"));
        audit.log("warehouse", "Gửi duyệt phiếu kiểm kê", "Gửi duyệt " + h.code() + ", " + s.diffs() + " dòng chênh lệch", "stocktakes", id);
        return detail(id, null);
    }

    @Transactional
    public void deleteDraft(String idText) {
        long id = Ids.parse(idText, NOT_FOUND);
        Head h = head(id);
        if (!"draft".equals(h.status())) throw new BusinessException("Chỉ xóa được phiếu kiểm kê nháp");
        jdbc.sql("DELETE FROM stocktakes WHERE id = ?").param(id).update();
        audit.log("warehouse", "Xóa phiếu kiểm kê nháp", "Xóa " + h.code(), "stocktakes", id);
    }

    private static String reason5(String reason, String label) {
        String r = Vi.trim(reason);
        if (r.length() < 5) throw new ValidationException("reason", "Vui lòng nhập lý do " + label + " (ít nhất 5 ký tự)");
        if (r.length() > 300) throw new ValidationException("reason", "Lý do tối đa 300 ký tự");
        return r;
    }

    @Transactional
    public StocktakeDetail cancel(String idText, ReasonInput in) {
        long id = Ids.parse(idText, NOT_FOUND);
        String reason = reason5(in.reason(), "hủy");
        Head h = head(id);
        if (!"rejected".equals(h.status())) throw new BusinessException("Chỉ hủy được phiếu kiểm kê bị từ chối");
        jdbc.sql("UPDATE stocktakes SET status = 'cancelled', cancel_reason = ? WHERE id = ?").params(reason, id).update();
        event(id, "cancel", reason);
        audit.log("warehouse", "Hủy phiếu kiểm kê", "Hủy " + h.code() + ": " + reason, "stocktakes", id);
        return detail(id, null);
    }

    /* ------------------------------------------------------------------ UC-KHO-24: duyệt / từ chối (Quản lý nhà hàng) */

    private Head pending(long id) {
        jdbc.sql("SELECT id FROM stocktakes WHERE id = ? FOR UPDATE").param(id).query(Long.class).optional();
        Head h = head(id);
        if (!"pending".equals(h.status())) throw new BusinessException("Phiếu kiểm kê đã được xử lý");
        return h;
    }

    @Transactional
    public StocktakeDetail approve(String idText) {
        long id = Ids.parse(idText, NOT_FOUND);
        Head h = pending(id);
        List<Item> its = items("WHERE si.stocktake_id = ?", id).stream().filter(i -> i.diff() != null && i.diff().signum() != 0).toList();
        // Kiểm tra trước toàn bộ: điều chỉnh không được làm tồn âm (tất cả hoặc không gì).
        for (Item i : its) {
            BigDecimal now = ledger.qtyAndCost(i.ingredientId())[0];
            if (now.add(i.diff()).signum() < 0) {
                throw new BusinessException("Không thể duyệt: tồn hiện tại của " + i.name() + " là " + WarehouseFormat.qty(now) + " "
                    + i.unit() + ", điều chỉnh " + WarehouseFormat.qty(i.diff()) + " sẽ làm tồn âm. Hãy từ chối để kho kiểm kê lại.");
            }
        }
        for (Item i : its) {
            BigDecimal cost = ledger.qtyAndCost(i.ingredientId())[1];
            if (cost == null && i.diff().signum() > 0) {
                cost = i.estUnitCost();
                ledger.restoreAvgCost(i.ingredientId(), cost);
            }
            BigDecimal value = cost == null ? BigDecimal.ZERO : PurchaseMath.money(i.diff().multiply(cost));
            ledger.record(i.ingredientId(), "stocktake", i.diff(), null, h.code(), "Điều chỉnh kiểm kê " + h.code(), null, null, null, id);
            jdbc.sql("UPDATE stocktake_items SET adjust_unit_cost = ?, adjust_value = ? WHERE id = ?").params(cost, value, i.id()).update();
        }
        jdbc.sql("UPDATE stocktakes SET status = 'approved', approved_by = ?, approved_at = ? WHERE id = ?")
            .params(userId(), Times.now(), id).update();
        event(id, "approve", null);
        notifications.sendToUser("stocktake", "Phiếu kiểm kê " + h.code() + " đã được duyệt",
            "Tồn kho đã được điều chỉnh theo " + its.size() + " dòng chênh lệch.", "stocktakes", id, h.createdById());
        audit.log("warehouse", "Duyệt phiếu kiểm kê", "Duyệt " + h.code() + ", " + its.size() + " dòng chênh lệch", "stocktakes", id);
        return detail(id, null);
    }

    @Transactional
    public StocktakeDetail reject(String idText, ReasonInput in) {
        long id = Ids.parse(idText, NOT_FOUND);
        String reason = reason5(in.reason(), "từ chối");
        Head h = pending(id);
        jdbc.sql("UPDATE stocktakes SET status = 'rejected', reject_reason = ? WHERE id = ?").params(reason, id).update();
        event(id, "reject", reason);
        notifications.sendToUser("stocktake", "Phiếu kiểm kê " + h.code() + " bị từ chối: " + reason, "Kiểm tra lại, sửa và gửi duyệt lại.",
            "stocktakes", id, h.createdById());
        audit.log("warehouse", "Từ chối phiếu kiểm kê", "Từ chối " + h.code() + ": " + reason, "stocktakes", id);
        return detail(id, null);
    }
}
