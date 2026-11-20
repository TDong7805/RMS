import type { PayrollDetail, Payslip } from '@/types';

/* In bảng lương / phiếu lương (cửa sổ in của trình duyệt) — dùng ở trang Bảng lương (thu ngân) và "Thông tin của tôi". */

const dmy = (iso: string) => iso.split('-').reverse().join('/');
const hours = (v: number) => v.toLocaleString('vi-VN', { maximumFractionDigits: 2 });
/* ---------------------------------------------------------------- In */

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const m = (v: number) => v.toLocaleString('vi-VN');
const STYLE = `<style>body{font-family:sans-serif;font-size:13px;padding:16px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #bbb;padding:4px 6px}
th{background:#f2f2f2;text-align:left}.r{text-align:right;white-space:nowrap}h2,h3{margin:0 0 4px}.muted{color:#555}</style>`;

function openPrint(title: string, body: string) {
  const w = window.open('', '_blank', 'width=900,height=700');
  if (!w) return;
  w.document.write(`<html><head><title>${esc(title)}</title>${STYLE}</head><body>${body}<script>window.print()</script></body></html>`);
  w.document.close();
}

export function printPayroll(d: PayrollDetail) {
  const rows = d.lines
    .map((l) => `<tr><td>${esc(l.userName)}<br/><span class="muted">${esc(l.roleName ?? '')}</span></td><td class="r">${hours(l.hours)}</td><td class="r">${m(l.hourlyRate)}</td>
<td class="r">${m(l.baseSalary)}</td><td class="r">${m(l.allowance)}</td><td class="r">${m(l.deduction)}</td><td class="r"><b>${m(l.total)}</b></td><td>${esc(l.note)}</td><td></td></tr>`)
    .join('');
  openPrint(`Bảng lương ${d.period.name}`, `<h2>BẢNG LƯƠNG ${esc(d.period.name.toUpperCase())}</h2>
<div class="muted">${dmy(d.period.startDate)} – ${dmy(d.period.endDate)} · ${d.period.status === 'closed' ? 'Đã chốt' : 'Nháp (chưa chốt)'}</div><br/>
<table><thead><tr><th>Nhân viên</th><th class="r">Giờ công</th><th class="r">Lương/giờ</th><th class="r">Lương CB</th><th class="r">Phụ cấp</th><th class="r">Khấu trừ</th><th class="r">Thực lĩnh</th><th>Ghi chú</th><th>Ký nhận</th></tr></thead>
<tbody>${rows}</tbody><tfoot><tr><th>Tổng</th><th class="r">${hours(d.totalHours)}</th><th></th><th></th><th class="r">${m(d.totalAllowance)}</th><th class="r">${m(d.totalDeduction)}</th><th class="r">${m(d.total)}</th><th></th><th></th></tr></tfoot></table>`);
}

export function printPayslip(s: Payslip) {
  const l = s.line;
  const days = s.days
    .map((r) => `<tr><td>${dmy(r.date)}</td><td>${r.checkIn}</td><td>${r.checkOut ?? 'Thiếu giờ ra'}${r.overnight ? ' (+1)' : ''}</td><td class="r">${hours(r.hours)}</td><td>${esc(r.note)}</td></tr>`)
    .join('');
  openPrint(`Phiếu lương ${l.userName}`, `<h3>${esc(s.restaurant.name)}</h3><div class="muted">${esc(s.restaurant.address)} ${s.restaurant.phone ? '· ĐT ' + esc(s.restaurant.phone) : ''}</div>
<h2 style="margin-top:12px">PHIẾU LƯƠNG – ${esc(s.period.name)}</h2><div class="muted">${dmy(s.period.startDate)} – ${dmy(s.period.endDate)}</div><br/>
<table><tr><th>Nhân viên</th><td>${esc(l.userName)} (${esc(l.username)})</td><th>Vai trò</th><td>${esc(l.roleName ?? '')}</td></tr>
<tr><th>Giờ công</th><td>${hours(l.hours)} giờ × ${m(l.hourlyRate)} đ</td><th>Lương theo giờ</th><td class="r">${m(Math.round(l.hours * l.hourlyRate))} đ</td></tr>
<tr><th>Lương cơ bản</th><td class="r">${m(l.baseSalary)} đ</td><th>Phụ cấp</th><td class="r">${m(l.allowance)} đ</td></tr>
<tr><th>Khấu trừ</th><td class="r">${m(l.deduction)} đ</td><th>THỰC LĨNH</th><td class="r"><b>${m(l.total)} đ</b></td></tr>
${l.note ? `<tr><th>Ghi chú</th><td colspan="3">${esc(l.note)}</td></tr>` : ''}</table><br/>
<h3>Chi tiết ngày công (${s.days.length} lượt)</h3><table><thead><tr><th>Ngày</th><th>Vào</th><th>Ra</th><th class="r">Số giờ</th><th>Ghi chú</th></tr></thead><tbody>${days}</tbody></table>
<br/><table style="border:0"><tr><td style="border:0;text-align:center">Người lập<br/><br/><br/></td><td style="border:0;text-align:center">Nhân viên ký nhận<br/><br/><br/></td></tr></table>`);
}
