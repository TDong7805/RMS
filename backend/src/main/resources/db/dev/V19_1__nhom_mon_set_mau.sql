/* =====================================================================
   DỮ LIỆU MẪU — Nhóm món và Set menu (chỉ profile dev, KHÔNG dùng cho môi trường thật). Cần migration V19.

   - 3 nhóm món: Vang đỏ Úc (ly / chai), Bia (thủ công / tươi), Nước ngọt có ga (6 loại) — mỗi loại vẫn là món
     riêng, trang gọi món hiện 1 thẻ cho cả nhóm.
   - 4 set menu bán trên thực đơn (thay 3 combo gợi ý cũ của Chatbot; Chatbot dùng chính các set này để gợi ý).
   - Ảnh nhóm / set: backend/database/seed-images/nhom, set (SeedImageLoader tự gắn).
   ===================================================================== */

SET NAMES utf8mb4;
SET time_zone = '+07:00';

/* ---------------------------------------------------------------- Nhóm món (V19) */
-- Mỗi loại vẫn là một món riêng; nhóm chỉ để trang gọi món gộp thành một thẻ, bấm vào chọn loại.
INSERT INTO dish_groups (name, category_id, description, sort_order)
SELECT x.name, c.id, x.descr, x.ord FROM (
  SELECT 'Vang đỏ Úc' name, 'Shiraz vùng Barossa — gọi theo ly hoặc cả chai.' descr, 1 ord UNION ALL
  SELECT 'Bia', 'Bia thủ công Úc đóng chai hoặc bia tươi.', 2 UNION ALL
  SELECT 'Nước ngọt có ga', 'Lon 330ml, chọn loại khi gọi.', 3
) x JOIN dish_categories c ON c.name = 'Đồ uống';

UPDATE dishes d JOIN (
  SELECT 'MA034' code, 'Vang đỏ Úc' grp, 'Ly 150ml' label UNION ALL
  SELECT 'MA040', 'Vang đỏ Úc', 'Chai 750ml' UNION ALL
  SELECT 'MA035', 'Bia', 'Thủ công Úc (chai 330ml)' UNION ALL
  SELECT 'MA036', 'Bia', 'Bia tươi (ly 500ml)' UNION ALL
  SELECT 'MA042', 'Nước ngọt có ga', 'Coca-Cola' UNION ALL
  SELECT 'MA043', 'Nước ngọt có ga', 'Coca-Cola Zero' UNION ALL
  SELECT 'MA044', 'Nước ngọt có ga', 'Sprite' UNION ALL
  SELECT 'MA045', 'Nước ngọt có ga', 'Fanta Cam' UNION ALL
  SELECT 'MA046', 'Nước ngọt có ga', 'Fanta Nho' UNION ALL
  SELECT 'MA047', 'Nước ngọt có ga', 'Sá xị Chương Dương'
) x ON x.code = d.code
JOIN dish_groups g ON g.name = x.grp
SET d.group_id = g.id, d.variant_label = x.label;

/* ---------------------------------------------------------------- Set menu (bảng combos, V19) */
-- Bán trên thực đơn với giá trọn gói (giảm ~10%, set trưa ~17%); Chatbot cũng dùng để gợi ý.
-- Giá gốc: Steak 1.547.000 · Tomahawk 2.654.000 · Lẩu 1.242.000 · Trưa 239.000.
INSERT INTO combos (name, description, price, note, is_active, on_menu, sell_from, sell_to, sort_order) VALUES
 ('Set Steak cho 2 người', 'Khai vị tataki, Striploin và Ribeye, khoai nghiền, salad, 2 ly vang đỏ, 2 kem vani.', 1390000,
  'Gợi ý cho cặp đôi / hẹn hò', 1, 1, NULL, NULL, 1),
 ('Set Tomahawk chia sẻ', 'Tomahawk 1,1kg cho 2–3 người, 2 khoai nghiền, salad, bánh mì bơ tỏi, 1 chai vang đỏ.', 2390000,
  'Gợi ý cho nhóm 2–3 người muốn ăn bít tết, dịp đặc biệt', 1, 1, NULL, NULL, 2),
 ('Set Lẩu nhóm 4 người', 'Bò cuốn lá lốt, gỏi bò, lẩu bò Úc sa tế, 2 đĩa bò nhúng thêm, rau nấm, 4 nước ngọt, 4 bánh flan.', 1090000,
  'Gợi ý khi khách đi nhóm 3–5 người', 1, 1, NULL, NULL, 3),
 ('Set Bữa trưa văn phòng', 'Súp bò hầm, cơm bò lúc lắc, trà đào cam sả. Bán 10:30–14:00.', 199000,
  'Gợi ý cho khách đi 1–2 người vào giờ trưa', 1, 1, '10:30:00', '14:00:00', 4);

INSERT INTO combo_items (combo_id, dish_id, quantity, allow_variant, sort_order)
SELECT cb.id, d.id, x.qty, x.variant, x.ord
FROM (
  SELECT 'Set Steak cho 2 người' cb, 'MA003' dc, 1 qty, 0 variant, 1 ord UNION ALL
  SELECT 'Set Steak cho 2 người', 'MA006', 1, 0, 2 UNION ALL
  SELECT 'Set Steak cho 2 người', 'MA008', 1, 0, 3 UNION ALL
  SELECT 'Set Steak cho 2 người', 'MA048', 1, 0, 4 UNION ALL
  SELECT 'Set Steak cho 2 người', 'MA049', 1, 0, 5 UNION ALL
  SELECT 'Set Steak cho 2 người', 'MA034', 2, 0, 6 UNION ALL
  SELECT 'Set Steak cho 2 người', 'MA032', 2, 0, 7 UNION ALL
  SELECT 'Set Tomahawk chia sẻ', 'MA011', 1, 0, 1 UNION ALL
  SELECT 'Set Tomahawk chia sẻ', 'MA048', 2, 0, 2 UNION ALL
  SELECT 'Set Tomahawk chia sẻ', 'MA049', 1, 0, 3 UNION ALL
  SELECT 'Set Tomahawk chia sẻ', 'MA050', 1, 0, 4 UNION ALL
  SELECT 'Set Tomahawk chia sẻ', 'MA040', 1, 0, 5 UNION ALL
  SELECT 'Set Lẩu nhóm 4 người', 'MA001', 1, 0, 1 UNION ALL
  SELECT 'Set Lẩu nhóm 4 người', 'MA002', 1, 0, 2 UNION ALL
  SELECT 'Set Lẩu nhóm 4 người', 'MA019', 1, 0, 3 UNION ALL
  SELECT 'Set Lẩu nhóm 4 người', 'MA054', 2, 0, 4 UNION ALL
  SELECT 'Set Lẩu nhóm 4 người', 'MA055', 1, 0, 5 UNION ALL
  SELECT 'Set Lẩu nhóm 4 người', 'MA042', 4, 1, 6 UNION ALL
  SELECT 'Set Lẩu nhóm 4 người', 'MA031', 4, 0, 7 UNION ALL
  SELECT 'Set Bữa trưa văn phòng', 'MA005', 1, 0, 1 UNION ALL
  SELECT 'Set Bữa trưa văn phòng', 'MA026', 1, 0, 2 UNION ALL
  SELECT 'Set Bữa trưa văn phòng', 'MA037', 1, 0, 3
) x
JOIN combos cb ON cb.name = x.cb
JOIN dishes d ON d.code = x.dc;
