package com.rms.ordering;

import com.rms.audit.AuditService;
import com.rms.common.BusinessException;
import com.rms.common.CurrentUserService;
import com.rms.common.Db;
import com.rms.common.Ids;
import com.rms.common.Times;
import com.rms.common.ValidationException;
import com.rms.common.Vi;
import com.rms.ordering.OrderCore.OrderView;
import com.rms.ordering.ServiceRequestService.Request;
import com.rms.table.TableService;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Khu Thu ngân: sơ đồ bàn (UC-TN-01), tra cứu đơn (UC-TN-02), chi tiết đơn và đánh dấu món đã mang ra (UC-TN-03),
 * hủy món / hủy đơn (UC-TN-04), chuyển bàn (UC-TN-05). Yêu cầu của khách: ServiceRequestService; hóa đơn: InvoiceService.
 */
@Service
public class CashierService {

    public record OrderBrief(String id, String code, String openedAt, long subtotal, int pendingCount, int readyCount,
                             boolean locked) {}

    public record ReservationBrief(String time, String customerName, int guests) {}

    public record FloorTable(String id, String code, String areaId, int seats, String shape, int x, int y, String status,
                             OrderBrief order, ReservationBrief reservation, boolean supportRequest, boolean paymentRequest) {}

    public record FloorArea(String id, String name) {}

    public record ReadyItem(String id, String orderId, String tableId, String tableCode, String dishName, int qty, String note,
                            String completedAt) {}

    public record Floor(int cols, int rows, List<FloorArea> areas, List<FloorTable> tables, List<ReadyItem> ready,
                        int occupiedCount, int tableCount, long revenueToday, int requestCount, int unpaidCount) {}

    public record IdsInput(List<String> ids) {}

    /** Chi tiết đơn cho Thu ngân: đơn + yêu cầu đang chờ của bàn + hóa đơn còn hiệu lực (nếu có). */
    public record OrderDetail(OrderView order, String closedAt, List<Request> requests, InvoiceBrief invoice) {}

    public record InvoiceBrief(String id, String code, String status, long total) {}

    public record CancelInput(String reason, String note) {}

    public record MoveInput(String tableId) {}

    public record MoveTarget(String id, String code, String areaId, String areaName, int seats, String status,
                             ReservationBrief reservation) {}

    public record OrderRow(String id, String code, String tableCode, String areaName, String openedAt, String closedAt,
                           int itemCount, long total, String status, String invoiceId, String invoiceCode) {}

    public record OrderList(List<OrderRow> items, int count, long completedTotal) {}

    static final Map<String, String> CANCEL_REASONS = Map.of("changed_mind", "Khách đổi ý", "wrong_order", "Gọi nhầm",
        "left", "Khách bỏ về", "other", "Khác");

    private final JdbcClient jdbc;
    private final OrderCore core;
    private final LiveEvents live;
    private final AuditService audit;
    private final CurrentUserService currentUser;
    private final ServiceRequestService requests;
    private final InvoiceService invoices;

    public CashierService(JdbcClient jdbc, OrderCore core, LiveEvents live, AuditService audit, CurrentUserService currentUser,
                          ServiceRequestService requests, InvoiceService invoices) {
        this.jdbc = jdbc;
        this.core = core;
        this.live = live;
        this.audit = audit;
        this.currentUser = currentUser;
        this.requests = requests;
        this.invoices = invoices;
    }

    private static String iso(LocalDateTime t) {
        return t == null ? null : Times.iso(t);
    }

    /** Lịch đặt sắp tới trong hôm nay của từng bàn (chưa đến / đã xác nhận). */
    private Map<Long, ReservationBrief> reservationsToday() {
        Map<Long, ReservationBrief> out = new HashMap<>();
        LocalDateTime now = Times.now();
        jdbc.sql("""
                SELECT table_id, reserved_at, customer_name, guests FROM reservations
                WHERE table_id IS NOT NULL AND status IN ('pending','confirmed') AND reserved_at >= ? AND reserved_at < ?
                ORDER BY reserved_at
                """).params(now.minusHours(1), Times.today().plusDays(1).atStartOfDay())
            .query((rs, n) -> out.putIfAbsent(rs.getLong("table_id"), new ReservationBrief(iso(Db.dateTime(rs, "reserved_at")),
                rs.getString("customer_name"), rs.getInt("guests"))))
            .list();
        return out;
    }

    /* ------------------------------------------------------------------ UC-TN-01: sơ đồ bàn */

    public Floor floor() {
        Map<Long, Set<String>> waiting = requests.waitingByTable();
        List<FloorArea> areas = jdbc.sql("SELECT id, name FROM areas WHERE is_active = 1 ORDER BY sort_order, id")
            .query((rs, n) -> new FloorArea(Ids.str(rs.getLong("id")), rs.getString("name"))).list();

        // Tóm tắt đơn đang mở theo bàn.
        Map<Long, OrderBrief> orders = new HashMap<>();
        jdbc.sql("""
                SELECT o.id, o.code, o.table_id, o.created_at,
                       COALESCE(SUM(CASE WHEN oi.status <> 'cancelled' THEN oi.unit_price * oi.quantity END), 0) AS subtotal,
                       COALESCE(SUM(oi.status IN ('pending','cooking')), 0) AS pending_count,
                       COALESCE(SUM(oi.status = 'done'), 0) AS ready_count,
                       EXISTS (SELECT 1 FROM invoices i WHERE i.order_id = o.id AND i.status = 'unpaid') AS locked
                FROM orders o LEFT JOIN order_items oi ON oi.order_id = o.id
                WHERE o.status = 'open'
                GROUP BY o.id, o.code, o.table_id, o.created_at
                """)
            .query((rs, n) -> Map.entry(rs.getLong("table_id"), new OrderBrief(Ids.str(rs.getLong("id")), rs.getString("code"),
                iso(Db.dateTime(rs, "created_at")), rs.getBigDecimal("subtotal").longValue(), rs.getInt("pending_count"),
                rs.getInt("ready_count"), rs.getBoolean("locked"))))
            .list().forEach(e -> orders.put(e.getKey(), e.getValue()));

        Map<Long, ReservationBrief> reservations = reservationsToday();

        List<FloorTable> tables = jdbc.sql("""
                SELECT t.id, t.code, t.area_id, t.seats, t.shape, t.pos_x, t.pos_y, t.status
                FROM dining_tables t JOIN areas a ON a.id = t.area_id WHERE a.is_active = 1 ORDER BY t.code
                """)
            .query((rs, n) -> {
                long id = rs.getLong("id");
                Set<String> w = waiting.getOrDefault(id, Set.of());
                return new FloorTable(Ids.str(id), rs.getString("code"), Ids.str(rs.getLong("area_id")), rs.getInt("seats"),
                    rs.getString("shape"), rs.getInt("pos_x"), rs.getInt("pos_y"), rs.getString("status"), orders.get(id),
                    reservations.get(id), w.contains("support"), w.contains("payment"));
            })
            .list();

        List<ReadyItem> ready = jdbc.sql("""
                SELECT oi.id, oi.order_id, t.id AS table_id, t.code, oi.dish_name, oi.quantity, oi.note, oi.completed_at
                FROM order_items oi JOIN orders o ON o.id = oi.order_id JOIN dining_tables t ON t.id = o.table_id
                WHERE oi.status = 'done' AND o.status = 'open' ORDER BY oi.completed_at, oi.id
                """)
            .query((rs, n) -> new ReadyItem(Ids.str(rs.getLong("id")), Ids.str(rs.getLong("order_id")), Ids.str(rs.getLong("table_id")),
                rs.getString("code"), rs.getString("dish_name"), rs.getInt("quantity"), rs.getString("note"),
                iso(Db.dateTime(rs, "completed_at"))))
            .list();

        long revenue = jdbc.sql("SELECT COALESCE(SUM(total_amount), 0) FROM invoices WHERE status = 'paid' AND paid_at >= ?")
            .param(Times.today().atStartOfDay()).query(java.math.BigDecimal.class).single().longValue();
        int occupied = (int) tables.stream().filter(t -> t.order() != null).count();
        int active = (int) tables.stream().filter(t -> !"inactive".equals(t.status())).count();
        int unpaid = jdbc.sql("SELECT COUNT(*) FROM invoices WHERE status = 'unpaid'").query(Integer.class).single();
        return new Floor(TableService.FLOOR_COLS, TableService.FLOOR_ROWS, areas, tables, ready, occupied, active, revenue,
            requests.waitingCount(), unpaid);
    }

    /* ------------------------------------------------------------------ UC-TN-03: chi tiết đơn */

    public OrderDetail order(String idText) {
        return detail(Ids.parse(idText, "Không tìm thấy đơn hàng"));
    }

    OrderDetail detail(long orderId) {
        OrderView o = core.order(orderId);
        LocalDateTime closed = jdbc.sql("SELECT closed_at FROM orders WHERE id = ?").param(orderId)
            .query((rs, n) -> Optional.ofNullable(Db.dateTime(rs, "closed_at"))).single().orElse(null);
        List<Request> reqs = new ArrayList<>();
        if ("open".equals(o.status())) {
            long tableId = Long.parseLong(o.tableId());
            requests.waitingPayment(tableId).ifPresent(reqs::add);
            requests.waitingSupport(tableId).ifPresent(reqs::add);
        }
        InvoiceBrief inv = invoices.activeOf(orderId)
            .map(id -> jdbc.sql("SELECT code, status, total_amount FROM invoices WHERE id = ?").param(id)
                .query((rs, n) -> new InvoiceBrief(Ids.str(id), rs.getString(1), rs.getString(2), rs.getBigDecimal(3).longValue()))
                .single())
            .orElse(null);
        return new OrderDetail(o, iso(closed), reqs, inv);
    }

    /** UC-TN-03: món Đã xong → Đã mang ra (theo báo của nhân viên phục vụ). */
    @Transactional
    public OrderDetail serve(IdsInput in) {
        if (in.ids() == null || in.ids().isEmpty()) throw new ValidationException("ids", "Chưa chọn món");
        Set<Long> tables = new HashSet<>();
        Long orderId = null;
        int changed = 0;
        for (String text : new HashSet<>(in.ids())) {
            long id = Ids.parse(text, "Không tìm thấy món");
            var row = jdbc.sql("SELECT oi.status, oi.order_id, o.table_id FROM order_items oi JOIN orders o ON o.id = oi.order_id WHERE oi.id = ? FOR UPDATE")
                .param(id).query((rs, n) -> new Object[] {rs.getString(1), rs.getLong(2), rs.getLong(3)}).optional()
                .orElseThrow(() -> BusinessException.notFound("Không tìm thấy món"));
            orderId = (Long) row[1];
            tables.add((Long) row[2]);
            if (!"done".equals(row[0])) continue;
            jdbc.sql("UPDATE order_items SET status = 'served', served_at = ?, served_by = ? WHERE id = ?")
                .params(Times.now(), currentUser.get().id(), id).update();
            changed++;
        }
        if (changed == 0) throw new BusinessException("Món không ở trạng thái Đã xong");
        String[] ch = new String[tables.size() + 2];
        ch[0] = LiveEvents.CASHIER;
        ch[1] = LiveEvents.KITCHEN;
        int i = 2;
        for (Long t : tables) ch[i++] = LiveEvents.table(t);
        live.publish(ch);
        return detail(orderId);
    }

    /* ------------------------------------------------------------------ UC-TN-04: hủy món, hủy đơn */

    private static String reason(CancelInput in) {
        String key = in.reason() == null ? "" : in.reason();
        String note = Vi.collapse(in.note());
        var v = new ValidationException.Collector();
        if (!CANCEL_REASONS.containsKey(key)) v.add("reason", "Vui lòng chọn lý do");
        if ("other".equals(key) && note.isEmpty()) v.add("note", "Vui lòng nhập lý do");
        if (note.length() > 200) v.add("note", "Lý do tối đa 200 ký tự");
        v.throwIfAny();
        return "other".equals(key) ? note : CANCEL_REASONS.get(key) + (note.isEmpty() ? "" : ": " + note);
    }

    private record OrderHead(long id, String code, long tableId) {}

    private OrderHead head(long orderId) {
        return jdbc.sql("SELECT id, code, table_id FROM orders WHERE id = ?").param(orderId)
            .query((rs, n) -> new OrderHead(rs.getLong(1), rs.getString(2), rs.getLong(3))).optional()
            .orElseThrow(() -> BusinessException.notFound("Không tìm thấy đơn hàng"));
    }

    /** Khóa bàn + đơn; đơn phải đang mở và chưa lập hóa đơn. */
    private OrderHead lockEditable(long orderId) {
        OrderHead h = head(orderId);
        core.lockTable(h.tableId());
        String status = jdbc.sql("SELECT status FROM orders WHERE id = ? FOR UPDATE").param(orderId).query(String.class).single();
        if (!"open".equals(status)) throw new BusinessException("Đơn đã đóng");
        if (core.isLocked(orderId)) throw new BusinessException("Đơn đang chờ thanh toán. Hủy hóa đơn trước nếu cần sửa đơn.");
        return h;
    }

    @Transactional
    public OrderDetail cancelItem(String itemIdText, CancelInput in) {
        String reason = reason(in);
        long itemId = Ids.parse(itemIdText, "Không tìm thấy món");
        long orderId = jdbc.sql("SELECT order_id FROM order_items WHERE id = ?").param(itemId).query(Long.class).optional()
            .orElseThrow(() -> BusinessException.notFound("Không tìm thấy món"));
        OrderHead h = lockEditable(orderId);
        String[] row = jdbc.sql("SELECT status, dish_name FROM order_items WHERE id = ? FOR UPDATE").param(itemId)
            .query((rs, n) -> new String[] {rs.getString(1), rs.getString(2)}).single();
        if ("cancelled".equals(row[0])) throw new BusinessException("Món đã bị hủy");
        if (!"pending".equals(row[0])) throw new BusinessException("Món đã bắt đầu chế biến, không thể hủy");
        jdbc.sql("UPDATE order_items SET status = 'cancelled', cancel_source = 'cashier', cancel_reason = ?, cancelled_by = ?, cancelled_at = ? WHERE id = ?")
            .params(reason, currentUser.get().id(), Times.now(), itemId).update();
        audit.log("cashier", "Hủy món", "Hủy " + row[1] + " – đơn " + h.code() + ": " + reason, "order_items", itemId);
        live.publish(LiveEvents.KITCHEN, LiveEvents.CASHIER, LiveEvents.table(h.tableId()));
        return detail(orderId);
    }

    @Transactional
    public OrderDetail cancelOrder(String orderIdText, CancelInput in) {
        String reason = reason(in);
        long orderId = Ids.parse(orderIdText, "Không tìm thấy đơn hàng");
        OrderHead h = lockEditable(orderId);
        int started = jdbc.sql("SELECT COUNT(*) FROM order_items WHERE order_id = ? AND status IN ('cooking','done','served')")
            .param(orderId).query(Integer.class).single();
        if (started > 0) throw new BusinessException("Đơn có món đã chế biến, không thể hủy. Hãy lập hóa đơn cho các món đã làm.");
        LocalDateTime now = Times.now();
        long user = currentUser.get().id();
        jdbc.sql("UPDATE order_items SET status = 'cancelled', cancel_source = 'cashier', cancel_reason = ?, cancelled_by = ?, cancelled_at = ? WHERE order_id = ? AND status = 'pending'")
            .params(reason, user, now, orderId).update();
        String note = "Hủy: " + reason;
        jdbc.sql("UPDATE orders SET status = 'cancelled', closed_at = ?, note = ? WHERE id = ?")
            .params(now, note.length() > 300 ? note.substring(0, 300) : note, orderId).update();
        jdbc.sql("UPDATE dining_tables SET status = 'available' WHERE id = ? AND status = 'occupied'").param(h.tableId()).update();
        requests.cancelAllOfTable(h.tableId());
        audit.log("cashier", "Hủy đơn", "Hủy đơn " + h.code() + ": " + reason, "orders", orderId);
        live.publish(LiveEvents.KITCHEN, LiveEvents.CASHIER, LiveEvents.table(h.tableId()));
        return detail(orderId);
    }

    /* ------------------------------------------------------------------ UC-TN-05: chuyển bàn */

    /** Bàn đích chọn được: khu vực đang hoạt động, bàn Trống / Đặt trước, không có đơn đang mở. */
    public List<MoveTarget> moveTargets() {
        Map<Long, ReservationBrief> res = reservationsToday();
        return jdbc.sql("""
                SELECT t.id, t.code, a.id AS area_id, a.name AS area_name, t.seats, t.status
                FROM dining_tables t JOIN areas a ON a.id = t.area_id
                WHERE a.is_active = 1 AND t.status IN ('available','reserved')
                  AND NOT EXISTS (SELECT 1 FROM orders o WHERE o.table_id = t.id AND o.status = 'open')
                ORDER BY a.sort_order, a.id, t.code
                """)
            .query((rs, n) -> new MoveTarget(Ids.str(rs.getLong("id")), rs.getString("code"), Ids.str(rs.getLong("area_id")),
                rs.getString("area_name"), rs.getInt("seats"), rs.getString("status"), res.get(rs.getLong("id"))))
            .list();
    }

    @Transactional
    public OrderDetail move(String orderIdText, MoveInput in) {
        long orderId = Ids.parse(orderIdText, "Không tìm thấy đơn hàng");
        Long target = Ids.parseOrNull(in.tableId());
        if (target == null) throw new ValidationException("tableId", "Vui lòng chọn bàn đích");
        OrderHead h = head(orderId);
        if (target == h.tableId()) throw new ValidationException("tableId", "Bàn đích trùng bàn hiện tại");
        // Khóa hai bàn theo thứ tự id để tránh khóa chéo.
        core.lockTable(Math.min(target, h.tableId()));
        core.lockTable(Math.max(target, h.tableId()));
        String status = jdbc.sql("SELECT status FROM orders WHERE id = ? FOR UPDATE").param(orderId).query(String.class).single();
        if (!"open".equals(status)) throw new BusinessException("Đơn đã đóng");
        var from = core.table(h.tableId());
        var to = core.table(target);
        boolean activeArea = jdbc.sql("SELECT a.is_active FROM dining_tables t JOIN areas a ON a.id = t.area_id WHERE t.id = ?")
            .param(target).query(Boolean.class).single();
        if (!activeArea || !Set.of("available", "reserved").contains(to.status()) || core.openOrderId(target).isPresent()) {
            throw new BusinessException("Bàn " + to.code() + " vừa có khách, vui lòng chọn bàn khác");
        }
        jdbc.sql("UPDATE orders SET table_id = ? WHERE id = ?").params(target, orderId).update();
        jdbc.sql("UPDATE dining_tables SET status = 'occupied' WHERE id = ?").param(target).update();
        jdbc.sql("UPDATE dining_tables SET status = 'available' WHERE id = ? AND status = 'occupied'").param(h.tableId()).update();
        requests.moveWaiting(h.tableId(), target);
        audit.log("cashier", "Chuyển bàn", "Đơn " + h.code() + ": bàn " + from.code() + " → " + to.code(), "orders", orderId);
        live.publish(LiveEvents.KITCHEN, LiveEvents.CASHIER, LiveEvents.table(h.tableId()), LiveEvents.table(target));
        return detail(orderId);
    }

    /* ------------------------------------------------------------------ UC-TN-02: tra cứu đơn */

    /** status: "" (tất cả) | open (đang mở, chưa lập hóa đơn) | awaiting_payment | completed | cancelled. */
    public OrderList orders(String keyword, String status, String from, String to) {
        LocalDate[] range = InvoiceService.range(from, to);
        StringBuilder sql = new StringBuilder("""
            SELECT o.id, o.code, o.status, o.created_at, o.closed_at, t.code AS table_code, a.name AS area_name,
                   COALESCE(SUM(CASE WHEN oi.status <> 'cancelled' THEN oi.quantity END), 0) AS item_count,
                   COALESCE(SUM(CASE WHEN oi.status <> 'cancelled' THEN oi.unit_price * oi.quantity END), 0) AS total,
                   (SELECT i.id FROM invoices i WHERE i.order_id = o.id AND i.status IN ('unpaid','paid') ORDER BY i.id DESC LIMIT 1) AS invoice_id,
                   (SELECT i.code FROM invoices i WHERE i.order_id = o.id AND i.status IN ('unpaid','paid') ORDER BY i.id DESC LIMIT 1) AS invoice_code,
                   EXISTS (SELECT 1 FROM invoices i WHERE i.order_id = o.id AND i.status = 'unpaid') AS locked
            FROM orders o JOIN dining_tables t ON t.id = o.table_id JOIN areas a ON a.id = t.area_id
            LEFT JOIN order_items oi ON oi.order_id = o.id
            WHERE o.created_at >= ? AND o.created_at < ?
            """);
        List<Object> params = new ArrayList<>(List.of(range[0].atStartOfDay(), range[1].plusDays(1).atStartOfDay()));
        String st = status == null ? "" : status;
        String unpaid = "EXISTS (SELECT 1 FROM invoices i WHERE i.order_id = o.id AND i.status = 'unpaid')";
        switch (st) {
            case "open" -> sql.append(" AND o.status = 'open' AND NOT ").append(unpaid);
            case "awaiting_payment" -> sql.append(" AND o.status = 'open' AND ").append(unpaid);
            case "completed", "cancelled" -> {
                sql.append(" AND o.status = ?");
                params.add(st);
            }
            default -> { }
        }
        sql.append(" GROUP BY o.id, o.code, o.status, o.created_at, o.closed_at, t.code, a.name ORDER BY o.created_at DESC, o.id DESC");
        String kw = Vi.trim(keyword);
        List<OrderRow> rows = new ArrayList<>();
        jdbc.sql(sql.toString()).params(params).query((rs, n) -> {
            String invCode = rs.getString("invoice_code");
            String hay = String.join(" ", rs.getString("code"), rs.getString("table_code"), invCode == null ? "" : invCode);
            if (!kw.isEmpty() && !Vi.matches(hay, kw)) return 0;
            Long invId = rs.getObject("invoice_id") == null ? null : rs.getLong("invoice_id");
            String s = rs.getString("status");
            if ("open".equals(s) && rs.getBoolean("locked")) s = "awaiting_payment";
            rows.add(new OrderRow(Ids.str(rs.getLong("id")), rs.getString("code"), rs.getString("table_code"), rs.getString("area_name"),
                iso(Db.dateTime(rs, "created_at")), iso(Db.dateTime(rs, "closed_at")), rs.getInt("item_count"),
                rs.getBigDecimal("total").longValue(), s, Ids.str(invId), invCode));
            return 1;
        }).list();
        long completed = rows.stream().filter(r -> "completed".equals(r.status())).mapToLong(OrderRow::total).sum();
        return new OrderList(rows, rows.size(), completed);
    }
}
