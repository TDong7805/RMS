import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Eye, EyeOff, RefreshCw, Save, ShieldCheck } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { AppShell } from '@/components/layout/AppShell';
import { Card, CardHeader } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { BlockError } from '@/components/common/EmptyState';
import { Field, TextInput } from '@/components/common/Form';
import { PageHeader } from '@/components/common/PageParts';
import { Skeleton } from '@/components/common/Skeleton';
import { canLogin, createAccount, getAccount, updateAccount } from '@/api/accounts';
import { qk } from '@/features/management/queries';
import { useApiMutation } from '@/hooks/use-api-mutation';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/cn';
import { ROLES, ROLE_KEYS } from '@/lib/labels';
import type { AccountInput, RoleKey } from '@/types';

// Vai trò để trống: bắt quản lý chọn rõ ràng (UC "Phân vai trò" là bắt buộc).
const EMPTY: AccountInput = { username: '', fullName: '', email: '', phone: '', role: '', password: '' };

/** 8 chữ + 2 số, bỏ ký tự dễ nhầm (0/O, 1/l/I); dùng crypto thay Math.random để khó đoán. */
function randomPassword(): string {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz';
  const digits = '23456789';
  const pick = (set: string) => set[crypto.getRandomValues(new Uint32Array(1))[0] % set.length];
  const chars = [...Array.from({ length: 8 }, () => pick(letters)), pick(digits), pick(digits)];
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = crypto.getRandomValues(new Uint32Array(1))[0] % (i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

export function AccountFormPage() {
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const { data: me } = useAuth();
  const [form, setForm] = useState<AccountInput>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showPw, setShowPw] = useState(false);

  const accountQuery = useQuery({ queryKey: [...qk.accounts, 'detail', id], queryFn: () => getAccount(id!), enabled: isEdit, retry: false });

  useEffect(() => {
    setErrors({});
    if (!id) setForm({ ...EMPTY, password: randomPassword() });
  }, [id]);

  useEffect(() => {
    const a = accountQuery.data;
    if (a && a.id === id) setForm({ username: a.username, fullName: a.fullName, email: a.email, phone: a.phone, role: a.role });
  }, [accountQuery.data, id]);

  const mutation = useApiMutation((input: AccountInput) => (id ? updateAccount(id, input) : createAccount(input)), {
    invalidate: [qk.accounts, qk.employees],
    success: (a) =>
      isEdit
        ? `Đã cập nhật tài khoản ${a.username}`
        : canLogin(a.role)
          ? `Đã tạo tài khoản ${a.username} – ${ROLES[a.role].label}. Gửi tên đăng nhập và mật khẩu khởi tạo cho nhân viên.`
          : `Đã thêm nhân viên phục vụ ${a.fullName}`,
    onFieldErrors: setErrors,
    onSuccess: () => navigate('/tai-khoan'),
  });

  const set = <K extends keyof AccountInput>(key: K, value: AccountInput[K]) => {
    setForm((p) => ({ ...p, [key]: value }));
    setErrors((p) => ({ ...p, [key]: '' }));
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const local: Record<string, string> = {};
    if (!form.username.trim()) local.username = 'Vui lòng nhập tên đăng nhập';
    if (!form.fullName.trim()) local.fullName = 'Vui lòng nhập họ tên';
    if (!form.email.trim()) local.email = 'Vui lòng nhập email';
    if (!form.role) local.role = 'Vui lòng phân vai trò cho tài khoản';
    if (Object.keys(local).length) return setErrors(local);
    // Phục vụ không đăng nhập: không gửi mật khẩu.
    mutation.mutate(needsPassword ? form : { ...form, password: '' });
  };

  const title = isEdit ? 'Cập nhật tài khoản' : 'Tạo tài khoản';
  const isSelf = Boolean(id) && id === me?.id;
  const needsPassword = !isEdit && (form.role === '' || canLogin(form.role));
  const originalRole = accountQuery.data?.role;
  // Phục vụ → vai trò đăng nhập được: tài khoản chưa có mật khẩu dùng được, cần "Đặt lại mật khẩu" sau khi lưu.
  const becomesLoginRole = isEdit && originalRole === 'waiter' && form.role !== '' && canLogin(form.role);

  return (
    <AppShell meta={{ label: isEdit ? 'Cập nhật tài khoản' : 'Thêm tài khoản', parent: 'Quản lý tài khoản' }}>
      <div className="min-w-0 space-y-4">
        <PageHeader
          title={title}
          description={isEdit ? 'Cập nhật thông tin cơ bản và vai trò của tài khoản.' : 'Cấp tài khoản mới cho nhân viên và phân vai trò truy cập.'}
          actions={<Button variant="ghost" size="sm" leadingIcon={<ArrowLeft size={15} />} onClick={() => navigate('/tai-khoan')}>Về danh sách</Button>}
        />

        {isEdit && accountQuery.isError ? (
          <BlockError message="Tài khoản không tồn tại hoặc đã bị xóa" onRetry={() => void accountQuery.refetch()} />
        ) : isEdit && accountQuery.isLoading ? (
          <Card padded><div className="grid gap-4 sm:grid-cols-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16" />)}</div></Card>
        ) : (
          <form onSubmit={submit} noValidate className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <Card padded>
              <CardHeader title="Thông tin tài khoản" />
              <div className="mt-4 grid gap-4">
                <Field
                  label="Tên đăng nhập"
                  htmlFor="u-username"
                  required
                  error={errors.username}
                  hint={isSelf ? 'Không thể tự đổi tên đăng nhập của chính mình' : '4–30 ký tự: chữ thường không dấu, số, dấu chấm, gạch dưới'}
                >
                  <TextInput id="u-username" value={form.username} autoComplete="off" disabled={isSelf} invalid={Boolean(errors.username)} onChange={(e) => set('username', e.target.value.toLowerCase())} placeholder="vd: lan.nguyen" />
                </Field>
                <Field label="Họ tên" htmlFor="u-name" required error={errors.fullName}>
                  <TextInput id="u-name" value={form.fullName} invalid={Boolean(errors.fullName)} onChange={(e) => set('fullName', e.target.value)} />
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Email" htmlFor="u-email" required error={errors.email}>
                    <TextInput id="u-email" type="email" value={form.email} invalid={Boolean(errors.email)} onChange={(e) => set('email', e.target.value)} />
                  </Field>
                  <Field label="Số điện thoại" htmlFor="u-phone" error={errors.phone}>
                    <TextInput id="u-phone" inputMode="tel" value={form.phone} invalid={Boolean(errors.phone)} onChange={(e) => set('phone', e.target.value)} />
                  </Field>
                </div>
                {needsPassword ? (
                  <Field label="Mật khẩu khởi tạo" htmlFor="u-pw" required error={errors.password} hint="Người dùng sẽ được yêu cầu đổi mật khẩu khi đăng nhập lần đầu">
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <TextInput id="u-pw" type={showPw ? 'text' : 'password'} value={form.password ?? ''} autoComplete="new-password" invalid={Boolean(errors.password)} onChange={(e) => set('password', e.target.value)} className="pr-10 font-mono" />
                        <button type="button" onClick={() => setShowPw((v) => !v)} aria-label={showPw ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'} className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full text-[var(--text-muted)] hover:text-[var(--text-primary)]">
                          {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                        </button>
                      </div>
                      <Button variant="outline" leadingIcon={<RefreshCw size={14} />} onClick={() => { set('password', randomPassword()); setShowPw(true); }}>
                        Tạo ngẫu nhiên
                      </Button>
                    </div>
                  </Field>
                ) : !isEdit ? (
                  <p className="rounded-item bg-[var(--bg-subtle)] px-3.5 py-2.5 text-[13px] text-[var(--text-secondary)]">
                    Nhân viên phục vụ không đăng nhập hệ thống nên không cần mật khẩu. Tài khoản này dùng để xếp ca và tính lương.
                  </p>
                ) : null}
              </div>
            </Card>

            <Card padded>
              <CardHeader title="Phân vai trò" icon={<ShieldCheck size={17} />} description="Mỗi vai trò chỉ được truy cập chức năng phù hợp nhiệm vụ." />
              {errors.role ? <p className="mt-2 text-[12px] font-medium text-[var(--danger)]">{errors.role}</p> : null}
              <div role="radiogroup" aria-label="Vai trò" className="mt-4 grid gap-2">
                {ROLE_KEYS.map((r: RoleKey) => {
                  const selected = form.role === r;
                  return (
                    <button
                      key={r}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      disabled={isSelf && !selected}
                      onClick={() => set('role', r)}
                      className={cn(
                        'flex items-start gap-3 rounded-item border px-4 py-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-45',
                        selected ? 'border-[var(--accent)] bg-[var(--accent-soft)]' : 'border-[var(--border)] hover:border-[var(--accent)]/60',
                      )}
                    >
                      <span className={cn('mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full border-2', selected ? 'border-[var(--accent)]' : 'border-[var(--border-strong)]')}>
                        {selected ? <span className="h-2 w-2 rounded-full bg-[var(--accent)]" /> : null}
                      </span>
                      <span>
                        <span className="block text-[14px] font-semibold">{ROLES[r].label}</span>
                        <span className="block text-[12.5px] text-[var(--text-muted)]">{ROLES[r].description}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
              {isSelf ? <p className="mt-2 text-[12px] text-[var(--text-muted)]">Bạn không thể tự thay đổi vai trò của chính mình.</p> : null}
              {becomesLoginRole ? (
                <p className="mt-2 rounded-item bg-[var(--warning-soft)] px-3 py-2 text-[12.5px] text-[var(--text-primary)]">
                  Nhân viên phục vụ chưa có mật khẩu đăng nhập. Sau khi lưu, chọn <b>Đặt lại mật khẩu</b> ở danh sách để cấp mật khẩu.
                </p>
              ) : null}
              <div className="mt-5 flex justify-end gap-2">
                <Button variant="ghost" onClick={() => navigate('/tai-khoan')} disabled={mutation.isPending}>Hủy</Button>
                <Button type="submit" loading={mutation.isPending} leadingIcon={<Save size={15} />}>{isEdit ? 'Lưu thay đổi' : 'Tạo tài khoản'}</Button>
              </div>
            </Card>
          </form>
        )}
      </div>
    </AppShell>
  );
}

export default AccountFormPage;
