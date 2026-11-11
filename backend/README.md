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

**Đã tạo `rms_db` từ trước (bản chưa có đăng nhập)?** Không cần tạo lại, chỉ chạy file nâng cấp:

```powershell
& $mysql -u root -p --default-character-set=utf8mb4 -e "source backend/database/migrations/001_dang_nhap.sql"
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

**5. Đăng nhập** bằng một trong các tài khoản mẫu, mật khẩu chung **`Rms@2026`** (chỉ dùng khi phát triển):

| Tài khoản | Vai trò | Vào trang |
|---|---|---|
| `tuan.nguyen` | Quản lý nhà hàng | `/` — toàn bộ trang quản lý |
| `linh.tran` | Thu ngân | `/thu-ngan` |
| `hung.pham` | Nhân viên bếp | `/bep` |
| `thao.bui` | Quản lý kho | `/kho` |
| `nam.hoang` | Nhân viên phục vụ | không đăng nhập được (chỉ để xếp ca, tính lương) |

> Mạng chặn IPv6 khiến Maven báo `Connect timed out` khi tải thư viện lần đầu? Chạy
> `$env:MAVEN_OPTS="-Djava.net.preferIPv4Stack=true"` rồi chạy lại lệnh mvn.

## Cấu trúc mã nguồn

```
src/main/java/com/rms/
├── auth/          Đăng nhập, đổi mật khẩu, phân quyền theo vai trò (Spring Security, session cookie)
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

## Đăng nhập & phân quyền

- **Không có đăng ký.** Quản lý cấp tài khoản; tài khoản mới (hoặc vừa được đặt lại mật khẩu) có
  `must_change_password = 1` → sau khi đăng nhập chỉ gọi được `/api/auth/**` cho tới khi đổi mật khẩu.
- **Phiên đăng nhập** là cookie `RMS_SESSION` (HttpOnly, SameSite=Lax), trình duyệt tự gửi kèm.
  Hết sau 2 giờ không thao tác; chọn "Ghi nhớ đăng nhập" thì giữ 7 ngày. Khởi động lại backend thì phải đăng nhập lại.
- **API:** `POST /api/auth/login`, `GET /api/auth/me`, `POST /api/auth/change-password`, `POST /api/auth/logout`.
- **Mã lỗi:** 401 = chưa đăng nhập / hết phiên / sai mật khẩu; 403 = không đủ quyền (hoặc phải đổi mật khẩu);
  429 = sai mật khẩu 5 lần liên tiếp, bị chặn 5 phút.
- **Khóa tài khoản có hiệu lực ngay:** mỗi request kiểm tra lại trạng thái trong CSDL (`ActiveUserFilter`).
- **Vai trò nào vào được đâu** khai báo ở `auth/StaffAreas.java` (backend) và `src/routes.tsx` (frontend).
- **Người đang thao tác** lấy bằng `CurrentUserService.get()` — `AuditService` dùng hàm này để ghi nhật ký đúng người.

**Thêm API cho phân hệ mới** (vd. Thu ngân): đặt đường dẫn `/api/cashier/...` và thêm
`.requestMatchers("/api/cashier/**").hasRole("CASHIER")` vào `SecurityConfig` **trước** dòng `/api/**`.
Hiện mọi API khác dưới `/api/**` chỉ dành cho Quản lý nhà hàng.

## Tiến độ nối backend (actor Quản lý nhà hàng)

| Chức năng | Trạng thái |
|---|---|
| Cấu hình hệ thống: thông tin nhà hàng, giờ hoạt động, lịch sao lưu | ✅ |
| Sao lưu / phục hồi dữ liệu thật (mysqldump) | ⏳ frontend còn giả lập |
| Khu vực & sơ đồ bàn | ✅ |
| Quản lý đặt bàn, cấu hình form đặt bàn | ✅ |
| Nhật ký hoạt động | ✅ |
| Đăng nhập, đổi mật khẩu, phân quyền 4 vai trò nhân viên | ✅ |
| Món ăn, Ca làm việc, Tài khoản, Bài viết, Chatbot AI, Thông báo, Dashboard | ⏳ frontend còn dữ liệu giả |

## Dữ liệu của actor khác

Mọi actor dùng chung CSDL `rms_db`. Chức năng của Quản lý nhà hàng đọc dữ liệu do actor khác tạo ra
(ví dụ lịch đặt bàn do Khách hàng đặt). Khi phân hệ đó chưa có, dữ liệu mẫu nằm trong
`database/rms_dev_seed.sql`. Khi viết phân hệ mới, hãy **dùng lại quy tắc có sẵn** thay vì viết lại —
ví dụ Khách hàng đặt bàn gọi `ReservationRules.validate(...)` để có đúng các kiểm tra trùng lịch,
sức chứa, giờ hoạt động như phía quản lý.
