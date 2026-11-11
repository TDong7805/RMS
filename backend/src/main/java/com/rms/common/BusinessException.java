package com.rms.common;

import org.springframework.http.HttpStatus;

/** Lỗi nghiệp vụ chung (không gắn với trường cụ thể), ví dụ "Không thể xóa ca làm việc này". */
public class BusinessException extends RuntimeException {
    private final HttpStatus status;

    public BusinessException(String message) {
        this(message, HttpStatus.CONFLICT);
    }

    public BusinessException(String message, HttpStatus status) {
        super(message);
        this.status = status;
    }

    public static BusinessException notFound(String message) {
        return new BusinessException(message, HttpStatus.NOT_FOUND);
    }

    public HttpStatus status() {
        return status;
    }
}
