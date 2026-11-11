# RMS Backend (Spring Boot)

API cho Hệ thống quản lý và vận hành nhà hàng. Java 17 · Spring Boot 3.5 · Spring JDBC · MySQL 8.0.

## Chạy lần đầu

Yêu cầu: JDK 17+, Maven 3.9+, MySQL 8.0.16+ đang chạy. Các lệnh PowerShell dưới đây chạy tại **thư mục gốc repo**.

**1. Khai báo kết nối:** sao chép `backend/.env.properties.example` thành `backend/.env.properties` rồi điền mật khẩu MySQL.
File này đã được `.gitignore` bỏ qua — không commit mật khẩu.

**2. Chạy backend** — CSDL được tạo tự động, không cần chạy file SQL nào:

```powershell
cd backend
mvn spring-boot:run          # API tại http://localhost:8080
```

Lần đầu, Flyway tạo CSDL `rms_db` (cấu trúc + dữ liệu mẫu) trong vài giây. Những lần sau chỉ chạy các file
thay đổi CSDL mới mà người khác đã thêm. Chi tiết, cách làm lại CSDL từ đầu và cách thêm bảng: [database/README.md](database/README.md).

> Đã có `rms_db` tạo bằng các file SQL cũ? Không cần làm gì: Flyway tự nhận và chỉ chạy phần mới.

Hoặc mở thư mục `backend` bằng IntelliJ IDEA và chạy lớp `com.rms.RmsApplication`
(working directory là `backend` hoặc thư mục gốc repo đều được).

**3. Chạy frontend** (cửa sổ khác): `cd frontend; npm run dev` → http://localhost:3000.
Vite tự chuyển mọi request `/api/...` sang backend cổng 8080 (đổi bằng biến `BACKEND_PORT`).

**4. Đăng nhập** bằng một trong các tài khoản mẫu, mật khẩu chung **`Rms@2026`** (chỉ có ở profile dev):

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
├── auth/          Đăng nhập, đổi mật khẩu, phân quyền theo vai trò (Spring Security, phiên lưu trong MySQL),
│                  BootstrapManager: tạo tài khoản quản lý đầu tiên khi chạy thật
├── common/        Dùng chung: xử lý lỗi, phân trang, chuỗi tiếng Việt, thời gian, người dùng hiện tại,
│                  FrontendConfig: phục vụ giao diện đã build khi đóng gói một file jar
├── account/       Quản lý tài khoản nhân viên
├── audit/         Nhật ký hoạt động (AuditService.log được mọi service gọi sau khi lưu)
├── settings/      Thông tin nhà hàng, giờ hoạt động, lịch sao lưu
├── table/         Khu vực, bàn, sơ đồ bàn
└── reservation/   Đặt bàn, cấu hình form đặt bàn, ReservationRules (quy tắc dùng chung)

src/main/resources/
├── application.properties        Cấu hình chung (đọc biến môi trường)
├── application-dev.properties    Khi phát triển (mặc định): dữ liệu mẫu, CORS cho Vite
├── application-prod.properties   Khi chạy thật: không dữ liệu mẫu, cookie chỉ qua HTTPS
└── db/migration, db/dev          File SQL của Flyway (xem database/README.md)
```

Mỗi phân hệ gồm `XxxController` (định nghĩa endpoint) và `XxxService` (nghiệp vụ + câu SQL qua `JdbcClient`).

## Môi trường dev / prod

| | `dev` (mặc định) | `prod` (`SPRING_PROFILES_ACTIVE=prod`) |
|---|---|---|
| Dữ liệu | Dữ liệu mẫu, tài khoản mật khẩu `Rms@2026` | Chỉ dữ liệu nền; quản lý đầu tiên tạo từ biến `RMS_BOOTSTRAP_*` |
| Cookie phiên | Gửi qua HTTP | Chỉ gửi qua HTTPS (`Secure`) |
| Frontend | Chạy riêng bằng `npm run dev` | Đóng gói chung trong `rms.jar` |
| Thiếu `DB_USER` / `DB_PASSWORD` | Dùng mặc định `root` / rỗng | Dừng ngay khi khởi động, báo thiếu biến |

Cách đóng gói và đưa lên máy chủ: [TRIEN_KHAI.md](../TRIEN_KHAI.md).

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
  Hết sau 2 giờ không thao tác; chọn "Ghi nhớ đăng nhập" thì giữ tới khi 7 ngày liền không thao tác.
  Phiên lưu trong MySQL (Spring Session JDBC): khởi động lại / cập nhật backend không đẩy ai ra ngoài.
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
| Quản lý tài khoản: tạo, sửa, khóa/mở khóa, đặt lại mật khẩu, xóa (mềm) | ✅ |
| Món ăn, Ca làm việc, Bài viết, Chatbot AI, Thông báo, Dashboard | ⏳ frontend còn dữ liệu giả |
| Sẵn sàng triển khai: Flyway, phiên lưu trong MySQL, profile dev/prod, đóng gói một file jar, tài khoản quản lý đầu tiên | ✅ (xem [TRIEN_KHAI.md](../TRIEN_KHAI.md)) |

## Dữ liệu của actor khác

Mọi actor dùng chung CSDL `rms_db`. Chức năng của Quản lý nhà hàng đọc dữ liệu do actor khác tạo ra
(ví dụ lịch đặt bàn do Khách hàng đặt). Khi phân hệ đó chưa có, dữ liệu mẫu nằm trong
`src/main/resources/db/dev/` (chỉ nạp ở profile dev). Khi viết phân hệ mới, hãy **dùng lại quy tắc có sẵn** thay vì viết lại —
ví dụ Khách hàng đặt bàn gọi `ReservationRules.validate(...)` để có đúng các kiểm tra trùng lịch,
sức chứa, giờ hoạt động như phía quản lý.
