/* =====================================================================
   DỮ LIỆU MẪU — Khu vực phụ trách của nhân viên phục vụ (chỉ profile dev). Cần migration V20.

   Gán khu cho các ca đã phân ở V3_2:
     nam.hoang → Tầng 1, vy.ngo → Tầng 1, phuc.do → Tầng 2, quynh.ly → Sân vườn, binh.vu → Phòng VIP.
   Khu không có ai trong ca thì yêu cầu hỗ trợ hiện cho mọi phục vụ đang trong ca.
   nam.hoang đăng nhập được từ V20 (mật khẩu chung Rms@2026).
   ===================================================================== */

SET NAMES utf8mb4;
SET time_zone = '+07:00';

UPDATE shift_assignments sa
JOIN users u ON u.id = sa.user_id
JOIN (
  SELECT 'nam.hoang' username, 'Tầng 1' area UNION ALL
  SELECT 'vy.ngo',    'Tầng 1' UNION ALL
  SELECT 'phuc.do',   'Tầng 2' UNION ALL
  SELECT 'quynh.ly',  'Sân vườn' UNION ALL
  SELECT 'binh.vu',   'Phòng VIP'
) m ON m.username = u.username
JOIN areas a ON a.name = m.area
SET sa.area_id = a.id;
