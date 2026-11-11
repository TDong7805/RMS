/* =====================================================================
   DỮ LIỆU MẪU — Chatbot AI: FAQ & câu hỏi chưa giải đáp (chỉ profile dev, KHÔNG dùng cho môi trường thật)

   - Thêm 4 FAQ (tổng 7), có 1 FAQ đang tắt.
   - Câu hỏi khách hay hỏi mà bot chưa trả lời được: MÔ PHỎNG dữ liệu phân hệ Khách hàng (chat với bot)
     sẽ tạo ra. Khi phân hệ đó hoàn thành, bảng unanswered_questions được ghi tự động, không cần phần này.
   ===================================================================== */

SET NAMES utf8mb4;
SET time_zone = '+07:00';

INSERT INTO faqs (category_id, question, answer, is_active, updated_at)
SELECT c.id, x.q, x.a, x.active, NOW() - INTERVAL x.h HOUR
FROM (
  SELECT 'Giờ mở cửa & địa chỉ' cat, 'Nhà hàng mở cửa lúc mấy giờ?' q,
         'Thứ Hai – Thứ Năm: 10:00–22:00; Thứ Sáu: 10:00–23:00; Thứ Bảy: 09:00–23:00; Chủ nhật: 09:00–22:00.' a, 1 active, 30 h UNION ALL
  SELECT 'Thanh toán', 'Có xuất hóa đơn VAT không?',
         'Có. Vui lòng cung cấp thông tin công ty cho thu ngân trước khi thanh toán.', 1, 250 UNION ALL
  SELECT 'Món ăn & dị ứng', 'Món ăn có dùng bột ngọt không?',
         'Bếp hạn chế tối đa bột ngọt. Quý khách có thể ghi chú "không bột ngọt" khi gọi món.', 1, 330 UNION ALL
  SELECT 'Đặt bàn', 'Có phòng riêng cho tiệc không?',
         'Có 2 phòng VIP sức chứa 8 và 12 khách. Vui lòng đặt trước ít nhất 1 ngày.', 0, 500
) x JOIN faq_categories c ON c.name = x.cat;

INSERT INTO unanswered_questions (question, asked_count, last_asked_at, status) VALUES
 ('Có wifi miễn phí không, mật khẩu là gì?',          22, NOW() - INTERVAL 15 MINUTE, 'open'),
 ('Nhà hàng có ghế cho em bé không?',                 14, NOW() - INTERVAL 40 MINUTE, 'open'),
 ('Có mang thú cưng vào được không?',                  9, NOW() - INTERVAL 5 HOUR,    'open'),
 ('Có giảm giá cho sinh viên không?',                  6, NOW() - INTERVAL 22 HOUR,   'open'),
 ('Có phục vụ món cho người ăn kiêng keto không?',     4, NOW() - INTERVAL 2 DAY,     'open'),
 ('Nhà hàng có hát karaoke không?',                    2, NOW() - INTERVAL 6 DAY,     'dismissed');
