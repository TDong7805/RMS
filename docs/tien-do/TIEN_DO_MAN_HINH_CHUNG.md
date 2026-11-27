# Màn hình chung, Cổng nhân viên, khóa phục vụ theo chấm công, Tin tức & Ưu đãi (27/11/2026)

Tài liệu cho nhóm: đã làm gì, tài khoản để test, cách test, còn gì chưa xong.

> **Lưu ý cho nhóm:** đợt này **đổi lại** một quyết định của nhóm ngày 26/11 (ghi trong `TIEN_DO_THU_NGAN_BEP.md`, mục D15).
> Trước: phục vụ không bị khóa, khu lấy theo lịch ca. Nay: phục vụ **phải chấm công vào ca** mới được thao tác và nhận
> thông báo. Lý do: không để nhân viên làm việc từ nhà, và không để điện thoại vẫn báo sau khi đã tan ca.

## Tài khoản để test

Mọi tài khoản dùng mật khẩu **`Rms@2026`**. Đây là dữ liệu mẫu, chỉ có ở môi trường dev (`db/dev`). Khi chạy thật, quản lý tự tạo tài khoản ở **Tài khoản → Thêm**.

| Tài khoản | Vai trò / loại | Đăng nhập xong vào | Dùng để test |
|---|---|---|---|
| `tuan.nguyen` | Quản lý nhà hàng | `/quan-ly` | Mọi trang quản lý, Bài viết, Sơ đồ bàn, Tài khoản, Cài đặt → Chấm công |
| **`khu.thu.ngan`** | Thu ngân – **màn hình chung** (máy ở quầy) | `/thu-ngan` | Màn POS: sơ đồ bàn, đơn hàng, yêu cầu thanh toán, hóa đơn, đặt bàn tại quầy |
| **`khu.bep`** | Bếp – **màn hình chung** (màn ở bếp) | `/bep` | Màn bếp, kiểm tra nguyên liệu, công thức |
| `linh.tran` | Thu ngân – tài khoản riêng | `/nhan-vien` | Cổng nhân viên + **Chấm công nhân viên**, **Bảng lương** |
| `khoa.le` | Thu ngân – tài khoản riêng | `/nhan-vien` | Như trên (người thứ hai) |
| `hung.pham` | Bếp – tài khoản riêng | `/nhan-vien` | Cổng nhân viên: chấm công, ca, lịch sử, phiếu lương, hồ sơ |
| `mai.vo`, `son.dang` | Bếp – tài khoản riêng | `/nhan-vien` | Như trên |
| `nam.hoang` | Phục vụ | `/phuc-vu` (giao diện điện thoại) | Sơ đồ, yêu cầu, xác nhận đơn, gọi món hộ, tab **Của tôi** |
| `vy.ngo`, `phuc.do`, `quynh.ly`, `binh.vu` | Phục vụ | `/phuc-vu` | Thử nhiều phục vụ ở các khu khác nhau |
| `thao.bui` | Quản lý kho | `/kho` | Khu kho |
| `duc.huynh`, `hoa.dinh` | Bếp / Kho, **chưa đổi mật khẩu** | `/doi-mat-khau` | Bắt đổi mật khẩu lần đầu |
| `trang.phan`, `an.truong` | Thu ngân / Phục vụ, **bị khóa** | — | Đăng nhập báo "Tài khoản đã bị khóa" |

Website khách: mở `http://localhost:3000/`, không cần đăng nhập. Trang gọi món tại bàn: `/goi-mon/<mã QR của bàn>`. Lấy mã ở **Quản lý → Khu vực bàn → In mã QR**.

## Đã làm

### 1. Tách tài khoản màn hình chung và tài khoản riêng (thu ngân, bếp)
- **Màn hình chung** (`khu.thu.ngan`, `khu.bep`): máy đặt ở quầy / bếp, cả ca dùng chung.
  - Chỉ mở được màn làm việc: POS, màn bếp.
  - Nhận thông báo công việc: yêu cầu thanh toán, bếp hủy món, đặt bàn qua website, khách gọi khi chưa phục vụ nào vào ca.
  - Không chấm công, không có thông tin cá nhân, không mở bảng lương. Không có trong lịch ca, danh sách chấm công hay bảng lương.
- **Tài khoản riêng** (`linh.tran`, `hung.pham`…): chỉ vào **Cổng nhân viên `/nhan-vien`**, gồm chấm công khuôn mặt, ca làm, lịch sử chấm công, phiếu lương, hồ sơ.
  - Thu ngân có thêm **Chấm công nhân viên** (sửa tay, nhập Excel) và **Bảng lương**, chuyển khỏi máy quầy dùng chung.
  - Đường cũ `/thu-ngan/cham-cong` và `/thu-ngan/bang-luong` tự chuyển về chỗ mới.
- Quản lý chọn loại tài khoản ở **Tài khoản → Thêm / Sửa**: với vai trò Thu ngân hoặc Bếp có thêm lựa chọn "Tài khoản riêng / Màn hình chung". Đổi loại thì người đang đăng nhập bị đăng xuất ngay.
- Gõ nhầm sang khu khác thì bị đưa về khu của mình.

### 2. Chấm công chặt hơn (chống chấm công hộ bằng điện thoại)
- Ngưỡng khuôn mặt riêng cho **thu ngân / bếp: 0,3** (phục vụ giữ ngưỡng cũ). Chỉnh ở **Cài đặt → Chấm công**, khoảng 0,2–0,6.
- Bước kiểm tra người sống đổi thành **lệnh ngẫu nhiên**: quay sang trái hoặc phải (chọn ngẫu nhiên) và nhắm mắt khoảng 1 giây, thứ tự cũng ngẫu nhiên. Mỗi lệnh có 12 giây, quá giờ thì đổi bộ lệnh mới.
- Giới hạn: kiểm tra chạy trên trình duyệt, nên chặn được người giơ ảnh / video trước camera, nhưng không chặn được người sửa mã trang.

### 3. Phục vụ: khóa theo chấm công
- Chưa vào ca hoặc đã tan ca thì **chỉ xem**: không mở / đóng / chuyển / ghép bàn, không gọi món, không nhận yêu cầu, không xác nhận đơn, không có thông báo và âm báo.
- Máy chủ chặn (`WaiterGuard`, lỗi 409), giao diện cũng báo ngay khi bấm.
- Đầu màn hình hiện dải **"Chưa vào ca"** kèm nút **Chấm công**. Đăng nhập lúc đang có ca mà chưa chấm thì app tự mở trang chấm công.
- Thêm tab **Của tôi** (`/phuc-vu/toi`): chấm công / tan ca, lịch làm, lịch sử, phiếu lương, hồ sơ. Có chấm đỏ khi đang có ca mà chưa chấm.
- Không phục vụ nào vào ca thì yêu cầu của khách và đơn chờ xác nhận được báo về **quầy thu ngân**.
- Muốn ở nhà không vào ca được: nhập IP WiFi quán ở **Cài đặt → Chấm công → Mạng của quán**. Để trống là không kiểm tra mạng.

### 4. Quản lý bài viết có tác dụng trên website
- Bài **đã xuất bản** hiện trên website khách. Bài nháp hoặc đã ẩn thì không hiện.
  - Trang chủ có mục **"Tin tức & Ưu đãi"**: 3 bài mới nhất, chưa có bài thì mục tự ẩn.
  - `/tin-tuc`: mọi bài đã xuất bản, lọc theo Ưu đãi / Sự kiện / Tin tức.
  - `/tin-tuc/:slug`: đọc một bài, cuối bài có nút Đặt bàn và bài khác.
  - Menu và chân trang có thêm mục "Tin tức".
- Quản lý **ẩn bài** thì bài biến mất ngay, link cũ báo "Bài viết đã được gỡ".
- API công khai: `GET /api/public/posts?category=&limit=`, `GET /api/public/posts/{slug}`.

### Cơ sở dữ liệu
- `V30__tai_khoan_man_hinh_chung.sql`: cột `users.shared_screen`, cài đặt `attendance.face_threshold_counter` = 0,3.
- `db/dev/V30_1__tai_khoan_man_hinh_chung_mau.sql`: hai tài khoản `khu.thu.ngan`, `khu.bep`.
- Không cần xóa `rms_db`. Lần khởi động backend tiếp theo Flyway sẽ tự chạy hai file này.

## Cách test nhanh (mở nhiều trình duyệt / cửa sổ ẩn danh, mỗi cửa sổ một tài khoản)

1. **Phân quyền:**
   - Đăng nhập `khu.thu.ngan` thì vào POS. Gõ `/nhan-vien` thì bị đưa về `/thu-ngan`.
   - Đăng nhập `linh.tran` thì vào Cổng nhân viên. Gõ `/thu-ngan` thì bị đưa về `/nhan-vien`.
   - Menu ☰ của quầy không còn Chấm công / Bảng lương.
2. **Khách gọi hỗ trợ khi chưa ai vào ca:** mở trang QR của một bàn, bấm "Gọi nhân viên". Phục vụ (`nam.hoang`) không có thông báo, quầy (`khu.thu.ngan`) có.
3. **Phục vụ chưa vào ca:** `nam.hoang` bấm một bàn → Mở bàn thì bị báo "chưa vào ca". Có dải "Chưa vào ca" và nút Chấm công.
4. **Phục vụ vào ca** (cần camera; điện thoại phải mở trang bằng HTTPS):
   - Tab **Của tôi** → đăng ký khuôn mặt. Quản lý duyệt ở **Nhân viên → Khuôn mặt**.
   - Quản lý xếp ca cho `nam.hoang` đúng giờ hiện tại.
   - Quay lại tab **Của tôi** → Chấm công. Làm theo lệnh (trái/phải + nhắm mắt). Sau đó mở bàn, nhận yêu cầu được, và có thông báo khi khách gọi.
5. **Quản lý đổi sơ đồ bàn:** quản lý kéo một bàn ở Sơ đồ bàn. Phục vụ đang mở app hiện ngay "Quản lý vừa thay đổi sơ đồ".
6. **Gọi món:** khách gửi món qua QR → phục vụ đã vào ca thấy ở tab Yêu cầu → Xác nhận → món hiện trên màn `khu.bep`.
7. **Đặt bàn trên website:** khách đặt ở `/dat-ban`. `khu.thu.ngan` và quản lý nhận thông báo, `linh.tran` thì không.
8. **Bài viết:** quản lý thêm bài, chọn **Xuất bản** → trang chủ (mục Tin tức & Ưu đãi) và `/tin-tuc` có bài. Ẩn bài thì bài biến mất.
9. **Ngưỡng thu ngân:** `linh.tran` chấm công trong Cổng nhân viên (cần đăng ký khuôn mặt và có ca). Ngưỡng hiện ở Cài đặt → Chấm công.

## Kiểm thử đã chạy (CSDL `rms_test` sạch)

- **API tự động** (`node tests/run-all.mjs`): **793 / 796** bước đạt.
  - Đã cập nhật các bộ 01, 02–05, 07, 09, 12, 13, 16, 17.
  - Bộ 13 viết lại phần khóa phục vụ, thêm bước thử ngưỡng 0,3. Bộ 09 thêm 7 bước cho Tin tức trên website.
- **3 bước trượt ở bộ 15 (lá thư bếp trưởng trên website) là lỗi có sẵn, không do đợt này:**
  - Chạy toàn bộ trên code trước đợt này (commit `b5c18d8`) cũng trượt đúng 3 bước đó.
  - Chạy riêng bộ 15 thì đạt 77/77. Lỗi chỉ xuất hiện khi chạy chung sau các bộ khác.
  - Cần người phụ trách website xem lại.
- **Bấm thử bằng Chrome tự động** (Playwright): đi qua mọi trang của 7 loại tài khoản và website khách, cùng các luồng ở mục "Cách test nhanh". Không có lỗi JavaScript hay lỗi máy chủ.

## Chưa xong / cần biết

- **Chưa thử quét mặt bằng camera thật** (lệnh nhắm mắt, quay trái/phải). Kiểm thử tự động giả lập phần chấm công trong CSDL.
- Bảng **Bảng lương** trên điện thoại hẹp bị cắt cột bên phải, phải vuốt ngang mới thấy hết.
- Bài viết mẫu chưa có ảnh bìa nên website hiện khung trống. Quản lý chọn ảnh bìa thì sẽ có ảnh.
- Đặc tả Word (`DacTa_UC_DatMon_Bep_ThuNgan.docx`, `CodeUC_QLNH.docx`) **chưa cập nhật** theo đợt này.
