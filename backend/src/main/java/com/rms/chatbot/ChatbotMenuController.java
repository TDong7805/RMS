package com.rms.chatbot;

import com.rms.chatbot.ChatbotMenuService.AiPatch;
import com.rms.chatbot.ChatbotMenuService.Combo;
import com.rms.chatbot.ChatbotMenuService.ComboInput;
import com.rms.chatbot.ChatbotMenuService.Menu;
import com.rms.chatbot.ChatbotMenuService.MenuSync;
import com.rms.dish.DishService.Dish;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * GET    /api/chatbot/menu              món + dữ liệu AI dùng (thẻ, bật gợi ý) + lần đồng bộ gần nhất
 * POST   /api/chatbot/menu/sync         đồng bộ thực đơn vào kho tri thức AI
 * PATCH  /api/chatbot/menu/{dishId}     {"aiEnabled"?: bool, "aiTags"?: [..]}
 * GET    /api/chatbot/ai-tags           danh sách thẻ phân loại
 * GET    /api/chatbot/combos
 * POST   /api/chatbot/combos            {"name", "dishIds", "note", "active"}
 * PUT    /api/chatbot/combos/{id}
 * DELETE /api/chatbot/combos/{id}
 */
@RestController
@RequestMapping("/api/chatbot")
public class ChatbotMenuController {
    private final ChatbotMenuService service;

    public ChatbotMenuController(ChatbotMenuService service) {
        this.service = service;
    }

    @GetMapping("/menu")
    public Menu menu() {
        return service.menu();
    }

    @PostMapping("/menu/sync")
    public MenuSync sync() {
        return service.sync();
    }

    @PatchMapping("/menu/{dishId}")
    public Dish updateAi(@PathVariable String dishId, @RequestBody AiPatch patch) {
        return service.updateAi(dishId, patch);
    }

    @GetMapping("/ai-tags")
    public List<String> aiTags() {
        return service.aiTags();
    }

    @GetMapping("/combos")
    public List<Combo> combos() {
        return service.combos();
    }

    @PostMapping("/combos")
    public Combo createCombo(@RequestBody ComboInput in) {
        return service.saveCombo(null, in);
    }

    @PutMapping("/combos/{id}")
    public Combo updateCombo(@PathVariable String id, @RequestBody ComboInput in) {
        return service.saveCombo(id, in);
    }

    @DeleteMapping("/combos/{id}")
    public ResponseEntity<Void> deleteCombo(@PathVariable String id) {
        service.deleteCombo(id);
        return ResponseEntity.noContent().build();
    }
}
