/* =====================================================================
   DỮ LIỆU MẪU — Phân công ca làm việc (chỉ profile dev, KHÔNG dùng cho môi trường thật)

   Lịch từ thứ Hai tuần trước đến hết 2 tuần tới (21 ngày), tính theo ngày file được chạy:
     - mỗi nhân viên nghỉ 1 ngày/tuần (lệch nhau);
     - vài người làm 2 ca không chồng giờ trong ngày (Ca gãy 10–14 + Ca tối 17–23);
     - Phan Thu Trang (tài khoản đã khóa) chỉ có ca ở tuần trước → lịch tuần trước vẫn hiện người này.
   Ca dùng tên trong V1_1 (Ca sáng, Ca chiều, Ca gãy, Ca tối).
   ===================================================================== */

SET NAMES utf8mb4;
SET time_zone = '+07:00';

INSERT INTO shift_assignments (shift_id, user_id, work_date, created_by, created_at)
WITH RECURSIVE days (d) AS (
  SELECT 0 UNION ALL SELECT d + 1 FROM days WHERE d < 20
),
plan (username, shift_name, i, only_first_week) AS (
  SELECT 'linh.tran',  'Ca sáng',  0, 0 UNION ALL
  SELECT 'khoa.le',    'Ca chiều', 1, 0 UNION ALL
  SELECT 'hung.pham',  'Ca sáng',  2, 0 UNION ALL
  SELECT 'mai.vo',     'Ca chiều', 3, 0 UNION ALL
  SELECT 'son.dang',   'Ca tối',   4, 0 UNION ALL
  SELECT 'duc.huynh',  'Ca gãy',   5, 0 UNION ALL
  SELECT 'duc.huynh',  'Ca tối',   5, 0 UNION ALL
  SELECT 'thao.bui',   'Ca sáng',  6, 0 UNION ALL
  SELECT 'hoa.dinh',   'Ca chiều', 0, 0 UNION ALL
  SELECT 'nam.hoang',  'Ca gãy',   1, 0 UNION ALL
  SELECT 'nam.hoang',  'Ca tối',   1, 0 UNION ALL
  SELECT 'vy.ngo',     'Ca sáng',  2, 0 UNION ALL
  SELECT 'phuc.do',    'Ca chiều', 3, 0 UNION ALL
  SELECT 'quynh.ly',   'Ca tối',   4, 0 UNION ALL
  SELECT 'binh.vu',    'Ca gãy',   5, 0 UNION ALL
  SELECT 'trang.phan', 'Ca chiều', 6, 1
)
SELECT s.id, u.id, w.work_date, m.id, TIMESTAMP(w.work_date - INTERVAL 3 DAY, '16:00')
FROM (
  -- Thứ Hai tuần trước + d ngày
  SELECT d, CURRENT_DATE - INTERVAL (WEEKDAY(CURRENT_DATE) + 7) DAY + INTERVAL d DAY AS work_date FROM days
) w
JOIN plan p ON (w.d + p.i) % 7 <> 6 AND (p.only_first_week = 0 OR w.d < 7)
JOIN users u ON u.username = p.username
JOIN shifts s ON s.name = p.shift_name
JOIN users m ON m.username = 'tuan.nguyen'
ORDER BY w.work_date, u.id, s.start_time;
