# Kịch bản test toàn hệ thống RMS (Royal Beef)

Test theo đường đi của một bữa ăn: **Khách (QR) → Bếp → Thu ngân**, sau đó **Quản lý nhà hàng** và **Kho**.
Mỗi dòng: làm đúng cột *Thao tác*, so với cột *Kết quả mong đợi*, đánh dấu `[x]` nếu đạt; không đạt thì ghi vào cột *Ghi chú*
(trang, ảnh chụp nếu có) để gửi sửa.

---

## 0. Chuẩn bị

**Test trên CSDL riêng — không đụng dữ liệu đang có** (nên dùng):

| Cách chạy | Lệnh |
|---|---|
| Có `dev.bat` (máy cá nhân) | Nhấp đúp **`dev-test.bat`** (hoặc `.\dev.ps1 -Test`) → backend dùng CSDL **`rms_test`**, ảnh tải lên vào `backend\uploads-test` |
| Làm lại từ đầu sau khi tạo "tùm lum" | Nhấp đúp **`dev-test-reset.bat`** (hoặc `.\dev.ps1 -ResetTest`) → xóa sạch `rms_test` + ảnh test, nạp lại dữ liệu mẫu mới |
| Không có `dev.bat` | PowerShell: `cd backend; $env:DB_NAME='rms_test'; $env:RMS_UPLOAD_DIR='uploads-test'; mvn spring-boot:run` rồi chạy frontend như thường. Làm lại từ đầu: `mysql -u root -p -e "DROP DATABASE rms_test"` và xóa thư mục `backend\uploads-test` |

- `rms_test` được tạo tự động lần đầu (dữ liệu mẫu Royal Beef, ảnh món / danh mục từ `seed-images`). CSDL thật `rms_db` và
  thư mục `uploads` **không bị đổi gì**. Cổng vẫn 8080 / 3000 nên QR trên điện thoại dùng như bình thường — chỉ cần tắt
  bản chạy thường trước (chế độ test tự báo nếu cổng 8080 đang bận).
- Mã QR của bàn trong `rms_test` khác `rms_db`: lấy lại đường dẫn QR trong `rms_test` (Quản lý → Khu vực bàn).
- **Chưa test:** đặt bàn ở **website khách** (repo riêng, đang thiết kế). Phần đặt bàn ở trang Quản lý / Thu ngân vẫn test bình thường.

**Tài khoản mẫu** (mật khẩu chung `Rms@2026`):

| Vai trò | Tên đăng nhập | Trang đầu sau khi đăng nhập |
|---|---|---|
| Quản lý nhà hàng | `tuan.nguyen` | `/quan-ly` |
| Thu ngân | `linh.tran` (hoặc `khoa.le`) | `/thu-ngan` |
| Nhân viên bếp | `hung.pham` | `/bep` |
| Quản lý kho | `thao.bui` | `/kho` |

**Mở 3 cửa sổ cùng lúc** (mỗi vai trò một cửa sổ riêng, vì mỗi trình duyệt chỉ giữ một phiên đăng nhập):

1. Cửa sổ thường → đăng nhập **Thu ngân**.
2. Cửa sổ ẩn danh (Ctrl+Shift+N) → đăng nhập **Bếp**.
3. Trình duyệt khác (Edge / Firefox) hoặc điện thoại → **trang đặt món của khách** (không cần đăng nhập).
   Lấy đường dẫn: đăng nhập Quản lý → *Quản lý khu vực bàn* → bấm một bàn → **Mã QR** → *Sao chép đường dẫn*.
   Trên máy tính: F12 → Ctrl+Shift+M để xem như điện thoại.

**Lưu ý dữ liệu mẫu**

- Đang có sẵn: bàn **T03, VIP01, SV01** có khách (món ở nhiều trạng thái); **T03** đang gọi nhân viên, **VIP01** đang yêu cầu thanh toán;
  món *T-bone bò Úc 450g* tạm hết hôm nay (kho hết T-bone); ~2 tháng hóa đơn đã thanh toán; chấm công từ đầu tháng trước; kỳ lương tháng trước đã chốt.
- Dùng bàn **trống** (vd. **T05**) cho luồng chính để dễ theo dõi.
- Nhà hàng chỉ cho gửi món **trong giờ mở cửa** (Cấu hình hệ thống). Test ngoài giờ thì sửa giờ mở cửa trước.
- Test xong muốn làm lại từ đầu: chạy `dev-test-reset.bat` (xem bảng trên) — **không xóa `rms_db`**.

---

## A. Luồng chính: một bữa ăn từ lúc ngồi xuống đến lúc thanh toán

| # | Vai trò | Thao tác | Kết quả mong đợi | Đạt | Ghi chú |
|---|---|---|---|---|---|
| A1 | Bếp | Đăng nhập → bấm **Bắt đầu ca** | Màn hình bếp kiểu KDS (nền sáng mặc định), **mỗi bàn một thẻ** (chỉ bàn còn món chờ / đang làm), thấy thẻ **T03, SV01** (VIP01 đã xong hết món nên không có thẻ); dải lọc Tất cả / Mới / Đang làm + viên danh mục | [ ] | |
| A2 | Thu ngân | Đăng nhập → **Sơ đồ bàn** (khu POS toàn màn hình) | Bàn tô màu theo trạng thái: VIP01 **vàng** (Chờ thanh toán), T03, SV01 có khách (yêu cầu *gọi nhân viên* của T03 chỉ hiện ở khu **Phục vụ**, từ V20); tab **Yêu cầu thanh toán** có số 1; đáy màn hình có "Đã thu hôm nay" > 0 | [ ] | |
| A2b | Khách → Thu ngân | Khách mở QR **T05** khi bàn còn Trống, thêm 1 món vào giỏ, bấm Gửi; rồi bấm Gọi nhân viên → gợi ý **"Mở bàn giúp tôi"**. Thu ngân bấm bàn T05 → chọn số khách 4 → **Mở bàn** | Bàn chưa mở: ảnh bìa có viên "Bàn chưa mở", giỏ báo "Bàn chưa được mở…", nút Gửi bị khóa; phục vụ khu Tầng 1 nhận yêu cầu (khu Phục vụ, có âm báo); mở xong: T05 xanh dương "Có khách" 4/…, bảng bàn có nút **Đóng bàn**, trang khách tự hết viên "Bàn chưa mở" (giỏ vẫn còn món) | [ ] | |
| A3 | Khách | Mở đường dẫn QR của **T05** (đã mở bàn) | Trang tông đỏ rượu / nền kem, tiêu đề chữ có chân: "Bạn đang ngồi tại · Bàn T05", nút chuông, **Món của tôi**; ảnh bìa (hoặc nền đỏ – nâu) có "Royal Beef", ô tìm kiếm + nút lọc; **dải danh mục cong có ảnh món tròn** ("Tất cả" ghép 4 ảnh); Bán chạy (ảnh tràn thẻ); Tất cả món có ảnh | [ ] | |
| A4 | Khách | Bấm từng vòng tròn danh mục; vuốt dải danh mục rồi thả; tự cuộn trang; mở nút lọc → Giá thấp → cao + Không cay → Áp dụng; Bỏ lọc | Dải cong: mục chọn vào giữa, hạ thấp, viền đỏ; bấm mục xa (vd. từ Tất cả sang mục thứ 5) thì dải đi thẳng tới mục đó, không giật qua các mục ở giữa; trang cuộn tới đúng mục (món khác vẫn còn); tự cuộn thì dải tự xoay theo; lọc: chỉ món khớp, giá tăng dần, nút lọc có số điều kiện | [ ] | |
| A5 | Khách | Gõ tìm "gỏi" (thử cả không dấu "goi") | Chỉ hiện *Gỏi bò tái chanh* | [ ] | |
| A6 | Khách | Tìm *T-bone* | Món mờ, ảnh có dấu **HẾT**, không thêm vào giỏ được | [ ] | |
| A7 | Khách | Bấm (+) trên 2 món; bấm ảnh **Ribeye bò Úc 300g** → màn chi tiết → kéo thanh **Độ chín** tới **Medium** (hoặc bấm chữ Medium dưới thanh), Sốt **Nấm**, ghi chú "Cắt sẵn", số lượng 2 → **Thêm · …** | Màn chi tiết thu xuống rồi ảnh món bay vào giỏ; thanh nổi "[túi + số món] \| Xác nhận gọi món · tổng" đúng. Nút Quay lại của điện thoại cũng đóng màn chi tiết | [ ] | |
| A8 | Khách | Bấm **Xác nhận gọi món** → giỏ: đổi số lượng, bấm biểu tượng ghi chú để sửa ghi chú, "Xóa hết giỏ món" (có hỏi lại) | Tổng tiền cập nhật; tải lại trang giỏ vẫn còn | [ ] | |
| A9 | Khách | Bấm **Gửi gọi món** → xác nhận | Màn **"Đã gửi tới bếp!"** có **danh sách món vừa gửi** (số lượng, tên, ghi chú); bấm **Theo dõi món** → Món của tôi (đợt 1, Chờ chế biến) | [ ] | |
| A10 | Bếp | (không bấm gì) | Thẻ **T05 – đợt 1** xuất hiện ngay, có âm báo; dòng Ribeye có ghi chú **"Medium, Sốt nấm, Cắt sẵn"** nổi màu vàng | [ ] | |
| A11 | Thu ngân | (không bấm gì) | Bàn T05 trên sơ đồ chuyển **xanh dương "Có khách"**; bấm bàn → bảng bên phải có món, tạm tính | [ ] | |
| A12 | Khách | Gọi thêm 1 món, gửi | Tab Món đã gọi có **đợt 2**; thẻ bếp T05 có thêm mục **Đợt 2** ở trên cùng với nhãn "Mới gọi thêm" (vẫn một thẻ) | [ ] | |
| A13 | Khách | Hủy 1 món của đợt 2 (còn Chờ chế biến) | Món gạch ngang "Khách hủy"; thẻ bếp hiện món gạch ngang nhãn **ĐÃ ĐỔI**, bếp có âm báo + thông báo "Bàn T05: Khách hủy…" | [ ] | |
| A14 | Bếp | Bấm **Bắt đầu (n)** cuối thẻ T05 | Các món mới có nhãn ĐANG LÀM, sọc thẻ đổi cam; khách thấy trạng thái + thanh tiến độ đổi ngay | [ ] | |
| A15 | Khách | Thử hủy món đang chế biến | Không có nút hủy / báo "Bếp đã bắt đầu chế biến…" | [ ] | |
| A16 | Bếp | Bấm Xong từng món (hoặc **Xong (n)** cuối thẻ) | Món rời thẻ, nút **Chờ lấy (n)** tăng; "TB hôm nay" có số phút; khách thấy "Đã xong" | [ ] | |
| A17 | Bếp | Bấm **Chờ lấy (n)** → **Trả lại** 1 món, rồi xong lại | Món quay lại thẻ với nhãn ĐANG LÀM + **GỌI LẠI**, rồi xong lại | [ ] | |
| A18 | Bếp → Thu ngân | Thu ngân xem sơ đồ: T05 **xanh lá "Món chờ mang ra"**, bảng bên phải tab **Chờ mang ra** chỉ xem (không có nút). Bếp bấm **Chờ lấy (n)** → **Đã lấy** một món, rồi **Đã lấy cả đợt** (giả như nhân viên phục vụ đến quầy lấy món) | Thu ngân không bấm được "Đã mang ra"; sau khi bếp bấm Đã lấy: món chuyển Đã mang ra, bàn về xanh dương, khách thấy "Đã mang ra" | [ ] | |
| A19 | Khách | Bấm nút chuông (Gọi nhân viên) → bấm gợi ý "Thêm nước" → đổi sang **Tư vấn món** → đổi sang **Khác**, để trống nội dung → Gửi | Gợi ý đổi theo loại (Tư vấn: "Gợi ý đồ uống"…; Khác: không có gợi ý), đổi loại thì ô nội dung xóa gợi ý cũ; Khác để trống báo "Vui lòng nhập nội dung yêu cầu" | [ ] | |
| A20 | Khách | Chọn gợi ý "Thêm nước" → Gửi | Báo "Đã gửi yêu cầu, nhân viên sẽ đến ngay"; nút chuông đỏ nhấp nháy; trong Món của tôi nút đổi "Đang chờ NV" | [ ] | |
| A21 | Khách | Bấm Gọi nhân viên lần nữa | Hiện trạng thái đang chờ + nút **Hủy yêu cầu** (không tạo thêm yêu cầu) | [ ] | |
| A22 | Phục vụ (`nam.hoang`, điện thoại) | Tab **Yêu cầu** (hoặc Sơ đồ: T05 **cam nhấp nháy**) | Có âm báo + rung khi yêu cầu tới; thẻ "T05 · Hỗ trợ tại bàn · Thêm nước" với nút **Tôi đến** / **Hoàn thành**. Thu ngân **không** thấy yêu cầu này | [ ] | |
| A23 | Phục vụ | Bấm **Tôi đến** | Thẻ đổi "Bạn đang đến"; phục vụ khu khác không nhận được yêu cầu này | [ ] | |
| A24 | Khách | (không bấm gì) → bấm lại nút chuông | Hiện **"Nhân viên Hoàng Gia Nam đang đến bàn bạn"** | [ ] | |
| A25 | Phục vụ | Bấm **Hoàn thành** | Yêu cầu sang tab Hoàn thành; khách: nút trở lại "Gọi nhân viên" | [ ] | |
| A26 | Khách | Bấm (+) 1 món (để trong giỏ, **không gửi**) → **Món của tôi** → **Thanh toán** → thử cả 3 nút; rồi vào lại Thanh toán | Hỏi "Giỏ còn món chưa gửi bếp": **Gửi bếp các món này** (mở bước gửi) · **Bỏ các món này, thanh toán luôn** (xóa giỏ, vào thanh toán) · **Quay lại**. Màn thanh toán: món đã gọi + tạm tính; còn món chưa xong có cảnh báo "Còn n món chưa xong" | [ ] | |
| A27 | Khách | Chọn **Chuyển khoản**, tick Xuất VAT, nhập công ty + mã số thuế sai (vd. "123") → Gửi | Báo lỗi mã số thuế tại ô | [ ] | |
| A28 | Khách | Sửa MST đúng (10 số, vd. 0312345678) → Gửi yêu cầu thanh toán | Hiện "Đã gửi yêu cầu thanh toán"; nút đổi "Đã yêu cầu" | [ ] | |
| A29 | Thu ngân | Sơ đồ bàn (T05 **vàng**) → bấm bàn → **Xem đơn đầy đủ** | Có thẻ "Khách yêu cầu thanh toán" (hình thức, VAT) | [ ] | |
| A30 | Thu ngân | Bấm **Lập hóa đơn** khi còn món chưa xong (nếu có) | Hộp báo "Còn n món chưa xong…", nút Lập hóa đơn bị khóa | [ ] | |
| A31 | Bếp → Thu ngân | Bếp hoàn thành hết món → thu ngân bấm **Lập hóa đơn** | Bản xem trước: món gộp cùng giá, tổng cộng; VAT điền sẵn từ yêu cầu của khách | [ ] | |
| A32 | Thu ngân | Bấm **Lập hóa đơn** | Báo "Đã lập hóa đơn HDyymm-xxx"; tự mở hộp **Thu tiền** có mã QR chuyển khoản | [ ] | |
| A33 | Khách | (không bấm gì) | Hóa đơn tự bật lên: các món, tổng cộng, **mã QR** (ngân hàng, số TK, số tiền, nội dung = mã HĐ) | [ ] | |
| A34 | Khách | Đóng hóa đơn, thử gọi thêm món | Báo "Bàn đang chờ thanh toán, không gọi thêm món được" | [ ] | |
| A35 | (tùy chọn) | Dùng app ngân hàng quét mã QR (không cần chuyển thật) | App đọc được: tài khoản mẫu, số tiền, nội dung | [ ] | |
| A36 | Thu ngân | Hộp Thu tiền: chọn Tiền mặt, số tiền 50.000, tiền khách đưa 100.000; bấm **Thêm hình thức** | Dòng 2 tự điền phần còn lại; hiện "Tiền thối lại 50.000"; "Còn phải thu 0" | [ ] | |
| A37 | Thu ngân | Sửa số tiền cho lệch tổng | Nút Xác nhận bị khóa / báo "Tổng tiền thu chưa khớp" | [ ] | |
| A38 | Thu ngân | Sửa đúng → **Xác nhận thanh toán** | "Đã thanh toán hóa đơn …"; đơn Hoàn tất; có nút In hóa đơn | [ ] | |
| A39 | Khách | (không bấm gì) → bấm **Xem thực đơn** | Hiện "**Cảm ơn quý khách!** Hóa đơn … đã được thanh toán"; bấm Xem thực đơn về **thẳng thực đơn** (không quay lại màn Đã gửi / Món của tôi) | [ ] | |
| A39b | Thu ngân | Bấm chuông **Thông báo** → bấm một thông báo yêu cầu của khách / hóa đơn | Mở đúng trang; dòng yêu cầu / hóa đơn liên quan **sáng nhấp nháy** vài giây | [ ] | |
| A39c | Thu ngân | Khách **nói miệng** "tính tiền" (không bấm trên điện thoại): bấm bàn → **Lập hóa đơn** | Lập hóa đơn, thu tiền bình thường — yêu cầu thanh toán trên điện thoại không bắt buộc | [ ] | |
| A40 | Thu ngân | Sơ đồ bàn | T05 về **Trống**; "Đã thu hôm nay" tăng đúng số tiền | [ ] | |
| A41 | Thu ngân | **Hóa đơn** → mở hóa đơn vừa thu → **In hóa đơn** | Chi tiết có 2 khoản thu, tiền thối; bản in có tên / địa chỉ nhà hàng, thu ngân, thông tin VAT | [ ] | |
| A42 | Quản lý | **Dashboard** → Doanh thu "Hôm nay" | Tổng doanh thu đã gồm hóa đơn vừa thu | [ ] | |

---

## B. Khách – trang đặt món (trường hợp khác)

| # | Thao tác | Kết quả mong đợi | Đạt | Ghi chú |
|---|---|---|---|---|
| B1 | Mở `/goi-mon/abc` (mã sai) | "Mã QR không hợp lệ. Vui lòng liên hệ nhân viên." | [ ] | |
| B2 | Quản lý cho một bàn **ngừng phục vụ** → mở QR bàn đó | "Bàn đang tạm ngừng phục vụ…" | [ ] | |
| B3 | Sửa giờ mở cửa hôm nay để đang **ngoài giờ** → mở QR | Viên "Ngoài giờ phục vụ · mở lại …" trên ảnh bìa; xem được thực đơn, không gửi món được | [ ] | |
| B4 | Có món trong giỏ → bếp đánh dấu món đó **tạm hết** → khách bấm Gửi | Món trong giỏ bị đánh dấu, báo xóa món hết mới gửi được | [ ] | |
| B5 | Bàn chưa gọi món → bấm Thanh toán | "Bàn chưa có món nào để thanh toán" | [ ] | |
| B6 | Gửi yêu cầu thanh toán rồi bấm **Hủy yêu cầu** (trước khi thu ngân lập hóa đơn) | Yêu cầu hủy, nút trở lại "Thanh toán" | [ ] | |
| B7 | Mở cùng một mã QR trên 2 thiết bị, cả hai gửi món | Cùng vào 1 đơn (đợt 1, đợt 2…), không tạo 2 đơn | [ ] | |
| B8 | Mở trang trên điện thoại thật; đổi điện thoại sang chế độ tối; kéo **dây đèn** trên ảnh bìa xuống rồi thả (thử cả bấm vào đèn) | Hiển thị gọn, không tràn ngang; trang tự tối theo điện thoại; kéo dây: đèn tắt, nền tối lan ra từ đèn, dây nảy + đèn đung đưa; kéo lại thì sáng; được nhớ khi tải lại | [ ] | |
| B9 | Quản lý: Cấu hình hệ thống → Thông tin nhà hàng → tải **Ảnh bìa trang đặt món** → Lưu; mở lại trang khách | Ảnh bìa hiện đầu trang khách, có dòng "Chào mừng đến với …" | [ ] | |
| B10 | Bấm **+** trên một món (giỏ đang trống), rồi bấm + thêm lần nữa | Ảnh món bay theo đường cong xuống thanh giỏ; thanh giỏ trượt lên, túi nảy, số món + tạm tính chạy số; nút + biến thành bộ tăng / giảm | [ ] | |
| B11 | Bấm vào ảnh một món → cuộn trong chi tiết → bấm ⤢ → bấm nút đóng (mũi tên xuống) / vuốt xuống | Màn trượt lên mượt: nền ảnh món làm mờ, ảnh món bo tròn nổi phóng nhẹ, các khối hiện lần lượt; cuộn thì ảnh thu nhỏ, đầu màn hiện tên món; ⤢ xem ảnh toàn màn hình; đóng thì màn trượt xuống | [ ] | |
| B12 | Mở **Phở bò Úc tái nạm**: chọn "Không hành", "Ghi chú khác" nhập "ít bánh", tăng số lượng → **Thêm · …** | Nút đổi "✓ Đã thêm", màn thu xuống **rồi** ảnh bay từ thẻ món vào giỏ (không khựng, không chạy chồng); giỏ có ghi chú "Không hành, ít bánh" | [ ] | |
| B13 | Mở Giỏ món / Món của tôi → kéo phần đầu màn xuống | Màn trượt xuống và đóng | [ ] | |
| B14 | Gửi món → Theo dõi món; bếp bắt đầu / xong món | Màn "Đã gửi tới bếp!" có tranh động ✓ + pháo giấy; Món của tôi có tranh động đổi theo giai đoạn + thanh 4 bước (Đã gửi → Đang nấu → Sẵn sàng → Đã mang ra) chạy tới bước hiện tại | [ ] | |
| B15 | Điện thoại bật **Giảm chuyển động** (iPhone: Trợ năng → Chuyển động; Android: Hỗ trợ tiếp cận → Xóa hiệu ứng) rồi mở lại trang | Không còn hiệu ứng bay / trượt; dải danh mục thành hàng thẳng; tranh động đứng yên; mọi chức năng vẫn dùng được | [ ] | |
| B16 | Quản lý đặt giờ đóng cửa hôm nay sớm hơn giờ hiện tại → mở trang khách | Góc trên ảnh bìa có viên "Ngoài giờ phục vụ · mở lại [giờ] sáng mai"; không còn khung vàng trên dải danh mục; giỏ món báo không gửi được | [ ] | |
| B17 | Mở các món bít tết (Striploin, Tomahawk, Bít tết chảo gang) | Có khối **Độ chín** dạng thanh kéo màu thịt (5 mức, chọn sẵn Medium rare; kéo hoặc bấm tên mức; màu chấm + mô tả đổi theo mức) + **Sốt kèm** (chảo gang không có Sốt kèm) | [ ] | |
| B18 | Mở 1 món **Lẩu**, 1 **Đồ uống** (Trà đào, Vang đỏ), 1 **Tráng miệng** | Ghi chú nhanh đúng loại: lẩu *Ít cay / Nước lẩu nhạt / Thêm nước chấm / Không hành* (không có "Không đá"); trà đào *Ít đá / Không đá / Ít ngọt*; vang *Ướp lạnh / Thêm đá*; tráng miệng *Ít ngọt…*; không món nào có độ chín | [ ] | |
| B22 | Thu ngân mở một bàn trống, không gọi món → bấm **Đóng bàn** | Bàn về Trống; QR bàn đó lại báo "Bàn chưa mở" | [ ] | |
| B23 | Mở bàn rồi để yên (Quản lý đặt Cấu hình → Gọi món tại bàn = 1 phút để thử nhanh) | Sau ~1–2 phút bàn tự đóng; đặt lại 30 phút sau khi thử | [ ] | |
| B24 | Bàn đặt trước (tím) có khách đến → **Khách đã đến – Mở bàn** | Mở bàn với số khách của phiếu đặt; phiếu đặt chuyển "Đã đến" | [ ] | |
| B25 | Bàn đã có món → tìm nút Đóng bàn | Không có nút Đóng bàn (phải dùng Hủy đơn kèm lý do) | [ ] | |
| B20 | Phần **Bán chạy**: để yên vài giây; chạm / vuốt băng chuyền; để yên tiếp | Băng chuyền nền tối tự trượt chậm qua lại (tới #10 thì chậm dần, dừng ~1,5 giây rồi chạy ngược về #1), dừng khi chạm / vuốt, để yên ~4 giây lại chạy | [ ] | |
| B21 | Mở **Món của tôi** / Giỏ món / Thanh toán rồi vuốt mạnh lên xuống tới mép danh sách (điện thoại thật) | Không lộ thực đơn phía sau, đóng màn thì trang thực đơn ở đúng chỗ cũ | [ ] | |
| B26 | Cuộn tới mục **Đồ uống** → bấm nút **+** của thẻ **Nước ngọt có ga** | Không có ảnh bay vào giỏ; bảng chọn hiện 6 dòng (Coca-Cola, Coca Zero, Sprite, Fanta Cam, Fanta Nho, Sá xị) có − / +; tăng 3 Sprite + 2 Coca (bảng không đóng, nút đáy ghi "Thêm vào giỏ · 5 món · 175.000đ") → bấm nút: giỏ có 5 lon, bảng đóng, thẻ hiện 5 | [ ] | |
| B26b | Mở lại bảng **Nước ngọt có ga** → giảm Sprite còn 2 → **Cập nhật giỏ**; mở lại, tăng thêm rồi bấm X đóng bảng | Bảng mở ra đã có sẵn số đang có trong giỏ; sau Cập nhật giỏ còn 4 lon; đóng bảng không bấm nút thì giỏ không đổi | [ ] | |
| B26c | Trong bảng chọn, chạm ảnh / tên **Sprite**; rồi gõ tìm "sprite" | Mở chi tiết món Sprite (mô tả, thành phần, đặt như món thường); kết quả tìm kiếm hiện Sprite, dưới tên ghi **"Nước ngọt có ga"** | [ ] | |
| B27 | Thẻ **Bia** / **Vang đỏ Úc** | Giá ghi "từ 45.000đ" / "từ 145.000đ"; bảng chọn có giá từng loại (ly / chai, chai / tươi) | [ ] | |
| B28 | Bấm **+** ngoài thẻ một món bít tết (vd. Ribeye) rồi mở giỏ | Dòng món có ghi chú **"Medium rare, Sốt tiêu đen"** (không còn trống) | [ ] | |
| B29 | Khu **Set menu** (ngay dưới Bán chạy) | Một khung giấy kem viền đôi vàng, chỉ hiện 1 set: ruy-băng chéo góc **"-10%"** (Set Steak), tên, danh sách món dòng chấm, giá set, giá gốc gạch ngang, "Tiết kiệm 157.000đ"; đáy khung có hàng chấm (3 chấm ngoài giờ trưa, 4 chấm trong 10:30–14:00); nền tối vẫn giữ màu giấy | [ ] | |
| B29b | Đứng yên ở khu Set menu ~10 giây; rồi vuốt ngang | Tự sang set kế (chuyển nhanh, chấm đổi theo); tới set cuối thì chạy ngược lại; vuốt thì đổi ngay, dừng đúng một set, đợi lại ~9 giây mới tự chạy; các set cao bằng nhau, trang không nhảy | [ ] | |
| B30 | Mở **Set Steak cho 2 người** → chọn độ chín / sốt riêng cho Striploin và Ribeye → **Thêm set** | Giỏ có 1 dòng set, bên dưới liệt kê món con kèm độ chín đã chọn | [ ] | |
| B31 | Mở **Set Lẩu nhóm 4 người** → giảm Coca còn 2, thêm 2 Sprite | Chưa đủ 4 lon thì nút báo "Chọn đủ nước ngọt" và khóa; đủ 4 thì thêm được | [ ] | |
| B32 | Gửi set (bàn đã mở) → Món của tôi | Mỗi món con hiện tên set; nút **"Hủy cả set"** khi bếp chưa làm; hủy → cả set về Đã hủy, tạm tính trừ đúng giá set | [ ] | |
| B33 | Bếp đánh dấu **Bánh flan** tạm hết → tải lại trang khách | **Set Lẩu nhóm 4 người** biến mất khỏi khu Set menu (món con tạm hết thì ẩn cả set); bỏ tạm hết → set hiện lại | [ ] | |
| B34 | Mở trang ngoài 10:30–14:00 | Không có **Set Bữa trưa văn phòng** | [ ] | |
| B35 | Mở chi tiết **Ribeye** / một món **Lẩu** | Có hàng **"Gọi thêm cho món này"** (steak: khoai nghiền, salad, bánh mì bơ tỏi, 3 sốt; lẩu: bò nhúng, rau nấm, bún); bấm + → thêm thành dòng riêng trong giỏ | [ ] | |
| B36 | Phần **Bán chạy** | Chỉ có món ăn (không có đồ uống, món Gọi thêm, set) | [ ] | |
| B37 | Có ảnh bìa (biển hiệu ROYAL BEEF trên cửa kính) | Chữ ROYAL BEEF và tua rua không bị thanh tìm kiếm che; không hiện dòng "Chào mừng đến với …" đè lên ảnh; bỏ ảnh bìa trong Cấu hình thì dòng chào hiện lại | [ ] | |
| B19 | Quản lý: Món ăn → **Danh mục món** → sửa 1 danh mục → bỏ ảnh → Lưu; mở lại trang khách; rồi tải ảnh khác → Lưu | Bỏ ảnh: vòng tròn hiện **chữ cái đầu**; tải ảnh mới: trang khách hiện ảnh mới; bật / tắt danh mục **không làm mất ảnh** | [ ] | |

## C. Bếp

| # | Thao tác | Kết quả mong đợi | Đạt | Ghi chú |
|---|---|---|---|---|
| C0 | Khách gửi một set (vd. Set Steak) | Món con hiện riêng từng phiếu, có nhãn **"SET · Steak cho 2 người"** | [ ] | |
| C1 | Đổi cách xem **Theo món** | Gộp số lượng cùng món từ nhiều bàn | [ ] | |
| C2 | Lọc **Mới / Đang làm** và bấm viên danh mục | Chỉ còn món đúng trạng thái / danh mục; số trên mỗi mục đúng | [ ] | |
| C3 | Thẻ chờ lâu | Đồng hồ + viền thẻ đổi vàng (≥10′), cam (≥20′), đỏ (≥30′) — theo mốc mặc định | [ ] | |
| C4 | Bấm **Hủy** 1 món còn chờ → chọn lý do "Hết nguyên liệu", tick đánh dấu tạm hết | Món hủy; khách thấy lý do; thu ngân nhận **thông báo** "Bếp hủy món…"; món thành tạm hết | [ ] | |
| C5 | Bấm vào tên bàn trên thẻ | Mở chi tiết đơn của bàn | [ ] | |
| C6 | **Món tạm hết** → bật / tắt một món | Khách thấy món hết / bán lại ngay | [ ] | |
| C7 | Rút mạng / tắt backend rồi bật lại | Báo "Mất kết nối", tự nối lại và cập nhật | [ ] | |
| C8 | **Kiểm tra nguyên liệu** → Theo món | Món ít phần nhất ở trên; nguyên liệu giới hạn; món chưa có công thức có link "Khai báo công thức" | [ ] | |
| C9 | Món còn 0 phần → **Đánh dấu tạm hết** | Món thành tạm hết hôm nay | [ ] | |
| C10 | **Theo nguyên liệu**, lọc "Sắp hết" | Tồn, tồn tối thiểu, tình trạng, các món dùng nguyên liệu | [ ] | |
| C11 | **Công thức** → lọc "Chưa có" → chọn món → thêm 2 nguyên liệu, định lượng 0 → Lưu | Báo "Định lượng phải lớn hơn 0" tại dòng | [ ] | |
| C12 | Nhập định lượng đúng (vd. 0,15) → Lưu | "Đã lưu công thức …"; giá vốn / phần và % giá bán hiện ra; Kiểm tra nguyên liệu có số phần của món | [ ] | |
| C13 | Chọn trùng nguyên liệu | Nguyên liệu đã chọn bị mờ trong danh sách / báo trùng | [ ] | |
| C14 | Sửa dở rồi bấm sang món khác | Hỏi "Bỏ thay đổi?" | [ ] | |
| C15 | Xóa hết dòng → Lưu | Hỏi xác nhận; món về "Chưa có công thức" | [ ] | |
| C16 | Kho: mở chi tiết nguyên liệu vừa dùng | Mục "Món đang dùng" có món vừa khai báo | [ ] | |
| C17 | Bàn gọi 2–3 đợt | Chỉ **một thẻ** cho bàn; đợt mới nhất ở trên, mỗi đợt có giờ gọi + đồng hồ riêng | [ ] | |
| C18 | ⚙ Cài đặt → Nền **Tối**, Số cột **3**, Cỡ chữ **Lớn**; tải lại trang | Áp dụng ngay; tải lại vẫn giữ; trang Kiểm tra nguyên liệu / Công thức cũng nền tối | [ ] | |
| C19 | ⚙ → Mốc màu: sửa 10 → 5 phút, đổi màu, **Thêm mốc** đến 4; **Khôi phục mặc định** | Đồng hồ đổi màu theo mốc mới; tối đa 4 mốc; khôi phục về 10/20/30 | [ ] | |
| C20 | ⚙ → Danh mục phụ trách: chọn **Đồ uống** (giả làm quầy pha chế); khách gọi 1 đồ uống + 1 món chính | Dải lọc hiện "Trạm: Đồ uống"; chỉ thấy + chỉ kêu cho đồ uống; máy khác (không chọn) thấy cả hai | [ ] | |
| C21 | Bàn phím rời: bấm số ở góc thẻ → **Space** → **Enter**; **← →**; **Esc** | Thẻ được viền chọn; Space bắt đầu món mới; Enter xong; mũi tên chuyển thẻ; Esc bỏ chọn | [ ] | |
| C22 | Thu ngân hủy 1 món còn chờ của bàn đang có món ở bếp | Thẻ bếp hiện **ĐÃ ĐỔI – Thu ngân hủy lúc …** trong 10 phút, có âm báo | [ ] | |

## D. Thu ngân (trường hợp khác)

| # | Thao tác | Kết quả mong đợi | Đạt | Ghi chú |
|---|---|---|---|---|
| D-POS1 | Thu ngân đăng nhập | Mở khu POS toàn màn hình (không có menu trái), tab Sơ đồ bàn / Đơn hàng / Yêu cầu thanh toán / Hóa đơn có số đếm | [ ] | |
| D-POS2 | Xem sơ đồ từng khu vực, phóng to / thu nhỏ | Bàn đúng hình + ghế theo số ghế, đúng vị trí như trang Khu vực bàn; màu đúng trạng thái; dải chú thích đếm đúng | [ ] | |
| D-POS3 | Khách quét QR gọi nhân viên ở một bàn | Sơ đồ **thu ngân không đổi** (yêu cầu hỗ trợ do phục vụ xử lý, xem H); khách bấm *Yêu cầu thanh toán* thì bàn chuyển vàng, tab Yêu cầu thanh toán tăng số | [ ] | |
| D-POS4 | Để một món chờ bếp quá 25 phút | Bàn chuyển đỏ "Quá giờ"; bảng bên phải ghi "n món chờ quá 25′" | [ ] | |
| D-POS5 | Quản lý tạo đặt bàn cho một bàn trống, giờ đến trong 2 giờ tới | Bàn tím, dưới bàn có tên + giờ đến; tab "Đặt bàn hôm nay" có phiếu (tô nổi) | [ ] | |
| D-POS6 | Bấm bàn có khách → bấm số khách 3 | Bàn hiện 3/[số ghế]; "Khách đang ngồi" ở đáy tăng | [ ] | |
| D-POS7 | Bảng bên phải → **In tạm tính** | Cửa sổ in "PHIẾU TẠM TÍNH"; bàn không bị khóa, khách vẫn gọi thêm được | [ ] | |
| D-POS8 | Bảng bên phải → Chuyển bàn / Lập hóa đơn → Thu tiền | Hoạt động như trước; sau thu tiền bàn về Trống | [ ] | |
| D-POS9 | Bấm **Văn phòng** → Chấm công → **Về quầy thu ngân** | Sang khung quản lý (Chấm công, Bảng lương, Thông báo), quay lại sơ đồ bàn | [ ] | |
| D-POS10 | Máy tính bảng dọc (≈800px) bấm một bàn | Bảng bàn hiện dạng lớp phủ bên phải; tab trên cùng chỉ còn biểu tượng | [ ] | |
| D1 | Chi tiết đơn có món Chờ chế biến → **Hủy** món, không chọn lý do | Nút Hủy món bị khóa | [ ] | |
| D2 | Chọn lý do → Hủy món | Món hủy (Thu ngân hủy + tên), bếp mất món, tạm tính giảm | [ ] | |
| D3 | Đơn chỉ có món chờ / đã hủy → **Hủy đơn** (lý do Khách bỏ về) | Đơn Đã hủy, bàn Trống, yêu cầu đang chờ của bàn hủy theo | [ ] | |
| D4 | Đơn có món đang / đã làm | Không có nút Hủy đơn | [ ] | |
| D5 | **Chuyển bàn** sang bàn Trống | "Đã chuyển đơn … sang bàn …"; bàn cũ Trống; bếp hiện tên bàn mới; QR bàn cũ không còn thấy đơn | [ ] | |
| D6 | Chuyển sang bàn **Đặt trước** | Hỏi lại "Bàn đang được giữ cho lịch đặt…" | [ ] | |
| D7 | **In tạm tính** | Bản in ghi rõ "không phải hóa đơn" | [ ] | |
| D8 | Lập hóa đơn rồi chọn **Để sau** | Đơn "Chờ thanh toán", có nút **Thu tiền HD…** | [ ] | |
| D9 | **Hóa đơn** → mở hóa đơn chưa thanh toán → **Hủy hóa đơn**, lý do 3 ký tự | Báo "ít nhất 5 ký tự" | [ ] | |
| D10 | Lý do đúng → Hủy | Hóa đơn Đã hủy; đơn mở khóa; khách gọi thêm món được | [ ] | |
| D11 | Hóa đơn đã thanh toán | Không có nút Hủy / Thu tiền, chỉ In | [ ] | |
| D12 | Danh sách Hóa đơn: lọc trạng thái, hình thức, tìm theo mã | Đúng kết quả; dưới bảng có tổng đã thu theo từng hình thức | [ ] | |
| D13 | Chọn khoảng ngày > 31 ngày | Báo "Khoảng ngày tối đa 31 ngày" | [ ] | |
| D14 | **Đơn hàng**: lọc Đang mở / Chờ thanh toán / Hoàn tất / Đã hủy, tìm mã bàn | Đúng kết quả; bấm mã đơn mở chi tiết | [ ] | |
| D15 | Xử lý yêu cầu thanh toán sẵn có của **VIP01** từ trang Yêu cầu → **Lập hóa đơn** | Mở đúng chi tiết đơn VIP01 | [ ] | |
| D16 | **Thông báo** (chuông) | Có thông báo yêu cầu khách / bếp hủy món; bấm vào mở đúng trang, dòng liên quan sáng nhấp nháy | [ ] | |
| D17 | **Chấm công**: xem tháng này | Danh sách + tổng giờ theo nhân viên; 2 dòng "Thiếu giờ ra" | [ ] | |
| D18 | **Nhập từ Excel** → Tải file mẫu → mở bằng Excel, sửa 3–4 dòng (có 1 dòng sai tên đăng nhập, 1 dòng ngày 31/02) → chọn file | Xem trước: dòng Hợp lệ / Lỗi kèm lý do | [ ] | |
| D19 | **Tải các dòng lỗi** | File Excel có cột "Lỗi" | [ ] | |
| D20 | **Nhập n dòng hợp lệ** | Báo số dòng đã nhập; dòng mới hiện nguồn "Excel" | [ ] | |
| D21 | Nhập lại cùng file | Các dòng thành **Trùng**; chọn Bỏ qua / Ghi đè hoạt động đúng | [ ] | |
| D22 | **Thêm chấm công** tay, bỏ trống ghi chú | Báo "Vui lòng nhập ghi chú" | [ ] | |
| D23 | Thêm dòng chồng giờ với dòng có sẵn | Báo "Chồng giờ…" | [ ] | |
| D24 | Giờ vào 22:00, giờ ra 06:00 | Lưu được, ghi "(+1 ngày)", 8 giờ | [ ] | |
| D25 | Sửa / xóa dòng của tháng trước (kỳ đã chốt) | Hiện "Đã chốt", không có nút sửa / xóa | [ ] | |
| D26 | **Bảng lương** → kỳ tháng trước | Đã chốt; mở xem được, không sửa được; In phiếu lương | [ ] | |
| D27 | **Tạo kỳ lương** trùng khoảng ngày tháng trước | Báo "Khoảng ngày trùng với kỳ …" | [ ] | |
| D28 | Tạo kỳ tháng này | Bảng lương từng nhân viên, cảnh báo dòng thiếu giờ ra | [ ] | |
| D29 | Bút chì 1 nhân viên → phụ cấp 200.000 không ghi chú | Báo cần ghi chú | [ ] | |
| D30 | Nhập ghi chú → Lưu | Thực lĩnh tăng đúng 200.000 | [ ] | |
| D31 | **Chốt bảng lương** | Bị chặn: còn thiếu giờ ra / kỳ chưa kết thúc | [ ] | |
| D32 | Sửa 2 dòng thiếu giờ ra ở Chấm công → quay lại → **Tính lại** | Giờ công cập nhật, phụ cấp vẫn giữ | [ ] | |
| D33 | **In bảng lương**, **In phiếu lương** | Bản in đúng số liệu, phiếu lương có chi tiết ngày công | [ ] | |

## E. Quản lý nhà hàng

| # | Trang | Thao tác | Kết quả mong đợi | Đạt | Ghi chú |
|---|---|---|---|---|---|
| E1 | Dashboard | Đổi mốc: Hôm nay / Hôm qua / 7 ngày / 30 ngày / Tháng này / Tháng trước; bật **So sánh kỳ trước** | Biểu đồ + tổng, số đơn, trung bình đổi theo; đường kỳ trước hiện khi bật so sánh | [ ] | |
| E2 | Dashboard | Thẻ **Món ăn**: tab Bán chạy / Bán chậm | 5 món mỗi tab, thanh tỷ lệ | [ ] | |
| E3 | Dashboard | Thẻ **Kho trong kỳ** | Chi phí nhập, phiếu chờ nhận, công nợ, nguyên liệu sắp hết | [ ] | |
| E4 | Đặt bàn → Lịch sử | Lọc, tìm; đổi trạng thái lịch (xác nhận, khách đến, hủy…); thêm lịch tại quầy | Đúng trạng thái, không trùng bàn trùng giờ | [ ] | |
| E5 | Đặt bàn → Cập nhật form | Sửa cấu hình form đặt bàn → Lưu | Lưu thành công | [ ] | |
| E6 | Khu vực bàn | Thêm khu vực, thêm bàn, kéo bàn trên sơ đồ, sửa số ghế, ngừng phục vụ | Lưu đúng; bàn ngừng hiện mờ ở sơ đồ thu ngân | [ ] | |
| E7 | Khu vực bàn | **Mã QR** → In | Bản in mã QR kèm tên bàn | [ ] | |
| E8 | Món ăn | Thêm món (ảnh, giá, danh mục, dị ứng, độ cay) → Lưu | Món hiện ở trang khách | [ ] | |
| E8b | Món ăn → Danh mục món | Thêm danh mục "Món chay" kèm ảnh → Lưu; thêm 1 món vào danh mục | Danh mục có ảnh tròn trong danh sách; trang khách có vòng tròn "Món chay" với ảnh vừa tải, ghi chú nhanh kiểu món chay | [ ] | |
| E8c | Món ăn → **Nhóm món** | Thêm nhóm "Trà các loại" (Đồ uống, có ảnh); sửa món Trà đào → Nhóm hiển thị = Trà các loại, Tên loại = "Trà đào" → Lưu; xem trang khách; xóa nhóm | Trang khách có thẻ nhóm mới; xóa nhóm → món trở lại đứng riêng (không mất món) | [ ] | |
| E8d | Món ăn → **Set menu** | Thêm set: chọn 2–3 món, số lượng, cho đổi loại món nước ngọt, giá, giờ bán, ảnh → Lưu; tắt "Bán trên thực đơn" | Thẻ hiện giá set / giá gốc / khách tiết kiệm; set có trên trang khách, tắt thì ẩn; Chatbot → Quản lý thực đơn hiện tóm tắt set | [ ] | |
| E9 | Món ăn | Ngừng bán một món | Món biến mất khỏi trang khách | [ ] | |
| E10 | Nhân viên → Ca làm | Tạo ca, xếp ca theo tuần; xếp trùng giờ | Báo trùng ca | [ ] | |
| E11 | Kho → Duyệt kiểm kê | Duyệt / từ chối phiếu kiểm kê chờ duyệt (xem mục F) | Phiếu đổi trạng thái; kho nhận thông báo | [ ] | |
| E12 | Kho → Công nợ NCC | Xem công nợ theo nhà cung cấp | Số khớp bên Kho | [ ] | |
| E13 | Bài viết | Thêm / sửa / ẩn bài viết | Lưu đúng | [ ] | |
| E14 | Tài khoản | Thêm tài khoản Thu ngân → đăng nhập tài khoản mới | Bị bắt **đổi mật khẩu** lần đầu | [ ] | |
| E15 | Tài khoản | Khóa tài khoản đang đăng nhập ở cửa sổ khác | Cửa sổ kia bị đăng xuất ở thao tác kế tiếp | [ ] | |
| E16 | Chatbot AI | Sửa cấu hình, FAQ | Lưu được (lịch sử hội thoại / thống kê còn **dữ liệu giả** — chờ làm AI) | [ ] | |
| E17 | Nhật ký | Lọc module **Thu ngân**, **Bếp**, **Chấm công – lương** | Thấy thao tác vừa test (lập / hủy hóa đơn, hủy món, chuyển bàn, nhập chấm công…) | [ ] | |
| E18 | Cấu hình → Thông tin | Sửa tên / địa chỉ / SĐT nhà hàng | Hóa đơn in ra dùng thông tin mới | [ ] | |
| E19 | Cấu hình → Giờ mở cửa | Sửa giờ | Trang khách chặn / cho gửi món theo giờ mới | [ ] | |
| E20 | Cấu hình → **Thanh toán** | Nhập số TK 2 ký tự → Lưu; sửa đúng → Lưu | Báo lỗi tại ô; lưu được; mã QR trên hóa đơn mới dùng TK mới | [ ] | |
| E21 | Cấu hình → Sao lưu | Tạo bản sao lưu, tải về | Có file .zip (phục hồi chỉ thử trên CSDL dev) | [ ] | |

## F. Quản lý kho

| # | Trang | Thao tác | Kết quả mong đợi | Đạt | Ghi chú |
|---|---|---|---|---|---|
| F1 | Dashboard kho | Xem số liệu | Giá trị tồn, sắp hết / hết, phiếu chờ nhận, biểu đồ nhập – xuất | [ ] | |
| F2 | Nguyên liệu | Thêm nguyên liệu (trùng tên → lỗi), sửa định mức tối thiểu | Lưu đúng; tình trạng Sắp hết / Hết đổi theo | [ ] | |
| F3 | Nguyên liệu | Chi tiết: lịch sử biến động, nhà cung cấp, món đang dùng | Hiện đủ | [ ] | |
| F4 | Nhà cung cấp | Thêm NCC, gắn nguyên liệu + giá theo đơn vị mua | Lưu đúng, có lịch sử đổi giá | [ ] | |
| F5 | Phiếu mua | Tạo phiếu (nháp) → sửa → gửi | Trạng thái Đang chờ nhận | [ ] | |
| F6 | Phiếu mua | **Nhận hàng** một phần, rồi nhận nốt | Nhận một phần → Đã nhận đủ; tồn kho tăng; giá vốn bình quân đổi | [ ] | |
| F7 | Nhập kho | Nhập **không theo phiếu** | Tồn tăng, có phiếu nhập | [ ] | |
| F8 | Xuất kho | Xuất cho bếp / xuất hủy; xuất quá tồn | Tồn giảm; quá tồn bị chặn; tồn dưới tối thiểu → thông báo cho Kho + Quản lý | [ ] | |
| F9 | Kiểm kê | Tạo phiếu, nhập số thực tế lệch → gửi duyệt | Chờ duyệt; Quản lý nhận thông báo | [ ] | |
| F10 | Kiểm kê | Quản lý **duyệt** (mục E11) | Tồn điều chỉnh theo số thực tế; kho nhận thông báo | [ ] | |
| F11 | Kiểm kê | Phiếu bị **từ chối** | Kho thấy lý do từ chối | [ ] | |
| F12 | Công nợ NCC | Ghi nhận thanh toán cho NCC (tiền mặt / chuyển khoản) | Công nợ giảm; phiếu mua đổi trạng thái thanh toán | [ ] | |

## G. Chung cho mọi vai trò

| # | Thao tác | Kết quả mong đợi | Đạt | Ghi chú |
|---|---|---|---|---|
| G1 | Đăng nhập sai mật khẩu | Báo lỗi, không vào được | [ ] | |
| G2 | Mỗi vai trò gõ đường dẫn của vai trò khác (vd. Bếp mở `/thu-ngan`) | Bị chuyển về trang của mình / không xem được dữ liệu | [ ] | |
| G3 | Đổi mật khẩu (menu tài khoản góc phải) | Đổi được, đăng nhập lại bằng mật khẩu mới | [ ] | |
| G4 | Ô tìm kiếm đầu trang (Ctrl+K) | Gợi ý đúng các trang của vai trò đó | [ ] | |
| G5 | Bật chế độ tối (Quản lý / Kho / Thu ngân) | Chữ, bảng, hộp thoại đọc rõ; mã QR vẫn nền trắng | [ ] | |
| G6 | Thu nhỏ cửa sổ / mở trên máy tính bảng | Menu thu gọn, bảng cuộn ngang, không vỡ bố cục | [ ] | |
| G7 | Để yên quá 2 giờ rồi thao tác | Hết phiên, đưa về trang đăng nhập | [ ] | |

## H. Nhân viên phục vụ & chấm công khuôn mặt (từ V20)

Đăng nhập bằng điện thoại (hoặc thu nhỏ trình duyệt). Tài khoản mẫu: `nam.hoang` (Tầng 1), `vy.ngo` (Tầng 1),
`phuc.do` (Tầng 2), `quynh.ly` (Sân vườn), `binh.vu` (Phòng VIP) — khu được gán theo ca trong dữ liệu mẫu.
**Camera trên điện thoại chỉ mở được qua HTTPS** (laptop mở `http://localhost` thì được) — xem
[TRIEN_KHAI.md](../trien-khai/TRIEN_KHAI.md) mục "Chấm công khuôn mặt".

| # | Thao tác | Kết quả mong đợi | Đạt | Ghi chú |
|---|---|---|---|---|
| H1 | Phục vụ đăng nhập | Vào `/phuc-vu`; thanh trên ghi ca hiện tại + khu (vd. "Ca gãy 10:00–14:00 · Tầng 1"); thanh dưới 5 tab: Sơ đồ · Yêu cầu · Mang món · Thực đơn · Tôi | [ ] | |
| H2 | Sơ đồ bàn | Mở sẵn khu "Của tôi"; chuyển tab xem được khu khác; bàn vẽ đúng vị trí như trang Quản lý → Khu vực bàn; không có doanh thu | [ ] | |
| H3 | Quản lý (máy khác) di chuyển một bàn ở Tầng 1 | Phục vụ thấy thông báo "Quản lý vừa thay đổi sơ đồ Tầng 1" và sơ đồ đổi ngay, không cần tải lại | [ ] | |
| H4 | Bấm bàn trống → chọn số khách → **Mở bàn** | Bảng bàn trượt lên; bàn chuyển Có khách; mã QR của bàn gọi món được | [ ] | |
| H5 | **Gọi món cho khách** → thêm 2 món, ghi chú "ít cay" → Xem giỏ → **Gửi bếp** | Về sơ đồ, báo đã gửi; bếp thấy món; món ghi là nhân viên gọi | [ ] | |
| H6 | Bếp bấm xong món → phục vụ tab **Mang món** → **Đã mang hết** | Món chuyển "Đã mang"; khách thấy món đã mang ra | [ ] | |
| H7 | Bàn có khách → **Chuyển bàn** sang bàn trống; bàn khác → **Ghép bàn** vào bàn đang có khách | Chuyển: bàn cũ Trống. Ghép: món + số khách gộp sang bàn đích, bàn cũ Trống | [ ] | |
| H8 | Khách ở Tầng 2 gọi nhân viên | Chỉ phục vụ Tầng 2 (`phuc.do`) thấy; khu không ai được gán trong ca thì mọi phục vụ trong ca thấy | [ ] | |
| H9 | Tab **Thực đơn** → bấm một món | Thấy thành phần, dị nguyên, độ cay, món đã hết | [ ] | |
| H10 | Tab **Tôi** → Chấm công → tick đồng ý → **Mở camera đăng ký** → làm theo hướng dẫn (nhìn thẳng → quay đầu → nhìn thẳng) | Gửi khuôn mặt, trạng thái "Đang chờ quản lý duyệt" kèm ảnh; quản lý nhận thông báo | [ ] | |
| H11 | Quản lý → Quản lý nhân viên → **Khuôn mặt chấm công** → **Duyệt** (thử thêm Từ chối có lý do) | Phục vụ nhận thông báo; từ chối thì phục vụ thấy lý do và đăng ký lại được | [ ] | |
| H12 | Quản lý → Cấu hình hệ thống → **Chấm công** → nhập một IP khác IP máy → Lưu; phục vụ thử Vào ca | Báo "Bạn cần kết nối WiFi của quán"; bấm **Thêm IP hiện tại** rồi Lưu thì chấm được | [ ] | |
| H13 | Phục vụ (đang có ca) → **Vào ca bằng khuôn mặt** | Lưu giờ vào; vào sau giờ bắt đầu ca thì ghi "Đi trễ n phút"; người khác đứng trước camera → "Khuôn mặt không khớp" | [ ] | |
| H14 | **Tan ca bằng khuôn mặt** | Lưu giờ ra; về trước giờ kết thúc ca ghi "Về sớm n phút" | [ ] | |
| H15 | Thu ngân → Văn phòng → **Chấm công** | Dòng nguồn "Khuôn mặt", có Trễ / Về sớm; bấm biểu tượng camera xem ảnh vào / tan ca kèm độ lệch | [ ] | |
| H16 | Tab **Tôi** → Ca làm / Lịch sử / Phiếu lương / Hồ sơ | Ca theo tuần có khu; lịch sử theo tháng xem được ảnh; phiếu lương kỳ đã chốt in được; sửa email / SĐT được | [ ] | |
| H17 | Thu ngân bấm **Chấm công** trên thanh trên; Bếp bấm tab **Chấm công** | Cùng trang "Thông tin của tôi" như phục vụ | [ ] | |
| H18 | Quản lý → Quản lý ca làm → lọc Nhân viên phục vụ → bấm ô ca hôm nay → đổi khu | Ô ca hiện khu mới; phục vụ thấy khu mặc định đổi trên sơ đồ | [ ] | |

---

**Gửi kết quả:** chỉ cần gửi các dòng **không đạt** (mã dòng + ghi chú / ảnh), hoặc yêu cầu đổi chức năng / giao diện —
mỗi yêu cầu sẽ được đánh giá lợi / hại / ảnh hưởng trước khi sửa.
