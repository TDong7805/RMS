import { useRef, useState, type FormEvent } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CircleAlert, Info, LockKeyhole, LogIn, UserRound } from 'lucide-react';
import { login } from '@/api/auth';
import { AuthField } from '@/components/auth/AuthField';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { Button } from '@/components/common/Button';
import { destinationAfterLogin, setSignedInUser, useAuth } from '@/lib/auth';
import { isValidationError } from '@/lib/mock';

/**
 * Đăng nhập cho nhân viên (Quản lý nhà hàng, Thu ngân, Bếp, Kho). Không có đăng ký:
 * quản lý cấp tài khoản ở trang "Tài khoản"; quên mật khẩu thì nhờ quản lý đặt lại.
 */
export default function LoginPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [params] = useSearchParams();
  const next = params.get('next');
  const { data: current } = useAuth();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');
  const [showForgot, setShowForgot] = useState(false);
  const passwordRef = useRef<HTMLInputElement>(null);

  const mutation = useMutation({
    mutationFn: login,
    onSuccess: (user) => {
      setSignedInUser(queryClient, user);
      navigate(destinationAfterLogin(user, next), { replace: true });
    },
    onError: (error) => {
      if (isValidationError(error)) {
        setFieldErrors(error.fields);
        setFormError('');
        return;
      }
      setFieldErrors({});
      setFormError(error instanceof Error ? error.message : 'Đăng nhập không thành công, vui lòng thử lại.');
      // Sai mật khẩu: xóa ô mật khẩu và đưa con trỏ về đó để nhập lại nhanh.
      setPassword('');
      passwordRef.current?.focus();
    },
  });

  // Đã đăng nhập mà mở lại trang này → về thẳng khu vực của mình.
  if (current && !mutation.isPending && !mutation.isSuccess) {
    return <Navigate to={destinationAfterLogin(current, next)} replace />;
  }

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const errors: Record<string, string> = {};
    if (!username.trim()) errors.username = 'Vui lòng nhập tên đăng nhập';
    if (!password) errors.password = 'Vui lòng nhập mật khẩu';
    setFieldErrors(errors);
    setFormError('');
    if (Object.keys(errors).length > 0) return;
    mutation.mutate({ username: username.trim(), password, remember });
  };

  const sessionExpired = Boolean(next) && !formError && !mutation.isPending;

  return (
    <AuthLayout>
      <div className="rm-animate-in">
        <h1 className="text-[28px] font-extrabold tracking-[-0.02em] text-[var(--text-primary)]">Đăng nhập</h1>
        <p className="mt-1.5 text-[14.5px] text-[var(--text-secondary)]">
          Dành cho nhân viên nhà hàng. Dùng tài khoản do quản lý cấp.
        </p>

        {sessionExpired ? (
          <div className="mt-6 flex gap-2.5 rounded-item border border-[var(--info)]/25 bg-[var(--info-soft)] px-3.5 py-3 text-[13.5px] text-[var(--text-primary)]">
            <Info size={17} className="mt-0.5 shrink-0 text-[var(--info)]" aria-hidden />
            <span>Vui lòng đăng nhập để tiếp tục. Sau khi đăng nhập bạn sẽ quay lại trang đang mở.</span>
          </div>
        ) : null}

        {formError ? (
          <div
            role="alert"
            className="mt-6 flex gap-2.5 rounded-item border border-[var(--danger)]/25 bg-[var(--danger-soft)] px-3.5 py-3 text-[13.5px] font-medium text-[var(--danger)]"
          >
            <CircleAlert size={17} className="mt-0.5 shrink-0" aria-hidden />
            <span>{formError}</span>
          </div>
        ) : null}

        <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-4">
          <AuthField
            id="username"
            label="Tên đăng nhập"
            icon={<UserRound size={18} strokeWidth={1.75} />}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            error={fieldErrors.username}
            placeholder="vd. linh.tran"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            autoFocus
          />
          <AuthField
            ref={passwordRef}
            id="password"
            label="Mật khẩu"
            password
            icon={<LockKeyhole size={18} strokeWidth={1.75} />}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={fieldErrors.password}
            placeholder="Nhập mật khẩu"
            autoComplete="current-password"
          />

          <div className="flex items-center justify-between gap-3">
            <label className="flex cursor-pointer select-none items-center gap-2 text-[13.5px] text-[var(--text-secondary)]">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="h-4 w-4 cursor-pointer rounded accent-[var(--accent)]"
              />
              Ghi nhớ đăng nhập
            </label>
            <button
              type="button"
              onClick={() => setShowForgot((v) => !v)}
              aria-expanded={showForgot}
              className="text-[13.5px] font-semibold text-[var(--accent)] hover:underline"
            >
              Quên mật khẩu?
            </button>
          </div>

          {showForgot ? (
            <div className="rm-animate-in rounded-item border border-[var(--border)] bg-[var(--bg-subtle)] px-3.5 py-3 text-[13px] leading-6 text-[var(--text-secondary)]">
              Hệ thống không tự đặt lại mật khẩu. Hãy liên hệ <b className="text-[var(--text-primary)]">Quản lý nhà hàng</b>{' '}
              để được cấp mật khẩu mới — bạn sẽ đổi lại mật khẩu của riêng mình ở lần đăng nhập kế tiếp.
            </div>
          ) : null}

          <Button
            type="submit"
            loading={mutation.isPending}
            leadingIcon={<LogIn size={17} strokeWidth={2} aria-hidden />}
            className="h-11 w-full text-[15px]"
          >
            {mutation.isPending ? 'Đang đăng nhập…' : 'Đăng nhập'}
          </Button>
        </form>

        <p className="mt-6 text-center text-[13px] text-[var(--text-muted)]">
          Chưa có tài khoản? Liên hệ quản lý nhà hàng để được cấp.
        </p>
      </div>
    </AuthLayout>
  );
}
