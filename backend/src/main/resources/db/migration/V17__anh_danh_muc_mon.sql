-- Ảnh minh họa cho danh mục món (dải danh mục cong ở trang khách gọi món qua QR).
-- Ảnh món tách nền, Quản lý tải lên ở "Danh mục món"; để trống thì trang khách hiện chữ cái đầu của tên danh mục.
ALTER TABLE dish_categories ADD COLUMN image_url VARCHAR(255) NULL AFTER sort_order;
