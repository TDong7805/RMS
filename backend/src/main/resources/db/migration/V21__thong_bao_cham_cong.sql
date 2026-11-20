-- V21 (20/11/2026): loại thông báo cho chấm công khuôn mặt — quản lý nhận khi có khuôn mặt chờ duyệt,
-- nhân viên nhận khi khuôn mặt được duyệt / từ chối / yêu cầu đăng ký lại.
INSERT IGNORE INTO notification_types (code, name, target_route) VALUES
 ('attendance', 'Chấm công', NULL);
