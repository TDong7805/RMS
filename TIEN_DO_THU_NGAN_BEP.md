# Tiến độ phân hệ Đặt món (khách tại bàn) – Bếp – Thu ngân

Cập nhật: 14/11/2026. Làm theo đặc tả `DacTa_UC_DatMon_Bep_ThuNgan.docx` (nguồn sinh: `tools/dac-ta/`).
Khi sửa chức năng: cập nhật file này **và** đặc tả.

## Kế hoạch
1. **Đợt 1 — XONG**: gọi món tại bàn bằng QR, màn hình bếp, sơ đồ bàn của thu ngân. Đồng bộ ngay giữa các màn hình.
2. **Đợt 2**: gọi nhân viên, yêu cầu thanh toán; thu ngân xử lý yêu cầu, hủy món / hủy đơn, chuyển bàn, lập hóa đơn, thu tiền (mã QR chuyển khoản), danh sách hóa đơn, thông báo.
   - Bên Quản lý: tài khoản nhận tiền trong Cấu hình hệ thống; doanh thu thật trên Dashboard.
3. **Đợt 3**: bếp khai báo công thức định lượng và kiểm tra nguyên liệu; thu ngân nhập chấm công từ Excel, tính và chốt bảng lương.

## Đợt 1 đã làm

### Database
- `db/migration/V10__dat_mon_bep.sql`:
  - Món tạm hết trong ngày (`dishes.sold_out_date`, tự hết hiệu lực sang ngày khác).
  - Món trong đơn: số đợt gọi, người bắt đầu chế biến, người mang ra, nguồn hủy (khách / thu ngân / bếp), lý do và thời điểm hủy.
  - Mã đơn theo tháng `DH2611-001`, dùng chung bộ đếm `doc_sequences`.
- `db/dev/V10_1__dat_mon_mau.sql`: 3 bàn đang có khách (T03, VIP01, SV01), món ở đủ các trạng thái, 1 món tạm hết.

### Backend (`com.rms.ordering`)
- `LiveEvents`: đẩy sự kiện "có thay đổi" qua SSE tới màn hình bếp, thu ngân và trang của từng bàn, phát sau khi lưu xong. Trình duyệt tự nối lại khi mất kết nối.
- `OrderCore`: đọc bàn, đơn đang mở, món trong đơn, giờ mở cửa.
- `QrOrderingService` / `QrOrderingController` (`/api/public/qr/{mã bàn}/...`, không đăng nhập): thông tin bàn, thực đơn, gửi giỏ món, hủy món chờ chế biến, kênh sự kiện của bàn.
- `KitchenService` / `KitchenController` (`/api/bep/...`, vai trò Bếp): hàng chờ, bắt đầu / hoàn thành (từng món hoặc cả thẻ), hoàn tác trong 30 phút, hủy món kèm lý do (báo thu ngân), món tạm hết, chi tiết đơn.
- `CashierService` / `CashierController` (`/api/thu-ngan/...`, vai trò Thu ngân): sơ đồ bàn, món chờ mang ra, chi tiết đơn, đánh dấu đã mang ra.
- Phân quyền: `/api/public/**` công khai, `/api/bep/**` Bếp, `/api/thu-ngan/**` Thu ngân.
- Thông báo "Bếp hủy món" gửi thu ngân; bấm vào mở chi tiết đơn.
- Trang Khu vực bàn (Quản lý): API bàn trả thêm `qrToken`.

### Frontend
- **Trang đặt món** `/goi-mon/:mã-bàn` (`pages/goi-mon/QrOrderPage.tsx`, `features/ordering/QrParts.tsx`):
  - Giao diện kiểu app đặt đồ ăn trên điện thoại.
  - Thanh danh mục dính đầu trang, nút (+) và bộ tăng giảm trên từng món, tấm trượt chi tiết món (ghi chú nhanh: ít cay, không hành…), thanh giỏ hàng nổi, giỏ lưu trên máy.
  - Tab "Món đã gọi" theo đợt, trạng thái và thanh tiến độ từng món, hủy món chưa làm.
  - Nút Gọi nhân viên / Thanh toán hiện tạm thông báo "sẽ có ở bản cập nhật tới" (đợt 2).
- **Màn hình bếp** `/bep` (`pages/bep/KitchenDisplayPage.tsx`):
  - Kiểu KDS: toàn màn hình, nền tối, hai cột Chờ / Đang chế biến, thẻ theo bàn + đợt gọi, đồng hồ chờ (cam 15′, đỏ 25′), ghi chú nổi màu vàng.
  - Cách xem "Theo món", lọc danh mục, nút "Bắt đầu ca" để bật âm báo, thẻ mới nhấp nháy kèm âm báo.
  - Hủy món kèm lý do, bảng món tạm hết, chi tiết đơn của bàn, dải "Vừa hoàn thành" để hoàn tác.
- **Khu Thu ngân** (khung trang dùng chung, menu riêng):
  - `/thu-ngan`: sơ đồ bàn theo khu vực, lọc nhanh, thẻ bàn (tạm tính, thời gian ngồi, số món đang làm / chờ mang ra, lịch đặt trước), khung "Món chờ mang ra".
  - `/thu-ngan/don/:id`: chi tiết đơn, đã mang ra từng món / tất cả, in tạm tính.
  - `/thu-ngan/thong-bao`: thông báo.
  - Các mục của đợt 2–3 tạm hiện trang "đang hoàn thiện".
- **Quản lý – Khu vực bàn**: nút **Mã QR** ở danh sách bàn và trong hộp sửa bàn. Hộp này hiện mã QR, cho sao chép / mở thử đường dẫn và in để dán lên bàn. Dùng thư viện `qrcode` (mới thêm).
- Đã bỏ trang tạm `StaffAreaPage` (Thu ngân, Bếp đã có trang thật).

### Đã chạy thử
- API: 23/23 bước đạt.
- Chrome (khách trên khung iPhone + bếp + thu ngân cùng lúc): 22/22 bước của luồng chính đạt, cộng 2/2 bước mã QR bên Quản lý (chạy riêng).
  - Khách gửi món → bếp thấy ngay; bếp bắt đầu / hoàn thành → khách thấy ngay; thu ngân đánh dấu đã mang ra → khách thấy ngay.
  - Bếp hủy món → khách thấy lý do, thu ngân nhận thông báo; món tạm hết → khách thấy.

## Khác đặc tả / lưu ý
- **Combo không bán trên trang đặt món**: bảng combo hiện chỉ dùng cho chatbot gợi ý, chưa có giá bán. Đặc tả đã sửa theo.
- **Lọc nhanh** (không cay / chay / không chứa chất gây dị ứng) chưa làm, đưa sang "phát triển sau" trong đặc tả.
- **Giờ mở cửa**: ngoài giờ trong Cấu hình hệ thống thì khách chỉ xem thực đơn, không gửi món được. Khi test ngoài giờ, sửa giờ mở cửa trong Cấu hình hệ thống.
- Món chưa có ảnh hiển thị ô màu kèm biểu tượng (dữ liệu mẫu chưa có ảnh món).
