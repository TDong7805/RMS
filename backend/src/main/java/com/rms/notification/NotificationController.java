package com.rms.notification;

import com.rms.notification.NotificationService.Item;
import com.rms.notification.NotificationService.ListResponse;
import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

/**
 * Thông báo của tài khoản đang đăng nhập (mọi vai trò nội bộ):
 * GET   /api/notifications                {items, unreadCount, total} — mới nhất trước, trong 30 ngày
 * GET   /api/notifications/unread-count   {count}
 * PATCH /api/notifications/{id}/read      đánh dấu một thông báo đã đọc
 * PATCH /api/notifications/read-all       {affected}
 */
@RestController
public class NotificationController {
    private final NotificationService service;

    public NotificationController(NotificationService service) {
        this.service = service;
    }

    @GetMapping("/api/notifications")
    public ListResponse list() {
        return service.list();
    }

    @GetMapping("/api/notifications/unread-count")
    public Map<String, Integer> unread() {
        return Map.of("count", service.unreadCount());
    }

    @PatchMapping("/api/notifications/read-all")
    public Map<String, Integer> readAll() {
        return Map.of("affected", service.markAllRead());
    }

    @PatchMapping("/api/notifications/{id}/read")
    public Item read(@PathVariable String id) {
        return service.markRead(id);
    }
}
