/* =====================================================================
   V8_1 — DỮ LIỆU MẪU phiếu mua + nhập kho (chỉ môi trường dev, [FAKE-DATA])
   Sinh tự động bằng backend/database/kho-seed/gen-v8_1.mjs. Ngày tháng tính lùi từ ngày chạy migration.
   8 phiếu mua (đã nhận đủ, nhận một phần rồi kết thúc, nhận một phần + trễ hạn, chưa nhận, đã hủy, nháp)
   và 1 phiếu nhập không phiếu. Chưa có thanh toán (đợt 3).
   ===================================================================== */

SET @thao = (SELECT id FROM users WHERE username = 'thao.bui');

/* ---------------------------------------------------------------- Phiếu mua 1: Mua nước giải khát tuần 1 */
SET @k = CONCAT('PM', DATE_FORMAT(CURDATE() - INTERVAL 28 DAY, '%y%m'));
INSERT INTO doc_sequences (seq_key, last_no) VALUES (@k, 1) ON DUPLICATE KEY UPDATE last_no = last_no + 1;
SET @no = (SELECT last_no FROM doc_sequences WHERE seq_key = @k COLLATE utf8mb4_unicode_ci);
SET @code = CONCAT(@k, '-', LPAD(@no, 3, '0'));
INSERT INTO purchase_orders (code, name, supplier_id, status, receive_status, order_date, ordered_at, ordered_by, expected_at, note, discount, tax_percent, other_cost, late_notified, created_by, created_at)
SELECT @code, 'Mua nước giải khát tuần 1', s.id, 'ordered', 'not_received', CURDATE() - INTERVAL 28 DAY, TIMESTAMP(CURDATE() - INTERVAL 28 DAY, '09:10:00'), @thao, CURDATE() - INTERVAL 27 DAY, NULL, 0, 10, 0, 0, @thao, TIMESTAMP(CURDATE() - INTERVAL 28 DAY, '09:00:00') FROM suppliers s WHERE s.code = 'NCC004';
SET @po1 = LAST_INSERT_ID();
INSERT INTO purchase_order_events (purchase_order_id, event, created_by, created_at) VALUES (@po1, 'create', @thao, TIMESTAMP(CURDATE() - INTERVAL 28 DAY, '09:00:00'));
INSERT INTO purchase_order_events (purchase_order_id, event, created_by, created_at) VALUES (@po1, 'order', @thao, TIMESTAMP(CURDATE() - INTERVAL 28 DAY, '09:10:00'));
INSERT INTO purchase_order_items (purchase_order_id, ingredient_id, purchase_unit, factor, qty_ordered, unit_price, sort_order) SELECT @po1, id, 'thùng', 24, 4, 228000, 0 FROM ingredients WHERE code = 'NL022';
SET @poi1_NL022 = LAST_INSERT_ID();
INSERT INTO purchase_order_items (purchase_order_id, ingredient_id, purchase_unit, factor, qty_ordered, unit_price, sort_order) SELECT @po1, id, 'thùng', 24, 3, 132000, 1 FROM ingredients WHERE code = 'NL023';
SET @poi1_NL023 = LAST_INSERT_ID();
INSERT INTO purchase_order_items (purchase_order_id, ingredient_id, purchase_unit, factor, qty_ordered, unit_price, sort_order) SELECT @po1, id, 'thùng', 24, 4, 360000, 2 FROM ingredients WHERE code = 'NL024';
SET @poi1_NL024 = LAST_INSERT_ID();
-- Phiếu nhập theo phiếu mua 1
SET @k = CONCAT('PN', DATE_FORMAT(CURDATE() - INTERVAL 27 DAY, '%y%m'));
INSERT INTO doc_sequences (seq_key, last_no) VALUES (@k, 1) ON DUPLICATE KEY UPDATE last_no = last_no + 1;
SET @no = (SELECT last_no FROM doc_sequences WHERE seq_key = @k COLLATE utf8mb4_unicode_ci);
SET @code = CONCAT(@k, '-', LPAD(@no, 3, '0'));
INSERT INTO goods_receipts (code, kind, purchase_order_id, supplier_id, note, total_value, created_by, created_at) SELECT @code, 'po', @po1, supplier_id, 'Anh Phát giao, hóa đơn 0012345', 2748000, @thao, TIMESTAMP(CURDATE() - INTERVAL 27 DAY, '10:00:00') FROM purchase_orders WHERE id = @po1;
SET @gr = LAST_INSERT_ID();
SET @ing = (SELECT id FROM ingredients WHERE code = 'NL022');
SET @q = (SELECT stock_qty FROM ingredients WHERE id = @ing);
SET @c = (SELECT avg_cost FROM ingredients WHERE id = @ing);
INSERT INTO goods_receipt_items (receipt_id, ingredient_id, purchase_order_item_id, unit, factor, qty, unit_price, amount, stock_qty, stock_unit_cost, prev_qty, prev_avg_cost) VALUES (@gr, @ing, @poi1_NL022, 'thùng', 24, 4, 228000, 912000, 96, 9500, @q, @c);
INSERT INTO stock_transactions (ingredient_id, txn_type, move_type, doc_code, quantity_change, unit_cost, purchase_order_item_id, receipt_id, reason, created_by, created_at) VALUES (@ing, 'import', 'po_receipt', @code, 96, 9500, @poi1_NL022, @gr, 'Nhận hàng theo phiếu mua', @thao, TIMESTAMP(CURDATE() - INTERVAL 27 DAY, '10:00:00'));
UPDATE ingredients SET avg_cost = IF(@q <= 0 OR @c IS NULL, 9500, ROUND((@q * @c + 96 * 9500) / (@q + 96), 2)) WHERE id = @ing;
UPDATE purchase_order_items SET qty_received = qty_received + 4 WHERE id = @poi1_NL022;
SET @ing = (SELECT id FROM ingredients WHERE code = 'NL023');
SET @q = (SELECT stock_qty FROM ingredients WHERE id = @ing);
SET @c = (SELECT avg_cost FROM ingredients WHERE id = @ing);
INSERT INTO goods_receipt_items (receipt_id, ingredient_id, purchase_order_item_id, unit, factor, qty, unit_price, amount, stock_qty, stock_unit_cost, prev_qty, prev_avg_cost) VALUES (@gr, @ing, @poi1_NL023, 'thùng', 24, 3, 132000, 396000, 72, 5500, @q, @c);
INSERT INTO stock_transactions (ingredient_id, txn_type, move_type, doc_code, quantity_change, unit_cost, purchase_order_item_id, receipt_id, reason, created_by, created_at) VALUES (@ing, 'import', 'po_receipt', @code, 72, 5500, @poi1_NL023, @gr, 'Nhận hàng theo phiếu mua', @thao, TIMESTAMP(CURDATE() - INTERVAL 27 DAY, '10:00:00'));
UPDATE ingredients SET avg_cost = IF(@q <= 0 OR @c IS NULL, 5500, ROUND((@q * @c + 72 * 5500) / (@q + 72), 2)) WHERE id = @ing;
UPDATE purchase_order_items SET qty_received = qty_received + 3 WHERE id = @poi1_NL023;
SET @ing = (SELECT id FROM ingredients WHERE code = 'NL024');
SET @q = (SELECT stock_qty FROM ingredients WHERE id = @ing);
SET @c = (SELECT avg_cost FROM ingredients WHERE id = @ing);
INSERT INTO goods_receipt_items (receipt_id, ingredient_id, purchase_order_item_id, unit, factor, qty, unit_price, amount, stock_qty, stock_unit_cost, prev_qty, prev_avg_cost) VALUES (@gr, @ing, @poi1_NL024, 'thùng', 24, 4, 360000, 1440000, 96, 15000, @q, @c);
INSERT INTO stock_transactions (ingredient_id, txn_type, move_type, doc_code, quantity_change, unit_cost, purchase_order_item_id, receipt_id, reason, created_by, created_at) VALUES (@ing, 'import', 'po_receipt', @code, 96, 15000, @poi1_NL024, @gr, 'Nhận hàng theo phiếu mua', @thao, TIMESTAMP(CURDATE() - INTERVAL 27 DAY, '10:00:00'));
UPDATE ingredients SET avg_cost = IF(@q <= 0 OR @c IS NULL, 15000, ROUND((@q * @c + 96 * 15000) / (@q + 96), 2)) WHERE id = @ing;
UPDATE purchase_order_items SET qty_received = qty_received + 4 WHERE id = @poi1_NL024;
UPDATE purchase_orders SET receive_status = 'received' WHERE id = @po1;

/* ---------------------------------------------------------------- Phiếu mua 2: Mua hải sản cuối tuần */
SET @k = CONCAT('PM', DATE_FORMAT(CURDATE() - INTERVAL 21 DAY, '%y%m'));
INSERT INTO doc_sequences (seq_key, last_no) VALUES (@k, 1) ON DUPLICATE KEY UPDATE last_no = last_no + 1;
SET @no = (SELECT last_no FROM doc_sequences WHERE seq_key = @k COLLATE utf8mb4_unicode_ci);
SET @code = CONCAT(@k, '-', LPAD(@no, 3, '0'));
INSERT INTO purchase_orders (code, name, supplier_id, status, receive_status, order_date, ordered_at, ordered_by, expected_at, note, discount, tax_percent, other_cost, late_notified, created_by, created_at)
SELECT @code, 'Mua hải sản cuối tuần', s.id, 'ordered', 'not_received', CURDATE() - INTERVAL 21 DAY, TIMESTAMP(CURDATE() - INTERVAL 21 DAY, '09:10:00'), @thao, CURDATE() - INTERVAL 20 DAY, NULL, 0, 0, 30000, 0, @thao, TIMESTAMP(CURDATE() - INTERVAL 21 DAY, '09:00:00') FROM suppliers s WHERE s.code = 'NCC001';
SET @po2 = LAST_INSERT_ID();
INSERT INTO purchase_order_events (purchase_order_id, event, created_by, created_at) VALUES (@po2, 'create', @thao, TIMESTAMP(CURDATE() - INTERVAL 21 DAY, '09:00:00'));
INSERT INTO purchase_order_events (purchase_order_id, event, created_by, created_at) VALUES (@po2, 'order', @thao, TIMESTAMP(CURDATE() - INTERVAL 21 DAY, '09:10:00'));
INSERT INTO purchase_order_items (purchase_order_id, ingredient_id, purchase_unit, factor, qty_ordered, unit_price, sort_order) SELECT @po2, id, 'kg', 1, 5, 210000, 0 FROM ingredients WHERE code = 'NL007';
SET @poi2_NL007 = LAST_INSERT_ID();
INSERT INTO purchase_order_items (purchase_order_id, ingredient_id, purchase_unit, factor, qty_ordered, unit_price, sort_order) SELECT @po2, id, 'kg', 1, 8, 60000, 1 FROM ingredients WHERE code = 'NL008';
SET @poi2_NL008 = LAST_INSERT_ID();
-- Phiếu nhập theo phiếu mua 2
SET @k = CONCAT('PN', DATE_FORMAT(CURDATE() - INTERVAL 20 DAY, '%y%m'));
INSERT INTO doc_sequences (seq_key, last_no) VALUES (@k, 1) ON DUPLICATE KEY UPDATE last_no = last_no + 1;
SET @no = (SELECT last_no FROM doc_sequences WHERE seq_key = @k COLLATE utf8mb4_unicode_ci);
SET @code = CONCAT(@k, '-', LPAD(@no, 3, '0'));
INSERT INTO goods_receipts (code, kind, purchase_order_id, supplier_id, note, total_value, created_by, created_at) SELECT @code, 'po', @po2, supplier_id, NULL, 1530000, @thao, TIMESTAMP(CURDATE() - INTERVAL 20 DAY, '10:00:00') FROM purchase_orders WHERE id = @po2;
SET @gr = LAST_INSERT_ID();
SET @ing = (SELECT id FROM ingredients WHERE code = 'NL007');
SET @q = (SELECT stock_qty FROM ingredients WHERE id = @ing);
SET @c = (SELECT avg_cost FROM ingredients WHERE id = @ing);
INSERT INTO goods_receipt_items (receipt_id, ingredient_id, purchase_order_item_id, unit, factor, qty, unit_price, amount, stock_qty, stock_unit_cost, prev_qty, prev_avg_cost) VALUES (@gr, @ing, @poi2_NL007, 'kg', 1, 5, 210000, 1050000, 5, 210000, @q, @c);
INSERT INTO stock_transactions (ingredient_id, txn_type, move_type, doc_code, quantity_change, unit_cost, purchase_order_item_id, receipt_id, reason, created_by, created_at) VALUES (@ing, 'import', 'po_receipt', @code, 5, 210000, @poi2_NL007, @gr, 'Nhận hàng theo phiếu mua', @thao, TIMESTAMP(CURDATE() - INTERVAL 20 DAY, '10:00:00'));
UPDATE ingredients SET avg_cost = IF(@q <= 0 OR @c IS NULL, 210000, ROUND((@q * @c + 5 * 210000) / (@q + 5), 2)) WHERE id = @ing;
UPDATE purchase_order_items SET qty_received = qty_received + 5 WHERE id = @poi2_NL007;
SET @ing = (SELECT id FROM ingredients WHERE code = 'NL008');
SET @q = (SELECT stock_qty FROM ingredients WHERE id = @ing);
SET @c = (SELECT avg_cost FROM ingredients WHERE id = @ing);
INSERT INTO goods_receipt_items (receipt_id, ingredient_id, purchase_order_item_id, unit, factor, qty, unit_price, amount, stock_qty, stock_unit_cost, prev_qty, prev_avg_cost) VALUES (@gr, @ing, @poi2_NL008, 'kg', 1, 8, 60000, 480000, 8, 60000, @q, @c);
INSERT INTO stock_transactions (ingredient_id, txn_type, move_type, doc_code, quantity_change, unit_cost, purchase_order_item_id, receipt_id, reason, created_by, created_at) VALUES (@ing, 'import', 'po_receipt', @code, 8, 60000, @poi2_NL008, @gr, 'Nhận hàng theo phiếu mua', @thao, TIMESTAMP(CURDATE() - INTERVAL 20 DAY, '10:00:00'));
UPDATE ingredients SET avg_cost = IF(@q <= 0 OR @c IS NULL, 60000, ROUND((@q * @c + 8 * 60000) / (@q + 8), 2)) WHERE id = @ing;
UPDATE purchase_order_items SET qty_received = qty_received + 8 WHERE id = @poi2_NL008;
UPDATE purchase_orders SET receive_status = 'received' WHERE id = @po2;

/* ---------------------------------------------------------------- Phiếu mua 3: Mua rau củ đầu tuần */
SET @k = CONCAT('PM', DATE_FORMAT(CURDATE() - INTERVAL 16 DAY, '%y%m'));
INSERT INTO doc_sequences (seq_key, last_no) VALUES (@k, 1) ON DUPLICATE KEY UPDATE last_no = last_no + 1;
SET @no = (SELECT last_no FROM doc_sequences WHERE seq_key = @k COLLATE utf8mb4_unicode_ci);
SET @code = CONCAT(@k, '-', LPAD(@no, 3, '0'));
INSERT INTO purchase_orders (code, name, supplier_id, status, receive_status, order_date, ordered_at, ordered_by, expected_at, note, discount, tax_percent, other_cost, late_notified, created_by, created_at)
SELECT @code, 'Mua rau củ đầu tuần', s.id, 'ordered', 'not_received', CURDATE() - INTERVAL 16 DAY, TIMESTAMP(CURDATE() - INTERVAL 16 DAY, '09:10:00'), @thao, CURDATE() - INTERVAL 15 DAY, NULL, 0, 0, 0, 0, @thao, TIMESTAMP(CURDATE() - INTERVAL 16 DAY, '09:00:00') FROM suppliers s WHERE s.code = 'NCC003';
SET @po3 = LAST_INSERT_ID();
INSERT INTO purchase_order_events (purchase_order_id, event, created_by, created_at) VALUES (@po3, 'create', @thao, TIMESTAMP(CURDATE() - INTERVAL 16 DAY, '09:00:00'));
INSERT INTO purchase_order_events (purchase_order_id, event, created_by, created_at) VALUES (@po3, 'order', @thao, TIMESTAMP(CURDATE() - INTERVAL 16 DAY, '09:10:00'));
INSERT INTO purchase_order_items (purchase_order_id, ingredient_id, purchase_unit, factor, qty_ordered, unit_price, sort_order) SELECT @po3, id, 'bó', 1, 20, 8000, 0 FROM ingredients WHERE code = 'NL014';
SET @poi3_NL014 = LAST_INSERT_ID();
INSERT INTO purchase_order_items (purchase_order_id, ingredient_id, purchase_unit, factor, qty_ordered, unit_price, sort_order) SELECT @po3, id, 'kg', 1, 10, 15000, 1 FROM ingredients WHERE code = 'NL016';
SET @poi3_NL016 = LAST_INSERT_ID();
INSERT INTO purchase_order_items (purchase_order_id, ingredient_id, purchase_unit, factor, qty_ordered, unit_price, sort_order) SELECT @po3, id, 'kg', 1, 6, 28000, 2 FROM ingredients WHERE code = 'NL012';
SET @poi3_NL012 = LAST_INSERT_ID();
-- Phiếu nhập theo phiếu mua 3
SET @k = CONCAT('PN', DATE_FORMAT(CURDATE() - INTERVAL 15 DAY, '%y%m'));
INSERT INTO doc_sequences (seq_key, last_no) VALUES (@k, 1) ON DUPLICATE KEY UPDATE last_no = last_no + 1;
SET @no = (SELECT last_no FROM doc_sequences WHERE seq_key = @k COLLATE utf8mb4_unicode_ci);
SET @code = CONCAT(@k, '-', LPAD(@no, 3, '0'));
INSERT INTO goods_receipts (code, kind, purchase_order_id, supplier_id, note, total_value, created_by, created_at) SELECT @code, 'po', @po3, supplier_id, 'Bún giao thiếu 4 kg', 418000, @thao, TIMESTAMP(CURDATE() - INTERVAL 15 DAY, '10:00:00') FROM purchase_orders WHERE id = @po3;
SET @gr = LAST_INSERT_ID();
SET @ing = (SELECT id FROM ingredients WHERE code = 'NL014');
SET @q = (SELECT stock_qty FROM ingredients WHERE id = @ing);
SET @c = (SELECT avg_cost FROM ingredients WHERE id = @ing);
INSERT INTO goods_receipt_items (receipt_id, ingredient_id, purchase_order_item_id, unit, factor, qty, unit_price, amount, stock_qty, stock_unit_cost, prev_qty, prev_avg_cost) VALUES (@gr, @ing, @poi3_NL014, 'bó', 1, 20, 8000, 160000, 20, 8000, @q, @c);
INSERT INTO stock_transactions (ingredient_id, txn_type, move_type, doc_code, quantity_change, unit_cost, purchase_order_item_id, receipt_id, reason, created_by, created_at) VALUES (@ing, 'import', 'po_receipt', @code, 20, 8000, @poi3_NL014, @gr, 'Nhận hàng theo phiếu mua', @thao, TIMESTAMP(CURDATE() - INTERVAL 15 DAY, '10:00:00'));
UPDATE ingredients SET avg_cost = IF(@q <= 0 OR @c IS NULL, 8000, ROUND((@q * @c + 20 * 8000) / (@q + 20), 2)) WHERE id = @ing;
UPDATE purchase_order_items SET qty_received = qty_received + 20 WHERE id = @poi3_NL014;
SET @ing = (SELECT id FROM ingredients WHERE code = 'NL016');
SET @q = (SELECT stock_qty FROM ingredients WHERE id = @ing);
SET @c = (SELECT avg_cost FROM ingredients WHERE id = @ing);
INSERT INTO goods_receipt_items (receipt_id, ingredient_id, purchase_order_item_id, unit, factor, qty, unit_price, amount, stock_qty, stock_unit_cost, prev_qty, prev_avg_cost) VALUES (@gr, @ing, @poi3_NL016, 'kg', 1, 6, 15000, 90000, 6, 15000, @q, @c);
INSERT INTO stock_transactions (ingredient_id, txn_type, move_type, doc_code, quantity_change, unit_cost, purchase_order_item_id, receipt_id, reason, created_by, created_at) VALUES (@ing, 'import', 'po_receipt', @code, 6, 15000, @poi3_NL016, @gr, 'Nhận hàng theo phiếu mua', @thao, TIMESTAMP(CURDATE() - INTERVAL 15 DAY, '10:00:00'));
UPDATE ingredients SET avg_cost = IF(@q <= 0 OR @c IS NULL, 15000, ROUND((@q * @c + 6 * 15000) / (@q + 6), 2)) WHERE id = @ing;
UPDATE purchase_order_items SET qty_received = qty_received + 6 WHERE id = @poi3_NL016;
SET @ing = (SELECT id FROM ingredients WHERE code = 'NL012');
SET @q = (SELECT stock_qty FROM ingredients WHERE id = @ing);
SET @c = (SELECT avg_cost FROM ingredients WHERE id = @ing);
INSERT INTO goods_receipt_items (receipt_id, ingredient_id, purchase_order_item_id, unit, factor, qty, unit_price, amount, stock_qty, stock_unit_cost, prev_qty, prev_avg_cost) VALUES (@gr, @ing, @poi3_NL012, 'kg', 1, 6, 28000, 168000, 6, 28000, @q, @c);
INSERT INTO stock_transactions (ingredient_id, txn_type, move_type, doc_code, quantity_change, unit_cost, purchase_order_item_id, receipt_id, reason, created_by, created_at) VALUES (@ing, 'import', 'po_receipt', @code, 6, 28000, @poi3_NL012, @gr, 'Nhận hàng theo phiếu mua', @thao, TIMESTAMP(CURDATE() - INTERVAL 15 DAY, '10:00:00'));
UPDATE ingredients SET avg_cost = IF(@q <= 0 OR @c IS NULL, 28000, ROUND((@q * @c + 6 * 28000) / (@q + 6), 2)) WHERE id = @ing;
UPDATE purchase_order_items SET qty_received = qty_received + 6 WHERE id = @poi3_NL012;
UPDATE purchase_orders SET receive_status = 'closed' WHERE id = @po3;
INSERT INTO purchase_order_events (purchase_order_id, event, reason, note, created_by, created_at) VALUES (@po3, 'close', 'short', 'Nhà cung cấp báo hết bún, không giao phần còn lại', @thao, TIMESTAMP(CURDATE() - INTERVAL 12 DAY, '16:00:00'));

/* ---------------------------------------------------------------- Phiếu mua 4: Mua gia vị tháng */
SET @k = CONCAT('PM', DATE_FORMAT(CURDATE() - INTERVAL 14 DAY, '%y%m'));
INSERT INTO doc_sequences (seq_key, last_no) VALUES (@k, 1) ON DUPLICATE KEY UPDATE last_no = last_no + 1;
SET @no = (SELECT last_no FROM doc_sequences WHERE seq_key = @k COLLATE utf8mb4_unicode_ci);
SET @code = CONCAT(@k, '-', LPAD(@no, 3, '0'));
INSERT INTO purchase_orders (code, name, supplier_id, status, receive_status, order_date, ordered_at, ordered_by, expected_at, note, discount, tax_percent, other_cost, late_notified, created_by, created_at)
SELECT @code, 'Mua gia vị tháng', s.id, 'ordered', 'not_received', CURDATE() - INTERVAL 14 DAY, TIMESTAMP(CURDATE() - INTERVAL 14 DAY, '09:10:00'), @thao, CURDATE() - INTERVAL 13 DAY, NULL, 50000, 8, 0, 0, @thao, TIMESTAMP(CURDATE() - INTERVAL 14 DAY, '09:00:00') FROM suppliers s WHERE s.code = 'NCC005';
SET @po4 = LAST_INSERT_ID();
INSERT INTO purchase_order_events (purchase_order_id, event, created_by, created_at) VALUES (@po4, 'create', @thao, TIMESTAMP(CURDATE() - INTERVAL 14 DAY, '09:00:00'));
INSERT INTO purchase_order_events (purchase_order_id, event, created_by, created_at) VALUES (@po4, 'order', @thao, TIMESTAMP(CURDATE() - INTERVAL 14 DAY, '09:10:00'));
INSERT INTO purchase_order_items (purchase_order_id, ingredient_id, purchase_unit, factor, qty_ordered, unit_price, sort_order) SELECT @po4, id, 'thùng', 12, 1, 540000, 0 FROM ingredients WHERE code = 'NL019';
SET @poi4_NL019 = LAST_INSERT_ID();
INSERT INTO purchase_order_items (purchase_order_id, ingredient_id, purchase_unit, factor, qty_ordered, unit_price, sort_order) SELECT @po4, id, 'can', 5, 3, 210000, 1 FROM ingredients WHERE code = 'NL020';
SET @poi4_NL020 = LAST_INSERT_ID();
INSERT INTO purchase_order_items (purchase_order_id, ingredient_id, purchase_unit, factor, qty_ordered, unit_price, sort_order) SELECT @po4, id, 'kg', 1, 5, 22500, 2 FROM ingredients WHERE code = 'NL021';
SET @poi4_NL021 = LAST_INSERT_ID();
-- Phiếu nhập theo phiếu mua 4
SET @k = CONCAT('PN', DATE_FORMAT(CURDATE() - INTERVAL 13 DAY, '%y%m'));
INSERT INTO doc_sequences (seq_key, last_no) VALUES (@k, 1) ON DUPLICATE KEY UPDATE last_no = last_no + 1;
SET @no = (SELECT last_no FROM doc_sequences WHERE seq_key = @k COLLATE utf8mb4_unicode_ci);
SET @code = CONCAT(@k, '-', LPAD(@no, 3, '0'));
INSERT INTO goods_receipts (code, kind, purchase_order_id, supplier_id, note, total_value, created_by, created_at) SELECT @code, 'po', @po4, supplier_id, NULL, 1282500, @thao, TIMESTAMP(CURDATE() - INTERVAL 13 DAY, '10:00:00') FROM purchase_orders WHERE id = @po4;
SET @gr = LAST_INSERT_ID();
SET @ing = (SELECT id FROM ingredients WHERE code = 'NL019');
SET @q = (SELECT stock_qty FROM ingredients WHERE id = @ing);
SET @c = (SELECT avg_cost FROM ingredients WHERE id = @ing);
INSERT INTO goods_receipt_items (receipt_id, ingredient_id, purchase_order_item_id, unit, factor, qty, unit_price, amount, stock_qty, stock_unit_cost, prev_qty, prev_avg_cost) VALUES (@gr, @ing, @poi4_NL019, 'thùng', 12, 1, 540000, 540000, 12, 43245.61, @q, @c);
INSERT INTO stock_transactions (ingredient_id, txn_type, move_type, doc_code, quantity_change, unit_cost, purchase_order_item_id, receipt_id, reason, created_by, created_at) VALUES (@ing, 'import', 'po_receipt', @code, 12, 43245.61, @poi4_NL019, @gr, 'Nhận hàng theo phiếu mua', @thao, TIMESTAMP(CURDATE() - INTERVAL 13 DAY, '10:00:00'));
UPDATE ingredients SET avg_cost = IF(@q <= 0 OR @c IS NULL, 43245.61, ROUND((@q * @c + 12 * 43245.61) / (@q + 12), 2)) WHERE id = @ing;
UPDATE purchase_order_items SET qty_received = qty_received + 1 WHERE id = @poi4_NL019;
SET @ing = (SELECT id FROM ingredients WHERE code = 'NL020');
SET @q = (SELECT stock_qty FROM ingredients WHERE id = @ing);
SET @c = (SELECT avg_cost FROM ingredients WHERE id = @ing);
INSERT INTO goods_receipt_items (receipt_id, ingredient_id, purchase_order_item_id, unit, factor, qty, unit_price, amount, stock_qty, stock_unit_cost, prev_qty, prev_avg_cost) VALUES (@gr, @ing, @poi4_NL020, 'can', 5, 3, 210000, 630000, 15, 40362.57, @q, @c);
INSERT INTO stock_transactions (ingredient_id, txn_type, move_type, doc_code, quantity_change, unit_cost, purchase_order_item_id, receipt_id, reason, created_by, created_at) VALUES (@ing, 'import', 'po_receipt', @code, 15, 40362.57, @poi4_NL020, @gr, 'Nhận hàng theo phiếu mua', @thao, TIMESTAMP(CURDATE() - INTERVAL 13 DAY, '10:00:00'));
UPDATE ingredients SET avg_cost = IF(@q <= 0 OR @c IS NULL, 40362.57, ROUND((@q * @c + 15 * 40362.57) / (@q + 15), 2)) WHERE id = @ing;
UPDATE purchase_order_items SET qty_received = qty_received + 3 WHERE id = @poi4_NL020;
SET @ing = (SELECT id FROM ingredients WHERE code = 'NL021');
SET @q = (SELECT stock_qty FROM ingredients WHERE id = @ing);
SET @c = (SELECT avg_cost FROM ingredients WHERE id = @ing);
INSERT INTO goods_receipt_items (receipt_id, ingredient_id, purchase_order_item_id, unit, factor, qty, unit_price, amount, stock_qty, stock_unit_cost, prev_qty, prev_avg_cost) VALUES (@gr, @ing, @poi4_NL021, 'kg', 1, 5, 22500, 112500, 5, 21622.81, @q, @c);
INSERT INTO stock_transactions (ingredient_id, txn_type, move_type, doc_code, quantity_change, unit_cost, purchase_order_item_id, receipt_id, reason, created_by, created_at) VALUES (@ing, 'import', 'po_receipt', @code, 5, 21622.81, @poi4_NL021, @gr, 'Nhận hàng theo phiếu mua', @thao, TIMESTAMP(CURDATE() - INTERVAL 13 DAY, '10:00:00'));
UPDATE ingredients SET avg_cost = IF(@q <= 0 OR @c IS NULL, 21622.81, ROUND((@q * @c + 5 * 21622.81) / (@q + 5), 2)) WHERE id = @ing;
UPDATE purchase_order_items SET qty_received = qty_received + 5 WHERE id = @poi4_NL021;
UPDATE purchase_orders SET receive_status = 'received' WHERE id = @po4;

/* ---------------------------------------------------------------- Phiếu mua 5: Mua bia bổ sung */
SET @k = CONCAT('PM', DATE_FORMAT(CURDATE() - INTERVAL 10 DAY, '%y%m'));
INSERT INTO doc_sequences (seq_key, last_no) VALUES (@k, 1) ON DUPLICATE KEY UPDATE last_no = last_no + 1;
SET @no = (SELECT last_no FROM doc_sequences WHERE seq_key = @k COLLATE utf8mb4_unicode_ci);
SET @code = CONCAT(@k, '-', LPAD(@no, 3, '0'));
INSERT INTO purchase_orders (code, name, supplier_id, status, receive_status, order_date, ordered_at, ordered_by, expected_at, note, discount, tax_percent, other_cost, late_notified, created_by, created_at)
SELECT @code, 'Mua bia bổ sung', s.id, 'cancelled', 'not_received', CURDATE() - INTERVAL 10 DAY, TIMESTAMP(CURDATE() - INTERVAL 10 DAY, '09:10:00'), @thao, CURDATE() - INTERVAL 9 DAY, NULL, 0, 0, 0, 0, @thao, TIMESTAMP(CURDATE() - INTERVAL 10 DAY, '09:00:00') FROM suppliers s WHERE s.code = 'NCC004';
SET @po5 = LAST_INSERT_ID();
INSERT INTO purchase_order_events (purchase_order_id, event, created_by, created_at) VALUES (@po5, 'create', @thao, TIMESTAMP(CURDATE() - INTERVAL 10 DAY, '09:00:00'));
INSERT INTO purchase_order_events (purchase_order_id, event, created_by, created_at) VALUES (@po5, 'order', @thao, TIMESTAMP(CURDATE() - INTERVAL 10 DAY, '09:10:00'));
INSERT INTO purchase_order_items (purchase_order_id, ingredient_id, purchase_unit, factor, qty_ordered, unit_price, sort_order) SELECT @po5, id, 'thùng', 24, 2, 360000, 0 FROM ingredients WHERE code = 'NL024';
SET @poi5_NL024 = LAST_INSERT_ID();
INSERT INTO purchase_order_events (purchase_order_id, event, reason, note, created_by, created_at) VALUES (@po5, 'cancel', 'wrong', 'Trùng với phiếu đã đặt qua điện thoại', @thao, TIMESTAMP(CURDATE() - INTERVAL 9 DAY, '08:45:00'));

/* ---------------------------------------------------------------- Phiếu mua 6: Mua thịt, gạo, sữa */
SET @k = CONCAT('PM', DATE_FORMAT(CURDATE() - INTERVAL 7 DAY, '%y%m'));
INSERT INTO doc_sequences (seq_key, last_no) VALUES (@k, 1) ON DUPLICATE KEY UPDATE last_no = last_no + 1;
SET @no = (SELECT last_no FROM doc_sequences WHERE seq_key = @k COLLATE utf8mb4_unicode_ci);
SET @code = CONCAT(@k, '-', LPAD(@no, 3, '0'));
INSERT INTO purchase_orders (code, name, supplier_id, status, receive_status, order_date, ordered_at, ordered_by, expected_at, note, discount, tax_percent, other_cost, late_notified, created_by, created_at)
SELECT @code, 'Mua thịt, gạo, sữa', s.id, 'ordered', 'not_received', CURDATE() - INTERVAL 7 DAY, TIMESTAMP(CURDATE() - INTERVAL 7 DAY, '09:10:00'), @thao, CURDATE() - INTERVAL 5 DAY, NULL, 0, 0, 0, 1, @thao, TIMESTAMP(CURDATE() - INTERVAL 7 DAY, '09:00:00') FROM suppliers s WHERE s.code = 'NCC002';
SET @po6 = LAST_INSERT_ID();
INSERT INTO purchase_order_events (purchase_order_id, event, created_by, created_at) VALUES (@po6, 'create', @thao, TIMESTAMP(CURDATE() - INTERVAL 7 DAY, '09:00:00'));
INSERT INTO purchase_order_events (purchase_order_id, event, created_by, created_at) VALUES (@po6, 'order', @thao, TIMESTAMP(CURDATE() - INTERVAL 7 DAY, '09:10:00'));
INSERT INTO purchase_order_items (purchase_order_id, ingredient_id, purchase_unit, factor, qty_ordered, unit_price, sort_order) SELECT @po6, id, 'kg', 1, 6, 160000, 0 FROM ingredients WHERE code = 'NL009';
SET @poi6_NL009 = LAST_INSERT_ID();
INSERT INTO purchase_order_items (purchase_order_id, ingredient_id, purchase_unit, factor, qty_ordered, unit_price, sort_order) SELECT @po6, id, 'bao', 25, 1, 800000, 1 FROM ingredients WHERE code = 'NL015';
SET @poi6_NL015 = LAST_INSERT_ID();
INSERT INTO purchase_order_items (purchase_order_id, ingredient_id, purchase_unit, factor, qty_ordered, unit_price, sort_order) SELECT @po6, id, 'lít', 1, 10, 36000, 2 FROM ingredients WHERE code = 'NL018';
SET @poi6_NL018 = LAST_INSERT_ID();
-- Phiếu nhập theo phiếu mua 6
SET @k = CONCAT('PN', DATE_FORMAT(CURDATE() - INTERVAL 5 DAY, '%y%m'));
INSERT INTO doc_sequences (seq_key, last_no) VALUES (@k, 1) ON DUPLICATE KEY UPDATE last_no = last_no + 1;
SET @no = (SELECT last_no FROM doc_sequences WHERE seq_key = @k COLLATE utf8mb4_unicode_ci);
SET @code = CONCAT(@k, '-', LPAD(@no, 3, '0'));
INSERT INTO goods_receipts (code, kind, purchase_order_id, supplier_id, note, total_value, created_by, created_at) SELECT @code, 'po', @po6, supplier_id, 'Sữa hẹn giao sau', 1760000, @thao, TIMESTAMP(CURDATE() - INTERVAL 5 DAY, '10:00:00') FROM purchase_orders WHERE id = @po6;
SET @gr = LAST_INSERT_ID();
SET @ing = (SELECT id FROM ingredients WHERE code = 'NL009');
SET @q = (SELECT stock_qty FROM ingredients WHERE id = @ing);
SET @c = (SELECT avg_cost FROM ingredients WHERE id = @ing);
INSERT INTO goods_receipt_items (receipt_id, ingredient_id, purchase_order_item_id, unit, factor, qty, unit_price, amount, stock_qty, stock_unit_cost, prev_qty, prev_avg_cost) VALUES (@gr, @ing, @poi6_NL009, 'kg', 1, 6, 160000, 960000, 6, 160000, @q, @c);
INSERT INTO stock_transactions (ingredient_id, txn_type, move_type, doc_code, quantity_change, unit_cost, purchase_order_item_id, receipt_id, reason, created_by, created_at) VALUES (@ing, 'import', 'po_receipt', @code, 6, 160000, @poi6_NL009, @gr, 'Nhận hàng theo phiếu mua', @thao, TIMESTAMP(CURDATE() - INTERVAL 5 DAY, '10:00:00'));
UPDATE ingredients SET avg_cost = IF(@q <= 0 OR @c IS NULL, 160000, ROUND((@q * @c + 6 * 160000) / (@q + 6), 2)) WHERE id = @ing;
UPDATE purchase_order_items SET qty_received = qty_received + 6 WHERE id = @poi6_NL009;
SET @ing = (SELECT id FROM ingredients WHERE code = 'NL015');
SET @q = (SELECT stock_qty FROM ingredients WHERE id = @ing);
SET @c = (SELECT avg_cost FROM ingredients WHERE id = @ing);
INSERT INTO goods_receipt_items (receipt_id, ingredient_id, purchase_order_item_id, unit, factor, qty, unit_price, amount, stock_qty, stock_unit_cost, prev_qty, prev_avg_cost) VALUES (@gr, @ing, @poi6_NL015, 'bao', 25, 1, 800000, 800000, 25, 32000, @q, @c);
INSERT INTO stock_transactions (ingredient_id, txn_type, move_type, doc_code, quantity_change, unit_cost, purchase_order_item_id, receipt_id, reason, created_by, created_at) VALUES (@ing, 'import', 'po_receipt', @code, 25, 32000, @poi6_NL015, @gr, 'Nhận hàng theo phiếu mua', @thao, TIMESTAMP(CURDATE() - INTERVAL 5 DAY, '10:00:00'));
UPDATE ingredients SET avg_cost = IF(@q <= 0 OR @c IS NULL, 32000, ROUND((@q * @c + 25 * 32000) / (@q + 25), 2)) WHERE id = @ing;
UPDATE purchase_order_items SET qty_received = qty_received + 1 WHERE id = @poi6_NL015;
UPDATE purchase_orders SET receive_status = 'partial' WHERE id = @po6;
INSERT INTO notifications (type_code, title, content, ref_table, ref_id, created_at) SELECT 'purchase', CONCAT('Phiếu mua ', code, ' trễ hạn'), CONCAT('Công ty Thực phẩm Đại Phát chưa giao đủ hàng, dự kiến nhận ngày ', DATE_FORMAT(expected_at, '%d/%m/%Y'), '.'), 'purchase_orders', id, TIMESTAMP(CURDATE() - INTERVAL 4 DAY, '08:00:00') FROM purchase_orders WHERE id = @po6;
SET @ntf = LAST_INSERT_ID();
INSERT INTO notification_recipients (notification_id, user_id) SELECT @ntf, u.id FROM users u JOIN roles r ON r.id = u.role_id WHERE r.code = 'warehouse' AND u.deleted_at IS NULL AND u.status = 'active';

/* ---------------------------------------------------------------- Phiếu mua 7: Mua rau, đậu hũ */
SET @k = CONCAT('PM', DATE_FORMAT(CURDATE() - INTERVAL 2 DAY, '%y%m'));
INSERT INTO doc_sequences (seq_key, last_no) VALUES (@k, 1) ON DUPLICATE KEY UPDATE last_no = last_no + 1;
SET @no = (SELECT last_no FROM doc_sequences WHERE seq_key = @k COLLATE utf8mb4_unicode_ci);
SET @code = CONCAT(@k, '-', LPAD(@no, 3, '0'));
INSERT INTO purchase_orders (code, name, supplier_id, status, receive_status, order_date, ordered_at, ordered_by, expected_at, note, discount, tax_percent, other_cost, late_notified, created_by, created_at)
SELECT @code, 'Mua rau, đậu hũ', s.id, 'ordered', 'not_received', CURDATE() - INTERVAL 2 DAY, TIMESTAMP(CURDATE() - INTERVAL 2 DAY, '09:10:00'), @thao, CURDATE() - INTERVAL -1 DAY, NULL, 0, 0, 0, 0, @thao, TIMESTAMP(CURDATE() - INTERVAL 2 DAY, '09:00:00') FROM suppliers s WHERE s.code = 'NCC003';
SET @po7 = LAST_INSERT_ID();
INSERT INTO purchase_order_events (purchase_order_id, event, created_by, created_at) VALUES (@po7, 'create', @thao, TIMESTAMP(CURDATE() - INTERVAL 2 DAY, '09:00:00'));
INSERT INTO purchase_order_events (purchase_order_id, event, created_by, created_at) VALUES (@po7, 'order', @thao, TIMESTAMP(CURDATE() - INTERVAL 2 DAY, '09:10:00'));
INSERT INTO purchase_order_items (purchase_order_id, ingredient_id, purchase_unit, factor, qty_ordered, unit_price, sort_order) SELECT @po7, id, 'khay', 10, 3, 80000, 0 FROM ingredients WHERE code = 'NL005';
SET @poi7_NL005 = LAST_INSERT_ID();
INSERT INTO purchase_order_items (purchase_order_id, ingredient_id, purchase_unit, factor, qty_ordered, unit_price, sort_order) SELECT @po7, id, 'kg', 1, 2, 40000, 1 FROM ingredients WHERE code = 'NL013';
SET @poi7_NL013 = LAST_INSERT_ID();
INSERT INTO purchase_order_items (purchase_order_id, ingredient_id, purchase_unit, factor, qty_ordered, unit_price, sort_order) SELECT @po7, id, 'kg', 1, 4, 35000, 2 FROM ingredients WHERE code = 'NL011';
SET @poi7_NL011 = LAST_INSERT_ID();

/* ---------------------------------------------------------------- Phiếu mua 8: Mua tôm sú */
SET @k = CONCAT('PM', DATE_FORMAT(CURDATE() - INTERVAL 0 DAY, '%y%m'));
INSERT INTO doc_sequences (seq_key, last_no) VALUES (@k, 1) ON DUPLICATE KEY UPDATE last_no = last_no + 1;
SET @no = (SELECT last_no FROM doc_sequences WHERE seq_key = @k COLLATE utf8mb4_unicode_ci);
SET @code = CONCAT(@k, '-', LPAD(@no, 3, '0'));
INSERT INTO purchase_orders (code, name, supplier_id, status, receive_status, order_date, ordered_at, ordered_by, expected_at, note, discount, tax_percent, other_cost, late_notified, created_by, created_at)
SELECT @code, 'Mua tôm sú', s.id, 'draft', 'not_received', CURDATE() - INTERVAL 0 DAY, NULL, NULL, NULL, 'Chờ báo giá tôm tuần này', 0, 0, 0, 0, @thao, TIMESTAMP(CURDATE() - INTERVAL 0 DAY, '09:00:00') FROM suppliers s WHERE s.code = 'NCC001';
SET @po8 = LAST_INSERT_ID();
INSERT INTO purchase_order_events (purchase_order_id, event, created_by, created_at) VALUES (@po8, 'create', @thao, TIMESTAMP(CURDATE() - INTERVAL 0 DAY, '09:00:00'));
INSERT INTO purchase_order_items (purchase_order_id, ingredient_id, purchase_unit, factor, qty_ordered, unit_price, sort_order) SELECT @po8, id, 'kg', 1, 5, 280000, 0 FROM ingredients WHERE code = 'NL001';
SET @poi8_NL001 = LAST_INSERT_ID();

/* ---------------------------------------------------------------- Nhập không phiếu (mua lẻ) */
SET @k = CONCAT('PN', DATE_FORMAT(CURDATE() - INTERVAL 9 DAY, '%y%m'));
INSERT INTO doc_sequences (seq_key, last_no) VALUES (@k, 1) ON DUPLICATE KEY UPDATE last_no = last_no + 1;
SET @no = (SELECT last_no FROM doc_sequences WHERE seq_key = @k COLLATE utf8mb4_unicode_ci);
SET @code = CONCAT(@k, '-', LPAD(@no, 3, '0'));
INSERT INTO goods_receipts (code, kind, source_name, note, total_value, created_by, created_at) VALUES (@code, 'direct', 'Chợ Bến Thành', 'Mua gấp cho tiệc tối', 166000, @thao, TIMESTAMP(CURDATE() - INTERVAL 9 DAY, '15:30:00'));
SET @gr = LAST_INSERT_ID();
SET @ing = (SELECT id FROM ingredients WHERE code = 'NL012');
SET @q = (SELECT stock_qty FROM ingredients WHERE id = @ing);
SET @c = (SELECT avg_cost FROM ingredients WHERE id = @ing);
INSERT INTO goods_receipt_items (receipt_id, ingredient_id, purchase_order_item_id, unit, factor, qty, unit_price, amount, stock_qty, stock_unit_cost, prev_qty, prev_avg_cost) VALUES (@gr, @ing, NULL, 'kg', 1, 3, 30000, 90000, 3, 30000, @q, @c);
INSERT INTO stock_transactions (ingredient_id, txn_type, move_type, doc_code, quantity_change, unit_cost, purchase_order_item_id, receipt_id, reason, created_by, created_at) VALUES (@ing, 'import', 'direct_receipt', @code, 3, 30000, NULL, @gr, 'Nhập không phiếu – Chợ Bến Thành', @thao, TIMESTAMP(CURDATE() - INTERVAL 9 DAY, '15:30:00'));
UPDATE ingredients SET avg_cost = IF(@q <= 0 OR @c IS NULL, 30000, ROUND((@q * @c + 3 * 30000) / (@q + 3), 2)) WHERE id = @ing;
SET @ing = (SELECT id FROM ingredients WHERE code = 'NL011');
SET @q = (SELECT stock_qty FROM ingredients WHERE id = @ing);
SET @c = (SELECT avg_cost FROM ingredients WHERE id = @ing);
INSERT INTO goods_receipt_items (receipt_id, ingredient_id, purchase_order_item_id, unit, factor, qty, unit_price, amount, stock_qty, stock_unit_cost, prev_qty, prev_avg_cost) VALUES (@gr, @ing, NULL, 'kg', 1, 2, 38000, 76000, 2, 38000, @q, @c);
INSERT INTO stock_transactions (ingredient_id, txn_type, move_type, doc_code, quantity_change, unit_cost, purchase_order_item_id, receipt_id, reason, created_by, created_at) VALUES (@ing, 'import', 'direct_receipt', @code, 2, 38000, NULL, @gr, 'Nhập không phiếu – Chợ Bến Thành', @thao, TIMESTAMP(CURDATE() - INTERVAL 9 DAY, '15:30:00'));
UPDATE ingredients SET avg_cost = IF(@q <= 0 OR @c IS NULL, 38000, ROUND((@q * @c + 2 * 38000) / (@q + 2), 2)) WHERE id = @ing;

UPDATE ingredients SET alert_level = CASE WHEN stock_qty <= 0 THEN 'out' WHEN stock_qty <= min_level THEN 'low' ELSE 'ok' END;
