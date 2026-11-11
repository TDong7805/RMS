package com.rms.common;

import java.text.Normalizer;
import java.util.Locale;
import java.util.regex.Pattern;

/** Tiện ích chuỗi tiếng Việt, khớp hành vi của frontend (normalize.ts / mock.ts). */
public final class Vi {
    private static final Pattern MARKS = Pattern.compile("\\p{M}+");
    private static final Pattern SPACES = Pattern.compile("\\s+");
    private static final Pattern NON_SLUG = Pattern.compile("[^a-z0-9]+");

    private Vi() {}

    /** "Quản lý món ăn" → "quan ly mon an" (bỏ dấu, hạ chữ thường). */
    public static String normalize(String input) {
        if (input == null) return "";
        String s = Normalizer.normalize(input, Normalizer.Form.NFD);
        s = MARKS.matcher(s).replaceAll("").replace('đ', 'd').replace('Đ', 'D');
        return s.toLowerCase(Locale.ROOT).trim();
    }

    public static boolean matches(String text, String keyword) {
        String k = normalize(keyword);
        return k.isEmpty() || normalize(text).contains(k);
    }

    public static boolean blank(String s) {
        return s == null || s.isBlank();
    }

    /** Gộp khoảng trắng liên tiếp và cắt hai đầu. */
    public static String collapse(String s) {
        return s == null ? "" : SPACES.matcher(s).replaceAll(" ").trim();
    }

    public static String slugify(String input) {
        String s = normalize(input);
        s = NON_SLUG.matcher(s).replaceAll("-");
        return s.replaceAll("^-+|-+$", "");
    }

    /** null → "" và cắt khoảng trắng hai đầu. */
    public static String trim(String s) {
        return s == null ? "" : s.trim();
    }
}
