# Ảnh mẫu cho dữ liệu demo (chỉ môi trường dev)

Backend chạy ở chế độ **dev** (mặc định khi `mvn spring-boot:run`, IntelliJ, `dev.bat`) tự gắn ảnh trong thư mục này
vào CSDL khi khởi động (`SeedImageLoader`). Chạy thật (`prod`) không dùng thư mục này.

## Đặt ảnh

| Ảnh | Đặt ở | Tên file |
|---|---|---|
| Ảnh món | `mon/` | đúng cột `ten_file_anh` trong [mon/danh-sach.csv](mon/danh-sach.csv), ví dụ `ribeye.jpg` |
| Ảnh danh mục (vòng tròn ở dải danh mục trang QR) | `danh-muc/` | đúng cột `ten_file_anh` trong [danh-muc/danh-sach.csv](danh-muc/danh-sach.csv), ví dụ `bit-tet.png` — món tách nền, nền trắng / trong suốt |
| Ảnh nhóm món (thẻ gộp nhiều loại, vd. Nước ngọt có ga) | `nhom/` | đúng cột `ten_file_anh` trong [nhom/danh-sach.csv](nhom/danh-sach.csv) |
| Ảnh set menu | `set/` | đúng cột `ten_file_anh` trong [set/danh-sach.csv](set/danh-sach.csv) (4:3, bày đủ món của set) |
| Ảnh trang chủ website (đầu trang, món đặc trưng, trải nghiệm, không gian, bếp trưởng…) | `website/` | đúng cột `ten_file_anh` trong [website/danh-sach.csv](website/danh-sach.csv) (cột `muc`: hero / about / reserve / chef / signature:N / experience:N / gallery). Ảnh giữ tới cạnh dài 2400px. Prompt: [website/PROMPT_ANH_WEBSITE.md](website/PROMPT_ANH_WEBSITE.md) |
| Ảnh bìa trang đặt món (QR) | thư mục này | `anh-bia.jpg` (ngang 16:9 — biển hiệu có tên quán; có ảnh bìa thì trang khách không hiện dòng chào) |

- Đuôi `.jpg`, `.jpeg`, `.png` hoặc `.webp`.
- Ảnh món nên vuông hoặc 4:3, cạnh ngắn từ ~800px. Ảnh lớn tự được thu nhỏ còn cạnh dài 1200px khi gắn.
- Món chưa có ảnh: trang khách hiện emoji như bình thường. Danh mục chưa có ảnh: hiện chữ cái đầu.
- Prompt tạo ảnh bằng AI (món, danh mục, ảnh bìa): [PROMPT_ANH_AI.md](PROMPT_ANH_AI.md).
- Nhớ ghi nguồn ảnh (Pexels, Unsplash, tự chụp, AI…) vào [NGUON_ANH.md](NGUON_ANH.md).

## Khi nào ảnh được gắn

- Lần chạy backend đầu tiên sau khi CSDL được tạo (hoặc khi thêm ảnh mới cho món chưa có ảnh): gắn ngay.
- Quản lý đổi / xóa ảnh món (hoặc ảnh danh mục) trên trang Món ăn: **không** bị gắn đè lại.
- Muốn gắn lại toàn bộ (vd. đã thay ảnh khác cùng tên): xóa `rms_db` rồi chạy backend, hoặc xóa dòng
  `dev.seed_images` trong bảng `system_settings` và xóa ảnh của món trên trang Món ăn.
