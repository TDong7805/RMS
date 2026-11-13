package com.rms.account;

import com.rms.audit.AuditService;
import com.rms.auth.StaffAreas;
import com.rms.common.BusinessException;
import com.rms.common.CurrentUserService;
import com.rms.common.Db;
import com.rms.common.Ids;
import com.rms.common.Paged;
import com.rms.common.Rules;
import com.rms.common.Times;
import com.rms.common.ValidationException;
import com.rms.common.Vi;
import com.rms.shift.ShiftService;
import java.security.SecureRandom;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * UC Quản lý tài khoản (Quản lý nhà hàng): xem, tìm/lọc, tạo, sửa, khóa/mở khóa, đặt lại mật khẩu, xóa.
 *
 * Quy tắc:
 *  - Không có đăng ký: tài khoản do quản lý tạo, có must_change_password = 1 → người dùng đổi mật khẩu lần đầu.
 *  - Không thao tác khóa / đặt lại mật khẩu / xóa / đổi vai trò / đổi tên đăng nhập trên chính mình
 *    (luôn còn ít nhất người đang thao tác là quản lý, không tự khóa mình ra ngoài).
 *  - Nhân viên phục vụ (waiter) không đăng nhập: không cần mật khẩu.
 *  - Xóa là xóa mềm (deleted_at) để giữ lịch sử ca làm, hóa đơn, nhật ký; tên đăng nhập và email được giải phóng;
 *    các ca làm việc từ hôm nay trở đi của người đó bị hủy.
 *  - Khóa / xóa / đổi vai trò / đặt lại mật khẩu có hiệu lực ngay: phiên đang mở của người đó bị hủy ở thao tác kế tiếp
 *    (com.rms.auth.ActiveUserFilter).
 */
@Service
public class AccountService {
    public static final int PAGE_SIZE = 10;

    public record Account(String id, String username, String fullName, String email, String phone, String role,
                          String status, boolean mustChangePassword, String createdAt, String lastLoginAt) {}

    public record AccountInput(String username, String fullName, String email, String phone, String role, String password) {}

    public record TempPassword(String password) {}

    private static final String SELECT = """
        SELECT u.id, u.username, u.full_name, u.email, u.phone, u.status, u.must_change_password,
               u.created_at, u.last_login_at, r.code AS role
        FROM users u JOIN roles r ON r.id = u.role_id
        WHERE u.deleted_at IS NULL
        """;

    private final JdbcClient jdbc;
    private final PasswordEncoder encoder;
    private final AuditService audit;
    private final CurrentUserService currentUser;
    private final SecureRandom random = new SecureRandom();
    private final ShiftService shifts;

    public AccountService(JdbcClient jdbc, PasswordEncoder encoder, AuditService audit, CurrentUserService currentUser,
                          ShiftService shifts) {
        this.shifts = shifts;
        this.jdbc = jdbc;
        this.encoder = encoder;
        this.audit = audit;
        this.currentUser = currentUser;
    }

    private Account map(ResultSet rs, int n) throws SQLException {
        String phone = rs.getString("phone");
        return new Account(Ids.str(rs.getLong("id")), rs.getString("username"), rs.getString("full_name"),
            rs.getString("email"), phone == null ? "" : phone, rs.getString("role"), rs.getString("status"),
            rs.getBoolean("must_change_password"), Times.iso(Db.dateTime(rs, "created_at")),
            Times.iso(Db.dateTime(rs, "last_login_at")));
    }

    public Paged<Account> list(String keyword, String role, String status, int page) {
        // Tìm không dấu ("tuan" khớp "Tuấn") làm ở Java cho đồng nhất với các danh sách khác.
        List<Account> all = jdbc.sql(SELECT + " ORDER BY u.created_at DESC, u.id DESC").query(this::map).list();
        String kw = Vi.trim(keyword);
        String phoneKw = kw.replaceAll("[\\s.]", "");
        List<Account> filtered = all.stream()
            .filter(a -> "all".equals(role) || Vi.blank(role) || a.role().equals(role))
            .filter(a -> "all".equals(status) || Vi.blank(status) || a.status().equals(status))
            .filter(a -> kw.isEmpty() || Vi.matches(a.username(), kw) || Vi.matches(a.fullName(), kw)
                || Vi.matches(a.email(), kw) || (!phoneKw.isEmpty() && a.phone().contains(phoneKw)))
            .toList();
        return Paged.of(filtered, page, PAGE_SIZE);
    }

    public Account get(String id) {
        return find(Ids.parse(id, notFoundMessage()));
    }

    private Account find(long id) {
        return jdbc.sql(SELECT + " AND u.id = ?").param(id).query(this::map).optional()
            .orElseThrow(() -> BusinessException.notFound(notFoundMessage()));
    }

    private static String notFoundMessage() {
        return "Tài khoản không tồn tại hoặc đã bị xóa";
    }

    @Transactional
    public Account create(AccountInput in) {
        Clean c = validate(in, null);
        boolean canLogin = StaffAreas.canLogin(c.role());
        String password = in.password() == null ? "" : in.password();
        if (canLogin) {
            String pwError = Rules.passwordError(password);
            if (pwError != null) throw new ValidationException("password", pwError.replace("mật khẩu mới", "mật khẩu khởi tạo"));
        }
        // Phục vụ không đăng nhập: lưu một mật khẩu ngẫu nhiên không ai biết (cột password_hash bắt buộc).
        String hash = encoder.encode(canLogin ? password : generatePassword() + generatePassword());

        jdbc.sql("""
                INSERT INTO users (username, password_hash, must_change_password, full_name, email, phone, role_id)
                VALUES (?, ?, ?, ?, ?, ?, (SELECT id FROM roles WHERE code = ?))
                """)
            .params(c.username(), hash, canLogin, c.fullName(), c.email(), c.phone(), c.role())
            .update();
        long id = jdbc.sql("SELECT LAST_INSERT_ID()").query(Long.class).single();
        audit.log("account", "Tạo tài khoản", "Tạo tài khoản " + c.username() + " – " + roleName(c.role()), "users", id);
        return find(id);
    }

    @Transactional
    public Account update(String idText, AccountInput in) {
        long id = Ids.parse(idText, notFoundMessage());
        Account current = find(id);
        Clean c = validate(in, id);
        if (isSelf(id)) {
            var v = new ValidationException.Collector();
            if (!c.role().equals(current.role())) v.add("role", "Không thể tự thay đổi vai trò của chính mình");
            if (!c.username().equals(current.username())) v.add("username", "Không thể tự đổi tên đăng nhập của chính mình");
            v.throwIfAny();
        }

        jdbc.sql("""
                UPDATE users SET username = ?, full_name = ?, email = ?, phone = ?,
                       role_id = (SELECT id FROM roles WHERE code = ?)
                WHERE id = ? AND deleted_at IS NULL
                """)
            .params(c.username(), c.fullName(), c.email(), c.phone(), c.role(), id)
            .update();

        List<String> changes = new ArrayList<>();
        if (!c.role().equals(current.role())) changes.add("vai trò: " + roleName(current.role()) + " → " + roleName(c.role()));
        if (!c.username().equals(current.username())) changes.add("tên đăng nhập: " + current.username() + " → " + c.username());
        audit.log("account", "Cập nhật tài khoản",
            "Cập nhật " + c.username() + (changes.isEmpty() ? "" : " (" + String.join("; ", changes) + ")"), "users", id);
        return find(id);
    }

    @Transactional
    public Account setStatus(String idText, String status) {
        long id = Ids.parse(idText, notFoundMessage());
        if (!"active".equals(status) && !"locked".equals(status)) {
            throw new ValidationException("status", "Trạng thái không hợp lệ");
        }
        Account current = find(id);
        boolean lock = "locked".equals(status);
        assertNotSelf(id, lock ? "khóa" : "mở khóa");
        if (current.status().equals(status)) return current;

        jdbc.sql("UPDATE users SET status = ? WHERE id = ?").params(status, id).update();
        audit.log("account", lock ? "Khóa tài khoản" : "Mở khóa tài khoản",
            (lock ? "Khóa" : "Mở khóa") + " tài khoản " + current.username(), "users", id);
        return find(id);
    }

    /** Tạo mật khẩu tạm (hiển thị một lần cho quản lý), buộc người dùng đổi ở lần đăng nhập kế tiếp. */
    @Transactional
    public TempPassword resetPassword(String idText) {
        long id = Ids.parse(idText, notFoundMessage());
        Account current = find(id);
        assertNotSelf(id, "đặt lại mật khẩu");
        if (!StaffAreas.canLogin(current.role())) {
            throw new BusinessException("Nhân viên phục vụ không đăng nhập hệ thống nên không cần mật khẩu.");
        }
        String temp = generatePassword();
        jdbc.sql("UPDATE users SET password_hash = ?, must_change_password = 1 WHERE id = ?")
            .params(encoder.encode(temp), id)
            .update();
        audit.log("account", "Đặt lại mật khẩu", "Đặt lại mật khẩu cho " + current.username(), "users", id);
        return new TempPassword(temp);
    }

    /**
     * Xóa mềm: giữ dòng để lịch sử (ca làm, hóa đơn, nhật ký) không bị mất. Tên đăng nhập/email được đổi thành
     * dạng "ten~12" (ký tự ~ không hợp lệ khi nhập) để người mới dùng lại được tên cũ.
     */
    @Transactional
    public void delete(String idText) {
        long id = Ids.parse(idText, notFoundMessage());
        Account current = find(id);
        assertNotSelf(id, "xóa");
        String suffix = "~" + id;
        jdbc.sql("""
                UPDATE users
                SET deleted_at = NOW(), status = 'locked',
                    username = CONCAT(LEFT(username, ? ), ?),
                    email = CONCAT(LEFT(email, ?), ?)
                WHERE id = ?
                """)
            .params(30 - suffix.length(), suffix, 150 - suffix.length(), suffix, id)
            .update();
        // Nhân viên nghỉ việc: hủy các ca từ hôm nay trở đi; lịch sử các ngày đã qua giữ nguyên.
        int removed = shifts.removeFutureAssignments(id);
        audit.log("account", "Xóa tài khoản", "Xóa tài khoản " + current.username() + " – " + current.fullName()
            + (removed > 0 ? " (hủy " + removed + " ca làm việc từ hôm nay)" : ""), "users", id);
    }

    // ------------------------------------------------------------------

    private record Clean(String username, String fullName, String email, String phone, String role) {}

    /** Kiểm tra theo đặc tả: trùng tên đăng nhập, email…; trả dữ liệu đã chuẩn hóa. */
    private Clean validate(AccountInput in, Long editingId) {
        String username = Vi.trim(in.username()).toLowerCase();
        String fullName = Vi.collapse(in.fullName());
        String email = Vi.trim(in.email()).toLowerCase();
        String phone = Vi.trim(in.phone()).replaceAll("[\\s.]", "");
        String role = Vi.trim(in.role());

        var v = new ValidationException.Collector();
        if (username.isEmpty()) v.add("username", "Vui lòng nhập tên đăng nhập");
        else if (!Rules.USERNAME.matcher(username).matches())
            v.add("username", "4–30 ký tự, chỉ gồm chữ thường không dấu, số, dấu chấm hoặc gạch dưới");
        else if (exists("username", username, editingId)) v.add("username", "Tên đăng nhập đã tồn tại");

        if (fullName.isEmpty()) v.add("fullName", "Vui lòng nhập họ tên");
        else if (fullName.length() > 100) v.add("fullName", "Họ tên tối đa 100 ký tự");

        if (email.isEmpty()) v.add("email", "Vui lòng nhập email");
        else if (email.length() > 150 || !Rules.EMAIL.matcher(email).matches()) v.add("email", "Email không đúng định dạng");
        else if (exists("email", email, editingId)) v.add("email", "Email đã được sử dụng cho tài khoản khác");

        if (!phone.isEmpty() && !Rules.PHONE.matcher(phone).matches())
            v.add("phone", "Số điện thoại không đúng định dạng (VD: 0912345678)");

        if (role.isEmpty() || roleName(role) == null) v.add("role", "Vui lòng phân vai trò cho tài khoản");
        v.throwIfAny();
        return new Clean(username, fullName, email, phone.isEmpty() ? null : phone, role);
    }

    private boolean exists(String column, String value, Long editingId) {
        // column chỉ nhận "username" / "email" từ code (không từ người dùng) nên ghép chuỗi an toàn.
        return jdbc.sql("SELECT COUNT(*) FROM users WHERE " + column + " = ? AND id <> ?")
            .params(value, editingId == null ? -1 : editingId)
            .query(Integer.class).single() > 0;
    }

    private String roleName(String code) {
        return jdbc.sql("SELECT name FROM roles WHERE code = ?").param(code).query(String.class).optional().orElse(null);
    }

    private boolean isSelf(long id) {
        return currentUser.get().id() == id;
    }

    private void assertNotSelf(long id, String action) {
        if (isSelf(id)) {
            throw new BusinessException("Không thể " + action + " tài khoản đang đăng nhập.", HttpStatus.CONFLICT);
        }
    }

    /** 10 ký tự: 8 chữ + 2 số, bỏ ký tự dễ nhầm (0/O, 1/l/I) để đọc cho nhân viên qua điện thoại không sai. */
    String generatePassword() {
        String letters = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz";
        String digits = "23456789";
        List<Character> chars = new ArrayList<>();
        for (int i = 0; i < 8; i++) chars.add(letters.charAt(random.nextInt(letters.length())));
        for (int i = 0; i < 2; i++) chars.add(digits.charAt(random.nextInt(digits.length())));
        Collections.shuffle(chars, random);
        StringBuilder sb = new StringBuilder();
        chars.forEach(sb::append);
        return sb.toString();
    }
}
