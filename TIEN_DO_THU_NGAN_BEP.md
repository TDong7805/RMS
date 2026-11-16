# Tiến độ phân hệ Đặt món (khách tại bàn) – Bếp – Thu ngân

Cập nhật: 14/11/2026. Làm theo đặc tả `DacTa_UC_DatMon_Bep_ThuNgan.docx` (nguồn sinh: `tools/dac-ta/`).
Khi sửa chức năng: cập nhật file này **và** đặc tả.

## Kế hoạch
1. **Đợt 1 — XONG**: gọi món tại bàn bằng QR, màn hình bếp, sơ đồ bàn của thu ngân. Đồng bộ ngay giữa các màn hình.
2. **Đợt 2 — XONG**: gọi nhân viên, yêu cầu thanh toán; thu ngân xử lý yêu cầu, hủy món / hủy đơn, chuyển bàn, lập hóa đơn, thu tiền (mã QR chuyển khoản), danh sách hóa đơn, thông báo.
   - Bên Quản lý: tài khoản nhận tiền trong Cấu hình hệ thống; doanh thu thật trên Dashboard.
3. **Đợt 3 — XONG**: bếp khai báo công thức định lượng và kiểm tra nguyên liệu; thu ngân nhập chấm công từ Excel, tính và chốt bảng lương.

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
- **Màn hình bếp** `/bep` (`pages/bep/KitchenDisplayPage.tsx`):
  - Kiểu KDS: toàn màn hình, nền tối, hai cột Chờ / Đang chế biến, thẻ theo bàn + đợt gọi, đồng hồ chờ (cam 15′, đỏ 25′), ghi chú nổi màu vàng.
  - Cách xem "Theo món", lọc danh mục, nút "Bắt đầu ca" để bật âm báo, thẻ mới nhấp nháy kèm âm báo.
  - Hủy món kèm lý do, bảng món tạm hết, chi tiết đơn của bàn, dải "Vừa hoàn thành" để hoàn tác.
- **Khu Thu ngân** (khung trang dùng chung, menu riêng):
  - `/thu-ngan`: sơ đồ bàn theo khu vực, lọc nhanh, thẻ bàn (tạm tính, thời gian ngồi, số món đang làm / chờ mang ra, lịch đặt trước), khung "Món chờ mang ra".
  - `/thu-ngan/don/:id`: chi tiết đơn, đã mang ra từng món / tất cả, in tạm tính.
  - `/thu-ngan/thong-bao`: thông báo.
- **Quản lý – Khu vực bàn**: nút **Mã QR** ở danh sách bàn và trong hộp sửa bàn. Hộp này hiện mã QR, cho sao chép / mở thử đường dẫn và in để dán lên bàn. Dùng thư viện `qrcode` (mới thêm).
- Đã bỏ trang tạm `StaffAreaPage` (Thu ngân, Bếp đã có trang thật).

### Đã chạy thử
- API: 23/23 bước đạt.
- Chrome (khách trên khung iPhone + bếp + thu ngân cùng lúc): 22/22 bước của luồng chính đạt, cộng 2/2 bước mã QR bên Quản lý (chạy riêng).
  - Khách gửi món → bếp thấy ngay; bếp bắt đầu / hoàn thành → khách thấy ngay; thu ngân đánh dấu đã mang ra → khách thấy ngay.
  - Bếp hủy món → khách thấy lý do, thu ngân nhận thông báo; món tạm hết → khách thấy.

## Đợt 2 đã làm

### Database
- `db/migration/V11__thu_ngan_thanh_toan.sql`:
  - Yêu cầu của khách: hình thức thanh toán khách chọn, thông tin xuất VAT, thời điểm hủy.
  - Hóa đơn: lý do / người / thời điểm hủy. Bỏ ràng buộc "1 đơn – 1 hóa đơn" để giữ lại hóa đơn đã hủy; vẫn chỉ một hóa đơn còn hiệu lực mỗi đơn (kiểm tra trong code).
  - Khoản thu: tiền khách đưa (để tính và in tiền thối).
  - Tài khoản nhận tiền ở `system_settings` (khóa `payment.*`).
  - Mã hóa đơn theo tháng `HD2611-001`, dùng chung `doc_sequences`.
- `db/dev/V11_1__hoa_don_mau.sql`: khoảng 63 ngày lịch sử bán hàng có hóa đơn đã thanh toán (để Dashboard có số liệu), 2 yêu cầu đang chờ hôm nay, tài khoản nhận tiền mẫu. Chi tiết ở `DU_LIEU_GIA.md`.

### Backend (`com.rms.ordering`)
- `VietQr`: tạo nội dung mã QR chuyển khoản chuẩn VietQR (EMVCo, CRC16) ngay trên máy chủ, không gọi dịch vụ ngoài.
- `PaymentSettingsService` / `Controller` (`/api/settings/payment`, Quản lý): xem / lưu / xóa tài khoản nhận tiền. Tên chủ tài khoản tự chuyển thành in hoa không dấu.
- `ServiceRequestService`:
  - Phía khách: gọi nhân viên (UC-KH-05), yêu cầu thanh toán (UC-KH-06), hủy yêu cầu còn Mới.
  - Phía thu ngân (UC-TN-06): danh sách, chuyển cho nhân viên (phục vụ / thu ngân / bếp), hoàn thành, hủy.
  - Mỗi bàn tối đa một yêu cầu hỗ trợ và một yêu cầu thanh toán đang chờ.
  - Thông báo cho Thu ngân; bấm thông báo mở trang Yêu cầu.
- `InvoiceService`:
  - Xem trước và lập hóa đơn (UC-TN-07): chặn khi còn món Chờ / Đang chế biến; gộp cùng món cùng giá; kiểm tra mã số thuế.
  - Thu tiền nhiều hình thức (UC-TN-08): tổng phải khớp, kiểm tra tiền khách đưa.
  - Thanh toán xong: đơn Hoàn tất, món Đã xong → Đã mang ra, bàn Trống, yêu cầu thanh toán Hoàn thành.
  - Hủy hóa đơn chưa thanh toán, có lý do (UC-TN-09); danh sách lọc 31 ngày, tổng theo hình thức.
- `CashierService`:
  - Tra cứu đơn (UC-TN-02).
  - Hủy món / hủy đơn có lý do (UC-TN-04); hủy đơn hủy theo các yêu cầu đang chờ.
  - Chuyển bàn (UC-TN-05): yêu cầu đang chờ đi theo; mã QR bàn cũ không còn thấy đơn.
  - Sơ đồ bàn thêm cờ gọi nhân viên / yêu cầu thanh toán, số yêu cầu chờ, số hóa đơn chưa thu, doanh thu hôm nay thật.
- `QrOrderingService`: thông tin bàn trả thêm yêu cầu đang chờ, hóa đơn chờ thanh toán (kèm mã QR), trạng thái "vừa thanh toán".
- `SalesDashboardService` / `Controller` (`/api/dashboard/revenue`, `/api/dashboard/top-dishes`): doanh thu theo giờ / ngày / tuần kèm kỳ trước, 5 món bán chạy / 5 món bán chậm, tính từ hóa đơn đã thanh toán.
- Nhật ký (module `cashier`): lập / thanh toán / hủy hóa đơn, hủy món / đơn, chuyển bàn, chuyển / hủy yêu cầu.

### Frontend
- **Trang đặt món**:
  - Gọi nhân viên: loại, gợi ý nhanh, trạng thái "Đang chờ" / "Nhân viên … đang đến", hủy yêu cầu.
  - Yêu cầu thanh toán: món và tạm tính, cảnh báo món chưa xong, hình thức, VAT.
  - Hóa đơn tự mở khi thu ngân lập, kèm mã QR chuyển khoản.
  - Lời cảm ơn khi đã thanh toán.
- **Thu ngân**:
  - Chi tiết đơn: thẻ yêu cầu và hóa đơn, các nút Hủy món, Hủy đơn, Chuyển bàn, Lập hóa đơn, Thu tiền.
  - Hộp thu tiền: nhiều hình thức, còn phải thu / tiền thối, mã QR khi có chuyển khoản, in hóa đơn.
  - Trang mới: `/thu-ngan/yeu-cau` (âm báo yêu cầu mới, tô đỏ quá 5 phút), `/thu-ngan/don-hang`, `/thu-ngan/hoa-don` (chi tiết, in, hủy, thu tiền).
  - Sơ đồ bàn: chuông / hóa đơn trên thẻ bàn, nhãn "Chờ thanh toán", ô Yêu cầu đang chờ.
- **Quản lý**:
  - Cấu hình hệ thống thêm tab **Thanh toán** (tài khoản nhận tiền, danh sách ngân hàng theo mã BIN).
  - Dashboard Doanh thu và Món ăn đọc số liệu thật; đã xóa `mocks/dashboard.ts`.

### Đã chạy thử
- API: 71/71 bước đạt.
- Chrome, khách trên khung iPhone + thu ngân + quản lý: 32/32 bước đạt.
  - Thay đổi hiện ngay ở cả hai phía: gọi nhân viên → thu ngân chuyển → khách thấy "đang đến".
  - Luồng thanh toán: yêu cầu thanh toán → lập hóa đơn → khách thấy QR → thu 2 hình thức → khách thấy "Cảm ơn".
  - Chuyển bàn, hủy đơn, danh sách hóa đơn / đơn, cấu hình tài khoản, Dashboard.

## Đợt 3 đã làm

### Database
- `db/migration/V12__cham_cong_luong.sql`:
  - Chấm công: nguồn (Excel / nhập tay), người và thời điểm nhập / sửa.
  - Kỳ lương: người tạo, người chốt, thời điểm chốt.
  - Bảng lương: tên vai trò lúc tính.
- `db/dev/V12_1__cham_cong_mau.sql`: chấm công khoảng 1,5 tháng, 2 dòng thiếu giờ ra, kỳ lương tháng trước đã chốt.
- `application.properties`: nâng giới hạn tải file lên 5 MB. Spring mặc định 1 MB; giới hạn 2 MB của file chấm công kiểm tra trong code. File quá lớn trả lỗi 422 "File quá lớn".

### Backend
- `com.rms.payroll.SheetIO`: tự đọc .xlsx (zip + XML, có chặn file nén "bom") và .csv (UTF-8 / BOM, dấu phẩy hoặc chấm phẩy, ngoặc kép). Tự ghi .xlsx cho file mẫu và file dòng lỗi. Không thêm thư viện.
- `AttendanceService` (UC-TN-10, 11):
  - Tìm dòng tiêu đề cột trong 10 dòng đầu.
  - Nhận diện nhân viên theo tên đăng nhập / email.
  - Hiểu ô ngày / giờ kiểu số của Excel, "dd/MM/yyyy", "8h". Ngày sai (31/02) là lỗi, không tự chỉnh.
  - Ca qua đêm.
  - Báo lỗi: chồng giờ (trong file và với dữ liệu có sẵn), ca quá 16 giờ, ngày ở tương lai, kỳ đã chốt.
  - Dòng trùng: bỏ qua / ghi đè. Máy chủ kiểm tra lại khi nhập.
  - Thêm / sửa / xóa tay (bắt buộc ghi chú); tổng giờ theo nhân viên.
- `PayrollService` (UC-TN-12):
  - Tạo kỳ: không chồng kỳ khác, tối đa 62 ngày.
  - Tính lương; tính lại vẫn giữ phụ cấp / khấu trừ.
  - Phụ cấp / khấu trừ bắt buộc có ghi chú.
  - Chốt: chặn khi còn dòng thiếu giờ ra hoặc kỳ chưa kết thúc; tính lại lần cuối trước khi chốt.
  - Phiếu lương.
- `RecipeService` (UC-BEP-06, 07):
  - Danh sách món + giá vốn ước tính.
  - Lưu công thức (thay toàn bộ): chặn trùng nguyên liệu, nguyên liệu đã ngừng dùng, định lượng ≤ 0 hoặc quá 3 số lẻ.
  - Số phần còn làm được theo món; tồn kho theo nguyên liệu.
- Phân quyền theo đường dẫn có sẵn: `/api/thu-ngan/attendance|payroll|employees` (Thu ngân), `/api/bep/recipes|stock-check|ingredient-options` (Bếp).
- Nhật ký module `payroll`, `kitchen`.

### Frontend
- **Bếp** (cùng nền tối với KDS, có thanh chuyển trang Hàng chờ · Kiểm tra nguyên liệu · Công thức):
  - `/bep/nguyen-lieu`: theo món (số phần, nguyên liệu giới hạn, nút Đánh dấu tạm hết khi còn 0 phần) và theo nguyên liệu; lọc danh mục, tình trạng.
  - `/bep/cong-thuc/:món`: danh sách món (lọc "Chưa có"), form định lượng, giá vốn / phần và % giá bán. Hỏi lại khi rời form chưa lưu hoặc khi xóa hết công thức.
- **Thu ngân**:
  - `/thu-ngan/cham-cong`: lọc nhân viên / khoảng ngày, tổng giờ theo nhân viên, thêm / sửa / xóa.
  - Hộp **Nhập từ Excel**: tải file mẫu, xem trước có lọc Hợp lệ / Trùng / Lỗi, chọn cách xử lý dòng trùng, tải file các dòng lỗi.
  - `/thu-ngan/bang-luong` và `/thu-ngan/bang-luong/:id`: tạo kỳ, phụ cấp / khấu trừ, tính lại, chốt, in bảng lương / phiếu lương.
- **Trang Nhật ký** (Quản lý): thêm tên module Bếp, Thu ngân, Chấm công – lương. Trước đây các dòng nhật ký của đợt 1–2 hiện trống tên module.

### Đã chạy thử
- API: 55/55 bước đạt.
  - Dùng file Excel thật tạo bằng openpyxl (ô ngày / giờ kiểu số, có dòng tên bảng phía trên), file CSV, file mẫu và file dòng lỗi đọc lại được.
- Chrome: 23/23 bước đạt.
  - Thu ngân: nhập file, thêm tay, tạo kỳ, phụ cấp, chặn chốt, in phiếu lương.
  - Bếp: kiểm tra nguyên liệu, khai báo công thức.

## Khác đặc tả / lưu ý
- **Combo không bán trên trang đặt món**: bảng combo hiện chỉ dùng cho chatbot gợi ý, chưa có giá bán. Đặc tả đã sửa theo.
- **Lọc nhanh** (không cay / chay / không chứa chất gây dị ứng) chưa làm, đưa sang "phát triển sau" trong đặc tả.
- **Giờ mở cửa**: ngoài giờ trong Cấu hình hệ thống thì khách chỉ xem thực đơn, không gửi món được. Khi test ngoài giờ, sửa giờ mở cửa trong Cấu hình hệ thống.
- Món chưa có ảnh hiển thị ô màu kèm biểu tượng (dữ liệu mẫu chưa có ảnh món).
- **Đợt 2** (đặc tả đã cập nhật theo):
  - Khách được hủy yêu cầu thanh toán khi còn Mới và chưa có hóa đơn.
  - Lời cảm ơn hiện 15 phút sau khi thanh toán.
  - Lọc "Đang mở" ở Đơn hàng không gồm đơn chờ thanh toán.
  - Tài khoản nhận tiền đặt ở Cấu hình hệ thống → Thanh toán.
- **Đợt 3** (đặc tả đã cập nhật theo):
  - Giờ ra để trống khi nhập vẫn hợp lệ, đánh dấu "Thiếu giờ ra".
  - Kỳ lương tối đa 62 ngày, chỉ chốt khi kỳ đã kết thúc.
  - Tình trạng món: Sắp hết = 1–5 phần.
- Tài khoản nhận tiền trong dữ liệu mẫu là **giả** (Vietcombank 1234567890). Trước khi dùng thật, Quản lý phải sửa ở Cấu hình hệ thống → Thanh toán.

## Chỉnh giao diện (sau đợt 3, theo yêu cầu rà từng trang)

- **Màn hình chờ khi mở web** (15/11/2026): thay màn hình trắng bằng hình động kiểu Pac-Man: miệng tròn xanh lá thương hiệu đứng yên, các món (bò bít tết, hamburger, ly nước, khoai tây chiên — theo chủ đề món bò của nhóm, không dùng hình con bò) trượt vào miệng; chữ "Chờ chút, món ngon sắp lên…".
  - Viết sẵn trong `frontend/index.html` (hiện ngay, trước khi JavaScript tải xong); áp chế độ sáng / tối đã lưu trước khi vẽ để không chớp trắng.
  - Dùng lại cho lúc kiểm tra đăng nhập và lúc chuyển hướng trang chủ (`components/common/PageLoader.tsx`, thay vòng xoay cũ). Đổi chữ: hằng `LOADER_TEXT` và dòng chữ trong `index.html`.
  - Chỉ hiện khi phải chờ quá **0,3 giây**, mờ dần lên. Trang tải nhanh thì không thấy màn hình chờ (tránh nháy), chỉ thấy nền cùng màu với web. Không cố tình giữ lâu hơn thời gian tải thật. Chuyển trang trong ứng dụng không hiện màn hình này.
  - Tắt hiệu ứng khi máy bật "giảm chuyển động". Chỉ đổi giao diện, không ảnh hưởng chức năng / đặc tả.
- **Phông chữ số** (15/11/2026): bỏ JetBrains Mono (số 0 có chấm ở giữa, rối mắt), dùng **Inter** với số đều cột cho mọi chỗ hiển thị số (tiền, giờ, số lượng, mã đơn / hóa đơn, đồng hồ bếp, trục biểu đồ).
  - Sửa ở `styles/tokens.css` (`--font-mono`), `globals.css` (lớp `font-mono` luôn `tabular-nums`), `main.tsx` (nạp `@fontsource-variable/inter`, gỡ gói JetBrains Mono), trục biểu đồ ở Dashboard quản lý và Dashboard kho. Số trong ô bảng không xuống dòng giữa chừng (mã HĐ "HD2611-154" bị ngắt dòng khi đổi phông).
  - Đã so sánh 5 phông: Plus Jakarta Sans có số 1 giống chữ l; Roboto Mono, DM Mono có số 0 gạch chéo. Chỉ đổi giao diện; bản in hóa đơn / phiếu lương dùng phông riêng, không đổi.
- **Trang đặt món của khách (QR) làm lại giao diện** (15/11/2026), theo ảnh mẫu app đặt đồ ăn người dùng gửi; chức năng giữ đúng UC-KH-01..06.
  - Bảng màu riêng cam – đỏ ấm (#FF6B2C, nền kem #FFF8F2), không dùng màu xanh của trang quản lý.
  - Thực đơn: lời chào + ô tìm kiếm; banner tự chuyển 3 món bán chạy nhất tuần; danh mục dạng ô biểu tượng dính đầu trang khi cuộn; hàng **Món nổi bật** (bán chạy hạng 4–10); lưới món 2 cột. Món chưa có ảnh dùng ô màu theo danh mục kèm biểu tượng (biểu tượng / màu tự gán theo tên danh mục).
  - Chi tiết món và giỏ món là **màn hình riêng toàn trang** (đường dẫn `?mon=` / `?gio=1`, nút Quay lại của điện thoại đóng được). Giỏ có nút xóa hết (hỏi lại).
  - Thanh tab dưới: Thực đơn · Món đã gọi · Gọi nhân viên · Thanh toán (thay 2 nút ở đầu trang). Thông báo nổi của trang khách hiện ở phía dưới để không che nút.
  - Backend: API thực đơn công khai trả thêm `bestSellers` (món bán chạy 7 ngày, ít số liệu thì 30 ngày, tối đa 10) — `QrOrderingService.menu`.
  - Không làm theo ảnh mẫu (không có dữ liệu / ngoài phạm vi): kích cỡ / món thêm có giá, đánh giá sao, calo, khuyến mãi, phí giao hàng, Yêu thích / Hồ sơ (khách không có tài khoản). Đặc tả UC-KH-02 đã cập nhật.
  - Trang đẹp hơn nhiều khi có ảnh món thật: Quản lý tải ảnh ở trang Món ăn (dữ liệu mẫu chưa có ảnh).
  - Đã chạy thử trên khung iPhone: banner, danh mục, tìm kiếm, chi tiết, giỏ, gửi món (bếp nhận ngay), hủy món, gọi nhân viên, yêu cầu thanh toán — 11/11 đạt.
- **Trang đặt món QR làm lại theo thiết kế Figma của nhóm** (16/11/2026), thay bản màu cam hôm trước. Luồng giữ đúng đặc tả (gửi món thẳng tới bếp, gọi thêm nhiều đợt, cuối bữa yêu cầu thanh toán, trả tại quầy); bỏ màn quét QR và phần sinh nhật của thiết kế.
  - **Bộ màu + phông riêng** chỉ cho trang khách: `features/ordering/qr-theme.css` (biến `--qr-*`, đỏ đậm #A71E25, bản tối #E2333B trên nền #0B0B0B), phông **Be Vietnam Pro** (`@fontsource/be-vietnam-pro`, chọn thay Urbanist của Figma vì Urbanist không có bộ chữ tiếng Việt). Sáng / tối tự theo điện thoại, có nút đổi (lưu trên máy).
  - Trang chính: "Bạn đang ngồi tại · Bàn …", nút Gọi nhân viên, **Món của tôi**; ảnh bìa + ô tìm kiếm + nút **Sắp xếp & lọc** (giá tăng / giảm, bán chạy; lọc bán chạy, chay, không cay, có cay, không chất dị ứng — lọc trên điện thoại); danh mục dạng viên có ảnh món (chưa có ảnh thì biểu tượng), chọn danh mục thì lọc danh sách; **Bán chạy** (thẻ dọc); **Tất cả món** (dòng); thanh nổi "[n] món | Xác nhận gọi món".
  - Màn hình riêng: chi tiết món (ghi chú cho bếp dạng danh sách lựa chọn "Miễn phí"), giỏ món (ghi chú từng món, giỏ trống có gợi ý món bán chạy), **Đã gửi tới bếp**, **Món của tôi** (theo dõi: Đã gửi → Đang chuẩn bị → Sắp xong → Sẵn sàng → Chúc ngon miệng, theo trạng thái món thật; kèm danh sách món theo đợt, hủy món, nút Gọi nhân viên / Thanh toán), **Thanh toán** (kiểu màn Checkout: nơi dùng bữa, món, chi tiết thanh toán, hình thức, VAT), **Hóa đơn** (mã hóa đơn, mã QR chuyển khoản), **Cảm ơn**.
  - **Ảnh bìa trang đặt món**: Quản lý tải ở Cấu hình hệ thống → Thông tin nhà hàng. `V13__anh_bia_trang_dat_mon.sql` (cột `restaurant_info.cover_image_url`), lưu qua `ImageStore` như ảnh món; API thông tin bàn công khai trả `coverImage`.
  - **Tranh minh họa theo dõi đơn**: chờ nhóm gửi 5 tranh xuất từ Figma. Đặt file vào `frontend/public/qr/tracking/` với tên `sent.png`, `cooking.png`, `almost.png`, `ready.png`, `served.png` là tự hiện; chưa có file thì dùng minh họa đơn giản (biểu tượng trên nền đỏ).
  - Không làm theo thiết kế (không có dữ liệu / khác UC): tùy chọn có giá thêm, calo, thời gian phục vụ dự kiến, đánh giá sao, mã khuyến mãi, phí phục vụ 10%, email nhận hóa đơn, thanh toán online, thanh toán trước khi bếp làm. Đặc tả UC-KH-02 đã cập nhật (lọc nhanh chuyển từ "phát triển sau" vào UC).
  - Đã chạy thử trên khung iPhone (sáng + tối): ảnh bìa từ Cấu hình, phông, danh mục, sắp xếp / lọc, chi tiết, giỏ, gửi món (bếp nhận ngay), theo dõi theo trạng thái bếp, gọi nhân viên, yêu cầu thanh toán, đổi sáng / tối — đạt.
- **Danh mục trên trang khách: bấm để cuộn tới mục** (16/11/2026, theo yêu cầu sau khi quét thử trên điện thoại): bấm viên danh mục → cuộn nhanh xuống đúng mục trong "Tất cả món" thay vì chỉ hiện món của danh mục đó; "Tất cả" → về đầu danh sách; tự cuộn thì viên danh mục tương ứng sáng (và tự trượt ngang cho thấy); đang tìm / lọc mà bấm danh mục thì bỏ tìm / lọc rồi cuộn. Đặc tả UC-KH-02 cập nhật. Đã chạy thử 6/6.
