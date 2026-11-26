package com.rms.waiter;

import com.rms.ordering.CashierService;
import com.rms.ordering.CashierService.MoveInput;
import com.rms.ordering.CashierService.MoveTarget;
import com.rms.ordering.CashierService.OrderDetail;
import com.rms.ordering.LiveEvents;
import com.rms.ordering.OrderCore.OrderView;
import com.rms.ordering.QrOrderingService;
import com.rms.ordering.ServiceRequestService;
import com.rms.ordering.ServiceRequestService.Request;
import com.rms.ordering.ServiceRequestService.RequestList;
import com.rms.common.Ids;
import com.rms.waiter.WaiterService.WaiterFloor;
import java.util.List;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

/**
 * Khu Nhân viên phục vụ (vai trò waiter):
 * GET  /api/phuc-vu/floor                       sơ đồ bàn {floor, myAreaIds, dutyLabel} (không có doanh thu)
 * GET  /api/phuc-vu/orders/{id}                 chi tiết đơn của bàn
 * POST /api/phuc-vu/tables/{id}/open            {guests, reservationId} mở bàn
 * POST /api/phuc-vu/orders/{id}/close           đóng bàn chưa gọi món
 * POST /api/phuc-vu/orders/{id}/guests          {guests}
 * GET  /api/phuc-vu/move-targets                bàn trống chuyển tới được
 * POST /api/phuc-vu/orders/{id}/move            {tableId} chuyển bàn
 * GET  /api/phuc-vu/merge-targets               bàn đang có khách ghép vào được
 * POST /api/phuc-vu/orders/{id}/merge           {tableId} ghép bàn
 * GET  /api/phuc-vu/menu                        thực đơn (tra cứu / gọi món hộ)
 * POST /api/phuc-vu/tables/{id}/items           {items: [...]} gọi món hộ khách (như giỏ món của trang QR)
 * GET  /api/phuc-vu/requests?status             yêu cầu hỗ trợ của khách trong khu vực của mình (waiting | done | cancelled)
 * POST /api/phuc-vu/requests/{id}/accept        "Tôi đến"
 * POST /api/phuc-vu/requests/{id}/done
 * POST /api/phuc-vu/requests/{id}/cancel
 * GET  /api/phuc-vu/confirmations               bàn có món khách gửi đang chờ xác nhận (khu của mình / quá giờ)
 * POST /api/phuc-vu/orders/{id}/confirm         {rejects: [{itemId, reason}]} xác nhận đơn → bếp; món trong rejects bị bỏ
 * Không đòi chấm công vào ca (D15, 26/11/2026): khu phụ trách lấy theo lịch ca; món xong do bếp bấm "Đã mang đi".
 * GET  /api/phuc-vu/stream                      SSE: "change" khi có thay đổi, "layout" {areaId, areaName} khi quản lý sửa sơ đồ
 * Ca làm, chấm công, phiếu lương của mình: /api/toi/** (SelfController).
 */
@RestController
public class WaiterController {
    private final WaiterService service;
    private final CashierService cashier;
    private final QrOrderingService ordering;
    private final ServiceRequestService requests;
    private final LiveEvents live;
    private final ConfirmService confirms;

    public WaiterController(WaiterService service, CashierService cashier, QrOrderingService ordering,
                            ServiceRequestService requests, LiveEvents live, ConfirmService confirms) {
        this.confirms = confirms;
        this.service = service;
        this.cashier = cashier;
        this.ordering = ordering;
        this.requests = requests;
        this.live = live;
    }

    @GetMapping("/api/phuc-vu/floor")
    public WaiterFloor floor() {
        return service.floor();
    }

    @GetMapping("/api/phuc-vu/orders/{id}")
    public OrderDetail order(@PathVariable String id) {
        return cashier.order(id);
    }

    @PostMapping("/api/phuc-vu/tables/{id}/open")
    public OrderDetail openTable(@PathVariable String id, @RequestBody(required = false) CashierService.OpenInput in) {
        return cashier.openTable(id, in);
    }

    @PostMapping("/api/phuc-vu/orders/{id}/close")
    public OrderDetail closeTable(@PathVariable String id) {
        return cashier.closeTable(id);
    }

    @PostMapping("/api/phuc-vu/orders/{id}/guests")
    public OrderDetail setGuests(@PathVariable String id, @RequestBody CashierService.GuestsInput in) {
        return cashier.setGuests(id, in);
    }

    @GetMapping("/api/phuc-vu/move-targets")
    public List<MoveTarget> moveTargets() {
        return cashier.moveTargets();
    }

    @PostMapping("/api/phuc-vu/orders/{id}/move")
    public OrderDetail move(@PathVariable String id, @RequestBody MoveInput in) {
        return cashier.move(id, in);
    }

    @GetMapping("/api/phuc-vu/merge-targets")
    public List<MoveTarget> mergeTargets() {
        return cashier.mergeTargets();
    }

    @PostMapping("/api/phuc-vu/orders/{id}/merge")
    public OrderDetail merge(@PathVariable String id, @RequestBody MoveInput in) {
        return cashier.merge(id, in);
    }

    @GetMapping("/api/phuc-vu/menu")
    public QrOrderingService.Menu menu() {
        return ordering.menu();
    }

    @PostMapping("/api/phuc-vu/tables/{id}/items")
    public OrderView sendItems(@PathVariable String id, @RequestBody QrOrderingService.SendInput in) {
        return ordering.sendByStaff(Ids.parse(id, "Không tìm thấy bàn"), in);
    }


    @GetMapping("/api/phuc-vu/requests")
    public RequestList requests(@RequestParam(required = false) String status) {
        return requests.listForWaiter(status);
    }

    @PostMapping("/api/phuc-vu/requests/{id}/accept")
    public Request accept(@PathVariable String id) {
        return requests.accept(id);
    }

    @PostMapping("/api/phuc-vu/requests/{id}/done")
    public Request done(@PathVariable String id) {
        return requests.doneByWaiter(id);
    }

    @PostMapping("/api/phuc-vu/requests/{id}/cancel")
    public Request cancel(@PathVariable String id) {
        return requests.cancelByWaiter(id);
    }

    @GetMapping("/api/phuc-vu/confirmations")
    public ConfirmService.PendingList confirmations() {
        return confirms.list();
    }

    @PostMapping("/api/phuc-vu/orders/{id}/confirm")
    public OrderView confirm(@PathVariable String id, @RequestBody(required = false) ConfirmService.ConfirmInput in) {
        return confirms.confirm(id, in);
    }

    @GetMapping(value = "/api/phuc-vu/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter stream() {
        return live.subscribe(LiveEvents.WAITER);
    }
}
