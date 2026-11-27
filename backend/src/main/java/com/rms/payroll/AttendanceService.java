package com.rms.payroll;

import com.rms.audit.AuditService;
import com.rms.common.BusinessException;
import com.rms.common.CurrentUserService;
import com.rms.common.Db;
import com.rms.common.Ids;
import com.rms.common.Times;
import com.rms.common.ValidationException;
import com.rms.common.Vi;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Chấm công (UC-TN-10, UC-TN-11): nhập từ file Excel / CSV, xem, thêm / sửa / xóa tay.
 *
 * Một dòng chấm công = một lần vào – ra của một nhân viên. Giờ ra nhỏ hơn giờ vào = ca qua đêm (ra sáng hôm sau).
 * Thiếu giờ ra được lưu (tính 0 giờ, đánh dấu "Thiếu giờ ra") nhưng chặn chốt bảng lương.
 * Ngày thuộc kỳ lương đã chốt không thêm / sửa / xóa được.
 */
@Service
public class AttendanceService {
    static final int MAX_ROWS = 5000;
    static final long MAX_BYTES = 2L * 1024 * 1024;
    static final int MAX_SHIFT_HOURS = 16;
    static final int MAX_RANGE_DAYS = 62;
    static final int NOTE_MAX = 200;
    private static final DateTimeFormatter DMY = DateTimeFormatter.ofPattern("dd/MM/yyyy");
    private static final DateTimeFormatter HM = DateTimeFormatter.ofPattern("HH:mm");
    private static final LocalDate EXCEL_EPOCH = LocalDate.of(1899, 12, 30);

    public record Employee(String id, String name, String username, String roleName, boolean locked) {}

    /**
     * Từ V20 (chấm công khuôn mặt, source = camera): lateMinutes / earlyMinutes so với ca, hasInPhoto / hasOutPhoto (ảnh xem qua
     * API có kiểm quyền), inDistance / outDistance = độ lệch khuôn mặt (càng nhỏ càng giống).
     */
    public record Row(String id, String userId, String userName, String username, String roleName, String date, String checkIn,
                      String checkOut, boolean overnight, double hours, String source, String note, boolean missingOut,
                      boolean locked, Integer lateMinutes, Integer earlyMinutes, boolean hasInPhoto, boolean hasOutPhoto,
                      Double inDistance, Double outDistance) {}

    public record Total(String userId, String userName, String roleName, int days, double hours, int missingOut) {}

    public record ListResponse(List<Row> items, List<Total> totals, double totalHours, int missingOutCount) {}

    public record Input(String userId, String date, String checkIn, String checkOut, String note) {}

    /** Một dòng đọc từ file (chưa kiểm tra). */
    public record RawLine(int rowNo, String user, String date, String checkIn, String checkOut, String note) {}

    public record PreviewLine(int rowNo, String user, String date, String checkIn, String checkOut, String note, String userId,
                              String userName, String workDate, double hours, boolean missingOut, String status, String error) {}

    public record Preview(String fileName, List<PreviewLine> lines, int validCount, int duplicateCount, int errorCount) {}

    public record ImportInput(String fileName, String duplicateMode, List<RawLine> lines) {}

    public record ImportResult(int imported, int overwritten, int skipped, int errors) {}

    private final JdbcClient jdbc;
    private final AuditService audit;
    private final CurrentUserService currentUser;

    public AttendanceService(JdbcClient jdbc, AuditService audit, CurrentUserService currentUser) {
        this.jdbc = jdbc;
        this.audit = audit;
        this.currentUser = currentUser;
    }

    /* ------------------------------------------------------------------ Dùng chung */

    /** Nhân viên còn tồn tại (kể cả đã khóa). */
    public List<Employee> employees() {
        return jdbc.sql("""
                SELECT u.id, u.full_name, u.username, r.name AS role_name, u.status FROM users u JOIN roles r ON r.id = u.role_id
                WHERE u.deleted_at IS NULL AND u.shared_screen = 0 ORDER BY u.full_name
                """)
            .query((rs, n) -> new Employee(Ids.str(rs.getLong("id")), rs.getString("full_name"), rs.getString("username"),
                rs.getString("role_name"), "locked".equals(rs.getString("status"))))
            .list();
    }

    /** Kỳ lương đã chốt chứa ngày (tên kỳ), nếu có. */
    Optional<String> closedPeriodOf(LocalDate d) {
        return jdbc.sql("SELECT name FROM payroll_periods WHERE status = 'closed' AND ? BETWEEN start_date AND end_date LIMIT 1")
            .param(d).query(String.class).optional();
    }

    static double hours(LocalDateTime in, LocalDateTime out) {
        if (out == null) return 0;
        return BigDecimal.valueOf(ChronoUnit.MINUTES.between(in, out)).divide(BigDecimal.valueOf(60), 2, RoundingMode.HALF_UP).doubleValue();
    }

    static LocalDate parseDate(String s) {
        String t = Vi.trim(s);
        if (t.isEmpty()) return null;
        if (t.matches("^\\d+(\\.\\d+)?$")) {
            double serial = Double.parseDouble(t);
            return serial >= 1 && serial < 100000 ? EXCEL_EPOCH.plusDays((long) Math.floor(serial)) : null;
        }
        for (String p : List.of("d/M/uuuu", "d-M-uuuu", "uuuu-M-d", "d.M.uuuu")) {
            try {
                // STRICT: 31/02 là lỗi, không tự chỉnh thành 28/02.
                return LocalDate.parse(t, DateTimeFormatter.ofPattern(p).withResolverStyle(java.time.format.ResolverStyle.STRICT));
            } catch (DateTimeParseException ignored) {
                // thử định dạng kế tiếp
            }
        }
        return null;
    }

    /** "08:00", "8:00", "8h", "08:00:00", số giờ Excel (0,3333 = 08:00) hoặc số giờ nguyên 0–23. */
    static LocalTime parseTime(String s) {
        String t = Vi.trim(s).toLowerCase(Locale.ROOT);
        if (t.isEmpty()) return null;
        if (t.matches("^\\d*\\.\\d+$")) {
            double v = Double.parseDouble(t);
            int minutes = (int) Math.round((v - Math.floor(v)) * 1440) % 1440;
            return LocalTime.of(minutes / 60, minutes % 60);
        }
        if (t.matches("^\\d{1,2}$")) {
            int h = Integer.parseInt(t);
            return h <= 23 ? LocalTime.of(h, 0) : null;
        }
        String[] p = t.replace('h', ':').split(":", -1);
        try {
            if (p.length < 2 || p.length > 3) return null;
            int h = Integer.parseInt(p[0]);
            int m = p[1].isEmpty() ? 0 : Integer.parseInt(p[1]);
            if (h < 0 || h > 23 || m < 0 || m > 59) return null;
            return LocalTime.of(h, m);
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private record UserRef(long id, String name) {}

    private Map<String, UserRef> userIndex() {
        Map<String, UserRef> m = new HashMap<>();
        jdbc.sql("SELECT id, username, email, full_name FROM users WHERE deleted_at IS NULL").query((rs, n) -> {
            UserRef u = new UserRef(rs.getLong("id"), rs.getString("full_name"));
            m.put(rs.getString("username").toLowerCase(Locale.ROOT), u);
            if (rs.getString("email") != null) m.put(rs.getString("email").toLowerCase(Locale.ROOT), u);
            return u;
        }).list();
        return m;
    }

    private record Interval(long id, long userId, LocalDate date, LocalDateTime in, LocalDateTime out) {
        LocalDateTime end() {
            return out == null ? in.plusMinutes(1) : out;
        }

        boolean overlaps(LocalDateTime a, LocalDateTime b) {
            return a.isBefore(end()) && in.isBefore(b);
        }
    }

    private List<Interval> existing(long userId, LocalDate from, LocalDate to) {
        return jdbc.sql("SELECT id, user_id, work_date, check_in, check_out FROM attendances WHERE user_id = ? AND work_date BETWEEN ? AND ?")
            .params(userId, from, to)
            .query((rs, n) -> new Interval(rs.getLong("id"), rs.getLong("user_id"), rs.getDate("work_date").toLocalDate(),
                Db.dateTime(rs, "check_in"), Db.dateTime(rs, "check_out")))
            .list();
    }

    /* ------------------------------------------------------------------ Kiểm tra từng dòng (Excel và nhập tay) */

    private record Checked(PreviewLine line, Long userId, LocalDate date, LocalDateTime in, LocalDateTime out, Long existingId) {}

    private List<Checked> check(List<RawLine> raws) {
        return check(raws, null);
    }

    /** @param excludeId dòng đang sửa (không so chồng giờ với chính nó) */
    private List<Checked> check(List<RawLine> raws, Long excludeId) {
        Map<String, UserRef> users = userIndex();
        Map<String, Optional<String>> closedCache = new HashMap<>();
        Map<Long, List<Interval>> dbCache = new HashMap<>();
        Map<Long, List<Checked>> accepted = new HashMap<>();
        List<Checked> out = new ArrayList<>();
        for (RawLine r : raws) {
            String error = null;
            UserRef u = users.get(Vi.trim(r.user()).toLowerCase(Locale.ROOT));
            LocalDate date = parseDate(r.date());
            LocalTime tin = parseTime(r.checkIn());
            boolean noOut = Vi.blank(r.checkOut());
            LocalTime tout = noOut ? null : parseTime(r.checkOut());
            String note = Vi.collapse(r.note());
            if (Vi.blank(r.user())) error = "Thiếu tên đăng nhập nhân viên";
            else if (u == null) error = "Không tìm thấy nhân viên \"" + Vi.trim(r.user()) + "\"";
            else if (date == null) error = "Ngày sai định dạng (dd/MM/yyyy)";
            else if (tin == null) error = "Giờ vào sai định dạng (HH:mm)";
            else if (!noOut && tout == null) error = "Giờ ra sai định dạng (HH:mm)";
            else if (note.length() > NOTE_MAX) error = "Ghi chú tối đa " + NOTE_MAX + " ký tự";
            else if (date.isAfter(Times.today())) error = "Ngày chấm công ở tương lai";
            LocalDateTime in = null;
            LocalDateTime outAt = null;
            Long existingId = null;
            String status = "valid";
            if (error == null) {
                in = date.atTime(tin);
                if (tout != null) {
                    outAt = date.atTime(tout);
                    if (!outAt.isAfter(in)) outAt = outAt.plusDays(1); // ca qua đêm
                    if (ChronoUnit.MINUTES.between(in, outAt) > MAX_SHIFT_HOURS * 60L) error = "Ca dài quá " + MAX_SHIFT_HOURS + " giờ";
                }
            }
            if (error == null) {
                Optional<String> closed = closedCache.computeIfAbsent(date.toString(), k -> closedPeriodOf(LocalDate.parse(k)));
                if (closed.isPresent()) error = "Ngày thuộc kỳ lương đã chốt (" + closed.get() + ")";
            }
            if (error == null) {
                final LocalDateTime fin = in;
                final LocalDateTime fout = outAt == null ? in.plusMinutes(1) : outAt;
                List<Interval> db = dbCache.computeIfAbsent(u.id(), id -> existing(id, Times.today().minusYears(5), Times.today().plusDays(1)).stream()
                    .filter(x -> excludeId == null || x.id() != excludeId).toList());
                Interval same = db.stream().filter(x -> x.in().equals(fin)).findFirst().orElse(null);
                Checked dupInFile = accepted.getOrDefault(u.id(), List.of()).stream()
                    .filter(c -> c.in().equals(fin)).findFirst().orElse(null);
                Checked overlapInFile = accepted.getOrDefault(u.id(), List.of()).stream()
                    .filter(c -> fin.isBefore(c.out() == null ? c.in().plusMinutes(1) : c.out()) && c.in().isBefore(fout))
                    .findFirst().orElse(null);
                if (dupInFile != null) error = "Trùng với dòng " + dupInFile.line().rowNo() + " trong file";
                else if (overlapInFile != null) error = "Chồng giờ với dòng " + overlapInFile.line().rowNo() + " trong file";
                else if (same != null) {
                    status = "duplicate";
                    existingId = same.id();
                    boolean overlapOther = db.stream().anyMatch(x -> x.id() != same.id() && x.overlaps(fin, fout));
                    if (overlapOther) error = "Chồng giờ với chấm công đã có của nhân viên";
                } else if (db.stream().anyMatch(x -> x.overlaps(fin, fout))) {
                    error = "Chồng giờ với chấm công đã có của nhân viên";
                }
            }
            if (error != null) status = "error";
            PreviewLine line = new PreviewLine(r.rowNo(), Vi.trim(r.user()), Vi.trim(r.date()), Vi.trim(r.checkIn()), Vi.trim(r.checkOut()),
                note, u == null ? null : Ids.str(u.id()), u == null ? null : u.name(), date == null ? null : date.toString(),
                in == null ? 0 : hours(in, outAt), error == null && outAt == null, status, error);
            Checked c = new Checked(line, u == null ? null : u.id(), date, in, outAt, existingId);
            if (!"error".equals(status)) accepted.computeIfAbsent(u.id(), k -> new ArrayList<>()).add(c);
            out.add(c);
        }
        return out;
    }

    /* ------------------------------------------------------------------ UC-TN-10: nhập từ file */

    /** Cột trong file theo tiêu đề (không phân biệt hoa thường, có dấu hay không). */
    static Map<String, Integer> headerMap(List<String> header) {
        Map<String, Integer> m = new HashMap<>();
        for (int i = 0; i < header.size(); i++) {
            String h = Vi.normalize(header.get(i)).replaceAll("[^a-z0-9 ]", " ").replaceAll("\\s+", " ").trim();
            if (h.isEmpty()) continue;
            if ((h.contains("dang nhap") || h.contains("email") || h.equals("nhan vien") || h.equals("tai khoan") || h.equals("username")) && !m.containsKey("user")) m.put("user", i);
            else if (h.startsWith("gio vao") || h.equals("vao") || h.equals("check in")) m.put("in", i);
            else if (h.startsWith("gio ra") || h.equals("ra") || h.equals("check out")) m.put("out", i);
            else if (h.startsWith("ngay")) m.put("date", i);
            else if (h.startsWith("ghi chu")) m.put("note", i);
        }
        return m;
    }

    public List<RawLine> parse(String fileName, byte[] data) {
        if (data == null || data.length == 0) throw new ValidationException("file", "Vui lòng chọn file");
        if (data.length > MAX_BYTES) throw new ValidationException("file", "File tối đa 2 MB");
        List<List<String>> rows;
        try {
            rows = SheetIO.read(fileName, data);
        } catch (SheetIO.BadFileException e) {
            throw new ValidationException("file", "File không đúng mẫu. Vui lòng dùng file mẫu.");
        }
        // Dòng tiêu đề: dòng đầu tiên (trong 10 dòng đầu) có đủ cột bắt buộc.
        int headerAt = -1;
        Map<String, Integer> cols = Map.of();
        for (int i = 0; i < Math.min(10, rows.size()); i++) {
            Map<String, Integer> m = headerMap(rows.get(i));
            if (m.containsKey("user") && m.containsKey("date") && m.containsKey("in") && m.containsKey("out")) {
                headerAt = i;
                cols = m;
                break;
            }
        }
        if (headerAt < 0) throw new ValidationException("file", "File không đúng mẫu. Vui lòng dùng file mẫu.");
        List<RawLine> out = new ArrayList<>();
        for (int i = headerAt + 1; i < rows.size(); i++) {
            List<String> r = rows.get(i);
            if (r.stream().allMatch(Vi::blank)) continue;
            if (out.size() >= MAX_ROWS) throw new ValidationException("file", "File tối đa " + MAX_ROWS + " dòng");
            out.add(new RawLine(i + 1, cell(r, cols.get("user")), cell(r, cols.get("date")), cell(r, cols.get("in")), cell(r, cols.get("out")),
                cell(r, cols.get("note"))));
        }
        if (out.isEmpty()) throw new ValidationException("file", "File không có dòng chấm công nào");
        return out;
    }

    private static String cell(List<String> r, Integer i) {
        return i == null || i >= r.size() ? "" : Vi.trim(r.get(i));
    }

    public Preview preview(String fileName, byte[] data) {
        return toPreview(fileName, check(parse(fileName, data)));
    }

    private static Preview toPreview(String fileName, List<Checked> checked) {
        List<PreviewLine> lines = checked.stream().map(Checked::line).toList();
        int valid = (int) lines.stream().filter(l -> "valid".equals(l.status())).count();
        int dup = (int) lines.stream().filter(l -> "duplicate".equals(l.status())).count();
        return new Preview(fileName, lines, valid, dup, lines.size() - valid - dup);
    }

    /** Nhập các dòng đã xem trước (máy chủ kiểm tra lại toàn bộ trước khi lưu). */
    @Transactional
    public ImportResult importLines(ImportInput in) {
        List<RawLine> raws = in.lines() == null ? List.of() : in.lines();
        if (raws.isEmpty()) throw new ValidationException("lines", "Không có dòng nào để nhập");
        if (raws.size() > MAX_ROWS) throw new ValidationException("lines", "Tối đa " + MAX_ROWS + " dòng");
        boolean overwrite = "overwrite".equals(in.duplicateMode());
        List<Checked> checked = check(raws);
        long user = currentUser.get().id();
        LocalDateTime now = Times.now();
        int imported = 0;
        int overwritten = 0;
        int skipped = 0;
        int errors = 0;
        for (Checked c : checked) {
            String status = c.line().status();
            if ("error".equals(status)) {
                errors++;
            } else if ("duplicate".equals(status)) {
                if (!overwrite) {
                    skipped++;
                    continue;
                }
                jdbc.sql("UPDATE attendances SET check_out = ?, note = ?, source = 'excel', updated_by = ?, updated_at = ? WHERE id = ?")
                    .params(c.out(), blankToNull(c.line().note()), user, now, c.existingId()).update();
                overwritten++;
            } else {
                jdbc.sql("""
                        INSERT INTO attendances (user_id, work_date, check_in, check_out, note, source, created_by, created_at)
                        VALUES (?, ?, ?, ?, ?, 'excel', ?, ?)
                        """).params(c.userId(), c.date(), c.in(), c.out(), blankToNull(c.line().note()), user, now).update();
                imported++;
            }
        }
        if (imported + overwritten == 0) throw new BusinessException("Không có dòng nào hợp lệ để nhập");
        String file = Vi.trim(in.fileName());
        audit.log("payroll", "Nhập chấm công từ file", (file.isEmpty() ? "File" : file) + ": nhập " + imported + " dòng, ghi đè "
            + overwritten + ", bỏ qua " + skipped + ", lỗi " + errors, "attendances", null);
        return new ImportResult(imported, overwritten, skipped, errors);
    }

    private static String blankToNull(String s) {
        return Vi.blank(s) ? null : s;
    }

    /** File mẫu .xlsx: tiêu đề + 2 dòng ví dụ. */
    public byte[] template() {
        List<Employee> emps = employees();
        String u1 = emps.isEmpty() ? "ten.dangnhap" : emps.get(0).username();
        String u2 = emps.size() > 1 ? emps.get(1).username() : u1;
        String d = Times.today().minusDays(1).format(DMY);
        return SheetIO.writeXlsx("Chấm công", List.of(
            List.of("Tên đăng nhập", "Ngày", "Giờ vào", "Giờ ra", "Ghi chú"),
            List.of(u1, d, "08:00", "16:30", ""),
            List.of(u2, d, "17:00", "23:15", "Ví dụ ca tối")), new int[] {22, 14, 10, 10, 30});
    }

    /** File các dòng lỗi (giữ nguyên nội dung gốc + cột Lỗi) để sửa rồi nhập lại. */
    public byte[] errorFile(List<RawLine> raws) {
        List<List<String>> rows = new ArrayList<>();
        rows.add(List.of("Tên đăng nhập", "Ngày", "Giờ vào", "Giờ ra", "Ghi chú", "Dòng gốc", "Lỗi"));
        for (Checked c : check(raws == null ? List.of() : raws)) {
            if (!"error".equals(c.line().status())) continue;
            PreviewLine l = c.line();
            rows.add(List.of(l.user(), displayDate(l.date()), displayTime(l.checkIn()), displayTime(l.checkOut()), l.note(),
                String.valueOf(l.rowNo()), l.error()));
        }
        return SheetIO.writeXlsx("Dòng lỗi", rows, new int[] {22, 14, 10, 10, 30, 10, 50});
    }

    /** Ngày / giờ dạng số seri Excel → chữ dễ đọc trong file lỗi. */
    private static String displayDate(String raw) {
        LocalDate d = raw != null && raw.matches("^\\d+(\\.\\d+)?$") ? parseDate(raw) : null;
        return d == null ? Vi.trim(raw) : d.format(DMY);
    }

    private static String displayTime(String raw) {
        LocalTime t = raw != null && raw.matches("^\\d*\\.\\d+$") ? parseTime(raw) : null;
        return t == null ? Vi.trim(raw) : t.format(HM);
    }

    /* ------------------------------------------------------------------ UC-TN-11: xem, thêm, sửa, xóa */

    static LocalDate[] range(String from, String to) {
        LocalDate f = Times.parseDate(from);
        LocalDate t = Times.parseDate(to);
        if (f == null && t == null) {
            f = Times.today().withDayOfMonth(1);
            t = Times.today();
        } else if (f == null) f = t;
        else if (t == null) t = f;
        if (t.isBefore(f)) throw new ValidationException("to", "Đến ngày phải sau Từ ngày");
        if (ChronoUnit.DAYS.between(f, t) >= MAX_RANGE_DAYS) throw new ValidationException("to", "Khoảng ngày tối đa " + MAX_RANGE_DAYS + " ngày");
        return new LocalDate[] {f, t};
    }

    private static final String ROW_SELECT = """
        SELECT a.*, u.full_name, u.username, r.name AS role_name,
               EXISTS (SELECT 1 FROM payroll_periods p WHERE p.status = 'closed' AND a.work_date BETWEEN p.start_date AND p.end_date) AS locked
        FROM attendances a JOIN users u ON u.id = a.user_id JOIN roles r ON r.id = u.role_id
        """;

    private static Row mapRow(java.sql.ResultSet rs) throws java.sql.SQLException {
        LocalDateTime in = Db.dateTime(rs, "check_in");
        LocalDateTime out = Db.dateTime(rs, "check_out");
        return new Row(Ids.str(rs.getLong("id")), Ids.str(rs.getLong("user_id")), rs.getString("full_name"), rs.getString("username"),
            rs.getString("role_name"), rs.getDate("work_date").toLocalDate().toString(), in.toLocalTime().format(HM),
            out == null ? null : out.toLocalTime().format(HM), out != null && !out.toLocalDate().equals(in.toLocalDate()),
            hours(in, out), rs.getString("source"), Vi.trim(rs.getString("note")), out == null, rs.getBoolean("locked"),
            (Integer) rs.getObject("late_minutes", Integer.class), (Integer) rs.getObject("early_minutes", Integer.class),
            rs.getString("check_in_photo") != null, rs.getString("check_out_photo") != null,
            rs.getBigDecimal("check_in_distance") == null ? null : rs.getBigDecimal("check_in_distance").doubleValue(),
            rs.getBigDecimal("check_out_distance") == null ? null : rs.getBigDecimal("check_out_distance").doubleValue());
    }

    public ListResponse list(String userIdText, String from, String to) {
        LocalDate[] r = range(from, to);
        Long userId = Ids.parseOrNull(userIdText);
        StringBuilder sql = new StringBuilder(ROW_SELECT).append(" WHERE a.work_date BETWEEN ? AND ?");
        List<Object> params = new ArrayList<>(List.of(r[0], r[1]));
        if (userId != null) {
            sql.append(" AND a.user_id = ?");
            params.add(userId);
        }
        sql.append(" ORDER BY a.work_date DESC, u.full_name, a.check_in");
        List<Row> items = jdbc.sql(sql.toString()).params(params).query((rs, n) -> mapRow(rs)).list();
        Map<String, Total> totals = new LinkedHashMap<>();
        Map<String, java.util.Set<String>> days = new HashMap<>();
        for (Row x : items) {
            days.computeIfAbsent(x.userId(), k -> new java.util.HashSet<>()).add(x.date());
            Total t = totals.getOrDefault(x.userId(), new Total(x.userId(), x.userName(), x.roleName(), 0, 0, 0));
            totals.put(x.userId(), new Total(t.userId(), t.userName(), t.roleName(), 0, round2(t.hours() + x.hours()),
                t.missingOut() + (x.missingOut() ? 1 : 0)));
        }
        List<Total> list = totals.values().stream()
            .map(t -> new Total(t.userId(), t.userName(), t.roleName(), days.get(t.userId()).size(), t.hours(), t.missingOut()))
            .sorted((a, b) -> a.userName().compareTo(b.userName())).toList();
        double total = round2(items.stream().mapToDouble(Row::hours).sum());
        int missing = (int) items.stream().filter(Row::missingOut).count();
        return new ListResponse(items, list, total, missing);
    }

    /** Chấm công một nhân viên trong khoảng ngày (phiếu lương, "Thông tin của tôi"), cũ nhất trước. */
    public List<Row> listForUser(long userId, LocalDate from, LocalDate to) {
        return jdbc.sql(ROW_SELECT + " WHERE a.user_id = ? AND a.work_date BETWEEN ? AND ? ORDER BY a.work_date, a.check_in")
            .params(userId, from, to).query((rs, n) -> mapRow(rs)).list();
    }

    static double round2(double v) {
        return BigDecimal.valueOf(v).setScale(2, RoundingMode.HALF_UP).doubleValue();
    }

    public Row get(long id) {
        return jdbc.sql(ROW_SELECT + " WHERE a.id = ?").param(id).query((rs, n) -> mapRow(rs)).optional()
            .orElseThrow(() -> BusinessException.notFound("Không tìm thấy dòng chấm công"));
    }

    /** Kiểm tra dòng nhập tay; bỏ qua chính dòng đang sửa khi xét chồng giờ. */
    private Checked checkManual(Input in, Long selfId) {
        var v = new ValidationException.Collector();
        Long userId = Ids.parseOrNull(in.userId());
        if (userId == null) v.add("userId", "Vui lòng chọn nhân viên");
        if (Vi.blank(in.date())) v.add("date", "Vui lòng chọn ngày");
        if (Vi.blank(in.checkIn())) v.add("checkIn", "Vui lòng nhập giờ vào");
        if (Vi.blank(in.note())) v.add("note", "Vui lòng nhập ghi chú");
        v.throwIfAny();
        String username = jdbc.sql("SELECT username FROM users WHERE id = ? AND deleted_at IS NULL").param(userId).query(String.class)
            .optional().orElseThrow(() -> new ValidationException("userId", "Không tìm thấy nhân viên"));
        LocalDate d = Times.parseDate(in.date());
        RawLine raw = new RawLine(0, username, d == null ? in.date() : d.format(DMY), in.checkIn(), in.checkOut(), in.note());
        Checked c = check(List.of(raw), selfId).get(0);
        String err = c.line().error();
        if (err == null && "duplicate".equals(c.line().status())) err = "Đã có chấm công cùng nhân viên, cùng ngày, cùng giờ vào";
        if (err != null) {
            String field = err.startsWith("Giờ ra") || err.startsWith("Ca dài") ? "checkOut"
                : err.startsWith("Giờ vào") || err.startsWith("Chồng") ? "checkIn"
                : err.startsWith("Ngày") ? "date" : err.startsWith("Ghi chú") ? "note" : "userId";
            if (err.startsWith("Ngày thuộc kỳ lương")) throw new BusinessException("Kỳ lương đã chốt, không sửa được chấm công");
            throw new ValidationException(field, err);
        }
        return c;
    }

    @Transactional
    public Row create(Input in) {
        Checked c = checkManual(in, null);
        jdbc.sql("""
                INSERT INTO attendances (user_id, work_date, check_in, check_out, note, source, created_by, created_at)
                VALUES (?, ?, ?, ?, ?, 'manual', ?, ?)
                """).params(c.userId(), c.date(), c.in(), c.out(), c.line().note(), currentUser.get().id(), Times.now()).update();
        long id = jdbc.sql("SELECT LAST_INSERT_ID()").query(Long.class).single();
        audit.log("payroll", "Thêm chấm công", c.line().userName() + " " + c.date().format(DMY) + " " + in.checkIn()
            + (Vi.blank(in.checkOut()) ? "" : "–" + in.checkOut()), "attendances", id);
        return get(id);
    }

    @Transactional
    public Row update(String idText, Input in) {
        long id = Ids.parse(idText, "Không tìm thấy dòng chấm công");
        Row old = get(id);
        if (old.locked()) throw new BusinessException("Kỳ lương đã chốt, không sửa được chấm công");
        Checked c = checkManual(in, id);
        jdbc.sql("""
                UPDATE attendances SET user_id = ?, work_date = ?, check_in = ?, check_out = ?, note = ?, source = 'manual',
                       updated_by = ?, updated_at = ? WHERE id = ?
                """).params(c.userId(), c.date(), c.in(), c.out(), c.line().note(), currentUser.get().id(), Times.now(), id).update();
        audit.log("payroll", "Sửa chấm công", old.userName() + " " + LocalDate.parse(old.date()).format(DMY) + ": " + old.checkIn() + "–"
            + (old.checkOut() == null ? "?" : old.checkOut()) + " → " + in.checkIn() + "–" + (Vi.blank(in.checkOut()) ? "?" : in.checkOut()),
            "attendances", id);
        return get(id);
    }

    @Transactional
    public void delete(String idText) {
        long id = Ids.parse(idText, "Không tìm thấy dòng chấm công");
        Row old = get(id);
        if (old.locked()) throw new BusinessException("Kỳ lương đã chốt, không sửa được chấm công");
        jdbc.sql("DELETE FROM attendances WHERE id = ?").param(id).update();
        audit.log("payroll", "Xóa chấm công", old.userName() + " " + LocalDate.parse(old.date()).format(DMY) + " " + old.checkIn() + "–"
            + (old.checkOut() == null ? "?" : old.checkOut()), "attendances", id);
    }
}
