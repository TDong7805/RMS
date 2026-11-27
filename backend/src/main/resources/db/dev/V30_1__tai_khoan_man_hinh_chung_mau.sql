-- Dữ liệu mẫu (chỉ dev): 2 tài khoản màn hình chung, mật khẩu "Rms@2026" như các tài khoản mẫu khác.
--   khu.thu.ngan — máy ở quầy thu ngân (POS)
--   khu.bep      — màn hình bếp
-- Môi trường thật: quản lý tự tạo ở Tài khoản → Thêm, chọn vai trò Thu ngân / Nhân viên bếp và bật "Màn hình chung".
INSERT IGNORE INTO users (username, password_hash, must_change_password, full_name, email, phone, role_id, shared_screen,
                          hourly_rate, status)
SELECT s.username, '$2a$10$JQ5j69tw/M7NIcGr6zTRTu1.4EdEALcihYDgiqQyg2dzz4bmMuRbq', 0, s.full_name,
       CONCAT(s.username, '@royalbeef.vn'), NULL, r.id, 1, 0, 'active'
FROM (
  SELECT 'khu.thu.ngan' username, 'Quầy thu ngân' full_name, 'cashier' role UNION ALL
  SELECT 'khu.bep',               'Màn hình bếp',            'kitchen'
) s
JOIN roles r ON r.code = s.role;
