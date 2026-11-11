package com.rms.reservation;
import com.rms.common.Db;

import com.rms.common.Ids;
import com.rms.common.Rules;
import com.rms.common.Times;
import com.rms.common.ValidationException;
import com.rms.common.Vi;
import com.rms.reservation.ReservationFormConfigService.FormConfig;
import com.rms.settings.SettingsService;
import com.rms.settings.SettingsService.OpeningDay;
import com.rms.table.TableService;
import com.rms.table.TableService.Area;
import com.rms.table.TableService.DiningTable;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;

/**
 * Quy tắc hợp lệ của một lịch đặt bàn: bắt buộc, định dạng SĐT, số khách, giờ hoạt động,
 * sức chứa bàn/khu vực và trùng lịch.
 *
 * Tách riêng để DÙNG CHUNG: hiện tại Quản lý nhà hàng dùng khi chỉnh sửa lịch; sau này phân hệ
 * Khách hàng đặt bàn gọi đúng lớp này khi tạo lịch mới → hai phía không bao giờ lệch quy tắc.
 */
@Component
public class ReservationRules {
    static final Set<String> ACTIVE = Set.of("pending", "confirmed", "seated");
    private static final String[] WEEKDAYS = {"Chủ nhật", "Thứ hai", "Thứ ba", "Thứ tư", "Thứ năm", "Thứ sáu", "Thứ bảy"};

    /** Thông tin cần kiểm tra của một lịch (mới hoặc sau khi sửa). */
    public record Candidate(String customerName, String phone, Integer guests, String date, String time,
                            String areaId, String tableId, String note) {}

    /** Lịch gốc khi chỉnh sửa (null nếu tạo mới). */
    public record Original(long id, LocalDateTime start, int guests, long areaId, Long tableId) {}

    /** Kết quả đã chuẩn hóa, sẵn sàng ghi vào CSDL. */
    public record Valid(String customerName, String phone, int guests, LocalDateTime start, long areaId, Long tableId,
                        String note, int durationMinutes) {}

    private final JdbcClient jdbc;
    private final TableService tables;
    private final SettingsService settings;
    private final ReservationFormConfigService formConfig;

    public ReservationRules(JdbcClient jdbc, TableService tables, SettingsService settings,
                            ReservationFormConfigService formConfig) {
        this.jdbc = jdbc;
        this.tables = tables;
        this.settings = settings;
        this.formConfig = formConfig;
    }

    public Valid validate(Candidate in, Original original) {
        FormConfig cfg = formConfig.get();
        var e = new ValidationException.Collector();

        String name = Vi.collapse(in.customerName());
        if (name.isEmpty()) e.add("customerName", "Vui lòng nhập tên khách hàng");
        else if (name.length() > 80) e.add("customerName", "Tên khách hàng tối đa 80 ký tự");

        String phone = Vi.trim(in.phone()).replaceAll("[\\s.]", "");
        if (phone.isEmpty()) e.add("phone", "Vui lòng nhập số điện thoại");
        else if (!Rules.PHONE.matcher(phone).matches()) e.add("phone", "Số điện thoại không đúng định dạng (VD: 0912345678)");

        Integer guests = in.guests();
        if (guests == null || guests <= 0) e.add("guests", "Số khách phải là số nguyên dương");
        else if (guests > cfg.maxGuests())
            e.add("guests", "Mỗi lịch đặt tối đa " + cfg.maxGuests() + " khách theo cấu hình form đặt bàn");
        else if (guests < cfg.minGuests())
            e.add("guests", "Mỗi lịch đặt tối thiểu " + cfg.minGuests() + " khách theo cấu hình form đặt bàn");

        LocalDate date = Times.parseDate(in.date());
        LocalTime time = Times.parseHhmm(in.time());
        if (date == null) e.add("date", "Vui lòng chọn ngày đặt");
        if (time == null) e.add("time", "Vui lòng chọn giờ đặt");

        Long areaId = Ids.parseOrNull(in.areaId());
        Area area = areaId == null ? null : tables.findArea(areaId).orElse(null);
        if (area == null) e.add("areaId", "Vui lòng chọn khu vực");
        else if (!area.active()) e.add("areaId", "Khu vực đang tạm ngưng phục vụ");

        String note = Vi.trim(in.note());
        if (note.length() > 300) e.add("note", "Ghi chú tối đa 300 ký tự");
        e.throwIfAny();

        LocalDateTime start = LocalDateTime.of(date, time);
        Long tableId = Ids.parseOrNull(in.tableId());
        boolean timeChanged = original == null || !start.equals(original.start());
        boolean capacityChanged = timeChanged
            || guests != original.guests()
            || areaId != original.areaId()
            || !java.util.Objects.equals(tableId, original.tableId());
        int duration = cfg.durationMinutes();

        if (timeChanged) {
            if (start.isBefore(Times.now())) {
                e.add("time", "Thời gian đặt không được nằm trong quá khứ");
            } else {
                int dow = start.getDayOfWeek().getValue() % 7; // 0 = Chủ nhật, khớp opening_hours
                OpeningDay day = settings.getOpeningHours().stream().filter(d -> d.day() == dow).findFirst().orElse(null);
                if (day == null || !day.open()) {
                    e.add("date", "Nhà hàng không mở cửa vào " + WEEKDAYS[dow]);
                } else {
                    int startMin = Times.minutes(time);
                    int openMin = Times.minutes(Times.parseHhmm(day.openTime()));
                    int latest = Times.minutes(Times.parseHhmm(day.closeTime())) - duration;
                    if (startMin < openMin || startMin > latest) {
                        e.add("time", "Giờ đặt phải trong khoảng " + day.openTime() + " – " + Times.minutesToHhmm(latest)
                            + " (giờ hoạt động " + day.openTime() + "–" + day.closeTime() + ", mỗi lượt " + duration + " phút)");
                    }
                }
            }
        }
        e.throwIfAny();

        if (capacityChanged) {
            List<Overlap> others = overlapping(start, duration, original == null ? 0 : original.id());
            List<DiningTable> all = tables.tables();
            if (tableId != null) {
                DiningTable table = all.stream().filter(t -> t.id().equals(Long.toString(tableId))).findFirst().orElse(null);
                if (table == null || !table.areaId().equals(Long.toString(areaId))) {
                    e.add("tableId", "Bàn không thuộc khu vực đã chọn");
                } else if ("inactive".equals(table.status())) {
                    e.add("tableId", "Bàn " + table.code() + " đang ngưng sử dụng");
                } else if (table.seats() < guests) {
                    e.add("tableId", "Bàn " + table.code() + " chỉ có " + table.seats() + " ghế, không đủ cho " + guests + " khách");
                } else {
                    others.stream().filter(o -> tableId.equals(o.tableId())).findFirst().ifPresent(clash ->
                        e.add("tableId", "Bàn " + table.code() + " đã có lịch " + clash.code() + " lúc "
                            + Times.hhmm(clash.start().toLocalTime()) + " — trùng khung giờ"));
                }
            } else {
                Set<String> busy = new HashSet<>();
                others.forEach(o -> { if (o.tableId() != null) busy.add(Long.toString(o.tableId())); });
                boolean free = all.stream().anyMatch(t -> t.areaId().equals(Long.toString(areaId))
                    && !"inactive".equals(t.status()) && !busy.contains(t.id()) && t.seats() >= guests);
                if (!free)
                    e.add("areaId", "Khu vực " + area.name() + " không còn bàn trống đủ " + guests + " chỗ trong khung giờ này");
            }
        }
        e.throwIfAny();

        return new Valid(name, phone, guests, start, areaId, tableId, note, duration);
    }

    private record Overlap(String code, LocalDateTime start, Long tableId) {}

    /** Lịch còn hiệu lực chồng khung giờ [start, start + duration) — mỗi lịch dùng thời lượng đã lưu của nó. */
    private List<Overlap> overlapping(LocalDateTime start, int duration, long excludeId) {
        return jdbc.sql("""
                SELECT code, reserved_at, table_id FROM reservations
                WHERE id <> ? AND status IN ('pending','confirmed','seated')
                  AND reserved_at < ? AND DATE_ADD(reserved_at, INTERVAL duration_minutes MINUTE) > ?
                """)
            .params(excludeId, start.plusMinutes(duration), start)
            .query((rs, n) -> new Overlap(rs.getString("code"), Db.dateTime(rs, "reserved_at"),
                (Long) rs.getObject("table_id", Long.class)))
            .list();
    }

    static final Map<String, List<String>> NEXT_STATUS = Map.of(
        "pending", List.of("confirmed", "cancelled"),
        "confirmed", List.of("seated", "cancelled", "no_show"),
        "seated", List.of("completed"),
        "completed", List.of(),
        "cancelled", List.of(),
        "no_show", List.of());
}
