package com.rms.selfservice;

import com.rms.audit.AuditService;
import com.rms.common.BusinessException;
import com.rms.common.CurrentUserService;
import com.rms.common.Db;
import com.rms.common.Ids;
import com.rms.common.Rules;
import com.rms.common.Times;
import com.rms.common.ValidationException;
import com.rms.common.Vi;
import com.rms.payroll.AttendanceService;
import com.rms.payroll.PayrollService;
import com.rms.shift.DutyService;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** "Thông tin của tôi" (phục vụ, thu ngân, bếp): hồ sơ, ca làm, chấm công và phiếu lương (kỳ đã chốt) của chính mình. */
@Service
public class SelfService {

    public record Profile(String id, String username, String fullName, String email, String phone, String role, String roleName,
                          long hourlyRate, String createdAt) {}

    public record ProfileInput(String email, String phone) {}

    public record ShiftRow(String id, String date, String shiftName, String start, String end, String areaName, boolean attended) {}

    public record PayslipRow(String periodId, String name, String startDate, String endDate, String closedAt, double hours, long total) {}

    private final JdbcClient jdbc;
    private final CurrentUserService currentUser;
    private final DutyService duty;
    private final AttendanceService attendance;
    private final PayrollService payroll;
    private final AuditService audit;

    public SelfService(JdbcClient jdbc, CurrentUserService currentUser, DutyService duty, AttendanceService attendance,
                       PayrollService payroll, AuditService audit) {
        this.jdbc = jdbc;
        this.currentUser = currentUser;
        this.duty = duty;
        this.attendance = attendance;
        this.payroll = payroll;
        this.audit = audit;
    }

    public Profile profile() {
        long me = currentUser.get().id();
        return jdbc.sql("""
                SELECT u.id, u.username, u.full_name, u.email, u.phone, r.code, r.name, u.hourly_rate, u.created_at
                FROM users u JOIN roles r ON r.id = u.role_id WHERE u.id = ?
                """).param(me)
            .query((rs, n) -> new Profile(Ids.str(rs.getLong(1)), rs.getString(2), rs.getString(3), rs.getString(4),
                Vi.trim(rs.getString(5)), rs.getString(6), rs.getString(7), rs.getBigDecimal(8).longValue(),
                Times.iso(Db.dateTime(rs, "created_at"))))
            .single();
    }

    /** Nhân viên tự sửa email, số điện thoại (họ tên, vai trò, lương do quản lý sửa). */
    @Transactional
    public Profile updateProfile(ProfileInput in) {
        long me = currentUser.get().id();
        String email = Vi.trim(in == null ? null : in.email()).toLowerCase();
        String phone = Vi.trim(in == null ? null : in.phone()).replaceAll("[\\s.]", "");
        var v = new ValidationException.Collector();
        if (email.isEmpty()) v.add("email", "Vui lòng nhập email");
        else if (email.length() > 150 || !Rules.EMAIL.matcher(email).matches()) v.add("email", "Email không đúng định dạng");
        else if (jdbc.sql("SELECT COUNT(*) FROM users WHERE email = ? AND id <> ?").params(email, me).query(Integer.class).single() > 0) {
            v.add("email", "Email đã được dùng cho tài khoản khác");
        }
        if (!phone.isEmpty() && !Rules.PHONE.matcher(phone).matches()) v.add("phone", "Số điện thoại không đúng định dạng");
        v.throwIfAny();
        try {
            jdbc.sql("UPDATE users SET email = ?, phone = ? WHERE id = ?").params(email, phone.isEmpty() ? null : phone, me).update();
        } catch (DuplicateKeyException e) {
            throw new ValidationException("email", "Email đã được dùng cho tài khoản khác");
        }
        audit.log("account", "Cập nhật hồ sơ cá nhân", "Đổi email / số điện thoại", "users", me);
        return profile();
    }

    private static LocalDate[] range(String from, String to, int maxDays) {
        LocalDate f = Times.parseDate(from), t = Times.parseDate(to);
        if (f == null && t == null) {
            f = Times.today().withDayOfMonth(1);
            t = f.plusMonths(1).minusDays(1);
        } else if (f == null) f = t;
        else if (t == null) t = f;
        if (t.isBefore(f)) throw new ValidationException("to", "Đến ngày phải sau Từ ngày");
        if (ChronoUnit.DAYS.between(f, t) >= maxDays) throw new ValidationException("to", "Khoảng ngày tối đa " + maxDays + " ngày");
        return new LocalDate[] {f, t};
    }

    public List<ShiftRow> shifts(String from, String to) {
        long me = currentUser.get().id();
        LocalDate[] r = range(from, to, 62);
        return duty.ofUser(me, r[0], r[1]).stream()
            .map(d -> new ShiftRow(Ids.str(d.assignmentId()), d.workDate().toString(), d.shiftName(), Times.iso(d.start()),
                Times.iso(d.end()), d.areaName(),
                jdbc.sql("SELECT COUNT(*) FROM attendances WHERE assignment_id = ?").param(d.assignmentId()).query(Integer.class).single() > 0))
            .toList();
    }

    public List<AttendanceService.Row> attendance(String from, String to) {
        LocalDate[] r = range(from, to, 62);
        List<AttendanceService.Row> rows = new java.util.ArrayList<>(attendance.listForUser(currentUser.get().id(), r[0], r[1]));
        java.util.Collections.reverse(rows);
        return rows;
    }

    public List<PayslipRow> payslips() {
        return jdbc.sql("""
                SELECT p.id, p.name, p.start_date, p.end_date, p.closed_at, pr.worked_hours, pr.total_amount
                FROM payrolls pr JOIN payroll_periods p ON p.id = pr.period_id
                WHERE pr.user_id = ? AND p.status = 'closed' ORDER BY p.end_date DESC
                """).param(currentUser.get().id())
            .query((rs, n) -> new PayslipRow(Ids.str(rs.getLong("id")), rs.getString("name"), rs.getDate("start_date").toLocalDate().toString(),
                rs.getDate("end_date").toLocalDate().toString(),
                Db.dateTime(rs, "closed_at") == null ? null : Times.iso(Db.dateTime(rs, "closed_at")),
                rs.getBigDecimal("worked_hours").doubleValue(), rs.getBigDecimal("total_amount").longValue()))
            .list();
    }

    /** Phiếu lương của mình — chỉ kỳ đã chốt. */
    public PayrollService.Payslip payslip(String periodIdText) {
        long me = currentUser.get().id();
        long periodId = Ids.parse(periodIdText, "Không tìm thấy phiếu lương");
        boolean ok = jdbc.sql("""
                SELECT COUNT(*) FROM payrolls pr JOIN payroll_periods p ON p.id = pr.period_id
                WHERE pr.period_id = ? AND pr.user_id = ? AND p.status = 'closed'
                """).params(periodId, me).query(Integer.class).single() > 0;
        if (!ok) throw BusinessException.notFound("Không tìm thấy phiếu lương");
        return payroll.payslip(Ids.str(periodId), Ids.str(me));
    }
}
