package com.rms.ordering;

import com.rms.ordering.KitchenService.CancelInput;
import com.rms.ordering.KitchenService.IdsInput;
import com.rms.ordering.KitchenService.Queue;
import com.rms.ordering.KitchenService.SoldOutDish;
import com.rms.ordering.KitchenService.SoldOutInput;
import com.rms.ordering.OrderCore.OrderView;
import java.util.List;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

/**
 * Khu Bếp (vai trò kitchen):
 * GET   /api/bep/queue                     món Chờ / Đang chế biến + vừa xong (30 phút), số liệu đầu trang
 * POST  /api/bep/items/start               {ids} Chờ chế biến → Đang chế biến
 * POST  /api/bep/items/complete            {ids} → Đã xong
 * POST  /api/bep/items/{id}/undo           hoàn tác Hoàn thành (trong 30 phút, chưa mang ra)
 * POST  /api/bep/items/{id}/cancel         {reason: out_of_stock|bad_quality|other, note, markSoldOut}
 * GET   /api/bep/orders/{id}               chi tiết đơn của bàn
 * GET   /api/bep/dishes                    món đang bán + cờ tạm hết hôm nay
 * PATCH /api/bep/dishes/{id}/sold-out      {soldOut: true|false}
 * GET   /api/bep/stream                    SSE: báo khi có thay đổi
 */
@RestController
public class KitchenController {
    private final KitchenService service;
    private final LiveEvents live;

    public KitchenController(KitchenService service, LiveEvents live) {
        this.service = service;
        this.live = live;
    }

    @GetMapping("/api/bep/queue")
    public Queue queue() {
        return service.queue();
    }

    @PostMapping("/api/bep/items/start")
    public Queue start(@RequestBody IdsInput in) {
        return service.start(in);
    }

    @PostMapping("/api/bep/items/complete")
    public Queue complete(@RequestBody IdsInput in) {
        return service.complete(in);
    }

    @PostMapping("/api/bep/items/{id}/undo")
    public Queue undo(@PathVariable String id) {
        return service.undo(id);
    }

    @PostMapping("/api/bep/items/{id}/cancel")
    public Queue cancel(@PathVariable String id, @RequestBody CancelInput in) {
        return service.cancel(id, in);
    }

    @GetMapping("/api/bep/orders/{id}")
    public OrderView order(@PathVariable String id) {
        return service.order(id);
    }

    @GetMapping("/api/bep/dishes")
    public List<SoldOutDish> dishes() {
        return service.dishes();
    }

    @PatchMapping("/api/bep/dishes/{id}/sold-out")
    public SoldOutDish soldOut(@PathVariable String id, @RequestBody SoldOutInput in) {
        return service.setSoldOut(id, in);
    }

    @GetMapping(value = "/api/bep/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter stream() {
        return live.subscribe(LiveEvents.KITCHEN);
    }
}
