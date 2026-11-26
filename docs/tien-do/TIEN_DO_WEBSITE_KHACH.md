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

## E1 – Trang chủ dài một trang (bản dựng thử, 27/11/2026)

Theo mục E1 của `docs/thiet-ke/QUY_TAC_GIAO_DIEN.md` (ảnh tham khảo `dot-E-WebsiteKH/E1.png`) + nhóm chốt: gộp 3 trang vào trang chủ, nội dung mới nhập ở Cấu hình, chụp 3 phông để chọn, ảnh nhóm tự tạo bằng AI, giữ sách thực đơn và thêm hướng dẫn thao tác.
- **Trang chủ** (`pages/khach/HomePage.tsx`): Đầu trang → Lưu ý trước khi đặt bàn → Món đặc trưng → Trải nghiệm → Không gian → Câu chuyện → Lá thư từ bếp trưởng → Đặt bàn → chân trang (Liên hệ). Hiệu ứng: chữ hiện dần, ảnh trôi chậm / tự trượt, mục hiện dần khi cuộn (`features/public-site/motion.ts`, `home.css`) — **luôn bật**, kể cả máy bật giảm chuyển động (`globals.css` chừa `.site-root`).
- **Khung** (`PublicLayout.tsx`): thanh trên trong suốt trên ảnh đầu trang, cuộn có nền, tô mục đang xem; nút nổi *Đặt bàn ngay*; ☰ điện thoại phủ kín màn hình; chân trang mới (tên quán chữ cực lớn, bản đồ nhỏ nếu link nhúng). Bỏ ô tìm món ở thanh trên.
- **Đường dẫn:** `/gioi-thieu` → `/#gioi-thieu`, `/album` → `/#khong-gian`, `/lien-he` → `/#lien-he`; xóa `AboutPage`, `GalleryPage`, `ContactPage`. Form đặt bàn tách thành `ReservationForm.tsx`, dùng chung trang chủ và `/dat-ban`.
- **Máy chủ:** migration `V29` (đặt V27 lúc làm, đổi V29 khi gộp vì trùng số với migration chatbot của nhóm; website_content thêm lời bếp trưởng + ảnh cạnh form; bảng `website_features` loại signature / experience); `GET/POST/PUT/PATCH move/DELETE /api/website/features`; `/api/public/site` thêm `chef`, `reserveImage`, `signatures`, `experiences`, `space` (số tầng / khu / bàn / chỗ từ sơ đồ bàn). Ảnh toàn khổ giữ tới 2400px (`ImageStore.applyWide`; giao diện nhận file gốc tới 15 MB rồi tự thu nhỏ). Ảnh mẫu: `seed-images/website/danh-sach.csv` (`SeedImageLoader.applyWebsite`).
- **Cấu hình → Website** đổi sang kiểu dòng: Đầu trang · Món đặc trưng · Trải nghiệm · Không gian – album · Câu chuyện · Lời từ bếp trưởng · Đặt bàn · Mạng xã hội & bản đồ · Thực đơn trên website; thanh Lưu dính đáy.
- **Sách thực đơn:** hướng dẫn bàn tay kéo góc trang (`FlipGuide.tsx`, lần đầu mỗi phiên); luôn lật trang, không còn rơi về sách tĩnh khi máy tắt hiệu ứng.
- **Kiểm thử:** bộ 15 thêm 20 bước (bếp trưởng, món đặc trưng / trải nghiệm, giới hạn 8 mục, ẩn / đổi thứ tự / xóa file ảnh, số liệu không gian; album không còn giả định album mẫu trống) → **77 / 77**. Chạy 17 bộ: **753 / 755** (2 bước bộ 13 sai vì chạy lúc 00:51 — bài test tạo ca "giờ hiện tại − 1 tiếng" rơi sang hôm qua; không liên quan E1). Giao diện: 29 / 29 bước (máy tính + iPhone 13, có bật giảm chuyển động), không lỗi trang.
- **Còn chờ:** ảnh AI (prompt ở `backend/database/seed-images/website/PROMPT_ANH_WEBSITE.md`); nhóm chọn phông (`?phong=1|2|3`) rồi bỏ hai phông còn lại.
- **Dòng phiếu test cần test:** trang 46 (46.1–46.17, viết lại), 47 (link cũ), 48.5–48.6, 49.7, 18.8.

## Thực đơn dạng sách lật trang (flipbook)
- `/thuc-don` hiển thị dạng sách (`features/public-site/flipbook/FlipMenu`). Dạng danh sách cũ vẫn giữ ở `/thuc-don/danh-sach` (nút ☰ trên thanh sách).
- Hiệu ứng lật dùng thư viện **`page-flip` 2.0.7** (StPageFlip, MIT), bọc trong `PageFlipBook.tsx`:
  - Rê chuột vào 4 góc ngoài thì góc cong lên (vùng kích hoạt 72px, cong theo con trỏ). Bấm vào góc đang cong thì lật hẳn.
  - Kéo hoặc vuốt thì trang gập theo đường chéo, bám con trỏ, có bóng dọc nếp gập. Thả quá nửa (hoặc vuốt nhanh) thì lật; chưa đủ thì bật về chỗ cũ. Lật mất 700ms.
  - Trên màn cảm ứng: khi mở menu, góc dưới-phải tự cong nhẹ một lần mỗi phiên để gợi ý menu lật được.
  - Thư viện tự di chuyển các trang trong DOM, nên các `<div>` trang được tạo bằng JavaScript; React chỉ vẽ nội dung vào trong qua portal.
- Thư viện không làm được (đã tự bổ sung hoặc là giới hạn):
  - Vùng góc mặc định là 1/5 đường chéo trang và không có tùy chọn để chỉnh. Mình thu về 72px bằng cách ghi đè `isPointOnCorners` trên từng phiên bản sách.
  - Không có lệnh "cong một nửa". Gợi ý cong góc trên màn cảm ứng dùng hàm nội bộ `showCorner()` của thư viện.
  - Không có hiệu ứng mờ dần. Khi bật giảm chuyển động, dùng `StaticBook` thay thế.
  - Không tự chia lại trang khi xoay máy. Sách được dựng lại tại trang đang xem (`startPage`).
  - **Mặt sau của trang đang lật luôn là trang kế tiếp** (giống sách in thật), không đặt riêng được một ảnh nền. Ảnh line-art chỉ dùng cho trang trống cuối sách, hoặc cho mọi trang khi chọn `?nen=2`.
- Thẻ món có ảnh lớn:
  - Màn ngang: 2 cột, 2–4 món/trang. Màn dọc: 1 cột, 2–3 món/trang, ảnh gần hết bề ngang.
  - Trang đầu mỗi danh mục có ít món hơn nên ảnh to hơn.
  - Cỡ chữ: tiêu đề danh mục 30px chữ hoa màu vàng đồng; tên món 21px; giá 19px; mô tả 15,5px.
  - Chân trang ghi: danh mục | tên quán | số trang.
- Nền trang có 3 phương án: giấy kem (mặc định), line-art, kraft. Đổi mặc định ở `flipbook/theme.ts`, xem thử nhanh bằng `?nen=1|2|3`. Nền bao quanh sách là vân gỗ sáng.
  - Đây là ảnh tạm, tạo bằng `tools/menu-textures/gen-textures.mjs`. Danh sách file cần thay có trong `tools/menu-textures/README.md`.
  - Màu chữ đạt WCAG AA trên cả ba nền.
- Bố cục theo màn hình:
  - Màn ngang: 2 trang mở cạnh nhau. Màn dọc: 1 trang.
  - Xoay máy thì chia lại trang, nhưng vẫn giữ món đang xem.
  - Trang giữ tỉ lệ 3:4, khung cao `100dvh`.
- Cách lật trang:
  - Vuốt trên điện thoại hoặc máy tính bảng.
  - Kéo mép hoặc góc trang bằng chuột.
  - Nút ‹ ›, phím ← → (không lật khi đang gõ trong ô tìm).
  - Chọn mục lục, hoặc chọn một kết quả tìm kiếm (sách lật tới món đó và làm món nhấp nháy nổi bật).
- Thứ tự trang: bìa trước → mục lục → mỗi danh mục bắt đầu một trang mới → set menu → bìa sau (địa chỉ, liên hệ, giờ mở cửa).
- Tự chia món sang trang sau theo chiều cao trang thật. Lưới thẻ có số hàng cố định trên mỗi trang nên không món nào bị cắt giữa hai trang.
- Chỉ vẽ các trang đang hiện. Ảnh của 1–2 trang kế tiếp được tải trước.
- Khi người dùng bật giảm chuyển động (`prefers-reduced-motion`), đổi trang bằng hiệu ứng mờ dần thay vì lật.
- Ô tìm kiếm dùng component `SearchField`, viết lại để sửa lỗi kính lúp đè lên chữ. Font ô nhập 16px nên iOS không tự phóng to khi chạm vào.
- Website chưa có thông tin wifi để in ở bìa sau. Nếu cần, thêm trường vào `website_content` bằng một migration mới.

## Lưu ý
- Danh hiệu "Michelin Selected 2026" và link mạng xã hội trong dữ liệu mẫu là **giả** (chỉ có ở dev).
- Album mẫu trống. Tải ảnh ở tab Website khách hàng.
- Giới hạn 5 lượt đặt hợp lệ mỗi IP trong 10 phút được lưu trong bộ nhớ, khởi động lại backend thì đếm lại từ 0.

## Việc để sau
- Trang tin tức `/tin-tuc` đọc từ `posts` (đã có `slug` và trạng thái xuất bản).
- Khách tra cứu hoặc hủy lịch đã đặt bằng mã và SĐT (hiện phải gọi nhà hàng).
- Gửi email hoặc SMS xác nhận cho khách (cần dịch vụ gửi thư hoặc SMS).

## Chatbot tư vấn trên website (V27, 23/11/2026)
- Nút nổi "Tư vấn món" ở góc phải mọi trang website (`features/public-site/SiteAssistant.tsx`). Điện thoại: khung chat chiếm cả màn hình.
- API: `GET /api/public/site/assistant` (bật/tắt, tên, ảnh, lời chào, câu gợi ý), `POST /api/public/site/assistant` `{message, history, shown, sessionId}` → `{text, cards, chips, actions, source}`. Tắt thì 409.
- Cùng bộ não với trợ lý tại bàn (`MenuAssistant.replyWebsite`: Gemini, dự phòng trả lời theo luật; FAQ; cấu hình Quản lý Chatbot). Khác:
  - không có giỏ món; chỉ gợi ý món `ai_enabled` VÀ đang hiện trên website;
  - trả lời địa chỉ, giờ mở cửa, hotline lấy từ Cấu hình hệ thống; câu về thanh toán / gọi nhân viên / wifi trả lời theo ngữ cảnh khách chưa tới quán;
  - nút hành động `reservation` (→ `/dat-ban`) và `contact` (→ `/lien-he`). Gemini đặt cờ `booking`; thực đơn cho cả nhóm luôn kèm nút Đặt bàn.
- Bấm thẻ món → `/thuc-don?mon=<id>` (hoặc `?set=<id>`): sách mở tới trang có món và làm món nổi bật. Id set trong sách dùng khóa `set:<id>` (id set và id món có thể trùng số).
- Công tắc: Quản lý Chatbot → Cấu hình: "Bật Chatbot AI" (chung) và "Hiện trên website khách hàng" (`chatbot_config.website_enabled`).
- Hội thoại lưu vào `chat_conversations` với `channel = 'website'`, `table_id` NULL; "Lịch sử hội thoại" hiện cột bàn là "Website". Giới hạn Gemini 8 câu/phút theo IP.
- Hội thoại giữ trong `sessionStorage` của tab; nút ↻ bắt đầu phiên mới.
