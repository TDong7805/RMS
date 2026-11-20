package com.rms.selfservice;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.rms.audit.AuditService;
import com.rms.common.BusinessException;
import com.rms.common.CurrentUserService;
import com.rms.common.Db;
import com.rms.common.Ids;
import com.rms.common.Times;
import com.rms.common.ValidationException;
import com.rms.common.Vi;
import com.rms.notification.NotificationService;
import com.rms.storage.ImageStore;
import com.rms.storage.StorageService;
import java.time.LocalDateTime;
import java.util.List;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Khuôn mặt đăng ký để chấm công (face_profiles).
 *
 * Trình duyệt (face-api) tính "mã khuôn mặt" 128 số từ ảnh camera; máy chủ lưu mã + ảnh đăng ký, quản lý xem ảnh rồi duyệt.
 * Khi chấm công, máy chủ so mã gửi lên với mã đã duyệt bằng khoảng cách Euclid (càng nhỏ càng giống).
 * Ảnh khuôn mặt lưu ở thư mục "khuon-mat" — KHÔNG phục vụ công khai qua /uploads (SecurityConfig), chỉ xem qua API có kiểm quyền.
 */
@Service
public class FaceService {
    public static final int DESCRIPTOR_SIZE = 128;
    static final String FOLDER = "khuon-mat";

    public record FaceStatus(String status, String rejectReason, String createdAt, String reviewedAt) {}

    public record EnrollInput(List<Double> descriptor, String photo, Boolean consent) {}

    public record FaceRow(String id, String userId, String fullName, String username, String roleName, String status,
                          String createdAt, String consentAt, String reviewedName, String reviewedAt, String rejectReason) {}

    public record RejectInput(String reason) {}

    private final JdbcClient jdbc;
    private final StorageService storage;
    private final ImageStore images;
    private final CurrentUserService currentUser;
    private final AuditService audit;
    private final NotificationService notifications;
    private final ObjectMapper json = new ObjectMapper();

    public FaceService(JdbcClient jdbc, StorageService storage, ImageStore images, CurrentUserService currentUser, AuditService audit,
                       NotificationService notifications) {
        this.jdbc = jdbc;
        this.storage = storage;
        this.images = images;
        this.currentUser = currentUser;
        this.audit = audit;
        this.notifications = notifications;
    }

    private static String iso(LocalDateTime t) {
        return t == null ? null : Times.iso(t);
    }

    /** Kiểm tra mã khuôn mặt: đúng 128 số hữu hạn (face-api cho giá trị khoảng −1…1). */
    static double[] descriptor(List<Double> in, String field) {
        if (in == null || in.size() != DESCRIPTOR_SIZE) {
            throw new ValidationException(field, "Không nhận diện được khuôn mặt, vui lòng thử lại");
        }
        double[] d = new double[DESCRIPTOR_SIZE];
        for (int i = 0; i < DESCRIPTOR_SIZE; i++) {
            Double v = in.get(i);
            if (v == null || !Double.isFinite(v) || Math.abs(v) > 2) {
                throw new ValidationException(field, "Không nhận diện được khuôn mặt, vui lòng thử lại");
            }
            d[i] = v;
        }
        return d;
    }

    static double distance(double[] a, double[] b) {
        double sum = 0;
        for (int i = 0; i < a.length; i++) sum += (a[i] - b[i]) * (a[i] - b[i]);
        return Math.sqrt(sum);
    }

    /** Ảnh camera (data URL) → lưu vào thư mục folder, trả khóa; file bị xóa nếu giao dịch không lưu được. */
    String savePhoto(String folder, String dataUrl, String field) {
        if (dataUrl == null || !dataUrl.startsWith("data:image/")) throw new ValidationException(field, "Thiếu ảnh chụp từ camera");
        // ImageStore: kiểm tra + chuẩn hóa ảnh (bỏ dữ liệu ẩn), xóa file nếu giao dịch không lưu được.
        return images.apply(folder, dataUrl, null, field);
    }

    /* ------------------------------------------------------------------ Nhân viên */

    public FaceStatus status(long userId) {
        return jdbc.sql("SELECT status, reject_reason, created_at, reviewed_at FROM face_profiles WHERE user_id = ?").param(userId)
            .query((rs, n) -> new FaceStatus(rs.getString("status"), rs.getString("reject_reason"), iso(Db.dateTime(rs, "created_at")),
                iso(Db.dateTime(rs, "reviewed_at"))))
            .optional().orElse(new FaceStatus("none", null, null, null));
    }

    /** Đăng ký / đăng ký lại (khi chưa duyệt hoặc bị từ chối). Đã duyệt thì phải nhờ quản lý đặt lại. */
    @Transactional
    public FaceStatus enroll(EnrollInput in) {
        var me = currentUser.get();
        if (in == null || !Boolean.TRUE.equals(in.consent())) {
            throw new ValidationException("consent", "Bạn cần đồng ý cho nhà hàng thu thập dữ liệu khuôn mặt để chấm công");
        }
        double[] d = descriptor(in.descriptor(), "descriptor");
        String old = jdbc.sql("SELECT status FROM face_profiles WHERE user_id = ? FOR UPDATE").param(me.id()).query(String.class).optional().orElse(null);
        if ("approved".equals(old)) {
            throw new BusinessException("Khuôn mặt của bạn đã được duyệt. Nhờ quản lý \"Yêu cầu đăng ký lại\" nếu cần đổi.");
        }
        String oldPhoto = jdbc.sql("SELECT photo_url FROM face_profiles WHERE user_id = ?").param(me.id()).query(String.class).optional().orElse(null);
        String key = savePhoto(FOLDER, in.photo(), "photo");
        String descJson;
        try {
            descJson = json.writeValueAsString(d);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException(e);
        }
        LocalDateTime now = Times.now();
        jdbc.sql("""
                INSERT INTO face_profiles (user_id, descriptor, photo_url, status, consent_at, created_at)
                VALUES (?, ?, ?, 'pending', ?, ?)
                ON DUPLICATE KEY UPDATE descriptor = VALUES(descriptor), photo_url = VALUES(photo_url), status = 'pending',
                  consent_at = VALUES(consent_at), created_at = VALUES(created_at), reviewed_by = NULL, reviewed_at = NULL, reject_reason = NULL
                """).params(me.id(), descJson, key, now, now).update();
        images.deleteAfterCommit(oldPhoto);
        audit.log("attendance", "Đăng ký khuôn mặt", me.fullName() + " gửi khuôn mặt chờ duyệt", "users", me.id());
        notifications.sendToRoles("attendance", me.fullName() + " đăng ký khuôn mặt chấm công", "Vào Chấm công → Khuôn mặt để duyệt",
            "users", me.id(), List.of("manager"));
        return status(me.id());
    }

    /** Mã khuôn mặt đã duyệt của nhân viên; chưa có / chưa duyệt → null. */
    double[] approvedDescriptor(long userId) {
        String raw = jdbc.sql("SELECT descriptor FROM face_profiles WHERE user_id = ? AND status = 'approved'").param(userId)
            .query(String.class).optional().orElse(null);
        if (raw == null) return null;
        try {
            return json.readValue(raw, double[].class);
        } catch (JsonProcessingException e) {
            return null;
        }
    }

    /** Ảnh đăng ký của chính mình. */
    public Photo ownPhoto() {
        String key = jdbc.sql("SELECT photo_url FROM face_profiles WHERE user_id = ?").param(currentUser.get().id())
            .query(String.class).optional().orElse(null);
        return Photo.of(storage, key);
    }

    /* ------------------------------------------------------------------ Quản lý */

    /** status: pending (mặc định) | approved | rejected | all. */
    public List<FaceRow> list(String status) {
        String s = Vi.blank(status) ? "pending" : status;
        String where = "all".equals(s) ? "" : " WHERE f.status = ?";
        var q = jdbc.sql("""
                SELECT f.*, u.full_name, u.username, r.name AS role_name, rv.full_name AS reviewed_name
                FROM face_profiles f JOIN users u ON u.id = f.user_id JOIN roles r ON r.id = u.role_id
                LEFT JOIN users rv ON rv.id = f.reviewed_by
                """ + where + " ORDER BY f.status = 'pending' DESC, f.created_at DESC");
        if (!where.isEmpty()) q = q.param(s);
        return q.query((rs, n) -> new FaceRow(Ids.str(rs.getLong("id")), Ids.str(rs.getLong("user_id")), rs.getString("full_name"),
                rs.getString("username"), rs.getString("role_name"), rs.getString("status"), iso(Db.dateTime(rs, "created_at")),
                iso(Db.dateTime(rs, "consent_at")), rs.getString("reviewed_name"), iso(Db.dateTime(rs, "reviewed_at")),
                rs.getString("reject_reason")))
            .list();
    }

    private record Head(long id, long userId, String name, String status, String photo) {}

    private Head lock(String idText) {
        long id = Ids.parse(idText, "Không tìm thấy khuôn mặt đăng ký");
        return jdbc.sql("""
                SELECT f.id, f.user_id, u.full_name, f.status, f.photo_url FROM face_profiles f JOIN users u ON u.id = f.user_id
                WHERE f.id = ? FOR UPDATE
                """).param(id)
            .query((rs, n) -> new Head(rs.getLong(1), rs.getLong(2), rs.getString(3), rs.getString(4), rs.getString(5))).optional()
            .orElseThrow(() -> BusinessException.notFound("Không tìm thấy khuôn mặt đăng ký"));
    }

    @Transactional
    public FaceRow approve(String idText) {
        Head h = lock(idText);
        jdbc.sql("UPDATE face_profiles SET status = 'approved', reviewed_by = ?, reviewed_at = ?, reject_reason = NULL WHERE id = ?")
            .params(currentUser.get().id(), Times.now(), h.id()).update();
        audit.log("attendance", "Duyệt khuôn mặt", "Duyệt khuôn mặt chấm công của " + h.name(), "users", h.userId());
        notifications.sendToUser("attendance", "Khuôn mặt chấm công đã được duyệt", "Bạn đã chấm công bằng khuôn mặt được",
            "users", h.userId(), h.userId());
        return row(h.id());
    }

    @Transactional
    public FaceRow reject(String idText, RejectInput in) {
        String reason = Vi.collapse(in == null ? null : in.reason());
        if (reason.isEmpty()) throw new ValidationException("reason", "Vui lòng nhập lý do (vd. ảnh mờ, không đúng người)");
        if (reason.length() > 200) throw new ValidationException("reason", "Lý do tối đa 200 ký tự");
        Head h = lock(idText);
        jdbc.sql("UPDATE face_profiles SET status = 'rejected', reviewed_by = ?, reviewed_at = ?, reject_reason = ? WHERE id = ?")
            .params(currentUser.get().id(), Times.now(), reason, h.id()).update();
        audit.log("attendance", "Từ chối khuôn mặt", h.name() + ": " + reason, "users", h.userId());
        notifications.sendToUser("attendance", "Khuôn mặt chấm công bị từ chối", reason + " — vui lòng đăng ký lại",
            "users", h.userId(), h.userId());
        return row(h.id());
    }

    /** Yêu cầu đăng ký lại: xóa khuôn mặt (kể cả đã duyệt) — nhân viên đăng ký lại từ đầu. */
    @Transactional
    public void reset(String idText) {
        Head h = lock(idText);
        jdbc.sql("DELETE FROM face_profiles WHERE id = ?").param(h.id()).update();
        images.deleteAfterCommit(h.photo());
        audit.log("attendance", "Yêu cầu đăng ký lại khuôn mặt", h.name(), "users", h.userId());
        notifications.sendToUser("attendance", "Vui lòng đăng ký lại khuôn mặt chấm công", "Quản lý đã yêu cầu bạn đăng ký lại",
            "users", h.userId(), h.userId());
    }

    private FaceRow row(long id) {
        return list("all").stream().filter(r -> r.id().equals(Ids.str(id))).findFirst()
            .orElseThrow(() -> BusinessException.notFound("Không tìm thấy khuôn mặt đăng ký"));
    }

    public Photo photo(String idText) {
        long id = Ids.parse(idText, "Không tìm thấy ảnh");
        String key = jdbc.sql("SELECT photo_url FROM face_profiles WHERE id = ?").param(id).query(String.class).optional().orElse(null);
        return Photo.of(storage, key);
    }
}
