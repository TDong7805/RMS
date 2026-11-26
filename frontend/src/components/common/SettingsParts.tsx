import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { useUnsavedGuard } from '@/hooks/use-unsaved-guard';
import { StickySaveBar } from './StickySaveBar';

/**
 * Trang cài đặt kiểu Linear (docs/thiet-ke/QUY_TAC_GIAO_DIEN.md, mục B10): mỗi nhóm cài đặt là một khung thẻ,
 * mỗi cài đặt một dòng — tên + một dòng mô tả bên trái, ô nhập / công tắc bên phải.
 */
export function SettingsSection({ title, description, action, children, className }: {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('min-w-0', className)}>
      <div className="mb-2 flex flex-wrap items-end justify-between gap-2 px-1">
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold text-[var(--text-primary)]">{title}</h2>
          {description ? <p className="mt-0.5 text-[12.5px] leading-5 text-[var(--text-muted)]">{description}</p> : null}
        </div>
        {action}
      </div>
      <div className="divide-y divide-[var(--border)] rounded-[14px] border border-[var(--border)] bg-[var(--bg-surface)] shadow-[var(--shadow-card)]">
        {children}
      </div>
    </section>
  );
}

/**
 * Một dòng cài đặt. `stacked`: ô nhập rộng (ảnh, danh sách mạng…) nằm dưới tên thay vì bên phải.
 * `error` hiện ngay dưới dòng.
 */
export function SettingRow({ label, description, htmlFor, error, stacked, children, className }: {
  label: ReactNode;
  description?: ReactNode;
  htmlFor?: string;
  error?: string;
  stacked?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('px-4 py-3.5 sm:px-5', className)}>
      <div className={cn('flex gap-x-6 gap-y-2.5', stacked ? 'flex-col' : 'flex-col sm:flex-row sm:items-center sm:justify-between')}>
        <div className="min-w-0 sm:max-w-[60%]">
          <label htmlFor={htmlFor} className="block text-[14px] font-medium text-[var(--text-primary)]">{label}</label>
          {description ? <p className="mt-0.5 text-[12.5px] leading-5 text-[var(--text-muted)]">{description}</p> : null}
        </div>
        <div className={cn('min-w-0', stacked ? 'w-full' : 'shrink-0')}>{children}</div>
      </div>
      {error ? <p className="mt-1.5 text-[12.5px] font-medium text-[var(--danger)]">{error}</p> : null}
    </div>
  );
}

/** Ô số có đơn vị phía sau: [ 30 ] phút */
export function UnitInput({ unit, children }: { unit: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      {children}
      <span className="text-[13px] text-[var(--text-muted)]">{unit}</span>
    </div>
  );
}

/**
 * Thanh lưu dính đáy của một mục cài đặt (luôn hiện, giống trang Thêm / sửa món) + hỏi trước khi rời mục / rời trang
 * khi còn thay đổi chưa lưu.
 */
export function SettingsSaveBar({ dirty, saving, errorCount = 0, onSave, onDiscard }: {
  dirty: boolean;
  saving?: boolean;
  errorCount?: number;
  onSave: () => void;
  onDiscard: () => void;
}) {
  const guard = useUnsavedGuard(dirty && !saving, { watchSearch: true });
  return (
    <>
      <StickySaveBar
        dirty={dirty}
        saving={saving}
        errorCount={errorCount}
        idleText="Chưa có thay đổi"
        onSave={onSave}
        onDiscard={onDiscard}
        className="mx-0 rounded-t-[12px] border-x px-4 sm:mx-0 sm:px-5"
      />
      {guard.dialog}
    </>
  );
}
