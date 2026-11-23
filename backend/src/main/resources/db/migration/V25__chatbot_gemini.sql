-- V25 (23/11/2026): Trợ lý gọi món trên trang QR dùng Google Gemini (khi có API key), dự phòng bằng bộ trả lời theo luật.
-- ai_model_config (có từ V1, 1 dòng): provider 'google', model Gemini Flash Lite (nhanh, có gói miễn phí).
-- api_key_ref chỉ là TÊN biến môi trường chứa key (GEMINI_API_KEY) — key thật KHÔNG lưu trong CSDL hay mã nguồn.
-- is_enabled = 1: dùng Gemini nếu máy chủ có key; không có key / lỗi mạng / hết lượt → tự quay về trả lời theo luật.
INSERT INTO ai_model_config (id, provider, model_name, temperature, max_tokens, system_prompt, api_key_ref, is_enabled)
VALUES (1, 'google', 'gemini-3.5-flash-lite', 0.40, 1024, NULL, 'GEMINI_API_KEY', 1)
ON DUPLICATE KEY UPDATE provider = 'google', model_name = 'gemini-3.5-flash-lite', temperature = 0.40, max_tokens = 1024,
                        api_key_ref = 'GEMINI_API_KEY', is_enabled = 1;
