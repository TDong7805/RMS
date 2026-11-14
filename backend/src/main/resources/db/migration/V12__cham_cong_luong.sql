/* =====================================================================
   V12 — Đợt 3: chấm công nhập từ Excel, bảng lương (DacTa_UC_DatMon_Bep_ThuNgan UC-TN-10..12)

   - Chấm công: nguồn (Excel / nhập tay), người nhập / sửa, thời điểm. Không dựa vào lịch phân ca.
   - Kỳ lương: người tạo, người chốt, thời điểm chốt. Kỳ đã chốt khóa chấm công trong khoảng ngày của kỳ.
   - Bảng lương: tên vai trò lúc tính (để phiếu lương giữ nguyên khi tài khoản đổi vai trò).
   ===================================================================== */

ALTER TABLE attendances
  ADD COLUMN source      VARCHAR(10) NOT NULL DEFAULT 'manual' AFTER note,
  ADD COLUMN created_by  BIGINT UNSIGNED NULL AFTER source,
  ADD COLUMN created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP AFTER created_by,
  ADD COLUMN updated_by  BIGINT UNSIGNED NULL AFTER created_at,
  ADD COLUMN updated_at  DATETIME NULL AFTER updated_by,
  ADD CONSTRAINT chk_att_source CHECK (source IN ('excel','manual')),
  ADD CONSTRAINT fk_att_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  ADD CONSTRAINT fk_att_updater FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX ix_att_date ON attendances (work_date);

ALTER TABLE payroll_periods
  ADD COLUMN created_by BIGINT UNSIGNED NULL AFTER status,
  ADD COLUMN created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP AFTER created_by,
  ADD COLUMN closed_by  BIGINT UNSIGNED NULL AFTER created_at,
  ADD COLUMN closed_at  DATETIME NULL AFTER closed_by,
  ADD CONSTRAINT fk_pp_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  ADD CONSTRAINT fk_pp_closer FOREIGN KEY (closed_by) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE payrolls
  ADD COLUMN role_name VARCHAR(60) NULL AFTER user_id;
