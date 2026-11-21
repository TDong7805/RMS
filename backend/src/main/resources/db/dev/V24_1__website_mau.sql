/* =====================================================================
   V24_1 — Nội dung mẫu cho website khách hàng (chỉ profile dev).

   Thông tin là giả lập cho đồ án: danh hiệu "Michelin Selected" và các link mạng xã hội KHÔNG có thật.
   Khi chạy thật, Quản lý nhập ở Cấu hình hệ thống → Website khách hàng.
   Album ảnh để trống: repo chưa có ảnh không gian quán (không dùng lại ảnh món — xóa ảnh album sẽ xóa luôn file ảnh món).
   ===================================================================== */

UPDATE website_content
SET slogan = 'Bò Úc thượng hạng – nướng đúng độ chín bạn yêu thích',
    award = 'Michelin Selected 2026',
    about_title = 'Câu chuyện Royal Beef',
    about_content = 'Royal Beef ra đời từ niềm đam mê với những thớ thịt bò Úc vân mỡ đẹp và hương vị bếp Việt quen thuộc. Mỗi phần bít tết được chọn lọc từ trang trại đạt chuẩn, ủ khô tại chỗ và nướng trên than đá núi lửa để giữ trọn vị ngọt tự nhiên.\nKhông gian nhà hàng kết hợp gỗ óc chó, ánh đèn vàng ấm và khu bếp mở – nơi thực khách có thể nhìn đầu bếp chế biến ngay trước mắt. Bên cạnh bít tết, thực đơn còn có phở bò, bò lúc lắc, lẩu giấm và nhiều món Việt nấu từ chính những phần thịt bò thượng hạng.',
    about_highlights = 'Bò Úc nhập khẩu, ủ khô 21 ngày\nBếp mở – nướng than đá núi lửa\nPhòng VIP riêng cho tiệc 8–20 khách\nĐồ uống & rượu vang chọn lọc',
    facebook_url = 'https://facebook.com/royalbeef.demo',
    instagram_url = 'https://instagram.com/royalbeef.demo',
    tiktok_url = 'https://tiktok.com/@royalbeef.demo',
    zalo_phone = '0912345678',
    map_url = 'https://maps.google.com/?q=68+Nguyen+Hue+Quan+1+TP+Ho+Chi+Minh'
WHERE id = 1;
