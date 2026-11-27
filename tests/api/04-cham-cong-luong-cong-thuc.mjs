// [04-cham-cong-luong-cong-thuc.mjs] C8–C16, D17–D33: chấm công Excel, kỳ lương, công thức định lượng, kiểm tra nguyên liệu
import { BASE, DB, FIXTURES, OUT, UPLOADS, sql } from '../lib/env.mjs';
// Gọi thử API đợt 3 (chấm công, bảng lương, công thức, kiểm tra nguyên liệu) trên backend 8081.
import { readFileSync } from 'node:fs';
let pass = 0, fail = 0;
const ok = (n, c, x = '') => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'} ${n}${c ? '' : ' — ' + JSON.stringify(x).slice(0, 500)}`); };
const j = async (r) => ({ status: r.status, body: r.headers.get('content-type')?.includes('json') ? await r.json() : await r.arrayBuffer() });
async function login(user) {
  const r = await fetch(BASE + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: user, password: 'Rms@2026' }) });
  const cookie = r.headers.get('set-cookie').split(';')[0];
  const call = (method) => (path, body) => fetch(BASE + path, { method, headers: { 'Content-Type': 'application/json', Cookie: cookie }, body: body === undefined ? undefined : JSON.stringify(body) }).then(j);
  const upload = (path, file, name) => {
    const fd = new FormData();
    fd.append('file', new Blob([readFileSync(file)]), name);
    return fetch(BASE + path, { method: 'POST', headers: { Cookie: cookie }, body: fd }).then(j);
  };
  return { get: call('GET'), post: call('POST'), put: call('PUT'), del: call('DELETE'), upload };
}
const isXlsx = (buf) => buf instanceof ArrayBuffer && new Uint8Array(buf)[0] === 0x50 && new Uint8Array(buf)[1] === 0x4b;

const tn = await login('linh.tran');
const bep = await login('khu.bep');
const ql = await login('tuan.nguyen');

/* ---------------- Dữ liệu mẫu */
let periods = await tn.get('/api/thu-ngan/payroll');
ok('có kỳ lương tháng trước đã chốt (mẫu)', periods.body.length === 1 && periods.body[0].status === 'closed' && periods.body[0].total > 0, periods.body);
let att = await tn.get('/api/thu-ngan/attendance');
ok('chấm công tháng này có dữ liệu, 2 dòng thiếu giờ ra', att.body.items.length > 20 && att.body.missingOutCount === 2, { n: att.body.items.length, m: att.body.missingOutCount });

/* ---------------- Mẫu + đọc file */
let r = await tn.get('/api/thu-ngan/attendance/template');
ok('tải file mẫu .xlsx', r.status === 200 && isXlsx(r.body), r.status);
const fs = await import('node:fs');
fs.writeFileSync(`${OUT}/att-template.xlsx`, Buffer.from(r.body));
r = await tn.upload('/api/thu-ngan/attendance/preview', `${OUT}/att-template.xlsx`, 'mau-cham-cong.xlsx');
ok('đọc lại file mẫu do hệ thống tạo: 2 dòng', r.status === 200 && r.body.lines.length === 2, r.body);
r = await tn.upload('/api/thu-ngan/attendance/preview', `${FIXTURES}/att-bad.xlsx`, 'att-bad.xlsx');
ok('file thiếu cột → "File không đúng mẫu"', r.status === 422 && /không đúng mẫu/.test(r.body.fields?.file), r.body);
r = await tn.upload('/api/thu-ngan/attendance/preview', `${FIXTURES}/att-test.csv`, 'att.txt');
ok('đuôi file khác .xlsx/.csv → 422', r.status === 422, r.body);

r = await tn.upload('/api/thu-ngan/attendance/preview', `${FIXTURES}/att-test.xlsx`, 'att-test.xlsx');
const pv = r.body;
const byRow = Object.fromEntries((pv.lines ?? []).map((l) => [l.rowNo, l]));
ok('xem trước file Excel: 9 dòng, 4 hợp lệ, 5 lỗi', r.status === 200 && pv.lines.length === 9 && pv.validCount === 4 && pv.errorCount === 5, pv);
ok('ô ngày / giờ kiểu số của Excel: 8,5 giờ', byRow[3]?.status === 'valid' && byRow[3].hours === 8.5 && byRow[3].workDate === '2026-09-10', byRow[3]);
ok('ca qua đêm 22:00–06:00 = 8 giờ', byRow[4]?.status === 'valid' && byRow[4].hours === 8, byRow[4]);
ok('lỗi: không tìm thấy nhân viên', /Không tìm thấy nhân viên/.test(byRow[5]?.error), byRow[5]);
ok('lỗi: ngày sai', /Ngày sai/.test(byRow[6]?.error), byRow[6]);
ok('lỗi: chồng giờ với dòng 3', /Chồng giờ với dòng 3/.test(byRow[7]?.error), byRow[7]);
ok('lỗi: kỳ lương đã chốt', /kỳ lương đã chốt/.test(byRow[8]?.error), byRow[8]);
ok('thiếu giờ ra vẫn hợp lệ (đánh dấu)', byRow[9]?.status === 'valid' && byRow[9].missingOut, byRow[9]);
ok('lỗi: ca dài quá 16 giờ', /16 giờ/.test(byRow[10]?.error), byRow[10]);
ok('nhận diện nhân viên theo email', byRow[12]?.status === 'valid' && byRow[12].userName, byRow[12]);
const raws = pv.lines.map(({ rowNo, user, date, checkIn, checkOut, note }) => ({ rowNo, user, date, checkIn, checkOut, note }));
r = await tn.post('/api/thu-ngan/attendance/errors', { lines: raws });
ok('tải file các dòng lỗi (.xlsx)', r.status === 200 && isXlsx(r.body), r.status);
fs.writeFileSync(`${OUT}/att-errors.xlsx`, Buffer.from(r.body));
r = await tn.upload('/api/thu-ngan/attendance/preview', `${OUT}/att-errors.xlsx`, 'loi.xlsx');
ok('file dòng lỗi đọc lại được: 5 dòng', r.status === 200 && r.body.lines.length === 5, r.body.lines?.length);

r = await tn.post('/api/thu-ngan/attendance/import', { fileName: 'att-test.xlsx', duplicateMode: 'skip', lines: raws });
ok('nhập: 4 dòng mới, 5 lỗi', r.status === 200 && r.body.imported === 4 && r.body.errors === 5, r.body);
r = await tn.upload('/api/thu-ngan/attendance/preview', `${FIXTURES}/att-test.xlsx`, 'att-test.xlsx');
ok('nhập lại cùng file: 4 dòng Trùng', r.body.duplicateCount === 4 && r.body.validCount === 0, r.body);
r = await tn.post('/api/thu-ngan/attendance/import', { fileName: 'att-test.xlsx', duplicateMode: 'skip', lines: raws });
ok('bỏ qua dòng trùng → "Không có dòng nào hợp lệ"', r.status === 409, r.body);
r = await tn.post('/api/thu-ngan/attendance/import', { fileName: 'att-test.xlsx', duplicateMode: 'overwrite', lines: raws });
ok('ghi đè dòng trùng: 4', r.body.overwritten === 4, r.body);
r = await tn.upload('/api/thu-ngan/attendance/preview', `${FIXTURES}/att-test.csv`, 'att-test.csv');
ok('CSV (BOM, chấm phẩy, "8h", ô có dấu chấm phẩy trong ngoặc kép)', r.status === 200 && r.body.validCount === 2 && r.body.lines[0].note.includes('có dấu chấm phẩy'), r.body);

/* ---------------- Nhập tay */
const emps = (await tn.get('/api/thu-ngan/employees')).body;
const khoa = emps.find((e) => e.username === 'khoa.le');
ok('danh sách nhân viên', emps.length > 5 && khoa, emps.length);
r = await tn.post('/api/thu-ngan/attendance', { userId: khoa.id, date: '2026-09-13', checkIn: '08:00', checkOut: '12:00', note: '' });
ok('thêm tay thiếu ghi chú → 422', r.status === 422 && r.body.fields.note, r.body);
r = await tn.post('/api/thu-ngan/attendance', { userId: khoa.id, date: '2026-09-13', checkIn: '08:00', checkOut: '12:00', note: 'Quên chấm' });
const manual = r.body;
ok('thêm tay → nguồn Nhập tay, 4 giờ', r.status === 200 && manual.source === 'manual' && manual.hours === 4, r.body);
r = await tn.post('/api/thu-ngan/attendance', { userId: khoa.id, date: '2026-09-13', checkIn: '11:00', checkOut: '13:00', note: 'x' });
ok('chồng giờ → 422', r.status === 422 && /Chồng giờ/.test(r.body.fields.checkIn), r.body);
r = await tn.put(`/api/thu-ngan/attendance/${manual.id}`, { userId: khoa.id, date: '2026-09-13', checkIn: '08:00', checkOut: '13:00', note: 'Sửa giờ ra' });
ok('sửa chính dòng đó (không báo chồng với chính nó)', r.status === 200 && r.body.hours === 5, r.body);
r = await tn.del(`/api/thu-ngan/attendance/${manual.id}`);
ok('xóa dòng chấm công', r.status === 204, r.status);
const octRow = sql("SELECT id FROM attendances WHERE work_date BETWEEN DATE_FORMAT(CURDATE() - INTERVAL 1 MONTH, '%Y-%m-01') AND LAST_DAY(CURDATE() - INTERVAL 1 MONTH) LIMIT 1");
r = await tn.del(`/api/thu-ngan/attendance/${octRow}`);
ok('xóa dòng thuộc kỳ đã chốt → 409', r.status === 409 && /đã chốt/.test(r.body.message), r.body);
r = await tn.get('/api/thu-ngan/attendance?from=2026-08-01&to=2026-11-14');
ok('khoảng ngày > 62 → 422', r.status === 422, r.status);

/* ---------------- Bảng lương */
r = await tn.post('/api/thu-ngan/payroll', { name: '', startDate: sql("SELECT DATE_FORMAT(CURDATE() - INTERVAL 1 MONTH, '%Y-%m-15')"), endDate: sql('SELECT CURDATE()') });
ok('kỳ chồng kỳ đã có → 422', r.status === 422 && /trùng với kỳ/.test(r.body.fields.startDate), r.body);
r = await tn.post('/api/thu-ngan/payroll', { name: '', startDate: '2026-09-01', endDate: '2026-09-30' });
const sep = r.body;
ok('tạo kỳ Tháng 09/2026 (tên mặc định), tính lương', r.status === 200 && sep.period.name === 'Tháng 09/2026' && sep.lines.length >= 4, r.body);
const linhLine = sep.lines.find((l) => l.username === 'linh.tran');
ok('giờ công linh.tran = 8,5', linhLine?.hours === 8.5 && linhLine.total === Math.round(8.5 * linhLine.hourlyRate) + linhLine.baseSalary, linhLine);
ok('cảnh báo 1 dòng thiếu giờ ra (khoa.le)', sep.missingOutCount === 1 && sep.lines.find((l) => l.username === 'khoa.le').missingOut === 1, sep.missingOutCount);
r = await tn.put(`/api/thu-ngan/payroll/${sep.period.id}/lines/${linhLine.userId}`, { allowance: 200000, deduction: 0, note: '' });
ok('phụ cấp thiếu ghi chú → 422', r.status === 422 && r.body.fields.note, r.body);
r = await tn.put(`/api/thu-ngan/payroll/${sep.period.id}/lines/${linhLine.userId}`, { allowance: 200000, deduction: 50000, note: 'Thưởng / đi trễ' });
const linh2 = r.body.lines?.find((l) => l.userId === linhLine.userId);
ok('phụ cấp / khấu trừ → thực lĩnh tính lại', linh2?.total === linhLine.total + 150000, linh2);
r = await tn.post(`/api/thu-ngan/payroll/${sep.period.id}/close`);
ok('chốt khi còn thiếu giờ ra → 409', r.status === 409 && /thiếu giờ ra/.test(r.body.message), r.body);
const missRow = sql("SELECT id FROM attendances WHERE work_date='2026-09-11' AND check_out IS NULL");
r = await tn.put(`/api/thu-ngan/attendance/${missRow}`, { userId: khoa.id, date: '2026-09-11', checkIn: '08:00', checkOut: '15:00', note: 'Bổ sung giờ ra' });
ok('sửa giờ ra', r.status === 200 && !r.body.missingOut, r.body);
r = await tn.post(`/api/thu-ngan/payroll/${sep.period.id}/recalculate`);
ok('tính lại: giữ phụ cấp, khoa.le 7 giờ', r.body.lines.find((l) => l.userId === linhLine.userId).allowance === 200000 && r.body.lines.find((l) => l.username === 'khoa.le').hours === 7, r.body.lines);
r = await tn.post(`/api/thu-ngan/payroll/${sep.period.id}/close`);
ok('chốt bảng lương', r.status === 200 && r.body.period.status === 'closed' && r.body.period.closedBy, r.body.period);
r = await tn.put(`/api/thu-ngan/payroll/${sep.period.id}/lines/${linhLine.userId}`, { allowance: 0, deduction: 0, note: '' });
ok('kỳ đã chốt không sửa được → 409', r.status === 409, r.body);
r = await tn.post('/api/thu-ngan/attendance', { userId: khoa.id, date: '2026-09-20', checkIn: '08:00', checkOut: '12:00', note: 'x' });
ok('thêm chấm công vào kỳ đã chốt → 409', r.status === 409 && /đã chốt/.test(r.body.message), r.body);
r = await tn.get(`/api/thu-ngan/payroll/${sep.period.id}/lines/${linhLine.userId}/payslip`);
ok('phiếu lương có chi tiết ngày công', r.status === 200 && r.body.days.length === 1 && r.body.restaurant.name, r.body.days?.length);
r = await tn.post('/api/thu-ngan/payroll', { name: 'Tháng sau', startDate: '2026-12-01', endDate: '2026-12-31' });
ok('kỳ chưa bắt đầu → 422', r.status === 422, r.body);
r = await tn.post('/api/thu-ngan/payroll', { name: 'Tháng 11', startDate: sql("SELECT DATE_FORMAT(CURDATE(), '%Y-%m-01')"), endDate: sql('SELECT LAST_DAY(CURDATE())') });
r = await tn.post(`/api/thu-ngan/payroll/${r.body.period.id}/close`);
ok('chốt kỳ chưa kết thúc / còn thiếu giờ ra → 409', r.status === 409, r.body);
r = await bep.get('/api/thu-ngan/payroll');
ok('bếp không vào được bảng lương → 403', r.status === 403, r.status);

/* ---------------- Bếp: công thức, kiểm tra nguyên liệu */
const khaiVi = (await ql.get('/api/dish-categories')).body.find((c) => c.name === 'Khai vị');
const newDish = (await ql.post('/api/dishes', { name: 'Món thử công thức', categoryId: khaiVi.id, price: 50000, image: null, status: 'selling' })).body;
let rec = await bep.get('/api/bep/recipes');
const withRecipe = rec.body.dishes.find((d) => d.ingredientCount > 0);
const without = rec.body.dishes.find((d) => d.id === newDish.id && d.ingredientCount === 0);
ok('danh sách món có / chưa có công thức', withRecipe && without, rec.body.dishes.length);
const opts = (await bep.get('/api/bep/ingredient-options')).body;
r = await bep.put(`/api/bep/recipes/${without.id}`, { lines: [{ ingredientId: opts[0].id, qty: 0.1 }, { ingredientId: opts[0].id, qty: 0.2 }] });
ok('nguyên liệu trùng → 422', r.status === 422 && /trùng/.test(r.body.fields['lines.1.ingredientId']), r.body);
r = await bep.put(`/api/bep/recipes/${without.id}`, { lines: [{ ingredientId: opts[0].id, qty: 0 }, { ingredientId: opts[1].id, qty: 0.12345 }] });
ok('định lượng 0 / quá 3 số lẻ → 422', r.status === 422 && r.body.fields['lines.0.qty'] && r.body.fields['lines.1.qty'], r.body);
r = await bep.put(`/api/bep/recipes/${without.id}`, { lines: [{ ingredientId: opts[0].id, qty: 0.15 }, { ingredientId: opts[1].id, qty: 0.05 }] });
ok('lưu công thức: 2 nguyên liệu, có giá vốn', r.status === 200 && r.body.lines.length === 2 && r.body.cost >= 0, r.body);
let st = await bep.get('/api/bep/stock-check');
const ds = st.body.dishes.find((d) => d.id === without.id);
const expected = Math.min(Math.floor(opts[0].stock / 0.15), Math.floor(opts[1].stock / 0.05));
ok('kiểm tra nguyên liệu: số phần = min(tồn ÷ định lượng)', ds.hasRecipe && ds.portions === Math.min(expected, 99999), { ds, expected });
ok('theo nguyên liệu: có mức tồn và món dùng', st.body.ingredients.some((i) => i.dishes.includes(without.name)), '');
r = await bep.put(`/api/bep/recipes/${without.id}`, { lines: [] });
ok('xóa hết dòng → Chưa có công thức', r.body.lines.length === 0 && !(await bep.get('/api/bep/stock-check')).body.dishes.find((d) => d.id === without.id).hasRecipe, r.body);
await ql.del(`/api/dishes/${newDish.id}`); // dọn món thử để các bộ sau đếm đúng số món
r = await tn.get('/api/bep/recipes');
ok('thu ngân không vào được công thức → 403', r.status === 403, r.status);

console.log(`\n${pass} PASS, ${fail} FAIL`);
