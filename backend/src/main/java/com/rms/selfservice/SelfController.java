package com.rms.selfservice;

import com.rms.payroll.AttendanceService;
import com.rms.payroll.PayrollService;
import com.rms.selfservice.ClockService.ClockInput;
import com.rms.selfservice.ClockService.ClockStatus;
import com.rms.selfservice.SelfService.PayslipRow;
import com.rms.selfservice.SelfService.Profile;
import com.rms.selfservice.SelfService.ProfileInput;
import com.rms.selfservice.SelfService.ShiftRow;
import com.rms.common.CurrentUserService;
import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * "Thông tin của tôi" — Nhân viên phục vụ, Thu ngân, Nhân viên bếp (SecurityConfig: /api/toi/**):
 * GET  /api/toi/profile                       hồ sơ
 * PUT  /api/toi/profile                       {email, phone}  (đổi mật khẩu: POST /api/auth/change-password)
 * GET  /api/toi/shifts?from&to                ca được phân (mặc định tháng này, tối đa 62 ngày)
 * GET  /api/toi/attendance?from&to            chấm công của mình (mới nhất trước)
 * GET  /api/toi/attendance/{id}/photo/{in|out}  ảnh chấm công của mình
 * GET  /api/toi/payslips                      kỳ lương đã chốt có tên mình
 * GET  /api/toi/payslips/{periodId}           phiếu lương
 * GET  /api/toi/face                          trạng thái khuôn mặt {status: none|pending|approved|rejected, rejectReason}
 * POST /api/toi/face                          {descriptor: [128 số], photo: data URL, consent: true} đăng ký khuôn mặt
 * GET  /api/toi/face/photo                    ảnh đăng ký của mình
 * GET  /api/toi/clock                         trạng thái chấm công (IP, WiFi quán, ca hiện tại / kế tiếp, lần vào ca đang mở)
 * POST /api/toi/clock/in                      {descriptor, photo, liveness: true} vào ca
 * POST /api/toi/clock/out                     {descriptor, photo, liveness: true} tan ca
 */
@RestController
public class SelfController {
    private final SelfService self;
    private final FaceService faces;
    private final ClockService clock;
    private final CurrentUserService currentUser;

    public SelfController(SelfService self, FaceService faces, ClockService clock, CurrentUserService currentUser) {
        this.self = self;
        this.faces = faces;
        this.clock = clock;
        this.currentUser = currentUser;
    }

    /** IP của máy khách (sau proxy tin cậy: server.forward-headers-strategy=native đọc X-Forwarded-For). */
    static String clientIp(HttpServletRequest req) {
        return req.getRemoteAddr();
    }

    @GetMapping("/api/toi/profile")
    public Profile profile() {
        return self.profile();
    }

    @PutMapping("/api/toi/profile")
    public Profile updateProfile(@RequestBody ProfileInput in) {
        return self.updateProfile(in);
    }

    @GetMapping("/api/toi/shifts")
    public List<ShiftRow> shifts(@RequestParam(required = false) String from, @RequestParam(required = false) String to) {
        return self.shifts(from, to);
    }

    @GetMapping("/api/toi/attendance")
    public List<AttendanceService.Row> attendance(@RequestParam(required = false) String from, @RequestParam(required = false) String to) {
        return self.attendance(from, to);
    }

    @GetMapping("/api/toi/attendance/{id}/photo/{kind}")
    public ResponseEntity<byte[]> attendancePhoto(@PathVariable String id, @PathVariable String kind) {
        return clock.photo(id, kind, currentUser.get().id()).response();
    }

    @GetMapping("/api/toi/payslips")
    public List<PayslipRow> payslips() {
        return self.payslips();
    }

    @GetMapping("/api/toi/payslips/{periodId}")
    public PayrollService.Payslip payslip(@PathVariable String periodId) {
        return self.payslip(periodId);
    }

    @GetMapping("/api/toi/face")
    public FaceService.FaceStatus face() {
        return faces.status(currentUser.get().id());
    }

    @PostMapping("/api/toi/face")
    public FaceService.FaceStatus enroll(@RequestBody FaceService.EnrollInput in) {
        return faces.enroll(in);
    }

    @GetMapping("/api/toi/face/photo")
    public ResponseEntity<byte[]> facePhoto() {
        return faces.ownPhoto().response();
    }

    @GetMapping("/api/toi/clock")
    public ClockStatus clock(HttpServletRequest req) {
        return clock.status(clientIp(req));
    }

    @PostMapping("/api/toi/clock/in")
    public ClockStatus checkIn(HttpServletRequest req, @RequestBody ClockInput in) {
        return clock.checkIn(clientIp(req), in);
    }

    @PostMapping("/api/toi/clock/out")
    public ClockStatus checkOut(HttpServletRequest req, @RequestBody ClockInput in) {
        return clock.checkOut(clientIp(req), in);
    }
}
