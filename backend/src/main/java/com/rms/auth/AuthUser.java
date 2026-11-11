package com.rms.auth;

import java.io.Serializable;
import java.security.Principal;

/**
 * Người dùng đã đăng nhập, lưu trong session (vì vậy phải Serializable — phiên được ghi vào MySQL).
 * Chỉ giữ thông tin định danh; trạng thái khóa/vai trò được kiểm tra lại với CSDL ở mỗi request
 * (xem {@link ActiveUserFilter}) để quản lý khóa tài khoản là có hiệu lực ngay.
 *
 * Là {@link Principal}: Spring Security lấy {@link #getName()} (tên đăng nhập) làm tên người dùng của phiên,
 * Spring Session lưu vào cột SPRING_SESSION.PRINCIPAL_NAME (tối đa 100 ký tự).
 */
public record AuthUser(long id, String username, String fullName, String role) implements Principal, Serializable {
    @Override
    public String getName() {
        return username;
    }
}
