# Kịch bản test bằng mắt theo từng trang – RMS (Royal Beef)

**Cách dùng:** test **xong hẳn một trang rồi mới sang trang khác**. Mỗi trang liệt kê mọi thứ cần kiểm trên trang đó:
hiển thị, từng nút / ô / bộ lọc, trường hợp nhập sai, trạng thái rỗng, giao diện điện thoại / chế độ tối.
Dòng **"Liên quan"** cuối mỗi trang ghi những trang dùng chung dữ liệu: trang đó lỗi thì xem lại các trang này,
xem lỗi có lan sang không.

Phần API (dữ liệu trả về, kiểm tra ô nhập ở máy chủ, phân quyền, tính tiền / lương) đã có bộ kiểm thử tự động `tests/`,
**không lặp lại ở đây**. Ở đây chỉ kiểm cái người dùng nhìn thấy và bấm.

Ghi kết quả: đạt thì `[x]`, không đạt thì ghi vào cột *Ghi chú* (thiết bị, ảnh chụp). Gửi lại các dòng không đạt kèm mã dòng.

**Phiếu bấm trên trình duyệt:** mở [phieu-test.html](phieu-test.html) (nhấp đúp), bấm Đạt / Lỗi và ghi chú từng dòng.
Kết quả chỉ nằm trong trình duyệt đang dùng, nên cuối mỗi buổi bấm **Lưu kết quả** rồi cất file JSON vào [ket-qua/](ket-qua/).
Đổi tài khoản Chrome, đổi máy hoặc chia nhau test thì bấm **Mở kết quả**, chọn file JSON (hoặc các file CSV đã xuất).
Nội dung phiếu dựng từ file này: sửa kịch bản ở đây thì nhớ cập nhật phiếu.

---

## 0. Chuẩn bị

### Chạy hệ thống trên CSDL test

| Cách chạy | Lệnh |
|---|---|
| Thường dùng | `dev-test.bat` (hoặc `.\dev.ps1 -Test`): CSDL **`rms_test`**, ảnh tải lên vào `backend\uploads-test` |
| Làm lại từ đầu | `dev-test-reset.bat` (hoặc `.\dev.ps1 -ResetTest`): xóa sạch `rms_test` + ảnh test, nạp lại dữ liệu mẫu |

CSDL thật `rms_db` không bị đổi. Mã QR của bàn trong `rms_test` lấy ở Quản lý → Sơ đồ bàn → bấm bàn → **Mã QR**.

### Tài khoản mẫu (mật khẩu chung `Rms@2026`)

| Vai trò | Tài khoản |
|---|---|
| Quản lý nhà hàng | `tuan.nguyen` |
| Thu ngân | `linh.tran`, `khoa.le` |
| Bếp | `hung.pham` |
| Kho | `thao.bui` |
| Phục vụ | `nam.hoang`, `vy.ngo` (Tầng 1), `phuc.do` (Tầng 2), `quynh.ly` (Sân vườn), `binh.vu` (Phòng VIP) |

### Không cần cho nhân viên vào ca

Từ 26/11/2026 không vai trò nào bị khóa vì chưa chấm công (bếp, phục vụ, thu ngân đều thao tác được ngay). Phục vụ: khu phụ trách lấy theo **lịch ca** — muốn thử chia khu thì Quản lý xếp ca hôm nay có khu (trang 12).

### Lưu ý dữ liệu mẫu

- Bàn **T03, VIP01, SV01** đang có khách; **VIP01** đang yêu cầu thanh toán. Bàn trống để thử: **T05** (khu Sảnh chính, Tầng 1).
- *T-bone bò Úc 450g* tạm hết hôm nay. Có khoảng 2 tháng hóa đơn, chấm công từ đầu tháng trước, kỳ lương tháng trước đã chốt.
- Chỉ gửi món được trong giờ mở cửa. **Bắt buộc phục vụ xác nhận món** đang bật (Cấu hình → Gọi món tại bàn).
- Với mọi trang có bảng: kiểm thêm **phân trang** (10 dòng / trang, dòng "Hiển thị x–y trên z"), **trạng thái rỗng** khi lọc không ra gì,
  và **thu nhỏ cửa sổ** (bảng cuộn ngang, không vỡ). Không ghi lại ở từng trang cho đỡ dài.

---

# Phần 1. Chung cho mọi vai trò

## Trang 1. Màn hình chờ, tab trình duyệt

| # | Thao tác | Mong đợi | Đạt | Ghi chú |
|---|---|---|---|---|
| 1.1 | F12 → Network → Slow 3G → mở web | Màn hình chờ: thớt gỗ, miếng steak chín dần từ trái sang, khói bốc, dao nĩa vàng; chữ "Chờ chút, món ngon sắp lên…" | [ ] | |
| 1.2 | Như trên, ở cỡ điện thoại và chế độ tối | Hình co vừa màn hình, không tràn; bản tối nền nâu than | [ ] | |
| 1.3 | Bỏ giả lập mạng chậm, mở lại | Tải nhanh thì không thấy màn hình chờ, không nháy trắng | [ ] | |
| 1.4 | Nhìn tab trình duyệt (Ctrl+F5 nếu chưa đổi) | Tiêu đề "Royal Beef — Quản lý nhà hàng", biểu tượng đầu bò vàng trên nền đỏ rượu | [ ] | |

## Trang 2. Đăng nhập (`/dang-nhap`)

| # | Thao tác | Mong đợi | Đạt | Ghi chú |
|---|---|---|---|---|
| 2.1 | Mở trang | Ô Tên đăng nhập, Mật khẩu (có nút hiện / ẩn), nút Đăng nhập; giao diện gọn trên điện thoại | [ ] | |
| 2.2 | Bấm Đăng nhập khi để trống | Báo lỗi tại ô, không gửi | [ ] | |
| 2.3 | Sai mật khẩu vài lần | Thông báo lỗi rõ; sai nhiều lần thì báo bị khóa tạm | [ ] | |
| 2.4 | Đăng nhập lần lượt từng vai trò | Vào đúng trang đầu: Quản lý `/quan-ly`, Thu ngân `/thu-ngan`, Bếp `/bep`, Kho `/kho`, Phục vụ `/phuc-vu` | [ ] | |
| 2.5 | Chưa đăng nhập, mở thẳng một trang bên trong (vd. `/quan-ly/mon-an`) | Về trang đăng nhập; đăng nhập xong quay lại đúng trang đó | [ ] | |
| 2.6 | Đã đăng nhập, gõ đường dẫn của vai trò khác (Bếp mở `/thu-ngan`) | Bị chuyển về trang của mình | [ ] | |
| 2.7 | Bấm Enter trong ô mật khẩu | Đăng nhập luôn | [ ] | |

## Trang 3. Khung chung: thanh trên, menu, đổi mật khẩu

| # | Thao tác | Mong đợi | Đạt | Ghi chú |
|---|---|---|---|---|
| 3.1 | Menu trái (Quản lý, Kho) | Mục đang mở được tô; menu con mở / đóng; thu gọn menu được | [ ] | |
| 3.2 | Ô tìm kiếm đầu trang / **Ctrl+K** | Gợi ý đúng các trang của vai trò đó; Enter mở trang; Esc đóng | [ ] | |
| 3.3 | Menu tài khoản góc phải → **Đổi mật khẩu**: nhập mật khẩu mới không khớp; rồi đúng | Báo không khớp; đổi xong đăng nhập lại bằng mật khẩu mới được | [ ] | |
| 3.4 | Tài khoản mới tạo đăng nhập lần đầu | Bị đưa tới trang **Đổi mật khẩu** bắt buộc, không đi trang khác được | [ ] | |
| 3.5 | Bật / tắt chế độ tối | Chữ, bảng, hộp thoại, biểu đồ đọc rõ; mã QR vẫn nền trắng; tải lại vẫn giữ | [ ] | |
| 3.6 | Thu nhỏ cửa sổ / máy tính bảng | Menu thu gọn thành nút, không vỡ bố cục | [ ] | |
| 3.7 | Đăng xuất | Về trang đăng nhập; bấm Back không vào lại được | [ ] | |
| 3.8 | Để yên quá 2 giờ rồi thao tác | Hết phiên, về trang đăng nhập | [ ] | |

## Trang 4. Thông báo (chuông + trang Thông báo của mỗi vai trò)

| # | Thao tác | Mong đợi | Đạt | Ghi chú |
|---|---|---|---|---|
| 4.1 | Chuông khi có thông báo mới | Số chưa đọc đúng; bấm chuông mở danh sách gọn | [ ] | |
| 4.2 | Bấm một thông báo | Mở đúng trang, dòng liên quan **sáng nhấp nháy** vài giây; thông báo thành Đã đọc | [ ] | |
| 4.3 | Trang Thông báo: lọc Chưa đọc / Đã đọc, đánh dấu đã đọc tất cả | Lọc đúng; số trên chuông về 0 | [ ] | |
| 4.4 | Thông báo trỏ tới dữ liệu đã bị xóa | Báo nội dung không còn tồn tại, không vỡ trang | [ ] | |

**Liên quan:** mọi trang có tạo thông báo (đặt bàn, kho, kiểm kê, yêu cầu khách, bếp hủy món, khuôn mặt).

---

# Phần 2. Quản lý nhà hàng (`tuan.nguyen`)

## Trang 5. Dashboard (`/quan-ly`)

| # | Thao tác | Mong đợi | Đạt | Ghi chú |
|---|---|---|---|---|
| 5.1 | Mở trang | Từ trên xuống: 4 thẻ số (Doanh thu, Số đơn đã thanh toán, Trung bình mỗi đơn, Số khách) → Doanh thu theo thời gian + Cơ cấu doanh thu → Giờ đông khách + Món bán chạy → Món đang lên / đang xuống + Kho cần chú ý. Không có chỗ trống lạ | [ ] | |
| 5.2 | Đổi khoảng thời gian ở **góc trên phải** (Hôm nay / Hôm qua / 7 ngày / 30 ngày / Tháng này / Tháng trước) | **Cả trang** đổi theo. Lúc chờ, số cũ mờ đi rồi số chạy sang số mới, không nháy trắng | [ ] | |
| 5.3 | Xem 4 thẻ số | Mỗi thẻ có nhãn % xanh (tăng) / đỏ (giảm) và dòng "so với hôm qua / 7 ngày trước đó…" (máy tính); kỳ trước bằng 0 thì ghi "Kỳ trước chưa có". Số khách ít hơn số đơn thì có dòng "Chỉ đếm bàn có ghi số khách lúc mở bàn" | [ ] | |
| 5.4 | Bật **So sánh kỳ trước**, rê chuột lên biểu đồ doanh thu | Có thêm đường nét đứt "Kỳ trước"; hiện số tiền của mốc đó, định dạng đúng | [ ] | |
| 5.5 | Cơ cấu doanh thu: đổi **Theo danh mục / Theo cách trả tiền** | Vòng tròn tối đa 5 phần + "Khác", tổng ở giữa; danh sách bên dưới có số tiền và %; cộng lại bằng doanh thu | [ ] | |
| 5.6 | Giờ đông khách: đổi **Số đơn / Số khách** | Cột giờ đông nhất tô đậm; dòng mô tả "Đông nhất 19:00–20:00 · x% đơn" | [ ] | |
| 5.7 | Món bán chạy: tab Bán chạy / Bán chậm, lọc **Món ăn** (mặc định) / Đồ uống / Tất cả | Tối đa 5 món, có ảnh nhỏ, số phần, doanh thu, thanh tỷ lệ; Bán chậm có món "Chưa bán". Không có nút Sửa | [ ] | |
| 5.8 | Món đang lên / đang xuống | 3 món tăng mạnh nhất, 3 món giảm mạnh nhất so với kỳ trước (số phần cũ → mới, %); món mới bán ghi "Mới bán" | [ ] | |
| 5.9 | Kho cần chú ý | Số nguyên liệu cần nhập thêm, phiếu chờ nhận, nợ nhà cung cấp + 3 nguyên liệu sắp hết; bấm "Xem công nợ nhà cung cấp" sang trang Công nợ | [ ] | |
| 5.10 | Chọn kỳ chưa có hóa đơn nào (vd. Hôm nay lúc sáng sớm trên dữ liệu mới) | 4 thẻ hiện 0, có ô "Kỳ này chưa có hóa đơn nào được thanh toán"; khối Kho vẫn hiện | [ ] | |
| 5.11 | Điện thoại (rộng ~390px) | 4 thẻ số xếp 2 × 2, các khối xếp dọc, không tràn ngang | [ ] | |

**Liên quan:** Hóa đơn (40), trang Kho (20–27).

## Trang 6. Đặt bàn → Lịch sử (`/quan-ly/dat-ban/lich-su`)

| # | Thao tác | Mong đợi | Đạt | Ghi chú |
|---|---|---|---|---|
| 6.1 | Mở trang | Thẻ tóm tắt: Lịch đặt hôm nay, Khách dự kiến hôm nay, Chờ xác nhận; bảng: Mã đặt, Khách hàng, Thời gian, Số khách, Khu vực / Bàn, Trạng thái | [ ] | |
| 6.2 | Lọc theo ngày, trạng thái, khu vực; tìm; **Xóa bộ lọc** | Kết quả đúng; xóa bộ lọc về mặc định | [ ] | |
| 6.3 | Thêm lịch tại quầy: để trống, SĐT sai → Lưu; rồi điền đúng | Lỗi dưới từng ô; lưu xong lịch xuất hiện trong bảng | [ ] | |
| 6.4 | Xếp bàn cho lịch; chọn bàn đã có lịch trùng giờ | Xếp được; trùng giờ thì báo, không cho lưu | [ ] | |
| 6.5 | Đổi trạng thái: Xác nhận → Khách đến; một lịch khác → Hủy | Trạng thái đổi màu đúng; số ở thẻ tóm tắt cập nhật | [ ] | |
| 6.6 | Mở chi tiết một lịch | Đủ thông tin, ghi chú, "Cập nhật lần cuối" | [ ] | |
| 6.7 | Lịch đặt từ website (trang 49) | Có trong bảng, phân biệt được là lịch online | [ ] | |

**Liên quan:** Sơ đồ bàn thu ngân (36, bàn tím), Đặt bàn website (46.13, 49), Thông báo (4).

## Trang 7. Đặt bàn → Cập nhật form (`/quan-ly/dat-ban/cap-nhat`)

| # | Thao tác | Mong đợi | Đạt | Ghi chú |
|---|---|---|---|---|
| 7.1 | Mở trang | Nhóm "Khung giờ & thời lượng", "Trường thông tin & xử lý", "Lưu ý hiển thị cho khách", khung **Xem trước form của khách** | [ ] | |
| 7.2 | Đổi Bước chọn giờ, thời lượng; bật / tắt Bắt buộc email, Cho phép ghi chú, Cho phép chọn khu vực, Tự động xác nhận | Khung xem trước đổi ngay | [ ] | |
| 7.3 | Lưu → mở trang Đặt bàn website (49) | Form của khách đúng cấu hình vừa lưu | [ ] | |

**Liên quan:** Đặt bàn website (49).

## Trang 8. Sơ đồ bàn (`/quan-ly/khu-vuc-ban`)

| # | Thao tác | Mong đợi | Đạt | Ghi chú |
|---|---|---|---|---|
| 8.1 | Mở trang (menu trái **Sơ đồ bàn**, một mục) | Chọn tầng ở đầu trang (Tầng 1 · Tầng 2, kèm số bàn); 3 kiểu xem: Xem trực tiếp · Sửa sơ đồ · Danh sách bàn | [ ] | |
| 8.2 | **Xem trực tiếp** Tầng 1, Tầng 2 | Vẽ cả tầng: tường ngoài, vách trong, hàng rào, vùng khu tô gạch chéo có tên; bàn cùng màu / cùng kiểu với thu ngân (đã ngồi bao lâu, giờ đặt, tạm tính); chú thích màu có số đếm. Bấm bàn → khung phải: khu, khách / ghế, đơn, đặt trước, nút Sửa thông tin, Mã QR | [ ] | |
| 8.3 | **Thêm tầng** (để trống tên, kích thước 3 ô; đúng); ⋯ → Đổi tên, kích thước; thu nhỏ làm mất bàn; Xóa tầng còn khu | Lỗi tại ô; tầng mới có sẵn tường ngoài; thu nhỏ quá bị chặn; tầng còn khu không xóa được | [ ] | |
| 8.4 | **Thêm khu vực** (chọn tầng; trùng tên); sửa khu đang có bàn sang tầng khác | Thêm được; khu còn bàn không chuyển tầng được | [ ] | |
| 8.5 | **Sửa sơ đồ** → Chọn & kéo: kéo bàn sang ô trống; kéo vào ô đã có bàn; kéo bàn vào vùng khu khác | Ô đích tô xanh / đỏ; trùng ô báo "Ô này đã có bàn …"; bàn kéo vào vùng khu khác thì đổi khu (khung "Đang chọn" ghi "sẽ đổi khi lưu") | [ ] | |
| 8.6 | **Vẽ tường** (Tường ngoài / Vách trong / Hàng rào): kéo ngang, dọc; bấm đoạn tường → đổi loại, Xóa (hoặc phím Delete) | Tường luôn thẳng; đổi loại / xóa được | [ ] | |
| 8.7 | **Vẽ vùng khu**: chọn khu → kéo khoanh vùng; vẽ chồng lên khu khác; Xóa vùng | Vùng hiện tên khu; chồng vùng bị báo; bàn trong vùng mới thuộc khu đó | [ ] | |
| 8.8 | Hoàn tác / Làm lại (nút hoặc Ctrl+Z / Ctrl+Y); thanh dưới đáy **Hủy thay đổi** / **Lưu**; đổi tầng / kiểu xem / trang khi chưa lưu | Thanh ghi "Chưa có thay đổi trên sơ đồ" / "Có thay đổi chưa lưu"; rời đi khi chưa lưu thì hỏi; Lưu xong tải lại vẫn giữ; thu ngân / phục vụ thấy sơ đồ mới | [ ] | |
| 8.9 | **Thêm bàn** (đầu trang hoặc khung trái): mã, số ghế, hình dạng | Bàn vào ô trống trong vùng của khu, đúng hình, số ghế | [ ] | |
| 8.10 | **Danh sách bàn**: bảng khu vực (số bàn, vùng trên sơ đồ, trạng thái, Sửa · ⋯ Xóa) và bảng bàn (Sửa · ⋯ Mã QR, Xóa); sửa bàn → Tạm ngưng | Bàn tạm ngưng sọc xám trên sơ đồ thu ngân / phục vụ; QR bàn đó báo tạm ngừng | [ ] | |
| 8.11 | **Mã QR gọi món** → Sao chép đường dẫn, In | Bản in có mã QR + tên bàn; quét bằng điện thoại mở đúng bàn | [ ] | |
| 8.12 | Xóa bàn / khu đang có khách hoặc có lịch đặt | Bị chặn, có giải thích, không mất đơn đang mở | [ ] | |

**Liên quan:** Sơ đồ thu ngân (36, xem từng khu — khung cắt quanh vùng khu, có tường), Sơ đồ phục vụ (31, có thông báo "sơ đồ thay đổi"), Trang QR (44).

## Trang 9. Thực đơn – tab Món ăn, Danh mục, Nhóm món (`/quan-ly/mon-an`, `/danh-muc`, `/nhom-mon`)

| # | Thao tác | Mong đợi | Đạt | Ghi chú |
|---|---|---|---|---|
| 9.1 | Mở menu trái **Thực đơn** | Một mục duy nhất (không còn "Danh sách / Thêm món ăn"). Trang "Thực đơn" có 4 tab Món ăn · Set menu · Danh mục · Nhóm món; nút chính "Thêm …" luôn ở góc phải, đổi chữ theo tab. Đường dẫn trên cùng: Trang chủ › Thực đơn › tên tab | [ ] | |
| 9.2 | Tab Món ăn: tìm theo tên / mã (có / không dấu); bấm **+ Lọc** → Danh mục / Trạng thái | Kết quả đúng; mỗi điều kiện là một chip "Trạng thái là Ngừng bán ×", có "Xóa lọc". Lọc không ra món nào: ô "Không có món phù hợp · n món đang bị ẩn bởi bộ lọc · Xóa lọc" | [ ] | |
| 9.3 | Mỗi dòng: nút **Sửa** + nút **⋯** | ⋯ mở menu có chữ: Xem chi tiết · Ngừng bán (hoặc Mở bán lại) · Xóa món (đỏ, nằm cuối). Bấm tên / ảnh món cũng mở chi tiết | [ ] | |
| 9.4 | ⋯ → Xóa món (món đã bán / món chưa bán) | Món đã có trong hóa đơn: "Không xóa được …" + nút Ngừng bán; món chưa bán: "Xóa rồi sẽ mất hẳn" | [ ] | |
| 9.5 | Tab **Danh mục**: Thêm danh mục có ảnh; Sửa; bật / tắt trên dòng; bỏ ảnh | Hộp nhỏ: tên + ảnh, dòng gợi ý chữ nhỏ dưới ô ảnh. Trang khách có vòng tròn mới; bỏ ảnh thì hiện chữ cái đầu; tắt danh mục không mất ảnh | [ ] | |
| 9.6 | Tab **Nhóm món**: Thêm nhóm "Trà các loại" (Đồ uống, ảnh); Sửa; ⋯ → Xóa nhóm | Danh sách cập nhật; xóa nhóm thì các món trở lại đứng riêng, không mất món | [ ] | |
| 9.7 | Ctrl+K gõ "set" / "danh mục" | Có Set menu, Danh mục món, Nhóm món, "Thêm set menu" (mở thẳng trang thêm set) | [ ] | |

**Liên quan:** Thêm / sửa món (10), Trang QR (44), Website thực đơn (48), Chatbot thực đơn (16).

## Trang 10. Thêm / sửa món (`/quan-ly/mon-an/them`, `/:id/sua`)

| # | Thao tác | Mong đợi | Đạt | Ghi chú |
|---|---|---|---|---|
| 10.1 | Mở form (Thêm món / Sửa ở một dòng) | Đường dẫn Thực đơn › Món ăn › Sửa (bấm được); tiêu đề là tên món; nút **Quay lại** có viền ở góc phải. **Chỉ một nút Lưu**, ở thanh dính đáy, hiện ngay khi mở trang ("Chưa có thay đổi", nút Lưu mờ). Nhóm Thông tin cơ bản, Ảnh món ăn, Trạng thái bán, Dữ liệu cho AI tư vấn | [ ] | |
| 10.2 | Bấm Lưu khi để trống tên / giá / danh mục | Lỗi tại từng ô; thanh dưới đáy ghi "Còn n chỗ chưa đúng" | [ ] | |
| 10.3 | Tải ảnh (đúng / sai định dạng, ảnh quá lớn) | Xem trước ảnh; sai thì báo | [ ] | |
| 10.4 | Chọn **Nhóm hiển thị** khác danh mục với món | Báo nhóm phải cùng danh mục | [ ] | |
| 10.5 | Gắn món vào nhóm, **Tên loại trong nhóm** = "Trà đào" → Lưu | Trang khách: món nằm trong thẻ nhóm, bảng chọn ghi "Trà đào" | [ ] | |
| 10.6 | Chọn Mức cay, dị nguyên, thành phần chính | Trang khách hiện đúng nhãn cay / dị nguyên trong chi tiết món | [ ] | |
| 10.7 | Chuyển **Ngừng bán** → Lưu | Món biến mất khỏi trang khách và website; vẫn còn trong lịch sử đơn | [ ] | |
| 10.8 | Sửa một ô | Thanh dưới đáy đổi thành "Có thay đổi chưa lưu · Hủy thay đổi · Lưu"; Hủy thay đổi trả lại như cũ; Lưu được, về danh sách, không bị hỏi | [ ] | |
| 10.9 | Sửa dở rồi rời trang bằng **Quay lại**, **menu trái**, **Ctrl+K**, đường dẫn trên cùng, nút Back trình duyệt; tải lại / đóng tab | Lần nào cũng hỏi "Bỏ các thay đổi chưa lưu?" (Ở lại / Bỏ thay đổi); tải lại / đóng tab thì trình duyệt tự hỏi. Chưa sửa gì thì đi luôn | [ ] | |

**Liên quan:** Trang QR (44), Website (48), Công thức (30), Set menu (11).

## Trang 11. Thực đơn – tab Set menu, thêm / sửa set (`/quan-ly/mon-an/set-menu`, `/set-menu/them`, `/set-menu/:id/sua`)

| # | Thao tác | Mong đợi | Đạt | Ghi chú |
|---|---|---|---|---|
| 11.1 | Mở tab Set menu | Danh sách (không còn thẻ to): ảnh nhỏ · tên · "n món" (bấm mở xem món × số lượng, món ngừng bán tô đỏ) · giá set, giá gốc gạch, -x% · giờ bán · trạng thái (Trên thực đơn / Chỉ AI gợi ý / Đang tắt) · Sửa / ⋯ | [ ] | |
| 11.2 | **Thêm set** | Mở trang riêng (Thực đơn › Set menu › Thêm mới), nút Quay lại góc phải, một nút Lưu ở thanh dưới đáy. Nhập tên, mô tả, giá, giờ bán (Cả ngày / Giới hạn giờ), ảnh, chọn món + số lượng; thanh dưới đáy luôn ghi "n món · giá gốc … · khách tiết kiệm … (x%)" | [ ] | |
| 11.3 | Sửa một set | Món đang có trong set nằm đầu danh sách chọn món | [ ] | |
| 11.4 | Lưu khi ít hơn 2 món, thiếu giá mà bật Bán trên thực đơn, giờ kết thúc trước giờ bắt đầu, tên trùng | Báo lỗi tại ô tương ứng (lỗi chọn món hiện ngay trên khung danh sách) | [ ] | |
| 11.5 | Bật **Đổi loại** cho món nước ngọt | Trang khách: set cho chọn loại nước | [ ] | |
| 11.6 | ⋯ → **Tắt set** rồi **Bật lại set**; tắt "Bán trên thực đơn" trong trang sửa | Trạng thái đổi ngay; set biến mất / hiện lại ở khung Set menu trang khách | [ ] | |
| 11.7 | ⋯ → **Xóa set** | Hỏi lại; đơn cũ có set vẫn hiện đúng ở hóa đơn | [ ] | |
| 11.8 | Sửa dở rồi rời trang (Quay lại, menu trái, Ctrl+K…) | Hỏi "Bỏ các thay đổi chưa lưu?" | [ ] | |

**Liên quan:** Trang QR khung Set (44), Hóa đơn (40), Chatbot (16), Website thực đơn (48).

## Trang 12. Quản lý ca làm (`/quan-ly/nhan-vien/ca-lam`)

| # | Thao tác | Mong đợi | Đạt | Ghi chú |
|---|---|---|---|---|
| 12.1 | Tab danh sách ca: thêm ca (tên, giờ, màu, ngày trong tuần); ca qua đêm | Lưu được; ca qua đêm hiện đúng số giờ | [ ] | |
| 12.2 | Xóa ca đang có phân công | Hỏi lại / báo ảnh hưởng | [ ] | |
| 12.3 | Lịch phân công **Theo ca** (mặc định): Tuần trước / Tuần này / Tuần sau | Hàng = ca, cột = ngày, có đường kẻ dọc giữa các ngày; cột hôm nay ghi "Hôm nay", tô nền nhạt. Người chia theo bộ phận trong khung nhỏ có vạch màu (Phục vụ xanh lá, Bếp đỏ, Thu ngân xanh dương, Kho nâu); phục vụ kèm khu ("chưa gán khu" nếu chưa) | [ ] | |
| 12.4 | Phân công: chọn nhân viên + ca + ngày; phân trùng giờ | Lưu được; trùng thì báo | [ ] | |
| 12.5 | Bấm tên phục vụ trong ô → **Đổi khu vực phụ trách** (hoặc "Không gán khu") | Ô cập nhật; phục vụ thấy khu mặc định đổi | [ ] | |
| 12.6 | Lọc theo bộ phận; chuyển kiểu xem **Theo nhân viên** | Lọc đúng. Chú thích ca nằm trên thanh công cụ (chip màu: tên + giờ); trong ô ghi luôn tên ca + giờ ngắn (vd. "Ca sáng 6–14") | [ ] | |
| 12.7 | Xem đầu mỗi ô (Theo ca) | Chip tóm tắt "PV 3 · Bếp 2 · TN 1" (có Kho / QL nếu có người). Ca hôm nay / sau này chưa có ai ở Phục vụ, Bếp hoặc Thu ngân thì chip bộ phận đó **đỏ** (vd. "Bếp 0"); ngày đã qua không tô đỏ | [ ] | |
| 12.8 | Ô có hơn 4 người | Hiện 3 người + "+n người"; bấm mở bảng đủ danh sách (đổi khu / hủy phân công ngay trong bảng được) | [ ] | |
| 12.9 | Cuộn lịch xuống / sang phải (cả hai kiểu xem) | Dòng ngày dính trên cùng, cột tên ca / tên nhân viên dính bên trái; trang không bị cuộn hai lớp | [ ] | |

**Liên quan:** Phục vụ (31, 33), Thông tin của tôi (43), Chấm công (41, trễ / sớm theo ca).

## Trang 13. Khuôn mặt chấm công (`/quan-ly/nhan-vien/khuon-mat`)

| # | Thao tác | Mong đợi | Đạt | Ghi chú |
|---|---|---|---|---|
| 13.1 | Mở trang | Danh sách đăng ký: ảnh, người, trạng thái, dòng "Đã đồng ý thu thập dữ liệu khuôn mặt" | [ ] | |
| 13.2 | **Xem ảnh lớn** | Mở ảnh to, đóng được | [ ] | |
| 13.3 | **Duyệt** | Trạng thái đổi; nhân viên nhận thông báo, chấm công được | [ ] | |
| 13.4 | **Từ chối** không nhập lý do; có lý do | Bắt nhập lý do; nhân viên thấy lý do | [ ] | |
| 13.5 | **Yêu cầu đăng ký lại** | Hỏi lại, nói rõ dữ liệu cũ bị xóa; nhân viên phải đăng ký lại | [ ] | |

**Liên quan:** Thông tin của tôi (43), Cấu hình → Chấm công (18).

## Trang 14. Bài viết (`/quan-ly/bai-viet`)

| # | Thao tác | Mong đợi | Đạt | Ghi chú |
|---|---|---|---|---|
| 14.1 | Danh sách: tìm, lọc chuyên mục | Đúng kết quả | [ ] | |
| 14.2 | Thêm bài: tiêu đề, chuyên mục, tóm tắt, ảnh bìa, nội dung; Lưu nháp / Xuất bản | Lưu được, trạng thái đúng | [ ] | |
| 14.3 | Sửa, xóa bài | Hỏi lại khi xóa | [ ] | |

## Trang 15. Tài khoản (`/quan-ly/tai-khoan`)

| # | Thao tác | Mong đợi | Đạt | Ghi chú |
|---|---|---|---|---|
| 15.1 | Danh sách: tìm theo tên / email / SĐT, lọc vai trò, trạng thái | Đúng; dòng của mình ghi "(bạn)" | [ ] | |
| 15.2 | Thêm tài khoản (có vai trò Phục vụ) | Hiện mật khẩu tạm để đưa nhân viên; tài khoản mới phải đổi mật khẩu lần đầu | [ ] | |
| 15.3 | Sửa tài khoản của chính mình | Không đổi được vai trò của mình (có ghi chú) | [ ] | |
| 15.4 | **Đặt lại mật khẩu** | Hiện mật khẩu tạm mới | [ ] | |
| 15.5 | **Khóa** tài khoản đang đăng nhập ở cửa sổ khác | Cửa sổ kia bị đăng xuất ở thao tác kế tiếp; **Mở khóa** dùng lại được | [ ] | |
| 15.6 | **Xóa tài khoản** | Hỏi lại; không xóa được chính mình | [ ] | |

**Liên quan:** Đăng nhập (2), Ca làm (12), Nhật ký (17).

## Trang 16. Chatbot AI (`/quan-ly/chatbot`)

| # | Thao tác | Mong đợi | Đạt | Ghi chú |
|---|---|---|---|---|
| 16.1 | Tab **Cấu hình**: bật / tắt Chatbot, tên trợ lý, avatar, câu chào, gợi ý nhanh, cảnh báo dị ứng, tone giọng | Khung **Xem trước khung chat** đổi ngay; Hoàn tác về như cũ; Lưu xong trợ lý trang QR (45) đổi theo | [ ] | |
| 16.2 | Tab **Thực đơn**: bật / tắt "AI gợi ý" từng món, gắn **Thẻ AI**; Đồng bộ thực đơn | Món tắt không được trợ lý gợi ý; tóm tắt **Set menu (AI gợi ý)** + link Quản lý set | [ ] | |
| 16.3 | Tab **FAQ**: thêm, sửa, tắt, xóa; tìm; lọc danh mục | Trợ lý trả lời theo FAQ đang áp dụng; FAQ tắt không dùng | [ ] | |
| 16.4 | **Câu hỏi chưa giải đáp**: bấm một câu → tạo FAQ; Bỏ qua | Câu chuyển thành FAQ / biến mất khỏi danh sách | [ ] | |
| 16.5 | Tab Hội thoại / thống kê | Hiện được, không lỗi (số liệu có phần là dữ liệu mẫu) | [ ] | |

**Liên quan:** Trợ lý trang QR (45), Món ăn (10).

## Trang 17. Nhật ký (`/quan-ly/nhat-ky`)

| # | Thao tác | Mong đợi | Đạt | Ghi chú |
|---|---|---|---|---|
| 17.1 | Lọc phân hệ, tài khoản, khoảng ngày; tìm; Xóa lọc | Đúng kết quả | [ ] | |
| 17.2 | Sau một buổi test, tìm các thao tác vừa làm | Có dòng cho hủy món, chuyển / ghép bàn, lập / hủy hóa đơn, xác nhận / bỏ món, duyệt khuôn mặt, nhập chấm công… đúng người, đúng giờ | [ ] | |
| 17.3 | **Xuất CSV** | Tải file mở được bằng Excel, tiếng Việt không lỗi font | [ ] | |

## Trang 18. Cấu hình hệ thống (`/quan-ly/cai-dat`)

| # | Thao tác | Mong đợi | Đạt | Ghi chú |
|---|---|---|---|---|
| 18.1 | Mở trang | Cột trái "Cấu hình" chia nhóm: Nhà hàng (Thông tin, Giờ hoạt động, Thanh toán) · Vận hành (Gọi món tại bàn, Chấm công) · Khách hàng (Website) · Hệ thống (Sao lưu & phục hồi, Nhật ký hoạt động ↗). Mỗi cài đặt một dòng: tên + mô tả bên trái, ô nhập / công tắc bên phải. Đường dẫn: Trang chủ › Cấu hình hệ thống › tên mục | [ ] | |
| 18.2 | Gõ vào ô **Tìm cài đặt** (vd. "wifi", "ngân hàng", "ảnh bìa") | Cột trái chỉ còn mục chứa cài đặt đó; không có thì ghi "Không có cài đặt phù hợp" | [ ] | |
| 18.3 | **Thông tin**: sửa tên, địa chỉ, SĐT; tải logo, ảnh bìa trang gọi món → Lưu | Hóa đơn in, website, trang QR dùng thông tin mới | [ ] | |
| 18.4 | **Giờ hoạt động**: đổi giờ, tắt công tắc một ngày (Nghỉ cả ngày) → Lưu | Trang QR chặn gửi món ngoài giờ; website đặt bàn bỏ ngày nghỉ | [ ] | |
| 18.5 | **Thanh toán**: chọn ngân hàng, số tài khoản sai → Lưu; đúng → Lưu; "Bỏ tài khoản" | Lỗi tại dòng; khung "Đang dùng trên hóa đơn" đổi theo; Bỏ tài khoản có hỏi lại; hóa đơn mới dùng tài khoản mới | [ ] | |
| 18.6 | **Gọi món tại bàn**: tự đóng bàn (phút), phục vụ xác nhận món (công tắc), nhắc lại (phút) | Tắt xác nhận thì món khách gửi xuống bếp thẳng (dòng "Nhắc lại" ẩn); bàn mở không gọi món tự đóng đúng thời gian | [ ] | |
| 18.7 | **Chấm công**: mạng của quán + **Thêm IP hiện tại**, vào ca sớm tối đa, độ chặt so khuôn mặt, giữ ảnh | Lưu được; dòng "Máy bạn đang dùng IP …" đúng; link "Duyệt khuôn mặt nhân viên" mở đúng trang | [ ] | |
| 18.8 | **Website** (mỗi cài đặt một dòng, theo thứ tự các mục trang chủ): Đầu trang (khẩu hiệu, danh hiệu, ảnh — nhận ảnh lớn tới 15 MB) · **Món đặc trưng** và **Trải nghiệm** (Thêm / sửa / ẩn hiện / đổi thứ tự / xóa, tối đa 8, để trống tên thì lỗi tại ô) · Không gian – album · Câu chuyện · **Lời từ bếp trưởng** (tên, chức danh, lá thư, ảnh) · Đặt bàn (ảnh cạnh form) · Mạng xã hội & bản đồ · Thực đơn trên website; thanh **Lưu** dính đáy | Website (46–49) đổi theo ngay; lá thư trống thì ẩn mục bếp trưởng; có lá thư mà thiếu tên thì lỗi tại ô tên; món tắt trên website vẫn còn ở trang QR | [ ] | |
| 18.9 | **Sao lưu & phục hồi**: Sao lưu ngay; mỗi bản: nút **Tải xuống** + ⋯ (Phục hồi từ bản này · Xóa bản sao lưu); lịch tự động (bao lâu một lần, giờ, giữ lại) → Lưu | Có file .zip; lịch lưu được; tắt "Tự động sao lưu" thì các dòng lịch mờ đi (phục hồi chỉ thử trên CSDL test) | [ ] | |
| 18.10 | Mọi mục có thanh dưới đáy | Mở mục: "Chưa có thay đổi", nút Lưu mờ; sửa: "Có thay đổi chưa lưu · Hủy thay đổi · Lưu"; Hủy thay đổi trả lại như cũ | [ ] | |
| 18.11 | Sửa dở rồi bấm mục khác ở cột trái / menu trái / Ctrl+K | Hỏi "Bỏ các thay đổi chưa lưu?"; Lưu xong thì đổi mục không hỏi | [ ] | |

## Trang 19. Duyệt kiểm kê, Công nợ (phía Quản lý)

| # | Thao tác | Mong đợi | Đạt | Ghi chú |
|---|---|---|---|---|
| 19.1 | **Kiểm kê** → mở phiếu chờ duyệt | Thấy dòng chênh lệch, giá trị tăng / giảm | [ ] | |
| 19.2 | **Duyệt** / **Từ chối** (phải nhập lý do) | Kho nhận thông báo; duyệt thì tồn điều chỉnh | [ ] | |
| 19.3 | **Công nợ** | Số khớp trang Công nợ bên Kho (27) | [ ] | |

**Liên quan:** Kiểm kê (26), Công nợ (27), Nguyên liệu (21).

---

# Phần 3. Quản lý kho (`thao.bui`)

## Trang 20. Dashboard kho (`/kho`)

| # | Thao tác | Mong đợi | Đạt | Ghi chú |
|---|---|---|---|---|
| 20.1 | Mở trang (thử cả menu ghim và thu gọn) | Giá trị tồn kho, công nợ phải trả, giá trị hao hụt, biểu đồ nhập / xuất theo ngày. Menu trái gọn: Nguyên liệu · Nhà cung cấp · Phiếu mua · Nhập kho · Xuất kho · Kiểm kê · Công nợ (không còn menu con) | [ ] | |
| 20.2 | Bảng **Nguyên liệu cần nhập**: tick 2–3 nguyên liệu (hoặc ô tick đầu bảng = chọn hết) → nút **Tạo phiếu mua (n)** ở đầu bảng | Chưa tick thì nút mờ; dòng đã tick tô nền; mở form phiếu mua có sẵn các nguyên liệu đó (xem 23.7) | [ ] | |
| 20.3 | **Phiếu mua chờ nhận** (trạng thái nằm dưới mã; Sắp đến hạn / Trễ hạn), **Phiếu kiểm kê cần chú ý**, **Hao hụt nhiều nhất** | Đúng dữ liệu; bấm dòng mở chi tiết; hai cột trên cao bằng nhau, khung bên phải không thừa khoảng trắng lớn | [ ] | |

## Trang 21. Nguyên liệu (`/kho/nguyen-lieu`)

| # | Thao tác | Mong đợi | Đạt | Ghi chú |
|---|---|---|---|---|
| 21.1 | Danh sách: tìm mã / tên; **+ Lọc** → Nhóm / Tình trạng tồn / Trạng thái; bấm × trên chip, **Xóa lọc** | Mỗi điều kiện là một chip; tình trạng Sắp hết / Hết tô màu; lọc không ra thì "Không có nguyên liệu phù hợp · Xóa lọc" | [ ] | |
| 21.2 | Mỗi dòng: nút **Sửa** + menu **⋯** (Xem chi tiết, Tạo phiếu mua, Ngừng / Sử dụng lại, Xóa nguyên liệu – chữ đỏ, nằm cuối) | Đúng việc; Xóa chỉ có khi nguyên liệu chưa có giao dịch | [ ] | |
| 21.3 | **Thêm nguyên liệu**: để trống; tên trùng; đúng (nhóm, đơn vị kho, tồn tối thiểu, tồn ban đầu) | Thanh dưới đáy luôn hiện ("Chưa nhập gì" → "Có thay đổi chưa lưu" / "Còn n chỗ chưa đúng"); lỗi tại ô; thêm được | [ ] | |
| 21.4 | Sửa nguyên liệu đã có giao dịch | Đơn vị kho bị khóa, có giải thích; khung "Tồn kho hiện tại" bên phải | [ ] | |
| 21.5 | Đang nhập dở → bấm **Quay lại** / menu trái / Ctrl+K / nút Back | Hỏi "Bỏ các thay đổi chưa lưu?" (Ở lại · Bỏ thay đổi); Lưu xong thì về danh sách không hỏi | [ ] | |
| 21.6 | Chi tiết: nhãn trạng thái cạnh tên; nút Quay lại · Sửa · **Tạo phiếu mua** · ⋯ (Ngừng / Sử dụng lại, Xóa); Thông tin chung, **Thẻ kho** (lọc ngày), Nhà cung cấp, **Món sử dụng** | Lịch sử biến động đúng thứ tự; món sử dụng khớp công thức bếp; Tạo phiếu mua mở form có sẵn nguyên liệu này | [ ] | |
| 21.7 | Xóa nguyên liệu đã có giao dịch | Không có mục Xóa / bị chặn có giải thích | [ ] | |

**Liên quan:** Công thức (30), Kiểm tra nguyên liệu (29), Phiếu mua (23).

## Trang 22. Nhà cung cấp (`/kho/nha-cung-cap`)

| # | Thao tác | Mong đợi | Đạt | Ghi chú |
|---|---|---|---|---|
| 22.1 | Danh sách: tìm mã / tên / SĐT; **+ Lọc** → Trạng thái; mỗi dòng **Sửa** + ⋯ (Xem chi tiết, Ngừng hoạt động / Kích hoạt lại, Xóa) | Đúng | [ ] | |
| 22.2 | Thêm NCC: tên trùng (hỏi lại), SĐT sai, thêm dòng nguyên liệu cung cấp (đơn vị mua, hệ số, giá, SL tối thiểu); rời trang khi chưa lưu | Lỗi tại ô; nút Lưu ở thanh dưới đáy; rời trang thì hỏi; lưu được | [ ] | |
| 22.3 | Chi tiết: bảng Nguyên liệu cung cấp mỗi dòng **Sửa giá** + ⋯ (Lịch sử giá nhập, Ngừng cung cấp / Kích hoạt lại); sửa giá một nguyên liệu (đổi lớn) | Hỏi "Giá nhập thay đổi lớn?"; có **Lịch sử giá nhập** | [ ] | |
| 22.4 | Đầu trang chi tiết: nhãn trạng thái cạnh tên; **Ngừng hoạt động** (⋯, chọn lý do); **Kích hoạt lại** (nút xanh) | Trạng thái đổi, lý do ngừng ghi ở dòng mô tả; lịch sử trạng thái ghi lại; NCC ngừng không chọn được khi tạo phiếu mua | [ ] | |
| 22.5 | Xóa NCC đã có phiếu mua | Không có mục Xóa / bị chặn | [ ] | |

## Trang 23. Phiếu mua (`/kho/phieu-mua`)

| # | Thao tác | Mong đợi | Đạt | Ghi chú |
|---|---|---|---|---|
| 23.1 | Danh sách: tìm; chọn ngày đặt; **+ Lọc** → Trạng thái / Thanh toán / Nhà cung cấp | Đúng; cột Phiếu mua = mã + tên phiếu; phiếu trễ hạn có nhãn **Trễ hạn** dưới ngày; bảng không cuộn ngang ở màn 1440 khi ghim menu | [ ] | |
| 23.2 | Nút chính mỗi dòng đổi theo trạng thái: Nháp → **Sửa**, chờ nhận → **Nhận hàng**, còn lại → **Xem**; ⋯ chứa Thanh toán, Kết thúc nhận hàng, Hủy phiếu, Xóa phiếu nháp | Đúng việc từng trạng thái | [ ] | |
| 23.3 | Tạo phiếu: thêm nguyên liệu khi chưa chọn NCC | Nhắc chọn NCC trước | [ ] | |
| 23.4 | Chọn NCC, thêm nguyên liệu, số lượng; giảm giá, thuế %, chi phí khác | Tạm tính, Tổng cộng tính đúng ngay; thanh dưới đáy hiện "Tổng cộng …" | [ ] | |
| 23.5 | Thanh dưới đáy: **Lưu nháp** (nút phụ) · **Đặt hàng** (nút chính) · Hủy thay đổi; sửa nháp (đầu trang có **Xóa phiếu nháp**, hỏi lại); rời trang khi chưa lưu | Lưu nháp / xóa nháp được; phiếu nháp chưa sửa gì vẫn bấm Đặt hàng được; rời trang thì hỏi | [ ] | |
| 23.6 | Đặt hàng | Trạng thái chờ nhận; không sửa được như nháp | [ ] | |
| 23.7 | Mở từ Dashboard với 2–3 nguyên liệu đã tick | Ô NCC chỉ gợi ý NCC bán các nguyên liệu này, ghi "bán x/y nguyên liệu đã chọn"; NCC bán nhiều nhất được chọn sẵn, các dòng có sẵn; nguyên liệu NCC không bán được ghi dưới ô NCC | [ ] | |
| 23.8 | Chi tiết: nhãn trạng thái (+ Trễ hạn) cạnh tiêu đề; nút việc chính (Sửa phiếu nháp / Nhận hàng / Thanh toán) + ⋯; Lịch sử nhận hàng, Lịch sử thanh toán (xếp dọc, đủ cột), Lịch sử trạng thái; **Kết thúc nhận hàng**; **Hủy phiếu** (lý do) | Đúng từng bước | [ ] | |

**Liên quan:** Nhập kho (24), Công nợ (27), Dashboard kho (20).

## Trang 24. Nhập kho (`/kho/nhap-kho`)

| # | Thao tác | Mong đợi | Đạt | Ghi chú |
|---|---|---|---|---|
| 24.1 | Danh sách: chọn ngày, tìm; **+ Lọc** → Loại. Hai nút ở góc phải: **Nhập không phiếu** · **Nhận hàng theo phiếu mua** | Dòng tổng giá trị không tính phiếu đã hủy | [ ] | |
| 24.2 | **Nhận hàng theo phiếu mua**: chọn phiếu, nhập SL nhận một phần, ghi chú dòng; "Nhận đủ tất cả"; "Đặt tất cả về 0" | Thanh dưới đáy: "Đã điền sẵn số lượng còn lại" · n nguyên liệu · giá trị lần này · **Nhập kho**; còn lại tính đúng; xác nhận xong phiếu mua thành nhận một phần | [ ] | |
| 24.3 | Nhận nốt phần còn lại | Phiếu mua đủ; tồn tăng; giá vốn bình quân đổi | [ ] | |
| 24.4 | **Nhập kho không phiếu**: chưa chọn nơi mua; đơn giá lệch nhiều; rời trang khi đang nhập dở | Nhắc chọn nơi mua; hỏi "Kiểm tra lại đơn giá?"; rời trang thì hỏi | [ ] | |
| 24.5 | Chi tiết phiếu nhập (nhãn trạng thái cạnh tiêu đề) → **Hủy phiếu nhập** (lý do) | Tồn giảm lại; phiếu ghi Đã hủy | [ ] | |

**Liên quan:** Nguyên liệu (21), Phiếu mua (23), Kiểm tra nguyên liệu (29).

## Trang 25. Xuất kho (`/kho/xuat-kho`)

| # | Thao tác | Mong đợi | Đạt | Ghi chú |
|---|---|---|---|---|
| 25.1 | Danh sách: chọn ngày, tìm; **+ Lọc** → Lý do | Đúng; tổng giá trị xuất | [ ] | |
| 25.2 | Tạo phiếu xuất: lý do, người nhận, thêm nguyên liệu; SL vượt tồn; bấm **Xuất kho** ở thanh dưới đáy | Hiện tồn hiện tại cạnh dòng; vượt tồn bị chặn ("Còn n chỗ chưa đúng"); thanh đáy có tổng giá trị xuất; rời trang khi nhập dở thì hỏi | [ ] | |
| 25.3 | Xuất làm tồn xuống dưới tối thiểu | Kho và Quản lý nhận thông báo sắp hết | [ ] | |

## Trang 26. Kiểm kê (`/kho/kiem-ke`)

| # | Thao tác | Mong đợi | Đạt | Ghi chú |
|---|---|---|---|---|
| 26.1 | Danh sách: **+ Lọc** → Trạng thái; Lập phiếu: phạm vi theo nhóm hoặc chọn nguyên liệu | Phiếu có đủ dòng, cột Sổ sách / SL thực tế / Chênh lệch; nhãn trạng thái cạnh tiêu đề phiếu | [ ] | |
| 26.2 | Nhập SL thực tế, lọc nhóm, tìm; bấm **Khớp sổ sách** | Chênh lệch, giá trị tăng / giảm tính ngay (mỗi dòng tự lưu) | [ ] | |
| 26.3 | Thanh dưới đáy "Đã đếm x/y · n dòng chênh lệch": **Gửi duyệt**; **Xóa phiếu** (nháp) / **Hủy phiếu** (lý do) | Chờ duyệt, Quản lý nhận thông báo | [ ] | |
| 26.4 | Phiếu bị từ chối | Thấy dòng "Bị từ chối: lý do"; thanh đáy có Hủy phiếu · Sửa và gửi lại | [ ] | |

**Liên quan:** Duyệt kiểm kê (19), Nguyên liệu (21).

## Trang 27. Công nợ (`/kho/cong-no`)

| # | Thao tác | Mong đợi | Đạt | Ghi chú |
|---|---|---|---|---|
| 27.1 | Danh sách theo NCC: tổng phải trả, đã trả, còn nợ, nợ cũ nhất từ; **+ Lọc** → Tình trạng (Còn nợ / Đã trả hết) | Đúng | [ ] | |
| 27.2 | Chi tiết (nhãn Còn nợ / Đã trả hết cạnh tên) → **Thanh toán** (số tiền vượt còn nợ; đúng) | Vượt bị chặn; đúng thì còn nợ giảm, phiếu mua đổi trạng thái thanh toán | [ ] | |
| 27.3 | Lịch sử thanh toán: ⋯ → **Hủy thanh toán** (lý do) | Còn nợ tăng lại | [ ] | |

---

# Phần 4. Bếp (`hung.pham`)

## Trang 28. Màn hình bếp (`/bep`)

| # | Thao tác | Mong đợi | Đạt | Ghi chú |
|---|---|---|---|---|
| 28.1 | Đăng nhập → **Bắt đầu** | Thanh trên: ☰ · BẾP · ô đếm **Tất cả · Mới · Đang làm · Chờ lấy** ở giữa · kết nối, TB hôm nay, đồng hồ bên phải. Không còn nút Chấm công, Đăng xuất, Món tạm hết, ⚙ nằm ngoài; không còn dải "chưa vào ca" | [ ] | |
| 28.2 | Tài khoản bếp **chưa chấm công**, bấm Bắt đầu / Xong một món | Làm được bình thường (màn bếp dùng chung, không đòi vào ca) | [ ] | |
| 28.3 | Món mới tới (sau khi phục vụ xác nhận) | Thẻ xuất hiện ngay, có âm báo; ghi chú nổi màu vàng | [ ] | |
| 28.4 | Bàn gọi nhiều đợt | Vẫn một thẻ; đợt mới ở trên, nhãn "Mới gọi thêm", mỗi đợt có giờ + đồng hồ riêng | [ ] | |
| 28.5 | Món thuộc set | Nhãn **"SET · tên set"** | [ ] | |
| 28.6 | **Bắt đầu (n)**, **Xong** từng món, **Xong (n)** | Nhãn ĐANG LÀM, sọc cam; xong thì rời thẻ, hiện ngay ở **cột Chờ lấy** bên phải (khối của bàn đó), ô đếm Chờ lấy tăng, "TB hôm nay" có số phút | [ ] | |
| 28.7 | Cột **Chờ lấy**: bấm **Đã mang đi (n)** của một bàn; bàn khác bấm ✓ một món | Cả khối / món đó biến mất; khách thấy "Đã mang ra"; thu ngân, phục vụ thấy món đã mang. Bàn chờ lâu nhất ở trên, số phút chờ đỏ khi từ 5 phút | [ ] | |
| 28.8 | Cột Chờ lấy → **Trả lại** (nút ↺) một món vừa xong | Món quay lại thẻ, nhãn ĐANG LÀM + **GỌI LẠI**; quá 30 phút thì không còn nút ↺ | [ ] | |
| 28.9 | **Hủy** một món chờ: lý do "Hết nguyên liệu" + tick tạm hết | Khách thấy lý do; thu ngân nhận thông báo; món tạm hết | [ ] | |
| 28.10 | Khách / thu ngân hủy món | Món gạch ngang nhãn **ĐÃ ĐỔI** (ghi ai hủy, lúc nào), có âm báo | [ ] | |
| 28.11 | Bấm ô đếm Mới / Đang làm / Tất cả; đổi **Theo món**; bấm viên danh mục | Lọc đúng, số đếm đúng; Theo món gộp đúng số lượng | [ ] | |
| 28.12 | Bấm **Tổng hợp món** | Cột phải đổi thành bảng Món · Mới · Đang làm · Chờ lấy (cộng số phần), theo danh mục đang lọc; **Về Chờ lấy** để trở lại | [ ] | |
| 28.13 | Thẻ chờ lâu | Đồng hồ + viền vàng (≥10′), cam (≥20′), đỏ (≥30′) | [ ] | |
| 28.14 | Bấm tên bàn trên thẻ | Mở chi tiết đơn bàn đó | [ ] | |
| 28.15 | Bấm **☰** | Menu trái: Kiểm tra nguyên liệu · Công thức · Món tạm hết (số đỏ) · Cài đặt màn hình; cuối menu tên người đăng nhập + Đăng xuất. Không có Chấm công | [ ] | |
| 28.16 | ☰ → **Đăng xuất** → Ở lại; làm lại → Đăng xuất | Hỏi "Đăng xuất khỏi màn hình bếp?"; Ở lại thì vẫn ở màn bếp; Đăng xuất về trang đăng nhập | [ ] | |
| 28.17 | ☰ → **Món tạm hết** → bật / tắt | Trang khách, website, trợ lý đổi theo | [ ] | |
| 28.18 | ☰ → **Cài đặt màn hình**: nền, số cột, cỡ chữ; mốc màu (thêm tối đa 4, khôi phục mặc định); danh mục phụ trách | Áp dụng ngay, tải lại vẫn giữ; trạm Đồ uống chỉ thấy + chỉ kêu cho đồ uống (cột Chờ lấy cũng chỉ món của trạm) | [ ] | |
| 28.19 | Bàn phím rời: số ở góc thẻ, Space, Enter, ← →, Esc | Chọn / bắt đầu / xong / chuyển thẻ / bỏ chọn đúng | [ ] | |
| 28.20 | Thu nhỏ cửa sổ dưới 1024 px | Cột phải ẩn; bấm ô **Chờ lấy** mở khung bên; Tổng hợp món mở thành khung | [ ] | |
| 28.21 | Tắt máy chủ rồi bật lại | Biểu tượng WiFi đỏ "Mất kết nối", tự nối lại | [ ] | |
| 28.22 | Gõ thẳng `/bep/toi` | Về màn bếp (trang chấm công của bếp đã gỡ) | [ ] | |

**Liên quan:** Trang QR (44), Phục vụ Yêu cầu / Mang món (33, 34), Sơ đồ thu ngân (36), Kiểm tra nguyên liệu / Công thức (29, 30 — thanh trên không còn tab Chấm công; Đăng xuất có hỏi).

## Trang 29. Kiểm tra nguyên liệu (`/bep/nguyen-lieu`)

| # | Thao tác | Mong đợi | Đạt | Ghi chú |
|---|---|---|---|---|
| 29.1 | Mở từ ☰ trên màn bếp | Thanh trên: ☰ · BẾP · tiêu đề "Kiểm tra nguyên liệu" · Làm mới · **Về màn bếp**. ☰ ở đây có Màn hình bếp / Kiểm tra nguyên liệu / Công thức / Đăng xuất (có hỏi lại) | [ ] | |
| 29.2 | Xem **Theo món** | Món ít phần nhất ở trên; nguyên liệu giới hạn; món chưa có công thức có link "Khai báo công thức" | [ ] | |
| 29.3 | Món còn 0 phần → **Đánh dấu tạm hết** | Món thành tạm hết hôm nay | [ ] | |
| 29.4 | Bấm chip **Tất cả · Hết hàng · Sắp hết · Đủ hàng**; đổi **Theo nguyên liệu**, tìm | Số trên chip đúng theo cách xem / từ khóa / danh mục; bảng nguyên liệu: tồn, tồn tối thiểu, tình trạng, các món dùng | [ ] | |

## Trang 30. Công thức (`/bep/cong-thuc`)

| # | Thao tác | Mong đợi | Đạt | Ghi chú |
|---|---|---|---|---|
| 30.1 | Mở từ ☰; lọc **Tất cả / Chưa có / Đã có** (kèm số), tìm món, chọn danh mục | Đúng; mỗi món có nhãn **% giá vốn / giá bán** (xanh ≤ 35%, vàng ≤ 45%, đỏ cao hơn) hoặc "Chưa có" | [ ] | |
| 30.2 | Chọn món | Phải: tên, danh mục, giá bán; bảng nguyên liệu (đơn vị nằm ngay trong ô định lượng); **thanh dính đáy**: giá vốn / phần · % giá bán · Hủy thay đổi · Lưu công thức | [ ] | |
| 30.3 | **Thêm nguyên liệu** → gõ tên / mã vào ô (vd. "hanh") | Danh sách lọc theo chữ gõ, hiện tồn kho; ↑ ↓ Enter chọn được; dòng cuối thì danh sách mở lên trên | [ ] | |
| 30.4 | Nguyên liệu đã có ở dòng khác | Mờ, ghi "đã có ở dòng khác", không chọn được | [ ] | |
| 30.5 | Để trống / định lượng 0 ở vài dòng → **Lưu** | Dòng lỗi tô đỏ, lỗi dưới ô; tự cuộn tới dòng lỗi đầu tiên, con trỏ vào ô đó; thanh đáy ghi "Còn n chỗ chưa đúng" | [ ] | |
| 30.6 | Định lượng đúng (vd. 0,08) → Lưu | Báo đã lưu; giá vốn / phần, % giá bán và nhãn % ở danh sách bên trái đổi theo | [ ] | |
| 30.7 | Sửa dở rồi chọn món khác / bấm Về màn bếp / ☰ → trang khác / nút Back | Hỏi "Bỏ các thay đổi chưa lưu?" [Ở lại] [Bỏ thay đổi]; đóng tab thì trình duyệt hỏi | [ ] | |
| 30.8 | Xóa hết dòng → Lưu | Hỏi lại; món về "Chưa có" | [ ] | |
| 30.9 | ☰ (màn bếp) → Cài đặt màn hình → nền Tối, mở lại Công thức | Trang Công thức cùng nền tối, chữ đọc rõ | [ ] | |

**Liên quan:** Nguyên liệu – Món sử dụng (21), Kiểm tra nguyên liệu (29).

---

# Phần 5. Phục vụ (điện thoại, `nam.hoang`)

## Trang 31. Sơ đồ bàn (`/phuc-vu`)

| # | Thao tác | Mong đợi | Đạt | Ghi chú |
|---|---|---|---|---|
| 31.1 | Mở trang (chưa chấm công, không cần) | Thanh trên: ca theo lịch ("Ca … · khu") hoặc "Ngoài ca · ca tới …"; thanh dưới **4 tab** Sơ đồ · Yêu cầu · Món xong · Thực đơn (không còn tab Tôi); không có dải "chưa vào ca" | [ ] | |
| 31.2 | Không có ca lúc này | Vẫn mở bàn, gọi món, xác nhận đơn được; khách gọi nhân viên thì mọi phục vụ nhận | [ ] | |
| 31.3 | Kiểu xem **Danh sách** | Thẻ bo tròn chữ to; bàn cần xử lý lên đầu (chờ xác nhận → khách gọi → món chờ lâu → món xong) | [ ] | |
| 31.4 | Kiểu xem **Sơ đồ** | Vị trí thật (bàn có ghế, vùng khu, tường), vừa màn hình; khu rộng thì vuốt ngang | [ ] | |
| 31.5 | **Nút gạt khu** (Sảnh chính / Sân vườn…): khu **Của tôi** và khu khác | Mở sẵn khu của ca theo lịch; khu khác xem và thao tác được; chấm đỏ khi khu có bàn cần xử lý | [ ] | |
| 31.6 | Chạm bàn trống → số khách (không bắt buộc) → **Mở bàn** (nút lớn) | Bảng dưới trượt lên có giải thích; mở xong QR bàn gọi món được | [ ] | |
| 31.7 | Bàn có khách chưa gọi món → **Đóng bàn** | Bàn về Trống | [ ] | |
| 31.8 | Bàn có món: **Gọi món cho khách** (nút lớn), **Chuyển bàn**, **Ghép bàn** | Chuyển: bàn cũ Trống. Ghép: món + số khách gộp sang bàn đích | [ ] | |
| 31.9 | Bàn có món bếp đã xong | Khung xanh "n món bếp đã xong — ra bếp lấy món"; món ghi **Xong – lấy ở bếp**; **không có** nút Mang ra / Đã mang hết | [ ] | |
| 31.10 | Bàn khách đã yêu cầu thanh toán / bàn ngừng phục vụ | Ghi "thu ngân đang xử lý hóa đơn", không gọi thêm / "Bàn đang ngừng phục vụ" | [ ] | |
| 31.11 | Quản lý sửa sơ đồ (máy khác) | Thông báo "Sơ đồ … vừa thay đổi", sơ đồ đổi ngay | [ ] | |
| 31.12 | Gõ thẳng `/phuc-vu/toi` | Về Sơ đồ (trang cá nhân đã gỡ, sau gom về Cổng nhân viên) | [ ] | |

**Liên quan:** Sơ đồ bàn (8), Sơ đồ thu ngân (36), Trang QR (44).

## Trang 32. Thực đơn / Gọi món hộ (`/phuc-vu/thuc-don`, `/phuc-vu/goi-mon/:bàn`)

| # | Thao tác | Mong đợi | Đạt | Ghi chú |
|---|---|---|---|---|
| 32.1 | Tab Thực đơn: lưới món ảnh tròn; tìm món / thành phần; bấm một món | Bảng dưới: ảnh, giá, thành phần, dị nguyên, độ cay; món hết ghi "Hết món"; không có nút + | [ ] | |
| 32.2 | Từ bảng bàn → **Gọi món**: chip danh mục, bấm **+** trên thẻ, − / + | Thẻ đã chọn hiện bộ đếm; thanh lớn **Xem giỏ · n món · tổng tiền** | [ ] | |
| 32.3 | Chip **Set menu** → chọn một set | Mở màn chi tiết set như trang QR: chọn độ chín / sốt cho bít tết, chia loại nước; Thêm set | [ ] | |
| 32.4 | **Xem giỏ** | Mỗi dòng: ảnh tròn, tên, giá, ô **Thêm ghi chú** (set thì ghi các món đã chọn), − n +; Tổng | [ ] | |
| 32.5 | **Gửi bếp · tổng tiền** | Về sơ đồ, báo đã gửi; bếp thấy món ngay (đúng độ chín / ghi chú); không cần chấm công | [ ] | |
| 32.6 | Ngoài giờ mở cửa bấm Gửi bếp | Báo "Nhà hàng hiện ngoài giờ phục vụ", giỏ giữ nguyên | [ ] | |

## Trang 33. Yêu cầu: đơn chờ xác nhận + khách gọi nhân viên (`/phuc-vu/yeu-cau`)

| # | Thao tác | Mong đợi | Đạt | Ghi chú |
|---|---|---|---|---|
| 33.1 | Khách khu mình (theo lịch ca) gửi món | Âm báo + rung; thẻ hồng **Chờ xác nhận** liệt kê món + ghi chú | [ ] | |
| 33.2 | **Bỏ món**: bỏ 1 món, nhập lý do → **Xác nhận n món, chuyển bếp** (nút lớn) | Bếp thấy món còn lại; khách thấy lý do món bị bỏ | [ ] | |
| 33.3 | Bỏ món không nhập lý do | Bắt nhập lý do | [ ] | |
| 33.4 | Khách tự hủy món đang chờ xác nhận | Thẻ cập nhật, món biến mất | [ ] | |
| 33.5 | Quá 3 phút không xác nhận | Thẻ tô đỏ, nhắc lại; phục vụ khu khác thấy và xác nhận được | [ ] | |
| 33.6 | Khách gọi nhân viên → **Tôi đến** → **Hoàn thành** | Khách thấy "Nhân viên … đang đến"; xong thì chuông khách bình thường | [ ] | |
| 33.7 | Yêu cầu từ khu không ai có ca; giờ không ai có ca | Khu không ai có ca: mọi phục vụ đang trong ca thấy. Không ai có ca: mọi phục vụ thấy + nhận thông báo | [ ] | |

**Liên quan:** Trang QR (44), Bếp (28), Chi tiết đơn thu ngân (37, ghi người xác nhận).

## Trang 34. Món xong (`/phuc-vu/mon-xong`)

| # | Thao tác | Mong đợi | Đạt | Ghi chú |
|---|---|---|---|---|
| 34.1 | Bếp bấm Xong một món của bàn khu mình | Âm báo + rung; số đỏ trên tab **Món xong**; món hiện theo bàn, bàn chờ lâu nhất trên, phút chờ đỏ khi ≥ 5 | [ ] | |
| 34.2 | Xem trang | **Chỉ xem** — không có nút Đã mang; dòng nhắc "Bếp sẽ bấm Đã mang đi khi bạn lấy món"; nút gạt Khu của tôi / Tất cả khu | [ ] | |
| 34.3 | Bếp bấm **Đã mang đi** | Món biến khỏi danh sách; khách thấy "Đã mang ra"; không còn món thì "Chưa có món nào xong" | [ ] | |
| 34.4 | Gõ đường dẫn cũ `/phuc-vu/mang-mon` | Về trang Món xong | [ ] | |

## Trang 35. Thông báo phục vụ (`/phuc-vu/thong-bao`)

| # | Thao tác | Mong đợi | Đạt | Ghi chú |
|---|---|---|---|---|
| 35.1 | Xem danh sách, bấm một thông báo | Mở đúng màn; trống thì "Chưa có thông báo" | [ ] | |

---

# Phần 6. Thu ngân (`linh.tran`)

## Trang 36. Quầy thu ngân – màn POS (`/thu-ngan`)

| # | Thao tác | Mong đợi | Đạt | Ghi chú |
|---|---|---|---|---|
| 36.1 | Mở trang (chưa chấm công, không cần) | Thanh trên chỉ còn ☰ (số đỏ = yêu cầu + hóa đơn chưa thu) · THU NGÂN + thứ / ngày · kết nối · giờ lớn · chuông. Không còn dải tab, nút Chấm công / Văn phòng, dải "chưa vào ca" | [ ] | |
| 36.2 | Bố cục | Trái: **Yêu cầu thanh toán · Đặt bàn hôm nay · Bàn đang có khách** (bấm tiêu đề để gập / mở, nhớ lần sau); giữa: sơ đồ; phải: trống cho tới khi chạm bàn; đáy: chú thích màu có số, Khách đang ngồi, Đã thu hôm nay | [ ] | |
| 36.3 | Sơ đồ | Vẽ cả tầng như trang Sơ đồ bàn của Quản lý (tường, vùng khu có tên, bàn có ghế, màu trạng thái, đã ngồi bao lâu, tạm tính); **Vừa khung** tự co vừa màn, − / + để chỉnh | [ ] | |
| 36.4 | Tab tầng: **Tất cả tầng** · Tầng 1 · Tầng 2 (mỗi tab ghi "n/m có khách", số vàng = chờ thanh toán, số cam = khách gọi) | Màn rộng (~1920) tự hiện cả 2 tầng; màn 1440 tự hiện một tầng (tầng có việc cần xử lý) cho bàn to rõ; bấm tab đổi được, nhớ lần sau | [ ] | |
| 36.5 | Chạm bàn → khung chi tiết bên phải: số khách, món, tạm tính, **In tạm tính**, **Chuyển bàn**, **Xem đơn đầy đủ**, **Lập hóa đơn / Thu tiền** | Đúng; bản in "PHIẾU TẠM TÍNH" ghi không phải hóa đơn; bấm ra ngoài sơ đồ hoặc ✕ thì đóng khung | [ ] | |
| 36.6 | Bàn trống → **Mở bàn**; bàn mở không món → **Đóng bàn**; bàn có món | Mở / đóng được (không cần chấm công); bàn có món không có Đóng bàn | [ ] | |
| 36.7 | Cột trái: bấm một dòng **Yêu cầu thanh toán** / **Bàn đang có khách** | Chọn đúng bàn trên sơ đồ (đổi tầng nếu cần), mở khung chi tiết | [ ] | |
| 36.8 | **Đặt bàn hôm nay → Thêm**: để trống tên / SĐT sai / giờ ngoài giờ mở cửa / bàn ít ghế hơn số khách / bàn trùng giờ | Lỗi đúng tại ô; chọn được "Khách gọi điện" / "Khách đến quầy" | [ ] | |
| 36.9 | Thêm lịch đúng (có / không xếp bàn) | Báo "Đã thêm lịch đặt DB-…"; hiện trong danh sách theo giờ (≤ 2 giờ nữa tô tím, quá giờ chữ đỏ "Trễ …"); Quản lý thấy trong lịch sử đặt bàn | [ ] | |
| 36.10 | Bấm một lịch → sửa giờ / số khách / bàn → Lưu; **Hủy lịch** (hỏi lại); quá giờ → **Khách không đến**; lịch website → **Xác nhận lịch** | Lưu đúng; lịch hủy / không đến chuyển xuống "lịch đã xử lý" | [ ] | |
| 36.11 | Lịch hôm nay đã xếp bàn → **Khách đã đến – Mở bàn**; hoặc bấm mã bàn tím trên dòng lịch → bàn → **Khách đã đến – Mở bàn** | Bàn mở với số khách của phiếu đặt, lịch thành Đã đến | [ ] | |
| 36.12 | Khách đặt qua website | Thu ngân nhận thông báo (chuông); lịch hiện trong Đặt bàn hôm nay (nếu đặt hôm nay) | [ ] | |
| 36.13 | Khách gọi nhân viên | Sơ đồ thu ngân **không đổi** (do phục vụ xử lý) | [ ] | |
| 36.14 | **☰**: Quầy thu ngân · Yêu cầu thanh toán · Hóa đơn · Đơn hàng · Văn phòng (Chấm công, Bảng lương, Thông báo, Đổi mật khẩu) · Đăng xuất | Số đỏ đúng; trang phụ có nút lớn **Về quầy thu ngân**; Đăng xuất hỏi "Đăng xuất khỏi quầy thu ngân?" [Ở lại] | [ ] | |
| 36.15 | Gõ thẳng `/thu-ngan/toi` | Báo "Không tìm thấy trang" (trang cá nhân đã gỡ, sau gom về Cổng nhân viên) | [ ] | |

## Trang 37. Chi tiết đơn (`/thu-ngan/don/:id`)

| # | Thao tác | Mong đợi | Đạt | Ghi chú |
|---|---|---|---|---|
| 37.1 | Mở đơn | Món theo đợt, trạng thái từng món, người xác nhận ("Xác nhận: …"), món set ghi "Thuộc [set] · giá đã chia từ giá set" | [ ] | |
| 37.2 | Hủy món chưa chọn lý do; có lý do | Nút khóa; hủy xong tạm tính giảm, bếp mất món | [ ] | |
| 37.3 | **Hủy đơn** (đơn chỉ có món chờ); đơn có món đang làm | Hủy được → bàn Trống; đơn có món đang làm không có nút | [ ] | |
| 37.4 | **Chuyển bàn** sang bàn trống / bàn đặt trước | Chuyển được; bàn đặt trước thì hỏi lại | [ ] | |
| 37.5 | Thẻ "Khách yêu cầu thanh toán" | Hiện hình thức, VAT khách nhập | [ ] | |
| 37.6 | **Lập hóa đơn** khi còn món chưa xong / còn món chờ xác nhận | Bị chặn, có giải thích | [ ] | |
| 37.7 | Lập hóa đơn: xem trước | Món gộp cùng giá, set một dòng kèm chi tiết, VAT điền sẵn | [ ] | |
| 37.8 | Hộp **Thu tiền**: nhiều hình thức, tiền khách đưa, tiền thối; tổng lệch | Tự điền phần còn lại; lệch thì nút Xác nhận khóa | [ ] | |
| 37.9 | Lập hóa đơn → **Để sau** | Đơn "Chờ thanh toán", có nút **Thu tiền HD…** | [ ] | |
| 37.10 | Thanh toán xong → **In hóa đơn** | Bản in có tên / địa chỉ, thu ngân, khoản thu, tiền thối, VAT, mã QR | [ ] | |

**Liên quan:** Trang QR (44, hóa đơn bật lên, cảm ơn), Hóa đơn (40), Dashboard (5).

## Trang 38. Đơn hàng (`/thu-ngan/don-hang`)

| # | Thao tác | Mong đợi | Đạt | Ghi chú |
|---|---|---|---|---|
| 38.1 | Lọc Đang mở / Chờ thanh toán / Hoàn tất / Đã hủy; tìm mã bàn; khoảng ngày | Đúng; "Đang mở" không gồm đơn chờ thanh toán | [ ] | |
| 38.2 | Bấm mã đơn | Mở chi tiết đơn (37) | [ ] | |

## Trang 39. Yêu cầu thanh toán (`/thu-ngan/yeu-cau`)

| # | Thao tác | Mong đợi | Đạt | Ghi chú |
|---|---|---|---|---|
| 39.1 | Mở trang | Chỉ có yêu cầu thanh toán (yêu cầu hỗ trợ không còn ở đây) | [ ] | |
| 39.2 | Yêu cầu của VIP01 → **Lập hóa đơn** | Mở đúng chi tiết đơn VIP01 | [ ] | |
| 39.3 | Khách hủy yêu cầu | Dòng biến mất, số đếm giảm | [ ] | |

## Trang 40. Hóa đơn (`/thu-ngan/hoa-don`)

| # | Thao tác | Mong đợi | Đạt | Ghi chú |
|---|---|---|---|---|
| 40.1 | Lọc trạng thái, hình thức, khoảng ngày (> 31 ngày); tìm mã | Đúng; quá 31 ngày thì báo | [ ] | |
| 40.2 | Dưới bảng | Tổng đã thu theo từng hình thức | [ ] | |
| 40.3 | Mở hóa đơn chưa thanh toán → **Thu tiền** / **Hủy hóa đơn** (lý do) | Thu được; hủy xong đơn mở khóa, khách gọi thêm được | [ ] | |
| 40.4 | Mở hóa đơn đã thanh toán | Chỉ có nút In | [ ] | |

## Trang 41. Chấm công – văn phòng (☰ → Chấm công, `/thu-ngan/cham-cong`)

| # | Thao tác | Mong đợi | Đạt | Ghi chú |
|---|---|---|---|---|
| 41.1 | Xem khoảng ngày, lọc nhân viên | Bảng + **Tổng giờ theo nhân viên**; dòng "Thiếu giờ ra" nổi bật | [ ] | |
| 41.2 | Cột Nguồn | Phân biệt Khuôn mặt / Excel / tay; có Trễ / Về sớm | [ ] | |
| 41.3 | **Xem ảnh chấm công** (dòng khuôn mặt) | Ảnh vào / tan ca; dòng không có ảnh ghi "Không có ảnh" | [ ] | |
| 41.4 | **Thêm chấm công**: thiếu ghi chú; chồng giờ; 22:00 → 06:00 | Bắt ghi chú; báo chồng giờ; ca qua đêm ghi "(+1 ngày)" | [ ] | |
| 41.5 | Dòng thuộc kỳ lương đã chốt | Ghi "Đã chốt", không sửa / xóa được | [ ] | |
| 41.6 | **Nhập từ Excel**: tải file mẫu, sửa vài dòng có lỗi, chọn file; nhập lại cùng file | Xem trước Hợp lệ / Lỗi / Trùng kèm lý do; tải file dòng lỗi; chọn Bỏ qua / Ghi đè | [ ] | |

## Trang 42. Bảng lương (☰ → Bảng lương, `/thu-ngan/bang-luong`)

| # | Thao tác | Mong đợi | Đạt | Ghi chú |
|---|---|---|---|---|
| 42.1 | Kỳ tháng trước | Đã chốt, chỉ xem, in được | [ ] | |
| 42.2 | Tạo kỳ trùng khoảng ngày | Báo trùng | [ ] | |
| 42.3 | Tạo kỳ tháng này → chi tiết | Mỗi nhân viên một dòng, cảnh báo dòng thiếu giờ ra, trễ / sớm | [ ] | |
| 42.4 | Phụ cấp không ghi chú; có ghi chú | Bắt ghi chú; thực lĩnh tăng đúng | [ ] | |
| 42.5 | **Chốt** khi còn thiếu giờ ra / kỳ chưa kết thúc | Bị chặn, có lý do | [ ] | |
| 42.6 | Sửa chấm công rồi **Tính lại** | Giờ công cập nhật, phụ cấp giữ nguyên | [ ] | |
| 42.7 | **In bảng lương**, **In phiếu lương** | Đúng số, phiếu có chi tiết ngày công | [ ] | |

**Liên quan:** Chấm công (41). Phiếu lương của nhân viên sẽ xem ở Cổng nhân viên (làm sau).

---

# Phần 7. Thông tin của tôi (đã gỡ 26/11/2026 — sau gom về Cổng nhân viên `/nhan-vien`)

## Trang 43. Thông tin của tôi + chấm công khuôn mặt — **tạm gỡ (26/11/2026)**

Trang cá nhân (chấm công khuôn mặt, ca làm, lịch sử, phiếu lương, hồ sơ) đã gỡ khỏi màn làm việc của bếp, phục vụ, thu ngân; sẽ gom về **Cổng nhân viên `/nhan-vien`** cho mọi vai trò (làm cuối cùng, nhóm mô tả sau). Các dòng test cũ của trang này viết lại khi làm Cổng. Duyệt khuôn mặt (13), Cấu hình chấm công (18), Chấm công văn phòng (41), Bảng lương (42) vẫn test bình thường.

| # | Thao tác | Mong đợi | Đạt | Ghi chú |
|---|---|---|---|---|
| 43.1 | Gõ `/thu-ngan/toi`, `/phuc-vu/toi`, `/bep/toi` | Không còn trang (thu ngân: "Không tìm thấy trang"; phục vụ, bếp: về màn chính) | [ ] | |

**Liên quan:** Khuôn mặt chấm công (13), Cấu hình → Chấm công (18), Chấm công văn phòng (41), Bảng lương (42).

---

# Phần 8. Khách – trang gọi món QR (`/goi-mon/<mã>`, điện thoại)

## Trang 44. Trang gọi món

Trang lớn, chia nhóm. Làm hết các nhóm trên cùng một bàn (vd. T05).

**44A. Mở trang, đầu trang, ảnh bìa**

| # | Thao tác | Mong đợi | Đạt | Ghi chú |
|---|---|---|---|---|
| 44.1 | Mở QR bàn trống | Viên "Bàn chưa mở"; thêm giỏ được nhưng Gửi bị khóa; bấm chuông có gợi ý "Mở bàn giúp tôi" | [ ] | |
| 44.2 | Bàn đã mở | Đầu trang "Bạn đang ngồi tại · Bàn …", nút chuông, **Món của tôi**; không tràn ngang | [ ] | |
| 44.3 | Ảnh bìa | Biển hiệu ROYAL BEEF trên cửa kính; chữ + tua rua không bị thanh tìm kiếm che | [ ] | |
| 44.4 | Kéo / bấm **dây đèn** | Đổi sáng / tối, màu lan từ đèn, dây nảy; tải lại vẫn nhớ | [ ] | |
| 44.5 | Điện thoại chế độ tối (lần đầu mở) | Trang tự tối | [ ] | |
| 44.6 | Bật Giảm chuyển động | Không còn bay / trượt / tự chạy; vẫn dùng được hết | [ ] | |

**44B. Danh mục, tìm, lọc, Bán chạy**

| # | Thao tác | Mong đợi | Đạt | Ghi chú |
|---|---|---|---|---|
| 44.7 | Bấm / vuốt dải danh mục cong; tự cuộn trang | Mục chọn vào giữa, viền đỏ; trang cuộn đúng mục; tự cuộn thì dải xoay theo | [ ] | |
| 44.8 | Tìm "gỏi" / "goi" / "sprite" / "T-bone" | Đúng món; Sprite ghi "Nước ngọt có ga"; T-bone mờ, dấu HẾT | [ ] | |
| 44.9 | Nút lọc: sắp xếp + nhãn → Áp dụng → Bỏ lọc | Đúng món, đúng thứ tự; nút có số điều kiện; không có kết quả thì "Không có món phù hợp" + Xem tất cả món | [ ] | |
| 44.10 | Bán chạy | Chỉ món ăn; băng chuyền tự trượt qua lại, dừng khi chạm | [ ] | |

**44C. Set menu**

| # | Thao tác | Mong đợi | Đạt | Ghi chú |
|---|---|---|---|---|
| 44.11 | Khung Set menu (sáng và tối) | Viền đôi vàng đậm rõ trên nền sáng; ruy-băng "-x%"; giá set, giá gốc gạch, "Tiết kiệm …đ"; chấm ở đáy | [ ] | |
| 44.12 | Đứng yên ~10 giây; vuốt ngang | Tự sang set kế, tới cuối chạy ngược; vuốt dừng đúng set; set cao bằng nhau | [ ] | |
| 44.13 | Trong / ngoài 10:30–14:00 | Set Bữa trưa văn phòng chỉ có trong giờ | [ ] | |
| 44.14 | Set Steak: độ chín / sốt từng phần → Thêm set | Giỏ một dòng set + món con kèm lựa chọn | [ ] | |
| 44.15 | Set Lẩu: chia 4 lon nước chưa đủ / đủ | Chưa đủ thì nút khóa "Chọn đủ nước ngọt" | [ ] | |
| 44.16 | Món con của set tạm hết | Set biến mất khỏi khung | [ ] | |

**44D. Chi tiết món, nhóm món, gọi thêm**

| # | Thao tác | Mong đợi | Đạt | Ghi chú |
|---|---|---|---|---|
| 44.17 | Mở chi tiết, cuộn, ⤢, đóng (mũi tên / vuốt / Back) | Trượt mượt; ảnh thu nhỏ khi cuộn; ⤢ toàn màn hình; mọi cách đóng đều được | [ ] | |
| 44.18 | Bít tết: thanh Độ chín, Sốt kèm; món khác: ghi chú nhanh theo loại | Đúng như mô tả (chảo gang không có sốt; lẩu / trà / vang có ghi chú riêng) | [ ] | |
| 44.19 | Bấm **+** ngoài thẻ Ribeye | Giỏ ghi "Medium rare, Sốt tiêu đen" | [ ] | |
| 44.20 | Hàng **Gọi thêm cho món này** (Ribeye, Lẩu) | Đúng món gợi ý; bấm + thêm dòng riêng | [ ] | |
| 44.21 | Nút + thẻ **Nước ngọt có ga** | Không bay vào giỏ; mở bảng 6 dòng − / + | [ ] | |
| 44.22 | Bảng chọn: tăng nhiều loại → nút đáy; mở lại → giảm → Cập nhật; đóng bằng X | Nút đổi "Thêm vào giỏ · n món · tổng" / "Cập nhật giỏ" / "Bỏ khỏi giỏ"; nút dính đáy; X không đổi giỏ | [ ] | |
| 44.23 | Bảng chọn: chạm ảnh / tên một loại | Mở chi tiết món đó | [ ] | |
| 44.24 | Thẻ Bia, Vang | Giá "từ …"; bảng có giá từng loại | [ ] | |

**44E. Giỏ, gửi, theo dõi**

| # | Thao tác | Mong đợi | Đạt | Ghi chú |
|---|---|---|---|---|
| 44.25 | Thêm món đầu tiên | Ảnh bay vào thanh giỏ; thanh giỏ trượt lên, số chạy; nút + thành bộ tăng / giảm | [ ] | |
| 44.26 | Giỏ: đổi số lượng, sửa ghi chú, Xóa hết (hỏi lại); tải lại trang | Tổng đúng; giỏ còn sau khi tải lại | [ ] | |
| 44.27 | Gửi gọi món | Màn "Đã gửi" có danh sách món, ghi **chờ nhân viên xác nhận** | [ ] | |
| 44.28 | Món của tôi khi phục vụ xác nhận / bỏ món, bếp làm, mang ra | Trạng thái đổi ngay; món bị bỏ có lý do; thanh 4 bước + tranh động đổi theo | [ ] | |
| 44.29 | Hủy món chờ xác nhận / chờ chế biến; món đang nấu | Hủy được; đang nấu thì không có nút hủy | [ ] | |
| 44.30 | Hủy cả set | Cả set Đã hủy, tạm tính trừ đúng giá set | [ ] | |
| 44.31 | Mở cùng QR trên 2 điện thoại, cả hai gửi | Cùng một đơn, điện thoại kia tự thấy món mới | [ ] | |

**44F. Chuông gọi nhân viên**

| # | Thao tác | Mong đợi | Đạt | Ghi chú |
|---|---|---|---|---|
| 44.32 | Đổi loại Hỗ trợ / Tư vấn món / Khác; Khác để trống | Gợi ý đổi theo loại; để trống báo nhập nội dung | [ ] | |
| 44.33 | Gửi → bấm chuông lần nữa | Chuông đỏ nhấp nháy; lần 2 hiện đang chờ + **Hủy yêu cầu** | [ ] | |
| 44.34 | Phục vụ bấm Tôi đến | Khách thấy "Nhân viên … đang đến bàn bạn" | [ ] | |

**44G. Thanh toán, hóa đơn, cảm ơn**

| # | Thao tác | Mong đợi | Đạt | Ghi chú |
|---|---|---|---|---|
| 44.35 | Thanh toán khi giỏ còn món chưa gửi | Hỏi 3 lựa chọn: gửi bếp / bỏ / quay lại | [ ] | |
| 44.36 | Bàn chưa gọi món bấm Thanh toán | Báo chưa có món | [ ] | |
| 44.37 | Chọn hình thức, VAT (MST sai rồi đúng) → Gửi; **Hủy yêu cầu** | Lỗi tại ô MST; gửi xong "Đã yêu cầu"; hủy thì trở lại "Thanh toán" | [ ] | |
| 44.38 | Thu ngân lập hóa đơn | Hóa đơn tự bật lên, có mã QR chuyển khoản; gọi thêm món bị chặn | [ ] | |
| 44.39 | Thu ngân thu tiền xong | "Cảm ơn quý khách!"; Xem thực đơn về thẳng thực đơn; bàn lại "chưa mở" | [ ] | |

**44H. Trường hợp đặc biệt**

| # | Thao tác | Mong đợi | Đạt | Ghi chú |
|---|---|---|---|---|
| 44.40 | Mã QR sai (`/goi-mon/abc`) | Trang báo mã không hợp lệ, có tranh | [ ] | |
| 44.41 | Bàn tạm ngừng | "Bàn đang tạm ngừng phục vụ…" | [ ] | |
| 44.42 | Ngoài giờ mở cửa | Viên "Ngoài giờ phục vụ · mở lại …"; xem được, không gửi được | [ ] | |
| 44.43 | Món trong giỏ vừa bị đánh dấu tạm hết | Món bị đánh dấu, phải xóa mới gửi được | [ ] | |
| 44.44 | Không phục vụ nào vào ca | Món nằm chờ; khách tự hủy được | [ ] | |
| 44.45 | Bỏ ảnh bìa trong Cấu hình | Đầu trang nền đỏ – nâu có "Chào mừng đến với Royal Beef" | [ ] | |
| 44.46 | Vuốt mạnh trong Món của tôi / Giỏ / Thanh toán | Không lộ trang phía sau | [ ] | |

**Liên quan:** Phục vụ (31–34), Bếp (28), Thu ngân (36, 37), Món ăn / Set (9–11), Cấu hình (18).

## Trang 45. Trợ lý tư vấn món (trên trang QR)

| # | Thao tác | Mong đợi | Đạt | Ghi chú |
|---|---|---|---|---|
| 45.1 | Nút **Tư vấn món**; thêm món cho thanh giỏ hiện | Nút tự đẩy lên, không che thanh giỏ | [ ] | |
| 45.2 | Mở khung chat | Tên bot, avatar, lời chào, câu gợi ý nhanh đúng cấu hình | [ ] | |
| 45.3 | "4 người, khoảng 1,5 triệu, không cay" | Thực đơn cả bàn trong ngân sách; thẻ món có ảnh, giá, lý do; nút **Thêm tất cả vào giỏ** | [ ] | |
| 45.4 | Hỏi tiếp "rẻ hơn", "món khác" | Giữ chủ đề, không lặp món | [ ] | |
| 45.5 | "di ung sua" (không dấu) | Không gợi ý món có sữa, có lời nhắc dị ứng | [ ] | |
| 45.6 | Hỏi một món cụ thể ("lẩu sa tế có cay không") | Giá, mô tả, độ cay, còn / hết | [ ] | |
| 45.7 | Có Ribeye trong giỏ → "ăn kèm gì" | Gợi ý theo giỏ | [ ] | |
| 45.8 | Bấm Thêm / ảnh món / Xem set | Thêm vào giỏ (không tự gửi); mở chi tiết; mở màn set | [ ] | |
| 45.9 | "mấy giờ mở cửa" | Trả lời theo FAQ | [ ] | |
| 45.10 | Câu lạ | Lời xin lỗi đã cấu hình; câu vào "Câu hỏi chưa giải đáp" | [ ] | |
| 45.11 | Đóng / mở lại khung; đóng tab rồi mở lại | Cùng tab còn hội thoại; đóng tab thì mất | [ ] | |
| 45.12 | Món tạm hết; món tắt "AI gợi ý"; tắt Chatbot | Không gợi ý món đó; tắt Chatbot thì nút biến mất | [ ] | |

**Liên quan:** Chatbot (16), Món ăn (10).

---

# Phần 9. Website khách hàng (`http://<máy>:3000/`, không đăng nhập)

Mỗi trang kiểm trên **máy tính và điện thoại**.

## Trang 46. Trang chủ dài một trang (`/`)

| # | Thao tác | Mong đợi | Đạt | Ghi chú |
|---|---|---|---|---|
| 46.1 | Mở trang trên máy tính | Ảnh đầu trang phủ kín màn hình, tên **Royal Beef** chữ có chân rất lớn hiện dần từng chữ; góc trái: danh hiệu + "Cuộn xuống"; góc phải: khẩu hiệu, đoạn giới thiệu ngắn, nút **Đặt bàn ngay** (đỏ) + **Xem thực đơn** | [ ] | |
| 46.2 | Thanh trên | Trong suốt khi ở đầu trang, cuộn xuống thì có nền tối; menu: Món đặc trưng · Trải nghiệm · Không gian · Câu chuyện · Thực đơn · Liên hệ + nút đỏ **Đặt bàn ngay**; mục đang xem có gạch chân | [ ] | |
| 46.3 | Bấm từng mục trên menu | Cuộn mượt tới đúng mục (Thực đơn mở trang sách lật); địa chỉ đổi thành `/#mục` | [ ] | |
| 46.4 | Cuộn qua ảnh đầu trang | Hiện nút nổi **Đặt bàn ngay** góc dưới phải (điện thoại: ngang đáy màn); tới form đặt bàn hoặc chân trang thì nút ẩn | [ ] | |
| 46.5 | Mục **Lưu ý** (3 thẻ) | Giờ phục vụ (gộp các ngày cùng giờ, ghi ngày nghỉ), Quy định đặt bàn (đặt trước tối thiểu, tối đa bao nhiêu ngày, số khách, thời lượng, ghi chú của quán), Khu vực & phòng riêng (số tầng / bàn / chỗ, tên khu) — đúng cấu hình | [ ] | |
| 46.6 | Mục **Món đặc trưng** | Ảnh toàn màn tự chuyển ~6 giây, tên món chữ to ở giữa; mũi tên ← →, chấm chọn ảnh; rê chuột vào thì dừng tự chuyển; chưa nhập món đặc trưng thì dùng món bán chạy | [ ] | |
| 46.7 | Mục **Trải nghiệm** | Dòng đầu **Set menu** (tự lấy các set đang bán, giá từ …, nút Xem các set); các dòng sau do Quản lý nhập; rê / bấm một dòng thì mở mô tả và ảnh bên phải đổi theo | [ ] | |
| 46.8 | Trải nghiệm → **Đặt bàn cho dịp này** | Cuộn tới form đặt bàn, ô Ghi chú điền sẵn tên dịp (vd. "Tiệc sinh nhật") | [ ] | |
| 46.9 | Mục **Không gian** | Ảnh album tự chuyển, chữ "Không gian" lớn, dòng số liệu **"x tầng \| y bàn \| z chỗ ngồi"** khớp Sơ đồ bàn (bàn ngừng dùng không tính), chú thích ảnh, địa chỉ; album trống thì nền tối vẫn có số liệu | [ ] | |
| 46.10 | Không gian → **Xem tất cả n ảnh** | Hộp xem ảnh lớn; ← → đổi ảnh, dải ảnh nhỏ bên dưới, Esc / ✕ đóng | [ ] | |
| 46.11 | Mục **Câu chuyện** | Nửa chữ (tiêu đề, các đoạn giới thiệu, điểm nhấn chữ in hoa nhỏ, nút Giữ chỗ cho bạn) — nửa ảnh | [ ] | |
| 46.12 | Mục **Lá thư từ bếp trưởng** | Lá thư chữ viết tay hiện dần từ trái sang, ảnh chân dung, "Thân mến," + tên + chức danh; Quản lý xóa lá thư thì mục này ẩn | [ ] | |
| 46.13 | Mục **Đặt bàn** | Nửa ảnh (kèm số gọi) — nửa form, form giống trang 49; gửi được ngay tại trang chủ (xem 49.2–49.4) | [ ] | |
| 46.14 | Chân trang (= Liên hệ) | Địa chỉ + Chỉ đường trên Google Maps (bản đồ nhỏ nếu dán link nhúng), điện thoại, email, giờ mở cửa (tô hôm nay), mạng xã hội, liên kết, tên quán chữ cực lớn; "Đăng nhập nhân viên" | [ ] | |
| 46.15 | Máy tính bật **tắt hiệu ứng** của Windows (hoặc F12 → Rendering → prefers-reduced-motion: reduce) | Website vẫn chạy đủ hiệu ứng (chữ hiện dần, ảnh trượt, mục hiện dần khi cuộn) | [ ] | |
| 46.16 | Điện thoại | Các khối xếp một cột, không kéo ngang được; thanh trên chỉ có tên + ☰; ☰ mở menu phủ kín màn hình chữ lớn, bấm mục thì đóng menu và cuộn tới | [ ] | |
| 46.17 | Tiêu đề trên website (tên quán, tên các mục, sách thực đơn) | Phông **Cormorant Garamond** (nhóm chọn 27/11/2026), đủ dấu tiếng Việt; trang gọi món QR vẫn dùng Playfair Display như cũ | [ ] | |

## Trang 47. Link cũ Giới thiệu / Album / Liên hệ (`/gioi-thieu`, `/album`, `/lien-he`)

| # | Thao tác | Mong đợi | Đạt | Ghi chú |
|---|---|---|---|---|
| 47.1 | Mở `/gioi-thieu` | Về trang chủ, cuộn tới mục **Câu chuyện** | [ ] | |
| 47.2 | Mở `/album` | Về trang chủ, cuộn tới mục **Không gian** | [ ] | |
| 47.3 | Mở `/lien-he` | Về trang chủ, cuộn tới chân trang (Liên hệ) | [ ] | |

## Trang 48. Thực đơn (`/thuc-don`)

| # | Thao tác | Mong đợi | Đạt | Ghi chú |
|---|---|---|---|---|
| 48.1 | Lọc danh mục; tìm "bit tet" (không dấu); Xóa từ khóa | Đúng; không có thì "Thực đơn đang được cập nhật" / không có kết quả | [ ] | |
| 48.2 | Khối Set menu | Hiện set đang bán | [ ] | |
| 48.3 | Món tạm hết | Nhãn "Tạm hết hôm nay" | [ ] | |
| 48.4 | Món / danh mục Quản lý tắt trên website | Không hiện ở đây, vẫn còn ở trang QR | [ ] | |
| 48.5 | Mở `/thuc-don` lần đầu trong phiên | Bàn tay nhỏ làm động tác kéo góc trang sang trái + dòng "Kéo góc trang sang trái, hoặc bấm phím → để lật sách" (điện thoại: "Vuốt sang trái…"); chạm / bấm / cuộn bất kỳ hoặc sau ~7 giây thì tắt; mở lại trong phiên không hiện nữa | [ ] | |
| 48.6 | Máy tắt hiệu ứng (như 46.15) | Sách vẫn lật trang có hiệu ứng (không đổi sang sách tĩnh) | [ ] | |

## Trang 49. Đặt bàn (`/dat-ban`)

| # | Thao tác | Mong đợi | Đạt | Ghi chú |
|---|---|---|---|---|
| 49.1 | Mở form | Họ tên, SĐT, số khách, ngày, giờ, khu vực (nếu cho chọn, có "Để nhà hàng sắp xếp"), email, ghi chú — đúng cấu hình trang 7 | [ ] | |
| 49.2 | Gửi khi để trống / SĐT sai | Lỗi dưới từng ô, không mất dữ liệu đã nhập | [ ] | |
| 49.3 | Mở ô giờ hôm nay và ngày mai; chọn ngày nghỉ | Giờ trong giờ mở cửa, đúng bước giờ, bỏ giờ quá sát; ngày nghỉ không chọn được | [ ] | |
| 49.4 | Gửi đúng | Hiện mã `DB-…`, thông tin lịch; nút "Đặt thêm lịch khác" | [ ] | |
| 49.5 | Khối "Đoàn đông hoặc đặt tiệc?" | Số điện thoại bấm gọi được trên điện thoại | [ ] | |
| 49.6 | Sau khi đặt | Quản lý nhận thông báo, lịch có ở trang 6 | [ ] | |
| 49.7 | Trang `/dat-ban` vẫn mở riêng được (gửi link cho khách) | Cùng form với mục Đặt bàn ở trang chủ | [ ] | |

## Trang 50. Album — đã gộp vào trang chủ (`/album`)

| # | Thao tác | Mong đợi | Đạt | Ghi chú |
|---|---|---|---|---|
| 50.1 | Xem mục **Không gian** ở trang chủ (46.9, 46.10) | Trang Album riêng đã gộp vào trang chủ (27/11/2026) | [ ] | |

## Trang 51. Liên hệ — đã gộp vào trang chủ (`/lien-he`)

| # | Thao tác | Mong đợi | Đạt | Ghi chú |
|---|---|---|---|---|
| 51.1 | Xem chân trang ở trang chủ (46.14) | Trang Liên hệ riêng đã gộp vào trang chủ (27/11/2026) | [ ] | |

## Trang 52. Không tìm thấy (đường dẫn lạ, vd. `/abc`)

| # | Thao tác | Mong đợi | Đạt | Ghi chú |
|---|---|---|---|---|
| 52.1 | Mở `/abc` | Trang "Không tìm thấy trang" theo giao diện website, nút Về trang chủ / Xem thực đơn | [ ] | |

---

# Phần 10. Kiểm tra xuyên suốt (làm sau khi xong các trang)

Những điểm này cần **nhiều trang cùng khớp**. Làm một bữa ăn trọn vẹn trên bàn T05 rồi đối chiếu.

| # | Kiểm tra | Mong đợi | Đạt | Ghi chú |
|---|---|---|---|---|
| X1 | Một bữa ăn: khách nhờ mở bàn → phục vụ mở → khách gửi → phục vụ xác nhận (bỏ 1 món) → bếp làm → phục vụ mang → khách yêu cầu thanh toán → thu ngân lập hóa đơn, thu tiền | Mỗi bước, các màn hình liên quan đổi ngay không cần tải lại | [ ] | |
| X2 | Bàn gọi set + món lẻ, thanh toán | Tổng tiền giống nhau ở trang khách, hóa đơn in, Dashboard; hóa đơn có một dòng set | [ ] | |
| X3 | Món phục vụ bỏ khi xác nhận | Không xuống bếp, không tính tiền, khách thấy lý do | [ ] | |
| X4 | Khách gửi món → Quản lý đổi giá món đó → lập hóa đơn | Hóa đơn giữ giá lúc gọi | [ ] | |
| X5 | Một món tạm hết | Hết ở trang QR, website, trợ lý không gợi ý, set chứa món bị ẩn | [ ] | |
| X6 | Nhân viên vào ca trễ 10 phút bằng khuôn mặt → tạo kỳ lương | Chấm công và phiếu lương cùng ghi trễ 10 phút | [ ] | |
| X7 | Đặt bàn website cho giờ sắp tới → khách đến | Lịch ở Quản lý; bàn tím ở thu ngân; "Khách đã đến – Mở bàn" xong thì QR gọi món được | [ ] | |
| X8 | Bếp khai báo công thức món mới | Kho → nguyên liệu → Món sử dụng có món đó; Kiểm tra nguyên liệu có số phần | [ ] | |
| X9 | Sau buổi test, mở Nhật ký | Mỗi thao tác quan trọng có dòng ghi đúng người, đúng giờ | [ ] | |

---

**Gửi kết quả:** gửi các dòng **không đạt** (mã dòng, ví dụ `44.22`, kèm ghi chú / ảnh). Mình sẽ xem lỗi có lan sang các trang ở dòng
"Liên quan" không, rồi đánh giá cách sửa trước khi sửa.
