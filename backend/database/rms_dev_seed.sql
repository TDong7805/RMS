/* =====================================================================
   DỮ LIỆU MẪU ĐỂ PHÁT TRIỂN & DEMO (KHÔNG dùng cho môi trường thật)

   Mục đích: mô phỏng dữ liệu mà các actor CHƯA được xây dựng sẽ tạo ra, để màn hình
   Quản lý nhà hàng có dữ liệu thật trong CSDL mà xem/sửa:
     - Lịch đặt bàn  → sau này do Khách hàng đặt qua website / Thu ngân nhập tại quầy
   Khi các phân hệ đó hoàn thành, dữ liệu sẽ tự sinh qua API, không cần file này.

   Chạy SAU rms_schema.sql (trên database vừa tạo mới):
     mysql -u root -p --default-character-set=utf8mb4 -e "source backend/database/rms_dev_seed.sql"
   Ngày giờ tính tương đối theo hôm nay, nên chạy lại schema + seed bất cứ lúc nào vẫn có
   lịch "hôm nay", "ngày mai"...
   ===================================================================== */

USE rms_db;
SET NAMES utf8mb4;
SET time_zone = '+07:00';

/* ---------------------------------------------------------------- Đặt bàn */
-- d = số ngày lệch so với hôm nay; tbl = mã bàn (NULL = chưa xếp bàn, khi đó dùng khu vực `area`).
INSERT INTO reservations (code, customer_name, phone, guests, reserved_at, area_id, table_id, note, status, source, created_at)
SELECT r.code, r.name, r.phone, r.guests,
       TIMESTAMP(CURRENT_DATE + INTERVAL r.d DAY, r.t),
       COALESCE(t.area_id, a.id), t.id, NULLIF(r.note, ''), r.status, r.source,
       TIMESTAMP(CURRENT_DATE + INTERVAL r.d DAY, r.t) - INTERVAL r.lead_days DAY
FROM (
  SELECT 'DB-1090' code, -6 d, '18:30' t, 'T06' tbl, 'Tầng 1' area, 6 guests, 'Nguyễn Thu Hà' name, '0903456781' phone, '' note, 'completed' status, 'website' source, 2 lead_days UNION ALL
  SELECT 'DB-1091', -5, '19:00', 'VIP01', 'Phòng VIP', 8, 'Trần Minh Quân', '0912345678', 'Sinh nhật, cần chuẩn bị bánh kem', 'completed', 'phone', 3 UNION ALL
  SELECT 'DB-1092', -4, '12:00', 'T03', 'Tầng 1', 3, 'Lê Hoàng Nam', '0987654321', 'Có trẻ nhỏ, xin ghế em bé', 'cancelled', 'website', 4 UNION ALL
  SELECT 'DB-1093', -3, '19:30', 'SV01', 'Sân vườn', 4, 'Phạm Diễm My', '0938123456', '', 'completed', 'walk_in', 5 UNION ALL
  SELECT 'DB-1094', -3, '20:00', 'SV02', 'Sân vườn', 7, 'Võ Thành Công', '0977001122', 'Khách dị ứng đậu phộng', 'no_show', 'website', 2 UNION ALL
  SELECT 'DB-1095', -2, '11:30', 'T01', 'Tầng 1', 2, 'Đặng Bảo Ngọc', '0356789012', 'Muốn ngồi gần cửa sổ', 'completed', 'phone', 3 UNION ALL
  SELECT 'DB-1096', -2, '18:00', 'VIP02', 'Phòng VIP', 10, 'Huỳnh Gia Hân', '0868111222', 'Tiệc công ty, xuất hóa đơn VAT', 'completed', 'website', 4 UNION ALL
  SELECT 'DB-1097', -1, '19:00', 'T06', 'Tầng 1', 5, 'Bùi Đức Anh', '0702334455', '', 'completed', 'walk_in', 5 UNION ALL
  SELECT 'DB-1098', -1, '12:30', 'L2-01', 'Tầng 2', 4, 'Ngô Quỳnh Như', '0829456123', '', 'cancelled', 'website', 2 UNION ALL
  SELECT 'DB-1099', 0, '11:00', 'T04', 'Tầng 1', 4, 'Hoàng Văn Lợi', '0945667788', '', 'seated', 'phone', 3 UNION ALL
  SELECT 'DB-1100', 0, '12:00', 'SV01', 'Sân vườn', 4, 'Phan Mỹ Duyên', '0389001234', 'Sinh nhật, cần chuẩn bị bánh kem', 'confirmed', 'phone', 4 UNION ALL
  SELECT 'DB-1101', 0, '18:30', 'T06', 'Tầng 1', 6, 'Trương Khải', '0919223344', '', 'pending', 'walk_in', 1 UNION ALL
  SELECT 'DB-1102', 0, '19:30', 'SV02', 'Sân vườn', 6, 'Nguyễn Thu Hà', '0903456781', 'Có trẻ nhỏ, xin ghế em bé', 'pending', 'website', 1 UNION ALL
  SELECT 'DB-1103', 0, '20:00', 'T02', 'Tầng 1', 2, 'Trần Minh Quân', '0912345678', '', 'confirmed', 'phone', 2 UNION ALL
  SELECT 'DB-1104', 0, '19:00', 'VIP01', 'Phòng VIP', 8, 'Lê Hoàng Nam', '0987654321', '', 'pending', 'website', 1 UNION ALL
  SELECT 'DB-1105', 1, '18:00', 'T03', 'Tầng 1', 4, 'Phạm Diễm My', '0938123456', '', 'confirmed', 'website', 3 UNION ALL
  SELECT 'DB-1106', 1, '19:00', 'L2-02', 'Tầng 2', 5, 'Võ Thành Công', '0977001122', 'Khách dị ứng đậu phộng', 'confirmed', 'phone', 2 UNION ALL
  SELECT 'DB-1107', 1, '12:00', 'L2-01', 'Tầng 2', 3, 'Đặng Bảo Ngọc', '0356789012', '', 'pending', 'website', 1 UNION ALL
  SELECT 'DB-1108', 2, '18:30', 'VIP02', 'Phòng VIP', 12, 'Huỳnh Gia Hân', '0868111222', 'Tiệc công ty, xuất hóa đơn VAT', 'confirmed', 'website', 5 UNION ALL
  SELECT 'DB-1109', 2, '19:30', 'SV01', 'Sân vườn', 3, 'Bùi Đức Anh', '0702334455', '', 'pending', 'walk_in', 1 UNION ALL
  SELECT 'DB-1110', 3, '11:30', 'T05', 'Tầng 1', 4, 'Ngô Quỳnh Như', '0829456123', '', 'confirmed', 'website', 2 UNION ALL
  SELECT 'DB-1111', 3, '20:00', 'SV02', 'Sân vườn', 6, 'Hoàng Văn Lợi', '0945667788', 'Muốn ngồi gần cửa sổ', 'cancelled', 'phone', 3 UNION ALL
  SELECT 'DB-1112', 4, '18:00', 'L2-02', 'Tầng 2', 9, 'Phan Mỹ Duyên', '0389001234', '', 'confirmed', 'website', 4 UNION ALL
  SELECT 'DB-1113', 5, '19:00', 'T06', 'Tầng 1', 6, 'Trương Khải', '0919223344', '', 'pending', 'website', 2 UNION ALL
  SELECT 'DB-1114', 6, '12:00', 'T01', 'Tầng 1', 2, 'Nguyễn Thu Hà', '0903456781', '', 'confirmed', 'phone', 3 UNION ALL
  SELECT 'DB-1115', 7, '18:30', NULL, 'Sân vườn', 2, 'Trần Minh Quân', '0912345678', 'Khách chưa chọn bàn cụ thể', 'pending', 'website', 1
) r
LEFT JOIN dining_tables t ON t.code = r.tbl
JOIN areas a ON a.name = r.area
ORDER BY r.code;
