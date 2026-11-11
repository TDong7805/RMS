package com.rms.common;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.LocalDateTime;
import java.time.LocalTime;

/**
 * Đọc cột thời gian đúng giá trị đã lưu (không để driver tự quy đổi múi giờ).
 * DATETIME/TIME trong CSDL luôn là giờ nhà hàng — xem Times.ZONE.
 */
public final class Db {
    private Db() {}

    public static LocalDateTime dateTime(ResultSet rs, String column) throws SQLException {
        return rs.getObject(column, LocalDateTime.class);
    }

    public static LocalTime time(ResultSet rs, String column) throws SQLException {
        return rs.getObject(column, LocalTime.class);
    }
}
