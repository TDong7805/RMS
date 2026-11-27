package com.rms.selfservice;

import com.rms.audit.AuditService;
import com.rms.common.BusinessException;
import com.rms.common.CurrentUserService;
import com.rms.common.Db;
import com.rms.common.Ids;
import com.rms.common.IpNetworks;
import com.rms.common.SystemSettings;
import com.rms.common.Times;
import com.rms.shift.DutyService;
import com.rms.shift.DutyService.Duty;
import com.rms.storage.ImageStore;
import com.rms.storage.StorageService;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Tự chấm công bằng khuôn mặt (phục vụ, thu ngân, bếp) trên điện thoại của mình.
 *
 * Vào ca — lần lượt kiểm tra: đang dùng WiFi quán (IP thuộc danh sách cấu hình; trống = không kiểm tra) → khuôn mặt đã duyệt
 * → người thật trước camera (trình duyệt kiểm tra nháy mắt / quay đầu) → khuôn mặt khớp (khoảng cách ≤ ngưỡng) → đang có ca
 * cho vào (sớm tối đa N phút) và chưa chấm ca đó. Đạt hết mới lưu: giờ vào, ảnh, IP, độ lệch, số phút đi trễ.
 * Tan ca — cùng các bước kiểm tra, đóng lần vào ca đang mở: giờ ra, ảnh, số phút về sớm.
 * Quên tan ca → dòng "Thiếu giờ ra" (sẵn có), thu ngân sửa tay ở trang Chấm công. Lương tính theo giờ thực tế.
 * Ảnh tự xóa sau N ngày (cấu hình), giờ chấm công giữ nguyên.
 */
@Service
public class ClockService {
    private static final Logger log = LoggerFactory.getLogger(ClockService.class);
    public static final String NETWORKS_KEY = "attendance.allowed_networks";
    public static final String THRESHOLD_KEY = "attendance.face_threshold";
    public static final String RETENTION_KEY = "attendance.photo_retention_days";
    static final String FOLDER = "cham-cong";
    /** Vào ca quá số giờ này mà chưa tan ca → không cho tan ca bằng khuôn mặt nữa (thu ngân sửa tay). */
    static final int MAX_SHIFT_HOURS = 16;

    public record ClockInput(List<Double> descriptor, String photo, Boolean liveness) {}

    public record DutyBrief(String assignmentId, String shiftName, String start, String end, String areaName) {}

    public record OpenRecord(String id, String checkIn, String shiftName, Integer lateMinutes) {}

    public record TodayRow(String id, String date, String checkIn, String checkOut, Integer lateMinutes, Integer earlyMinutes,
                           String source) {}

    /**
     * Trạng thái màn hình chấm công. networkChecked = quán có cấu hình WiFi; face: none | pending | approved | rejected.
     * current: ca đang cho vào (chưa chấm); open: lần vào ca chưa tan.
     */
    public record ClockStatus(String ip, boolean networkChecked, boolean networkOk, FaceService.FaceStatus face, double threshold,
                              DutyBrief current, DutyBrief next, OpenRecord open, List<TodayRow> recent) {}

    private final JdbcClient jdbc;
    private final DutyService duty;
    private final FaceService faces;
    private final SystemSettings settings;
    private final CurrentUserService currentUser;
    private final AuditService audit;
    private final ImageStore images;
    private final StorageService storage;

    public ClockService(JdbcClient jdbc, DutyService duty, FaceService faces, SystemSettings settings, CurrentUserService currentUser,
                        AuditService audit, ImageStore images, StorageService storage) {
        this.jdbc = jdbc;
        this.duty = duty;
        this.faces = faces;
        this.settings = settings;
        this.currentUser = currentUser;
        this.audit = audit;
        this.images = images;
        this.storage = storage;
    }

    /** Ngưỡng riêng của thu ngân / bếp (V30) — chặt hơn phục vụ. */
    public static final String COUNTER_THRESHOLD_KEY = "attendance.face_threshold_counter";

    /** Ngưỡng của nhân viên phục vụ. */
    double threshold() {
        double t = settings.decimal(THRESHOLD_KEY, 0.4);
        return t < 0.2 || t > 0.8 ? 0.4 : t;
    }

    /** Ngưỡng của thu ngân / bếp. */
    double counterThreshold() {
        double t = settings.decimal(COUNTER_THRESHOLD_KEY, 0.3);
        return t < 0.2 || t > 0.8 ? 0.3 : t;
    }

    /** Ngưỡng áp cho vai trò (thu ngân / bếp dùng ngưỡng riêng, chặt hơn). */
    double thresholdFor(String role) {
        return com.rms.auth.StaffAreas.SCREEN_ROLES.contains(role) ? counterThreshold() : threshold();
    }

    boolean networkChecked() {
        return !IpNetworks.parseLenient(settings.string(NETWORKS_KEY, "")).isEmpty();
    }

    boolean networkOk(String ip) {
        var nets = IpNetworks.parseLenient(settings.string(NETWORKS_KEY, ""));
        return nets.isEmpty() || IpNetworks.matches(ip, nets);
    }

    private static DutyBrief brief(Duty d) {
        return d == null ? null : new DutyBrief(Ids.str(d.assignmentId()), d.shiftName(), Times.iso(d.start()), Times.iso(d.end()),
            d.areaName());
    }

    /** Ca đang cho vào mà chưa có chấm công. */
    private Duty currentDuty(long userId, LocalDateTime now) {
        return duty.checkInWindow(userId, now).stream()
            .filter(d -> jdbc.sql("SELECT COUNT(*) FROM attendances WHERE assignment_id = ?").param(d.assignmentId())
                .query(Integer.class).single() == 0)
            .findFirst().orElse(null);
    }

    private record Open(long id, LocalDateTime checkIn, Long assignmentId, Integer late) {}

    private Open openRecord(long userId, LocalDateTime now) {
        return jdbc.sql("""
                SELECT id, check_in, assignment_id, late_minutes FROM attendances
                WHERE user_id = ? AND check_out IS NULL AND check_in > ? ORDER BY check_in DESC LIMIT 1
                """).params(userId, now.minusHours(MAX_SHIFT_HOURS))
            .query((rs, n) -> new Open(rs.getLong("id"), Db.dateTime(rs, "check_in"),
                rs.getObject("assignment_id") == null ? null : rs.getLong("assignment_id"),
                rs.getObject("late_minutes") == null ? null : rs.getInt("late_minutes")))
            .optional().orElse(null);
    }

    public ClockStatus status(String ip) {
        long me = currentUser.get().id();
        LocalDateTime now = Times.now();
        Open open = openRecord(me, now);
        OpenRecord openOut = null;
        if (open != null) {
            String shift = open.assignmentId() == null ? null : jdbc.sql(
                    "SELECT s.name FROM shift_assignments sa JOIN shifts s ON s.id = sa.shift_id WHERE sa.id = ?")
                .param(open.assignmentId()).query(String.class).optional().orElse(null);
            openOut = new OpenRecord(Ids.str(open.id()), Times.iso(open.checkIn()), shift, open.late());
        }
        List<TodayRow> recent = jdbc.sql("""
                SELECT id, work_date, check_in, check_out, late_minutes, early_minutes, source FROM attendances
                WHERE user_id = ? AND work_date >= ? ORDER BY check_in DESC LIMIT 10
                """).params(me, now.toLocalDate().minusDays(1))
            .query((rs, n) -> new TodayRow(Ids.str(rs.getLong("id")), rs.getDate("work_date").toLocalDate().toString(),
                Times.iso(Db.dateTime(rs, "check_in")), Db.dateTime(rs, "check_out") == null ? null : Times.iso(Db.dateTime(rs, "check_out")),
                (Integer) rs.getObject("late_minutes", Integer.class), (Integer) rs.getObject("early_minutes", Integer.class),
                rs.getString("source")))
            .list();
        return new ClockStatus(ip, networkChecked(), networkOk(ip), faces.status(me), thresholdFor(currentUser.get().role()),
            open == null ? brief(currentDuty(me, now)) : null, brief(duty.next(me, now)), openOut, recent);
    }

    /** Các bước kiểm tra chung của vào ca / tan ca; trả độ lệch khuôn mặt. */
    private double verify(long userId, String ip, ClockInput in) {
        if (!networkOk(ip)) {
            throw new BusinessException("Bạn cần kết nối WiFi của quán để chấm công (IP hiện tại: " + ip + ")");
        }
        double[] registered = faces.approvedDescriptor(userId);
        if (registered == null) {
            String st = faces.status(userId).status();
            throw new BusinessException("pending".equals(st) ? "Khuôn mặt của bạn đang chờ quản lý duyệt"
                : "Bạn chưa đăng ký khuôn mặt (hoặc đã bị từ chối) — hãy đăng ký trước khi chấm công");
        }
        if (in == null || !Boolean.TRUE.equals(in.liveness())) {
            throw new BusinessException("Chưa xác nhận người thật trước camera — vui lòng nháy mắt hoặc quay đầu theo hướng dẫn");
        }
        double[] d = FaceService.descriptor(in.descriptor(), "descriptor");
        double dist = FaceService.distance(registered, d);
        double limit = thresholdFor(currentUser.get().role());
        if (dist > limit) {
            log.info("Chấm công: khuôn mặt không khớp user={} dist={} limit={}", userId, String.format("%.3f", dist), limit);
            throw new BusinessException("Khuôn mặt không khớp với khuôn mặt đã đăng ký. Hãy đứng nơi đủ sáng, nhìn thẳng camera rồi thử lại.");
        }
        return dist;
    }

    private static BigDecimal dec(double v) {
        return BigDecimal.valueOf(v).setScale(4, RoundingMode.HALF_UP);
    }

    @Transactional
    public ClockStatus checkIn(String ip, ClockInput in) {
        var me = currentUser.get();
        jdbc.sql("SELECT id FROM users WHERE id = ? FOR UPDATE").param(me.id()).query(Long.class).single(); // một lần chấm tại một thời điểm
        LocalDateTime now = Times.now().truncatedTo(ChronoUnit.SECONDS);
        double dist = verify(me.id(), ip, in);
        if (openRecord(me.id(), now) != null) throw new BusinessException("Bạn đang trong ca — hãy bấm Tan ca");
        Duty d = currentDuty(me.id(), now);
        if (d == null) {
            Duty next = duty.next(me.id(), now);
            throw new BusinessException("Bạn không có ca nào lúc này (được vào sớm tối đa " + duty.earlyMinutes() + " phút)"
                + (next == null ? "" : ". Ca tiếp theo: " + next.shiftName() + " lúc " + Times.hhmm(next.start().toLocalTime())
                    + " ngày " + next.start().toLocalDate().format(java.time.format.DateTimeFormatter.ofPattern("dd/MM"))));
        }
        boolean closed = jdbc.sql("SELECT COUNT(*) FROM payroll_periods WHERE status = 'closed' AND ? BETWEEN start_date AND end_date")
            .param(d.workDate()).query(Integer.class).single() > 0;
        if (closed) throw new BusinessException("Ngày làm việc thuộc kỳ lương đã chốt, không chấm công được");
        int late = (int) Math.max(0, Duration.between(d.start(), now).toMinutes());
        String photo = faces.savePhoto(FOLDER, in.photo(), "photo");
        jdbc.sql("""
                INSERT INTO attendances (assignment_id, user_id, work_date, check_in, check_in_photo, check_in_ip, check_in_distance,
                                         late_minutes, source, created_by, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'camera', ?, ?)
                """).params(d.assignmentId(), me.id(), d.workDate(), now, photo, ip, dec(dist), late, me.id(), now).update();
        long id = jdbc.sql("SELECT LAST_INSERT_ID()").query(Long.class).single();
        audit.log("attendance", "Vào ca", me.fullName() + " vào " + d.shiftName() + " lúc " + Times.hhmm(now.toLocalTime())
            + (late > 0 ? " (trễ " + late + " phút)" : ""), "attendances", id);
        return status(ip);
    }

    @Transactional
    public ClockStatus checkOut(String ip, ClockInput in) {
        var me = currentUser.get();
        jdbc.sql("SELECT id FROM users WHERE id = ? FOR UPDATE").param(me.id()).query(Long.class).single();
        LocalDateTime now = Times.now().truncatedTo(ChronoUnit.SECONDS);
        double dist = verify(me.id(), ip, in);
        Open open = openRecord(me.id(), now);
        if (open == null) throw new BusinessException("Bạn chưa vào ca (hoặc lần vào ca đã quá " + MAX_SHIFT_HOURS + " giờ — nhờ thu ngân sửa tay)");
        if (!now.isAfter(open.checkIn())) throw new BusinessException("Bạn vừa vào ca, vui lòng thử lại sau ít phút");
        Integer early = null;
        if (open.assignmentId() != null) {
            Duty d = duty.ofUser(me.id(), open.checkIn().toLocalDate().minusDays(1), open.checkIn().toLocalDate().plusDays(1)).stream()
                .filter(x -> x.assignmentId() == open.assignmentId()).findFirst().orElse(null);
            if (d != null) early = (int) Math.max(0, Duration.between(now, d.end()).toMinutes());
        }
        String photo = faces.savePhoto(FOLDER, in.photo(), "photo");
        jdbc.sql("""
                UPDATE attendances SET check_out = ?, check_out_photo = ?, check_out_ip = ?, check_out_distance = ?, early_minutes = ?,
                       updated_by = ?, updated_at = ? WHERE id = ?
                """).params(now, photo, ip, dec(dist), early, me.id(), now, open.id()).update();
        audit.log("attendance", "Tan ca", me.fullName() + " tan ca lúc " + Times.hhmm(now.toLocalTime())
            + (early != null && early > 0 ? " (về sớm " + early + " phút)" : ""), "attendances", open.id());
        return status(ip);
    }

    /* ------------------------------------------------------------------ Ảnh chấm công */

    /** kind: in | out. ownerId != null → chỉ xem ảnh của chính mình. */
    public Photo photo(String idText, String kind, Long ownerId) {
        long id = Ids.parse(idText, "Không tìm thấy chấm công");
        String col = "out".equals(kind) ? "check_out_photo" : "check_in_photo";
        var row = jdbc.sql("SELECT user_id, " + col + " FROM attendances WHERE id = ?").param(id)
            .query((rs, n) -> new Object[] {rs.getLong(1), rs.getString(2)}).optional()
            .orElseThrow(() -> BusinessException.notFound("Không tìm thấy chấm công"));
        if (ownerId != null && (long) row[0] != ownerId) throw BusinessException.notFound("Không tìm thấy chấm công");
        return Photo.of(storage, (String) row[1]);
    }

    /** 3:20 sáng mỗi ngày: xóa ảnh chấm công cũ hơn N ngày (giữ giờ chấm công). */
    @Scheduled(cron = "0 20 3 * * *", zone = "Asia/Ho_Chi_Minh")
    @Transactional
    public void purgeOldPhotos() {
        int days = Math.max(7, settings.integer(RETENTION_KEY, 90));
        LocalDateTime before = Times.now().minusDays(days);
        List<Object[]> rows = jdbc.sql("""
                SELECT id, check_in_photo, check_out_photo FROM attendances
                WHERE photos_purged_at IS NULL AND (check_in_photo IS NOT NULL OR check_out_photo IS NOT NULL) AND check_in < ?
                LIMIT 5000
                """).param(before).query((rs, n) -> new Object[] {rs.getLong(1), rs.getString(2), rs.getString(3)}).list();
        LocalDateTime now = Times.now();
        for (Object[] r : rows) {
            images.deleteAfterCommit((String) r[1]);
            images.deleteAfterCommit((String) r[2]);
            jdbc.sql("UPDATE attendances SET check_in_photo = NULL, check_out_photo = NULL, photos_purged_at = ? WHERE id = ?")
                .params(now, r[0]).update();
        }
        if (!rows.isEmpty()) log.info("Đã xóa ảnh chấm công của {} lượt (cũ hơn {} ngày)", rows.size(), days);
    }
}
