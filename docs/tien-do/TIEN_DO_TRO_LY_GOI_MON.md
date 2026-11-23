# Trợ lý gọi món trên trang QR (cách 1 — dựa trên luật)

_Cập nhật 21/11/2026_

> **Bản hiện tại chỉ là ví dụ** (trả lời theo luật, không dùng AI). Sau này sẽ gắn mô hình AI thật vào — xem mục "Giới hạn / bước sau".

## Khách thấy gì

- Trên trang gọi món QR có nút nổi **"Tư vấn món"** (góc phải dưới, tự đẩy lên khi thanh giỏ hiện).
- Bấm vào sẽ mở khung chat. Khách gõ câu hỏi hoặc bấm câu gợi ý nhanh, trợ lý trả lời kèm **thẻ món** (ảnh, giá, lý do gợi ý) và nút **Thêm**.
- Gợi ý thực đơn cho cả bàn có thêm nút **Thêm tất cả vào giỏ**. Bấm vào ảnh món sẽ mở chi tiết món; thẻ set có nút **Xem set**.
- **Trợ lý không tự thêm vào giỏ.** Giỏ vẫn phải bấm *Xác nhận gọi món*, rồi được phục vụ xác nhận như thường (V22).
- Hội thoại lưu trong trình duyệt theo bàn (sessionStorage), đóng tab là mất.

## Trợ lý hiểu được

| Khách hỏi | Ví dụ | Trợ lý làm |
|---|---|---|
| Ngân sách | "dưới 200k", "1.500.000", "1,5 triệu", "mỗi người 200k" | Lọc theo giá; "mỗi người" thì nhân với số người |
| Số người | "4 người", "cả nhà", "cặp đôi", "nhóm bạn" | Ghép **thực đơn cả bàn**: lẩu (mỗi 3 người một nồi), món chính, khai vị, đồ uống; nằm trong ngân sách |
| Khẩu vị | "không cay", "món cay", "chay", "cho bé", "ăn nhẹ", "không ăn bò" | Lọc theo độ cay và nhãn (Chay, Trẻ em thích, Món nhẹ, Ít dầu mỡ) |
| Dị ứng | "dị ứng sữa", "không ăn được đậu phộng" | Loại món có chất đó, kèm lời nhắc dị ứng trong cấu hình |
| Loại món | "lẩu", "bít tết", "phở", "đồ uống", "tráng miệng", "set menu" | Lọc theo danh mục; "set menu" thì chỉ hiện set |
| Một món cụ thể | "phở wagyu giá bao nhiêu", "lẩu sa tế có cay không" | Báo giá, mô tả, thành phần, độ cay, dị ứng, còn hay tạm hết; "cho 2 phần …" thì gợi ý số lượng 2 |
| Ăn kèm | "ăn kèm gì", "gọi thêm gì" | Dựa vào giỏ: bít tết → sốt, khoai nghiền, vang; lẩu → bò nhúng, rau, bún; nhắc đồ uống / tráng miệng nếu thiếu |
| Hỏi tiếp | "rẻ hơn", "món khác", "không cay" | Giữ chủ đề các câu trước và không lặp lại món đã gợi ý |
| Câu hỏi chung | "mấy giờ mở cửa", "có chỗ đậu xe không" | Trả lời theo **FAQ** do quản lý nhập |
| Gọi nhân viên / thanh toán | | Hướng dẫn bấm chuông / vào *Món của tôi → Thanh toán* |

- Gõ có dấu hay không dấu đều hiểu ("mon khong cay").
- Không bao giờ gợi ý món ngừng bán, món tạm hết hôm nay, hoặc món quản lý đã tắt *"cho AI gợi ý"*.

## Nối với Quản lý Chatbot (đã có từ trước)

| Trang quản lý | Ảnh hưởng tới trợ lý |
|---|---|
| Cấu hình → Bật / tắt | Tắt thì nút "Tư vấn món" biến mất; câu hỏi gửi lên bị từ chối 409 |
| Tên bot, ảnh đại diện, lời chào, câu gợi ý nhanh | Hiện ở đầu khung chat |
| Lời xin lỗi khi không hiểu, lời nhắc dị ứng | Dùng nguyên văn |
| Thực đơn → bật / tắt "cho AI gợi ý" từng món | Món tắt không được gợi ý |
| FAQ | Câu khách khớp FAQ → trả lời FAQ |
| Câu hỏi chưa giải đáp | Câu trợ lý không trả lời được tự ghi vào đây (cùng câu thì cộng số lần) để quản lý thêm FAQ |

## Kỹ thuật

- Backend: [MenuAssistant.java](../../backend/src/main/java/com/rms/ordering/MenuAssistant.java).
  - `GET /api/public/qr/{token}/assistant`: tên, lời chào, gợi ý nhanh, trạng thái bật / tắt.
  - `POST /api/public/qr/{token}/assistant`: nhận `{message, history, shown, cart}`, trả `{text, items[{kind, id, qty, note}], chips, addAll}`.
- Frontend: [QrAssistant.tsx](../../frontend/src/features/ordering/QrAssistant.tsx), gắn vào `QrOrderPage`.
- Không gọi dịch vụ AI bên ngoài nên **không tốn phí**; xử lý mỗi câu chỉ vài mili-giây, không cần máy mạnh.
- Không cần migration mới (dùng các bảng chatbot_config, faqs, unanswered_questions, dishes.ai_enabled, dish_ai_tags có từ V1).
- Kiểm thử: `tests/api/14-tro-ly-goi-mon.mjs` (26 bước).

## Gemini AI (cập nhật 23/11/2026, V25)

Trợ lý giờ trả lời bằng **Google Gemini** khi máy chủ có API key; bộ trả lời theo luật ở trên vẫn giữ làm **dự phòng**.

**Cài key (mỗi máy chạy backend làm một lần):**
1. Lấy key ở Google AI Studio (aistudio.google.com → Get API key).
2. Mở file `backend/.env.properties` (file riêng của máy, git bỏ qua), thêm dòng `GEMINI_API_KEY=khóa-của-bạn`. Hoặc đặt biến môi trường bằng PowerShell: `setx GEMINI_API_KEY "khóa-của-bạn"`.
3. Khởi động lại backend. Nếu dùng `setx`: đóng **mọi** cửa sổ PowerShell / terminal / VS Code đang mở trước (để chúng đọc biến mới).
4. Vào **Quản lý Chatbot → Cấu hình**, xem thẻ "Trí tuệ nhân tạo" báo *Máy chủ đã có key* → bấm **Thử kết nối**.

Mỗi người dùng key của chính mình: key nằm trong máy, không đi theo code lên GitHub. Máy không có key thì trợ lý tự trả lời theo luật.

Key **không** nằm trong mã nguồn hay CSDL: bảng `ai_model_config.api_key_ref` chỉ lưu tên biến `GEMINI_API_KEY`.

**Quản lý Chatbot → Cấu hình → "Trí tuệ nhân tạo (Google Gemini)":**
- bật / tắt Gemini;
- chọn model (mặc định `gemini-3.5-flash-lite`: khoảng 1,5 giây mỗi câu, có gói miễn phí);
- chỉnh độ sáng tạo;
- ghi tên biến môi trường chứa key;
- thêm hướng dẫn riêng cho AI;
- nút **Thử kết nối**.

**Cách chạy mỗi câu hỏi:**
- Gửi kèm cho Gemini: thực đơn hôm nay (chỉ món đang bán, chưa hết, được bật "cho AI gợi ý"), set menu, FAQ, giỏ món, 4 câu hỏi trước, và ngân sách khách nêu nếu có. Tên bot, giọng điệu, lời nhắc dị ứng và câu trả lời khi ngoài phạm vi lấy từ trang Quản lý Chatbot.
- Gemini trả JSON (câu trả lời, món gợi ý theo id, câu gợi ý nhanh). Khung chat hiện thẻ món kèm nút **Thêm** như trước, có thêm nhãn "✨ Gemini AI".

**Máy chủ kiểm tra lại kết quả của Gemini:**
- Bỏ những món không có trong thực đơn hoặc đã hết.
- Giá luôn lấy từ CSDL.
- Máy chủ **tự cộng tiền**: vượt ngân sách khách nêu thì dùng câu trả lời theo luật. Lý do là model hay cộng sai.

**Tự quay về trả lời theo luật khi:**
- Gemini bị tắt hoặc chưa có key;
- một bàn hỏi quá 8 câu / phút (tránh bị phá làm cạn lượt miễn phí);
- lỗi mạng, quá 12 giây, Google quá tải (503), JSON sai hoặc bị cắt.

Khách không bao giờ thấy lỗi.

**Mã nguồn:**
- `chatbot/GeminiClient.java`, `chatbot/AiModelService.java` (cấu hình, thử kết nối);
- `ordering/GeminiAssistant.java`;
- `MenuAssistant.reply` gọi Gemini trước;
- `frontend/src/features/chatbot/AiModelCard.tsx`.

**Kiểm thử:** bộ `14-tro-ly-goi-mon.mjs` (32 bước) tắt Gemini rồi thử phần theo luật và trang cấu hình AI, nên chạy được cả khi không có mạng hay key.

**Lưu ý:** ở gói miễn phí, Google có thể dùng nội dung chat để cải thiện sản phẩm của họ. Muốn dùng thật cho khách thì nên chuyển sang gói trả phí.

## Lưu hội thoại (cập nhật 23/11/2026, V26)

Mỗi câu khách hỏi và câu bot trả lời trên trang QR đều được lưu lại. Quản lý xem ở **Quản lý Chatbot → Lịch sử hội thoại** và **Thống kê & báo cáo** (trước đây hai tab này dùng dữ liệu giả).

- **Một hội thoại** = một phiên chat trên một thiết bị: trình duyệt tạo mã phiên, giữ tới khi đóng tab. Hội thoại gắn với bàn và đơn đang mở.
- **Kết quả của hội thoại:**
  - *Đã trả lời*: bot trả lời được hết.
  - *Ngoài phạm vi*: có câu bot không trả lời được (câu đó cũng vào "Câu hỏi chưa giải đáp").
  - *Chuyển nhân viên*: khách hỏi gọi nhân viên hoặc thanh toán.
  - Kết quả chỉ nâng lên, không hạ xuống.
- **Các thông tin được ghi lại:**
  - món bot gợi ý → "Món được hỏi nhiều";
  - món khách bấm **Thêm** từ thẻ gợi ý → "Khách thêm món sau tư vấn";
  - nguồn câu trả lời của bot (Gemini hay theo luật).
- **API:**
  - `GET /api/chatbot/conversations?keyword=&date=&status=&page=`
  - `GET /api/chatbot/stats?days=7`
  - `POST /api/public/qr/{token}/assistant/added`
- **Mã nguồn:** `ordering/ChatLogService.java`, `ordering/ChatLogController.java`.
- Lưu hội thoại bị lỗi thì khách vẫn được trả lời bình thường.

## Giới hạn / bước sau (cách 2)

- Trợ lý chỉ hiểu theo từ khóa và mẫu câu, nên câu dài, vòng vo hoặc nhiều ý lồng nhau có thể hiểu chưa đúng. Những câu không hiểu đều được ghi lại để quản lý xem.
- Đã có Gemini (mục trên). Bộ theo luật vẫn dùng khi Gemini không sẵn sàng.
