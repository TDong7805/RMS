package com.rms.auth;

import java.io.Serializable;

/**
 * Người dùng đã đăng nhập, lưu trong session (vì vậy phải Serializable).
 * Chỉ giữ thông tin định danh; trạng thái khóa/vai trò được kiểm tra lại với CSDL ở mỗi request
 * (xem {@link ActiveUserFilter}) để quản lý khóa tài khoản là có hiệu lực ngay.
 */
public record AuthUser(long id, String username, String fullName, String role) implements Serializable {}
