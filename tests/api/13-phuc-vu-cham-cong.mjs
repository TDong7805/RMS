// [13-phuc-vu-cham-cong.mjs] V20: Nhân viên phục vụ (khu vực, yêu cầu hỗ trợ, bàn, gọi món hộ, bưng món, ghép bàn,
// sơ đồ cập nhật tức thời) và chấm công bằng khuôn mặt (đăng ký, duyệt, WiFi quán, vào ca / tan ca, ảnh không công khai).
import { deflateSync } from 'node:zlib';
import { BASE, sql } from '../lib/env.mjs';

let pass = 0, fail = 0;
const ok = (n, c, x = '') => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'} ${n}${c ? '' : ' — ' + JSON.stringify(x).slice(0, 300)}`); };
const j = async (r) => ({ status: r.status, body: await r.json().catch(() => null), type: r.headers.get('content-type') });
const pub = (p, body) => fetch(BASE + '/api/public/qr/' + p, body === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(j);
async function login(user) {
  const r = await fetch(BASE + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: user, password: 'Rms@2026' }) });
  const data = await r.json();
  const cookie = r.headers.get('set-cookie').split(';')[0];
  const call = (method) => (path, body) => fetch(BASE + path, { method, headers: { 'Content-Type': 'application/json', Cookie: cookie }, body: body === undefined ? undefined : JSON.stringify(body) }).then(j);
  return { data, cookie, get: call('GET'), post: call('POST'), put: call('PUT'), patch: call('PATCH'), del: call('DELETE') };
}

// ---- Ảnh PNG thật (ImageProcessor giải mã ảnh) + mã khuôn mặt giả lập.
const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc32 = (buf) => { let c = 0xffffffff; for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(w, h) {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = y * (w * 3 + 1) + 1 + x * 3; raw[i] = x * 2; raw[i + 1] = 120; raw[i + 2] = y * 2; }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
const PHOTO = `data:image/png;base64,${png(96, 96).toString('base64')}`;
const FACE = Array.from({ length: 128 }, (_, i) => Math.round(Math.sin(i * 1.7) * 1000) / 10000);
const SAME = FACE.map((v, i) => v + (i % 2 ? 0.004 : -0.004));        // cùng người (độ lệch ~0.045)
const OTHER = FACE.map((v, i) => v + (i % 3 ? 0.09 : -0.09));          // người khác (độ lệch ~1.0)

const ql = await login('tuan.nguyen');
const tn = await login('linh.tran');
const pv = await login('nam.hoang');
const pv2 = await login('vy.ngo');
const bep = await login('hung.pham');
const kho = await login('thao.bui');

/* ------------------------------------------------------------------ Đăng nhập & phân quyền */
ok('phục vụ đăng nhập được → home /phuc-vu', pv.data.role === 'waiter' && pv.data.home === '/phuc-vu', pv.data);
ok('phục vụ không vào được khu thu ngân', (await pv.get('/api/thu-ngan/floor')).status === 403);
ok('thu ngân không vào được khu phục vụ', (await tn.get('/api/phuc-vu/floor')).status === 403);
ok('phục vụ xem được thông báo của mình', (await pv.get('/api/notifications')).status === 200);
ok('kho / quản lý không có trang "Thông tin của tôi"', (await kho.get('/api/toi/clock')).status === 403 && (await ql.get('/api/toi/clock')).status === 403);
ok('bếp có trang "Thông tin của tôi"', (await bep.get('/api/toi/profile')).status === 200);

/* ------------------------------------------------------------------ Chuẩn bị ca đang diễn ra */
const area = (name) => sql(`SELECT id FROM areas WHERE name='${name}'`);
const A1 = area('Tầng 1'), A2 = area('Tầng 2'), AV = area('Sân vườn');
const uid = (u) => sql(`SELECT id FROM users WHERE username='${u}'`);
// Dọn dữ liệu của lần chạy trước (chạy lại được mà không cần tạo lại CSDL).
sql(`DELETE FROM attendances WHERE source='camera'; DELETE FROM face_profiles;
     UPDATE service_requests SET status='cancelled', cancelled_at=NOW() WHERE status IN ('new','forwarded') AND request_type <> 'payment';
     DELETE sa FROM shift_assignments sa JOIN shifts s ON s.id=sa.shift_id WHERE s.name='Ca kiểm thử';
     DELETE FROM shifts WHERE name='Ca kiểm thử'; SELECT 1`);
sql(`DELETE FROM shift_assignments WHERE user_id IN (SELECT u.id FROM users u JOIN roles r ON r.id=u.role_id WHERE r.code='waiter')
     AND work_date BETWEEN CURDATE() - INTERVAL 1 DAY AND CURDATE() + INTERVAL 1 DAY; SELECT 1`);
sql(`INSERT INTO shifts (name, start_time, end_time) VALUES ('Ca kiểm thử', TIME(DATE_FORMAT(NOW() - INTERVAL 1 HOUR, '%H:%i:00')),
     TIME(DATE_FORMAT(NOW() + INTERVAL 3 HOUR, '%H:%i:00'))); SELECT 1`);
const SHIFT = sql(`SELECT id FROM shifts WHERE name='Ca kiểm thử'`);
const assign = (u, areaId) => sql(`INSERT INTO shift_assignments (shift_id, user_id, work_date, area_id) VALUES (${SHIFT}, ${uid(u)},
     DATE(NOW() - INTERVAL 1 HOUR), ${areaId ?? 'NULL'}); SELECT LAST_INSERT_ID()`);
const asgNam = assign('nam.hoang', A1);
assign('vy.ngo', A2);

let fl = (await pv.get('/api/phuc-vu/floor')).body;
ok('sơ đồ phục vụ: mở sẵn khu Tầng 1, có nhãn ca', fl.myAreaIds?.length === 1 && fl.myAreaIds[0] === A1 && /Ca kiểm thử/.test(fl.dutyLabel), fl?.myAreaIds);
ok('sơ đồ phục vụ không có doanh thu / hóa đơn chưa thu', fl.floor.revenueToday === 0 && fl.floor.unpaidCount === 0);

/* ------------------------------------------------------------------ Yêu cầu hỗ trợ theo khu vực */
const freeIn = (areaId, skip = []) => fl.floor.tables.find((t) => t.areaId === areaId && t.status === 'available' && !t.order && !t.reservation && !skip.includes(t.id));
const T1 = freeIn(A1);
const TV = fl.floor.tables.find((t) => t.areaId === AV && t.status !== 'inactive' && !t.supportRequest);
const token = (id) => sql(`SELECT qr_token FROM dining_tables WHERE id=${id}`);
const notesBefore = sql(`SELECT COUNT(*) FROM notification_recipients WHERE user_id=${uid('vy.ngo')}`);
let r = await pub(token(T1.id) + '/requests', { type: 'support', content: 'Cho thêm đá' });
ok(`khách bàn ${T1.code} (Tầng 1) gọi nhân viên`, r.status === 200 && r.body.support?.status === 'new', r);
await pub(token(TV.id) + '/requests', { type: 'consult', content: '' });
let list = (await pv.get('/api/phuc-vu/requests')).body;
const reqT1 = list.items.find((x) => x.tableId === T1.id);
ok('phục vụ Tầng 1 thấy yêu cầu Tầng 1 + Sân vườn (khu không ai gán)', reqT1 && list.items.some((x) => x.tableId === TV.id), list.items.map((x) => x.tableCode));
let list2 = (await pv2.get('/api/phuc-vu/requests')).body;
ok('phục vụ Tầng 2 KHÔNG thấy yêu cầu Tầng 1, vẫn thấy Sân vườn', !list2.items.some((x) => x.tableId === T1.id) && list2.items.some((x) => x.tableId === TV.id), list2.items.map((x) => x.tableCode));
ok('thông báo yêu cầu Tầng 1 chỉ gửi phục vụ Tầng 1', sql(`SELECT COUNT(*) FROM notification_recipients nr JOIN notifications n ON n.id=nr.notification_id
     WHERE n.ref_id=${reqT1.id} AND n.ref_table='service_requests' AND nr.user_id=${uid('nam.hoang')}`) === '1'
  && sql(`SELECT COUNT(*) FROM notification_recipients nr JOIN notifications n ON n.id=nr.notification_id
     WHERE n.ref_id=${reqT1.id} AND n.ref_table='service_requests' AND nr.user_id=${uid('vy.ngo')}`) === '0');
r = await pv2.post(`/api/phuc-vu/requests/${reqT1.id}/accept`);
ok('phục vụ khu khác nhận yêu cầu Tầng 1 → 409', r.status === 409 && /khu vực/.test(r.body?.message), r);
r = await pv.post(`/api/phuc-vu/requests/${reqT1.id}/accept`);
ok('phục vụ Tầng 1 bấm "Tôi đến"', r.status === 200 && r.body.status === 'forwarded' && r.body.assignedName === 'Hoàng Gia Nam', r);
r = await pub(token(T1.id));
ok('khách thấy "Nhân viên đang đến" kèm tên', r.body.support?.status === 'forwarded' && r.body.support?.assignedName === 'Hoàng Gia Nam', r.body.support);
r = await pv.post(`/api/phuc-vu/requests/${reqT1.id}/done`);
ok('phục vụ hoàn thành yêu cầu', r.status === 200 && r.body.status === 'done', r);
const tnReq = (await tn.get('/api/thu-ngan/requests')).body;
ok('thu ngân không còn thấy yêu cầu hỗ trợ', tnReq.items.every((x) => x.type === 'payment'), tnReq.items.map((x) => x.type));
const reqTV = list.items.find((x) => x.tableId === TV.id);
r = await tn.post(`/api/thu-ngan/requests/${reqTV.id}/forward`);
ok('thu ngân bấm "Báo nhân viên" yêu cầu hỗ trợ → 409', r.status === 409 && /phục vụ/.test(r.body?.message), r);
ok('sơ đồ thu ngân không hiện cờ hỗ trợ', !(await tn.get('/api/thu-ngan/floor')).body.tables.find((t) => t.id === TV.id).supportRequest);
ok('sơ đồ phục vụ hiện cờ hỗ trợ', (await pv.get('/api/phuc-vu/floor')).body.floor.tables.find((t) => t.id === TV.id).supportRequest);
await pv.post(`/api/phuc-vu/requests/${reqTV.id}/cancel`);

/* ------------------------------------------------------------------ Mở bàn, gọi món hộ, bưng món, ghép / chuyển bàn */
r = await pv.post(`/api/phuc-vu/tables/${T1.id}/open`, { guests: 2 });
ok(`phục vụ mở bàn ${T1.code} (2 khách)`, r.status === 200 && r.body.guests === 2, r);
const orderA = r.body.order.id;
ok('nhật ký ghi module "waiter"', sql(`SELECT module FROM audit_logs WHERE action='Mở bàn' ORDER BY id DESC LIMIT 1`) === 'waiter');
const menu = (await pv.get('/api/phuc-vu/menu')).body;
const dish = menu.dishes.find((d) => !d.soldOut);
ok('phục vụ tra thực đơn', menu.dishes.length > 10 && dish, menu?.dishes?.length);
r = await pv.post(`/api/phuc-vu/tables/${T1.id}/items`, { items: [{ dishId: dish.id, qty: 2, note: 'ít cay' }] });
ok('gọi món hộ khách → vào đơn của bàn', r.status === 200 && r.body.id === orderA && r.body.items.length === 1, r);
ok('món ghi added_via = staff', sql(`SELECT added_via FROM order_items WHERE order_id=${orderA}`) === 'staff');
const T2 = freeIn(A1, [T1.id]);
r = await pv.post(`/api/phuc-vu/tables/${T2.id}/items`, { items: [{ dishId: dish.id, qty: 1 }] });
ok('gọi món bàn chưa mở → 409', r.status === 409 && /chưa được mở/.test(r.body?.message), r);
const item = sql(`SELECT id FROM order_items WHERE order_id=${orderA} LIMIT 1`);
r = await pv.post('/api/phuc-vu/serve', { ids: [item] });
ok('bưng món chưa xong → 409', r.status === 409, r);
sql(`UPDATE order_items SET status='done', completed_at=NOW() WHERE id=${item}; SELECT 1`);
fl = (await pv.get('/api/phuc-vu/floor')).body;
ok('món đã xong hiện ở danh sách chờ bưng', fl.floor.ready.some((x) => x.id === item));
r = await pv.post('/api/phuc-vu/serve', { ids: [item] });
ok('bưng món → Đã mang ra, ghi người bưng', r.status === 200 && sql(`SELECT CONCAT(status,'/',served_by) FROM order_items WHERE id=${item}`) === `served/${uid('nam.hoang')}`, r);

r = await pv.post(`/api/phuc-vu/tables/${T2.id}/open`, { guests: 3 });
const orderB = r.body.order.id;
await pv.post(`/api/phuc-vu/tables/${T2.id}/items`, { items: [{ dishId: dish.id, qty: 1 }] });
const targets = (await pv.get('/api/phuc-vu/merge-targets')).body;
ok('bàn ghép được: các bàn đang có khách', targets.some((t) => t.id === T2.id) && targets.some((t) => t.id === T1.id), targets.map((t) => t.code));
r = await pv.post(`/api/phuc-vu/orders/${orderA}/merge`, { tableId: T2.id });
ok(`ghép bàn ${T1.code} vào ${T2.code}: đủ món, cộng số khách`, r.status === 200 && r.body.order.id === orderB && r.body.order.items.length === 2 && r.body.guests === 5, r);
ok('đơn cũ đóng (ghi chú ghép), bàn cũ trống', /Ghép vào đơn/.test(sql(`SELECT note FROM orders WHERE id=${orderA}`))
  && sql(`SELECT status FROM dining_tables WHERE id=${T1.id}`) === 'available');
r = await pv.post(`/api/phuc-vu/orders/${orderB}/merge`, { tableId: T1.id });
ok('ghép vào bàn trống → 409 (dùng Chuyển bàn)', r.status === 409 && /Chuyển bàn/.test(r.body?.message), r);
r = await pv.post(`/api/phuc-vu/orders/${orderB}/move`, { tableId: T1.id });
ok(`chuyển bàn ${T2.code} → ${T1.code}`, r.status === 200 && r.body.order.tableId === T1.id, r);
r = await pv.post(`/api/phuc-vu/orders/${orderB}/guests`, { guests: 4 });
ok('phục vụ sửa số khách', r.status === 200 && r.body.guests === 4, r);

/* ------------------------------------------------------------------ Quản lý sửa sơ đồ → phục vụ nhận sự kiện "layout" */
const ctl = new AbortController();
const stream = await fetch(BASE + '/api/phuc-vu/stream', { headers: { Cookie: pv.cookie }, signal: ctl.signal });
const reader = stream.body.getReader();
let sse = '';
const gotLayout = (async () => {
  const dec = new TextDecoder();
  while (!/event: ?layout\r?\ndata: ?[^\n]+\n/.test(sse)) {
    const { value, done } = await reader.read();
    if (done) break;
    sse += dec.decode(value);
  }
  return sse;
})().catch(() => sse);
await new Promise((res) => setTimeout(res, 300));
const moveT = fl.floor.tables.find((t) => t.areaId === AV);
const usedCells = new Set(fl.floor.tables.filter((t) => t.areaId === AV).map((t) => `${t.x},${t.y}`));
let cell = null;
for (let y = 0; y < 5 && !cell; y++) for (let x = 0; x < 8 && !cell; x++) if (!usedCells.has(`${x},${y}`)) cell = { x, y };
r = await ql.patch(`/api/tables/${moveT.id}/position`, cell);
ok('quản lý di chuyển bàn trên sơ đồ', r.status === 200, r);
const got = await Promise.race([gotLayout, new Promise((res) => setTimeout(() => res(sse), 3000))]);
ctl.abort();
ok('phục vụ nhận sự kiện "layout" kèm khu vực', /event:\s*layout/.test(got) && got.includes(AV) && got.includes('Sân vườn'), got.slice(-200));

/* ------------------------------------------------------------------ Gán khu vực cho ca */
r = await ql.put(`/api/shift-assignments/${asgNam}/area`, { areaId: A2 });
ok('quản lý đổi khu của phục vụ trong ca', r.status === 200 && r.body.areaId === A2, r);
ok('sơ đồ phục vụ đổi khu mặc định', (await pv.get('/api/phuc-vu/floor')).body.myAreaIds[0] === A2);
await ql.put(`/api/shift-assignments/${asgNam}/area`, { areaId: A1 });
const kitchenAsg = sql(`SELECT sa.id FROM shift_assignments sa JOIN users u ON u.id=sa.user_id WHERE u.username='hung.pham' AND sa.work_date >= CURDATE() LIMIT 1`);
r = await ql.put(`/api/shift-assignments/${kitchenAsg}/area`, { areaId: A1 });
ok('không gán khu cho nhân viên bếp → 409', r.status === 409, r);

// Phân công / hủy ca (không chọn khu) → màn hình phục vụ nhận sự kiện "change" ngay (không phải đợi tự làm mới).
async function waiterEventAfter(action) {
  const c = new AbortController();
  const res = await fetch(BASE + '/api/phuc-vu/stream', { headers: { Cookie: pv.cookie }, signal: c.signal });
  const rd = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  const got = (async () => {
    while (!/event: ?ready/.test(buf)) { const { value, done } = await rd.read(); if (done) return false; buf += dec.decode(value); }
    buf = '';
    await action();
    while (!/event: ?change/.test(buf)) { const { value, done } = await rd.read(); if (done) return false; buf += dec.decode(value); }
    return true;
  })().catch(() => false);
  const ok2 = await Promise.race([got, new Promise((res2) => setTimeout(() => res2(false), 4000))]);
  c.abort();
  return ok2;
}
const tomorrow = sql(`SELECT DATE_FORMAT(CURDATE() + INTERVAL 2 DAY, '%Y-%m-%d')`);
const morning = sql(`SELECT id FROM shifts WHERE name='Ca sáng'`);
sql(`DELETE FROM shift_assignments WHERE user_id=${uid('nam.hoang')} AND work_date='${tomorrow}'; SELECT 1`);
let newAsg = null;
ok('phân công ca mới (không chọn khu) → phục vụ nhận sự kiện cập nhật', await waiterEventAfter(async () => {
  const a = await ql.post('/api/shift-assignments', { employeeId: uid('nam.hoang'), shiftId: morning, dates: [tomorrow] });
  newAsg = a.body?.[0]?.id;
}), newAsg);
ok('ca mới hiện trong "Ca làm của tôi"', (await pv.get(`/api/toi/shifts?from=${tomorrow}&to=${tomorrow}`)).body.some((s) => s.id === newAsg));
ok('hủy ca → phục vụ nhận sự kiện cập nhật', await waiterEventAfter(() => ql.del(`/api/shift-assignments/${newAsg}`)));
ok('ca đã hủy không còn trong "Ca làm của tôi"', !(await pv.get(`/api/toi/shifts?from=${tomorrow}&to=${tomorrow}`)).body.some((s) => s.id === newAsg));

/* ------------------------------------------------------------------ Khuôn mặt: đăng ký & duyệt */
ok('chưa đăng ký khuôn mặt', (await pv.get('/api/toi/face')).body.status === 'none');
r = await pv.post('/api/toi/clock/in', { descriptor: FACE, photo: PHOTO, liveness: true });
ok('chưa đăng ký → không chấm công được', r.status === 409 && /chưa đăng ký/.test(r.body?.message), r);
r = await pv.post('/api/toi/face', { descriptor: FACE, photo: PHOTO, consent: false });
ok('không đồng ý thu thập → 422', r.status === 422 && r.body?.fields?.consent, r);
r = await pv.post('/api/toi/face', { descriptor: FACE.slice(0, 50), photo: PHOTO, consent: true });
ok('mã khuôn mặt sai → 422', r.status === 422 && r.body?.fields?.descriptor, r);
r = await pv.post('/api/toi/face', { descriptor: FACE, photo: PHOTO, consent: true });
ok('đăng ký khuôn mặt → chờ duyệt', r.status === 200 && r.body.status === 'pending', r);
ok('quản lý nhận thông báo chờ duyệt', sql(`SELECT COUNT(*) FROM notifications WHERE type_code='attendance' AND ref_id=${uid('nam.hoang')}`) !== '0');
r = await pv.post('/api/toi/clock/in', { descriptor: FACE, photo: PHOTO, liveness: true });
ok('đang chờ duyệt → không chấm công được', r.status === 409 && /chờ quản lý duyệt/.test(r.body?.message), r);
const faces = (await ql.get('/api/faces')).body;
const myFace = faces.find((f) => f.username === 'nam.hoang');
ok('quản lý thấy khuôn mặt chờ duyệt', myFace?.status === 'pending', faces);
r = await fetch(BASE + `/api/faces/${myFace.id}/photo`, { headers: { Cookie: ql.cookie } });
ok('quản lý xem ảnh đăng ký (ảnh thật)', r.status === 200 && /image\//.test(r.headers.get('content-type')));
const faceKey = sql(`SELECT photo_url FROM face_profiles WHERE id=${myFace.id}`);
ok('ảnh khuôn mặt KHÔNG mở công khai qua /uploads', [401, 403].includes((await fetch(BASE + '/uploads/' + faceKey)).status) && [401, 403].includes((await fetch(BASE + '/uploads/' + faceKey, { headers: { Cookie: tn.cookie } })).status));
ok('thu ngân không duyệt được khuôn mặt', (await tn.post(`/api/faces/${myFace.id}/approve`)).status === 403);
r = await ql.post(`/api/faces/${myFace.id}/reject`, { reason: '' });
ok('từ chối không lý do → 422', r.status === 422, r);
r = await ql.post(`/api/faces/${myFace.id}/approve`);
ok('quản lý duyệt khuôn mặt', r.status === 200 && r.body.status === 'approved', r);
r = await pv.post('/api/toi/face', { descriptor: FACE, photo: PHOTO, consent: true });
ok('đã duyệt → tự đăng ký lại bị chặn', r.status === 409, r);

/* ------------------------------------------------------------------ WiFi quán */
r = await ql.put('/api/settings/attendance', { allowedNetworks: 'abc', earlyMinutes: 30, faceThreshold: 0.5, photoRetentionDays: 90 });
ok('IP sai định dạng → 422', r.status === 422 && r.body?.fields?.allowedNetworks, r);
r = await ql.put('/api/settings/attendance', { allowedNetworks: '10.99.99.0/24', earlyMinutes: 30, faceThreshold: 0.5, photoRetentionDays: 90 });
ok('quản lý đặt WiFi quán; biết IP hiện tại', r.status === 200 && r.body.allowedNetworks === '10.99.99.0/24' && r.body.currentIp, r);
let st = (await pv.get('/api/toi/clock')).body;
ok('trạng thái: ngoài WiFi quán, có ca đang vào được', st.networkChecked && !st.networkOk && st.current?.shiftName === 'Ca kiểm thử', st);
r = await pv.post('/api/toi/clock/in', { descriptor: FACE, photo: PHOTO, liveness: true });
ok('ngoài WiFi quán → chặn chấm công', r.status === 409 && /WiFi/.test(r.body?.message), r);
await ql.put('/api/settings/attendance', { allowedNetworks: '127.0.0.1, ::1, 10.99.99.0/24', earlyMinutes: 30, faceThreshold: 0.5, photoRetentionDays: 90 });

/* ------------------------------------------------------------------ Vào ca / tan ca */
r = await pv.post('/api/toi/clock/in', { descriptor: FACE, photo: PHOTO, liveness: false });
ok('chưa xác nhận người thật → chặn', r.status === 409 && /người thật/.test(r.body?.message), r);
r = await pv.post('/api/toi/clock/in', { descriptor: OTHER, photo: PHOTO, liveness: true });
ok('khuôn mặt người khác → chặn', r.status === 409 && /không khớp/.test(r.body?.message), r);
r = await pv.post('/api/toi/clock/in', { descriptor: SAME, photo: PHOTO, liveness: true });
ok('vào ca bằng khuôn mặt', r.status === 200 && r.body.open && r.body.current === null, r);
const att = sql(`SELECT id FROM attendances WHERE user_id=${uid('nam.hoang')} AND source='camera' ORDER BY id DESC LIMIT 1`);
const late = Number(sql(`SELECT late_minutes FROM attendances WHERE id=${att}`));
ok('lưu giờ vào, ảnh, IP, độ lệch, đi trễ ~60 phút', late >= 58 && late <= 62 && sql(`SELECT check_in_photo IS NOT NULL AND check_in_ip IS NOT NULL AND check_in_distance < 0.5 FROM attendances WHERE id=${att}`) === '1', late);
r = await pv.post('/api/toi/clock/in', { descriptor: SAME, photo: PHOTO, liveness: true });
ok('vào ca lần 2 → "đang trong ca"', r.status === 409 && /Tan ca/.test(r.body?.message), r);
sql(`UPDATE attendances SET check_in = check_in - INTERVAL 5 SECOND WHERE id=${att}; SELECT 1`);
r = await pv.post('/api/toi/clock/out', { descriptor: SAME, photo: PHOTO, liveness: true });
ok('tan ca bằng khuôn mặt', r.status === 200 && r.body.open === null, r);
const early = Number(sql(`SELECT early_minutes FROM attendances WHERE id=${att}`));
ok('lưu giờ ra, về sớm ~180 phút', early >= 178 && early <= 181 && sql(`SELECT check_out IS NOT NULL AND check_out_photo IS NOT NULL FROM attendances WHERE id=${att}`) === '1', early);
r = await pv.post('/api/toi/clock/out', { descriptor: SAME, photo: PHOTO, liveness: true });
ok('tan ca khi chưa vào ca → 409', r.status === 409, r);
r = await pv.post('/api/toi/clock/in', { descriptor: SAME, photo: PHOTO, liveness: true });
ok('ca đã chấm rồi → không vào lại được', r.status === 409 && /không có ca/.test(r.body?.message), r);

const mine = (await pv.get('/api/toi/attendance')).body;
const row = mine.find((x) => x.id === att);
ok('"Thông tin của tôi": chấm công có ảnh, đi trễ / về sớm', row?.source === 'camera' && row.hasInPhoto && row.hasOutPhoto && row.lateMinutes === late, row);
r = await fetch(BASE + `/api/toi/attendance/${att}/photo/in`, { headers: { Cookie: pv.cookie } });
ok('xem ảnh chấm công của mình', r.status === 200 && /image\//.test(r.headers.get('content-type')));
ok('người khác không xem được ảnh chấm công', (await fetch(BASE + `/api/toi/attendance/${att}/photo/in`, { headers: { Cookie: pv2.cookie } })).status === 404);
ok('thu ngân xem ảnh chấm công (trang Chấm công)', (await fetch(BASE + `/api/thu-ngan/attendance/${att}/photo/out`, { headers: { Cookie: tn.cookie } })).status === 200);
const tnRow = (await tn.get(`/api/thu-ngan/attendance?userId=${uid('nam.hoang')}`)).body.items.find((x) => x.id === att);
ok('trang Chấm công của thu ngân có cờ ảnh + đi trễ', tnRow?.hasInPhoto && tnRow.lateMinutes === late, tnRow);
const shifts = (await pv.get('/api/toi/shifts')).body;
ok('ca của tôi: có ca kiểm thử, đã chấm công, khu Tầng 1', shifts.some((s) => s.id === asgNam && s.attended && s.areaName === 'Tầng 1'), shifts.slice(0, 3));

r = await pv2.post('/api/toi/clock/in', { descriptor: FACE, photo: PHOTO, liveness: true });
ok('phục vụ khác chưa đăng ký khuôn mặt → chặn', r.status === 409, r);
r = await ql.del(`/api/faces/${myFace.id}`);
ok('quản lý yêu cầu đăng ký lại → khuôn mặt bị xóa', r.status === 204 && (await pv.get('/api/toi/face')).body.status === 'none', r);

/* ------------------------------------------------------------------ Hồ sơ, phiếu lương */
r = await pv.put('/api/toi/profile', { email: 'sai-email', phone: '0901000006' });
ok('hồ sơ: email sai → 422', r.status === 422 && r.body?.fields?.email, r);
r = await pv.put('/api/toi/profile', { email: 'linh.tran@royalbeef.vn', phone: '' });
ok('hồ sơ: email trùng người khác → 422', r.status === 422, r);
r = await pv.put('/api/toi/profile', { email: 'nam.hoang@royalbeef.vn', phone: '0912345678' });
ok('hồ sơ: đổi số điện thoại', r.status === 200 && r.body.phone === '0912345678', r);
r = await pv.get('/api/toi/payslips');
ok('phiếu lương của tôi (kỳ đã chốt)', r.status === 200 && Array.isArray(r.body), r);
ok('xem phiếu lương kỳ không có → 404', (await pv.get('/api/toi/payslips/999999')).status === 404);

// Dọn: bỏ WiFi, để các bộ khác không bị ảnh hưởng
await ql.put('/api/settings/attendance', { allowedNetworks: '', earlyMinutes: 30, faceThreshold: 0.5, photoRetentionDays: 90 });

console.log(`\n${pass} PASS, ${fail} FAIL`);
process.exit(fail ? 1 : 0);
