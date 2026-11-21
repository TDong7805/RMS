/* =====================================================================
   V24 — Website khách hàng (trang công khai, không đăng nhập).

   Quản lý nhà hàng cấu hình ở Cấu hình hệ thống → tab "Website khách hàng"; website đọc qua các API /api/public/site.
   (Không viết dấu sao đôi sau dấu gạch chéo trong chú thích: Flyway hiểu là mở chú thích lồng và bỏ qua cả file.)
   - website_content (1 dòng): slogan, danh hiệu, ảnh banner, phần "Về chúng tôi", mạng xã hội, bản đồ.
     Tên, logo, SĐT, email, địa chỉ vẫn lấy từ restaurant_info; giờ mở cửa từ opening_hours (không lặp dữ liệu).
   - gallery_photos: album ảnh nhà hàng (ảnh lưu KHÓA như ảnh món — xem ImageStore).
   - show_on_website của món / danh mục: ẩn khỏi website mà không phải ngừng bán (trang gọi món QR không đổi).
   - doc_sequences 'DB': bộ đếm mã lịch đặt bàn DB-xxxx cho lịch khách tự đặt, nối tiếp mã đã có.
   ===================================================================== */

CREATE TABLE website_content (
  id               TINYINT UNSIGNED NOT NULL DEFAULT 1 PRIMARY KEY,
  slogan           VARCHAR(200)  NULL,
  award            VARCHAR(100)  NULL,                -- danh hiệu / giải thưởng hiện ở banner, vd. "Michelin Selected"
  hero_image_url   VARCHAR(255)  NULL,                -- NULL = dùng ảnh bìa (restaurant_info.cover_image_url)
  about_title      VARCHAR(150)  NULL,
  about_content    TEXT          NULL,                -- tối đa 5000 ký tự (kiểm ở ứng dụng); xuống dòng = sang đoạn mới
  about_highlights VARCHAR(1000) NULL,                -- mỗi dòng một điểm nhấn
  about_image_url  VARCHAR(255)  NULL,
  facebook_url     VARCHAR(200)  NULL,
  instagram_url    VARCHAR(200)  NULL,
  tiktok_url       VARCHAR(200)  NULL,
  youtube_url      VARCHAR(200)  NULL,
  zalo_phone       VARCHAR(15)   NULL,
  map_url          VARCHAR(500)  NULL,                -- link Google Maps (mở tab mới / nhúng bản đồ)
  updated_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  updated_by       BIGINT UNSIGNED NULL,
  CONSTRAINT chk_wc_single CHECK (id = 1),
  CONSTRAINT fk_wc_user FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB COMMENT='Nội dung website khách hàng (1 dòng).';

INSERT INTO website_content (id) VALUES (1);

CREATE TABLE gallery_photos (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  image_url   VARCHAR(255) NOT NULL,
  caption     VARCHAR(150) NULL,
  sort_order  SMALLINT     NOT NULL DEFAULT 0,
  is_visible  TINYINT(1)   NOT NULL DEFAULT 1,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by  BIGINT UNSIGNED NULL,
  CONSTRAINT fk_gallery_user FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX ix_gallery_order (is_visible, sort_order)
) ENGINE=InnoDB COMMENT='Album ảnh trên website khách hàng.';

ALTER TABLE dishes
  ADD COLUMN show_on_website TINYINT(1) NOT NULL DEFAULT 1 AFTER ai_enabled;

ALTER TABLE dish_categories
  ADD COLUMN show_on_website TINYINT(1) NOT NULL DEFAULT 1 AFTER is_active;

-- Mã lịch đặt bàn: tiếp nối số lớn nhất đang có (dev có lịch mẫu DB-1xxx); CSDL trống bắt đầu từ DB-1001.
INSERT INTO doc_sequences (seq_key, last_no)
SELECT 'DB', COALESCE(MAX(CAST(SUBSTRING(code, 4) AS UNSIGNED)), 1000)
FROM reservations WHERE code REGEXP '^DB-[0-9]+$';
