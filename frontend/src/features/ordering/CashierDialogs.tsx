import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Printer, Trash2 } from 'lucide-react';
import { Modal, ConfirmDialog } from '@/components/common/Modal';
import { Button } from '@/components/common/Button';
import { Field, SelectInput, TextArea, TextInput } from '@/components/common/Form';
import { Skeleton } from '@/components/common/Skeleton';
import {
  cancelInvoice,
  cashierCancelItem,
  cashierCancelOrder,
  createInvoice,
  getInvoicePreview,
  getMoveTargets,
  moveOrder,
  payInvoice,
} from '@/api/ordering';
import { TransferQrBox } from '@/features/ordering/TransferQrBox';
import { formatCurrency } from '@/lib/format';
import { cn } from '@/lib/cn';
import { ValidationError } from '@/lib/mock';
import type { CashierCancelReason, CashierOrderDetail, Invoice, MoveTarget, PayMethod } from '@/types';

/* Hộp thoại của Thu ngân: hủy món / đơn (UC-TN-04), chuyển bàn (UC-TN-05), lập hóa đơn (UC-TN-07),
   thu tiền (UC-TN-08), hủy hóa đơn và in hóa đơn (UC-TN-09). */

export const PAY_METHOD_LABEL: Record<PayMethod, string> = { cash: 'Tiền mặt', card: 'Thẻ', transfer: 'Chuyển khoản', ewallet: 'Ví điện tử' };

const errorText = (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback);

/* ---------------------------------------------------------------- Hủy món / hủy đơn */

const REASONS: { value: CashierCancelReason; label: string }[] = [
  { value: 'changed_mind', label: 'Khách đổi ý' },
  { value: 'wrong_order', label: 'Gọi nhầm' },
  { value: 'left', label: 'Khách bỏ về' },
  { value: 'other', label: 'Khác' },
];

export function CancelDialog({
  target,
  onClose,
  onDone,
}: {
  /** Món (kind=item) hoặc đơn (kind=order) cần hủy. */
  target: { kind: 'item'; id: string; name: string } | { kind: 'order'; id: string; code: string; tableCode: string } | null;
  onClose: () => void;
  onDone: (d: CashierOrderDetail) => void;
}) {
  const [reason, setReason] = useState<CashierCancelReason | ''>('');
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  useEffect(() => {
    setReason('');
    setNote('');
    setErrors({});
  }, [target]);
  const m = useMutation({
    mutationFn: () =>
      target!.kind === 'item' ? cashierCancelItem(target!.id, reason as CashierCancelReason, note) : cashierCancelOrder(target!.id, reason as CashierCancelReason, note),
    onSuccess: (d) => {
      toast.success(target!.kind === 'item' ? `Đã hủy ${target!.name}` : `Đã hủy đơn ${target!.code}`);
      onDone(d);
      onClose();
    },
    onError: (e) => {
      if (e instanceof ValidationError) setErrors(e.fields);
      else {
        toast.error(errorText(e, 'Không hủy được'));
        onClose();
      }
    },
  });
  const isItem = target?.kind === 'item';
  return (
    <ConfirmDialog
      open={Boolean(target)}
      onOpenChange={(o) => !o && onClose()}
      title={isItem ? 'Hủy món?' : 'Hủy đơn hàng?'}
      description={
        !target ? null : target.kind === 'item' ? (
          <>Món <b>{target.name}</b> sẽ bị hủy, bếp không còn thấy món này.</>
        ) : (
          <>Đơn <b>{target.code}</b> – Bàn <b>{target.tableCode}</b> sẽ bị hủy, bàn chuyển về Trống.</>
        )
      }
      cancelLabel="Đóng"
      confirmLabel={isItem ? 'Hủy món' : 'Hủy đơn'}
      loading={m.isPending}
      confirmDisabled={!reason}
      onConfirm={() => m.mutate()}
    >
      <div className="space-y-3">
        <Field label="Lý do" required error={errors.reason}>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Lý do hủy">
            {REASONS.map((r) => (
              <button
                key={r.value}
                type="button"
                role="radio"
                aria-checked={reason === r.value}
                onClick={() => setReason(r.value)}
                className={cn(
                  'rounded-full border px-3 py-1.5 text-[13px] font-medium',
                  reason === r.value ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]' : 'border-[var(--border-strong)]',
                )}
              >
                {r.label}
              </button>
            ))}
          </div>
        </Field>
        <Field label={reason === 'other' ? 'Nội dung lý do' : 'Ghi chú thêm'} required={reason === 'other'} error={errors.note}>
          <TextInput value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} invalid={Boolean(errors.note)} aria-label="Nội dung lý do" />
        </Field>
      </div>
    </ConfirmDialog>
  );
}

/* ---------------------------------------------------------------- Chuyển bàn */

export function MoveTableDialog({
  open,
  order,
  onClose,
  onDone,
}: {
  open: boolean;
  order: { id: string; code: string; tableCode: string };
  onClose: () => void;
  onDone: (d: CashierOrderDetail) => void;
}) {
  const targets = useQuery({ queryKey: ['thu-ngan', 'move-targets'], queryFn: getMoveTargets, enabled: open });
  const [picked, setPicked] = useState<MoveTarget | null>(null);
  const [confirmReserved, setConfirmReserved] = useState(false);
  useEffect(() => {
    if (open) setPicked(null);
  }, [open]);
  const m = useMutation({
    mutationFn: () => moveOrder(order.id, picked!.id),
    onSuccess: (d) => {
      toast.success(`Đã chuyển đơn ${order.code} từ bàn ${order.tableCode} sang bàn ${picked!.code}`);
      setConfirmReserved(false);
      onDone(d);
      onClose();
    },
    onError: (e) => {
      setConfirmReserved(false);
      toast.error(errorText(e, 'Không chuyển được bàn'));
      void targets.refetch();
      setPicked(null);
    },
  });
  const byArea = useMemo(() => {
    const m = new Map<string, MoveTarget[]>();
    (targets.data ?? []).forEach((t) => m.set(t.areaName, [...(m.get(t.areaName) ?? []), t]));
    return [...m.entries()];
  }, [targets.data]);
  const submit = () => (picked?.status === 'reserved' && picked.reservation ? setConfirmReserved(true) : m.mutate());

  return (
    <>
      <Modal
        open={open}
        onOpenChange={(o) => !o && onClose()}
        title={`Chuyển bàn – đơn ${order.code}`}
        description={`Đang ở bàn ${order.tableCode}. Chọn bàn Trống / Đặt trước.`}
        footer={
          <>
            <Button variant="ghost" onClick={onClose}>Đóng</Button>
            <Button disabled={!picked} loading={m.isPending} onClick={submit}>Chuyển bàn</Button>
          </>
        }
      >
        {targets.isLoading ? (
          <Skeleton className="h-40" />
        ) : byArea.length === 0 ? (
          <p className="text-[13.5px] text-[var(--text-muted)]">Không còn bàn trống.</p>
        ) : (
          <div className="space-y-4">
            {byArea.map(([area, list]) => (
              <div key={area}>
                <p className="mb-1.5 text-[12px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">{area}</p>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {list.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      aria-pressed={picked?.id === t.id}
                      onClick={() => setPicked(t)}
                      className={cn(
                        'rounded-item border-2 p-2.5 text-left',
                        picked?.id === t.id ? 'border-[var(--accent)] bg-[var(--accent-soft)]' : t.status === 'reserved' ? 'border-[var(--info)] bg-[var(--info-soft)]' : 'border-[var(--border)]',
                      )}
                    >
                      <p className="text-[16px] font-extrabold">{t.code}</p>
                      <p className="text-[12px] text-[var(--text-muted)]">{t.seats} chỗ · {t.status === 'reserved' ? 'Đặt trước' : 'Trống'}</p>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </Modal>
      <ConfirmDialog
        open={confirmReserved}
        onOpenChange={setConfirmReserved}
        tone="primary"
        title="Bàn đang được giữ"
        description={
          picked?.reservation ? (
            <>
              Bàn <b>{picked.code}</b> đang được giữ cho lịch đặt {new Date(picked.reservation.time).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} – {picked.reservation.customerName}. Vẫn chuyển?
            </>
          ) : null
        }
        confirmLabel="Vẫn chuyển"
        loading={m.isPending}
        onConfirm={() => m.mutate()}
      />
    </>
  );
}

/* ---------------------------------------------------------------- Lập hóa đơn */

export function CreateInvoiceDialog({ orderId, open, onClose, onCreated }: { orderId: string; open: boolean; onClose: () => void; onCreated: (inv: Invoice) => void }) {
  const preview = useQuery({ queryKey: ['thu-ngan', 'invoice-preview', orderId], queryFn: () => getInvoicePreview(orderId), enabled: open, retry: false, gcTime: 0 });
  const [company, setCompany] = useState('');
  const [tax, setTax] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  useEffect(() => {
    if (preview.data) {
      setCompany(preview.data.vatCompany);
      setTax(preview.data.vatTaxCode);
      setErrors({});
    }
  }, [preview.data]);
  const m = useMutation({
    mutationFn: () => createInvoice(orderId, company, tax),
    onSuccess: (inv) => {
      toast.success(`Đã lập hóa đơn ${inv.code}`);
      onCreated(inv);
    },
    onError: (e) => {
      if (e instanceof ValidationError) setErrors(e.fields);
      else {
        toast.error(errorText(e, 'Không lập được hóa đơn'));
        void preview.refetch();
      }
    },
  });
  const p = preview.data;
  const blocked = p ? p.blockers.length > 0 || p.lines.length === 0 : true;
  return (
    <Modal
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title="Lập hóa đơn"
      description={p ? `Đơn ${p.orderCode} · Bàn ${p.tableCode}${p.requestedMethod ? ` · khách chọn ${PAY_METHOD_LABEL[p.requestedMethod]}` : ''}` : undefined}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Đóng</Button>
          <Button disabled={blocked} loading={m.isPending} onClick={() => m.mutate()}>Lập hóa đơn</Button>
        </>
      }
    >
      {preview.isError ? (
        <p className="text-[14px] text-[var(--danger)]">{errorText(preview.error, 'Không tải được')}</p>
      ) : !p ? (
        <Skeleton className="h-48" />
      ) : (
        <div className="space-y-4">
          {p.blockers.length ? (
            <p className="rounded-item bg-[var(--warning-soft)] px-3 py-2 text-[13.5px] text-[var(--warning)]">
              Còn {p.blockers.length} món chưa xong: {p.blockers.join(', ')}. Hãy chờ bếp hoàn thành hoặc hủy món chưa làm.
            </p>
          ) : null}
          {p.lines.length === 0 ? <p className="text-[13.5px] text-[var(--danger)]">Đơn không có món để lập hóa đơn. Bạn có thể hủy đơn.</p> : null}
          <InvoiceLines lines={p.lines} total={p.total} />
          <div className="grid gap-3 sm:grid-cols-[1fr_200px]">
            <Field label="Tên công ty (xuất VAT)" error={errors.vatCompany}>
              <TextInput value={company} maxLength={200} onChange={(e) => setCompany(e.target.value)} invalid={Boolean(errors.vatCompany)} />
            </Field>
            <Field label="Mã số thuế" required={Boolean(company.trim())} error={errors.vatTaxCode}>
              <TextInput value={tax} maxLength={14} onChange={(e) => setTax(e.target.value)} invalid={Boolean(errors.vatTaxCode)} inputMode="numeric" />
            </Field>
          </div>
        </div>
      )}
    </Modal>
  );
}

export function InvoiceLines({ lines, total }: { lines: { name: string; price: number; qty: number; amount: number }[]; total: number }) {
  return (
    <div className="overflow-hidden rounded-item border border-[var(--border)]">
      <table className="w-full text-[13.5px]">
        <thead className="bg-[var(--bg-subtle)] text-[12px] text-[var(--text-muted)]">
          <tr>
            <th className="px-3 py-2 text-left font-semibold">Món</th>
            <th className="px-3 py-2 text-right font-semibold">SL</th>
            <th className="px-3 py-2 text-right font-semibold">Đơn giá</th>
            <th className="px-3 py-2 text-right font-semibold">Thành tiền</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((l, i) => (
            <tr key={i} className="border-t border-[var(--border)]">
              <td className="px-3 py-1.5">{l.name}</td>
              <td className="px-3 py-1.5 text-right font-mono">{l.qty}</td>
              <td className="px-3 py-1.5 text-right font-mono">{formatCurrency(l.price)}</td>
              <td className="px-3 py-1.5 text-right font-mono font-semibold">{formatCurrency(l.amount)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-[var(--border)]">
            <td colSpan={3} className="px-3 py-2 text-right font-semibold">Tổng cộng</td>
            <td className="px-3 py-2 text-right font-mono text-[16px] font-bold text-[var(--accent)]">{formatCurrency(total)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

/* ---------------------------------------------------------------- Thu tiền */

interface Line {
  method: PayMethod;
  amount: string;
  cashGiven: string;
  ref: string;
}

const num = (s: string) => {
  const n = Number(s.replace(/[^\d]/g, ''));
  return Number.isFinite(n) ? n : 0;
};

export function PaymentDialog({ invoice, onClose, onPaid }: { invoice: Invoice | null; onClose: () => void; onPaid: (inv: Invoice) => void }) {
  const [lines, setLines] = useState<Line[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');
  useEffect(() => {
    if (invoice) {
      setLines([{ method: invoice.requestedMethod ?? 'cash', amount: String(invoice.total), cashGiven: '', ref: '' }]);
      setErrors({});
      setFormError('');
    }
  }, [invoice]);
  const sum = lines.reduce((s, l) => s + num(l.amount), 0);
  const remaining = (invoice?.total ?? 0) - sum;
  const cashLine = lines.find((l) => l.method === 'cash' && l.cashGiven);
  const change = cashLine ? num(cashLine.cashGiven) - num(cashLine.amount) : null;
  const hasTransfer = lines.some((l) => l.method === 'transfer');

  const m = useMutation({
    mutationFn: () =>
      payInvoice(
        invoice!.id,
        lines.map((l) => ({ method: l.method, amount: num(l.amount), cashGiven: l.method === 'cash' && l.cashGiven ? num(l.cashGiven) : null, transactionRef: l.method === 'cash' ? '' : l.ref })),
      ),
    onSuccess: (inv) => {
      toast.success(`Đã thanh toán hóa đơn ${inv.code}`);
      onPaid(inv);
    },
    onError: (e) => {
      if (e instanceof ValidationError) {
        setErrors(e.fields);
        setFormError(e.message);
      } else {
        toast.error(errorText(e, 'Không thanh toán được'));
        onClose();
      }
    },
  });
  const set = (i: number, patch: Partial<Line>) => setLines((prev) => prev.map((l, k) => (k === i ? { ...l, ...patch } : l)));

  return (
    <Modal
      open={Boolean(invoice)}
      onOpenChange={(o) => !o && onClose()}
      size="lg"
      title={invoice ? `Thu tiền – ${invoice.code}` : ''}
      description={invoice ? `Bàn ${invoice.tableCode} · đơn ${invoice.orderCode}${invoice.requestedMethod ? ` · khách chọn ${PAY_METHOD_LABEL[invoice.requestedMethod]}` : ''}` : undefined}
      footer={
        invoice ? (
          <>
            <Button variant="ghost" leadingIcon={<Printer size={15} />} onClick={() => printInvoice(invoice)}>In hóa đơn</Button>
            <span className="flex-1" />
            <Button variant="ghost" onClick={onClose}>Để sau</Button>
            <Button loading={m.isPending} disabled={remaining !== 0} onClick={() => m.mutate()}>Xác nhận thanh toán</Button>
          </>
        ) : null
      }
    >
      {invoice ? (
        <div className={cn('grid gap-5', hasTransfer && invoice.transfer ? 'md:grid-cols-[minmax(0,1fr)_260px]' : '')}>
          <div className="space-y-3">
            <div className="flex items-baseline justify-between rounded-item bg-[var(--accent-soft)] px-4 py-3">
              <span className="text-[14px] font-semibold">Tổng cộng</span>
              <b className="font-mono text-[24px] text-[var(--accent)]">{formatCurrency(invoice.total)}</b>
            </div>
            {lines.map((l, i) => (
              <div key={i} className="rounded-item border border-[var(--border)] p-3">
                <div className="grid gap-2 sm:grid-cols-[150px_1fr_auto]">
                  <Field label={`Hình thức ${lines.length > 1 ? i + 1 : ''}`} error={errors[`payments.${i}.method`]}>
                    <SelectInput
                      value={l.method}
                      onChange={(e) => set(i, { method: e.target.value as PayMethod })}
                      options={(Object.keys(PAY_METHOD_LABEL) as PayMethod[]).map((k) => ({ value: k, label: PAY_METHOD_LABEL[k] }))}
                      aria-label={`Hình thức ${i + 1}`}
                    />
                  </Field>
                  <Field label="Số tiền" error={errors[`payments.${i}.amount`]}>
                    <TextInput
                      value={num(l.amount) ? num(l.amount).toLocaleString('vi-VN') : ''}
                      onChange={(e) => set(i, { amount: String(num(e.target.value)) })}
                      inputMode="numeric"
                      aria-label={`Số tiền ${i + 1}`}
                      invalid={Boolean(errors[`payments.${i}.amount`])}
                    />
                  </Field>
                  {lines.length > 1 ? (
                    <Button variant="ghost" size="sm" className="self-end" aria-label="Bỏ khoản thu" onClick={() => setLines((prev) => prev.filter((_, k) => k !== i))}>
                      <Trash2 size={15} />
                    </Button>
                  ) : null}
                </div>
                {l.method === 'cash' ? (
                  <div className="mt-2 grid gap-2 sm:grid-cols-[150px_1fr]">
                    <span className="hidden sm:block" />
                    <Field label="Tiền khách đưa" error={errors[`payments.${i}.cashGiven`]}>
                      <TextInput
                        value={num(l.cashGiven) ? num(l.cashGiven).toLocaleString('vi-VN') : ''}
                        onChange={(e) => set(i, { cashGiven: String(num(e.target.value) || '') })}
                        inputMode="numeric"
                        aria-label="Tiền khách đưa"
                        invalid={Boolean(errors[`payments.${i}.cashGiven`])}
                      />
                    </Field>
                  </div>
                ) : (
                  <div className="mt-2 grid gap-2 sm:grid-cols-[150px_1fr]">
                    <span className="hidden sm:block" />
                    <Field label="Mã giao dịch (không bắt buộc)" error={errors[`payments.${i}.transactionRef`]}>
                      <TextInput value={l.ref} maxLength={100} onChange={(e) => set(i, { ref: e.target.value })} aria-label="Mã giao dịch" />
                    </Field>
                  </div>
                )}
              </div>
            ))}
            {lines.length < 4 ? (
              <Button
                variant="outline"
                size="sm"
                leadingIcon={<Plus size={15} />}
                onClick={() => setLines((prev) => [...prev, { method: prev.some((x) => x.method === 'cash') ? 'transfer' : 'cash', amount: String(Math.max(0, remaining)), cashGiven: '', ref: '' }])}
              >
                Thêm hình thức
              </Button>
            ) : null}
            <div className="space-y-1 rounded-item border border-[var(--border)] px-4 py-3 text-[14px]">
              <div className="flex justify-between"><span>Đã nhập</span><b className="font-mono">{formatCurrency(sum)}</b></div>
              <div className={cn('flex justify-between', remaining !== 0 && 'text-[var(--danger)]')}>
                <span>{remaining >= 0 ? 'Còn phải thu' : 'Thu thừa'}</span>
                <b className="font-mono">{formatCurrency(Math.abs(remaining))}</b>
              </div>
              {change !== null ? (
                <div className={cn('flex justify-between', change < 0 && 'text-[var(--danger)]')}>
                  <span>{change < 0 ? 'Tiền khách đưa chưa đủ' : 'Tiền thối lại'}</span>
                  <b className="font-mono text-[16px]">{formatCurrency(Math.abs(change))}</b>
                </div>
              ) : null}
            </div>
            {formError && !Object.keys(errors).some((k) => k.startsWith('payments.')) ? <p className="text-[13px] text-[var(--danger)]">{formError}</p> : null}
            {hasTransfer ? <p className="text-[12.5px] text-[var(--text-muted)]">Kiểm tra tiền đã về tài khoản trước khi xác nhận khoản chuyển khoản.</p> : null}
          </div>
          {hasTransfer && invoice.transfer ? (
            <TransferQrBox
              transfer={{ ...invoice.transfer, amount: lines.filter((l) => l.method === 'transfer').reduce((s, l) => s + num(l.amount), 0) || invoice.total }}
              size={190}
            />
          ) : null}
        </div>
      ) : null}
    </Modal>
  );
}

/* ---------------------------------------------------------------- Hủy hóa đơn */

export function CancelInvoiceDialog({ invoice, onClose, onDone }: { invoice: Invoice | null; onClose: () => void; onDone: (inv: Invoice) => void }) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    setReason('');
    setError('');
  }, [invoice]);
  const m = useMutation({
    mutationFn: () => cancelInvoice(invoice!.id, reason),
    onSuccess: (inv) => {
      toast.success(`Đã hủy hóa đơn ${inv.code}`);
      onDone(inv);
      onClose();
    },
    onError: (e) => {
      if (e instanceof ValidationError) setError(e.fields.reason ?? e.message);
      else {
        toast.error(errorText(e, 'Không hủy được hóa đơn'));
        onClose();
      }
    },
  });
  return (
    <ConfirmDialog
      open={Boolean(invoice)}
      onOpenChange={(o) => !o && onClose()}
      title="Hủy hóa đơn?"
      description={invoice ? <>Hóa đơn <b>{invoice.code}</b> sẽ bị hủy, đơn <b>{invoice.orderCode}</b> mở lại để gọi thêm món.</> : null}
      cancelLabel="Đóng"
      confirmLabel="Hủy hóa đơn"
      loading={m.isPending}
      onConfirm={() => (reason.trim().length < 5 ? setError('Vui lòng nhập lý do hủy (ít nhất 5 ký tự)') : m.mutate())}
    >
      <Field label="Lý do hủy" required error={error}>
        <TextArea value={reason} rows={2} maxLength={300} onChange={(e) => setReason(e.target.value)} invalid={Boolean(error)} aria-label="Lý do hủy" />
      </Field>
    </ConfirmDialog>
  );
}

/* ---------------------------------------------------------------- In hóa đơn */

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const money = (v: number) => v.toLocaleString('vi-VN');
const dt = (iso: string | null) => (iso ? new Date(iso).toLocaleString('vi-VN') : '');

/** In hóa đơn (bản in khổ nhỏ) bằng trình duyệt. */
export function printInvoice(inv: Invoice) {
  const r = inv.restaurant;
  const rows = inv.lines
    .map((l) => `<tr><td>${esc(l.name)}<br/><small>${l.qty} × ${money(l.price)}</small></td><td class="r">${money(l.amount)}</td></tr>`)
    .join('');
  const pays = inv.payments
    .map(
      (p) =>
        `<tr><td>${PAY_METHOD_LABEL[p.method]}${p.transactionRef ? ` (${esc(p.transactionRef)})` : ''}</td><td class="r">${money(p.amount)}</td></tr>` +
        (p.cashGiven != null ? `<tr><td><small>Khách đưa / thối lại</small></td><td class="r"><small>${money(p.cashGiven)} / ${money(p.change ?? 0)}</small></td></tr>` : ''),
    )
    .join('');
  const status = inv.status === 'paid' ? 'ĐÃ THANH TOÁN' : inv.status === 'cancelled' ? 'ĐÃ HỦY' : 'CHƯA THANH TOÁN';
  const w = window.open('', '_blank', 'width=380,height=700');
  if (!w) return;
  w.document.write(`<html><head><title>Hóa đơn ${esc(inv.code)}</title><style>
body{font-family:sans-serif;font-size:13px;padding:12px;max-width:320px;margin:auto}table{width:100%;border-collapse:collapse}td{padding:3px 0;vertical-align:top}
.r{text-align:right;white-space:nowrap}.c{text-align:center}h2{margin:0;font-size:16px}hr{border:0;border-top:1px dashed #999}small{color:#555}</style></head><body>
<div class="c"><h2>${esc(r.name)}</h2>${r.address ? `<div>${esc(r.address)}</div>` : ''}${r.phone ? `<div>ĐT: ${esc(r.phone)}</div>` : ''}${r.taxCode ? `<div>MST: ${esc(r.taxCode)}</div>` : ''}
<h2 style="margin-top:8px">HÓA ĐƠN THANH TOÁN</h2><div>${esc(inv.code)} · ${status}</div></div><hr/>
<div>Bàn: ${esc(inv.tableCode)} (${esc(inv.areaName)}) · Đơn: ${esc(inv.orderCode)}</div>
<div>Lập lúc: ${dt(inv.createdAt)}</div>${inv.paidAt ? `<div>Thanh toán: ${dt(inv.paidAt)}</div>` : ''}<div>Thu ngân: ${esc(inv.cashierName ?? '')}</div>
${inv.vatCompany ? `<div>Công ty: ${esc(inv.vatCompany)}</div><div>MST: ${esc(inv.vatTaxCode)}</div>` : ''}<hr/>
<table>${rows}</table><hr/><table><tr><td><b>TỔNG CỘNG</b></td><td class="r"><b>${money(inv.total)} đ</b></td></tr>${pays}</table><hr/>
<div class="c">Giá đã bao gồm thuế. Cảm ơn quý khách, hẹn gặp lại!</div><script>window.print()</script></body></html>`);
  w.document.close();
}
