package com.rms.ordering;

import com.rms.ordering.CashierService.CancelInput;
import com.rms.ordering.CashierService.Floor;
import com.rms.ordering.CashierService.IdsInput;
import com.rms.ordering.CashierService.MoveInput;
import com.rms.ordering.CashierService.MoveTarget;
import com.rms.ordering.CashierService.OrderDetail;
import com.rms.ordering.CashierService.OrderList;
import com.rms.ordering.InvoiceService.Invoice;
import com.rms.ordering.InvoiceService.PayInput;
import com.rms.ordering.InvoiceService.Preview;
import com.rms.ordering.ServiceRequestService.Request;
import com.rms.ordering.ServiceRequestService.RequestList;
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
 * Khu Thu ngân (vai trò cashier):
 * GET  /api/thu-ngan/floor                      sơ đồ bàn, món chờ mang ra, số liệu đầu trang
 * GET  /api/thu-ngan/orders?keyword&status&from&to   tra cứu đơn (tối đa 31 ngày)
 * GET  /api/thu-ngan/orders/{id}                chi tiết đơn {order, closedAt, requests, invoice}
 * POST /api/thu-ngan/items/{id}/cancel          {reason, note} hủy món Chờ chế biến
 * POST /api/thu-ngan/orders/{id}/cancel         {reason, note} hủy đơn
 * GET  /api/thu-ngan/move-targets               bàn đích chuyển được
 * POST /api/thu-ngan/orders/{id}/move           {tableId} chuyển bàn
 * GET  /api/thu-ngan/orders/{id}/invoice-preview  xem trước hóa đơn
 * POST /api/thu-ngan/orders/{id}/invoice        {vatCompany, vatTaxCode} lập hóa đơn
 * GET  /api/thu-ngan/invoices?keyword&status&method&from&to   danh sách hóa đơn
 * GET  /api/thu-ngan/invoices/{id}              chi tiết hóa đơn (kèm mã QR chuyển khoản nếu chưa thanh toán)
 * POST /api/thu-ngan/invoices/{id}/pay          {payments: [{method, amount, cashGiven, transactionRef}]}
 * POST /api/thu-ngan/invoices/{id}/cancel       {reason} hủy hóa đơn chưa thanh toán
 * GET  /api/thu-ngan/requests?status            yêu cầu của khách (waiting | done | cancelled)
 * POST /api/thu-ngan/requests/{id}/forward      Đã báo nhân viên (bộ đàm)
 * POST /api/thu-ngan/requests/{id}/done
 * POST /api/thu-ngan/requests/{id}/cancel
 * GET  /api/thu-ngan/stream                     SSE: báo khi có thay đổi
 */
@RestController
public class CashierController {
    private final CashierService service;
    private final InvoiceService invoices;
    private final ServiceRequestService requests;
    private final LiveEvents live;

    public CashierController(CashierService service, InvoiceService invoices, ServiceRequestService requests, LiveEvents live) {
        this.service = service;
        this.invoices = invoices;
        this.requests = requests;
        this.live = live;
    }

    @GetMapping("/api/thu-ngan/floor")
    public Floor floor() {
        return service.floor();
    }

    @GetMapping("/api/thu-ngan/orders")
    public OrderList orders(@RequestParam(required = false) String keyword, @RequestParam(required = false) String status,
                            @RequestParam(required = false) String from, @RequestParam(required = false) String to) {
        return service.orders(keyword, status, from, to);
    }

    @GetMapping("/api/thu-ngan/orders/{id}")
    public OrderDetail order(@PathVariable String id) {
        return service.order(id);
    }

    @PostMapping("/api/thu-ngan/items/{id}/cancel")
    public OrderDetail cancelItem(@PathVariable String id, @RequestBody CancelInput in) {
        return service.cancelItem(id, in);
    }

    @PostMapping("/api/thu-ngan/tables/{id}/open")
    public OrderDetail openTable(@PathVariable String id, @RequestBody(required = false) CashierService.OpenInput in) {
        return service.openTable(id, in);
    }

    @PostMapping("/api/thu-ngan/orders/{id}/close")
    public OrderDetail closeTable(@PathVariable String id) {
        return service.closeTable(id);
    }

    @PostMapping("/api/thu-ngan/orders/{id}/cancel")
    public OrderDetail cancelOrder(@PathVariable String id, @RequestBody CancelInput in) {
        return service.cancelOrder(id, in);
    }

    @GetMapping("/api/thu-ngan/move-targets")
    public List<MoveTarget> moveTargets() {
        return service.moveTargets();
    }

    @PostMapping("/api/thu-ngan/orders/{id}/guests")
    public OrderDetail setGuests(@PathVariable String id, @RequestBody CashierService.GuestsInput in) {
        return service.setGuests(id, in);
    }

    @PostMapping("/api/thu-ngan/orders/{id}/move")
    public OrderDetail move(@PathVariable String id, @RequestBody MoveInput in) {
        return service.move(id, in);
    }

    @GetMapping("/api/thu-ngan/orders/{id}/invoice-preview")
    public Preview preview(@PathVariable String id) {
        return invoices.preview(id);
    }

    @PostMapping("/api/thu-ngan/orders/{id}/invoice")
    public Invoice createInvoice(@PathVariable String id, @RequestBody InvoiceService.CreateInput in) {
        return invoices.create(id, in);
    }

    @GetMapping("/api/thu-ngan/invoices")
    public InvoiceService.ListResponse invoices(@RequestParam(required = false) String keyword,
                                                @RequestParam(required = false) String status,
                                                @RequestParam(required = false) String method,
                                                @RequestParam(required = false) String from,
                                                @RequestParam(required = false) String to) {
        return invoices.list(keyword, status, method, from, to);
    }

    @GetMapping("/api/thu-ngan/invoices/{id}")
    public Invoice invoice(@PathVariable String id) {
        return invoices.get(id);
    }

    @PostMapping("/api/thu-ngan/invoices/{id}/pay")
    public Invoice pay(@PathVariable String id, @RequestBody PayInput in) {
        return invoices.pay(id, in);
    }

    @PostMapping("/api/thu-ngan/invoices/{id}/cancel")
    public Invoice cancelInvoice(@PathVariable String id, @RequestBody InvoiceService.CancelInput in) {
        return invoices.cancel(id, in);
    }

    @GetMapping("/api/thu-ngan/requests")
    public RequestList requests(@RequestParam(required = false) String status) {
        return requests.list(status);
    }

    @PostMapping("/api/thu-ngan/requests/{id}/forward")
    public Request forward(@PathVariable String id) {
        return requests.forward(id);
    }

    @PostMapping("/api/thu-ngan/requests/{id}/done")
    public Request done(@PathVariable String id) {
        return requests.done(id);
    }

    @PostMapping("/api/thu-ngan/requests/{id}/cancel")
    public Request cancelRequest(@PathVariable String id) {
        return requests.cancel(id);
    }

    @GetMapping(value = "/api/thu-ngan/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter stream() {
        return live.subscribe(LiveEvents.CASHIER);
    }
}
