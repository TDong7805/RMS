import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as Dropdown from '@radix-ui/react-dropdown-menu';
import { Copy, KeyRound, Lock, LockOpen, MoreHorizontal, Pencil, Plus, Trash2, UserRound } from 'lucide-react';
import { toast } from 'sonner';
import { AppShell } from '@/components/layout/AppShell';
import { Card } from '@/components/common/Card';
import { Badge } from '@/components/common/Badge';
import { Button } from '@/components/common/Button';
import { BlockError, EmptyState } from '@/components/common/EmptyState';
import { SearchInput, SelectInput } from '@/components/common/Form';
import { ConfirmDialog, Modal } from '@/components/common/Modal';
import { DataTable, PageHeader, Pagination, TableSkeleton, Td, Th, Toolbar } from '@/components/common/PageParts';
import {
  ACCOUNT_PAGE_SIZE,
  CURRENT_USER_ID,
  deleteAccount,
  resetAccountPassword,
  setAccountLocked,
} from '@/api/accounts';
import { qk, useAccounts } from '@/features/management/queries';
import { useApiMutation } from '@/hooks/use-api-mutation';
import { useDebounced } from '@/hooks/use-debounced';
import { cn } from '@/lib/cn';
import { formatRelativeTime } from '@/lib/format';
import { ACCOUNT_STATUS, ROLES, ROLE_KEYS, formatDateOnly } from '@/lib/labels';
import type { Account, AccountStatus, RoleKey } from '@/types';

type Pending = { kind: 'lock' | 'unlock' | 'reset' | 'delete'; account: Account } | null;

export function AccountsPage() {
  const navigate = useNavigate();
  const [keyword, setKeyword] = useState('');
  const [role, setRole] = useState<RoleKey | 'all'>('all');
  const [status, setStatus] = useState<AccountStatus | 'all'>('all');
  const [page, setPage] = useState(1);
  const debounced = useDebounced(keyword);
  const [pending, setPending] = useState<Pending>(null);
  const [tempPassword, setTempPassword] = useState<{ account: Account; password: string } | null>(null);

  const list = useAccounts({ keyword: debounced, role, status, page });
  useEffect(() => setPage(1), [debounced, role, status]);

  const lockMutation = useApiMutation((v: { id: string; locked: boolean }) => setAccountLocked(v.id, v.locked), {
    invalidate: [qk.accounts, qk.employees],
    success: (a) => (a.status === 'locked' ? `Đã khóa tài khoản ${a.username}` : `Đã mở khóa tài khoản ${a.username}`),
    onSuccess: () => setPending(null),
  });
  const resetMutation = useApiMutation((a: Account) => resetAccountPassword(a.id), {
    onSuccess: (password, account) => {
      setPending(null);
      setTempPassword({ account, password });
    },
  });
  const deleteMutation = useApiMutation((a: Account) => deleteAccount(a.id), {
    invalidate: [qk.accounts, qk.employees],
    success: (_r, a) => `Đã xóa tài khoản ${a.username}`,
    onSuccess: () => setPending(null),
  });

  const confirmPending = () => {
    if (!pending) return;
    const { kind, account } = pending;
    if (kind === 'lock' || kind === 'unlock') lockMutation.mutate({ id: account.id, locked: kind === 'lock' });
    if (kind === 'reset') resetMutation.mutate(account);
    if (kind === 'delete') deleteMutation.mutate(account);
  };

  const CONFIRM_TEXT = {
    lock: { title: 'Khóa tài khoản?', body: 'Người dùng sẽ bị đăng xuất và không thể đăng nhập cho đến khi được mở khóa.', label: 'Khóa', tone: 'danger' as const },
    unlock: { title: 'Mở khóa tài khoản?', body: 'Người dùng có thể đăng nhập lại với mật khẩu hiện tại.', label: 'Mở khóa', tone: 'primary' as const },
    reset: { title: 'Đặt lại mật khẩu?', body: 'Hệ thống tạo mật khẩu tạm mới; người dùng phải đổi mật khẩu ở lần đăng nhập kế tiếp.', label: 'Đặt lại', tone: 'primary' as const },
    delete: { title: 'Xóa tài khoản?', body: 'Tài khoản sẽ bị xóa khỏi hệ thống. Lịch sử thao tác trong nhật ký vẫn được giữ lại.', label: 'Xóa tài khoản', tone: 'danger' as const },
  };
  const text = pending ? CONFIRM_TEXT[pending.kind] : null;
  const hasFilter = Boolean(keyword || role !== 'all' || status !== 'all');

  return (
    <AppShell meta={{ label: 'Danh sách tài khoản', parent: 'Quản lý tài khoản' }}>
      <div className="min-w-0 space-y-4">
        <PageHeader
          title="Danh sách tài khoản"
          description="Quản lý tài khoản nhân viên, phân vai trò và quyền truy cập hệ thống."
          actions={
            <Button size="sm" leadingIcon={<Plus size={15} />} onClick={() => navigate('/tai-khoan/them')}>
              Tạo tài khoản
            </Button>
          }
        />

        <Card className="overflow-hidden">
          <Toolbar>
            <SearchInput value={keyword} onChange={setKeyword} placeholder="Tìm tên đăng nhập, họ tên, email, SĐT…" className="w-full sm:w-[320px]" />
            <SelectInput
              aria-label="Lọc theo vai trò"
              value={role === 'all' ? '' : role}
              onChange={(e) => setRole((e.target.value || 'all') as RoleKey | 'all')}
              placeholder="Mọi vai trò"
              options={ROLE_KEYS.map((r) => ({ value: r, label: ROLES[r].label }))}
              className="w-full sm:w-[190px]"
            />
            <SelectInput
              aria-label="Lọc theo trạng thái"
              value={status === 'all' ? '' : status}
              onChange={(e) => setStatus((e.target.value || 'all') as AccountStatus | 'all')}
              placeholder="Mọi trạng thái"
              options={[{ value: 'active', label: 'Hoạt động' }, { value: 'locked', label: 'Đã khóa' }]}
              className="w-full sm:w-[160px]"
            />
          </Toolbar>

          {list.isError ? (
            <div className="p-5"><BlockError onRetry={() => void list.refetch()} retrying={list.isFetching} /></div>
          ) : list.isLoading || !list.data ? (
            <TableSkeleton cols={6} />
          ) : list.data.items.length === 0 ? (
            <div className="p-5">
              <EmptyState icon={UserRound} title="Không tìm thấy tài khoản" description={hasFilter ? 'Thử từ khóa hoặc bộ lọc khác.' : 'Chưa có tài khoản nào.'} />
            </div>
          ) : (
            <div className={list.isFetching ? 'opacity-60 transition-opacity' : ''}>
              <DataTable minWidth={900}>
                <thead>
                  <tr>
                    <Th>Tài khoản</Th>
                    <Th>Liên hệ</Th>
                    <Th>Vai trò</Th>
                    <Th>Trạng thái</Th>
                    <Th>Đăng nhập gần nhất</Th>
                    <Th>Ngày tạo</Th>
                    <Th className="text-right">Thao tác</Th>
                  </tr>
                </thead>
                <tbody>
                  {list.data.items.map((a) => {
                    const self = a.id === CURRENT_USER_ID;
                    const protectedAcc = self || a.role === 'admin';
                    return (
                      <tr key={a.id} className="hover:bg-[var(--bg-subtle)]">
                        <Td>
                          <div className="flex items-center gap-2.5">
                            <span className={cn('grid h-9 w-9 shrink-0 place-items-center rounded-full font-mono text-[12px] font-bold', a.status === 'locked' ? 'bg-[var(--bg-subtle)] text-[var(--text-muted)]' : 'bg-[var(--accent-soft)] text-[var(--accent)]')}>
                              {a.fullName.split(' ').slice(-2).map((w) => w[0]).join('')}
                            </span>
                            <div className="min-w-0">
                              <p className="font-semibold">
                                {a.fullName}
                                {self ? <span className="ml-1.5 text-[11px] font-medium text-[var(--accent)]">(bạn)</span> : null}
                              </p>
                              <p className="font-mono text-[12px] text-[var(--text-muted)]">@{a.username}</p>
                            </div>
                          </div>
                        </Td>
                        <Td>
                          <p className="text-[13px]">{a.email}</p>
                          <p className="font-mono text-[12px] text-[var(--text-muted)]">{a.phone || '—'}</p>
                        </Td>
                        <Td>{ROLES[a.role].label}</Td>
                        <Td><Badge variant={ACCOUNT_STATUS[a.status].variant}>{ACCOUNT_STATUS[a.status].label}</Badge></Td>
                        <Td className="font-mono text-[12.5px] text-[var(--text-secondary)]">{a.lastLoginAt ? formatRelativeTime(a.lastLoginAt) : 'Chưa đăng nhập'}</Td>
                        <Td className="font-mono text-[12.5px] text-[var(--text-secondary)]">{formatDateOnly(a.createdAt)}</Td>
                        <Td className="text-right">
                          <Dropdown.Root>
                            <Dropdown.Trigger asChild>
                              <Button size="sm" variant="ghost" aria-label={`Thao tác với ${a.username}`}>
                                <MoreHorizontal size={16} />
                              </Button>
                            </Dropdown.Trigger>
                            <Dropdown.Portal>
                              <Dropdown.Content align="end" sideOffset={4} className="z-[80] min-w-[200px] rounded-item border border-[var(--border)] bg-[var(--bg-surface)] p-1.5 shadow-overlay">
                                <MenuItem icon={<Pencil size={14} />} disabled={a.role === 'admin'} onSelect={() => navigate(`/tai-khoan/${a.id}/sua`)}>
                                  Sửa thông tin
                                </MenuItem>
                                {a.status === 'active' ? (
                                  <MenuItem icon={<Lock size={14} />} disabled={protectedAcc} onSelect={() => setPending({ kind: 'lock', account: a })}>Khóa tài khoản</MenuItem>
                                ) : (
                                  <MenuItem icon={<LockOpen size={14} />} disabled={protectedAcc} onSelect={() => setPending({ kind: 'unlock', account: a })}>Mở khóa tài khoản</MenuItem>
                                )}
                                <MenuItem icon={<KeyRound size={14} />} disabled={protectedAcc} onSelect={() => setPending({ kind: 'reset', account: a })}>Đặt lại mật khẩu</MenuItem>
                                <Dropdown.Separator className="my-1 h-px bg-[var(--border)]" />
                                <MenuItem icon={<Trash2 size={14} />} danger disabled={protectedAcc} onSelect={() => setPending({ kind: 'delete', account: a })}>Xóa tài khoản</MenuItem>
                                {protectedAcc ? (
                                  <p className="px-2.5 pb-1 pt-1.5 text-[11px] leading-4 text-[var(--text-muted)]">
                                    {self ? 'Không thể thao tác trên tài khoản đang đăng nhập.' : 'Tài khoản Quản trị viên do Quản trị viên quản lý.'}
                                  </p>
                                ) : null}
                              </Dropdown.Content>
                            </Dropdown.Portal>
                          </Dropdown.Root>
                        </Td>
                      </tr>
                    );
                  })}
                </tbody>
              </DataTable>
              <Pagination page={list.data.page} pageCount={list.data.pageCount} total={list.data.total} pageSize={ACCOUNT_PAGE_SIZE} onChange={setPage} unit="tài khoản" />
            </div>
          )}
        </Card>
      </div>

      <ConfirmDialog
        open={Boolean(pending)}
        onOpenChange={(o) => !o && setPending(null)}
        title={text?.title ?? ''}
        tone={text?.tone}
        description={
          pending ? (
            <>
              <p className="font-semibold text-[var(--text-primary)]">{pending.account.fullName} (@{pending.account.username})</p>
              <p className="mt-1">{text?.body}</p>
            </>
          ) : null
        }
        confirmLabel={text?.label}
        loading={lockMutation.isPending || resetMutation.isPending || deleteMutation.isPending}
        onConfirm={confirmPending}
      />

      <Modal
        open={Boolean(tempPassword)}
        onOpenChange={(o) => !o && setTempPassword(null)}
        size="sm"
        title="Mật khẩu tạm đã được tạo"
        description={tempPassword ? `Gửi mật khẩu này cho ${tempPassword.account.fullName}. Mật khẩu chỉ hiển thị một lần.` : undefined}
        footer={<Button onClick={() => setTempPassword(null)}>Đã lưu lại</Button>}
      >
        <div className="flex items-center gap-2 rounded-item border border-[var(--border)] bg-[var(--bg-subtle)] px-4 py-3">
          <code className="flex-1 font-mono text-[18px] font-bold tracking-wider text-[var(--accent)]">{tempPassword?.password}</code>
          <Button
            size="sm"
            variant="outline"
            leadingIcon={<Copy size={14} />}
            onClick={() => {
              void navigator.clipboard?.writeText(tempPassword?.password ?? '');
              toast.success('Đã sao chép mật khẩu');
            }}
          >
            Sao chép
          </Button>
        </div>
      </Modal>
    </AppShell>
  );
}

function MenuItem({
  icon,
  children,
  onSelect,
  disabled,
  danger,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
  onSelect: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <Dropdown.Item
      disabled={disabled}
      onSelect={onSelect}
      className={cn(
        'flex cursor-pointer items-center gap-2 rounded-[9px] px-2.5 py-2 text-[13.5px] outline-none data-[disabled]:cursor-not-allowed data-[disabled]:opacity-40 data-[highlighted]:bg-[var(--bg-subtle)]',
        danger ? 'text-[var(--danger)]' : 'text-[var(--text-primary)]',
      )}
    >
      {icon}
      {children}
    </Dropdown.Item>
  );
}

export default AccountsPage;
