import type { Conversation, ConversationStatus } from '@/types';

const now = Date.now();

/* Cấu hình, FAQ, câu hỏi chưa giải đáp: đã chuyển sang CSDL (backend com.rms.chatbot). */

const TABLES = ['T03', 'SV02', 'L2-01', 'T06', 'VIP01', 'T01', 'SV05', 'L2-03'];

type C = [number, ConversationStatus, [string, string][], string[]];

const convRows: C[] = [
  [12, 'answered', [['Tôi muốn ăn món ít cay, giá vừa phải', 'Bạn có thể tham khảo: Gà nướng mật ong (145.000 ₫, cay nhẹ), Sườn non rim mặn ngọt (135.000 ₫, không cay), Đậu hũ non sốt nấm (59.000 ₫, không cay). Bạn muốn chọn món nào không?'], ['Cho mình Sườn non rim', 'Bạn xác nhận thêm 1 phần Sườn non rim mặn ngọt vào giỏ hàng nhé?'], ['Đồng ý', 'Đã thêm vào giỏ hàng. Bạn vẫn cần kiểm tra giỏ và bấm "Gửi đơn" để xác nhận.']], ['Sườn non rim mặn ngọt']],
  [35, 'answered', [['Tôi dị ứng với đậu phộng, nên chọn món nào?', 'Theo dữ liệu nhà hàng khai báo, các món không có đậu phộng gồm: Chả giò hải sản, Cá kho tộ, Gà nướng mật ong… Lưu ý: thông tin có thể chưa phản ánh nguy cơ nhiễm chéo, vui lòng xác nhận với nhân viên.']], []],
  [80, 'fallback', [['Có wifi miễn phí không?', 'Xin lỗi, mình chưa có thông tin xác nhận cho câu hỏi này. Bạn có thể bấm "Gọi nhân viên" để được hỗ trợ trực tiếp nhé.']], []],
  [150, 'answered', [['Lẩu Thái có những gì?', 'Lẩu Thái hải sản gồm tôm, mực, nghêu, cá, nấm, sả, lá chanh, ớt và nước cốt dừa. Mức cay: rất cay. Giá 395.000 ₫ cho 3–4 người.'], ['Có món lẩu nào không cay không?', 'Bạn có thể chọn Lẩu nấm chay (295.000 ₫, không cay).']], []],
  [240, 'handoff', [['Mình muốn đổi bàn ra sân vườn', 'Yêu cầu này cần nhân viên hỗ trợ. Mình đã gợi ý bạn bấm "Gọi nhân viên" để thu ngân chuyển yêu cầu cho nhân viên phụ trách.']], []],
  [400, 'answered', [['Món chay', 'Các món chay hiện có: Đậu hũ non sốt nấm, Lẩu nấm chay, Chè hạt sen long nhãn, Nước ép dưa hấu.'], ['Thêm lẩu nấm chay', 'Bạn xác nhận thêm 1 phần Lẩu nấm chay vào giỏ hàng nhé?'], ['Ok', 'Đã thêm vào giỏ hàng.']], ['Lẩu nấm chay']],
  [700, 'fallback', [['Có ghế cho em bé không?', 'Xin lỗi, mình chưa có thông tin xác nhận cho câu hỏi này.']], []],
  [1100, 'answered', [['Dưới 100.000 ₫', 'Một số món dưới 100.000 ₫: Gỏi cuốn tôm thịt (35.000 ₫), Chả giò hải sản (65.000 ₫), Cơm chiên cá mặn (95.000 ₫)…']], []],
  [1500, 'answered', [['Món bán chạy', 'Món được gọi nhiều: Gỏi cuốn tôm thịt, Gà nướng mật ong, Trà sen vàng.'], ['Gà nướng có cay không?', 'Gà nướng mật ong có mức cay nhẹ.']], []],
  [2200, 'handoff', [['Cho mình thanh toán', 'Mình không thể thực hiện thanh toán. Bạn vui lòng bấm "Gọi nhân viên" hoặc ra quầy thu ngân nhé.']], []],
  [2900, 'answered', [['Cá kho tộ có xương không?', 'Cá kho tộ dùng cá basa, ít xương dăm. Bạn nên hỏi thêm nhân viên nếu cần chắc chắn.']], []],
  [3600, 'fallback', [['Có mang thú cưng vào được không?', 'Xin lỗi, mình chưa có thông tin xác nhận cho câu hỏi này.']], []],
  [4300, 'answered', [['Tôm sú rang muối có cay không?', 'Tôm sú rang muối ớt ở mức rất cay. Nếu muốn ít cay, bạn có thể ghi chú khi gọi món.'], ['Vậy cho 1 phần, ghi chú ít cay', 'Bạn xác nhận thêm 1 phần Tôm sú rang muối ớt (ghi chú: ít cay) vào giỏ hàng nhé?'], ['Xác nhận', 'Đã thêm vào giỏ hàng.']], ['Tôm sú rang muối ớt']],
  [5200, 'answered', [['Nhà hàng mở cửa tới mấy giờ?', 'Hôm nay nhà hàng mở cửa đến 22:00.']], []],
];

/** [FAKE-DATA] Lịch sử hội thoại mẫu — thay bằng dữ liệu thật khi có phân hệ Khách hàng (chat với bot). */
export const conversationSeed: Conversation[] = convRows.map(([m, status, pairs, cart], i) => {
  const start = now - m * 60_000;
  return {
    id: `conv-${i + 1}`,
    tableCode: TABLES[i % TABLES.length],
    startedAt: new Date(start).toISOString(),
    status,
    addedToCart: cart,
    messages: pairs.flatMap(([q, a], j) => [
      { from: 'customer' as const, text: q, at: new Date(start + j * 90_000).toISOString() },
      { from: 'bot' as const, text: a, at: new Date(start + j * 90_000 + 4000).toISOString() },
    ]),
  };
});

/** [FAKE-DATA] Số lần món được nhắc đến trong hội thoại (thống kê "món được hỏi nhiều"), theo tên món. */
export const dishMentionSeed: Record<string, number> = {
  'Lẩu Thái hải sản': 48,
  'Gà nướng mật ong': 41,
  'Gỏi cuốn tôm thịt': 37,
  'Lẩu nấm chay': 30,
  'Tôm sú rang muối ớt': 26,
  'Bò lúc lắc khoai tây': 21,
  'Cá kho tộ': 17,
  'Trà sen vàng': 12,
};
