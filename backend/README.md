# RMS Backend (Spring Boot)

API cho Hệ thống quản lý và vận hành nhà hàng. Java 17 · Spring Boot 3.5 · Spring JDBC · MySQL 8.0.

## Chạy lần đầu

Yêu cầu: JDK 17+, Maven 3.9+, MySQL 8.0.16+. Các lệnh PowerShell dưới đây chạy tại **thư mục gốc repo**.

**1. Tạo CSDL** (xem chi tiết ở [database/README.md](database/README.md))

```powershell
$mysql = "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe"
& $mysql -u root -p --default-character-set=utf8mb4 -e "source backend/database/rms_schema.sql"    # XÓA và tạo lại rms_db
& $mysql -u root -p --default-character-set=utf8mb4 -e "source backend/database/rms_verify.sql"    # phải in toàn PASS
& $mysql -u root -p --default-character-set=utf8mb4 -e "source backend/database/rms_dev_seed.sql"  # dữ liệu mẫu để demo
```

**2. Khai báo kết nối:** sao chép `backend/.env.properties.example` thành `backend/.env.properties` rồi điền mật khẩu MySQL.
File này đã được `.gitignore` bỏ qua — không commit mật khẩu.

**3. Chạy backend**

```powershell
cd backend
mvn spring-boot:run          # API tại http://localhost:8080
```

Hoặc mở thư mục `backend` bằng IntelliJ IDEA và chạy lớp `com.rms.RmsApplication`
(working directory là `backend` hoặc thư mục gốc repo đều được).

**4. Chạy frontend** (cửa sổ khác): `cd frontend; npm run dev` → http://localhost:3000.
Vite tự chuyển mọi request `/api/...` sang backend cổng 8080 (đổi bằng biến `BACKEND_PORT`).

> Mạng chặn IPv6 khiến Maven báo `Connect timed out` khi tải thư viện lần đầu? Chạy
> `$env:MAVEN_OPTS="-Djava.net.preferIPv4Stack=true"` rồi chạy lại lệnh mvn.

## Cấu trúc mã nguồn

```
src/main/java/com/rms/
├── common/        Dùng chung: xử lý lỗi, phân trang, chuỗi tiếng Việt, thời gian, người dùng hiện tại
├── audit/         Nhật ký hoạt động (AuditService.log được mọi service gọi sau khi lưu)
├── settings/      Thông tin nhà hàng, giờ hoạt động, lịch sao lưu
├── table/         Khu vực, bàn, sơ đồ bàn
└── reservation/   Đặt bàn, cấu hình form đặt bàn, ReservationRules (quy tắc dùng chung)
```

Mỗi phân hệ gồm `XxxController` (định nghĩa endpoint) và `XxxService` (nghiệp vụ + câu SQL qua `JdbcClient`).

## Quy ước API (frontend phụ thuộc vào các quy ước này)

| Nội dung | Quy ước |
|---|---|
| Lỗi dữ liệu theo trường | HTTP 422 `{"message": "...", "fields": {"phone": "..."}}` → form hiện lỗi dưới từng ô |
| Lỗi nghiệp vụ | 404 / 409 / 400 `{"message": "..."}` → frontend hiện toast |
| Id | Chuỗi số (`"12"`), dù trong CSDL là `BIGINT` |
| Thời gian | ISO-8601 UTC (`2026-11-11T12:30:00Z`); CSDL lưu giờ Việt Nam (+07:00) |
| Danh sách có phân trang | `{"items": [...], "total", "page", "pageCount"}` |
| Nhật ký | Service tự ghi trong cùng transaction — lưu lỗi thì không có dòng nhật ký |

**Chưa có đăng nhập:** mọi thao tác được ghi dưới tài khoản `rms.dev-user` (mặc định `tuan.nguyen`).
Khi làm JWT chỉ cần sửa `CurrentUserService.get()`.

## Tiến độ nối backend (actor Quản lý nhà hàng)

| Chức năng | Trạng thái |
|---|---|
| Cấu hình hệ thống: thông tin nhà hàng, giờ hoạt động, lịch sao lưu | ✅ |
| Sao lưu / phục hồi dữ liệu thật (mysqldump) | ⏳ frontend còn giả lập |
| Khu vực & sơ đồ bàn | ✅ |
| Quản lý đặt bàn, cấu hình form đặt bàn | ✅ |
| Nhật ký hoạt động | ✅ |
| Món ăn, Ca làm việc, Tài khoản, Bài viết, Chatbot AI, Thông báo, Dashboard | ⏳ frontend còn dữ liệu giả |

## Dữ liệu của actor khác

Mọi actor dùng chung CSDL `rms_db`. Chức năng của Quản lý nhà hàng đọc dữ liệu do actor khác tạo ra
(ví dụ lịch đặt bàn do Khách hàng đặt). Khi phân hệ đó chưa có, dữ liệu mẫu nằm trong
`database/rms_dev_seed.sql`. Khi viết phân hệ mới, hãy **dùng lại quy tắc có sẵn** thay vì viết lại —
ví dụ Khách hàng đặt bàn gọi `ReservationRules.validate(...)` để có đúng các kiểm tra trùng lịch,
sức chứa, giờ hoạt động như phía quản lý.
