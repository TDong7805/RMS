package com.rms.account;

import com.rms.account.AccountService.Account;
import com.rms.account.AccountService.AccountInput;
import com.rms.account.AccountService.TempPassword;
import com.rms.common.Paged;
import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * GET    /api/accounts?keyword=&role=&status=&page=   danh sách (10 dòng/trang)
 * GET    /api/accounts/{id}
 * POST   /api/accounts                                tạo (body: username, fullName, email, phone, role, password)
 * PUT    /api/accounts/{id}                           sửa thông tin + vai trò
 * PATCH  /api/accounts/{id}/status                    {"status": "active" | "locked"}
 * POST   /api/accounts/{id}/reset-password            → {"password": "mật khẩu tạm"} (chỉ trả một lần)
 * DELETE /api/accounts/{id}                           xóa mềm
 * Chỉ Quản lý nhà hàng gọi được (SecurityConfig: /api/** → ROLE_MANAGER).
 */
@RestController
@RequestMapping("/api/accounts")
public class AccountController {
    private final AccountService service;

    public AccountController(AccountService service) {
        this.service = service;
    }

    @GetMapping
    public Paged<Account> list(
        @RequestParam(defaultValue = "") String keyword,
        @RequestParam(defaultValue = "all") String role,
        @RequestParam(defaultValue = "all") String status,
        @RequestParam(defaultValue = "1") int page) {
        return service.list(keyword, role, status, page);
    }

    @GetMapping("/{id}")
    public Account get(@PathVariable String id) {
        return service.get(id);
    }

    @PostMapping
    public Account create(@RequestBody AccountInput in) {
        return service.create(in);
    }

    @PutMapping("/{id}")
    public Account update(@PathVariable String id, @RequestBody AccountInput in) {
        return service.update(id, in);
    }

    @PatchMapping("/{id}/status")
    public Account status(@PathVariable String id, @RequestBody Map<String, String> body) {
        return service.setStatus(id, body.get("status"));
    }

    @PostMapping("/{id}/reset-password")
    public ResponseEntity<TempPassword> resetPassword(@PathVariable String id) {
        // Không cho trình duyệt/proxy lưu lại mật khẩu tạm.
        return ResponseEntity.ok().header("Cache-Control", "no-store").body(service.resetPassword(id));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable String id) {
        service.delete(id);
        return ResponseEntity.noContent().build();
    }
}
