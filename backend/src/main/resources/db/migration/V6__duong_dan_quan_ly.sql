/* =====================================================================
   V6 — Trang quản lý chuyển sang /quan-ly/...

   "/" và các đường dẫn ngắn (/thuc-don, /tin-tuc, /dat-ban) để dành cho website khách hàng; trang của
   Quản lý nhà hàng gom dưới /quan-ly (frontend: lib/paths.ts, backend: com.rms.auth.StaffAreas).
   notification_types.target_route lưu đường dẫn trang mở ra khi bấm thông báo → cập nhật theo.
   ===================================================================== */

UPDATE notification_types
SET target_route = CONCAT('/quan-ly', target_route)
WHERE target_route LIKE '/%' AND target_route NOT LIKE '/quan-ly%';
