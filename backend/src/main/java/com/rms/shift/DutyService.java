package com.rms.shift;

import com.rms.common.Db;
import com.rms.common.SystemSettings;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;

/**
 * Ca đã phân công quy ra giờ thực tế (ca qua đêm kết thúc hôm sau) — dùng cho:
 *  - chấm công khuôn mặt: ca nào đang cho vào (sớm tối đa N phút theo cấu hình), số phút đi trễ / về sớm;
 *  - nhân viên phục vụ: ai đã chấm công vào ca (đang làm việc) và phụ trách khu vực nào — định tuyến yêu cầu hỗ trợ,
 *    đơn chờ xác nhận; chưa vào ca thì chỉ xem (WaiterGuard), không nhận thông báo (27/11/2026).
 */
@Service
public class DutyService {
    public static final String EARLY_KEY = "attendance.early_minutes";
    public record Duty(long assignmentId, long userId, String fullName, String role, LocalDate workDate, long shiftId,
                       String shiftName, LocalDateTime start, LocalDateTime end, Long areaId, String areaName) {}

    private final JdbcClient jdbc;
    private final SystemSettings settings;

    public DutyService(JdbcClient jdbc, SystemSettings settings) {
        this.jdbc = jdbc;
        this.settings = settings;
    }

    public int earlyMinutes() {
        return Math.max(0, Math.min(180, settings.integer(EARLY_KEY, 30)));
    }

    private static final String SELECT = """
        SELECT sa.id, sa.user_id, u.full_name, r.code AS role, sa.work_date, s.id AS shift_id, s.name AS shift_name,
               s.start_time, s.end_time, sa.area_id, a.name AS area_name
        FROM shift_assignments sa JOIN shifts s ON s.id = sa.shift_id JOIN users u ON u.id = sa.user_id
        JOIN roles r ON r.id = u.role_id LEFT JOIN areas a ON a.id = sa.area_id
        """;

    private static Duty map(java.sql.ResultSet rs) throws java.sql.SQLException {
        LocalDate d = rs.getObject("work_date", LocalDate.class);
        LocalTime st = Db.time(rs, "start_time"), en = Db.time(rs, "end_time");
        LocalDateTime start = d.atTime(st);
        LocalDateTime end = (en.isAfter(st) ? d : d.plusDays(1)).atTime(en);
        return new Duty(rs.getLong("id"), rs.getLong("user_id"), rs.getString("full_name"), rs.getString("role"), d,
            rs.getLong("shift_id"), rs.getString("shift_name"), start, end,
            rs.getObject("area_id") == null ? null : rs.getLong("area_id"), rs.getString("area_name"));
    }

    /** Ca của một nhân viên làm trong [from, to] (theo ngày phân công), sớm nhất trước. */
    public List<Duty> ofUser(long userId, LocalDate from, LocalDate to) {
        return jdbc.sql(SELECT + " WHERE sa.user_id = ? AND sa.work_date BETWEEN ? AND ? ORDER BY sa.work_date, s.start_time")
            .params(userId, from, to).query((rs, n) -> map(rs)).list();
    }

    /** Ca của nhân viên đang nhận chấm công vào: now ∈ [bắt đầu − N phút, kết thúc). */
    public List<Duty> checkInWindow(long userId, LocalDateTime now) {
        int early = earlyMinutes();
        return ofUser(userId, now.toLocalDate().minusDays(1), now.toLocalDate().plusDays(1)).stream()
            .filter(d -> !now.isBefore(d.start().minusMinutes(early)) && now.isBefore(d.end()))
            .toList();
    }

    /** Ca kế tiếp của nhân viên (trong 7 ngày tới) — để báo "ca tiếp theo lúc …". */
    public Duty next(long userId, LocalDateTime now) {
        return ofUser(userId, now.toLocalDate().minusDays(1), now.toLocalDate().plusDays(7)).stream()
            .filter(d -> d.start().isAfter(now)).findFirst().orElse(null);
    }

    /**
     * Phục vụ có ca theo LỊCH PHÂN CÔNG đang diễn ra lúc {@code now} (chưa chắc đã chấm công) — để hiện "Ca … · khu" và
     * nhắc chấm công.
     */
    public List<Duty> waitersScheduled(LocalDateTime now) {
        return jdbc.sql(SELECT + """
                 WHERE r.code = 'waiter' AND u.status = 'active' AND u.deleted_at IS NULL AND sa.work_date BETWEEN ? AND ?
                """)
            .params(now.toLocalDate().minusDays(1), now.toLocalDate())
            .query((rs, n) -> map(rs)).list().stream()
            .filter(d -> !now.isBefore(d.start()) && now.isBefore(d.end()))
            .toList();
    }

    /**
     * Phục vụ ĐANG LÀM VIỆC lúc {@code now} = đã chấm công vào ca và chưa tan ca (V22; bỏ ở D15 26/11, dùng lại 27/11/2026
     * theo yêu cầu: chưa vào ca / đã tan ca thì chỉ xem, không nhận thông báo — tránh làm từ nhà, tan ca rồi vẫn bị báo).
     * Khu phụ trách lấy theo ca đã chấm công vào; lượt chấm công không gắn ca (nhập tay) → không có khu (thấy mọi khu).
     * Vào ca quá OPEN_MAX_HOURS giờ mà chưa tan ca thì không tính nữa.
     */
    public List<Duty> waitersOnDuty(LocalDateTime now) {
        return jdbc.sql("""
                SELECT a.check_in, a.user_id, u.full_name, r.code AS role, sa.id AS asg_id, sa.work_date, s.id AS shift_id,
                       s.name AS shift_name, s.start_time, s.end_time, sa.area_id, ar.name AS area_name
                FROM attendances a JOIN users u ON u.id = a.user_id JOIN roles r ON r.id = u.role_id
                LEFT JOIN shift_assignments sa ON sa.id = a.assignment_id LEFT JOIN shifts s ON s.id = sa.shift_id
                LEFT JOIN areas ar ON ar.id = sa.area_id
                WHERE r.code = 'waiter' AND u.status = 'active' AND u.deleted_at IS NULL
                  AND a.check_out IS NULL AND a.check_in <= ? AND a.check_in > ?
                """)
            .params(now, now.minusHours(OPEN_MAX_HOURS))
            .query((rs, n) -> {
                LocalDateTime in = Db.dateTime(rs, "check_in");
                if (rs.getObject("asg_id") == null) {
                    return new Duty(0, rs.getLong("user_id"), rs.getString("full_name"), rs.getString("role"), in.toLocalDate(), 0,
                        "Ca ngoài lịch", in, in.plusHours(OPEN_MAX_HOURS), null, null);
                }
                LocalDate d = rs.getObject("work_date", LocalDate.class);
                LocalTime st = Db.time(rs, "start_time"), en = Db.time(rs, "end_time");
                return new Duty(rs.getLong("asg_id"), rs.getLong("user_id"), rs.getString("full_name"), rs.getString("role"), d,
                    rs.getLong("shift_id"), rs.getString("shift_name"), d.atTime(st), (en.isAfter(st) ? d : d.plusDays(1)).atTime(en),
                    rs.getObject("area_id") == null ? null : rs.getLong("area_id"), rs.getString("area_name"));
            })
            .list();
    }

    /** Phục vụ này đã chấm công vào ca và chưa tan ca. */
    public boolean isOnDuty(long userId, LocalDateTime now) {
        return waitersOnDuty(now).stream().anyMatch(d -> d.userId() == userId);
    }

    /** Vào ca quá số giờ này mà chưa tan ca → coi như không còn làm việc (khớp ClockService.MAX_SHIFT_HOURS). */
    public static final int OPEN_MAX_HOURS = 16;

    /**
     * Khu vực phục vụ {@code userId} được xem yêu cầu hỗ trợ / đơn chờ xác nhận lúc này; null = mọi khu vực.
     * Chưa vào ca / ca không gán khu → mọi khu (chưa vào ca thì chỉ xem, thao tác bị chặn ở WaiterGuard).
     * Có khu → khu của mình + các khu không có phục vụ nào đã vào ca được gán.
     */
    public Set<Long> visibleAreas(long userId, LocalDateTime now) {
        List<Duty> onDuty = waitersOnDuty(now);
        List<Duty> mine = onDuty.stream().filter(d -> d.userId() == userId).toList();
        if (mine.isEmpty() || mine.stream().anyMatch(d -> d.areaId() == null)) return null;
        Set<Long> covered = new HashSet<>();
        onDuty.forEach(d -> { if (d.areaId() != null) covered.add(d.areaId()); });
        Set<Long> visible = new HashSet<>();
        mine.forEach(d -> visible.add(d.areaId()));
        jdbc.sql("SELECT id FROM areas").query(Long.class).list().stream().filter(a -> !covered.contains(a)).forEach(visible::add);
        return visible;
    }

    /** Khu vực được gán cho phục vụ trong ca hiện tại (để mở sẵn tab trên sơ đồ). */
    public List<Long> myAreas(long userId, LocalDateTime now) {
        return waitersOnDuty(now).stream().filter(d -> d.userId() == userId && d.areaId() != null)
            .map(Duty::areaId).distinct().toList();
    }

    /**
     * Người nhận thông báo (yêu cầu hỗ trợ, đơn chờ xác nhận) ở khu {@code areaId}: phục vụ đã vào ca của khu đó;
     * không có thì mọi phục vụ đã vào ca; không ai vào ca → danh sách trống (nơi gọi báo thu ngân thay).
     * Phục vụ chưa vào ca / đã tan ca không bao giờ nhận.
     */
    public List<Long> waitersFor(long areaId, LocalDateTime now) {
        List<Duty> onDuty = waitersOnDuty(now);
        List<Long> exact = onDuty.stream().filter(d -> d.areaId() == null || d.areaId() == areaId).map(Duty::userId).distinct().toList();
        if (onDuty.stream().anyMatch(d -> d.areaId() != null && d.areaId() == areaId)) return exact;
        return onDuty.stream().map(Duty::userId).distinct().toList();
    }
}
