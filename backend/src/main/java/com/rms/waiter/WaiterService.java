package com.rms.waiter;

import com.rms.common.CurrentUserService;
import com.rms.common.Ids;
import com.rms.common.Times;
import com.rms.ordering.CashierService;
import com.rms.ordering.CashierService.Floor;
import com.rms.shift.DutyService;
import java.util.List;
import org.springframework.stereotype.Service;

/**
 * Khu Nhân viên phục vụ: sơ đồ bàn theo khu vực trong ca. Các thao tác bàn (mở / đóng / chuyển / ghép, số khách) dùng chung
 * CashierService; gọi món hộ dùng QrOrderingService; yêu cầu hỗ trợ dùng ServiceRequestService.
 * Từ D15 (26/11/2026): không còn khóa "chưa vào ca" — ca lấy theo lịch phân công; bếp bấm "Đã mang đi" (phục vụ chỉ xem món xong).
 */
@Service
public class WaiterService {

    /**
     * onShift: giờ này có ca theo lịch. dutyLabel: ca đang diễn ra (có thể nhiều ca); nextLabel: ca kế tiếp khi chưa tới ca.
     * myAreaIds: khu của ca đang làm (mở sẵn tab). confirmCount: số bàn có món chờ xác nhận mà mình được xử lý.
     */
    public record WaiterFloor(Floor floor, List<String> myAreaIds, String dutyLabel, boolean onShift, String nextLabel,
                              int confirmCount) {}

    private final CashierService cashier;
    private final DutyService duty;
    private final CurrentUserService currentUser;
    private final ConfirmService confirms;

    public WaiterService(CashierService cashier, DutyService duty, CurrentUserService currentUser, ConfirmService confirms) {
        this.cashier = cashier;
        this.duty = duty;
        this.currentUser = currentUser;
        this.confirms = confirms;
    }

    private static String label(DutyService.Duty d) {
        return d.shiftName() + " " + Times.hhmm(d.start().toLocalTime()) + "–" + Times.hhmm(d.end().toLocalTime())
            + (d.areaName() == null ? "" : " · " + d.areaName());
    }

    public WaiterFloor floor() {
        long me = currentUser.get().id();
        var now = Times.now();
        List<DutyService.Duty> mine = duty.waitersOnDuty(now).stream().filter(d -> d.userId() == me).toList();
        List<String> areas = mine.stream().filter(d -> d.areaId() != null).map(d -> Ids.str(d.areaId())).distinct().toList();
        String current = mine.isEmpty() ? null : String.join(" + ", mine.stream().map(WaiterService::label).toList());
        String next = null;
        if (mine.isEmpty()) {
            var n = duty.next(me, now);
            if (n != null) next = (n.workDate().equals(now.toLocalDate()) ? "" : String.format("%02d/%02d", n.workDate().getDayOfMonth(), n.workDate().getMonthValue()) + " ") + label(n);
        }
        return new WaiterFloor(cashier.floor(true), areas, current, !mine.isEmpty(), next, confirms.list().count());
    }
}
