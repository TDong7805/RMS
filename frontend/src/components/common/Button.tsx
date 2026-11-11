import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/cn';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'icon';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
}

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'bg-[var(--accent)] text-[var(--accent-contrast)] border border-transparent hover:bg-[var(--accent-hover)] active:bg-[var(--accent-hover)]',
  secondary:
    'bg-[var(--accent-soft)] text-[var(--accent)] border border-transparent hover:bg-[var(--accent-soft)]/70 active:bg-[var(--accent-soft)]',
  outline:
    '!bg-transparent text-[var(--text-primary)] border border-[var(--border-strong)] hover:!bg-[var(--bg-subtle)] hover:border-[var(--accent)] hover:text-[var(--accent)]',
  ghost:
    '!bg-transparent text-[var(--text-secondary)] border border-transparent hover:!bg-[var(--bg-subtle)] hover:text-[var(--text-primary)]',
  danger:
    'bg-[var(--danger)] text-white border border-transparent hover:opacity-90 active:opacity-95',
};

const SIZES: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-[13px] gap-1.5 rounded-[10px]',
  md: 'h-10 px-4 text-[14px] gap-2 rounded-control',
  icon: 'h-10 w-10 justify-center rounded-control',
};

const BASE =
  'inline-flex items-center justify-center font-semibold whitespace-nowrap transition-colors duration-150 disabled:pointer-events-none disabled:opacity-50 select-none';

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'primary',
    size = 'md',
    loading = false,
    leadingIcon,
    trailingIcon,
    className,
    children,
    disabled,
    type = 'button',
    ...rest
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      className={cn(BASE, VARIANTS[variant], SIZES[size], className)}
      {...rest}
    >
      {loading ? <Loader2 size={16} className="animate-spin" aria-hidden /> : leadingIcon}
      {children}
      {!loading && trailingIcon}
    </button>
  );
});