package com.rms.auth;

import java.util.Map;

/**
 * Vai trò được phép đăng nhập trang nội bộ và trang chủ của từng vai trò.
 *
 * Theo đặc tả (5 actor): Quản lý nhà hàng (gộp cả Quản trị viên), Thu ngân, Nhân viên bếp, Quản lý kho
 * đăng nhập; Khách hàng không đăng nhập. Vai trò khác trong bảng roles (vd. waiter — nhân viên phục vụ
 * chỉ để xếp ca/tính lương) không có trong danh sách này nên không đăng nhập được.
 *
 * Thêm actor mới đăng nhập được: thêm một dòng ở đây + khu vực trang tương ứng ở frontend.
 *
 * Trang quản lý nằm dưới /quan-ly (frontend lib/paths.ts — MANAGER_HOME); "/" để dành cho website khách hàng.
 */
public final class StaffAreas {
    private StaffAreas() {}

    public static final Map<String, String> HOME = Map.of(
        "manager", "/quan-ly",
        "cashier", "/thu-ngan",
        "kitchen", "/bep",
        "warehouse", "/kho"
    );

    public static boolean canLogin(String role) {
        return HOME.containsKey(role);
    }

    public static String home(String role) {
        return HOME.getOrDefault(role, "/dang-nhap");
    }

    /** Quyền Spring Security tương ứng vai trò, vd. manager → ROLE_MANAGER. */
    public static String authority(String role) {
        return "ROLE_" + role.toUpperCase();
    }

    /** Quyền tạm khi phải đổi mật khẩu: chỉ gọi được /api/auth/**, mọi API nghiệp vụ trả 403. */
    public static final String PASSWORD_CHANGE_REQUIRED = "PASSWORD_CHANGE_REQUIRED";
}
