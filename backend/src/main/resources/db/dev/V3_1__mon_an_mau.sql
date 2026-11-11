/* =====================================================================
   DỮ LIỆU MẪU — Quản lý món ăn (chỉ profile dev, KHÔNG dùng cho môi trường thật)

   - Thêm 16 món (tổng 25 món → trang danh sách có 3 trang), có món "Ngừng bán".
   - Danh mục "Món theo mùa" đang tắt (thử quy tắc: không chọn được danh mục đã tắt).
   - 3 combo gợi ý cho Chatbot AI.
   - Vài đơn hàng đã hoàn tất trong 7 ngày qua: mô phỏng dữ liệu Khách hàng / Thu ngân sẽ tạo,
     để thấy quy tắc "món đã có trong đơn hàng thì không xóa được, chỉ chuyển Ngừng bán".
     Món MA016 Mực hấp gừng, MA021 Kem dừa, MA024 Bia chưa từng được gọi → xóa được.
   ===================================================================== */

SET NAMES utf8mb4;
SET time_zone = '+07:00';

/* ---------------------------------------------------------------- Danh mục */
INSERT INTO dish_categories (name, is_active, sort_order) VALUES ('Món theo mùa', 0, 7);

/* ---------------------------------------------------------------- Món ăn */
-- h = số giờ trước đây món được cập nhật lần cuối (để danh sách có thứ tự "mới cập nhật" tự nhiên).
INSERT INTO dishes (code, name, category_id, price, description, ingredients_text, spicy_level, status, ai_enabled,
                    created_at, updated_at, status_updated_at)
SELECT x.code, x.name, c.id, x.price, NULLIF(x.descr, ''), NULLIF(x.ing, ''), x.spicy, x.status, x.status = 'selling',
       NOW() - INTERVAL x.days DAY, NOW() - INTERVAL x.h HOUR, NOW() - INTERVAL x.h HOUR
FROM (
  SELECT 'MA010' code, 'Chả giò hải sản' name, 'Khai vị' cat, 65000 price, 'Giòn rụm, chấm nước mắm chua ngọt.' descr, 'Tôm, mực, cà rốt, khoai môn, bánh tráng chiên' ing, 0 spicy, 'selling' status, 190 days, 42 h UNION ALL
  SELECT 'MA011', 'Gỏi ngó sen tôm thịt', 'Khai vị', 85000, '', 'Ngó sen, tôm, thịt heo, cà rốt, rau răm, đậu phộng rang', 1, 'selling', 185, 79 UNION ALL
  SELECT 'MA012', 'Súp cua gà xé', 'Khai vị', 55000, '', 'Thịt cua, gà xé, trứng, nấm tuyết', 0, 'selling', 180, 116 UNION ALL
  SELECT 'MA013', 'Bò lúc lắc khoai tây', 'Món chính', 165000, 'Bò mềm, sốt tiêu đen, ăn kèm khoai tây chiên.', 'Thăn bò Úc, khoai tây chiên, ớt chuông, hành tây, bơ', 0, 'stopped', 175, 20 UNION ALL
  SELECT 'MA014', 'Sườn non rim mặn ngọt', 'Món chính', 135000, 'Đưa cơm, thơm mùi tỏi phi.', 'Sườn non heo, nước mắm, đường thốt nốt, tỏi phi', 0, 'selling', 170, 153 UNION ALL
  SELECT 'MA015', 'Tôm sú rang muối ớt', 'Món chính', 225000, '', 'Tôm sú, muối hột, ớt hiểm, tỏi, lá chanh', 3, 'selling', 165, 190 UNION ALL
  SELECT 'MA016', 'Mực hấp gừng', 'Món chính', 175000, '', 'Mực ống, gừng, hành boa rô, nước mắm', 0, 'selling', 12, 6 UNION ALL
  SELECT 'MA017', 'Lẩu bò nhúng giấm', 'Lẩu', 365000, '', 'Bắp bò, giấm, sả, hành tây, bánh tráng, rau sống', 1, 'selling', 150, 227 UNION ALL
  SELECT 'MA018', 'Mì xào hải sản', 'Cơm & mì', 115000, '', 'Mì trứng, tôm, mực, cải ngọt, cà rốt', 1, 'selling', 145, 264 UNION ALL
  SELECT 'MA019', 'Cơm sen lá sen', 'Cơm & mì', 105000, '', 'Gạo, hạt sen, lạp xưởng, nấm, đậu Hà Lan', 0, 'selling', 140, 301 UNION ALL
  SELECT 'MA020', 'Bánh flan caramen', 'Tráng miệng', 35000, '', 'Trứng, sữa tươi, caramen', 0, 'selling', 130, 338 UNION ALL
  SELECT 'MA021', 'Kem dừa', 'Tráng miệng', 55000, 'Kem dừa trong trái dừa tươi.', '', 0, 'selling', 9, 9 UNION ALL
  SELECT 'MA022', 'Nước ép dưa hấu', 'Đồ uống', 39000, '', 'Dưa hấu tươi', 0, 'selling', 120, 375 UNION ALL
  SELECT 'MA023', 'Cà phê sữa đá', 'Đồ uống', 32000, '', 'Cà phê phin, sữa đặc', 0, 'selling', 115, 412 UNION ALL
  SELECT 'MA024', 'Bia Sài Gòn Special', 'Đồ uống', 30000, '', 'Bia lon 330ml', 0, 'selling', 7, 3 UNION ALL
  SELECT 'MA025', 'Cua rang me', 'Món theo mùa', 450000, 'Chỉ phục vụ mùa cua tháng 8 – 10.', 'Cua thịt, me chua, tỏi, ớt', 2, 'stopped', 300, 900
) x JOIN dish_categories c ON c.name = x.cat;

INSERT INTO dish_allergens (dish_id, allergen_id)
SELECT d.id, a.id FROM dishes d JOIN allergens a ON
     (d.code = 'MA010' AND a.name IN ('Hải sản có vỏ','Gluten (lúa mì)'))
  OR (d.code = 'MA011' AND a.name IN ('Hải sản có vỏ','Đậu phộng'))
  OR (d.code = 'MA012' AND a.name IN ('Hải sản có vỏ','Trứng'))
  OR (d.code = 'MA013' AND a.name IN ('Sữa'))
  OR (d.code = 'MA015' AND a.name IN ('Hải sản có vỏ'))
  OR (d.code = 'MA016' AND a.name IN ('Hải sản có vỏ'))
  OR (d.code = 'MA018' AND a.name IN ('Hải sản có vỏ','Trứng','Gluten (lúa mì)'))
  OR (d.code = 'MA020' AND a.name IN ('Trứng','Sữa'))
  OR (d.code = 'MA023' AND a.name IN ('Sữa'))
  OR (d.code = 'MA024' AND a.name IN ('Gluten (lúa mì)'))
  OR (d.code = 'MA025' AND a.name IN ('Hải sản có vỏ'));

INSERT INTO dish_ai_tags (dish_id, tag_id)
SELECT d.id, t.id FROM dishes d JOIN ai_tags t ON
     (d.code = 'MA003' AND t.name IN ('Món Việt truyền thống'))
  OR (d.code = 'MA007' AND t.name IN ('Trẻ em thích'))
  OR (d.code = 'MA008' AND t.name IN ('Chay','Món nhẹ'))
  OR (d.code = 'MA009' AND t.name IN ('Bán chạy'))
  OR (d.code = 'MA010' AND t.name IN ('Trẻ em thích'))
  OR (d.code = 'MA011' AND t.name IN ('Ít dầu mỡ'))
  OR (d.code = 'MA012' AND t.name IN ('Món nhẹ'))
  OR (d.code = 'MA013' AND t.name IN ('Bán chạy'))
  OR (d.code = 'MA014' AND t.name IN ('Món Việt truyền thống'))
  OR (d.code = 'MA015' AND t.name IN ('Cay'))
  OR (d.code = 'MA016' AND t.name IN ('Ít dầu mỡ'))
  OR (d.code = 'MA017' AND t.name IN ('Nhóm 4 người'))
  OR (d.code = 'MA019' AND t.name IN ('Món Việt truyền thống'))
  OR (d.code = 'MA020' AND t.name IN ('Trẻ em thích'))
  OR (d.code = 'MA022' AND t.name IN ('Chay'))
  OR (d.code = 'MA025' AND t.name IN ('Theo mùa'));

/* ---------------------------------------------------------------- Combo gợi ý (Chatbot AI) */
INSERT INTO combos (name, note, is_active) VALUES
 ('Combo gia đình 4 người', 'Gợi ý khi khách đi nhóm 3–5 người, có trẻ nhỏ', 1),
 ('Bữa trưa văn phòng',     'Gợi ý cho khách đi 1–2 người vào giờ trưa', 1),
 ('Tiệc chay thanh đạm',    'Gợi ý khi khách hỏi món chay', 1);

INSERT INTO combo_items (combo_id, dish_id)
SELECT cb.id, d.id FROM combos cb JOIN dishes d ON
     (cb.name = 'Combo gia đình 4 người' AND d.code IN ('MA001','MA003','MA014','MA008','MA020'))
  OR (cb.name = 'Bữa trưa văn phòng'     AND d.code IN ('MA007','MA009'))
  OR (cb.name = 'Tiệc chay thanh đạm'    AND d.code IN ('MA002','MA006','MA008','MA022'));

/* ---------------------------------------------------------------- Đơn hàng đã hoàn tất (mô phỏng) */
-- d = số ngày trước, t = giờ vào bàn. Đơn do khách gọi qua QR (created_by NULL).
INSERT INTO orders (code, table_id, status, source, created_at, closed_at)
SELECT o.code, t.id, 'completed', 'qr',
       TIMESTAMP(CURRENT_DATE - INTERVAL o.d DAY, o.t),
       TIMESTAMP(CURRENT_DATE - INTERVAL o.d DAY, o.t) + INTERVAL 75 MINUTE
FROM (
  SELECT 'DH-0001' code, 7 d, '11:40' t, 'T03' tbl UNION ALL
  SELECT 'DH-0002', 6, '18:20', 'VIP01' UNION ALL
  SELECT 'DH-0003', 5, '12:10', 'T01' UNION ALL
  SELECT 'DH-0004', 5, '19:05', 'SV02' UNION ALL
  SELECT 'DH-0005', 4, '18:45', 'T06' UNION ALL
  SELECT 'DH-0006', 3, '11:55', 'L2-01' UNION ALL
  SELECT 'DH-0007', 2, '19:30', 'VIP02' UNION ALL
  SELECT 'DH-0008', 1, '12:25', 'T02'
) o JOIN dining_tables t ON t.code = o.tbl;

-- Giá trong đơn là bản chụp lúc bán: đổi giá món sau này không làm đổi các đơn này.
INSERT INTO order_items (order_id, dish_id, dish_name, unit_price, quantity, status, added_via, created_at, completed_at, served_at)
SELECT o.id, d.id, d.name, d.price, i.qty, 'served', 'customer', o.created_at,
       o.created_at + INTERVAL 20 MINUTE, o.created_at + INTERVAL 25 MINUTE
FROM (
  SELECT 'DH-0001' oc, 'MA001' dc, 2 qty UNION ALL SELECT 'DH-0001', 'MA007', 1 UNION ALL SELECT 'DH-0001', 'MA009', 2 UNION ALL
  SELECT 'DH-0002', 'MA005', 1 UNION ALL SELECT 'DH-0002', 'MA010', 2 UNION ALL SELECT 'DH-0002', 'MA013', 1 UNION ALL
  SELECT 'DH-0002', 'MA025', 1 UNION ALL SELECT 'DH-0002', 'MA023', 4 UNION ALL
  SELECT 'DH-0003', 'MA002', 1 UNION ALL SELECT 'DH-0003', 'MA019', 1 UNION ALL SELECT 'DH-0003', 'MA022', 2 UNION ALL
  SELECT 'DH-0004', 'MA006', 1 UNION ALL SELECT 'DH-0004', 'MA011', 1 UNION ALL SELECT 'DH-0004', 'MA008', 3 UNION ALL
  SELECT 'DH-0005', 'MA003', 1 UNION ALL SELECT 'DH-0005', 'MA014', 1 UNION ALL SELECT 'DH-0005', 'MA004', 1 UNION ALL
  SELECT 'DH-0005', 'MA020', 2 UNION ALL
  SELECT 'DH-0006', 'MA012', 2 UNION ALL SELECT 'DH-0006', 'MA018', 1 UNION ALL SELECT 'DH-0006', 'MA009', 1 UNION ALL
  SELECT 'DH-0007', 'MA017', 1 UNION ALL SELECT 'DH-0007', 'MA015', 1 UNION ALL SELECT 'DH-0007', 'MA001', 3 UNION ALL
  SELECT 'DH-0007', 'MA023', 2 UNION ALL
  SELECT 'DH-0008', 'MA004', 1 UNION ALL SELECT 'DH-0008', 'MA001', 1 UNION ALL SELECT 'DH-0008', 'MA022', 1
) i
JOIN orders o ON o.code = i.oc
JOIN dishes d ON d.code = i.dc;
