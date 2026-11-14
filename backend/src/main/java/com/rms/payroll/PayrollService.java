package com.rms.payroll;

import com.rms.audit.AuditService;
import com.rms.common.BusinessException;
import com.rms.common.CurrentUserService;
import com.rms.common.Db;
import com.rms.common.Ids;
import com.rms.common.Times;
import com.rms.common.ValidationException;
import com.rms.common.Vi;
import com.rms.payroll.AttendanceService.Row;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Bảng lương (UC-TN-12): tạo kỳ lương, tính từ chấm công, phụ cấp / khấu trừ, tính lại, chốt, phiếu lương.
 *
 * Thực lĩnh = Giờ công × Lương theo giờ + Lương cơ bản + Phụ cấp − Khấu trừ (làm tròn đến đồng, không âm).
 * Lương theo giờ / lương cơ bản / vai trò chụp từ tài khoản lúc tính (lại); kỳ đã chốt giữ nguyên.
 * Kỳ: draft (Nháp) → closed (Đã chốt, cuối). Chốt khóa chấm công trong khoảng ngày của kỳ.
 */
@Service
public class PayrollService {
    static final int MAX_PERIOD_DAYS = 62;
    private static final DateTimeFormatter DMY = DateTimeFormatter.ofPattern("dd/MM/yyyy");

    public record Period(String id, String name, String startDate, String endDate, String status, int employeeCount, long total,
                         String createdBy, String createdAt, String closedBy, String closedAt) {}

    public record Line(String userId, String userName, String username, String roleName, double hours, long hourlyRate,
                       long baseSalary, long allowance, long deduction, long total, String note, int missingOut) {}

    public record Detail(Period period, List<Line> lines, double totalHours, long totalAllowance, long totalDeduction, long total,
                         int missingOutCount) {}

    public record CreateInput(String name, String startDate, String endDate) {}

    public record LineInput(Long allowance, Long deduction, String note) {}

    public record Payslip(Period period, Line line, List<Row> days, Restaurant restaurant) {}

    public record Restaurant(String name, String address, String phone) {}

    private final JdbcClient jdbc;
    private final AuditService audit;
    private final CurrentUserService currentUser;
    private final AttendanceService attendance;

    public PayrollService(JdbcClient jdbc, AuditService audit, CurrentUserService currentUser, AttendanceService attendance) {
        this.jdbc = jdbc;
        this.audit = audit;
        this.currentUser = currentUser;
        this.attendance = attendance;
    }

    private static String iso(LocalDateTime t) {
        return t == null ? null : Times.iso(t);
    }

    private static long money(BigDecimal b) {
        return b == null ? 0 : b.longValue();
    }

    /* ------------------------------------------------------------------ Đọc */

    private static final String PERIOD_SELECT = """
        SELECT p.*, cu.full_name AS created_name, xu.full_name AS closed_name,
               (SELECT COUNT(*) FROM payrolls r WHERE r.period_id = p.id) AS employee_count,
               (SELECT COALESCE(SUM(r.total_amount), 0) FROM payrolls r WHERE r.period_id = p.id) AS total
        FROM payroll_periods p LEFT JOIN users cu ON cu.id = p.created_by LEFT JOIN users xu ON xu.id = p.closed_by
        """;

    private static Period mapPeriod(java.sql.ResultSet rs) throws java.sql.SQLException {
        return new Period(Ids.str(rs.getLong("id")), rs.getString("name"), rs.getDate("start_date").toLocalDate().toString(),
            rs.getDate("end_date").toLocalDate().toString(), rs.getString("status"), rs.getInt("employee_count"),
            money(rs.getBigDecimal("total")), rs.getString("created_name"), iso(Db.dateTime(rs, "created_at")), rs.getString("closed_name"),
            iso(Db.dateTime(rs, "closed_at")));
    }

    public List<Period> periods() {
        return jdbc.sql(PERIOD_SELECT + " ORDER BY p.start_date DESC, p.id DESC").query((rs, n) -> mapPeriod(rs)).list();
    }

    private Period period(long id) {
        return jdbc.sql(PERIOD_SELECT + " WHERE p.id = ?").param(id).query((rs, n) -> mapPeriod(rs)).optional()
            .orElseThrow(() -> BusinessException.notFound("Không tìm thấy kỳ lương"));
    }

    /** Số dòng chấm công thiếu giờ ra theo nhân viên trong khoảng ngày. */
    private Map<Long, Integer> missingOut(LocalDate from, LocalDate to) {
        Map<Long, Integer> m = new HashMap<>();
        jdbc.sql("SELECT user_id, COUNT(*) FROM attendances WHERE check_out IS NULL AND work_date BETWEEN ? AND ? GROUP BY user_id")
            .params(from, to).query((rs, n) -> m.put(rs.getLong(1), rs.getInt(2))).list();
        return m;
    }

    public Detail detail(String idText) {
        long id = Ids.parse(idText, "Không tìm thấy kỳ lương");
        Period p = period(id);
        Map<Long, Integer> missing = missingOut(LocalDate.parse(p.startDate()), LocalDate.parse(p.endDate()));
        List<Line> lines = jdbc.sql("""
                SELECT r.*, u.full_name, u.username FROM payrolls r JOIN users u ON u.id = r.user_id
                WHERE r.period_id = ? ORDER BY u.full_name
                """).param(id)
            .query((rs, n) -> new Line(Ids.str(rs.getLong("user_id")), rs.getString("full_name"), rs.getString("username"),
                rs.getString("role_name"), rs.getBigDecimal("worked_hours").doubleValue(), money(rs.getBigDecimal("hourly_rate")),
                money(rs.getBigDecimal("base_salary")), money(rs.getBigDecimal("allowance")), money(rs.getBigDecimal("deduction")),
                money(rs.getBigDecimal("total_amount")), Vi.trim(rs.getString("note")), missing.getOrDefault(rs.getLong("user_id"), 0)))
            .list();
        return new Detail(p, lines, AttendanceService.round2(lines.stream().mapToDouble(Line::hours).sum()),
            lines.stream().mapToLong(Line::allowance).sum(), lines.stream().mapToLong(Line::deduction).sum(),
            lines.stream().mapToLong(Line::total).sum(), missing.values().stream().mapToInt(Integer::intValue).sum());
    }

    /* ------------------------------------------------------------------ Tạo kỳ, tính lương */

    static long net(double hours, long rate, long base, long allowance, long deduction) {
        long v = Math.round(hours * rate) + base + allowance - deduction;
        return Math.max(0, v);
    }

    @Transactional
    public Detail create(CreateInput in) {
        LocalDate from = Times.parseDate(in.startDate());
        LocalDate to = Times.parseDate(in.endDate());
        var v = new ValidationException.Collector();
        if (from == null) v.add("startDate", "Vui lòng chọn Từ ngày");
        if (to == null) v.add("endDate", "Vui lòng chọn Đến ngày");
        v.throwIfAny();
        if (to.isBefore(from)) throw new ValidationException("endDate", "Đến ngày phải sau Từ ngày");
        if (ChronoUnit.DAYS.between(from, to) >= MAX_PERIOD_DAYS) throw new ValidationException("endDate", "Kỳ lương tối đa " + MAX_PERIOD_DAYS + " ngày");
        if (from.isAfter(Times.today())) throw new ValidationException("startDate", "Kỳ lương chưa bắt đầu");
        String name = Vi.collapse(in.name());
        if (name.isEmpty()) name = "Tháng " + from.format(DateTimeFormatter.ofPattern("MM/yyyy"));
        if (name.length() > 50) throw new ValidationException("name", "Tên kỳ tối đa 50 ký tự");
        jdbc.sql("SELECT id FROM payroll_periods FOR UPDATE").query(Long.class).list();
        String overlap = jdbc.sql("SELECT name FROM payroll_periods WHERE start_date <= ? AND end_date >= ? LIMIT 1").params(to, from)
            .query(String.class).optional().orElse(null);
        if (overlap != null) throw new ValidationException("startDate", "Khoảng ngày trùng với kỳ " + overlap);
        long user = currentUser.get().id();
        jdbc.sql("INSERT INTO payroll_periods (name, start_date, end_date, status, created_by, created_at) VALUES (?, ?, ?, 'draft', ?, ?)")
            .params(name, from, to, user, Times.now()).update();
        long id = jdbc.sql("SELECT LAST_INSERT_ID()").query(Long.class).single();
        calculate(id, from, to);
        audit.log("payroll", "Tạo kỳ lương", name + " (" + from.format(DMY) + " – " + to.format(DMY) + ")", "payroll_periods", id);
        return detail(Ids.str(id));
    }

    /**
     * Tính (lại) giờ công và lương cho mọi nhân viên có chấm công hoặc có lương cơ bản trong kỳ.
     * Phụ cấp / khấu trừ / ghi chú đã nhập được giữ; dòng không còn đủ điều kiện và chưa có phụ cấp / khấu trừ bị bỏ.
     */
    private void calculate(long periodId, LocalDate from, LocalDate to) {
        record Emp(long id, String role, long rate, long base, double hours) {}
        List<Emp> emps = jdbc.sql("""
                SELECT u.id, r.name AS role_name, u.hourly_rate, u.base_salary,
                       COALESCE((SELECT SUM(TIMESTAMPDIFF(MINUTE, a.check_in, a.check_out)) FROM attendances a
                                 WHERE a.user_id = u.id AND a.check_out IS NOT NULL AND a.work_date BETWEEN ? AND ?), 0) AS minutes,
                       EXISTS (SELECT 1 FROM attendances a WHERE a.user_id = u.id AND a.work_date BETWEEN ? AND ?) AS has_att
                FROM users u JOIN roles r ON r.id = u.role_id
                WHERE u.deleted_at IS NULL
                """).params(from, to, from, to)
            .query((rs, n) -> {
                boolean has = rs.getBoolean("has_att");
                long base = money(rs.getBigDecimal("base_salary"));
                if (!has && base == 0) return null;
                return new Emp(rs.getLong("id"), rs.getString("role_name"), money(rs.getBigDecimal("hourly_rate")), base,
                    AttendanceService.round2(rs.getLong("minutes") / 60.0));
            })
            .list().stream().filter(java.util.Objects::nonNull).toList();
        Map<Long, long[]> kept = new HashMap<>();
        jdbc.sql("SELECT user_id, allowance, deduction FROM payrolls WHERE period_id = ?").param(periodId)
            .query((rs, n) -> kept.put(rs.getLong(1), new long[] {money(rs.getBigDecimal(2)), money(rs.getBigDecimal(3))})).list();
        long calcBy = currentUser.get().id();
        LocalDateTime now = Times.now();
        java.util.Set<Long> seen = new java.util.HashSet<>();
        for (Emp e : emps) {
            seen.add(e.id());
            long[] ad = kept.getOrDefault(e.id(), new long[] {0, 0});
            long total = net(e.hours(), e.rate(), e.base(), ad[0], ad[1]);
            jdbc.sql("""
                    INSERT INTO payrolls (period_id, user_id, role_name, worked_hours, hourly_rate, base_salary, allowance, deduction,
                                          total_amount, calculated_by, calculated_at)
                    VALUES (?, ?, ?, ?, ?, ?, 0, 0, ?, ?, ?)
                    ON DUPLICATE KEY UPDATE role_name = VALUES(role_name), worked_hours = VALUES(worked_hours),
                        hourly_rate = VALUES(hourly_rate), base_salary = VALUES(base_salary), total_amount = ?,
                        calculated_by = VALUES(calculated_by), calculated_at = VALUES(calculated_at)
                    """).params(periodId, e.id(), e.role(), e.hours(), e.rate(), e.base(), total, calcBy, now, total).update();
        }
        kept.forEach((userId, ad) -> {
            if (seen.contains(userId)) return;
            if (ad[0] == 0 && ad[1] == 0) {
                jdbc.sql("DELETE FROM payrolls WHERE period_id = ? AND user_id = ?").params(periodId, userId).update();
            } else {
                jdbc.sql("UPDATE payrolls SET worked_hours = 0, total_amount = GREATEST(0, base_salary + allowance - deduction) WHERE period_id = ? AND user_id = ?")
                    .params(periodId, userId).update();
            }
        });
    }

    private Period lockDraft(long id) {
        jdbc.sql("SELECT id FROM payroll_periods WHERE id = ? FOR UPDATE").param(id).query(Long.class).optional()
            .orElseThrow(() -> BusinessException.notFound("Không tìm thấy kỳ lương"));
        Period p = period(id);
        if (!"draft".equals(p.status())) throw new BusinessException("Kỳ lương đã chốt, không sửa được");
        return p;
    }

    @Transactional
    public Detail recalculate(String idText) {
        long id = Ids.parse(idText, "Không tìm thấy kỳ lương");
        Period p = lockDraft(id);
        calculate(id, LocalDate.parse(p.startDate()), LocalDate.parse(p.endDate()));
        audit.log("payroll", "Tính lại bảng lương", p.name(), "payroll_periods", id);
        return detail(idText);
    }

    @Transactional
    public Detail updateLine(String idText, String userIdText, LineInput in) {
        long id = Ids.parse(idText, "Không tìm thấy kỳ lương");
        long userId = Ids.parse(userIdText, "Không tìm thấy nhân viên trong bảng lương");
        Period p = lockDraft(id);
        long allowance = in.allowance() == null ? 0 : in.allowance();
        long deduction = in.deduction() == null ? 0 : in.deduction();
        String note = Vi.collapse(in.note());
        var v = new ValidationException.Collector();
        if (allowance < 0) v.add("allowance", "Phụ cấp không được âm");
        if (deduction < 0) v.add("deduction", "Khấu trừ không được âm");
        if (allowance > 1_000_000_000L) v.add("allowance", "Phụ cấp quá lớn");
        if (deduction > 1_000_000_000L) v.add("deduction", "Khấu trừ quá lớn");
        if ((allowance > 0 || deduction > 0) && note.isEmpty()) v.add("note", "Vui lòng nhập ghi chú cho phụ cấp / khấu trừ");
        if (note.length() > 300) v.add("note", "Ghi chú tối đa 300 ký tự");
        v.throwIfAny();
        record Cur(double hours, long rate, long base) {}
        Cur c = jdbc.sql("SELECT worked_hours, hourly_rate, base_salary FROM payrolls WHERE period_id = ? AND user_id = ?")
            .params(id, userId)
            .query((rs, n) -> new Cur(rs.getBigDecimal(1).doubleValue(), money(rs.getBigDecimal(2)), money(rs.getBigDecimal(3))))
            .optional().orElseThrow(() -> BusinessException.notFound("Không tìm thấy nhân viên trong bảng lương"));
        jdbc.sql("UPDATE payrolls SET allowance = ?, deduction = ?, note = ?, total_amount = ? WHERE period_id = ? AND user_id = ?")
            .params(allowance, deduction, note.isEmpty() ? null : note, net(c.hours(), c.rate(), c.base(), allowance, deduction), id, userId)
            .update();
        String name = jdbc.sql("SELECT full_name FROM users WHERE id = ?").param(userId).query(String.class).single();
        audit.log("payroll", "Sửa phụ cấp / khấu trừ", p.name() + " – " + name + ": phụ cấp " + allowance + ", khấu trừ " + deduction,
            "payroll_periods", id);
        return detail(idText);
    }

    @Transactional
    public Detail close(String idText) {
        long id = Ids.parse(idText, "Không tìm thấy kỳ lương");
        Period p = lockDraft(id);
        LocalDate from = LocalDate.parse(p.startDate());
        LocalDate to = LocalDate.parse(p.endDate());
        int missing = missingOut(from, to).values().stream().mapToInt(Integer::intValue).sum();
        if (missing > 0) throw new BusinessException("Còn " + missing + " dòng chấm công thiếu giờ ra. Hãy sửa trước khi chốt.");
        if (to.isAfter(Times.today())) throw new BusinessException("Kỳ lương chưa kết thúc (đến " + to.format(DMY) + "), chưa chốt được");
        // Tính lại lần cuối để bảng lương khớp chấm công hiện tại.
        calculate(id, from, to);
        jdbc.sql("UPDATE payroll_periods SET status = 'closed', closed_by = ?, closed_at = ? WHERE id = ?")
            .params(currentUser.get().id(), Times.now(), id).update();
        Detail d = detail(idText);
        audit.log("payroll", "Chốt bảng lương", p.name() + " – " + d.lines().size() + " nhân viên – " + d.total() + " đ", "payroll_periods", id);
        return d;
    }

    /** Phiếu lương một nhân viên: dòng lương + chi tiết ngày công trong kỳ. */
    public Payslip payslip(String idText, String userIdText) {
        Detail d = detail(idText);
        Line line = d.lines().stream().filter(l -> l.userId().equals(userIdText)).findFirst()
            .orElseThrow(() -> BusinessException.notFound("Không tìm thấy nhân viên trong bảng lương"));
        List<Row> days = attendance.listForUser(Long.parseLong(line.userId()), LocalDate.parse(d.period().startDate()),
            LocalDate.parse(d.period().endDate()));
        Restaurant r = jdbc.sql("SELECT name, address, phone FROM restaurant_info WHERE id = 1")
            .query((rs, n) -> new Restaurant(rs.getString(1), Vi.trim(rs.getString(2)), Vi.trim(rs.getString(3)))).optional()
            .orElse(new Restaurant("Nhà hàng", "", ""));
        return new Payslip(d.period(), line, days, r);
    }
}
