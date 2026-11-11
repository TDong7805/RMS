package com.rms.common;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Dữ liệu không hợp lệ theo từng trường → HTTP 422.
 * Frontend map thành ValidationError để form hiển thị lỗi ngay dưới ô nhập.
 */
public class ValidationException extends RuntimeException {
    private final Map<String, String> fields;

    public ValidationException(Map<String, String> fields) {
        this(fields, "Thông tin chưa hợp lệ");
    }

    public ValidationException(Map<String, String> fields, String message) {
        super(message);
        this.fields = fields;
    }

    public ValidationException(String field, String error) {
        this(Map.of(field, error));
    }

    public Map<String, String> fields() {
        return fields;
    }

    /** Gom lỗi từng trường rồi ném một lần nếu có lỗi. */
    public static class Collector {
        private final Map<String, String> errors = new LinkedHashMap<>();

        public Collector add(String field, String message) {
            errors.putIfAbsent(field, message);
            return this;
        }

        public boolean has(String field) {
            return errors.containsKey(field);
        }

        public boolean isEmpty() {
            return errors.isEmpty();
        }

        public void throwIfAny() {
            if (!errors.isEmpty()) throw new ValidationException(errors);
        }

        public void throwIfAny(String message) {
            if (!errors.isEmpty()) throw new ValidationException(errors, message);
        }
    }
}
