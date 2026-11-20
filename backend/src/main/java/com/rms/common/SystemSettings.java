package com.rms.common;

import java.util.Optional;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;

/** Đọc / ghi bảng system_settings (khóa – giá trị). Giá trị sai định dạng thì dùng mặc định. */
@Component
public class SystemSettings {
    private final JdbcClient jdbc;

    public SystemSettings(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    public Optional<String> get(String key) {
        return jdbc.sql("SELECT setting_value FROM system_settings WHERE setting_key = ?").param(key).query(String.class).optional();
    }

    public String string(String key, String fallback) {
        return get(key).map(String::trim).orElse(fallback);
    }

    public int integer(String key, int fallback) {
        try {
            return get(key).map(v -> Integer.parseInt(v.trim())).orElse(fallback);
        } catch (NumberFormatException e) {
            return fallback;
        }
    }

    public double decimal(String key, double fallback) {
        try {
            return get(key).map(v -> Double.parseDouble(v.trim())).orElse(fallback);
        } catch (NumberFormatException e) {
            return fallback;
        }
    }

    public void put(String key, String value, String type, long userId) {
        jdbc.sql("""
                INSERT INTO system_settings (setting_key, setting_value, value_type, updated_by) VALUES (?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_by = VALUES(updated_by)
                """).params(key, value, type, userId).update();
    }
}
