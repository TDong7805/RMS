package com.rms.auth;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Mỗi request của người đã đăng nhập: kiểm tra lại tài khoản trong CSDL.
 * Nếu tài khoản vừa bị khóa, bị xóa, bị đổi vai trò hoặc được quản lý đặt lại mật khẩu → hủy phiên, trả 401,
 * buộc đăng nhập lại.
 * Nhờ vậy khi quản lý khóa một tài khoản, người đó bị đẩy ra ngay ở thao tác kế tiếp.
 *
 * Không đánh dấu @Component: nếu là bean Filter, Spring Boot sẽ tự đăng ký thêm vào servlet và filter chạy hai lần.
 * Được gắn vào chuỗi bảo mật trong {@link SecurityConfig}.
 */
class ActiveUserFilter extends OncePerRequestFilter {
    private final JdbcClient jdbc;

    ActiveUserFilter(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    private record Row(String status, boolean deleted, String role, boolean mustChangePassword) {}

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return !request.getRequestURI().startsWith("/api/") || request.getRequestURI().equals("/api/auth/login");
    }

    @Override
    protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain)
        throws ServletException, IOException {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof AuthUser user) {
            Row row = jdbc.sql("""
                    SELECT u.status, u.deleted_at IS NOT NULL AS deleted, r.code AS role, u.must_change_password
                    FROM users u JOIN roles r ON r.id = u.role_id WHERE u.id = ?
                    """)
                .param(user.id())
                .query((rs, n) -> new Row(rs.getString("status"), rs.getBoolean("deleted"), rs.getString("role"),
                    rs.getBoolean("must_change_password")))
                .optional()
                .orElse(null);

            // Mật khẩu bị đặt lại (must_change_password = 1) trong khi phiên này đã qua bước đổi mật khẩu → phiên cũ hết hiệu lực.
            boolean sessionPending = auth.getAuthorities().stream()
                .anyMatch(g -> StaffAreas.PASSWORD_CHANGE_REQUIRED.equals(g.getAuthority()));
            boolean passwordReset = row != null && row.mustChangePassword() && !sessionPending;

            if (row == null || row.deleted() || !"active".equals(row.status()) || !row.role().equals(user.role()) || passwordReset) {
                SecurityContextHolder.clearContext();
                var session = req.getSession(false);
                if (session != null) session.invalidate();
                String message;
                if (row != null && "locked".equals(row.status()) && !row.deleted()) {
                    message = "Tài khoản đã bị khóa. Vui lòng liên hệ quản lý nhà hàng.";
                } else if (passwordReset && "active".equals(row.status()) && row.role().equals(user.role())) {
                    message = "Mật khẩu của bạn vừa được quản lý đặt lại. Vui lòng đăng nhập bằng mật khẩu mới.";
                } else {
                    message = "Tài khoản đã thay đổi. Vui lòng đăng nhập lại.";
                }
                JsonErrors.write(res, HttpServletResponse.SC_UNAUTHORIZED, message);
                return;
            }
        }
        chain.doFilter(req, res);
    }
}
