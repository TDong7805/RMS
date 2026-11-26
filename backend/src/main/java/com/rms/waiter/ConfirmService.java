package com.rms.waiter;

import com.rms.audit.AuditService;
import com.rms.common.BusinessException;
import com.rms.common.CurrentUserService;
import com.rms.common.Db;
import com.rms.common.Ids;
import com.rms.common.SystemSettings;
import com.rms.common.Times;
import com.rms.common.ValidationException;
import com.rms.common.Vi;
import com.rms.notification.NotificationService;
import com.rms.ordering.LiveEvents;
import com.rms.ordering.OrderCore;
import com.rms.ordering.OrderCore.OrderView;
import com.rms.shift.DutyService;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Xác nhận đơn của khách (V22): món khách gửi qua QR ở trạng thái Chờ xác nhận; nhân viên phục vụ trong ca (theo lịch) của khu
 * kiểm tra với khách rồi xác nhận (→ Chờ chế biến, bếp thấy) hoặc bỏ từng món kèm lý do (khách thấy lý do).
 * Người xác nhận được ghi vào từng món (confirmed_by) — người chịu trách nhiệm cho lượt gọi món đó.
 *
 * Ai thấy: phục vụ của khu (khu không ai có ca → mọi phục vụ đang trong ca). Chờ quá N phút (cấu hình) → nhắc lại cho mọi
 * phục vụ đang trong ca và hiện cho tất cả. Không tự chuyển bếp.
 */
@Service
public class ConfirmService {
    public static final String REMIND_KEY = "order.confirm_remind_minutes";
    static final int REASON_MAX = 200;

    public record Line(String itemId, String name, int qty, String note, String setId, String setName, long price) {}

    /** Một bàn có món chờ xác nhận (gộp mọi lượt gửi chưa xác nhận). overdue = chờ quá N phút. */
    public record Pending(String orderId, String orderCode, String tableId, String tableCode, String areaId, String areaName,
                          String since, int waitingMinutes, boolean overdue, List<Line> items) {}

    public record PendingList(List<Pending> items, int count, int remindMinutes) {}

    public record Reject(String itemId, String reason) {}

    public record ConfirmInput(List<Reject> rejects) {}

    private final JdbcClient jdbc;
    private final DutyService duty;
    private final CurrentUserService currentUser;
    private final OrderCore core;
    private final LiveEvents live;
    private final AuditService audit;
    private final NotificationService notifications;
    private final SystemSettings settings;

    public ConfirmService(JdbcClient jdbc, DutyService duty, CurrentUserService currentUser, OrderCore core, LiveEvents live,
                          AuditService audit, NotificationService notifications, SystemSettings settings) {
        this.jdbc = jdbc;
        this.duty = duty;
        this.currentUser = currentUser;
        this.core = core;
        this.live = live;
        this.audit = audit;
        this.notifications = notifications;
        this.settings = settings;
    }

    public int remindMinutes() {
        return Math.max(1, Math.min(60, settings.integer(REMIND_KEY, 3)));
    }

    private record Row(long itemId, long orderId, String orderCode, long tableId, String tableCode, long areaId, String areaName,
                       String name, int qty, String note, Long setId, String setName, long price, LocalDateTime createdAt) {}

    private List<Row> rows(String where, Object... params) {
        return jdbc.sql("""
                SELECT oi.id, oi.order_id, o.code AS order_code, t.id AS table_id, t.code AS table_code, a.id AS area_id,
                       a.name AS area_name, oi.dish_name, oi.quantity, oi.note, oi.order_set_id, os.set_name, oi.unit_price, oi.created_at
                FROM order_items oi JOIN orders o ON o.id = oi.order_id JOIN dining_tables t ON t.id = o.table_id
                JOIN areas a ON a.id = t.area_id LEFT JOIN order_sets os ON os.id = oi.order_set_id
                WHERE oi.status = 'unconfirmed' AND o.status = 'open'
                """ + where + " ORDER BY oi.created_at, oi.id").params(params)
            .query((rs, n) -> new Row(rs.getLong("id"), rs.getLong("order_id"), rs.getString("order_code"), rs.getLong("table_id"),
                rs.getString("table_code"), rs.getLong("area_id"), rs.getString("area_name"), rs.getString("dish_name"),
                rs.getInt("quantity"), Vi.trim(rs.getString("note")), rs.getObject("order_set_id") == null ? null : rs.getLong("order_set_id"),
                rs.getString("set_name"), rs.getBigDecimal("unit_price").longValue(), Db.dateTime(rs, "created_at")))
            .list();
    }

    /** Đơn này phục vụ đang đăng nhập có được xem / xác nhận không: khu của mình (hoặc khu không ai trực) hoặc đã quá giờ. */
    private boolean visible(long areaId, LocalDateTime since, Set<Long> areas, LocalDateTime now) {
        return areas == null || areas.contains(areaId) || since.isBefore(now.minusMinutes(remindMinutes()));
    }

    public PendingList list() {
        LocalDateTime now = Times.now();
        Set<Long> areas = duty.visibleAreas(currentUser.get().id(), now);
        Map<Long, List<Row>> byOrder = new LinkedHashMap<>();
        rows("").forEach(r -> byOrder.computeIfAbsent(r.orderId(), k -> new ArrayList<>()).add(r));
        List<Pending> out = new ArrayList<>();
        for (List<Row> list : byOrder.values()) {
            Row f = list.get(0);
            if (!visible(f.areaId(), f.createdAt(), areas, now)) continue;
            int wait = (int) Math.max(0, java.time.Duration.between(f.createdAt(), now).toMinutes());
            out.add(new Pending(Ids.str(f.orderId()), f.orderCode(), Ids.str(f.tableId()), f.tableCode(), Ids.str(f.areaId()), f.areaName(),
                Times.iso(f.createdAt()), wait, wait >= remindMinutes(),
                list.stream().map(r -> new Line(Ids.str(r.itemId()), r.name(), r.qty(), r.note(), Ids.str(r.setId()), r.setName(), r.price())).toList()));
        }
        // Chờ lâu nhất trước.
        out.sort((a, b) -> Integer.compare(b.waitingMinutes(), a.waitingMinutes()));
        return new PendingList(out, out.size(), remindMinutes());
    }

    /**
     * Xác nhận mọi món đang chờ của đơn; món có trong rejects bị bỏ (kèm lý do). Bỏ một món trong set → bỏ cả set
     * (giá set chia cho các món con). Trả về đơn sau khi xác nhận.
     */
    @Transactional
    public OrderView confirm(String orderIdText, ConfirmInput in) {
        long orderId = Ids.parse(orderIdText, "Không tìm thấy đơn hàng");
        var me = currentUser.get();
        LocalDateTime now = Times.now();
        long tableId = jdbc.sql("SELECT table_id FROM orders WHERE id = ?").param(orderId).query(Long.class).optional()
            .orElseThrow(() -> BusinessException.notFound("Không tìm thấy đơn hàng"));
        core.lockTable(tableId);
        List<Row> items = rows(" AND oi.order_id = ?", orderId);
        if (items.isEmpty()) throw new BusinessException("Đơn không còn món nào chờ xác nhận (có thể nhân viên khác vừa xác nhận)");
        Row f = items.get(0);
        if (!visible(f.areaId(), f.createdAt(), duty.visibleAreas(me.id(), now), now)) {
            throw new BusinessException("Bàn " + f.tableCode() + " thuộc khu vực của nhân viên khác");
        }

        Map<Long, String> rejects = new HashMap<>();
        var v = new ValidationException.Collector();
        Set<Long> pendingIds = items.stream().map(Row::itemId).collect(Collectors.toSet());
        for (Reject r : in == null || in.rejects() == null ? List.<Reject>of() : in.rejects()) {
            Long id = Ids.parseOrNull(r.itemId());
            String reason = Vi.collapse(r.reason());
            if (id == null || !pendingIds.contains(id)) continue; // món vừa bị khách hủy
            if (reason.isEmpty()) v.add("rejects." + id, "Nhập lý do bỏ món");
            else if (reason.length() > REASON_MAX) v.add("rejects." + id, "Lý do tối đa " + REASON_MAX + " ký tự");
            rejects.put(id, reason);
        }
        v.throwIfAny();
        // Bỏ một món trong set → bỏ cả set.
        for (Row r : items) {
            if (r.setId() == null || rejects.containsKey(r.itemId())) continue;
            items.stream().filter(x -> r.setId().equals(x.setId()) && rejects.containsKey(x.itemId())).findFirst()
                .ifPresent(x -> rejects.put(r.itemId(), rejects.get(x.itemId())));
        }

        int confirmed = 0;
        for (Row r : items) {
            String reason = rejects.get(r.itemId());
            if (reason != null) {
                jdbc.sql("""
                        UPDATE order_items SET status = 'cancelled', cancel_source = 'waiter', cancel_reason = ?, cancelled_by = ?, cancelled_at = ?
                        WHERE id = ? AND status = 'unconfirmed'
                        """).params(reason, me.id(), now, r.itemId()).update();
            } else {
                confirmed += jdbc.sql("UPDATE order_items SET status = 'pending', confirmed_by = ?, confirmed_at = ? WHERE id = ? AND status = 'unconfirmed'")
                    .params(me.id(), now, r.itemId()).update();
            }
        }
        audit.log("waiter", "Xác nhận đơn", "Bàn " + f.tableCode() + " (đơn " + f.orderCode() + "): xác nhận " + confirmed + " món"
            + (rejects.isEmpty() ? "" : ", bỏ " + rejects.size() + " món"), "orders", orderId);
        live.publish(LiveEvents.KITCHEN, LiveEvents.CASHIER, LiveEvents.WAITER, LiveEvents.table(tableId));
        return core.order(orderId);
    }

    /** Mỗi 30 giây: đơn chờ xác nhận quá N phút (chưa nhắc) → báo mọi phục vụ đang trong ca (không ai có ca → mọi phục vụ), đánh dấu đã nhắc. */
    @Scheduled(fixedDelay = 30_000, initialDelay = 20_000)
    @Transactional
    public void remindOverdue() {
        LocalDateTime now = Times.now();
        List<Row> late = rows(" AND oi.confirm_reminded_at IS NULL AND oi.created_at < ?", now.minusMinutes(remindMinutes()));
        if (late.isEmpty()) return;
        List<Long> waiters = duty.waitersOnDuty(now).stream().map(DutyService.Duty::userId).distinct().toList();
        if (waiters.isEmpty()) waiters = duty.allWaiters();
        Map<Long, Row> byOrder = new LinkedHashMap<>();
        late.forEach(r -> byOrder.putIfAbsent(r.orderId(), r));
        for (Row r : byOrder.values()) {
            String title = "Bàn " + r.tableCode() + " (" + r.areaName() + ") chờ xác nhận quá " + remindMinutes() + " phút";
            for (long w : waiters) notifications.sendToUser("service_request", title, "Khách đang chờ — xác nhận để chuyển bếp", "orders", r.orderId(), w);
        }
        jdbc.sql("UPDATE order_items SET confirm_reminded_at = ? WHERE status = 'unconfirmed' AND confirm_reminded_at IS NULL AND created_at < ?")
            .params(now, now.minusMinutes(remindMinutes())).update();
        live.publish(LiveEvents.WAITER);
    }
}
