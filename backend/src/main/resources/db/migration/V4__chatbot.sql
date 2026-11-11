/* =====================================================================
   V4 — Quản lý Chatbot AI: cấu hình & FAQ

   Danh mục FAQ trở thành dữ liệu nền (trước đây chỉ có trong dữ liệu mẫu): giao diện chỉ cho
   chọn danh mục khi soạn FAQ, nếu CSDL thật không có danh mục nào thì không tạo được FAQ.
   INSERT IGNORE: CSDL phát triển đã có các danh mục này (từ V1_1) thì bỏ qua.
   ===================================================================== */

INSERT IGNORE INTO faq_categories (name) VALUES
 ('Giờ mở cửa & địa chỉ'), ('Đặt bàn'), ('Thanh toán'), ('Món ăn & dị ứng'), ('Dịch vụ khác');
