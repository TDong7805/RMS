// [16-so-do-tang.mjs] Sơ đồ bàn theo tầng (mục B7, 26/11/2026): tầng, vùng khu, tường, lưu cả sơ đồ, một ô một bàn theo tầng,
// sơ đồ trực tiếp cho Quản lý, dữ liệu sơ đồ của thu ngân. Tự dọn tầng / khu / bàn tạo ra (chạy lại được).
import { BASE, sql } from '../lib/env.mjs';

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => { cond ? pass++ : fail++; console.log(`${cond ? 'PASS' : 'FAIL'} ${name}${cond || !extra ? '' : ' — ' + JSON.stringify(extra).slice(0, 300)}`); };
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
const m = client(), tn = client();
await m('POST', '/api/auth/login', { username: 'tuan.nguyen', password: 'Rms@2026' });
await tn('POST', '/api/auth/login', { username: 'linh.tran', password: 'Rms@2026' });

// Dọn lần chạy trước
sql(`DELETE t FROM dining_tables t JOIN areas a ON a.id=t.area_id JOIN floors f ON f.id=a.floor_id WHERE f.name LIKE 'Tầng KT%'`);
sql(`DELETE a FROM areas a JOIN floors f ON f.id=a.floor_id WHERE f.name LIKE 'Tầng KT%'`);
sql(`DELETE FROM floors WHERE name LIKE 'Tầng KT%'`);

/* ------------------------------------------------------------------ Đọc */
let r = await m('GET', '/api/floors');
const floors = r.data ?? [];
ok('Quản lý xem danh sách tầng, có tường', r.status === 200 && floors.length >= 1 && floors.every((f) => f.cols >= 6 && f.rows >= 4 && Array.isArray(f.walls)), r.data);
r = await m('GET', '/api/areas');
ok('khu vực có tầng + vùng khu', r.status === 200 && r.data.every((a) => a.floorId && (a.zone === null || a.zone.w >= 1)), r.data?.[0]);
const cellsOk = Number(sql(`SELECT COUNT(*) FROM (SELECT a.floor_id, t.pos_x, t.pos_y FROM dining_tables t JOIN areas a ON a.id=t.area_id GROUP BY 1,2,3 HAVING COUNT(*)>1) x`));
ok('dữ liệu hiện có: không ô nào của tầng có hai bàn', cellsOk === 0, cellsOk);
ok('thu ngân không gọi được API tầng của Quản lý', (await tn('GET', '/api/floors')).status === 403);
r = await tn('GET', '/api/thu-ngan/floor');
ok('sơ đồ thu ngân có tầng (kèm tường) và khu có tầng / vùng', r.status === 200 && r.data.floors?.length >= 1 && r.data.areas.every((a) => a.floorId) && !('cols' in r.data), Object.keys(r.data ?? {}));
r = await m('GET', '/api/floors/live');
ok('Quản lý xem sơ đồ trực tiếp (cùng dữ liệu thu ngân)', r.status === 200 && r.data.tables.length >= 1 && r.data.floors.length === floors.length, r.status);

/* ------------------------------------------------------------------ Tầng */
r = await m('POST', '/api/floors', { name: ' ', cols: 3, rows: 50 });
ok('thêm tầng: thiếu tên, kích thước sai → lỗi tại ô', r.status === 422 && r.data.fields?.name && r.data.fields?.cols && r.data.fields?.rows, r.data);
r = await m('POST', '/api/floors', { name: floors[0].name, cols: 10, rows: 6 });
ok('thêm tầng trùng tên → lỗi', r.status === 422 && /tồn tại/.test(r.data.fields?.name), r.data);
r = await m('POST', '/api/floors', { name: 'Tầng KT', cols: 10, rows: 6 });
const F = r.data;
ok('thêm tầng → có sẵn 4 tường ngoài quanh tầng', r.status === 201 && F.walls.length === 4 && F.walls.every((w) => w.kind === 'outer'), r.data);

r = await m('POST', '/api/areas', { name: 'Khu KT A', description: '', active: true, floorId: F.id });
const A = r.data;
r = await m('POST', '/api/areas', { name: 'Khu KT B', description: '', active: true, floorId: F.id });
const B = r.data;
ok('thêm khu vào tầng mới (chưa có vùng)', A?.floorId === F.id && A.zone === null && B?.floorId === F.id, A);

r = await m('POST', '/api/tables', { code: 'KT01', areaId: A.id, seats: 4, shape: 'square', status: 'available' });
const T1 = r.data;
r = await m('POST', '/api/tables', { code: 'KT02', areaId: A.id, seats: 2, shape: 'round', status: 'available' });
const T2 = r.data;
ok('thêm bàn: vào ô trống đầu tiên của tầng', T1?.x === 0 && T1.y === 0 && T2?.x === 1 && T2.y === 0, [T1, T2]);

/* ------------------------------------------------------------------ Lưu sơ đồ */
const walls = [...F.walls, { kind: 'inner', x1: 5, y1: 0, x2: 5, y2: 3 }, { kind: 'fence', x1: 0, y1: 4, x2: 4, y2: 4 }];
const zones = [{ areaId: A.id, x: 1, y: 1, w: 3, h: 2 }, { areaId: B.id, x: 6, y: 1, w: 3, h: 4 }];
r = await m('PUT', `/api/floors/${F.id}/layout`, { walls: [{ kind: 'inner', x1: 1, y1: 1, x2: 3, y2: 3 }], zones: [], tables: [] });
ok('tường chéo → 400', r.status === 400, r.data);
r = await m('PUT', `/api/floors/${F.id}/layout`, { walls, zones: [{ areaId: A.id, x: 1, y: 1, w: 3, h: 2 }, { areaId: B.id, x: 2, y: 2, w: 3, h: 2 }], tables: [] });
ok('vùng khu chồng nhau → báo tên hai khu', r.status === 409 && /Khu KT A/.test(r.data.message) && /Khu KT B/.test(r.data.message), r.data);
r = await m('PUT', `/api/floors/${F.id}/layout`, { walls, zones, tables: [{ id: T1.id, x: 2, y: 1, areaId: A.id }, { id: T2.id, x: 2, y: 1, areaId: A.id }] });
ok('hai bàn chung một ô → 409', r.status === 409 && /chung một ô/.test(r.data.message), r.data);
r = await m('PUT', `/api/floors/${F.id}/layout`, { walls, zones, tables: [{ id: T1.id, x: 10, y: 1, areaId: A.id }] });
ok('bàn ra ngoài sơ đồ → 400', r.status === 400, r.data);
const before = sql(`SELECT CONCAT(pos_x,',',pos_y) FROM dining_tables WHERE id=${T1.id}`);
ok('lưu lỗi thì không ghi gì (vị trí, tường giữ nguyên)', before === '0,0' && sql(`SELECT COUNT(*) FROM floor_walls WHERE floor_id=${F.id}`) === '4', before);
r = await m('PUT', `/api/floors/${F.id}/layout`, { walls, zones, tables: [{ id: T1.id, x: 2, y: 1, areaId: A.id }, { id: T2.id, x: 7, y: 2, areaId: B.id }] });
ok('lưu sơ đồ: tường, vùng, vị trí, bàn kéo sang vùng khu B thì thuộc khu B', r.status === 200 && r.data.walls.length === 6
  && sql(`SELECT CONCAT(pos_x,',',pos_y,',',area_id) FROM dining_tables WHERE id=${T2.id}`) === `7,2,${B.id}`
  && sql(`SELECT CONCAT(zone_x,',',zone_y,',',zone_w,',',zone_h) FROM areas WHERE id=${A.id}`) === '1,1,3,2', r.data);
r = await tn('GET', '/api/thu-ngan/floor');
const tf = r.data.floors.find((f) => f.id === F.id);
ok('thu ngân thấy tường + vùng khu mới', tf?.walls.length === 6 && r.data.areas.find((a) => a.id === B.id)?.zone?.w === 3, tf);

/* ------------------------------------------------------------------ Thêm / sửa bàn theo vùng khu */
r = await m('POST', '/api/tables', { code: 'KT03', areaId: A.id, seats: 4, shape: 'rect', status: 'available' });
const T3 = r.data;
ok('bàn mới vào ô trống trong vùng của khu', T3?.x >= 1 && T3.x <= 3 && T3.y >= 1 && T3.y <= 2 && !(T3.x === 2 && T3.y === 1), T3);
r = await m('PATCH', `/api/tables/${T3.id}/position`, { x: 7, y: 2 });
ok('kéo bàn vào ô đã có bàn (khu khác, cùng tầng) → 409', r.status === 409, r.data);
r = await m('PATCH', `/api/tables/${T3.id}/position`, { x: 9, y: 5 });
ok('kéo bàn tới góc tầng (trong giới hạn 10 × 6) → được', r.status === 200 && r.data.x === 9, r.data);
r = await m('PUT', `/api/tables/${T3.id}`, { code: 'KT03', areaId: B.id, seats: 4, shape: 'rect', status: 'available' });
ok('đổi khu của bàn → chuyển vào ô trống trong vùng khu mới', r.status === 200 && r.data.areaId === B.id && r.data.x >= 6 && r.data.x <= 8 && r.data.y >= 1 && r.data.y <= 4, r.data);

/* ------------------------------------------------------------------ Kích thước, chuyển tầng, xóa */
r = await m('PUT', `/api/floors/${F.id}`, { name: 'Tầng KT', cols: 7, rows: 6 });
ok('thu nhỏ tầng làm mất bàn / vùng → lỗi tại ô chiều ngang', r.status === 422 && r.data.fields?.cols, r.data);
r = await m('PUT', `/api/floors/${F.id}`, { name: 'Tầng KT 2', cols: 12, rows: 6 });
ok('đổi tên + nới tầng được; tường ngoài đã sửa thì giữ nguyên', r.status === 200 && r.data.name === 'Tầng KT 2' && r.data.cols === 12 && r.data.walls.length === 6, r.data);
r = await m('PUT', `/api/areas/${A.id}`, { name: 'Khu KT A', description: '', active: true, floorId: floors[0].id });
ok('khu còn bàn → không chuyển tầng được', r.status === 409 && /chuyển tầng/.test(r.data.message), r.data);
r = await m('DELETE', `/api/floors/${F.id}`);
ok('tầng còn khu → không xóa được', r.status === 409, r.data);

for (const t of [T1, T2, T3]) await m('DELETE', `/api/tables/${t.id}`);
for (const a of [A, B]) await m('DELETE', `/api/areas/${a.id}`);
r = await m('DELETE', `/api/floors/${F.id}`);
ok('dọn: xóa bàn, khu rồi xóa tầng → được, tường đi theo', r.status === 204 && sql(`SELECT COUNT(*) FROM floor_walls WHERE floor_id=${F.id}`) === '0', r.status);

console.log(`\n${pass} đạt, ${fail} không đạt`);
process.exit(fail ? 1 : 0);
