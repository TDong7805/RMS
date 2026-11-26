-- V27 (23/11/2026): Chatbot tư vấn trên website khách hàng (ngoài trợ lý gọi món tại bàn qua QR).
--  * chatbot_config.website_enabled: công tắc riêng "Hiện trên website khách hàng" (Quản lý Chatbot, Cấu hình).
--    Công tắc chung is_active vẫn tắt được cả hai nơi.
--  * chat_conversations.channel: hội thoại đến từ trang gọi món tại bàn ('qr') hay website ('website');
--    hội thoại website không gắn bàn (table_id NULL).

ALTER TABLE chatbot_config
  ADD COLUMN website_enabled TINYINT(1) NOT NULL DEFAULT 1 AFTER is_active;

ALTER TABLE chat_conversations
  ADD COLUMN channel VARCHAR(10) NOT NULL DEFAULT 'qr' AFTER order_id,
  ADD CONSTRAINT chk_conv_channel CHECK (channel IN ('qr','website'));
