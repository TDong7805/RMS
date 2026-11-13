package com.rms.warehouse;

import com.rms.warehouse.ReceiptService.CancelInput;
import com.rms.warehouse.ReceiptService.DirectInput;
import com.rms.warehouse.ReceiptService.ReceiptDetail;
import com.rms.warehouse.ReceiptService.ReceiptPage;
import com.rms.warehouse.ReceiptService.ReceiveInput;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Nhập kho (Quản lý kho):
 * GET   /api/kho/receipts?keyword=&kind=all|po|direct|opening&from=&to=&page=   mặc định 30 ngày, tối đa 366 ngày
 * GET   /api/kho/receipts/{id}                              chi tiết + có hủy được không (kèm lý do nếu không)
 * POST  /api/kho/purchase-orders/{id}/receipts              nhận hàng theo phiếu mua {lines: [{purchaseOrderItemId, qty, note}], note}
 * POST  /api/kho/receipts/direct                            nhập không phiếu {supplierId | sourceName, note, lines: [{ingredientId, unit, qty, unitPrice}]}
 * PATCH /api/kho/receipts/{id}/cancel                       {reason} — hủy phiếu nhập vừa lập
 */
@RestController
public class ReceiptController {
    private final ReceiptService service;

    public ReceiptController(ReceiptService service) {
        this.service = service;
    }

    @GetMapping("/api/kho/receipts")
    public ReceiptPage list(@RequestParam(defaultValue = "") String keyword, @RequestParam(defaultValue = "all") String kind,
                            @RequestParam(defaultValue = "") String from, @RequestParam(defaultValue = "") String to,
                            @RequestParam(defaultValue = "1") int page) {
        return service.list(keyword, kind, from, to, page);
    }

    @GetMapping("/api/kho/receipts/{id}")
    public ReceiptDetail detail(@PathVariable String id) {
        return service.detail(id);
    }

    @PostMapping("/api/kho/purchase-orders/{id}/receipts")
    public ReceiptDetail receive(@PathVariable String id, @RequestBody ReceiveInput in) {
        return service.receive(id, in);
    }

    @PostMapping("/api/kho/receipts/direct")
    public ReceiptDetail direct(@RequestBody DirectInput in) {
        return service.direct(in);
    }

    @PatchMapping("/api/kho/receipts/{id}/cancel")
    public ReceiptDetail cancel(@PathVariable String id, @RequestBody CancelInput in) {
        return service.cancel(id, in);
    }
}
