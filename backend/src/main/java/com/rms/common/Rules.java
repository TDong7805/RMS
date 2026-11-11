package com.rms.common;

import java.util.regex.Pattern;

/** Quy tắc định dạng dùng chung, khớp với frontend (lib/mock.ts) để hai phía luôn đồng nhất. */
public final class Rules {
    public static final Pattern PHONE = Pattern.compile("^(0|\\+84)(3|5|7|8|9)\\d{8}$");
    public static final Pattern EMAIL = Pattern.compile("^[^\\s@]+@[^\\s@]+\\.[^\\s@]{2,}$");

    private Rules() {}
}
