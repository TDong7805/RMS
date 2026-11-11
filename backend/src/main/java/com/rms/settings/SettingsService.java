package com.rms.settings;
import com.rms.common.Db;

import com.rms.audit.AuditService;
import com.rms.common.CurrentUserService;
import com.rms.common.Rules;
import com.rms.common.Times;
import com.rms.common.ValidationException;
import com.rms.common.Vi;
import java.time.LocalTime;
import java.util.List;
import java.util.regex.Pattern;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** UC Cấu hình hệ thống: thông tin nhà hàng, giờ hoạt động, lịch sao lưu. */
@Service
public class SettingsService {
    private static final Pattern TAX = Pattern.compile("^\\d{10}(-\\d{3})?$");
    private static final Pattern LANDLINE = Pattern.compile("^0\\d{9,10}$");
    private static final Pattern WEBSITE = Pattern.compile("^https?://\\S+\\.\\S+");
    private static final String[] WEEKDAYS = {"Chủ nhật", "Thứ hai", "Thứ ba", "Thứ tư", "Thứ năm", "Thứ sáu", "Thứ bảy"};

    public record RestaurantInfo(String name, String legalName, String taxCode, String logo, String phone,
                                 String email, String address, String website, String updatedAt) {}

    public record RestaurantInfoInput(String name, String legalName, String taxCode, String logo, String phone,
                                      String email, String address, String website) {}

    public record OpeningDay(int day, boolean open, String openTime, String closeTime) {}

    public record BackupSchedule(boolean enabled, String frequency, int weekday, String time, int keep) {}

    private final JdbcClient jdbc;
    private final AuditService audit;
    private final CurrentUserService currentUser;

    public SettingsService(JdbcClient jdbc, AuditService audit, CurrentUserService currentUser) {
        this.jdbc = jdbc;
        this.audit = audit;
        this.currentUser = currentUser;
    }

    /* ------------------------------------------------------------ Thông tin nhà hàng */

    public RestaurantInfo getInfo() {
        return jdbc.sql("""
                SELECT name, legal_name, tax_code, logo_url, phone, email, address, website, updated_at
                FROM restaurant_info WHERE id = 1
                """)
            .query((rs, n) -> new RestaurantInfo(
                rs.getString("name"),
                nz(rs.getString("legal_name")),
                nz(rs.getString("tax_code")),
                rs.getString("logo_url"),
                rs.getString("phone"),
                rs.getString("email"),
                rs.getString("address"),
                nz(rs.getString("website")),
                Times.iso(Db.dateTime(rs, "updated_at"))))
            .single();
    }

    @Transactional
    public RestaurantInfo updateInfo(RestaurantInfoInput in) {
        var errors = new ValidationException.Collector();
        String name = Vi.collapse(in.name());
        String address = Vi.collapse(in.address());
        String tax = Vi.trim(in.taxCode());
        String phone = Vi.trim(in.phone());
        String website = Vi.trim(in.website());

        if (name.isEmpty()) errors.add("name", "Vui lòng nhập tên nhà hàng");
        else if (name.length() > 150) errors.add("name", "Tên nhà hàng tối đa 150 ký tự");
        if (Vi.collapse(in.legalName()).length() > 200) errors.add("legalName", "Tên pháp nhân tối đa 200 ký tự");
        if (!tax.isEmpty() && !TAX.matcher(tax).matches())
            errors.add("taxCode", "Mã số thuế gồm 10 số hoặc 13 số (dạng 0123456789-001)");
        if (!Rules.PHONE.matcher(phone).matches() && !LANDLINE.matcher(phone).matches())
            errors.add("phone", "Số điện thoại không hợp lệ");
        if (!Rules.EMAIL.matcher(Vi.trim(in.email())).matches()) errors.add("email", "Email không đúng định dạng");
        else if (in.email().trim().length() > 150) errors.add("email", "Email tối đa 150 ký tự");
        if (address.isEmpty()) errors.add("address", "Vui lòng nhập địa chỉ");
        else if (address.length() > 300) errors.add("address", "Địa chỉ tối đa 300 ký tự");
        if (!website.isEmpty() && !WEBSITE.matcher(website).matches())
            errors.add("website", "Website phải bắt đầu bằng http:// hoặc https://");
        else if (website.length() > 200) errors.add("website", "Website tối đa 200 ký tự");
        errors.throwIfAny();

        jdbc.sql("""
                UPDATE restaurant_info
                SET name = ?, legal_name = ?, tax_code = ?, logo_url = ?, phone = ?, email = ?, address = ?,
                    website = ?, updated_by = ?
                WHERE id = 1
                """)
            .params(name, nullIfBlank(Vi.collapse(in.legalName())), nullIfBlank(tax), nullIfBlank(in.logo()), phone,
                in.email().trim(), address, nullIfBlank(website), currentUser.get().id())
            .update();
        audit.log("settings", "Cập nhật thông tin nhà hàng", "Cập nhật thông tin định danh & liên hệ của " + name);
        return getInfo();
    }

    /* ------------------------------------------------------------ Giờ hoạt động */

    /** Giờ hoạt động theo ngày (0 = Chủ nhật). Cũng được module đặt bàn dùng để kiểm tra giờ hợp lệ. */
    public List<OpeningDay> getOpeningHours() {
        return jdbc.sql("SELECT day_of_week, is_open, open_time, close_time FROM opening_hours ORDER BY day_of_week")
            .query((rs, n) -> new OpeningDay(
                rs.getInt("day_of_week"),
                rs.getBoolean("is_open"),
                Times.hhmm(Db.time(rs, "open_time")),
                Times.hhmm(Db.time(rs, "close_time"))))
            .list();
    }

    @Transactional
    public List<OpeningDay> updateOpeningHours(List<OpeningDay> input) {
        var errors = new ValidationException.Collector();
        for (OpeningDay d : input) {
            if (d.day() < 0 || d.day() > 6) {
                errors.add("general", "Ngày trong tuần không hợp lệ");
                continue;
            }
            if (!d.open()) continue;
            LocalTime open = Times.parseHhmm(d.openTime());
            LocalTime close = Times.parseHhmm(d.closeTime());
            String key = "day-" + d.day();
            if (open == null || close == null) errors.add(key, "Giờ không đúng định dạng HH:mm");
            else if (!close.isAfter(open)) errors.add(key, "Giờ đóng cửa phải sau giờ mở cửa");
        }
        if (input.stream().noneMatch(OpeningDay::open))
            errors.add("general", "Nhà hàng phải mở cửa ít nhất một ngày trong tuần");
        errors.throwIfAny();

        for (OpeningDay d : input) {
            LocalTime open = Times.parseHhmm(d.openTime());
            LocalTime close = Times.parseHhmm(d.closeTime());
            if (d.open() || (open != null && close != null && close.isAfter(open))) {
                jdbc.sql("UPDATE opening_hours SET is_open = ?, open_time = ?, close_time = ? WHERE day_of_week = ?")
                    .params(d.open(), open, close, d.day()).update();
            } else {
                // Ngày nghỉ mà giờ nhập không hợp lệ: chỉ đổi cờ mở/đóng, giữ giờ cũ.
                jdbc.sql("UPDATE opening_hours SET is_open = 0 WHERE day_of_week = ?").param(d.day()).update();
            }
        }
        String summary = getOpeningHours().stream()
            .filter(OpeningDay::open).limit(2)
            .map(d -> WEEKDAYS[d.day()] + " " + d.openTime() + "–" + d.closeTime())
            .reduce((a, b) -> a + "; " + b).orElse("");
        audit.log("settings", "Cập nhật giờ hoạt động", summary + "…");
        return getOpeningHours();
    }

    /* ------------------------------------------------------------ Lịch sao lưu */

    public BackupSchedule getSchedule() {
        return jdbc.sql("SELECT enabled, frequency, weekday, run_time, keep_count FROM backup_schedule WHERE id = 1")
            .query((rs, n) -> new BackupSchedule(
                rs.getBoolean("enabled"), rs.getString("frequency"), rs.getInt("weekday"),
                Times.hhmm(Db.time(rs, "run_time")), rs.getInt("keep_count")))
            .single();
    }

    @Transactional
    public BackupSchedule updateSchedule(BackupSchedule in) {
        var errors = new ValidationException.Collector();
        LocalTime time = Times.parseHhmm(in.time());
        if (time == null) errors.add("time", "Giờ không đúng định dạng HH:mm");
        if (in.keep() < 1 || in.keep() > 60) errors.add("keep", "Số bản lưu giữ từ 1 đến 60");
        if (!"daily".equals(in.frequency()) && !"weekly".equals(in.frequency()))
            errors.add("frequency", "Tần suất là hằng ngày hoặc hằng tuần");
        if (in.weekday() < 0 || in.weekday() > 6) errors.add("weekday", "Ngày trong tuần không hợp lệ");
        errors.throwIfAny();

        jdbc.sql("UPDATE backup_schedule SET enabled = ?, frequency = ?, weekday = ?, run_time = ?, keep_count = ? WHERE id = 1")
            .params(in.enabled(), in.frequency(), in.weekday(), time, in.keep()).update();
        audit.log("settings", "Cập nhật lịch sao lưu", in.enabled()
            ? "Tự động sao lưu " + ("daily".equals(in.frequency()) ? "hằng ngày" : "mỗi " + WEEKDAYS[in.weekday()])
                + " lúc " + in.time() + ", giữ " + in.keep() + " bản"
            : "Tắt sao lưu tự động");
        return getSchedule();
    }

    private static String nz(String s) {
        return s == null ? "" : s;
    }

    private static String nullIfBlank(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }
}
