package com.rms.auth;

import com.rms.audit.AuditService;
import com.rms.common.BusinessException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.time.Duration;
import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * POST /api/auth/login            đăng nhập (body: username, password, remember)
 * GET  /api/auth/me               người đang đăng nhập (401 nếu chưa đăng nhập)
 * POST /api/auth/change-password  đổi mật khẩu (bắt buộc ở lần đăng nhập đầu / sau khi được đặt lại)
 * POST /api/auth/logout           đăng xuất
 */
@RestController
@RequestMapping("/api/auth")
public class AuthController {
    /** "Ghi nhớ đăng nhập": giữ phiên 7 ngày kể cả khi đóng trình duyệt. Không chọn: hết khi đóng trình duyệt hoặc sau 2 giờ không thao tác. */
    static final Duration REMEMBER = Duration.ofDays(7);

    private final AuthService auth;
    private final AuditService audit;
    private final SecurityContextRepository contextRepository;
    private final String cookieName;

    public AuthController(AuthService auth, AuditService audit, SecurityContextRepository contextRepository,
                          @Value("${server.servlet.session.cookie.name:JSESSIONID}") String cookieName) {
        this.auth = auth;
        this.audit = audit;
        this.contextRepository = contextRepository;
        this.cookieName = cookieName;
    }

    @PostMapping("/login")
    public AuthService.Me login(@RequestBody AuthService.LoginRequest body, HttpServletRequest req, HttpServletResponse res) {
        AuthService.Account account = auth.authenticate(body);

        // Chống chiếm phiên (session fixation): luôn cấp phiên mới sau khi đăng nhập.
        var old = req.getSession(false);
        if (old != null) old.invalidate();
        var session = req.getSession(true);

        signIn(account, req, res);

        boolean remember = Boolean.TRUE.equals(body.remember());
        if (remember) {
            session.setMaxInactiveInterval((int) REMEMBER.toSeconds());
            // Cookie phiên mặc định mất khi đóng trình duyệt; gửi lại cùng tên kèm Max-Age để giữ 7 ngày.
            res.addHeader(HttpHeaders.SET_COOKIE, ResponseCookie.from(cookieName, session.getId())
                .path("/").httpOnly(true).sameSite("Lax").maxAge(REMEMBER).build().toString());
        }
        auth.recordLogin(account, remember);
        return auth.toMe(account);
    }

    @GetMapping("/me")
    public AuthService.Me me() {
        return auth.toMe(auth.findById(currentUser().id())
            .orElseThrow(() -> new BusinessException("Tài khoản không còn tồn tại.", HttpStatus.UNAUTHORIZED)));
    }

    @PostMapping("/change-password")
    public AuthService.Me changePassword(@RequestBody AuthService.ChangePasswordRequest body,
                                         HttpServletRequest req, HttpServletResponse res) {
        AuthService.Account account = auth.changePassword(currentUser().id(), body);
        // Đổi xong: nâng từ quyền tạm PASSWORD_CHANGE_REQUIRED lên quyền thật của vai trò, không cần đăng nhập lại.
        signIn(account, req, res);
        return auth.toMe(account);
    }

    @PostMapping("/logout")
    public ResponseEntity<Void> logout(HttpServletRequest req) {
        audit.log("auth", "Đăng xuất", null);
        var session = req.getSession(false);
        if (session != null) session.invalidate();
        SecurityContextHolder.clearContext();
        return ResponseEntity.noContent()
            .header(HttpHeaders.SET_COOKIE, ResponseCookie.from(cookieName, "").path("/").httpOnly(true)
                .sameSite("Lax").maxAge(0).build().toString())
            .build();
    }

    private void signIn(AuthService.Account account, HttpServletRequest req, HttpServletResponse res) {
        var principal = new AuthUser(account.id(), account.username(), account.fullName(), account.role());
        var authority = account.mustChangePassword()
            ? StaffAreas.PASSWORD_CHANGE_REQUIRED
            : StaffAreas.authority(account.role());
        var token = UsernamePasswordAuthenticationToken.authenticated(principal, null,
            List.of(new SimpleGrantedAuthority(authority)));
        var context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(token);
        SecurityContextHolder.setContext(context);
        contextRepository.saveContext(context, req, res);
    }

    private static AuthUser currentUser() {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof AuthUser user) return user;
        throw new BusinessException("Bạn chưa đăng nhập hoặc phiên đăng nhập đã hết hạn.", HttpStatus.UNAUTHORIZED);
    }
}
