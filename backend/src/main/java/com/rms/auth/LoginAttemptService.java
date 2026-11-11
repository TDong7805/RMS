package com.rms.auth;

import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.stereotype.Service;

/**
 * Chống dò mật khẩu: sai quá {@value #MAX_FAILURES} lần liên tiếp với cùng một tên đăng nhập thì tạm chặn
 * {@link #LOCK_TIME} (không khóa hẳn tài khoản — việc khóa là của quản lý).
 * Lưu trong bộ nhớ: khởi động lại backend thì bộ đếm về 0, đủ dùng cho một nhà hàng.
 */
@Service
public class LoginAttemptService {
    static final int MAX_FAILURES = 5;
    static final Duration LOCK_TIME = Duration.ofMinutes(5);

    private record Attempt(int failures, Instant lockedUntil) {}

    private final Map<String, Attempt> attempts = new ConcurrentHashMap<>();

    /** Số phút còn bị chặn (làm tròn lên), 0 nếu không bị chặn. */
    public long minutesBlocked(String username) {
        Attempt a = attempts.get(username);
        if (a == null || a.lockedUntil() == null) return 0;
        Duration left = Duration.between(Instant.now(), a.lockedUntil());
        if (left.isNegative() || left.isZero()) {
            attempts.remove(username);
            return 0;
        }
        return Math.max(1, (left.toSeconds() + 59) / 60);
    }

    public void failed(String username) {
        attempts.compute(username, (k, a) -> {
            int failures = (a == null ? 0 : a.failures()) + 1;
            return failures >= MAX_FAILURES
                ? new Attempt(0, Instant.now().plus(LOCK_TIME))
                : new Attempt(failures, null);
        });
    }

    public void succeeded(String username) {
        attempts.remove(username);
    }
}
