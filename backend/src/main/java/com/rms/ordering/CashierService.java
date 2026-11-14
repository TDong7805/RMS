package com.rms.ordering;

import com.rms.audit.AuditService;
import com.rms.common.BusinessException;
import com.rms.common.CurrentUserService;
import com.rms.common.Db;
import com.rms.common.Ids;
import com.rms.common.Times;
import com.rms.common.ValidationException;
import com.rms.ordering.OrderCore.OrderView;
import com.rms.table.TableService;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Khu Thu ngân, đợt 1: sơ đồ bàn (UC-TN-01), chi tiết đơn và đánh dấu món đã mang ra (UC-TN-03).
 * Đợt 2 thêm: hủy món / đơn, chuyển bàn, yêu cầu của khách, hóa đơn, thanh toán.
 */
@Service
public class CashierService {

    public record OrderBrief(String id, String code, String openedAt, long subtotal, int pendingCount, int readyCount,
                             boolean locked) {}

    public record ReservationBrief(String time, String customerName, int guests) {}

    public record FloorTable(String id, String code, String areaId, int seats, String shape, int x, int y, String status,
                             OrderBrief order, ReservationBrief reservation) {}

    public record FloorArea(String id, String name) {}

    public record ReadyItem(String id, String orderId, String tableId, String tableCode, String dishName, int qty, String note,
                            String completedAt) {}

    public record Floor(int cols, int rows, List<FloorArea> areas, List<FloorTable> tables, List<ReadyItem> ready,
                        int occupiedCount, int tableCount, long revenueToday) {}

    public record IdsInput(List<String> ids) {}

    private final JdbcClient jdbc;
    private final OrderCore core;
    private final LiveEvents live;
    private final AuditService audit;
    private final CurrentUserService currentUser;

    public CashierService(JdbcClient jdbc, OrderCore core, LiveEvents live, AuditService audit, CurrentUserService currentUser) {
        this.jdbc = jdbc;
        this.core = core;
        this.live = live;
        this.audit = audit;
        this.currentUser = currentUser;
    }

    private static String iso(LocalDateTime t) {
        return t == null ? null : Times.iso(t);
    }

    public Floor floor() {
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

        // Lịch đặt sắp tới trong hôm nay của từng bàn (chưa đến / đã xác nhận).
        Map<Long, ReservationBrief> reservations = new HashMap<>();
        LocalDateTime now = Times.now();
        jdbc.sql("""
                SELECT table_id, reserved_at, customer_name, guests FROM reservations
                WHERE table_id IS NOT NULL AND status IN ('pending','confirmed') AND reserved_at >= ? AND reserved_at < ?
                ORDER BY reserved_at
                """).params(now.minusHours(1), Times.today().plusDays(1).atStartOfDay())
            .query((rs, n) -> Map.entry(rs.getLong("table_id"), new ReservationBrief(iso(Db.dateTime(rs, "reserved_at")),
                rs.getString("customer_name"), rs.getInt("guests"))))
            .list().forEach(e -> reservations.putIfAbsent(e.getKey(), e.getValue()));

        List<FloorTable> tables = jdbc.sql("""
                SELECT t.id, t.code, t.area_id, t.seats, t.shape, t.pos_x, t.pos_y, t.status
                FROM dining_tables t JOIN areas a ON a.id = t.area_id WHERE a.is_active = 1 ORDER BY t.code
                """)
            .query((rs, n) -> {
                long id = rs.getLong("id");
                return new FloorTable(Ids.str(id), rs.getString("code"), Ids.str(rs.getLong("area_id")), rs.getInt("seats"),
                    rs.getString("shape"), rs.getInt("pos_x"), rs.getInt("pos_y"), rs.getString("status"), orders.get(id),
                    reservations.get(id));
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
        return new Floor(TableService.FLOOR_COLS, TableService.FLOOR_ROWS, areas, tables, ready, occupied, active, revenue);
    }

    public OrderView order(String idText) {
        return core.order(Ids.parse(idText, "Không tìm thấy đơn hàng"));
    }

    /** UC-TN-03: món Đã xong → Đã mang ra (theo báo của nhân viên phục vụ). */
    @Transactional
    public OrderView serve(IdsInput in) {
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
        return core.order(orderId);
    }

    /** Dùng cho nhật ký các thao tác của đợt 2. */
    void log(String action, String detail, String table, Long id) {
        audit.log("cashier", action, detail, table, id);
    }
}
