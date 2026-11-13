import { useEffect, useState } from 'react';
import { Field, SelectInput, TextArea } from '@/components/common/Form';
import { ConfirmDialog } from '@/components/common/Modal';
import { cancelPurchaseOrder, closePurchaseOrder, deletePurchaseDraft } from '@/api/warehouse-purchases';
import { useApiMutation } from '@/hooks/use-api-mutation';
import { formatCurrency } from '@/lib/format';
import { PURCHASE_CANCEL_REASON, PURCHASE_CLOSE_REASON } from './labels';
import { wk } from './queries';

/** Thông tin tối thiểu của phiếu để hiện trong hộp thoại (dùng được cả dòng danh sách lẫn trang chi tiết). */
export interface PurchaseTarget {
  id: string;
  code: string;
  supplierName: string;
  payable: number;
  /** "x/y nguyên liệu đã nhận đủ" — chỉ có khi mở từ trang chi tiết. */
  progress?: string;
}

interface DialogProps {
  target: PurchaseTarget | null;
  onClose: () => void;
  onDone?: () => void;
}

/** Hộp chọn lý do + ghi chú dùng chung cho Hủy phiếu và Kết thúc nhận hàng (UC-KHO-16). */
function ReasonDialog<R extends string>({
  target,
  onClose,
  onDone,
  kind,
}: DialogProps & { kind: 'cancel' | 'close' }) {
  const reasons = (kind === 'cancel' ? PURCHASE_CANCEL_REASON : PURCHASE_CLOSE_REASON) as Record<R, string>;
  const [reason, setReason] = useState<R | ''>('');
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    setReason('');
    setNote('');
    setErrors({});
  }, [target?.id]);

  const mutation = useApiMutation(
    (t: PurchaseTarget) =>
      kind === 'cancel'
        ? cancelPurchaseOrder(t.id, reason as never, note)
        : closePurchaseOrder(t.id, reason as never, note),
    {
      invalidate: [wk.all],
      success: (r) => (kind === 'cancel' ? `Đã hủy phiếu mua ${r.code}` : `Đã kết thúc nhận hàng phiếu ${r.code}`),
      onFieldErrors: setErrors,
      onSuccess: () => {
        onClose();
        onDone?.();
      },
    },
  );

  const confirm = () => {
    if (!target) return;
    const local: Record<string, string> = {};
    if (!reason) local.reason = 'Vui lòng chọn lý do';
    if (reason === 'other' && !note.trim()) local.note = 'Vui lòng nhập ghi chú cho lý do Khác';
    if (Object.keys(local).length) {
      setErrors(local);
      return;
    }
    mutation.mutate(target);
  };

  const description = !target
    ? null
    : kind === 'cancel'
      ? `Phiếu ${target.code} – ${target.supplierName} sẽ không được nhận hàng hay thanh toán nữa. Thao tác này không thể hoàn tác.`
      : `Phiếu ${target.code}${target.progress ? ` đã nhận đủ ${target.progress} nguyên liệu` : ''}. Phần còn lại sẽ không được nhận nữa; công nợ tính theo hàng đã nhận (${formatCurrency(target.payable)}).`;

  return (
    <ConfirmDialog
      open={Boolean(target)}
      onOpenChange={(o) => !o && onClose()}
      tone={kind === 'cancel' ? 'danger' : 'primary'}
      title={kind === 'cancel' ? 'Hủy phiếu mua?' : 'Kết thúc nhận hàng?'}
      description={description}
      cancelLabel="Đóng"
      confirmLabel={kind === 'cancel' ? 'Hủy phiếu mua' : 'Kết thúc nhận hàng'}
      loading={mutation.isPending}
      onConfirm={confirm}
    >
      <div className="space-y-3">
        <Field label="Lý do" htmlFor="po-reason" required error={errors.reason}>
          <SelectInput
            id="po-reason"
            value={reason}
            invalid={Boolean(errors.reason)}
            onChange={(e) => {
              setReason(e.target.value as R | '');
              setErrors({});
            }}
            placeholder="— Chọn lý do —"
            options={(Object.keys(reasons) as R[]).map((r) => ({ value: r, label: reasons[r] }))}
          />
        </Field>
        <Field label="Ghi chú" htmlFor="po-note" required={reason === 'other'} error={errors.note} hint={`${note.length}/255 ký tự`}>
          <TextArea id="po-note" rows={2} maxLength={255} value={note} invalid={Boolean(errors.note)} onChange={(e) => { setNote(e.target.value); setErrors((p) => ({ ...p, note: '' })); }} />
        </Field>
      </div>
    </ConfirmDialog>
  );
}

export function PurchaseCancelDialog(props: DialogProps) {
  return <ReasonDialog {...props} kind="cancel" />;
}

export function PurchaseCloseDialog(props: DialogProps) {
  return <ReasonDialog {...props} kind="close" />;
}

/** UC-KHO-15 (4b): xóa phiếu nháp. */
export function PurchaseDeleteDialog({ target, onClose, onDone }: DialogProps) {
  const mutation = useApiMutation((t: PurchaseTarget) => deletePurchaseDraft(t.id), {
    invalidate: [wk.all],
    success: (_r, t) => `Đã xóa phiếu nháp ${t.code}`,
    onSuccess: () => {
      onClose();
      onDone?.();
    },
  });
  return (
    <ConfirmDialog
      open={Boolean(target)}
      onOpenChange={(o) => !o && onClose()}
      title="Xóa phiếu nháp?"
      description={`Phiếu ${target?.code} sẽ bị xóa khỏi hệ thống. Thao tác này không thể hoàn tác.`}
      confirmLabel="Xóa phiếu"
      loading={mutation.isPending}
      onConfirm={() => target && mutation.mutate(target)}
    />
  );
}
