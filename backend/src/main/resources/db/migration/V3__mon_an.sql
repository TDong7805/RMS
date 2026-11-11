/* =====================================================================
   V3 — Quản lý món ăn (UC-MON-01)

   Cấu trúc bảng món đã có từ V1 (dishes, dish_categories, dish_allergens, dish_ai_tags, combos...).
   File này chỉ bổ sung dữ liệu nền:
     - Thẻ AI "Theo mùa" cho món chỉ phục vụ theo mùa.

   Ghi chú về ảnh món (dishes.image_url): cột lưu KHÓA của ảnh trong kho lưu trữ, ví dụ
   "dishes/3f2a9c....jpg" — không lưu đường dẫn đầy đủ. Backend ghép thành địa chỉ xem ảnh theo cấu hình
   (com.rms.storage.StorageService), nên đổi nơi lưu ảnh (thư mục máy chủ → S3/R2) không phải sửa dữ liệu.
   ===================================================================== */

INSERT INTO ai_tags (name)
SELECT 'Theo mùa' FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM ai_tags WHERE name = 'Theo mùa');
