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
| **Dashboard thống kê** — doanh thu, món bán chạy / bán chậm | `mocks/dashboard.ts`, `api/dashboard.ts` | Doanh thu lấy từ **hóa đơn** (Thu ngân) — phân hệ này chưa làm. **Thẻ Kho đã dùng số liệu thật** (`GET /api/dashboard/inventory`) | Làm Thu ngân trước, rồi viết API thống kê đọc bảng `invoices`, `payments`, các view `v_revenue_daily`, `v_dish_sales` |
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
| `V1_1__du_lieu_mau.sql` | Tài khoản mẫu (mật khẩu `Rms@2026`), khu vực & bàn, 9 món, nguyên liệu + tồn đầu kỳ, nhà cung cấp, ca làm, 3 FAQ | — (demo) | — |
| `V1_1__du_lieu_mau.sql` | **26 lịch đặt bàn** quanh ngày tạo CSDL | **Khách hàng** (đặt qua website), **Thu ngân** (nhập tại quầy) | Khi có trang đặt bàn cho khách, lịch mới sinh qua API; dùng lại `ReservationRules.validate(...)` |
| `V1_1__du_lieu_mau.sql` | 11 nhân viên thêm (có người bị khóa, chưa đổi mật khẩu) | — (demo trang Tài khoản) | — |
| `V3_1__mon_an_mau.sql` | Thêm 16 món, danh mục "Món theo mùa" đang tắt, 3 combo | — (demo) | — |
| `V3_1__mon_an_mau.sql` | **8 đơn hàng đã hoàn tất** (`orders`, `order_items`) trong 7 ngày qua | **Khách hàng** (gọi món qua QR), **Thu ngân** | **Các đơn này CHƯA có hóa đơn / thanh toán.** Khi làm Thu ngân / Dashboard doanh thu: thêm hóa đơn mẫu cho chúng, hoặc lọc bỏ đơn không có hóa đơn |
| `V3_2__phan_ca_mau.sql` | Lịch phân ca 21 ngày quanh ngày tạo CSDL | — (demo) | **Chưa có chấm công** (`attendances`) — Thu ngân tính lương sẽ cần |
| `V3_3__bai_viet_mau.sql` | 7 bài viết (có nháp, đã ẩn), chưa có ảnh bìa | — (demo) | — |
| `V4_1__chatbot_mau.sql` | Thêm 4 FAQ | — (demo) | — |
| `V10_1__dat_mon_mau.sql` | 3 bàn đang có khách (T03, VIP01, SV01) với món ở đủ trạng thái (chờ / đang làm / đã xong / đã mang ra / đã hủy), 1 món tạm hết hôm nay | **Khách hàng** (gọi món qua QR), **Bếp** | Đơn mẫu chưa có hóa đơn — đợt 2 (thanh toán) sẽ thu tiền được cho các đơn này |
| `V9_1__kho_xuat_kiem_ke_mau.sql` | 9 phiếu xuất 10 ngày gần đây (cho bếp, hủy hư hỏng / hết hạn, khác), 3 phiếu kiểm kê (đã duyệt, bị từ chối, chờ duyệt) kèm thông báo, 4 lần thanh toán NCC. Sinh bằng `backend/database/kho-seed/gen-v9_1.mjs` | Xuất cho bếp: **Bếp** (sau này có thể tự trừ kho theo món đã bán) | — |
| `V8_1__kho_phieu_mua_mau.sql` | 8 phiếu mua ở đủ trạng thái (đã nhận đủ có thuế / giảm giá / chi phí khác, nhận một phần rồi kết thúc, nhận một phần + trễ hạn, chưa nhận, đã hủy, nháp), các phiếu nhập tương ứng, 1 phiếu nhập không phiếu và 1 thông báo trễ hạn. Sinh bằng `backend/database/kho-seed/gen-v8_1.mjs` | — (demo) | Thanh toán mẫu nằm ở V9_1 |
| `V7_1__kho_mau.sql` | Kho: 26 nguyên liệu (NL001–NL006 từ V1_1 được bổ sung nhóm, ghi chú), 6 nhà cung cấp (NCC006 đang ngừng), 26 liên kết giá theo đơn vị mua + lịch sử đổi giá, tồn đầu kỳ 35 ngày trước và vài lần xuất bếp để có đủ Sắp hết / Hết hàng. Sinh tự động, trùng bộ giả cũ của frontend | — (demo) | Chưa có phiếu mua / nhập / xuất / kiểm kê mẫu — đợt 2–3 sẽ thêm file seed riêng |
| `V7_1__kho_mau.sql` | **Công thức định lượng** (`dish_ingredients`) cho 7 món | **Bếp** (đầu bếp khai báo định lượng — trang chưa làm) | Khi làm khu Bếp: thêm UC nhập định lượng, đọc / ghi `dish_ingredients`; khu Kho chỉ hiển thị |
| `V7_1__kho_mau.sql` | **8 thông báo mẫu** (5 tồn kho gửi Kho + Quản lý, 3 đặt bàn gửi Quản lý) | Đặt bàn: **Khách hàng** (đặt qua website) | Thông báo kho đã sinh thật khi tồn giảm qua mức tối thiểu. Thông báo đặt bàn: khi làm website khách, gọi `NotificationService.sendToRoles("reservation", …, "reservations", id, ["manager"])` lúc có lịch mới |
| `V4_1__chatbot_mau.sql` | **6 câu hỏi khách hay hỏi mà bot chưa trả lời được** | **Khách hàng** (chat với bot) | Bot ghi / cộng dồn `unanswered_questions` mỗi khi không trả lời được |

Dữ liệu mẫu tính ngày giờ theo **lúc tạo CSDL**. Muốn có lại lịch "hôm nay": xóa `rms_db` rồi chạy backend
(xem `backend/database/README.md`).

## C. Chưa có (không giả, nhưng còn thiếu)

| Chức năng | Ghi chú |
|---|---|
| Cấu hình mô hình AI (nhà cung cấp, model, nhiệt độ, tên biến chứa API key) | Có bảng `ai_model_config` + quyền `ai.config`, chưa có giao diện. Làm cùng phần bot trả lời khách. Không lưu API key thật trong CSDL |
| API công khai cho khách (xem thực đơn, đọc tin tức, đặt bàn) | Thuộc phân hệ Khách hàng. Backend đã có sẵn dữ liệu (`dishes`, `posts` có `slug`, `reservations`) |
