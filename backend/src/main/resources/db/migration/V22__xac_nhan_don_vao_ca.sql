/* =====================================================================
   V22 — Xác nhận đơn của khách + phục vụ phải vào ca mới làm việc (21/11/2026)

   - Món khách gửi qua QR ở trạng thái 'unconfirmed' (Chờ xác nhận): bếp chưa thấy. Nhân viên phục vụ đã vào ca của khu
     xác nhận → 'pending' (Chờ chế biến), ghi người xác nhận; hoặc bỏ món kèm lý do (cancel_source = 'waiter').
   - Món do nhân viên gọi hộ khách: coi như đã xác nhận (confirmed_by = người gọi).
   - Cấu hình: bắt buộc xác nhận (mặc định bật), số phút chờ trước khi nhắc lại cho mọi phục vụ đã vào ca.
   ===================================================================== */

ALTER TABLE order_items DROP CHECK chk_oi_status;
ALTER TABLE order_items DROP CHECK chk_oi_cancel_source;

ALTER TABLE order_items
  MODIFY COLUMN status VARCHAR(12) NOT NULL DEFAULT 'pending',   -- 'unconfirmed' dài 11 ký tự
  ADD COLUMN confirmed_by BIGINT UNSIGNED NULL AFTER added_via,
  ADD COLUMN confirmed_at DATETIME NULL AFTER confirmed_by,
  ADD COLUMN confirm_reminded_at DATETIME NULL AFTER confirmed_at,
  ADD CONSTRAINT fk_oi_confirmed FOREIGN KEY (confirmed_by) REFERENCES users(id) ON DELETE SET NULL,
  ADD CONSTRAINT chk_oi_status CHECK (status IN ('unconfirmed','pending','cooking','done','served','cancelled')),
  ADD CONSTRAINT chk_oi_cancel_source CHECK (cancel_source IS NULL OR cancel_source IN ('customer','cashier','kitchen','waiter'));

INSERT IGNORE INTO system_settings (setting_key, setting_value, value_type, description) VALUES
 ('order.require_confirm',        'true', 'boolean', 'Món khách gửi qua QR phải được nhân viên phục vụ xác nhận rồi mới xuống bếp'),
 ('order.confirm_remind_minutes', '3',    'number',  'Chờ xác nhận quá bao nhiêu phút thì nhắc lại cho mọi phục vụ đã vào ca');
