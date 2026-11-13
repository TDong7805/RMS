package com.rms.warehouse;

import com.rms.warehouse.IssueService.Employee;
import com.rms.warehouse.IssueService.IssueDetail;
import com.rms.warehouse.IssueService.IssueInput;
import com.rms.warehouse.IssueService.IssuePage;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Xuất kho (Quản lý kho):
 * GET  /api/kho/issues?keyword=&reason=all|kitchen|damaged|expired|other&from=&to=&page=   mặc định 30 ngày
 * GET  /api/kho/issues/{id}
 * POST /api/kho/issues        {reason, receiverId, note, lines: [{ingredientId, qty}]}
 * GET  /api/kho/employees     nhân viên đang hoạt động (người nhận khi xuất cho bếp)
 */
@RestController
public class IssueController {
    private final IssueService service;

    public IssueController(IssueService service) {
        this.service = service;
    }

    @GetMapping("/api/kho/issues")
    public IssuePage list(@RequestParam(defaultValue = "") String keyword, @RequestParam(defaultValue = "all") String reason,
                          @RequestParam(defaultValue = "") String from, @RequestParam(defaultValue = "") String to,
                          @RequestParam(defaultValue = "1") int page) {
        return service.list(keyword, reason, from, to, page);
    }

    @GetMapping("/api/kho/issues/{id}")
    public IssueDetail detail(@PathVariable String id) {
        return service.detail(id);
    }

    @PostMapping("/api/kho/issues")
    public IssueDetail create(@RequestBody IssueInput in) {
        return service.create(in);
    }

    @GetMapping("/api/kho/employees")
    public List<Employee> employees() {
        return service.employees();
    }
}
