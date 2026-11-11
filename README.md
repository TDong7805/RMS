# RMS — Hệ thống quản lý và vận hành nhà hàng

Đề tài nhóm 2. 6 actor: Quản trị viên, Khách hàng, Quản lý nhà hàng, Thu ngân, Nhân viên bếp, Quản lý kho. Đặc tả Use Case: `CodeUC_QLNH.docx`.

## Cấu trúc thư mục

```
RMS-main/
├── frontend/          Giao diện React + Vite + TypeScript (trang Quản lý nhà hàng)
├── database/          CSDL MySQL 8.0 dùng chung cho mọi actor (xem database/README.md)
└── CodeUC_QLNH.docx   Đặc tả Use Case
```

## Chạy frontend

Yêu cầu Node.js 18+.

```bash
cd frontend
npm install
npm run dev
```

Frontend hiện dùng dữ liệu mẫu trong bộ nhớ (`frontend/src/mocks`, `frontend/src/api`). Mỗi hàm API có ghi chú `[BACKEND-TODO]` chỉ rõ endpoint cần thay khi có backend.

## Tạo cơ sở dữ liệu

```powershell
& "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe" -u root -p --default-character-set=utf8mb4 -e "source database/rms_schema.sql"
```

## Chức năng Quản lý nhà hàng đã có giao diện

Dashboard thống kê · Thông báo · Quản lý đặt bàn & form đặt bàn · Sơ đồ khu vực bàn · Quản lý món ăn · Quản lý ca làm việc · Quản lý bài viết · Quản lý tài khoản · Quản lý Chatbot AI · Nhật ký hoạt động · Cấu hình hệ thống.
