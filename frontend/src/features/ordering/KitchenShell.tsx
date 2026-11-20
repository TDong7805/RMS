import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { BookOpen, ChefHat, ClipboardList, LogOut, PackageSearch, ScanFace, X } from 'lucide-react';
import { useAuth, useLogout } from '@/lib/auth';
import { cn } from '@/lib/cn';
import { useKdsSettings } from './kdsSettings';
import './kds-theme.css';

/* Khung các trang phụ của Bếp (kiểm tra nguyên liệu, công thức): cùng bộ màu với màn hình bếp (sáng / tối theo cài đặt của máy). */

const TABS = [
  { to: '/bep', label: 'Hàng chờ', icon: ClipboardList, end: true },
  { to: '/bep/nguyen-lieu', label: 'Kiểm tra nguyên liệu', icon: PackageSearch, end: false },
  { to: '/bep/cong-thuc', label: 'Công thức', icon: BookOpen, end: false },
  { to: '/bep/toi', label: 'Chấm công', icon: ScanFace, end: false },
];

export function KitchenShell({ children, actions }: { children: ReactNode; actions?: ReactNode }) {
  const { data: user } = useAuth();
  const logout = useLogout();
  const [settings] = useKdsSettings();
  return (
    <div className="kds flex min-h-dvh flex-col" data-kds-mode={settings.mode}>
      <header className="sticky top-0 z-20 flex flex-wrap items-center gap-3 border-b border-[var(--k-line)] bg-[var(--k-header)] px-4 py-2.5">
        <KitchenBrand />
        <KitchenNav />
        <div className="ml-auto flex items-center gap-2">
          {actions}
          <span className="hidden text-[13px] text-[var(--k-muted)] md:inline">{user?.fullName}</span>
          <button type="button" aria-label="Đăng xuất" title="Đăng xuất" onClick={() => logout.mutate()} className={kIconBtn}>
            <LogOut size={16} />
          </button>
        </div>
      </header>
      <main className="flex-1 p-4">{children}</main>
    </div>
  );
}

export function KitchenBrand({ children }: { children?: ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="grid h-9 w-9 place-items-center rounded-lg bg-[var(--k-brand)] text-[var(--k-on-brand)]"><ChefHat size={20} /></span>
      <span className="text-[19px] font-extrabold tracking-wide">BẾP</span>
      {children}
    </div>
  );
}

export function KitchenNav() {
  return (
    <nav className="flex gap-1 rounded-lg bg-[var(--k-fill)] p-0.5 text-[14px] font-semibold" aria-label="Trang của bếp">
      {TABS.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) =>
            cn('inline-flex items-center gap-1.5 rounded-md px-3 py-1.5', isActive ? 'bg-[var(--k-invert-bg)] text-[var(--k-invert-text)]' : 'text-[var(--k-muted)] hover:bg-[var(--k-fill-2)]')
          }
        >
          <Icon size={15} />
          {label}
        </NavLink>
      ))}
    </nav>
  );
}

/* ---------------------------------------------------------------- Ô nhập / nút / hộp thoại theo bộ màu bếp */

export const kInput =
  'rounded-lg border border-[var(--k-line)] bg-[var(--k-surface)] px-3 py-1.5 text-[14px] text-[var(--k-text)] outline-none placeholder:text-[var(--k-muted)] focus:border-[var(--k-brand)]';
export const kBtn = 'inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-[14px] font-semibold disabled:opacity-50';
export const kBtnPrimary = `${kBtn} bg-[var(--k-brand-strong)] text-[var(--k-on-brand)] hover:bg-[var(--k-brand)]`;
export const kBtnGhost = `${kBtn} bg-[var(--k-fill)] hover:bg-[var(--k-fill-2)]`;
export const kIconBtn = 'grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[var(--k-fill)] hover:bg-[var(--k-fill-2)]';

export function KitchenDialog({ title, onClose, children, footer }: { title: string; onClose: () => void; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[var(--k-overlay)] p-4" role="dialog" aria-modal="true" aria-label={title}>
      <div className="w-full max-w-[440px] rounded-xl border border-[var(--k-line)] bg-[var(--k-surface)] shadow-2xl">
        <div className="flex items-center justify-between border-b border-[var(--k-line)] px-4 py-3">
          <p className="text-[16px] font-bold">{title}</p>
          <button type="button" aria-label="Đóng" onClick={onClose} className="grid h-8 w-8 place-items-center rounded-lg bg-[var(--k-fill)]"><X size={15} /></button>
        </div>
        <div className="px-4 py-3 text-[14px]">{children}</div>
        {footer ? <div className="flex justify-end gap-2 border-t border-[var(--k-line)] px-4 py-3">{footer}</div> : null}
      </div>
    </div>
  );
}
