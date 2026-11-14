package com.rms.ordering;

import com.rms.audit.AuditService;
import com.rms.common.BusinessException;
import com.rms.common.CurrentUserService;
import com.rms.common.Db;
import com.rms.common.Ids;
import com.rms.common.Times;
import com.rms.common.ValidationException;
import com.rms.common.Vi;
import com.rms.notification.NotificationService;
import com.rms.ordering.OrderCore.OrderView;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Khu Bếp (UC-BEP-01..05): màn hình bếp, cập nhật tiến độ món, hủy món khi hết nguyên liệu, món tạm hết trong ngày.
 */
@Service
public class KitchenService {
    static final int UNDO_MINUTES = 30;
    static final Map<String, String> CANCEL_REASONS = Map.of(
        "out_of_stock", "Hết nguyên liệu", "bad_quality", "Nguyên liệu không đạt", "other", "Khác");

    public record KItem(String id, String orderId, String orderCode, String tableId, String tableCode, String areaName,
                        int batchNo, String dishId, String dishName, String categoryId, String categoryName, int qty,
                        String note, String status, String createdAt, String startedAt, String completedAt) {}

    public record Queue(List<KItem> items, List<KItem> recent, int pendingCount, int cookingCount, int doneToday,
                        int soldOutCount) {}

    public record SoldOutDish(String id, String name, String categoryName, boolean soldOut, String soldOutBy, int pendingCount) {}

    public record IdsInput(List<String> ids) {}

    public record CancelInput(String reason, String note, Boolean markSoldOut) {}

    public record SoldOutInput(Boolean soldOut) {}

    private final JdbcClient jdbc;
    private final OrderCore core;
    private final LiveEvents live;
    private final AuditService audit;
    private final CurrentUserService currentUser;
    private final NotificationService notifications;

    public KitchenService(JdbcClient jdbc, OrderCore core, LiveEvents live, AuditService audit, CurrentUserService currentUser,
                          NotificationService notifications) {
        this.jdbc = jdbc;
        this.core = core;
        this.live = live;
        this.audit = audit;
        this.currentUser = currentUser;
        this.notifications = notifications;
    }

    private static final String ITEM_SELECT = """
        SELECT oi.id, oi.order_id, o.code AS order_code, t.id AS table_id, t.code AS table_code, a.name AS area_name,
               oi.batch_no, oi.dish_id, oi.dish_name, c.id AS cat_id, c.name AS cat_name, oi.quantity, oi.note, oi.status,
               oi.created_at, oi.started_at, oi.completed_at
        FROM order_items oi
        JOIN orders o ON o.id = oi.order_id
        JOIN dining_tables t ON t.id = o.table_id
        JOIN areas a ON a.id = t.area_id
        JOIN dishes d ON d.id = oi.dish_id
        JOIN dish_categories c ON c.id = d.category_id
        """;

    private static String iso(LocalDateTime t) {
        return t == null ? null : Times.iso(t);
    }

    private List<KItem> items(String where, Object... params) {
        return jdbc.sql(ITEM_SELECT + where).params(params)
            .query((rs, n) -> new KItem(Ids.str(rs.getLong("id")), Ids.str(rs.getLong("order_id")), rs.getString("order_code"),
                Ids.str(rs.getLong("table_id")), rs.getString("table_code"), rs.getString("area_name"), rs.getInt("batch_no"),
                Ids.str(rs.getLong("dish_id")), rs.getString("dish_name"), Ids.str(rs.getLong("cat_id")), rs.getString("cat_name"),
                rs.getInt("quantity"), Vi.trim(rs.getString("note")), rs.getString("status"), iso(Db.dateTime(rs, "created_at")),
                iso(Db.dateTime(rs, "started_at")), iso(Db.dateTime(rs, "completed_at"))))
            .list();
    }

    /** UC-BEP-01: món Chờ / Đang chế biến (cũ nhất trước) + món vừa xong trong 30 phút (để hoàn tác). */
    public Queue queue() {
        List<KItem> active = items("WHERE o.status = 'open' AND oi.status IN ('pending','cooking') ORDER BY oi.created_at, oi.id");
        List<KItem> recent = items("WHERE oi.status = 'done' AND oi.completed_at >= ? ORDER BY oi.completed_at DESC LIMIT 30",
            Times.now().minusMinutes(UNDO_MINUTES));
        int pending = (int) active.stream().filter(i -> "pending".equals(i.status())).count();
        int doneToday = jdbc.sql("SELECT COUNT(*) FROM order_items WHERE completed_at >= ?").param(Times.today().atStartOfDay())
            .query(Integer.class).single();
        int soldOut = jdbc.sql("SELECT COUNT(*) FROM dishes WHERE status = 'selling' AND sold_out_date = ?").param(Times.today())
            .query(Integer.class).single();
        return new Queue(active, recent, pending, active.size() - pending, doneToday, soldOut);
    }

    public OrderView order(String orderIdText) {
        return core.order(Ids.parse(orderIdText, "Không tìm thấy đơn hàng"));
    }

    private record Row(long id, long tableId, String status, String orderStatus, String dishName, String tableCode,
                       long orderId, LocalDateTime completedAt) {}

    private List<Row> lock(List<String> idTexts) {
        if (idTexts == null || idTexts.isEmpty()) throw new ValidationException("ids", "Chưa chọn món");
        List<Row> out = new ArrayList<>();
        for (String text : new HashSet<>(idTexts)) {
            long id = Ids.parse(text, "Không tìm thấy món");
            out.add(jdbc.sql("""
                    SELECT oi.id, o.table_id, oi.status, o.status AS order_status, oi.dish_name, t.code, o.id AS order_id, oi.completed_at
                    FROM order_items oi JOIN orders o ON o.id = oi.order_id JOIN dining_tables t ON t.id = o.table_id
                    WHERE oi.id = ? FOR UPDATE
                    """).param(id)
                .query((rs, n) -> new Row(rs.getLong("id"), rs.getLong("table_id"), rs.getString("status"),
                    rs.getString("order_status"), rs.getString("dish_name"), rs.getString("code"), rs.getLong("order_id"),
                    Db.dateTime(rs, "completed_at")))
                .optional().orElseThrow(() -> BusinessException.notFound("Không tìm thấy món")));
        }
        return out;
    }

    private void publish(List<Row> rows) {
        Set<String> ch = new HashSet<>(List.of(LiveEvents.KITCHEN, LiveEvents.CASHIER));
        rows.forEach(r -> ch.add(LiveEvents.table(r.tableId())));
        live.publish(ch.toArray(String[]::new));
    }

    private long userId() {
        return currentUser.get().id();
    }

    /** UC-BEP-03: Chờ chế biến → Đang chế biến. Món đã hủy / đã chuyển trạng thái thì bỏ qua (máy khác vừa xử lý). */
    @Transactional
    public Queue start(IdsInput in) {
        List<Row> rows = lock(in.ids());
        if (rows.stream().anyMatch(r -> "cancelled".equals(r.status()))) {
            List<Row> pendingOnes = rows.stream().filter(r -> "pending".equals(r.status())).toList();
            if (pendingOnes.isEmpty()) throw new BusinessException("Món đã bị hủy");
        }
        LocalDateTime now = Times.now();
        for (Row r : rows) {
            if (!"pending".equals(r.status())) continue;
            jdbc.sql("UPDATE order_items SET status = 'cooking', started_at = ?, started_by = ? WHERE id = ?")
                .params(now, userId(), r.id()).update();
        }
        publish(rows);
        return queue();
    }

    /** UC-BEP-03: Đang chế biến → Đã xong (món Chờ chế biến bấm Hoàn thành thì ghi bắt đầu = hoàn thành). */
    @Transactional
    public Queue complete(IdsInput in) {
        List<Row> rows = lock(in.ids());
        if (rows.stream().allMatch(r -> "cancelled".equals(r.status()))) throw new BusinessException("Món đã bị hủy");
        LocalDateTime now = Times.now();
        for (Row r : rows) {
            if ("pending".equals(r.status())) {
                jdbc.sql("UPDATE order_items SET status = 'done', started_at = ?, started_by = ?, completed_at = ?, kitchen_user_id = ? WHERE id = ?")
                    .params(now, userId(), now, userId(), r.id()).update();
            } else if ("cooking".equals(r.status())) {
                jdbc.sql("UPDATE order_items SET status = 'done', completed_at = ?, kitchen_user_id = ? WHERE id = ?")
                    .params(now, userId(), r.id()).update();
            }
        }
        publish(rows);
        return queue();
    }

    /** Hoàn tác "Hoàn thành" bấm nhầm: trong 30 phút, món chưa được mang ra. */
    @Transactional
    public Queue undo(String idText) {
        Row r = lock(List.of(idText)).get(0);
        if (!"done".equals(r.status())) {
            throw new BusinessException("served".equals(r.status()) ? "Món đã được mang ra, không hoàn tác được" : "Món không ở trạng thái Đã xong");
        }
        if (r.completedAt() != null && r.completedAt().isBefore(Times.now().minusMinutes(UNDO_MINUTES))) {
            throw new BusinessException("Chỉ hoàn tác được trong " + UNDO_MINUTES + " phút sau khi hoàn thành");
        }
        jdbc.sql("UPDATE order_items SET status = 'cooking', completed_at = NULL, kitchen_user_id = NULL WHERE id = ?").param(r.id()).update();
        publish(List.of(r));
        return queue();
    }

    /** UC-BEP-04: hủy món Chờ chế biến (hết nguyên liệu…), báo thu ngân; có thể đánh dấu món tạm hết. */
    @Transactional
    public Queue cancel(String idText, CancelInput in) {
        String reasonKey = Vi.trim(in.reason());
        String note = Vi.collapse(in.note());
        var v = new ValidationException.Collector();
        if (!CANCEL_REASONS.containsKey(reasonKey)) v.add("reason", "Vui lòng chọn lý do");
        if ("other".equals(reasonKey) && note.isEmpty()) v.add("note", "Vui lòng nhập lý do");
        if (note.length() > 200) v.add("note", "Lý do tối đa 200 ký tự");
        v.throwIfAny();
        Row r = lock(List.of(idText)).get(0);
        if ("cancelled".equals(r.status())) throw new BusinessException("Món đã bị hủy");
        if (!"pending".equals(r.status())) throw new BusinessException("Món đã bắt đầu chế biến, không thể hủy");
        String reason = "other".equals(reasonKey) ? note : CANCEL_REASONS.get(reasonKey) + (note.isEmpty() ? "" : ": " + note);
        jdbc.sql("UPDATE order_items SET status = 'cancelled', cancel_source = 'kitchen', cancel_reason = ?, cancelled_by = ?, cancelled_at = ? WHERE id = ?")
            .params(reason, userId(), Times.now(), r.id()).update();
        if (Boolean.TRUE.equals(in.markSoldOut())) {
            jdbc.sql("UPDATE dishes d JOIN order_items oi ON oi.dish_id = d.id SET d.sold_out_date = ?, d.sold_out_by = ? WHERE oi.id = ?")
                .params(Times.today(), userId(), r.id()).update();
        }
        notifications.sendToRoles("kitchen", "Bếp hủy món " + r.dishName() + " – bàn " + r.tableCode(), reason, "orders", r.orderId(),
            List.of("cashier"));
        audit.log("kitchen", "Hủy món", "Hủy " + r.dishName() + " – bàn " + r.tableCode() + ": " + reason, "order_items", r.id());
        publish(List.of(r));
        return queue();
    }

    /* ------------------------------------------------------------------ UC-BEP-05: món tạm hết */

    public List<SoldOutDish> dishes() {
        return jdbc.sql("""
                SELECT d.id, d.name, c.name AS cat_name, (d.sold_out_date = ?) AS sold_out, u.full_name,
                       (SELECT COUNT(*) FROM order_items oi JOIN orders o ON o.id = oi.order_id
                         WHERE oi.dish_id = d.id AND oi.status = 'pending' AND o.status = 'open') AS pending
                FROM dishes d JOIN dish_categories c ON c.id = d.category_id LEFT JOIN users u ON u.id = d.sold_out_by
                WHERE d.status = 'selling'
                ORDER BY sold_out DESC, c.sort_order, d.name
                """).param(Times.today())
            .query((rs, n) -> new SoldOutDish(Ids.str(rs.getLong("id")), rs.getString("name"), rs.getString("cat_name"),
                rs.getBoolean("sold_out"), rs.getBoolean("sold_out") ? Vi.trim(rs.getString("full_name")) : null, rs.getInt("pending")))
            .list();
    }

    @Transactional
    public SoldOutDish setSoldOut(String dishIdText, SoldOutInput in) {
        long id = Ids.parse(dishIdText, "Không tìm thấy món");
        boolean soldOut = Boolean.TRUE.equals(in.soldOut());
        String name = jdbc.sql("SELECT name FROM dishes WHERE id = ? AND status = 'selling'").param(id).query(String.class).optional()
            .orElseThrow(() -> BusinessException.notFound("Món không còn đang bán"));
        if (soldOut) {
            jdbc.sql("UPDATE dishes SET sold_out_date = ?, sold_out_by = ? WHERE id = ?").params(Times.today(), userId(), id).update();
        } else {
            jdbc.sql("UPDATE dishes SET sold_out_date = NULL, sold_out_by = NULL WHERE id = ?").param(id).update();
        }
        audit.log("kitchen", soldOut ? "Đánh dấu món tạm hết" : "Bán lại món", (soldOut ? "Tạm hết: " : "Bán lại: ") + name, "dishes", id);
        // Trang đặt món của mọi bàn cần biết món tạm hết → báo các bàn đang có đơn mở.
        List<Long> tables = jdbc.sql("SELECT DISTINCT table_id FROM orders WHERE status = 'open'").query(Long.class).list();
        List<String> ch = new ArrayList<>(List.of(LiveEvents.KITCHEN, LiveEvents.CASHIER));
        tables.forEach(t -> ch.add(LiveEvents.table(t)));
        live.publish(ch.toArray(String[]::new));
        return dishes().stream().filter(d -> d.id().equals(Ids.str(id))).findFirst().orElseThrow();
    }
}
