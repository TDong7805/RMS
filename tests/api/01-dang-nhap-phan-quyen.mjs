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
ok('Phục vụ (waiter) đăng nhập → 403', r.status === 403, r.data?.message);

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
ok('Thu ngân đăng nhập → home /thu-ngan', r.status === 200 && r.data.home === '/thu-ngan');
ok('Ghi nhớ đăng nhập → cookie lâu dài (Max-Age ≥ 7 ngày)', r.setCookies.some((c) => Number(/Max-Age=(\d+)/.exec(c)?.[1] ?? 0) >= 604800), r.setCookies.join(' | ').slice(0, 200));
r = await cashier.req('GET', '/api/tables');
ok('Thu ngân gọi API quản lý → 403', r.status === 403, r.data?.message);
r = await cashier.req('POST', '/api/auth/logout');
ok('Đăng xuất → 204', r.status === 204);
r = await cashier.req('GET', '/api/auth/me');
ok('Sau đăng xuất /me → 401', r.status === 401);

// Phiên cũ không dùng lại được sau khi đăng nhập (chống session fixation)
const fx = client();
await fx.req('POST', '/api/auth/login', { username: 'hung.pham', password: PW });
const before = fx.jar.RMS_SESSION;
await fx.req('POST', '/api/auth/login', { username: 'hung.pham', password: PW });
ok('Mỗi lần đăng nhập cấp phiên mới', before && fx.jar.RMS_SESSION && before !== fx.jar.RMS_SESSION);

console.log(`\n${pass}/${pass + fail} PASS`);
process.exit(fail ? 1 : 0);
