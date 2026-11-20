/* =====================================================================
   V20 — Actor Nhân viên phục vụ + chấm công bằng khuôn mặt (20/11/2026)

   - Phục vụ (waiter) được đăng nhập: xem ca, sơ đồ bàn, mở / đóng bàn, gọi món hộ, bưng món,
     chuyển / ghép bàn, nhận yêu cầu hỗ trợ của khách theo khu vực.
   - Phân công ca có thêm khu vực phụ trách (vd. Tầng 1). Yêu cầu hỗ trợ qua QR của bàn thuộc khu nào
     chỉ phục vụ được gán khu đó trong ca thấy; khu không ai được gán thì mọi phục vụ đang trong ca thấy.
     Yêu cầu thanh toán vẫn do Thu ngân xử lý (gắn với hóa đơn).
   - Khuôn mặt đăng ký (face_profiles): mã khuôn mặt 128 số do trình duyệt tính, quản lý duyệt.
   - Chấm công nguồn 'camera': ảnh, IP, độ lệch khuôn mặt, số phút đi trễ / về sớm so với ca.
   - Áp dụng chấm công khuôn mặt: phục vụ, thu ngân, bếp.
   ===================================================================== */

/* ---------------------------------------------------------------- Vai trò & quyền */
UPDATE roles SET description = 'Sơ đồ bàn, mở bàn, gọi món hộ, bưng món, nhận yêu cầu hỗ trợ theo khu vực'
WHERE code = 'waiter';

INSERT INTO permissions (code, module, name) VALUES
 ('table.serve',     'table',   'Mở / đóng bàn, chuyển / ghép bàn, gọi món hộ khách, bưng món'),
 ('attendance.self', 'payroll', 'Tự chấm công bằng khuôn mặt, xem chấm công và phiếu lương của mình');

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p ON
  (r.code = 'waiter'  AND p.code IN ('table.serve','service_request.serve','order.view','attendance.self','notification.view'))
  OR (r.code IN ('cashier','kitchen') AND p.code = 'attendance.self');

/* ---------------------------------------------------------------- Khu vực phụ trách theo ca */
ALTER TABLE shift_assignments
  ADD COLUMN area_id BIGINT UNSIGNED NULL AFTER work_date,
  ADD CONSTRAINT fk_sa_area FOREIGN KEY (area_id) REFERENCES areas(id) ON DELETE SET NULL;

/* ---------------------------------------------------------------- Khuôn mặt đăng ký */
CREATE TABLE face_profiles (
  id             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id        BIGINT UNSIGNED NOT NULL,
  descriptor     JSON NOT NULL,                       -- mảng 128 số thực (face-api), so khớp ở backend
  photo_url      VARCHAR(500) NULL,                   -- ảnh lúc đăng ký, để quản lý duyệt
  status         VARCHAR(10) NOT NULL DEFAULT 'pending',
  consent_at     DATETIME NOT NULL,                   -- nhân viên đồng ý thu thập dữ liệu khuôn mặt (NĐ 13/2023)
  created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reviewed_by    BIGINT UNSIGNED NULL,
  reviewed_at    DATETIME NULL,
  reject_reason  VARCHAR(200) NULL,
  CONSTRAINT uq_face_user UNIQUE (user_id),           -- đăng ký lại = ghi đè, quay về chờ duyệt
  CONSTRAINT fk_face_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_face_reviewer FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT chk_face_status CHECK (status IN ('pending','approved','rejected'))
) ENGINE=InnoDB COMMENT='Dữ liệu sinh trắc học: xóa khi xóa tài khoản; chỉ quản lý và chính nhân viên xem được.';

/* ---------------------------------------------------------------- Chấm công bằng camera */
ALTER TABLE attendances DROP CHECK chk_att_source;

ALTER TABLE attendances
  ADD COLUMN check_in_photo   VARCHAR(500) NULL AFTER check_out,
  ADD COLUMN check_out_photo  VARCHAR(500) NULL AFTER check_in_photo,
  ADD COLUMN check_in_ip      VARCHAR(45)  NULL AFTER check_out_photo,
  ADD COLUMN check_out_ip     VARCHAR(45)  NULL AFTER check_in_ip,
  ADD COLUMN check_in_distance  DECIMAL(5,4) NULL AFTER check_out_ip,   -- độ lệch khuôn mặt, càng nhỏ càng giống
  ADD COLUMN check_out_distance DECIMAL(5,4) NULL AFTER check_in_distance,
  ADD COLUMN late_minutes     SMALLINT UNSIGNED NULL AFTER check_out_distance,
  ADD COLUMN early_minutes    SMALLINT UNSIGNED NULL AFTER late_minutes,
  ADD COLUMN photos_purged_at DATETIME NULL AFTER early_minutes,       -- ảnh đã tự xóa sau N ngày
  ADD CONSTRAINT chk_att_source CHECK (source IN ('excel','manual','camera'));

/* ---------------------------------------------------------------- Cấu hình chấm công */
INSERT IGNORE INTO system_settings (setting_key, setting_value, value_type, description) VALUES
 ('attendance.allowed_networks', '',    'string', 'IP / dải mạng WiFi quán được chấm công, cách nhau dấu phẩy (vd. 113.161.1.20, 192.168.1.0/24). Trống = không kiểm tra'),
 ('attendance.early_minutes',    '30',  'number', 'Được vào ca sớm tối đa bao nhiêu phút'),
 ('attendance.face_threshold',   '0.5', 'number', 'Độ lệch khuôn mặt tối đa để coi là đúng người (0.4 chặt – 0.6 dễ)'),
 ('attendance.photo_retention_days', '90', 'number', 'Ảnh chấm công tự xóa sau bao nhiêu ngày (giờ chấm công vẫn giữ)');
