/* =====================================================================
   V10 — Đặt món tại bàn (QR) và Bếp, đợt 1 (DacTa_UC_DatMon_Bep_ThuNgan)

   - Món tạm hết trong ngày (UC-BEP-05): sold_out_date = ngày bị đánh dấu; sang ngày khác tự hết hiệu lực.
   - Món trong đơn: số đợt gọi (mỗi lần khách bấm Gửi là một đợt), ai bắt đầu chế biến, ai mang ra,
     hủy bởi ai (khách / thu ngân / bếp) kèm lý do và thời điểm.
   - Mã đơn theo tháng DH2611-001 dùng chung bộ đếm doc_sequences (đơn cũ dạng DH-0001 giữ nguyên).
   - Thông báo Bếp dùng loại 'kitchen' đã có; yêu cầu của khách dùng 'service_request'.
   ===================================================================== */

ALTER TABLE dishes
  ADD COLUMN sold_out_date DATE NULL AFTER status_updated_at,
  ADD COLUMN sold_out_by   BIGINT UNSIGNED NULL AFTER sold_out_date,
  ADD CONSTRAINT fk_dishes_soldout_user FOREIGN KEY (sold_out_by) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE order_items
  ADD COLUMN batch_no       SMALLINT UNSIGNED NOT NULL DEFAULT 1 AFTER order_id,
  ADD COLUMN started_by     BIGINT UNSIGNED NULL AFTER kitchen_user_id,
  ADD COLUMN served_by      BIGINT UNSIGNED NULL AFTER started_by,
  ADD COLUMN cancel_source  VARCHAR(10)  NULL AFTER served_at,
  ADD COLUMN cancel_reason  VARCHAR(200) NULL AFTER cancel_source,
  ADD COLUMN cancelled_by   BIGINT UNSIGNED NULL AFTER cancel_reason,
  ADD COLUMN cancelled_at   DATETIME NULL AFTER cancelled_by,
  ADD CONSTRAINT fk_oi_started FOREIGN KEY (started_by) REFERENCES users(id) ON DELETE SET NULL,
  ADD CONSTRAINT fk_oi_served FOREIGN KEY (served_by) REFERENCES users(id) ON DELETE SET NULL,
  ADD CONSTRAINT fk_oi_cancelled FOREIGN KEY (cancelled_by) REFERENCES users(id) ON DELETE SET NULL,
  ADD CONSTRAINT chk_oi_cancel_source CHECK (cancel_source IS NULL OR cancel_source IN ('customer','cashier','kitchen'));

-- Một bàn chỉ có một đơn đang mở: kiểm tra ở ứng dụng (khóa dòng bàn khi tạo đơn); chỉ mục ix_orders_table đã có từ V1.
