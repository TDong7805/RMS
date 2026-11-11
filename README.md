# RMS — Hệ thống quản lý và vận hành nhà hàng

Đề tài nhóm 2. 5 actor: Quản lý nhà hàng (gộp cả Quản trị viên), Thu ngân, Nhân viên bếp, Quản lý kho, Khách hàng. Đặc tả Use Case: `CodeUC_QLNH.docx`.

## Cấu trúc thư mục

```
RMS-main/
├── frontend/          Giao diện React + Vite + TypeScript (trang Quản lý nhà hàng)
├── backend/           Spring Boot API; CSDL MySQL 8.0 dùng chung cho mọi actor (Flyway tự tạo, xem backend/database)
├── TRIEN_KHAI.md      Hướng dẫn đóng gói và đưa lên máy chủ thật
├── DU_LIEU_GIA.md     Những chỗ còn dữ liệu giả / dữ liệu mẫu và cách thay
└── CodeUC_QLNH.docx   Đặc tả Use Case
```

## Chạy dự án

Yêu cầu: Node.js 18+, JDK 17+, Maven 3.9+, MySQL 8.0.16+.

1. **Backend:** làm theo [backend/README.md](backend/README.md) — khai báo mật khẩu MySQL trong `backend/.env.properties`,
   chạy `mvn spring-boot:run` → cổng 8080. CSDL `rms_db` và dữ liệu mẫu được tạo tự động ở lần chạy đầu.
2. **Frontend:**

   ```bash
   cd frontend
   npm install
   npm run dev      # http://localhost:3000 — request /api được chuyển sang backend
   ```

3. **Đăng nhập:** tài khoản mẫu `tuan.nguyen` (Quản lý), `linh.tran` (Thu ngân), `hung.pham` (Bếp),
   `thao.bui` (Kho), mật khẩu chung `Rms@2026`. Không có trang đăng ký — quản lý cấp tài khoản.

Các trang Đặt bàn, Khu vực bàn, Món ăn, Ca làm việc, Bài viết, Tài khoản, Nhật ký, Cấu hình hệ thống và Chatbot AI (cấu hình, thực đơn, FAQ) đã dùng dữ liệu thật từ MySQL.
Những chỗ còn dữ liệu giả (Dashboard, Thông báo, lịch sử / thống kê Chatbot, Sao lưu) và dữ liệu mẫu mô phỏng actor chưa làm: xem **[DU_LIEU_GIA.md](DU_LIEU_GIA.md)**.
Tiến độ chi tiết: xem bảng trong [backend/README.md](backend/README.md).

## Chức năng Quản lý nhà hàng đã có giao diện

Dashboard thống kê · Thông báo · Quản lý đặt bàn & form đặt bàn · Sơ đồ khu vực bàn · Quản lý món ăn · Quản lý ca làm việc · Quản lý bài viết · Quản lý tài khoản · Quản lý Chatbot AI · Nhật ký hoạt động · Cấu hình hệ thống.

## Triển khai thật

Đóng gói thành một file `rms.jar` (gồm cả giao diện), cấu hình bằng biến môi trường, chạy sau HTTPS:
xem [TRIEN_KHAI.md](TRIEN_KHAI.md).
