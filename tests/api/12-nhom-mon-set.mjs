// [12-nhom-mon-set.mjs] Nhóm món (thẻ gộp nhiều loại) và Set menu: thực đơn QR, gửi set, chia giá, bếp, hóa đơn, quản lý
import { BASE, DB, FIXTURES, OUT, UPLOADS, sql } from '../lib/env.mjs';
// Bộ này thử luồng bếp / thu ngân: tắt bắt buộc phục vụ xác nhận đơn (V22; luồng xác nhận thử ở bộ 13).
sql("UPDATE system_settings SET setting_value='false' WHERE setting_key='order.require_confirm'; SELECT 1");

let pass = 0, fail = 0;
const ok = (n, c, x = '') => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'} ${n}${c ? '' : ' — ' + JSON.stringify(x).slice(0, 300)}`); };
const j = async (r) => ({ status: r.status, body: await r.json().catch(() => null) });
const pub = (p, body) => fetch(BASE + '/api/public/qr/' + p, body === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(j);
async function login(user) {
  const r = await fetch(BASE + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: user, password: 'Rms@2026' }) });
  const cookie = r.headers.get('set-cookie').split(';')[0];
  const call = (method) => (path, body) => fetch(BASE + path, { method, headers: { 'Content-Type': 'application/json', Cookie: cookie }, body: body === undefined ? undefined : JSON.stringify(body) }).then(j);
  return { get: call('GET'), post: call('POST'), put: call('PUT'), patch: call('PATCH'), del: call('DELETE') };
}
const tn = await login('linh.tran');
const ql = await login('tuan.nguyen');
const bep = await login('hung.pham');
const table = (code) => ({ id: sql(`SELECT id FROM dining_tables WHERE code='${code}'`), token: sql(`SELECT qr_token FROM dining_tables WHERE code='${code}'`) });
const dishId = (code) => sql(`SELECT id FROM dishes WHERE code='${code}'`);
// Chuẩn bị: các bộ trước có thể đánh dấu "tạm hết" vài món (vd. bánh flan) → set chứa món đó bị ẩn. Bỏ đánh dấu trước khi thử.
sql('UPDATE dishes SET sold_out_date = NULL, sold_out_by = NULL WHERE sold_out_date IS NOT NULL');

/* ---------------- Thực đơn QR: nhóm món, set, bán chạy theo nhóm */
const floor = (await tn.get('/api/thu-ngan/floor')).body;
const free = floor.tables.find((t) => t.status === 'available' && !t.order && !t.reservation);
const T = table(free.code);
let menu = (await pub(T.token + '/menu')).body;
const soft = menu.groups.find((g) => g.name === 'Nước ngọt có ga');
ok('thực đơn có 3 nhóm món (vang, bia, nước ngọt)', menu.groups.length === 3, menu.groups.map((g) => g.name));
ok('nhóm Nước ngọt có 6 loại, theo thứ tự nhập, có ảnh', soft?.dishIds.length === 6 && soft.dishIds[0] === dishId('MA042') && soft.image, soft);
const coca = menu.dishes.find((d) => d.id === dishId('MA042'));
ok('món trong nhóm có groupId + tên loại', coca?.groupId === soft.id && coca.variantLabel === 'Coca-Cola', coca);
ok('món đứng riêng không có nhóm', menu.dishes.find((d) => d.id === dishId('MA013'))?.groupId === null);
const now = new Date().toLocaleTimeString('en-GB', { timeZone: 'Asia/Ho_Chi_Minh', hour12: false });
const lunchOpen = now >= '10:30' && now < '14:00';
ok(`set đang bán: 3 set cả ngày${lunchOpen ? ' + set trưa' : ' (set trưa ngoài giờ bị ẩn)'}`, menu.sets.length === (lunchOpen ? 4 : 3), menu.sets.map((s) => s.name));
const steakSet = menu.sets.find((s) => s.name === 'Set Steak cho 2 người');
ok('set có giá set, giá gốc, ảnh, danh sách món kèm số lượng', steakSet?.price === 1390000 && steakSet.originalPrice === 1547000 && steakSet.image && steakSet.items.length === 7
  && steakSet.items.find((i) => i.dishId === dishId('MA034'))?.qty === 2, steakSet);
const lauSet = menu.sets.find((s) => s.name === 'Set Lẩu nhóm 4 người');
ok('set lẩu: nước ngọt cho đổi loại (allowVariant, cùng nhóm)', lauSet?.items.find((i) => i.allowVariant)?.groupId === soft.id, lauSet?.items);
ok('bán chạy: mỗi mục là món trên thực đơn hoặc nhóm "g<id>" (không có set, không có món lẻ trong nhóm)',
  menu.bestSellers.length > 0 && menu.bestSellers.every((x) => (x.startsWith('g') ? menu.groups.some((g) => 'g' + g.id === x) : menu.dishes.some((d) => d.id === x && !d.groupId))), menu.bestSellers);

/* ---------------- Gửi set */
let r = await tn.post(`/api/thu-ngan/tables/${T.id}/open`, { guests: 4 });
const orderId = r.body.order.id;
const lauParts = lauSet.items.map((i) => ({ dishId: i.dishId, qty: i.qty, note: '' }));
// đổi 4 lon Coca thành 2 Coca + 2 Sprite
const softIdx = lauParts.findIndex((p) => p.dishId === dishId('MA042'));
lauParts.splice(softIdx, 1, { dishId: dishId('MA042'), qty: 2, note: 'Ít đá' }, { dishId: dishId('MA044'), qty: 2, note: '' });
r = await pub(T.token + '/orders', { items: [{ setId: lauSet.id, qty: 1, parts: [{ dishId: dishId('MA013'), qty: 1 }] }] });
ok('set: món không thuộc set → 422', r.status === 422 && /không đúng/.test(JSON.stringify(r.body?.fields)), r);
r = await pub(T.token + '/orders', { items: [{ setId: lauSet.id, qty: 1, parts: lauParts.slice(1) }] });
ok('set: thiếu món → 422', r.status === 422 && /chưa đủ/.test(JSON.stringify(r.body?.fields)), r);
const badVariant = lauParts.map((p) => (p.dishId === dishId('MA044') ? { ...p, dishId: dishId('MA036') } : p));
r = await pub(T.token + '/orders', { items: [{ setId: lauSet.id, qty: 1, parts: badVariant }] });
ok('set: đổi sang món khác nhóm (bia) → 422', r.status === 422, r);
r = await pub(T.token + '/orders', { items: [
  { setId: lauSet.id, qty: 1, parts: lauParts },
  { setId: steakSet.id, qty: 1, parts: [] },
  { dishId: dishId('MA041'), qty: 2, note: '' },
] });
ok('gửi 2 set + 1 món lẻ → 200', r.status === 200, r);
const order = r.body;
const lauItems = order.items.filter((i) => i.setName === 'Set Lẩu nhóm 4 người');
const steakItems = order.items.filter((i) => i.setName === 'Set Steak cho 2 người');
ok('đơn có 2 dòng set (giá set) + món con mang setId / setName', order.sets?.length === 2 && lauItems.length === 8 && steakItems.length >= 7, order.sets);
const lauSum = lauItems.reduce((a, i) => a + i.price * i.qty, 0);
const steakSum = steakItems.reduce((a, i) => a + i.price * i.qty, 0);
ok('giá chia cho món con cộng lại đúng bằng giá set', lauSum === 1090000 && steakSum === 1390000, { lauSum, steakSum });
ok('tổng đơn = giá 2 set + món lẻ', order.subtotal === 1090000 + 1390000 + 2 * 25000, order.subtotal);
ok('nước ngọt đổi loại: 2 Coca (ghi chú) + 2 Sprite', lauItems.some((i) => i.dishId === dishId('MA042') && i.qty === 2 && i.note === 'Ít đá') && lauItems.some((i) => i.dishId === dishId('MA044') && i.qty === 2));
ok('CSDL: order_sets ghi tên + giá set (bản chụp)', sql(`SELECT GROUP_CONCAT(set_price ORDER BY id) FROM order_sets WHERE order_id=${orderId}`) === '1090000.00,1390000.00');

/* ---------------- Bếp thấy từng món con kèm tên set */
const q = (await bep.get('/api/bep/queue')).body;
const kItem = q.items.find((i) => i.orderId === orderId && i.dishId === dishId('MA019'));
ok('bếp: món con hiện riêng, có tên set', kItem?.setName === 'Set Lẩu nhóm 4 người', kItem);

/* ---------------- Khách hủy món trong set → hủy cả set (khi bếp chưa làm) */
const tataki = steakItems.find((i) => i.dishId === dishId('MA003'));
r = await pub(T.token + `/items/${tataki.id}/cancel`, {});
const afterCancel = r.body;
ok('khách hủy 1 món trong set → cả set bị hủy', r.status === 200 && afterCancel.items.filter((i) => i.setName === 'Set Steak cho 2 người').every((i) => i.status === 'cancelled'), r);
ok('tổng đơn trừ đúng giá set đã hủy', afterCancel.subtotal === 1090000 + 2 * 25000, afterCancel.subtotal);
const lau = afterCancel.items.find((i) => i.dishId === dishId('MA019') && i.setName);
await bep.post('/api/bep/items/start', { ids: [lau.id] });
const roll = afterCancel.items.find((i) => i.dishId === dishId('MA001') && i.setName);
r = await pub(T.token + `/items/${roll.id}/cancel`, {});
ok('bếp đã bắt đầu 1 món của set → khách không hủy được set', r.status === 409 && /set/.test(r.body?.message), r);

/* ---------------- Thu ngân hủy 1 món con → trừ đúng phần giá đã chia; hóa đơn 1 dòng set */
r = await tn.post(`/api/thu-ngan/items/${roll.id}/cancel`, { reason: 'wrong_order', note: '' });
ok('thu ngân hủy món con trong set', r.status === 200, r);
const ord = (await pub(T.token)).body.order;
ok('tổng đơn trừ phần giá đã chia của món đó', ord.subtotal === 1090000 - roll.price * roll.qty + 2 * 25000, { sub: ord.subtotal, part: roll.price });
const pendingIds = ord.items.filter((i) => ['pending', 'cooking'].includes(i.status)).map((i) => i.id);
await bep.post('/api/bep/items/start', { ids: pendingIds.filter((id) => ord.items.find((i) => i.id === id).status === 'pending') });
await bep.post('/api/bep/items/complete', { ids: pendingIds });
r = await tn.post(`/api/thu-ngan/orders/${orderId}/invoice`, { vatCompany: '', vatTaxCode: '' });
const inv = r.body;
const setLine = inv?.lines?.find((l) => l.name === 'Set Lẩu nhóm 4 người');
ok('hóa đơn: 1 dòng set, tiền = giá set trừ món đã hủy, có danh sách món', r.status === 200 && setLine?.qty === 1 && setLine.amount === 1090000 - roll.price && /Lẩu bò Úc sa tế/.test(setLine.detail), inv?.lines);
ok('hóa đơn: không có dòng món lẻ của set, tổng đúng', inv.lines.length === 2 && inv.total === ord.subtotal, inv.lines);
await tn.post(`/api/thu-ngan/invoices/${inv.id}/pay`, { payments: [{ method: 'cash', amount: inv.total, cashGiven: inv.total }] });

/* ---------------- Set: món con tạm hết → ẩn set; ngoài giờ bán → không gửi được */
await bep.patch(`/api/bep/dishes/${dishId('MA003')}/sold-out`, { soldOut: true });
menu = (await pub(T.token + '/menu')).body;
ok('món con (tataki) tạm hết → set Steak bị ẩn', !menu.sets.some((s) => s.name === 'Set Steak cho 2 người'), menu.sets.map((s) => s.name));
await bep.patch(`/api/bep/dishes/${dishId('MA003')}/sold-out`, { soldOut: false });
await bep.patch(`/api/bep/dishes/${dishId('MA042')}/sold-out`, { soldOut: true });
menu = (await pub(T.token + '/menu')).body;
const lau2 = menu.sets.find((s) => s.name === 'Set Lẩu nhóm 4 người');
ok('món cho đổi loại tạm hết (Coca) → set vẫn bán, mặc định đổi sang loại còn hàng', lau2 && lau2.items.find((i) => i.allowVariant).dishId !== dishId('MA042'), lau2?.items);
await bep.patch(`/api/bep/dishes/${dishId('MA042')}/sold-out`, { soldOut: false });
const lunch = sql("SELECT id FROM combos WHERE name='Set Bữa trưa văn phòng'");
if (!lunchOpen) {
  await tn.post(`/api/thu-ngan/tables/${T.id}/open`, {});
  r = await pub(T.token + '/orders', { items: [{ setId: lunch, qty: 1, parts: [] }] });
  ok('set trưa ngoài 10:30–14:00 → không gửi được', r.status === 422 && /chỉ bán/.test(JSON.stringify(r.body?.fields)), r);
  const o = (await pub(T.token)).body.order;
  await tn.post(`/api/thu-ngan/orders/${o.id}/close`);
} else {
  ok('set trưa trong giờ bán → có trên thực đơn', menu.sets.some((s) => s.id === lunch));
}

/* ---------------- Quản lý: nhóm món */
const drinks = sql("SELECT id FROM dish_categories WHERE name='Đồ uống'");
r = await ql.get('/api/dish-groups');
ok('quản lý: danh sách nhóm kèm số món', r.status === 200 && r.body.find((g) => g.name === 'Nước ngọt có ga')?.dishCount === 6, r.body);
r = await ql.post('/api/dish-groups', { name: '  nước ngọt CÓ ga ', categoryId: drinks });
ok('nhóm trùng tên trong danh mục → 422', r.status === 422 && /đã có/.test(r.body?.fields?.name), r);
r = await ql.post('/api/dish-groups', { name: 'Trà các loại', categoryId: drinks, description: 'Trà pha' });
const tea = r.body;
ok('thêm nhóm → 200', r.status === 200 && tea.name === 'Trà các loại' && tea.dishCount === 0, r);
const ma037 = (await ql.get(`/api/dishes/${dishId('MA037')}`)).body;
const inputOf = (d, patch) => ({ name: d.name, categoryId: d.categoryId, price: d.price, description: d.description, image: d.image, status: d.status, ingredients: d.ingredients, allergens: d.allergens, spicyLevel: d.spicyLevel, groupId: d.groupId, variantLabel: d.variantLabel, ...patch });
r = await ql.put(`/api/dishes/${ma037.id}`, inputOf(ma037, { groupId: tea.id, variantLabel: 'Trà đào' }));
ok('gắn món vào nhóm + tên loại', r.status === 200 && r.body.groupId === tea.id && r.body.variantLabel === 'Trà đào', r);
const khaiVi = sql("SELECT id FROM dishes WHERE code='MA002'");
const ma002 = (await ql.get(`/api/dishes/${khaiVi}`)).body;
r = await ql.put(`/api/dishes/${khaiVi}`, inputOf(ma002, { groupId: tea.id }));
ok('món khác danh mục với nhóm → 422', r.status === 422 && /cùng danh mục/.test(r.body?.fields?.groupId), r);
r = await ql.del(`/api/dish-groups/${tea.id}`);
ok('xóa nhóm → món trở lại đứng riêng (không xóa món)', r.status === 204 && sql(`SELECT IFNULL(group_id,'null') FROM dishes WHERE code='MA037'`) === 'null');

/* ---------------- Quản lý: set */
r = await ql.post('/api/chatbot/combos', { name: 'Set thử', items: [{ dishId: dishId('MA013'), qty: 1 }, { dishId: dishId('MA041'), qty: 1 }], onMenu: true });
ok('set bán trên thực đơn mà chưa có giá → 422', r.status === 422 && r.body?.fields?.price, r);
r = await ql.post('/api/chatbot/combos', { name: 'Set thử', items: [{ dishId: dishId('MA013'), qty: 1, allowVariant: true }, { dishId: dishId('MA041'), qty: 1 }], price: 190000, onMenu: true });
ok('cho đổi loại món không thuộc nhóm → 422', r.status === 422 && /thuộc nhóm/.test(r.body?.fields?.dishIds), r);
r = await ql.post('/api/chatbot/combos', { name: 'Set thử', items: [{ dishId: dishId('MA013'), qty: 1 }, { dishId: dishId('MA042'), qty: 2, allowVariant: true }], price: 220000, onMenu: true, sellFrom: '17:00', sellTo: '16:00' });
ok('giờ kết thúc trước giờ bắt đầu → 422', r.status === 422 && r.body?.fields?.sellTo, r);
r = await ql.post('/api/chatbot/combos', { name: 'Set thử', description: 'Lúc lắc + 2 nước', items: [{ dishId: dishId('MA013'), qty: 1 }, { dishId: dishId('MA042'), qty: 2, allowVariant: true }], price: 220000, onMenu: true, active: true });
const testSet = r.body;
ok('thêm set → 200, giá gốc tính từ món', r.status === 200 && testSet.price === 220000 && testSet.originalPrice === 179000 + 2 * 35000 && testSet.items[1].allowVariant, r);
menu = (await pub(T.token + '/menu')).body;
ok('set mới hiện trên thực đơn QR', menu.sets.some((s) => s.id === testSet.id));
r = await ql.put(`/api/chatbot/combos/${testSet.id}`, { ...testSet, onMenu: false });
menu = (await pub(T.token + '/menu')).body;
ok('tắt "bán trên thực đơn" → ẩn khỏi QR', r.status === 200 && !menu.sets.some((s) => s.id === testSet.id), r);
r = await ql.del(`/api/chatbot/combos/${testSet.id}`);
ok('xóa set → 204', r.status === 204);
ok('thu ngân không gọi được API nhóm món', (await tn.get('/api/dish-groups')).status === 403);

console.log(`\n${pass}/${pass + fail} PASS`);
process.exit(fail ? 1 : 0);
