/* =====================================================================
   KIỂM TRA NHANH SAU KHI CHẠY rms_schema.sql
   Chạy:  mysql -u root -p --default-character-set=utf8mb4 < database/rms_verify.sql
   Mọi thay đổi chạy trong procedure và được ROLLBACK → dữ liệu khởi tạo giữ nguyên.
   ===================================================================== */
USE rms_db;
SET NAMES utf8mb4;

DROP PROCEDURE IF EXISTS sp_verify;
DELIMITER $$
CREATE PROCEDURE sp_verify()
BEGIN
  DECLARE v_err INT DEFAULT 0;
  DECLARE v_ing BIGINT UNSIGNED;
  DECLARE v_dish BIGINT UNSIGNED;
  DECLARE v_order BIGINT UNSIGNED;
  DECLARE v_stock DECIMAL(12,3);
  DECLARE CONTINUE HANDLER FOR SQLEXCEPTION SET v_err = 1;

  DROP TEMPORARY TABLE IF EXISTS t_result;
  -- MEMORY: không bị ROLLBACK cuốn mất kết quả
  CREATE TEMPORARY TABLE t_result (test VARCHAR(120), result VARCHAR(10)) ENGINE=MEMORY;

  START TRANSACTION;

  -- 1. Xuất kho vượt tồn phải bị trigger chặn
  SELECT id, stock_qty INTO v_ing, v_stock FROM ingredients WHERE code = 'NL001';
  SET v_err = 0;
  INSERT INTO stock_transactions (ingredient_id, txn_type, quantity_change) VALUES (v_ing, 'export', -(v_stock + 1));
  INSERT INTO t_result VALUES ('Chặn xuất kho vượt tồn', IF(v_err = 1, 'PASS', 'FAIL'));

  -- 2. Xuất kho hợp lệ phải trừ tồn đúng
  SET v_err = 0;
  INSERT INTO stock_transactions (ingredient_id, txn_type, quantity_change) VALUES (v_ing, 'export', -2);
  INSERT INTO t_result VALUES ('Xuất kho hợp lệ trừ tồn',
    IF(v_err = 0 AND (SELECT stock_qty FROM ingredients WHERE id = v_ing) = v_stock - 2, 'PASS', 'FAIL'));

  -- 3. Không cho sửa/xóa phiếu kho
  SET v_err = 0;
  UPDATE stock_transactions SET reason = 'sửa' WHERE ingredient_id = v_ing LIMIT 1;
  INSERT INTO t_result VALUES ('Chặn sửa phiếu kho', IF(v_err = 1, 'PASS', 'FAIL'));

  -- 4. Món đã có trong đơn hàng không xóa được
  SELECT id INTO v_dish FROM dishes WHERE code = 'MA001';
  INSERT INTO orders (code, table_id, source) VALUES ('DH-TEST', (SELECT id FROM dining_tables WHERE code = 'T01'), 'qr');
  SET v_order = LAST_INSERT_ID();
  INSERT INTO order_items (order_id, dish_id, dish_name, unit_price, quantity) VALUES (v_order, v_dish, 'Gỏi cuốn tôm thịt', 35000, 2);
  SET v_err = 0;
  DELETE FROM dishes WHERE id = v_dish;
  INSERT INTO t_result VALUES ('Chặn xóa món đã bán', IF(v_err = 1, 'PASS', 'FAIL'));

  -- 5. Ngừng bán → AI tự tắt gợi ý
  UPDATE dishes SET status = 'stopped' WHERE id = v_dish;
  INSERT INTO t_result VALUES ('Ngừng bán tự tắt ai_enabled',
    IF((SELECT ai_enabled FROM dishes WHERE id = v_dish) = 0, 'PASS', 'FAIL'));

  -- 6. Hóa đơn sai tổng tiền bị CHECK chặn
  SET v_err = 0;
  INSERT INTO invoices (code, order_id, subtotal, total_amount) VALUES ('HD-TEST', v_order, 70000, 50000);
  INSERT INTO t_result VALUES ('Chặn hóa đơn sai tổng tiền', IF(v_err = 1, 'PASS', 'FAIL'));

  -- 7. Hóa đơn đúng + thanh toán → view doanh thu có số liệu
  SET v_err = 0;
  INSERT INTO invoices (code, order_id, subtotal, total_amount, status, paid_at) VALUES ('HD-TEST', v_order, 70000, 70000, 'paid', NOW());
  INSERT INTO payments (invoice_id, method, amount) VALUES (LAST_INSERT_ID(), 'cash', 70000);
  INSERT INTO t_result VALUES ('Lập hóa đơn & doanh thu theo ngày',
    IF(v_err = 0 AND (SELECT revenue FROM v_revenue_daily WHERE revenue_date = CURRENT_DATE) >= 70000, 'PASS', 'FAIL'));

  -- 8. Hai bàn cùng một ô sơ đồ bị chặn
  SET v_err = 0;
  INSERT INTO dining_tables (code, area_id, seats, pos_x, pos_y, qr_token)
  SELECT 'TEST1', area_id, 2, pos_x, pos_y, REPLACE(UUID(),'-','') FROM dining_tables WHERE code = 'T01';
  INSERT INTO t_result VALUES ('Chặn hai bàn trùng ô sơ đồ', IF(v_err = 1, 'PASS', 'FAIL'));

  -- 9. Ca trùng khung giờ bị chặn ("Dữ liệu bị trùng lặp")
  SET v_err = 0;
  INSERT INTO shifts (name, start_time, end_time) VALUES ('Ca sáng 2', '06:00', '14:00');
  INSERT INTO t_result VALUES ('Chặn ca trùng khung giờ', IF(v_err = 1, 'PASS', 'FAIL'));

  -- 10. Ca đã phân công không xóa được
  INSERT INTO shift_assignments (shift_id, user_id, work_date)
  VALUES ((SELECT id FROM shifts WHERE name = 'Ca sáng'), (SELECT id FROM users WHERE username = 'nam.hoang'), CURRENT_DATE);
  SET v_err = 0;
  DELETE FROM shifts WHERE name = 'Ca sáng';
  INSERT INTO t_result VALUES ('Chặn xóa ca đã phân công', IF(v_err = 1, 'PASS', 'FAIL'));

  -- 11. Phân quyền: thêm actor mới chỉ bằng INSERT
  SET v_err = 0;
  INSERT INTO roles (code, name, is_system) VALUES ('shipper_test', 'Actor thử nghiệm', 0);
  INSERT INTO role_permissions (role_id, permission_id)
  SELECT LAST_INSERT_ID(), id FROM permissions WHERE code = 'notification.view';
  INSERT INTO t_result VALUES ('Thêm actor mới không cần ALTER', IF(v_err = 0, 'PASS', 'FAIL'));

  ROLLBACK;

  SELECT test AS `Kiểm tra`, result AS `Kết quả` FROM t_result;
  SELECT (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'rms_db' AND table_type = 'BASE TABLE') AS so_bang,
         (SELECT COUNT(*) FROM information_schema.views  WHERE table_schema = 'rms_db') AS so_view,
         (SELECT COUNT(*) FROM information_schema.triggers WHERE trigger_schema = 'rms_db') AS so_trigger;
END$$
DELIMITER ;

CALL sp_verify();
DROP PROCEDURE sp_verify;
