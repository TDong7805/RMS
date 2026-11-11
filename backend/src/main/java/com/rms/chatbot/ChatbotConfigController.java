package com.rms.chatbot;

import com.rms.chatbot.ChatbotConfigService.Config;
import com.rms.chatbot.ChatbotConfigService.ConfigInput;
import com.rms.chatbot.ChatbotConfigService.Faq;
import com.rms.chatbot.ChatbotConfigService.FaqInput;
import com.rms.chatbot.ChatbotConfigService.FaqList;
import com.rms.chatbot.ChatbotConfigService.Unanswered;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * GET    /api/chatbot/config              cấu hình trợ lý (tên, avatar, gợi ý nhanh, câu chào, ngoài phạm vi, tính cách...)
 * PUT    /api/chatbot/config
 * GET    /api/chatbot/faqs                {"faqs": [...], "categories": [...]}
 * POST   /api/chatbot/faqs                {"question", "answer", "categoryId", "active", "fromUnansweredId"?}
 * PUT    /api/chatbot/faqs/{id}
 * DELETE /api/chatbot/faqs/{id}
 * GET    /api/chatbot/unanswered          câu khách hay hỏi mà bot chưa trả lời được (chưa xử lý)
 * DELETE /api/chatbot/unanswered/{id}     bỏ qua (đánh dấu dismissed, không xóa)
 *
 * Lịch sử hội thoại / thống kê chưa có API: cần dữ liệu từ phân hệ Khách hàng (xem DU_LIEU_GIA.md).
 */
@RestController
@RequestMapping("/api/chatbot")
public class ChatbotConfigController {
    private final ChatbotConfigService service;

    public ChatbotConfigController(ChatbotConfigService service) {
        this.service = service;
    }

    @GetMapping("/config")
    public Config config() {
        return service.config();
    }

    @PutMapping("/config")
    public Config updateConfig(@RequestBody ConfigInput in) {
        return service.updateConfig(in);
    }

    @GetMapping("/faqs")
    public FaqList faqs() {
        return service.faqs();
    }

    @PostMapping("/faqs")
    public Faq createFaq(@RequestBody FaqInput in) {
        return service.saveFaq(null, in);
    }

    @PutMapping("/faqs/{id}")
    public Faq updateFaq(@PathVariable String id, @RequestBody FaqInput in) {
        return service.saveFaq(id, in);
    }

    @DeleteMapping("/faqs/{id}")
    public ResponseEntity<Void> deleteFaq(@PathVariable String id) {
        service.deleteFaq(id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/unanswered")
    public List<Unanswered> unanswered() {
        return service.unanswered();
    }

    @DeleteMapping("/unanswered/{id}")
    public ResponseEntity<Void> dismiss(@PathVariable String id) {
        service.dismissUnanswered(id);
        return ResponseEntity.noContent().build();
    }
}
