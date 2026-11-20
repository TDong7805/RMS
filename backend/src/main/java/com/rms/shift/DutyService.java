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
 *  - nhân viên phục vụ: ai đang trong ca và phụ trách khu vực nào (định tuyến yêu cầu hỗ trợ của khách).
 */
@Service
public class DutyService {
    public static final String EARLY_KEY = "attendance.early_minutes";
    /** Sau giờ kết thúc ca bao nhiêu phút vẫn coi là đang trong ca (phục vụ dọn bàn, bàn giao). */
    static final int LATE_GRACE_MINUTES = 30;

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

    /** Nhân viên phục vụ (tài khoản đang hoạt động) đang trong ca lúc now. */
    public List<Duty> waitersOnDuty(LocalDateTime now) {
        int early = earlyMinutes();
        List<Duty> out = new ArrayList<>();
        jdbc.sql(SELECT + """
                 WHERE r.code = 'waiter' AND u.status = 'active' AND u.deleted_at IS NULL AND sa.work_date BETWEEN ? AND ?
                """)
            .params(now.toLocalDate().minusDays(1), now.toLocalDate())
            .query((rs, n) -> map(rs)).list().stream()
            .filter(d -> !now.isBefore(d.start().minusMinutes(early)) && now.isBefore(d.end().plusMinutes(LATE_GRACE_MINUTES)))
            .forEach(out::add);
        return out;
    }

    /**
     * Khu vực phục vụ {@code userId} được xem yêu cầu hỗ trợ lúc này; null = mọi khu vực.
     * Không trong ca / ca không gán khu → mọi khu. Có khu → khu của mình + các khu không có phục vụ nào được gán trong ca.
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

    /** Người nhận thông báo yêu cầu hỗ trợ ở khu {@code areaId}: phục vụ trong ca của khu đó; không có thì mọi phục vụ trong ca. */
    public List<Long> waitersFor(long areaId, LocalDateTime now) {
        List<Duty> onDuty = waitersOnDuty(now);
        List<Long> exact = onDuty.stream().filter(d -> d.areaId() == null || d.areaId() == areaId).map(Duty::userId).distinct().toList();
        if (onDuty.stream().anyMatch(d -> d.areaId() != null && d.areaId() == areaId)) return exact;
        return onDuty.stream().map(Duty::userId).distinct().toList();
    }
}
