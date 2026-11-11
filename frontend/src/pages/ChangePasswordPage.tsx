import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, CircleAlert, KeyRound, LockKeyhole, LogOut, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { changePassword } from '@/api/auth';
import { AuthField } from '@/components/auth/AuthField';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { Button } from '@/components/common/Button';
import { AUTH_KEY, useAuth, useLogout } from '@/lib/auth';
import { isValidationError } from '@/lib/mock';

const RULE = 'Từ 8 đến 64 ký tự, gồm cả chữ và số.';

/** Kiểm tra giống backend (Rules.passwordError) để báo lỗi ngay, backend vẫn kiểm tra lại. */
function validate(current: string, next: string, confirm: string): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!current) errors.currentPassword = 'Vui lòng nhập mật khẩu hiện tại';
  if (!next) errors.newPassword = 'Vui lòng nhập mật khẩu mới';
  else if (next.length < 8 || next.length > 64 || !/\p{L}/u.test(next) || !/\d/.test(next))
    errors.newPassword = 'Mật khẩu từ 8 đến 64 ký tự, gồm cả chữ và số';
  else if (next === current) errors.newPassword = 'Mật khẩu mới phải khác mật khẩu hiện tại';
  if (!confirm) errors.confirmPassword = 'Vui lòng nhập lại mật khẩu mới';
  else if (confirm !== next) errors.confirmPassword = 'Mật khẩu nhập lại không khớp';
  return errors;
}

/**
 * Đổi mật khẩu. Bắt buộc khi tài khoản mới được cấp hoặc vừa được quản lý đặt lại mật khẩu
 * (mustChangePassword) — khi đó chưa vào được trang nào khác. Ngoài ra người dùng tự mở từ menu tài khoản.
 */
export default function ChangePasswordPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: user } = useAuth();
  const logout = useLogout();
  const forced = Boolean(user?.mustChangePassword);

  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');

  const mutation = useMutation({
    mutationFn: changePassword,
    onSuccess: (updated) => {
      queryClient.setQueryData(AUTH_KEY, updated);
      toast.success('Đã đổi mật khẩu.');
      navigate(updated.home, { replace: true });
    },
    onError: (error) => {
      if (isValidationError(error)) {
        setFieldErrors(error.fields);
        setFormError('');
      } else {
        setFormError(error instanceof Error ? error.message : 'Không đổi được mật khẩu, vui lòng thử lại.');
      }
    },
  });

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const errors = validate(current, next, confirm);
    setFieldErrors(errors);
    setFormError('');
    if (Object.keys(errors).length === 0) {
      mutation.mutate({ currentPassword: current, newPassword: next, confirmPassword: confirm });
    }
  };

  return (
    <AuthLayout>
      <div className="rm-animate-in">
        <span className="grid h-12 w-12 place-items-center rounded-item bg-[var(--accent-soft)] text-[var(--accent)]">
          <KeyRound size={22} strokeWidth={1.75} aria-hidden />
        </span>
        <h1 className="mt-4 text-[26px] font-extrabold tracking-[-0.02em] text-[var(--text-primary)]">Đổi mật khẩu</h1>
        <p className="mt-1.5 text-[14.5px] text-[var(--text-secondary)]">
          {user ? (
            <>
              Tài khoản <b className="text-[var(--text-primary)]">{user.username}</b> · {user.roleLabel}
            </>
          ) : null}
        </p>

        {forced ? (
          <div className="mt-5 flex gap-2.5 rounded-item border border-[var(--warning)]/30 bg-[var(--warning-soft)] px-3.5 py-3 text-[13.5px] text-[var(--text-primary)]">
            <ShieldCheck size={17} className="mt-0.5 shrink-0 text-[var(--warning)]" aria-hidden />
            <span>
              Đây là mật khẩu do quản lý cấp. Hãy đặt mật khẩu của riêng bạn trước khi bắt đầu sử dụng hệ thống.
            </span>
          </div>
        ) : null}

        {formError ? (
          <div
            role="alert"
            className="mt-5 flex gap-2.5 rounded-item border border-[var(--danger)]/25 bg-[var(--danger-soft)] px-3.5 py-3 text-[13.5px] font-medium text-[var(--danger)]"
          >
            <CircleAlert size={17} className="mt-0.5 shrink-0" aria-hidden />
            <span>{formError}</span>
          </div>
        ) : null}

        <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-4">
          {/* Ô ẩn giúp trình quản lý mật khẩu của trình duyệt biết đang đổi mật khẩu cho tài khoản nào. */}
          <input type="text" name="username" autoComplete="username" value={user?.username ?? ''} readOnly hidden />
          <AuthField
            id="currentPassword"
            label={forced ? 'Mật khẩu được cấp' : 'Mật khẩu hiện tại'}
            password
            icon={<LockKeyhole size={18} strokeWidth={1.75} />}
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            error={fieldErrors.currentPassword}
            autoComplete="current-password"
            autoFocus
          />
          <AuthField
            id="newPassword"
            label="Mật khẩu mới"
            password
            icon={<KeyRound size={18} strokeWidth={1.75} />}
            value={next}
            onChange={(e) => setNext(e.target.value)}
            error={fieldErrors.newPassword}
            hint={RULE}
            autoComplete="new-password"
          />
          <AuthField
            id="confirmPassword"
            label="Nhập lại mật khẩu mới"
            password
            icon={<KeyRound size={18} strokeWidth={1.75} />}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            error={fieldErrors.confirmPassword}
            autoComplete="new-password"
          />

          <Button type="submit" loading={mutation.isPending} className="h-11 w-full text-[15px]">
            {mutation.isPending ? 'Đang lưu…' : 'Đổi mật khẩu'}
          </Button>
        </form>

        <div className="mt-4 flex justify-center">
          {forced ? (
            <Button
              variant="ghost"
              leadingIcon={<LogOut size={16} aria-hidden />}
              loading={logout.isPending}
              onClick={() => logout.mutate()}
            >
              Đăng xuất
            </Button>
          ) : (
            <Button
              variant="ghost"
              leadingIcon={<ArrowLeft size={16} aria-hidden />}
              onClick={() => (window.history.length > 1 ? navigate(-1) : navigate(user?.home ?? '/'))}
            >
              Quay lại
            </Button>
          )}
        </div>
      </div>
    </AuthLayout>
  );
}
