/* =====================================================================
   V11_1 — DỮ LIỆU MẪU hóa đơn / thanh toán (chỉ môi trường dev, [FAKE-DATA])

   - ~63 ngày lịch sử bán hàng (tính lùi từ lúc chạy migration): mỗi ngày 7–17 đơn (cuối tuần đông hơn),
     giờ vào bàn dồn vào trưa / chiều / tối, 2–5 dòng món mỗi đơn; khoảng 1/37 đơn bị hủy (khách bỏ về).
   - Đơn hoàn tất đều có hóa đơn ĐÃ THANH TOÁN: tiền mặt (kèm tiền khách đưa) / thẻ / chuyển khoản,
     1/13 hóa đơn trả hai hình thức; vài hóa đơn xuất VAT. 8 đơn hoàn tất của V3_1 cũng được lập hóa đơn.
   - Yêu cầu của khách đã xử lý (lịch sử) + 2 yêu cầu đang chờ hôm nay: T03 gọi nhân viên, VIP01 yêu cầu thanh toán.
   - Tài khoản nhận tiền mẫu (để thử mã QR chuyển khoản): Vietcombank 1234567890 – NHA HANG ROYAL BEEF (không có thật).
   - Món bán chạy (gọi nhiều hơn): Phở bò, Bò lúc lắc, Ribeye, Striploin, Lẩu bò nhúng giấm, Bún bò Huế, Cơm bò lúc lắc, Burger.
     Món giá cao (từ 300.000đ: bít tết, lẩu, Tomahawk…) mỗi dòng chỉ 1 phần.
   Mã đơn / mã hóa đơn theo tháng (DH2610-012, HD2610-012) và cộng dồn vào doc_sequences.
   ===================================================================== */

SET @khoa = (SELECT id FROM users WHERE username = 'khoa.le');
SET @linh = (SELECT id FROM users WHERE username = 'linh.tran');
SET @vy   = (SELECT id FROM users WHERE username = 'vy.ngo');
SET @phuc = (SELECT id FROM users WHERE username = 'phuc.do');

/* Bảng tạm (bảng thường để tham chiếu nhiều lần trong một câu lệnh; xóa ở cuối). */
DROP TABLE IF EXISTS seed_v11_dish;
DROP TABLE IF EXISTS seed_v11_table;
DROP TABLE IF EXISTS seed_v11_order;

CREATE TABLE seed_v11_dish (idx INT PRIMARY KEY, dish_id BIGINT UNSIGNED, name VARCHAR(120), price DECIMAL(14,2));
-- 8 món đầu danh sách được gọi nhiều hơn (xem câu INSERT order_items) → đưa các món bán chạy lên đầu.
INSERT INTO seed_v11_dish
SELECT ROW_NUMBER() OVER (ORDER BY FIELD(d.code, 'MA022','MA013','MA008','MA006','MA018','MA023','MA026','MA029') = 0,
                                   FIELD(d.code, 'MA022','MA013','MA008','MA006','MA018','MA023','MA026','MA029'), d.code),
       d.id, d.name, d.price
FROM dishes d WHERE d.status = 'selling';
SET @dn = (SELECT COUNT(*) FROM seed_v11_dish);

CREATE TABLE seed_v11_table (idx INT PRIMARY KEY, table_id BIGINT UNSIGNED);
INSERT INTO seed_v11_table SELECT ROW_NUMBER() OVER (ORDER BY t.code), t.id FROM dining_tables t WHERE t.status <> 'inactive';
SET @tn = (SELECT COUNT(*) FROM seed_v11_table);

CREATE TABLE seed_v11_order (
  n          INT AUTO_INCREMENT PRIMARY KEY,
  d          INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL,
  closed_at  DATETIME NOT NULL,
  table_id   BIGINT UNSIGNED NOT NULL,
  cancelled  TINYINT NOT NULL DEFAULT 0,
  legacy     TINYINT NOT NULL DEFAULT 0,
  code       VARCHAR(20) NULL,
  order_id   BIGINT UNSIGNED NULL,
  total      DECIMAL(14,2) NULL,
  inv_code   VARCHAR(20) NULL,
  invoice_id BIGINT UNSIGNED NULL
);

/* ---------------------------------------------------------------- Đơn lịch sử */
INSERT INTO seed_v11_order (d, created_at, closed_at, table_id, cancelled)
SELECT x.d, x.created_at, x.created_at + INTERVAL (45 + (x.d * 11 + x.k * 17) % 60) MINUTE, st.table_id,
       (x.d * 31 + x.k * 7) % 37 = 0
FROM (
  WITH RECURSIVE days AS (SELECT 0 AS d UNION ALL SELECT d + 1 FROM days WHERE d < 62),
                 nums AS (SELECT 1 AS k UNION ALL SELECT k + 1 FROM nums WHERE k < 17)
  SELECT days.d, nums.k,
         CASE
           WHEN nums.k % 3 = 0 THEN TIMESTAMP(CURDATE() - INTERVAL days.d DAY, '14:00') + INTERVAL ((nums.k * 37 + days.d * 11) % 180) MINUTE
           WHEN nums.k % 2 = 1 THEN TIMESTAMP(CURDATE() - INTERVAL days.d DAY, '11:00') + INTERVAL ((nums.k * 29 + days.d * 7) % 150) MINUTE
           ELSE TIMESTAMP(CURDATE() - INTERVAL days.d DAY, '17:30') + INTERVAL ((nums.k * 23 + days.d * 13) % 210) MINUTE
         END AS created_at
  FROM days JOIN nums
  WHERE nums.k <= 7 + (days.d * 5) % 6 + IF(DAYOFWEEK(CURDATE() - INTERVAL days.d DAY) IN (1, 7), 5, 0)
) x
JOIN seed_v11_table st ON st.idx = 1 + (x.d * 5 + x.k * 3) % @tn
WHERE x.created_at + INTERVAL 105 MINUTE < NOW()
ORDER BY x.created_at;

-- Mã đơn theo tháng, nối tiếp bộ đếm hiện có.
INSERT INTO doc_sequences (seq_key, last_no)
SELECT DISTINCT CONCAT('DH', DATE_FORMAT(created_at, '%y%m')), 0 FROM seed_v11_order
ON DUPLICATE KEY UPDATE last_no = last_no;

UPDATE seed_v11_order s
JOIN (SELECT n, ROW_NUMBER() OVER (PARTITION BY DATE_FORMAT(created_at, '%y%m') ORDER BY created_at, n) AS rn FROM seed_v11_order) r
  ON r.n = s.n
JOIN doc_sequences q ON q.seq_key = CONCAT('DH', DATE_FORMAT(s.created_at, '%y%m')) COLLATE utf8mb4_unicode_ci
SET s.code = CONCAT(q.seq_key, '-', LPAD(q.last_no + r.rn, 3, '0'));

UPDATE doc_sequences q
JOIN (SELECT CONCAT('DH', DATE_FORMAT(created_at, '%y%m')) COLLATE utf8mb4_unicode_ci AS k, COUNT(*) AS c FROM seed_v11_order GROUP BY k) x
  ON x.k = q.seq_key
SET q.last_no = q.last_no + x.c;

INSERT INTO orders (code, table_id, status, source, created_at, closed_at, note)
SELECT code, table_id, IF(cancelled, 'cancelled', 'completed'), 'qr', created_at,
       IF(cancelled, created_at + INTERVAL 12 MINUTE, closed_at), IF(cancelled, 'Hủy: Khách bỏ về', NULL)
FROM seed_v11_order ORDER BY n;

UPDATE seed_v11_order s JOIN orders o ON o.code = s.code SET s.order_id = o.id;

-- 2–5 dòng món; 8 món đầu bảng mã được gọi nhiều hơn (để có nhóm bán chạy rõ ràng).
INSERT INTO order_items (order_id, batch_no, dish_id, dish_name, unit_price, quantity, status, added_via, created_at,
                         started_at, completed_at, served_at, cancel_source, cancel_reason, cancelled_at)
SELECT s.order_id, 1, sd.dish_id, sd.name, sd.price, IF(sd.price >= 300000, 1, 1 + (s.n + j.i) % 3), IF(s.cancelled, 'cancelled', 'served'), 'customer',
       s.created_at,
       IF(s.cancelled, NULL, s.created_at + INTERVAL 4 MINUTE),
       IF(s.cancelled, NULL, s.created_at + INTERVAL 18 MINUTE),
       IF(s.cancelled, NULL, s.created_at + INTERVAL 22 MINUTE),
       IF(s.cancelled, 'cashier', NULL), IF(s.cancelled, 'Khách bỏ về', NULL),
       IF(s.cancelled, s.created_at + INTERVAL 12 MINUTE, NULL)
FROM seed_v11_order s
JOIN (SELECT 1 AS i UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL SELECT 5) j ON j.i <= 2 + (s.n * 7) % 4
JOIN seed_v11_dish sd ON sd.idx = 1 + IF((s.n * 7 + j.i * 13) % (@dn + 8) >= @dn,
                                         (s.n * 7 + j.i * 13) % (@dn + 8) - @dn,
                                         (s.n * 7 + j.i * 13 + s.d) % @dn);

/* 8 đơn hoàn tất có sẵn từ V3_1 (DH-0001…) cũng được lập hóa đơn. */
INSERT INTO seed_v11_order (created_at, closed_at, table_id, legacy, code, order_id)
SELECT o.created_at, o.closed_at, o.table_id, 1, o.code, o.id
FROM orders o
WHERE o.status = 'completed' AND o.closed_at IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM invoices i WHERE i.order_id = o.id)
  AND NOT EXISTS (SELECT 1 FROM seed_v11_order s WHERE s.order_id = o.id);

UPDATE seed_v11_order s
JOIN (SELECT order_id, SUM(unit_price * quantity) AS t FROM order_items WHERE status <> 'cancelled' GROUP BY order_id) x
  ON x.order_id = s.order_id
SET s.total = x.t;

/* ---------------------------------------------------------------- Hóa đơn đã thanh toán */
INSERT INTO doc_sequences (seq_key, last_no)
SELECT DISTINCT CONCAT('HD', DATE_FORMAT(closed_at, '%y%m')), 0 FROM seed_v11_order WHERE cancelled = 0
ON DUPLICATE KEY UPDATE last_no = last_no;

UPDATE seed_v11_order s
JOIN (SELECT n, ROW_NUMBER() OVER (PARTITION BY DATE_FORMAT(closed_at, '%y%m') ORDER BY closed_at, n) AS rn
      FROM seed_v11_order WHERE cancelled = 0) r ON r.n = s.n
JOIN doc_sequences q ON q.seq_key = CONCAT('HD', DATE_FORMAT(s.closed_at, '%y%m')) COLLATE utf8mb4_unicode_ci
SET s.inv_code = CONCAT(q.seq_key, '-', LPAD(q.last_no + r.rn, 3, '0'));

UPDATE doc_sequences q
JOIN (SELECT CONCAT('HD', DATE_FORMAT(closed_at, '%y%m')) COLLATE utf8mb4_unicode_ci AS k, COUNT(*) AS c
      FROM seed_v11_order WHERE cancelled = 0 GROUP BY k) x ON x.k = q.seq_key
SET q.last_no = q.last_no + x.c;

INSERT INTO invoices (code, order_id, subtotal, discount_amount, tax_amount, total_amount, status, vat_company_name, vat_tax_code,
                      cashier_id, created_at, paid_at)
SELECT inv_code, order_id, total, 0, 0, total, 'paid',
       IF(n % 23 = 0, 'Công ty TNHH Minh Phát', NULL), IF(n % 23 = 0, '0312345678', NULL),
       IF(n % 2 = 0, @linh, @khoa), closed_at - INTERVAL 4 MINUTE, closed_at
FROM seed_v11_order WHERE cancelled = 0 ORDER BY closed_at, n;

UPDATE seed_v11_order s JOIN invoices i ON i.code = s.inv_code SET s.invoice_id = i.id;

-- Một hình thức: 0–4 tiền mặt (khách đưa tròn 50.000 đ), 5–6 thẻ, 7–9 chuyển khoản.
INSERT INTO payments (invoice_id, method, amount, cash_given, transaction_ref, paid_at, received_by)
SELECT invoice_id,
       CASE WHEN n % 10 < 5 THEN 'cash' WHEN n % 10 < 7 THEN 'card' ELSE 'transfer' END,
       total,
       IF(n % 10 < 5, CEIL(total / 50000) * 50000, NULL),
       IF(n % 10 < 5, NULL, CONCAT(IF(n % 10 < 7, 'POS', 'FT'), DATE_FORMAT(closed_at, '%y%m%d'), LPAD(n, 5, '0'))),
       closed_at, IF(n % 2 = 0, @linh, @khoa)
FROM seed_v11_order WHERE cancelled = 0 AND n % 13 <> 0;

-- Hai hình thức: nửa tiền mặt, phần còn lại chuyển khoản.
INSERT INTO payments (invoice_id, method, amount, cash_given, transaction_ref, paid_at, received_by)
SELECT invoice_id, 'cash', ROUND(total / 2, -3), ROUND(total / 2, -3), NULL, closed_at, IF(n % 2 = 0, @linh, @khoa)
FROM seed_v11_order WHERE cancelled = 0 AND n % 13 = 0;
INSERT INTO payments (invoice_id, method, amount, cash_given, transaction_ref, paid_at, received_by)
SELECT invoice_id, 'transfer', total - ROUND(total / 2, -3), NULL, CONCAT('FT', DATE_FORMAT(closed_at, '%y%m%d'), LPAD(n, 5, '0')),
       closed_at, IF(n % 2 = 0, @linh, @khoa)
FROM seed_v11_order WHERE cancelled = 0 AND n % 13 = 0;

/* ---------------------------------------------------------------- Yêu cầu của khách (lịch sử) */
INSERT INTO service_requests (table_id, order_id, request_type, payment_method, status, received_by, created_at, done_at)
SELECT table_id, order_id, 'payment', CASE WHEN n % 10 < 5 THEN 'cash' WHEN n % 10 < 7 THEN 'card' ELSE 'transfer' END,
       'done', @linh, closed_at - INTERVAL 8 MINUTE, closed_at
FROM seed_v11_order WHERE cancelled = 0 AND legacy = 0 AND n % 6 = 0;

INSERT INTO service_requests (table_id, order_id, request_type, content, status, received_by, assigned_to, created_at,
                              forwarded_at, done_at)
SELECT table_id, order_id, IF(n % 4 = 0, 'consult', 'support'),
       ELT(1 + n % 4, 'Thêm chén đũa', 'Thêm nước', 'Dọn bàn', NULL), 'done', @linh, IF(n % 2 = 0, @vy, @phuc),
       created_at + INTERVAL 25 MINUTE, created_at + INTERVAL 26 MINUTE, created_at + INTERVAL 30 MINUTE
FROM seed_v11_order WHERE cancelled = 0 AND legacy = 0 AND n % 9 = 0;

/* Đang chờ hôm nay: T03 gọi nhân viên, VIP01 yêu cầu thanh toán (chuyển khoản, xuất VAT). */
INSERT INTO service_requests (table_id, order_id, request_type, content, status, created_at)
SELECT t.id, o.id, 'support', 'Thêm nước', 'new', NOW() - INTERVAL 2 MINUTE
FROM dining_tables t LEFT JOIN orders o ON o.table_id = t.id AND o.status = 'open' WHERE t.code = 'T03';

INSERT INTO service_requests (table_id, order_id, request_type, payment_method, vat_company, vat_tax_code, status, created_at)
SELECT t.id, o.id, 'payment', 'transfer', 'Công ty CP Hoa Sen Xanh', '0109876543', 'new', NOW() - INTERVAL 1 MINUTE
FROM dining_tables t JOIN orders o ON o.table_id = t.id AND o.status = 'open' WHERE t.code = 'VIP01';

/* ---------------------------------------------------------------- Tài khoản nhận tiền mẫu */
UPDATE system_settings SET setting_value = '970436' WHERE setting_key = 'payment.bank_bin';
UPDATE system_settings SET setting_value = 'Vietcombank' WHERE setting_key = 'payment.bank_name';
UPDATE system_settings SET setting_value = '1234567890' WHERE setting_key = 'payment.account_no';
UPDATE system_settings SET setting_value = 'NHA HANG ROYAL BEEF' WHERE setting_key = 'payment.account_name';

DROP TABLE seed_v11_dish;
DROP TABLE seed_v11_table;
DROP TABLE seed_v11_order;
