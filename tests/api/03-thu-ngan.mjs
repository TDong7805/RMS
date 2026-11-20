// [03-thu-ngan.mjs] A, D1–D16: yêu cầu khách (từ V20 hỗ trợ do phục vụ nhận), hủy món / hủy đơn, chuyển bàn, hóa đơn, thanh toán
import { BASE, DB, FIXTURES, OUT, UPLOADS, sql } from '../lib/env.mjs';
// Gọi thử API đợt 2 (yêu cầu, hóa đơn, thanh toán, dashboard) trên backend 8081.
const T05 = sql("SELECT qr_token FROM dining_tables WHERE code='T04'");
const T06 = sql("SELECT qr_token FROM dining_tables WHERE code='T06'");
const T03 = sql("SELECT qr_token FROM dining_tables WHERE code='T03'");
let pass = 0, fail = 0;
const ok = (n, c, x = '') => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'} ${n}${c ? '' : ' — ' + JSON.stringify(x).slice(0, 400)}`); };
const j = async (r) => ({ status: r.status, body: await r.json().catch(() => null) });
const pub = (p, body) => fetch(BASE + '/api/public/qr/' + p, { method: body === undefined ? 'GET' : 'POST', headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) }).then(j);
async function login(user) {
  const r = await fetch(BASE + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: user, password: 'Rms@2026' }) });
  const cookie = r.headers.get('set-cookie').split(';')[0];
  const call = (method) => (path, body) => fetch(BASE + path, { method, headers: { 'Content-Type': 'application/json', Cookie: cookie }, body: body === undefined ? undefined : JSON.stringify(body) }).then(j);
  return { get: call('GET'), post: call('POST'), put: call('PUT') };
}
function crc16(s) {
  let crc = 0xffff;
  for (const b of Buffer.from(s, 'utf8')) {
    crc ^= b << 8;
    for (let i = 0; i < 8; i++) crc = (crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

const tn = await login('linh.tran');
const waiter = await login('nam.hoang');
const bep = await login('hung.pham');
const ql = await login('tuan.nguyen');

/* ---------------- Khách: gọi nhân viên */
let info = await pub(T05);
ok('T05 chưa có yêu cầu / hóa đơn', info.body.support === null && info.body.payment === null && info.body.invoice === null, info.body);
let r = await pub(T05 + '/requests', { type: 'other', content: '' });
ok('Khác mà thiếu nội dung → 422', r.status === 422 && r.body.fields?.content, r);
r = await pub(T05 + '/requests', { type: 'support', content: 'Thêm chén đũa' });
ok('gọi nhân viên → Mới', r.status === 200 && r.body.support?.status === 'new' && r.body.support.content === 'Thêm chén đũa', r);
const supportId = r.body.support?.id;
r = await pub(T05 + '/requests', { type: 'consult', content: '' });
ok('gọi lần 2 khi đang chờ → 409', r.status === 409 && /đã gửi yêu cầu/.test(r.body.message), r);
r = await pub(T05 + '/payment-request', { method: 'cash' });
ok('yêu cầu thanh toán khi chưa gọi món → 409', r.status === 409 && /chưa có món/.test(r.body.message), r);

/* ---------------- Khách gọi món rồi yêu cầu thanh toán */
const menu = (await pub(T05 + '/menu')).body;
const ds = menu.dishes.filter((d) => !d.soldOut);
await tn.post(`/api/thu-ngan/tables/${sql("SELECT id FROM dining_tables WHERE code='T04'")}/open`, {});
const sent = await pub(T05 + '/orders', { items: [{ dishId: ds[0].id, qty: 2 }, { dishId: ds[1].id, qty: 1 }] });
ok('gửi món tạo đơn', sent.status === 200, sent);
const orderId = sent.body.id;
r = await pub(T05 + '/payment-request', { method: 'bitcoin' });
ok('hình thức sai → 422', r.status === 422 && r.body.fields?.method, r);
r = await pub(T05 + '/payment-request', { method: 'transfer', vatCompany: 'Cty A', vatTaxCode: '123' });
ok('mã số thuế sai → 422', r.status === 422 && r.body.fields?.vatTaxCode, r);
r = await pub(T05 + '/payment-request', { method: 'transfer', vatCompany: 'Công ty TNHH Thử', vatTaxCode: '0312345678-001' });
ok('yêu cầu thanh toán → Mới', r.status === 200 && r.body.payment?.status === 'new' && r.body.payment.paymentMethod === 'transfer', r);
r = await pub(T05 + '/payment-request', { method: 'cash' });
ok('yêu cầu thanh toán lần 2 → 409', r.status === 409, r);

/* ---------------- Thu ngân: yêu cầu */
let reqs = await tn.get('/api/thu-ngan/requests');
const t05reqs = reqs.body.items.filter((x) => x.tableCode === 'T04');
ok('thu ngân chỉ thấy yêu cầu thanh toán của T05 (hỗ trợ do phục vụ nhận)', t05reqs.length === 1 && t05reqs[0].type === 'payment'
  && reqs.body.items.every((x) => x.type === 'payment'), reqs.body.items.map((x) => x.tableCode + x.type));
ok('không còn API danh sách nhân viên (dùng bộ đàm)', (await tn.get('/api/thu-ngan/staff')).status >= 400);
r = await tn.post(`/api/thu-ngan/requests/${supportId}/forward`, {});
ok('thu ngân "Báo nhân viên" yêu cầu hỗ trợ → 409', r.status === 409 && /phục vụ/.test(r.body?.message), r);
r = await waiter.post(`/api/phuc-vu/requests/${supportId}/accept`);
ok('phục vụ nhận yêu cầu hỗ trợ → forwarded, có tên người nhận', r.body.status === 'forwarded' && r.body.assignedName === 'Hoàng Gia Nam', r);
info = await pub(T05);
ok('khách thấy "Nhân viên đang đến"', info.body.support?.status === 'forwarded', info.body.support);
r = await pub(`${T05}/requests/${supportId}/cancel`, {});
ok('khách hủy yêu cầu đã chuyển → 409', r.status === 409, r);
r = await waiter.post(`/api/phuc-vu/requests/${supportId}/done`);
ok('phục vụ hoàn thành yêu cầu hỗ trợ', r.body.status === 'done', r);
const payReqId = t05reqs.find((x) => x.type === 'payment').id;
r = await tn.post(`/api/thu-ngan/requests/${payReqId}/done`);
ok('không bấm Hoàn thành yêu cầu thanh toán → 409', r.status === 409, r);
const floor = await tn.get('/api/thu-ngan/floor');
const ft = floor.body.tables.find((t) => t.code === 'T04');
ok('sơ đồ bàn: T05 cờ thanh toán, đếm yêu cầu thanh toán', ft.paymentRequest === true && ft.supportRequest === false && floor.body.requestCount >= 1, ft);
// Hóa đơn mẫu "hôm nay" bắt đầu từ 11:00 nên chạy test buổi sáng doanh thu có thể = 0.
ok('doanh thu hôm nay là số không âm', Number.isInteger(floor.body.revenueToday) && floor.body.revenueToday >= 0, floor.body.revenueToday);

/* ---------------- Lập hóa đơn khi còn món chưa xong */
let detail = await tn.get('/api/thu-ngan/orders/' + orderId);
ok('chi tiết đơn có yêu cầu thanh toán', detail.body.requests.some((x) => x.type === 'payment') && detail.body.invoice === null, detail.body.requests);
let pv = await tn.get(`/api/thu-ngan/orders/${orderId}/invoice-preview`);
ok('xem trước: 2 món chặn, VAT điền sẵn', pv.body.blockers.length === 2 && pv.body.vatTaxCode === '0312345678-001' && pv.body.requestedMethod === 'transfer', pv.body);
r = await tn.post(`/api/thu-ngan/orders/${orderId}/invoice`, { vatCompany: '', vatTaxCode: '' });
ok('lập hóa đơn khi còn món chưa xong → 409', r.status === 409 && /Còn 2 món chưa xong/.test(r.body.message), r);

/* ---------------- Hủy món (thu ngân), bếp làm món còn lại */
const items = sent.body.items;
r = await tn.post(`/api/thu-ngan/items/${items[1].id}/cancel`, { reason: 'other', note: '' });
ok('hủy món: Khác mà thiếu lý do → 422', r.status === 422, r);
r = await tn.post(`/api/thu-ngan/items/${items[1].id}/cancel`, { reason: 'wrong_order', note: '' });
ok('thu ngân hủy món chờ chế biến', r.body.order.items.find((i) => i.id === items[1].id).status === 'cancelled', r);
await bep.post('/api/bep/items/start', { ids: [items[0].id] });
r = await tn.post(`/api/thu-ngan/items/${items[0].id}/cancel`, { reason: 'wrong_order', note: '' });
ok('hủy món đang chế biến → 409', r.status === 409 && /bắt đầu chế biến/.test(r.body.message), r);
r = await tn.post(`/api/thu-ngan/orders/${orderId}/cancel`, { reason: 'left', note: '' });
ok('hủy đơn có món đang làm → 409', r.status === 409 && /đã chế biến/.test(r.body.message), r);
await bep.post('/api/bep/items/complete', { ids: [items[0].id] });

/* ---------------- Lập hóa đơn */
r = await tn.post(`/api/thu-ngan/orders/${orderId}/invoice`, { vatCompany: 'Cty B', vatTaxCode: '' });
ok('có tên công ty thiếu MST → 422', r.status === 422 && r.body.fields?.vatTaxCode, r);
r = await tn.post(`/api/thu-ngan/orders/${orderId}/invoice`, { vatCompany: 'Công ty TNHH Thử', vatTaxCode: '0312345678-001' });
const inv = r.body;
const expected = ds[0].price * 2;
ok('lập hóa đơn HD…, tổng đúng, chưa thanh toán', r.status === 200 && /^HD\d{4}-\d{3}$/.test(inv.code) && inv.total === expected && inv.status === 'unpaid', r);
ok('hóa đơn có mã QR chuyển khoản hợp lệ', inv.transfer && inv.transfer.payload.startsWith('000201') && inv.transfer.payload.includes('970436')
  && inv.transfer.payload.slice(-4) === crc16(inv.transfer.payload.slice(0, -4)) && inv.transfer.content === inv.code.replace('-', ' '), inv.transfer);
info = await pub(T05);
ok('khách thấy hóa đơn + QR', info.body.invoice?.code === inv.code && info.body.invoice.transfer?.amount === expected && info.body.order.locked, info.body.invoice);
r = await pub(T05 + '/orders', { items: [{ dishId: ds[2].id, qty: 1 }] });
ok('đơn khóa: khách gửi thêm → 409', r.status === 409, r);
r = await tn.post(`/api/thu-ngan/orders/${orderId}/invoice`, { vatCompany: '', vatTaxCode: '' });
ok('lập hóa đơn lần 2 → 409', r.status === 409, r);

/* ---------------- Thu tiền: lỗi */
r = await tn.post(`/api/thu-ngan/invoices/${inv.id}/pay`, { payments: [{ method: 'cash', amount: expected - 1000 }] });
ok('tổng thu chưa khớp → 422', r.status === 422 && /chưa khớp/.test(r.body.message), r);
r = await tn.post(`/api/thu-ngan/invoices/${inv.id}/pay`, { payments: [{ method: 'cash', amount: expected, cashGiven: expected - 1 }] });
ok('tiền khách đưa chưa đủ → 422', r.status === 422, r);

/* ---------------- Hủy hóa đơn, lập lại */
r = await tn.post(`/api/thu-ngan/invoices/${inv.id}/cancel`, { reason: 'abc' });
ok('lý do hủy < 5 ký tự → 422', r.status === 422, r);
r = await tn.post(`/api/thu-ngan/invoices/${inv.id}/cancel`, { reason: 'Khách gọi thêm món' });
ok('hủy hóa đơn chưa thanh toán', r.body.status === 'cancelled' && r.body.cancelReason === 'Khách gọi thêm món', r);
info = await pub(T05);
ok('khách: đơn mở khóa, không còn hóa đơn', info.body.invoice === null && info.body.order.locked === false, info.body);
r = await tn.post(`/api/thu-ngan/orders/${orderId}/invoice`, { vatCompany: '', vatTaxCode: '' });
const inv2 = r.body;
ok('lập lại hóa đơn mới', r.status === 200 && inv2.code !== inv.code, r);

/* ---------------- Thu tiền: hai hình thức */
const cashPart = 100000;
r = await tn.post(`/api/thu-ngan/invoices/${inv2.id}/pay`, { payments: [
  { method: 'cash', amount: cashPart, cashGiven: 200000 },
  { method: 'transfer', amount: expected - cashPart, transactionRef: 'FT123' },
] });
ok('thanh toán 2 hình thức → Đã thanh toán, tiền thối đúng', r.status === 200 && r.body.status === 'paid' && r.body.payments[0].change === 100000 && r.body.transfer === null, r);
detail = await tn.get('/api/thu-ngan/orders/' + orderId);
ok('đơn Hoàn tất, món đã xong → đã mang ra', detail.body.order.status === 'completed' && detail.body.closedAt && detail.body.order.items.every((i) => ['served', 'cancelled'].includes(i.status)), detail.body.order);
ok('bàn T04 về Trống', sql("SELECT status FROM dining_tables WHERE code='T04'") === 'available');
ok('yêu cầu thanh toán tự Hoàn thành', sql(`SELECT status FROM service_requests WHERE id=${payReqId}`) === 'done');
info = await pub(T05);
ok('khách thấy "Cảm ơn quý khách"', info.body.order === null && info.body.paid?.code === inv2.code, info.body);
r = await tn.post(`/api/thu-ngan/invoices/${inv2.id}/pay`, { payments: [{ method: 'cash', amount: expected }] });
ok('thanh toán lại → 409 đã xử lý', r.status === 409 && /đã được xử lý/.test(r.body.message), r);
r = await tn.post(`/api/thu-ngan/invoices/${inv2.id}/cancel`, { reason: 'Thử hủy hóa đơn đã trả' });
ok('hủy hóa đơn đã thanh toán → 409', r.status === 409, r);

/* ---------------- Danh sách hóa đơn / đơn */
let list = await tn.get('/api/thu-ngan/invoices');
ok('danh sách hóa đơn hôm nay có 2 hóa đơn vừa lập', list.body.items.some((x) => x.code === inv.code && x.status === 'cancelled') && list.body.items.some((x) => x.code === inv2.code && x.status === 'paid'), list.body.count);
ok('tổng theo hình thức có chuyển khoản', list.body.byMethod.transfer >= expected - cashPart, list.body.byMethod);
r = await tn.get(`/api/thu-ngan/invoices?keyword=${encodeURIComponent(inv2.code)}`);
ok('tìm hóa đơn theo mã', r.body.items.length === 1 && r.body.items[0].methods.join() === 'cash,transfer', r.body);
r = await tn.get('/api/thu-ngan/invoices?from=2026-01-01&to=2026-11-14');
ok('khoảng ngày > 31 → 422', r.status === 422, r);
r = await tn.get('/api/thu-ngan/orders?status=completed');
ok('đơn hoàn tất hôm nay có đơn T05', r.body.items.some((o) => o.id === orderId && o.invoiceCode === inv2.code), r.body.count);
r = await tn.get('/api/thu-ngan/orders?status=awaiting_payment');
ok('lọc chờ thanh toán (rỗng)', r.status === 200 && r.body.items.every((o) => o.status === 'awaiting_payment'), r.body);
r = await tn.get('/api/thu-ngan/invoices/' + inv2.id);
ok('chi tiết hóa đơn có thông tin nhà hàng', r.body.restaurant.name && r.body.lines.length === 1, r.body.restaurant);

/* ---------------- Chuyển bàn */
const t03order = sql("SELECT o.id FROM orders o JOIN dining_tables t ON t.id=o.table_id WHERE t.code='T03' AND o.status='open'");
const targets = await tn.get('/api/thu-ngan/move-targets');
const t05target = targets.body.find((t) => t.code === 'T04');
ok('bàn đích có T04, không có T03/VIP01', t05target && !targets.body.some((t) => ['T03', 'VIP01', 'SV01'].includes(t.code)), targets.body.map((t) => t.code));
const vip = sql("SELECT id FROM dining_tables WHERE code='VIP01'");
r = await tn.post(`/api/thu-ngan/orders/${t03order}/move`, { tableId: vip });
ok('chuyển sang bàn có khách → 409', r.status === 409 && /vừa có khách/.test(r.body.message), r);
r = await tn.post(`/api/thu-ngan/orders/${t03order}/move`, { tableId: t05target.id });
ok('chuyển T03 → T04', r.status === 200 && r.body.order.tableCode === 'T04', r);
ok('T03 Trống, T04 Có khách', sql("SELECT status FROM dining_tables WHERE code='T03'") === 'available' && sql("SELECT status FROM dining_tables WHERE code='T04'") === 'occupied');
ok('yêu cầu đang chờ của T03 đi theo', sql("SELECT t.code FROM service_requests s JOIN dining_tables t ON t.id=s.table_id WHERE s.status='new' AND s.request_type='support' ORDER BY s.id LIMIT 1") === 'T04');
info = await pub(T03);
ok('QR T03 không còn thấy đơn', info.body.order === null, info.body.order);

/* ---------------- Hủy đơn */
await tn.post(`/api/thu-ngan/tables/${sql("SELECT id FROM dining_tables WHERE code='T06'")}/open`, {});
const s6 = await pub(T06 + '/orders', { items: [{ dishId: ds[3].id, qty: 1 }] });
await pub(T06 + '/requests', { type: 'support', content: '' });
r = await tn.post(`/api/thu-ngan/orders/${s6.body.id}/cancel`, { reason: 'left', note: '' });
ok('hủy đơn → Đã hủy, bàn Trống, yêu cầu hủy theo', r.body.order.status === 'cancelled' && sql("SELECT status FROM dining_tables WHERE code='T06'") === 'available'
  && sql(`SELECT COUNT(*) FROM service_requests WHERE table_id=(SELECT id FROM dining_tables WHERE code='T06') AND status='new'`) === '0', r.body.order?.status);

/* ---------------- Quản lý: tài khoản nhận tiền, dashboard */
r = await tn.get('/api/settings/payment');
ok('thu ngân không xem cấu hình thanh toán → 403', r.status === 403, r.status);
r = await ql.get('/api/settings/payment');
ok('quản lý xem tài khoản nhận tiền', r.body.configured && r.body.bankBin === '970436', r.body);
r = await ql.put('/api/settings/payment', { bankBin: '12', bankName: '', accountNo: '1', accountName: '' });
ok('cấu hình sai → 422 (3 lỗi)', r.status === 422 && Object.keys(r.body.fields).length === 3, r.body);
r = await ql.put('/api/settings/payment', { bankBin: '970422', bankName: 'MB Bank', accountNo: '0123456789', accountName: 'Nhà hàng Green Lotus' });
ok('lưu tài khoản: tên chủ TK in hoa không dấu', r.body.accountName === 'NHA HANG GREEN LOTUS' && r.body.bankBin === '970422', r.body);
for (const p of ['today', 'yesterday', 'last7', 'last30', 'thisMonth', 'lastMonth']) {
  const rev = await ql.get('/api/dashboard/revenue?period=' + p);
  const sum = rev.body.series.reduce((a, x) => a + x.current, 0);
  ok(`doanh thu ${p}: có dữ liệu, tổng biểu đồ = tổng`, rev.body.hasData && sum === rev.body.total && rev.body.orders > 0, { total: rev.body.total, sum, n: rev.body.series.length });
}
const top = await ql.get('/api/dashboard/top-dishes?period=last30');
ok('món bán chạy / chậm', top.body.best.length === 5 && top.body.slow.length === 5 && top.body.best[0].share === 100, top.body.best.map((d) => d.name + ':' + d.quantity));

console.log(`\n${pass} PASS, ${fail} FAIL`);
