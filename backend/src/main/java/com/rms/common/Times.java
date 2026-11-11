package com.rms.common;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;

/** Mọi DATETIME trong CSDL là giờ nhà hàng (Asia/Ho_Chi_Minh); API trao đổi ISO-8601 UTC. */
public final class Times {
    public static final ZoneId ZONE = ZoneId.of("Asia/Ho_Chi_Minh");
    private static final DateTimeFormatter HHMM = DateTimeFormatter.ofPattern("HH:mm");

    private Times() {}

    public static LocalDateTime now() {
        return LocalDateTime.now(ZONE);
    }

    public static LocalDate today() {
        return LocalDate.now(ZONE);
    }

    /** LocalDateTime (giờ nhà hàng) → "2026-11-11T12:30:00Z". */
    public static String iso(LocalDateTime t) {
        return t == null ? null : t.atZone(ZONE).toInstant().toString();
    }

    public static LocalDateTime fromIso(String iso) {
        return LocalDateTime.ofInstant(Instant.parse(iso), ZONE);
    }

    /** TIME của MySQL → "08:30". */
    public static String hhmm(LocalTime t) {
        return t == null ? null : t.format(HHMM);
    }

    /** "08:30" → LocalTime; sai định dạng → null. */
    public static LocalTime parseHhmm(String s) {
        try {
            return s == null ? null : LocalTime.parse(s, HHMM);
        } catch (DateTimeParseException e) {
            return null;
        }
    }

    /** "2026-11-11" → LocalDate; sai định dạng → null. */
    public static LocalDate parseDate(String s) {
        try {
            return s == null || s.isBlank() ? null : LocalDate.parse(s);
        } catch (DateTimeParseException e) {
            return null;
        }
    }

    public static int minutes(LocalTime t) {
        return t.getHour() * 60 + t.getMinute();
    }

    public static String minutesToHhmm(int total) {
        int t = ((total % 1440) + 1440) % 1440;
        return String.format("%02d:%02d", t / 60, t % 60);
    }
}
