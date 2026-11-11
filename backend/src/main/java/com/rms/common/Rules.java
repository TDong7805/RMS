package com.rms.common;

import java.util.regex.Pattern;

/** Quy tắc định dạng dùng chung, khớp với frontend (lib/mock.ts) để hai phía luôn đồng nhất. */
public final class Rules {
    public static final Pattern PHONE = Pattern.compile("^(0|\\+84)(3|5|7|8|9)\\d{8}$");
    public static final Pattern EMAIL = Pattern.compile("^[^\\s@]+@[^\\s@]+\\.[^\\s@]{2,}$");

    public static final int PASSWORD_MIN = 8;
    /** bcrypt chỉ dùng 72 byte đầu; giới hạn để mật khẩu dài hơn không bị cắt âm thầm. */
    public static final int PASSWORD_MAX = 64;

    private Rules() {}

    /** Mật khẩu: 8–64 ký tự, có cả chữ và số (trùng quy tắc form tạo tài khoản ở frontend). Trả null nếu hợp lệ. */
    public static String passwordError(String password) {
        if (password == null || password.isEmpty()) return "Vui lòng nhập mật khẩu mới";
        if (password.length() < PASSWORD_MIN || password.length() > PASSWORD_MAX
            || !password.chars().anyMatch(Character::isLetter) || !password.chars().anyMatch(Character::isDigit)) {
            return "Mật khẩu từ 8 đến 64 ký tự, gồm cả chữ và số";
        }
        return null;
    }
}
