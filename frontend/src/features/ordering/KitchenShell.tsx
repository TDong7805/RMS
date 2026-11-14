import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { BookOpen, ChefHat, ClipboardList, LogOut, PackageSearch, X } from 'lucide-react';
import { useAuth, useLogout } from '@/lib/auth';
import { cn } from '@/lib/cn';

/* Khung các trang phụ của Bếp (kiểm tra nguyên liệu, công thức): cùng nền tối với màn hình bếp, không dùng khung trang quản lý. */

const TABS = [
  { to: '/bep', label: 'Hàng chờ', icon: ClipboardList, end: true },
  { to: '/bep/nguyen-lieu', label: 'Kiểm tra nguyên liệu', icon: PackageSearch, end: false },
  { to: '/bep/cong-thuc', label: 'Công thức', icon: BookOpen, end: false },
];

export function KitchenShell({ children, actions }: { children: ReactNode; actions?: ReactNode }) {
  const { data: user } = useAuth();
  const logout = useLogout();
  return (
    <div className="flex min-h-dvh flex-col bg-[#0d1210] text-[#e9efec] [color-scheme:dark]">
      <header className="sticky top-0 z-20 flex flex-wrap items-center gap-3 border-b border-white/10 bg-[#121916] px-4 py-2.5">
        <div className="flex items-center gap-2">
          <ChefHat size={26} className="text-[#34d399]" />
          <span className="text-[20px] font-extrabold tracking-wide">BẾP</span>
        </div>
        <KitchenNav />
        <div className="ml-auto flex items-center gap-2">
          {actions}
          <span className="hidden text-[13px] text-white/60 md:inline">{user?.fullName}</span>
          <button type="button" aria-label="Đăng xuất" title="Đăng xuất" onClick={() => logout.mutate()} className="grid h-9 w-9 place-items-center rounded-lg bg-white/10 hover:bg-white/15">
            <LogOut size={16} />
          </button>
        </div>
      </header>
      <main className="flex-1 p-4">{children}</main>
    </div>
  );
}

export function KitchenNav() {
  return (
    <nav className="flex gap-1 rounded-lg bg-white/5 p-0.5 text-[14px] font-semibold" aria-label="Trang của bếp">
      {TABS.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) => cn('inline-flex items-center gap-1.5 rounded-md px-3 py-1.5', isActive ? 'bg-white text-[#0d1210]' : 'text-white/75 hover:bg-white/10')}
        >
          <Icon size={15} />
          {label}
        </NavLink>
      ))}
    </nav>
  );
}

/* ---------------------------------------------------------------- Ô nhập / nút / hộp thoại kiểu nền tối */

export const kInput = 'rounded-lg border border-white/15 bg-[#1a2420] px-3 py-1.5 text-[14px] text-[#e9efec] outline-none placeholder:text-white/35 focus:border-[#34d399]';
export const kBtn = 'inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-[14px] font-semibold disabled:opacity-50';
export const kBtnPrimary = `${kBtn} bg-[#10b981] text-[#06231a] hover:bg-[#34d399]`;
export const kBtnGhost = `${kBtn} bg-white/10 hover:bg-white/15`;

export function KitchenDialog({ title, onClose, children, footer }: { title: string; onClose: () => void; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-label={title}>
      <div className="w-full max-w-[440px] rounded-xl border border-white/10 bg-[#151d1a] shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <p className="text-[16px] font-bold">{title}</p>
          <button type="button" aria-label="Đóng" onClick={onClose} className="grid h-8 w-8 place-items-center rounded-lg bg-white/10"><X size={15} /></button>
        </div>
        <div className="px-4 py-3 text-[14px] text-white/80">{children}</div>
        {footer ? <div className="flex justify-end gap-2 border-t border-white/10 px-4 py-3">{footer}</div> : null}
      </div>
    </div>
  );
}
