package com.rms.waiter;

import com.rms.common.BusinessException;
import com.rms.common.CurrentUserService;
import com.rms.common.Times;
import com.rms.shift.DutyService;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

/**
 * Nhân viên phục vụ phải đã chấm công vào ca (và chưa tan ca) mới được thao tác: mở / đóng / chuyển / ghép bàn, số khách,
 * gọi món hộ, nhận / xong / hủy yêu cầu, xác nhận đơn. Chưa vào ca vẫn xem được sơ đồ, thực đơn, yêu cầu.
 * (V22; bỏ ở D15 26/11, dùng lại 27/11/2026 để không làm được từ nhà — vào ca phải quét mặt trong WiFi quán.)
 */
@Component
public class WaiterGuard {
    private final DutyService duty;
    private final CurrentUserService currentUser;

    public WaiterGuard(DutyService duty, CurrentUserService currentUser) {
        this.duty = duty;
        this.currentUser = currentUser;
    }

    public void requireOnDuty() {
        if (!duty.isOnDuty(currentUser.get().id(), Times.now())) {
            throw new BusinessException("Bạn cần chấm công vào ca trước khi thao tác. Bấm \"Chấm công\" ở đầu trang.",
                HttpStatus.CONFLICT);
        }
    }
}
