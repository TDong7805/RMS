import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';

export type BadgeVariant = 'accent' | 'danger' | 'warning' | 'info' | 'neutral';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  mono?: boolean;
  icon?: ReactNode;
}

const VARIANTS: Record<BadgeVariant, string> = {
  accent: 'bg-[var(--accent-soft)] text-[var(--accent)]',
  danger: 'bg-[var(--danger-soft)] text-[var(--danger)]',
  warning: 'bg-[var(--warning-soft)] text-[var(--warning)]',
  info: 'bg-[var(--info-soft)] text-[var(--info)]',
  neutral: 'bg-[var(--bg-subtle)] text-[var(--text-secondary)]',
};

export function formatBadgeCount(count: number): string {
  if (count <= 0) return '';
  return count > 99 ? '99+' : String(count);
}

export function Badge({
  variant = 'accent',
  mono = false,
  icon,
  className,
  children,
  ...rest
}: BadgeProps) {
  if (children === 0 || children === '0' || children === '') return null;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-pill px-2 py-[3px] text-[12px] font-semibold leading-none',
        mono && 'font-mono tabular-nums',
        VARIANTS[variant],
        className,
      )}
      {...rest}
    >
      {icon}
      {children}
    </span>
  );
}