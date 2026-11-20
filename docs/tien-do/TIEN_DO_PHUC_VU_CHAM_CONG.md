# Tiến độ: Nhân viên phục vụ & chấm công khuôn mặt

Cập nhật: 20/11/2026. Làm theo yêu cầu đã chốt với nhóm (hỏi – đáp trước khi code), 6 đợt: CSDL → backend → giao diện
Phục vụ → chấm công khuôn mặt + "Thông tin của tôi" → phía Quản lý → kiểm thử + tài liệu. **Đã xong cả 6 đợt.**

## Yêu cầu đã chốt

| Chủ đề | Quyết định |
|---|---|
| Actor mới | **Nhân viên phục vụ** (`waiter`) đăng nhập được, trang `/phuc-vu`, giao diện cho điện thoại |
| Việc của phục vụ | Xem ca; sơ đồ bàn; mở / đóng bàn (QR), số khách; **chuyển / ghép bàn**; **gọi món hộ khách**; **bưng món**; tra thực đơn (thành phần, dị nguyên, món hết); thông báo |
| Yêu cầu của khách qua QR | Yêu cầu **hỗ trợ** (gọi nhân viên, tư vấn, khác) **chỉ phục vụ thấy**, theo khu vực: bàn ở khu nào → phục vụ được gán khu đó trong ca. Khu không ai được gán → mọi phục vụ trong ca. Yêu cầu **thanh toán** vẫn do thu ngân (gắn với hóa đơn) |
| Khu vực | Quản lý gán khu cho phục vụ **theo từng ca**. Phục vụ mở sẵn khu của mình, xem / thao tác được khu khác khi đông |
| Sơ đồ bàn | Phục vụ **chỉ xem**. Quản lý sửa sơ đồ → phục vụ thấy ngay kèm thông báo "Sơ đồ Tầng 1 vừa thay đổi" để kê lại bàn ghế thật |
| Chấm công | **Phục vụ, thu ngân, bếp** tự chấm trên **điện thoại của mình**. Phải: dùng **WiFi quán** (IP do quản lý cấu hình) + **đúng người** (so khớp khuôn mặt đã duyệt) + **người thật** (quay đầu) + **đang có ca** (vào sớm tối đa 30 phút). Sai bước nào thì chặn, báo lý do |
| Đăng ký khuôn mặt | Một lần, phải **đồng ý** thu thập dữ liệu (NĐ 13/2023); quản lý **duyệt** / từ chối (có lý do) / yêu cầu đăng ký lại |
| Lương | Tính theo giờ thực tế; ghi phút đi trễ / về sớm so với ca. Quên tan ca → "Thiếu giờ ra", thu ngân sửa tay |
| Ảnh | Ảnh chấm công tự xóa sau **90 ngày** (giờ chấm công giữ nguyên). Ảnh không công khai |
| "Thông tin của tôi" | Phục vụ, thu ngân, bếp (không có cho quản lý, kho): hồ sơ, đổi mật khẩu, ca làm, lịch sử chấm công (kèm ảnh), phiếu lương kỳ đã chốt |

## Đã làm

### CSDL
- `V20__nhan_vien_phuc_vu_cham_cong_khuon_mat.sql`: quyền của phục vụ; `shift_assignments.area_id`; bảng `face_profiles`;
  cột `attendances.check_in_photo / check_out_photo / *_ip / *_distance / late_minutes / early_minutes / photos_purged_at`,
  nguồn `camera`; cấu hình `attendance.allowed_networks / early_minutes / face_threshold / photo_retention_days`.
- `V21__thong_bao_cham_cong.sql`: loại thông báo "Chấm công".
- Dữ liệu mẫu `V20_1`: khu của các phục vụ mẫu.

### Backend
- `com.rms.waiter`: `/api/phuc-vu/**` — sơ đồ (không doanh thu), bưng món; thao tác bàn dùng chung `CashierService`
  (thêm **ghép bàn**, nhật ký ghi module theo vai trò người thao tác); gọi món hộ qua `QrOrderingService.sendByStaff`.
- `com.rms.shift.DutyService`: ca quy ra giờ thực tế — ai đang trong ca, khu nào; dùng cho định tuyến yêu cầu và chấm công.
- `ServiceRequestService`: yêu cầu hỗ trợ → phục vụ theo khu (thông báo riêng từng người), "Tôi đến" ghi tên người nhận
  (khách thấy "Nhân viên … đang đến"); thu ngân chỉ còn yêu cầu thanh toán.
- `LiveEvents`: kênh `waiter`; sự kiện `layout` khi quản lý sửa khu / bàn.
- `com.rms.selfservice`: `FaceService`, `ClockService` (vào ca / tan ca, xóa ảnh cũ 3:20 sáng), `SelfService`,
  `AttendanceAdminController` (duyệt khuôn mặt, cấu hình chấm công, xem ảnh chấm công).
- Bảo mật: `/uploads/khuon-mat`, `/uploads/cham-cong` bị chặn; ảnh chỉ xem qua API có kiểm quyền.

### Giao diện
- Khu **Phục vụ** (`/phuc-vu`): Sơ đồ (bảng bàn trượt lên), Yêu cầu (âm báo + rung), Mang món, Thực đơn / Gọi món hộ, Tôi.
- **Thông tin của tôi**: `/phuc-vu/toi`, `/thu-ngan/toi` (nút "Chấm công" trên thanh trên), `/bep/toi` (tab "Chấm công").
- **Camera nhận diện** (`features/self/FaceCamera.tsx`, thư viện `@vladmandic/face-api`, mô hình ở
  `frontend/public/models/face`, chỉ tải khi mở camera).
- **Quản lý**: Quản lý nhân viên → *Khuôn mặt chấm công*; Cấu hình hệ thống → tab *Chấm công*; Quản lý ca làm: khu vực
  phụ trách trong ô ca + khi phân công.
- **Thu ngân**: tab "Yêu cầu thanh toán" (bỏ "Đã báo nhân viên"); trang Chấm công có nguồn "Khuôn mặt", trễ / sớm, ảnh.

### Kiểm thử
- Bộ mới `tests/api/13-phuc-vu-cham-cong.mjs` (84 bước); cập nhật 01, 03, 07 theo quy tắc mới. Toàn bộ **13 bộ, 557 bước đạt**
  trên `rms_test` mới (20/11/2026).
- Kịch bản tay: [KICH_BAN_TEST.md](../kiem-thu/KICH_BAN_TEST.md) mục A22–A25 (sửa), H1–H18 (mới).
- Đã thử trên trình duyệt thật (Chrome, cỡ điện thoại 390×844): sơ đồ, mở bàn, gọi món hộ, mang món, ghép bàn, thông báo
  sơ đồ đổi, camera (camera giả của Chrome), duyệt khuôn mặt, cấu hình WiFi, ảnh chấm công.

## Giới hạn & việc để sau

- **Chưa thử nhận diện với khuôn mặt thật** trên trình duyệt (máy phát triển không có video khuôn mặt mẫu). Phần so khớp
  ở máy chủ đã có kiểm thử API. Cần thử bằng webcam / điện thoại thật (mục H10–H14).
- Mã khuôn mặt + bước "người thật" tính ở trình duyệt → người rành kỹ thuật có thể gửi mã giả; ảnh được lưu để đối chiếu.
  Chặt hơn: tính mã ở máy chủ (ONNX), tốn tài nguyên hơn.
- Camera trên điện thoại cần **HTTPS** — xem [TRIEN_KHAI.md](../trien-khai/TRIEN_KHAI.md) mục "Chấm công khuôn mặt".
- IP công cộng của mạng quán có thể đổi khi khởi động lại modem → quản lý bấm "Thêm IP hiện tại" lại.
- Sơ đồ 8 cột rộng hơn màn hình điện thoại → vuốt ngang / thu phóng.
- Phục vụ chưa hủy được món (vẫn do thu ngân / bếp / khách); chưa tách / tách hóa đơn khi ghép bàn.
- Đề xuất đã bàn nhưng chưa làm: không có.
