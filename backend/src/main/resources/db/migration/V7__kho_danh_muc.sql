/* =====================================================================
   V7 — Phân hệ Quản lý kho, đợt 1 (theo DacTa_UC_QuanLyKho)

   - Nguyên liệu: nhóm, ghi chú, người tạo; giá vốn NULL = "chưa có giá vốn" (chưa từng nhập).
     alert_level ghi mức đã cảnh báo gần nhất để không gửi trùng thông báo sắp hết / hết hàng (UC-KHO-27).
   - Nhà cung cấp: phương thức thanh toán, người liên hệ, website, mã số thuế (duy nhất), ghi chú,
     lý do ngừng hoạt động; lịch sử bật / tắt trạng thái.
   - Liên kết nguyên liệu – nhà cung cấp (UC-KHO-11): đơn vị mua + hệ số quy đổi ra đơn vị kho,
     giá nhập cho 1 đơn vị mua, SL đặt tối thiểu; lịch sử giá theo ngày áp dụng.
   - Sổ kho: thêm loại nghiệp vụ chi tiết (move_type) và mã chứng từ (doc_code) để hiện thẻ kho.
   - Bộ đếm mã chứng từ theo tháng (PN2611-001…) và mã danh mục (NL…, NCC…).
   - Loại thông báo mới cho kho: phiếu mua, kiểm kê.
   ===================================================================== */

/* ---------------------------------------------------------------- Nguyên liệu */

ALTER TABLE ingredients DROP CHECK chk_ing_qty;

ALTER TABLE ingredients
  ADD COLUMN group_key   VARCHAR(20)  NOT NULL DEFAULT 'other' AFTER name,
  ADD COLUMN note        VARCHAR(300) NULL AFTER is_active,
  ADD COLUMN alert_level VARCHAR(5)   NOT NULL DEFAULT 'ok' AFTER note,
  ADD COLUMN created_by  BIGINT UNSIGNED NULL AFTER alert_level,
  MODIFY COLUMN avg_cost DECIMAL(14,2) NULL DEFAULT NULL,
  ADD CONSTRAINT fk_ing_user FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  ADD CONSTRAINT chk_ing_group CHECK (group_key IN ('meat','seafood','produce','spice','dry','dairy','drink','other')),
  ADD CONSTRAINT chk_ing_alert CHECK (alert_level IN ('ok','low','out')),
  ADD CONSTRAINT chk_ing_qty CHECK (stock_qty >= 0 AND min_level >= 0 AND (avg_cost IS NULL OR avg_cost >= 0));

-- Nguyên liệu chưa từng nhập kho thì chưa có giá vốn.
UPDATE ingredients i
   SET i.avg_cost = NULL
 WHERE NOT EXISTS (SELECT 1 FROM stock_transactions t WHERE t.ingredient_id = i.id);

UPDATE ingredients
   SET alert_level = CASE WHEN stock_qty <= 0 THEN 'out' WHEN stock_qty <= min_level THEN 'low' ELSE 'ok' END;

CREATE OR REPLACE VIEW v_ingredient_status AS
SELECT i.id, i.code, i.name, i.unit, i.stock_qty, i.min_level,
       CASE WHEN i.stock_qty = 0 THEN 'out'
            WHEN i.stock_qty <= i.min_level THEN 'low'
            ELSE 'ok' END AS stock_status,
       i.stock_qty * COALESCE(i.avg_cost, 0) AS stock_value
FROM ingredients i
WHERE i.is_active = 1;

/* ---------------------------------------------------------------- Nhà cung cấp */

-- Mã cũ dạng NCC01 → NCC001 (quy ước mã 3 chữ số như NL001).
UPDATE suppliers
   SET code = CONCAT('NCC', LPAD(SUBSTRING(code, 4), 3, '0'))
 WHERE code REGEXP '^NCC[0-9]{1,2}$';

ALTER TABLE suppliers
  ADD COLUMN payment_method VARCHAR(10)  NOT NULL DEFAULT 'transfer' AFTER phone,
  ADD COLUMN contact_name   VARCHAR(100) NULL AFTER payment_method,
  ADD COLUMN website        VARCHAR(200) NULL AFTER email,
  ADD COLUMN tax_code       VARCHAR(14)  NULL AFTER website,
  ADD COLUMN note           VARCHAR(500) NULL AFTER address,
  ADD COLUMN stop_reason    VARCHAR(10)  NULL AFTER is_active,
  ADD COLUMN stop_note      VARCHAR(255) NULL AFTER stop_reason,
  ADD COLUMN updated_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at,
  ADD CONSTRAINT uq_sup_tax UNIQUE (tax_code),
  ADD CONSTRAINT chk_sup_method CHECK (payment_method IN ('cash','transfer')),
  ADD CONSTRAINT chk_sup_reason CHECK (stop_reason IS NULL OR stop_reason IN ('ended','quality','price','late','other'));

CREATE TABLE supplier_status_events (
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  supplier_id  BIGINT UNSIGNED NOT NULL,
  is_active    TINYINT(1)   NOT NULL,
  reason       VARCHAR(10)  NULL,
  note         VARCHAR(255) NULL,
  created_by   BIGINT UNSIGNED NULL,
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_sse_sup FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE CASCADE,
  CONSTRAINT fk_sse_user FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX ix_sse_sup (supplier_id, created_at)
) ENGINE=InnoDB COMMENT='Lịch sử ngừng hoạt động / kích hoạt lại nhà cung cấp (UC-KHO-10).';

INSERT INTO supplier_status_events (supplier_id, is_active, note, created_at)
SELECT id, 1, 'Tạo nhà cung cấp', created_at FROM suppliers;

/* ---------------------------------------------------------------- Liên kết nguyên liệu – nhà cung cấp */

CREATE TABLE supplier_ingredients (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  supplier_id     BIGINT UNSIGNED NOT NULL,
  ingredient_id   BIGINT UNSIGNED NOT NULL,
  purchase_unit   VARCHAR(10)   NOT NULL,           -- đơn vị mua: thùng, bao, kg...
  factor          DECIMAL(10,3) NOT NULL DEFAULT 1, -- 1 đơn vị mua = factor đơn vị kho
  price           DECIMAL(14,2) NOT NULL,           -- giá nhập hiện hành cho 1 đơn vị mua
  min_order       DECIMAL(12,3) NULL,               -- SL đặt tối thiểu (đơn vị mua)
  effective_from  DATE NOT NULL,
  is_active       TINYINT(1) NOT NULL DEFAULT 1,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT uq_si_pair UNIQUE (supplier_id, ingredient_id),
  CONSTRAINT fk_si_sup FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE CASCADE,
  CONSTRAINT fk_si_ing FOREIGN KEY (ingredient_id) REFERENCES ingredients(id) ON DELETE RESTRICT,
  CONSTRAINT chk_si_values CHECK (factor > 0 AND price > 0 AND (min_order IS NULL OR min_order > 0))
) ENGINE=InnoDB COMMENT='Nguyên liệu nhà cung cấp bán, giá theo đơn vị mua (UC-KHO-11).';

CREATE TABLE supplier_price_history (
  id             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  link_id        BIGINT UNSIGNED NOT NULL,
  price          DECIMAL(14,2) NOT NULL,
  purchase_unit  VARCHAR(10)   NOT NULL,
  factor         DECIMAL(10,3) NOT NULL,
  min_order      DECIMAL(12,3) NULL,
  valid_from     DATE NOT NULL,
  valid_to       DATE NULL,                         -- NULL = đang áp dụng
  change_type    VARCHAR(12) NOT NULL,
  created_by     BIGINT UNSIGNED NULL,
  created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_sph_link FOREIGN KEY (link_id) REFERENCES supplier_ingredients(id) ON DELETE CASCADE,
  CONSTRAINT fk_sph_user FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT chk_sph_change CHECK (change_type IN ('create','price','spec','min','reactivate')),
  INDEX ix_sph_link (link_id, valid_from)
) ENGINE=InnoDB COMMENT='Mỗi lần đổi giá / quy cách / SL tối thiểu: đóng bản ghi cũ (valid_to = hôm qua), mở bản ghi mới.';

/* ---------------------------------------------------------------- Sổ kho */

ALTER TABLE stock_transactions
  ADD COLUMN move_type VARCHAR(20) NULL AFTER txn_type,
  ADD COLUMN doc_code  VARCHAR(20) NULL AFTER move_type,
  ADD INDEX ix_st_doc (doc_code);

CREATE TABLE doc_sequences (
  seq_key  VARCHAR(12) NOT NULL PRIMARY KEY,        -- 'PN2611' (chứng từ theo tháng) hoặc 'NL', 'NCC' (danh mục)
  last_no  INT UNSIGNED NOT NULL DEFAULT 0
) ENGINE=InnoDB COMMENT='Bộ đếm mã: lấy số mới bằng INSERT ... ON DUPLICATE KEY UPDATE last_no = LAST_INSERT_ID(last_no + 1).';

-- Gắn loại nghiệp vụ + mã phiếu cho các dòng sổ kho đã có (dòng cũ chỉ có txn_type).
-- Sổ kho bị trigger khóa sửa; bật @rms_restore trong phạm vi migration này (xem V5) rồi tắt ngay.
SET @rms_restore = 1;

UPDATE stock_transactions t
JOIN (
  SELECT id,
         CONCAT(CASE txn_type WHEN 'import' THEN 'PN' WHEN 'export' THEN 'PX' ELSE 'KK' END,
                DATE_FORMAT(created_at, '%y%m'), '-',
                LPAD(ROW_NUMBER() OVER (PARTITION BY txn_type, DATE_FORMAT(created_at, '%y%m') ORDER BY created_at, id), 3, '0')) AS code
  FROM stock_transactions
) x ON x.id = t.id
SET t.move_type = CASE t.txn_type
                    WHEN 'import' THEN IF(t.purchase_order_item_id IS NULL, 'opening', 'po_receipt')
                    WHEN 'export' THEN 'issue_other'
                    ELSE 'stocktake' END,
    t.doc_code = x.code;

SET @rms_restore = NULL;

INSERT INTO doc_sequences (seq_key, last_no)
SELECT LEFT(doc_code, 6), MAX(CAST(SUBSTRING(doc_code, 8) AS UNSIGNED))
FROM stock_transactions WHERE doc_code IS NOT NULL
GROUP BY LEFT(doc_code, 6);

INSERT INTO doc_sequences (seq_key, last_no)
SELECT 'NL', COALESCE(MAX(CAST(SUBSTRING(code, 3) AS UNSIGNED)), 0) FROM ingredients WHERE code REGEXP '^NL[0-9]+$';

INSERT INTO doc_sequences (seq_key, last_no)
SELECT 'NCC', COALESCE(MAX(CAST(SUBSTRING(code, 4) AS UNSIGNED)), 0) FROM suppliers WHERE code REGEXP '^NCC[0-9]+$';

/* ---------------------------------------------------------------- Thông báo */

INSERT INTO notification_types (code, name, target_route) VALUES
 ('purchase',  'Phiếu mua', NULL),
 ('stocktake', 'Kiểm kê',   NULL);
