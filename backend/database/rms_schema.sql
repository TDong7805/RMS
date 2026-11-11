/* =====================================================================
   HỆ THỐNG QUẢN LÝ VÀ VẬN HÀNH NHÀ HÀNG (RMS) — CƠ SỞ DỮ LIỆU CHUNG
   Hệ quản trị : MySQL 8.0.16+ (cần CHECK constraint)
   Bảng mã     : utf8mb4 / utf8mb4_unicode_ci (hỗ trợ đầy đủ tiếng Việt, emoji)

   Phạm vi: đủ cho 6 Actor theo UC Diagram tổng thể
     1. Quản trị viên      2. Khách hàng        3. Quản lý nhà hàng
     4. Thu ngân           5. Nhân viên bếp     6. Quản lý kho
   (+ Nhân viên phục vụ nhận yêu cầu do Thu ngân chuyển tiếp)

   Nguyên tắc thiết kế để mở rộng không lỗi:
     - Phân quyền bằng dữ liệu (roles / permissions / role_permissions):
       thêm actor hay quyền mới chỉ cần INSERT, không ALTER bảng.
     - Mọi khóa chính BIGINT UNSIGNED → khóa ngoại luôn cùng kiểu, không lệch.
     - Trạng thái dùng VARCHAR + CHECK có đặt tên (chk_...) → muốn thêm
       trạng thái chỉ cần DROP CHECK rồi ADD CHECK mới.
     - Bảng giao dịch lưu "bản chụp" (tên món, đơn giá, tên người thao tác)
       → đổi giá/xóa tài khoản không làm sai lịch sử.
     - ON DELETE RESTRICT cho dữ liệu có lịch sử (món đã bán, ca đã phân công,
       bàn có lịch đặt...). ON DELETE CASCADE chỉ cho bảng con thuần túy.
     - Bảng cấu hình một dòng (id = 1) cho thông tin nhà hàng, form đặt bàn,
       chatbot, cấu hình AI, lịch sao lưu.

   Cách chạy:   mysql -u root -p < backend/database/rms_schema.sql
   CẢNH BÁO:    Script XÓA và tạo lại database `rms_db`. Đổi tên ở 3 dòng
                dưới nếu máy bạn đã có database trùng tên.
   ===================================================================== */

DROP DATABASE IF EXISTS rms_db;
CREATE DATABASE rms_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE rms_db;

SET NAMES utf8mb4;
SET time_zone = '+07:00';

/* =====================================================================
   PHẦN 1. PHÂN QUYỀN & TÀI KHOẢN  (Quản trị viên, Quản lý nhà hàng)
   ===================================================================== */

CREATE TABLE roles (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  code          VARCHAR(30)  NOT NULL,              -- admin, manager, cashier, ...
  name          VARCHAR(100) NOT NULL,
  description   VARCHAR(255) NULL,
  is_system     TINYINT(1)   NOT NULL DEFAULT 1,    -- vai trò gốc, không cho xóa trên giao diện
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_roles_code UNIQUE (code)
) ENGINE=InnoDB COMMENT='Vai trò (actor nội bộ). Thêm actor mới = INSERT một dòng.';

CREATE TABLE permissions (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  code          VARCHAR(60)  NOT NULL,              -- vd: reservation.manage
  module        VARCHAR(30)  NOT NULL,              -- trùng mã module của audit_logs
  name          VARCHAR(150) NOT NULL,
  CONSTRAINT uq_permissions_code UNIQUE (code)
) ENGINE=InnoDB COMMENT='Quyền chức năng chi tiết.';

CREATE TABLE role_permissions (
  role_id       BIGINT UNSIGNED NOT NULL,
  permission_id BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (role_id, permission_id),
  CONSTRAINT fk_rp_role FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
  CONSTRAINT fk_rp_perm FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE users (
  id                    BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  username              VARCHAR(30)  NOT NULL,
  password_hash         VARCHAR(255) NOT NULL,      -- bcrypt/argon2, KHÔNG lưu mật khẩu thô
  full_name             VARCHAR(100) NOT NULL,
  email                 VARCHAR(150) NOT NULL,
  phone                 VARCHAR(15)  NULL,
  role_id               BIGINT UNSIGNED NOT NULL,
  status                VARCHAR(10)  NOT NULL DEFAULT 'active',
  must_change_password  TINYINT(1)   NOT NULL DEFAULT 1,   -- bật sau khi tạo/đặt lại mật khẩu
  hourly_rate           DECIMAL(14,2) NOT NULL DEFAULT 0,  -- dùng cho tính lương
  base_salary           DECIMAL(14,2) NOT NULL DEFAULT 0,
  avatar_url            VARCHAR(500) NULL,
  last_login_at         DATETIME     NULL,
  created_at            DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at            DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at            DATETIME     NULL,          -- xóa mềm: giữ lịch sử ca làm, hóa đơn, nhật ký
  CONSTRAINT uq_users_username UNIQUE (username),
  CONSTRAINT uq_users_email UNIQUE (email),
  CONSTRAINT fk_users_role FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE RESTRICT,
  CONSTRAINT chk_users_status CHECK (status IN ('active','locked')),
  CONSTRAINT chk_users_money CHECK (hourly_rate >= 0 AND base_salary >= 0)
) ENGINE=InnoDB COMMENT='Tài khoản nhân sự (mọi actor nội bộ).';

CREATE TABLE customers (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  full_name     VARCHAR(100) NOT NULL,
  phone         VARCHAR(15)  NULL,
  email         VARCHAR(150) NULL,
  password_hash VARCHAR(255) NULL,                  -- NULL = khách vãng lai (QR/đặt bàn không cần tài khoản)
  note          VARCHAR(500) NULL,
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT uq_customers_phone UNIQUE (phone)      -- nhiều NULL vẫn hợp lệ
) ENGINE=InnoDB COMMENT='Actor Khách hàng — tách khỏi users vì không đăng nhập trang quản lý.';

/* =====================================================================
   PHẦN 2. CẤU HÌNH HỆ THỐNG  (UC Cấu hình hệ thống, Quản trị viên)
   ===================================================================== */

CREATE TABLE restaurant_info (
  id            TINYINT UNSIGNED NOT NULL DEFAULT 1 PRIMARY KEY,
  name          VARCHAR(150) NOT NULL,
  legal_name    VARCHAR(200) NULL,
  tax_code      VARCHAR(14)  NULL,
  logo_url      VARCHAR(500) NULL,
  phone         VARCHAR(15)  NOT NULL,
  email         VARCHAR(150) NOT NULL,
  address       VARCHAR(300) NOT NULL,
  website       VARCHAR(200) NULL,
  updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  updated_by    BIGINT UNSIGNED NULL,
  CONSTRAINT chk_restaurant_single CHECK (id = 1),
  CONSTRAINT fk_restaurant_user FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB COMMENT='Thông tin định danh nhà hàng (1 dòng). Mở rộng chi nhánh: thêm bảng branches.';

CREATE TABLE opening_hours (
  day_of_week   TINYINT UNSIGNED NOT NULL PRIMARY KEY,   -- 0 = Chủ nhật ... 6 = Thứ bảy
  is_open       TINYINT(1) NOT NULL DEFAULT 1,
  open_time     TIME NOT NULL,
  close_time    TIME NOT NULL,
  CONSTRAINT chk_oh_day CHECK (day_of_week BETWEEN 0 AND 6),
  CONSTRAINT chk_oh_time CHECK (is_open = 0 OR close_time > open_time)
) ENGINE=InnoDB COMMENT='Giờ hoạt động — dùng kiểm tra giờ đặt bàn hợp lệ.';

CREATE TABLE reservation_form_config (
  id                 TINYINT UNSIGNED NOT NULL DEFAULT 1 PRIMARY KEY,
  slot_minutes       SMALLINT UNSIGNED NOT NULL DEFAULT 30,
  duration_minutes   SMALLINT UNSIGNED NOT NULL DEFAULT 120,
  min_guests         SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  max_guests         SMALLINT UNSIGNED NOT NULL DEFAULT 20,
  lead_time_minutes  SMALLINT UNSIGNED NOT NULL DEFAULT 60,
  max_days_ahead     SMALLINT UNSIGNED NOT NULL DEFAULT 30,
  require_email      TINYINT(1) NOT NULL DEFAULT 0,
  allow_area_choice  TINYINT(1) NOT NULL DEFAULT 1,
  allow_note         TINYINT(1) NOT NULL DEFAULT 1,
  auto_confirm       TINYINT(1) NOT NULL DEFAULT 0,
  notice             VARCHAR(500) NULL,
  updated_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  updated_by         BIGINT UNSIGNED NULL,
  CONSTRAINT chk_rfc_single CHECK (id = 1),
  CONSTRAINT chk_rfc_slot CHECK (slot_minutes IN (15,30,60)),
  CONSTRAINT chk_rfc_duration CHECK (duration_minutes BETWEEN 30 AND 360),
  CONSTRAINT chk_rfc_guests CHECK (min_guests >= 1 AND max_guests >= min_guests AND max_guests <= 50),
  CONSTRAINT chk_rfc_days CHECK (max_days_ahead BETWEEN 1 AND 180 AND lead_time_minutes <= 1440),
  CONSTRAINT fk_rfc_user FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB COMMENT='Cấu hình form đặt bàn của khách (1 dòng).';

CREATE TABLE system_settings (
  setting_key   VARCHAR(100) NOT NULL PRIMARY KEY,  -- vd: notification.retention_days
  setting_value TEXT NULL,
  value_type    VARCHAR(10)  NOT NULL DEFAULT 'string',
  description   VARCHAR(255) NULL,
  updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  updated_by    BIGINT UNSIGNED NULL,
  CONSTRAINT chk_ss_type CHECK (value_type IN ('string','number','boolean','json')),
  CONSTRAINT fk_ss_user FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB COMMENT='Thiết lập dạng khóa–giá trị: thêm thiết lập mới không cần ALTER.';

CREATE TABLE backup_schedule (
  id            TINYINT UNSIGNED NOT NULL DEFAULT 1 PRIMARY KEY,
  enabled       TINYINT(1) NOT NULL DEFAULT 1,
  frequency     VARCHAR(10) NOT NULL DEFAULT 'daily',
  weekday       TINYINT UNSIGNED NOT NULL DEFAULT 1,
  run_time      TIME NOT NULL DEFAULT '02:00:00',
  keep_count    SMALLINT UNSIGNED NOT NULL DEFAULT 7,
  CONSTRAINT chk_bs_single CHECK (id = 1),
  CONSTRAINT chk_bs_freq CHECK (frequency IN ('daily','weekly')),
  CONSTRAINT chk_bs_values CHECK (weekday BETWEEN 0 AND 6 AND keep_count BETWEEN 1 AND 60)
) ENGINE=InnoDB;

CREATE TABLE backup_files (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  file_name     VARCHAR(200) NOT NULL,
  file_path     VARCHAR(500) NOT NULL,
  size_kb       INT UNSIGNED NOT NULL DEFAULT 0,
  kind          VARCHAR(10)  NOT NULL DEFAULT 'auto',
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by    BIGINT UNSIGNED NULL,
  CONSTRAINT uq_backup_name UNIQUE (file_name),
  CONSTRAINT chk_bf_kind CHECK (kind IN ('auto','manual')),
  CONSTRAINT fk_bf_user FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE audit_logs (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id         BIGINT UNSIGNED NULL,
  actor_name      VARCHAR(100) NOT NULL,            -- bản chụp, giữ được khi tài khoản bị xóa
  actor_username  VARCHAR(30)  NOT NULL,
  module          VARCHAR(30)  NOT NULL,            -- auth, reservation, table, dish, account, shift, post,
                                                    -- chatbot, settings, order, kitchen, invoice, inventory, payroll ...
  action          VARCHAR(100) NOT NULL,
  detail          VARCHAR(1000) NULL,
  ref_table       VARCHAR(50)  NULL,                -- bảng bị tác động (tra ngược)
  ref_id          BIGINT UNSIGNED NULL,
  ip_address      VARCHAR(45)  NULL,                -- đủ cho IPv6
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX ix_audit_time (created_at),
  INDEX ix_audit_module (module, created_at),
  INDEX ix_audit_user (user_id, created_at),
  CONSTRAINT fk_audit_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB COMMENT='Nhật ký hoạt động. module không ràng buộc CHECK để phân hệ mới ghi log tự do.';

/* =====================================================================
   PHẦN 3. KHU VỰC & BÀN  (Quản lý nhà hàng — chỉnh sửa sơ đồ bàn)
   ===================================================================== */

CREATE TABLE areas (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(50)  NOT NULL,
  description   VARCHAR(200) NULL,
  is_active     TINYINT(1)   NOT NULL DEFAULT 1,
  sort_order    SMALLINT     NOT NULL DEFAULT 0,
  CONSTRAINT uq_areas_name UNIQUE (name)
) ENGINE=InnoDB;

CREATE TABLE dining_tables (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  code          VARCHAR(10)  NOT NULL,
  area_id       BIGINT UNSIGNED NOT NULL,
  seats         TINYINT UNSIGNED NOT NULL,
  shape         VARCHAR(10)  NOT NULL DEFAULT 'square',
  pos_x         TINYINT UNSIGNED NOT NULL DEFAULT 0,   -- cột trên sơ đồ
  pos_y         TINYINT UNSIGNED NOT NULL DEFAULT 0,   -- hàng trên sơ đồ
  status        VARCHAR(10)  NOT NULL DEFAULT 'available',
  qr_token      CHAR(32)     NOT NULL,                 -- mã trong QR dán trên bàn (Khách hàng quét)
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_tables_code UNIQUE (code),
  CONSTRAINT uq_tables_qr UNIQUE (qr_token),
  CONSTRAINT uq_tables_cell UNIQUE (area_id, pos_x, pos_y),   -- một ô chỉ một bàn
  CONSTRAINT fk_tables_area FOREIGN KEY (area_id) REFERENCES areas(id) ON DELETE RESTRICT,
  CONSTRAINT chk_tables_seats CHECK (seats BETWEEN 1 AND 50),
  CONSTRAINT chk_tables_shape CHECK (shape IN ('square','round','rect')),
  CONSTRAINT chk_tables_status CHECK (status IN ('available','reserved','occupied','inactive'))
) ENGINE=InnoDB;

/* =====================================================================
   PHẦN 4. ĐẶT BÀN  (Khách hàng đặt — Quản lý nhà hàng quản lý)
   ===================================================================== */

CREATE TABLE reservations (
  id                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  code              VARCHAR(20)  NOT NULL,
  customer_id       BIGINT UNSIGNED NULL,
  customer_name     VARCHAR(80)  NOT NULL,          -- bản chụp thông tin khách lúc đặt
  phone             VARCHAR(15)  NOT NULL,
  email             VARCHAR(150) NULL,
  guests            SMALLINT UNSIGNED NOT NULL,
  reserved_at       DATETIME     NOT NULL,          -- thời điểm khách đến
  duration_minutes  SMALLINT UNSIGNED NOT NULL DEFAULT 120,
  area_id           BIGINT UNSIGNED NOT NULL,
  table_id          BIGINT UNSIGNED NULL,           -- NULL = chưa xếp bàn
  note              VARCHAR(300) NULL,
  status            VARCHAR(12)  NOT NULL DEFAULT 'pending',
  source            VARCHAR(10)  NOT NULL DEFAULT 'website',
  created_by        BIGINT UNSIGNED NULL,           -- NULL = khách tự đặt
  created_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT uq_res_code UNIQUE (code),
  CONSTRAINT fk_res_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL,
  CONSTRAINT fk_res_area FOREIGN KEY (area_id) REFERENCES areas(id) ON DELETE RESTRICT,
  CONSTRAINT fk_res_table FOREIGN KEY (table_id) REFERENCES dining_tables(id) ON DELETE RESTRICT,
  CONSTRAINT fk_res_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT chk_res_guests CHECK (guests > 0),
  CONSTRAINT chk_res_status CHECK (status IN ('pending','confirmed','seated','completed','cancelled','no_show')),
  CONSTRAINT chk_res_source CHECK (source IN ('website','phone','walk_in')),
  INDEX ix_res_time (reserved_at),
  INDEX ix_res_phone (phone),
  INDEX ix_res_table_time (table_id, reserved_at),
  INDEX ix_res_status (status, reserved_at)
) ENGINE=InnoDB COMMENT='Kiểm tra trùng lịch/sức chứa thực hiện ở tầng ứng dụng (loại trừ chính bản ghi đang sửa).';

/* =====================================================================
   PHẦN 5. THỰC ĐƠN  (Quản lý nhà hàng; Khách hàng xem; AI tư vấn đọc)
   ===================================================================== */

CREATE TABLE dish_categories (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(50) NOT NULL,
  is_active     TINYINT(1)  NOT NULL DEFAULT 1,
  sort_order    SMALLINT    NOT NULL DEFAULT 0,
  CONSTRAINT uq_dcat_name UNIQUE (name)
) ENGINE=InnoDB;

CREATE TABLE dishes (
  id                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  code              VARCHAR(10)  NOT NULL,          -- MA001 (hệ thống sinh, không cho sửa)
  name              VARCHAR(120) NOT NULL,
  category_id       BIGINT UNSIGNED NOT NULL,
  price             DECIMAL(14,2) NOT NULL,
  description       VARCHAR(500) NULL,
  image_url         VARCHAR(500) NULL,
  status            VARCHAR(10)  NOT NULL DEFAULT 'selling',
  ingredients_text  VARCHAR(500) NULL,              -- thành phần khai báo cho AI tư vấn
  spicy_level       TINYINT UNSIGNED NOT NULL DEFAULT 0,
  ai_enabled        TINYINT(1)   NOT NULL DEFAULT 1,
  created_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  status_updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_dishes_code UNIQUE (code),
  CONSTRAINT uq_dishes_name_in_cat UNIQUE (category_id, name),   -- chống trùng tên trong cùng danh mục
  CONSTRAINT fk_dishes_cat FOREIGN KEY (category_id) REFERENCES dish_categories(id) ON DELETE RESTRICT,
  CONSTRAINT chk_dishes_price CHECK (price >= 0),
  CONSTRAINT chk_dishes_status CHECK (status IN ('selling','stopped')),
  CONSTRAINT chk_dishes_spicy CHECK (spicy_level BETWEEN 0 AND 3),
  INDEX ix_dishes_status (status)
) ENGINE=InnoDB COMMENT='Món đã có trong order_items không xóa được (FK RESTRICT) → chuyển "stopped".';

CREATE TABLE allergens (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(60) NOT NULL,
  CONSTRAINT uq_allergens_name UNIQUE (name)
) ENGINE=InnoDB;

CREATE TABLE dish_allergens (
  dish_id       BIGINT UNSIGNED NOT NULL,
  allergen_id   BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (dish_id, allergen_id),
  CONSTRAINT fk_da_dish FOREIGN KEY (dish_id) REFERENCES dishes(id) ON DELETE CASCADE,
  CONSTRAINT fk_da_allergen FOREIGN KEY (allergen_id) REFERENCES allergens(id) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE ai_tags (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(40) NOT NULL,
  CONSTRAINT uq_ai_tags_name UNIQUE (name)
) ENGINE=InnoDB COMMENT='Thẻ phân loại cho Chatbot: Ít cay, Chay, Bán chạy...';

CREATE TABLE dish_ai_tags (
  dish_id       BIGINT UNSIGNED NOT NULL,
  tag_id        BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (dish_id, tag_id),
  CONSTRAINT fk_dat_dish FOREIGN KEY (dish_id) REFERENCES dishes(id) ON DELETE CASCADE,
  CONSTRAINT fk_dat_tag FOREIGN KEY (tag_id) REFERENCES ai_tags(id) ON DELETE CASCADE
) ENGINE=InnoDB;

/* =====================================================================
   PHẦN 6. KHO  (Quản lý kho: nhập/xuất/kiểm tra tồn; Quản lý nhà hàng: điều chỉnh;
                 Nhân viên bếp: kiểm tra nguyên liệu)
   ===================================================================== */

CREATE TABLE ingredients (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  code          VARCHAR(20)  NOT NULL,
  name          VARCHAR(120) NOT NULL,
  unit          VARCHAR(20)  NOT NULL,              -- kg, lít, hộp...
  min_level     DECIMAL(12,3) NOT NULL DEFAULT 0,   -- định mức tồn tối thiểu
  stock_qty     DECIMAL(12,3) NOT NULL DEFAULT 0,   -- tồn hiện tại, do trigger cập nhật
  avg_cost      DECIMAL(14,2) NOT NULL DEFAULT 0,
  is_active     TINYINT(1)   NOT NULL DEFAULT 1,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT uq_ing_code UNIQUE (code),
  CONSTRAINT uq_ing_name UNIQUE (name),
  CONSTRAINT chk_ing_qty CHECK (stock_qty >= 0 AND min_level >= 0 AND avg_cost >= 0)
) ENGINE=InnoDB COMMENT='Không sửa stock_qty trực tiếp — mọi thay đổi đi qua stock_transactions.';

CREATE TABLE dish_ingredients (
  dish_id        BIGINT UNSIGNED NOT NULL,
  ingredient_id  BIGINT UNSIGNED NOT NULL,
  quantity       DECIMAL(12,3) NOT NULL,            -- định lượng cho 1 phần
  PRIMARY KEY (dish_id, ingredient_id),
  CONSTRAINT fk_di_dish FOREIGN KEY (dish_id) REFERENCES dishes(id) ON DELETE CASCADE,
  CONSTRAINT fk_di_ing FOREIGN KEY (ingredient_id) REFERENCES ingredients(id) ON DELETE RESTRICT,
  CONSTRAINT chk_di_qty CHECK (quantity > 0)
) ENGINE=InnoDB COMMENT='Công thức định lượng — bếp kiểm tra đủ nguyên liệu cho món.';

CREATE TABLE suppliers (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  code          VARCHAR(20)  NOT NULL,
  name          VARCHAR(150) NOT NULL,
  phone         VARCHAR(15)  NULL,
  email         VARCHAR(150) NULL,
  address       VARCHAR(300) NULL,
  is_active     TINYINT(1)   NOT NULL DEFAULT 1,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_sup_code UNIQUE (code)
) ENGINE=InnoDB;

CREATE TABLE purchase_orders (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  code            VARCHAR(20) NOT NULL,             -- PN-2411
  supplier_id     BIGINT UNSIGNED NOT NULL,
  status          VARCHAR(10) NOT NULL DEFAULT 'draft',
  receive_status  VARCHAR(15) NOT NULL DEFAULT 'not_received',
  ordered_at      DATETIME NULL,
  expected_at     DATE NULL,
  note            VARCHAR(500) NULL,
  created_by      BIGINT UNSIGNED NULL,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT uq_po_code UNIQUE (code),
  CONSTRAINT fk_po_supplier FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE RESTRICT,
  CONSTRAINT fk_po_user FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT chk_po_status CHECK (status IN ('draft','ordered','cancelled')),
  CONSTRAINT chk_po_receive CHECK (receive_status IN ('not_received','partial','received')),
  INDEX ix_po_pending (status, receive_status)
) ENGINE=InnoDB COMMENT='Phiếu mua. "Chờ nhận" = ordered + not_received/partial (Dashboard).';

CREATE TABLE purchase_order_items (
  id                 BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  purchase_order_id  BIGINT UNSIGNED NOT NULL,
  ingredient_id      BIGINT UNSIGNED NOT NULL,
  qty_ordered        DECIMAL(12,3) NOT NULL,
  qty_received       DECIMAL(12,3) NOT NULL DEFAULT 0,
  unit_price         DECIMAL(14,2) NOT NULL,
  CONSTRAINT uq_poi_line UNIQUE (purchase_order_id, ingredient_id),
  CONSTRAINT fk_poi_po FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id) ON DELETE CASCADE,
  CONSTRAINT fk_poi_ing FOREIGN KEY (ingredient_id) REFERENCES ingredients(id) ON DELETE RESTRICT,
  CONSTRAINT chk_poi_qty CHECK (qty_ordered > 0 AND qty_received >= 0 AND unit_price >= 0)
) ENGINE=InnoDB;

CREATE TABLE stock_transactions (
  id                      BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  ingredient_id           BIGINT UNSIGNED NOT NULL,
  txn_type                VARCHAR(10) NOT NULL,     -- import | export | adjust
  quantity_change         DECIMAL(12,3) NOT NULL,   -- dương = tăng tồn, âm = giảm tồn
  unit_cost               DECIMAL(14,2) NULL,
  purchase_order_item_id  BIGINT UNSIGNED NULL,     -- nhập theo phiếu mua
  order_item_id           BIGINT UNSIGNED NULL,     -- xuất theo món đã chế biến (mở rộng)
  reason                  VARCHAR(300) NULL,        -- bắt buộc với adjust (kiểm ở ứng dụng)
  created_by              BIGINT UNSIGNED NULL,
  created_at              DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_st_ing FOREIGN KEY (ingredient_id) REFERENCES ingredients(id) ON DELETE RESTRICT,
  CONSTRAINT fk_st_poi FOREIGN KEY (purchase_order_item_id) REFERENCES purchase_order_items(id) ON DELETE SET NULL,
  CONSTRAINT fk_st_user FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT chk_st_type CHECK (txn_type IN ('import','export','adjust')),
  CONSTRAINT chk_st_sign CHECK (
       (txn_type = 'import' AND quantity_change > 0)
    OR (txn_type = 'export' AND quantity_change < 0)
    OR (txn_type = 'adjust' AND quantity_change <> 0)),
  INDEX ix_st_ing_time (ingredient_id, created_at),
  INDEX ix_st_time (created_at)
) ENGINE=InnoDB COMMENT='Sổ kho: nhập kho, xuất kho (Quản lý kho), điều chỉnh tồn (Quản lý nhà hàng).';

CREATE TABLE supplier_payments (
  id                 BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  supplier_id        BIGINT UNSIGNED NOT NULL,
  purchase_order_id  BIGINT UNSIGNED NULL,
  amount             DECIMAL(14,2) NOT NULL,
  method             VARCHAR(10) NOT NULL DEFAULT 'transfer',
  paid_at            DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  note               VARCHAR(300) NULL,
  created_by         BIGINT UNSIGNED NULL,
  CONSTRAINT fk_sp_sup FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE RESTRICT,
  CONSTRAINT fk_sp_po FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id) ON DELETE SET NULL,
  CONSTRAINT fk_sp_user FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT chk_sp_amount CHECK (amount > 0),
  CONSTRAINT chk_sp_method CHECK (method IN ('cash','transfer'))
) ENGINE=InnoDB COMMENT='Công nợ NCC = giá trị hàng đã nhận − tổng đã thanh toán (xem v_supplier_debt).';

/* =====================================================================
   PHẦN 7. GỌI MÓN, BẾP, GỌI NHÂN VIÊN  (Khách hàng, Nhân viên bếp, Thu ngân, Phục vụ)
   ===================================================================== */

CREATE TABLE orders (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  code            VARCHAR(20) NOT NULL,
  table_id        BIGINT UNSIGNED NULL,
  reservation_id  BIGINT UNSIGNED NULL,
  customer_id     BIGINT UNSIGNED NULL,
  status          VARCHAR(10) NOT NULL DEFAULT 'open',
  source          VARCHAR(10) NOT NULL DEFAULT 'qr',  -- qr: khách tự gọi; staff: nhân viên nhập
  note            VARCHAR(300) NULL,
  created_by      BIGINT UNSIGNED NULL,               -- NULL = khách đặt qua QR
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  closed_at       DATETIME NULL,
  CONSTRAINT uq_orders_code UNIQUE (code),
  CONSTRAINT fk_orders_table FOREIGN KEY (table_id) REFERENCES dining_tables(id) ON DELETE RESTRICT,
  CONSTRAINT fk_orders_res FOREIGN KEY (reservation_id) REFERENCES reservations(id) ON DELETE SET NULL,
  CONSTRAINT fk_orders_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL,
  CONSTRAINT fk_orders_user FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT chk_orders_status CHECK (status IN ('open','completed','cancelled')),
  CONSTRAINT chk_orders_source CHECK (source IN ('qr','staff')),
  INDEX ix_orders_status (status, created_at),
  INDEX ix_orders_table (table_id, status)
) ENGINE=InnoDB COMMENT='Nhà hàng chỉ phục vụ tại chỗ (không mang đi/giao hàng) theo đặc tả.';

CREATE TABLE order_items (
  id                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  order_id          BIGINT UNSIGNED NOT NULL,
  dish_id           BIGINT UNSIGNED NOT NULL,
  dish_name         VARCHAR(120) NOT NULL,          -- bản chụp
  unit_price        DECIMAL(14,2) NOT NULL,         -- bản chụp: đổi giá món không ảnh hưởng đơn cũ
  quantity          SMALLINT UNSIGNED NOT NULL,
  note              VARCHAR(300) NULL,              -- "ít cay", "không hành"...
  status            VARCHAR(10) NOT NULL DEFAULT 'pending',
  added_via         VARCHAR(15) NOT NULL DEFAULT 'customer',  -- customer | ai_suggestion | staff
  kitchen_user_id   BIGINT UNSIGNED NULL,           -- bếp xác nhận hoàn thành
  created_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  started_at        DATETIME NULL,
  completed_at      DATETIME NULL,
  served_at         DATETIME NULL,
  CONSTRAINT fk_oi_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  CONSTRAINT fk_oi_dish FOREIGN KEY (dish_id) REFERENCES dishes(id) ON DELETE RESTRICT,
  CONSTRAINT fk_oi_kitchen FOREIGN KEY (kitchen_user_id) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT chk_oi_qty CHECK (quantity > 0 AND unit_price >= 0),
  CONSTRAINT chk_oi_status CHECK (status IN ('pending','cooking','done','served','cancelled')),
  CONSTRAINT chk_oi_via CHECK (added_via IN ('customer','ai_suggestion','staff')),
  INDEX ix_oi_kitchen (status, created_at),
  INDEX ix_oi_dish (dish_id)
) ENGINE=InnoDB COMMENT='ai_suggestion chỉ ghi khi KHÁCH đã xác nhận (AI không tự thêm món).';

CREATE TABLE service_requests (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  table_id        BIGINT UNSIGNED NOT NULL,
  order_id        BIGINT UNSIGNED NULL,
  request_type    VARCHAR(10) NOT NULL DEFAULT 'support',
  content         VARCHAR(300) NULL,
  status          VARCHAR(10) NOT NULL DEFAULT 'new',
  received_by     BIGINT UNSIGNED NULL,             -- Thu ngân tiếp nhận (đầu mối)
  assigned_to     BIGINT UNSIGNED NULL,             -- nhân viên phục vụ được chuyển tiếp
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  forwarded_at    DATETIME NULL,
  done_at         DATETIME NULL,
  CONSTRAINT fk_sr_table FOREIGN KEY (table_id) REFERENCES dining_tables(id) ON DELETE RESTRICT,
  CONSTRAINT fk_sr_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL,
  CONSTRAINT fk_sr_cashier FOREIGN KEY (received_by) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_sr_staff FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT chk_sr_type CHECK (request_type IN ('support','consult','payment','other')),
  CONSTRAINT chk_sr_status CHECK (status IN ('new','forwarded','done','cancelled')),
  INDEX ix_sr_status (status, created_at)
) ENGINE=InnoDB COMMENT='UC Gọi nhân viên: Khách → Thu ngân nhận → chuyển nhân viên phụ trách.';

/* =====================================================================
   PHẦN 8. HÓA ĐƠN & THANH TOÁN  (Thu ngân; Khách hàng thanh toán)
   ===================================================================== */

CREATE TABLE invoices (
  id                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  code              VARCHAR(20) NOT NULL,
  order_id          BIGINT UNSIGNED NOT NULL,
  subtotal          DECIMAL(14,2) NOT NULL,
  discount_amount   DECIMAL(14,2) NOT NULL DEFAULT 0,   -- dự phòng khuyến mãi (phát triển sau)
  tax_amount        DECIMAL(14,2) NOT NULL DEFAULT 0,   -- dự phòng thuế (phát triển sau)
  total_amount      DECIMAL(14,2) NOT NULL,
  status            VARCHAR(10) NOT NULL DEFAULT 'unpaid',
  vat_company_name  VARCHAR(200) NULL,
  vat_tax_code      VARCHAR(14)  NULL,
  cashier_id        BIGINT UNSIGNED NULL,
  created_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  paid_at           DATETIME NULL,                     -- doanh thu tính theo thời điểm thanh toán
  CONSTRAINT uq_inv_code UNIQUE (code),
  CONSTRAINT uq_inv_order UNIQUE (order_id),          -- 1 đơn ↔ 1 hóa đơn
  CONSTRAINT fk_inv_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE RESTRICT,
  CONSTRAINT fk_inv_cashier FOREIGN KEY (cashier_id) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT chk_inv_amount CHECK (subtotal >= 0 AND discount_amount >= 0 AND tax_amount >= 0
                                   AND total_amount = subtotal - discount_amount + tax_amount),
  CONSTRAINT chk_inv_status CHECK (status IN ('unpaid','paid','cancelled')),
  INDEX ix_inv_paid (status, paid_at)
) ENGINE=InnoDB;

CREATE TABLE payments (
  id                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  invoice_id        BIGINT UNSIGNED NOT NULL,
  method            VARCHAR(10) NOT NULL,
  amount            DECIMAL(14,2) NOT NULL,
  transaction_ref   VARCHAR(100) NULL,               -- mã giao dịch ngân hàng/ví
  paid_at           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  received_by       BIGINT UNSIGNED NULL,
  CONSTRAINT fk_pay_inv FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE RESTRICT,
  CONSTRAINT fk_pay_user FOREIGN KEY (received_by) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT chk_pay_method CHECK (method IN ('cash','card','transfer','ewallet')),
  CONSTRAINT chk_pay_amount CHECK (amount > 0),
  INDEX ix_pay_time (paid_at)
) ENGINE=InnoDB COMMENT='Một hóa đơn có thể trả bằng nhiều hình thức.';

/* =====================================================================
   PHẦN 9. NHÂN SỰ: CA LÀM, CHẤM CÔNG, LƯƠNG  (Quản lý nhà hàng, Thu ngân tính lương)
   ===================================================================== */

CREATE TABLE shifts (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(40) NOT NULL,
  start_time    TIME NOT NULL,
  end_time      TIME NOT NULL,                      -- end < start = ca qua đêm
  color         CHAR(7) NOT NULL DEFAULT '#0f7b5a',
  note          VARCHAR(200) NULL,
  is_active     TINYINT(1) NOT NULL DEFAULT 1,
  CONSTRAINT uq_shifts_name UNIQUE (name),
  CONSTRAINT uq_shifts_time UNIQUE (start_time, end_time),   -- "Dữ liệu bị trùng lặp"
  CONSTRAINT chk_shifts_time CHECK (start_time <> end_time)
) ENGINE=InnoDB;

CREATE TABLE shift_assignments (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  shift_id      BIGINT UNSIGNED NOT NULL,
  user_id       BIGINT UNSIGNED NOT NULL,
  work_date     DATE NOT NULL,
  created_by    BIGINT UNSIGNED NULL,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_sa UNIQUE (user_id, work_date, shift_id),
  CONSTRAINT fk_sa_shift FOREIGN KEY (shift_id) REFERENCES shifts(id) ON DELETE RESTRICT,   -- "Không thể xóa ca"
  CONSTRAINT fk_sa_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT fk_sa_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX ix_sa_date (work_date)
) ENGINE=InnoDB COMMENT='Trùng giờ giữa các ca khác nhau trong cùng ngày kiểm tra ở ứng dụng.';

CREATE TABLE attendances (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  assignment_id   BIGINT UNSIGNED NULL,
  user_id         BIGINT UNSIGNED NOT NULL,
  work_date       DATE NOT NULL,
  check_in        DATETIME NOT NULL,
  check_out       DATETIME NULL,
  note            VARCHAR(200) NULL,
  CONSTRAINT uq_att_assignment UNIQUE (assignment_id),
  CONSTRAINT fk_att_assignment FOREIGN KEY (assignment_id) REFERENCES shift_assignments(id) ON DELETE SET NULL,
  CONSTRAINT fk_att_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT chk_att_time CHECK (check_out IS NULL OR check_out > check_in),
  INDEX ix_att_user_date (user_id, work_date)
) ENGINE=InnoDB COMMENT='Chấm công thực tế — nguồn dữ liệu tính lương.';

CREATE TABLE payroll_periods (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(50) NOT NULL,               -- "Tháng 11/2026"
  start_date    DATE NOT NULL,
  end_date      DATE NOT NULL,
  status        VARCHAR(10) NOT NULL DEFAULT 'draft',
  CONSTRAINT uq_pp_range UNIQUE (start_date, end_date),
  CONSTRAINT chk_pp_range CHECK (end_date >= start_date),
  CONSTRAINT chk_pp_status CHECK (status IN ('draft','closed'))
) ENGINE=InnoDB;

CREATE TABLE payrolls (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  period_id       BIGINT UNSIGNED NOT NULL,
  user_id         BIGINT UNSIGNED NOT NULL,
  worked_hours    DECIMAL(7,2)  NOT NULL DEFAULT 0,
  hourly_rate     DECIMAL(14,2) NOT NULL DEFAULT 0,  -- bản chụp lúc tính
  base_salary     DECIMAL(14,2) NOT NULL DEFAULT 0,
  allowance       DECIMAL(14,2) NOT NULL DEFAULT 0,
  deduction       DECIMAL(14,2) NOT NULL DEFAULT 0,
  total_amount    DECIMAL(14,2) NOT NULL DEFAULT 0,
  note            VARCHAR(300) NULL,
  calculated_by   BIGINT UNSIGNED NULL,              -- Thu ngân
  calculated_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_payroll UNIQUE (period_id, user_id),
  CONSTRAINT fk_payroll_period FOREIGN KEY (period_id) REFERENCES payroll_periods(id) ON DELETE RESTRICT,
  CONSTRAINT fk_payroll_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT fk_payroll_calc FOREIGN KEY (calculated_by) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT chk_payroll_values CHECK (worked_hours >= 0 AND allowance >= 0 AND deduction >= 0)
) ENGINE=InnoDB;

/* =====================================================================
   PHẦN 10. BÀI VIẾT  (Quản lý nhà hàng)
   ===================================================================== */

CREATE TABLE posts (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  title           VARCHAR(150) NOT NULL,
  slug            VARCHAR(180) NOT NULL,
  summary         VARCHAR(300) NULL,
  content         MEDIUMTEXT NOT NULL,
  cover_image_url VARCHAR(500) NULL,
  category        VARCHAR(10) NOT NULL DEFAULT 'news',
  status          VARCHAR(10) NOT NULL DEFAULT 'draft',
  author_id       BIGINT UNSIGNED NULL,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  published_at    DATETIME NULL,
  CONSTRAINT uq_posts_slug UNIQUE (slug),
  CONSTRAINT fk_posts_author FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT chk_posts_category CHECK (category IN ('news','promotion','event')),
  CONSTRAINT chk_posts_status CHECK (status IN ('draft','published','hidden')),
  INDEX ix_posts_status (status, published_at)
) ENGINE=InnoDB;

/* =====================================================================
   PHẦN 11. CHATBOT AI  (Quản trị viên: cấu hình AI; Quản lý nhà hàng: quản lý chatbot;
                         Khách hàng: hỏi AI tư vấn)
   ===================================================================== */

CREATE TABLE ai_model_config (
  id              TINYINT UNSIGNED NOT NULL DEFAULT 1 PRIMARY KEY,
  provider        VARCHAR(30)  NOT NULL DEFAULT 'anthropic',
  model_name      VARCHAR(60)  NOT NULL,
  temperature     DECIMAL(3,2) NOT NULL DEFAULT 0.30,
  max_tokens      INT UNSIGNED NOT NULL DEFAULT 1024,
  system_prompt   TEXT NULL,
  api_key_ref     VARCHAR(100) NULL,                -- TÊN biến môi trường chứa key, KHÔNG lưu key thật
  is_enabled      TINYINT(1)   NOT NULL DEFAULT 1,
  updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  updated_by      BIGINT UNSIGNED NULL,
  CONSTRAINT chk_aimc_single CHECK (id = 1),
  CONSTRAINT chk_aimc_temp CHECK (temperature BETWEEN 0 AND 1),
  CONSTRAINT fk_aimc_user FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB COMMENT='Cấu hình mô hình AI — thuộc quyền Quản trị viên.';

CREATE TABLE chatbot_config (
  id                  TINYINT UNSIGNED NOT NULL DEFAULT 1 PRIMARY KEY,
  bot_name            VARCHAR(30)  NOT NULL,
  avatar              VARCHAR(20)  NOT NULL DEFAULT '🤖',
  is_active           TINYINT(1)   NOT NULL DEFAULT 1,
  greeting            VARCHAR(300) NOT NULL,
  fallback_message    VARCHAR(500) NOT NULL,
  fallback_action     VARCHAR(15)  NOT NULL DEFAULT 'suggest_staff',
  tone                VARCHAR(15)  NOT NULL DEFAULT 'friendly',
  personality         VARCHAR(500) NULL,
  allergy_disclaimer  VARCHAR(500) NOT NULL,         -- bắt buộc theo nguyên tắc AI
  updated_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  updated_by          BIGINT UNSIGNED NULL,
  CONSTRAINT chk_cbc_single CHECK (id = 1),
  CONSTRAINT chk_cbc_fallback CHECK (fallback_action IN ('suggest_staff','show_menu','rephrase')),
  CONSTRAINT chk_cbc_tone CHECK (tone IN ('friendly','professional','playful')),
  CONSTRAINT fk_cbc_user FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE chatbot_quick_replies (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  label         VARCHAR(30) NOT NULL,
  sort_order    SMALLINT NOT NULL DEFAULT 0,
  CONSTRAINT uq_cqr_label UNIQUE (label)
) ENGINE=InnoDB;

CREATE TABLE combos (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(100) NOT NULL,
  note          VARCHAR(300) NULL,                  -- khi nào AI nên gợi ý
  is_active     TINYINT(1) NOT NULL DEFAULT 1,
  CONSTRAINT uq_combos_name UNIQUE (name)
) ENGINE=InnoDB;

CREATE TABLE combo_items (
  combo_id      BIGINT UNSIGNED NOT NULL,
  dish_id       BIGINT UNSIGNED NOT NULL,
  quantity      SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  PRIMARY KEY (combo_id, dish_id),
  CONSTRAINT fk_ci_combo FOREIGN KEY (combo_id) REFERENCES combos(id) ON DELETE CASCADE,
  CONSTRAINT fk_ci_dish FOREIGN KEY (dish_id) REFERENCES dishes(id) ON DELETE CASCADE,
  CONSTRAINT chk_ci_qty CHECK (quantity > 0)
) ENGINE=InnoDB;

CREATE TABLE faq_categories (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(60) NOT NULL,
  CONSTRAINT uq_faqc_name UNIQUE (name)
) ENGINE=InnoDB;

CREATE TABLE faqs (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  category_id   BIGINT UNSIGNED NOT NULL,
  question      VARCHAR(200) NOT NULL,
  answer        VARCHAR(1000) NOT NULL,
  is_active     TINYINT(1) NOT NULL DEFAULT 1,
  updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  updated_by    BIGINT UNSIGNED NULL,
  CONSTRAINT uq_faqs_question UNIQUE (question),
  CONSTRAINT fk_faqs_cat FOREIGN KEY (category_id) REFERENCES faq_categories(id) ON DELETE RESTRICT,
  CONSTRAINT fk_faqs_user FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE chat_conversations (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  table_id        BIGINT UNSIGNED NULL,
  order_id        BIGINT UNSIGNED NULL,
  session_token   CHAR(36) NOT NULL,                -- phiên chat trên thiết bị khách
  status          VARCHAR(10) NOT NULL DEFAULT 'answered',
  started_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ended_at        DATETIME NULL,
  CONSTRAINT uq_conv_session UNIQUE (session_token),
  CONSTRAINT fk_conv_table FOREIGN KEY (table_id) REFERENCES dining_tables(id) ON DELETE SET NULL,
  CONSTRAINT fk_conv_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL,
  CONSTRAINT chk_conv_status CHECK (status IN ('answered','fallback','handoff')),
  INDEX ix_conv_time (started_at)
) ENGINE=InnoDB;

CREATE TABLE chat_messages (
  id               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  conversation_id  BIGINT UNSIGNED NOT NULL,
  sender           VARCHAR(10) NOT NULL,
  content          TEXT NOT NULL,
  matched_faq_id   BIGINT UNSIGNED NULL,
  is_fallback      TINYINT(1) NOT NULL DEFAULT 0,
  created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_cm_conv FOREIGN KEY (conversation_id) REFERENCES chat_conversations(id) ON DELETE CASCADE,
  CONSTRAINT fk_cm_faq FOREIGN KEY (matched_faq_id) REFERENCES faqs(id) ON DELETE SET NULL,
  CONSTRAINT chk_cm_sender CHECK (sender IN ('customer','bot')),
  INDEX ix_cm_conv (conversation_id, created_at)
) ENGINE=InnoDB;

CREATE TABLE chat_message_dishes (
  message_id    BIGINT UNSIGNED NOT NULL,
  dish_id       BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (message_id, dish_id),
  CONSTRAINT fk_cmd_msg FOREIGN KEY (message_id) REFERENCES chat_messages(id) ON DELETE CASCADE,
  CONSTRAINT fk_cmd_dish FOREIGN KEY (dish_id) REFERENCES dishes(id) ON DELETE CASCADE
) ENGINE=InnoDB COMMENT='Món được nhắc trong tin nhắn → thống kê "món được hỏi nhiều".';

CREATE TABLE unanswered_questions (
  id               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  question         VARCHAR(300) NOT NULL,
  asked_count      INT UNSIGNED NOT NULL DEFAULT 1,
  last_asked_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  status           VARCHAR(10) NOT NULL DEFAULT 'open',
  resolved_faq_id  BIGINT UNSIGNED NULL,
  CONSTRAINT fk_uq_faq FOREIGN KEY (resolved_faq_id) REFERENCES faqs(id) ON DELETE SET NULL,
  CONSTRAINT chk_uq_status CHECK (status IN ('open','resolved','dismissed')),
  INDEX ix_uq_open (status, asked_count)
) ENGINE=InnoDB;

CREATE TABLE menu_sync_logs (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  synced_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  total_dishes    INT UNSIGNED NOT NULL,
  enabled_dishes  INT UNSIGNED NOT NULL,
  missing_count   INT UNSIGNED NOT NULL DEFAULT 0,
  synced_by       BIGINT UNSIGNED NULL,
  CONSTRAINT fk_msl_user FOREIGN KEY (synced_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

/* =====================================================================
   PHẦN 12. THÔNG BÁO  (UC Thông báo — Phụ lục A mở rộng được)
   ===================================================================== */

CREATE TABLE notification_types (
  code          VARCHAR(30)  NOT NULL PRIMARY KEY,  -- reservation, inventory, service_request, kitchen ...
  name          VARCHAR(60)  NOT NULL,
  target_route  VARCHAR(100) NULL,                  -- trang mở khi bấm (NULL = chỉ xem)
  is_active     TINYINT(1)   NOT NULL DEFAULT 1
) ENGINE=InnoDB COMMENT='Thêm loại thông báo = INSERT một dòng (đúng quy tắc mở rộng Phụ lục A).';

CREATE TABLE notifications (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  type_code     VARCHAR(30)  NOT NULL,
  title         VARCHAR(150) NOT NULL,
  content       VARCHAR(500) NULL,
  ref_table     VARCHAR(50)  NULL,
  ref_id        BIGINT UNSIGNED NULL,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at    DATETIME NOT NULL DEFAULT (CURRENT_TIMESTAMP + INTERVAL 30 DAY),   -- giữ 30 ngày
  CONSTRAINT fk_ntf_type FOREIGN KEY (type_code) REFERENCES notification_types(code) ON DELETE RESTRICT,
  INDEX ix_ntf_time (created_at)
) ENGINE=InnoDB;

CREATE TABLE notification_recipients (
  notification_id  BIGINT UNSIGNED NOT NULL,
  user_id          BIGINT UNSIGNED NOT NULL,
  is_read          TINYINT(1) NOT NULL DEFAULT 0,
  read_at          DATETIME NULL,
  PRIMARY KEY (notification_id, user_id),
  CONSTRAINT fk_nr_ntf FOREIGN KEY (notification_id) REFERENCES notifications(id) ON DELETE CASCADE,
  CONSTRAINT fk_nr_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX ix_nr_unread (user_id, is_read)
) ENGINE=InnoDB COMMENT='Trạng thái đọc riêng theo từng tài khoản.';

/* =====================================================================
   PHẦN 13. TRIGGER — giữ tồn kho luôn đúng, không bao giờ âm
   ===================================================================== */

DELIMITER $$

CREATE TRIGGER trg_stock_before_insert
BEFORE INSERT ON stock_transactions
FOR EACH ROW
BEGIN
  DECLARE current_qty DECIMAL(12,3);
  SELECT stock_qty INTO current_qty FROM ingredients WHERE id = NEW.ingredient_id FOR UPDATE;
  IF current_qty + NEW.quantity_change < 0 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Tồn kho không đủ: số lượng xuất/điều chỉnh vượt quá tồn hiện tại';
  END IF;
END$$

CREATE TRIGGER trg_stock_after_insert
AFTER INSERT ON stock_transactions
FOR EACH ROW
BEGIN
  UPDATE ingredients
     SET stock_qty = stock_qty + NEW.quantity_change
   WHERE id = NEW.ingredient_id;
END$$

CREATE TRIGGER trg_stock_no_update
BEFORE UPDATE ON stock_transactions
FOR EACH ROW
BEGIN
  SIGNAL SQLSTATE '45000'
    SET MESSAGE_TEXT = 'Không sửa phiếu kho đã ghi. Hãy tạo phiếu điều chỉnh (adjust).';
END$$

CREATE TRIGGER trg_stock_no_delete
BEFORE DELETE ON stock_transactions
FOR EACH ROW
BEGIN
  SIGNAL SQLSTATE '45000'
    SET MESSAGE_TEXT = 'Không xóa phiếu kho đã ghi. Hãy tạo phiếu điều chỉnh (adjust).';
END$$

CREATE TRIGGER trg_dish_status_time
BEFORE UPDATE ON dishes
FOR EACH ROW
BEGIN
  IF NEW.status <> OLD.status THEN
    SET NEW.status_updated_at = CURRENT_TIMESTAMP;
    IF NEW.status = 'stopped' THEN
      SET NEW.ai_enabled = 0;                      -- món ngừng bán thì AI không được gợi ý
    END IF;
  END IF;
END$$

DELIMITER ;

/* =====================================================================
   PHẦN 14. VIEW — phục vụ Dashboard và các màn hình tra cứu
   ===================================================================== */

-- Món đã phát sinh giao dịch (không cho xóa cứng)
CREATE VIEW v_dish_usage AS
SELECT d.id, d.code, d.name,
       EXISTS (SELECT 1 FROM order_items oi WHERE oi.dish_id = d.id) AS used_in_orders
FROM dishes d;

-- Tình trạng nguyên liệu: ok / low (≤ định mức) / out (= 0)
CREATE VIEW v_ingredient_status AS
SELECT i.id, i.code, i.name, i.unit, i.stock_qty, i.min_level,
       CASE WHEN i.stock_qty = 0 THEN 'out'
            WHEN i.stock_qty <= i.min_level THEN 'low'
            ELSE 'ok' END AS stock_status,
       i.stock_qty * i.avg_cost AS stock_value
FROM ingredients i
WHERE i.is_active = 1;

-- Doanh thu theo ngày: chỉ hóa đơn đã thanh toán, theo thời điểm thanh toán
CREATE VIEW v_revenue_daily AS
SELECT DATE(inv.paid_at) AS revenue_date,
       COUNT(*)             AS invoice_count,
       SUM(inv.total_amount) AS revenue,
       SUM(inv.total_amount) / COUNT(*) AS avg_per_invoice
FROM invoices inv
WHERE inv.status = 'paid'
GROUP BY DATE(inv.paid_at);

-- Số lượng & doanh thu bán theo món (hóa đơn đã thanh toán, bỏ dòng bị hủy)
CREATE VIEW v_dish_sales AS
SELECT oi.dish_id, d.name AS dish_name, d.category_id,
       DATE(inv.paid_at) AS sale_date,
       SUM(oi.quantity) AS quantity,
       SUM(oi.quantity * oi.unit_price) AS revenue
FROM order_items oi
JOIN orders o     ON o.id = oi.order_id
JOIN invoices inv ON inv.order_id = o.id AND inv.status = 'paid'
JOIN dishes d     ON d.id = oi.dish_id
WHERE oi.status <> 'cancelled'
GROUP BY oi.dish_id, d.name, d.category_id, DATE(inv.paid_at);

-- Công nợ nhà cung cấp = giá trị hàng đã nhận − đã thanh toán
CREATE VIEW v_supplier_debt AS
SELECT s.id AS supplier_id, s.name,
       COALESCE(r.received_value, 0) AS received_value,
       COALESCE(p.paid_amount, 0)    AS paid_amount,
       COALESCE(r.received_value, 0) - COALESCE(p.paid_amount, 0) AS debt
FROM suppliers s
LEFT JOIN (
  SELECT po.supplier_id, SUM(poi.qty_received * poi.unit_price) AS received_value
  FROM purchase_orders po JOIN purchase_order_items poi ON poi.purchase_order_id = po.id
  WHERE po.status <> 'cancelled'
  GROUP BY po.supplier_id
) r ON r.supplier_id = s.id
LEFT JOIN (
  SELECT supplier_id, SUM(amount) AS paid_amount FROM supplier_payments GROUP BY supplier_id
) p ON p.supplier_id = s.id;

-- Phiếu mua chờ nhận (Dashboard: số ngày chờ)
CREATE VIEW v_pending_purchase_orders AS
SELECT po.id, po.code, s.name AS supplier_name, po.ordered_at,
       DATEDIFF(CURRENT_DATE, DATE(po.ordered_at)) AS waiting_days,
       SUM(poi.qty_ordered * poi.unit_price) AS total_value
FROM purchase_orders po
JOIN suppliers s ON s.id = po.supplier_id
JOIN purchase_order_items poi ON poi.purchase_order_id = po.id
WHERE po.status = 'ordered' AND po.receive_status IN ('not_received','partial')
GROUP BY po.id, po.code, s.name, po.ordered_at;

-- Hàng chờ bếp: món chưa hoàn thành, cũ nhất trước
CREATE VIEW v_kitchen_queue AS
SELECT oi.id AS order_item_id, o.code AS order_code, t.code AS table_code,
       oi.dish_name, oi.quantity, oi.note, oi.status, oi.created_at
FROM order_items oi
JOIN orders o ON o.id = oi.order_id AND o.status = 'open'
LEFT JOIN dining_tables t ON t.id = o.table_id
WHERE oi.status IN ('pending','cooking');

/* =====================================================================
   PHẦN 15. DỮ LIỆU KHỞI TẠO
   Mật khẩu mẫu: chuỗi băm dưới đây là PLACEHOLDER — backend phải tạo hash thật
   (bcrypt) và must_change_password = 1 buộc đổi mật khẩu khi đăng nhập lần đầu.
   ===================================================================== */

INSERT INTO roles (code, name, description) VALUES
 ('admin',     'Quản trị viên',     'Cập nhật thông tin tài khoản chung, cấu hình AI, cập nhật hệ thống'),
 ('manager',   'Quản lý nhà hàng',  'Món ăn, sơ đồ bàn, đặt bàn, nhân viên, bài viết, chatbot, thống kê'),
 ('cashier',   'Thu ngân',          'Tra cứu đơn, lập hóa đơn, tính lương, nhận yêu cầu khách'),
 ('kitchen',   'Nhân viên bếp',     'Xem đơn, kiểm tra nguyên liệu, xác nhận hoàn thành món'),
 ('warehouse', 'Quản lý kho',       'Nhập kho, xuất kho, kiểm tra tồn kho'),
 ('waiter',    'Nhân viên phục vụ', 'Hỗ trợ khách tại bàn theo yêu cầu được chuyển tiếp');

INSERT INTO permissions (code, module, name) VALUES
 ('account.manage',      'account',     'Quản lý tài khoản'),
 ('settings.manage',     'settings',    'Cấu hình hệ thống, sao lưu & phục hồi'),
 ('audit.view',          'settings',    'Xem nhật ký hoạt động'),
 ('ai.config',           'chatbot',     'Cấu hình mô hình AI'),
 ('chatbot.manage',      'chatbot',     'Quản lý Chatbot AI (cấu hình, FAQ, thực đơn AI)'),
 ('dashboard.view',      'dashboard',   'Xem Dashboard thống kê'),
 ('notification.view',   'notification','Xem thông báo'),
 ('reservation.manage',  'reservation', 'Quản lý đặt bàn & form đặt bàn'),
 ('table.manage',        'table',       'Chỉnh sửa khu vực & sơ đồ bàn'),
 ('dish.manage',         'dish',        'Quản lý món ăn & danh mục'),
 ('shift.manage',        'shift',       'Quản lý & phân công ca làm việc'),
 ('post.manage',         'post',        'Quản lý bài viết'),
 ('inventory.adjust',    'inventory',   'Điều chỉnh tồn kho'),
 ('inventory.view',      'inventory',   'Kiểm tra tồn kho'),
 ('inventory.import',    'inventory',   'Nhập kho'),
 ('inventory.export',    'inventory',   'Xuất kho'),
 ('purchase.manage',     'inventory',   'Phiếu mua & nhà cung cấp'),
 ('order.view',          'order',       'Tra cứu đơn hàng'),
 ('invoice.manage',      'invoice',     'Lập hóa đơn & nhận thanh toán'),
 ('service_request.handle','order',     'Nhận & chuyển tiếp yêu cầu của khách'),
 ('service_request.serve','order',      'Xử lý yêu cầu được chuyển tới'),
 ('payroll.manage',      'payroll',     'Tính lương nhân viên'),
 ('kitchen.process',     'kitchen',     'Xem đơn & xác nhận hoàn thành món');

-- Gán quyền theo vai trò (dùng code, không phụ thuộc id)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p ON
  (r.code = 'admin'     AND p.code IN ('account.manage','settings.manage','audit.view','ai.config','notification.view'))
  OR (r.code = 'manager'   AND p.code IN ('account.manage','settings.manage','audit.view','chatbot.manage','dashboard.view',
                                          'notification.view','reservation.manage','table.manage','dish.manage','shift.manage',
                                          'post.manage','inventory.adjust','inventory.view'))
  OR (r.code = 'cashier'   AND p.code IN ('order.view','invoice.manage','service_request.handle','payroll.manage','notification.view'))
  OR (r.code = 'kitchen'   AND p.code IN ('kitchen.process','order.view','inventory.view'))
  OR (r.code = 'warehouse' AND p.code IN ('inventory.view','inventory.import','inventory.export','purchase.manage','notification.view'))
  OR (r.code = 'waiter'    AND p.code IN ('service_request.serve','notification.view'));

INSERT INTO users (username, password_hash, full_name, email, phone, role_id, hourly_rate) VALUES
 ('admin',       '$2b$10$REPLACE.WITH.REAL.BCRYPT.HASH.000000000000000000000', 'Quản trị hệ thống', 'admin@greenlotus.vn',       '0901000001', (SELECT id FROM roles WHERE code='admin'),     0),
 ('tuan.nguyen', '$2b$10$REPLACE.WITH.REAL.BCRYPT.HASH.000000000000000000000', 'Nguyễn Anh Tuấn',   'tuan.nguyen@greenlotus.vn', '0901000002', (SELECT id FROM roles WHERE code='manager'),   0),
 ('linh.tran',   '$2b$10$REPLACE.WITH.REAL.BCRYPT.HASH.000000000000000000000', 'Trần Thùy Linh',    'linh.tran@greenlotus.vn',   '0901000003', (SELECT id FROM roles WHERE code='cashier'),   30000),
 ('hung.pham',   '$2b$10$REPLACE.WITH.REAL.BCRYPT.HASH.000000000000000000000', 'Phạm Quốc Hùng',    'hung.pham@greenlotus.vn',   '0901000004', (SELECT id FROM roles WHERE code='kitchen'),   35000),
 ('thao.bui',    '$2b$10$REPLACE.WITH.REAL.BCRYPT.HASH.000000000000000000000', 'Bùi Phương Thảo',   'thao.bui@greenlotus.vn',    '0901000005', (SELECT id FROM roles WHERE code='warehouse'), 32000),
 ('nam.hoang',   '$2b$10$REPLACE.WITH.REAL.BCRYPT.HASH.000000000000000000000', 'Hoàng Gia Nam',     'nam.hoang@greenlotus.vn',   '0901000006', (SELECT id FROM roles WHERE code='waiter'),    25000);

INSERT INTO restaurant_info (id, name, legal_name, tax_code, phone, email, address, website) VALUES
 (1, 'Green Lotus', 'Công ty TNHH Ẩm thực Green Lotus', '0315678912', '02838221234',
  'lienhe@greenlotus.vn', '28 Nguyễn Huệ, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh', 'https://greenlotus.vn');

INSERT INTO opening_hours (day_of_week, is_open, open_time, close_time) VALUES
 (0,1,'09:00','22:00'), (1,1,'10:00','22:00'), (2,1,'10:00','22:00'), (3,1,'10:00','22:00'),
 (4,1,'10:00','22:00'), (5,1,'10:00','23:00'), (6,1,'09:00','23:00');

INSERT INTO reservation_form_config (id, notice) VALUES
 (1, 'Nhà hàng giữ bàn tối đa 15 phút sau giờ hẹn. Với nhóm trên 12 khách, vui lòng gọi hotline.');

INSERT INTO backup_schedule (id) VALUES (1);

INSERT INTO system_settings (setting_key, setting_value, value_type, description) VALUES
 ('notification.retention_days', '30',   'number',  'Số ngày giữ thông báo'),
 ('notification.bell_limit',     '4',    'number',  'Số thông báo hiển thị ở chuông'),
 ('purchase.pending_alert_days', '3',    'number',  'Phiếu mua chờ nhận quá số ngày thì báo'),
 ('order.allow_qr_ordering',     'true', 'boolean', 'Cho phép khách tự gọi món qua QR');

INSERT INTO areas (name, description, sort_order) VALUES
 ('Tầng 1',    'Sảnh chính, gần quầy thu ngân', 1),
 ('Sân vườn',  'Ngoài trời, có mái che di động', 2),
 ('Tầng 2',    'Không gian yên tĩnh, phù hợp gia đình', 3),
 ('Phòng VIP', 'Phòng riêng có máy lạnh, tối đa 12 khách', 4);

INSERT INTO dining_tables (code, area_id, seats, shape, pos_x, pos_y, qr_token)
SELECT t.code, a.id, t.seats, t.shape, t.x, t.y, REPLACE(UUID(), '-', '')
FROM (
  SELECT 'T01' code, 'Tầng 1' area, 2 seats, 'square' shape, 0 x, 0 y UNION ALL
  SELECT 'T02', 'Tầng 1', 2, 'square', 2, 0 UNION ALL
  SELECT 'T03', 'Tầng 1', 4, 'square', 4, 0 UNION ALL
  SELECT 'T04', 'Tầng 1', 4, 'square', 6, 0 UNION ALL
  SELECT 'T05', 'Tầng 1', 4, 'round',  0, 2 UNION ALL
  SELECT 'T06', 'Tầng 1', 6, 'rect',   2, 2 UNION ALL
  SELECT 'SV01','Sân vườn', 4, 'round', 0, 0 UNION ALL
  SELECT 'SV02','Sân vườn', 8, 'rect',  4, 3 UNION ALL
  SELECT 'L2-01','Tầng 2', 4, 'square', 0, 1 UNION ALL
  SELECT 'L2-02','Tầng 2', 10,'rect',   2, 3 UNION ALL
  SELECT 'VIP01','Phòng VIP', 8, 'round', 1, 1 UNION ALL
  SELECT 'VIP02','Phòng VIP', 12,'rect',  4, 2
) t JOIN areas a ON a.name = t.area;

INSERT INTO dish_categories (name, sort_order) VALUES
 ('Khai vị',1), ('Món chính',2), ('Lẩu',3), ('Cơm & mì',4), ('Tráng miệng',5), ('Đồ uống',6);

INSERT INTO allergens (name) VALUES
 ('Đậu phộng'), ('Hải sản có vỏ'), ('Cá'), ('Sữa'), ('Trứng'), ('Gluten (lúa mì)'), ('Đậu nành'), ('Mè (vừng)'), ('Hạt cây');

INSERT INTO ai_tags (name) VALUES
 ('Bán chạy'), ('Chay'), ('Ít cay'), ('Cay'), ('Ít dầu mỡ'), ('Món nhẹ'), ('Trẻ em thích'), ('Nhóm 4 người'), ('Món Việt truyền thống');

INSERT INTO dishes (code, name, category_id, price, description, ingredients_text, spicy_level)
SELECT x.code, x.name, c.id, x.price, x.descr, x.ing, x.spicy
FROM (
  SELECT 'MA001' code, 'Gỏi cuốn tôm thịt' name, 'Khai vị' cat, 35000 price, 'Cuốn tươi mát, phù hợp mở đầu bữa ăn.' descr, 'Tôm, thịt ba chỉ, bún, rau sống, bánh tráng; chấm tương đậu phộng' ing, 0 spicy UNION ALL
  SELECT 'MA002', 'Đậu hũ non sốt nấm', 'Khai vị', 59000, 'Món chay mềm mịn, sốt nấm đậm đà.', 'Đậu hũ non, nấm đông cô, nấm rơm, hành lá', 0 UNION ALL
  SELECT 'MA003', 'Cá kho tộ', 'Món chính', 125000, 'Cá kho đậm vị miền Tây trong niêu đất.', 'Cá basa, nước màu, tiêu, ớt, hành', 2 UNION ALL
  SELECT 'MA004', 'Gà nướng mật ong', 'Món chính', 145000, 'Gà nướng thơm mùi sả, mật ong.', 'Đùi gà, mật ong, tỏi, sả, ớt', 1 UNION ALL
  SELECT 'MA005', 'Lẩu Thái hải sản', 'Lẩu', 395000, 'Phần cho 3–4 người.', 'Tôm, mực, nghêu, cá, nấm, sả, lá chanh, ớt, nước cốt dừa', 3 UNION ALL
  SELECT 'MA006', 'Lẩu nấm chay', 'Lẩu', 295000, 'Lẩu nấm thanh đạm.', 'Nấm đông cô, nấm kim châm, nấm đùi gà, đậu hũ, rau củ', 0 UNION ALL
  SELECT 'MA007', 'Cơm chiên cá mặn', 'Cơm & mì', 95000, NULL, 'Cơm, cá mặn, trứng, hành lá, đậu que', 0 UNION ALL
  SELECT 'MA008', 'Chè hạt sen long nhãn', 'Tráng miệng', 45000, NULL, 'Hạt sen, long nhãn, đường phèn', 0 UNION ALL
  SELECT 'MA009', 'Trà sen vàng', 'Đồ uống', 49000, NULL, 'Trà xanh, hạt sen, kem sữa', 0
) x JOIN dish_categories c ON c.name = x.cat;

INSERT INTO dish_allergens (dish_id, allergen_id)
SELECT d.id, a.id FROM dishes d JOIN allergens a ON
     (d.code = 'MA001' AND a.name IN ('Hải sản có vỏ','Đậu phộng'))
  OR (d.code = 'MA002' AND a.name IN ('Đậu nành'))
  OR (d.code = 'MA003' AND a.name IN ('Cá'))
  OR (d.code = 'MA005' AND a.name IN ('Hải sản có vỏ','Cá','Sữa'))
  OR (d.code = 'MA006' AND a.name IN ('Đậu nành'))
  OR (d.code = 'MA007' AND a.name IN ('Cá','Trứng'))
  OR (d.code = 'MA009' AND a.name IN ('Sữa'));

INSERT INTO dish_ai_tags (dish_id, tag_id)
SELECT d.id, t.id FROM dishes d JOIN ai_tags t ON
     (d.code = 'MA001' AND t.name IN ('Bán chạy','Món nhẹ'))
  OR (d.code = 'MA002' AND t.name IN ('Chay','Ít cay'))
  OR (d.code = 'MA004' AND t.name IN ('Bán chạy','Trẻ em thích'))
  OR (d.code = 'MA005' AND t.name IN ('Cay','Nhóm 4 người'))
  OR (d.code = 'MA006' AND t.name IN ('Chay','Ít cay','Nhóm 4 người'));

INSERT INTO ingredients (code, name, unit, min_level, avg_cost) VALUES
 ('NL001', 'Tôm sú tươi',    'kg',  6,   280000),
 ('NL002', 'Thịt ba chỉ',    'kg',  5,   140000),
 ('NL003', 'Cá basa phi lê', 'kg',  5,   90000),
 ('NL004', 'Đùi gà',         'kg',  8,   75000),
 ('NL005', 'Đậu hũ non',     'hộp', 20,  8000),
 ('NL006', 'Nấm đông cô',    'kg',  2,   220000);

INSERT INTO dish_ingredients (dish_id, ingredient_id, quantity)
SELECT d.id, i.id, x.qty FROM (
  SELECT 'MA001' dish, 'NL001' ing, 0.080 qty UNION ALL
  SELECT 'MA001', 'NL002', 0.060 UNION ALL
  SELECT 'MA002', 'NL005', 1.000 UNION ALL
  SELECT 'MA002', 'NL006', 0.030 UNION ALL
  SELECT 'MA003', 'NL003', 0.350 UNION ALL
  SELECT 'MA004', 'NL004', 0.400
) x JOIN dishes d ON d.code = x.dish JOIN ingredients i ON i.code = x.ing;

INSERT INTO suppliers (code, name, phone, address) VALUES
 ('NCC01', 'Hải sản Phú Quốc',              '0912000111', 'Chợ Bình Điền, Quận 8, TP.HCM'),
 ('NCC02', 'Công ty Thực phẩm Đại Phát',    '0912000222', 'KCN Tân Bình, TP.HCM');

-- Tồn đầu kỳ: nhập qua sổ kho để trigger tự cập nhật stock_qty.
-- LƯU Ý (MySQL lỗi 1442): câu INSERT vào stock_transactions KHÔNG được đọc bảng ingredients,
-- vì trigger đang ghi vào ingredients. Vì vậy chép id ra bảng tạm trước (backend cũng nên
-- lấy ingredient_id ở một câu SELECT riêng rồi mới INSERT).
CREATE TEMPORARY TABLE tmp_opening_stock AS
SELECT i.id AS ingredient_id, i.avg_cost, x.qty
FROM (
  SELECT 'NL001' code, 12 qty UNION ALL SELECT 'NL002', 10 UNION ALL SELECT 'NL003', 4 UNION ALL
  SELECT 'NL004', 15 UNION ALL SELECT 'NL005', 40 UNION ALL SELECT 'NL006', 3
) x JOIN ingredients i ON i.code = x.code;

INSERT INTO stock_transactions (ingredient_id, txn_type, quantity_change, unit_cost, reason, created_by)
SELECT t.ingredient_id, 'import', t.qty, t.avg_cost, 'Tồn đầu kỳ', (SELECT id FROM users WHERE username = 'thao.bui')
FROM tmp_opening_stock t;

DROP TEMPORARY TABLE tmp_opening_stock;

INSERT INTO shifts (name, start_time, end_time, color, note) VALUES
 ('Ca sáng',  '06:00', '14:00', '#0f7b5a', 'Chuẩn bị nguyên liệu, phục vụ bữa trưa'),
 ('Ca chiều', '14:00', '22:00', '#2563eb', 'Phục vụ bữa tối'),
 ('Ca gãy',   '10:00', '14:00', '#d97706', 'Tăng cường giờ cao điểm trưa'),
 ('Ca tối',   '17:00', '23:00', '#7c3aed', 'Cao điểm tối & dọn dẹp cuối ngày');

INSERT INTO ai_model_config (id, provider, model_name, temperature, api_key_ref, system_prompt) VALUES
 (1, 'anthropic', 'claude-sonnet-5-5', 0.30, 'AI_API_KEY',
  'Bạn là trợ lý tư vấn thực đơn. Chỉ dùng dữ liệu món ăn được cung cấp. Không tự thêm món vào giỏ, không tạo đơn, không thanh toán.');

INSERT INTO chatbot_config (id, bot_name, avatar, greeting, fallback_message, personality, allergy_disclaimer) VALUES
 (1, 'Sen', '🪷',
  'Xin chào, mình là Sen – trợ lý thực đơn của Green Lotus! Bạn muốn tìm món theo khẩu vị, ngân sách hay hỏi về thành phần món nào?',
  'Xin lỗi, mình chưa có thông tin xác nhận cho câu hỏi này. Bạn có thể bấm "Gọi nhân viên" để được hỗ trợ trực tiếp nhé.',
  'Ngắn gọn, nhiệt tình, luôn giải thích lý do gợi ý. Không tự suy đoán giá hay thành phần.',
  'Thông tin dị nguyên dựa trên dữ liệu nhà hàng khai báo và có thể chưa phản ánh nguy cơ nhiễm chéo. Vui lòng xác nhận trực tiếp với nhân viên.');

INSERT INTO chatbot_quick_replies (label, sort_order) VALUES
 ('Món ít cay',1), ('Món chay',2), ('Món bán chạy',3), ('Dưới 100.000 ₫',4), ('Tôi bị dị ứng',5);

INSERT INTO faq_categories (name) VALUES
 ('Giờ mở cửa & địa chỉ'), ('Đặt bàn'), ('Thanh toán'), ('Món ăn & dị ứng'), ('Dịch vụ khác');

INSERT INTO faqs (category_id, question, answer)
SELECT c.id, x.q, x.a FROM (
  SELECT 'Đặt bàn' cat, 'Có thể đặt bàn trước bao lâu?' q, 'Quý khách có thể đặt bàn trước tối đa 30 ngày và tối thiểu 60 phút.' a UNION ALL
  SELECT 'Thanh toán', 'Nhà hàng nhận thanh toán bằng hình thức nào?', 'Tiền mặt, thẻ ngân hàng, chuyển khoản QR và ví điện tử.' UNION ALL
  SELECT 'Dịch vụ khác', 'Nhà hàng có chỗ đậu xe ô tô không?', 'Có bãi giữ xe ô tô miễn phí ở tầng hầm tòa nhà.'
) x JOIN faq_categories c ON c.name = x.cat;

INSERT INTO notification_types (code, name, target_route) VALUES
 ('reservation',     'Đặt bàn',           '/dat-ban/lich-su'),
 ('inventory',       'Kho',               NULL),
 ('service_request', 'Yêu cầu của khách', NULL),     -- dành cho Thu ngân (mở rộng)
 ('kitchen',         'Bếp',               NULL),     -- món hoàn thành (mở rộng)
 ('system',          'Hệ thống',          NULL);

/* =====================================================================
   HƯỚNG DẪN MỞ RỘNG NHANH
   - Thêm actor mới:      INSERT INTO roles ...; INSERT INTO role_permissions ...
   - Thêm quyền mới:      INSERT INTO permissions (code, module, name) ...
   - Thêm trạng thái mới: ALTER TABLE orders DROP CHECK chk_orders_status,
                          ADD CONSTRAINT chk_orders_status CHECK (status IN (...));
   - Thêm loại thông báo: INSERT INTO notification_types ...
   - Thêm thiết lập:      INSERT INTO system_settings ...
   - Nhiều chi nhánh:     tạo bảng branches, thêm cột branch_id (NULL được) vào
                          areas, orders, ingredients, users rồi gán dần.
   ===================================================================== */
