package com.rms.notification;

import com.rms.common.BusinessException;
import com.rms.common.CurrentUserService;
import com.rms.common.Db;
import com.rms.common.Ids;
import com.rms.common.Times;
import com.rms.common.Vi;
import java.util.Collection;
import java.util.List;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Thông báo dùng chung cho mọi khu (Quản lý nhà hàng, Kho, sau này Thu ngân / Bếp).
 *
 * Mỗi thông báo có một hoặc nhiều người nhận (notification_recipients); trạng thái đã đọc riêng từng tài khoản.
 * Thông báo giữ 30 ngày (cột expires_at) rồi tự xóa. Đường dẫn khi bấm tính theo đối tượng liên quan
 * (ref_table / ref_id) và vai trò người xem — cùng một thông báo kho mở trang khác nhau cho kho và quản lý.
 */
@Service
public class NotificationService {
    static final int LIST_LIMIT = 200;

    /** Khớp kiểu AppNotification của frontend. */
    public record Item(String id, String type, String title, String description, String createdAt, boolean read,
                       String href) {}

    public record ListResponse(List<Item> items, int unreadCount, int total) {}

    private final JdbcClient jdbc;
    private final CurrentUserService currentUser;

    public NotificationService(JdbcClient jdbc, CurrentUserService currentUser) {
        this.jdbc = jdbc;
        this.currentUser = currentUser;
    }

    /* ------------------------------------------------------------------ Gửi */

    /** Gửi cho mọi tài khoản đang hoạt động thuộc các vai trò (vd. "warehouse", "manager"). */
    @Transactional
    public void sendToRoles(String type, String title, String content, String refTable, Long refId, Collection<String> roles) {
        if (roles.isEmpty()) return;
        long id = insert(type, title, content, refTable, refId);
        String placeholders = String.join(",", roles.stream().map(r -> "?").toList());
        jdbc.sql("""
                INSERT INTO notification_recipients (notification_id, user_id)
                SELECT ?, u.id FROM users u JOIN roles r ON r.id = u.role_id
                WHERE u.deleted_at IS NULL AND u.status = 'active' AND r.code IN (%s)
                """.formatted(placeholders))
            .params(concat(id, roles))
            .update();
    }

    /** Gửi riêng cho một tài khoản (vd. người lập phiếu kiểm kê). */
    @Transactional
    public void sendToUser(String type, String title, String content, String refTable, Long refId, long userId) {
        long id = insert(type, title, content, refTable, refId);
        jdbc.sql("INSERT INTO notification_recipients (notification_id, user_id) VALUES (?, ?)").params(id, userId).update();
    }

    private long insert(String type, String title, String content, String refTable, Long refId) {
        jdbc.sql("INSERT INTO notifications (type_code, title, content, ref_table, ref_id) VALUES (?, ?, ?, ?, ?)")
            .params(type, cut(title, 150), cut(content, 500), refTable, refId)
            .update();
        return jdbc.sql("SELECT LAST_INSERT_ID()").query(Long.class).single();
    }

    private static Object[] concat(long first, Collection<String> rest) {
        Object[] out = new Object[rest.size() + 1];
        out[0] = first;
        int i = 1;
        for (String r : rest) out[i++] = r;
        return out;
    }

    private static String cut(String s, int max) {
        if (s == null) return null;
        return s.length() <= max ? s : s.substring(0, max - 1) + "…";
    }

    /* ------------------------------------------------------------------ Đọc */

    public ListResponse list() {
        var user = currentUser.get();
        List<Item> items = jdbc.sql("""
                SELECT n.id, n.type_code, n.title, n.content, n.ref_table, n.ref_id, n.created_at, nr.is_read
                FROM notification_recipients nr JOIN notifications n ON n.id = nr.notification_id
                WHERE nr.user_id = ? AND n.expires_at > NOW()
                ORDER BY n.created_at DESC, n.id DESC
                LIMIT %d
                """.formatted(LIST_LIMIT))
            .param(user.id())
            .query((rs, i) -> {
                Long refId = rs.getObject("ref_id") == null ? null : rs.getLong("ref_id");
                return new Item(Ids.str(rs.getLong("id")), rs.getString("type_code"), rs.getString("title"),
                    Vi.trim(rs.getString("content")), Times.iso(Db.dateTime(rs, "created_at")), rs.getBoolean("is_read"),
                    href(user.role(), rs.getString("ref_table"), refId));
            })
            .list();
        int unread = (int) items.stream().filter(n -> !n.read()).count();
        return new ListResponse(items, unread, items.size());
    }

    public int unreadCount() {
        var user = currentUser.get();
        return jdbc.sql("""
                SELECT COUNT(*) FROM notification_recipients nr JOIN notifications n ON n.id = nr.notification_id
                WHERE nr.user_id = ? AND nr.is_read = 0 AND n.expires_at > NOW()
                """)
            .param(user.id()).query(Integer.class).single();
    }

    /** Trang mở khi bấm thông báo; null = chỉ xem. */
    static String href(String role, String refTable, Long refId) {
        if (refTable == null || refId == null) return null;
        boolean warehouse = "warehouse".equals(role);
        boolean manager = "manager".equals(role);
        boolean cashier = "cashier".equals(role);
        return switch (refTable) {
            case "ingredients" -> warehouse ? "/kho/nguyen-lieu/" + refId : null;
            case "purchase_orders" -> warehouse ? "/kho/phieu-mua/" + refId : null;
            case "stocktakes" -> warehouse ? "/kho/kiem-ke/" + refId : manager ? "/quan-ly/kiem-ke/" + refId : null;
            case "reservations" -> manager ? "/quan-ly/dat-ban/lich-su?id=" + refId : null;
            case "orders" -> cashier ? "/thu-ngan/don/" + refId : null;
            default -> null;
        };
    }

    /* ------------------------------------------------------------------ Đánh dấu đã đọc */

    @Transactional
    public Item markRead(String idText) {
        long id = Ids.parse(idText, "Không tìm thấy thông báo");
        var user = currentUser.get();
        int changed = jdbc.sql("""
                UPDATE notification_recipients SET is_read = 1, read_at = COALESCE(read_at, NOW())
                WHERE notification_id = ? AND user_id = ?
                """).params(id, user.id()).update();
        if (changed == 0) throw BusinessException.notFound("Không tìm thấy thông báo");
        return list().items().stream().filter(n -> n.id().equals(Ids.str(id))).findFirst()
            .orElseThrow(() -> BusinessException.notFound("Không tìm thấy thông báo"));
    }

    @Transactional
    public int markAllRead() {
        var user = currentUser.get();
        return jdbc.sql("UPDATE notification_recipients SET is_read = 1, read_at = NOW() WHERE user_id = ? AND is_read = 0")
            .param(user.id()).update();
    }

    /** Thông báo hết hạn (giữ 30 ngày) tự xóa lúc 3:00 hằng ngày; người nhận xóa theo (ON DELETE CASCADE). */
    @Scheduled(cron = "0 0 3 * * *", zone = "Asia/Ho_Chi_Minh")
    public void purgeExpired() {
        jdbc.sql("DELETE FROM notifications WHERE expires_at <= NOW()").update();
    }
}
