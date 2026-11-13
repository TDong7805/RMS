/* =====================================================================
   V8 — Phân hệ Quản lý kho, đợt 2: phiếu mua (UC-KHO-12..16) và nhập kho (UC-KHO-17..19)

   - Phiếu mua: tên phiếu, ngày đặt (chọn được 7 ngày trước → hôm nay), người đặt, giảm giá (số tiền hoặc %),
     thuế %, chi phí khác; trạng thái nhận thêm "closed" (Đã kết thúc); cờ đã gửi thông báo trễ hạn.
     Phiếu nháp được lưu dòng chưa đủ số lượng / đơn giá (NULL).
   - Dòng phiếu mua chốt đơn vị mua + hệ số quy đổi lúc đặt hàng.
   - Lịch sử trạng thái phiếu mua (tạo, đặt hàng, hủy, kết thúc nhận hàng kèm lý do).
   - Phiếu nhập (goods_receipts): theo phiếu mua / nhập không phiếu / tồn đầu kỳ; hủy được (UC-KHO-19).
     Mỗi dòng lưu tồn và giá vốn ngay trước khi nhập để hủy thì trả về đúng như cũ.
   - Thanh toán NCC: thêm mã, trạng thái hiệu lực / đã hủy (giao diện làm ở đợt 3).
   - Các phiếu "Tồn đầu kỳ" đã có trong sổ kho được tạo phiếu nhập tương ứng.
   ===================================================================== */

/* ---------------------------------------------------------------- Phiếu mua */

ALTER TABLE purchase_orders DROP CHECK chk_po_receive;

ALTER TABLE purchase_orders
  ADD COLUMN name             VARCHAR(150) NOT NULL DEFAULT '' AFTER code,
  ADD COLUMN order_date       DATE NULL AFTER status,
  ADD COLUMN ordered_by       BIGINT UNSIGNED NULL AFTER ordered_at,
  ADD COLUMN discount_percent DECIMAL(5,2)  NULL AFTER note,          -- NULL = giảm theo số tiền
  ADD COLUMN discount         DECIMAL(14,2) NOT NULL DEFAULT 0 AFTER discount_percent,
  ADD COLUMN tax_percent      DECIMAL(5,2)  NOT NULL DEFAULT 0 AFTER discount,
  ADD COLUMN other_cost       DECIMAL(14,2) NOT NULL DEFAULT 0 AFTER tax_percent,
  ADD COLUMN late_notified    TINYINT(1) NOT NULL DEFAULT 0 AFTER other_cost,
  ADD CONSTRAINT fk_po_orderer FOREIGN KEY (ordered_by) REFERENCES users(id) ON DELETE SET NULL,
  ADD CONSTRAINT chk_po_receive CHECK (receive_status IN ('not_received','partial','received','closed')),
  ADD CONSTRAINT chk_po_money CHECK (discount >= 0 AND other_cost >= 0 AND tax_percent BETWEEN 0 AND 100
                                     AND (discount_percent IS NULL OR discount_percent BETWEEN 0 AND 100));

UPDATE purchase_orders SET order_date = DATE(ordered_at) WHERE ordered_at IS NOT NULL;

ALTER TABLE purchase_order_items DROP CHECK chk_poi_qty;

ALTER TABLE purchase_order_items
  MODIFY COLUMN qty_ordered DECIMAL(12,3) NULL,
  MODIFY COLUMN unit_price  DECIMAL(14,2) NULL,
  ADD COLUMN purchase_unit VARCHAR(10)   NULL AFTER ingredient_id,
  ADD COLUMN factor        DECIMAL(10,3) NOT NULL DEFAULT 1 AFTER purchase_unit,
  ADD COLUMN sort_order    INT NOT NULL DEFAULT 0,
  ADD CONSTRAINT chk_poi_qty CHECK ((qty_ordered IS NULL OR qty_ordered > 0) AND qty_received >= 0
                                    AND (unit_price IS NULL OR unit_price > 0) AND factor > 0);

UPDATE purchase_order_items poi JOIN ingredients i ON i.id = poi.ingredient_id
   SET poi.purchase_unit = i.unit WHERE poi.purchase_unit IS NULL;

CREATE TABLE purchase_order_events (
  id                 BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  purchase_order_id  BIGINT UNSIGNED NOT NULL,
  event              VARCHAR(10)  NOT NULL,          -- create | order | cancel | close
  reason             VARCHAR(20)  NULL,
  note               VARCHAR(255) NULL,
  created_by         BIGINT UNSIGNED NULL,
  created_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_poe_po FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id) ON DELETE CASCADE,
  CONSTRAINT fk_poe_user FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT chk_poe_event CHECK (event IN ('create','order','cancel','close')),
  INDEX ix_poe_po (purchase_order_id, created_at)
) ENGINE=InnoDB COMMENT='Lịch sử trạng thái phiếu mua (UC-KHO-14).';

/* ---------------------------------------------------------------- Phiếu nhập */

CREATE TABLE goods_receipts (
  id                 BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  code               VARCHAR(20)  NOT NULL,          -- PN2611-001
  kind               VARCHAR(10)  NOT NULL,          -- po | direct | opening
  purchase_order_id  BIGINT UNSIGNED NULL,
  supplier_id        BIGINT UNSIGNED NULL,           -- nhập không phiếu từ NCC
  source_name        VARCHAR(150) NULL,              -- "Mua lẻ": tên nơi mua
  note               VARCHAR(500) NULL,
  total_value        DECIMAL(14,2) NOT NULL DEFAULT 0,
  status             VARCHAR(10)  NOT NULL DEFAULT 'posted',
  cancel_reason      VARCHAR(300) NULL,
  cancelled_by       BIGINT UNSIGNED NULL,
  cancelled_at       DATETIME NULL,
  created_by         BIGINT UNSIGNED NULL,
  created_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_gr_code UNIQUE (code),
  CONSTRAINT fk_gr_po FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id) ON DELETE RESTRICT,
  CONSTRAINT fk_gr_sup FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE RESTRICT,
  CONSTRAINT fk_gr_user FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_gr_cancel_user FOREIGN KEY (cancelled_by) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT chk_gr_kind CHECK (kind IN ('po','direct','opening')),
  CONSTRAINT chk_gr_status CHECK (status IN ('posted','cancelled')),
  INDEX ix_gr_time (created_at)
) ENGINE=InnoDB COMMENT='Phiếu nhập kho: không sửa, không xóa; chỉ hủy khi chưa có giao dịch kho khác (UC-KHO-19).';

CREATE TABLE goods_receipt_items (
  id                      BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  receipt_id              BIGINT UNSIGNED NOT NULL,
  ingredient_id           BIGINT UNSIGNED NOT NULL,
  purchase_order_item_id  BIGINT UNSIGNED NULL,
  unit                    VARCHAR(10)   NOT NULL,     -- đơn vị đã nhập (đơn vị mua hoặc đơn vị kho)
  factor                  DECIMAL(10,3) NOT NULL DEFAULT 1,
  qty                     DECIMAL(12,3) NOT NULL,     -- theo đơn vị đã nhập
  unit_price              DECIMAL(14,2) NOT NULL,     -- cho 1 đơn vị đã nhập
  amount                  DECIMAL(14,2) NOT NULL,     -- qty × unit_price, làm tròn đồng
  stock_qty               DECIMAL(12,3) NOT NULL,     -- quy ra đơn vị kho
  stock_unit_cost         DECIMAL(14,2) NOT NULL,     -- đơn giá nhập kho cho 1 đơn vị kho (đã trừ giảm giá phân bổ)
  prev_qty                DECIMAL(12,3) NOT NULL,     -- tồn ngay trước khi nhập (để hủy)
  prev_avg_cost           DECIMAL(14,2) NULL,         -- giá vốn ngay trước khi nhập (để hủy)
  note                    VARCHAR(200) NULL,
  CONSTRAINT fk_gri_gr FOREIGN KEY (receipt_id) REFERENCES goods_receipts(id) ON DELETE CASCADE,
  CONSTRAINT fk_gri_ing FOREIGN KEY (ingredient_id) REFERENCES ingredients(id) ON DELETE RESTRICT,
  CONSTRAINT fk_gri_poi FOREIGN KEY (purchase_order_item_id) REFERENCES purchase_order_items(id) ON DELETE RESTRICT,
  CONSTRAINT chk_gri_qty CHECK (qty > 0 AND unit_price >= 0 AND stock_qty > 0 AND factor > 0)
) ENGINE=InnoDB;

ALTER TABLE stock_transactions
  ADD COLUMN receipt_id BIGINT UNSIGNED NULL AFTER purchase_order_item_id,
  ADD CONSTRAINT fk_st_gr FOREIGN KEY (receipt_id) REFERENCES goods_receipts(id) ON DELETE RESTRICT;

/* ---------------------------------------------------------------- Thanh toán NCC (giao diện ở đợt 3) */

ALTER TABLE supplier_payments
  ADD COLUMN code          VARCHAR(20)  NULL AFTER id,
  ADD COLUMN status        VARCHAR(10)  NOT NULL DEFAULT 'valid' AFTER note,
  ADD COLUMN cancel_reason VARCHAR(300) NULL AFTER status,
  ADD COLUMN cancelled_by  BIGINT UNSIGNED NULL AFTER cancel_reason,
  ADD COLUMN cancelled_at  DATETIME NULL AFTER cancelled_by,
  ADD CONSTRAINT uq_sp_code UNIQUE (code),
  ADD CONSTRAINT fk_sp_cancel_user FOREIGN KEY (cancelled_by) REFERENCES users(id) ON DELETE SET NULL,
  ADD CONSTRAINT chk_sp_status CHECK (status IN ('valid','cancelled'));

/* ---------------------------------------------------------------- Phiếu nhập cho "Tồn đầu kỳ" đã có */

INSERT INTO goods_receipts (code, kind, note, total_value, created_by, created_at)
SELECT t.doc_code, 'opening', 'Tồn đầu kỳ', SUM(ROUND(t.quantity_change * COALESCE(t.unit_cost, 0))), MIN(t.created_by), MIN(t.created_at)
FROM stock_transactions t
WHERE t.move_type = 'opening' AND t.doc_code IS NOT NULL
GROUP BY t.doc_code;

INSERT INTO goods_receipt_items (receipt_id, ingredient_id, unit, factor, qty, unit_price, amount, stock_qty, stock_unit_cost, prev_qty, prev_avg_cost)
SELECT r.id, t.ingredient_id, i.unit, 1, t.quantity_change, COALESCE(t.unit_cost, 0), ROUND(t.quantity_change * COALESCE(t.unit_cost, 0)),
       t.quantity_change, COALESCE(t.unit_cost, 0), 0, NULL
FROM stock_transactions t
JOIN goods_receipts r ON r.code = t.doc_code
JOIN ingredients i ON i.id = t.ingredient_id
WHERE t.move_type = 'opening';

-- Sổ kho bị trigger khóa sửa; bật @rms_restore trong phạm vi migration này (xem V5) rồi tắt ngay.
SET @rms_restore = 1;
UPDATE stock_transactions t JOIN goods_receipts r ON r.code = t.doc_code
   SET t.receipt_id = r.id
 WHERE t.move_type = 'opening';
SET @rms_restore = NULL;
