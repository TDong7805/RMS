package com.rms.ordering;

import com.rms.ordering.OrderCore.OrderView;
import com.rms.ordering.QrOrderingService.Menu;
import com.rms.ordering.QrOrderingService.SendInput;
import com.rms.ordering.QrOrderingService.TableInfo;
import java.util.Collections;
import java.util.Map;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

/**
 * Trang đặt món của khách — API CÔNG KHAI (không đăng nhập), nhận diện bàn bằng mã QR:
 * GET  /api/public/qr/{token}                     thông tin bàn, nhà hàng, đang trong giờ phục vụ, đơn đang mở (nếu có)
 * GET  /api/public/qr/{token}/menu                thực đơn (món đang bán, cờ tạm hết)
 * GET  /api/public/qr/{token}/order               {order: đơn đang mở | null}
 * POST /api/public/qr/{token}/orders              gửi giỏ món {items: [{dishId, qty, note}]}
 * POST /api/public/qr/{token}/items/{id}/cancel   hủy món còn Chờ chế biến
 * POST /api/public/qr/{token}/requests          gọi nhân viên {type: support|consult|other, content}
 * POST /api/public/qr/{token}/payment-request   yêu cầu thanh toán {method: cash|card|transfer, vatCompany, vatTaxCode}
 * POST /api/public/qr/{token}/requests/{id}/cancel  khách hủy yêu cầu còn Mới
 * GET  /api/public/qr/{token}/stream             SSE: báo khi đơn của bàn thay đổi
 */
@RestController
public class QrOrderingController {
    private final QrOrderingService service;
    private final LiveEvents live;

    public QrOrderingController(QrOrderingService service, LiveEvents live) {
        this.service = service;
        this.live = live;
    }

    @GetMapping("/api/public/qr/{token}")
    public TableInfo info(@PathVariable String token) {
        return service.info(token);
    }

    @GetMapping("/api/public/qr/{token}/menu")
    public Menu menu(@PathVariable String token) {
        return service.menu(token);
    }

    @GetMapping("/api/public/qr/{token}/order")
    public Map<String, OrderView> order(@PathVariable String token) {
        return Collections.singletonMap("order", service.currentOrder(token));
    }

    @PostMapping("/api/public/qr/{token}/orders")
    public OrderView send(@PathVariable String token, @RequestBody SendInput in) {
        return service.send(token, in);
    }

    @PostMapping("/api/public/qr/{token}/items/{id}/cancel")
    public OrderView cancel(@PathVariable String token, @PathVariable String id) {
        return service.cancelItem(token, id);
    }

    @PostMapping("/api/public/qr/{token}/requests")
    public TableInfo callStaff(@PathVariable String token, @RequestBody ServiceRequestService.SupportInput in) {
        return service.callStaff(token, in);
    }

    @PostMapping("/api/public/qr/{token}/payment-request")
    public TableInfo requestPayment(@PathVariable String token, @RequestBody ServiceRequestService.PaymentInput in) {
        return service.requestPayment(token, in);
    }

    @PostMapping("/api/public/qr/{token}/requests/{id}/cancel")
    public TableInfo cancelRequest(@PathVariable String token, @PathVariable String id) {
        return service.cancelRequest(token, id);
    }

    @GetMapping(value = "/api/public/qr/{token}/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter stream(@PathVariable String token) {
        return live.subscribe(LiveEvents.table(service.table(token).id()));
    }
}
