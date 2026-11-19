/* =====================================================================
   V15 — Sơ đồ bàn kiểu POS của Thu ngân: số khách đang ngồi ở bàn.
   Thu ngân nhập khi khách vào bàn (NULL = chưa nhập; sơ đồ dùng số khách trong phiếu đặt bàn nếu có).
   ===================================================================== */

ALTER TABLE orders
  ADD COLUMN guests SMALLINT UNSIGNED NULL AFTER reservation_id,
  ADD CONSTRAINT chk_orders_guests CHECK (guests IS NULL OR guests BETWEEN 1 AND 99);
