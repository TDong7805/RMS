// [10-ca-lam.mjs] E10: ca làm việc, phân công
import { BASE, DB, FIXTURES, OUT, UPLOADS, sql } from '../lib/env.mjs';
// Kiểm thử API Quản lý ca làm việc. Chạy trên CSDL tạm (DB=...).
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
const key = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const addDays = (n) => { const d = new Date(); d.setHours(12); d.setDate(d.getDate() + n); return key(d); };
const today = addDays(0);
const monday = (() => { const d = new Date(); d.setHours(12); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d; })();
const mondayKey = (offsetDays) => { const d = new Date(monday); d.setDate(d.getDate() + offsetDays); return key(d); };

const m = client();
await m('POST', '/api/auth/login', { username: 'tuan.nguyen', password: 'Rms@2026' });

// ---------------------------------------------------------------- Danh sách ca
let r = await m('GET', '/api/shifts');
const shifts = r.data;
const shiftId = (name) => shifts.find((s) => s.name === name)?.id;
ok('Danh sách ca theo giờ bắt đầu, kèm số lượt phân công', r.status === 200 && shifts.map((s) => s.name).join(',') === 'Ca sáng,Ca gãy,Ca chiều,Ca tối' && shifts.every((s) => s.assignmentCount > 0), shifts.map((s) => s.name + s.assignmentCount).join(','));

// ---------------------------------------------------------------- Thêm ca: kiểm tra dữ liệu
r = await m('POST', '/api/shifts', { name: '  ', startTime: '25:00', endTime: '8:00', color: 'xanh', note: 'x'.repeat(201) });
ok('A1: dữ liệu sai → 422 đủ các ô', r.status === 422 && ['name', 'startTime', 'endTime', 'color', 'note'].every((k) => r.data.fields[k]), JSON.stringify(r.data.fields));
r = await m('POST', '/api/shifts', { name: 'Ca thử', startTime: '09:00', endTime: '09:00', color: '#123456', note: '' });
ok('Giờ kết thúc trùng giờ bắt đầu → 422', r.status === 422 && /khác giờ bắt đầu/.test(r.data.fields.endTime));
r = await m('POST', '/api/shifts', { name: ' ca   SÁNG ', startTime: '06:00', endTime: '14:00', color: '#123456', note: '' });
ok('A2: trùng tên + trùng khung giờ → "Dữ liệu bị trùng lặp"', r.status === 422 && r.data.message === 'Dữ liệu bị trùng lặp' && /Ca sáng/.test(r.data.fields.name) && /Ca sáng/.test(r.data.fields.startTime), JSON.stringify(r.data));
r = await m('POST', '/api/shifts', { name: 'Ca đêm', startTime: '22:00', endTime: '05:00', color: '#334155', note: ' Trực kho đêm ' });
const night = r.data;
ok('Thêm ca qua đêm 22:00–05:00 → 200', r.status === 200 && night.startTime === '22:00' && night.endTime === '05:00' && night.note === 'Trực kho đêm' && night.assignmentCount === 0, JSON.stringify(r.data));
r = await m('PUT', `/api/shifts/${night.id}`, { name: 'Ca đêm', startTime: '22:00', endTime: '05:00', color: '#475569', note: 'Trực đêm' });
ok('Sửa ca (màu, ghi chú)', r.status === 200 && r.data.color === '#475569' && r.data.note === 'Trực đêm');
r = await m('PUT', '/api/shifts/999999', { name: 'X', startTime: '01:00', endTime: '02:00', color: '#000000', note: '' });
ok('Sửa ca không tồn tại → 404', r.status === 404);

// ---------------------------------------------------------------- Nhân viên cho lịch
r = await m('GET', `/api/employees?from=${mondayKey(0)}&to=${mondayKey(6)}`);
const thisWeek = r.data;
const emp = (u) => thisWeek.find((e) => e.fullName === u);
ok('Nhân viên tuần này: chỉ người đang hoạt động (có quản lý, phục vụ)', r.status === 200 && thisWeek.every((e) => e.status === 'active') && emp('Nguyễn Anh Tuấn') && emp('Vũ Thanh Bình') && !emp('Phan Thu Trang'), thisWeek.length);
r = await m('GET', `/api/employees?from=${mondayKey(-7)}&to=${mondayKey(-1)}`);
ok('Tuần trước: có cả người đã khóa từng có ca (nhãn locked)', r.data.some((e) => e.fullName === 'Phan Thu Trang' && e.status === 'locked'));
const tuan = emp('Nguyễn Anh Tuấn').id, linh = emp('Trần Thùy Linh').id, trang = r.data.find((e) => e.fullName === 'Phan Thu Trang').id;

r = await m('GET', `/api/shift-assignments?from=${mondayKey(0)}&to=${mondayKey(6)}`);
ok('Phân công tuần này từ CSDL', r.status === 200 && r.data.length > 50 && r.data.every((a) => a.date >= mondayKey(0) && a.date <= mondayKey(6)));
r = await m('GET', '/api/shift-assignments?from=2026-01-10&to=2026-01-01');
ok('Khoảng ngày ngược → 422', r.status === 422);

// ---------------------------------------------------------------- Phân công
r = await m('POST', '/api/shift-assignments', { employeeId: '', shiftId: '', dates: [] });
ok('Thiếu nhân viên, ca, ngày → 422', r.status === 422 && r.data.fields.employeeId && r.data.fields.shiftId && r.data.fields.dates);
r = await m('POST', '/api/shift-assignments', { employeeId: tuan, shiftId: shiftId('Ca sáng'), dates: [addDays(-1)] });
ok('Phân công ngày đã qua → 422', r.status === 422 && /đã qua/.test(r.data.fields.dates));
r = await m('POST', '/api/shift-assignments', { employeeId: trang, shiftId: shiftId('Ca sáng'), dates: [addDays(2)] });
ok('Nhân viên bị khóa → không phân công được', r.status === 422 && /bị khóa/.test(r.data.fields.employeeId), r.data?.fields?.employeeId);
// Ngày trong tương lai mà Linh có Ca sáng
const linhDays = (await m('GET', `/api/shift-assignments?from=${addDays(1)}&to=${addDays(14)}`)).data.filter((a) => a.employeeId === linh && a.shiftId === shiftId('Ca sáng')).map((a) => a.date);
const dLinh = linhDays[0];
r = await m('POST', '/api/shift-assignments', { employeeId: linh, shiftId: shiftId('Ca sáng'), dates: [dLinh] });
ok('Đã có đúng ca đó trong ngày → 422', r.status === 422 && /đã có Ca sáng/.test(r.data.fields.dates), r.data?.fields?.dates);
r = await m('POST', '/api/shift-assignments', { employeeId: linh, shiftId: shiftId('Ca gãy'), dates: [dLinh] });
ok('A3: Ca gãy 10–14 chồng Ca sáng 06–14 → "Trùng lịch làm việc"', r.status === 422 && r.data.message === 'Trùng lịch làm việc' && /Ca sáng/.test(r.data.fields.dates), JSON.stringify(r.data));
// Ca đêm 22:00–05:00 hôm trước không chồng Ca sáng 06:00 → được; sửa thành 22:00–07:00 thì chồng.
const prev = (() => { const [y, mo, d] = dLinh.split('-').map(Number); return key(new Date(y, mo - 1, d - 1, 12)); })();
const linhHasPrevAssign = (await m('GET', `/api/shift-assignments?from=${prev}&to=${prev}`)).data.some((a) => a.employeeId === linh && a.shiftId !== shiftId('Ca sáng'));
r = await m('POST', '/api/shift-assignments', { employeeId: linh, shiftId: night.id, dates: [prev] });
ok('Ca đêm 22–05 trước ngày có Ca sáng 06–14 → được', (prev >= today && !linhHasPrevAssign) ? r.status === 200 : true, JSON.stringify(r.data));
const nightAssign = r.data?.[0];
r = await m('PUT', `/api/shifts/${night.id}`, { name: 'Ca đêm', startTime: '22:00', endTime: '07:00', color: '#475569', note: '' });
ok('Sửa giờ ca đêm thành 22–07 làm chồng Ca sáng hôm sau → 422', nightAssign ? r.status === 422 && /Giờ mới trùng/.test(r.data.fields.startTime) : true, JSON.stringify(r.data));
if (nightAssign) {
  await m('DELETE', `/api/shift-assignments/${nightAssign.id}`);
  await m('PUT', `/api/shifts/${night.id}`, { name: 'Ca đêm', startTime: '22:00', endTime: '07:00', color: '#475569', note: '' });
  r = await m('POST', '/api/shift-assignments', { employeeId: linh, shiftId: night.id, dates: [prev] });
  ok('Ca đêm 22–07 chồng Ca sáng 06:00 hôm sau → chặn (ca qua đêm)', r.status === 422 && /chồng giờ với ca ngày/.test(r.data.fields.dates), JSON.stringify(r.data));
}

r = await m('POST', '/api/shift-assignments', { employeeId: tuan, shiftId: shiftId('Ca sáng'), dates: [addDays(3), addDays(1), addDays(2), addDays(1)] });
ok('Phân công nhiều ngày (bỏ trùng, sắp theo ngày)', r.status === 200 && r.data.length === 3 && r.data.map((a) => a.date).join() === [addDays(1), addDays(2), addDays(3)].join(), JSON.stringify(r.data));
const created = r.data;
r = await m('GET', `/api/shift-assignments?from=${addDays(1)}&to=${addDays(3)}`);
ok('Phân công mới có trong lịch', created.every((c) => r.data.some((a) => a.id === c.id && a.employeeId === tuan)));
r = await m('DELETE', `/api/shift-assignments/${created[0].id}`);
ok('Hủy phân công ngày tới → 204', r.status === 204);
const pastId = sql(`SELECT id FROM shift_assignments WHERE work_date < CURDATE() LIMIT 1`);
r = await m('DELETE', `/api/shift-assignments/${pastId}`);
ok('Hủy phân công ngày đã qua → 409', r.status === 409 && /đã qua/.test(r.data.message));
r = await m('DELETE', '/api/shift-assignments/999999');
ok('Hủy phân công không tồn tại → 404', r.status === 404);

// ---------------------------------------------------------------- Xóa ca
r = await m('DELETE', `/api/shifts/${shiftId('Ca gãy')}`);
ok('A4: xóa ca đã có phân công → "Không thể xóa ca làm việc này"', r.status === 409 && /Không thể xóa ca làm việc này/.test(r.data.message));
r = await m('POST', '/api/shifts', { name: 'Ca thử xóa', startTime: '08:00', endTime: '12:00', color: '#0f7b5a', note: '' });
r = await m('DELETE', `/api/shifts/${r.data.id}`);
ok('Xóa ca chưa phân công → 204', r.status === 204);

// ---------------------------------------------------------------- Xóa tài khoản → hủy ca từ hôm nay
r = await m('POST', '/api/accounts', { username: 'test.phucvu', fullName: 'Thử Phục Vụ', email: 'test.phucvu@example.com', phone: '', role: 'waiter', password: 'Rms@2026' });
const w = r.data;
await m('POST', '/api/shift-assignments', { employeeId: w.id, shiftId: shiftId('Ca chiều'), dates: [today, addDays(1), addDays(5)] });
sql(`INSERT INTO shift_assignments (shift_id, user_id, work_date) VALUES (${shiftId('Ca chiều')}, ${w.id}, CURDATE() - INTERVAL 2 DAY)`);
r = await m('DELETE', `/api/accounts/${w.id}`);
ok('Xóa tài khoản → 204', r.status === 204);
ok('Ca từ hôm nay của người đã xóa bị hủy, ca đã qua giữ nguyên', sql(`SELECT CONCAT(SUM(work_date >= CURDATE()), '/', SUM(work_date < CURDATE())) FROM shift_assignments WHERE user_id = ${w.id}`) === '0/1');
r = await m('GET', `/api/employees?from=${addDays(-3)}&to=${addDays(-1)}`);
ok('Người đã nghỉ vẫn hiện ở tuần từng có ca (nhãn deleted)', r.data.some((e) => e.id === w.id && e.status === 'deleted'));
r = await m('POST', '/api/shift-assignments', { employeeId: w.id, shiftId: shiftId('Ca chiều'), dates: [addDays(2)] });
ok('Không phân công được cho người đã nghỉ', r.status === 422 && r.data.fields.employeeId);
r = await m('GET', '/api/audit-logs?module=account');
ok('Nhật ký xóa tài khoản ghi số ca đã hủy', r.data.items.some((x) => /hủy 3 ca làm việc từ hôm nay/.test(x.detail ?? '')), r.data.items[0]?.detail);

// ---------------------------------------------------------------- Phân quyền, nhật ký
const cashier = client();
await cashier('POST', '/api/auth/login', { username: 'linh.tran', password: 'Rms@2026' });
ok('Thu ngân gọi API ca → 403', (await cashier('GET', '/api/shifts')).status === 403);
r = await m('GET', '/api/audit-logs?module=shift');
const actions = (r.data.items ?? []).map((x) => x.action);
ok('Nhật ký ca: thêm, sửa, xóa ca, phân công, hủy phân công', ['Thêm ca làm việc', 'Sửa ca làm việc', 'Xóa ca làm việc', 'Phân công ca', 'Hủy phân công'].every((a) => actions.includes(a)), actions.join(', '));
ok('Nhật ký hủy phân công ghi rõ tên nhân viên', r.data.items.some((x) => x.action === 'Hủy phân công' && /Nguyễn Anh Tuấn/.test(x.detail)));

sql(`DELETE FROM audit_logs WHERE detail LIKE '%test.%'`);
console.log(`\n${pass}/${pass + fail} PASS`);
process.exit(fail ? 1 : 0);
