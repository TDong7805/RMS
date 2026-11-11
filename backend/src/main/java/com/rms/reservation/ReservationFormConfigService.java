package com.rms.reservation;
import com.rms.common.Db;

import com.rms.audit.AuditService;
import com.rms.common.CurrentUserService;
import com.rms.common.Times;
import com.rms.common.ValidationException;
import com.rms.common.Vi;
import java.util.Set;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Cấu hình form đặt bàn phía khách hàng (bảng một dòng reservation_form_config). */
@Service
public class ReservationFormConfigService {

    public record FormConfig(int slotMinutes, int durationMinutes, int minGuests, int maxGuests, int leadTimeMinutes,
                             int maxDaysAhead, boolean requireEmail, boolean allowAreaChoice, boolean allowNote,
                             boolean autoConfirm, String notice, String updatedAt) {}

    public record FormConfigInput(Integer slotMinutes, Integer durationMinutes, Integer minGuests, Integer maxGuests,
                                  Integer leadTimeMinutes, Integer maxDaysAhead, boolean requireEmail,
                                  boolean allowAreaChoice, boolean allowNote, boolean autoConfirm, String notice) {}

    private final JdbcClient jdbc;
    private final AuditService audit;
    private final CurrentUserService currentUser;

    public ReservationFormConfigService(JdbcClient jdbc, AuditService audit, CurrentUserService currentUser) {
        this.jdbc = jdbc;
        this.audit = audit;
        this.currentUser = currentUser;
    }

    public FormConfig get() {
        return jdbc.sql("SELECT * FROM reservation_form_config WHERE id = 1")
            .query((rs, n) -> new FormConfig(
                rs.getInt("slot_minutes"), rs.getInt("duration_minutes"), rs.getInt("min_guests"),
                rs.getInt("max_guests"), rs.getInt("lead_time_minutes"), rs.getInt("max_days_ahead"),
                rs.getBoolean("require_email"), rs.getBoolean("allow_area_choice"), rs.getBoolean("allow_note"),
                rs.getBoolean("auto_confirm"), rs.getString("notice") == null ? "" : rs.getString("notice"),
                Times.iso(Db.dateTime(rs, "updated_at"))))
            .single();
    }

    @Transactional
    public FormConfig update(FormConfigInput in) {
        var e = new ValidationException.Collector();
        if (in.slotMinutes() == null || !Set.of(15, 30, 60).contains(in.slotMinutes()))
            e.add("slotMinutes", "Bước thời gian là 15, 30 hoặc 60 phút");
        if (in.durationMinutes() == null || in.durationMinutes() < 30 || in.durationMinutes() > 360)
            e.add("durationMinutes", "Thời lượng mỗi lượt từ 30 đến 360 phút");
        if (in.minGuests() == null || in.minGuests() < 1) e.add("minGuests", "Tối thiểu 1 khách");
        if (in.maxGuests() == null || (in.minGuests() != null && in.maxGuests() < in.minGuests()))
            e.add("maxGuests", "Số khách tối đa phải lớn hơn hoặc bằng số khách tối thiểu");
        else if (in.maxGuests() > 50) e.add("maxGuests", "Tối đa 50 khách cho mỗi lịch đặt");
        if (in.leadTimeMinutes() == null || in.leadTimeMinutes() < 0 || in.leadTimeMinutes() > 1440)
            e.add("leadTimeMinutes", "Từ 0 đến 1440 phút");
        if (in.maxDaysAhead() == null || in.maxDaysAhead() < 1 || in.maxDaysAhead() > 180)
            e.add("maxDaysAhead", "Từ 1 đến 180 ngày");
        String notice = Vi.trim(in.notice());
        if (notice.length() > 500) e.add("notice", "Lưu ý tối đa 500 ký tự");
        e.throwIfAny();

        jdbc.sql("""
                UPDATE reservation_form_config SET slot_minutes = ?, duration_minutes = ?, min_guests = ?, max_guests = ?,
                  lead_time_minutes = ?, max_days_ahead = ?, require_email = ?, allow_area_choice = ?, allow_note = ?,
                  auto_confirm = ?, notice = ?, updated_by = ?
                WHERE id = 1
                """)
            .params(in.slotMinutes(), in.durationMinutes(), in.minGuests(), in.maxGuests(), in.leadTimeMinutes(),
                in.maxDaysAhead(), in.requireEmail(), in.allowAreaChoice(), in.allowNote(), in.autoConfirm(),
                notice.isEmpty() ? null : notice, currentUser.get().id())
            .update();
        audit.log("reservation", "Cập nhật form đặt bàn", "Lượt " + in.durationMinutes() + " phút, " + in.minGuests()
            + "–" + in.maxGuests() + " khách, đặt trước tối đa " + in.maxDaysAhead() + " ngày");
        return get();
    }
}
