package com.rms.ordering;

import com.rms.ordering.PaymentSettingsService.BankAccount;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

/**
 * Cấu hình hệ thống → Thanh toán (Quản lý nhà hàng):
 * GET /api/settings/payment   tài khoản nhận tiền
 * PUT /api/settings/payment   {bankBin, bankName, accountNo, accountName} — để trống cả ngân hàng và số tài khoản để xóa
 */
@RestController
public class PaymentSettingsController {
    private final PaymentSettingsService service;

    public PaymentSettingsController(PaymentSettingsService service) {
        this.service = service;
    }

    @GetMapping("/api/settings/payment")
    public BankAccount get() {
        return service.get();
    }

    @PutMapping("/api/settings/payment")
    public BankAccount update(@RequestBody BankAccount in) {
        return service.update(in);
    }
}
