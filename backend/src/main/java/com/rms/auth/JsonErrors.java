package com.rms.auth;

import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.nio.charset.StandardCharsets;

/** Trả lỗi từ filter bảo mật theo đúng định dạng chung {"message", "fields"} như GlobalExceptionHandler. */
final class JsonErrors {
    private JsonErrors() {}

    static void write(HttpServletResponse res, int status, String message) throws IOException {
        res.setStatus(status);
        res.setContentType("application/json");
        res.setCharacterEncoding(StandardCharsets.UTF_8.name());
        String escaped = message.replace("\\", "\\\\").replace("\"", "\\\"");
        res.getWriter().write("{\"message\":\"" + escaped + "\",\"fields\":{}}");
    }
}
