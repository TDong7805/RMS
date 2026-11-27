// [05-mo-ban.mjs] A2b, B22–B25: mở bàn, đóng bàn, tự đóng, khách đặt trước đến
import { BASE, DB, FIXTURES, OUT, UPLOADS, sql, fakeClockIn, fakeClockOut } from '../lib/env.mjs';
fakeClockIn(); // thu ngân, bếp phải đã vào ca (V22)
// Bộ này thử luồng bếp / thu ngân: tắt bắt buộc phục vụ xác nhận đơn (V22; luồng xác nhận thử ở bộ 13).
sql("UPDATE system_settings SET setting_value='false' WHERE setting_key='order.require_confirm'; SELECT 1");
// Kiểm thử "Mở bàn": QR chỉ gửi được món khi thu ngân đã mở bàn; đóng bàn; tự đóng; khách đặt trước đến.
let pass = 0, fail = 0;
const ok = (n, c, x = '') => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'} ${n}${c ? '' : ' — ' + JSON.stringify(x).slice(0, 300)}`); };
const j = async (r) => ({ status: r.status, body: await r.json().catch(() => null) });
const pub = (p, body) => fetch(BASE + '/api/public/qr/' + p, body === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(j);
async function login(user) {
  const r = await fetch(BASE + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: user, password: 'Rms@2026' }) });
  const cookie = r.headers.get('set-cookie').split(';')[0];
  const call = (method) => (path, body) => fetch(BASE + path, { method, headers: { 'Content-Type': 'application/json', Cookie: cookie }, body: body === undefined ? undefined : JSON.stringify(body) }).then(j);
  return { get: call('GET'), post: call('POST'), put: call('PUT') };
}
const tn = await login('khu.thu.ngan');
const ql = await login('tuan.nguyen');
const table = (code) => ({ id: sql(`SELECT id FROM dining_tables WHERE code='${code}'`), token: sql(`SELECT qr_token FROM dining_tables WHERE code='${code}'`) });

// Chọn một bàn trống, không có đặt trước
const floor = (await tn.get('/api/thu-ngan/floor')).body;
const free = floor.tables.find((t) => t.status === 'available' && !t.order && !t.reservation);
const T = table(free.code);
const menu = (await pub(T.token + '/menu')).body;
const dish = menu.dishes.find((d) => !d.soldOut);

let info = (await pub(T.token)).body;
ok(`bàn ${free.code} chưa mở: QR xem được thực đơn, chưa có đơn`, info.order === null && menu.dishes.length > 10, info.order);
let r = await pub(T.token + '/orders', { items: [{ dishId: dish.id, qty: 1, note: '' }] });
ok('bàn chưa mở → gửi món bị chặn', r.status === 409 && /chưa được mở/.test(r.body?.message), r);
r = await pub(T.token + '/requests', { type: 'support', content: 'Mở bàn giúp tôi' });
ok('bàn chưa mở vẫn gọi nhân viên được (nhờ mở bàn)', r.status === 200 && r.body.support?.status === 'new', r);

r = await tn.post(`/api/thu-ngan/tables/${T.id}/open`, { guests: 120 });
ok('số khách > 99 → 422', r.status === 422, r);
r = await tn.post(`/api/thu-ngan/tables/${T.id}/open`, { guests: 3 });
ok('thu ngân mở bàn (3 khách) → đơn rỗng', r.status === 200 && r.body.order.items.length === 0 && r.body.guests === 3, r);
const orderId = r.body.order?.id;
ok('mở lần 2 → 409 "đã được mở"', (await tn.post(`/api/thu-ngan/tables/${T.id}/open`, {})).body?.message?.includes('đã được mở'));
ok('sơ đồ: bàn Có khách', sql(`SELECT status FROM dining_tables WHERE id=${T.id}`) === 'occupied');
r = await tn.post(`/api/thu-ngan/orders/${orderId}/close`);
ok('đóng bàn chưa gọi món', r.status === 200 && r.body.order.status === 'cancelled', r);
ok('bàn về Trống, yêu cầu của bàn hủy theo', sql(`SELECT status FROM dining_tables WHERE id=${T.id}`) === 'available' && sql(`SELECT COUNT(*) FROM service_requests WHERE table_id=${T.id} AND status IN ('new','forwarded')`) === '0');

// Mở lại → khách gửi món được → đóng bàn bị chặn
r = await tn.post(`/api/thu-ngan/tables/${T.id}/open`, {});
const order2 = r.body.order.id;
r = await pub(T.token + '/orders', { items: [{ dishId: dish.id, qty: 2, note: '' }] });
ok('bàn đã mở → khách gửi món vào đúng đơn', r.status === 200 && r.body.id === order2 && r.body.items.length === 1, r);
r = await tn.post(`/api/thu-ngan/orders/${order2}/close`);
ok('bàn đã có món → "Đóng bàn" bị chặn (dùng Hủy đơn)', r.status === 409 && /Hủy đơn/.test(r.body?.message), r);
r = await tn.post(`/api/thu-ngan/orders/${order2}/cancel`, { reason: 'left', note: '' });
ok('hủy đơn còn món chờ → bàn đóng', r.status === 200 && sql(`SELECT status FROM dining_tables WHERE id=${T.id}`) === 'available', r);
ok('QR sau khi đóng: không còn đơn', (await pub(T.token)).body.order === null);

// Tự đóng: đặt 1 phút, lùi giờ mở 2 phút, chờ tác vụ chạy (giây 30 mỗi phút)
r = await ql.put('/api/settings/ordering', { openTableTimeoutMinutes: 500 });
ok('cấu hình: > 240 phút → 422', r.status === 422, r);
r = await ql.put('/api/settings/ordering', { openTableTimeoutMinutes: 1 });
ok('cấu hình: tự đóng sau 1 phút', r.status === 200 && r.body.openTableTimeoutMinutes === 1, r);
ok('thu ngân không sửa được cấu hình', (await tn.put('/api/settings/ordering', { openTableTimeoutMinutes: 5 })).status === 403);
r = await tn.post(`/api/thu-ngan/tables/${T.id}/open`, {});
const order3 = r.body.order.id;
sql(`UPDATE orders SET created_at = NOW() - INTERVAL 3 MINUTE WHERE id=${order3}; SELECT 1`);
let closed = false;
for (let i = 0; i < 16 && !closed; i++) {
  await new Promise((res) => setTimeout(res, 5000));
  closed = sql(`SELECT status FROM orders WHERE id=${order3}`) === 'cancelled';
}
ok('bàn mở quá giờ chưa gọi món → tự đóng', closed && /Tự đóng/.test(sql(`SELECT note FROM orders WHERE id=${order3}`)));
await ql.put('/api/settings/ordering', { openTableTimeoutMinutes: 30 });

// Khách đặt trước đến
const resTable = (await tn.get('/api/thu-ngan/floor')).body.tables.find((t) => !t.order && t.reservation && t.status !== 'inactive');
if (resTable) {
  r = await tn.post(`/api/thu-ngan/tables/${resTable.id}/open`, { guests: null, reservationId: resTable.reservation.id });
  ok(`khách đặt trước đến (${resTable.code}): mở bàn, số khách lấy từ phiếu đặt`, r.status === 200 && r.body.guests === resTable.reservation.guests, r);
  ok('phiếu đặt chuyển Đã đến', sql(`SELECT status FROM reservations WHERE id=${resTable.reservation.id}`) === 'seated');
  await tn.post(`/api/thu-ngan/orders/${r.body.order.id}/close`);
} else ok('có bàn đặt trước trong 2 giờ tới để thử', false, 'không có');

fakeClockOut();
console.log(`\n${pass} PASS, ${fail} FAIL`);
