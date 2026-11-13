/* =====================================================================
   V9 — Phân hệ Quản lý kho, đợt 3: xuất kho (UC-KHO-20, 21), kiểm kê + duyệt (UC-KHO-22..24),
        công nợ / thanh toán nhà cung cấp (UC-KHO-25, 26)

   - Phiếu xuất (PX…): lý do xuất cho bếp / hủy hư hỏng / hủy hết hạn / khác; giá trị theo giá vốn lúc xuất.
     Không sửa, không xóa, không hủy.
   - Phiếu kiểm kê (KK…): mỗi dòng chụp tồn sổ sách + thời điểm lúc nhập số đếm; chỉ điều chỉnh tồn khi
     Quản lý nhà hàng duyệt (cộng / trừ đúng phần chênh lệch, giá trị chốt theo giá vốn lúc duyệt).
   - Thanh toán NCC: thêm mã tham chiếu (mã giao dịch ngân hàng, số phiếu chi).
   - Các dòng xuất kho đã có trong sổ (dữ liệu cũ) được gắn phiếu xuất tương ứng.
   ===================================================================== */

/* ---------------------------------------------------------------- Phiếu xuất */

CREATE TABLE stock_issues (
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  code         VARCHAR(20)  NOT NULL,              -- PX2611-001
  reason       VARCHAR(10)  NOT NULL,              -- kitchen | damaged | expired | other
  receiver_id  BIGINT UNSIGNED NULL,               -- nhân viên nhận (xuất cho bếp)
  note         VARCHAR(500) NULL,
  total_value  DECIMAL(14,2) NOT NULL DEFAULT 0,
  created_by   BIGINT UNSIGNED NULL,
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_si_code UNIQUE (code),
  CONSTRAINT fk_iss_receiver FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_iss_user FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT chk_iss_reason CHECK (reason IN ('kitchen','damaged','expired','other')),
  INDEX ix_iss_time (created_at)
) ENGINE=InnoDB COMMENT='Phiếu xuất kho: không sửa, không xóa, không hủy (UC-KHO-20).';

CREATE TABLE stock_issue_items (
  id             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  issue_id       BIGINT UNSIGNED NOT NULL,
  ingredient_id  BIGINT UNSIGNED NOT NULL,
  qty            DECIMAL(12,3) NOT NULL,           -- đơn vị kho
  unit_cost      DECIMAL(14,2) NULL,               -- giá vốn lúc xuất (NULL = chưa có giá vốn)
  value          DECIMAL(14,2) NOT NULL DEFAULT 0, -- qty × giá vốn, làm tròn đồng
  CONSTRAINT fk_isi_issue FOREIGN KEY (issue_id) REFERENCES stock_issues(id) ON DELETE CASCADE,
  CONSTRAINT fk_isi_ing FOREIGN KEY (ingredient_id) REFERENCES ingredients(id) ON DELETE RESTRICT,
  CONSTRAINT chk_isi_qty CHECK (qty > 0)
) ENGINE=InnoDB;

/* ---------------------------------------------------------------- Phiếu kiểm kê */

CREATE TABLE stocktakes (
  id             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  code           VARCHAR(20)  NOT NULL,            -- KK2611-001
  scope          VARCHAR(10)  NOT NULL,            -- all | group | pick
  scope_groups   VARCHAR(200) NULL,                -- danh sách nhóm (phạm vi theo nhóm), phân tách bằng dấu phẩy
  note           VARCHAR(500) NULL,
  status         VARCHAR(10)  NOT NULL DEFAULT 'draft',
  reject_reason  VARCHAR(300) NULL,
  cancel_reason  VARCHAR(300) NULL,
  submitted_at   DATETIME NULL,
  approved_by    BIGINT UNSIGNED NULL,
  approved_at    DATETIME NULL,
  created_by     BIGINT UNSIGNED NULL,
  created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT uq_stk_code UNIQUE (code),
  CONSTRAINT fk_stk_approver FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_stk_user FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT chk_stk_scope CHECK (scope IN ('all','group','pick')),
  CONSTRAINT chk_stk_status CHECK (status IN ('draft','pending','approved','matched','rejected','cancelled')),
  INDEX ix_stk_status (status, created_at)
) ENGINE=InnoDB COMMENT='Phiếu kiểm kê: chỉ đổi tồn khi Quản lý nhà hàng duyệt (UC-KHO-23, 24).';

CREATE TABLE stocktake_items (
  id                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  stocktake_id      BIGINT UNSIGNED NOT NULL,
  ingredient_id     BIGINT UNSIGNED NOT NULL,
  book_qty          DECIMAL(12,3) NULL,            -- tồn sổ sách chụp lúc nhập số đếm
  actual_qty        DECIMAL(12,3) NULL,            -- NULL = chưa đếm
  counted_at        DATETIME NULL,
  reason            VARCHAR(12)  NULL,             -- natural | damaged | wrong_entry | lost | other
  note              VARCHAR(200) NULL,
  est_unit_cost     DECIMAL(14,2) NULL,            -- đơn giá ước tính (dòng tăng, nguyên liệu chưa có giá vốn)
  adjust_unit_cost  DECIMAL(14,2) NULL,            -- giá vốn chốt lúc duyệt
  adjust_value      DECIMAL(14,2) NULL,            -- giá trị chênh lệch chốt lúc duyệt (±)
  CONSTRAINT uq_stki_line UNIQUE (stocktake_id, ingredient_id),
  CONSTRAINT fk_stki_stk FOREIGN KEY (stocktake_id) REFERENCES stocktakes(id) ON DELETE CASCADE,
  CONSTRAINT fk_stki_ing FOREIGN KEY (ingredient_id) REFERENCES ingredients(id) ON DELETE RESTRICT,
  CONSTRAINT chk_stki_qty CHECK ((actual_qty IS NULL OR actual_qty >= 0) AND (est_unit_cost IS NULL OR est_unit_cost > 0)),
  CONSTRAINT chk_stki_reason CHECK (reason IS NULL OR reason IN ('natural','damaged','wrong_entry','lost','other'))
) ENGINE=InnoDB;

CREATE TABLE stocktake_events (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  stocktake_id  BIGINT UNSIGNED NOT NULL,
  event         VARCHAR(10)  NOT NULL,             -- create | submit | matched | approve | reject | cancel
  note          VARCHAR(300) NULL,
  created_by    BIGINT UNSIGNED NULL,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_stke_stk FOREIGN KEY (stocktake_id) REFERENCES stocktakes(id) ON DELETE CASCADE,
  CONSTRAINT fk_stke_user FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT chk_stke_event CHECK (event IN ('create','submit','matched','approve','reject','cancel')),
  INDEX ix_stke_stk (stocktake_id, created_at)
) ENGINE=InnoDB COMMENT='Lịch sử trạng thái phiếu kiểm kê.';

ALTER TABLE stock_transactions
  ADD COLUMN issue_id     BIGINT UNSIGNED NULL AFTER receipt_id,
  ADD COLUMN stocktake_id BIGINT UNSIGNED NULL AFTER issue_id,
  ADD CONSTRAINT fk_st_issue FOREIGN KEY (issue_id) REFERENCES stock_issues(id) ON DELETE RESTRICT,
  ADD CONSTRAINT fk_st_stk FOREIGN KEY (stocktake_id) REFERENCES stocktakes(id) ON DELETE RESTRICT;

/* ---------------------------------------------------------------- Thanh toán NCC */

ALTER TABLE supplier_payments
  ADD COLUMN reference VARCHAR(50) NULL AFTER method;

/* ---------------------------------------------------------------- Phiếu xuất cho các dòng xuất đã có */

INSERT INTO stock_issues (code, reason, note, total_value, created_by, created_at)
SELECT t.doc_code, IF(t.move_type = 'issue_kitchen', 'kitchen', IF(t.move_type = 'issue_waste', 'damaged', 'other')),
       MAX(t.reason), SUM(ROUND(-t.quantity_change * COALESCE(t.unit_cost, 0))), MIN(t.created_by), MIN(t.created_at)
FROM stock_transactions t
WHERE t.move_type LIKE 'issue\_%' AND t.doc_code IS NOT NULL
GROUP BY t.doc_code, t.move_type;

INSERT INTO stock_issue_items (issue_id, ingredient_id, qty, unit_cost, value)
SELECT i.id, t.ingredient_id, -t.quantity_change, t.unit_cost, ROUND(-t.quantity_change * COALESCE(t.unit_cost, 0))
FROM stock_transactions t JOIN stock_issues i ON i.code = t.doc_code
WHERE t.move_type LIKE 'issue\_%';

-- Sổ kho bị trigger khóa sửa; bật @rms_restore trong phạm vi migration này (xem V5) rồi tắt ngay.
SET @rms_restore = 1;
UPDATE stock_transactions t JOIN stock_issues i ON i.code = t.doc_code
   SET t.issue_id = i.id
 WHERE t.move_type LIKE 'issue\_%';
SET @rms_restore = NULL;
