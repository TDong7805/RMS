package com.rms.chatbot;

import com.rms.audit.AuditService;
import com.rms.common.BusinessException;
import com.rms.common.CurrentUserService;
import com.rms.common.Db;
import com.rms.common.Ids;
import com.rms.common.Times;
import com.rms.common.ValidationException;
import com.rms.common.Vi;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Quản lý Chatbot AI — luồng A "Cấu hình Chatbot" và luồng C "Quản lý FAQ".
 *
 *  - Cấu hình (bảng chatbot_config, một dòng id = 1; gợi ý nhanh ở chatbot_quick_replies): tên & avatar, gợi ý nhanh,
 *    câu chào, xử lý ngoài phạm vi, giọng điệu & tính cách, cảnh báo dị ứng (bắt buộc theo nguyên tắc AI).
 *    Bot áp dụng ở phiên chat tiếp theo (phần bot trả lời khách thuộc phân hệ Khách hàng).
 *  - FAQ: thêm / sửa / xóa, phân loại danh mục, bật / tắt. Gợi ý từ câu hỏi khách hay hỏi mà bot chưa trả lời được:
 *    tạo FAQ từ câu đó thì đánh dấu "resolved" + liên kết FAQ; "Bỏ qua" thì đánh dấu "dismissed" (không xóa, giữ số liệu).
 *  - Mọi thao tác ghi nhật ký (module "chatbot").
 */
@Service
public class ChatbotConfigService {
    static final int MAX_QUICK_REPLIES = 6;
    private static final Set<String> TONES = Set.of("friendly", "professional", "playful");
    private static final Set<String> FALLBACK_ACTIONS = Set.of("suggest_staff", "show_menu", "rephrase");

    public record Config(String botName, String avatar, boolean active, String greeting, List<String> quickReplies,
                         String fallbackMessage, String fallbackAction, String tone, String personality,
                         String allergyDisclaimer, String updatedAt) {}

    public record ConfigInput(String botName, String avatar, Boolean active, String greeting, List<String> quickReplies,
                              String fallbackMessage, String fallbackAction, String tone, String personality,
                              String allergyDisclaimer) {}

    public record FaqCategory(String id, String name) {}

    public record Faq(String id, String question, String answer, String categoryId, boolean active, String updatedAt) {}

    public record FaqList(List<Faq> faqs, List<FaqCategory> categories) {}

    public record FaqInput(String question, String answer, String categoryId, Boolean active, String fromUnansweredId) {}

    public record Unanswered(String id, String question, int askedCount, String lastAskedAt) {}

    private final JdbcClient jdbc;
    private final AuditService audit;
    private final CurrentUserService currentUser;

    public ChatbotConfigService(JdbcClient jdbc, AuditService audit, CurrentUserService currentUser) {
        this.jdbc = jdbc;
        this.audit = audit;
        this.currentUser = currentUser;
    }

    /* ------------------------------------------------------------------ Cấu hình */

    public Config config() {
        List<String> replies = jdbc.sql("SELECT label FROM chatbot_quick_replies ORDER BY sort_order, id").query(String.class).list();
        return jdbc.sql("""
                SELECT bot_name, avatar, is_active, greeting, fallback_message, fallback_action, tone, personality,
                       allergy_disclaimer, updated_at
                FROM chatbot_config WHERE id = 1
                """)
            .query((rs, n) -> new Config(rs.getString("bot_name"), rs.getString("avatar"), rs.getBoolean("is_active"),
                rs.getString("greeting"), replies, rs.getString("fallback_message"), rs.getString("fallback_action"),
                rs.getString("tone"), Objects.toString(rs.getString("personality"), ""), rs.getString("allergy_disclaimer"),
                Times.iso(Db.dateTime(rs, "updated_at"))))
            .optional()
            .orElseThrow(() -> new BusinessException("Chưa khởi tạo cấu hình Chatbot (thiếu dòng chatbot_config id = 1)"));
    }

    @Transactional
    public Config updateConfig(ConfigInput in) {
        var v = new ValidationException.Collector();
        String botName = Vi.collapse(in.botName());
        if (botName.isEmpty()) v.add("botName", "Vui lòng đặt tên cho trợ lý");
        else if (botName.length() > 30) v.add("botName", "Tên tối đa 30 ký tự");
        String avatar = Vi.trim(in.avatar());
        if (avatar.isEmpty() || avatar.codePointCount(0, avatar.length()) > 8 || avatar.length() > 20)
            v.add("avatar", "Vui lòng chọn avatar");
        String greeting = Vi.trim(in.greeting());
        if (greeting.isEmpty()) v.add("greeting", "Vui lòng nhập câu chào");
        else if (greeting.length() > 300) v.add("greeting", "Câu chào tối đa 300 ký tự");

        List<String> replies = new ArrayList<>();
        for (String r : in.quickReplies() == null ? List.<String>of() : in.quickReplies()) {
            String c = Vi.collapse(r);
            if (!c.isEmpty()) replies.add(c);
        }
        Set<String> seen = new HashSet<>();
        if (replies.size() > MAX_QUICK_REPLIES) v.add("quickReplies", "Tối đa " + MAX_QUICK_REPLIES + " gợi ý nhanh");
        else if (replies.stream().anyMatch(r -> r.length() > 30)) v.add("quickReplies", "Mỗi gợi ý tối đa 30 ký tự");
        // So sánh không phân biệt hoa thường, dấu — giống ràng buộc UNIQUE(label) của CSDL.
        else if (!replies.stream().allMatch(r -> seen.add(Vi.normalize(r)))) v.add("quickReplies", "Gợi ý nhanh bị trùng");

        String fallback = Vi.trim(in.fallbackMessage());
        if (fallback.isEmpty()) v.add("fallbackMessage", "Vui lòng nhập câu trả lời khi ngoài phạm vi");
        else if (fallback.length() > 500) v.add("fallbackMessage", "Câu trả lời tối đa 500 ký tự");
        String action = Vi.trim(in.fallbackAction());
        if (!FALLBACK_ACTIONS.contains(action)) v.add("fallbackAction", "Cách xử lý ngoài phạm vi không hợp lệ");
        String tone = Vi.trim(in.tone());
        if (!TONES.contains(tone)) v.add("tone", "Giọng điệu không hợp lệ");
        String personality = Vi.trim(in.personality());
        if (personality.length() > 500) v.add("personality", "Mô tả tính cách tối đa 500 ký tự");
        String disclaimer = Vi.trim(in.allergyDisclaimer());
        if (disclaimer.isEmpty()) v.add("allergyDisclaimer", "Cảnh báo dị ứng là bắt buộc theo nguyên tắc hoạt động của AI");
        else if (disclaimer.length() > 500) v.add("allergyDisclaimer", "Cảnh báo dị ứng tối đa 500 ký tự");
        v.throwIfAny();

        boolean active = in.active() == null || in.active();
        jdbc.sql("""
                UPDATE chatbot_config SET bot_name = ?, avatar = ?, is_active = ?, greeting = ?, fallback_message = ?,
                       fallback_action = ?, tone = ?, personality = ?, allergy_disclaimer = ?, updated_by = ?,
                       updated_at = CURRENT_TIMESTAMP
                WHERE id = 1
                """)
            .params(botName, avatar, active, greeting, fallback, action, tone, personality.isEmpty() ? null : personality,
                disclaimer, currentUser.get().id())
            .update();
        jdbc.sql("DELETE FROM chatbot_quick_replies").update();
        for (int i = 0; i < replies.size(); i++) {
            jdbc.sql("INSERT INTO chatbot_quick_replies (label, sort_order) VALUES (?, ?)").params(replies.get(i), i + 1).update();
        }
        audit.log("chatbot", "Cập nhật cấu hình",
            "Cấu hình trợ lý \"" + botName + "\" (" + (active ? "đang bật" : "đang tắt") + ")", "chatbot_config", 1L);
        return config();
    }

    /* ------------------------------------------------------------------ FAQ */

    public FaqList faqs() {
        List<FaqCategory> categories = jdbc.sql("SELECT id, name FROM faq_categories ORDER BY id")
            .query((rs, n) -> new FaqCategory(Ids.str(rs.getLong("id")), rs.getString("name"))).list();
        List<Faq> faqs = jdbc.sql("SELECT id, question, answer, category_id, is_active, updated_at FROM faqs ORDER BY updated_at DESC, id DESC")
            .query((rs, n) -> new Faq(Ids.str(rs.getLong("id")), rs.getString("question"), rs.getString("answer"),
                Ids.str(rs.getLong("category_id")), rs.getBoolean("is_active"), Times.iso(Db.dateTime(rs, "updated_at"))))
            .list();
        return new FaqList(faqs, categories);
    }

    private Faq faq(long id) {
        return faqs().faqs().stream().filter(f -> f.id().equals(Ids.str(id))).findFirst()
            .orElseThrow(() -> BusinessException.notFound("FAQ không tồn tại"));
    }

    @Transactional
    public Faq saveFaq(String idText, FaqInput in) {
        Long id = idText == null ? null : Ids.parse(idText, "FAQ không tồn tại");
        if (id != null) faq(id);

        var v = new ValidationException.Collector();
        String question = Vi.collapse(in.question());
        if (question.isEmpty()) v.add("question", "Vui lòng nhập câu hỏi");
        else if (question.length() > 200) v.add("question", "Câu hỏi tối đa 200 ký tự");
        else if (jdbc.sql("SELECT COUNT(*) FROM faqs WHERE question = ? AND id <> ?").params(question, id == null ? 0 : id)
            .query(Long.class).single() > 0) v.add("question", "Câu hỏi đã có trong FAQ");
        String answer = Vi.trim(in.answer());
        if (answer.isEmpty()) v.add("answer", "Vui lòng nhập câu trả lời");
        else if (answer.length() > 1000) v.add("answer", "Câu trả lời tối đa 1000 ký tự");
        Long categoryId = Ids.parseOrNull(in.categoryId());
        boolean categoryExists = categoryId != null
            && jdbc.sql("SELECT COUNT(*) FROM faq_categories WHERE id = ?").param(categoryId).query(Long.class).single() > 0;
        if (!categoryExists) v.add("categoryId", "Vui lòng chọn danh mục");
        v.throwIfAny();

        boolean active = in.active() == null || in.active();
        long userId = currentUser.get().id();
        if (id == null) {
            jdbc.sql("INSERT INTO faqs (category_id, question, answer, is_active, updated_by) VALUES (?, ?, ?, ?, ?)")
                .params(categoryId, question, answer, active, userId).update();
            id = jdbc.sql("SELECT LAST_INSERT_ID()").query(Long.class).single();
        } else {
            jdbc.sql("""
                    UPDATE faqs SET category_id = ?, question = ?, answer = ?, is_active = ?, updated_by = ?,
                                    updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                    """).params(categoryId, question, answer, active, userId, id).update();
        }

        // Tạo / sửa FAQ từ một câu hỏi chưa giải đáp → câu đó được đánh dấu đã giải đáp bằng FAQ này.
        Long fromId = Ids.parseOrNull(in.fromUnansweredId());
        boolean resolved = fromId != null && jdbc.sql(
                "UPDATE unanswered_questions SET status = 'resolved', resolved_faq_id = ? WHERE id = ? AND status = 'open'")
            .params(id, fromId).update() > 0;
        audit.log("chatbot", idText == null ? "Thêm FAQ" : "Sửa FAQ",
            question + (resolved ? " (giải đáp câu hỏi khách hay hỏi)" : ""), "faqs", id);
        return faq(id);
    }

    @Transactional
    public void deleteFaq(String idText) {
        long id = Ids.parse(idText, "FAQ không tồn tại");
        Faq current = faq(id);
        // unanswered_questions.resolved_faq_id → ON DELETE SET NULL; câu hỏi vẫn giữ trạng thái đã giải đáp.
        jdbc.sql("DELETE FROM faqs WHERE id = ?").param(id).update();
        audit.log("chatbot", "Xóa FAQ", current.question(), "faqs", id);
    }

    /* ------------------------------------------------------------------ Câu hỏi chưa giải đáp */

    public List<Unanswered> unanswered() {
        return jdbc.sql("""
                SELECT id, question, asked_count, last_asked_at FROM unanswered_questions
                WHERE status = 'open' ORDER BY asked_count DESC, last_asked_at DESC
                """)
            .query((rs, n) -> new Unanswered(Ids.str(rs.getLong("id")), rs.getString("question"), rs.getInt("asked_count"),
                Times.iso(Db.dateTime(rs, "last_asked_at"))))
            .list();
    }

    @Transactional
    public void dismissUnanswered(String idText) {
        long id = Ids.parse(idText, "Câu hỏi không tồn tại hoặc đã được xử lý");
        String question = jdbc.sql("SELECT question FROM unanswered_questions WHERE id = ? AND status = 'open'").param(id)
            .query(String.class).optional()
            .orElseThrow(() -> BusinessException.notFound("Câu hỏi không tồn tại hoặc đã được xử lý"));
        jdbc.sql("UPDATE unanswered_questions SET status = 'dismissed' WHERE id = ?").param(id).update();
        audit.log("chatbot", "Bỏ qua câu hỏi chưa giải đáp", question, "unanswered_questions", id);
    }
}
