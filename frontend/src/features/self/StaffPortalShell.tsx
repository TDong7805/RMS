import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { ClipboardCheck, UserRound, Users } from 'lucide-react';
import { NotificationMenu } from '@/components/layout/NotificationMenu';
import { UserMenu } from '@/components/layout/UserMenu';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/cn';

/*
 * Cổng nhân viên /nhan-vien (27/11/2026) — tài khoản RIÊNG của thu ngân / bếp. Màn làm việc (POS, màn bếp) chỉ mở bằng
 * tài khoản màn hình chung (khu.thu.ngan, khu.bep); ở đây chỉ có việc của riêng mình: chấm công khuôn mặt, ca làm,
 * lịch sử, phiếu lương, hồ sơ. Thu ngân thêm việc văn phòng: Chấm công nhân viên (sửa tay / Excel), Bảng lương.
 * Nền sáng, dùng được trên điện thoại.
 */

export const PORTAL_PATHS = {
  home: '/nhan-vien',
  notifications: '/nhan-vien/thong-bao',
  attendance: '/nhan-vien/van-phong/cham-cong',
  payroll: '/nhan-vien/van-phong/bang-luong',
} as const;

export function StaffPortalShell({ children, wide = false }: { children: ReactNode; /** Trang văn phòng (bảng rộng). */ wide?: boolean }) {
  const { data: user } = useAuth();
  const tabs = [
    { to: PORTAL_PATHS.home, label: 'Của tôi', icon: UserRound, end: true },
    ...(user?.role === 'cashier'
      ? [
          { to: PORTAL_PATHS.attendance, label: 'Chấm công nhân viên', icon: ClipboardCheck, end: false },
          { to: PORTAL_PATHS.payroll, label: 'Bảng lương', icon: Users, end: false },
        ]
      : []),
  ];
  return (
    <div data-theme="light" className="flex min-h-dvh flex-col bg-[var(--bg-page)] text-[var(--text-primary)] [color-scheme:light]">
      <header className="sticky top-0 z-20 border-b border-[var(--border)] bg-[var(--bg-surface)]">
        <div className="flex h-14 items-center gap-2.5 px-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-[var(--accent)] text-[14px] font-extrabold text-white">NV</span>
          <span className="min-w-0 flex-1 leading-tight">
            <span className="block truncate text-[15px] font-extrabold">CỔNG NHÂN VIÊN</span>
            <span className="block truncate text-[12px] text-[var(--text-muted)]">{user ? `${user.fullName} · ${user.roleLabel}` : ''}</span>
          </span>
          <NotificationMenu allHref={PORTAL_PATHS.notifications} />
          <UserMenu />
        </div>
        {tabs.length > 1 ? (
          <nav className="no-scrollbar flex gap-1 overflow-x-auto px-3 pb-2" aria-label="Cổng nhân viên">
            {tabs.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  cn(
                    'inline-flex h-9 shrink-0 items-center gap-1.5 rounded-[10px] px-3 text-[13.5px] font-semibold',
                    isActive ? 'bg-[var(--accent-soft)] text-[var(--accent)]' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]',
                  )
                }
              >
                <Icon size={16} />
                {label}
              </NavLink>
            ))}
          </nav>
        ) : null}
      </header>
      <main className="flex-1 p-3 sm:p-4">{wide ? <div className="mx-auto max-w-[1400px]">{children}</div> : children}</main>
    </div>
  );
}
