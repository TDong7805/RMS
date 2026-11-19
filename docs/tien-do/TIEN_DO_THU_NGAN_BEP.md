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
- **Combo → Set menu** (19/11/2026): combo cũ mở rộng thành set có giá, bán trên trang đặt món; Chatbot dùng chính các set này để gợi ý (xem mục "Làm mới thực đơn").
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
  - **Đổi sang chủ đề Royal Beef (19/11/2026):** bỏ hẳn hình Pac-Man xanh lá (của Green Lotus). Hình mới vẽ bằng SVG + CSS: thớt gỗ có tay cầm, **miếng steak chín dần từ trái sang** (thanh "độ chín": hồng → nâu, lặp mỗi 3,6 giây), viền mỡ và vệt nướng, dao nĩa vàng đồng, nhánh hương thảo, hạt tiêu / muối, khói bốc. Màu Royal Beef (nền kem / nâu than, vàng đồng) cho mọi trang; giữ chữ "Chờ chút, món ngon sắp lên…". Co theo màn hình (rộng tối đa 340px, 84% bề ngang điện thoại). Giảm chuyển động: steak đứng yên ở mức chín vừa. Hình vẽ trong `index.html` và `PageLoader.tsx` phải giống hệt nhau. Sửa luôn tiêu đề tab "Royal Beef — Quản lý nhà hàng", mô tả trang và favicon (đầu bò vàng đồng trên nền đỏ rượu) — không còn chữ Green Lotus / "GL".
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
- **Màn hình bếp làm lại kiểu KDS** (16/11/2026, theo bố cục Lightspeed + tính năng học từ Toast, không dùng logo / tên thương hiệu):
  - Mỗi bàn một thẻ, trong thẻ chia đợt gọi (đợt mới nhất ở trên, nhãn "Mới gọi thêm"), mỗi đợt có đồng hồ riêng; sọc màu theo trạng thái (xanh dương còn món mới, cam đang làm).
  - Dải lọc Tất cả / Mới / Đang làm và viên danh mục kèm số; cách xem Theo món giữ nguyên.
  - Nút ⚙ cài đặt lưu trên từng máy (`rms-kds-settings`): nền sáng (mặc định) / tối, số cột, cỡ chữ, tối đa 4 mốc màu cảnh báo (mặc định 10/20/30 phút), danh mục màn này phụ trách (trạm). Trang Kiểm tra nguyên liệu, Công thức dùng cùng bộ màu (`kds-theme.css`).
  - Nhãn ĐÃ ĐỔI (khách / thu ngân hủy trong 10 phút, âm báo riêng + thông báo) và GỌI LẠI (bếp trả lại món đã xong) — migration **V14** thêm `order_items.recalled_at`.
  - Nút "Đã xong (n)" thay dải "Vừa hoàn thành": trả lại từng món / cả đợt. "TB hôm nay" = thời gian ra món trung bình.
  - Phím tắt: số chọn thẻ, ← →, Space = bắt đầu, Enter = xong, Esc.
  - API `/api/bep/queue` thêm `changed`, `avgMinutesToday`, `categories`; món thêm `recalledAt`, `cancelSource`, `cancelledAt`. Đặc tả UC-BEP-01, 03 cập nhật. Đã chạy thử 24/24.
- **Trang đặt món QR: hiệu ứng động + biểu tượng mới** (16/11/2026, người dùng chốt: sống động vừa phải; đủ 4 nhóm hiệu ứng; emoji 3D + icon mềm; danh mục cong luôn dính đầu trang, có "Tất cả"; bỏ nút ♡; tranh động Lottie):
  - Thư viện mới: `motion` (chuyển động), `lottie-web` (tranh động, tải khi cần), `@phosphor-icons/react` (icon bo tròn ở nút thao tác). Trang QR tải riêng (lazy) — thư viện không vào gói của trang quản lý (tách nhãn yêu cầu sang `requestLabels.ts`).
  - Emoji 3D Fluent (MIT) ở `frontend/public/qr/emoji/*.webp`, tranh động LottieFiles ở `frontend/public/qr/lottie/*.json`; nguồn ghi ở `frontend/public/qr/NGUON_TAI_NGUYEN.md`. Danh mục / món chưa có ảnh chọn emoji theo tên (`categoryEmoji`, `dishEmoji` trong `qrMotion.tsx`).
  - Dải danh mục cong như bánh xe (`CategoryArc`), món bay vào giỏ (`FlyProvider`), nút + biến thành bộ tăng giảm, số lăn / chạy số, ảnh bìa parallax, món hiện dần, khung chờ lấp lánh, màn hình trượt lên + kéo xuống để đóng, chuông rung.
  - Chi tiết món làm lại: ảnh tràn phóng to từ thẻ (thu về khi đóng), bảng bo tròn, thành phần dạng viên, dị ứng chỉ khi có, ghi chú viên + "Ghi chú khác", thanh dưới một hàng, xem ảnh toàn màn hình. Bỏ thông báo "Đã thêm …" (thay bằng hiệu ứng bay vào giỏ) và "Đã gửi …" (thay bằng màn chúc mừng).
  - Theo dõi đơn: tranh động theo giai đoạn + thanh 5 bước; giỏ trống / chưa gọi món có tranh động; màn cảm ơn có tranh động.
  - Sửa lỗi cũ: tiêu đề h1/h2 ở nền tối bị tô màu chữ của trang quản lý.
  - Đặc tả UC-KH-02, 03, 04 cập nhật. Đã chạy thử: kịch bản mới 15/15, hồi quy QR 15/15, nhảy danh mục 6/6.
- **Thông báo trạng thái trên trang khách thành viên nhỏ trên ảnh bìa** (16/11/2026, người dùng thấy khung vàng nằm sát dải danh mục trông xấu): "🌙 Ngoài giờ phục vụ · mở lại 10:00 sáng mai", "🧾 Hóa đơn … — chờ thanh toán" (bấm mở hóa đơn), "⏳ Bàn đang chờ thanh toán". API thông tin bàn thêm `reopenAt` (lần mở cửa kế tiếp theo bảng giờ mở cửa, `OrderCore.nextOpenAt`), không đổi CSDL. Đặc tả UC-KH-01 cập nhật.
- **Bỏ icon đứng cạnh chữ trên trang khách** (16/11/2026, người dùng: chữ đã mô tả thì không cần icon, trông không thuận mắt): bỏ emoji ở "Chào mừng đến với", viên trạng thái trên ảnh bìa, tiêu đề "Bán chạy" và tiêu đề từng danh mục, nhãn #1 / Bán chạy / Bán chạy #n, nhãn cay (giữ chữ màu cam) / chay (chữ xanh), bảng lọc, "Gợi ý món bán chạy", "Xóa hết giỏ món", "Đã gửi yêu cầu thanh toán", nút "Xem thực đơn". Giữ: nút chỉ có icon, vòng tròn danh mục, emoji thay ảnh món, khung cảnh báo dị ứng, túi giỏ, tranh động, và các icon người dùng chọn giữ (Món của tôi, ô tìm kiếm, mũi tên →, Gọi nhân viên / Thanh toán, chuông chờ nhân viên, ✓ viên ghi chú, + Ghi chú khác, ✓ Đã thêm, icon hình thức thanh toán, tranh chuông khi chờ). Xóa các file emoji không còn dùng. Đặc tả UC-KH-01, 02 cập nhật.
- **Thu ngân: sơ đồ bàn kiểu POS** (17/11/2026, theo ảnh mẫu người dùng gửi + tham khảo Odoo POS nhà hàng; người dùng chốt: tách khu POS / Văn phòng, lưới ô hiện có, nền sáng, bấm bàn mở bảng bên phải, "Quá giờ" = món chờ quá 25′, đặt bàn hiện trước 2 giờ, thêm 3 chức năng: đặt bàn trên sơ đồ, số khách / số ghế, in tạm tính):
  - Khung POS toàn màn hình (`CashierShell`): tab Sơ đồ bàn · Đơn hàng · Yêu cầu · Hóa đơn (kèm số), nút Văn phòng; Chấm công / Bảng lương / Thông báo giữ khung quản lý, menu trái có "Về quầy thu ngân".
  - Sơ đồ (`FloorPage`): bàn đúng hình + ghế quanh bàn, 8 màu trạng thái, đồng hồ, số khách, tạm tính / tên đặt dưới bàn, phóng to, dải chú thích có số lượng + tổng khách + đã thu. Bảng bên phải: chờ mang ra / đặt bàn hôm nay; bàn có khách: số khách, món, yêu cầu, In tạm tính, Chuyển bàn, Lập hóa đơn / Thu tiền.
  - Migration **V15** thêm `orders.guests`; API `POST /api/thu-ngan/orders/{id}/guests`; sơ đồ trả thêm số khách, số món quá giờ, danh sách đặt bàn hôm nay (gần nửa đêm vẫn lấy tới 2 giờ tới).
  - `tokens.css`: thêm `[data-theme='light']` để khu POS luôn sáng. Đặc tả UC-TN-01 viết lại. Đã chạy thử 21/21.
- **Sửa lỗi dải danh mục cong bị giật khi bấm mục xa** (17/11/2026, người dùng thấy trên điện thoại): bấm mục 4 thì dải khoanh 4 rồi giật về 1, 2, 3 mới tới 4 — do lúc trang tự cuộn mượt, phần "cuộn tới đâu sáng mục đó" chọn lần lượt các mục đi ngang. Nay tạm tắt phần đó trong lúc trang tự cuộn (mở lại khi trang dừng cuộn). Đã kiểm tra với cuộn mượt giả lập: trước sửa nhảy qua 4–6 mục, sau sửa đi thẳng tới mục.
- **Dữ liệu mẫu đổi sang nhà hàng Royal Beef** (17/11/2026, người dùng duyệt thực đơn trước khi làm): bò Úc hiện đại kèm món Việt, **38 món / 8 danh mục** (bỏ món không dùng bò và cà phê theo yêu cầu).
  - Viết lại dữ liệu mẫu `db/dev` V1_1, V3_1, V3_3, V10_1, V11_1 và 3 bộ sinh kho (`gen-v7_1/8_1/9_1.mjs` → V7_1/V8_1/V9_1): 29 nguyên liệu bò / rau / đồ uống, 6 nhà cung cấp, 27 công thức định lượng, ~690 đơn lịch sử (món bán chạy hợp lý, món giá cao 1 phần / dòng), combo, bài viết, đơn đang mở ở bếp / thu ngân, T-bone hết hàng + tạm hết.
  - Migration **V16** (mọi môi trường): tên nhà hàng, lời chào chatbot (Roy), gợi ý nhanh "Bít tết Úc" — chỉ đổi khi còn mặc định "Green Lotus".
  - Ảnh mẫu: `backend/database/seed-images/mon/` theo `danh-sach.csv` + `anh-bia.jpg`; `SeedImageLoader` (chỉ dev) tự gắn khi khởi động, không gắn đè ảnh Quản lý đã đổi / xóa. Người dùng tự tìm ảnh.
  - Trang khách: bỏ lọc "Món chay"; emoji danh mục theo tên mới (Món nước 🍜, Bít tết 🥩, Lẩu 🍲, danh mục "chay" 🥗), thêm emoji burger / khoai tây chiên / vang / trà.
  - **Mỗi người phải xóa `rms_db` rồi chạy backend** (sửa file dữ liệu mẫu đã chạy → sai checksum). Đã nạp thử trên CSDL sạch: 27 migration chạy hết, kịch bản QR 15/15, nhảy danh mục 6/6 + 9/9.
- **Trang QR: ảnh danh mục, chi tiết món mới, sửa giật khi thêm vào giỏ** (17/11/2026, người dùng chọn hướng trước khi làm):
  - Dải danh mục cong: bỏ emoji 3D, dùng **ảnh danh mục** (món tách nền trong vòng tròn trắng, kiểu app giao đồ ăn); "Tất cả" ghép 4 ảnh danh mục đầu; chưa có ảnh hiện chữ cái đầu.
  - Migration **V17** `dish_categories.image_url`; Quản lý tải ảnh ở Món ăn → **Danh mục món** (bật / tắt không mất ảnh). API `/api/dish-categories` và menu QR trả `image`. Ảnh mẫu: `seed-images/danh-muc/` theo `danh-sach.csv` (SeedImageLoader gắn như ảnh món). Prompt AI cho ảnh danh mục trong `PROMPT_ANH_AI.md`.
  - Chi tiết món làm lại: màn trượt lên, nền ảnh món làm mờ + ảnh món bo tròn nổi, các khối hiện lần lượt; **Độ chín** (5 mức, dải màu thịt) + **Sốt kèm** cho bít tết; **ghi chú nhanh theo loại món** (`features/ordering/dishOptions.ts` — lẩu không còn "Không đá"…), lựa chọn ghép vào ghi chú dòng món.
  - Thêm vào giỏ: trước đây ảnh bay và màn đóng chạy chồng nhau → giật ~1 giây. Nay màn đóng trước (0,26 giây), xong mới bay từ thẻ món vào giỏ; tách context "giỏ nảy" để các thẻ món không vẽ lại mỗi lần thêm.
  - Kiểm thử Playwright (iPhone 13, CSDL tạm): 13/13 — ảnh danh mục, độ chín mặc định, ghi chú ghép "Medium, Sốt nấm, Cắt sẵn", lẩu / đồ uống đúng ghi chú, màn đóng < 1,2 giây rồi mới bay, không lỗi trang. Đặc tả UC-KH-02 cập nhật, dựng lại file Word.
- **Trang QR: tông ấm khớp ảnh món** (17/11/2026, người dùng chọn mức "nhẹ" — vẫn theo Figma của nhóm): `qr-theme.css` đổi đỏ tươi → đỏ rượu vang `#8e1b22`, nền trắng → kem `#faf6f1`, viền / chữ phụ ngả nâu, bản tối đen → nâu than `#17110e`; ảnh bìa mặc định đỏ rượu chuyển nâu gỗ; bóng đổ ấm (biến `--qr-primary-glow`).
  - Tiêu đề (tên nhà hàng, Bán chạy, Tất cả món, tên danh mục, tên món ở chi tiết, đầu các màn) dùng chữ có chân **Playfair Display** (gói `@fontsource-variable/playfair-display`, giấy phép OFL, có tiếng Việt; chỉ nạp ở trang QR). Cả nhóm cần `npm install`.
  - Thẻ Bán chạy: ảnh tràn phần trên thẻ, phủ tối nhẹ ở đáy; dòng món ảnh 104px bo góc có bóng.
  - Đã chạy với 39 ảnh món thật (tạo bằng AI) trên CSDL tạm: kịch bản QR 12/13 (bước còn lại cần ảnh danh mục — chưa có), chụp sáng / tối.
- **Kịch bản test cập nhật + chạy test trên CSDL riêng** (17/11/2026): `KICH_BAN_TEST.md` sửa theo hệ thống hiện tại (bếp KDS, sơ đồ bàn POS 8 màu, trang QR tông ấm / ảnh danh mục / chi tiết món mới, T-bone tạm hết), thêm B17–B19 (độ chín, ghi chú theo loại món, ảnh danh mục) và E8b; đặt bàn ở website khách để sau. Chế độ test: backend chạy với `DB_NAME=rms_test` + `RMS_UPLOAD_DIR=uploads-test` (không đụng `rms_db` / `uploads`); máy cá nhân có `dev-test.bat` / `dev-test-reset.bat` (`dev.ps1 -Test / -ResetTest`, chỉ xóa `rms_test`); `.gitignore` thêm `uploads-test/`.
- **Sửa theo kết quả test lần 1 của người dùng** (17/11/2026, người dùng chốt hướng trước khi làm):
  - **Bếp bấm "Đã lấy"** thay cho thu ngân đánh dấu đã mang ra (thu ngân không thấy lúc món rời bếp, nhân viên phục vụ không có tài khoản): nút đầu trang bếp đổi "Chờ lấy (n)" (món đã xong của đơn đang mở, không giới hạn 30 phút; Trả lại vẫn trong 30 phút), API `POST /api/bep/items/serve`; bỏ API / nút "Đã mang ra" của thu ngân, sơ đồ bàn chỉ hiển thị "Chờ mang ra".
  - **"Đã báo nhân viên"** thay cho chuyển yêu cầu theo tên nhân viên (nhóm dùng bộ đàm): bỏ `GET /api/thu-ngan/staff`, `forward` không cần staffId; khách thấy "Nhân viên đang đến bàn bạn"; xử lý yêu cầu ngay trên bảng bàn của sơ đồ (Đã báo nhân viên / Hoàn thành; yêu cầu thanh toán: Lập hóa đơn / Thu tiền).
  - Thông báo yêu cầu mở `/thu-ngan/yeu-cau?id=…`, dòng yêu cầu / hóa đơn mở từ thông báo **sáng nhấp nháy** (`.rms-flash`).
  - Trang khách: gợi ý gọi nhân viên theo loại; màn "Đã gửi tới bếp" có danh sách món; thanh toán khi giỏ còn món chưa gửi thì hỏi (Gửi bếp / Bỏ / Quay lại); cảm ơn → "Xem thực đơn" về thẳng thực đơn; **độ chín dạng thanh kéo** màu thịt (input range, kéo hoặc bấm tên mức).
  - Prompt AI cho tranh trạng thái (thay Lottie) và clip đầu bếp lật bò cạnh tên quán (nền đen, trộn màu vào ảnh bìa) — chờ người dùng tạo.
  - Kiểm thử Playwright 20/20 (bếp Đã lấy → khách Đã mang ra, thu ngân không còn nút, Đã báo nhân viên trên bảng bàn → khách thấy, sáng dòng từ thông báo, gợi ý theo loại, giỏ chưa gửi, thanh kéo độ chín) + QR 13/13. Kịch bản test và đặc tả (UC-BEP-03, UC-TN-03/06, UC-KH-03/05/06) cập nhật, dựng lại Word.
- **Tranh trạng thái mô hình 3D + clip chảo hất bò** (17/11/2026, người dùng chọn phong cách mô hình 3D tí hon, không có người): bỏ tranh động Lottie (xóa `public/qr/lottie`, gỡ gói `lottie-web` — cả nhóm `npm install`); `features/ordering/qrScene.tsx` — `Scene` (ảnh 4:3 trong `public/qr/tranh`, hiệu ứng: lơ lửng + phóng chậm, hơi bốc, ánh đèn / nến lập lòe, kim tuyến; video lặp cho Đã gửi / Đang nấu) dùng ở màn Đã gửi, theo dõi đơn, giỏ trống, cảm ơn, hộp chờ nhân viên, trang mã QR lỗi / bàn tạm ngừng; `PanClip` cạnh tên quán (`public/qr/clip/chao-bo.mp4`, ~12 giây phát một lần, trộn screen + tăng tương phản + mờ mép). Giảm chuyển động / tiết kiệm dữ liệu: ảnh tĩnh, không clip. Ảnh nén còn 14–34 KB. Kiểm thử 7/7 (404 của mã QR sai là đúng). Đặc tả UC-KH-02/03/04 cập nhật, dựng lại Word; nguồn ghi ở `NGUON_TAI_NGUYEN.md`.
- **Chỉnh tranh trạng thái theo góp ý** (17/11/2026): giỏ trống / bàn chưa gọi món dùng lại tranh động xe hàng (Lottie `empty-cart`, cài lại `lottie-web`); màn Đã gửi + Cảm ơn: tranh gọn trong khung bo góc (~300px), không phủ nửa màn hình; **bỏ bước "Sắp xong"** (theo dõi đơn còn 4 bước: Đã gửi → Đang nấu → Sẵn sàng → Đã mang ra); clip chảo rõ hơn (to hơn, sáng hơn, mép mờ ít hơn); video không phóng / lơ lửng thêm và hiện đủ khung (object-contain). Dựng trang xem thử mẫu Lottie (chạy trực tiếp, tự tô lại màu Royal Beef) để người dùng chọn thay video.
- **Tranh trạng thái đổi sang Lottie tô màu Royal Beef** (17/11/2026, người dùng chọn mẫu): gỡ hết ảnh / video mô hình 3D và clip chảo hất bò (xóa `public/qr/tranh`, `public/qr/clip`, bỏ PanClip); 4 Lottie từ LottieFiles — Đã gửi `paper-plane-1`, Đang nấu `bbq-6`, Sẵn sàng `bell-0`, Đã mang ra / cảm ơn / trang lỗi `restaurant-2` — tô lại màu (đỏ rượu / vàng đồng / kem / nâu, bỏ lớp nền) lưu thành `public/qr/lottie/sent|cooking|ready|served.json`; `qrScene.tsx` → `StageLottie`: đĩa kem viền vàng đồng lơ lửng + hiệu ứng nền (quầng sáng, quầng lửa + tàn lửa, vòng sóng chuông, lấp lánh). Kiểm thử 7/7 đủ 4 giai đoạn + nền tối + trang lỗi.
- **Trang QR: đèn kéo dây, băng chuyền Bán chạy, nồi nấu, sửa lọt cuộn** (17/11/2026, người dùng chọn hướng): nút sáng / tối → `LampSwitch` (đèn thả chụp vàng đồng treo mép trên ảnh bìa, dây kéo bằng cử chỉ pan, thả thì dây nảy + đèn đung đưa; đổi màu lan theo vòng tròn từ núm đèn bằng View Transitions, trình duyệt không hỗ trợ thì đổi ngay); `BestCarousel` (khối nền nâu than luôn tối, thẻ to 212px, nhãn vàng "Bán chạy #n", đèn chiếu, tự trượt ~28px/s, dừng khi chạm / vuốt / rê chuột 4 giây, tới cuối quay về đầu, giảm chuyển động thì không tự trượt); Đang nấu dùng lại Lottie nồi nấu cũ tô màu Royal Beef; `scrollLock.ts` cố định body khi mở màn phủ / tấm trượt (sửa lỗi kéo lọt xuống thực đơn trên iPhone) + overscroll-contain cho các danh sách. Kiểm thử 9/9.
  - Băng chuyền Bán chạy đổi sang **chạy qua lại** (người dùng chọn): tới mép chậm dần, dừng 1,5 giây rồi đổi chiều, thay cho kéo nhanh về đầu.
  - Tranh nồi nấu tô riêng: bỏ nền tròn trong tranh (thìa / rau củ bị lẫn vào nền vàng), thìa gỗ nâu đậm, nồi đỏ rượu nắp vàng đồng, rau củ giữ màu tự nhiên.
- **Kiểm thử tự động đợt chức năng** (17/11/2026, CSDL tạm sạch): API bếp / thu ngân 25/25, yêu cầu – hóa đơn – thanh toán – chuyển bàn 70/70, chấm công – lương – công thức – kiểm tra nguyên liệu 55/55, **kho mới viết `api-kho.mjs` 46/46** (F1–F12, E3, E11, E12), đăng nhập 17/17. Các kịch bản cũ (tài khoản, món ăn, bài viết, ca làm, chatbot, giao diện kho) lỗi do còn dữ liệu Green Lotus, không phải lỗi hệ thống — chưa viết lại. Không phát hiện lỗi chức năng mới.

## Làm mới thực đơn: nhóm món + set menu (19/11/2026)

### Database
- Migration `V19__nhom_mon_va_set.sql`: bảng `dish_groups`; `dishes.group_id`, `variant_label`; `combos` thêm mô tả, giá, ảnh, `on_menu`, giờ bán `sell_from/sell_to`, thứ tự; `combo_items.allow_variant`, `sort_order`; bảng `order_sets` (chụp tên + giá set lúc gọi); `order_items.order_set_id`.
- Dữ liệu mẫu: `V3_1` thực đơn 55 món đang bán (thêm danh mục **Gọi thêm**, nước suối, vang chai, 6 nước ngọt; sửa mô tả / dị ứng); `V19_1` 3 nhóm món + 4 set (Steak 2 người 1.390k, Tomahawk 2.390k, Lẩu 4 người 1.090k, Trưa văn phòng 199k 10:30–14:00); `V7_1` sinh lại: 106 nguyên liệu, công thức đủ 56 món, giá vốn trung bình ~40%.
- Ảnh mẫu: `seed-images/mon` (56), `nhom/`, `set/`, `danh-muc/goi-them.png`, `anh-bia.jpg`; `SeedImageLoader` gắn thêm ảnh nhóm / set.
- **Cả nhóm phải xóa `rms_db`** rồi chạy lại (Flyway báo sai checksum vì dữ liệu mẫu V3_1 / V7_1 đổi).

### Backend
- `QrOrderingService`: thực đơn trả thêm `groups`, `sets`; gửi giỏ có dòng set → tạo `order_sets`, chia giá set cho từng món con theo tỉ lệ giá lẻ (phần lẻ làm tròn dồn vào 1 dòng, tổng luôn đúng giá set); khách hủy món con khi cả set còn chờ → hủy cả set. Set ẩn khi tắt / không bán trên thực đơn / ngoài giờ / món con tạm hết (món cho đổi loại thì lấy loại khác còn bán). Bán chạy chỉ tính món ăn (bỏ đồ uống, Gọi thêm, set), gộp theo nhóm.
- `DishService` / `DishController`: trường nhóm + tên loại; CRUD `/api/dish-groups` (xóa nhóm → món đứng riêng).
- `ChatbotMenuService`: combo → set (giá, ảnh, giờ bán, cho đổi loại, thông báo lỗi chữ "Set…").
- `OrderCore` / `InvoiceService` / `KitchenService`: món mang tên set; hóa đơn 1 dòng set kèm chi tiết món.

### Frontend
- Trang QR: thẻ nhóm + bảng chọn loại (`GroupPickSheet`), khu **Set menu** dưới Bán chạy (thẻ giấy thực đơn), màn chi tiết set (độ chín / sốt từng phần, chia loại nước ngọt), hàng "Gọi thêm cho món này" ở chi tiết món, ghi chú mặc định "Medium rare, Sốt tiêu đen" khi bấm + món steak, giỏ / Món của tôi hiện dòng set + "Hủy cả set"; có ảnh bìa thì bỏ dòng chào.
- Quản lý: nút **Nhóm món** (`GroupModal`), trang **Set menu** (`/quan-ly/mon-an/set-menu`), ô "Nhóm hiển thị" / "Tên loại trong nhóm" ở biểu mẫu món; tab Chatbot chỉ còn tóm tắt set + liên kết.
- Bếp: nhãn "SET · …"; Thu ngân: "Thuộc [set] · giá đã chia từ giá set", hóa đơn / in có chi tiết set.

### Đã chạy thử
- API: thêm bộ `tests/api/12-nhom-mon-set.mjs` (42 bước); sửa 03, 04, 08 theo dữ liệu mới — **12 bộ, 479/479 đạt**.
- Chụp màn hình trang QR (sáng / tối), màn set, bảng chọn loại, trang Set menu quản lý, bếp, thu ngân.
- Tài liệu: đặc tả `DacTa_UC_DatMon_Bep_ThuNgan.docx` (KH-02/03/04, BEP-01, TN-04/07) và `CodeUC_QLNH.docx` (UC-MON-01 thêm 3d / 3e / 5c / 5d + quy tắc, UC Chatbot đổi Combo → Set menu); `DU_LIEU_GIA`, `KICH_BAN_TEST` (B26–B37, C0, E8c, E8d), `CONG_THUC_DINH_LUONG`, `PROMPT_ANH_AI`.

### Chỉnh sau khi chạy thử (19/11/2026)
- **Khung Set menu**: thay danh sách thẻ xếp dọc bằng một khung giấy kem viền đôi, mỗi lần một set; vuốt ngang (hít đúng trang), tự sang set kế sau ~9 giây (chuyển nhanh, tới cuối chạy ngược lại; dừng khi mở màn khác / khung khuất / giảm chuyển động), hàng chấm chỉ báo vị trí ở đáy khung; **ruy-băng chéo góc "-x%"** (làm tròn xuống, dưới 5% không hiện) + dòng "Tiết kiệm [số tiền]".
- **Bảng chọn nhóm món** làm lại: nút + của thẻ nhóm không còn hiệu ứng bay vào giỏ (trước đây gây nhầm là đã thêm); mỗi loại một dòng − / +, bảng không tự đóng, mở ra thấy sẵn số trong giỏ; nút dính đáy "Thêm vào giỏ · n món · tổng" / "Cập nhật giỏ" / "Bỏ khỏi giỏ" — chỉ khi bấm mới đổi giỏ và ảnh mới bay vào giỏ; chạm ảnh / tên loại → chi tiết món; kết quả tìm kiếm ghi tên nhóm dưới tên món.
- **Ảnh bìa mới**: biển hiệu treo cao trên cửa kính (thanh tìm kiếm không che chữ), prompt cập nhật trong `PROMPT_ANH_AI.md`.
- Chỉ sửa frontend (`QrMenuExtras.tsx`, `QrParts.tsx`, `QrOrderPage.tsx`) + ảnh bìa; không đổi CSDL. Chụp màn hình sáng / tối: tự chuyển, vuốt, bảng chọn (nháp → thêm → cập nhật), chi tiết Sprite, tìm kiếm — không lỗi trang. Đặc tả KH-02 (thẻ Set menu, thẻ nhóm, luồng 4d) và kịch bản B26–B26c, B29–B29b, B37 cập nhật.

## Việc để sau / ghi chú quyết định (18/11/2026)

- **Phục vụ xác nhận món trước khi xuống bếp (X1):** tạm giữ như hiện tại — khách gửi là xuống bếp thẳng. Nhóm chạy thử và thống nhất ở buổi họp thứ 6 (21/11/2026); nếu cần sẽ làm chế độ phục vụ nhập mã PIN trên điện thoại khách để xác nhận, Quản lý bật / tắt trong Cấu hình.
- **Đề xuất nhập hàng – chỉnh theo sự kiện (B13):** chưa làm. Ý tưởng để sau: Kho nhập "tăng / giảm X%" cho kỳ có lễ / Tết / tiệc lớn, hoặc tự cộng theo số khách đặt bàn trước của kỳ tới.
- **Chatbot AI:** để sau (hướng dự kiến: mô hình ngôn ngữ qua API + công cụ chỉ đọc thực đơn, không cho AI đọc thẳng CSDL).
- **Mở bàn** (18/11/2026, người dùng chốt A1–A8): mã QR chỉ gửi được món khi thu ngân đã mở bàn. Mở bàn = tạo đơn rỗng (người mở, số khách, phiếu đặt) — `POST /api/thu-ngan/tables/{id}/open`; đóng bàn chưa gọi món `POST /api/thu-ngan/orders/{id}/close` (có món thì dùng Hủy đơn); tự đóng bàn mở quá N phút chưa gọi món (tác vụ mỗi phút; Cấu hình hệ thống → Gọi món tại bàn, `GET/PUT /api/settings/ordering`, mặc định 30, 0 = tắt; migration V18); bàn đặt trước có nút "Khách đã đến – Mở bàn" (phiếu đặt → seated). Trang khách: bàn chưa mở thì viên "Bàn chưa mở" trên ảnh bìa, giỏ báo và khóa nút Gửi, gợi ý gọi nhân viên "Mở bàn giúp tôi"; bàn đóng / lượt khách mới thì xóa giỏ chưa gửi. Kiểm thử API 19/19 (`api-open.mjs`) + giao diện 9/9; các bộ cũ cập nhật thêm bước mở bàn: 25/25, 70/70, 55/55, kho 46/46. Đặc tả thêm UC-TN-14, UC-KH-03 ngoại lệ 7e; kịch bản test thêm A2b, B22–B25.
- **Kiểm thử tự động mức API – đưa vào repo** (18/11/2026): 11 bộ trong `tests/api/`, chạy `node tests/run-all.mjs` (hướng dẫn: `tests/README.md`). Cấu hình chung `tests/lib/env.mjs` (mặc định backend 8080 + CSDL `rms_test`, từ chối `rms_db`), file mẫu chấm công ở `tests/fixtures/`. Đã viết lại các bộ còn dữ liệu Green Lotus (tài khoản, món ăn, chatbot) theo dữ liệu Royal Beef. Kết quả trên CSDL sạch: **437/437 bước đạt**.
- **Khi nào làm kiểm thử đơn vị JUnit (mức c):** chưa làm. Bắt đầu khi **làm chức năng Đề xuất nhập hàng / dự báo** (sau buổi họp 21/11/2026 chốt phương pháp) — viết JUnit cho công thức dự báo ngay lúc viết công thức, vì sai số khó thấy bằng mắt. Sau đó bổ sung dần cho: tính tiền hóa đơn (giảm giá, VAT, làm tròn), giá vốn bình quân khi nhập kho, tính lương từ chấm công. Cũng viết JUnit **trước khi sửa lớn** (tách / gộp service) các phần trên để biết có làm hỏng không. Các phần còn lại (CRUD, phân quyền) đã có kiểm thử API phủ, không cần JUnit.
