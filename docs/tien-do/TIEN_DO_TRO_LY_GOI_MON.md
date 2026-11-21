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

## Giới hạn / bước sau (cách 2)

- Trợ lý chỉ hiểu theo từ khóa và mẫu câu, nên câu dài, vòng vo hoặc nhiều ý lồng nhau có thể hiểu chưa đúng. Những câu không hiểu đều được ghi lại để quản lý xem.
- Muốn trò chuyện tự nhiên hơn thì dùng mô hình AI thật (Claude) ở **cách 2**: chỉ cần thay phần thân `MenuAssistant.reply`, giao diện và API giữ nguyên.
  - Cách 2 cần API key, đặt trong biến môi trường (bảng `ai_model_config.api_key_ref` chỉ lưu *tên* biến), và tốn phí theo lượng dùng.
