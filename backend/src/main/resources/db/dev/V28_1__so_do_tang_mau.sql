/* [FAKE-DATA] Sơ đồ mẫu theo tầng (chỉ môi trường dev). Ghi trong docs/du-lieu/DU_LIEU_GIA.md.
 *
 * Trước đây khu vực mẫu được đặt tên như tầng ("Tầng 1", "Tầng 2"). Nay có tầng thật nên đổi tên khu:
 *   Tầng 1 (sơ đồ 12 × 7): Sảnh chính (T01–T06) · Sân vườn (SV01, SV02, có hàng rào) · góc quầy thu ngân
 *   Tầng 2 (sơ đồ 10 × 6): Khu gia đình (L2-01, L2-02) · Phòng VIP (VIP01, VIP02, vách ngăn có cửa)
 * Mỗi ô đã chừa chỗ cho ghế nên bàn đặt ở hai ô cạnh nhau vẫn thoáng.
 * Chỉ sửa đúng các khu / bàn mẫu theo tên, mã; dữ liệu người dùng tự thêm giữ nguyên.
 */

SET @has_sanh = (SELECT COUNT(*) FROM areas WHERE name = 'Sảnh chính');
UPDATE areas SET name = 'Sảnh chính' WHERE name = 'Tầng 1' AND @has_sanh = 0;
SET @has_gd = (SELECT COUNT(*) FROM areas WHERE name = 'Khu gia đình');
UPDATE areas SET name = 'Khu gia đình' WHERE name = 'Tầng 2' AND @has_gd = 0;

SET @f1 = (SELECT id FROM floors WHERE name = 'Tầng 1');
UPDATE floors SET cols = 12, rows_count = 7 WHERE id = @f1;
INSERT INTO floors (name, sort_order, cols, rows_count)
SELECT 'Tầng 2', 2, 10, 6 FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM floors WHERE name = 'Tầng 2');
SET @f2 = (SELECT id FROM floors WHERE name = 'Tầng 2');
UPDATE floors SET cols = 10, rows_count = 6 WHERE id = @f2;

UPDATE areas SET floor_id = @f1, zone_x = 1, zone_y = 1, zone_w = 6, zone_h = 3, sort_order = 1 WHERE name = 'Sảnh chính';
UPDATE areas SET floor_id = @f1, zone_x = 9, zone_y = 1, zone_w = 2, zone_h = 5, sort_order = 2 WHERE name = 'Sân vườn';
UPDATE areas SET floor_id = @f2, zone_x = 1, zone_y = 1, zone_w = 4, zone_h = 4, sort_order = 3 WHERE name = 'Khu gia đình';
UPDATE areas SET floor_id = @f2, zone_x = 7, zone_y = 1, zone_w = 2, zone_h = 4, sort_order = 4 WHERE name = 'Phòng VIP';

UPDATE dining_tables t
JOIN (
  SELECT 'T01' code, 1 x, 1 y UNION ALL SELECT 'T02', 2, 1 UNION ALL SELECT 'T03', 4, 1 UNION ALL SELECT 'T04', 5, 1 UNION ALL
  SELECT 'T05', 2, 3 UNION ALL SELECT 'T06', 5, 3 UNION ALL
  SELECT 'SV01', 9, 2 UNION ALL SELECT 'SV02', 9, 4 UNION ALL
  SELECT 'L2-01', 2, 1 UNION ALL SELECT 'L2-02', 2, 3 UNION ALL
  SELECT 'VIP01', 7, 1 UNION ALL SELECT 'VIP02', 7, 3
) p ON p.code = t.code
SET t.pos_x = p.x, t.pos_y = p.y;

DELETE FROM floor_walls WHERE floor_id IN (@f1, @f2);
INSERT INTO floor_walls (floor_id, kind, x1, y1, x2, y2) VALUES
  -- Tầng 1: nhà chính x 0–8, cửa ra sân vườn ở cạnh phải (y 2–4); góc quầy thu ngân dưới trái
  (@f1, 'outer', 0, 0, 8, 0), (@f1, 'outer', 0, 0, 0, 7), (@f1, 'outer', 0, 7, 8, 7),
  (@f1, 'outer', 8, 0, 8, 2), (@f1, 'outer', 8, 4, 8, 7),
  (@f1, 'inner', 0, 5, 3, 5), (@f1, 'inner', 3, 5, 3, 7),
  (@f1, 'fence', 8, 0, 12, 0), (@f1, 'fence', 12, 0, 12, 7), (@f1, 'fence', 8, 7, 12, 7),
  -- Tầng 2: vách ngăn phòng VIP có cửa (y 2–3)
  (@f2, 'outer', 0, 0, 10, 0), (@f2, 'outer', 10, 0, 10, 6), (@f2, 'outer', 0, 6, 10, 6), (@f2, 'outer', 0, 0, 0, 6),
  (@f2, 'inner', 6, 0, 6, 2), (@f2, 'inner', 6, 3, 6, 6);
