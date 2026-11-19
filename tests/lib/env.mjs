/**
 * Cấu hình chung cho bộ kiểm thử API (xem tests/README.md).
 *
 *  RMS_API      địa chỉ backend, mặc định http://localhost:8080 (dev-test.bat chạy ở cổng này)
 *  RMS_TEST_DB  CSDL backend đang dùng, mặc định rms_test — KHÔNG chạy trên rms_db (kiểm thử tạo / sửa / xóa dữ liệu)
 *  MYSQL_BIN    đường dẫn mysql.exe (mặc định MySQL 8.0 trên Windows, hoặc "mysql" trong PATH)
 *  MYSQL_PWD    mật khẩu MySQL; bỏ trống thì đọc DB_USER / DB_PASSWORD trong backend/.env.properties (không in ra)
 *  RMS_UPLOADS  thư mục ảnh của backend đang chạy (để kiểm file ảnh); mặc định backend/uploads-test
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(HERE, '../..');
export const FIXTURES = path.resolve(HERE, '../fixtures');
export const BASE = (process.env.RMS_API || 'http://localhost:8080').replace(/\/$/, '');
export const DB = process.env.RMS_TEST_DB || 'rms_test';
export const UPLOADS = process.env.RMS_UPLOADS || path.join(ROOT, 'backend', 'uploads-test');
/** Thư mục tạm cho file tải về trong lúc kiểm thử (file mẫu Excel, file dòng lỗi…). */
export const OUT = mkdtempSync(path.join(tmpdir(), 'rms-test-'));

if (DB === 'rms_db') {
  console.error('Không chạy kiểm thử trên rms_db (dữ liệu thật). Chạy dev-test.bat rồi đặt RMS_TEST_DB=rms_test.');
  process.exit(2);
}

function envProps() {
  const f = path.join(ROOT, 'backend', '.env.properties');
  if (!existsSync(f)) return {};
  const out = {};
  for (const line of readFileSync(f, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_]+)\s*=(.*)$/);
    if (m) out[m[1]] = m[2].trim();
  }
  return out;
}
const props = envProps();
const MYSQL = process.env.MYSQL_BIN
  || (existsSync('C:/Program Files/MySQL/MySQL Server 8.0/bin/mysql.exe') ? 'C:/Program Files/MySQL/MySQL Server 8.0/bin/mysql.exe' : 'mysql');
const MYSQL_ENV = { ...process.env, MYSQL_PWD: process.env.MYSQL_PWD ?? props.DB_PASSWORD ?? '' };
const MYSQL_USER = process.env.MYSQL_USER || props.DB_USER || 'root';

/** Chạy câu SQL trên CSDL kiểm thử, trả về dòng cuối (một giá trị) — dùng để chuẩn bị / đối chiếu dữ liệu. */
export function sql(q) {
  const out = execFileSync(MYSQL, ['-u', MYSQL_USER, '--default-character-set=utf8mb4', DB, '-N', '-e', q], { encoding: 'utf8', env: MYSQL_ENV }).trim();
  return out.split(/\r?\n/).pop() ?? '';
}
