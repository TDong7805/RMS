// [09-bai-viet.mjs] E13: bài viết
import { BASE, DB, FIXTURES, OUT, UPLOADS, sql } from '../lib/env.mjs';
// Kiểm thử API Quản lý bài viết. CSDL tạm (DB=...), thư mục ảnh tạm (UPLOADS=...).
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
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = y * (w * 3 + 1) + 1 + x * 3; raw[i] = x % 256; raw[i + 1] = 100; raw[i + 2] = y % 256; }
  const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 2;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ih), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
const dataUrl = (b) => `data:image/png;base64,${b.toString('base64')}`;
const fileOf = (url) => (UPLOADS && url ? path.join(UPLOADS, url.replace(/^\/uploads\//, '')) : null);
const body = (p, patch = {}) => ({ title: p.title, summary: p.summary, content: p.content, coverImage: p.coverImage, category: p.category, status: p.status, ...patch });
const CONTENT = 'Nội dung bài viết thử nghiệm đủ dài để hợp lệ.\n\n- Dòng một\n- Dòng hai';

const m = client();
await m('POST', '/api/auth/login', { username: 'tuan.nguyen', password: 'Rms@2026' });

// ---------------------------------------------------------------- Danh sách
let r = await m('GET', '/api/posts');
ok('Danh sách: 8 bài/trang, 7 bài, đếm theo trạng thái', r.status === 200 && r.data.items.length === 7 && r.data.total === 7 && JSON.stringify(r.data.counts) === '{"all":7,"draft":1,"published":5,"hidden":1}', JSON.stringify(r.data.counts));
const times = r.data.items.map((p) => p.updatedAt);
ok('Sắp xếp mới cập nhật trước, có tác giả', times.every((t, i) => !i || times[i - 1] >= t) && r.data.items.every((p) => p.author === 'Nguyễn Anh Tuấn'));
r = await m('GET', '/api/posts?status=published');
ok('Lọc Đã xuất bản → 5 bài, counts vẫn đủ các tab', r.data.total === 5 && r.data.counts.all === 7);
r = await m('GET', '/api/posts?category=promotion');
ok('Lọc chuyên mục Ưu đãi → 2 bài, counts theo chuyên mục', r.data.total === 2 && r.data.counts.all === 2 && r.data.counts.hidden === 1);
r = await m('GET', '/api/posts?keyword=nhac%20acoustic');
ok('Tìm không dấu theo tiêu đề', r.data.total === 1 && /acoustic/.test(r.data.items[0].title));
r = await m('GET', '/api/posts?keyword=ngay%20sinh');
ok('Tìm theo tóm tắt', r.data.total === 1 && /sinh nhật/.test(r.data.items[0].title));
r = await m('GET', '/api/posts?keyword=khongcobaiviet');
ok('Không có kết quả → rỗng', r.data.total === 0 && r.data.items.length === 0);
r = await m('GET', '/api/posts/999999');
ok('Bài không tồn tại → 404 "không tồn tại"', r.status === 404 && /không tồn tại/.test(r.data.message));
r = await m('GET', '/api/posts/abc');
ok('Id sai → 404', r.status === 404);

// ---------------------------------------------------------------- Thêm: kiểm tra dữ liệu
r = await m('POST', '/api/posts', { title: '  ', summary: 'x'.repeat(301), content: 'ngắn', category: 'abc', status: 'xyz', coverImage: null });
ok('Dữ liệu sai → 422 đủ các ô', r.status === 422 && ['title', 'summary', 'content', 'category', 'status'].every((k) => r.data.fields[k]), JSON.stringify(r.data.fields));
r = await m('POST', '/api/posts', { title: '!!! ???', summary: '', content: CONTENT, category: 'news', status: 'draft', coverImage: null });
ok('Tiêu đề không có chữ/số → 422', r.status === 422 && /chữ hoặc số/.test(r.data.fields.title));
r = await m('POST', '/api/posts', { title: 'Bài dài', summary: '', content: 'a'.repeat(20001), category: 'news', status: 'draft', coverImage: null });
ok('Nội dung quá 20.000 ký tự → 422', r.status === 422 && /20\.000/.test(r.data.fields.content));
r = await m('POST', '/api/posts', { title: 'ĐÊM NHẠC Acoustic tại sân vườn!', summary: '', content: CONTENT, category: 'event', status: 'draft', coverImage: null });
ok('Trùng đường dẫn với bài khác (khác hoa thường, dấu câu) → 422', r.status === 422 && /trùng tiêu đề/.test(r.data.fields.title), JSON.stringify(r.data));

// ---------------------------------------------------------------- Thêm nháp kèm ảnh bìa
r = await m('POST', '/api/posts', { title: '  Khai   trương chi nhánh mới ', summary: ' Tóm tắt ', content: '  ' + CONTENT + '  ', category: 'news', status: 'draft', coverImage: dataUrl(png(1920, 1080)) });
const draft = r.data;
ok('Thêm bài nháp → 200, chuẩn hóa, đường dẫn từ tiêu đề, chưa xuất bản', r.status === 200 && draft.title === 'Khai trương chi nhánh mới' && draft.slug === 'khai-truong-chi-nhanh-moi' && draft.summary === 'Tóm tắt' && draft.content === CONTENT && draft.publishedAt === null && draft.author === 'Nguyễn Anh Tuấn', JSON.stringify(draft).slice(0, 300));
ok('Ảnh bìa lưu tại /uploads/posts/...jpg', /^\/uploads\/posts\/[0-9a-f-]+\.jpg$/.test(draft.coverImage ?? ''), draft.coverImage);
ok('Xem ảnh bìa không cần đăng nhập', (await fetch(BASE + draft.coverImage)).status === 200);
r = await m('PUT', `/api/posts/${draft.id}`, body(draft, { title: 'Khai trương chi nhánh Quận 7' }));
ok('Bài nháp: đổi tiêu đề → đường dẫn đổi theo, ảnh giữ nguyên', r.status === 200 && r.data.slug === 'khai-truong-chi-nhanh-quan-7' && r.data.coverImage === draft.coverImage);

// ---------------------------------------------------------------- Xuất bản → khóa đường dẫn
r = await m('PATCH', `/api/posts/${draft.id}/status`, { status: 'published' });
const firstPublished = r.data.publishedAt;
ok('Xuất bản → có thời điểm xuất bản', r.status === 200 && r.data.status === 'published' && firstPublished);
r = await m('PUT', `/api/posts/${draft.id}`, body(r.data, { title: 'Khai trương chi nhánh Quận 7 – ưu đãi 20%' }));
ok('Đã xuất bản: đổi tiêu đề → đường dẫn GIỮ NGUYÊN', r.status === 200 && r.data.title === 'Khai trương chi nhánh Quận 7 – ưu đãi 20%' && r.data.slug === 'khai-truong-chi-nhanh-quan-7', r.data.slug);
r = await m('PATCH', `/api/posts/${draft.id}/status`, { status: 'hidden' });
ok('Ẩn bài', r.status === 200 && r.data.status === 'hidden');
await new Promise((res) => setTimeout(res, 1100));
r = await m('PATCH', `/api/posts/${draft.id}/status`, { status: 'published' });
ok('Xuất bản lại → giữ thời điểm xuất bản lần đầu', r.status === 200 && r.data.publishedAt === firstPublished, `${firstPublished} vs ${r.data.publishedAt}`);
r = await m('PATCH', `/api/posts/${draft.id}/status`, { status: 'abc' });
ok('Trạng thái lạ → 422', r.status === 422);
const published = (await m('GET', `/api/posts/${draft.id}`)).data;

// ---------------------------------------------------------------- Ảnh bìa: đổi / bỏ / lỗi
const oldCover = fileOf(published.coverImage);
r = await m('PUT', `/api/posts/${published.id}`, body(published, { coverImage: dataUrl(png(800, 450)) }));
const changed = r.data;
ok('Đổi ảnh bìa → ảnh mới, file cũ bị xóa', r.status === 200 && changed.coverImage !== published.coverImage && (!UPLOADS || !existsSync(oldCover)));
r = await m('PUT', `/api/posts/${published.id}`, body(changed, { coverImage: dataUrl(Buffer.from('không phải ảnh')) }));
ok('Ảnh bìa không phải ảnh → 422 ở ô coverImage', r.status === 422 && /JPG, PNG hoặc WebP/.test(r.data.fields.coverImage), JSON.stringify(r.data));
r = await m('PUT', `/api/posts/${published.id}`, body(changed, { coverImage: null }));
ok('Bỏ ảnh bìa → null, file bị xóa', r.status === 200 && r.data.coverImage === null && (!UPLOADS || !existsSync(fileOf(changed.coverImage))));

// ---------------------------------------------------------------- Thêm bài xuất bản ngay, xóa
r = await m('POST', '/api/posts', { title: 'Ưu đãi Black Friday', summary: '', content: CONTENT, category: 'promotion', status: 'published', coverImage: dataUrl(png(600, 400)) });
const pub2 = r.data;
ok('Thêm và xuất bản ngay → có thời điểm xuất bản', r.status === 200 && pub2.publishedAt && pub2.status === 'published');
r = await m('DELETE', `/api/posts/${pub2.id}`);
ok('Xóa bài → 204, ảnh bìa bị xóa', r.status === 204 && (!UPLOADS || !existsSync(fileOf(pub2.coverImage))));
ok('Bài đã xóa → 404', (await m('GET', `/api/posts/${pub2.id}`)).status === 404);
r = await m('DELETE', `/api/posts/${pub2.id}`);
ok('Xóa lại bài đã xóa → 404', r.status === 404);

// ---------------------------------------------------------------- Tác giả đã xóa tài khoản
r = await m('POST', '/api/accounts', { username: 'test.qlbaiviet', fullName: 'Thử Tác Giả', email: 'test.qlbaiviet@example.com', phone: '', role: 'manager', password: 'TacGia2026' });
const author = r.data;
const a = client();
await a('POST', '/api/auth/login', { username: 'test.qlbaiviet', password: 'TacGia2026' });
await a('POST', '/api/auth/change-password', { currentPassword: 'TacGia2026', newPassword: 'TacGia2027', confirmPassword: 'TacGia2027' });
r = await a('POST', '/api/posts', { title: 'Bài của quản lý khác', summary: '', content: CONTENT, category: 'news', status: 'draft', coverImage: null });
ok('Tác giả là người đang đăng nhập', r.status === 200 && r.data.author === 'Thử Tác Giả');
const other = r.data;
await m('DELETE', `/api/accounts/${author.id}`);
ok('Tác giả bị xóa tài khoản → bài vẫn còn, giữ tên tác giả', (await m('GET', `/api/posts/${other.id}`)).data.author === 'Thử Tác Giả');
await m('DELETE', `/api/posts/${other.id}`);

// ---------------------------------------------------------------- Phân quyền, nhật ký
const cashier = client();
await cashier('POST', '/api/auth/login', { username: 'linh.tran', password: 'Rms@2026' });
ok('Thu ngân gọi API bài viết → 403', (await cashier('GET', '/api/posts')).status === 403);
r = await m('GET', '/api/audit-logs?module=post');
const actions = (r.data.items ?? []).map((x) => x.action);
ok('Nhật ký: thêm, cập nhật, xuất bản, ẩn, xóa', ['Thêm bài viết', 'Cập nhật bài viết', 'Xuất bản bài viết', 'Ẩn bài viết', 'Xóa bài viết'].every((x) => actions.includes(x)), actions.join(', '));

sql(`DELETE FROM audit_logs WHERE detail LIKE '%test.%'`);
console.log(`\n${pass}/${pass + fail} PASS`);
process.exit(fail ? 1 : 0);
