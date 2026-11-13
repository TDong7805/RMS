import { useEffect, useState } from 'react';
import { Button } from '@/components/common/Button';
import { Field, SelectInput, TextArea, TextInput } from '@/components/common/Form';
import { ConfirmDialog, Modal } from '@/components/common/Modal';
import { cancelPayment, createPayment } from '@/api/warehouse-debts';
import { useApiMutation } from '@/hooks/use-api-mutation';
import { formatCurrency } from '@/lib/format';
import { formatDateOnly } from '@/lib/labels';
import { PAYMENT_METHOD } from './labels';
import { dateKeyOffset, InfoItem, parseMoney } from './parts';
import { wk } from './queries';
import type { PaymentMethod, PurchaseOrderRow, SupplierPayment } from '@/types';

const METHODS = Object.keys(PAYMENT_METHOD) as PaymentMethod[];

/** Phiếu có thể thanh toán: Đã đặt và còn nợ. */
export interface PayableOrder {
  id: string;
  code: string;
  supplierName: string;
  payable: number;
  paid: number;
  debt: number;
}

interface Props {
  open: boolean;
  onClose: () => void;
  /** Mở từ một phiếu: chỉ phiếu đó. Mở từ trang công nợ NCC: chọn trong các phiếu còn nợ (phiếu nợ cũ nhất chọn sẵn). */
  orders: PayableOrder[];
  defaultMethod?: PaymentMethod;
}

/** UC-KHO-26: Ghi nhận thanh toán nhà cung cấp (hộp thoại nhỏ: Hủy đóng ngay). */
export function PaymentDialog({ open, onClose, orders, defaultMethod }: Props) {
  const [orderId, setOrderId] = useState('');
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<PaymentMethod | ''>('');
  const [paidDate, setPaidDate] = useState(dateKeyOffset(0));
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const order = orders.find((o) => o.id === orderId);

  useEffect(() => {
    if (!open) return;
    const first = orders[0];
    setOrderId(first?.id ?? '');
    setAmount(first ? String(first.debt) : '');
    setMethod(defaultMethod ?? 'transfer');
    setPaidDate(dateKeyOffset(0));
    setReference('');
    setNote('');
    setErrors({});
  }, [open, orders, defaultMethod]);

  const mutation = useApiMutation(createPayment, {
    invalidate: [wk.all],
    success: (p: SupplierPayment) => `Đã ghi nhận thanh toán ${formatCurrency(p.amount)} cho phiếu ${p.purchaseOrderCode ?? ''}`,
    onFieldErrors: setErrors,
    onSuccess: onClose,
  });

  const submit = () => {
    const value = parseMoney(amount);
    const local: Record<string, string> = {};
    if (!orderId) local.purchaseOrderId = 'Vui lòng chọn phiếu mua';
    if (!(value > 0)) local.amount = 'Số tiền phải lớn hơn 0';
    else if (order && value > order.debt) local.amount = `Số tiền không được vượt quá số còn nợ (${formatCurrency(order.debt)})`;
    if (!method) local.method = 'Vui lòng chọn phương thức';
    if (paidDate > dateKeyOffset(0) || paidDate < dateKeyOffset(-7)) local.paidDate = `Ngày thanh toán phải từ ${formatDateOnly(dateKeyOffset(-7))} đến hôm nay`;
    if (Object.keys(local).length) {
      setErrors(local);
      return;
    }
    mutation.mutate({ purchaseOrderId: orderId, amount: value, method, paidDate, reference, note });
  };

  return (
    <Modal
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title="Ghi nhận thanh toán"
      description={order ? `${order.code} · ${order.supplierName}` : undefined}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={mutation.isPending}>Hủy</Button>
          <Button onClick={submit} loading={mutation.isPending}>Ghi nhận</Button>
        </>
      }
    >
      <div className="space-y-4">
        {orders.length > 1 ? (
          <Field label="Phiếu mua" htmlFor="pay-po" required error={errors.purchaseOrderId}>
            <SelectInput
              id="pay-po"
              value={orderId}
              onChange={(e) => {
                setOrderId(e.target.value);
                const o = orders.find((x) => x.id === e.target.value);
                setAmount(o ? String(o.debt) : '');
              }}
              options={orders.map((o) => ({ value: o.id, label: `${o.code} — còn nợ ${formatCurrency(o.debt)}` }))}
            />
          </Field>
        ) : null}
        {order ? (
          <div className="grid grid-cols-3 gap-3 rounded-item bg-[var(--bg-subtle)] px-3 py-2.5">
            <InfoItem label="Phải trả"><span className="font-mono">{formatCurrency(order.payable)}</span></InfoItem>
            <InfoItem label="Đã trả"><span className="font-mono">{formatCurrency(order.paid)}</span></InfoItem>
            <InfoItem label="Còn nợ"><span className="font-mono font-semibold">{formatCurrency(order.debt)}</span></InfoItem>
          </div>
        ) : null}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Số tiền (đ)" htmlFor="pay-amount" required error={errors.amount} hint={parseMoney(amount) > 0 ? formatCurrency(parseMoney(amount)) : undefined}>
            <TextInput id="pay-amount" inputMode="numeric" value={amount} invalid={Boolean(errors.amount)} onChange={(e) => { setAmount(e.target.value); setErrors((p) => ({ ...p, amount: '' })); }} />
          </Field>
          <Field label="Phương thức" htmlFor="pay-method" required error={errors.method}>
            <SelectInput id="pay-method" value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)} options={METHODS.map((m) => ({ value: m, label: PAYMENT_METHOD[m] }))} />
          </Field>
          <Field label="Ngày thanh toán" htmlFor="pay-date" required error={errors.paidDate}>
            <TextInput id="pay-date" type="date" min={dateKeyOffset(-7)} max={dateKeyOffset(0)} value={paidDate} invalid={Boolean(errors.paidDate)} onChange={(e) => setPaidDate(e.target.value)} />
          </Field>
          <Field label="Mã tham chiếu" htmlFor="pay-ref" error={errors.reference} hint="Mã giao dịch ngân hàng, số phiếu chi…">
            <TextInput id="pay-ref" maxLength={50} value={reference} onChange={(e) => setReference(e.target.value)} />
          </Field>
        </div>
        <Field label="Ghi chú" htmlFor="pay-note" error={errors.note} hint={`${note.length}/300 ký tự`}>
          <TextArea id="pay-note" rows={2} maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}

/** UC-KHO-26 (A): Hủy một lần thanh toán ghi nhầm. */
export function CancelPaymentDialog({ payment, onClose }: { payment: SupplierPayment | null; onClose: () => void }) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    setReason('');
    setError('');
  }, [payment?.id]);
  const mutation = useApiMutation((p: SupplierPayment) => cancelPayment(p.id, reason), {
    invalidate: [wk.all],
    success: (p) => `Đã hủy thanh toán ${p.code}`,
    onFieldErrors: (f) => setError(f.reason ?? ''),
    onSuccess: onClose,
  });
  return (
    <ConfirmDialog
      open={Boolean(payment)}
      onOpenChange={(o) => !o && onClose()}
      title="Hủy thanh toán?"
      description={payment ? `Khoản ${formatCurrency(payment.amount)} ngày ${formatDateOnly(payment.paidAt)} cho phiếu ${payment.purchaseOrderCode ?? ''} sẽ không còn được tính. Bản ghi vẫn được giữ lại.` : null}
      cancelLabel="Đóng"
      confirmLabel="Hủy thanh toán"
      loading={mutation.isPending}
      onConfirm={() => {
        if (!payment) return;
        if (reason.trim().length < 5) {
          setError('Vui lòng nhập lý do hủy (ít nhất 5 ký tự)');
          return;
        }
        mutation.mutate(payment);
      }}
    >
      <Field label="Lý do hủy" htmlFor="pay-cancel" required error={error} hint={`${reason.length}/300 ký tự`}>
        <TextArea id="pay-cancel" rows={2} maxLength={300} value={reason} invalid={Boolean(error)} onChange={(e) => { setReason(e.target.value); setError(''); }} />
      </Field>
    </ConfirmDialog>
  );
}

export const toPayable = (r: PurchaseOrderRow): PayableOrder => ({ id: r.id, code: r.code, supplierName: r.supplierName, payable: r.payable, paid: r.paid, debt: r.debt });
