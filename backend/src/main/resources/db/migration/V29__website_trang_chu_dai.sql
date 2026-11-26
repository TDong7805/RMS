/* =====================================================================
   V29 — Website khách hàng kiểu trang chủ dài một trang (E1, 27/11/2026).

   Quản lý nhập ở Cấu hình hệ thống → Website. Để trống mục nào thì website ẩn mục đó.
   (Không viết dấu sao đôi sau dấu gạch chéo trong chú thích: Flyway hiểu là mở chú thích lồng và bỏ qua cả file.)
   - website_content thêm: lời bếp trưởng (tên, chức danh, ảnh, lá thư) và ảnh cạnh form đặt bàn.
   - website_features: các mục do Quản lý tự nhập, chia hai loại:
       signature  = "Món đặc trưng" (ảnh toàn khổ tự trượt; chưa có dòng nào thì website dùng món bán chạy),
       experience = "Trải nghiệm" (tiệc sinh nhật, tiếp khách…; set menu do website tự lấy từ thực đơn).
   ===================================================================== */

ALTER TABLE website_content
  ADD COLUMN chef_name         VARCHAR(80)   NULL AFTER map_url,
  ADD COLUMN chef_title        VARCHAR(80)   NULL AFTER chef_name,   -- vd. "Bếp trưởng"
  ADD COLUMN chef_letter       TEXT          NULL AFTER chef_title,  -- tối đa 2000 ký tự; xuống dòng = sang đoạn mới
  ADD COLUMN chef_image_url    VARCHAR(255)  NULL AFTER chef_letter,
  ADD COLUMN reserve_image_url VARCHAR(255)  NULL AFTER chef_image_url;

CREATE TABLE website_features (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  kind        VARCHAR(20)  NOT NULL,                 -- signature | experience
  title       VARCHAR(80)  NOT NULL,
  subtitle    VARCHAR(120) NULL,                     -- dòng nhỏ phía trên tiêu đề (vd. "Bò Nhật A5 Kagoshima")
  description VARCHAR(500) NULL,
  image_url   VARCHAR(255) NULL,
  sort_order  SMALLINT     NOT NULL DEFAULT 0,
  is_visible  TINYINT(1)   NOT NULL DEFAULT 1,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by  BIGINT UNSIGNED NULL,
  CONSTRAINT chk_wf_kind CHECK (kind IN ('signature', 'experience')),
  CONSTRAINT fk_wf_user FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX ix_wf_kind (kind, is_visible, sort_order)
) ENGINE=InnoDB COMMENT='Món đặc trưng và trải nghiệm trên trang chủ website.';
