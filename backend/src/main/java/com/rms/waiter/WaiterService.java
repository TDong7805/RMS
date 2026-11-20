package com.rms.waiter;

import com.rms.common.BusinessException;
import com.rms.common.CurrentUserService;
import com.rms.common.Ids;
import com.rms.common.Times;
import com.rms.ordering.CashierService;
import com.rms.ordering.CashierService.Floor;
import com.rms.ordering.LiveEvents;
import com.rms.shift.DutyService;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Khu Nhân viên phục vụ: sơ đồ bàn theo khu vực trong ca, bưng món đã xong. Các thao tác bàn (mở / đóng / chuyển / ghép,
 * số khách) dùng chung CashierService; gọi món hộ dùng QrOrderingService; yêu cầu hỗ trợ dùng ServiceRequestService.
 */
@Service
public class WaiterService {

    /** myAreaIds: khu được gán trong ca hiện tại (mở sẵn tab); trống = chưa gán khu / ngoài ca. */
    public record WaiterFloor(Floor floor, List<String> myAreaIds, String dutyLabel) {}

    public record IdsInput(List<String> ids) {}

    private final JdbcClient jdbc;
    private final CashierService cashier;
    private final DutyService duty;
    private final CurrentUserService currentUser;
    private final LiveEvents live;

    public WaiterService(JdbcClient jdbc, CashierService cashier, DutyService duty, CurrentUserService currentUser, LiveEvents live) {
        this.jdbc = jdbc;
        this.cashier = cashier;
        this.duty = duty;
        this.currentUser = currentUser;
        this.live = live;
    }

    public WaiterFloor floor() {
        long me = currentUser.get().id();
        var now = Times.now();
        List<DutyService.Duty> mine = duty.waitersOnDuty(now).stream().filter(d -> d.userId() == me).toList();
        List<String> areas = mine.stream().filter(d -> d.areaId() != null).map(d -> Ids.str(d.areaId())).distinct().toList();
        String label = mine.isEmpty() ? null : String.join(" + ", mine.stream()
            .map(d -> d.shiftName() + " " + Times.hhmm(d.start().toLocalTime()) + "–" + Times.hhmm(d.end().toLocalTime())
                + (d.areaName() == null ? "" : " · " + d.areaName()))
            .toList());
        return new WaiterFloor(cashier.floor(true), areas, label);
    }

    /** Bưng món: Đã xong → Đã mang ra (khách và bếp thấy ngay). Món máy khác vừa xử lý thì bỏ qua. */
    @Transactional
    public WaiterFloor serve(IdsInput in) {
        List<String> ids = in == null || in.ids() == null ? List.of() : in.ids();
        if (ids.isEmpty()) throw new BusinessException("Chưa chọn món");
        if (ids.size() > 100) throw new BusinessException("Tối đa 100 món một lần");
        long me = currentUser.get().id();
        Set<Long> tables = new HashSet<>();
        int changed = 0;
        List<Long> parsed = new ArrayList<>();
        for (String id : ids) parsed.add(Ids.parse(id, "Không tìm thấy món"));
        parsed.sort(Long::compare);
        for (long id : parsed) {
            var row = jdbc.sql("""
                    SELECT oi.status, o.table_id FROM order_items oi JOIN orders o ON o.id = oi.order_id WHERE oi.id = ? FOR UPDATE
                    """).param(id).query((rs, n) -> new Object[] {rs.getString(1), rs.getLong(2)}).optional().orElse(null);
            if (row == null || !"done".equals(row[0])) continue;
            jdbc.sql("UPDATE order_items SET status = 'served', served_at = ?, served_by = ? WHERE id = ?")
                .params(Times.now(), me, id).update();
            tables.add((Long) row[1]);
            changed++;
        }
        if (changed == 0) throw new BusinessException("Món không ở trạng thái Đã xong (có thể vừa được người khác mang ra)");
        List<String> channels = new ArrayList<>(List.of(LiveEvents.KITCHEN, LiveEvents.CASHIER));
        tables.forEach(t -> channels.add(LiveEvents.table(t)));
        live.publish(channels.toArray(String[]::new));
        return floor();
    }
}
