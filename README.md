# RMS — Hệ thống quản lý nhà hàng Royal Beef

Đề tài nhóm 2. Nhà hàng mẫu: **Royal Beef** (chuyên bò, 38 món đang bán).
Repo này gồm phần **Quản lý nhà hàng, Quản lý kho, Thu ngân, Bếp** và **trang gọi món qua QR** cho khách ngồi tại bàn.
Website khách (giới thiệu, đặt bàn online) nằm ở repo riêng.

Actor: Quản lý nhà hàng (gộp Quản trị viên), Thu ngân, Nhân viên bếp, Quản lý kho, Khách hàng.

## Tài liệu

| Tài liệu | Nội dung |
|---|---|
| [docs/dac-ta/](docs/dac-ta/) | Đặc tả Use Case (Word): `CodeUC_QLNH.docx` (Quản lý nhà hàng), `DacTa_UC_QuanLyKho.docx`, `DacTa_UC_DatMon_Bep_ThuNgan.docx` |
| [docs/tien-do/](docs/tien-do/) | Tiến độ từng phần: [Kho](docs/tien-do/TIEN_DO_KHO.md), [Thu ngân – Bếp – Đặt món](docs/tien-do/TIEN_DO_THU_NGAN_BEP.md) (kèm việc để sau, quyết định chờ họp) |
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

Khách gọi món: quét mã QR của bàn (Quản lý → Khu vực bàn → in mã QR), đường dẫn dạng `/goi-mon/<mã QR riêng của bàn>`.
Thu ngân phải **mở bàn** thì khách mới gửi món được.
