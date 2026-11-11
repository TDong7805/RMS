import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Bật container queries để bố cục bên trong tự đổi theo độ rộng của card. */
  container?: boolean;
  padded?: boolean;
}

export function Card({
  className,
  children,
  container = true,
  padded = false,
  ...rest
}: CardProps) {
  return (
    <div
      className={cn(
        'rounded-card border border-[var(--border)] bg-[var(--bg-surface)]',
        container && '@container/card',
        padded && 'p-5 sm:p-6',
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

export interface CardHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

export function CardHeader({
  title,
  description,
  icon,
  actions,
  className,
}: CardHeaderProps) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-start justify-between gap-x-4 gap-y-3',
        className,
      )}
    >
      <div className="flex min-w-0 items-start gap-3">
        {icon ? (
          <span
            className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-[var(--accent-soft)] text-[var(--accent)]"
            aria-hidden
          >
            {icon}
          </span>
        ) : null}
        <div className="min-w-0">
          <h2 className="truncate text-[17px] font-semibold leading-6 text-[var(--text-primary)]">
            {title}
          </h2>
          {description ? (
            <p className="mt-1 text-[13px] leading-5 text-[var(--text-muted)]">
              {description}
            </p>
          ) : null}
        </div>
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}