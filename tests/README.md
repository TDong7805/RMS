# Kiểm thử API tự động

Bộ kiểm thử gọi thẳng API của backend đang chạy (giống frontend gọi) và đối chiếu kết quả, kể cả dữ liệu trong MySQL.
Mỗi bước in `PASS` / `FAIL`. Hiện có **15 bộ, khoảng 670 bước** — chạy hết khoảng 1 phút (bộ 05 chờ ~15 giây để thử tự đóng bàn).

Đây là kiểm thử **mức API** (gọi qua HTTP). Kiểm thử đơn vị JUnit cho các công thức tính toán chưa làm — xem mục "Việc để sau" trong [docs/tien-do/TIEN_DO_THU_NGAN_BEP.md](../docs/tien-do/TIEN_DO_THU_NGAN_BEP.md).

## Cách chạy

Kiểm thử **tạo / sửa / xóa dữ liệu**, nên luôn chạy trên CSDL test riêng `rms_test`, không bao giờ trên `rms_db` (bộ kiểm thử tự từ chối nếu thấy `rms_db`).

1. Chạy hệ thống ở chế độ test, dữ liệu mẫu mới tinh (PowerShell, ở thư mục gốc):

   ```powershell
   .\dev.ps1 -ResetTest     # xóa rms_test + backend\uploads-test rồi chạy backend (8080) + frontend
   ```

2. Mở cửa sổ khác, chạy kiểm thử:

   ```bash
   node tests/run-all.mjs           # chạy tất cả
   node tests/run-all.mjs kho       # chỉ chạy bộ có tên chứa "kho"
   node tests/api/03-thu-ngan.mjs   # chạy riêng một bộ, xem chi tiết từng bước
   ```

   Cuối cùng in bảng tổng kết; có bước không đạt thì mã thoát là 1.

Không có `dev.ps1` (script riêng trên máy cá nhân)? Chạy backend test ở cổng khác, backend chính vẫn chạy bình thường:

```powershell
mysql -u root -p -e "DROP DATABASE IF EXISTS rms_test"; Remove-Item -Recurse -Force backend\uploads-test -ErrorAction SilentlyContinue
cd backend; $env:DB_NAME='rms_test'; $env:PORT='8081'; $env:RMS_UPLOAD_DIR='uploads-test'; $env:RMS_BACKUP_DIR='backups-test'; mvn spring-boot:run
```

rồi `RMS_API=http://localhost:8081 node tests/run-all.mjs`. **Không bao giờ** trỏ `RMS_API` vào backend đang dùng `rms_db`:
các bộ chỉ gọi API (không đụng mysql) vẫn sửa dữ liệu của backend đó dù đã đặt `RMS_TEST_DB`.

**Chạy lại lần nữa thì `-ResetTest` trước.** Các bộ dựa vào dữ liệu mẫu ban đầu (số món, mã món kế tiếp, bàn trống…), nên chạy lần hai trên dữ liệu đã bị sửa sẽ báo sai.

Yêu cầu: Node.js 18+, MySQL client (`mysql.exe` của MySQL 8.0; bộ kiểm thử dùng nó để chuẩn bị / đối chiếu dữ liệu). Mật khẩu MySQL đọc từ `backend/.env.properties`, không in ra.

### Biến môi trường (không bắt buộc)

| Biến | Mặc định | Dùng khi |
|---|---|---|
| `RMS_API` | `http://localhost:8080` | backend chạy ở cổng khác |
| `RMS_TEST_DB` | `rms_test` | backend dùng CSDL test tên khác |
| `RMS_UPLOADS` | `backend/uploads-test` | backend lưu ảnh ở thư mục khác (để kiểm file ảnh được tạo / xóa) |
| `MYSQL_BIN` | MySQL 8.0 trên Windows, hoặc `mysql` trong PATH | mysql.exe nằm chỗ khác |
| `MYSQL_USER`, `MYSQL_PWD` | đọc trong `backend/.env.properties` | không có file đó |

Ví dụ (Git Bash): `RMS_API=http://localhost:8081 RMS_TEST_DB=rms_kho_test node tests/run-all.mjs`

## Các bộ kiểm thử

Mã ở cột "Kịch bản" là số dòng trong [docs/kiem-thu/KICH_BAN_TEST.md](../docs/kiem-thu/KICH_BAN_TEST.md) (kịch bản thử bằng tay).

| File | Kịch bản | Nội dung |
|---|---|---|
| `01-dang-nhap-phan-quyen.mjs` | G1–G3, G7 | Đăng nhập, khóa khi sai nhiều lần, phân quyền theo khu vực, đổi mật khẩu, phiên |
| `02-dat-mon-bep.mjs` | B, C | Khách gọi món qua QR; bếp bắt đầu / xong / Đã lấy / hủy món / món tạm hết |
| `03-thu-ngan.mjs` | A, D1–D16 | Yêu cầu khách (thanh toán → thu ngân, hỗ trợ → phục vụ), hủy món / hủy đơn, chuyển bàn, hóa đơn, thanh toán |
| `04-cham-cong-luong-cong-thuc.mjs` | C8–C16, D17–D33 | Chấm công từ Excel, kỳ lương, công thức định lượng, kiểm tra nguyên liệu |
| `05-mo-ban.mjs` | A2b, B22–B25 | Mở bàn, đóng bàn, tự đóng bàn (bộ này chờ ~1 phút để thử tự đóng) |
| `06-kho.mjs` | F1–F12, E3, E11, E12 | Nguyên liệu, nhà cung cấp, phiếu mua, nhập / xuất, kiểm kê, công nợ |
| `07-tai-khoan.mjs` | E14, E15 | Tài khoản nhân viên |
| `08-mon-an.mjs` | E8, E9 | Món ăn, danh mục, ảnh món, thực đơn AI, set (API combo cũ) |
| `09-bai-viet.mjs` | E13 | Bài viết |
| `10-ca-lam.mjs` | E10 | Ca làm việc, phân công |
| `11-chatbot.mjs` | E16 | Cấu hình chatbot, FAQ |
| `13-phuc-vu-cham-cong.mjs` | A22–A25, H1–H18 | Phục vụ: quyền, khu vực theo ca, yêu cầu hỗ trợ theo khu, mở bàn, gọi món hộ, bưng món, ghép / chuyển bàn, sự kiện "sơ đồ đổi"; chấm công khuôn mặt: đăng ký / duyệt, WiFi quán, vào ca / tan ca, trễ / sớm, ảnh không công khai; hồ sơ, phiếu lương |
| `14-tro-ly-goi-mon.mjs` | — | Trợ lý gọi món trên trang QR (theo luật; cấu hình Gemini — bộ này tắt Gemini để không phụ thuộc mạng / key): ngân sách, số người, cay / chay / trẻ em / dị ứng, loại món, hỏi một món, ăn kèm theo giỏ, set menu, món tạm hết; nối Quản lý Chatbot: lời chào, FAQ, câu hỏi chưa giải đáp, món tắt "cho AI gợi ý", tắt Chatbot |
| `15-website-khach.mjs` | — | Website khách hàng (không đăng nhập): thông tin nhà hàng không lộ dữ liệu nội bộ, thực đơn (tìm không dấu, lọc danh mục, ẩn món / danh mục khỏi website), nội dung + ảnh banner, album (thêm / ẩn / đổi thứ tự / xóa file); đặt bàn: lỗi theo trường, ngày nghỉ, quá 30 ngày, SĐT quá 3 lịch, trùng lịch, chọn khu / tự xếp khu, tự xác nhận, bản ghi `reservations` + thông báo Quản lý, giới hạn 5 lượt / IP / 10 phút (chạy lại phải khởi động lại backend) |
| `12-nhom-mon-set.mjs` | B26–B37, C0, E8c, E8d | Nhóm món (thẻ gộp nhiều loại), Set menu: thực đơn QR, gửi set, chia giá, hủy set, bếp, hóa đơn 1 dòng set, ẩn set khi món con hết / ngoài giờ, quản lý nhóm và set |

## Cấu trúc

```
tests/
├── run-all.mjs        chạy lần lượt tests/api/*.mjs, in tổng kết
├── lib/env.mjs        cấu hình chung: địa chỉ API, CSDL test, hàm sql() để đối chiếu dữ liệu
├── api/               các bộ kiểm thử (đánh số theo thứ tự chạy)
└── fixtures/          file mẫu dùng khi kiểm thử (Excel / CSV chấm công; make_att_files.py tạo lại chúng)
```

## Khi sửa / thêm chức năng

- Đổi hành vi một API → sửa bước tương ứng trong bộ kiểm thử, chạy lại cho hết `FAIL`.
- Đổi dữ liệu mẫu (`backend/src/main/resources/db/dev`) → các bước đếm số lượng / mã món có thể phải sửa theo.
- Thêm chức năng mới → thêm file `tests/api/NN-ten.mjs`, dòng đầu ghi `// [NN-ten.mjs] mã kịch bản: nội dung`, import từ `../lib/env.mjs`, in mỗi bước `PASS tên` hoặc `FAIL tên — chi tiết`.

> Bộ 05 có một bước cần phiếu đặt bàn mẫu trong 2 giờ tới — chạy sau ~21h (khi dữ liệu mẫu không còn phiếu đặt trong ngày) bước này báo FAIL "không có"; đó là do giờ chạy, không phải lỗi.
