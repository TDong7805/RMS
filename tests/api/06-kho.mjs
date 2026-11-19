// [06-kho.mjs] F1–F12, E3, E11, E12: nguyên liệu, nhà cung cấp, phiếu mua, nhập / xuất, kiểm kê, công nợ
import { BASE, DB, FIXTURES, OUT, UPLOADS, sql } from '../lib/env.mjs';
// Kiểm thử API khu Kho theo kịch bản F1–F12 (+ E11, E12 phía Quản lý) — dữ liệu mẫu Royal Beef, backend 8081.
let pass = 0, fail = 0;
const ok = (n, c, x = '') => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'} ${n}${c ? '' : ' — ' + JSON.stringify(x).slice(0, 400)}`); };
const j = async (r) => ({ status: r.status, body: await r.json().catch(() => null) });
async function login(user) {
  const r = await fetch(BASE + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: user, password: 'Rms@2026' }) });
  const cookie = r.headers.get('set-cookie').split(';')[0];
  const call = (method) => (path, body) => fetch(BASE + path, { method, headers: { 'Content-Type': 'application/json', Cookie: cookie }, body: body === undefined ? undefined : JSON.stringify(body) }).then(j);
  return { get: call('GET'), post: call('POST'), put: call('PUT'), patch: call('PATCH'), del: call('DELETE') };
}
const kho = await login('thao.bui');
const SUF = Date.now().toString().slice(-5);
const ql = await login('tuan.nguyen');
const tn = await login('linh.tran');
const ing = async (id) => (await kho.get('/api/kho/ingredients/' + id)).body;

/* F1 Dashboard kho */
let r = await kho.get('/api/kho/dashboard');
ok('F1 dashboard: giá trị tồn > 0, có sắp hết / hết, biểu đồ', r.status === 200 && r.body.stockValue > 0 && r.body.lowCount >= 1 && r.body.outCount >= 1 && r.body.series.length > 0, r.body && { v: r.body.stockValue, low: r.body.lowCount, out: r.body.outCount });
ok('F1 cần nhập thêm có T-bone (hết hàng)', r.body.needRestock.some((x) => /T-bone/i.test(x.name)), r.body.needRestock.map((x) => x.name));
ok('thu ngân không vào được API kho', (await tn.get('/api/kho/dashboard')).status === 403);

/* F2 Nguyên liệu: thêm, trùng tên, sửa định mức → tình trạng */
r = await kho.get('/api/kho/ingredients?stock=all');
const list = r.body.items;
ok('F2 danh sách nguyên liệu', r.status === 200 && r.body.total >= 25, r.body.total);
r = await kho.post('/api/kho/ingredients', { name: '', group: 'meat', unit: 'kg', minLevel: 1 });
ok('F2 thiếu tên → 422', r.status === 422 && r.body.fields?.name, r);
const dupName = list[0].name;
r = await kho.post('/api/kho/ingredients', { name: dupName, group: 'meat', unit: 'kg', minLevel: 1 });
ok('F2 trùng tên → 422', r.status === 422 && r.body.fields?.name, r);
r = await kho.post('/api/kho/ingredients', { name: 'Bắp hoa bò Úc test ' + SUF, group: 'meat', unit: 'kg', minLevel: 4, note: 'test', openingQty: 10, openingCost: 300000 });
const newIng = r.body;
ok('F2 thêm nguyên liệu có tồn đầu kỳ', r.status === 200 && /^NL\d+/.test(newIng.code) && newIng.onHand === 10 && newIng.stockLevel === 'ok', r);
r = await kho.put('/api/kho/ingredients/' + newIng.id, { name: newIng.name, group: 'meat', unit: 'kg', minLevel: 12, note: 'test' });
ok('F2 sửa định mức 12 > tồn 10 → Sắp hết', r.status === 200 && r.body.stockLevel === 'low', r.body?.stockLevel);
r = await kho.put('/api/kho/ingredients/' + newIng.id, { name: newIng.name, group: 'meat', unit: 'g', minLevel: 12, note: 'test' });
ok('F2 đổi đơn vị khi đã có tồn / biến động → bị chặn', r.status >= 400 || r.body?.unit === 'kg', r);

/* F3 Chi tiết: lịch sử, nhà cung cấp, món đang dùng */
const ribeye = list.find((x) => /Ribeye bò Úc/.test(x.name));
let d = await ing(ribeye.id);
ok('F3 chi tiết Ribeye: có nhà cung cấp và món đang dùng', d.suppliers.length >= 1 && d.dishes.length >= 1, { s: d.suppliers?.length, dishes: d.dishes?.map((x) => x.name) });
r = await kho.get(`/api/kho/ingredients/${ribeye.id}/moves`);
ok('F3 lịch sử biến động có tồn đầu kỳ', r.status === 200 && (r.body.items ?? r.body).length >= 1, r.status);

/* F4 Nhà cung cấp: thêm + gắn giá, lịch sử giá */
r = await kho.post('/api/kho/suppliers', { name: 'NCC thử nghiệm', phone: '0909', paymentMethod: 'cash', links: [] });
ok('F4 SĐT sai → 422', r.status === 422 && r.body.fields?.phone, r);
r = await kho.post('/api/kho/suppliers', { name: 'Công ty Thịt Bò Test ' + SUF, phone: '0909123456', paymentMethod: 'transfer', contact: 'Anh Test', links: [{ ingredientId: newIng.id, purchaseUnit: 'kg', factor: 1, price: 310000, minOrder: 2 }] });
const sup = r.body;
ok('F4 thêm nhà cung cấp + gắn nguyên liệu', r.status === 200 && /^NCC/.test(sup.code), r);
const supD = (await kho.get('/api/kho/suppliers/' + sup.id)).body;
const link = supD.links.find((l) => l.ingredientId === newIng.id);
r = await kho.put('/api/kho/supplier-links/' + link.id, { ingredientId: newIng.id, purchaseUnit: 'kg', factor: 1, price: 320000, minOrder: 2 });
ok('F4 đổi giá', r.status === 200, r);
r = await kho.get(`/api/kho/supplier-links/${link.id}/prices`);
ok('F4 lịch sử giá: đổi trong cùng ngày ghi đè giá ngày đó (320.000)', r.status === 200 && r.body.length === 1 && r.body[0].price === 320000, r.body);

/* F5 Phiếu mua: nháp → sửa → đặt hàng */
const po0 = { supplierId: sup.id, name: 'Nhập bắp hoa test', orderDate: new Date().toISOString().slice(0, 10), expectedDate: new Date(Date.now() + 864e5).toISOString().slice(0, 10), note: '', discountPercent: null, discount: 0, taxPercent: 0, otherCost: 0, lines: [{ ingredientId: newIng.id, qty: 5, unitPrice: 320000 }] };
r = await kho.post('/api/kho/purchase-orders?action=draft', po0);
const po = r.body;
ok('F5 lưu nháp phiếu mua', r.status === 200 && po.status === 'draft', r);
r = await kho.put(`/api/kho/purchase-orders/${po.id}?action=order`, { ...po0, lines: [{ ingredientId: newIng.id, qty: 6, unitPrice: 320000 }] });
ok('F5 sửa + đặt hàng → Đang chờ nhận', r.status === 200 && r.body.status === 'ordered' && r.body.receiveStatus === 'not_received' && r.body.total === 1920000, r.body);
let pod = (await kho.get('/api/kho/purchase-orders/' + po.id)).body;

/* F6 Nhận hàng một phần rồi nhận nốt; tồn + giá vốn */
const before = await ing(newIng.id);
r = await kho.post(`/api/kho/purchase-orders/${po.id}/receipts`, { note: '', lines: [{ purchaseOrderItemId: pod.lines[0].id, qty: 2, note: '' }] });
ok('F6 nhận 2/6', r.status === 200, r);
pod = (await kho.get('/api/kho/purchase-orders/' + po.id)).body;
ok('F6 phiếu mua → Nhận một phần', pod.receiveStatus === 'partial', pod.receiveStatus);
r = await kho.post(`/api/kho/purchase-orders/${po.id}/receipts`, { note: '', lines: [{ purchaseOrderItemId: pod.lines[0].id, qty: 10, note: '' }] });
ok('F6 nhận quá số còn lại → bị chặn', r.status >= 400, r);
r = await kho.post(`/api/kho/purchase-orders/${po.id}/receipts`, { note: '', lines: [{ purchaseOrderItemId: pod.lines[0].id, qty: 4, note: '' }] });
pod = (await kho.get('/api/kho/purchase-orders/' + po.id)).body;
const afterRec = await ing(newIng.id);
ok('F6 nhận nốt → Đã nhận đủ', pod.receiveStatus === 'received', pod.receiveStatus);
ok('F6 tồn tăng 6', Math.abs(afterRec.onHand - before.onHand - 6) < 1e-6, { before: before.onHand, after: afterRec.onHand });
ok('F6 giá vốn bình quân đổi (300k → giữa 300k–320k)', afterRec.avgCost > before.avgCost && afterRec.avgCost < 320000, { before: before.avgCost, after: afterRec.avgCost });

/* F7 Nhập không theo phiếu */
r = await kho.post('/api/kho/receipts/direct', { supplierId: null, sourceName: 'Chợ Bến Thành', note: 'mua lẻ', lines: [{ ingredientId: newIng.id, unit: 'kg', qty: 1.5, unitPrice: 330000 }] });
ok('F7 nhập không theo phiếu', r.status === 200 && /^PN/.test(r.body.code ?? ''), r);
ok('F7 tồn tăng 1,5', Math.abs((await ing(newIng.id)).onHand - afterRec.onHand - 1.5) < 1e-6);

/* F8 Xuất kho: cho bếp, hủy, quá tồn, dưới định mức → thông báo */
const emp = (await kho.get('/api/kho/employees')).body;
const hung = emp.find((e) => /Hùng/.test(e.fullName));
const onHand1 = (await ing(newIng.id)).onHand;
r = await kho.post('/api/kho/issues', { reason: 'kitchen', receiverId: hung?.id, note: '', lines: [{ ingredientId: newIng.id, qty: onHand1 + 5 }] });
ok('F8 xuất quá tồn → bị chặn', r.status >= 400, r);
r = await kho.post('/api/kho/issues', { reason: 'kitchen', receiverId: hung?.id, note: 'ca tối', lines: [{ ingredientId: newIng.id, qty: onHand1 - 3 }] });
ok('F8 xuất cho bếp', r.status === 200, r);
const lowNow = await ing(newIng.id);
ok('F8 tồn còn 3 < định mức 12 → Sắp hết', Math.abs(lowNow.onHand - 3) < 1e-6 && lowNow.stockLevel === 'low', { onHand: lowNow.onHand, lv: lowNow.stockLevel });
r = await kho.post('/api/kho/issues', { reason: 'damaged', receiverId: null, note: 'hỏng', lines: [{ ingredientId: newIng.id, qty: 0.5 }] });
ok('F8 xuất hủy (hư hỏng)', r.status === 200, r);
const nk = (await kho.get('/api/notifications')).body;
const nq = (await ql.get('/api/notifications')).body;
const lowMsg = (n) => n.items.some((x) => new RegExp('Bắp hoa bò Úc test ' + SUF).test(x.title + ' ' + (x.body ?? x.content ?? '')));
ok('F8 thông báo sắp hết tới Kho', lowMsg(nk), nk.items.slice(0, 3).map((x) => x.title));
ok('F8 thông báo sắp hết tới Quản lý', lowMsg(nq), nq.items.slice(0, 3).map((x) => x.title));

/* F9–F11 Kiểm kê: tạo, nhập lệch, gửi duyệt; Quản lý duyệt / từ chối */
r = await kho.post('/api/kho/stocktakes', { scope: 'pick', groups: [], ingredientIds: [newIng.id], note: 'kiểm thử' });
const st = r.body;
ok('F9 tạo phiếu kiểm kê', r.status === 200 && st.lines?.length === 1, r);
const line = st.lines[0];
r = await kho.put(`/api/kho/stocktakes/${st.id}/lines/${line.id}`, { actualQty: (line.bookQty ?? line.onHand) - 1, reason: 'natural', note: 'hao hụt', estUnitCost: null });
ok('F9 nhập số thực tế lệch', r.status === 200, r);
r = await kho.post(`/api/kho/stocktakes/${st.id}/submit`, {});
ok('F9 gửi duyệt → Chờ duyệt', r.status === 200 && /pending|submitted|waiting/.test(r.body.status), r.body?.status);
const nq2 = (await ql.get('/api/notifications')).body;
ok('F9 Quản lý nhận thông báo kiểm kê', nq2.items.some((x) => x.href?.includes('/kiem-ke/' + st.id)), nq2.items.slice(0, 3));
const beforeApprove = (await ing(newIng.id)).onHand;
r = await ql.patch(`/api/stocktake-approvals/${st.id}/approve`, {});
ok('F10/E11 Quản lý duyệt', r.status === 200, r);
ok('F10 tồn điều chỉnh -1 theo số thực tế', Math.abs((await ing(newIng.id)).onHand - (beforeApprove - 1)) < 1e-6);
const nk2 = (await kho.get('/api/notifications')).body;
ok('F10 Kho nhận thông báo đã duyệt', nk2.items.some((x) => x.href?.includes('/kiem-ke/' + st.id)), nk2.items.slice(0, 3));
r = await kho.post('/api/kho/stocktakes', { scope: 'pick', groups: [], ingredientIds: [newIng.id], note: 'lần 2' });
const st2 = r.body;
await kho.put(`/api/kho/stocktakes/${st2.id}/lines/${st2.lines[0].id}`, { actualQty: 0, reason: 'lost', note: 'mất', estUnitCost: null });
await kho.post(`/api/kho/stocktakes/${st2.id}/submit`, {});
r = await ql.patch(`/api/stocktake-approvals/${st2.id}/reject`, { reason: '' });
ok('F11 từ chối không lý do → 422', r.status === 422, r);
r = await ql.patch(`/api/stocktake-approvals/${st2.id}/reject`, { reason: 'Đếm lại giúp, lệch quá nhiều' });
const st2d = (await kho.get('/api/kho/stocktakes/' + st2.id)).body;
ok('F11 Kho thấy lý do từ chối', r.status === 200 && /Đếm lại/.test(st2d.rejectReason ?? ''), st2d.rejectReason);

/* F12 / E12 Công nợ NCC: ghi nhận thanh toán */
r = await kho.get('/api/kho/debts/' + sup.id);
ok('F12 công nợ NCC test = 1.920.000', r.status === 200 && Math.round(r.body.debt) === 1920000, r.body && { payable: r.body.payable, paid: r.body.paid, debt: r.body.debt });
r = await kho.post('/api/kho/payments', { purchaseOrderId: po.id, amount: 3000000, method: 'cash', paidDate: new Date().toISOString().slice(0, 10), reference: '', note: '' });
ok('F12 trả vượt nợ → bị chặn', r.status >= 400, r);
r = await kho.post('/api/kho/payments', { purchaseOrderId: po.id, amount: 1000000, method: 'transfer', paidDate: new Date().toISOString().slice(0, 10), reference: 'UNC001', note: '' });
ok('F12 trả 1.000.000', r.status === 200, r);
pod = (await kho.get('/api/kho/purchase-orders/' + po.id)).body;
ok('F12 phiếu mua → Thanh toán một phần, còn nợ 920.000', pod.paymentStatus === 'partial' && Math.round(pod.debt) === 920000, { ps: pod.paymentStatus, debt: pod.debt });
r = await ql.get('/api/supplier-debts/' + sup.id);
ok('E12 Quản lý xem công nợ khớp bên Kho', r.status === 200 && Math.round(r.body.debt) === 920000, r.body?.debt);
r = await ql.get('/api/dashboard/inventory');
ok('E3 thẻ Kho trên dashboard Quản lý', r.status === 200, r.status);

console.log(`\n${pass} PASS, ${fail} FAIL`);
