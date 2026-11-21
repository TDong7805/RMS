# Tiến độ: Website khách hàng (trang công khai)

Cập nhật: 22/11/2026.

## Đã làm
- **Website công khai** ở gốc `/`, không cần đăng nhập. Khung riêng `PublicLayout`, bộ màu riêng `site-theme.css`, tải riêng với trang quản lý.
  - Thanh đầu trang có logo và tên (lấy động), menu Giới thiệu · Thực đơn · Đặt bàn · Album ảnh · Liên hệ, ô tìm món, menu trên điện thoại.
  - Trang chủ:
    - Banner: danh hiệu, slogan, ảnh banner (không có thì lấy ảnh bìa nhà hàng), nút tới Thực đơn và Đặt bàn.
    - Giới thiệu ngắn, món được yêu thích (món bán chạy), xem trước album, giờ mở cửa và liên hệ.
  - `/gioi-thieu`, `/thuc-don` (lọc danh mục, tìm không dấu, set menu, nhãn "Tạm hết hôm nay"), `/album` (xem ảnh lớn, phím ← →), `/lien-he` (bản đồ nhúng nếu dán link "Nhúng bản đồ" của Google).
  - Đường dẫn lạ hiện trang "Không tìm thấy" của website.
- **Đặt bàn trực tuyến** (`/dat-ban`):
  - Form gồm họ tên, SĐT, số khách, ngày, giờ, khu vực (nếu cấu hình cho chọn), email (bắt buộc hoặc không theo cấu hình), ghi chú.
  - Giờ chọn được sinh theo giờ mở cửa, bước giờ, thời lượng mỗi lượt và thời gian đặt trước tối thiểu.
  - Kiểm tra ngay trên form. Lỗi máy chủ hiện dưới từng ô. Thành công thì hiện mã `DB-…`.
- **Cấu hình website** ở Cấu hình hệ thống → tab **Website khách hàng**:
  - Banner (slogan, danh hiệu, ảnh), Về chúng tôi, mạng xã hội và bản đồ.
  - Album ảnh: thêm, sửa chú thích, ẩn/hiện, đổi thứ tự, xóa.
  - Bật/tắt từng danh mục và món hiện trên website. Không ảnh hưởng trang gọi món QR.
- **Dữ liệu:** migration `V24`, mẫu `V24_1`. **API:** `com.rms.website` (xem `backend/README.md` → Website khách hàng). **Kiểm thử:** `tests/api/15-website-khach.mjs`.
- **Sửa lỗi có sẵn:** logo nhà hàng giờ lưu qua `ImageStore`. Trước đây form gửi ảnh dạng data URL mà cột chỉ có 500 ký tự.

## Lưu ý
- Danh hiệu "Michelin Selected 2026" và link mạng xã hội trong dữ liệu mẫu là **giả** (chỉ có ở dev).
- Album mẫu trống. Tải ảnh ở tab Website khách hàng.
- Giới hạn 5 lượt đặt hợp lệ mỗi IP trong 10 phút được lưu trong bộ nhớ, khởi động lại backend thì đếm lại từ 0.

## Việc để sau
- Trang tin tức `/tin-tuc` đọc từ `posts` (đã có `slug` và trạng thái xuất bản).
- Khách tra cứu hoặc hủy lịch đã đặt bằng mã và SĐT (hiện phải gọi nhà hàng).
- Gửi email hoặc SMS xác nhận cho khách (cần dịch vụ gửi thư hoặc SMS).
- Chatbot tư vấn trên website (dùng lại `MenuAssistant` của trang QR).
