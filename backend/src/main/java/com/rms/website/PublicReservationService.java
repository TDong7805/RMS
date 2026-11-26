package com.rms.website;

import com.rms.common.BusinessException;
import com.rms.common.Ids;
import com.rms.common.Rules;
import com.rms.common.Times;
import com.rms.common.ValidationException;
import com.rms.common.Vi;
import com.rms.notification.NotificationService;
import com.rms.reservation.ReservationFormConfigService;
import com.rms.reservation.ReservationFormConfigService.FormConfig;
import com.rms.reservation.ReservationRules;
import com.rms.reservation.ReservationService;
import com.rms.reservation.ReservationRules.Candidate;
import com.rms.reservation.ReservationRules.Valid;
import com.rms.website.PublicSiteService.AreaOption;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Khách tự đặt bàn trên website (không đăng nhập) — tạo lịch thật trong bảng reservations để Quản lý xử lý ở
 * /quan-ly/dat-ban/lich-su (nguồn "Website", người tạo NULL = khách tự đặt).
 *
 * Quy tắc: dùng chung ReservationRules.validate (bắt buộc, SĐT, số khách, giờ mở cửa, sức chứa, trùng lịch) như phía
 * Quản lý, cộng thêm các giới hạn chỉ áp dụng cho khách theo cấu hình form đặt bàn: đặt trước tối thiểu lead_time phút,
 * tối đa max_days_ahead ngày, email bắt buộc / ghi chú theo cấu hình.
 * Không chọn khu (hoặc cấu hình không cho chọn): hệ thống chọn khu đầu tiên còn bàn trống đủ chỗ.
 * Chưa xếp bàn (table_id NULL); trạng thái "Chờ xác nhận", hoặc "Đã xác nhận" khi bật tự xác nhận.
 * Không ghi nhật ký hoạt động (nhật ký gắn với tài khoản nhân viên) — thay bằng thông báo cho Quản lý nhà hàng.
 */
@Service
public class PublicReservationService {
    /** Mỗi SĐT tối đa bấy nhiêu lịch còn hiệu lực sắp tới (chống giữ chỗ ảo). */
    static final int MAX_UPCOMING_PER_PHONE = 3;
    private static final DateTimeFormatter DAY = DateTimeFormatter.ofPattern("EEEE dd/MM", Locale.forLanguageTag("vi"));

    public record ReservationInput(String customerName, String phone, String email, Integer guests, String date,
                                   String time, String areaId, String note) {}

    /** status: pending (Chờ xác nhận) | confirmed (khi bật tự xác nhận). dateTime: ISO UTC. */
    public record ReservationResult(String code, String status, String customerName, int guests, String dateTime,
                                    String areaName) {}

    private final JdbcClient jdbc;
    private final ReservationRules rules;
    private final ReservationFormConfigService formConfig;
    private final PublicSiteService site;
    private final NotificationService notifications;
    private final PublicRateLimiter limiter;
    private final ReservationService reservations;

    public PublicReservationService(JdbcClient jdbc, ReservationRules rules, ReservationFormConfigService formConfig,
                                    PublicSiteService site, NotificationService notifications, PublicRateLimiter limiter,
                                    ReservationService reservations) {
        this.reservations = reservations;
        this.jdbc = jdbc;
        this.rules = rules;
        this.formConfig = formConfig;
        this.site = site;
        this.notifications = notifications;
        this.limiter = limiter;
    }

    @Transactional
    public ReservationResult create(ReservationInput in, String clientIp) {
        FormConfig cfg = formConfig.get();
        Map<String, String> extra = new LinkedHashMap<>();

        // Giới hạn riêng của khách (phía Quản lý sửa lịch không bị áp).
        LocalDate date = Times.parseDate(in.date());
        LocalTime time = Times.parseHhmm(in.time());
        LocalDate today = Times.today();
        if (date != null && date.isAfter(today.plusDays(cfg.maxDaysAhead()))) {
            extra.put("date", "Chỉ nhận đặt bàn trước tối đa " + cfg.maxDaysAhead() + " ngày");
        }
        if (date != null && time != null) {
            LocalDateTime start = LocalDateTime.of(date, time);
            LocalDateTime earliest = Times.now().plusMinutes(cfg.leadTimeMinutes());
            if (!start.isBefore(Times.now()) && start.isBefore(earliest)) {
                extra.put("time", "Vui lòng đặt trước ít nhất " + cfg.leadTimeMinutes() + " phút (sớm nhất "
                    + Times.hhmm(earliest.toLocalTime())
                    + (earliest.toLocalDate().equals(date) ? "" : " ngày " + earliest.toLocalDate().format(DateTimeFormatter.ofPattern("dd/MM")))
                    + ")");
            }
        }
        String email = Vi.trim(in.email());
        if (email.isEmpty() && cfg.requireEmail()) extra.put("email", "Vui lòng nhập email");
        else if (!email.isEmpty() && !Rules.EMAIL.matcher(email).matches()) extra.put("email", "Email không đúng định dạng");
        else if (email.length() > 150) extra.put("email", "Email tối đa 150 ký tự");
        String note = cfg.allowNote() ? Vi.trim(in.note()) : "";

        Valid v = validateWithArea(in, note, cfg, extra);
        String phone = v.phone();

        List<String> sameTime = jdbc.sql("""
                SELECT code FROM reservations
                WHERE phone = ? AND reserved_at = ? AND status IN ('pending','confirmed','seated')
                """).params(phone, v.start()).query(String.class).list();
        if (!sameTime.isEmpty()) {
            throw new BusinessException("Số điện thoại này đã đặt bàn vào đúng thời điểm này (mã " + sameTime.get(0)
                + "). Nhà hàng sẽ liên hệ xác nhận, bạn không cần đặt lại.");
        }
        int upcoming = jdbc.sql("""
                SELECT COUNT(*) FROM reservations
                WHERE phone = ? AND status IN ('pending','confirmed') AND reserved_at >= ?
                """).params(phone, Times.now()).query(Integer.class).single();
        if (upcoming >= MAX_UPCOMING_PER_PHONE) {
            throw new BusinessException("Số điện thoại này đã có " + upcoming
                + " lịch đặt sắp tới. Vui lòng gọi nhà hàng để được hỗ trợ thêm.");
        }
        // Chỉ tính lượt khi yêu cầu hợp lệ: khách sửa lỗi form nhiều lần không bị chặn oan.
        long wait = limiter.tryAcquire("reservation:" + (clientIp == null ? "unknown" : clientIp));
        if (wait > 0) {
            throw new BusinessException("Bạn đã gửi quá nhiều yêu cầu đặt bàn. Vui lòng thử lại sau " + wait + " phút.",
                HttpStatus.TOO_MANY_REQUESTS);
        }

        Long customerId = customerId(v.customerName(), phone, email);
        String code = reservations.nextCode();
        String status = cfg.autoConfirm() ? "confirmed" : "pending";
        jdbc.sql("""
                INSERT INTO reservations (code, customer_id, customer_name, phone, email, guests, reserved_at, duration_minutes,
                                          area_id, table_id, note, status, source, created_by)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, 'website', NULL)
                """)
            .params(code, customerId, v.customerName(), phone, email.isEmpty() ? null : email, v.guests(), v.start(),
                v.durationMinutes(), v.areaId(), v.note().isEmpty() ? null : v.note(), status)
            .update();
        long id = jdbc.sql("SELECT LAST_INSERT_ID()").query(Long.class).single();

        String areaName = jdbc.sql("SELECT name FROM areas WHERE id = ?").param(v.areaId()).query(String.class).single();
        String when = Times.hhmm(v.start().toLocalTime()) + " " + v.start().format(DAY);
        notifications.sendToRoles("reservation",
            (cfg.autoConfirm() ? "Lịch đặt bàn mới (đã tự xác nhận) " : "Lịch đặt bàn mới cần xác nhận ") + code,
            v.customerName() + " · " + phone + " · " + v.guests() + " khách · " + when + " · " + areaName
                + (v.note().isEmpty() ? "" : " · Ghi chú: " + v.note()),
            "reservations", id, List.of("manager", "cashier"));
        return new ReservationResult(code, status, v.customerName(), v.guests(), Times.iso(v.start()), areaName);
    }

    /**
     * Khách chọn khu (khi được phép): kiểm tra đúng khu đó. Không chọn: thử lần lượt các khu nhận đặt — lỗi duy nhất là
     * "khu hết bàn" thì thử khu kế tiếp; lỗi khác (SĐT, giờ…) trả ngay vì đổi khu cũng không hết lỗi.
     * Lỗi riêng của khách (extra) được gộp với lỗi của quy tắc chung để form hiện đủ trong một lượt.
     */
    private Valid validateWithArea(ReservationInput in, String note, FormConfig cfg, Map<String, String> extra) {
        List<AreaOption> areas = site.bookableAreas();
        if (areas.isEmpty()) {
            throw new BusinessException("Nhà hàng tạm ngưng nhận đặt bàn trực tuyến. Vui lòng gọi hotline để đặt bàn.");
        }
        String chosen = cfg.allowAreaChoice() ? Ids.str(Ids.parseOrNull(in.areaId())) : null;
        if (chosen != null && areas.stream().noneMatch(a -> a.id().equals(chosen))) {
            extra.putIfAbsent("areaId", "Khu vực này hiện không nhận đặt bàn trực tuyến");
        }
        List<String> tryAreas = chosen != null ? List.of(chosen) : areas.stream().map(AreaOption::id).toList();

        for (String areaId : tryAreas) {
            Valid v;
            try {
                v = rules.validate(new Candidate(in.customerName(), in.phone(), in.guests(), in.date(), in.time(), areaId,
                    null, note), null);
            } catch (ValidationException ex) {
                boolean onlyAreaFull = ex.fields().keySet().equals(Set.of("areaId"));
                if (chosen == null && onlyAreaFull) continue;
                Map<String, String> merged = new LinkedHashMap<>(extra);
                ex.fields().forEach(merged::putIfAbsent);
                throw new ValidationException(merged);
            }
            if (!extra.isEmpty()) throw new ValidationException(extra);
            return v;
        }
        // Không chọn khu và mọi khu đều kín chỗ trong khung giờ này.
        extra.putIfAbsent("time", "Khung giờ này đã kín chỗ cho " + in.guests() + " khách. Vui lòng chọn giờ khác hoặc gọi nhà hàng.");
        throw new ValidationException(extra);
    }

    /** Khách vãng lai theo SĐT (customers.phone là UNIQUE): có rồi thì dùng lại, chưa có thì tạo. */
    private Long customerId(String name, String phone, String email) {
        jdbc.sql("""
                INSERT INTO customers (full_name, phone, email) VALUES (?, ?, ?)
                ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id)
                """)
            .params(name, phone, email.isEmpty() ? null : email)
            .update();
        return jdbc.sql("SELECT LAST_INSERT_ID()").query(Long.class).single();
    }

    /** DB-1027…: bộ đếm doc_sequences 'DB' (V24 khởi tạo nối tiếp mã đã có), khóa dòng nên không trùng khi đặt đồng thời. */
}
