// [02-dat-mon-bep.mjs] B, C: khách gọi món qua QR, bếp bắt đầu / xong / Đã lấy / hủy món / món tạm hết
import { BASE, DB, FIXTURES, OUT, UPLOADS, sql } from '../lib/env.mjs';
// Bộ này thử luồng bếp / thu ngân: tắt bắt buộc phục vụ xác nhận đơn (V22; luồng xác nhận thử ở bộ 13).
sql("UPDATE system_settings SET setting_value='false' WHERE setting_key='order.require_confirm'; SELECT 1");
// Gọi thử API đợt 1 Đặt món / Bếp / Thu ngân trên backend 8081.
const token = sql(`SELECT qr_token FROM dining_tables WHERE code='T05'`);
const tokenT03 = sql(`SELECT qr_token FROM dining_tables WHERE code='T03'`);
let pass = 0, fail = 0;
const ok = (n, c, x = '') => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'} ${n}${c ? '' : ' — ' + JSON.stringify(x).slice(0, 300)}`); };
const j = async (r) => ({ status: r.status, body: await r.json().catch(() => null) });
const pub = (p, opt = {}) => fetch(BASE + '/api/public/qr/' + p, { headers: { 'Content-Type': 'application/json' }, ...opt }).then(j);
async function login(user) {
  const r = await fetch(BASE + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: user, password: 'Rms@2026' }) });
  const cookie = r.headers.get('set-cookie').split(';')[0];
  return (path, opt = {}) => fetch(BASE + path, { ...opt, headers: { 'Content-Type': 'application/json', Cookie: cookie } }).then(j);
}

const info = await pub(token);
ok('mở trang bằng QR (T05, chưa có đơn)', info.status === 200 && info.body.tableCode === 'T05' && info.body.order === null, info);
ok('QR sai → 404', (await pub('khongtontai')).status === 404);
const menu = await pub(token + '/menu');
ok('thực đơn có món và danh mục', menu.body.dishes.length > 10 && menu.body.categories.length > 3, menu.status);
const soldOut = menu.body.dishes.find((d) => d.soldOut);
ok('có món tạm hết (T-bone)', soldOut && soldOut.name.includes('T-bone'), soldOut);
const d1 = menu.body.dishes.find((d) => !d.soldOut);
const d2 = menu.body.dishes.filter((d) => !d.soldOut)[1];

// SSE của bếp: đếm sự kiện
const ctrl = new AbortController();
const bep = await login('hung.pham');
let kitchenEvents = 0;
const bepCookie = (await fetch(BASE + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'hung.pham', password: 'Rms@2026' }) })).headers.get('set-cookie').split(';')[0];
fetch(BASE + '/api/bep/stream', { headers: { Cookie: bepCookie }, signal: ctrl.signal }).then(async (r) => {
  const reader = r.body.getReader();
  const dec = new TextDecoder();
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    const t = dec.decode(value);
    kitchenEvents += (t.match(/event:change/g) || []).length;
  }
}).catch(() => {});
await new Promise((r) => setTimeout(r, 800));

// Mở bàn (thu ngân) trước khi khách gửi món.
const t05id = sql(`SELECT id FROM dining_tables WHERE code='T05'`);
await (await login('linh.tran'))(`/api/thu-ngan/tables/${t05id}/open`, { method: 'POST', body: '{}' });
const sent = await pub(token + '/orders', { method: 'POST', body: JSON.stringify({ items: [{ dishId: d1.id, qty: 2, note: 'ít cay' }, { dishId: d2.id, qty: 1 }] }) });
const isOpen = info.body.openNow;
if (isOpen) {
  ok('gửi đặt món tạo đơn mới', sent.status === 200 && sent.body.items.length === 2 && /^DH\d{4}-\d{3}$/.test(sent.body.code), sent);
  await new Promise((r) => setTimeout(r, 800));
  ok('bếp nhận sự kiện realtime', kitchenEvents >= 1, kitchenEvents);
  const sent2 = await pub(token + '/orders', { method: 'POST', body: JSON.stringify({ items: [{ dishId: d1.id, qty: 1 }] }) });
  ok('gửi lần 2 cộng vào cùng đơn, đợt 2', sent2.body.id === sent.body.id && sent2.body.items.some((i) => i.batchNo === 2), sent2);
  const so = await pub(token + '/orders', { method: 'POST', body: JSON.stringify({ items: [{ dishId: soldOut.id, qty: 1 }] }) });
  ok('chặn món tạm hết', so.status === 422 && /đã hết/.test(so.body.message), so);
  const cancelId = sent2.body.items.find((i) => i.batchNo === 2).id;
  const c = await pub(`${token}/items/${cancelId}/cancel`, { method: 'POST' });
  ok('khách hủy món chờ chế biến', c.body.items.find((i) => i.id === cancelId).status === 'cancelled', c);
} else {
  ok('ngoài giờ phục vụ chặn gửi món', sent.status === 409 && /ngoài giờ/.test(sent.body.message), sent);
}

// Bếp
const q = await bep('/api/bep/queue');
ok('màn hình bếp có món chờ / đang làm', q.status === 200 && q.body.items.length >= 4, q.status);
const pendingT03 = q.body.items.find((i) => i.tableCode === 'T03' && i.status === 'pending');
const st = await bep('/api/bep/items/start', { method: 'POST', body: JSON.stringify({ ids: [pendingT03.id] }) });
ok('bắt đầu chế biến', st.body.items.find((i) => i.id === pendingT03.id).status === 'cooking', st);
const cp = await bep('/api/bep/items/complete', { method: 'POST', body: JSON.stringify({ ids: [pendingT03.id] }) });
ok('hoàn thành', cp.body.recent.some((i) => i.id === pendingT03.id), cp);
const un = await bep(`/api/bep/items/${pendingT03.id}/undo`, { method: 'POST' });
ok('hoàn tác hoàn thành', un.body.items.find((i) => i.id === pendingT03.id)?.status === 'cooking', un);
const another = (await bep('/api/bep/queue')).body.items.find((i) => i.status === 'pending');
const cn = await bep(`/api/bep/items/${another.id}/cancel`, { method: 'POST', body: JSON.stringify({ reason: 'other', note: '' }) });
ok('hủy lý do Khác bắt buộc nhập', cn.status === 422, cn);
const cn2 = await bep(`/api/bep/items/${another.id}/cancel`, { method: 'POST', body: JSON.stringify({ reason: 'out_of_stock', markSoldOut: true }) });
ok('bếp hủy món + đánh dấu tạm hết', cn2.status === 200 && !cn2.body.items.some((i) => i.id === another.id), cn2);
const dishes = await bep('/api/bep/dishes');
ok('danh sách món tạm hết', dishes.body.filter((d) => d.soldOut).length >= 2, dishes.body.filter((d) => d.soldOut).map((d) => d.name));
const back = await bep(`/api/bep/dishes/${soldOut.id}/sold-out`, { method: 'PATCH', body: JSON.stringify({ soldOut: false }) });
ok('bán lại món', back.body.soldOut === false, back);

// Thu ngân
const tn = await login('linh.tran');
const floor = await tn('/api/thu-ngan/floor');
ok('sơ đồ bàn', floor.status === 200 && floor.body.tables.length >= 12 && floor.body.occupiedCount >= 3, floor.body?.occupiedCount);
ok('có món chờ mang ra (VIP01)', floor.body.ready.some((r) => r.tableCode === 'VIP01'), floor.body.ready);
const readyIds = floor.body.ready.filter((r) => r.tableCode === 'VIP01').map((r) => r.id);
ok('thu ngân không còn API "Đã mang ra" (bếp bấm Đã lấy)', (await tn('/api/thu-ngan/items/serve', { method: 'POST', body: JSON.stringify({ ids: readyIds }) })).status >= 400);
const sv = await bep('/api/bep/items/serve', { method: 'POST', body: JSON.stringify({ ids: readyIds }) });
ok('bếp bấm Đã lấy → món rời danh sách Chờ lấy', sv.status === 200 && !sv.body.recent.some((i) => readyIds.includes(i.id)), sv);
const floor2 = await tn('/api/thu-ngan/floor');
ok('sơ đồ thu ngân: VIP01 hết món chờ mang ra', !floor2.body.ready.some((r) => r.tableCode === 'VIP01'), floor2.body.ready);
const ntf = await tn('/api/notifications');
ok('thu ngân nhận thông báo bếp hủy món', ntf.body.items.some((n) => /Bếp hủy món/.test(n.title) && n.href?.startsWith('/thu-ngan/don/')), ntf.body.items.slice(0, 2));
ok('thu ngân không gọi được API bếp', (await tn('/api/bep/queue')).status === 403);
ok('khách T03 thấy đơn của bàn', (await pub(tokenT03 + '/order')).body.order?.tableCode === 'T03');

ctrl.abort();
console.log(`\n${pass} pass, ${fail} fail`);
process.exit(0);
