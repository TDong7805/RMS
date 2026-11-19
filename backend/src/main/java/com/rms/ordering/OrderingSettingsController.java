package com.rms.ordering;

import com.rms.audit.AuditService;
import com.rms.common.CurrentUserService;
import com.rms.common.ValidationException;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

/**
 * Cấu hình hệ thống → Gọi món tại bàn (Quản lý nhà hàng):
 * GET /api/settings/ordering   {openTableTimeoutMinutes}
 * PUT /api/settings/ordering   {openTableTimeoutMinutes} — 0 = không tự đóng bàn, tối đa 240 phút
 */
@RestController
public class OrderingSettingsController {
    public record OrderingSettings(Integer openTableTimeoutMinutes) {}

    private final JdbcClient jdbc;
    private final CashierService cashier;
    private final AuditService audit;
    private final CurrentUserService currentUser;

    public OrderingSettingsController(JdbcClient jdbc, CashierService cashier, AuditService audit, CurrentUserService currentUser) {
        this.jdbc = jdbc;
        this.cashier = cashier;
        this.audit = audit;
        this.currentUser = currentUser;
    }

    @GetMapping("/api/settings/ordering")
    public OrderingSettings get() {
        return new OrderingSettings(cashier.openTimeoutMinutes());
    }

    @PutMapping("/api/settings/ordering")
    @Transactional
    public OrderingSettings update(@RequestBody OrderingSettings in) {
        Integer m = in == null ? null : in.openTableTimeoutMinutes();
        if (m == null || m < 0 || m > 240) throw new ValidationException("openTableTimeoutMinutes", "Nhập từ 0 đến 240 phút (0 = không tự đóng)");
        jdbc.sql("""
                INSERT INTO system_settings (setting_key, setting_value, value_type, updated_by) VALUES (?, ?, 'number', ?)
                ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_by = VALUES(updated_by)
                """).params(CashierService.OPEN_TIMEOUT_KEY, String.valueOf(m), currentUser.get().id()).update();
        audit.log("settings", "Cập nhật gọi món tại bàn", m == 0 ? "Tắt tự đóng bàn" : "Tự đóng bàn sau " + m + " phút chưa gọi món");
        return get();
    }
}
