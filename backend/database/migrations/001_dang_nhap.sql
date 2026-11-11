/* =====================================================================
   NÂNG CẤP 001 — Đăng nhập & phân quyền 5 actor
   Dành cho máy ĐÃ tạo rms_db bằng rms_schema.sql bản cũ (trước khi có đăng nhập).
   Máy tạo mới bằng rms_schema.sql bản hiện tại thì KHÔNG cần chạy file này.

   Việc làm:
     1. Gộp Quản trị viên vào Quản lý nhà hàng: chuyển quyền ai.config sang manager,
        xóa tài khoản 'admin' và vai trò 'admin'.
     2. Nhân viên phục vụ (waiter) giữ lại để xếp ca/tính lương nhưng bỏ hết quyền (không đăng nhập).
     3. Đặt mật khẩu mẫu "Rms@2026" cho các tài khoản mẫu (chỉ dùng khi phát triển).

   Cách chạy:  mysql -u root -p rms_db < backend/database/migrations/001_dang_nhap.sql
   Chạy lại nhiều lần vẫn an toàn.
   ===================================================================== */

USE rms_db;
SET NAMES utf8mb4;

START TRANSACTION;

-- 1. Quyền cấu hình AI thuộc về Quản lý nhà hàng
INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.code = 'ai.config' WHERE r.code = 'manager';

-- Lịch sử thao tác của admin (nếu có) vẫn giữ: audit_logs/backup_files tự đặt user_id = NULL nhờ ON DELETE SET NULL.
DELETE FROM users WHERE username = 'admin';
DELETE FROM roles WHERE code = 'admin';

UPDATE roles SET description = 'Toàn bộ nghiệp vụ quản lý, gồm cả tài khoản, cấu hình AI và cấu hình hệ thống'
WHERE code = 'manager';

-- 2. Phục vụ: không đăng nhập
DELETE rp FROM role_permissions rp JOIN roles r ON r.id = rp.role_id WHERE r.code = 'waiter';
UPDATE roles SET description = 'Chỉ để xếp ca và tính lương; không đăng nhập hệ thống' WHERE code = 'waiter';

-- 3. Mật khẩu mẫu "Rms@2026" — chỉ ghi đè tài khoản mẫu còn mật khẩu giữ chỗ (chưa ai đổi).
UPDATE users
SET password_hash = '$2a$10$JQ5j69tw/M7NIcGr6zTRTu1.4EdEALcihYDgiqQyg2dzz4bmMuRbq', must_change_password = 0
WHERE username IN ('tuan.nguyen', 'linh.tran', 'hung.pham', 'thao.bui', 'nam.hoang')
  AND password_hash LIKE '%REPLACE.WITH.REAL.BCRYPT.HASH%';

COMMIT;

SELECT u.username, r.code AS vai_tro, u.status AS trang_thai, u.must_change_password AS phai_doi_mat_khau
FROM users u JOIN roles r ON r.id = u.role_id
WHERE u.deleted_at IS NULL
ORDER BY u.id;
