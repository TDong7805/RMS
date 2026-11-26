package com.rms.ordering;

import com.rms.common.Paged;
import java.util.List;
import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Hội thoại của trợ lý gọi món:
 * POST /api/public/qr/{token}/assistant/added   {sessionId, items:[{kind: dish|set, id, qty}]} — khách thêm món từ gợi ý
 * GET  /api/chatbot/conversations?keyword=&date=&status=&page=   Quản lý: lịch sử hội thoại
 * GET  /api/chatbot/stats?days=7                                 Quản lý: thống kê
 */
@RestController
public class ChatLogController {
    public record AddedInput(String sessionId, List<ChatLogService.CartAdd> items) {}

    private final ChatLogService chatLog;
    private final QrOrderingService qr;

    public ChatLogController(ChatLogService chatLog, QrOrderingService qr) {
        this.chatLog = chatLog;
        this.qr = qr;
    }

    @PostMapping("/api/public/qr/{token}/assistant/added")
    public Map<String, Integer> added(@PathVariable String token, @RequestBody AddedInput in) {
        return Map.of("saved", chatLog.cartAdds(qr.table(token).id(), in.sessionId(), in.items()));
    }

    @GetMapping("/api/chatbot/conversations")
    public Paged<ChatLogService.Conversation> conversations(@RequestParam(required = false) String keyword,
                                                            @RequestParam(required = false) String date,
                                                            @RequestParam(required = false) String status,
                                                            @RequestParam(defaultValue = "1") int page) {
        return chatLog.list(keyword, date, status, page);
    }

    @GetMapping("/api/chatbot/stats")
    public ChatLogService.Stats stats(@RequestParam(defaultValue = "7") int days) {
        return chatLog.stats(days);
    }
}
