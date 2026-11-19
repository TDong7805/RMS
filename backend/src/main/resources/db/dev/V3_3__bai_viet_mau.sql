/* =====================================================================
   DỮ LIỆU MẪU — Bài viết (chỉ profile dev, KHÔNG dùng cho môi trường thật)
   7 bài của Royal Beef: tin tức, ưu đãi, sự kiện; có bài nháp và bài đã ẩn. Chưa có ảnh bìa.
   ===================================================================== */

SET NAMES utf8mb4;
SET time_zone = '+07:00';

INSERT INTO posts (title, slug, summary, content, category, status, author_id, created_at, updated_at, published_at) VALUES
 ('Steak Night thứ Tư – giảm 20% bít tết Úc', 'steak-night-thu-tu-giam-20-bit-tet-uc', 'Mỗi tối thứ Tư từ 17:00, giảm 20% toàn bộ bít tết Úc (trừ Tomahawk và Wagyu).',
  'Mỗi tối thứ Tư hằng tuần từ 17:00, Royal Beef giảm 20% cho toàn bộ món bít tết Úc: Striploin, Tenderloin, Ribeye, T-bone.

Điều kiện áp dụng:
- Không áp dụng cho Tomahawk và Ribeye Wagyu.
- Không áp dụng đồng thời với chương trình khác.

Hẹn gặp quý khách!',
  'promotion', 'published', (SELECT id FROM users WHERE username = 'tuan.nguyen'),
  NOW() - INTERVAL 3 DAY, NOW() - INTERVAL 1 DAY, NOW() - INTERVAL 1 DAY),
 ('Ra mắt Ribeye Wagyu Úc MB4+', 'ra-mat-ribeye-wagyu-uc-mb4', 'Bò Wagyu Úc vân mỡ MB4+ nhập trực tiếp từ trang trại Queensland, phục vụ từ tuần này.',
  'Royal Beef chính thức đưa Ribeye Wagyu Úc MB4+ vào thực đơn. Thịt được ủ lạnh, cắt dày và nướng than theo độ chín quý khách chọn.

Món khuyên dùng chín tái (medium rare) để cảm nhận trọn vị béo ngậy của vân mỡ.',
  'news', 'published', (SELECT id FROM users WHERE username = 'tuan.nguyen'),
  NOW() - INTERVAL 8 DAY, NOW() - INTERVAL 6 DAY, NOW() - INTERVAL 6 DAY),
 ('Đêm nhạc acoustic tại sân vườn', 'dem-nhac-acoustic-tai-san-vuon', 'Mỗi tối thứ Bảy từ 19:30, thưởng thức nhạc mộc cùng bít tết và vang đỏ ngoài trời.',
  'Sân vườn Royal Beef mở cửa đêm nhạc acoustic mỗi tối thứ Bảy từ 19:30.

Vui lòng đặt bàn khu vực Sân vườn để có chỗ ngồi đẹp nhất.',
  'event', 'published', (SELECT id FROM users WHERE username = 'tuan.nguyen'),
  NOW() - INTERVAL 12 DAY, NOW() - INTERVAL 10 DAY, NOW() - INTERVAL 10 DAY),
 ('Tặng tráng miệng cho khách sinh nhật', 'tang-trang-mieng-cho-khach-sinh-nhat', 'Khách có ngày sinh trong tháng được tặng một phần kem vani sốt sô-cô-la.',
  'Chỉ cần xuất trình CCCD có ngày sinh trong tháng, quý khách sẽ nhận một phần kem vani sốt sô-cô-la miễn phí.',
  'promotion', 'hidden', (SELECT id FROM users WHERE username = 'tuan.nguyen'),
  NOW() - INTERVAL 27 DAY, NOW() - INTERVAL 25 DAY, NOW() - INTERVAL 25 DAY),
 ('Royal Beef đạt chứng nhận an toàn thực phẩm', 'royal-beef-dat-chung-nhan-an-toan-thuc-pham', 'Nhà hàng vinh dự nhận chứng nhận cơ sở đủ điều kiện an toàn thực phẩm năm 2026.',
  'Chúng tôi cam kết duy trì quy trình bếp sạch, thịt bò nhập khẩu có giấy chứng nhận nguồn gốc và kiểm tra định kỳ.',
  'news', 'published', (SELECT id FROM users WHERE username = 'tuan.nguyen'),
  NOW() - INTERVAL 42 DAY, NOW() - INTERVAL 40 DAY, NOW() - INTERVAL 40 DAY),
 ('Thực đơn Tết Nguyên Đán 2027', 'thuc-don-tet-nguyen-dan-2027', 'Bản nháp set tiệc Tết: Tomahawk, lẩu bò và Wagyu A5, dự kiến công bố đầu tháng Chạp.',
  'Đang hoàn thiện danh sách món và giá cho set tiệc Tết.',
  'event', 'draft', (SELECT id FROM users WHERE username = 'tuan.nguyen'),
  NOW() - INTERVAL 4 DAY, NOW() - INTERVAL 2 DAY, NULL),
 ('Hướng dẫn gọi món bằng QR tại bàn', 'huong-dan-goi-mon-bang-qr-tai-ban', 'Quét mã QR trên bàn để xem thực đơn, chọn độ chín bít tết trong ghi chú và gửi món thẳng tới bếp.',
  'Bước 1: Quét mã QR dán trên bàn.
Bước 2: Xem thực đơn, chọn món; với bít tết, ghi độ chín và loại sốt trong ô ghi chú.
Bước 3: Kiểm tra giỏ món và bấm gửi — bếp nhận ngay.

Cần hỗ trợ, bấm "Gọi nhân viên" trên trang.',
  'news', 'published', (SELECT id FROM users WHERE username = 'tuan.nguyen'),
  NOW() - INTERVAL 17 DAY, NOW() - INTERVAL 15 DAY, NOW() - INTERVAL 15 DAY);
