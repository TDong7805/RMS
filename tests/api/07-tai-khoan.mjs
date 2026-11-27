// [07-tai-khoan.mjs] E14, E15: tài khoản nhân viên
import { BASE, DB, FIXTURES, OUT, UPLOADS, sql } from '../lib/env.mjs';
// Kiểm thử API Quản lý tài khoản. Tạo tài khoản thử tên test.*, cuối cùng xóa hẳn khỏi CSDL.
let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => { cond ? pass++ : fail++; console.log(`${cond ? 'PASS' : 'FAIL'} ${name}${extra ? ' — ' + extra : ''}`); };
function client() {
  const jar = {};
  return async (method, path, body) => {
    const headers = { 'Content-Type': 'application/json' };
    const cookie = Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; ');
    if (cookie) headers.Cookie = cookie;
    const res = await fetch(BASE + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
    for (const sc of res.headers.getSetCookie?.() ?? []) { const [k, v] = sc.split(';')[0].split('='); if (v) jar[k] = v; else delete jar[k]; }
    let data = null; try { data = await res.json(); } catch {}
    return { status: res.status, data, headers: res.headers };
  };
}
const cleanup = () => sql(`DELETE FROM audit_logs WHERE actor_username LIKE 'test.%'; DELETE FROM shift_assignments WHERE user_id IN (SELECT id FROM (SELECT id FROM users WHERE username LIKE 'test.%' OR email LIKE 'test.%') x); DELETE FROM users WHERE username LIKE 'test.%' OR username LIKE 'test.%~%' OR email LIKE 'test.%'`);
cleanup();
try {
  const m = client();
  let r = await m('POST', '/api/auth/login', { username: 'tuan.nguyen', password: 'Rms@2026' });
  const meId = r.data.id;

  // ---- Danh sách, tìm, lọc
  r = await m('GET', '/api/accounts');
  ok('Danh sách: 10 dòng/trang, đủ tổng', r.status === 200 && r.data.items.length === 10 && r.data.total >= 16 && r.data.pageCount >= 2, `total=${r.data.total}`);
  ok('Không trả mật khẩu (password_hash) ra ngoài', !JSON.stringify(r.data).includes('$2a$') && !('passwordHash' in r.data.items[0]));
  r = await m('GET', '/api/accounts?keyword=tuan');
  ok('Tìm không dấu "tuan" → Nguyễn Anh Tuấn', r.data.items.some((a) => a.fullName === 'Nguyễn Anh Tuấn'));
  r = await m('GET', '/api/accounts?keyword=0905123402');
  ok('Tìm theo số điện thoại', r.data.items.length === 1 && r.data.items[0].username === 'mai.vo');
  r = await m('GET', '/api/accounts?role=waiter&status=locked');
  ok('Lọc vai trò + trạng thái', r.data.items.length === 1 && r.data.items[0].username === 'an.truong');
  r = await m('GET', '/api/accounts?keyword=khongcoai');
  ok('Không có kết quả → danh sách rỗng', r.data.items.length === 0 && r.data.total === 0);

  // ---- Tạo: kiểm tra dữ liệu
  r = await m('POST', '/api/accounts', { username: 'AB', fullName: '  ', email: 'sai', phone: '123', role: 'admin', password: 'abc' });
  ok('Tạo sai → 422 đủ các ô', r.status === 422 && ['username', 'fullName', 'email', 'phone', 'role'].every((k) => r.data.fields[k]), JSON.stringify(r.data.fields));
  r = await m('POST', '/api/accounts', { username: 'linh.tran', fullName: 'X', email: 'tuan.nguyen@royalbeef.vn', phone: '', role: 'cashier', password: 'Abcdef12' });
  ok('Trùng tên đăng nhập và email → 422', r.status === 422 && /tồn tại/.test(r.data.fields.username) && /đã được sử dụng/.test(r.data.fields.email));
  r = await m('POST', '/api/accounts', { username: 'test.thungan', fullName: 'Thử Thu Ngân', email: 'test.thungan@example.com', phone: '', role: 'cashier', password: 'abc' });
  ok('Mật khẩu khởi tạo yếu → 422', r.status === 422 && /8 đến 64/.test(r.data.fields.password ?? ''), r.data.fields?.password);

  // ---- Tạo thành công
  r = await m('POST', '/api/accounts', { username: 'Test.ThuNgan ', fullName: '  Thử   Thu Ngân ', email: 'Test.ThuNgan@Example.com', phone: '0905 999 001', role: 'cashier', password: 'KhoiTao123' });
  ok('Tạo thu ngân → 200, chuẩn hóa dữ liệu, buộc đổi mật khẩu', r.status === 200 && r.data.username === 'test.thungan' && r.data.fullName === 'Thử Thu Ngân'
    && r.data.email === 'test.thungan@example.com' && r.data.phone === '0905999001' && r.data.mustChangePassword === true && r.data.status === 'active', JSON.stringify(r.data));
  const cashierId = r.data.id;
  r = await m('POST', '/api/accounts', { username: 'test.phucvu', fullName: 'Thử Phục Vụ', email: 'test.phucvu@example.com', phone: '', role: 'waiter', password: '' });
  ok('Tạo phục vụ phải có mật khẩu (từ V20 phục vụ đăng nhập được)', r.status === 422 && r.data?.fields?.password, JSON.stringify(r.data?.fields ?? ''));
  r = await m('POST', '/api/accounts', { username: 'test.phucvu', fullName: 'Thử Phục Vụ', email: 'test.phucvu@example.com', phone: '', role: 'waiter', password: 'KhoiTao123' });
  ok('Tạo phục vụ có mật khẩu', r.status === 200 && r.data.role === 'waiter', JSON.stringify(r.data?.fields ?? ''));
  const waiterId = r.data.id;
  // Màn hình chung (V30): chỉ thu ngân / bếp; vai trò khác bỏ qua cờ.
  r = await m('POST', '/api/accounts', { username: 'test.quay2', fullName: 'Quầy 2', email: 'test.quay2@example.com', phone: '', role: 'cashier', password: 'KhoiTao123', sharedScreen: true });
  ok('Tạo tài khoản màn hình chung thu ngân', r.status === 200 && r.data.sharedScreen === true, JSON.stringify(r.data));
  r = await m('POST', '/api/accounts', { username: 'test.kho2', fullName: 'Kho 2', email: 'test.kho2@example.com', phone: '', role: 'warehouse', password: 'KhoiTao123', sharedScreen: true });
  ok('Vai trò kho không làm màn hình chung được (cờ bị bỏ qua)', r.status === 200 && r.data.sharedScreen === false, JSON.stringify(r.data));

  // ---- Người mới đăng nhập → phải đổi mật khẩu
  const u = client();
  r = await u('POST', '/api/auth/login', { username: 'test.thungan', password: 'KhoiTao123' });
  ok('Tài khoản mới đăng nhập được, mustChangePassword (thu ngân riêng → /nhan-vien)', r.status === 200 && r.data.mustChangePassword === true && r.data.home === '/nhan-vien');
  r = await u('POST', '/api/auth/change-password', { currentPassword: 'KhoiTao123', newPassword: 'CuaToi2026', confirmPassword: 'CuaToi2026' });
  ok('Người dùng tự đổi mật khẩu', r.status === 200 && r.data.mustChangePassword === false);
  r = await u('GET', '/api/accounts');
  ok('Thu ngân gọi API tài khoản → 403', r.status === 403);

  // ---- Đặt lại mật khẩu → phiên cũ bị hủy
  r = await m('POST', `/api/accounts/${cashierId}/reset-password`);
  const temp = r.data?.password;
  ok('Đặt lại mật khẩu → mật khẩu tạm 10 ký tự có chữ và số, no-store', r.status === 200 && /^(?=.*[A-Za-z])(?=.*\d).{10}$/.test(temp ?? '') && r.headers.get('cache-control') === 'no-store', temp);
  r = await u('GET', '/api/auth/me');
  ok('Phiên đang mở của người đó bị hủy ngay', r.status === 401 && /đặt lại/.test(r.data?.message ?? ''), r.data?.message);
  r = await client()('POST', '/api/auth/login', { username: 'test.thungan', password: 'CuaToi2026' });
  ok('Mật khẩu cũ hết hiệu lực', r.status === 401);
  r = await u('POST', '/api/auth/login', { username: 'test.thungan', password: temp });
  ok('Mật khẩu tạm đăng nhập được và phải đổi lại', r.status === 200 && r.data.mustChangePassword === true);
  r = await m('POST', `/api/accounts/${waiterId}/reset-password`);
  ok('Đặt lại mật khẩu cho phục vụ (đăng nhập được từ V20)', r.status === 200 && r.data?.password, r.data?.message);

  // ---- Sửa
  r = await m('PUT', `/api/accounts/${cashierId}`, { username: 'test.thungan2', fullName: 'Thử Thu Ngân Hai', email: 'test.thungan@example.com', phone: '', role: 'kitchen' });
  ok('Sửa thông tin + đổi vai trò', r.status === 200 && r.data.username === 'test.thungan2' && r.data.role === 'kitchen' && r.data.phone === '');
  r = await u('GET', '/api/auth/me');
  ok('Đổi vai trò → phiên của người đó bị hủy', r.status === 401);
  r = await m('PUT', `/api/accounts/${meId}`, { username: 'tuan.nguyen', fullName: 'Nguyễn Anh Tuấn', email: 'tuan.nguyen@royalbeef.vn', phone: '0901000002', role: 'cashier' });
  ok('Tự đổi vai trò của mình → 422', r.status === 422 && r.data.fields.role, r.data.fields?.role);
  r = await m('PUT', `/api/accounts/${meId}`, { username: 'tuan.nguyen2', fullName: 'Nguyễn Anh Tuấn', email: 'tuan.nguyen@royalbeef.vn', phone: '0901000002', role: 'manager' });
  ok('Tự đổi tên đăng nhập → 422', r.status === 422 && r.data.fields.username);

  // ---- Khóa / mở khóa / xóa chính mình bị chặn
  for (const [method, path, body, name] of [['PATCH', `/api/accounts/${meId}/status`, { status: 'locked' }, 'khóa'], ['POST', `/api/accounts/${meId}/reset-password`, null, 'đặt lại mật khẩu'], ['DELETE', `/api/accounts/${meId}`, null, 'xóa']]) {
    r = await m(method, path, body);
    ok(`Tự ${name} chính mình → 409`, r.status === 409, r.data?.message);
  }

  // ---- Khóa → không đăng nhập được; mở khóa
  r = await m('PATCH', `/api/accounts/${cashierId}/status`, { status: 'locked' });
  ok('Khóa tài khoản', r.status === 200 && r.data.status === 'locked');
  r = await client()('POST', '/api/auth/login', { username: 'test.thungan2', password: temp });
  ok('Tài khoản bị khóa không đăng nhập được', r.status === 403);
  r = await m('PATCH', `/api/accounts/${cashierId}/status`, { status: 'active' });
  ok('Mở khóa', r.status === 200 && r.data.status === 'active');
  r = await m('PATCH', `/api/accounts/${cashierId}/status`, { status: 'xyz' });
  ok('Trạng thái lạ → 422', r.status === 422);

  // ---- Xóa → tên đăng nhập được giải phóng
  r = await m('DELETE', `/api/accounts/${cashierId}`);
  ok('Xóa → 204', r.status === 204);
  r = await m('GET', `/api/accounts/${cashierId}`);
  ok('Đã xóa thì không xem được (404)', r.status === 404);
  r = await client()('POST', '/api/auth/login', { username: 'test.thungan2', password: temp });
  ok('Tài khoản đã xóa không đăng nhập được', r.status === 401);
  r = await m('POST', '/api/accounts', { username: 'test.thungan2', fullName: 'Người Mới', email: 'test.thungan@example.com', phone: '', role: 'cashier', password: 'KhoiTao123' });
  ok('Dùng lại tên đăng nhập + email của tài khoản đã xóa', r.status === 200, JSON.stringify(r.data?.fields ?? ''));
  ok('Dòng cũ vẫn còn trong CSDL (xóa mềm, giữ lịch sử)', sql(`SELECT COUNT(*) FROM users WHERE id=${cashierId} AND deleted_at IS NOT NULL`) === '1');

  r = await m('GET', '/api/accounts/abc');
  ok('Id không hợp lệ → 404', r.status === 404);

  // ---- Nhật ký
  r = await m('GET', '/api/audit-logs?module=account');
  const actions = r.data.items.map((x) => x.action);
  ok('Nhật ký ghi đủ: tạo, sửa, khóa, mở khóa, đặt lại mật khẩu, xóa',
    ['Tạo tài khoản', 'Cập nhật tài khoản', 'Khóa tài khoản', 'Mở khóa tài khoản', 'Đặt lại mật khẩu', 'Xóa tài khoản'].every((a) => actions.includes(a)), actions.slice(0, 10).join(', '));
  ok('Nhật ký đổi vai trò ghi rõ trước → sau', r.data.items.some((x) => /vai trò: Thu ngân → Nhân viên bếp/.test(x.detail)));
} finally {
  // Xóa nhật ký do bài thử sinh ra (module account) để không lẫn với dữ liệu demo.
  sql(`DELETE FROM audit_logs WHERE module='account' AND detail LIKE '%test.%'`);
  cleanup();
  console.log('(đã xóa tài khoản thử)');
}
console.log(`\n${pass}/${pass + fail} PASS`);
process.exit(fail ? 1 : 0);
