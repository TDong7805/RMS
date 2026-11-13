import { useEffect, useState } from 'react';
import { ConfirmDialog } from '@/components/common/Modal';
import { Field, SelectInput, TextArea } from '@/components/common/Form';
import { activateSupplier, deleteSupplier, stopSupplier } from '@/api/warehouse-suppliers';
import { useApiMutation } from '@/hooks/use-api-mutation';
import { SUPPLIER_STOP_REASON } from './labels';
import { wk } from './queries';
import type { Supplier, SupplierStopReason } from '@/types';

interface DialogProps {
  target: Supplier | null;
  onClose: () => void;
  onDone?: () => void;
}

const REASONS = Object.keys(SUPPLIER_STOP_REASON) as SupplierStopReason[];

/** UC-KHO-10: Ngừng hoạt động (bắt buộc lý do; "Khác" bắt buộc ghi chú). */
export function SupplierStopDialog({ target, onClose, onDone }: DialogProps) {
  const [reason, setReason] = useState<SupplierStopReason | ''>('');
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    setReason('');
    setNote('');
    setErrors({});
  }, [target?.id]);

  const mutation = useApiMutation((s: Supplier) => stopSupplier(s.id, reason, note), {
    invalidate: [wk.all],
    success: (s) => `Đã ngừng hoạt động nhà cung cấp ${s.name}`,
    onFieldErrors: setErrors,
    onSuccess: () => {
      onClose();
      onDone?.();
    },
  });

  const confirm = () => {
    if (!target) return;
    const local: Record<string, string> = {};
    if (!reason) local.reason = 'Vui lòng chọn lý do ngừng hoạt động';
    if (reason === 'other' && !note.trim()) local.note = 'Vui lòng nhập ghi chú cho lý do Khác';
    if (Object.keys(local).length) {
      setErrors(local);
      return;
    }
    mutation.mutate(target);
  };

  return (
    <ConfirmDialog
      open={Boolean(target)}
      onOpenChange={(o) => !o && onClose()}
      tone="primary"
      title="Ngừng hoạt động nhà cung cấp?"
      description={
        target ? (
          <>
            <p>“{target.name}” ({target.code}) sẽ không được chọn khi lập phiếu mua mới. Dữ liệu và lịch sử vẫn được giữ nguyên.</p>
            {target.openPurchaseCount > 0 ? (
              <p className="mt-2 rounded-item bg-[var(--warning-soft)] px-3 py-2 text-[13px] text-[var(--text-primary)]">
                Nhà cung cấp đang có {target.openPurchaseCount} phiếu mua chưa nhận đủ hàng. Các phiếu này vẫn được nhận hàng và thanh toán bình thường.
              </p>
            ) : null}
          </>
        ) : null
      }
      confirmLabel="Ngừng hoạt động"
      loading={mutation.isPending}
      onConfirm={confirm}
    >
      <div className="space-y-3">
        <Field label="Lý do ngừng" htmlFor="stop-reason" required error={errors.reason}>
          <SelectInput
            id="stop-reason"
            value={reason}
            invalid={Boolean(errors.reason)}
            onChange={(e) => {
              setReason(e.target.value as SupplierStopReason | '');
              setErrors({});
            }}
            placeholder="— Chọn lý do —"
            options={REASONS.map((r) => ({ value: r, label: SUPPLIER_STOP_REASON[r] }))}
          />
        </Field>
        <Field label="Ghi chú" htmlFor="stop-note" required={reason === 'other'} error={errors.note} hint={`${note.length}/255 ký tự`}>
          <TextArea id="stop-note" rows={2} maxLength={255} value={note} invalid={Boolean(errors.note)} onChange={(e) => { setNote(e.target.value); setErrors((p) => ({ ...p, note: '' })); }} />
        </Field>
      </div>
    </ConfirmDialog>
  );
}

/** UC-KHO-10 (A): Kích hoạt lại — không cần lý do. */
export function SupplierActivateDialog({ target, onClose, onDone }: DialogProps) {
  const mutation = useApiMutation((s: Supplier) => activateSupplier(s.id), {
    invalidate: [wk.all],
    success: (s) => `Đã kích hoạt lại nhà cung cấp ${s.name}`,
    onSuccess: () => {
      onClose();
      onDone?.();
    },
  });
  return (
    <ConfirmDialog
      open={Boolean(target)}
      onOpenChange={(o) => !o && onClose()}
      tone="primary"
      title="Kích hoạt lại nhà cung cấp?"
      description={`“${target?.name}” sẽ được chọn lại khi lập phiếu mua.`}
      confirmLabel="Kích hoạt lại"
      loading={mutation.isPending}
      onConfirm={() => target && mutation.mutate(target)}
    />
  );
}

/** UC-KHO-10 (B): Xóa nhà cung cấp chưa có phiếu mua nào (kể cả nháp). */
export function SupplierDeleteDialog({ target, onClose, onDone }: DialogProps) {
  const mutation = useApiMutation((s: Supplier) => deleteSupplier(s.id), {
    invalidate: [wk.all],
    success: (_r, s) => `Đã xóa nhà cung cấp ${s.name}`,
    onSuccess: () => {
      onClose();
      onDone?.();
    },
  });
  return (
    <ConfirmDialog
      open={Boolean(target)}
      onOpenChange={(o) => !o && onClose()}
      title="Xóa nhà cung cấp?"
      description={`“${target?.name}” (${target?.code}) cùng danh sách nguyên liệu cung cấp và lịch sử giá sẽ bị xóa khỏi hệ thống. Thao tác này không thể hoàn tác.`}
      confirmLabel="Xóa nhà cung cấp"
      loading={mutation.isPending}
      onConfirm={() => target && mutation.mutate(target)}
    />
  );
}
