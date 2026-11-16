/* =====================================================================
   V13 — Ảnh bìa trang đặt món của khách (QR): ảnh lớn đầu trang (mặt tiền / không gian quán).
   Quản lý nhà hàng tải lên ở Cấu hình hệ thống → Thông tin nhà hàng; lưu khóa ảnh như ảnh món (ImageStore).
   ===================================================================== */

ALTER TABLE restaurant_info
  ADD COLUMN cover_image_url VARCHAR(500) NULL AFTER logo_url;
