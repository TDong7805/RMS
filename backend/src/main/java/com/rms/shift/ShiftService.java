package com.rms.shift;

import com.rms.audit.AuditService;
import com.rms.common.BusinessException;
import com.rms.common.CurrentUserService;
import com.rms.common.Db;
import com.rms.common.Ids;
import com.rms.common.Times;
import com.rms.common.ValidationException;
import com.rms.common.Vi;
import java.text.Collator;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.TreeSet;
import java.util.function.Function;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * UC Quản lý ca làm việc: xem danh sách ca, thêm, sửa, xóa ca; phân công ca cho nhân viên.
 *
 * Quy tắc (theo đặc tả):
 *  - A1: tên ca, giờ bắt đầu / kết thúc bắt buộc, đúng định dạng HH:mm.
 *  - A2: trùng tên hoặc trùng khung giờ với ca khác → "Dữ liệu bị trùng lặp" (CSDL có UNIQUE tương ứng).
 *  - A3: nhân viên không được có hai ca chồng giờ. So sánh theo giờ thực tế, nên ca qua đêm (vd. 22:00–06:00)
 *    cũng chặn ca sáng sớm hôm sau.
 *  - A4: ca đã có phân công / lịch sử làm việc thì không xóa được (FK RESTRICT).
 *  - Ngày đã qua là lịch sử (dùng tính lương): không phân công mới, không hủy.
 *  - Chỉ phân công cho nhân viên đang hoạt động; người đã khóa / đã nghỉ vẫn hiện ở tuần họ từng có ca.
 *  - Mọi thao tác ghi nhật ký (module "shift").
 */
@Service
public class ShiftService {
    static final int NAME_MAX = 40;
    static final int NOTE_MAX = 200;
    static final int MAX_DATES = 31;
    static final String DEFAULT_COLOR = "#0f7b5a";
    private static final Pattern HHMM = Pattern.compile("^([01]\\d|2[0-3]):[0-5]\\d$");
    private static final Pattern COLOR = Pattern.compile("^#[0-9a-fA-F]{6}$");
    private static final DateTimeFormatter DMY = DateTimeFormatter.ofPattern("dd/MM/yyyy");
    private static final DateTimeFormatter DM = DateTimeFormatter.ofPattern("dd/MM");

    public record Shift(String id, String name, String startTime, String endTime, String color, String note,
                        int assignmentCount) {}

    public record ShiftInput(String name, String startTime, String endTime, String color, String note) {}

    /** status: active | locked | deleted (đã xóa tài khoản = đã nghỉ việc). */
    public record Employee(String id, String fullName, String role, String status) {}

    public record Assignment(String id, String shiftId, String employeeId, String date) {}

    public record AssignInput(String employeeId, String shiftId, List<String> dates) {}

    private record ShiftRow(long id, String name, LocalTime start, LocalTime end) {
        /** Khoảng thời gian thực tế của ca khi làm ngày {@code date}; ca qua đêm kết thúc ngày hôm sau. */
        LocalDateTime[] on(LocalDate date) {
            LocalDateTime from = date.atTime(start);
            LocalDateTime to = (end.isAfter(start) ? date : date.plusDays(1)).atTime(end);
            return new LocalDateTime[] {from, to};
        }

        String label() {
            return "\"" + name + "\" (" + Times.hhmm(start) + "–" + Times.hhmm(end) + ")";
        }
    }

    private record AssignmentRow(long id, long shiftId, long userId, LocalDate date) {}

    private final JdbcClient jdbc;
    private final AuditService audit;
    private final CurrentUserService currentUser;

    public ShiftService(JdbcClient jdbc, AuditService audit, CurrentUserService currentUser) {
        this.jdbc = jdbc;
        this.audit = audit;
        this.currentUser = currentUser;
    }

    /* ------------------------------------------------------------------ Ca làm việc */

    public List<Shift> list() {
        return jdbc.sql("""
                SELECT s.id, s.name, s.start_time, s.end_time, s.color, s.note,
                       (SELECT COUNT(*) FROM shift_assignments a WHERE a.shift_id = s.id) AS assignment_count
                FROM shifts s ORDER BY s.start_time, s.id
                """)
            .query((rs, n) -> new Shift(Ids.str(rs.getLong("id")), rs.getString("name"),
                Times.hhmm(Db.time(rs, "start_time")), Times.hhmm(Db.time(rs, "end_time")), rs.getString("color"),
                Vi.trim(rs.getString("note")), rs.getInt("assignment_count")))
            .list();
    }

    private Shift one(long id) {
        return list().stream().filter(s -> s.id().equals(Ids.str(id))).findFirst()
            .orElseThrow(() -> BusinessException.notFound("Ca làm việc không tồn tại"));
    }

    private List<ShiftRow> shiftRows() {
        return jdbc.sql("SELECT id, name, start_time, end_time FROM shifts")
            .query((rs, n) -> new ShiftRow(rs.getLong("id"), rs.getString("name"), Db.time(rs, "start_time"),
                Db.time(rs, "end_time")))
            .list();
    }

    @Transactional
    public Shift create(ShiftInput in) {
        Clean c = validate(in, null);
        jdbc.sql("INSERT INTO shifts (name, start_time, end_time, color, note) VALUES (?, ?, ?, ?, ?)")
            .params(c.name(), c.start(), c.end(), c.color(), c.note().isEmpty() ? null : c.note())
            .update();
        long id = jdbc.sql("SELECT LAST_INSERT_ID()").query(Long.class).single();
        audit.log("shift", "Thêm ca làm việc", "Thêm " + c.name() + " (" + Times.hhmm(c.start()) + " – " + Times.hhmm(c.end()) + ")",
            "shifts", id);
        return one(id);
    }

    @Transactional
    public Shift update(String idText, ShiftInput in) {
        long id = Ids.parse(idText, "Ca làm việc không tồn tại");
        ShiftRow current = shiftRows().stream().filter(s -> s.id() == id).findFirst()
            .orElseThrow(() -> BusinessException.notFound("Ca làm việc không tồn tại"));
        Clean c = validate(in, id);

        // Đổi giờ không được làm phát sinh trùng lịch với các phân công đang có.
        if (!current.start().equals(c.start()) || !current.end().equals(c.end())) {
            ShiftRow updated = new ShiftRow(id, c.name(), c.start(), c.end());
            Map<Long, ShiftRow> shifts = shiftRows().stream().collect(Collectors.toMap(ShiftRow::id, Function.identity()));
            shifts.put(id, updated);
            for (AssignmentRow a : assignmentsWhere("a.shift_id = ?", id)) {
                AssignmentRow clash = findClash(a.userId(), updated, a.date(), shifts, a.id());
                if (clash != null) {
                    throw new ValidationException(Map.of("startTime", "Giờ mới trùng với " + shifts.get(clash.shiftId()).label()
                        + " của nhân viên đã được phân công ngày " + clash.date().format(DMY)), "Trùng lịch làm việc");
                }
            }
        }
        jdbc.sql("UPDATE shifts SET name = ?, start_time = ?, end_time = ?, color = ?, note = ? WHERE id = ?")
            .params(c.name(), c.start(), c.end(), c.color(), c.note().isEmpty() ? null : c.note(), id)
            .update();
        audit.log("shift", "Sửa ca làm việc", c.name() + " (" + Times.hhmm(c.start()) + " – " + Times.hhmm(c.end()) + ")",
            "shifts", id);
        return one(id);
    }

    @Transactional
    public void delete(String idText) {
        long id = Ids.parse(idText, "Ca làm việc không tồn tại");
        Shift current = one(id);
        if (current.assignmentCount() > 0) {
            throw new BusinessException(
                "Không thể xóa ca làm việc này vì đã có nhân viên được phân công hoặc đã có lịch sử làm việc.");
        }
        jdbc.sql("DELETE FROM shifts WHERE id = ?").param(id).update();
        audit.log("shift", "Xóa ca làm việc", "Xóa " + current.name(), "shifts", id);
    }

    private record Clean(String name, LocalTime start, LocalTime end, String color, String note) {}

    private Clean validate(ShiftInput in, Long editingId) {
        var v = new ValidationException.Collector();
        String name = Vi.collapse(in.name());
        if (name.isEmpty()) v.add("name", "Vui lòng nhập tên ca");
        else if (name.length() > NAME_MAX) v.add("name", "Tên ca tối đa " + NAME_MAX + " ký tự");
        String startText = Vi.trim(in.startTime()), endText = Vi.trim(in.endTime());
        if (!HHMM.matcher(startText).matches()) v.add("startTime", "Giờ bắt đầu không đúng định dạng HH:mm");
        if (!HHMM.matcher(endText).matches()) v.add("endTime", "Giờ kết thúc không đúng định dạng HH:mm");
        else if (!v.has("startTime") && startText.equals(endText)) v.add("endTime", "Giờ kết thúc phải khác giờ bắt đầu");
        String color = Vi.blank(in.color()) ? DEFAULT_COLOR : in.color().trim();
        if (!COLOR.matcher(color).matches()) v.add("color", "Màu không hợp lệ");
        String note = Vi.trim(in.note());
        if (note.length() > NOTE_MAX) v.add("note", "Ghi chú tối đa " + NOTE_MAX + " ký tự");
        v.throwIfAny();

        LocalTime start = Times.parseHhmm(startText), end = Times.parseHhmm(endText);
        long editing = editingId == null ? 0 : editingId;
        // Collation của CSDL: không phân biệt hoa thường, dấu — đúng như ràng buộc UNIQUE(name).
        String dupName = jdbc.sql("SELECT name FROM shifts WHERE name = ? AND id <> ?").params(name, editing)
            .query(String.class).optional().orElse(null);
        String dupTime = jdbc.sql("SELECT name FROM shifts WHERE start_time = ? AND end_time = ? AND id <> ?")
            .params(start, end, editing).query(String.class).optional().orElse(null);
        if (dupName != null) v.add("name", "Trùng tên với ca \"" + dupName + "\"");
        if (dupTime != null) v.add("startTime", "Trùng khung giờ với ca \"" + dupTime + "\"");
        v.throwIfAny("Dữ liệu bị trùng lặp");
        return new Clean(name, start, end, color.toLowerCase(Locale.ROOT), note);
    }

    /* ------------------------------------------------------------------ Nhân viên */

    /**
     * Nhân viên đang hoạt động (được phân công mới) + người đã khóa / đã nghỉ nhưng có ca trong [from, to]
     * (để lịch tuần cũ vẫn đủ). Sắp theo bộ phận rồi tên.
     */
    public List<Employee> employees(String fromText, String toText) {
        LocalDate from = Times.parseDate(fromText), to = Times.parseDate(toText);
        String extra = from == null || to == null ? "" : """
             OR u.id IN (SELECT a.user_id FROM shift_assignments a WHERE a.work_date BETWEEN ? AND ?)""";
        var q = jdbc.sql("""
                SELECT u.id, u.full_name, r.code AS role,
                       CASE WHEN u.deleted_at IS NOT NULL THEN 'deleted' ELSE u.status END AS state
                FROM users u JOIN roles r ON r.id = u.role_id
                WHERE (u.deleted_at IS NULL AND u.status = 'active')""" + extra);
        if (!extra.isEmpty()) q = q.params(from, to);
        Collator vi = Collator.getInstance(Locale.forLanguageTag("vi"));
        return q.query((rs, n) -> new Employee(Ids.str(rs.getLong("id")), rs.getString("full_name"), rs.getString("role"),
                rs.getString("state")))
            .list().stream()
            .sorted(Comparator.comparing(Employee::role).thenComparing(Employee::fullName, vi))
            .toList();
    }

    /* ------------------------------------------------------------------ Phân công */

    public List<Assignment> assignments(String fromText, String toText) {
        LocalDate from = Times.parseDate(fromText), to = Times.parseDate(toText);
        if (from == null || to == null || to.isBefore(from)) throw new ValidationException("from", "Khoảng ngày không hợp lệ");
        if (from.plusDays(62).isBefore(to)) throw new ValidationException("to", "Chỉ xem tối đa 62 ngày một lần");
        return assignmentsWhere("a.work_date BETWEEN ? AND ?", from, to).stream()
            .map(a -> new Assignment(Ids.str(a.id()), Ids.str(a.shiftId()), Ids.str(a.userId()), a.date().toString()))
            .toList();
    }

    private List<AssignmentRow> assignmentsWhere(String condition, Object... params) {
        return jdbc.sql("SELECT a.id, a.shift_id, a.user_id, a.work_date FROM shift_assignments a WHERE " + condition
                + " ORDER BY a.work_date, a.id")
            .params(params)
            .query((rs, n) -> new AssignmentRow(rs.getLong("id"), rs.getLong("shift_id"), rs.getLong("user_id"),
                rs.getObject("work_date", LocalDate.class)))
            .list();
    }

    /** Phân công của nhân viên chồng giờ với {@code shift} làm ngày {@code date} (xét cả hôm trước / hôm sau vì ca qua đêm). */
    private AssignmentRow findClash(long userId, ShiftRow shift, LocalDate date, Map<Long, ShiftRow> shifts, long excludeId) {
        LocalDateTime[] mine = shift.on(date);
        for (AssignmentRow other : assignmentsWhere("a.user_id = ? AND a.work_date BETWEEN ? AND ? AND a.id <> ?",
            userId, date.minusDays(1), date.plusDays(1), excludeId)) {
            LocalDateTime[] theirs = shifts.get(other.shiftId()).on(other.date());
            if (mine[0].isBefore(theirs[1]) && theirs[0].isBefore(mine[1])) return other;
        }
        return null;
    }

    @Transactional
    public List<Assignment> assign(AssignInput in) {
        var v = new ValidationException.Collector();
        Long userId = Ids.parseOrNull(in.employeeId());
        Employee emp = userId == null ? null : jdbc.sql("""
                SELECT u.id, u.full_name, r.code AS role,
                       CASE WHEN u.deleted_at IS NOT NULL THEN 'deleted' ELSE u.status END AS state
                FROM users u JOIN roles r ON r.id = u.role_id WHERE u.id = ?
                """).param(userId)
            .query((rs, n) -> new Employee(Ids.str(rs.getLong("id")), rs.getString("full_name"), rs.getString("role"),
                rs.getString("state")))
            .optional().orElse(null);
        if (emp == null || "deleted".equals(emp.status())) v.add("employeeId", "Vui lòng chọn nhân viên");
        else if (!"active".equals(emp.status())) v.add("employeeId", "Tài khoản của " + emp.fullName() + " đang bị khóa, không thể phân công");

        Map<Long, ShiftRow> shifts = shiftRows().stream().collect(Collectors.toMap(ShiftRow::id, Function.identity()));
        Long shiftId = Ids.parseOrNull(in.shiftId());
        ShiftRow shift = shiftId == null ? null : shifts.get(shiftId);
        if (shift == null) v.add("shiftId", "Vui lòng chọn ca làm việc");

        TreeSet<LocalDate> dates = new TreeSet<>();
        boolean badDate = false;
        for (String d : in.dates() == null ? List.<String>of() : in.dates()) {
            LocalDate parsed = Times.parseDate(d);
            if (parsed == null) badDate = true;
            else dates.add(parsed);
        }
        if (badDate) v.add("dates", "Ngày làm việc không hợp lệ");
        else if (dates.isEmpty()) v.add("dates", "Chọn ít nhất một ngày");
        else if (dates.size() > MAX_DATES) v.add("dates", "Mỗi lần phân công tối đa " + MAX_DATES + " ngày");
        else if (dates.first().isBefore(Times.today())) v.add("dates", "Không thể phân công cho ngày đã qua");
        v.throwIfAny();

        for (LocalDate date : dates) {
            boolean same = !assignmentsWhere("a.user_id = ? AND a.work_date = ? AND a.shift_id = ?", userId, date, shiftId).isEmpty();
            if (same) {
                throw new ValidationException(Map.of("dates", emp.fullName() + " đã có " + shift.name() + " ngày " + date.format(DMY)),
                    "Trùng lịch làm việc");
            }
            AssignmentRow clash = findClash(userId, shift, date, shifts, 0);
            if (clash != null) {
                ShiftRow other = shifts.get(clash.shiftId());
                String when = clash.date().equals(date) ? "ngày " + date.format(DMY)
                    : "ca " + shift.name() + " ngày " + date.format(DMY) + " chồng giờ với ca ngày " + clash.date().format(DMY);
                throw new ValidationException(Map.of("dates", "Trùng lịch làm việc: " + when + " " + emp.fullName()
                    + " đã có " + other.label()), "Trùng lịch làm việc");
            }
        }

        long creator = currentUser.get().id();
        List<Long> ids = new ArrayList<>();
        for (LocalDate date : dates) {
            jdbc.sql("INSERT INTO shift_assignments (shift_id, user_id, work_date, created_by) VALUES (?, ?, ?, ?)")
                .params(shiftId, userId, date, creator).update();
            ids.add(jdbc.sql("SELECT LAST_INSERT_ID()").query(Long.class).single());
        }
        String days = dates.stream().map(d -> d.format(DM)).collect(Collectors.joining(", "));
        audit.log("shift", "Phân công ca",
            "Phân công " + emp.fullName() + " vào " + shift.name() + " (" + dates.size() + " ngày: " + days + ")", "users", userId);
        List<Assignment> out = new ArrayList<>();
        int i = 0;
        for (LocalDate date : dates) out.add(new Assignment(Ids.str(ids.get(i++)), Ids.str(shiftId), Ids.str(userId), date.toString()));
        return out;
    }

    @Transactional
    public void unassign(String idText) {
        long id = Ids.parse(idText, "Phân công không tồn tại");
        record Row(LocalDate date, String shift, String employee, boolean attended) {}
        Row row = jdbc.sql("""
                SELECT a.work_date, s.name AS shift_name, u.full_name,
                       EXISTS (SELECT 1 FROM attendances t WHERE t.assignment_id = a.id) AS attended
                FROM shift_assignments a JOIN shifts s ON s.id = a.shift_id JOIN users u ON u.id = a.user_id
                WHERE a.id = ?
                """).param(id)
            .query((rs, n) -> new Row(rs.getObject("work_date", LocalDate.class), rs.getString("shift_name"),
                rs.getString("full_name"), rs.getBoolean("attended")))
            .optional().orElseThrow(() -> BusinessException.notFound("Phân công không tồn tại"));
        if (row.date().isBefore(Times.today()))
            throw new BusinessException("Không thể hủy phân công của ngày đã qua (đã thuộc lịch sử làm việc)");
        if (row.attended())
            throw new BusinessException("Nhân viên đã chấm công cho ca này, không thể hủy phân công");
        jdbc.sql("DELETE FROM shift_assignments WHERE id = ?").param(id).update();
        audit.log("shift", "Hủy phân công", "Hủy " + row.shift() + " của " + row.employee() + " ngày " + row.date().format(DMY),
            "shift_assignments", id);
    }

    /**
     * Gọi khi xóa tài khoản (nhân viên nghỉ việc): hủy các ca từ hôm nay trở đi chưa chấm công.
     * Lịch sử các ngày đã qua giữ nguyên. Trả về số ca đã hủy.
     */
    public int removeFutureAssignments(long userId) {
        return jdbc.sql("""
                DELETE a FROM shift_assignments a
                LEFT JOIN attendances t ON t.assignment_id = a.id
                WHERE a.user_id = ? AND a.work_date >= ? AND t.id IS NULL
                """).params(userId, Times.today()).update();
    }
}
