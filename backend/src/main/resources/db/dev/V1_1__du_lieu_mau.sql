/* =====================================================================
   DỮ LIỆU MẪU ĐỂ PHÁT TRIỂN & DEMO — KHÔNG dùng cho môi trường thật

   Flyway chỉ chạy file này ở profile "dev" (mặc định khi chạy mvn spring-boot:run / IDE).
   Khi chạy thật (profile "prod") thư mục db/dev không được nạp → CSDL chỉ có dữ liệu nền.

   Nội dung: tài khoản mẫu, khu vực & bàn, món ăn, nguyên liệu & tồn đầu kỳ, nhà cung cấp, ca làm,
   FAQ, và dữ liệu mô phỏng các actor CHƯA được xây dựng (lịch đặt bàn của Khách hàng...).
   Ngày giờ tính tương đối theo lúc file được chạy (lần đầu khởi động trên CSDL trống).
   Muốn có lại dữ liệu "hôm nay": xóa CSDL rms_db rồi chạy lại backend.

   Mật khẩu chung của mọi tài khoản mẫu: "Rms@2026" (đã băm bcrypt).
   must_change_password = 0 để nhóm đăng nhập ngay; tài khoản do quản lý tạo trên giao diện
   có must_change_password = 1 → buộc đổi mật khẩu ở lần đăng nhập đầu.
   ===================================================================== */

SET NAMES utf8mb4;
SET time_zone = '+07:00';

/* ---------------------------------------------------------------- Tài khoản mẫu */
-- Mật khẩu mẫu "Rms@2026" (bcrypt). nam.hoang (phục vụ) có mật khẩu nhưng vẫn bị chặn đăng nhập theo vai trò.
INSERT INTO users (username, password_hash, must_change_password, full_name, email, phone, role_id, hourly_rate) VALUES
 ('tuan.nguyen', '$2a$10$JQ5j69tw/M7NIcGr6zTRTu1.4EdEALcihYDgiqQyg2dzz4bmMuRbq', 0, 'Nguyễn Anh Tuấn',   'tuan.nguyen@greenlotus.vn', '0901000002', (SELECT id FROM roles WHERE code='manager'),   0),
 ('linh.tran',   '$2a$10$JQ5j69tw/M7NIcGr6zTRTu1.4EdEALcihYDgiqQyg2dzz4bmMuRbq', 0, 'Trần Thùy Linh',    'linh.tran@greenlotus.vn',   '0901000003', (SELECT id FROM roles WHERE code='cashier'),   30000),
 ('hung.pham',   '$2a$10$JQ5j69tw/M7NIcGr6zTRTu1.4EdEALcihYDgiqQyg2dzz4bmMuRbq', 0, 'Phạm Quốc Hùng',    'hung.pham@greenlotus.vn',   '0901000004', (SELECT id FROM roles WHERE code='kitchen'),   35000),
 ('thao.bui',    '$2a$10$JQ5j69tw/M7NIcGr6zTRTu1.4EdEALcihYDgiqQyg2dzz4bmMuRbq', 0, 'Bùi Phương Thảo',   'thao.bui@greenlotus.vn',    '0901000005', (SELECT id FROM roles WHERE code='warehouse'), 32000),
 ('nam.hoang',   '$2a$10$JQ5j69tw/M7NIcGr6zTRTu1.4EdEALcihYDgiqQyg2dzz4bmMuRbq', 0, 'Hoàng Gia Nam',     'nam.hoang@greenlotus.vn',   '0901000006', (SELECT id FROM roles WHERE code='waiter'),    25000);

/* ---------------------------------------------------------------- Khu vực, bàn */
INSERT INTO areas (name, description, sort_order) VALUES
 ('Tầng 1',    'Sảnh chính, gần quầy thu ngân', 1),
 ('Sân vườn',  'Ngoài trời, có mái che di động', 2),
 ('Tầng 2',    'Không gian yên tĩnh, phù hợp gia đình', 3),
 ('Phòng VIP', 'Phòng riêng có máy lạnh, tối đa 12 khách', 4);

INSERT INTO dining_tables (code, area_id, seats, shape, pos_x, pos_y, qr_token)
SELECT t.code, a.id, t.seats, t.shape, t.x, t.y, REPLACE(UUID(), '-', '')
FROM (
  SELECT 'T01' code, 'Tầng 1' area, 2 seats, 'square' shape, 0 x, 0 y UNION ALL
  SELECT 'T02', 'Tầng 1', 2, 'square', 2, 0 UNION ALL
  SELECT 'T03', 'Tầng 1', 4, 'square', 4, 0 UNION ALL
  SELECT 'T04', 'Tầng 1', 4, 'square', 6, 0 UNION ALL
  SELECT 'T05', 'Tầng 1', 4, 'round',  0, 2 UNION ALL
  SELECT 'T06', 'Tầng 1', 6, 'rect',   2, 2 UNION ALL
  SELECT 'SV01','Sân vườn', 4, 'round', 0, 0 UNION ALL
  SELECT 'SV02','Sân vườn', 8, 'rect',  4, 3 UNION ALL
  SELECT 'L2-01','Tầng 2', 4, 'square', 0, 1 UNION ALL
  SELECT 'L2-02','Tầng 2', 10,'rect',   2, 3 UNION ALL
  SELECT 'VIP01','Phòng VIP', 8, 'round', 1, 1 UNION ALL
  SELECT 'VIP02','Phòng VIP', 12,'rect',  4, 2
) t JOIN areas a ON a.name = t.area;

/* ---------------------------------------------------------------- Thực đơn */
INSERT INTO dish_categories (name, sort_order) VALUES
 ('Khai vị',1), ('Món chính',2), ('Lẩu',3), ('Cơm & mì',4), ('Tráng miệng',5), ('Đồ uống',6);

INSERT INTO dishes (code, name, category_id, price, description, ingredients_text, spicy_level)
SELECT x.code, x.name, c.id, x.price, x.descr, x.ing, x.spicy
FROM (
  SELECT 'MA001' code, 'Gỏi cuốn tôm thịt' name, 'Khai vị' cat, 35000 price, 'Cuốn tươi mát, phù hợp mở đầu bữa ăn.' descr, 'Tôm, thịt ba chỉ, bún, rau sống, bánh tráng; chấm tương đậu phộng' ing, 0 spicy UNION ALL
  SELECT 'MA002', 'Đậu hũ non sốt nấm', 'Khai vị', 59000, 'Món chay mềm mịn, sốt nấm đậm đà.', 'Đậu hũ non, nấm đông cô, nấm rơm, hành lá', 0 UNION ALL
  SELECT 'MA003', 'Cá kho tộ', 'Món chính', 125000, 'Cá kho đậm vị miền Tây trong niêu đất.', 'Cá basa, nước màu, tiêu, ớt, hành', 2 UNION ALL
  SELECT 'MA004', 'Gà nướng mật ong', 'Món chính', 145000, 'Gà nướng thơm mùi sả, mật ong.', 'Đùi gà, mật ong, tỏi, sả, ớt', 1 UNION ALL
  SELECT 'MA005', 'Lẩu Thái hải sản', 'Lẩu', 395000, 'Phần cho 3–4 người.', 'Tôm, mực, nghêu, cá, nấm, sả, lá chanh, ớt, nước cốt dừa', 3 UNION ALL
  SELECT 'MA006', 'Lẩu nấm chay', 'Lẩu', 295000, 'Lẩu nấm thanh đạm.', 'Nấm đông cô, nấm kim châm, nấm đùi gà, đậu hũ, rau củ', 0 UNION ALL
  SELECT 'MA007', 'Cơm chiên cá mặn', 'Cơm & mì', 95000, NULL, 'Cơm, cá mặn, trứng, hành lá, đậu que', 0 UNION ALL
  SELECT 'MA008', 'Chè hạt sen long nhãn', 'Tráng miệng', 45000, NULL, 'Hạt sen, long nhãn, đường phèn', 0 UNION ALL
  SELECT 'MA009', 'Trà sen vàng', 'Đồ uống', 49000, NULL, 'Trà xanh, hạt sen, kem sữa', 0
) x JOIN dish_categories c ON c.name = x.cat;

INSERT INTO dish_allergens (dish_id, allergen_id)
SELECT d.id, a.id FROM dishes d JOIN allergens a ON
     (d.code = 'MA001' AND a.name IN ('Hải sản có vỏ','Đậu phộng'))
  OR (d.code = 'MA002' AND a.name IN ('Đậu nành'))
  OR (d.code = 'MA003' AND a.name IN ('Cá'))
  OR (d.code = 'MA005' AND a.name IN ('Hải sản có vỏ','Cá','Sữa'))
  OR (d.code = 'MA006' AND a.name IN ('Đậu nành'))
  OR (d.code = 'MA007' AND a.name IN ('Cá','Trứng'))
  OR (d.code = 'MA009' AND a.name IN ('Sữa'));

INSERT INTO dish_ai_tags (dish_id, tag_id)
SELECT d.id, t.id FROM dishes d JOIN ai_tags t ON
     (d.code = 'MA001' AND t.name IN ('Bán chạy','Món nhẹ'))
  OR (d.code = 'MA002' AND t.name IN ('Chay','Ít cay'))
  OR (d.code = 'MA004' AND t.name IN ('Bán chạy','Trẻ em thích'))
  OR (d.code = 'MA005' AND t.name IN ('Cay','Nhóm 4 người'))
  OR (d.code = 'MA006' AND t.name IN ('Chay','Ít cay','Nhóm 4 người'));

/* ---------------------------------------------------------------- Kho */
INSERT INTO ingredients (code, name, unit, min_level, avg_cost) VALUES
 ('NL001', 'Tôm sú tươi',    'kg',  6,   280000),
 ('NL002', 'Thịt ba chỉ',    'kg',  5,   140000),
 ('NL003', 'Cá basa phi lê', 'kg',  5,   90000),
 ('NL004', 'Đùi gà',         'kg',  8,   75000),
 ('NL005', 'Đậu hũ non',     'hộp', 20,  8000),
 ('NL006', 'Nấm đông cô',    'kg',  2,   220000);

INSERT INTO dish_ingredients (dish_id, ingredient_id, quantity)
SELECT d.id, i.id, x.qty FROM (
  SELECT 'MA001' dish, 'NL001' ing, 0.080 qty UNION ALL
  SELECT 'MA001', 'NL002', 0.060 UNION ALL
  SELECT 'MA002', 'NL005', 1.000 UNION ALL
  SELECT 'MA002', 'NL006', 0.030 UNION ALL
  SELECT 'MA003', 'NL003', 0.350 UNION ALL
  SELECT 'MA004', 'NL004', 0.400
) x JOIN dishes d ON d.code = x.dish JOIN ingredients i ON i.code = x.ing;

INSERT INTO suppliers (code, name, phone, address) VALUES
 ('NCC01', 'Hải sản Phú Quốc',              '0912000111', 'Chợ Bình Điền, Quận 8, TP.HCM'),
 ('NCC02', 'Công ty Thực phẩm Đại Phát',    '0912000222', 'KCN Tân Bình, TP.HCM');

-- Tồn đầu kỳ: nhập qua sổ kho để trigger tự cập nhật stock_qty.
-- LƯU Ý (MySQL lỗi 1442): câu INSERT vào stock_transactions KHÔNG được đọc bảng ingredients,
-- vì trigger đang ghi vào ingredients. Vì vậy chép id ra bảng tạm trước (backend cũng nên
-- lấy ingredient_id ở một câu SELECT riêng rồi mới INSERT).
CREATE TEMPORARY TABLE tmp_opening_stock AS
SELECT i.id AS ingredient_id, i.avg_cost, x.qty
FROM (
  SELECT 'NL001' code, 12 qty UNION ALL SELECT 'NL002', 10 UNION ALL SELECT 'NL003', 4 UNION ALL
  SELECT 'NL004', 15 UNION ALL SELECT 'NL005', 40 UNION ALL SELECT 'NL006', 3
) x JOIN ingredients i ON i.code = x.code;

INSERT INTO stock_transactions (ingredient_id, txn_type, quantity_change, unit_cost, reason, created_by)
SELECT t.ingredient_id, 'import', t.qty, t.avg_cost, 'Tồn đầu kỳ', (SELECT id FROM users WHERE username = 'thao.bui')
FROM tmp_opening_stock t;

DROP TEMPORARY TABLE tmp_opening_stock;

/* ---------------------------------------------------------------- Ca làm việc */
INSERT INTO shifts (name, start_time, end_time, color, note) VALUES
 ('Ca sáng',  '06:00', '14:00', '#0f7b5a', 'Chuẩn bị nguyên liệu, phục vụ bữa trưa'),
 ('Ca chiều', '14:00', '22:00', '#2563eb', 'Phục vụ bữa tối'),
 ('Ca gãy',   '10:00', '14:00', '#d97706', 'Tăng cường giờ cao điểm trưa'),
 ('Ca tối',   '17:00', '23:00', '#7c3aed', 'Cao điểm tối & dọn dẹp cuối ngày');

/* ---------------------------------------------------------------- FAQ chatbot */
INSERT INTO faq_categories (name) VALUES
 ('Giờ mở cửa & địa chỉ'), ('Đặt bàn'), ('Thanh toán'), ('Món ăn & dị ứng'), ('Dịch vụ khác');

INSERT INTO faqs (category_id, question, answer)
SELECT c.id, x.q, x.a FROM (
  SELECT 'Đặt bàn' cat, 'Có thể đặt bàn trước bao lâu?' q, 'Quý khách có thể đặt bàn trước tối đa 30 ngày và tối thiểu 60 phút.' a UNION ALL
  SELECT 'Thanh toán', 'Nhà hàng nhận thanh toán bằng hình thức nào?', 'Tiền mặt, thẻ ngân hàng, chuyển khoản QR và ví điện tử.' UNION ALL
  SELECT 'Dịch vụ khác', 'Nhà hàng có chỗ đậu xe ô tô không?', 'Có bãi giữ xe ô tô miễn phí ở tầng hầm tòa nhà.'
) x JOIN faq_categories c ON c.name = x.cat;

/* ---------------------------------------------------------------- Đặt bàn */
-- d = số ngày lệch so với hôm nay; tbl = mã bàn (NULL = chưa xếp bàn, khi đó dùng khu vực `area`).
INSERT INTO reservations (code, customer_name, phone, guests, reserved_at, area_id, table_id, note, status, source, created_at)
SELECT r.code, r.name, r.phone, r.guests,
       TIMESTAMP(CURRENT_DATE + INTERVAL r.d DAY, r.t),
       COALESCE(t.area_id, a.id), t.id, NULLIF(r.note, ''), r.status, r.source,
       TIMESTAMP(CURRENT_DATE + INTERVAL r.d DAY, r.t) - INTERVAL r.lead_days DAY
FROM (
  SELECT 'DB-1090' code, -6 d, '18:30' t, 'T06' tbl, 'Tầng 1' area, 6 guests, 'Nguyễn Thu Hà' name, '0903456781' phone, '' note, 'completed' status, 'website' source, 2 lead_days UNION ALL
  SELECT 'DB-1091', -5, '19:00', 'VIP01', 'Phòng VIP', 8, 'Trần Minh Quân', '0912345678', 'Sinh nhật, cần chuẩn bị bánh kem', 'completed', 'phone', 3 UNION ALL
  SELECT 'DB-1092', -4, '12:00', 'T03', 'Tầng 1', 3, 'Lê Hoàng Nam', '0987654321', 'Có trẻ nhỏ, xin ghế em bé', 'cancelled', 'website', 4 UNION ALL
  SELECT 'DB-1093', -3, '19:30', 'SV01', 'Sân vườn', 4, 'Phạm Diễm My', '0938123456', '', 'completed', 'walk_in', 5 UNION ALL
  SELECT 'DB-1094', -3, '20:00', 'SV02', 'Sân vườn', 7, 'Võ Thành Công', '0977001122', 'Khách dị ứng đậu phộng', 'no_show', 'website', 2 UNION ALL
  SELECT 'DB-1095', -2, '11:30', 'T01', 'Tầng 1', 2, 'Đặng Bảo Ngọc', '0356789012', 'Muốn ngồi gần cửa sổ', 'completed', 'phone', 3 UNION ALL
  SELECT 'DB-1096', -2, '18:00', 'VIP02', 'Phòng VIP', 10, 'Huỳnh Gia Hân', '0868111222', 'Tiệc công ty, xuất hóa đơn VAT', 'completed', 'website', 4 UNION ALL
  SELECT 'DB-1097', -1, '19:00', 'T06', 'Tầng 1', 5, 'Bùi Đức Anh', '0702334455', '', 'completed', 'walk_in', 5 UNION ALL
  SELECT 'DB-1098', -1, '12:30', 'L2-01', 'Tầng 2', 4, 'Ngô Quỳnh Như', '0829456123', '', 'cancelled', 'website', 2 UNION ALL
  SELECT 'DB-1099', 0, '11:00', 'T04', 'Tầng 1', 4, 'Hoàng Văn Lợi', '0945667788', '', 'seated', 'phone', 3 UNION ALL
  SELECT 'DB-1100', 0, '12:00', 'SV01', 'Sân vườn', 4, 'Phan Mỹ Duyên', '0389001234', 'Sinh nhật, cần chuẩn bị bánh kem', 'confirmed', 'phone', 4 UNION ALL
  SELECT 'DB-1101', 0, '18:30', 'T06', 'Tầng 1', 6, 'Trương Khải', '0919223344', '', 'pending', 'walk_in', 1 UNION ALL
  SELECT 'DB-1102', 0, '19:30', 'SV02', 'Sân vườn', 6, 'Nguyễn Thu Hà', '0903456781', 'Có trẻ nhỏ, xin ghế em bé', 'pending', 'website', 1 UNION ALL
  SELECT 'DB-1103', 0, '20:00', 'T02', 'Tầng 1', 2, 'Trần Minh Quân', '0912345678', '', 'confirmed', 'phone', 2 UNION ALL
  SELECT 'DB-1104', 0, '19:00', 'VIP01', 'Phòng VIP', 8, 'Lê Hoàng Nam', '0987654321', '', 'pending', 'website', 1 UNION ALL
  SELECT 'DB-1105', 1, '18:00', 'T03', 'Tầng 1', 4, 'Phạm Diễm My', '0938123456', '', 'confirmed', 'website', 3 UNION ALL
  SELECT 'DB-1106', 1, '19:00', 'L2-02', 'Tầng 2', 5, 'Võ Thành Công', '0977001122', 'Khách dị ứng đậu phộng', 'confirmed', 'phone', 2 UNION ALL
  SELECT 'DB-1107', 1, '12:00', 'L2-01', 'Tầng 2', 3, 'Đặng Bảo Ngọc', '0356789012', '', 'pending', 'website', 1 UNION ALL
  SELECT 'DB-1108', 2, '18:30', 'VIP02', 'Phòng VIP', 12, 'Huỳnh Gia Hân', '0868111222', 'Tiệc công ty, xuất hóa đơn VAT', 'confirmed', 'website', 5 UNION ALL
  SELECT 'DB-1109', 2, '19:30', 'SV01', 'Sân vườn', 3, 'Bùi Đức Anh', '0702334455', '', 'pending', 'walk_in', 1 UNION ALL
  SELECT 'DB-1110', 3, '11:30', 'T05', 'Tầng 1', 4, 'Ngô Quỳnh Như', '0829456123', '', 'confirmed', 'website', 2 UNION ALL
  SELECT 'DB-1111', 3, '20:00', 'SV02', 'Sân vườn', 6, 'Hoàng Văn Lợi', '0945667788', 'Muốn ngồi gần cửa sổ', 'cancelled', 'phone', 3 UNION ALL
  SELECT 'DB-1112', 4, '18:00', 'L2-02', 'Tầng 2', 9, 'Phan Mỹ Duyên', '0389001234', '', 'confirmed', 'website', 4 UNION ALL
  SELECT 'DB-1113', 5, '19:00', 'T06', 'Tầng 1', 6, 'Trương Khải', '0919223344', '', 'pending', 'website', 2 UNION ALL
  SELECT 'DB-1114', 6, '12:00', 'T01', 'Tầng 1', 2, 'Nguyễn Thu Hà', '0903456781', '', 'confirmed', 'phone', 3 UNION ALL
  SELECT 'DB-1115', 7, '18:30', NULL, 'Sân vườn', 2, 'Trần Minh Quân', '0912345678', 'Khách chưa chọn bàn cụ thể', 'pending', 'website', 1
) r
LEFT JOIN dining_tables t ON t.code = r.tbl
JOIN areas a ON a.name = r.area
ORDER BY r.code;

/* ---------------------------------------------------------------- Nhân viên */
-- Thêm nhân viên để trang Tài khoản có đủ dữ liệu tìm kiếm / lọc / phân trang.
-- Mật khẩu chung "Rms@2026". Vài tài khoản để must_change_password = 1 (chưa đổi mật khẩu được cấp)
-- và vài tài khoản bị khóa, để thấy đủ các trạng thái. INSERT IGNORE: chạy lại không bị trùng.
INSERT IGNORE INTO users (username, password_hash, must_change_password, full_name, email, phone, role_id, status,
                          hourly_rate, created_at, last_login_at)
SELECT s.username, '$2a$10$JQ5j69tw/M7NIcGr6zTRTu1.4EdEALcihYDgiqQyg2dzz4bmMuRbq', s.must_change, s.full_name,
       CONCAT(s.username, '@greenlotus.vn'), s.phone, r.id, s.status, s.rate,
       NOW() - INTERVAL s.created_days DAY,
       IF(s.login_days IS NULL, NULL, NOW() - INTERVAL s.login_days DAY - INTERVAL 3 HOUR)
FROM (
  SELECT 'khoa.le' username, 'Lê Đăng Khoa' full_name, 'cashier' role, '0905123401' phone, 'active' status, 0 must_change, 30000 rate, 210 created_days, 1 login_days UNION ALL
  SELECT 'mai.vo',      'Võ Ngọc Mai',      'kitchen',   '0905123402', 'active', 0, 35000, 260, 0 UNION ALL
  SELECT 'son.dang',    'Đặng Thanh Sơn',   'kitchen',   '0905123403', 'active', 0, 35000, 120, 2 UNION ALL
  SELECT 'duc.huynh',   'Huỳnh Minh Đức',   'kitchen',   '0905123404', 'active', 1, 33000,  45, NULL UNION ALL
  SELECT 'trang.phan',  'Phan Thu Trang',   'cashier',   '0905123405', 'locked', 0, 30000, 400, 90 UNION ALL
  SELECT 'vy.ngo',      'Ngô Tường Vy',     'waiter',    '0905123406', 'active', 0, 25000, 150, NULL UNION ALL
  SELECT 'phuc.do',     'Đỗ Hồng Phúc',     'waiter',    '0905123407', 'active', 0, 25000,  95, NULL UNION ALL
  SELECT 'an.truong',   'Trương Bảo An',    'waiter',    '0905123408', 'locked', 0, 25000, 240, NULL UNION ALL
  SELECT 'quynh.ly',    'Lý Như Quỳnh',     'waiter',    '0905123409', 'active', 0, 25000,  60, NULL UNION ALL
  SELECT 'binh.vu',     'Vũ Thanh Bình',    'waiter',    '0905123410', 'active', 0, 25000,  12, NULL UNION ALL
  SELECT 'hoa.dinh',    'Đinh Thị Hoa',     'warehouse', '0905123411', 'active', 1, 32000,   3, NULL
) s
JOIN roles r ON r.code = s.role;
