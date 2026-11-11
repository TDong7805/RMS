# Cơ sở dữ liệu RMS (MySQL 8.0)

CSDL **không còn tạo bằng tay**. Backend dùng [Flyway](https://documentation.red-gate.com/flyway): mỗi lần khởi động,
Flyway xem bảng `flyway_schema_history` và tự chạy những file SQL chưa chạy. Chỉ cần MySQL đang chạy và
`backend/.env.properties` có mật khẩu đúng; CSDL `rms_db` chưa có thì backend tự tạo.

## Các file

| File | Nội dung | Chạy khi |
|---|---|---|
| `src/main/resources/db/migration/V1__khoi_tao.sql` | 54 bảng, 5 trigger, 7 view + **dữ liệu nền** (vai trò, quyền, cấu hình mặc định, dị nguyên, loại thông báo). Không có tài khoản | Mọi môi trường |
| `src/main/resources/db/migration/V2__phien_dang_nhap.sql` | Bảng `SPRING_SESSION` lưu phiên đăng nhập | Mọi môi trường |
| `src/main/resources/db/dev/V1_1__du_lieu_mau.sql` | **Dữ liệu mẫu**: tài khoản (mật khẩu `Rms@2026`), khu vực & bàn, món, kho, ca, FAQ, lịch đặt bàn | Chỉ profile `dev` |
| `backend/database/rms_verify.sql` | 11 phép kiểm tra ràng buộc, tự ROLLBACK | Chạy tay khi cần, trên CSDL phát triển |

Profile `dev` là mặc định khi chạy `mvn spring-boot:run`, IntelliJ hoặc `dev.bat`. Khi chạy thật (`prod`), thư mục
`db/dev` không được nạp → CSDL chỉ có dữ liệu nền, không ai biết trước mật khẩu nào (xem `TRIEN_KHAI.md`).

## Sau khi pull bản có Flyway về

- **CSDL `rms_db` đang có (tạo bằng các file SQL cũ, đã chạy `001_dang_nhap.sql`):** không cần làm gì. Lần chạy
  backend đầu tiên Flyway tự nhận CSDL này là đã có V1 + dữ liệu mẫu, chỉ chạy thêm V2.
- **Không chắc CSDL của mình đủ mới / muốn làm lại từ đầu:** xóa CSDL rồi chạy backend:

  ```powershell
  & "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe" -u root -p -e "DROP DATABASE IF EXISTS rms_db"
  cd backend; mvn spring-boot:run      # Flyway tạo lại toàn bộ trong vài giây
  ```

Dữ liệu mẫu tính ngày giờ tương đối theo **lúc được tạo**. Muốn có lại lịch đặt bàn "hôm nay", "ngày mai": xóa
`rms_db` và chạy lại backend như trên.

## Muốn thay đổi CSDL (thêm bảng, cột, trạng thái...)

1. **Không sửa file V đã có.** Flyway lưu checksum từng file; sửa file đã chạy thì backend của cả nhóm báo lỗi
   `Migration checksum mismatch` và không khởi động.
2. Tạo file mới trong `db/migration`, số phiên bản lớn hơn file cuối cùng, tên mô tả không dấu:
   `V3__them_bang_hoa_don.sql`, `V4__them_cot_anh_mon.sql`...
3. Dữ liệu **cần cho cả môi trường thật** (quyền mới, loại thông báo mới, cấu hình mặc định) để ngay trong file V đó.
   Dữ liệu **chỉ để demo** cho bảng mới thì để ở `db/dev`, đánh số ngay sau: `V3_1__mau_hoa_don.sql`.
4. Chạy backend: Flyway áp dụng file mới. Commit file SQL cùng với code dùng nó.
5. Hai người cùng tạo `V3` trên hai nhánh → người merge sau đổi tên file của mình thành số kế tiếp.

> Lỡ sửa file đã chạy trên máy mình? Hoàn tác thay đổi đó (`git checkout -- <file>`), hoặc xóa `rms_db` để tạo lại.

## Các nhóm bảng

| Nhóm | Bảng chính | Actor |
|---|---|---|
| Phân quyền | `roles`, `permissions`, `role_permissions`, `users`, `customers` | Quản lý |
| Cấu hình | `restaurant_info`, `opening_hours`, `reservation_form_config`, `system_settings`, `backup_*`, `audit_logs` | Quản lý |
| Bàn & đặt bàn | `areas`, `dining_tables`, `reservations` | Khách hàng, Quản lý |
| Thực đơn | `dish_categories`, `dishes`, `allergens`, `ai_tags`, `dish_ingredients` | Quản lý, Khách hàng |
| Kho | `ingredients`, `suppliers`, `purchase_orders`, `stock_transactions`, `supplier_payments` | Quản lý kho, Bếp, Quản lý |
| Gọi món & bếp | `orders`, `order_items`, `service_requests` | Khách hàng, Bếp, Thu ngân |
| Thu ngân | `invoices`, `payments`, `payroll_periods`, `payrolls` | Thu ngân |
| Nhân sự | `shifts`, `shift_assignments`, `attendances` | Quản lý, Thu ngân |
| Nội dung | `posts` | Quản lý |
| Chatbot AI | `ai_model_config`, `chatbot_config`, `faqs`, `combos`, `chat_*`, `unanswered_questions` | Quản lý, Khách hàng |
| Thông báo | `notification_types`, `notifications`, `notification_recipients` | Tất cả |
| Hệ thống | `flyway_schema_history` (Flyway), `SPRING_SESSION*` (phiên đăng nhập) | — không sửa tay |

## Quy ước khi chỉnh sửa (để cả nhóm không lỗi khi ghép)

- Khóa chính và khóa ngoại luôn là `BIGINT UNSIGNED`.
- Tên bảng/cột dùng `snake_case`, tên ràng buộc theo mẫu `fk_…`, `uq_…`, `chk_…`, `ix_…`.
- Thêm actor/quyền: chỉ `INSERT` vào `roles`, `permissions`, `role_permissions` (trong một file V mới).
- Thêm trạng thái: `DROP CHECK chk_…` rồi `ADD CONSTRAINT chk_… CHECK (...)` với danh sách mới.
- Không sửa trực tiếp `ingredients.stock_qty` — luôn ghi qua `stock_transactions`.
- Câu `INSERT INTO stock_transactions` **không được** đọc bảng `ingredients` trong cùng câu lệnh
  (kể cả subquery), nếu không MySQL báo lỗi 1442 do trigger đang ghi vào `ingredients`.
  Hãy `SELECT` lấy `ingredient_id` trước, rồi `INSERT ... VALUES (...)` ở câu riêng.
- Mật khẩu luôn lưu dạng băm bcrypt (backend băm); file SQL không bao giờ chứa mật khẩu thô.
- Hướng dẫn mở rộng chi tiết nằm ở cuối `V1__khoi_tao.sql`.
