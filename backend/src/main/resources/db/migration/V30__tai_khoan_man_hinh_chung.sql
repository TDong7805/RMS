-- ============================================================================
-- V30: Tài khoản MÀN HÌNH CHUNG cho quầy thu ngân / bếp (27/11/2026)
--
--  - Màn hình chung (users.shared_screen = 1, chỉ vai trò thu ngân / bếp): máy đặt ở quầy / bếp, cả ca dùng chung một
--    tài khoản (vd. khu.thu.ngan, khu.bep). Chỉ mở được màn làm việc (POS / màn bếp), nhận thông báo công việc.
--    Không chấm công, không có thông tin cá nhân, không vào bảng lương / lịch ca.
--  - Tài khoản riêng của thu ngân / bếp (shared_screen = 0): chỉ trang cá nhân (Cổng nhân viên /nhan-vien: chấm công,
--    ca của tôi, lịch sử, phiếu lương, hồ sơ). Thu ngân còn có việc văn phòng: sửa chấm công, bảng lương.
--  - Ngưỡng khuôn mặt riêng cho thu ngân / bếp (chặt hơn phục vụ).
-- ============================================================================

ALTER TABLE users
  ADD COLUMN shared_screen TINYINT(1) NOT NULL DEFAULT 0
    COMMENT '1 = tài khoản màn hình chung ở quầy / bếp (chỉ thu ngân, bếp)' AFTER role_id;

INSERT INTO system_settings (setting_key, setting_value, value_type, description) VALUES
 ('attendance.face_threshold_counter', '0.3', 'number',
  'Độ lệch khuôn mặt tối đa khi thu ngân / bếp chấm công (0.2 rất chặt – 0.6 dễ; khuyên dùng 0.3)')
ON DUPLICATE KEY UPDATE setting_key = setting_key;
