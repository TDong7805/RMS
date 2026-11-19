# Dữ liệu giả còn lại trong hệ thống

File này ghi lại **mọi chỗ chưa dùng dữ liệu thật**: chỗ nào, vì sao, và cần gì để thay.
Khi làm xong một phần ở đây, **xóa dòng tương ứng**. Khi thêm dữ liệu giả mới, **ghi vào đây**.

Có hai loại, khác nhau hoàn toàn:

| Loại | Nằm ở đâu | Mất khi tải lại trang? | Có khi chạy thật? |
|---|---|---|---|
| **A. Dữ liệu giả ở giao diện** | `frontend/src/mocks`, một phần `frontend/src/api` | Có — thao tác không lưu đi đâu | Có (đây là phần cần làm tiếp) |
| **B. Dữ liệu mẫu trong CSDL** | `backend/src/main/resources/db/dev` | Không — lưu thật trong MySQL | **Không** — chỉ nạp ở profile `dev` |

Tìm nhanh trong code:

```bash
grep -rn "BACKEND-TODO\|FAKE-DATA" frontend/src      # loại A
ls backend/src/main/resources/db/dev                  # loại B
```

---

## A. Dữ liệu giả ở giao diện (chưa có backend)

| Trang / chức năng | File | Vì sao còn giả | Cần gì để thay |
|---|---|---|---|
| **Chatbot AI — Lịch sử hội thoại** | `mocks/chatbot.ts` (`conversationSeed`), `api/chatbot.ts` (`getConversations`) | Chỉ có khi **khách chat với bot** (phân hệ Khách hàng) | Làm phần bot trả lời khách, ghi bảng `chat_conversations` / `chat_messages`, rồi viết API đọc |
| **Chatbot AI — Thống kê & báo cáo** | `api/chatbot.ts` (`getChatbotStats`), `mocks/chatbot.ts` (`dishMentionSeed`) | Tính từ lịch sử hội thoại (chưa có). Số theo ngày đang là công thức giả | Như trên, tính từ `chat_conversations`, `chat_message_dishes`, `unanswered_questions` |
| **Ô tìm kiếm — "Trang truy cập gần đây"** | `mocks/notifications.ts` (`recentPagePaths`), `api/search.ts` | Chỉ là tiện ích giao diện | Có thể lưu vào `localStorage` của trình duyệt; không cần backend |

**Không phải dữ liệu giả** (cấu hình giao diện, giữ nguyên được): cấu trúc menu bên trái (`mocks/menu.ts`), danh sách
trang cho ô tìm kiếm (`pageSuggestions` trong `mocks/notifications.ts`).

## B. Dữ liệu mẫu trong CSDL (chỉ khi phát triển)

Các file trong `db/dev` chỉ chạy ở profile `dev`. Khi chạy thật (`prod`) CSDL **không** có dữ liệu này.
Một phần là dữ liệu demo bình thường, một phần **mô phỏng dữ liệu mà actor chưa làm sẽ tạo ra** — phần này cần chú ý
khi làm actor đó.

| File | Nội dung | Mô phỏng actor nào | Lưu ý khi làm actor đó |
|---|---|---|---|
| `V1_1__du_lieu_mau.sql` | Tài khoản mẫu (mật khẩu `Rms@2026`, email @royalbeef.vn), khu vực & bàn, 8 danh mục món, 6 nguyên liệu bò đầu tiên + tồn đầu kỳ, 2 nhà cung cấp, ca làm, 3 FAQ | — (demo) | — |
| `V1_1__du_lieu_mau.sql` | **26 lịch đặt bàn** quanh ngày tạo CSDL | **Khách hàng** (đặt qua website), **Thu ngân** (nhập tại quầy) | Khi có trang đặt bàn cho khách, lịch mới sinh qua API; dùng lại `ReservationRules.validate(...)` |
| `V1_1__du_lieu_mau.sql` | 11 nhân viên thêm (có người bị khóa, chưa đổi mật khẩu) | — (demo trang Tài khoản) | — |
| `V3_1__mon_an_mau.sql` | **Thực đơn Royal Beef: 55 món đang bán** (bò Úc hiện đại + món Việt, 9 danh mục: 8 danh mục ở V1_1 + **"Gọi thêm"** đặt cuối — khoai nghiền, salad, bánh mì bơ tỏi, 3 sốt, bò nhúng, rau nấm, bún; đồ uống có thêm nước suối, vang chai, 6 loại nước ngọt), danh mục "Món theo mùa" đang tắt + 1 món ngừng bán (Wagyu A5). Ảnh món gắn từ `backend/database/seed-images` (xem dòng dưới) | — (demo) | Đổi thực đơn mẫu thì cả nhóm xóa `rms_db` (Flyway báo sai checksum) |
| `backend/database/seed-images/` (chỉ dev, `SeedImageLoader`) | Ảnh mẫu: ảnh món (`mon/danh-sach.csv`, 56 ảnh, tạo bằng AI theo phong cách bàn gỗ óc chó; nước ngọt dùng logo hãng), **ảnh danh mục** (`danh-muc/`), **ảnh nhóm món** (`nhom/`), **ảnh set** (`set/`), ảnh bìa `anh-bia.jpg` (biển hiệu nhung đỏ "ROYAL BEEF") — nguồn ghi ở `NGUON_ANH.md`, prompt ở `PROMPT_ANH_AI.md` | — (demo) | Ảnh chỉ gắn khi CSDL chưa có ảnh (Quản lý đổi ảnh thì không bị gắn đè) |
| `V3_1__mon_an_mau.sql` | **8 đơn hàng đã hoàn tất** (`orders`, `order_items`) trong 7 ngày qua | **Khách hàng** (gọi món qua QR), **Thu ngân** | Hóa đơn / thanh toán của 8 đơn này được thêm ở `V11_1` |
| `V3_2__phan_ca_mau.sql` | Lịch phân ca 21 ngày quanh ngày tạo CSDL | — (demo) | **Chưa có chấm công** (`attendances`) — Thu ngân tính lương sẽ cần |
| `V3_3__bai_viet_mau.sql` | 7 bài viết của Royal Beef (có nháp, đã ẩn), chưa có ảnh bìa | — (demo) | — |
| `V4_1__chatbot_mau.sql` | Thêm 4 FAQ | — (demo) | — |
| `V19_1__nhom_mon_set_mau.sql` | **3 nhóm món** (Vang đỏ Úc: ly / chai; Bia: thủ công / tươi; Nước ngọt có ga: 6 loại) và **4 set menu** bán trên thực đơn (Steak cho 2 người 1.390k, Tomahawk chia sẻ 2.390k, Lẩu nhóm 4 người 1.090k, Bữa trưa văn phòng 199k bán 10:30–14:00) — thay 3 combo gợi ý cũ, Chatbot dùng chính các set này | — (demo) | Quản lý sửa ở Món ăn → Nhóm món / Set menu |
| `V10_1__dat_mon_mau.sql` | 3 bàn đang có khách (T03, VIP01, SV01) với món ở đủ trạng thái (chờ / đang làm / đã xong / đã mang ra / bếp hủy "Hết nguyên liệu"), T-bone tạm hết hôm nay (khớp kho hết T-bone) | **Khách hàng** (gọi món qua QR), **Bếp** | Chưa có hóa đơn — thu ngân lập hóa đơn và thu tiền được cho các đơn này |
| `V11_1__hoa_don_mau.sql` | ~63 ngày lịch sử bán hàng (khoảng 690 đơn, hóa đơn đã thanh toán, tiền mặt / thẻ / chuyển khoản), yêu cầu của khách đã xử lý, 2 yêu cầu đang chờ hôm nay (T03, VIP01), món bán chạy (phở bò, bò lúc lắc, ribeye, striploin, lẩu giấm, bún bò, cơm lúc lắc, burger), món từ 300.000đ mỗi dòng 1 phần, **tài khoản nhận tiền giả** Vietcombank 1234567890 – NHA HANG ROYAL BEEF | **Khách hàng**, **Thu ngân** (để Dashboard Doanh thu / Món ăn và danh sách hóa đơn có số liệu demo) | Chỉ chạy ở môi trường dev. Dùng thật: sửa tài khoản ở Cấu hình hệ thống → Thanh toán |
| `V12_1__cham_cong_mau.sql` | Chấm công từ ngày 1 tháng trước đến hôm qua cho mọi nhân viên đang hoạt động trừ Quản lý (nghỉ khoảng 1 ngày / tuần, ca sáng / tối, nguồn Excel), 2 dòng "Thiếu giờ ra" trong tháng này, **kỳ lương tháng trước đã chốt** (phụ cấp mẫu cho linh.tran) | **Thu ngân** (nhập chấm công, chốt lương) | Kỳ tháng trước đã chốt nên chấm công tháng trước không sửa được. Muốn thử chốt lương: sửa 2 dòng thiếu giờ ra trước |
| `V9_1__kho_xuat_kiem_ke_mau.sql` | 9 phiếu xuất 10 ngày gần đây (cho bếp, hủy hư hỏng / hết hạn, khác), 3 phiếu kiểm kê (đã duyệt, bị từ chối, chờ duyệt) kèm thông báo, 4 lần thanh toán NCC. Sinh bằng `backend/database/kho-seed/gen-v9_1.mjs` | Xuất cho bếp: **Bếp** (sau này có thể tự trừ kho theo món đã bán) | — |
| `V8_1__kho_phieu_mua_mau.sql` | 8 phiếu mua ở đủ trạng thái (đã nhận đủ có thuế / giảm giá / chi phí khác, nhận một phần rồi kết thúc, nhận một phần + trễ hạn, chưa nhận, đã hủy, nháp), các phiếu nhập tương ứng, 1 phiếu nhập không phiếu và 1 thông báo trễ hạn. Sinh bằng `backend/database/kho-seed/gen-v8_1.mjs` | — (demo) | Thanh toán mẫu nằm ở V9_1 |
| `V7_1__kho_mau.sql` | Kho: **106 nguyên liệu** (thịt bò Úc các phần, rau củ, bánh / sợi, sữa / phô mai, gia vị, nước chấm, sốt pha sẵn, đồ uống; NL001–NL006 từ V1_1; Ba chỉ bò Mỹ đang ngừng dùng; Lá lốt chưa nhập; Wagyu A5 theo mùa = 0), 6 nhà cung cấp (NCC006 Phương Nam ngừng → T-bone hết hàng), 106 liên kết giá + lịch sử đổi giá, tồn đầu kỳ 35 ngày trước. Sinh bằng `backend/database/kho-seed/gen-v7_1.mjs` | — (demo) | — |
| `V7_1__kho_mau.sql` | **Công thức định lượng** (`dish_ingredients`) cho **đủ 56 món** (đã gồm nước chấm đi kèm, sốt kèm steak mặc định Tiêu đen) — bảng chi tiết ở `docs/du-lieu/CONG_THUC_DINH_LUONG.md`; giá vốn trung bình khoảng 40% giá bán | **Bếp** (khai báo định lượng) | Bếp sửa / xóa ở trang **Công thức** (`/bep/cong-thuc`); khu Kho chỉ hiển thị |
| `V7_1__kho_mau.sql` | **8 thông báo mẫu** (5 tồn kho gửi Kho + Quản lý, 3 đặt bàn gửi Quản lý) | Đặt bàn: **Khách hàng** (đặt qua website) | Thông báo kho đã sinh thật khi tồn giảm qua mức tối thiểu. Thông báo đặt bàn: khi làm website khách, gọi `NotificationService.sendToRoles("reservation", …, "reservations", id, ["manager"])` lúc có lịch mới |
| `V4_1__chatbot_mau.sql` | **6 câu hỏi khách hay hỏi mà bot chưa trả lời được** | **Khách hàng** (chat với bot) | Bot ghi / cộng dồn `unanswered_questions` mỗi khi không trả lời được |

Dữ liệu mẫu tính ngày giờ theo **lúc tạo CSDL**. Muốn có lại lịch "hôm nay": xóa `rms_db` rồi chạy backend
(xem `backend/database/README.md`).

## C. Chưa có (không giả, nhưng còn thiếu)

| Chức năng | Ghi chú |
|---|---|
| Cấu hình mô hình AI (nhà cung cấp, model, nhiệt độ, tên biến chứa API key) | Có bảng `ai_model_config` + quyền `ai.config`, chưa có giao diện. Làm cùng phần bot trả lời khách. Không lưu API key thật trong CSDL |
| API công khai cho khách (xem thực đơn, đọc tin tức, đặt bàn) | Thuộc phân hệ Khách hàng. Backend đã có sẵn dữ liệu (`dishes`, `posts` có `slug`, `reservations`) |
