# Đánh giá test bằng mắt – đợt 1 (24/11/2026)

Nguồn: `ket-qua-test-rms-20261124-1203.json`. Mã dòng (vd. `36.4`) là mã trong [KICH_BAN_TEST.md](../KICH_BAN_TEST.md).

## Tổng quan

| | Số dòng |
|---|---|
| Tổng | 337 (332 gốc + 5 dòng tự thêm) |
| Đạt | 283 |
| Lỗi | 1 (`36.4`) |
| Chưa test | 53 |
| Có ghi chú | 54 |

Nhiều dòng bấm **Đạt** nhưng ghi chú tả một lỗi hoặc góp ý. Sau khi đọc từng ghi chú, kết quả thật như sau:
**10 lỗi cần sửa**, **12 góp ý giao diện**, **6 câu hỏi nghiệp vụ cần nhóm quyết**, còn lại là chạy đúng (giải đáp ở cuối).

Mức độ: **Cao** = sai nghiệp vụ hoặc chặn công việc · **TB** = dễ thao tác nhầm / khó dùng · **Thấp** = khó chịu nhỏ.

---

## 1. Lỗi cần sửa

| # | Dòng | Lỗi | Nguyên nhân (đã xem code) | Mức | Đề xuất sửa |
|---|---|---|---|---|---|
| L1 | 36.4 | Thu ngân **chưa vào ca thì không xem được gì**: bấm bàn, đổi tab đều không được | Khung thu ngân khóa **toàn bộ** màn hình khi chưa vào ca. Máy chủ chỉ chặn thao tác ghi, xem vẫn được, nên giao diện đang chặn quá tay | Cao | Chỉ khóa các nút thao tác (mở bàn, hủy, lập hóa đơn, thu tiền…); bấm bàn, xem đơn, xem hóa đơn vẫn được; có thanh nhắc "Bạn chưa vào ca — chỉ xem" như bên phục vụ |
| L2 | 6.3, 6.4 | **Không có chỗ thêm lịch đặt bàn** cho khách gọi điện / đến quầy | Máy chủ không có chức năng tạo lịch cho nhân viên, chỉ có xem, sửa, đổi trạng thái. Dữ liệu mẫu lại có nguồn "điện thoại", "quầy" | Cao | Thêm nút **Thêm lịch đặt** ở trang Đặt bàn (Quản lý, có thể cả Thu ngân), dùng chung quy tắc với đặt bàn website (giờ mở cửa, trùng bàn, số khách) |
| L3 | 32.2 | Gọi món hộ: **không xem chi tiết set**, **không đổi loại nước** trong set (trang QR của khách thì đổi được) | Trang phục vụ gửi set với món mặc định | TB | Dùng lại màn chi tiết set của trang QR (độ chín, sốt, chia loại nước) cho phục vụ |
| L4 | 28.13 | Bếp hủy món: **mặc định chọn sẵn "Hết nguyên liệu" và tick "Đánh dấu tạm hết"** → lỡ bấm là món thành tạm hết dù kho còn | Hộp hủy món đặt sẵn lý do đầu tiên và tick tạm hết | TB | Không chọn sẵn lý do; chỉ hiện tick tạm hết khi chọn "Hết nguyên liệu" và để **tắt** mặc định; ghi rõ "Món sẽ ẩn khỏi thực đơn hôm nay" |
| L5 | 28.9 | Bếp: món bị hủy **chỉ hiện nhãn ĐÃ ĐỔI khi bàn còn món khác**; hủy hết món của bàn thì chỉ nháy thông báo rồi mất | Món hủy chỉ được gắn vào thẻ bàn đang có món | TB | Giữ một dải nhỏ **"Vừa hủy (10 phút)"** ở đầu màn bếp cho món đã hủy mà thẻ bàn không còn; không trộn vào thẻ món đang làm (ý bạn lo rối là đúng) |
| L6 | 30.2 | Công thức: lỗi ở dòng phía dưới, nút Lưu ở trên, **bấm Lưu như không có gì xảy ra** | Không cuộn tới dòng lỗi | TB | Bấm Lưu mà có lỗi thì cuộn tới dòng lỗi đầu tiên + báo "Còn n dòng chưa hợp lệ"; nút Lưu dính cố định ở đáy hoặc đầu màn |
| L7 | 1.3 | Màn hình chờ **chớp lên khi tải lại** dù trang tải nhanh | Bản màn hình chờ của React hiện ngay nếu trang đã mở quá 0,3 giây, không tự đợi | Thấp | Bản React cũng đợi 0,3 giây kể từ lúc nó xuất hiện mới hiện hình |
| L8 | 44.7 | Trang QR: **vuốt nhanh dải danh mục cong** thì nó nhảy về mục cũ rồi mới tới mục mới | Dải chọn mục khi dừng cuộn và trang cuộn theo, hai việc đè nhau khi vuốt nhanh | Thấp | Khi khách đang vuốt dải thì bỏ qua lệnh "xoay theo trang" cho tới khi dừng hẳn |
| L9 | 8.2 | Trùng tên khu vực chỉ báo "thông tin chưa hợp lệ" chung chung | Thông báo lỗi không nói rõ | Thấp | Báo ngay tại ô: "Tên khu vực đã tồn tại" |
| L10 | 2.8 | Tên đăng nhập có khoảng trắng đầu / cuối thì không đăng nhập được | Code **đã** cắt khoảng trắng đầu / cuối ở cả giao diện lẫn máy chủ, lẽ ra phải được | Cần thử lại | Thử lại `" linh.tran "` (khoảng trắng chỉ ở đầu / cuối). Vẫn không được thì là lỗi, mình xem tiếp. Khoảng trắng ở giữa tên thì không đăng nhập được là đúng |

## 2. Góp ý giao diện / trải nghiệm

Chạy đúng nhưng nên làm tốt hơn. Phần lớn là ý của bạn, mình thấy hợp lý.

| # | Dòng | Góp ý | Đề xuất |
|---|---|---|---|
| G1 | 5.1, 5.5, 5.6 | Dashboard đổi kỳ thì **chớp như tải lại trang**; 3 khối xếp dọc thừa khoảng trống, chữ nhỏ | Đổi kỳ: giữ số cũ rồi **chạy số** sang số mới, biểu đồ chuyển mượt; thanh % đưa tên món + số phần vào trong / cạnh thanh; khi màn rộng xếp lại thành lưới 2 cột cho kín chỗ. Hướng: gọn, đủ hiểu, không nhồi |
| G2 | 9.3 | Thông báo hệ thống nền đen nhiều chữ khó đọc (cả sáng lẫn tối) | Thông báo ngắn 1 dòng, màu theo loại (thành công / cảnh báo / lỗi); nội dung dài (vd. vì sao không xóa được) chuyển vào hộp thoại có nút |
| G3 | 11.6 | Xóa dữ liệu quan trọng (set…) lỡ tay thì phải tạo lại | Thay vì bắt gõ chữ "xác nhận", nên: **ẩn thay vì xóa** (set đã có trạng thái Tắt) + hộp xóa ghi rõ hậu quả; hoặc thông báo "Đã xóa · **Hoàn tác**" trong 10 giây. Gõ chữ chỉ nên dùng cho việc cực nguy hiểm (phục hồi sao lưu) |
| G4 | 12.3 | Lịch phân công **theo ca** chữ chen chúc, nhiều người sẽ rối | Mỗi ô ca hiện **số người theo bộ phận** dạng chip ("PV 3 · Bếp 2 · TN 1", thiếu người tô đỏ); bấm ô mở danh sách chi tiết. Kiểu "theo nhân viên" giữ như hiện tại |
| G5 | 20.2 | Dashboard kho: 4 nút chức năng trông giống tiêu đề thường | Đổi thành nút rõ ràng (viền màu / nền nhạt + biểu tượng) |
| G6 | 3.2 | Hai ô tìm kiếm (trên thanh trên và trong trang) dễ tưởng thừa | Không thừa: ô trên = **tìm trang / chức năng** (Ctrl+K), ô trong trang = **lọc dữ liệu** trang đó. Đổi chữ gợi ý cho rõ: "Tìm trang… Ctrl+K" và "Tìm món theo tên, mã…" |
| G7 | 3.1 | Thu gọn menu thì có **chấm đỏ trên logo** (là số thông báo), dễ tưởng lỗi | Khi thu gọn, đặt chấm đỏ đúng trên biểu tượng chuông, có chú thích khi rê chuột |
| G8 | 2.3 | Sai mật khẩu thì khung đăng nhập chớp | Giữ khung đứng yên, chỉ hiện lỗi dưới ô; nút Đăng nhập hiện "Đang kiểm tra…" |
| G9 | 2.10 | Đăng xuất rồi bấm Back ra website khách | Không lộ dữ liệu nên không phải lỗi bảo mật; nên về trang đăng nhập cho đúng ý người dùng |
| G10 | 32.1, 32.2 | Gọi món hộ xong bấm quay lại về sơ đồ thay vì bàn đang mở; biểu tượng độ cay xấu | Quay lại đúng bảng bàn vừa mở; độ cay hiện bằng chữ ngắn ("Cay nhẹ / vừa / nhiều") giống trang QR |
| G11 | 28.12 | Bếp bấm tên bàn mở chi tiết đơn, thông tin gần trùng với thẻ | Giữ nhưng cho đáng mở: lịch sử các đợt, món đã xong / đã hủy, ghi chú của khách, giờ khách vào; hoặc bỏ để màn bếp gọn |
| G12 | 1.1 | Trên máy tính khó thấy steak chín dần | Máy tính tải nhanh nên màn hình chờ chỉ hiện chốc lát, chấp nhận được. Sửa L7 xong sẽ ít chớp hơn. Không cần làm thêm |

## 3. Câu hỏi nghiệp vụ – cần nhóm quyết

| # | Dòng | Câu hỏi | Hiện tại | Mình đề xuất |
|---|---|---|---|---|
| H1 | 34.2 | Bếp ("Đã lấy") và phục vụ ("Đã mang") **cùng đánh dấu một việc**, bên này bấm thì bên kia mất theo | Cả hai đều chuyển món sang "đã mang ra" | Có phục vụ rồi thì bếp chỉ cần **Xong**; phục vụ bấm **Đã mang**. Bỏ "Đã lấy" ở bếp, hoặc chỉ giữ khi Quản lý tắt chế độ có phục vụ |
| H2 | 37.2, 37.3, 33.4 | **Ai được hủy món, ở trạng thái nào?** | Khách: hủy món chờ xác nhận / chờ chế biến · Phục vụ: bỏ món khi xác nhận · Thu ngân: hủy món chờ chế biến (không hủy món chờ xác nhận) · Bếp: hủy khi hết nguyên liệu | Chốt bảng này và ghi vào đặc tả. Mình thấy hợp lý; chỉ cần thêm: phục vụ được hủy món chờ chế biến khi khách đổi ý tại bàn |
| H3 | 23.6 | Kho tự **ghi nhận thanh toán cho nhà cung cấp**, có nên vậy? | Kho ghi, Quản lý xem công nợ | Quán nhỏ để Kho ghi là được. Muốn chặt hơn: Kho ghi "đề nghị thanh toán", Quản lý xác nhận |
| H4 | 5.5 | Bán chạy ở Dashboard **có tính đồ uống không?** | Tính mọi món đang bán (trang QR chỉ tính món ăn) | Dashboard để quản lý xem, nên có cả hai: tab Món ăn / Đồ uống, hoặc bộ lọc danh mục |
| H5 | 2.9 | "Ghi nhớ đăng nhập" nên vào thẳng hay chỉ điền sẵn tên? | Vào thẳng (giữ phiên lâu) | Giữ như hiện tại, đây là cách phổ biến. Máy dùng chung ở quầy thì đừng tick |
| H6 | 9.4 | Danh mục chỉ ngừng được, không xóa | Đúng thiết kế, để giữ lịch sử món đã bán | Giữ. Có thể cho xóa danh mục **chưa từng có món** |

## 4. Giải đáp – chạy đúng, không phải lỗi

| Dòng | Giải đáp |
|---|---|
| 2.6 | `localhost:3000` vào thẳng website khách là đúng: từ 22/11 website khách nằm ở trang gốc `/`. Trang nhân viên vẫn ở `/dang-nhap`, `/quan-ly`… |
| 2.11 | `next=//trang-khac.com` không đưa người dùng ra trang ngoài là **đúng và an toàn** (chống lừa chuyển hướng). Thấy trang "Không tìm thấy" của website là chấp nhận được |
| 3.8 | Quay lại tab sau một lúc thấy trang "tải lại": trang tự lấy lại dữ liệu mới khi quay lại, không phải hết phiên. Hết phiên là sau 2 giờ không thao tác |
| 5.5 | % trên thanh = **số phần bán so với món bán nhiều nhất trong kỳ** (món đứng đầu = 100%), không phải % doanh thu. Hai tab Bán chạy / Bán chậm dùng chung thang |
| 10.4 | Món thuộc danh mục có nhóm mới chọn được nhóm, không thì "Món đứng riêng": đúng |
| 37.3 | Thu ngân không có nút hủy món **chờ xác nhận** vì đó là việc của phục vụ (bỏ món) hoặc khách tự hủy (xem H2) |
| 44.11 | "Tiết kiệm đến x%" = % cao nhất trong các set đang hiện (làm tròn xuống). Thêm set giảm 20% thì hiện "Tiết kiệm đến 20%" |
| 4.4 | Chưa gặp trường hợp thông báo trỏ tới dữ liệu đã xóa: bình thường, khó tạo. Đợt sau có thể thử bằng cách xóa một bài viết / set rồi bấm thông báo cũ |

## 5. Chưa test (53 dòng) – để đợt 2

- **Cả trang:** 16 Chatbot AI, 45 Trợ lý tư vấn, 46–52 Website khách (đang có thêm thực đơn sách lật trang mới).
- **Kho nhận hàng:** 21.3, 21.6, 22.5, 23.6, 24.2–24.4 (bạn ghi chưa rõ quy trình). Đợt 2 mình sẽ viết sẵn kịch bản từng bước kèm số liệu.
- **Khác:** 37.2, 37.3 (chờ chốt H2), 43.6 (WiFi), X4, X5.
- **6.3, 6.4:** không có chức năng (xem L2).

## 6. Kịch bản cần sửa theo kết quả đợt 1

- 6.3, 6.4: viết lại sau khi có chức năng thêm lịch (L2).
- 36.4: ghi rõ "chưa vào ca vẫn xem được" sau khi sửa L1.
- 37.2, 37.3, 34.2: viết lại theo kết quả H1, H2.
- 28.13: viết lại theo cách sửa L4.

## 7. Đề xuất cho đợt 2

1. **Cách ghi:** chạy sai mong đợi thì bấm **Lỗi**; chạy đúng nhưng muốn góp ý thì bấm Đạt và ghi chú bắt đầu bằng `GÓP Ý:`; chưa hiểu quy trình thì `HỎI:`. Như vậy số Lỗi trên phiếu phản ánh đúng.
2. **Lỗi logic khó thấy bằng mắt** (như bạn nói) không nên dồn cho người test. Đề xuất:
   - Mình **rà nghiệp vụ trong code**: luồng tiền (set, hủy món, hóa đơn, doanh thu), trạng thái món, quyền theo vai trò và theo ca, chấm công → lương, kho (nhận một phần, giá vốn, kiểm kê). Rà xong ra danh sách rủi ro.
   - Bổ sung **kiểm thử tự động** cho các quy tắc đó, máy kiểm thay người.
   - Kịch bản tay đợt 2 có **số liệu cụ thể** (vd. "gọi set 1.390.000 + 2 Coca, hủy 1 Coca → hóa đơn phải là …"), người test chỉ cần so số.
3. **Thứ tự đợt 2:** test lại các lỗi đã sửa → các trang chưa test (16, 45–52, kho nhận hàng) → luồng xuyên suốt X1–X9.
