// [17-dat-ban-thu-ngan.mjs] Đặt bàn ở màn POS thu ngân (B6 / D16, 26/11/2026): xem lịch trong ngày, thêm lịch (điện thoại / tại quầy),
// sửa, xác nhận / hủy / không đến, khách đã đến → mở bàn; lịch website báo cả thu ngân; không còn khóa "chưa vào ca".
// Tự dọn lịch tạo ra (tên khách bắt đầu "KT Đặt bàn") — chạy lại được.
import { BASE, sql } from '../lib/env.mjs';

let pass = 0, fail = 0;
const ok = (n, c, x = '') => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'} ${n}${c ? '' : ' — ' + JSON.stringify(x).slice(0, 300)}`); };
const j = async (r) => ({ status: r.status, body: await r.json().catch(() => null) });
async function login(user) {
  const r = await fetch(BASE + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: user, password: 'Rms@2026' }) });
  const cookie = r.headers.get('set-cookie').split(';')[0];
  const call = (method) => (path, body) => fetch(BASE + path, { method, headers: { 'Content-Type': 'application/json', Cookie: cookie }, body: body === undefined ? undefined : JSON.stringify(body) }).then(j);
  return { get: call('GET'), post: call('POST'), put: call('PUT'), patch: call('PATCH') };
}
const tn = await login('linh.tran');
const ql = await login('tuan.nguyen');
const pv = await login('nam.hoang');

const clean = () => sql(`UPDATE orders o JOIN reservations r ON r.id = o.reservation_id SET o.reservation_id = NULL WHERE r.customer_name LIKE 'KT Đặt bàn%';
  DELETE FROM reservations WHERE customer_name LIKE 'KT Đặt bàn%'; SELECT 1`);
clean();
// Không ai đang vào ca: thu ngân vẫn thao tác được (D16).
sql("DELETE FROM attendances WHERE note = 'Vào ca (kiểm thử)'; SELECT 1");

const tomorrow = sql(`SELECT DATE_FORMAT(CURDATE() + INTERVAL 1 DAY, '%Y-%m-%d')`);
const dow = Number(sql(`SELECT DAYOFWEEK(CURDATE() + INTERVAL 1 DAY) - 1`));
const hoursBefore = sql(`SELECT CONCAT(is_open, ',', open_time, ',', close_time) FROM opening_hours WHERE day_of_week = ${dow}`);
sql(`UPDATE opening_hours SET is_open = 1, open_time = '09:00:00', close_time = '22:00:00' WHERE day_of_week = ${dow}; SELECT 1`);
const area = sql(`SELECT id FROM areas WHERE name = 'Sảnh chính'`);
const big = sql(`SELECT id FROM dining_tables WHERE area_id = ${area} AND seats >= 4 AND status <> 'inactive' ORDER BY seats, id LIMIT 1`);
const small = sql(`SELECT id FROM dining_tables WHERE area_id = ${area} AND seats = 2 AND status <> 'inactive' LIMIT 1`);
sql(`DELETE FROM reservations WHERE DATE(reserved_at) = '${tomorrow}' AND table_id IN (${big}, ${small}) AND status IN ('pending','confirmed'); SELECT 1`);

/* ------------------------------------------------------------------ Quyền, đọc */
let r = await tn.get('/api/thu-ngan/reservations');
ok('thu ngân xem lịch đặt hôm nay', r.status === 200 && Array.isArray(r.body), r);
ok('phục vụ không gọi được API đặt bàn của thu ngân', (await pv.get('/api/thu-ngan/reservations')).status === 403);

/* ------------------------------------------------------------------ Thêm */
const base = { customerName: 'KT Đặt bàn A', phone: '0901234567', guests: 4, date: tomorrow, time: '12:00', areaId: area, tableId: '', note: 'Sinh nhật', source: 'phone' };
r = await tn.post('/api/thu-ngan/reservations', { ...base, customerName: ' ', phone: '123', guests: 0 });
ok('thêm lịch thiếu tên, SĐT sai, số khách 0 → lỗi tại ô', r.status === 422 && r.body.fields?.customerName && r.body.fields?.phone && r.body.fields?.guests, r.body);
r = await tn.post('/api/thu-ngan/reservations', { ...base, time: '23:30' });
ok('giờ ngoài giờ mở cửa → lỗi tại ô giờ', r.status === 422 && r.body.fields?.time, r.body);
r = await tn.post('/api/thu-ngan/reservations', { ...base, tableId: small });
ok('bàn ít ghế hơn số khách → lỗi tại ô bàn', r.status === 422 && /ghế/.test(r.body.fields?.tableId ?? ''), r.body);
r = await tn.post('/api/thu-ngan/reservations', { ...base, tableId: big });
const A = r.body;
ok('thêm lịch qua điện thoại → Đã xác nhận, nguồn phone, ghi người tạo', r.status === 201 && A.status === 'confirmed' && A.source === 'phone'
  && sql(`SELECT created_by FROM reservations WHERE id = ${A.id}`) === sql(`SELECT id FROM users WHERE username = 'linh.tran'`), r.body);
r = await tn.post('/api/thu-ngan/reservations', { ...base, customerName: 'KT Đặt bàn B', phone: '0907654321', guests: 2, time: '12:30', tableId: big, source: 'walk_in' });
ok('trùng bàn trong khung giờ → lỗi tại ô bàn', r.status === 422 && /trùng/.test(r.body.fields?.tableId ?? ''), r.body);
r = await tn.post('/api/thu-ngan/reservations', { ...base, customerName: 'KT Đặt bàn B', phone: '0907654321', guests: 2, time: '19:00', tableId: '', source: 'walk_in' });
const B = r.body;
ok('thêm lịch tại quầy, chưa xếp bàn', r.status === 201 && B.source === 'walk_in' && !B.tableId, r.body);
r = await tn.get(`/api/thu-ngan/reservations?date=${tomorrow}`);
const listA = r.body.find((x) => x.id === A.id);
ok('lịch trong ngày có tên khu + mã bàn, xếp theo giờ', listA?.areaName === 'Sảnh chính' && listA.tableCode && r.body.findIndex((x) => x.id === A.id) < r.body.findIndex((x) => x.id === B.id), r.body.map((x) => x.code));
ok('Quản lý thấy lịch thu ngân tạo trong lịch sử', (await ql.get(`/api/reservations?keyword=KT Đặt bàn A`)).body.items?.some((x) => x.id === A.id));

/* ------------------------------------------------------------------ Sửa, trạng thái */
r = await tn.put(`/api/thu-ngan/reservations/${B.id}`, { ...base, customerName: 'KT Đặt bàn B', phone: '0907654321', guests: 3, time: '19:30', tableId: big, note: '' });
ok('sửa lịch: đổi giờ, số khách, xếp bàn', r.status === 200 && r.body.guests === 3 && r.body.tableId === big, r.body);
r = await tn.patch(`/api/thu-ngan/reservations/${B.id}/status`, { status: 'seated' });
ok('đổi sang "Đã đến" bằng API trạng thái → 409 (dùng Mở bàn)', r.status === 409, r.body);
r = await tn.patch(`/api/thu-ngan/reservations/${B.id}/status`, { status: 'cancelled' });
ok('hủy lịch', r.status === 200 && r.body.status === 'cancelled', r.body);
r = await tn.put(`/api/thu-ngan/reservations/${B.id}`, { ...base, customerName: 'KT Đặt bàn B', phone: '0907654321', guests: 3, time: '20:00', tableId: '', note: '' });
ok('lịch đã hủy không sửa được', r.status >= 400, r.status);
r = await tn.patch(`/api/thu-ngan/reservations/${A.id}/status`, { status: 'no_show' });
ok('đánh dấu khách không đến', r.status === 200 && r.body.status === 'no_show', r.body);

/* ------------------------------------------------------------------ Khách đã đến → mở bàn */
const freeT = sql(`SELECT t.id FROM dining_tables t WHERE t.status = 'available' AND t.seats >= 2 AND NOT EXISTS (SELECT 1 FROM orders o WHERE o.table_id = t.id AND o.status = 'open') LIMIT 1`);
sql(`INSERT INTO reservations (code, customer_name, phone, guests, reserved_at, duration_minutes, area_id, table_id, status, source)
     SELECT 'DB-KT17', 'KT Đặt bàn C', '0911111111', 2, NOW() + INTERVAL 10 MINUTE, 90, area_id, id, 'confirmed', 'phone' FROM dining_tables WHERE id = ${freeT}; SELECT 1`);
const C = sql(`SELECT id FROM reservations WHERE code = 'DB-KT17'`);
r = await tn.get('/api/thu-ngan/reservations');
ok('lịch hôm nay hiện trên POS', r.body.some((x) => x.id === C), r.body.map((x) => x.code));
r = await tn.post(`/api/thu-ngan/tables/${freeT}/open`, { guests: null, reservationId: C });
ok('khách đã đến → mở bàn (chưa vào ca vẫn được), lịch thành Đã đến', r.status === 200 && sql(`SELECT status FROM reservations WHERE id = ${C}`) === 'seated', r.body);
if (r.status === 200) await tn.post(`/api/thu-ngan/orders/${r.body.order.id}/close`);

/* ------------------------------------------------------------------ Website báo cả thu ngân */
const n0 = Number(sql(`SELECT COUNT(*) FROM notification_recipients nr JOIN notifications n ON n.id = nr.notification_id WHERE n.type_code = 'reservation' AND nr.user_id = (SELECT id FROM users WHERE username = 'linh.tran')`));
const site = await fetch(BASE + '/api/public/site').then((x) => x.json());
const webArea = site.areas?.[0]?.id ?? null;
r = await fetch(BASE + '/api/public/reservations', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '10.17.17.' + Math.floor(Math.random() * 200) },
  body: JSON.stringify({ customerName: 'KT Đặt bàn Web', phone: '0933' + String(Math.floor(Math.random() * 1e6)).padStart(6, '0'), guests: 2, date: tomorrow, time: '13:00', areaId: webArea, note: '', email: '' }) }).then(j);
const n1 = Number(sql(`SELECT COUNT(*) FROM notification_recipients nr JOIN notifications n ON n.id = nr.notification_id WHERE n.type_code = 'reservation' AND nr.user_id = (SELECT id FROM users WHERE username = 'linh.tran')`));
ok('khách đặt qua website → thu ngân nhận thông báo', r.status === 201 && n1 === n0 + 1, [r.status, r.body?.message, n1 - n0]);

clean();
sql(`UPDATE opening_hours SET is_open = ${hoursBefore.split(',')[0]}, open_time = '${hoursBefore.split(',')[1]}', close_time = '${hoursBefore.split(',')[2]}' WHERE day_of_week = ${dow}; SELECT 1`);
console.log(`\n${pass} đạt, ${fail} không đạt`);
process.exit(fail ? 1 : 0);
