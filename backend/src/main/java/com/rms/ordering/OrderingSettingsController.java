package com.rms.ordering;

import com.rms.audit.AuditService;
import com.rms.common.CurrentUserService;
import com.rms.common.SystemSettings;
import com.rms.common.ValidationException;
import com.rms.waiter.ConfirmService;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

/**
 * Cấu hình hệ thống → Gọi món tại bàn (Quản lý nhà hàng):
 * GET /api/settings/ordering   {openTableTimeoutMinutes, requireConfirm, confirmRemindMinutes}
 * PUT /api/settings/ordering   — openTableTimeoutMinutes: 0 = không tự đóng bàn, tối đa 240 phút;
 *                                requireConfirm: món khách gửi phải được phục vụ xác nhận (V22, bỏ trống = giữ nguyên);
 *                                confirmRemindMinutes: 1–60 phút chờ trước khi nhắc lại cho mọi phục vụ đã vào ca.
 */
@RestController
public class OrderingSettingsController {
    public record OrderingSettings(Integer openTableTimeoutMinutes, Boolean requireConfirm, Integer confirmRemindMinutes) {}

    private final CashierService cashier;
    private final QrOrderingService ordering;
    private final ConfirmService confirms;
    private final SystemSettings settings;
    private final AuditService audit;
    private final CurrentUserService currentUser;

    public OrderingSettingsController(CashierService cashier, QrOrderingService ordering, ConfirmService confirms, SystemSettings settings,
                                      AuditService audit, CurrentUserService currentUser) {
        this.cashier = cashier;
        this.ordering = ordering;
        this.confirms = confirms;
        this.settings = settings;
        this.audit = audit;
        this.currentUser = currentUser;
    }

    @GetMapping("/api/settings/ordering")
    public OrderingSettings get() {
        return new OrderingSettings(cashier.openTimeoutMinutes(), ordering.requireConfirm(), confirms.remindMinutes());
    }

    @PutMapping("/api/settings/ordering")
    @Transactional
    public OrderingSettings update(@RequestBody OrderingSettings in) {
        Integer m = in == null ? null : in.openTableTimeoutMinutes();
        Integer remind = in == null ? null : in.confirmRemindMinutes();
        var v = new ValidationException.Collector();
        if (m == null || m < 0 || m > 240) v.add("openTableTimeoutMinutes", "Nhập từ 0 đến 240 phút (0 = không tự đóng)");
        if (remind != null && (remind < 1 || remind > 60)) v.add("confirmRemindMinutes", "Nhập từ 1 đến 60 phút");
        v.throwIfAny();
        long me = currentUser.get().id();
        settings.put(CashierService.OPEN_TIMEOUT_KEY, String.valueOf(m), "number", me);
        if (in.requireConfirm() != null) settings.put(QrOrderingService.REQUIRE_CONFIRM_KEY, String.valueOf(in.requireConfirm()), "boolean", me);
        if (remind != null) settings.put(ConfirmService.REMIND_KEY, String.valueOf(remind), "number", me);
        OrderingSettings now = get();
        audit.log("settings", "Cập nhật gọi món tại bàn", (m == 0 ? "Tắt tự đóng bàn" : "Tự đóng bàn sau " + m + " phút chưa gọi món")
            + " · " + (now.requireConfirm() ? "phục vụ xác nhận đơn, nhắc sau " + now.confirmRemindMinutes() + " phút" : "không cần xác nhận đơn"));
        return now;
    }
}
