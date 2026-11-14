package com.rms.payroll;

import com.rms.common.ValidationException;
import com.rms.payroll.AttendanceService.Employee;
import com.rms.payroll.AttendanceService.ImportInput;
import com.rms.payroll.AttendanceService.ImportResult;
import com.rms.payroll.AttendanceService.Input;
import com.rms.payroll.AttendanceService.ListResponse;
import com.rms.payroll.AttendanceService.Preview;
import com.rms.payroll.AttendanceService.RawLine;
import com.rms.payroll.AttendanceService.Row;
import com.rms.payroll.PayrollService.CreateInput;
import com.rms.payroll.PayrollService.Detail;
import com.rms.payroll.PayrollService.LineInput;
import com.rms.payroll.PayrollService.Payslip;
import com.rms.payroll.PayrollService.Period;
import java.io.IOException;
import java.util.List;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

/**
 * Khu Thu ngân — chấm công và bảng lương (vai trò cashier):
 * GET    /api/thu-ngan/employees                               nhân viên (kể cả đã khóa)
 * GET    /api/thu-ngan/attendance?userId&from&to               chấm công (tối đa 62 ngày) + tổng giờ theo nhân viên
 * POST   /api/thu-ngan/attendance                              thêm tay {userId, date, checkIn, checkOut, note}
 * PUT    /api/thu-ngan/attendance/{id}                         sửa
 * DELETE /api/thu-ngan/attendance/{id}                         xóa
 * GET    /api/thu-ngan/attendance/template                     file mẫu .xlsx
 * POST   /api/thu-ngan/attendance/preview   (multipart file)   đọc file, kiểm tra từng dòng
 * POST   /api/thu-ngan/attendance/import                       {fileName, duplicateMode: skip|overwrite, lines}
 * POST   /api/thu-ngan/attendance/errors                       {lines} → file .xlsx các dòng lỗi
 * GET    /api/thu-ngan/payroll                                 danh sách kỳ lương
 * POST   /api/thu-ngan/payroll                                 tạo kỳ {name, startDate, endDate}
 * GET    /api/thu-ngan/payroll/{id}                            bảng lương
 * POST   /api/thu-ngan/payroll/{id}/recalculate                tính lại
 * PUT    /api/thu-ngan/payroll/{id}/lines/{userId}             phụ cấp / khấu trừ {allowance, deduction, note}
 * POST   /api/thu-ngan/payroll/{id}/close                      chốt
 * GET    /api/thu-ngan/payroll/{id}/lines/{userId}/payslip     phiếu lương
 */
@RestController
public class PayrollController {
    private static final MediaType XLSX = MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");

    private final AttendanceService attendance;
    private final PayrollService payroll;

    public PayrollController(AttendanceService attendance, PayrollService payroll) {
        this.attendance = attendance;
        this.payroll = payroll;
    }

    private static ResponseEntity<byte[]> xlsx(String fileName, byte[] data) {
        return ResponseEntity.ok().contentType(XLSX)
            .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment().filename(fileName, java.nio.charset.StandardCharsets.UTF_8).build().toString())
            .body(data);
    }

    @GetMapping("/api/thu-ngan/employees")
    public List<Employee> employees() {
        return attendance.employees();
    }

    @GetMapping("/api/thu-ngan/attendance")
    public ListResponse list(@RequestParam(required = false) String userId, @RequestParam(required = false) String from,
                             @RequestParam(required = false) String to) {
        return attendance.list(userId, from, to);
    }

    @PostMapping("/api/thu-ngan/attendance")
    public Row create(@RequestBody Input in) {
        return attendance.create(in);
    }

    @PutMapping("/api/thu-ngan/attendance/{id}")
    public Row update(@PathVariable String id, @RequestBody Input in) {
        return attendance.update(id, in);
    }

    @DeleteMapping("/api/thu-ngan/attendance/{id}")
    public ResponseEntity<Void> delete(@PathVariable String id) {
        attendance.delete(id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/api/thu-ngan/attendance/template")
    public ResponseEntity<byte[]> template() {
        return xlsx("mau-cham-cong.xlsx", attendance.template());
    }

    @PostMapping(value = "/api/thu-ngan/attendance/preview", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public Preview preview(@RequestPart(value = "file", required = false) MultipartFile file) throws IOException {
        if (file == null || file.isEmpty()) throw new ValidationException("file", "Vui lòng chọn file");
        if (file.getSize() > AttendanceService.MAX_BYTES) throw new ValidationException("file", "File tối đa 2 MB");
        return attendance.preview(file.getOriginalFilename(), file.getBytes());
    }

    @PostMapping("/api/thu-ngan/attendance/import")
    public ImportResult importLines(@RequestBody ImportInput in) {
        return attendance.importLines(in);
    }

    public record ErrorsInput(List<RawLine> lines) {}

    @PostMapping("/api/thu-ngan/attendance/errors")
    public ResponseEntity<byte[]> errors(@RequestBody ErrorsInput in) {
        return xlsx("cham-cong-dong-loi.xlsx", attendance.errorFile(in.lines()));
    }

    @GetMapping("/api/thu-ngan/payroll")
    public List<Period> periods() {
        return payroll.periods();
    }

    @PostMapping("/api/thu-ngan/payroll")
    public Detail create(@RequestBody CreateInput in) {
        return payroll.create(in);
    }

    @GetMapping("/api/thu-ngan/payroll/{id}")
    public Detail detail(@PathVariable String id) {
        return payroll.detail(id);
    }

    @PostMapping("/api/thu-ngan/payroll/{id}/recalculate")
    public Detail recalculate(@PathVariable String id) {
        return payroll.recalculate(id);
    }

    @PutMapping("/api/thu-ngan/payroll/{id}/lines/{userId}")
    public Detail updateLine(@PathVariable String id, @PathVariable String userId, @RequestBody LineInput in) {
        return payroll.updateLine(id, userId, in);
    }

    @PostMapping("/api/thu-ngan/payroll/{id}/close")
    public Detail close(@PathVariable String id) {
        return payroll.close(id);
    }

    @GetMapping("/api/thu-ngan/payroll/{id}/lines/{userId}/payslip")
    public Payslip payslip(@PathVariable String id, @PathVariable String userId) {
        return payroll.payslip(id, userId);
    }
}
