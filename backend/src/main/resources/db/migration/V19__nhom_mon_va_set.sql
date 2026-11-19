/* =====================================================================
   V19 — Nhóm món (gộp nhiều loại thành một thẻ trên thực đơn) và Set menu.

   Nhóm món: vd. "Nước ngọt có ga" gồm Coca-Cola, Sprite… Mỗi loại VẪN LÀ MỘT MÓN RIÊNG (mã, giá, công thức,
   tồn kho riêng) — nhóm chỉ để hiển thị: trang gọi món hiện một thẻ, bấm vào chọn loại.

   Set menu: mở rộng bảng combos (trước chỉ để Chatbot gợi ý) thành set bán trên thực đơn với giá trọn gói.
   Khi khách gọi set: đơn có 1 dòng order_sets (tên + giá set, bản chụp) và các dòng order_items của món con
   (bếp làm từng món như thường). Giá set được chia cho món con theo tỉ lệ giá gốc, ghi vào order_items.unit_price,
   nên tổng tiền đơn / hóa đơn vẫn = Σ số lượng × đơn giá như cũ; hủy một món con thì tự trừ phần giá của món đó.
   ===================================================================== */

CREATE TABLE dish_groups (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(80)  NOT NULL,
  category_id   BIGINT UNSIGNED NOT NULL,
  description   VARCHAR(500) NULL,
  image_url     VARCHAR(255) NULL,
  sort_order    SMALLINT NOT NULL DEFAULT 0,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT uq_dgroup_name_in_cat UNIQUE (category_id, name),
  CONSTRAINT fk_dgroup_cat FOREIGN KEY (category_id) REFERENCES dish_categories(id) ON DELETE RESTRICT
) ENGINE=InnoDB COMMENT='Nhóm hiển thị nhiều món cùng loại thành một thẻ (vd. Nước ngọt có ga).';

ALTER TABLE dishes
  ADD COLUMN group_id      BIGINT UNSIGNED NULL AFTER category_id,
  ADD COLUMN variant_label VARCHAR(40) NULL AFTER group_id,       -- tên loại hiện ở khung chọn, vd. "Coca-Cola", "Ly 150ml"
  ADD CONSTRAINT fk_dishes_group FOREIGN KEY (group_id) REFERENCES dish_groups(id) ON DELETE SET NULL;

ALTER TABLE combos
  ADD COLUMN description VARCHAR(500) NULL AFTER name,            -- mô tả cho khách
  ADD COLUMN price       DECIMAL(14,2) NULL AFTER description,    -- giá set; NULL = chỉ là gợi ý của Chatbot
  ADD COLUMN image_url   VARCHAR(255) NULL AFTER price,
  ADD COLUMN on_menu     TINYINT(1) NOT NULL DEFAULT 0 AFTER is_active,   -- hiện trên thực đơn cho khách gọi
  ADD COLUMN sell_from   TIME NULL AFTER on_menu,                 -- giờ bán (NULL = cả ngày), vd. set trưa 10:30–14:00
  ADD COLUMN sell_to     TIME NULL AFTER sell_from,
  ADD COLUMN sort_order  SMALLINT NOT NULL DEFAULT 0 AFTER sell_to,
  ADD COLUMN updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  ADD CONSTRAINT chk_combos_price CHECK (price IS NULL OR price >= 0),
  ADD CONSTRAINT chk_combos_menu CHECK (on_menu = 0 OR price IS NOT NULL),
  ADD CONSTRAINT chk_combos_time CHECK ((sell_from IS NULL) = (sell_to IS NULL));

ALTER TABLE combo_items
  ADD COLUMN allow_variant TINYINT(1) NOT NULL DEFAULT 0 AFTER quantity,   -- khách được đổi sang loại khác cùng nhóm (vd. nước ngọt)
  ADD COLUMN sort_order    SMALLINT NOT NULL DEFAULT 0 AFTER allow_variant;

CREATE TABLE order_sets (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  order_id      BIGINT UNSIGNED NOT NULL,
  combo_id      BIGINT UNSIGNED NULL,
  set_name      VARCHAR(100)  NOT NULL,                 -- bản chụp
  set_price     DECIMAL(14,2) NOT NULL,                 -- bản chụp: giá set lúc gọi (mỗi dòng là 1 set)
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_os_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  CONSTRAINT fk_os_combo FOREIGN KEY (combo_id) REFERENCES combos(id) ON DELETE SET NULL,
  CONSTRAINT chk_os_price CHECK (set_price >= 0),
  INDEX ix_os_order (order_id)
) ENGINE=InnoDB COMMENT='Mỗi set khách gọi; món con nằm ở order_items.order_set_id.';

ALTER TABLE order_items
  ADD COLUMN order_set_id BIGINT UNSIGNED NULL AFTER order_id,
  ADD CONSTRAINT fk_oi_set FOREIGN KEY (order_set_id) REFERENCES order_sets(id) ON DELETE CASCADE;
