package com.rms.auth;

import com.rms.common.Rules;
import java.util.Locale;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Tạo tài khoản Quản lý nhà hàng đầu tiên khi chạy thật.
 *
 * CSDL thật không có tài khoản mẫu (không ai biết trước mật khẩu). Ở lần chạy đầu, đặt biến môi trường
 * (hoặc dòng trong .env.properties): RMS_BOOTSTRAP_USERNAME, RMS_BOOTSTRAP_PASSWORD, RMS_BOOTSTRAP_EMAIL.
 * Khi khởi động, nếu CSDL chưa có quản lý nào đang hoạt động thì tạo tài khoản này với must_change_password = 1
 * → đăng nhập lần đầu bắt buộc đổi mật khẩu. Đã có quản lý thì không làm gì (có thể xóa các biến đi).
 *
 * Họ tên mặc định "Quản lý nhà hàng", đổi trong trang Tài khoản sau khi đăng nhập. Không lấy họ tên từ cấu hình
 * vì file .env.properties được đọc theo bảng mã ISO-8859-1, chữ có dấu sẽ bị lỗi.
 *
 * Khi phát triển, dữ liệu mẫu đã có quản lý (tuan.nguyen) nên lớp này không làm gì.
 */
@Component
class BootstrapManager implements ApplicationRunner {
    private static final Logger log = LoggerFactory.getLogger(BootstrapManager.class);
    private static final String DEFAULT_FULL_NAME = "Quản lý nhà hàng";

    private final JdbcClient jdbc;
    private final PasswordEncoder encoder;
    private final String username;
    private final String password;
    private final String email;

    BootstrapManager(JdbcClient jdbc, PasswordEncoder encoder,
                     @Value("${rms.bootstrap.username:}") String username,
                     @Value("${rms.bootstrap.password:}") String password,
                     @Value("${rms.bootstrap.email:}") String email) {
        this.jdbc = jdbc;
        this.encoder = encoder;
        this.username = username.trim().toLowerCase(Locale.ROOT);
        this.password = password;
        this.email = email.trim().toLowerCase(Locale.ROOT);
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        long activeManagers = jdbc.sql("""
                SELECT COUNT(*) FROM users u JOIN roles r ON r.id = u.role_id
                WHERE r.code = 'manager' AND u.status = 'active' AND u.deleted_at IS NULL
                """).query(Long.class).single();
        if (activeManagers > 0) return;

        if (username.isEmpty() || password.isEmpty()) {
            log.warn("Chưa có tài khoản Quản lý nhà hàng nào đang hoạt động nên chưa ai đăng nhập được. "
                + "Đặt RMS_BOOTSTRAP_USERNAME, RMS_BOOTSTRAP_PASSWORD, RMS_BOOTSTRAP_EMAIL rồi khởi động lại "
                + "để tạo tài khoản quản lý đầu tiên.");
            return;
        }

        String problem = validate();
        if (problem != null) {
            // Dừng khởi động: cấu hình sai thì báo ngay, không chạy lên mà không ai đăng nhập được.
            throw new IllegalStateException("Không tạo được tài khoản quản lý đầu tiên: " + problem);
        }

        jdbc.sql("""
                INSERT INTO users (username, password_hash, must_change_password, full_name, email, role_id)
                VALUES (?, ?, 1, ?, ?, (SELECT id FROM roles WHERE code = 'manager'))
                """)
            .params(username, encoder.encode(password), DEFAULT_FULL_NAME, email)
            .update();
        jdbc.sql("""
                INSERT INTO audit_logs (user_id, actor_name, actor_username, module, action, detail, ref_table, ref_id)
                SELECT NULL, 'Hệ thống', 'system', 'account', 'Tạo tài khoản quản lý đầu tiên', ?, 'users', id
                FROM users WHERE username = ? AND deleted_at IS NULL
                """)
            .params("Tạo từ biến môi trường RMS_BOOTSTRAP_* khi khởi động: " + username, username)
            .update();
        log.info("Đã tạo tài khoản quản lý đầu tiên '{}'. Đăng nhập và đổi mật khẩu, sau đó có thể xóa các biến RMS_BOOTSTRAP_*.",
            username);
    }

    private String validate() {
        if (!Rules.USERNAME.matcher(username).matches())
            return "RMS_BOOTSTRAP_USERNAME phải từ 4–30 ký tự, chỉ gồm chữ thường không dấu, số, dấu chấm, gạch dưới.";
        String pw = Rules.passwordError(password);
        if (pw != null) return "RMS_BOOTSTRAP_PASSWORD: " + pw + ".";
        if (email.isEmpty() || !Rules.EMAIL.matcher(email).matches())
            return "RMS_BOOTSTRAP_EMAIL chưa có hoặc không đúng định dạng email.";
        long taken = jdbc.sql("SELECT COUNT(*) FROM users WHERE username = ? OR email = ?")
            .params(username, email).query(Long.class).single();
        if (taken > 0)
            return "tên đăng nhập hoặc email đã thuộc về một tài khoản khác (có thể đang bị khóa). Hãy dùng tên khác.";
        return null;
    }
}
