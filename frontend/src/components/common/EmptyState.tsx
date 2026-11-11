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