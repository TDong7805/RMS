package com.rms.selfservice;

import com.rms.audit.AuditService;
import com.rms.common.CurrentUserService;
import com.rms.common.IpNetworks;
import com.rms.common.SystemSettings;
import com.rms.common.ValidationException;
import com.rms.shift.DutyService;
import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
import java.util.Locale;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Chấm công khuôn mặt — phía Quản lý nhà hàng (/api/** mặc định ROLE_MANAGER) và Thu ngân (xem ảnh ở trang Chấm công):
 * GET    /api/faces?status=pending|approved|rejected|all   khuôn mặt đăng ký
 * GET    /api/faces/{id}/photo                             ảnh đăng ký
 * POST   /api/faces/{id}/approve
 * POST   /api/faces/{id}/reject                            {reason}
 * DELETE /api/faces/{id}                                   yêu cầu đăng ký lại (xóa khuôn mặt)
 * GET    /api/attendance/{id}/photo/{in|out}               ảnh chấm công (quản lý)
 * GET    /api/thu-ngan/attendance/{id}/photo/{in|out}      ảnh chấm công (thu ngân — trang Chấm công)
 * GET    /api/settings/attendance                          {allowedNetworks, earlyMinutes, faceThreshold, faceThresholdCounter, photoRetentionDays, currentIp}
 * PUT    /api/settings/attendance                          {allowedNetworks, earlyMinutes, faceThreshold, faceThresholdCounter, photoRetentionDays}
 */
@RestController
public class AttendanceAdminController {
    /** faceThreshold: phục vụ; faceThresholdCounter: thu ngân / bếp (V30, chặt hơn). */
    public record AttendanceSettings(String allowedNetworks, Integer earlyMinutes, Double faceThreshold, Double faceThresholdCounter,
                                     Integer photoRetentionDays, String currentIp) {}

    private final FaceService faces;
    private final ClockService clock;
    private final SystemSettings settings;
    private final CurrentUserService currentUser;
    private final AuditService audit;

    public AttendanceAdminController(FaceService faces, ClockService clock, SystemSettings settings, CurrentUserService currentUser,
                                     AuditService audit) {
        this.faces = faces;
        this.clock = clock;
        this.settings = settings;
        this.currentUser = currentUser;
        this.audit = audit;
    }

    @GetMapping("/api/faces")
    public List<FaceService.FaceRow> faces(@RequestParam(required = false) String status) {
        return faces.list(status);
    }

    @GetMapping("/api/faces/{id}/photo")
    public ResponseEntity<byte[]> facePhoto(@PathVariable String id) {
        return faces.photo(id).response();
    }

    @PostMapping("/api/faces/{id}/approve")
    public FaceService.FaceRow approve(@PathVariable String id) {
        return faces.approve(id);
    }

    @PostMapping("/api/faces/{id}/reject")
    public FaceService.FaceRow reject(@PathVariable String id, @RequestBody FaceService.RejectInput in) {
        return faces.reject(id, in);
    }

    @DeleteMapping("/api/faces/{id}")
    public ResponseEntity<Void> reset(@PathVariable String id) {
        faces.reset(id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/api/attendance/{id}/photo/{kind}")
    public ResponseEntity<byte[]> photoForManager(@PathVariable String id, @PathVariable String kind) {
        return clock.photo(id, kind, null).response();
    }

    @GetMapping("/api/thu-ngan/attendance/{id}/photo/{kind}")
    public ResponseEntity<byte[]> photoForCashier(@PathVariable String id, @PathVariable String kind) {
        return clock.photo(id, kind, null).response();
    }

    private AttendanceSettings read(HttpServletRequest req) {
        return new AttendanceSettings(settings.string(ClockService.NETWORKS_KEY, ""), settings.integer(DutyService.EARLY_KEY, 30),
            clock.threshold(), clock.counterThreshold(), settings.integer(ClockService.RETENTION_KEY, 90), SelfController.clientIp(req));
    }

    @GetMapping("/api/settings/attendance")
    public AttendanceSettings get(HttpServletRequest req) {
        return read(req);
    }

    @PutMapping("/api/settings/attendance")
    @Transactional
    public AttendanceSettings update(HttpServletRequest req, @RequestBody AttendanceSettings in) {
        var v = new ValidationException.Collector();
        String nets = in.allowedNetworks() == null ? "" : in.allowedNetworks().trim();
        List<IpNetworks.Network> parsed = List.of();
        try {
            parsed = IpNetworks.parse(nets, "allowedNetworks");
        } catch (ValidationException e) {
            v.add("allowedNetworks", e.fields().get("allowedNetworks"));
        }
        if (parsed.size() > 20) v.add("allowedNetworks", "Tối đa 20 IP / dải mạng");
        Integer early = in.earlyMinutes();
        if (early == null || early < 0 || early > 180) v.add("earlyMinutes", "Từ 0 đến 180 phút");
        Double th = in.faceThreshold();
        if (th == null || th < 0.3 || th > 0.7) v.add("faceThreshold", "Từ 0,3 (chặt) đến 0,7 (dễ)");
        Double thc = in.faceThresholdCounter() == null ? clock.counterThreshold() : in.faceThresholdCounter();
        if (thc < 0.2 || thc > 0.6) v.add("faceThresholdCounter", "Từ 0,2 (rất chặt) đến 0,6 (dễ)");
        Integer days = in.photoRetentionDays();
        if (days == null || days < 7 || days > 365) v.add("photoRetentionDays", "Từ 7 đến 365 ngày");
        v.throwIfAny();
        long me = currentUser.get().id();
        String normalized = String.join(", ", parsed.stream().map(IpNetworks.Network::text).toList());
        settings.put(ClockService.NETWORKS_KEY, normalized, "string", me);
        settings.put(DutyService.EARLY_KEY, String.valueOf(early), "number", me);
        settings.put(ClockService.THRESHOLD_KEY, String.format(Locale.ROOT, "%.2f", th), "number", me);
        settings.put(ClockService.COUNTER_THRESHOLD_KEY, String.format(Locale.ROOT, "%.2f", thc), "number", me);
        settings.put(ClockService.RETENTION_KEY, String.valueOf(days), "number", me);
        audit.log("settings", "Cập nhật chấm công khuôn mặt",
            (normalized.isEmpty() ? "Không kiểm tra WiFi" : "WiFi quán: " + normalized) + " · vào sớm " + early + " phút · ngưỡng phục vụ "
                + String.format(Locale.ROOT, "%.2f", th) + " · ngưỡng thu ngân / bếp " + String.format(Locale.ROOT, "%.2f", thc) + " · giữ ảnh " + days + " ngày");
        return read(req);
    }
}
