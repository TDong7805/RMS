/* =====================================================================
   V12_1 — DỮ LIỆU MẪU chấm công / bảng lương (chỉ môi trường dev, [FAKE-DATA])

   - Chấm công từ ngày 1 tháng trước đến hôm qua cho nhân viên đang hoạt động (trừ Quản lý nhà hàng):
     mỗi người nghỉ khoảng 1 ngày / tuần, ca sáng 07:30–15:30 hoặc ca tối 15:00–23:00 (lệch vài phút),
     nguồn "Excel" (mô phỏng file từ máy chấm công).
   - 2 dòng "Thiếu giờ ra" trong tháng này (để thấy cảnh báo khi chốt lương).
   - Kỳ lương tháng trước ĐÃ CHỐT (tính từ chấm công ở trên, phụ cấp mẫu cho 1 người).
   Mô phỏng: Thu ngân (nhập chấm công, chốt lương tháng trước).
   ===================================================================== */

SET @linh = (SELECT id FROM users WHERE username = 'linh.tran');
SET @m1 = DATE_FORMAT(CURDATE() - INTERVAL 1 MONTH, '%Y-%m-01');
SET @m1_end = LAST_DAY(@m1);

INSERT INTO attendances (user_id, work_date, check_in, check_out, note, source, created_by, created_at)
SELECT u.id, d.day,
       TIMESTAMP(d.day, IF((u.id + DAYOFYEAR(d.day)) % 2 = 0, '07:30', '15:00')) + INTERVAL (CAST((u.id * 7 + DAYOFYEAR(d.day) * 3) % 11 AS SIGNED) - 5) MINUTE,
       TIMESTAMP(d.day, IF((u.id + DAYOFYEAR(d.day)) % 2 = 0, '15:30', '23:00')) + INTERVAL (CAST((u.id * 5 + DAYOFYEAR(d.day) * 7) % 13 AS SIGNED) - 3) MINUTE,
       NULL, 'excel', @linh, TIMESTAMP(d.day + INTERVAL 1 DAY, '09:00')
FROM (
  WITH RECURSIVE days AS (SELECT CAST(@m1 AS DATE) AS day UNION ALL SELECT day + INTERVAL 1 DAY FROM days WHERE day < CURDATE() - INTERVAL 1 DAY)
  SELECT day FROM days
) d
JOIN users u ON u.deleted_at IS NULL AND u.status = 'active'
JOIN roles r ON r.id = u.role_id AND r.code <> 'manager'
WHERE (DAYOFYEAR(d.day) + u.id * 3) % 7 <> 0;

-- Hai dòng quên chấm ra trong tháng này (nếu tháng này đã có ngày làm).
UPDATE attendances a
JOIN (SELECT id FROM attendances WHERE work_date >= DATE_FORMAT(CURDATE(), '%Y-%m-01') ORDER BY work_date DESC, id LIMIT 2) x ON x.id = a.id
SET a.check_out = NULL, a.note = 'Quên chấm ra';

/* ---------------------------------------------------------------- Kỳ lương tháng trước (đã chốt) */
INSERT INTO payroll_periods (name, start_date, end_date, status, created_by, created_at, closed_by, closed_at)
VALUES (CONCAT('Tháng ', DATE_FORMAT(@m1, '%m/%Y')), @m1, @m1_end, 'closed', @linh, @m1_end + INTERVAL 1 DAY,
        @linh, TIMESTAMP(@m1_end + INTERVAL 2 DAY, '10:00'));
SET @pp = LAST_INSERT_ID();

INSERT INTO payrolls (period_id, user_id, role_name, worked_hours, hourly_rate, base_salary, allowance, deduction, total_amount,
                      note, calculated_by, calculated_at)
SELECT @pp, u.id, r.name, x.hours, u.hourly_rate, u.base_salary,
       IF(u.username = 'linh.tran', 300000, 0), 0,
       ROUND(x.hours * u.hourly_rate) + u.base_salary + IF(u.username = 'linh.tran', 300000, 0),
       IF(u.username = 'linh.tran', 'Phụ cấp trách nhiệm thu ngân', NULL), @linh, TIMESTAMP(@m1_end + INTERVAL 2 DAY, '09:30')
FROM users u JOIN roles r ON r.id = u.role_id
JOIN (SELECT user_id, ROUND(SUM(TIMESTAMPDIFF(MINUTE, check_in, check_out)) / 60, 2) AS hours
      FROM attendances WHERE work_date BETWEEN @m1 AND @m1_end AND check_out IS NOT NULL GROUP BY user_id) x ON x.user_id = u.id;
