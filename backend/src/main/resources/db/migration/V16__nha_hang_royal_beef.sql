/* =====================================================================
   V16 — Đổi thông tin mặc định của nhà hàng sang Royal Beef (nhà hàng bò Úc hiện đại kèm món Việt).

   Chỉ đổi khi còn giá trị mặc định cũ "Green Lotus" của V1 (nhà hàng đã tự sửa ở Cấu hình hệ thống thì giữ nguyên).
   Thông tin là giả lập cho đồ án; khi triển khai thật, Quản lý sửa ở Cấu hình hệ thống → Thông tin nhà hàng.
   ===================================================================== */

UPDATE restaurant_info
SET name = 'Royal Beef',
    legal_name = 'Công ty TNHH Ẩm thực Royal Beef',
    phone = '02838226868',
    email = 'hello@royalbeef.vn',
    address = '68 Nguyễn Huệ, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh',
    website = 'https://royalbeef.vn'
WHERE id = 1 AND name = 'Green Lotus';

-- Trợ lý thực đơn: đổi tên / lời chào theo nhà hàng mới (giữ nguyên nếu đã được sửa).
UPDATE chatbot_config
SET bot_name = 'Roy',
    avatar = '🥩',
    greeting = 'Xin chào, mình là Roy – trợ lý thực đơn của Royal Beef! Bạn muốn chọn bít tết, món bò Việt hay hỏi về độ chín, phần cắt và thành phần món nào?'
WHERE id = 1 AND bot_name = 'Sen';

-- Nhà hàng chuyên bò, không có món chay: đổi gợi ý nhanh "Món chay" thành "Bít tết Úc".
UPDATE chatbot_quick_replies SET label = 'Bít tết Úc' WHERE label = 'Món chay';
