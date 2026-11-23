package com.rms.chatbot;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * Gọi Google Gemini (API generateContent) — trả về văn bản (JSON nếu có responseSchema).
 * Key gửi qua header x-goog-api-key (không đưa vào URL để khỏi lọt vào log). Lỗi / quá giờ → {@link GeminiException}.
 */
@Component
public class GeminiClient {

    public static class GeminiException extends RuntimeException {
        private final int status;

        public GeminiException(String message, int status) {
            super(message);
            this.status = status;
        }

        public int status() {
            return status;
        }
    }

    private final ObjectMapper json;
    private final String baseUrl;
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();

    public GeminiClient(ObjectMapper json, @Value("${rms.ai.gemini-base-url:https://generativelanguage.googleapis.com}") String baseUrl) {
        this.json = json;
        this.baseUrl = baseUrl.replaceAll("/+$", "");
    }

    /**
     * @param schema responseSchema (null = văn bản thường)
     * @param timeout thời gian chờ tối đa
     */
    public String generate(String apiKey, String model, String system, String user, double temperature, int maxTokens,
                           Map<String, Object> schema, Duration timeout) {
        Map<String, Object> config = new java.util.LinkedHashMap<>();
        config.put("temperature", temperature);
        config.put("maxOutputTokens", maxTokens);
        if (schema != null) {
            config.put("responseMimeType", "application/json");
            config.put("responseSchema", schema);
        }
        Map<String, Object> body = new java.util.LinkedHashMap<>();
        if (system != null && !system.isBlank()) body.put("systemInstruction", Map.of("parts", List.of(Map.of("text", system))));
        body.put("contents", List.of(Map.of("role", "user", "parts", List.of(Map.of("text", user)))));
        body.put("generationConfig", config);
        try {
            HttpRequest req = HttpRequest.newBuilder(URI.create(baseUrl + "/v1beta/models/" + model + ":generateContent"))
                .timeout(timeout)
                .header("Content-Type", "application/json; charset=utf-8")
                .header("x-goog-api-key", apiKey)
                .POST(HttpRequest.BodyPublishers.ofString(json.writeValueAsString(body), StandardCharsets.UTF_8))
                .build();
            HttpResponse<String> res = http.send(req, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
            JsonNode root = json.readTree(res.body());
            if (res.statusCode() != 200) {
                String msg = root.path("error").path("message").asText("Gemini trả lỗi " + res.statusCode());
                throw new GeminiException(msg, res.statusCode());
            }
            JsonNode parts = root.path("candidates").path(0).path("content").path("parts");
            StringBuilder sb = new StringBuilder();
            for (JsonNode p : parts) if (p.has("text") && !p.path("thought").asBoolean(false)) sb.append(p.get("text").asText());
            if (sb.isEmpty()) throw new GeminiException("Gemini không trả nội dung (" + root.path("candidates").path(0).path("finishReason").asText("?") + ")", 502);
            return sb.toString();
        } catch (GeminiException e) {
            throw e;
        } catch (java.net.http.HttpTimeoutException e) {
            throw new GeminiException("Gemini trả lời quá chậm (quá " + timeout.toSeconds() + " giây)", 504);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new GeminiException("Bị ngắt khi gọi Gemini", 503);
        } catch (Exception e) {
            throw new GeminiException("Không kết nối được Gemini: " + e.getMessage(), 503);
        }
    }
}
