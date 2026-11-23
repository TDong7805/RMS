# RMS — Hệ thống quản lý nhà hàng Royal Beef

Đề tài nhóm 2. Nhà hàng mẫu: **Royal Beef** (chuyên bò, 38 món đang bán).
Repo này gồm phần **Quản lý nhà hàng, Quản lý kho, Thu ngân, Bếp, Nhân viên phục vụ** (kèm chấm công khuôn mặt), **trang gọi món qua QR** cho khách ngồi tại bàn
và **website khách hàng** công khai ở `/` (giới thiệu, thực đơn, album ảnh, liên hệ, đặt bàn trực tuyến — không cần đăng nhập; nội dung do Quản lý cấu hình ở Cấu hình hệ thống → Website khách hàng).

Actor: Quản lý nhà hàng (gộp Quản trị viên), Thu ngân, Nhân viên bếp, Quản lý kho, Nhân viên phục vụ (từ V20), Khách hàng.

## Chatbot tư vấn món dùng Google Gemini

Trợ lý trên trang gọi món QR trả lời bằng **Gemini** nếu máy chạy backend có API key; không có key thì tự trả lời theo luật (vẫn dùng được).
1. Lấy key miễn phí ở [Google AI Studio](https://aistudio.google.com) → *Get API key*.
2. **Dán key:** mở file **`backend/.env.properties`** (file riêng của từng máy, git bỏ qua — cùng file chứa mật khẩu MySQL;
   chưa có thì copy từ `backend/.env.properties.example`), thêm một dòng ở cuối rồi lưu:
   ```properties
   GEMINI_API_KEY=dán-key-của-bạn-vào-đây
   ```
   Khởi động lại backend. (Cách khác: PowerShell `setx GEMINI_API_KEY "key"` rồi mở lại terminal / VS Code.)
3. *Quản lý Chatbot → Cấu hình → Trí tuệ nhân tạo (Google Gemini)*: bật / tắt, đổi model, **Thử kết nối**.

Key **không** để trong code hay CSDL (chỉ lưu tên biến `GEMINI_API_KEY`), mỗi người dùng key của mình — đừng commit / gửi key.
Chi tiết: `docs/tien-do/TIEN_DO_TRO_LY_GOI_MON.md`.

## Tài liệu

| Tài liệu | Nội dung |
|---|---|
| [docs/dac-ta/](docs/dac-ta/) | Đặc tả Use Case (Word): `CodeUC_QLNH.docx` (Quản lý nhà hàng), `DacTa_UC_QuanLyKho.docx`, `DacTa_UC_DatMon_Bep_ThuNgan.docx` |
| [docs/tien-do/](docs/tien-do/) | Tiến độ từng phần: [Kho](docs/tien-do/TIEN_DO_KHO.md), [Thu ngân – Bếp – Đặt món](docs/tien-do/TIEN_DO_THU_NGAN_BEP.md) (kèm việc để sau, quyết định chờ họp), [Phục vụ – Chấm công khuôn mặt](docs/tien-do/TIEN_DO_PHUC_VU_CHAM_CONG.md), [Website khách hàng](docs/tien-do/TIEN_DO_WEBSITE_KHACH.md) |
| [docs/kiem-thu/KICH_BAN_TEST.md](docs/kiem-thu/KICH_BAN_TEST.md) | Kịch bản thử bằng tay theo từng vai |
| [tests/](tests/README.md) | Kiểm thử API tự động (`node tests/run-all.mjs`) |
| [docs/du-lieu/DU_LIEU_GIA.md](docs/du-lieu/DU_LIEU_GIA.md) | Chỗ nào còn dữ liệu giả / dữ liệu mẫu và cách thay |
| [docs/trien-khai/TRIEN_KHAI.md](docs/trien-khai/TRIEN_KHAI.md) | Đóng gói `rms.jar` và đưa lên máy chủ thật |
| [backend/README.md](backend/README.md), [backend/database/README.md](backend/database/README.md) | Cấu hình backend, CSDL, migration, dữ liệu mẫu |
| [tools/dac-ta/](tools/dac-ta/README.md) | Script sinh file Word đặc tả Đặt món – Bếp – Thu ngân |

## Cấu trúc thư mục

```
RMS/
├── frontend/   React + Vite + TypeScript (mọi trang nhân viên + trang gọi món QR)
├── backend/    Spring Boot 3.5 API, MySQL 8.0 (Flyway tự tạo bảng và dữ liệu mẫu)
├── tests/      Kiểm thử API tự động
├── docs/       Đặc tả, tiến độ, kịch bản test, triển khai
├── tools/      Script sinh tài liệu
└── dev.ps1     Chạy cả backend + frontend một lệnh
```

## Chạy dự án

Yêu cầu: Node.js 18+, JDK 17+, Maven 3.9+, MySQL 8.0.16+.

1. Tạo `backend/.env.properties` khai báo tài khoản MySQL (xem [backend/README.md](backend/README.md)). File này không đưa lên git.
2. Lần đầu: `cd frontend && npm install`.
3. Ở thư mục gốc (PowerShell):

   ```powershell
   .\dev.ps1              # backend :8080 (CSDL rms_db) + frontend http://localhost:3000
   .\dev.ps1 -Test        # chạy trên CSDL thử rms_test, không đụng dữ liệu thật
   .\dev.ps1 -ResetTest   # xóa sạch rms_test rồi chạy lại với dữ liệu mẫu mới
   ```

   Hoặc chạy riêng: `cd backend && mvn spring-boot:run`, `cd frontend && npm run dev`.

CSDL và dữ liệu mẫu tự được tạo ở lần chạy đầu.

### Tài khoản mẫu

Mật khẩu chung `Rms@2026`. Không có trang đăng ký — Quản lý cấp tài khoản.

| Tài khoản | Vai trò | Trang chính |
|---|---|---|
| `tuan.nguyen` | Quản lý nhà hàng | `/quan-ly` |
| `linh.tran` | Thu ngân | `/thu-ngan` |
| `hung.pham` | Nhân viên bếp | `/bep` |
| `thao.bui` | Quản lý kho | `/kho` |
| `nam.hoang` | Nhân viên phục vụ (khu Tầng 1) | `/phuc-vu` — giao diện điện thoại |

Website khách hàng: mở `http://localhost:3000/` (không đăng nhập) — Giới thiệu, Thực đơn, Đặt bàn, Album ảnh, Liên hệ. Lịch khách đặt hiện ở Quản lý → Đặt bàn → Lịch sử đặt bàn (nguồn "Website") kèm thông báo cho Quản lý.
Nhân viên vào trang làm việc bằng `/dang-nhap` (link "Đăng nhập nhân viên" ở chân website).

Khách gọi món: quét mã QR của bàn (Quản lý → Khu vực bàn → in mã QR), đường dẫn dạng `/goi-mon/<mã QR riêng của bàn>`.
Thu ngân hoặc phục vụ phải **mở bàn** thì khách mới gửi món được. Khách *gọi nhân viên* → phục vụ của khu đó nhận; *yêu cầu thanh toán* → thu ngân.

Chấm công khuôn mặt (phục vụ, thu ngân, bếp) dùng camera của điện thoại: trình duyệt chỉ cho mở camera khi trang chạy **HTTPS** (hoặc `localhost` trên laptop) — xem [TRIEN_KHAI.md](docs/trien-khai/TRIEN_KHAI.md).
