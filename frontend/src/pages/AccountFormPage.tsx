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
import { CURRENT_USER_ID, createAccount, getAccount, updateAccount } from '@/api/accounts';
import { qk } from '@/features/management/queries';
import { useApiMutation } from '@/hooks/use-api-mutation';
import { cn } from '@/lib/cn';
import { ROLES, ROLE_KEYS } from '@/lib/labels';
import type { AccountInput, RoleKey } from '@/types';

const EMPTY: AccountInput = { username: '', fullName: '', email: '', phone: '', role: 'waiter', password: '' };

function randomPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz';
  let s = '';
  for (let i = 0; i < 6; i += 1) s += chars[Math.floor(Math.random() * chars.length)];
  return `${s}${Math.floor(Math.random() * 900 + 100)}`;
}

export function AccountFormPage() {
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
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
    success: (a) => (isEdit ? `Đã cập nhật tài khoản ${a.username}` : `Đã tạo tài khoản ${a.username} – ${ROLES[a.role].label}`),
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
    if (Object.keys(local).length) return setErrors(local);
    mutation.mutate(form);
  };

  const title = isEdit ? 'Cập nhật tài khoản' : 'Tạo tài khoản';
  const isSelf = id === CURRENT_USER_ID;
  const isAdminAccount = accountQuery.data?.role === 'admin';

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
        ) : isAdminAccount ? (
          <BlockError message="Không có quyền sửa tài khoản Quản trị viên" onRetry={() => navigate('/tai-khoan')} />
        ) : (
          <form onSubmit={submit} noValidate className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <Card padded>
              <CardHeader title="Thông tin tài khoản" />
              <div className="mt-4 grid gap-4">
                <Field label="Tên đăng nhập" htmlFor="u-username" required error={errors.username} hint="4–30 ký tự: chữ thường không dấu, số, dấu chấm, gạch dưới">
                  <TextInput id="u-username" value={form.username} autoComplete="off" invalid={Boolean(errors.username)} onChange={(e) => set('username', e.target.value.toLowerCase())} placeholder="vd: lan.nguyen" />
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
                {!isEdit ? (
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
                ) : null}
              </div>
            </Card>

            <Card padded>
              <CardHeader title="Phân vai trò" icon={<ShieldCheck size={17} />} description="Mỗi vai trò chỉ được truy cập chức năng phù hợp nhiệm vụ." />
              {errors.role ? <p className="mt-2 text-[12px] font-medium text-[var(--danger)]">{errors.role}</p> : null}
              <div role="radiogroup" aria-label="Vai trò" className="mt-4 grid gap-2">
                {ROLE_KEYS.filter((r) => r !== 'admin').map((r: RoleKey) => {
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
