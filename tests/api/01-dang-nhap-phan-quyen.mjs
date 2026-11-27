// [01-dang-nhap-phan-quyen.mjs] G1–G3, G7: đăng nhập, khóa khi sai nhiều lần, phân quyền theo khu vực, đổi mật khẩu, phiên
import { BASE, DB, FIXTURES, OUT, UPLOADS, sql } from '../lib/env.mjs';
// Kiểm thử API đăng nhập/phân quyền. Mỗi "trình duyệt" giữ cookie riêng.
let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => { cond ? pass++ : fail++; console.log(`${cond ? 'PASS' : 'FAIL'} ${name}${extra ? ' — ' + extra : ''}`); };

function client() {
  const jar = {};
  return {
    jar,
    async req(method, path, body) {
      const headers = { 'Content-Type': 'application/json' };
      const cookie = Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; ');
      if (cookie) headers.Cookie = cookie;
      const res = await fetch(BASE + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
      const setCookies = res.headers.getSetCookie?.() ?? [];
      for (const sc of setCookies) {
        const [pair, ...attrs] = sc.split(';');
        const [k, v] = pair.split('=');
        if (/max-age=0/i.test(attrs.join(';')) || v === '') delete jar[k.trim()]; else jar[k.trim()] = v;
      }
      let data = null; try { data = await res.json(); } catch {}
      return { status: res.status, data, setCookies };
    },
  };
}
const PW = 'Rms@2026';

const anon = client();
let r = await anon.req('GET', '/api/tables');
ok('Chưa đăng nhập gọi API quản lý → 401', r.status === 401, r.data?.message);
r = await anon.req('GET', '/api/auth/me');
ok('Chưa đăng nhập /me → 401', r.status === 401);
r = await anon.req('POST', '/api/auth/login', { username: '', password: '' });
ok('Bỏ trống → 422 kèm lỗi 2 ô', r.status === 422 && r.data.fields.username && r.data.fields.password, JSON.stringify(r.data.fields));
r = await anon.req('POST', '/api/auth/login', { username: 'tuan.nguyen', password: 'sai-mat-khau1' });
ok('Sai mật khẩu → 401 thông báo chung', r.status === 401 && r.data.message === 'Sai tên đăng nhập hoặc mật khẩu.');
r = await anon.req('POST', '/api/auth/login', { username: 'khong.ton.tai', password: 'abc12345' });
ok('Tên không tồn tại → cùng thông báo', r.status === 401 && r.data.message === 'Sai tên đăng nhập hoặc mật khẩu.');
r = await anon.req('POST', '/api/auth/login', { username: 'nam.hoang', password: PW });
ok('Phục vụ (waiter) đăng nhập được từ V20 → home /phuc-vu', r.status === 200 && r.data.home === '/phuc-vu', r.data);

const mgr = client();
r = await mgr.req('POST', '/api/auth/login', { username: '  Tuan.Nguyen ', password: PW });
ok('Quản lý đăng nhập (không phân biệt hoa thường, bỏ khoảng trắng)', r.status === 200 && r.data.role === 'manager' && r.data.home === '/quan-ly', JSON.stringify(r.data));
const sc = r.setCookies.join(' | ');
ok('Cookie phiên HttpOnly + SameSite=Lax, không Max-Age khi không ghi nhớ', /RMS_SESSION=/.test(sc) && /HttpOnly/i.test(sc) && /SameSite=Lax/i.test(sc) && !/Max-Age/i.test(sc), sc.slice(0, 160));
r = await mgr.req('GET', '/api/auth/me');
ok('/me trả quản lý', r.status === 200 && r.data.fullName === 'Nguyễn Anh Tuấn' && r.data.roleLabel === 'Quản lý nhà hàng');
r = await mgr.req('GET', '/api/tables');
ok('Quản lý gọi API bàn → 200', r.status === 200);
r = await mgr.req('GET', '/api/audit-logs?module=auth');
ok('Nhật ký ghi "Đăng nhập" đúng người', r.status === 200 && r.data.items?.[0]?.action === 'Đăng nhập' && r.data.items[0].actorUsername === 'tuan.nguyen', JSON.stringify(r.data.items?.[0] ?? r.data).slice(0, 200));

const cashier = client();
r = await cashier.req('POST', '/api/auth/login', { username: 'linh.tran', password: PW, remember: true });
ok('Thu ngân (tài khoản riêng) đăng nhập → home /nhan-vien (Cổng nhân viên)', r.status === 200 && r.data.home === '/nhan-vien' && r.data.sharedScreen === false, JSON.stringify(r.data));
ok('Ghi nhớ đăng nhập → cookie lâu dài (Max-Age ≥ 7 ngày)', r.setCookies.some((c) => Number(/Max-Age=(\d+)/.exec(c)?.[1] ?? 0) >= 604800), r.setCookies.join(' | ').slice(0, 200));
r = await cashier.req('GET', '/api/tables');
ok('Thu ngân gọi API quản lý → 403', r.status === 403, r.data?.message);
ok('Thu ngân riêng: không mở màn quầy (POS) → 403', (await cashier.req('GET', '/api/thu-ngan/floor')).status === 403);
ok('Thu ngân riêng: chấm công của mình, bảng lương, chấm công nhân viên → 200',
  (await cashier.req('GET', '/api/toi/clock')).status === 200 && (await cashier.req('GET', '/api/thu-ngan/payroll')).status === 200
  && (await cashier.req('GET', '/api/thu-ngan/attendance')).status === 200);
r = await cashier.req('POST', '/api/auth/logout');
ok('Đăng xuất → 204', r.status === 204);
r = await cashier.req('GET', '/api/auth/me');
ok('Sau đăng xuất /me → 401', r.status === 401);

// Tài khoản MÀN HÌNH CHUNG (V30): khu.thu.ngan / khu.bep chỉ mở màn làm việc; không chấm công, không bảng lương.
const quay = client();
r = await quay.req('POST', '/api/auth/login', { username: 'khu.thu.ngan', password: PW });
ok('Màn hình chung thu ngân → home /thu-ngan, sharedScreen', r.status === 200 && r.data.home === '/thu-ngan' && r.data.sharedScreen === true, JSON.stringify(r.data));
ok('Màn hình chung thu ngân: mở POS → 200', (await quay.req('GET', '/api/thu-ngan/floor')).status === 200);
ok('Màn hình chung thu ngân: không chấm công / bảng lương / chấm công NV → 403',
  (await quay.req('GET', '/api/toi/clock')).status === 403 && (await quay.req('GET', '/api/thu-ngan/payroll')).status === 403
  && (await quay.req('GET', '/api/thu-ngan/attendance')).status === 403 && (await quay.req('GET', '/api/thu-ngan/employees')).status === 403);
const bepChung = client();
r = await bepChung.req('POST', '/api/auth/login', { username: 'khu.bep', password: PW });
ok('Màn hình chung bếp → home /bep; mở màn bếp → 200; không chấm công → 403', r.data?.home === '/bep'
  && (await bepChung.req('GET', '/api/bep/queue')).status === 200 && (await bepChung.req('GET', '/api/toi/clock')).status === 403);
const bepRieng = client();
r = await bepRieng.req('POST', '/api/auth/login', { username: 'hung.pham', password: PW });
ok('Bếp tài khoản riêng → home /nhan-vien; không mở màn bếp → 403; chấm công của mình → 200', r.data?.home === '/nhan-vien'
  && (await bepRieng.req('GET', '/api/bep/queue')).status === 403 && (await bepRieng.req('GET', '/api/toi/clock')).status === 200);
// Quản lý đổi loại tài khoản → phiên cũ hết hiệu lực ngay.
sql("UPDATE users SET shared_screen = 1 WHERE username = 'hung.pham'; SELECT 1");
r = await bepRieng.req('GET', '/api/toi/clock');
ok('Đổi tài khoản riêng → màn hình chung: phiên cũ bị đăng xuất (401)', r.status === 401, r.data?.message);
sql("UPDATE users SET shared_screen = 0 WHERE username = 'hung.pham'; SELECT 1");
// Màn hình chung không vào lịch ca / danh sách chấm công / bảng lương.
r = await mgr.req('GET', '/api/employees');
ok('Lịch ca: không có tài khoản màn hình chung', r.status === 200 && !JSON.stringify(r.data).includes('Quầy thu ngân'), JSON.stringify(r.data).slice(0, 120));

// Phiên cũ không dùng lại được sau khi đăng nhập (chống session fixation)
const fx = client();
await fx.req('POST', '/api/auth/login', { username: 'hung.pham', password: PW });
const before = fx.jar.RMS_SESSION;
await fx.req('POST', '/api/auth/login', { username: 'hung.pham', password: PW });
ok('Mỗi lần đăng nhập cấp phiên mới', before && fx.jar.RMS_SESSION && before !== fx.jar.RMS_SESSION);

console.log(`\n${pass}/${pass + fail} PASS`);
process.exit(fail ? 1 : 0);
