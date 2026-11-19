// Chạy lần lượt toàn bộ kiểm thử API trong tests/api (theo thứ tự tên file), in tổng kết, trả mã lỗi nếu có bước không đạt.
// Cách dùng: xem tests/README.md.   node tests/run-all.mjs [lọc-tên]   vd. node tests/run-all.mjs kho
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const filter = process.argv[2] ?? '';
const files = readdirSync(path.join(HERE, 'api')).filter((f) => f.endsWith('.mjs') && f.includes(filter)).sort();
const rows = [];
for (const f of files) {
  const started = Date.now();
  const r = spawnSync(process.execPath, [path.join(HERE, 'api', f)], { encoding: 'utf8', env: process.env });
  const out = (r.stdout ?? '') + (r.stderr ?? '');
  const lines = out.split(/\r?\n/);
  const pass = lines.filter((l) => /^PASS\b/.test(l)).length;
  const failed = lines.filter((l) => /^FAIL\b/.test(l));
  const crashed = r.status !== 0 && failed.length === 0 && pass === 0 ? 1 : 0;
  rows.push({ f, pass, fail: failed.length + crashed, sec: ((Date.now() - started) / 1000).toFixed(1) });
  console.log(`\n=== ${f}: ${pass} đạt, ${failed.length} không đạt${r.status !== 0 ? ` (mã thoát ${r.status})` : ''} — ${rows.at(-1).sec}s`);
  failed.forEach((l) => console.log('  ' + l.slice(0, 300)));
  if (r.status !== 0 && failed.length === 0) console.log(out.split(/\r?\n/).slice(-12).join('\n'));
}
const total = rows.reduce((a, r) => ({ pass: a.pass + r.pass, fail: a.fail + r.fail }), { pass: 0, fail: 0 });
console.log('\n──────── Tổng kết ────────');
rows.forEach((r) => console.log(`${r.fail ? '✗' : '✓'} ${r.f.padEnd(38)} ${String(r.pass).padStart(4)} đạt  ${String(r.fail).padStart(3)} không đạt`));
console.log(`\n${total.pass} bước đạt, ${total.fail} bước không đạt (${rows.length} bộ).`);
process.exit(total.fail ? 1 : 0);
