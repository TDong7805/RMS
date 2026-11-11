package com.rms.audit;

import com.rms.common.CurrentUserService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.web.context.request.RequestAttributes;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

/**
 * Ghi nhật ký hoạt động. Các service nghiệp vụ gọi log() sau khi lưu; vì cùng transaction nên
 * thay đổi dữ liệu và dòng nhật ký luôn thành công/thất bại cùng nhau.
 */
@Service
public class AuditService {
    private final JdbcClient jdbc;
    private final CurrentUserService currentUser;

    public AuditService(JdbcClient jdbc, CurrentUserService currentUser) {
        this.jdbc = jdbc;
        this.currentUser = currentUser;
    }

    public void log(String module, String action, String detail) {
        log(module, action, detail, null, null);
    }

    public void log(String module, String action, String detail, String refTable, Long refId) {
        var user = currentUser.get();
        jdbc.sql("""
                INSERT INTO audit_logs (user_id, actor_name, actor_username, module, action, detail, ref_table, ref_id, ip_address)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """)
            .params(user.id(), user.fullName(), user.username(), module, cut(action, 100), cut(detail, 1000), refTable, refId, clientIp())
            .update();
    }

    private static String cut(String s, int max) {
        if (s == null) return null;
        return s.length() <= max ? s : s.substring(0, max - 1) + "…";
    }

    /**
     * IP người thao tác. Không tự đọc header X-Forwarded-For (ai cũng giả được): khi chạy sau reverse proxy,
     * Tomcat đã thay getRemoteAddr() bằng IP thật do proxy tin cậy gửi (server.forward-headers-strategy=native).
     */
    private static String clientIp() {
        RequestAttributes attrs = RequestContextHolder.getRequestAttributes();
        if (attrs instanceof ServletRequestAttributes sra) {
            HttpServletRequest req = sra.getRequest();
            String ip = req.getRemoteAddr();
            return ip != null && ip.length() > 45 ? ip.substring(0, 45) : ip;
        }
        return null;
    }
}
