package com.rms.chatbot;

import com.rms.audit.AuditService;
import com.rms.common.CurrentUserService;
import com.rms.common.ValidationException;
import com.rms.common.Vi;
import java.time.Duration;
import java.util.Objects;
import java.util.Optional;
import org.springframework.core.env.Environment;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Cấu hình mô hình AI cho trợ lý gọi món (bảng ai_model_config, 1 dòng) — Quản lý Chatbot → Cấu hình.
 * Key KHÔNG lưu trong CSDL: api_key_ref là tên biến môi trường trên máy chủ (vd. GEMINI_API_KEY).
 *
 * <p>CÁCH DÙNG GEMINI:
 * <ol>
 *   <li>Lấy key ở Google AI Studio (aistudio.google.com → Get API key).</li>
 *   <li>Dán key vào file {@code backend/.env.properties} (file riêng của máy, git bỏ qua): dòng {@code GEMINI_API_KEY=khóa-của-bạn}.
 *       Hoặc đặt biến môi trường: {@code setx GEMINI_API_KEY "khóa-của-bạn"} rồi đóng mở lại terminal / IDE.</li>
 *   <li>Chạy backend; Quản lý Chatbot → Cấu hình → thẻ "Trí tuệ nhân tạo" → Thử kết nối.</li>
 * </ol>
 * Không có key / tắt Gemini → trợ lý trả lời theo luật (MenuAssistant). Mỗi máy dùng key riêng, key không lên GitHub.
 * Đổi model (vd. khi Google ngừng model cũ): sửa ô "Model" ở thẻ trên, không cần sửa code.
 */
@Service
public class AiModelService {

    /** keyPresent: máy chủ đang có biến môi trường chứa key (không bao giờ trả key ra ngoài). */
    public record AiConfig(boolean enabled, String provider, String modelName, double temperature, int maxTokens,
                           String systemPrompt, String apiKeyRef, boolean keyPresent) {}

    public record AiConfigInput(Boolean enabled, String modelName, Double temperature, Integer maxTokens, String systemPrompt,
                                String apiKeyRef) {}

    public record TestResult(boolean ok, String message, long millis, String reply) {}

    private final JdbcClient jdbc;
    private final GeminiClient gemini;
    private final AuditService audit;
    private final CurrentUserService currentUser;
    private final Environment env;

    public AiModelService(JdbcClient jdbc, GeminiClient gemini, AuditService audit, CurrentUserService currentUser, Environment env) {
        this.env = env;
        this.jdbc = jdbc;
        this.gemini = gemini;
        this.audit = audit;
        this.currentUser = currentUser;
    }

    public AiConfig get() {
        return jdbc.sql("SELECT provider, model_name, temperature, max_tokens, system_prompt, api_key_ref, is_enabled FROM ai_model_config WHERE id = 1")
            .query((rs, n) -> new AiConfig(rs.getBoolean("is_enabled"), rs.getString("provider"), rs.getString("model_name"),
                rs.getBigDecimal("temperature").doubleValue(), rs.getInt("max_tokens"), Objects.toString(rs.getString("system_prompt"), ""),
                Objects.toString(rs.getString("api_key_ref"), ""), key(rs.getString("api_key_ref")).isPresent()))
            .optional()
            .orElse(new AiConfig(false, "google", "gemini-3.5-flash-lite", 0.4, 1024, "", "GEMINI_API_KEY", key("GEMINI_API_KEY").isPresent()));
    }

    /** Key theo tên: biến môi trường, thuộc tính JVM hoặc dòng trong backend/.env.properties (Spring gộp chung). */
    public Optional<String> key(String ref) {
        if (ref == null || ref.isBlank()) return Optional.empty();
        String v = env.getProperty(ref);
        return v == null || v.isBlank() ? Optional.empty() : Optional.of(v.trim());
    }

    /** Dùng được Gemini lúc này: đang bật, provider google, có key. */
    public boolean usable(AiConfig c) {
        return c.enabled() && "google".equals(c.provider()) && c.keyPresent();
    }

    @Transactional
    public AiConfig update(AiConfigInput in) {
        AiConfig cur = get();
        var e = new ValidationException.Collector();
        String model = in.modelName() == null ? cur.modelName() : Vi.trim(in.modelName());
        if (!model.matches("[a-z0-9][a-z0-9.\\-]{2,58}")) e.add("modelName", "Tên model chỉ gồm chữ thường, số, dấu chấm, gạch ngang (vd. gemini-3.5-flash-lite)");
        double temp = in.temperature() == null ? cur.temperature() : in.temperature();
        if (temp < 0 || temp > 1) e.add("temperature", "Độ sáng tạo từ 0 đến 1");
        int tokens = in.maxTokens() == null ? cur.maxTokens() : in.maxTokens();
        if (tokens < 256 || tokens > 8192) e.add("maxTokens", "Từ 256 đến 8192");
        String prompt = in.systemPrompt() == null ? cur.systemPrompt() : Vi.trim(in.systemPrompt());
        if (prompt.length() > 2000) e.add("systemPrompt", "Tối đa 2000 ký tự");
        String ref = in.apiKeyRef() == null ? cur.apiKeyRef() : Vi.trim(in.apiKeyRef());
        if (!ref.matches("[A-Za-z_][A-Za-z0-9_]{0,99}")) e.add("apiKeyRef", "Tên biến môi trường chỉ gồm chữ, số, dấu gạch dưới (vd. GEMINI_API_KEY) — không dán key vào đây");
        e.throwIfAny();
        boolean enabled = in.enabled() == null ? cur.enabled() : in.enabled();
        jdbc.sql("""
                INSERT INTO ai_model_config (id, provider, model_name, temperature, max_tokens, system_prompt, api_key_ref, is_enabled, updated_by)
                VALUES (1, 'google', ?, ?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE provider = 'google', model_name = VALUES(model_name), temperature = VALUES(temperature),
                  max_tokens = VALUES(max_tokens), system_prompt = VALUES(system_prompt), api_key_ref = VALUES(api_key_ref),
                  is_enabled = VALUES(is_enabled), updated_by = VALUES(updated_by)
                """).params(model, temp, tokens, prompt.isEmpty() ? null : prompt, ref, enabled, currentUser.get().id()).update();
        audit.log("chatbot", "Cập nhật cấu hình AI", (enabled ? "Bật" : "Tắt") + " Gemini · " + model);
        return get();
    }

    /** Thử gọi Gemini một câu ngắn với cấu hình hiện tại. */
    public TestResult test() {
        AiConfig c = get();
        Optional<String> k = key(c.apiKeyRef());
        if (k.isEmpty())
            return new TestResult(false, "Máy chủ chưa có biến môi trường " + c.apiKeyRef() + " — thêm dòng " + c.apiKeyRef() + "=khóa vào backend/.env.properties (hoặc setx) rồi khởi động lại backend", 0, "");
        long t = System.currentTimeMillis();
        try {
            String reply = gemini.generate(k.get(), c.modelName(), "Trả lời bằng tiếng Việt, một câu ngắn.", "Chào bạn, bạn là ai?",
                c.temperature(), 128, null, Duration.ofSeconds(15));
            return new TestResult(true, "Kết nối Gemini thành công", System.currentTimeMillis() - t, reply.trim());
        } catch (GeminiClient.GeminiException ex) {
            return new TestResult(false, ex.getMessage(), System.currentTimeMillis() - t, "");
        }
    }
}
