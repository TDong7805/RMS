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

## Sửa giao diện theo quy tắc – nhóm 1: nền chung (26/11/2026)

Theo `docs/thiet-ke/QUY_TAC_GIAO_DIEN.md` (đợt A + "Thiết kế theo từng trang"). Chỉ sửa frontend, không đổi nghiệp vụ / dữ liệu.
- **Màu:** trang nhân viên giữ xanh dịu mát; nền ánh xanh nhạt hơn, viền dịu, thẻ (`Card`) có bóng nhẹ `--shadow-card`; thêm `--brand` (đỏ rượu) chỉ cho logo "RB" (khung Quản lý / Kho, trang đăng nhập); vàng cảnh báo đậm hơn.
- **Menu trái kiểu Linear** (`AppShell`): ghim (mặc định) hoặc thu gọn = ẩn hẳn; rê chuột vào nút mở menu / mép trái → menu trượt ra nổi, rời chuột tự ẩn, bấm để ghim; máy tính bảng chạm để mở; phím `[`; nhớ trạng thái (`localStorage rms-sidebar-collapsed`); chấm đỏ số thông báo trên nút mở menu (sửa góp ý 3.1). Bỏ kiểu cột biểu tượng cũ.
- **Bảng lệnh Ctrl+K** (`CommandPalette`, thay `SearchBox`): nhóm Gần đây / Đi tới · Tạo mới (theo khu Quản lý / Kho) · Hệ thống (sáng / tối, thu gọn menu, đổi mật khẩu, đăng xuất); phím tắt bên phải; ↑ ↓ Enter Esc (góp ý 3.2).
- **Thông báo nổi kiểu Atlassian Flag** (trang nhân viên): thẻ nền trang, biểu tượng màu theo loại, tiêu đề + mô tả, nút hành động (Hoàn tác) chữ màu chính; màu theo sáng / tối của hệ thống.
- **Màn hình chờ** chỉ hiện khi tải quá 0,6 giây (trước 0,3 giây) → hết chớp khi tải lại (lỗi L7, dòng 1.3).
- **Đăng nhập:** gửi lại không xóa thông báo lỗi cũ, không ẩn hộp "phiên hết hạn" lúc đang gửi → khung không nhảy (dòng 2.3).
- **Nút:** thêm viền tập trung khi dùng bàn phím, ghi chú cấp nút.
- **Thành phần làm sẵn, chưa gắn trang:** `Banner` (dải cảnh báo), `FilterChips` (chip lọc + menu tìm loại lọc), `FilteredEmpty` (trang trống "n mục đang bị ẩn bởi bộ lọc · Xóa lọc"), `StickySaveBar` (thanh lưu dính đáy). Gắn dần khi sửa từng trang.
- Đăng xuất bấm Back ra website (2.10): giữ nguyên — đăng xuất đã thay trang hiện tại bằng trang đăng nhập; Back về trang trước khi vào hệ thống, không lộ dữ liệu.
- Kiểm tra: chụp sáng / tối, máy tính + máy tính bảng (Quản lý, Kho), Ctrl+K, phím `[`, thông báo, hộp xác nhận, đăng nhập sai — không lỗi trang. Typecheck sạch.
- **Chữ dễ hiểu (không dùng từ kỹ thuật):** hộp xóa món — món đã có trong hóa đơn cũ thì tiêu đề "Không xóa được …", giải thích hậu quả và nút **Ngừng bán** ngay trong hộp (món đã ngừng bán thì chỉ có Đóng); món chưa có trong hóa đơn nào: "Xóa rồi sẽ mất hẳn, không lấy lại được". Trang Chatbot: "Đồng bộ" → "Cập nhật", thẻ Gemini bỏ chữ "biến môi trường / backend".
- **Dòng phiếu test cần test lại:** 1.1–1.3, 2.3, 3.1, 3.2, 3.5, 3.6, 4.1, 9.3 (thông báo), 15.5 (đăng xuất ở cửa sổ khác vẫn đúng), 9.3 hộp xóa món (cả món đã bán và món chưa bán), 16.2.

## Sửa giao diện theo quy tắc – nhóm 2: Dashboard Quản lý (26/11/2026)

Theo mục B5 của `docs/thiet-ke/QUY_TAC_GIAO_DIEN.md`. Đọc từ trên xuống: hôm nay thế nào → vì sao → làm gì tiếp.
- **Backend:** thêm `GET /api/dashboard/overview?period=` (`SalesDashboardService.overview`) trả mọi số liệu trong một lần gọi: 4 chỉ số kèm kỳ trước và % (doanh thu, số đơn, trung bình mỗi đơn, **số khách** = tổng `orders.guests` của đơn đã thanh toán), biểu đồ doanh thu, cơ cấu doanh thu theo danh mục (tiền món quy về đúng tổng hóa đơn) và theo cách trả tiền (`payments.method`), giờ đông khách (theo giờ tạo đơn), số phần / doanh thu từng món kỳ này + kỳ trước, loại món (món ăn / đồ uống / gọi thêm — cùng cách nhận biết với băng chuyền bán chạy ở trang QR). Giữ nguyên `/revenue`, `/top-dishes` (kiểm thử còn dùng).
- **Frontend:** dựng lại `DashboardPage` + `features/dashboard/OverviewBlocks.tsx`:
  - **Một bộ chọn thời gian chung cho cả trang** ở góc trên phải (trước đây mỗi khối chọn riêng) + nút So sánh kỳ trước (thêm đường nét đứt trên biểu đồ).
  - Hàng 1: 4 thẻ số có nhãn % xanh / đỏ "so với hôm qua / 7 ngày trước đó…"; điện thoại xếp 2 × 2.
  - Hàng 2: Doanh thu theo thời gian (biểu đồ cũ) + **Cơ cấu doanh thu** (vành khuyên, tối đa 5 phần + "Khác", tổng ở giữa; đổi Theo danh mục / Theo cách trả tiền).
  - Hàng 3: **Giờ đông khách** (cột theo giờ, giờ đông nhất tô đậm, đổi Số đơn / Số khách) + **Món bán chạy / bán chậm** dạng danh sách gọn có ảnh nhỏ, lọc Món ăn (mặc định) / Đồ uống / Tất cả.
  - Hàng 4: **Món đang lên / đang xuống** (3 + 3 món, chỉ xét món có từ 3 phần ở một trong hai kỳ) + **Kho cần chú ý** gọn.
  - Đổi kỳ: giữ số cũ mờ nhẹ, số chạy sang số mới, biểu đồ trượt (tắt khi máy bật giảm chuyển động). Thành phần mới `CountUp`; màu biểu đồ vành khuyên `--chart-1…5`.
  - Bỏ `RevenueCard`, `TopDishesCard`, `InventoryCard` cũ. Ảnh món lỗi thì `DishThumb` hiện biểu tượng đĩa.
- **Kiểm thử API:** bộ 03 thêm 11 bước cho `/overview` (khớp số với `/revenue`, `/top-dishes`; cơ cấu cộng lại = doanh thu; giờ đông khách đủ số đơn; thu ngân bị chặn 403). Chạy cả bộ trên CSDL tạm: 03 đạt 82/82; các bộ khác không đổi.
- **Lưu ý dữ liệu mẫu:** đơn cũ trong dữ liệu mẫu phần lớn chưa ghi số khách nên thẻ Số khách nhỏ, có dòng "Chỉ đếm bàn có ghi số khách lúc mở bàn".
- **Dòng phiếu test cần test lại:** cả trang 5 (5.1–5.11, đã viết lại trong `KICH_BAN_TEST.md` và `phieu-test.html`).
- **Kết quả test trang 5 (26/11/2026):** 11/11 đạt — ghi vào `docs/kiem-thu/ket-qua/ket-qua-test-rms-20261126-trang5.json` (gộp kết quả đợt 1, thay phần trang 5).
- **Chỉnh sau test:** biểu đồ Doanh thu và Giờ đông khách giãn vừa chiều cao khung bên cạnh (hết khoảng trắng, cả khi menu ghim / thu gọn); danh sách Đang lên / đang xuống giãn đều theo khung Kho; ghi chú "Chỉ đếm bàn có ghi số khách" chuyển thành biểu tượng ⓘ để 4 thẻ số cao bằng nhau; ô chọn thời gian tự đóng sau khi chọn. Thêm vào quy tắc 2 của `QUY_TAC_GIAO_DIEN.md`.
- **Chưa xong:** dữ liệu mẫu (cả `rms_db`: 694 đơn) chưa đơn nào ghi số khách → thẻ Số khách và chế độ "Số khách" ở Giờ đông khách gần như toàn 0. **Đã chốt 26/11/2026:** tạm để nguyên; sau này làm bộ dữ liệu kinh doanh 2 năm (phục vụ dự báo) thì ghi số khách cho đơn luôn một lượt.

## Sửa giao diện theo quy tắc – nhóm 3: Thực đơn (26/11/2026)

Theo mục B8 của `docs/thiet-ke/QUY_TAC_GIAO_DIEN.md`. Người dùng chốt: **không** làm Nhân bản món; form set **chuyển thành trang con**; menu trái **gộp một mục "Thực đơn"**. Chỉ sửa frontend + đặc tả, không đổi máy chủ / dữ liệu.
- **Trang "Thực đơn" 4 tab** (`features/dishes/MenuLayout.tsx`): Món ăn `/quan-ly/mon-an` · Set menu `/set-menu` · Danh mục `/danh-muc` (mới) · Nhóm món `/nhom-mon` (mới). Mọi tab cùng bố cục, nút chính "Thêm …" luôn ở góc phải. Bỏ hàng 4 nút cũ (2 nút mở hộp, 2 nút nhảy trang).
- **Menu trái:** "Quản lý món ăn" (2 mục con) → một mục **Thực đơn**. Ctrl+K: thêm Set menu / Danh mục món / Nhóm món; "Thêm set menu" mở thẳng trang thêm set.
- **Đường dẫn trên cùng** bấm được và có nhiều cấp: Trang chủ › Thực đơn › Món ăn › Sửa (`Breadcrumb` thêm `parentTo`, `trail`).
- **Tab Món ăn:** lọc bằng chip (`FilterChips`: Danh mục, Trạng thái) + trang trống khi lọc (`FilteredEmpty`); mỗi dòng **Sửa** + **⋯** (Xem chi tiết · Ngừng bán / Mở bán lại · Xóa món) — thành phần mới `RowActions` dùng lại cho các trang sau; bấm tên / ảnh món mở chi tiết.
- **Tab Danh mục / Nhóm món:** danh sách nằm ngay trên trang (trước là hộp chứa cả danh sách); thêm / sửa mở hộp nhỏ, câu hướng dẫn ảnh thành chữ nhỏ dưới ô ảnh. Bỏ `CategoryModal`, `GroupModal`.
- **Tab Set menu:** lưới thẻ to → danh sách như tab Món ăn: ảnh nhỏ · tên · "n món" (bấm mở xem món, món ngừng bán tô đỏ) · giá set / giá gốc / -x% · giờ bán · trạng thái · Sửa / ⋯ (Tắt set / Bật lại set · Xóa set).
- **Thêm / sửa món và set dùng chung một kiểu trang** (`MenuFormHeader`): tiêu đề, **Quay lại** + **Lưu** ở góc phải; thanh lưu dính đáy (`StickySaveBar`) khi có thay đổi — Hủy thay đổi / Lưu / "Còn n chỗ chưa đúng"; Quay lại khi chưa lưu thì hỏi "Bỏ các thay đổi chưa lưu?". Trang set mới `SetFormPage` (`/set-menu/them`, `/set-menu/:id/sua`): thanh dưới đáy luôn ghi số món, giá gốc, khách tiết kiệm; món đang có trong set nằm đầu danh sách chọn.
- Chữ: "Chatbot AI" → "trợ lý AI" ở các hộp xác nhận; trang Chatbot ghi "Thực đơn → Set menu".
- **Đặc tả** `CodeUC_QLNH.docx` (UC Quản lý món ăn + UC Chatbot): menu "Thực đơn" 4 tab, lọc chip, menu "⋯", tab Danh mục, form set ở trang riêng.
- Kiểm tra: typecheck sạch; tự chạy thử 4 tab, menu ⋯, lọc chip, hộp danh mục, sửa món có thay đổi → hỏi khi Quay lại → Lưu ở thanh dưới đáy, tắt / bật set — không lỗi trang.
- **Chỉnh sau test (26/11/2026):** (1) bỏ nút Lưu trên đầu trang thêm / sửa món và set — **chỉ còn một nút Lưu ở thanh dính đáy**, thanh **luôn hiện** ở cả hai trang ("Chưa có thay đổi", nút mờ tới khi sửa; trang set kèm số món / giá gốc / tiết kiệm), nền đặc; nút **Quay lại** có viền cho dễ thấy. (2) **Rời trang khi chưa lưu bằng bất kỳ cách nào** (menu trái, Ctrl+K, đường dẫn, Back, Quay lại) đều hỏi; tải lại / đóng tab trình duyệt tự hỏi — hook mới `useUnsavedGuard`; để làm được, `App.tsx` đổi `BrowserRouter` → `createBrowserRouter` + `RouterProvider` (danh sách trang trong `routes.tsx` giữ nguyên). Đã chạy thử: đăng nhập, chuyển hướng khi chưa đăng nhập, các khu khác mở bình thường.
- **Dòng phiếu test cần test lại:** trang 9 (9.1–9.7), 10 (10.1–10.9), 11 (11.1–11.8) — đã viết lại trong `KICH_BAN_TEST.md` và `phieu-test.html`; thêm 16.x (nút "Quản lý set" ở trang Chatbot vẫn mở tab Set menu).

## Sửa giao diện theo quy tắc – nhóm 4: Lịch phân công ca (26/11/2026)

Theo mục B9 của `docs/thiet-ke/QUY_TAC_GIAO_DIEN.md`. Người dùng chốt: **"thiếu người" = bộ phận chính (Phục vụ, Bếp, Thu ngân) không có ai** trong ca — chưa thêm "số người cần" cho ca. Chỉ sửa frontend (`ShiftsPage.tsx`) + đặc tả.
- **Theo ca:** đường kẻ dọc giữa các ngày; cột hôm nay ghi "Hôm nay", tô nền nhạt; dòng ngày và cột tên ca **dính khi cuộn** (khung cuộn có chiều cao vừa màn hình). Đầu mỗi ô có **chip tóm tắt** "PV 3 · Bếp 2 · TN 1" (+ Kho / QL nếu có), bộ phận chính 0 người thì **đỏ** (chỉ hôm nay / sau này). Người chia theo bộ phận trong **khung nhỏ có vạch màu**. Ô hơn 4 người: hiện 3 + "+n người", bấm mở bảng đủ (đổi khu / hủy phân công được).
- **Theo nhân viên:** chú thích ca chuyển lên thanh công cụ dạng chip màu (tên + giờ); trong ô ghi tên ca + giờ ngắn ("Ca sáng 6–14"); dòng ngày / cột tên dính khi cuộn; kẻ dọc, tô cột hôm nay.
- **Đặc tả** `CodeUC_QLNH.docx` bước 5.2 (phân công ca): xem theo ca / theo nhân viên, chip số người, tô đỏ bộ phận chính chưa có người.
- Kiểm tra: typecheck sạch; chạy thử sáng / tối, cuộn, "+n người" — không lỗi trang.
- **Dòng phiếu test cần test lại:** 12.3, 12.6–12.9.

## Sửa giao diện theo quy tắc – nhóm 5: Cấu hình hệ thống (26/11/2026)

Theo mục B10 của `docs/thiet-ke/QUY_TAC_GIAO_DIEN.md` (kiểu trang cài đặt Linear). Chỉ sửa frontend + đặc tả, không đổi máy chủ.
- **Bố cục mới** (`SettingsPage.tsx`): cột trái "Cấu hình" chia nhóm có **ô tìm cài đặt** (tìm cả tên cài đặt bên trong) — Nhà hàng (Thông tin, Giờ hoạt động, Thanh toán) · Vận hành (Gọi món tại bàn, Chấm công) · Khách hàng (Website) · Hệ thống (Sao lưu & phục hồi, Nhật ký hoạt động ↗). Bỏ hàng tab cũ; Giờ hoạt động và Gọi món tại bàn tách khỏi tab Thông tin thành mục riêng. Đường dẫn `?tab=` cũ vẫn mở được.
- **Mỗi cài đặt một dòng** (thành phần mới `SettingsSection`, `SettingRow`, `UnitInput`): tên + một dòng mô tả bên trái, ô nhập / công tắc bên phải; ô số có đơn vị ("phút", "ngày"). Chữ mô tả viết lại cho dễ hiểu ("Mạng của quán", "Độ chặt khi so khuôn mặt"…).
- **Một thanh lưu dưới đáy cho mỗi mục** (`SettingsSaveBar`), luôn hiện như trang Thêm / sửa món; đổi mục ở cột trái / rời trang khi chưa lưu thì hỏi (`useUnsavedGuard` thêm tùy chọn theo dõi `?tab=`). Hook mới `useDraft` giữ bản gốc / bản nháp để biết có thay đổi và Hủy thay đổi.
- **Thanh toán:** khung "Đang dùng trên hóa đơn" thay khung Xem trước; "Bỏ tài khoản" có hộp hỏi lại.
- **Sao lưu:** lịch tự động thành các dòng (tắt thì mờ); danh sách bản sao lưu: thời điểm in đậm, tên file nhỏ, nút **Tải xuống** + ⋯ (Phục hồi từ bản này · Xóa bản sao lưu).
- **Website:** chưa đổi bố cục (vẫn kiểu thẻ, nhiều ô dài + album); chỉ sửa chữ trỏ sang mục mới. Đổi sang kiểu dòng khi làm nhóm E (website).
- **Đặc tả** `CodeUC_QLNH.docx` UC Cấu hình hệ thống: bước 2 (các nhóm, mỗi cài đặt một dòng), bước 5 (thanh lưu dưới đáy, hỏi khi rời mục).
- Kiểm tra: typecheck sạch; chạy thử mọi mục, tìm "wifi", sửa → hỏi khi đổi mục → Lưu → giá trị đã lưu — không lỗi trang.
- **Chỉnh sau góp ý (26/11/2026):** menu thu gọn thì trang dồn sang trái, bên phải trống → cả cụm (cột trái + nội dung) **căn giữa**, bề ngang tối đa 1064px (mục Website 1320px).
- **Dòng phiếu test cần test lại:** cả trang 18 (18.1–18.11, viết lại; phiếu HTML trang 18 trước bị lệch cột, đã sửa); 18.1 thử cả menu ghim và thu gọn.

## Sửa giao diện theo quy tắc – nhóm 6: Kho (26/11/2026)

Theo mục C của `docs/thiet-ke/QUY_TAC_GIAO_DIEN.md`: đồng bộ 14 trang Kho với các mẫu đã làm bên Quản lý. Chỉ sửa frontend + đặc tả, không đổi máy chủ. Nhóm chốt 4 điểm: gộp menu, thanh đáy phiếu mua có Lưu nháp + Đặt hàng, Dashboard tick chọn + một nút Tạo phiếu mua, nút Nhập kho về góc phải.
- **Menu trái Kho gọn:** Nguyên liệu · Nhà cung cấp · Phiếu mua (bỏ menu con Danh sách / Thêm; nút Thêm nằm trên trang danh sách, vẫn có trong Ctrl+K). Đường dẫn trên cùng: Trang chủ › Nguyên liệu › Thêm nguyên liệu (bấm được).
- **Danh sách** (Nguyên liệu, Nhà cung cấp, Phiếu mua, Nhập kho, Xuất kho, Kiểm kê, Công nợ): ô chọn lọc / nút gạt → **chip lọc** (+ Lọc); lọc không ra → "Không có … phù hợp · Xóa lọc"; hàng biểu tượng mỗi dòng → **nút chữ + menu ⋯** (việc nguy hiểm chữ đỏ, nằm cuối). Phiếu mua: nút chính đổi theo trạng thái (Sửa / Nhận hàng / Xem); cột Phiếu mua gộp mã + tên để bảng vừa màn 1440 khi ghim menu.
- **Form** (Nguyên liệu, Nhà cung cấp, Phiếu mua, Nhập không phiếu, Nhận hàng theo phiếu mua, Xuất kho): đầu trang nút **Quay lại** có viền; **một thanh dính đáy luôn hiện** (Chưa nhập gì / Có thay đổi chưa lưu / Còn n chỗ chưa đúng + tổng tiền, Hủy thay đổi, nút chính). Phiếu mua: **Lưu nháp** (nút phụ) + **Đặt hàng**; Xóa phiếu nháp lên đầu trang. Rời form khi chưa lưu bằng bất cứ cách nào (menu trái, Ctrl+K, Back) đều hỏi — thay `useLeaveGuard` cũ của Kho (chỉ hỏi khi bấm nút "Về…") bằng `useUnsavedGuard` chung.
- **Chi tiết** (Nguyên liệu, Nhà cung cấp, Phiếu mua, Phiếu nhập, Phiếu xuất, Kiểm kê, Công nợ): thành phần mới `SubPageHeader` — nhãn trạng thái cạnh tiêu đề, bên phải Quay lại · nút việc chính · ⋯ (`RowActions` thêm kiểu `inHeader`); bỏ ô "Trạng thái" trùng. Phiếu kiểm kê: nút Gửi duyệt / Duyệt / Từ chối / Hủy phiếu xuống **thanh dính đáy** (`StickyActionBar`, kèm "Đã đếm x/y"). Chi tiết phiếu mua: hai bảng lịch sử xếp dọc (cạnh nhau bị cắt cột).
- **Dashboard kho:** bảng Nguyên liệu cần nhập có **ô tick** + một nút **Tạo phiếu mua (n)**; form phiếu mua nhận `?nl=1,2,3`, gợi ý NCC bán được nhiều nguyên liệu nhất ("bán x/y nguyên liệu đã chọn"), tự chọn khi chỉ có một, thêm sẵn các dòng; nguyên liệu NCC không bán ghi dưới ô NCC. Bên phải Phiếu mua chờ nhận + Phiếu kiểm kê xếp chồng, cao bằng cột trái; Hao hụt nhiều nhất cả hàng.
- **Sửa chung (ảnh hưởng mọi trang):** nhãn trạng thái không xuống dòng; đầu trang không đẩy nút xuống dưới khi mô tả dài; bảng có chữ ẩn ở cột cuối không còn làm cả trang tràn ngang (khung bảng thêm `relative`); `StickySaveBar` thêm `canSave`, `saveIcon`, `extraActions`.
- **Đặc tả** `DacTa_UC_QuanLyKho.docx`: bảng menu, các bước "chọn menu …", quy ước "Rời form thêm / sửa" (thay "Hủy form"), UC-KHO-01 (tick chọn), UC-KHO-13 1a (nhiều nguyên liệu), menu ⋯.
- Kiểm tra: typecheck sạch; chụp 14 trang + 7 trang chi tiết ở 1440 menu ghim / thu gọn; đo mọi bảng không tràn (trừ bảng đếm của phiếu kiểm kê đang sửa — nhiều ô nhập, cuộn ngang như cũ); tick 3 nguyên liệu → form có NCC gợi ý; rời form → hỏi; không lỗi trang.
- **Dòng phiếu test cần test lại:** cả trang 20–27 (viết lại, 38 dòng). Trang 19 (Quản lý duyệt kiểm kê) chỉ đổi đầu trang chi tiết.

## Sửa giao diện theo quy tắc – nhóm 11: D16 Thu ngân POS + B6 đặt bàn ở thu ngân (26/11/2026)

Theo mục D16, B6 của `docs/thiet-ke/QUY_TAC_GIAO_DIEN.md` + nhóm chốt: gỡ **chấm công cá nhân** (khóa "chưa vào ca", nút Chấm công, trang Tôi); **giữ** Chấm công văn phòng (Excel / thêm tay) + Bảng lương trong ☰; trang phụ mở riêng có nút "Về quầy"; màn POS dùng được trên máy tính; sơ đồ **to rõ, vẽ như trang Sơ đồ bàn của Quản lý, hiện được cả 2 tầng**.
- **Máy chủ:** bỏ hẳn `OnDutyInterceptor` (không vai trò nào còn bị khóa vì chưa chấm công). **Đặt bàn cho thu ngân:** `GET /api/thu-ngan/reservations?date=` (lịch trong ngày kèm khu, mã bàn), `POST` (thêm lịch, `source` phone / walk_in, xác nhận luôn, ghi người tạo), `PUT /{id}` (sửa), `PATCH /{id}/status` (confirmed / cancelled / no_show; "Đã đến" chỉ qua Mở bàn). `ReservationService.create`, `day`, `nextCode` (mã DB-… dùng chung với website). Lịch khách đặt qua website **báo cả thu ngân**.
- **Khung** (`CashierShell`): thanh trên ☰ (số đỏ = yêu cầu thanh toán + hóa đơn chưa thu) · THU NGÂN + thứ / ngày · kết nối · giờ lớn · chuông; bỏ dải tab, nút Chấm công / Văn phòng, dải "chưa vào ca", menu tài khoản. **Menu ☰:** Quầy thu ngân · Yêu cầu thanh toán · Hóa đơn · Đơn hàng · *Văn phòng*: Chấm công · Bảng lương · Thông báo · Đổi mật khẩu · Đăng xuất (hỏi lại). Trang phụ (Đơn hàng, Hóa đơn, Yêu cầu, Chi tiết đơn, **Chấm công, Bảng lương** — trước dùng khung quản lý) dùng chung khung này với nút lớn **Về quầy thu ngân**.
- **Màn POS** (`pages/thu-ngan/FloorPage.tsx`): trái 3 mục gập mở được (nhớ trạng thái) — **Yêu cầu thanh toán**, **Đặt bàn hôm nay** (nút Thêm; ≤ 2 giờ tô tím, quá giờ "Trễ x giờ y phút", lịch đã xử lý gập riêng), **Bàn đang có khách** (đã ngồi bao lâu, tạm tính); giữa: **sơ đồ cả tầng** (tường, vùng khu, bàn có ghế), tab **Tất cả tầng · Tầng 1 · Tầng 2** kèm "n/m có khách" + số chờ thanh toán / khách gọi; **Vừa khung** tự co (− / + chỉnh tay); **Tự chọn**: màn đủ rộng (bàn ≥ 50%) hiện mọi tầng, màn 1440 hiện một tầng có việc cần xử lý; bàn trên POS vẽ to hơn 10%, chữ có cỡ tối thiểu; phải: khung chi tiết chỉ hiện khi chạm bàn (giữ nguyên các việc: số khách, món, In tạm tính, Chuyển bàn, Lập hóa đơn, Thu tiền…). Bỏ khung "Chờ mang ra" (bếp bấm Đã mang đi).
- **Hộp đặt bàn** (`CashierReservationDialog`): thêm (Khách gọi điện / Khách đến quầy) / sửa — tên, SĐT, ngày, giờ, số khách, khu, bàn (không bắt buộc, ghi "ít ghế"), ghi chú; lỗi tại ô theo quy tắc chung; Xác nhận lịch · **Khách đã đến – Mở bàn** · Khách không đến · Hủy lịch (hỏi lại).
- Gỡ `/thu-ngan/toi`; xóa `SelfPages.tsx`, `SelfShell.tsx`, `DutyBanner.tsx` (giữ `MyInfo` để dựng Cổng nhân viên).
- **Kiểm thử:** bộ mới **`tests/api/17-dat-ban-thu-ngan.mjs`** (18 bước); bộ 13: "thu ngân chưa vào ca mở bàn được". Chạy 17 bộ trên CSDL mới: **734 / 735** (bước không đạt: bộ 05 cần lịch đặt trong 2 giờ tới — dữ liệu mẫu chỉ tới 20:00, chạy lúc 23h). Giao diện: **17 / 17** bước ở 1440 và 1920 (☰, cột trái, một tầng / cả 2 tầng, khung chi tiết, thêm lịch có lỗi tại ô, trang Chấm công có Về quầy, đăng xuất hỏi lại), không lỗi trang.
- **Đặc tả** `DacTa_UC_DatMon_Bep_ThuNgan.docx`: mô tả tác nhân Thu ngân, **Nhân viên phục vụ** (nay có tài khoản, khu theo lịch ca); UC-TN-01 (bố cục POS, tab tầng / Tự chọn, cột trái, khung chi tiết, ☰, 4d–4e nhận / sửa đặt bàn, không cần vào ca, lịch website báo thu ngân). **Chưa làm:** dòng "ca hiện tại" trên thanh trên (cần nguồn ca của quầy — chờ Cổng nhân viên); trang Đặt bàn của Quản lý chưa có nút Thêm (thu ngân nhận đặt bàn).
- **Dòng phiếu test cần test lại:** trang 36 (36.1–36.15, viết lại), 41, 42 (mở qua ☰, có Về quầy), 43 (tạm gỡ); mục "Không cần cho nhân viên vào ca" ở đầu phiếu.

## Sửa giao diện theo quy tắc – nhóm 10: D15 Phục vụ trên điện thoại (26/11/2026)

Theo mục D15 của `docs/thiet-ke/QUY_TAC_GIAO_DIEN.md` + nhóm chốt: **gỡ chấm công** khỏi khu phục vụ; **chia khu theo lịch ca** (không theo chấm công); tab Mang món → **Món xong chỉ xem**; bỏ tab **Tôi** — phần cá nhân (chấm công, lịch sử, phiếu lương, hồ sơ, ca của tôi) sau gom về **Cổng nhân viên `/nhan-vien`** cho mọi vai trò (làm cuối cùng, nhóm tìm hiểu rồi thống nhất; nhân viên được xem ca của chính mình).
- **Máy chủ:** `DutyService.waitersOnDuty` = phục vụ có ca theo **lịch phân công** đang diễn ra (không còn dựa vào chấm công); `waitersFor` giờ không ai có ca → **mọi phục vụ** nhận thông báo (thêm `allWaiters`); nhắc đơn quá giờ cũng vậy. Bỏ `WaiterGuard` (khóa "chưa vào ca") và API `POST /api/phuc-vu/serve` (bếp bấm Đã mang đi). Sơ đồ phục vụ trả `onShift` + `nextLabel` (ca kế tiếp) thay `clockedIn` / `scheduledLabel`. Thông báo khuôn mặt cho nhân viên không còn trỏ về `/…/toi`.
- **Khung** (`WaiterShell`): 4 tab Sơ đồ · Yêu cầu · **Món xong** (số đỏ = món xong của khu mình) · Thực đơn; dòng ca "Ca … · khu" hoặc "Ngoài ca · ca tới …"; âm báo + rung cả khi bếp vừa xong món của khu mình; bỏ dải "chưa vào ca".
- **Sơ đồ:** nút gạt khu bo tròn (chấm đỏ khu cần xử lý), thẻ bàn bo tròn; bảng dưới: Mở bàn / Gọi món cho khách (nút lớn) / Chuyển / Ghép; món xong chỉ ghi "Xong – lấy ở bếp", bỏ nút Mang ra / Đã mang hết; bỏ khóa thao tác.
- **Gọi món** (`WaiterMenuPage`): lưới món ảnh tròn + nút **+** (đã chọn thì bộ đếm − n + xuống dòng dưới giá), chip danh mục + tìm; **Set menu mở màn chi tiết của trang QR** (`SetDetailScreen`: độ chín / sốt, chia loại nước — gửi kèm món con); thanh lớn **Xem giỏ · n món · tổng**; giỏ: ảnh tròn, giá, ô Thêm ghi chú, − / +, nút lớn **Gửi bếp · tổng tiền**. Thực đơn tra cứu cùng lưới, bấm món mở bảng thông tin.
- **Món xong** (`/phuc-vu/mon-xong`, đường cũ `/phuc-vu/mang-mon` chuyển về): chỉ xem theo bàn, bàn chờ lâu nhất trên, phút chờ đỏ khi ≥ 5, nút gạt Khu của tôi / Tất cả khu.
- **Yêu cầu:** bỏ khóa; nút xác nhận đơn lớn bo tròn. Gỡ `/phuc-vu/toi`, `/phuc-vu/ca-lam`.
- **Kiểm thử:** bộ 13 viết lại phần đầu — ngoài ca không bị khóa, không ai có ca → báo mọi phục vụ, API bưng món đã bỏ, xếp ca (chưa chấm công) → khu của ca; bưng món → bếp bấm Đã mang đi, món rời "Món xong". Chạy 16 bộ trên CSDL mới: **716 / 717** (bước không đạt: bộ 05 cần lịch đặt trong 2 giờ tới — dữ liệu mẫu chỉ tới 20:00, chạy lúc 22h). Giao diện điện thoại (iPhone 13): **16 / 16** bước, không lỗi trang (sửa: giá bị bẻ dòng khi có bộ đếm).
- **Đặc tả Word:** `DacTa_UC_DatMon_Bep_ThuNgan.docx` chưa có phần Nhân viên phục vụ (vẫn ghi "phục vụ không có tài khoản, thu ngân báo bộ đàm") — cần viết bổ sung (đã báo nhóm).
- **Dòng phiếu test cần test lại:** trang 31 (31.1–31.12), 32 (32.1–32.6), 33 (33.1–33.7), 34 Món xong (34.1–34.4), 43.1; mục "Cho nhân viên vào ca" ở đầu phiếu.

## Sửa giao diện theo quy tắc – nhóm 9: D14 Công thức + trang phụ của bếp (26/11/2026)

Theo mục D14 của `docs/thiet-ke/QUY_TAC_GIAO_DIEN.md`; làm luôn cho xong khu bếp trước khi nhóm test một lượt.
- **Khung trang phụ** (`KitchenShell`): ☰ (menu dùng chung với màn chính: Màn hình bếp · Kiểm tra nguyên liệu · Công thức · Đăng xuất có hỏi lại; màn chính thêm Món tạm hết, Cài đặt màn hình) · BẾP · **tiêu đề trang** · nút việc của trang · **Về màn bếp**. Bỏ dải tab cũ. Menu ☰ và hộp hỏi đăng xuất chuyển vào `KitchenShell` (`KitchenMenu`, `KitchenLogoutDialog`) để hai nơi dùng chung.
- **Công thức** (`pages/bep/RecipesPage.tsx`): trái lọc **Tất cả / Chưa có / Đã có** kèm số, nhãn **% giá vốn / giá bán** tô màu (≤ 35% xanh, ≤ 45% vàng, cao hơn đỏ); phải bảng định lượng — **ô chọn nguyên liệu gõ tìm** theo tên / mã (hiện tồn, ↑ ↓ Enter, nguyên liệu đã có ở dòng khác bị mờ, thiếu chỗ thì mở lên trên), **đơn vị nằm trong ô định lượng**; **thanh dính đáy** giá vốn / phần · % giá bán · Chưa có thay đổi / Có thay đổi chưa lưu / Còn n chỗ chưa đúng · Hủy thay đổi · Lưu công thức; Lưu có lỗi thì **tô đỏ dòng, cuộn tới dòng lỗi đầu và đặt con trỏ vào ô**; rời trang / đổi món / Back khi chưa lưu thì hỏi (đóng tab trình duyệt tự hỏi).
- **Kiểm tra nguyên liệu**: tiêu đề lên thanh trên; lọc tình trạng bằng **chip có số** (Tất cả · Hết hàng · Sắp hết · Đủ hàng).
- Sửa: tiêu đề trang phụ bị mất ở nền tối (thẻ h1 ăn màu chung) → dùng màu chữ của bộ màu bếp.
- **Kiểm thử:** không đổi máy chủ. Giao diện 15 / 15 bước (trang phụ + ☰, chip lọc, lọc Chưa có / Đã có, nhãn %, thanh dính đáy, đơn vị cạnh ô, ô chọn có tìm, lỗi cuộn tới dòng + con trỏ, hỏi khi đổi món / Về màn bếp, Hủy thay đổi, lưu, nền tối); chạy lại màn bếp D13 15 / 15; bộ API 02 đạt.
- **Đặc tả** `DacTa_UC_DatMon_Bep_ThuNgan.docx`: đường vào UC-BEP-05/06/07 qua ☰; UC-BEP-06 chip lọc; UC-BEP-07 danh sách (nhãn %, lọc Chưa có / Đã có), ô chọn có tìm, thanh dính đáy, hỏi khi rời, cuộn tới dòng lỗi.
- **Dòng phiếu test cần test lại:** trang 29 (29.1–29.4) và 30 (30.1–30.9), viết lại.

## Sửa giao diện theo quy tắc – nhóm 8: D13 Màn bếp (26/11/2026)

Theo mục D13 của `docs/thiet-ke/QUY_TAC_GIAO_DIEN.md` + nhóm chốt thêm: bếp là người bấm **Đã mang đi** (không còn chờ phục vụ); **Chờ lấy đưa ra ngoài** thành cột cố định bên phải; **gỡ chấm công khỏi bếp** (chấm công sẽ là trang riêng quét QR — nhóm mô tả sau; thu ngân / phục vụ gỡ khi tới lượt).
- **Thanh trên cùng:** ☰ · BẾP · giữa là ô đếm **Tất cả · Mới · Đang làm · Chờ lấy** (bấm để lọc) · phải: kết nối (biểu tượng), TB hôm nay, đồng hồ lớn. Dải thứ hai: trạm, viên danh mục, Theo bàn / Theo món, **Tổng hợp món**.
- **Menu ☰** (trái): Kiểm tra nguyên liệu, Công thức, Món tạm hết (số đỏ), Cài đặt màn hình; cuối menu người đăng nhập + **Đăng xuất có hỏi lại**. Không còn nút phụ / đăng xuất nằm ngoài.
- **Cột Chờ lấy** (cố định bên phải, từ 1024 px): mỗi bàn một khối (gộp đợt, bàn chờ lâu nhất trên, phút chờ đỏ khi ≥ 5), nút lớn **Đã mang đi (n)**, ✓ từng món, ↺ Trả lại (30 phút). Màn hẹp: bấm ô Chờ lấy mở khung. Lọc theo trạm như thẻ bàn.
- **Tổng hợp món:** bảng Món · Mới · Đang làm · Chờ lấy (cộng số phần) theo trạm / danh mục, thay chỗ cột Chờ lấy; Về Chờ lấy để trở lại.
- **Gỡ chấm công khỏi bếp:** bỏ tab Chấm công (trang phụ), dải "chưa vào ca", trang `/bep/toi` (gõ thẳng thì về `/bep`). Máy chủ `OnDutyInterceptor` **không còn chặn bếp** (thu ngân vẫn phải vào ca). Màn mở đầu đổi "Bắt đầu ca" → "Bắt đầu".
- Trang phụ của bếp (`KitchenShell`): Đăng xuất cũng hỏi lại.
- **Kiểm thử:** bộ 13 đổi bước "bếp chưa vào ca bị chặn" → "không bị chặn". Chạy 16 bộ trên CSDL mới: 609 / 610 khi chạy chung lúc 21h — bước không đạt là bộ 05 cần lịch đặt trong 2 giờ tới (dữ liệu mẫu chỉ có tới 20:00, không liên quan); bộ 13 bị dữ liệu bộ trước làm lệch khi chạy chung, chạy riêng **110 / 110**. Giao diện: 15 / 15 bước chụp màn (không dải vào ca, cột Chờ lấy, Đã mang đi, Tổng hợp món, menu ☰, đăng xuất hỏi lại, trang phụ không tab Chấm công, `/bep/toi` về `/bep`, màn hẹp) — không lỗi trang.
- **Đặc tả** `DacTa_UC_DatMon_Bep_ThuNgan.docx`: UC-BEP-01 (đầu trang, ô đếm, cột Chờ lấy, menu ☰, Tổng hợp món, không chấm công), UC-BEP-03 (Đã mang đi), các chỗ "bếp bấm Đã lấy" ở thu ngân.
- **Chưa làm (để tới lượt):** nút "Mang ra / Đã mang hết" và trang Mang món bên **phục vụ** (D15 — hỏi lại nhóm); chấm công thu ngân / phục vụ; trang chấm công QR riêng.
- **Dòng phiếu test cần test lại:** cả trang 28 (28.1–28.22, viết lại); 43.1.

## Sửa giao diện theo quy tắc – nhóm 7: B7 Sơ đồ bàn theo tầng (26/11/2026)

Theo mục B7 của `docs/thiet-ke/QUY_TAC_GIAO_DIEN.md` (bị sót khi làm nhóm B, làm bù sau nhóm C). Nhóm chốt: **thêm Tầng**; trình sửa **bàn + vùng khu + tường**; Quản lý xem **trạng thái trực tiếp như thu ngân**; khối "Không gian" của website để nhóm E (dữ liệu đã sẵn).
- **Máy chủ — migration `V26__so_do_tang.sql`:** bảng `floors` (tên, cols × rows ô) và `floor_walls` (tường thẳng: outer / inner / fence); `areas` thêm `floor_id` + vùng khu `zone_x/y/w/h`; `dining_tables.pos_x/pos_y` từ nay là tọa độ trên **tầng** (một ô một bàn theo tầng, kiểm ở TableService; bỏ ràng buộc cũ theo khu). Dữ liệu cũ: tạo "Tầng 1", xếp mỗi khu thành khối 8 × 5, cộng vị trí bàn, vẽ tường ngoài.
- **Dữ liệu mẫu `V26_1` (dev):** đổi tên khu "Tầng 1" → **Sảnh chính**, "Tầng 2" → **Khu gia đình**; 2 tầng gọn (12 × 7, 10 × 6) có vùng khu, tường, hàng rào sân vườn, vách phòng VIP. Đã ghi `DU_LIEU_GIA.md`.
- **API mới:** `GET/POST /api/floors`, `PUT/DELETE /api/floors/{id}`, `PUT /api/floors/{id}/layout` (lưu cả tường, vùng, vị trí + khu của bàn một lần; kiểm hết rồi mới ghi), `GET /api/floors/live` (sơ đồ trực tiếp cho Quản lý, cùng dữ liệu thu ngân). Khu vực có `floorId`, `zone`; thêm bàn vào ô trống trong vùng khu; đổi khu thì tìm ô trong vùng mới; khu còn bàn không chuyển tầng; thu nhỏ tầng không được cắt mất bàn / vùng / tường. Sơ đồ thu ngân / phục vụ trả `floors` + vùng khu thay `cols/rows`.
- **Trang Quản lý `Sơ đồ bàn`** (menu trái một mục): chọn tầng ở đầu trang (+ Thêm tầng, ⋯ Đổi tên / kích thước, Xóa tầng); 3 kiểu xem `?che-do=`:
  - **Xem trực tiếp** — vẽ cả tầng bằng đúng cách vẽ của thu ngân (tường, vùng khu tô gạch chéo có nhãn tên, bàn có ghế, màu trạng thái, đã ngồi bao lâu, giờ đặt), chú thích màu có số đếm, bấm bàn → khung chi tiết (Sửa thông tin, Mã QR), tự làm mới 20 giây.
  - **Sửa sơ đồ** (`features/floorplan/FloorEditor.tsx`) — khung trái Công cụ (Chọn & kéo · Vẽ tường: ngoài / trong / hàng rào · Vẽ vùng khu theo khu) · Bàn (Thêm bàn) · Đang chọn (sửa / Mã QR / xóa bàn; đổi loại / xóa tường; vẽ lại / xóa vùng); kéo bàn có ô đích xanh / đỏ, kéo vào vùng khu khác thì đổi khu; Hoàn tác / Làm lại (Ctrl+Z / Ctrl+Y), phím Delete; thanh dưới đáy Hủy thay đổi · Lưu; rời tầng / kiểu xem / trang khi chưa lưu thì hỏi.
  - **Danh sách bàn** — bảng khu vực của tầng (số bàn, vùng trên sơ đồ, Sửa · ⋯) và bảng bàn (Sửa · ⋯ Mã QR, Xóa).
- **Phần vẽ dùng chung** (`floorParts.tsx`): `PlanBackdrop` (lưới, vùng khu, tường), `FloorCanvas` nhận khung xem; `areaWindow` cắt khung quanh vùng khu. **Thu ngân, phục vụ** vẫn xem theo khu như cũ nhưng giờ thấy vùng khu + tường quanh khu.
- **Kiểm thử:** bộ mới `tests/api/16-so-do-tang.mjs` (27 bước); bộ 13 sửa theo tên khu mới và cách tìm ô trống theo tầng. Chạy đủ 16 bộ trên CSDL mới: **719 / 719 đạt**. Giao diện: chụp 3 kiểu xem, kéo bàn, kéo trùng ô, vẽ tường, hoàn tác, hỏi khi rời, lưu; thu ngân + phục vụ (điện thoại) vẽ đúng — không lỗi trang.
- **Đặc tả** `CodeUC_QLNH.docx` mục 6.4 (sơ đồ theo tầng). **Chưa làm:** sofa, trang trí, sàn (để sau như đã ghi ở B7); khối "Không gian" trên website (nhóm E).
- **Dòng phiếu test cần test lại:** cả trang 8 (8.1–8.12, viết lại); trang 31 và 36 xem lại phần sơ đồ (có vùng khu, tường).

## Kịch bản test bằng mắt (22/11/2026)
- Viết lại `docs/kiem-thu/KICH_BAN_TEST.md` cho toàn hệ thống sau đợt phục vụ / chấm công / trợ lý / website: chỉ kiểm giao diện, thao tác và nghiệp vụ giữa các vai trò (phần API đã có trong `tests/`). Sắp theo **từng trang** (52 trang, 10 phần: chung, Quản lý, Kho, Bếp, Phục vụ, Thu ngân, Thông tin của tôi, trang QR + trợ lý, website, kiểm tra xuyên suốt) để test xong một trang rồi mới sang trang khác; mỗi trang có dòng "Liên quan" chỉ các trang dùng chung dữ liệu. Thêm bước chuẩn bị "cho nhân viên vào ca" bằng chấm công tay. Cột "Kịch bản" trong `tests/README.md` đổi theo mã mới.

## Việc để sau / ghi chú quyết định (18/11/2026)

- **Phục vụ xác nhận món trước khi xuống bếp (X1):** tạm giữ như hiện tại — khách gửi là xuống bếp thẳng. Nhóm chạy thử và thống nhất ở buổi họp thứ 6 (21/11/2026); nếu cần sẽ làm chế độ phục vụ nhập mã PIN trên điện thoại khách để xác nhận, Quản lý bật / tắt trong Cấu hình.
- **Đề xuất nhập hàng – chỉnh theo sự kiện (B13):** chưa làm. Ý tưởng để sau: Kho nhập "tăng / giảm X%" cho kỳ có lễ / Tết / tiệc lớn, hoặc tự cộng theo số khách đặt bàn trước của kỳ tới.
- **Chatbot AI:** để sau (hướng dự kiến: mô hình ngôn ngữ qua API + công cụ chỉ đọc thực đơn, không cho AI đọc thẳng CSDL).
- **Mở bàn** (18/11/2026, người dùng chốt A1–A8): mã QR chỉ gửi được món khi thu ngân đã mở bàn. Mở bàn = tạo đơn rỗng (người mở, số khách, phiếu đặt) — `POST /api/thu-ngan/tables/{id}/open`; đóng bàn chưa gọi món `POST /api/thu-ngan/orders/{id}/close` (có món thì dùng Hủy đơn); tự đóng bàn mở quá N phút chưa gọi món (tác vụ mỗi phút; Cấu hình hệ thống → Gọi món tại bàn, `GET/PUT /api/settings/ordering`, mặc định 30, 0 = tắt; migration V18); bàn đặt trước có nút "Khách đã đến – Mở bàn" (phiếu đặt → seated). Trang khách: bàn chưa mở thì viên "Bàn chưa mở" trên ảnh bìa, giỏ báo và khóa nút Gửi, gợi ý gọi nhân viên "Mở bàn giúp tôi"; bàn đóng / lượt khách mới thì xóa giỏ chưa gửi. Kiểm thử API 19/19 (`api-open.mjs`) + giao diện 9/9; các bộ cũ cập nhật thêm bước mở bàn: 25/25, 70/70, 55/55, kho 46/46. Đặc tả thêm UC-TN-14, UC-KH-03 ngoại lệ 7e; kịch bản test thêm A2b, B22–B25.
- **Kiểm thử tự động mức API – đưa vào repo** (18/11/2026): 11 bộ trong `tests/api/`, chạy `node tests/run-all.mjs` (hướng dẫn: `tests/README.md`). Cấu hình chung `tests/lib/env.mjs` (mặc định backend 8080 + CSDL `rms_test`, từ chối `rms_db`), file mẫu chấm công ở `tests/fixtures/`. Đã viết lại các bộ còn dữ liệu Green Lotus (tài khoản, món ăn, chatbot) theo dữ liệu Royal Beef. Kết quả trên CSDL sạch: **437/437 bước đạt**.
- **Khi nào làm kiểm thử đơn vị JUnit (mức c):** chưa làm. Bắt đầu khi **làm chức năng Đề xuất nhập hàng / dự báo** (sau buổi họp 21/11/2026 chốt phương pháp) — viết JUnit cho công thức dự báo ngay lúc viết công thức, vì sai số khó thấy bằng mắt. Sau đó bổ sung dần cho: tính tiền hóa đơn (giảm giá, VAT, làm tròn), giá vốn bình quân khi nhập kho, tính lương từ chấm công. Cũng viết JUnit **trước khi sửa lớn** (tách / gộp service) các phần trên để biết có làm hỏng không. Các phần còn lại (CRUD, phân quyền) đã có kiểm thử API phủ, không cần JUnit.
