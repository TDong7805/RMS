package com.rms.common;

/**
 * CSDL dùng khóa BIGINT; API trả id dạng chuỗi ("12") để khớp kiểu string của frontend.
 */
public final class Ids {
    private Ids() {}

    public static String str(Long id) {
        return id == null ? null : Long.toString(id);
    }

    /** Id không phải số thì chắc chắn không tồn tại → 404 thay vì lỗi 400 khó hiểu. */
    public static long parse(String id, String notFoundMessage) {
        try {
            return Long.parseLong(id);
        } catch (NumberFormatException | NullPointerException e) {
            throw BusinessException.notFound(notFoundMessage);
        }
    }

    /** Id tùy chọn: rỗng/null → null; sai định dạng → null (coi như không chọn). */
    public static Long parseOrNull(String id) {
        if (id == null || id.isBlank()) return null;
        try {
            return Long.parseLong(id);
        } catch (NumberFormatException e) {
            return null;
        }
    }
}
