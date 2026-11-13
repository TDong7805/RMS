package com.rms.shift;

import com.rms.shift.ShiftService.AssignInput;
import com.rms.shift.ShiftService.Assignment;
import com.rms.shift.ShiftService.Employee;
import com.rms.shift.ShiftService.Shift;
import com.rms.shift.ShiftService.ShiftInput;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * GET    /api/shifts                              danh sách ca (theo giờ bắt đầu) kèm số lượt phân công
 * POST   /api/shifts                              {"name", "startTime": "HH:mm", "endTime", "color": "#RRGGBB", "note"}
 * PUT    /api/shifts/{id}
 * DELETE /api/shifts/{id}                         409 nếu ca đã có phân công
 * GET    /api/employees?from=&to=                 nhân viên cho lịch phân công (status: active | locked | deleted)
 * GET    /api/shift-assignments?from=&to=         phân công trong khoảng ngày (YYYY-MM-DD, tối đa 62 ngày)
 * POST   /api/shift-assignments                   {"employeeId", "shiftId", "dates": ["YYYY-MM-DD", ...]}
 * DELETE /api/shift-assignments/{id}              hủy phân công (không hủy được ngày đã qua)
 */
@RestController
public class ShiftController {
    private final ShiftService service;

    public ShiftController(ShiftService service) {
        this.service = service;
    }

    @GetMapping("/api/shifts")
    public List<Shift> list() {
        return service.list();
    }

    @PostMapping("/api/shifts")
    public Shift create(@RequestBody ShiftInput in) {
        return service.create(in);
    }

    @PutMapping("/api/shifts/{id}")
    public Shift update(@PathVariable String id, @RequestBody ShiftInput in) {
        return service.update(id, in);
    }

    @DeleteMapping("/api/shifts/{id}")
    public ResponseEntity<Void> delete(@PathVariable String id) {
        service.delete(id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/api/employees")
    public List<Employee> employees(@RequestParam(defaultValue = "") String from, @RequestParam(defaultValue = "") String to) {
        return service.employees(from, to);
    }

    @GetMapping("/api/shift-assignments")
    public List<Assignment> assignments(@RequestParam String from, @RequestParam String to) {
        return service.assignments(from, to);
    }

    @PostMapping("/api/shift-assignments")
    public List<Assignment> assign(@RequestBody AssignInput in) {
        return service.assign(in);
    }

    @DeleteMapping("/api/shift-assignments/{id}")
    public ResponseEntity<Void> unassign(@PathVariable String id) {
        service.unassign(id);
        return ResponseEntity.noContent().build();
    }
}
