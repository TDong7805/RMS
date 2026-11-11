import { forwardRef, useState, type InputHTMLAttributes, type ReactNode } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { controlClass } from '@/components/common/Form';
import { cn } from '@/lib/cn';

export interface AuthFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  id: string;
  label: string;
  icon: ReactNode;
  error?: string;
  hint?: ReactNode;
  /** Ô mật khẩu: có nút hiện/ẩn và cảnh báo Caps Lock. */
  password?: boolean;
}

/**
 * Ô nhập của trang đăng nhập/đổi mật khẩu: icon phía trước, cao 44px (dễ bấm trên máy tính bảng ở quầy/bếp),
 * dùng chung viền/màu với form trong trang quản lý (controlClass).
 */
export const AuthField = forwardRef<HTMLInputElement, AuthFieldProps>(function AuthField(
  { id, label, icon, error, hint, password = false, className, onKeyUp, ...rest },
  ref,
) {
  const [visible, setVisible] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const describedBy = error ? `${id}-error` : hint || capsLock ? `${id}-hint` : undefined;

  return (
    <div className={cn('min-w-0', className)}>
      <label htmlFor={id} className="mb-1.5 block text-[13px] font-semibold text-[var(--text-primary)]">
        {label}
      </label>
      <div className="relative">
        <span
          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
          aria-hidden
        >
          {icon}
        </span>
        <input
          ref={ref}
          id={id}
          type={password && !visible ? 'password' : 'text'}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          onKeyUp={(event) => {
            if (password) setCapsLock(event.getModifierState('CapsLock'));
            onKeyUp?.(event);
          }}
          className={cn(controlClass(Boolean(error)), 'h-11 pl-11 text-[14.5px]', password ? 'pr-11' : 'pr-3.5')}
          {...rest}
        />
        {password ? (
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            aria-label={visible ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
            aria-pressed={visible}
            className="absolute right-1.5 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-[8px] text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)]"
          >
            {visible ? <EyeOff size={17} strokeWidth={1.75} /> : <Eye size={17} strokeWidth={1.75} />}
          </button>
        ) : null}
      </div>
      {error ? (
        <p id={`${id}-error`} role="alert" className="mt-1.5 text-[12.5px] font-medium text-[var(--danger)]">
          {error}
        </p>
      ) : capsLock ? (
        <p id={`${id}-hint`} className="mt-1.5 text-[12.5px] font-medium text-[var(--warning)]">
          Caps Lock đang bật
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-1.5 text-[12.5px] text-[var(--text-muted)]">
          {hint}
        </p>
      ) : null}
    </div>
  );
});
