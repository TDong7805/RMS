package com.rms.warehouse;

import com.rms.warehouse.DebtService.CancelInput;
import com.rms.warehouse.DebtService.DebtDetail;
import com.rms.warehouse.DebtService.DebtPage;
import com.rms.warehouse.DebtService.PaymentInput;
import com.rms.warehouse.DebtService.PaymentRow;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Công nợ nhà cung cấp:
 * GET   /api/kho/debts?keyword=&status=all|owing|clear&page=     (Quản lý kho)
 * GET   /api/kho/debts/{supplierId}
 * POST  /api/kho/payments              {purchaseOrderId, amount, method, paidDate, reference, note}
 * PATCH /api/kho/payments/{id}/cancel  {reason}
 * GET   /api/supplier-debts, /api/supplier-debts/{supplierId}     (Quản lý nhà hàng — chỉ xem)
 */
@RestController
public class DebtController {
    private final DebtService service;

    public DebtController(DebtService service) {
        this.service = service;
    }

    @GetMapping({"/api/kho/debts", "/api/supplier-debts"})
    public DebtPage list(@RequestParam(defaultValue = "") String keyword, @RequestParam(defaultValue = "all") String status,
                         @RequestParam(defaultValue = "1") int page) {
        return service.list(keyword, status, page);
    }

    @GetMapping({"/api/kho/debts/{supplierId}", "/api/supplier-debts/{supplierId}"})
    public DebtDetail detail(@PathVariable String supplierId) {
        return service.detail(supplierId);
    }

    @PostMapping("/api/kho/payments")
    public PaymentRow pay(@RequestBody PaymentInput in) {
        return service.pay(in);
    }

    @PatchMapping("/api/kho/payments/{id}/cancel")
    public PaymentRow cancel(@PathVariable String id, @RequestBody CancelInput in) {
        return service.cancel(id, in);
    }
}
