package com.rms.ordering;

import com.rms.common.BusinessException;
import com.rms.common.Db;
import com.rms.common.Ids;
import com.rms.common.Times;
import com.rms.common.Vi;
import java.time.DayOfWeek;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;
import java.util.Optional;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;

/**
 * Phần dùng chung của Đặt món, Bếp, Thu ngân: đọc bàn, đơn đang mở, món trong đơn, giờ mở cửa.
 *
 * Trạng thái món: pending (Chờ chế biến) → cooking (Đang chế biến) → done (Đã xong) → served (Đã mang ra);
 * pending → cancelled (khách / thu ngân / bếp). Đơn: open → completed | cancelled. Một bàn tối đa một đơn đang mở.
 * Đơn "bị khóa" khi đang có hóa đơn chưa thanh toán (đợt 2): không gửi thêm món, không hủy món.
 */
@Component
public class OrderCore {

    public record TableRow(long id, String code, String areaName, long areaId, int seats, String status, String qrToken) {}

    public record Item(String id, String dishId, String name, long price, int qty, String note, String status, int batchNo,
                       String createdAt, String startedAt, String completedAt, String servedAt, String cancelSource,
                       String cancelReason, String cancelledBy) {}

    public record OrderView(String id, String code, String tableId, String tableCode, String areaName, String status,
                            boolean locked, String createdAt, long subtotal, int pendingCount, int readyCount,
                            List<Item> items) {}

    private final JdbcClient jdbc;

    public OrderCore(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    /* ------------------------------------------------------------------ Bàn */

    private static final String TABLE_SELECT = """
        SELECT t.id, t.code, a.name AS area_name, a.id AS area_id, t.seats, t.status, t.qr_token
        FROM dining_tables t JOIN areas a ON a.id = t.area_id
        """;

    private static TableRow mapTable(java.sql.ResultSet rs) throws java.sql.SQLException {
        return new TableRow(rs.getLong("id"), rs.getString("code"), rs.getString("area_name"), rs.getLong("area_id"),
            rs.getInt("seats"), rs.getString("status"), rs.getString("qr_token"));
    }

    public Optional<TableRow> tableByToken(String token) {
        if (Vi.blank(token) || token.length() > 64) return Optional.empty();
        return jdbc.sql(TABLE_SELECT + " WHERE t.qr_token = ?").param(token).query((rs, n) -> mapTable(rs)).optional();
    }

    public TableRow table(long id) {
        return jdbc.sql(TABLE_SELECT + " WHERE t.id = ?").param(id).query((rs, n) -> mapTable(rs)).optional()
            .orElseThrow(() -> BusinessException.notFound("Không tìm thấy bàn"));
    }

    /** Khóa dòng bàn trong giao dịch hiện tại (chống hai điện thoại cùng tạo đơn cho một bàn). */
    public void lockTable(long id) {
        jdbc.sql("SELECT id FROM dining_tables WHERE id = ? FOR UPDATE").param(id).query(Long.class).optional();
    }

    /* ------------------------------------------------------------------ Giờ mở cửa */

    /** Đang trong giờ phục vụ theo bảng opening_hours (0 = Chủ nhật … 6 = Thứ bảy). */
    public boolean isOpenNow() {
        LocalDateTime now = Times.now();
        int dow = now.getDayOfWeek() == DayOfWeek.SUNDAY ? 0 : now.getDayOfWeek().getValue();
        return jdbc.sql("SELECT is_open, open_time, close_time FROM opening_hours WHERE day_of_week = ?").param(dow)
            .query((rs, n) -> {
                if (!rs.getBoolean("is_open")) return false;
                LocalTime t = now.toLocalTime();
                return !t.isBefore(Db.time(rs, "open_time")) && t.isBefore(Db.time(rs, "close_time"));
            })
            .optional().orElse(true);
    }

    /* ------------------------------------------------------------------ Đơn và món */

    public Optional<Long> openOrderId(long tableId) {
        return jdbc.sql("SELECT id FROM orders WHERE table_id = ? AND status = 'open' ORDER BY id DESC LIMIT 1")
            .param(tableId).query(Long.class).optional();
    }

    /** Đơn đang có hóa đơn chưa thanh toán → khóa gọi thêm / hủy món. */
    public boolean isLocked(long orderId) {
        return jdbc.sql("SELECT COUNT(*) FROM invoices WHERE order_id = ? AND status = 'unpaid'").param(orderId)
            .query(Integer.class).single() > 0;
    }

    public List<Item> items(long orderId) {
        return jdbc.sql("""
                SELECT oi.*, cu.full_name AS cancelled_name
                FROM order_items oi LEFT JOIN users cu ON cu.id = oi.cancelled_by
                WHERE oi.order_id = ? ORDER BY oi.batch_no DESC, oi.id
                """).param(orderId)
            .query((rs, n) -> new Item(Ids.str(rs.getLong("id")), Ids.str(rs.getLong("dish_id")), rs.getString("dish_name"),
                rs.getBigDecimal("unit_price").longValue(), rs.getInt("quantity"), Vi.trim(rs.getString("note")),
                rs.getString("status"), rs.getInt("batch_no"), iso(Db.dateTime(rs, "created_at")),
                iso(Db.dateTime(rs, "started_at")), iso(Db.dateTime(rs, "completed_at")), iso(Db.dateTime(rs, "served_at")),
                rs.getString("cancel_source"), rs.getString("cancel_reason"), rs.getString("cancelled_name")))
            .list();
    }

    private static String iso(LocalDateTime t) {
        return t == null ? null : Times.iso(t);
    }

    public OrderView order(long orderId) {
        record Head(long id, String code, long tableId, String status, LocalDateTime createdAt) {}
        Head h = jdbc.sql("SELECT id, code, table_id, status, created_at FROM orders WHERE id = ?").param(orderId)
            .query((rs, n) -> new Head(rs.getLong("id"), rs.getString("code"), rs.getLong("table_id"), rs.getString("status"),
                Db.dateTime(rs, "created_at")))
            .optional().orElseThrow(() -> BusinessException.notFound("Không tìm thấy đơn hàng"));
        TableRow t = table(h.tableId());
        List<Item> items = items(orderId);
        long subtotal = items.stream().filter(i -> !"cancelled".equals(i.status())).mapToLong(i -> i.price() * i.qty()).sum();
        int pending = (int) items.stream().filter(i -> "pending".equals(i.status()) || "cooking".equals(i.status())).count();
        int ready = (int) items.stream().filter(i -> "done".equals(i.status())).count();
        return new OrderView(Ids.str(h.id()), h.code(), Ids.str(t.id()), t.code(), t.areaName(), h.status(), isLocked(orderId),
            Times.iso(h.createdAt()), subtotal, pending, ready, items);
    }

    /** Bàn của một món (để phát sự kiện tới đúng trang khách). */
    public long tableOfItem(long itemId) {
        return jdbc.sql("SELECT o.table_id FROM order_items oi JOIN orders o ON o.id = oi.order_id WHERE oi.id = ?")
            .param(itemId).query(Long.class).optional().orElseThrow(() -> BusinessException.notFound("Không tìm thấy món"));
    }
}
