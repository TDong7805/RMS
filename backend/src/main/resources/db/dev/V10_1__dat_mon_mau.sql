/* =====================================================================
   V10_1 — DỮ LIỆU MẪU đặt món tại bàn (chỉ môi trường dev, [FAKE-DATA])
   3 bàn đang có khách với món ở đủ trạng thái (chờ / đang làm / đã xong / đã mang ra / đã hủy)
   và 1 món tạm hết trong ngày. Thời gian tính lùi từ lúc chạy migration.
   Mô phỏng: Khách hàng (gọi món qua QR), Bếp (cập nhật tiến độ).
   ===================================================================== */

SET @hung = (SELECT id FROM users WHERE username = 'hung.pham');
SET @linh = (SELECT id FROM users WHERE username = 'linh.tran');
SET @k = CONCAT('DH', DATE_FORMAT(CURDATE(), '%y%m'));
INSERT INTO doc_sequences (seq_key, last_no) VALUES (@k, 0) ON DUPLICATE KEY UPDATE last_no = last_no;

/* ---------------------------------------------------------------- Bàn T03: vừa gọi, bếp đang làm */
UPDATE doc_sequences SET last_no = last_no + 1 WHERE seq_key = @k COLLATE utf8mb4_unicode_ci;
SET @code = CONCAT(@k, '-', LPAD((SELECT last_no FROM doc_sequences WHERE seq_key = @k COLLATE utf8mb4_unicode_ci), 3, '0'));
INSERT INTO orders (code, table_id, status, source, created_at)
SELECT @code, id, 'open', 'qr', NOW() - INTERVAL 18 MINUTE FROM dining_tables WHERE code = 'T03';
SET @o = LAST_INSERT_ID();
INSERT INTO order_items (order_id, batch_no, dish_id, dish_name, unit_price, quantity, note, status, added_via, created_at, started_at, started_by)
SELECT @o, 1, d.id, d.name, d.price, x.qty, x.note, x.st, 'customer', NOW() - INTERVAL 18 MINUTE,
       IF(x.st = 'cooking', NOW() - INTERVAL 9 MINUTE, NULL), IF(x.st = 'cooking', @hung, NULL)
FROM (SELECT 'MA001' c, 2 qty, NULL note, 'cooking' st UNION ALL
      SELECT 'MA004', 1, 'Ít mật ong', 'cooking' UNION ALL
      SELECT 'MA003', 1, NULL, 'pending') x JOIN dishes d ON d.code = x.c;
INSERT INTO order_items (order_id, batch_no, dish_id, dish_name, unit_price, quantity, note, status, added_via, created_at)
SELECT @o, 2, d.id, d.name, d.price, 2, 'Không hành', 'pending', 'customer', NOW() - INTERVAL 3 MINUTE FROM dishes d WHERE d.code = 'MA008';

/* ---------------------------------------------------------------- Bàn VIP01: có món đã xong chờ mang ra */
UPDATE doc_sequences SET last_no = last_no + 1 WHERE seq_key = @k COLLATE utf8mb4_unicode_ci;
SET @code = CONCAT(@k, '-', LPAD((SELECT last_no FROM doc_sequences WHERE seq_key = @k COLLATE utf8mb4_unicode_ci), 3, '0'));
INSERT INTO orders (code, table_id, status, source, created_at)
SELECT @code, id, 'open', 'qr', NOW() - INTERVAL 42 MINUTE FROM dining_tables WHERE code = 'VIP01';
SET @o = LAST_INSERT_ID();
INSERT INTO order_items (order_id, batch_no, dish_id, dish_name, unit_price, quantity, note, status, added_via, created_at,
                         started_at, started_by, completed_at, kitchen_user_id, served_at, served_by, cancel_source, cancel_reason, cancelled_by, cancelled_at)
SELECT @o, x.b, d.id, d.name, d.price, x.qty, x.note, x.st, 'customer', NOW() - INTERVAL x.ago MINUTE,
       IF(x.st IN ('cooking','done','served'), NOW() - INTERVAL (x.ago - 5) MINUTE, NULL), IF(x.st IN ('cooking','done','served'), @hung, NULL),
       IF(x.st IN ('done','served'), NOW() - INTERVAL (x.ago - 20) MINUTE, NULL), IF(x.st IN ('done','served'), @hung, NULL),
       IF(x.st = 'served', NOW() - INTERVAL (x.ago - 22) MINUTE, NULL), IF(x.st = 'served', @linh, NULL),
       IF(x.st = 'cancelled', 'kitchen', NULL), IF(x.st = 'cancelled', 'Hết nguyên liệu', NULL),
       IF(x.st = 'cancelled', @hung, NULL), IF(x.st = 'cancelled', NOW() - INTERVAL (x.ago - 2) MINUTE, NULL)
FROM (SELECT 1 b, 'MA002' c, 2 qty, NULL note, 'served' st, 42 ago UNION ALL
      SELECT 1, 'MA006', 1, 'Chín vừa', 'served', 42 UNION ALL
      SELECT 1, 'MA011', 2, NULL, 'done', 40 UNION ALL
      SELECT 2, 'MA001', 1, NULL, 'done', 26 UNION ALL
      SELECT 2, 'MA010', 1, NULL, 'cancelled', 26) x JOIN dishes d ON d.code = x.c;

/* ---------------------------------------------------------------- Bàn SV01: món đã ra hết, khách đang dùng bữa */
UPDATE doc_sequences SET last_no = last_no + 1 WHERE seq_key = @k COLLATE utf8mb4_unicode_ci;
SET @code = CONCAT(@k, '-', LPAD((SELECT last_no FROM doc_sequences WHERE seq_key = @k COLLATE utf8mb4_unicode_ci), 3, '0'));
INSERT INTO orders (code, table_id, status, source, created_at)
SELECT @code, id, 'open', 'qr', NOW() - INTERVAL 65 MINUTE FROM dining_tables WHERE code = 'SV01';
SET @o = LAST_INSERT_ID();
INSERT INTO order_items (order_id, batch_no, dish_id, dish_name, unit_price, quantity, note, status, added_via, created_at,
                         started_at, started_by, completed_at, kitchen_user_id, served_at, served_by)
SELECT @o, 1, d.id, d.name, d.price, x.qty, NULL, 'served', 'customer', NOW() - INTERVAL 65 MINUTE,
       NOW() - INTERVAL 60 MINUTE, @hung, NOW() - INTERVAL 45 MINUTE, @hung, NOW() - INTERVAL 43 MINUTE, @linh
FROM (SELECT 'MA004' c, 1 qty UNION ALL SELECT 'MA003', 1 UNION ALL SELECT 'MA002', 1) x JOIN dishes d ON d.code = x.c;

UPDATE dining_tables SET status = 'occupied' WHERE code IN ('T03', 'VIP01', 'SV01');

/* ---------------------------------------------------------------- Món tạm hết hôm nay */
UPDATE dishes SET sold_out_date = CURDATE(), sold_out_by = @hung WHERE code = 'MA010';
