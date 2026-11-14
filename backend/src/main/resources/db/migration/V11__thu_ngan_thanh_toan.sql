/* =====================================================================
   V11 — Thu ngân đợt 2: yêu cầu của khách, hóa đơn, thanh toán (DacTa_UC_DatMon_Bep_ThuNgan)

   - Yêu cầu của khách: hình thức thanh toán khách chọn + thông tin xuất hóa đơn VAT (yêu cầu thanh toán),
     thời điểm hủy.
   - Hóa đơn: lý do / người / thời điểm hủy (chỉ hủy hóa đơn chưa thanh toán). Mã HD2611-001 dùng doc_sequences.
   - Khoản thu: tiền khách đưa (tiền mặt) để in tiền thối trên hóa đơn.
   - Tài khoản nhận tiền (mã QR chuyển khoản) lưu ở system_settings, khóa payment.*.
   ===================================================================== */

ALTER TABLE service_requests
  ADD COLUMN payment_method VARCHAR(10)  NULL AFTER content,
  ADD COLUMN vat_company    VARCHAR(200) NULL AFTER payment_method,
  ADD COLUMN vat_tax_code   VARCHAR(14)  NULL AFTER vat_company,
  ADD COLUMN cancelled_at   DATETIME NULL AFTER done_at,
  ADD CONSTRAINT chk_sr_method CHECK (payment_method IS NULL OR payment_method IN ('cash','card','transfer'));

ALTER TABLE invoices
  ADD COLUMN cancel_reason VARCHAR(300) NULL AFTER paid_at,
  ADD COLUMN cancelled_by  BIGINT UNSIGNED NULL AFTER cancel_reason,
  ADD COLUMN cancelled_at  DATETIME NULL AFTER cancelled_by,
  ADD CONSTRAINT fk_inv_cancel_user FOREIGN KEY (cancelled_by) REFERENCES users(id) ON DELETE SET NULL;

-- Một đơn chỉ có MỘT hóa đơn còn hiệu lực; hóa đơn đã hủy được giữ lại → bỏ ràng buộc 1 đơn – 1 hóa đơn.
-- (Tạo chỉ mục thường cho khóa ngoại trước khi bỏ chỉ mục duy nhất đang được khóa ngoại dùng.)
CREATE INDEX ix_inv_order ON invoices (order_id);
ALTER TABLE invoices DROP INDEX uq_inv_order;

ALTER TABLE payments
  ADD COLUMN cash_given DECIMAL(14,2) NULL AFTER amount;

INSERT IGNORE INTO system_settings (setting_key, setting_value, value_type, description) VALUES
 ('payment.bank_bin',     NULL, 'string', 'Mã ngân hàng (BIN Napas) của tài khoản nhận tiền — tạo mã QR chuyển khoản'),
 ('payment.bank_name',    NULL, 'string', 'Tên ngân hàng hiển thị'),
 ('payment.account_no',   NULL, 'string', 'Số tài khoản nhận tiền'),
 ('payment.account_name', NULL, 'string', 'Tên chủ tài khoản (in hoa, không dấu)');
