/* =====================================================================
   V14 — Màn hình bếp: đánh dấu món "GỌI LẠI" (bếp hoàn tác "Đã xong" → món quay lại hàng chờ).
   recalled_at = lần hoàn tác gần nhất; màn bếp hiện nhãn GỌI LẠI cho món đang chờ / đang làm có giá trị này.
   ===================================================================== */

ALTER TABLE order_items
  ADD COLUMN recalled_at DATETIME NULL AFTER completed_at;
