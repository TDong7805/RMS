package com.rms.website;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Chống gửi dồn dập từ trang công khai (không đăng nhập): mỗi IP tối đa {@value #MAX_PER_WINDOW} lần gửi đặt bàn trong
 * {@link #WINDOW}. Lưu trong bộ nhớ giống LoginAttemptService — khởi động lại backend thì bộ đếm về 0, đủ cho một nhà hàng.
 * IP lấy từ request.getRemoteAddr() (đã là IP thật khi chạy sau proxy tin cậy, xem server.forward-headers-strategy).
 */
@Component
public class PublicRateLimiter {
    static final int MAX_PER_WINDOW = 5;
    static final Duration WINDOW = Duration.ofMinutes(10);

    private final Map<String, Deque<Instant>> hits = new ConcurrentHashMap<>();

    /** Ghi nhận một lần gửi; trả số phút phải chờ (làm tròn lên) nếu đã vượt giới hạn, 0 nếu được phép. */
    public long tryAcquire(String key) {
        Instant now = Instant.now();
        Deque<Instant> q = hits.computeIfAbsent(key, k -> new ArrayDeque<>());
        synchronized (q) {
            while (!q.isEmpty() && q.peekFirst().isBefore(now.minus(WINDOW))) q.pollFirst();
            if (q.size() >= MAX_PER_WINDOW) {
                Duration left = Duration.between(now, q.peekFirst().plus(WINDOW));
                return Math.max(1, (left.toSeconds() + 59) / 60);
            }
            q.addLast(now);
            return 0;
        }
    }

    /** Dọn IP không còn lượt nào trong cửa sổ — tránh bộ nhớ tăng dần. */
    @Scheduled(fixedDelay = 15 * 60 * 1000)
    public void purge() {
        Instant limit = Instant.now().minus(WINDOW);
        hits.entrySet().removeIf(e -> {
            synchronized (e.getValue()) {
                return e.getValue().isEmpty() || e.getValue().peekLast().isBefore(limit);
            }
        });
    }
}
