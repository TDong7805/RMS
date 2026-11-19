# Nguồn ảnh mẫu

Ghi nguồn từng ảnh đặt trong thư mục này (ảnh miễn phí như Pexels / Unsplash không bắt buộc ghi công, nhưng nên ghi
để biết giấy phép).

## Tóm tắt

Ảnh món, ảnh set, ảnh nhóm món, ảnh danh mục và ảnh bìa là **ảnh tạo bằng AI** (Lumina, KlingAI, Magnific) theo prompt
trong [PROMPT_ANH_AI.md](PROMPT_ANH_AI.md); riêng 6 ảnh **logo nước ngọt** là logo / nhãn của chính hãng (quán bán đúng
sản phẩm đó, dùng để khách nhận ra loại khi chọn). Đây là **ảnh minh họa cho bản demo của đồ án**, không phải ảnh chụp
món thật của nhà hàng. Triển khai thật thì Quản lý thay bằng ảnh chụp thật ở trang Món ăn / Danh mục / Nhóm món / Set menu.

- Người tạo: nhóm 2 (bộ ảnh hiện tại tạo ngày 18–19/11/2026; bộ ảnh cũ 17/11/2026 bằng Magnific đã thay).
- Giấy phép: theo điều khoản của từng công cụ đối với tài khoản đã dùng để tạo (Lumina, KlingAI, Magnific). Watermark
  của công cụ đã được xóa / cắt khỏi ảnh. Logo nước ngọt thuộc quyền của các hãng (The Coca-Cola Company — Coca-Cola,
  Coca-Cola Zero, Sprite, Fanta; Công ty Nước giải khát Chương Dương — Sá xị Chương Dương), chỉ dùng để nhận diện sản
  phẩm trong bản demo. Trước khi dùng ngoài phạm vi đồ án, kiểm tra lại điều khoản / quyền sử dụng.

## Chi tiết

| File / thư mục | Nội dung | Nguồn | Ghi chú |
|---|---|---|---|
| `mon/*.jpg` (56 ảnh, danh sách trong [mon/danh-sach.csv](mon/danh-sach.csv)) | 55 món đang bán + Wagyu A5 (món theo mùa) | Tạo bằng AI — Lumina (phần lớn), KlingAI (Wagyu A5) | Phong cách chung: bàn gỗ óc chó tông ấm, ánh sáng tự nhiên, 4:3; mỗi món một dụng cụ đựng / món kèm riêng. Prompt ở PROMPT_ANH_AI.md |
| `mon/nuoc-ngot-*.jpg` (6 ảnh) | Logo Coca-Cola, Coca-Cola Zero, Sprite, Fanta Cam, Fanta Nho, Sá xị Chương Dương | Logo / nhãn chính hãng | Đã đưa về cùng khung vuông 600×600 (nới nền cùng màu cho logo ngang) |
| `nhom/*.jpg` (3 ảnh, [nhom/danh-sach.csv](nhom/danh-sach.csv)) | Thẻ nhóm Vang đỏ Úc, Bia, Nước ngọt có ga | Tạo bằng AI — Lumina | |
| `set/*.jpg` (4 ảnh, [set/danh-sach.csv](set/danh-sach.csv)) | 4 set menu | Tạo bằng AI — Lumina | Bày đủ món của set, góc cao ~60° |
| `danh-muc/*.png` (9 ảnh, [danh-muc/danh-sach.csv](danh-muc/danh-sach.csv)) | Ảnh 9 danh mục cho dải danh mục cong ở trang khách | 8 ảnh: AI — Magnific (lưới 4×2, cắt từng món); "Gọi thêm": AI — Lumina | Cắt vuông, nền trắng tinh để khớp vòng tròn trắng |
| `anh-bia.jpg` | Ảnh bìa trang gọi món: biển hiệu nhung đỏ "ROYAL BEEF" | Tạo bằng AI — Lumina (ảnh tham khảo bố cục: một biển hiệu quán ramen, không sao chép chữ / tên) | Đã xóa watermark; có ảnh bìa thì trang khách không hiện dòng chào |
