package com.rms.common;

import com.rms.auth.AuthUser;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

/**
 * Người dùng đang thao tác, lấy từ phiên đăng nhập (com.rms.auth).
 * Mọi service gọi get() (vd. AuditService ghi nhật ký) nên không phải biết chi tiết đăng nhập.
 */
@Service
public class CurrentUserService {

    public record CurrentUser(long id, String username, String fullName, String role) {}

    public CurrentUser get() {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof AuthUser user) {
            return new CurrentUser(user.id(), user.username(), user.fullName(), user.role());
        }
        throw new BusinessException("Bạn chưa đăng nhập hoặc phiên đăng nhập đã hết hạn.", HttpStatus.UNAUTHORIZED);
    }
}
