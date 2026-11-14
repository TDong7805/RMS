package com.rms.ordering;

import com.rms.ordering.CashierService.Floor;
import com.rms.ordering.CashierService.IdsInput;
import com.rms.ordering.OrderCore.OrderView;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

/**
 * Khu Thu ngân (vai trò cashier), đợt 1:
 * GET  /api/thu-ngan/floor           sơ đồ bàn: bàn, đơn đang mở, lịch đặt hôm nay, món chờ mang ra, số liệu đầu trang
 * GET  /api/thu-ngan/orders/{id}     chi tiết đơn
 * POST /api/thu-ngan/items/serve     {ids} món Đã xong → Đã mang ra
 * GET  /api/thu-ngan/stream          SSE: báo khi có thay đổi
 */
@RestController
public class CashierController {
    private final CashierService service;
    private final LiveEvents live;

    public CashierController(CashierService service, LiveEvents live) {
        this.service = service;
        this.live = live;
    }

    @GetMapping("/api/thu-ngan/floor")
    public Floor floor() {
        return service.floor();
    }

    @GetMapping("/api/thu-ngan/orders/{id}")
    public OrderView order(@PathVariable String id) {
        return service.order(id);
    }

    @PostMapping("/api/thu-ngan/items/serve")
    public OrderView serve(@RequestBody IdsInput in) {
        return service.serve(in);
    }

    @GetMapping(value = "/api/thu-ngan/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter stream() {
        return live.subscribe(LiveEvents.CASHIER);
    }
}
