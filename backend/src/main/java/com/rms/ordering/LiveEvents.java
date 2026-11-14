package com.rms.ordering;

import java.io.IOException;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArraySet;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

/**
 * Đẩy "có thay đổi" tới màn hình đang mở qua Server-Sent Events (một chiều, máy chủ → trình duyệt).
 *
 * Kênh: "kitchen" (màn hình bếp), "cashier" (khu thu ngân), "table:{id}" (trang đặt món của một bàn).
 * Sự kiện chỉ báo kênh nào đổi; trình duyệt tự tải lại dữ liệu qua API thường, nên không lộ dữ liệu qua kênh
 * và không lo lệch trạng thái. Sự kiện phát SAU KHI giao dịch commit để màn hình không đọc phải dữ liệu cũ.
 * Mất kết nối thì EventSource ở trình duyệt tự nối lại; giao diện còn tự làm mới định kỳ làm dự phòng.
 */
@Component
public class LiveEvents {
    private static final Logger log = LoggerFactory.getLogger(LiveEvents.class);
    /** Mỗi kết nối sống tối đa 30 phút rồi trình duyệt tự nối lại (tránh kết nối treo). */
    private static final long TIMEOUT_MS = 30 * 60 * 1000L;

    public static final String KITCHEN = "kitchen";
    public static final String CASHIER = "cashier";

    public static String table(long tableId) {
        return "table:" + tableId;
    }

    private final Map<String, Set<SseEmitter>> channels = new ConcurrentHashMap<>();

    public SseEmitter subscribe(String channel) {
        SseEmitter emitter = new SseEmitter(TIMEOUT_MS);
        Set<SseEmitter> set = channels.computeIfAbsent(channel, k -> new CopyOnWriteArraySet<>());
        set.add(emitter);
        Runnable remove = () -> set.remove(emitter);
        emitter.onCompletion(remove);
        emitter.onTimeout(remove);
        emitter.onError(e -> remove.run());
        try {
            emitter.send(SseEmitter.event().name("ready").data(channel));
        } catch (IOException e) {
            remove.run();
        }
        return emitter;
    }

    /** Báo các kênh có thay đổi (sau khi giao dịch hiện tại commit; không có giao dịch thì gửi ngay). */
    public void publish(String... names) {
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    send(names);
                }
            });
        } else {
            send(names);
        }
    }

    private void send(String... names) {
        for (String name : names) {
            Set<SseEmitter> set = channels.get(name);
            if (set == null) continue;
            for (SseEmitter e : set) {
                try {
                    e.send(SseEmitter.event().name("change").data(name));
                } catch (IOException | IllegalStateException ex) {
                    set.remove(e);
                }
            }
        }
    }

    /** Nhịp giữ kết nối (một số proxy cắt kết nối im lặng lâu) và dọn kết nối chết. */
    @Scheduled(fixedRate = 25_000)
    public void heartbeat() {
        channels.forEach((name, set) -> {
            for (SseEmitter e : set) {
                try {
                    e.send(SseEmitter.event().comment("ping"));
                } catch (IOException | IllegalStateException ex) {
                    set.remove(e);
                }
            }
        });
        log.trace("SSE channels: {}", channels.keySet());
    }
}
