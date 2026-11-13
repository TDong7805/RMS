/* =====================================================================
   DỮ LIỆU MẪU — Bài viết (chỉ profile dev, KHÔNG dùng cho môi trường thật)
   7 bài: tin tức, ưu đãi, sự kiện; có bài nháp và bài đã ẩn. Chưa có ảnh bìa.
   ===================================================================== */

SET NAMES utf8mb4;
SET time_zone = '+07:00';

INSERT INTO posts (title, slug, summary, content, category, status, author_id, created_at, updated_at, published_at) VALUES
 ('Ưu đãi cuối tuần – giảm 15% set lẩu', 'uu-dai-cuoi-tuan-giam-15-set-lau', 'Áp dụng thứ Sáu đến Chủ nhật cho nhóm từ 4 khách khi gọi lẩu Thái hoặc lẩu nấm chay.',
  'Từ thứ Sáu đến Chủ nhật hằng tuần, Green Lotus giảm 15% cho tất cả set lẩu dành cho nhóm từ 4 khách.

Điều kiện áp dụng:
- Đặt bàn trước qua website hoặc hotline.
- Không áp dụng đồng thời với chương trình khác.

Hẹn gặp quý khách!',
  'promotion', 'published', (SELECT id FROM users WHERE username = 'tuan.nguyen'),
  NOW() - INTERVAL 3 DAY, NOW() - INTERVAL 1 DAY, NOW() - INTERVAL 1 DAY),
 ('Ra mắt thực đơn chay mùa Vu Lan', 'ra-mat-thuc-don-chay-mua-vu-lan', 'Bảy món chay mới từ nấm, đậu hũ và rau củ hữu cơ, phục vụ suốt tháng Bảy âm lịch.',
  'Nhân mùa Vu Lan, bếp Green Lotus giới thiệu thực đơn chay gồm 7 món mới từ nấm, đậu hũ và rau củ.

Tất cả nguyên liệu đều được chọn lọc từ nông trại hữu cơ tại Đà Lạt.',
  'news', 'published', (SELECT id FROM users WHERE username = 'tuan.nguyen'),
  NOW() - INTERVAL 8 DAY, NOW() - INTERVAL 6 DAY, NOW() - INTERVAL 6 DAY),
 ('Đêm nhạc acoustic tại sân vườn', 'dem-nhac-acoustic-tai-san-vuon', 'Mỗi tối thứ Bảy từ 19:30, thưởng thức nhạc mộc cùng bữa tối ngoài trời.',
  'Sân vườn Green Lotus mở cửa đêm nhạc acoustic mỗi tối thứ Bảy từ 19:30.

Vui lòng đặt bàn khu vực Sân vườn để có chỗ ngồi đẹp nhất.',
  'event', 'published', (SELECT id FROM users WHERE username = 'tuan.nguyen'),
  NOW() - INTERVAL 12 DAY, NOW() - INTERVAL 10 DAY, NOW() - INTERVAL 10 DAY),
 ('Tặng chè hạt sen cho khách sinh nhật', 'tang-che-hat-sen-cho-khach-sinh-nhat', 'Khách có ngày sinh trong tháng được tặng một phần chè hạt sen long nhãn.',
  'Chỉ cần xuất trình CCCD có ngày sinh trong tháng, quý khách sẽ nhận một phần chè hạt sen long nhãn miễn phí.',
  'promotion', 'hidden', (SELECT id FROM users WHERE username = 'tuan.nguyen'),
  NOW() - INTERVAL 27 DAY, NOW() - INTERVAL 25 DAY, NOW() - INTERVAL 25 DAY),
 ('Green Lotus đạt chứng nhận an toàn thực phẩm', 'green-lotus-dat-chung-nhan-an-toan-thuc-pham', 'Nhà hàng vinh dự nhận chứng nhận cơ sở đủ điều kiện an toàn thực phẩm năm 2026.',
  'Chúng tôi cam kết duy trì quy trình bếp sạch, nguồn nguyên liệu rõ ràng và kiểm tra định kỳ.',
  'news', 'published', (SELECT id FROM users WHERE username = 'tuan.nguyen'),
  NOW() - INTERVAL 42 DAY, NOW() - INTERVAL 40 DAY, NOW() - INTERVAL 40 DAY),
 ('Thực đơn Tết Nguyên Đán 2027', 'thuc-don-tet-nguyen-dan-2027', 'Bản nháp thực đơn mâm cỗ Tết, dự kiến công bố đầu tháng Chạp.',
  'Đang hoàn thiện danh sách món và giá cho mâm cỗ Tết.',
  'event', 'draft', (SELECT id FROM users WHERE username = 'tuan.nguyen'),
  NOW() - INTERVAL 4 DAY, NOW() - INTERVAL 2 DAY, NULL),
 ('Hướng dẫn gọi món bằng QR tại bàn', 'huong-dan-goi-mon-bang-qr-tai-ban', 'Quét mã QR trên bàn để xem thực đơn, hỏi trợ lý AI và gửi yêu cầu gọi món.',
  'Bước 1: Quét mã QR dán trên bàn.
Bước 2: Xem thực đơn hoặc hỏi trợ lý AI về món ăn.
Bước 3: Kiểm tra giỏ hàng và xác nhận gửi đơn.

Trợ lý AI chỉ tư vấn, quý khách luôn là người quyết định món.',
  'news', 'published', (SELECT id FROM users WHERE username = 'tuan.nguyen'),
  NOW() - INTERVAL 17 DAY, NOW() - INTERVAL 15 DAY, NOW() - INTERVAL 15 DAY);
