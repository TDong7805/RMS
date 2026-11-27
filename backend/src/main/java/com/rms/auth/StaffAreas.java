package com.rms.auth;

import java.util.Map;

/**
 * Vai trò được phép đăng nhập trang nội bộ và trang chủ của từng vai trò.
 *
 * Quản lý nhà hàng (gộp cả Quản trị viên), Thu ngân, Nhân viên bếp, Quản lý kho, Nhân viên phục vụ (từ V20)
 * đăng nhập; Khách hàng không đăng nhập. Vai trò không có trong danh sách này thì không đăng nhập được.
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
        "warehouse", "/kho",
        "waiter", "/phuc-vu"
    );

    /** Vai trò tự chấm công bằng khuôn mặt và có trang "Thông tin của tôi" (/api/toi/**). */
    public static final java.util.Set<String> SELF_SERVICE = java.util.Set.of("waiter", "cashier", "kitchen");

    public static boolean canLogin(String role) {
        return HOME.containsKey(role);
    }

    public static String home(String role) {
        return HOME.getOrDefault(role, "/dang-nhap");
    }

    /**
     * Vai trò có hai loại tài khoản (V30): MÀN HÌNH CHUNG (users.shared_screen = 1, vd. khu.thu.ngan, khu.bep) chỉ mở màn
     * làm việc; tài khoản RIÊNG chỉ mở Cổng nhân viên (/nhan-vien: chấm công, ca, phiếu lương, hồ sơ; thu ngân thêm việc
     * văn phòng: sửa chấm công, bảng lương).
     */
    public static final java.util.Set<String> SCREEN_ROLES = java.util.Set.of("cashier", "kitchen");

    /** Cổng nhân viên của tài khoản riêng thu ngân / bếp. */
    public static final String STAFF_PORTAL = "/nhan-vien";

    public static final String SCREEN_SUFFIX = "_SCREEN";
    public static final String SELF_SUFFIX = "_SELF";

    /** Màn hình chung chỉ có ý nghĩa với thu ngân / bếp; cờ ở vai trò khác bị bỏ qua. */
    public static boolean isSharedScreen(String role, boolean sharedFlag) {
        return sharedFlag && SCREEN_ROLES.contains(role);
    }

    /** Trang chủ theo vai trò + loại tài khoản. */
    public static String home(String role, boolean sharedFlag) {
        if (SCREEN_ROLES.contains(role) && !sharedFlag) return STAFF_PORTAL;
        return home(role);
    }

    /** Quyền Spring Security tương ứng vai trò, vd. manager → ROLE_MANAGER. */
    public static String authority(String role) {
        return "ROLE_" + role.toUpperCase();
    }

    /**
     * Mọi quyền của một tài khoản: quyền vai trò; thu ngân / bếp thêm CASHIER_SCREEN | CASHIER_SELF | KITCHEN_SCREEN |
     * KITCHEN_SELF (SecurityConfig dùng để tách màn làm việc và Cổng nhân viên).
     */
    public static java.util.List<String> authorities(String role, boolean sharedFlag) {
        if (!SCREEN_ROLES.contains(role)) return java.util.List.of(authority(role));
        return java.util.List.of(authority(role), role.toUpperCase() + (sharedFlag ? SCREEN_SUFFIX : SELF_SUFFIX));
    }

    /** Phiên hiện tại có quyền màn hình chung không (để phát hiện quản lý vừa đổi loại tài khoản). */
    static boolean sessionShared(java.util.Collection<? extends org.springframework.security.core.GrantedAuthority> granted) {
        return granted.stream().anyMatch(g -> g.getAuthority().endsWith(SCREEN_SUFFIX));
    }

    /** Quyền tạm khi phải đổi mật khẩu: chỉ gọi được /api/auth/**, mọi API nghiệp vụ trả 403. */
    public static final String PASSWORD_CHANGE_REQUIRED = "PASSWORD_CHANGE_REQUIRED";
}
