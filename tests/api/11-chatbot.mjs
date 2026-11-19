// [11-chatbot.mjs] E16: cấu hình chatbot, FAQ
import { BASE, DB, FIXTURES, OUT, UPLOADS, sql } from '../lib/env.mjs';
// Kiểm thử API Chatbot AI: cấu hình + FAQ + câu hỏi chưa giải đáp. CSDL tạm (DB=...).
let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => { cond ? pass++ : fail++; console.log(`${cond ? 'PASS' : 'FAIL'} ${name}${cond || !extra ? '' : ' — ' + String(extra).slice(0, 300)}`); };
function client() {
  const jar = {};
  return async (method, p, body) => {
    const headers = { 'Content-Type': 'application/json' };
    const cookie = Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; ');
    if (cookie) headers.Cookie = cookie;
    const res = await fetch(BASE + p, { method, headers, body: body ? JSON.stringify(body) : undefined });
    for (const sc of res.headers.getSetCookie?.() ?? []) { const [k, v] = sc.split(';')[0].split('='); if (v) jar[k] = v; else delete jar[k]; }
    let data = null; try { data = await res.json(); } catch {}
    return { status: res.status, data };
  };
}
const m = client();
await m('POST', '/api/auth/login', { username: 'tuan.nguyen', password: 'Rms@2026' });

// ---------------------------------------------------------------- Cấu hình
let r = await m('GET', '/api/chatbot/config');
const cfg = r.data;
ok('Đọc cấu hình từ CSDL (tên Roy, 5 gợi ý nhanh, có cảnh báo dị ứng)', r.status === 200 && cfg.botName === 'Roy' && cfg.quickReplies.length === 5 && cfg.allergyDisclaimer.length > 0 && cfg.updatedAt, JSON.stringify(cfg).slice(0, 200));
const { updatedAt: _u, ...base } = cfg;
r = await m('PUT', '/api/chatbot/config', { ...base, botName: ' ', avatar: '', greeting: '', quickReplies: ['a', 'b', 'c', 'd', 'e', 'f', 'g'], fallbackMessage: '', fallbackAction: 'xyz', tone: 'rude', personality: 'x'.repeat(501), allergyDisclaimer: '  ' });
ok('Cấu hình sai → 422 đủ các ô', r.status === 422 && ['botName', 'avatar', 'greeting', 'quickReplies', 'fallbackMessage', 'fallbackAction', 'tone', 'personality', 'allergyDisclaimer'].every((k) => r.data.fields[k]), JSON.stringify(r.data.fields));
ok('Cảnh báo dị ứng là bắt buộc (nguyên tắc AI)', /bắt buộc/.test(r.data.fields.allergyDisclaimer));
r = await m('PUT', '/api/chatbot/config', { ...base, quickReplies: ['Món chay', 'MON CHAY'] });
ok('Gợi ý nhanh trùng (không phân biệt hoa thường, dấu) → 422', r.status === 422 && /trùng/.test(r.data.fields.quickReplies));
r = await m('PUT', '/api/chatbot/config', { ...base, quickReplies: ['Một gợi ý dài hơn ba mươi ký tự cho phép'] });
ok('Gợi ý nhanh quá 30 ký tự → 422', r.status === 422 && /30 ký tự/.test(r.data.fields.quickReplies));
r = await m('PUT', '/api/chatbot/config', { ...base, botName: '  Bé   Sen ', avatar: '👩‍🍳', active: false, tone: 'professional', fallbackAction: 'show_menu', quickReplies: [' Món chay ', '', 'Lẩu cho 4 người', 'Đồ uống'], personality: '' });
ok('Lưu cấu hình → chuẩn hóa tên, bỏ gợi ý rỗng, giữ thứ tự, avatar emoji ghép', r.status === 200 && r.data.botName === 'Bé Sen' && r.data.avatar === '👩‍🍳' && !r.data.active && r.data.tone === 'professional' && JSON.stringify(r.data.quickReplies) === '["Món chay","Lẩu cho 4 người","Đồ uống"]', JSON.stringify(r.data));
ok('Ghi người cập nhật', sql("SELECT u.username FROM chatbot_config c JOIN users u ON u.id = c.updated_by WHERE c.id = 1") === 'tuan.nguyen');
r = await m('GET', '/api/chatbot/config');
ok('Đọc lại thấy cấu hình mới', r.data.botName === 'Bé Sen' && r.data.quickReplies.length === 3 && r.data.personality === '');
await m('PUT', '/api/chatbot/config', base);

// ---------------------------------------------------------------- FAQ
r = await m('GET', '/api/chatbot/faqs');
const cats = r.data.categories;
const catId = (n) => cats.find((c) => c.name === n)?.id;
ok('FAQ từ CSDL: 7 câu, 5 danh mục, mới cập nhật trước, có câu đang tắt', r.status === 200 && r.data.faqs.length === 7 && cats.length === 5 && r.data.faqs.some((f) => !f.active) && r.data.faqs.every((f, i, a) => !i || a[i - 1].updatedAt >= f.updatedAt), `${r.data.faqs.length}/${cats.length}`);
r = await m('POST', '/api/chatbot/faqs', { question: '', answer: '', categoryId: '', active: true });
ok('FAQ thiếu dữ liệu → 422 đủ các ô', r.status === 422 && r.data.fields.question && r.data.fields.answer && r.data.fields.categoryId);
r = await m('POST', '/api/chatbot/faqs', { question: 'x'.repeat(201), answer: 'y'.repeat(1001), categoryId: catId('Đặt bàn'), active: true });
ok('Quá độ dài → 422', r.status === 422 && /200/.test(r.data.fields.question) && /1000/.test(r.data.fields.answer));
r = await m('POST', '/api/chatbot/faqs', { question: '  nhà hàng MỞ CỬA lúc mấy giờ? ', answer: 'abc', categoryId: catId('Đặt bàn'), active: true });
ok('Câu hỏi trùng FAQ đã có → 422', r.status === 422 && /đã có trong FAQ/.test(r.data.fields.question));

// ---------------------------------------------------------------- Câu hỏi chưa giải đáp
r = await m('GET', '/api/chatbot/unanswered');
const un = r.data;
ok('Câu hỏi chưa giải đáp: chỉ câu chưa xử lý, hỏi nhiều trước', r.status === 200 && un.length === 5 && un[0].askedCount === 22 && un.every((u, i) => !i || un[i - 1].askedCount >= u.askedCount) && !un.some((u) => /karaoke/.test(u.question)));
const wifi = un.find((u) => /wifi/.test(u.question));
r = await m('POST', '/api/chatbot/faqs', { question: '  Có wifi   miễn phí không? ', answer: 'Có. Mật khẩu wifi in trên menu tại bàn.', categoryId: catId('Dịch vụ khác'), active: true, fromUnansweredId: wifi.id });
const created = r.data;
ok('Tạo FAQ từ câu hỏi chưa giải đáp → 200', r.status === 200 && created.question === 'Có wifi miễn phí không?' && created.active, JSON.stringify(r.data));
ok('Câu hỏi đó chuyển "đã giải đáp", liên kết FAQ mới', sql(`SELECT CONCAT(status, '/', resolved_faq_id) FROM unanswered_questions WHERE id = ${wifi.id}`) === `resolved/${created.id}`);
r = await m('GET', '/api/chatbot/unanswered');
ok('…và biến khỏi danh sách gợi ý', r.data.length === 4 && !r.data.some((u) => u.id === wifi.id));
r = await m('PUT', `/api/chatbot/faqs/${created.id}`, { question: created.question, answer: 'Có, wifi miễn phí. Mật khẩu in trên menu.', categoryId: catId('Dịch vụ khác'), active: false });
ok('Sửa FAQ (câu trả lời, tắt)', r.status === 200 && r.data.active === false && /miễn phí/.test(r.data.answer));
r = await m('PUT', '/api/chatbot/faqs/999999', { question: 'X?', answer: 'Y', categoryId: catId('Đặt bàn'), active: true });
ok('Sửa FAQ không tồn tại → 404', r.status === 404);
const pet = un.find((u) => /thú cưng/.test(u.question));
r = await m('DELETE', `/api/chatbot/unanswered/${pet.id}`);
ok('Bỏ qua câu hỏi → 204, đánh dấu dismissed (không xóa)', r.status === 204 && sql(`SELECT status FROM unanswered_questions WHERE id = ${pet.id}`) === 'dismissed');
r = await m('DELETE', `/api/chatbot/unanswered/${pet.id}`);
ok('Bỏ qua lần nữa → 404', r.status === 404);
r = await m('DELETE', `/api/chatbot/faqs/${created.id}`);
ok('Xóa FAQ → 204', r.status === 204 && !(await m('GET', '/api/chatbot/faqs')).data.faqs.some((f) => f.id === created.id));
ok('Câu hỏi đã giải đáp vẫn giữ trạng thái khi FAQ bị xóa', sql(`SELECT CONCAT(status, '/', IFNULL(resolved_faq_id, 'null')) FROM unanswered_questions WHERE id = ${wifi.id}`) === 'resolved/null');
r = await m('DELETE', `/api/chatbot/faqs/${created.id}`);
ok('Xóa FAQ đã xóa → 404', r.status === 404);

// ---------------------------------------------------------------- Phân quyền, nhật ký
const cashier = client();
await cashier('POST', '/api/auth/login', { username: 'linh.tran', password: 'Rms@2026' });
ok('Thu ngân gọi API chatbot → 403', (await cashier('GET', '/api/chatbot/config')).status === 403);
r = await m('GET', '/api/audit-logs?module=chatbot');
const actions = (r.data.items ?? []).map((x) => x.action);
ok('Nhật ký: cấu hình, thêm / sửa / xóa FAQ, bỏ qua câu hỏi', ['Cập nhật cấu hình', 'Thêm FAQ', 'Sửa FAQ', 'Xóa FAQ', 'Bỏ qua câu hỏi chưa giải đáp'].every((a) => actions.includes(a)), actions.join(', '));
ok('Nhật ký ghi FAQ giải đáp câu hỏi khách hay hỏi', r.data.items.some((x) => /giải đáp câu hỏi khách hay hỏi/.test(x.detail ?? '')));

console.log(`\n${pass}/${pass + fail} PASS`);
process.exit(fail ? 1 : 0);
