import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { ChevronDown, KeyRound, LogOut, Settings } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { initialsOf, useAuth, useLogout } from '@/lib/auth';

const itemClass =
  'flex min-h-[38px] cursor-pointer select-none items-center gap-2.5 rounded-[8px] px-2.5 text-[13.5px] text-[var(--text-secondary)] outline-none transition-colors data-[highlighted]:bg-[var(--bg-subtle)] data-[highlighted]:text-[var(--text-primary)]';

/** Avatar + menu tài khoản của người đang đăng nhập (dùng ở trang quản lý và khu vực Thu ngân/Bếp/Kho). */
export function UserMenu() {
  const navigate = useNavigate();
  const { data: user } = useAuth();
  const logout = useLogout();

  const name = user?.fullName ?? 'Đang tải…';
  const role = user?.roleLabel ?? '';
  const initials = user ? initialsOf(user.fullName) : '';

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          aria-label="Mở menu tài khoản"
          className="flex shrink-0 items-center gap-2 rounded-pill border border-[var(--border)] bg-[var(--bg-surface)] py-1 pl-1 pr-1 transition-colors duration-150 hover:border-[var(--accent)] sm:pr-2.5"
        >
          <span
            className="grid h-8 w-8 place-items-center rounded-full bg-[var(--accent-soft)] font-mono text-[12.5px] font-semibold text-[var(--accent)]"
            aria-hidden
          >
            {initials}
          </span>
          <span className="hidden min-w-0 text-left sm:block">
            <span className="block max-w-[140px] truncate text-[13px] font-semibold leading-4 text-[var(--text-primary)]">
              {name}
            </span>
            <span className="block max-w-[140px] truncate text-[11px] leading-4 text-[var(--text-muted)]">
              {role}
            </span>
          </span>
          <ChevronDown
            size={14}
            strokeWidth={2}
            aria-hidden
            className="hidden shrink-0 text-[var(--text-muted)] sm:block"
          />
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          side="bottom"
          align="end"
          sideOffset={8}
          collisionPadding={12}
          className="z-[60] w-[236px] rounded-item border border-[var(--border)] bg-[var(--bg-surface)] p-1.5 shadow-overlay"
        >
          <div className="px-2.5 py-2">
            <p className="truncate text-[13.5px] font-semibold text-[var(--text-primary)]">{name}</p>
            <p className="truncate text-[12px] text-[var(--text-muted)]">{user?.email ?? ''}</p>
            <p className="mt-1 truncate text-[11.5px] text-[var(--text-muted)]">
              {user ? `@${user.username} · ${role}` : ''}
            </p>
          </div>
          <DropdownMenu.Separator className="my-1 h-px bg-[var(--border)]" />
          <DropdownMenu.Item className={itemClass} onSelect={() => navigate('/doi-mat-khau')}>
            <KeyRound size={16} strokeWidth={1.75} aria-hidden />
            Đổi mật khẩu
          </DropdownMenu.Item>
          {user?.role === 'manager' ? (
            <DropdownMenu.Item className={itemClass} onSelect={() => navigate('/cai-dat')}>
              <Settings size={16} strokeWidth={1.75} aria-hidden />
              Cài đặt
            </DropdownMenu.Item>
          ) : null}
          <DropdownMenu.Separator className="my-1 h-px bg-[var(--border)]" />
          <DropdownMenu.Item
            className="flex min-h-[38px] cursor-pointer select-none items-center gap-2.5 rounded-[8px] px-2.5 text-[13.5px] text-[var(--danger)] outline-none transition-colors data-[highlighted]:bg-[var(--danger-soft)]"
            disabled={logout.isPending}
            onSelect={(event) => {
              event.preventDefault();
              logout.mutate();
            }}
          >
            <LogOut size={16} strokeWidth={1.75} aria-hidden />
            {logout.isPending ? 'Đang đăng xuất…' : 'Đăng xuất'}
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
