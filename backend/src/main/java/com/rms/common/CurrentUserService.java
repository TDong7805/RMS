package com.rms.common;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;

/**
 * Người dùng đang thao tác. TẠM THỜI chưa có đăng nhập: luôn là tài khoản cấu hình ở rms.dev-user.
 * Khi làm xác thực JWT, chỉ cần đổi hàm get() để lấy người dùng từ token — các nơi khác không phải sửa.
 */
@Service
public class CurrentUserService {

    public record CurrentUser(long id, String username, String fullName, String role) {}

    private final JdbcClient jdbc;
    private final String devUsername;

    public CurrentUserService(JdbcClient jdbc, @Value("${rms.dev-user}") String devUsername) {
        this.jdbc = jdbc;
        this.devUsername = devUsername;
    }

    public CurrentUser get() {
        return jdbc.sql("""
                SELECT u.id, u.username, u.full_name, r.code AS role
                FROM users u JOIN roles r ON r.id = u.role_id
                WHERE u.username = ? AND u.deleted_at IS NULL
                """)
            .param(devUsername)
            .query((rs, n) -> new CurrentUser(rs.getLong("id"), rs.getString("username"), rs.getString("full_name"), rs.getString("role")))
            .optional()
            .orElseThrow(() -> new BusinessException(
                "Chưa có tài khoản '" + devUsername + "' trong CSDL. Hãy chạy backend/database/rms_schema.sql.",
                org.springframework.http.HttpStatus.INTERNAL_SERVER_ERROR));
    }
}
