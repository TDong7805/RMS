-- Mở bàn (18/11/2026): mã QR của bàn chỉ gửi được món khi thu ngân đã mở bàn (tạo đơn rỗng cho bàn).
-- Bàn mở quá N phút mà chưa gọi món thì tự đóng; 0 = không tự đóng. Quản lý chỉnh ở Cấu hình hệ thống.
INSERT IGNORE INTO system_settings (setting_key, setting_value, value_type, description) VALUES
 ('order.open_table_timeout_minutes', '30', 'number', 'Mở bàn quá bao nhiêu phút mà chưa gọi món thì tự đóng (0 = không tự đóng)');
