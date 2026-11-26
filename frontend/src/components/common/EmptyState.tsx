import type { ComponentType, ReactNode } from 'react';
import type { LucideProps } from 'lucide-react';
import { AlertTriangle, Inbox } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Button } from './Button';

export interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: ComponentType<LucideProps>;
  action?: ReactNode;
  tone?: 'neutral' | 'error';
  className?: string;
}

export function EmptyState({
  title,
  description,
  icon,
  action,
  tone = 'neutral',
  className,
}: EmptyStateProps) {
  const Icon = icon ?? (tone === 'error' ? AlertTriangle : Inbox);

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-2 rounded-item border border-dashed border-[var(--border-strong)] px-4 py-8 text-center',
        className,
      )}
    >
      <span
        className={cn(
          'grid h-10 w-10 place-items-center rounded-full',
          tone === 'error'
            ? 'bg-[var(--danger-soft)] text-[var(--danger)]'
            : 'bg-[var(--bg-subtle)] text-[var(--text-muted)]',
        )}
        aria-hidden
      >
        <Icon size={18} strokeWidth={1.75} />
      </span>
      <p className="text-[14px] font-semibold text-[var(--text-primary)]">{title}</p>
      {description ? (
        <p className="max-w-[38ch] text-[13px] leading-5 text-[var(--text-muted)]">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}

/**
 * Trang trống khi lọc không ra kết quả (theo Linear — docs/thiet-ke/QUY_TAC_GIAO_DIEN.md):
 * "Không có … phù hợp bộ lọc" + ô nhỏ "n mục đang bị ẩn bởi bộ lọc · Xóa lọc" để người dùng biết vì sao không thấy gì.
 */
export interface FilteredEmptyProps {
  /** Vd. "Không có món phù hợp bộ lọc". */
  title: string;
  /** Số mục bị ẩn do đang lọc (tổng – số đang hiện). */
  hiddenCount?: number;
  /** Đơn vị đếm, vd. "món", "phiếu". */
  unit?: string;
  onClear: () => void;
  className?: string;
}

export function FilteredEmpty({ title, hiddenCount, unit = 'mục', onClear, className }: FilteredEmptyProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-3 px-4 py-10 text-center', className)}>
      <span className="grid h-12 w-12 place-items-center rounded-[14px] border border-dashed border-[var(--border-strong)] text-[var(--text-muted)]" aria-hidden>
        <Inbox size={20} strokeWidth={1.6} />
      </span>
      <p className="text-[14.5px] font-semibold text-[var(--text-primary)]">{title}</p>
      <div className="flex items-center gap-4 rounded-[10px] border border-[var(--border)] bg-[var(--bg-surface)] px-4 py-2 text-[13px]">
        {hiddenCount ? (
          <span className="text-[var(--text-secondary)]">
            <span className="font-semibold text-[var(--text-primary)]">{hiddenCount} {unit}</span> đang bị ẩn bởi bộ lọc
          </span>
        ) : null}
        <button type="button" onClick={onClear} className="font-semibold text-[var(--accent)] hover:underline">
          Xóa lọc
        </button>
      </div>
    </div>
  );
}

export interface BlockErrorProps {
  message?: string;
  onRetry: () => void;
  retrying?: boolean;
}

export function BlockError({ message, onRetry, retrying }: BlockErrorProps) {
  return (
    <EmptyState
      tone="error"
      title={message ?? 'Không tải được dữ liệu'}
      description="Kiểm tra kết nối hoặc thử tải lại khối này."
      action={
        <Button variant="outline" size="sm" onClick={onRetry} loading={retrying}>
          Tải lại
        </Button>
      }
    />
  );
}