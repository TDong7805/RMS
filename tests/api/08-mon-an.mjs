// [08-mon-an.mjs] E8, E9: món ăn, danh mục, ảnh, thực đơn AI / combo
import { BASE, DB, FIXTURES, OUT, UPLOADS, sql } from '../lib/env.mjs';
// Kiểm thử API Quản lý món ăn + Thực đơn AI/Combo. Chạy trên CSDL tạm (DB=...), thư mục ảnh tạm (UPLOADS=...).
import { deflateSync } from 'node:zlib';
import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';

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
    return { status: res.status, data, headers: res.headers };
  };
}

// ---- Tạo ảnh PNG thật (không cần thư viện): w×h, RGB hoặc RGBA.
const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc32 = (buf) => { let c = 0xffffffff; for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(w, h, alpha = false) {
  const ch = alpha ? 4 : 3;
  const raw = Buffer.alloc((w * ch + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * ch + 1)] = 0;
    for (let x = 0; x < w; x++) {
      const i = y * (w * ch + 1) + 1 + x * ch;
      raw[i] = (x * 255) / w; raw[i + 1] = 120; raw[i + 2] = (y * 255) / h;
      if (alpha) raw[i + 3] = x < w / 2 ? 0 : 255;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = alpha ? 6 : 2;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
const dataUrl = (buf, mime = 'image/png') => `data:${mime};base64,${buf.toString('base64')}`;
/** Kích thước ảnh JPG/PNG từ nội dung file. */
function dims(buf) {
  if (buf[0] === 0x89) return { type: 'png', w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
  let i = 2;
  while (i < buf.length) {
    const marker = buf[i + 1];
    const len = buf.readUInt16BE(i + 2);
    if (marker >= 0xc0 && marker <= 0xc3) return { type: 'jpg', h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7) };
    i += 2 + len;
  }
  return null;
}
const fileOf = (url) => UPLOADS && url ? path.join(UPLOADS, url.replace(/^\/uploads\//, '')) : null;
const inputOf = (d, patch = {}) => ({
  name: d.name, categoryId: d.categoryId, price: d.price, description: d.description, image: d.image, status: d.status,
  ingredients: d.ingredients, allergens: d.allergens, spicyLevel: d.spicyLevel, ...patch,
});

const m = client();
await m('POST', '/api/auth/login', { username: 'tuan.nguyen', password: 'Rms@2026' });
const cats = (await m('GET', '/api/dish-categories')).data;
const catId = (name) => cats.find((c) => c.name === name)?.id;
const dishByCode = async (code) => (await m('GET', `/api/dishes?keyword=${code}`)).data.items.find((d) => d.code === code);

// ---------------------------------------------------------------- Danh sách, tìm, lọc
let r = await m('GET', '/api/dishes');
ok('Danh sách: 10 món/trang, 56 món, 6 trang', r.status === 200 && r.data.items.length === 10 && r.data.total === 56 && r.data.pageCount === 6, JSON.stringify({ t: r.data.total, p: r.data.pageCount }));
const times = r.data.items.map((d) => d.updatedAt);
ok('Sắp xếp: mới cập nhật trước', times.every((t, i) => i === 0 || times[i - 1] >= t));
ok('Món có đủ trường (dị nguyên, thẻ AI, đã bán, giá số nguyên)', r.data.items.every((d) => Array.isArray(d.allergens) && Array.isArray(d.aiTags) && typeof d.usedInOrders === 'boolean' && Number.isInteger(d.price)));
r = await m('GET', '/api/dishes?page=6');
ok('Trang 6 có 6 món', r.data.items.length === 6 && r.data.page === 6);
r = await m('GET', '/api/dishes?keyword=bun%20bo%20hue');
ok('Tìm không dấu "bun bo hue" → Bún bò Huế', r.data.items.length === 1 && r.data.items[0].name === 'Bún bò Huế', JSON.stringify(r.data.items.map((d) => d.name)));
r = await m('GET', '/api/dishes?keyword=ma015');
ok('Tìm theo mã món', r.data.items.length === 1 && r.data.items[0].code === 'MA015');
r = await m('GET', `/api/dishes?categoryId=${catId('Lẩu bò')}`);
ok('Lọc theo danh mục Lẩu bò → 4 món', r.data.total === 4 && r.data.items.every((d) => d.categoryId === catId('Lẩu bò')));
r = await m('GET', '/api/dishes?status=stopped');
ok('Lọc Ngừng bán → 1 món, AI tắt', r.data.total === 1 && r.data.items.every((d) => d.status === 'stopped' && !d.aiEnabled));
r = await m('GET', '/api/dishes?keyword=khongcomon');
ok('Không có kết quả → danh sách rỗng', r.data.total === 0 && r.data.items.length === 0);
r = await m('GET', '/api/dishes/abc');
ok('Id sai → 404', r.status === 404 && /không tồn tại/.test(r.data.message));
r = await m('GET', '/api/dishes/999999');
ok('Id không có → 404', r.status === 404);
r = await m('GET', '/api/allergens');
ok('Dị nguyên lấy từ CSDL (9 loại)', r.data.length === 9 && r.data.includes('Hạt cây'));

// ---------------------------------------------------------------- Thêm: kiểm tra dữ liệu
r = await m('POST', '/api/dishes', { name: '   ', categoryId: '', price: -5, description: 'x'.repeat(501), ingredients: '', allergens: ['Không có'], spicyLevel: 7, image: null, status: 'selling' });
ok('Thêm sai → 422 đủ các ô', r.status === 422 && ['name', 'categoryId', 'price', 'description', 'allergens', 'spicyLevel'].every((k) => r.data.fields[k]), JSON.stringify(r.data.fields));
r = await m('POST', '/api/dishes', { name: 'Món thử', categoryId: catId('Khai vị'), price: 1000.5, image: null });
ok('Giá có phần lẻ → 422', r.status === 422 && /phần lẻ/.test(r.data.fields.price));
r = await m('POST', '/api/dishes', { name: 'Món thử', categoryId: catId('Khai vị'), price: 200000000, image: null });
ok('Giá vượt giới hạn → 422', r.status === 422 && /giới hạn/.test(r.data.fields.price));
r = await m('POST', '/api/dishes', { name: 'Món thử', categoryId: catId('Món theo mùa'), price: 1000, image: null });
ok('Danh mục đang tắt → 422', r.status === 422 && /ngừng hoạt động/.test(r.data.fields.categoryId), r.data?.fields?.categoryId);
r = await m('POST', '/api/dishes', { name: '  bò LÚC   lắc khoai TÂY ', categoryId: catId('Bò nướng & áp chảo'), price: 1000, image: null });
ok('Trùng tên trong danh mục (không phân biệt hoa thường) → 422 kèm mã món', r.status === 422 && /MA013/.test(r.data.fields.name), r.data?.fields?.name);
r = await m('POST', '/api/dishes', { name: 'Bò lúc lắc khoai tây', categoryId: catId('Khai vị'), price: 1000, ingredients: '', image: null });
ok('Cùng tên nhưng khác danh mục → được', r.status === 200, JSON.stringify(r.data));
await m('DELETE', `/api/dishes/${r.data?.id}`);

// ---------------------------------------------------------------- Ảnh
r = await m('POST', '/api/dishes', { name: 'Món ảnh giả', categoryId: catId('Khai vị'), price: 1000, image: dataUrl(Buffer.from('<?php echo 1; ?> không phải ảnh'), 'image/png') });
ok('File không phải ảnh (đổi tên .png) → 422', r.status === 422 && /JPG, PNG hoặc WebP/.test(r.data.fields.image), r.data?.fields?.image);
r = await m('POST', '/api/dishes', { name: 'Món ảnh to', categoryId: catId('Khai vị'), price: 1000, image: dataUrl(Buffer.alloc(2.2 * 1024 * 1024, 7)) });
ok('Ảnh quá 2 MB → 422', r.status === 422 && /2 MB/.test(r.data.fields.image), r.data?.fields?.image);
r = await m('POST', '/api/dishes', { name: 'Món ảnh hỏng', categoryId: catId('Khai vị'), price: 1000, image: dataUrl(png(50, 50).subarray(0, 60)) });
ok('Ảnh hỏng → 422', r.status === 422 && /Không đọc được|hỏng/.test(r.data.fields.image), r.data?.fields?.image);
r = await m('POST', '/api/dishes', { name: 'Món ảnh sai', categoryId: catId('Khai vị'), price: 1000, image: 'http://evil.example/a.jpg' });
ok('Ảnh là đường dẫn lạ → 422', r.status === 422 && r.data.fields.image);
const filesBefore = UPLOADS && existsSync(path.join(UPLOADS, 'dishes')) ? readdirSync(path.join(UPLOADS, 'dishes')).length : 0;

r = await m('POST', '/api/dishes', {
  name: '  Gỏi   cuốn   chay ', categoryId: catId('Khai vị'), price: 39000, description: ' Cuốn rau củ ', ingredients: 'Bánh tráng, rau sống, đậu hũ',
  allergens: ['Đậu nành', 'Đậu nành'], spicyLevel: 0, status: 'selling', image: dataUrl(png(1600, 1000)),
});
const created = r.data;
ok('Thêm món kèm ảnh → 200, mã MA057, chuẩn hóa tên', r.status === 200 && created.code === 'MA057' && created.name === 'Gỏi cuốn chay' && created.description === 'Cuốn rau củ' && created.aiEnabled && !created.usedInOrders, JSON.stringify(created).slice(0, 300));
ok('Dị nguyên trùng chỉ lưu một lần', JSON.stringify(created.allergens) === '["Đậu nành"]');
ok('Ảnh trả về là đường dẫn /uploads/dishes/...jpg', /^\/uploads\/dishes\/[0-9a-f-]+\.jpg$/.test(created.image ?? ''), created.image);
let img = await fetch(BASE + created.image);
let buf = Buffer.from(await img.arrayBuffer());
let d = dims(buf);
ok('Xem ảnh: 200, image/jpeg, lưu đệm lâu dài', img.status === 200 && img.headers.get('content-type') === 'image/jpeg' && /max-age=31536000/.test(img.headers.get('cache-control') ?? ''), img.headers.get('content-type') + ' ' + img.headers.get('cache-control'));
ok('Ảnh 1600×1000 được thu nhỏ còn 1200×750, lưu lại thành JPG', d?.type === 'jpg' && d.w === 1200 && d.h === 750, JSON.stringify(d));
ok('Ảnh xem được không cần đăng nhập (khách xem thực đơn)', (await fetch(BASE + created.image)).status === 200);
const oldFile = fileOf(created.image);
ok('File ảnh nằm trong thư mục lưu trữ', !UPLOADS || existsSync(oldFile));
ok('CSDL chỉ lưu khóa ảnh, không lưu đường dẫn', sql(`SELECT image_url FROM dishes WHERE id=${created.id}`) === created.image.replace('/uploads/', ''));

r = await m('PUT', `/api/dishes/${created.id}`, inputOf(created, { price: 42000 }));
ok('Sửa giữ nguyên ảnh (gửi lại địa chỉ cũ) → ảnh không đổi', r.status === 200 && r.data.image === created.image && r.data.price === 42000 && r.data.code === 'MA057');
r = await m('PUT', `/api/dishes/${created.id}`, inputOf(created, { price: 42000, image: dataUrl(png(400, 300, true)) }));
const withAlpha = r.data;
ok('Đổi ảnh có nền trong suốt → lưu PNG', r.status === 200 && /\.png$/.test(withAlpha.image ?? ''), withAlpha?.image);
buf = Buffer.from(await (await fetch(BASE + withAlpha.image)).arrayBuffer());
d = dims(buf);
ok('Ảnh nhỏ (400×300) giữ nguyên kích thước', d?.type === 'png' && d.w === 400 && d.h === 300, JSON.stringify(d));
ok('Đổi ảnh → file ảnh cũ bị xóa', !UPLOADS || !existsSync(oldFile));
ok('Địa chỉ ảnh cũ trả 404', (await fetch(BASE + created.image)).status === 404);
r = await m('PUT', `/api/dishes/${created.id}`, inputOf(withAlpha, { image: 'data:image/png;base64,AAAA' }));
ok('Sửa với ảnh lỗi → 422, ảnh hiện tại giữ nguyên', r.status === 422 && (await m('GET', `/api/dishes/${created.id}`)).data.image === withAlpha.image);
r = await m('PUT', `/api/dishes/${created.id}`, inputOf(withAlpha, { image: null }));
ok('Bỏ ảnh → image null, file bị xóa', r.status === 200 && r.data.image === null && (!UPLOADS || !existsSync(fileOf(withAlpha.image))));
const filesAfter = UPLOADS ? readdirSync(path.join(UPLOADS, 'dishes')).length : 0;
ok('Không còn file ảnh rác sau các lần lỗi / đổi ảnh', !UPLOADS || filesAfter === filesBefore, `${filesBefore} → ${filesAfter}`);
r = await fetch(BASE + '/uploads/..%2f..%2fapplication.properties');
ok('Không đọc được file ngoài thư mục ảnh', r.status === 404 || r.status === 400, r.status);

// ---------------------------------------------------------------- Sửa, trạng thái, danh mục tắt
const ma001 = await dishByCode('MA001');
const snapshotBefore = sql(`SELECT GROUP_CONCAT(DISTINCT unit_price) FROM order_items WHERE dish_id=${ma001.id}`);
r = await m('PUT', `/api/dishes/${ma001.id}`, inputOf(ma001, { price: 45000 }));
ok('Sửa giá món đã bán → 200', r.status === 200 && r.data.price === 45000);
ok('Giá trong các đơn hàng cũ không đổi (bản chụp)', sql(`SELECT GROUP_CONCAT(DISTINCT unit_price) FROM order_items WHERE dish_id=${ma001.id}`) === snapshotBefore, snapshotBefore);
await m('PUT', `/api/dishes/${ma001.id}`, inputOf(ma001));

const ma025 = await dishByCode('MA039'); // món Ngừng bán, thuộc danh mục đã tắt "Món theo mùa"
r = await m('PUT', `/api/dishes/${ma025.id}`, inputOf(ma025, { description: 'Chỉ bán dịp lễ hội cuối năm' }));
ok('Món ngừng bán trong danh mục đã tắt: vẫn sửa được thông tin', r.status === 200, JSON.stringify(r.data?.fields ?? r.data?.message));
r = await m('PUT', `/api/dishes/${ma025.id}`, inputOf(ma025, { status: 'selling' }));
ok('…nhưng không chuyển sang Đang bán được (422)', r.status === 422 && /Ngừng bán/.test(r.data.fields.categoryId ?? ''), r.data?.fields?.categoryId);
r = await m('PATCH', `/api/dishes/${ma025.id}/status`, { status: 'selling' });
ok('Bật bán món thuộc danh mục tắt → 409 "hãy bật danh mục trước"', r.status === 409 && /bật danh mục/.test(r.data.message));

const ma004 = await dishByCode('MA004');
r = await m('PATCH', `/api/dishes/${ma004.id}/status`, { status: 'stopped' });
ok('Ngừng bán → AI tự tắt, ghi thời điểm đổi trạng thái', r.status === 200 && r.data.status === 'stopped' && !r.data.aiEnabled && r.data.statusUpdatedAt >= ma004.statusUpdatedAt, JSON.stringify(r.data).slice(0, 200));
r = await m('PATCH', `/api/dishes/${ma004.id}/status`, { status: 'selling' });
ok('Bán lại → AI vẫn tắt (quản lý tự bật lại trong Chatbot)', r.status === 200 && r.data.status === 'selling' && !r.data.aiEnabled);
r = await m('PATCH', `/api/dishes/${ma004.id}/status`, { status: 'abc' });
ok('Trạng thái lạ → 422', r.status === 422);

// ---------------------------------------------------------------- Xóa
r = await m('DELETE', `/api/dishes/${ma001.id}`);
ok('Xóa món đã có trong đơn hàng → 409, hướng dẫn Ngừng bán', r.status === 409 && /Ngừng bán/.test(r.data.message), r.data?.message);
// dữ liệu mẫu: món nào cũng đã có trong đơn → tạo một món mới để thử xóa
const ma016 = (await m('POST', '/api/dishes', { name: 'Món xóa thử', categoryId: catId('Khai vị'), price: 10000, ingredients: '', image: null })).data;
r = await m('DELETE', `/api/dishes/${ma016.id}`);
ok('Xóa món chưa bán → 204', r.status === 204);
ok('Món đã xóa → 404', (await m('GET', `/api/dishes/${ma016.id}`)).status === 404);
r = await m('PUT', `/api/dishes/${created.id}`, inputOf(created, { image: dataUrl(png(300, 300)) }));
const toDelete = r.data;
await m('DELETE', `/api/dishes/${created.id}`);
ok('Xóa món → xóa luôn file ảnh', !UPLOADS || !existsSync(fileOf(toDelete.image)));

// ---------------------------------------------------------------- Danh mục
r = await m('POST', '/api/dish-categories', { name: '  KHAI VỊ ', active: true });
ok('Danh mục trùng tên (không phân biệt hoa thường) → 422', r.status === 422 && /đã tồn tại/.test(r.data.fields.name));
r = await m('POST', '/api/dish-categories', { name: '', active: true });
ok('Danh mục rỗng → 422', r.status === 422);
r = await m('POST', '/api/dish-categories', { name: 'Món   nướng', active: true });
const grill = r.data;
ok('Thêm danh mục → thứ tự cuối, 0 món', r.status === 200 && grill.name === 'Món nướng' && grill.sortOrder === 11 && grill.dishCount === 0, JSON.stringify(grill));
r = await m('PUT', `/api/dish-categories/${grill.id}`, { name: 'Món nướng than', active: false });
ok('Sửa tên + tắt danh mục', r.status === 200 && r.data.name === 'Món nướng than' && r.data.active === false);
r = await m('PUT', '/api/dish-categories/999999', { name: 'X', active: true });
ok('Danh mục không tồn tại → 404', r.status === 404);

// ---------------------------------------------------------------- Chatbot: thực đơn AI
r = await m('GET', '/api/chatbot/menu');
ok('Thực đơn AI: đủ món, chưa đồng bộ lần nào', r.status === 200 && r.data.dishes.length === 56 && r.data.lastSync === null, r.data?.dishes?.length);
r = await m('PATCH', `/api/chatbot/menu/${ma025.id}`, { aiEnabled: true });
ok('Bật gợi ý món Ngừng bán → 409', r.status === 409 && /Ngừng bán/.test(r.data.message));
r = await m('PATCH', `/api/chatbot/menu/${ma004.id}`, { aiEnabled: true });
ok('Bật lại gợi ý món đang bán', r.status === 200 && r.data.aiEnabled === true);
r = await m('PATCH', `/api/chatbot/menu/${ma004.id}`, { aiTags: ['Bán chạy', 'Thẻ lạ'] });
ok('Thẻ không có trong danh sách → 422', r.status === 422 && /Thẻ lạ/.test(r.data.fields.aiTags));
r = await m('PATCH', `/api/chatbot/menu/${ma004.id}`, { aiTags: ['Bán chạy', 'Cay', 'Bán chạy'] });
ok('Gắn thẻ → lưu, bỏ trùng', r.status === 200 && JSON.stringify(r.data.aiTags) === '["Bán chạy","Cay"]', JSON.stringify(r.data?.aiTags));
r = await m('POST', '/api/chatbot/menu/sync');
ok('Đồng bộ thực đơn → số món, số món AI dùng, món thiếu dữ liệu', r.status === 200 && r.data.total === 56 && r.data.enabled > 0 && r.data.missingData.some((x) => x.missing.includes('mô tả')), JSON.stringify(r.data).slice(0, 200));
r = await m('GET', '/api/chatbot/menu');
ok('Lần đồng bộ gần nhất được lưu', r.data.lastSync?.total === 56);

// ---------------------------------------------------------------- Chatbot: combo
const ids = async (...codes) => Promise.all(codes.map(async (c) => (await dishByCode(c)).id));
r = await m('POST', '/api/chatbot/combos', { name: 'Combo thử', dishIds: await ids('MA002'), note: '', active: true });
ok('Set 1 món → 422', r.status === 422 && /ít nhất 2/.test(r.data.fields.dishIds));
r = await m('POST', '/api/chatbot/combos', { name: 'Combo thử', dishIds: await ids('MA002', 'MA039'), note: '', active: true });
ok('Set có món ngừng bán → 422', r.status === 422 && /Wagyu A5/.test(r.data.fields.dishIds), r.data?.fields?.dishIds);
r = await m('POST', '/api/chatbot/combos', { name: 'set bữa trưa văn phòng', dishIds: await ids('MA002', 'MA003'), note: '', active: true });
ok('Set trùng tên → 422', r.status === 422 && /đã tồn tại/.test(r.data.fields.name));
r = await m('POST', '/api/chatbot/combos', { name: 'Combo nướng', dishIds: await ids('MA013', 'MA015', 'MA017'), note: 'Nhóm thích đồ nướng', active: true });
const combo = r.data;
ok('Thêm set (chỉ Chatbot gợi ý, chưa có giá) → 200', r.status === 200 && combo.dishIds.length === 3 && combo.note === 'Nhóm thích đồ nướng');
r = await m('PUT', `/api/chatbot/combos/${combo.id}`, { name: 'Combo nướng cay', dishIds: await ids('MA015', 'MA017'), note: '', active: false });
ok('Sửa set', r.status === 200 && r.data.dishIds.length === 2 && !r.data.active && r.data.name === 'Combo nướng cay');
r = await m('DELETE', `/api/chatbot/combos/${combo.id}`);
ok('Xóa set → 204', r.status === 204 && !(await m('GET', '/api/chatbot/combos')).data.some((c) => c.id === combo.id));

// ---------------------------------------------------------------- Phân quyền, nhật ký
const cashier = client();
await cashier('POST', '/api/auth/login', { username: 'linh.tran', password: 'Rms@2026' });
ok('Thu ngân gọi API món → 403', (await cashier('GET', '/api/dishes')).status === 403);
ok('Chưa đăng nhập → 401', (await client()('GET', '/api/dishes')).status === 401);
r = await m('GET', '/api/audit-logs?module=dish');
const actions = (r.data.items ?? []).map((x) => x.action);
ok('Nhật ký món: thêm, sửa, đổi trạng thái, xóa, danh mục', ['Thêm món ăn', 'Cập nhật món ăn', 'Đổi trạng thái món', 'Xóa món ăn', 'Thêm danh mục', 'Cập nhật danh mục'].every((a) => actions.includes(a)), actions.join(', '));
ok('Nhật ký sửa giá ghi rõ giá cũ → mới', r.data.items.some((x) => /giá 89\.000 ₫ → 45\.000 ₫/.test(x.detail ?? '')));
r = await m('GET', '/api/audit-logs?module=chatbot');
const cActions = (r.data.items ?? []).map((x) => x.action);
ok('Nhật ký chatbot: bật gợi ý, gắn thẻ, đồng bộ, set', ['Bật gợi ý món', 'Gắn thẻ món', 'Đồng bộ thực đơn', 'Thêm set', 'Xóa set'].every((a) => cActions.includes(a)), cActions.join(', '));

console.log(`\n${pass}/${pass + fail} PASS`);
process.exit(fail ? 1 : 0);
