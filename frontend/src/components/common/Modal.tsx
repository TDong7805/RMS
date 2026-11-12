import type { ReactNode } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { AlertTriangle, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Button } from './Button';

export interface ModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

const SIZES = {
  sm: 'max-w-[420px]',
  md: 'max-w-[560px]',
  lg: 'max-w-[760px]',
  xl: 'max-w-[980px]',
};

export function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  size = 'md',
}: ModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[90] bg-[rgba(15,26,20,0.45)] data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <Dialog.Content
          className={cn(
            'fixed left-1/2 top-1/2 z-[95] flex max-h-[min(92vh,900px)] w-[calc(100vw-24px)] -translate-x-1/2 -translate-y-1/2 flex-col rounded-card border border-[var(--border)] bg-[var(--bg-surface)] shadow-overlay focus:outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95',
            SIZES[size],
          )}
        >
          <div className="flex shrink-0 items-start justify-between gap-3 border-b border-[var(--border)] px-5 py-4 sm:px-6">
            <div className="min-w-0">
              <Dialog.Title className="text-[17px] font-bold leading-6 text-[var(--text-primary)]">
                {title}
              </Dialog.Title>
              {description ? (
                <Dialog.Description className="mt-0.5 text-[13px] leading-5 text-[var(--text-muted)]">
                  {description}
                </Dialog.Description>
              ) : typeof title === 'string' ? (
                <Dialog.Description className="sr-only">{title}</Dialog.Description>
              ) : null}
            </div>
            <Dialog.Close
              aria-label="Đóng"
              className="grid h-8 w-8 shrink-0 place-items-center rounded-[9px] text-[var(--text-muted)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)]"
            >
              <X size={17} />
            </Dialog.Close>
          </div>
          {children ? (
            <div className="ghost-scroll min-h-0 flex-1 px-5 py-4 sm:px-6">{children}</div>
          ) : null}
          {footer ? (
            <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-[var(--border)] px-5 py-3 sm:px-6">
              {footer}
            </div>
          ) : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  /** Chữ trên nút đóng hộp. Mặc định "Hủy"; dùng "Đóng" khi thao tác chính cũng là hủy (hủy phiếu…). */
  cancelLabel?: string;
  tone?: 'danger' | 'primary';
  loading?: boolean;
  /** Nút xác nhận bị khóa (vd. chưa chọn lý do). */
  confirmDisabled?: boolean;
  onConfirm: () => void;
  /** Nội dung thêm dưới phần mô tả (vd. ô lý do). */
  children?: ReactNode;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Xác nhận',
  cancelLabel = 'Hủy',
  tone = 'danger',
  loading,
  confirmDisabled,
  onConfirm,
  children,
}: ConfirmDialogProps) {
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      size="sm"
      title={
        <span className="flex items-center gap-2">
          {tone === 'danger' ? (
            <span className="grid h-8 w-8 place-items-center rounded-full bg-[var(--danger-soft)] text-[var(--danger)]">
              <AlertTriangle size={16} />
            </span>
          ) : null}
          {title}
        </span>
      }
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button variant={tone === 'danger' ? 'danger' : 'primary'} onClick={onConfirm} loading={loading} disabled={confirmDisabled}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      {description || children ? (
        <>
          {description ? (
            <div className="text-[14px] leading-6 text-[var(--text-secondary)]">{description}</div>
          ) : null}
          {children ? <div className={description ? 'mt-3' : ''}>{children}</div> : null}
        </>
      ) : null}
    </Modal>
  );
}
