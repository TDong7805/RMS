// [14-tro-ly-goi-mon.mjs] Trợ lý gọi món trên trang QR (dựa trên luật): POST /api/public/qr/{token}/assistant
import { BASE, sql } from '../lib/env.mjs';
let pass = 0, fail = 0;
const ok = (n, c, x = '') => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'} ${n}${c ? '' : ' — ' + JSON.stringify(x).slice(0, 300)}`); };
const j = async (r) => ({ status: r.status, body: await r.json().catch(() => null) });
const token = sql("SELECT qr_token FROM dining_tables ORDER BY id LIMIT 1");
const menu = await fetch(`${BASE}/api/public/qr/${token}/menu`).then((r) => r.json());
const byId = new Map(menu.dishes.map((d) => [d.id, d]));
const cat = (d) => menu.categories.find((c) => c.id === d.categoryId)?.name ?? '';
const ask = (message, extra = {}) => fetch(`${BASE}/api/public/qr/${token}/assistant`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ message, history: [], shown: [], cart: [], ...extra }),
}).then(j);
const dishesOf = (r) => (r.body?.items ?? []).filter((i) => i.kind === 'dish').map((i) => byId.get(i.id));

let r = await ask('');
ok('câu trống → 400/422', r.status >= 400 && r.status < 500, r);
r = await fetch(`${BASE}/api/public/qr/khong-co-ma-nay/assistant`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: 'chào' }) });
ok('mã QR sai → 404', r.status === 404, r.status);

r = await ask('xin chào');
ok('chào → giới thiệu + gợi ý món + nút gợi ý nhanh', r.status === 200 && /trợ lý/.test(r.body.text) && r.body.items.length > 0 && r.body.chips.length > 0, r.body);

r = await ask('đồ uống dưới 50k');
let ds = dishesOf(r);
ok('"đồ uống dưới 50k" → chỉ đồ uống ≤ 50.000đ', ds.length > 0 && ds.every((d) => cat(d) === 'Đồ uống' && d.price <= 50000), ds.map((d) => d?.name));

r = await ask('mon khong cay'); // không dấu
ds = dishesOf(r);
ok('gõ không dấu "mon khong cay" → không món nào cay vừa / rất cay', ds.length > 0 && ds.every((d) => d.spicyLevel <= 1), ds.map((d) => [d.name, d.spicyLevel]));

r = await ask('món cay');
ds = dishesOf(r);
ok('"món cay" → toàn món có độ cay', ds.length > 0 && ds.every((d) => d.spicyLevel >= 1 || d.tags.includes('Cay')), ds.map((d) => d.name));

r = await ask('tôi dị ứng sữa, gợi ý khai vị');
ds = dishesOf(r);
ok('dị ứng sữa + khai vị → khai vị không chứa Sữa, có lưu ý', ds.length > 0 && ds.every((d) => cat(d) === 'Khai vị' && !d.allergens.includes('Sữa')) && /Lưu ý/.test(r.body.text), ds.map((d) => d.name));

r = await ask('lẩu nào ngon');
ds = dishesOf(r);
ok('"lẩu nào ngon" → toàn món lẩu', ds.length > 0 && ds.every((d) => cat(d) === 'Lẩu bò'), ds.map((d) => d.name));
const lauShown = ds.map((d) => d.id);
r = await ask('rẻ hơn', { history: ['lẩu nào ngon'], shown: lauShown });
ok('"rẻ hơn" nối tiếp → giữ chủ đề lẩu, không gợi ý món đắt hơn', r.status === 200 && dishesOf(r).every((d) => cat(d) === 'Lẩu bò' && d.price < Math.min(...lauShown.map((id) => byId.get(id).price))), r.body);

r = await ask('4 người dưới 1 triệu');
const total = (r.body.items ?? []).reduce((s, i) => s + (byId.get(i.id)?.price ?? 0) * i.qty, 0);
ok('"4 người dưới 1 triệu" → thực đơn cả bàn, có "Thêm tất cả", tổng ≤ 1.000.000đ', r.body.addAll && r.body.items.length >= 3 && total <= 1_000_000 && /4 người/.test(r.body.text), { total, text: r.body.text });

r = await ask('2 người mỗi người 200k');
const total2 = (r.body.items ?? []).reduce((s, i) => s + (byId.get(i.id)?.price ?? 0) * i.qty, 0);
ok('"mỗi người 200k" cho 2 người → ngân sách 400.000đ', /400\.000đ/.test(r.body.text) && total2 <= 400_000, { total2, text: r.body.text });

const pho = menu.dishes.find((d) => d.name === 'Phở Wagyu Úc');
r = await ask('phở wagyu giá bao nhiêu');
ok('hỏi tên món → trả giá, thành phần, độ cay; thẻ đầu là món đó', r.body.items[0]?.id === pho?.id && r.body.text.includes('165.000đ') && /Độ cay/.test(r.body.text), r.body.text);
r = await ask('cho 2 phần phở wagyu');
ok('"cho 2 phần phở wagyu" → gợi ý số lượng 2 (khách vẫn phải bấm Thêm)', r.body.items[0]?.id === pho?.id && r.body.items[0]?.qty === 2, r.body.items);

const steak = menu.dishes.find((d) => cat(d) === 'Bít tết Úc');
r = await ask('ăn kèm gì', { cart: [steak.id] });
ds = dishesOf(r);
ok('giỏ có bít tết → gợi ý món Gọi thêm + đồ uống, không lặp món trong giỏ', ds.some((d) => cat(d) === 'Gọi thêm') && ds.some((d) => cat(d) === 'Đồ uống') && !ds.some((d) => d.id === steak.id), ds.map((d) => d.name));
r = await ask('ăn kèm gì');
ok('giỏ trống → nhắc chọn món chính trước', /trống/.test(r.body.text), r.body.text);

r = await ask('set menu');
ok('"set menu" → chỉ các set đang bán', r.body.items.length > 0 && r.body.items.every((i) => i.kind === 'set'), r.body.items);

r = await ask('gọi nhân viên');
ok('"gọi nhân viên" → hướng dẫn bấm chuông, không gợi ý món', /chuông/.test(r.body.text) && r.body.items.length === 0, r.body);
// ---- Nối với Quản lý Chatbot: cấu hình, FAQ, câu hỏi chưa giải đáp, món bật "cho AI gợi ý"
const fallbackMsg = sql('SELECT fallback_message FROM chatbot_config WHERE id = 1');
sql("DELETE FROM unanswered_questions WHERE question = 'asdfgh qwerty'; SELECT 1");
r = await ask('asdfgh qwerty');
ok('câu vô nghĩa → lời xin lỗi trong cấu hình Chatbot + ví dụ', r.body.text.startsWith(fallbackMsg) && /2 người dưới 500k/.test(r.body.text), r.body.text);
await ask('asdfgh qwerty');
ok('câu không trả lời được → vào "Câu hỏi chưa giải đáp", hỏi lại thì cộng số lần', sql("SELECT asked_count FROM unanswered_questions WHERE question = 'asdfgh qwerty' AND status = 'open'") === '2');

let intro = (await fetch(`${BASE}/api/public/qr/${token}/assistant`).then(j)).body;
const botName = sql('SELECT bot_name FROM chatbot_config WHERE id = 1');
ok('GET assistant → tên bot, lời chào, câu gợi ý nhanh từ Quản lý Chatbot', intro.active === true && intro.botName === botName && intro.greeting.length > 0 && intro.chips.length > 0, intro);

const faqQ = sql("SELECT question FROM faqs WHERE is_active = 1 AND question LIKE '%mở cửa%' LIMIT 1");
if (faqQ) {
  const faqA = sql(`SELECT answer FROM faqs WHERE question = '${faqQ}'`);
  r = await ask('mấy giờ nhà hàng mở cửa vậy');
  ok('hỏi giờ mở cửa → trả lời đúng FAQ', r.body.text === faqA, r.body.text);
} else ok('có FAQ giờ mở cửa trong dữ liệu mẫu', false, 'không có');

const lau = menu.dishes.filter((d) => cat(d) === 'Lẩu bò');
sql(`UPDATE dishes SET ai_enabled = 0 WHERE id = ${lau[0].id}; SELECT 1`);
r = await ask('lẩu');
ok('món Quản lý tắt "cho AI gợi ý" → không được gợi ý', r.body.items.length > 0 && !r.body.items.some((i) => i.id === lau[0].id), r.body.items);
sql(`UPDATE dishes SET ai_enabled = 1 WHERE id = ${lau[0].id}; SELECT 1`);

sql('UPDATE chatbot_config SET is_active = 0 WHERE id = 1; SELECT 1');
intro = (await fetch(`${BASE}/api/public/qr/${token}/assistant`).then(j)).body;
r = await ask('xin chào');
ok('Quản lý tắt Chatbot → active = false, hỏi bị từ chối 409', intro.active === false && r.status === 409 && /tạm tắt/.test(r.body?.message), { intro, r });
sql('UPDATE chatbot_config SET is_active = 1 WHERE id = 1; SELECT 1');

// Món tạm hết hôm nay không được gợi ý
const out = menu.dishes.find((d) => cat(d) === 'Đồ uống' && !d.soldOut);
sql(`UPDATE dishes SET sold_out_date = CURDATE() WHERE id = ${out.id}; SELECT 1`);
r = await ask('đồ uống');
ok('món tạm hết hôm nay không có trong gợi ý', !r.body.items.some((i) => i.id === out.id), r.body.items);
r = await ask(out.name);
ok('hỏi đúng món tạm hết → báo "tạm hết", không có nút thêm món đó', /tạm hết/.test(r.body.text) && !r.body.items.some((i) => i.id === out.id), r.body);
sql(`UPDATE dishes SET sold_out_date = NULL WHERE id = ${out.id}; SELECT 1`);

r = await ask('x'.repeat(2000));
ok('câu quá dài vẫn trả lời (cắt còn 300 ký tự)', r.status === 200, r.status);

console.log(`\n${pass} PASS, ${fail} FAIL`);
