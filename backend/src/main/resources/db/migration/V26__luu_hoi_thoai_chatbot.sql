-- V26 (23/11/2026): Lưu hội thoại thật của trợ lý gọi món trên trang QR → Quản lý Chatbot: "Lịch sử hội thoại", "Thống kê".
-- Dùng các bảng có từ V1: chat_conversations (mỗi phiên chat trên một thiết bị — session_token do trình duyệt tạo),
-- chat_messages (câu khách / câu bot), chat_message_dishes (món bot gợi ý trong câu trả lời → "món được hỏi nhiều").
--  * chat_messages.source: bot trả lời bằng Gemini ('ai') hay bộ theo luật ('rules').
--  * chat_cart_adds (mới): món khách bấm "Thêm" từ thẻ gợi ý của bot → tỉ lệ khách thêm món nhờ chatbot.

ALTER TABLE chat_messages
  ADD COLUMN source VARCHAR(5) NULL AFTER is_fallback,
  ADD CONSTRAINT chk_cm_source CHECK (source IS NULL OR source IN ('ai','rules'));

CREATE TABLE chat_cart_adds (
  id               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  conversation_id  BIGINT UNSIGNED NOT NULL,
  dish_id          BIGINT UNSIGNED NULL,
  combo_id         BIGINT UNSIGNED NULL,
  quantity         SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  added_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_cca_conv FOREIGN KEY (conversation_id) REFERENCES chat_conversations(id) ON DELETE CASCADE,
  CONSTRAINT fk_cca_dish FOREIGN KEY (dish_id) REFERENCES dishes(id) ON DELETE CASCADE,
  CONSTRAINT fk_cca_combo FOREIGN KEY (combo_id) REFERENCES combos(id) ON DELETE CASCADE,
  CONSTRAINT chk_cca_qty CHECK (quantity BETWEEN 1 AND 20),
  INDEX ix_cca_conv (conversation_id)
) ENGINE=InnoDB COMMENT='Món khách thêm vào giỏ từ gợi ý của trợ lý gọi món.';
