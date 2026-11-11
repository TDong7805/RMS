# Cơ sở dữ liệu RMS (MySQL 8.0)

| File | Nội dung |
|---|---|
| `rms_schema.sql` | Toàn bộ CSDL chung cho 6 actor: 54 bảng, 5 trigger, 7 view và dữ liệu khởi tạo |
| `rms_verify.sql` | 11 phép kiểm tra ràng buộc (tự ROLLBACK, không làm thay đổi dữ liệu) |

## Cách chạy

Yêu cầu MySQL **8.0.16 trở lên** (cần CHECK constraint). Mở PowerShell tại thư mục gốc dự án:

```powershell
$mysql = "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe"
& $mysql -u root -p --default-character-set=utf8mb4 -e "source database/rms_schema.sql"
& $mysql -u root -p --default-character-set=utf8mb4 -e "source database/rms_verify.sql"
```

> ⚠️ `rms_schema.sql` **xóa và tạo lại** database `rms_db`. Đổi tên ở đầu file nếu máy đã có database trùng tên.

Lệnh thứ hai phải in ra toàn bộ `PASS`.

## Các nhóm bảng

| Nhóm | Bảng chính | Actor |
|---|---|---|
| Phân quyền | `roles`, `permissions`, `role_permissions`, `users`, `customers` | Quản trị viên, Quản lý |
| Cấu hình | `restaurant_info`, `opening_hours`, `reservation_form_config`, `system_settings`, `backup_*`, `audit_logs` | Quản trị viên, Quản lý |
| Bàn & đặt bàn | `areas`, `dining_tables`, `reservations` | Khách hàng, Quản lý |
| Thực đơn | `dish_categories`, `dishes`, `allergens`, `ai_tags`, `dish_ingredients` | Quản lý, Khách hàng |
| Kho | `ingredients`, `suppliers`, `purchase_orders`, `stock_transactions`, `supplier_payments` | Quản lý kho, Bếp, Quản lý |
| Gọi món & bếp | `orders`, `order_items`, `service_requests` | Khách hàng, Bếp, Thu ngân |
| Thu ngân | `invoices`, `payments`, `payroll_periods`, `payrolls` | Thu ngân |
| Nhân sự | `shifts`, `shift_assignments`, `attendances` | Quản lý, Thu ngân |
| Nội dung | `posts` | Quản lý |
| Chatbot AI | `ai_model_config`, `chatbot_config`, `faqs`, `combos`, `chat_*`, `unanswered_questions` | Quản trị viên, Quản lý, Khách hàng |
| Thông báo | `notification_types`, `notifications`, `notification_recipients` | Tất cả |

## Quy ước khi chỉnh sửa (để cả nhóm không lỗi khi ghép)

- Khóa chính và khóa ngoại luôn là `BIGINT UNSIGNED`.
- Tên bảng/cột dùng `snake_case`, tên ràng buộc theo mẫu `fk_…`, `uq_…`, `chk_…`, `ix_…`.
- Thêm actor/quyền: chỉ `INSERT` vào `roles`, `permissions`, `role_permissions`.
- Thêm trạng thái: `DROP CHECK chk_…` rồi `ADD CONSTRAINT chk_… CHECK (...)` với danh sách mới.
- Không sửa trực tiếp `ingredients.stock_qty` — luôn ghi qua `stock_transactions`.
- Câu `INSERT INTO stock_transactions` **không được** đọc bảng `ingredients` trong cùng câu lệnh
  (kể cả subquery), nếu không MySQL báo lỗi 1442 do trigger đang ghi vào `ingredients`.
  Hãy `SELECT` lấy `ingredient_id` trước, rồi `INSERT ... VALUES (...)` ở câu riêng.
- Mật khẩu mẫu trong file là placeholder; backend phải tạo hash bcrypt thật.
- Hướng dẫn mở rộng chi tiết nằm ở cuối `rms_schema.sql`.
