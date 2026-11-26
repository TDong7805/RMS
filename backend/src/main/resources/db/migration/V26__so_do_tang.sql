/* Sơ đồ bàn theo tầng (docs/thiet-ke/QUY_TAC_GIAO_DIEN.md, mục B7 — chốt 26/11/2026).
 *
 * - floors: mỗi tầng một sơ đồ lưới cols × rows_count ô (1 ô = 1 bàn).
 * - areas.floor_id: khu vực thuộc một tầng; zone_x/y/w/h: vùng khu tô nền trên sơ đồ tầng (ô), NULL = chưa vẽ.
 * - dining_tables.pos_x/pos_y: từ nay là tọa độ trên sơ đồ TẦNG (trước là trên lưới 8×5 riêng của từng khu).
 *   Một ô của tầng chỉ một bàn — kiểm tra ở TableService (bỏ ràng buộc cũ theo khu).
 * - floor_walls: tường thẳng ngang / dọc trên đường kẻ lưới; kind: outer (tường ngoài), inner (vách trong), fence (hàng rào).
 *
 * Dữ liệu cũ: tạo "Tầng 1", xếp các khu đang có thành từng khối 8×5 (2 khối một hàng, cách nhau 1 ô),
 * cộng vị trí bàn theo khối của khu; vẽ tường ngoài quanh tầng.
 */

CREATE TABLE floors (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(50)      NOT NULL,
  sort_order  SMALLINT         NOT NULL DEFAULT 0,
  cols        TINYINT UNSIGNED NOT NULL DEFAULT 18,
  rows_count  TINYINT UNSIGNED NOT NULL DEFAULT 12,
  CONSTRAINT uq_floors_name UNIQUE (name)
) ENGINE=InnoDB;

CREATE TABLE floor_walls (
  id        BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  floor_id  BIGINT UNSIGNED  NOT NULL,
  kind      VARCHAR(10)      NOT NULL DEFAULT 'outer',
  x1        TINYINT UNSIGNED NOT NULL,
  y1        TINYINT UNSIGNED NOT NULL,
  x2        TINYINT UNSIGNED NOT NULL,
  y2        TINYINT UNSIGNED NOT NULL,
  CONSTRAINT fk_walls_floor FOREIGN KEY (floor_id) REFERENCES floors(id) ON DELETE CASCADE
) ENGINE=InnoDB;

ALTER TABLE areas
  ADD COLUMN floor_id BIGINT UNSIGNED NULL AFTER id,
  ADD COLUMN zone_x TINYINT UNSIGNED NULL,
  ADD COLUMN zone_y TINYINT UNSIGNED NULL,
  ADD COLUMN zone_w TINYINT UNSIGNED NULL,
  ADD COLUMN zone_h TINYINT UNSIGNED NULL;

INSERT INTO floors (name, sort_order, cols, rows_count)
SELECT 'Tầng 1', 1, 18, GREATEST(12, 6 * CEIL(COUNT(*) / 2)) FROM areas;

SET @f1 = (SELECT id FROM floors WHERE name = 'Tầng 1');

UPDATE areas a
JOIN (SELECT id, ROW_NUMBER() OVER (ORDER BY sort_order, id) - 1 AS i FROM areas) r ON r.id = a.id
SET a.floor_id = @f1,
    a.zone_x = 1 + (r.i % 2) * 9,
    a.zone_y = 1 + FLOOR(r.i / 2) * 6,
    a.zone_w = 8,
    a.zone_h = 5;

-- Chỉ mục cũ (area_id, pos_x, pos_y) đang được khóa ngoại area_id dùng: thêm chỉ mục area_id riêng rồi mới bỏ.
ALTER TABLE dining_tables ADD INDEX idx_tables_area (area_id), DROP INDEX uq_tables_cell;

UPDATE dining_tables t JOIN areas a ON a.id = t.area_id
SET t.pos_x = t.pos_x + a.zone_x, t.pos_y = t.pos_y + a.zone_y;

UPDATE floors SET rows_count = GREATEST(rows_count, (SELECT COALESCE(MAX(zone_y + zone_h), 0) + 1 FROM areas)) WHERE id = @f1;

ALTER TABLE areas
  MODIFY floor_id BIGINT UNSIGNED NOT NULL,
  ADD CONSTRAINT fk_areas_floor FOREIGN KEY (floor_id) REFERENCES floors(id) ON DELETE RESTRICT;

INSERT INTO floor_walls (floor_id, kind, x1, y1, x2, y2)
SELECT id, 'outer', 0, 0, cols, 0 FROM floors WHERE id = @f1 UNION ALL
SELECT id, 'outer', cols, 0, cols, rows_count FROM floors WHERE id = @f1 UNION ALL
SELECT id, 'outer', 0, rows_count, cols, rows_count FROM floors WHERE id = @f1 UNION ALL
SELECT id, 'outer', 0, 0, 0, rows_count FROM floors WHERE id = @f1;
