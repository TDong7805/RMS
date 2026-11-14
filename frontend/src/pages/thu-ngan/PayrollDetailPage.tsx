import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AlertTriangle, ArrowLeft, Lock, Pencil, Printer, RefreshCw } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { Card } from '@/components/common/Card';
import { Badge } from '@/components/common/Badge';
import { Button } from '@/components/common/Button';
import { BlockError } from '@/components/common/EmptyState';
import { Field, TextInput } from '@/components/common/Form';
import { ConfirmDialog, Modal } from '@/components/common/Modal';
import { DataTable, PageHeader, StatTile, Td, Th } from '@/components/common/PageParts';
import { Skeleton } from '@/components/common/Skeleton';
import { closePayroll, getPayroll, getPayslip, recalculatePayroll, updatePayrollLine } from '@/api/payroll';
import { formatCurrency } from '@/lib/format';
import { formatDateTime } from '@/lib/labels';
import { ValidationError } from '@/lib/mock';
import type { PayrollDetail, PayrollLine, Payslip } from '@/types';

const dmy = (iso: string) => iso.split('-').reverse().join('/');
const hours = (v: number) => v.toLocaleString('vi-VN', { maximumFractionDigits: 2 });
const num = (s: string) => Number(s.replace(/[^\d]/g, '')) || 0;

/** UC-TN-12: bảng lương một kỳ — phụ cấp / khấu trừ, tính lại, chốt, in bảng lương / phiếu lương. */
export default function PayrollDetailPage() {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const key = ['thu-ngan', 'payroll', id];
  const q = useQuery({ queryKey: key, queryFn: () => getPayroll(id), retry: false });
  const [editing, setEditing] = useState<PayrollLine | null>(null);
  const [confirmClose, setConfirmClose] = useState(false);
  const apply = (d: PayrollDetail) => {
    qc.setQueryData(key, d);
    void qc.invalidateQueries({ queryKey: ['thu-ngan', 'payroll'], exact: true });
  };
  const recalc = useMutation({
    mutationFn: () => recalculatePayroll(id),
    onSuccess: (d) => {
      apply(d);
      toast.success('Đã tính lại theo chấm công hiện tại');
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Không tính lại được'),
  });
  const close = useMutation({
    mutationFn: () => closePayroll(id),
    onSuccess: (d) => {
      apply(d);
      setConfirmClose(false);
      toast.success(`Đã chốt bảng lương ${d.period.name}`);
    },
    onError: (e) => {
      setConfirmClose(false);
      toast.error(e instanceof Error ? e.message : 'Không chốt được');
    },
  });
  const slip = useMutation({
    mutationFn: (userId: string) => getPayslip(id, userId),
    onSuccess: printPayslip,
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Không in được'),
  });

  const d = q.data;
  const p = d?.period;
  const draft = p?.status === 'draft';
  return (
    <AppShell meta={{ label: p?.name ?? 'Bảng lương', parent: 'Bảng lương' }}>
      <div className="min-w-0 space-y-4">
        {q.isError ? (
          <BlockError message="Không tìm thấy kỳ lương" onRetry={() => navigate('/thu-ngan/bang-luong')} />
        ) : !d || !p ? (
          <Skeleton className="h-72" />
        ) : (
          <>
            <PageHeader
              title={p.name}
              description={`${dmy(p.startDate)} – ${dmy(p.endDate)} · ${p.status === 'closed' ? `đã chốt bởi ${p.closedBy ?? ''} lúc ${p.closedAt ? formatDateTime(p.closedAt) : ''}` : 'nháp — chưa chốt'}`}
              actions={
                <div className="flex flex-wrap gap-2">
                  <Button variant="ghost" size="sm" leadingIcon={<ArrowLeft size={15} />} onClick={() => navigate('/thu-ngan/bang-luong')}>Danh sách kỳ</Button>
                  <Button variant="outline" size="sm" leadingIcon={<Printer size={15} />} onClick={() => printPayroll(d)}>In bảng lương</Button>
                  {draft ? (
                    <>
                      <Button variant="outline" size="sm" leadingIcon={<RefreshCw size={15} />} loading={recalc.isPending} onClick={() => recalc.mutate()}>Tính lại</Button>
                      <Button size="sm" leadingIcon={<Lock size={15} />} onClick={() => setConfirmClose(true)}>Chốt bảng lương</Button>
                    </>
                  ) : null}
                </div>
              }
            />
            {d.missingOutCount && draft ? (
              <p className="flex items-center gap-2 rounded-item bg-[var(--warning-soft)] px-4 py-2.5 text-[13.5px] text-[var(--warning)]">
                <AlertTriangle size={16} />
                Còn {d.missingOutCount} dòng chấm công thiếu giờ ra trong kỳ (tính 0 giờ). Sửa ở trang Chấm công, bấm Tính lại, rồi mới chốt được.
              </p>
            ) : null}
            <div className="grid gap-3 sm:grid-cols-4">
              <StatTile label="Trạng thái" value={<Badge variant={draft ? 'warning' : 'accent'}>{draft ? 'Nháp' : 'Đã chốt'}</Badge>} />
              <StatTile label="Nhân viên" value={d.lines.length} />
              <StatTile label="Tổng giờ công" value={hours(d.totalHours)} />
              <StatTile label="Tổng thực lĩnh" value={formatCurrency(d.total)} tone="accent" />
            </div>
            <Card className="overflow-hidden">
              <DataTable minWidth={1100}>
                <thead>
                  <tr>
                    <Th>Nhân viên</Th><Th className="text-right">Giờ công</Th><Th className="text-right">Lương / giờ</Th><Th className="text-right">Lương cơ bản</Th>
                    <Th className="text-right">Phụ cấp</Th><Th className="text-right">Khấu trừ</Th><Th className="text-right">Thực lĩnh</Th><Th>Ghi chú</Th><Th />
                  </tr>
                </thead>
                <tbody>
                  {d.lines.map((l) => (
                    <tr key={l.userId} className="hover:bg-[var(--bg-subtle)]">
                      <Td>
                        <p className="font-semibold">{l.userName}</p>
                        <p className="text-[12px] text-[var(--text-muted)]">{l.roleName}{l.missingOut ? <span className="ml-1 text-[var(--warning)]">· {l.missingOut} thiếu giờ ra</span> : null}</p>
                      </Td>
                      <Td className="text-right font-mono">{hours(l.hours)}</Td>
                      <Td className="text-right font-mono">{formatCurrency(l.hourlyRate)}</Td>
                      <Td className="text-right font-mono">{formatCurrency(l.baseSalary)}</Td>
                      <Td className="text-right font-mono">{l.allowance ? formatCurrency(l.allowance) : '—'}</Td>
                      <Td className="text-right font-mono">{l.deduction ? formatCurrency(l.deduction) : '—'}</Td>
                      <Td className="text-right font-mono font-bold text-[var(--accent)]">{formatCurrency(l.total)}</Td>
                      <Td className="max-w-[180px] truncate text-[13px] text-[var(--text-secondary)]" title={l.note}>{l.note || '—'}</Td>
                      <Td className="whitespace-nowrap text-right">
                        {draft ? <Button size="sm" variant="ghost" aria-label={`Phụ cấp / khấu trừ ${l.userName}`} onClick={() => setEditing(l)}><Pencil size={15} /></Button> : null}
                        <Button size="sm" variant="ghost" aria-label={`In phiếu lương ${l.userName}`} loading={slip.isPending && slip.variables === l.userId} onClick={() => slip.mutate(l.userId)}><Printer size={15} /></Button>
                      </Td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-[var(--border)] font-semibold">
                    <Td>Tổng</Td>
                    <Td className="text-right font-mono">{hours(d.totalHours)}</Td>
                    <Td /><Td />
                    <Td className="text-right font-mono">{formatCurrency(d.totalAllowance)}</Td>
                    <Td className="text-right font-mono">{formatCurrency(d.totalDeduction)}</Td>
                    <Td className="text-right font-mono text-[var(--accent)]">{formatCurrency(d.total)}</Td>
                    <Td /><Td />
                  </tr>
                </tfoot>
              </DataTable>
            </Card>
            <LineDialog periodId={id} line={editing} onClose={() => setEditing(null)} onSaved={apply} />
            <ConfirmDialog
              open={confirmClose}
              onOpenChange={setConfirmClose}
              tone="primary"
              title="Chốt bảng lương?"
              description={<>Sau khi chốt, bảng lương và chấm công từ <b>{dmy(p.startDate)}</b> đến <b>{dmy(p.endDate)}</b> không sửa được.</>}
              confirmLabel="Chốt"
              loading={close.isPending}
              onConfirm={() => close.mutate()}
            />
          </>
        )}
      </div>
    </AppShell>
  );
}

function LineDialog({ periodId, line, onClose, onSaved }: { periodId: string; line: PayrollLine | null; onClose: () => void; onSaved: (d: PayrollDetail) => void }) {
  const [allowance, setAllowance] = useState('');
  const [deduction, setDeduction] = useState('');
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  useEffect(() => {
    if (line) {
      setAllowance(line.allowance ? String(line.allowance) : '');
      setDeduction(line.deduction ? String(line.deduction) : '');
      setNote(line.note);
      setErrors({});
    }
  }, [line]);
  const m = useMutation({
    mutationFn: () => updatePayrollLine(periodId, line!.userId, { allowance: num(allowance), deduction: num(deduction), note }),
    onSuccess: (d) => {
      toast.success(`Đã lưu phụ cấp / khấu trừ của ${line!.userName}`);
      onSaved(d);
      onClose();
    },
    onError: (e) => {
      if (e instanceof ValidationError) setErrors(e.fields);
      else {
        toast.error(e instanceof Error ? e.message : 'Không lưu được');
        onClose();
      }
    },
  });
  const preview = line ? Math.max(0, Math.round(line.hours * line.hourlyRate) + line.baseSalary + num(allowance) - num(deduction)) : 0;
  const money = (s: string) => (num(s) ? num(s).toLocaleString('vi-VN') : '');
  return (
    <Modal
      open={Boolean(line)}
      onOpenChange={(o) => !o && onClose()}
      size="sm"
      title={line ? `Phụ cấp / khấu trừ – ${line.userName}` : ''}
      description={line ? `${hours(line.hours)} giờ × ${formatCurrency(line.hourlyRate)} + lương cơ bản ${formatCurrency(line.baseSalary)}` : undefined}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Hủy</Button>
          <Button loading={m.isPending} onClick={() => m.mutate()}>Lưu</Button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Phụ cấp (đ)" error={errors.allowance} htmlFor="pl-allow">
            <TextInput id="pl-allow" inputMode="numeric" value={money(allowance)} onChange={(e) => setAllowance(String(num(e.target.value)))} invalid={Boolean(errors.allowance)} />
          </Field>
          <Field label="Khấu trừ (đ)" error={errors.deduction} htmlFor="pl-ded">
            <TextInput id="pl-ded" inputMode="numeric" value={money(deduction)} onChange={(e) => setDeduction(String(num(e.target.value)))} invalid={Boolean(errors.deduction)} />
          </Field>
        </div>
        <Field label="Ghi chú" required={num(allowance) > 0 || num(deduction) > 0} error={errors.note} htmlFor="pl-note">
          <TextInput id="pl-note" value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} invalid={Boolean(errors.note)} />
        </Field>
        <p className="text-right text-[14px]">Thực lĩnh: <b className="font-mono text-[18px] text-[var(--accent)]">{formatCurrency(preview)}</b></p>
      </div>
    </Modal>
  );
}

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

function printPayroll(d: PayrollDetail) {
  const rows = d.lines
    .map((l) => `<tr><td>${esc(l.userName)}<br/><span class="muted">${esc(l.roleName ?? '')}</span></td><td class="r">${hours(l.hours)}</td><td class="r">${m(l.hourlyRate)}</td>
<td class="r">${m(l.baseSalary)}</td><td class="r">${m(l.allowance)}</td><td class="r">${m(l.deduction)}</td><td class="r"><b>${m(l.total)}</b></td><td>${esc(l.note)}</td><td></td></tr>`)
    .join('');
  openPrint(`Bảng lương ${d.period.name}`, `<h2>BẢNG LƯƠNG ${esc(d.period.name.toUpperCase())}</h2>
<div class="muted">${dmy(d.period.startDate)} – ${dmy(d.period.endDate)} · ${d.period.status === 'closed' ? 'Đã chốt' : 'Nháp (chưa chốt)'}</div><br/>
<table><thead><tr><th>Nhân viên</th><th class="r">Giờ công</th><th class="r">Lương/giờ</th><th class="r">Lương CB</th><th class="r">Phụ cấp</th><th class="r">Khấu trừ</th><th class="r">Thực lĩnh</th><th>Ghi chú</th><th>Ký nhận</th></tr></thead>
<tbody>${rows}</tbody><tfoot><tr><th>Tổng</th><th class="r">${hours(d.totalHours)}</th><th></th><th></th><th class="r">${m(d.totalAllowance)}</th><th class="r">${m(d.totalDeduction)}</th><th class="r">${m(d.total)}</th><th></th><th></th></tr></tfoot></table>`);
}

function printPayslip(s: Payslip) {
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
