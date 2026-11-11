package com.rms.auth;

import com.rms.audit.AuditService;
import com.rms.common.BusinessException;
import com.rms.common.Ids;
import com.rms.common.Rules;
import com.rms.common.ValidationException;
import java.util.Optional;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * UC Đăng nhập / Đổi mật khẩu cho nhân viên (bảng users). Không có đăng ký: quản lý cấp tài khoản.
 */
@Service
public class AuthService {

    public record LoginRequest(String username, String password, Boolean remember) {}

    public record ChangePasswordRequest(String currentPassword, String newPassword, String confirmPassword) {}

    /** Thông tin trả cho frontend sau khi đăng nhập và ở GET /api/auth/me. */
    public record Me(String id, String username, String fullName, String email, String role, String roleLabel,
                     boolean mustChangePassword, String home) {}

    record Account(long id, String username, String passwordHash, String fullName, String email, String status,
                   String role, String roleName, boolean mustChangePassword) {}

    private static final String SELECT_ACCOUNT = """
        SELECT u.id, u.username, u.password_hash, u.full_name, u.email, u.status, u.must_change_password,
               r.code AS role, r.name AS role_name
        FROM users u JOIN roles r ON r.id = u.role_id
        WHERE u.deleted_at IS NULL AND
        """;

    private final JdbcClient jdbc;
    private final PasswordEncoder encoder;
    private final LoginAttemptService attempts;
    private final AuditService audit;
    /** So khớp giả khi không có tài khoản, để thời gian phản hồi không tiết lộ tên đăng nhập nào tồn tại. */
    private final String dummyHash;

    public AuthService(JdbcClient jdbc, PasswordEncoder encoder, LoginAttemptService attempts, AuditService audit) {
        this.jdbc = jdbc;
        this.encoder = encoder;
        this.attempts = attempts;
        this.audit = audit;
        this.dummyHash = encoder.encode("khong-co-tai-khoan-nay");
    }

    Optional<Account> findByUsername(String username) {
        return jdbc.sql(SELECT_ACCOUNT + " u.username = ?").param(username).query(this::map).optional();
    }

    Optional<Account> findById(long id) {
        return jdbc.sql(SELECT_ACCOUNT + " u.id = ?").param(id).query(this::map).optional();
    }

    private Account map(java.sql.ResultSet rs, int n) throws java.sql.SQLException {
        return new Account(rs.getLong("id"), rs.getString("username"), rs.getString("password_hash"),
            rs.getString("full_name"), rs.getString("email"), rs.getString("status"), rs.getString("role"),
            rs.getString("role_name"), rs.getBoolean("must_change_password"));
    }

    Me toMe(Account a) {
        return new Me(Ids.str(a.id()), a.username(), a.fullName(), a.email(), a.role(), a.roleName(),
            a.mustChangePassword(), StaffAreas.home(a.role()));
    }

    /**
     * Kiểm tra tên đăng nhập + mật khẩu. Thành công trả tài khoản; thất bại ném lỗi với thông báo chung
     * "Sai tên đăng nhập hoặc mật khẩu" (không nói rõ sai ô nào để tránh dò tên tài khoản).
     * Trạng thái khóa / không có quyền chỉ được báo SAU KHI mật khẩu đúng, cùng lý do đó.
     */
    Account authenticate(LoginRequest body) {
        String username = body.username() == null ? "" : body.username().trim().toLowerCase();
        String password = body.password() == null ? "" : body.password();

        var v = new ValidationException.Collector();
        if (username.isEmpty()) v.add("username", "Vui lòng nhập tên đăng nhập");
        if (password.isEmpty()) v.add("password", "Vui lòng nhập mật khẩu");
        v.throwIfAny();

        long blocked = attempts.minutesBlocked(username);
        if (blocked > 0) {
            throw new BusinessException("Bạn đã nhập sai quá nhiều lần. Vui lòng thử lại sau " + blocked + " phút.",
                HttpStatus.TOO_MANY_REQUESTS);
        }

        Account account = findByUsername(username).orElse(null);
        boolean ok = encoder.matches(password, account != null ? account.passwordHash() : dummyHash) && account != null;
        if (!ok) {
            attempts.failed(username);
            throw new BusinessException("Sai tên đăng nhập hoặc mật khẩu.", HttpStatus.UNAUTHORIZED);
        }
        attempts.succeeded(username);

        if (!"active".equals(account.status())) {
            throw new BusinessException("Tài khoản đã bị khóa. Vui lòng liên hệ quản lý nhà hàng.", HttpStatus.FORBIDDEN);
        }
        if (!StaffAreas.canLogin(account.role())) {
            throw new BusinessException("Tài khoản " + account.roleName().toLowerCase()
                + " không có quyền truy cập hệ thống quản lý.", HttpStatus.FORBIDDEN);
        }
        return account;
    }

    /** Gọi sau khi đã đặt phiên đăng nhập (để nhật ký ghi đúng người). */
    @Transactional
    void recordLogin(Account account, boolean remember) {
        jdbc.sql("UPDATE users SET last_login_at = NOW() WHERE id = ?").param(account.id()).update();
        audit.log("auth", "Đăng nhập", remember ? "Có chọn ghi nhớ đăng nhập" : null, "users", account.id());
    }

    @Transactional
    Account changePassword(long userId, ChangePasswordRequest body) {
        Account account = findById(userId)
            .orElseThrow(() -> new BusinessException("Tài khoản không còn tồn tại.", HttpStatus.UNAUTHORIZED));
        String current = body.currentPassword() == null ? "" : body.currentPassword();
        String next = body.newPassword() == null ? "" : body.newPassword();
        String confirm = body.confirmPassword() == null ? "" : body.confirmPassword();

        var v = new ValidationException.Collector();
        if (current.isEmpty()) v.add("currentPassword", "Vui lòng nhập mật khẩu hiện tại");
        else if (!encoder.matches(current, account.passwordHash())) v.add("currentPassword", "Mật khẩu hiện tại không đúng");

        String pwError = Rules.passwordError(next);
        if (pwError != null) v.add("newPassword", pwError);
        else if (next.equals(current)) v.add("newPassword", "Mật khẩu mới phải khác mật khẩu hiện tại");

        if (confirm.isEmpty()) v.add("confirmPassword", "Vui lòng nhập lại mật khẩu mới");
        else if (!confirm.equals(next)) v.add("confirmPassword", "Mật khẩu nhập lại không khớp");
        v.throwIfAny();

        jdbc.sql("UPDATE users SET password_hash = ?, must_change_password = 0 WHERE id = ?")
            .params(encoder.encode(next), userId)
            .update();
        audit.log("auth", "Đổi mật khẩu", account.mustChangePassword() ? "Đổi mật khẩu bắt buộc lần đầu" : null,
            "users", userId);
        return findById(userId).orElseThrow();
    }
}
