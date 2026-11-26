// [15-website-khach.mjs] Website khách hàng: API công khai (thông tin, thực đơn, album, đặt bàn) + cấu hình ở trang Quản lý.
// Chạy trên rms_test mới (xem tests/README.md). Bộ này dùng 5 lượt đặt bàn của giới hạn 5 lượt / IP / 10 phút:
// chạy lại lần nữa thì khởi động lại backend (-ResetTest) trước.
import { BASE, UPLOADS, sql } from '../lib/env.mjs';
import { deflateSync } from 'node:zlib';
import { existsSync } from 'node:fs';
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
    return { status: res.status, data };
  };
}
const crcT = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = (b) => { let c = 0xffffffff; for (const x of b) c = crcT[(c ^ x) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
function png(w, h) {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = y * (w * 3 + 1) + 1 + x * 3; raw[i] = x % 256; raw[i + 1] = 80; raw[i + 2] = y % 256; }
  const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 2;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ih), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
const dataUrl = (b) => `data:image/png;base64,${b.toString('base64')}`;
const fileOf = (url) => (UPLOADS && url ? path.join(UPLOADS, url.replace(/^\/uploads\//, '')) : null);
const addDays = (key, n) => { const [y, m, d] = key.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10); };
const weekday = (key) => { const [y, m, d] = key.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)).getUTCDay(); };

const guest = client(); // khách: không đăng nhập
const m = client();
await m('POST', '/api/auth/login', { username: 'tuan.nguyen', password: 'Rms@2026' });

// ---------------------------------------------------------------- Thông tin chung (không đăng nhập)
let r = await guest('GET', '/api/public/site');
ok('GET /api/public/site không cần đăng nhập → 200', r.status === 200, r.status);
const site = r.data;
ok('Thương hiệu lấy từ Cấu hình: tên Royal Beef, slogan + danh hiệu mẫu', site.brand.name === 'Royal Beef' && site.brand.award === 'Michelin Selected 2026' && site.brand.slogan.length > 0, JSON.stringify(site.brand));
ok('Banner chưa có ảnh riêng → dùng ảnh bìa nhà hàng (hoặc null)', site.brand.heroImage === null || site.brand.heroImage.startsWith('/uploads/'), site.brand.heroImage);
ok('Giới thiệu: 2 đoạn, 4 điểm nhấn', site.about.paragraphs.length === 2 && site.about.highlights.length === 4, JSON.stringify(site.about).slice(0, 200));
ok('Liên hệ: SĐT, email, địa chỉ, mạng xã hội', site.contact.phone && site.contact.email && site.contact.address && site.contact.facebookUrl.startsWith('https://'));
ok('Giờ mở cửa đủ 7 ngày', site.openingHours.length === 7);
ok('Cấu hình form đặt bàn + 4 khu vực cho chọn', site.reservation.maxGuests === 20 && site.reservation.slotMinutes === 30 && site.areas.length === 4, JSON.stringify(site.reservation));
const raw = JSON.stringify(site);
ok('Không lộ thông tin nội bộ (mã số thuế, tên pháp nhân)', !raw.includes('taxCode') && !raw.includes('legalName') && !raw.includes('0123456789'));

// ---------------------------------------------------------------- Thực đơn công khai
r = await guest('GET', '/api/public/site/menu');
const menu = r.data;
ok('Thực đơn: có danh mục, món, món nổi bật', r.status === 200 && menu.categories.length > 0 && menu.items.length > 0 && menu.featured.length > 0 && menu.totalItems === menu.items.length, r.status);
ok('Món không có thành phần khai báo cho AI', !JSON.stringify(menu).includes('ingredients'));
r = await guest('GET', '/api/public/site/menu?keyword=pho%20bo');
ok('Tìm không dấu "pho bo" → có Phở bò', r.data.items.some((i) => /Phở bò/.test(i.name)), JSON.stringify(r.data.items.map((i) => i.name)));
r = await guest('GET', '/api/public/site/menu?keyword=khongcomonnay');
ok('Không có kết quả → rỗng, danh mục vẫn đủ (thanh lọc ổn định)', r.data.items.length === 0 && r.data.sets.length === 0 && r.data.categories.length === menu.categories.length);
const cat = menu.categories[0];
r = await guest('GET', `/api/public/site/menu?categoryId=${cat.id}`);
ok('Lọc theo danh mục', r.data.items.length > 0 && r.data.items.every((i) => i.categoryId === cat.id) && r.data.sets.length === 0);

const pho = menu.items.find((i) => /Phở bò/.test(i.name));
r = await guest('GET', '/api/website/menu');
ok('Khách gọi API cấu hình website → 401', r.status === 401, r.status);
r = await m('PATCH', `/api/website/menu/dishes/${pho.id}`, { visible: false });
ok('Quản lý ẩn món khỏi website', r.status === 200 && r.data.some((c) => c.dishes.some((d) => d.id === pho.id && !d.showOnWebsite)), r.status);
r = await guest('GET', '/api/public/site/menu');
ok('Món đã ẩn không còn trên website', !r.data.items.some((i) => i.id === pho.id));
ok('Món ẩn khỏi website vẫn bán ở trang gọi món (status selling)', sql(`SELECT status FROM dishes WHERE id = ${pho.id}`) === 'selling');
await m('PATCH', `/api/website/menu/dishes/${pho.id}`, { visible: true });
r = await m('PATCH', `/api/website/menu/categories/${cat.id}`, { visible: false });
r = await guest('GET', '/api/public/site/menu');
ok('Ẩn danh mục → mất danh mục và mọi món của nó', !r.data.categories.some((c) => c.id === cat.id) && !r.data.items.some((i) => i.categoryId === cat.id));
await m('PATCH', `/api/website/menu/categories/${cat.id}`, { visible: true });
r = await guest('GET', '/api/public/site/menu');
ok('Hiện lại → thực đơn như cũ', r.data.items.length === menu.items.length);
r = await m('PATCH', `/api/website/menu/dishes/${pho.id}`, {});
ok('Thiếu visible → 422', r.status === 422);
ok('Ẩn / hiện có ghi nhật ký', Number(sql("SELECT COUNT(*) FROM audit_logs WHERE action = 'Thực đơn trên website'")) >= 4);

// ---------------------------------------------------------------- Nội dung website
r = await m('GET', '/api/website/content');
const content = r.data;
ok('Quản lý đọc nội dung website', r.status === 200 && content.award === 'Michelin Selected 2026');
r = await m('PUT', '/api/website/content', { ...content, facebookUrl: 'facebook.com/abc', zaloPhone: '123', mapUrl: 'ban do', aboutHighlights: 'a\nb\nc\nd\ne\nf\ng', award: 'x'.repeat(101) });
ok('Dữ liệu sai → 422 đủ các ô', r.status === 422 && ['facebookUrl', 'zaloPhone', 'mapUrl', 'aboutHighlights', 'award'].every((k) => r.data.fields[k]), JSON.stringify(r.data?.fields));
r = await m('PUT', '/api/website/content', { ...content, slogan: '  Bò Úc   ngon nhất phố  ', heroImage: dataUrl(png(800, 450)), aboutContent: 'Đoạn một.\n\n\nĐoạn hai.' });
ok('Lưu nội dung + ảnh banner', r.status === 200 && r.data.slogan === 'Bò Úc ngon nhất phố' && r.data.heroImage?.startsWith('/uploads/website/'), JSON.stringify(r.data).slice(0, 200));
const heroFile = fileOf(r.data.heroImage);
ok('File ảnh banner đã lưu', existsSync(heroFile), heroFile);
r = await guest('GET', '/api/public/site');
ok('Website thấy ngay slogan, ảnh banner, đoạn giới thiệu mới', r.data.brand.slogan === 'Bò Úc ngon nhất phố' && r.data.brand.heroImage?.startsWith('/uploads/website/') && r.data.about.paragraphs.length === 2, JSON.stringify(r.data.brand));
r = await m('PUT', '/api/website/content', { ...content, heroImage: null });
ok('Bỏ ảnh banner → xóa file', r.status === 200 && r.data.heroImage === null && !existsSync(heroFile));

// ---------------------------------------------------------------- Album ảnh
r = await guest('GET', '/api/public/site/gallery');
// Album mẫu có thể có sẵn ảnh không gian (seed-images/website) — so sánh theo số ảnh ban đầu.
const g0 = r.data.length;
ok('Đọc album công khai', r.status === 200 && Array.isArray(r.data));
r = await m('POST', '/api/website/gallery', { image: null, caption: 'x' });
ok('Thêm ảnh thiếu ảnh → 422', r.status === 422 && r.data.fields.image);
r = await m('POST', '/api/website/gallery', { image: dataUrl(png(600, 400)), caption: 'Phòng VIP', visible: true });
const p1 = r.data;
ok('Thêm ảnh 1', r.status === 200 && p1.image.startsWith('/uploads/gallery/') && p1.sortOrder === 1, JSON.stringify(r.data));
r = await m('POST', '/api/website/gallery', { image: dataUrl(png(600, 400)), caption: 'Quầy bar', visible: true });
const p2 = r.data;
r = await guest('GET', '/api/public/site/gallery');
ok('Website thấy 2 ảnh mới ở cuối, đúng thứ tự', r.data.length === g0 + 2 && r.data[g0].id === p1.id && r.data[g0 + 1].caption === 'Quầy bar');
r = await m('PATCH', `/api/website/gallery/${p2.id}/move`, { direction: 'up' });
ok('Đưa ảnh 2 lên trước', r.status === 200 && r.data[g0].id === p2.id && r.data[g0 + 1].id === p1.id);
r = await m('PUT', `/api/website/gallery/${p1.id}`, { image: p1.image, caption: 'Phòng VIP tầng 2', visible: false });
ok('Ẩn ảnh, giữ nguyên file ảnh', r.status === 200 && !r.data.visible && r.data.image === p1.image && existsSync(fileOf(p1.image)));
r = await guest('GET', '/api/public/site/gallery');
ok('Ảnh ẩn không hiện trên website', r.data.length === g0 + 1 && r.data.every((x) => x.id !== p1.id));
r = await m('DELETE', `/api/website/gallery/${p2.id}`);
ok('Xóa ảnh → 204, xóa file', r.status === 204 && !existsSync(fileOf(p2.image)), r.status);
r = await m('DELETE', `/api/website/gallery/${p2.id}`);
ok('Xóa lần nữa → 404', r.status === 404);
await m('DELETE', `/api/website/gallery/${p1.id}`);

// ---------------------------------------------------------------- Trang chủ dài một trang (E1): bếp trưởng, món đặc trưng, trải nghiệm, không gian
r = await guest('GET', '/api/public/site');
ok('Website có lời bếp trưởng mẫu (tên + các đoạn thư)', r.data.chef?.name === 'Trần Minh Khôi' && r.data.chef.paragraphs.length >= 2, JSON.stringify(r.data.chef)?.slice(0, 120));
ok('Website có 4 món đặc trưng + 4 trải nghiệm mẫu', r.data.signatures.length === 4 && r.data.experiences.length === 4);
const tablesNow = Number(sql("SELECT COUNT(*) FROM dining_tables t JOIN areas a ON a.id = t.area_id WHERE t.status <> 'inactive' AND a.is_active = 1"));
ok('Số liệu Không gian lấy từ sơ đồ bàn (bàn đang dùng)', r.data.space.tables === tablesNow && r.data.space.seats > 0 && r.data.space.floors >= 1, JSON.stringify(r.data.space));
r = await m('PUT', '/api/website/content', { ...content, chefLetter: 'x'.repeat(2001), chefName: '' });
ok('Lá thư quá 2000 ký tự → 422', r.status === 422 && r.data.fields.chefLetter, JSON.stringify(r.data?.fields));
r = await m('PUT', '/api/website/content', { ...content, chefLetter: 'Xin chào', chefName: '' });
ok('Có lá thư mà thiếu tên người viết → 422 tại ô tên', r.status === 422 && r.data.fields.chefName);
r = await m('PUT', '/api/website/content', { ...content, chefLetter: '', chefImage: dataUrl(png(300, 400)), reserveImage: dataUrl(png(300, 400)) });
ok('Xóa lá thư, lưu ảnh chân dung + ảnh cạnh form', r.status === 200 && r.data.chefImage?.startsWith('/uploads/website/') && r.data.reserveImage?.startsWith('/uploads/website/'));
const chefFile = fileOf(r.data.chefImage), reserveFile = fileOf(r.data.reserveImage);
r = await guest('GET', '/api/public/site');
ok('Lá thư trống → website ẩn mục bếp trưởng (chef = null), vẫn có ảnh cạnh form', r.data.chef === null && r.data.reserveImage?.startsWith('/uploads/website/'));
r = await m('PUT', '/api/website/content', { ...content });
ok('Khôi phục nội dung → bỏ ảnh thì xóa file', r.status === 200 && !existsSync(chefFile) && !existsSync(reserveFile));

r = await m('GET', '/api/website/features?kind=experience');
const exp0 = r.data.length;
r = await m('POST', '/api/website/features', { kind: 'abc', title: 'x' });
ok('Loại mục sai → 422', r.status === 422 && r.data.fields.kind);
r = await m('POST', '/api/website/features', { kind: 'experience', title: ' ', description: 'x'.repeat(501) });
ok('Thiếu tên, mô tả quá dài → 422', r.status === 422 && r.data.fields.title && r.data.fields.description, JSON.stringify(r.data?.fields));
r = await m('POST', '/api/website/features', { kind: 'experience', title: '  Tiệc   cưới nhỏ ', description: 'Dưới 30 khách', image: dataUrl(png(1600, 2000)), visible: true });
const f1 = r.data;
ok('Thêm trải nghiệm (gộp khoảng trắng, ảnh lưu ở website/)', r.status === 200 && f1.title === 'Tiệc cưới nhỏ' && f1.sortOrder === exp0 + 1 && f1.image?.startsWith('/uploads/website/'), JSON.stringify(r.data));
r = await guest('GET', '/api/public/site');
ok('Website thấy trải nghiệm mới ở cuối', r.data.experiences.at(-1)?.id === f1.id);
r = await m('PATCH', `/api/website/features/${f1.id}/move`, { direction: 'up' });
ok('Đưa lên trước một bậc (chỉ trong cùng loại)', r.status === 200 && r.data.every((x) => x.kind === 'experience') && r.data[exp0 - 1].id === f1.id);
r = await m('PUT', `/api/website/features/${f1.id}`, { ...f1, visible: false });
ok('Ẩn trải nghiệm, giữ file ảnh', r.status === 200 && !r.data.visible && existsSync(fileOf(f1.image)));
r = await guest('GET', '/api/public/site');
ok('Mục ẩn không hiện trên website', r.data.experiences.every((x) => x.id !== f1.id));
for (let i = exp0 + 1; i < 8; i++) await m('POST', '/api/website/features', { kind: 'experience', title: 'KT đầy ' + i });
r = await m('POST', '/api/website/features', { kind: 'experience', title: 'KT thứ 9' });
ok('Tối đa 8 mục mỗi loại → báo lỗi', r.status >= 400 && /Tối đa 8/.test(r.data?.message ?? ''), JSON.stringify(r.data));
r = await m('DELETE', `/api/website/features/${f1.id}`);
ok('Xóa trải nghiệm → 204, xóa file ảnh', r.status === 204 && !existsSync(fileOf(f1.image)));
sql("DELETE FROM website_features WHERE title LIKE 'KT %'");
ok('Thêm / sửa / xóa mục có ghi nhật ký', Number(sql("SELECT COUNT(*) FROM audit_logs WHERE action LIKE 'Website: %'")) >= 3);
r = await guest('GET', '/api/website/features?kind=signature');
ok('Khách không gọi được API cấu hình mục', r.status === 401 || r.status === 403, r.status);

// ---------------------------------------------------------------- Đặt bàn: kiểm tra dữ liệu
const today = site.today;
const tomorrow = addDays(today, 1);
const base = { customerName: 'Khách Website', phone: '0901112233', email: '', guests: 4, date: tomorrow, time: '19:00', areaId: '', note: 'Sinh nhật' };
r = await guest('POST', '/api/public/reservations', { customerName: ' ', phone: '12345', email: 'abc', guests: 0, date: '', time: '', areaId: '', note: 'x'.repeat(301) });
ok('Dữ liệu sai → 422 (họ tên, SĐT, email, số khách, ngày, giờ, ghi chú)', r.status === 422 && ['customerName', 'phone', 'email', 'guests', 'date', 'time', 'note'].every((k) => r.data.fields[k]), JSON.stringify(r.data?.fields));
r = await guest('POST', '/api/public/reservations', { ...base, guests: 21 });
ok('Quá số khách tối đa của cấu hình → 422 guests', r.status === 422 && /tối đa 20/.test(r.data.fields.guests));
r = await guest('POST', '/api/public/reservations', { ...base, date: addDays(today, -1) });
ok('Ngày quá khứ → 422', r.status === 422 && (r.data.fields.time || r.data.fields.date));
r = await guest('POST', '/api/public/reservations', { ...base, date: addDays(today, 31) });
ok('Quá 30 ngày → 422 date', r.status === 422 && /tối đa 30 ngày/.test(r.data.fields.date), JSON.stringify(r.data?.fields));
r = await guest('POST', '/api/public/reservations', { ...base, time: '23:30' });
ok('Ngoài giờ mở cửa → 422 time', r.status === 422 && /Giờ đặt phải trong khoảng/.test(r.data.fields.time), JSON.stringify(r.data?.fields));
const dow = weekday(tomorrow);
const savedDay = sql(`SELECT CONCAT(is_open, ',', open_time, ',', close_time) FROM opening_hours WHERE day_of_week = ${dow}`);
sql(`UPDATE opening_hours SET is_open = 0 WHERE day_of_week = ${dow}`);
r = await guest('POST', '/api/public/reservations', base);
ok('Ngày nghỉ → 422 date', r.status === 422 && /không mở cửa/.test(r.data.fields.date), JSON.stringify(r.data?.fields));
sql(`UPDATE opening_hours SET is_open = ${savedDay.split(',')[0]} WHERE day_of_week = ${dow}`);
r = await guest('POST', '/api/public/reservations', { ...base, areaId: site.areas[0].id, guests: 50 });
ok('Nhiều lỗi một lượt: số khách + khu vực đã chọn', r.status === 422 && r.data.fields.guests);

// Mỗi SĐT tối đa 3 lịch sắp tới (kiểm tra trước giới hạn theo IP nên không tốn lượt).
const busy = '0907770000';
const areaId = site.areas[0].id;
for (let i = 2; i <= 4; i++) {
  sql(`INSERT INTO reservations (code, customer_name, phone, guests, reserved_at, area_id, status, source) VALUES ('TST-${i}', 'Khách bận', '${busy}', 2, TIMESTAMP('${addDays(today, i)}', '12:00'), ${areaId}, 'pending', 'website')`);
}
r = await guest('POST', '/api/public/reservations', { ...base, phone: busy });
ok('SĐT đã có 3 lịch sắp tới → 409', r.status === 409 && /3 lịch/.test(r.data.message), JSON.stringify(r.data));

// ---------------------------------------------------------------- Đặt bàn thành công
const before = Number(sql("SELECT COALESCE(MAX(CAST(SUBSTRING(code, 4) AS UNSIGNED)), 0) FROM reservations WHERE code REGEXP '^DB-[0-9]+$'"));
r = await guest('POST', '/api/public/reservations', { ...base, phone: '0901 112.233' });
const res1 = r.data;
ok('Đặt bàn hợp lệ → 201, mã DB- nối tiếp, Chờ xác nhận', r.status === 201 && res1.code === `DB-${before + 1}` && res1.status === 'pending' && res1.guests === 4, JSON.stringify(r.data));
const row = sql(`SELECT CONCAT_WS('|', source, status, IFNULL(created_by, 'NULL'), IFNULL(table_id, 'NULL'), phone, duration_minutes, note, IF(customer_id IS NULL, 'nocus', 'cus')) FROM reservations WHERE code = '${res1.code}'`);
ok('Bản ghi reservations: nguồn website, người tạo NULL, chưa xếp bàn, SĐT chuẩn hóa, có khách hàng', row === 'website|pending|NULL|NULL|0901112233|120|Sinh nhật|cus', row);
const resId = sql(`SELECT id FROM reservations WHERE code = '${res1.code}'`);
ok('Thông báo "Đặt bàn" gửi Quản lý nhà hàng', Number(sql(`SELECT COUNT(*) FROM notifications n JOIN notification_recipients x ON x.notification_id = n.id JOIN users u ON u.id = x.user_id JOIN roles ro ON ro.id = u.role_id WHERE n.type_code = 'reservation' AND n.ref_id = ${resId} AND ro.code = 'manager'`)) >= 1);
ok('Khách vãng lai lưu theo SĐT', sql("SELECT full_name FROM customers WHERE phone = '0901112233'") === 'Khách Website');
r = await m('GET', `/api/reservations?keyword=${res1.code}`);
ok('Quản lý thấy ngay ở Lịch sử đặt bàn (nguồn Website)', r.data.total === 1 && r.data.items[0].source === 'website' && r.data.items[0].status === 'pending');
r = await m('GET', '/api/notifications');
ok('Chuông thông báo của Quản lý có lịch mới', r.data.items.some((n) => n.title.includes(res1.code)), JSON.stringify(r.data.items.slice(0, 2)));

r = await guest('POST', '/api/public/reservations', base);
ok('Gửi trùng (cùng SĐT, cùng giờ) → 409 kèm mã cũ', r.status === 409 && r.data.message.includes(res1.code), JSON.stringify(r.data));

const vip = site.areas.find((a) => a.name === 'Phòng VIP');
r = await guest('POST', '/api/public/reservations', { ...base, phone: '0902223344', areaId: vip.id, guests: 6, time: '18:00' });
ok('Chọn khu Phòng VIP → lịch ở đúng khu', r.status === 201 && r.data.areaName === 'Phòng VIP', JSON.stringify(r.data));

sql('UPDATE reservation_form_config SET auto_confirm = 1 WHERE id = 1');
r = await guest('POST', '/api/public/reservations', { ...base, phone: '0903334455', time: '12:00', email: 'khach@example.com' });
ok('Bật tự xác nhận → Đã xác nhận', r.status === 201 && r.data.status === 'confirmed', JSON.stringify(r.data));
sql('UPDATE reservation_form_config SET auto_confirm = 0 WHERE id = 1');
sql('UPDATE reservation_form_config SET allow_area_choice = 0 WHERE id = 1');
r = await guest('GET', '/api/public/site');
ok('Tắt cho chọn khu → website không gửi danh sách khu', r.data.areas.length === 0 && r.data.reservation.allowAreaChoice === false);
r = await guest('POST', '/api/public/reservations', { ...base, phone: '0904445566', time: '13:00', areaId: vip.id, guests: 2 });
ok('Tắt cho chọn khu → hệ thống tự xếp khu (bỏ qua khu khách gửi)', r.status === 201 && r.data.areaName === site.areas[0].name, JSON.stringify(r.data));
sql('UPDATE reservation_form_config SET allow_area_choice = 1 WHERE id = 1');

// 4 lượt hợp lệ đã dùng; lượt 5 được, lượt 6 bị chặn.
r = await guest('POST', '/api/public/reservations', { ...base, phone: '0905556677', time: '14:00', guests: 2 });
ok('Lượt thứ 5 trong 10 phút vẫn được', r.status === 201, JSON.stringify(r.data));
r = await guest('POST', '/api/public/reservations', { ...base, phone: '0906667788', time: '15:00', guests: 2 });
ok('Lượt thứ 6 trong 10 phút → 429', r.status === 429 && /thử lại sau/.test(r.data.message), JSON.stringify(r.data));
r = await guest('POST', '/api/public/reservations', { ...base, customerName: '' });
ok('Lỗi dữ liệu vẫn trả 422 khi đang bị chặn (chỉ tính lượt hợp lệ)', r.status === 422);

sql("DELETE FROM reservations WHERE code LIKE 'TST-%'");
console.log(`\n${pass} đạt, ${fail} không đạt`);
process.exit(fail ? 1 : 0);
