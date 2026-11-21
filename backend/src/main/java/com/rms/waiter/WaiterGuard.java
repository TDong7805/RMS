package com.rms.waiter;

import com.rms.common.BusinessException;
import com.rms.common.CurrentUserService;
import com.rms.common.Times;
import com.rms.shift.DutyService;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

/**
 * Nhân viên phục vụ phải đã chấm công vào ca (và chưa tan ca) mới được thao tác: mở / đóng / chuyển / ghép bàn, gọi món hộ,
 * bưng món, nhận yêu cầu, xác nhận đơn (V22). Chưa vào ca vẫn xem được sơ đồ, thực đơn, ca làm.
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
            throw new BusinessException("Bạn cần vào ca (chấm công khuôn mặt) trước khi thao tác. Vào mục Tôi → Chấm công.",
                HttpStatus.CONFLICT);
        }
    }
}
