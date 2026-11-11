# Triển khai RMS lên máy chủ thật

Toàn bộ hệ thống (API + giao diện) đóng gói thành **một file `rms.jar`**, chạy bằng Java 17, dùng MySQL 8.
Phía trước đặt một reverse proxy (Caddy hoặc Nginx) để có HTTPS.

```
Trình duyệt ──HTTPS──▶ Caddy / Nginx (cổng 443) ──▶ rms.jar (cổng 8080, chỉ mở trong máy) ──▶ MySQL
```

Khác với khi phát triển: không có dữ liệu mẫu, không có tài khoản `Rms@2026`. Cookie đăng nhập chỉ gửi qua HTTPS.
Thiếu cấu hình CSDL thì backend dừng ngay và báo thiếu biến nào.

## 1. Đóng gói (trên máy phát triển)

```powershell
cd frontend
npm ci
npm run build                  # → frontend/dist
cd ../backend
mvn -Pbundle clean package     # → backend/target/rms.jar (đã chứa giao diện)
```

Chạy thử ngay trên máy: `java -jar target/rms.jar --spring.profiles.active=prod` rồi mở http://localhost:8080.
Chạy thử không có HTTPS mà mở bằng địa chỉ IP (vd. từ điện thoại trong cùng mạng) thì đặt thêm `COOKIE_SECURE=false`,
nếu không trình duyệt sẽ không giữ đăng nhập.

## 2. Chuẩn bị máy chủ

- Java 17 (ví dụ Eclipse Temurin 17) và MySQL **8.0.16+**.
- Tạo CSDL và tài khoản MySQL riêng cho ứng dụng (không dùng `root`):

  ```sql
  CREATE DATABASE rms_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
  CREATE USER 'rms'@'localhost' IDENTIFIED BY 'mat-khau-manh-o-day';
  GRANT ALL PRIVILEGES ON rms_db.* TO 'rms'@'localhost';
  ```

- Nếu lần chạy đầu Flyway báo lỗi **1419** khi tạo trigger: MySQL đang bật binary log và tài khoản không phải
  `root` chưa được tạo trigger. Chạy `SET PERSIST log_bin_trust_function_creators = 1;` bằng `root`.
  Với MySQL thuê (AWS RDS, Azure...), đặt tham số này trong phần cấu hình của dịch vụ.

## 3. Cấu hình

Tạo file `.env.properties` **cạnh file `rms.jar`** (chỉ người chạy ứng dụng được đọc, ví dụ `chmod 600`).
Hoặc đặt các biến này làm biến môi trường. Trong file này chỉ dùng **ký tự không dấu**: Java đọc file `.properties`
theo bảng mã ISO-8859-1.

```properties
DB_HOST=localhost
DB_PORT=3306
DB_NAME=rms_db
DB_USER=rms
DB_PASSWORD=mat-khau-manh-o-day

# Chỉ cho lần chạy đầu — tạo tài khoản Quản lý nhà hàng đầu tiên:
RMS_BOOTSTRAP_USERNAME=quanly
RMS_BOOTSTRAP_PASSWORD=MatKhauTam2026
RMS_BOOTSTRAP_EMAIL=quanly@ten-nha-hang.vn
```

| Biến | Bắt buộc | Ý nghĩa |
|---|---|---|
| `DB_HOST`, `DB_PORT`, `DB_NAME` | không (mặc định `localhost`, `3306`, `rms_db`) | Địa chỉ MySQL |
| `DB_USER`, `DB_PASSWORD` | **có** | Tài khoản MySQL của ứng dụng |
| `DB_SSL_MODE` | không (mặc định `DISABLED`) | Đặt `REQUIRED` khi MySQL nằm ở máy khác |
| `PORT` | không (mặc định `8080`) | Cổng của `rms.jar` |
| `COOKIE_SECURE` | không (mặc định `true`) | Chỉ đặt `false` khi chạy thử trong mạng nội bộ không có HTTPS |
| `RMS_UPLOAD_DIR` | nên đặt (mặc định thư mục `uploads` nơi chạy jar) | Thư mục lưu ảnh món ăn... Đặt đường dẫn cố định, ví dụ `/var/lib/rms/uploads`, và sao lưu cùng CSDL |
| `RMS_BOOTSTRAP_USERNAME`, `_PASSWORD`, `_EMAIL` | lần đầu | Tài khoản quản lý đầu tiên (mật khẩu 8–64 ký tự, có chữ và số) |
| `RMS_CORS_ALLOWED_ORIGINS` | không | Chỉ khi giao diện đặt ở tên miền khác API (mặc định không cần) |

Chế độ chạy thật bật bằng tham số `--spring.profiles.active=prod` khi chạy (hoặc biến môi trường
`SPRING_PROFILES_ACTIVE=prod`), **không** đặt trong `.env.properties`.

## 4. Chạy lần đầu

```bash
java -jar rms.jar --spring.profiles.active=prod
```

1. Flyway tạo toàn bộ bảng và dữ liệu nền (vai trò, quyền, cấu hình mặc định). Log có dòng
   `Đã tạo tài khoản quản lý đầu tiên 'quanly'`.
2. Mở trang web, đăng nhập bằng tài khoản đó → hệ thống bắt đổi mật khẩu ngay. Họ tên mặc định là
   "Quản lý nhà hàng" — sửa lại trong trang Tài khoản.
3. **Xóa 3 dòng `RMS_BOOTSTRAP_*`** khỏi `.env.properties` (để mật khẩu tạm không còn nằm trên máy chủ).
4. Nhập dữ liệu thật: Cấu hình hệ thống (thông tin nhà hàng, giờ mở cửa), Khu vực bàn, Tài khoản nhân viên...

Đã có quản lý rồi thì các biến `RMS_BOOTSTRAP_*` bị bỏ qua; khai báo sai (mật khẩu yếu, email sai) thì backend
dừng và báo lỗi cụ thể.

### Chạy nền, tự khởi động lại (Linux, systemd)

`/etc/systemd/system/rms.service`:

```ini
[Unit]
Description=RMS - quan ly nha hang
After=network.target mysql.service

[Service]
User=rms
WorkingDirectory=/opt/rms
ExecStart=/usr/bin/java -Xms256m -Xmx512m -jar /opt/rms/rms.jar --spring.profiles.active=prod
# Tắt bằng SIGTERM: chờ các request đang chạy xong rồi mới dừng; Java thoát với mã 143.
SuccessExitStatus=143
Restart=always

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable --now rms
journalctl -u rms -f        # xem log
```

Máy chủ Windows: dùng [NSSM](https://nssm.cc) hoặc WinSW để chạy `java -jar ...` thành Windows Service.

## 5. HTTPS bằng reverse proxy

**Caddy** (tự xin và gia hạn chứng chỉ Let's Encrypt). `Caddyfile`:

```
quanly.ten-nha-hang.vn {
    reverse_proxy localhost:8080
}
```

**Nginx** (chứng chỉ lấy bằng certbot):

```nginx
server {
    listen 443 ssl;
    server_name quanly.ten-nha-hang.vn;
    # ssl_certificate ... ; ssl_certificate_key ... ;  (certbot tự điền)
    client_max_body_size 10m;
    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

- **Chặn cổng 8080 từ Internet** (tường lửa chỉ mở 80, 443). Backend chỉ tin header `X-Forwarded-*` từ proxy
  cùng máy / mạng nội bộ, nhờ đó nhật ký hoạt động ghi đúng IP người dùng.
- MySQL cũng chỉ nghe trong máy (`bind-address = 127.0.0.1`) nếu chạy cùng máy chủ.

## 6. Cập nhật phiên bản mới

1. Sao lưu CSDL (mục 7).
2. Đóng gói `rms.jar` mới (mục 1), chép đè lên máy chủ.
3. `sudo systemctl restart rms`. Flyway tự chạy các file thay đổi CSDL mới (`V3__...`, `V4__...`).
   Phiên đăng nhập lưu trong MySQL nên người đang dùng không bị đăng xuất.

## 7. Sao lưu và phục hồi

> Chức năng "Sao lưu / phục hồi" trong trang Cấu hình hệ thống **hiện vẫn là giả lập**. Khi chạy thật phải sao lưu
> bằng công cụ của MySQL như dưới đây.

Sao lưu hằng ngày (cron, giữ 30 bản), mật khẩu đặt trong `~/.my.cnf` của người chạy cron:

```bash
# /etc/cron.d/rms-backup  — 2 giờ sáng mỗi ngày
0 2 * * * rms mysqldump --single-transaction --routines --triggers rms_db | gzip > /var/backups/rms/rms_$(date +\%F).sql.gz && find /var/backups/rms -name '*.sql.gz' -mtime +30 -delete
```

Sao lưu cả **thư mục ảnh** (`RMS_UPLOAD_DIR`) — CSDL chỉ lưu tên file ảnh:

```bash
# /etc/cron.d/rms-backup-uploads — 2 giờ 30 mỗi ngày
30 2 * * * rms tar -czf /var/backups/rms/uploads_$(date +\%F).tar.gz -C /var/lib/rms uploads && find /var/backups/rms -name 'uploads_*.tar.gz' -mtime +30 -delete
```

Chép bản sao lưu ra **máy khác** (ổ cứng ngoài, dịch vụ lưu trữ) — hỏng máy chủ thì vẫn còn dữ liệu.
Thỉnh thoảng thử phục hồi vào một CSDL trống để chắc bản sao lưu dùng được:

```bash
mysql -e "CREATE DATABASE rms_restore_test CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
gunzip < /var/backups/rms/rms_2026-11-12.sql.gz | mysql rms_restore_test
```

## 8. Theo dõi

- `https://quanly.ten-nha-hang.vn/actuator/health` trả `{"status":"UP"}` khi ứng dụng và kết nối CSDL bình thường.
  Gắn địa chỉ này vào dịch vụ theo dõi (UptimeRobot, Better Stack...) để được báo khi hệ thống ngừng.
- Log: `journalctl -u rms` (systemd). Lỗi khởi động (thiếu biến, sai mật khẩu MySQL, lỗi Flyway) đều ghi rõ ở đây.

## 9. Kiểm tra trước khi giao cho nhà hàng

- [ ] Mở bằng `https://`, trình duyệt không cảnh báo chứng chỉ.
- [ ] Cổng 8080 và 3306 không truy cập được từ bên ngoài.
- [ ] Tài khoản MySQL của ứng dụng không phải `root`.
- [ ] Đã đổi mật khẩu quản lý đầu tiên và xóa `RMS_BOOTSTRAP_*` khỏi `.env.properties`.
- [ ] Sao lưu tự động đang chạy, đã thử phục hồi được.

## Quên mật khẩu của quản lý duy nhất

Có quản lý khác: người đó vào Tài khoản → Đặt lại mật khẩu. Không còn ai:

1. Khóa tài khoản quản lý cũ bằng SQL: `UPDATE users SET status = 'locked' WHERE username = 'quanly';`
2. Đặt lại `RMS_BOOTSTRAP_*` với **tên đăng nhập và email khác**, khởi động lại → có quản lý mới.
3. Đăng nhập quản lý mới, đặt lại mật khẩu và mở khóa tài khoản cũ (hoặc xóa đi).

## Chưa sẵn sàng cho chạy thật

- Trang Bài viết, Thông báo, Dashboard và phần cấu hình / FAQ / lịch sử / thống kê của Chatbot AI vẫn dùng
  dữ liệu giả trong trình duyệt (mất khi tải lại trang). Sao lưu / phục hồi trong trang Cấu hình là giả lập.
- Các phân hệ Thu ngân, Bếp, Kho, Khách hàng chưa xây dựng.
- Chặn dò mật khẩu (sai 5 lần → chặn 5 phút) đếm trong bộ nhớ: đủ cho một máy chủ; chạy nhiều máy chủ thì mỗi máy đếm riêng.
- Ảnh lưu trên ổ đĩa máy chủ: chạy nhiều máy chủ cùng lúc thì cần chuyển sang S3/R2 (viết thêm một lớp
  `StorageService`, xem `com.rms.storage`).
- Chưa có Docker. Thêm `Dockerfile` khi đã chọn nơi triển khai (máy chủ riêng hay dịch vụ cloud).
