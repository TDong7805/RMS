import { useEffect, useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Ban, BookOpen, ChefHat, ClipboardList, LogOut, Menu, PackageSearch, Settings, X } from 'lucide-react';
import { useAuth, useLogout } from '@/lib/auth';
import { cn } from '@/lib/cn';
import { useKdsSettings } from './kdsSettings';
import './kds-theme.css';

/*
 * Khung các trang phụ của Bếp (Kiểm tra nguyên liệu, Công thức): cùng bộ màu với màn hình bếp (sáng / tối theo cài đặt của máy),
 * cùng nút ☰ như màn chính (D13) — mọi chuyển trang / đăng xuất nằm trong menu, đăng xuất có hỏi lại.
 */

export function KitchenShell({ title, children, actions }: { title: string; children: ReactNode; actions?: ReactNode }) {
  const { data: user } = useAuth();
  const navigate = useNavigate();
  const [settings] = useKdsSettings();
  const [menu, setMenu] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  return (
    <div className="kds flex min-h-dvh flex-col" data-kds-mode={settings.mode}>
      <header className="sticky top-0 z-20 flex flex-wrap items-center gap-3 border-b border-[var(--k-line)] bg-[var(--k-header)] px-3 py-2">
        <KitchenMenuButton onClick={() => setMenu(true)} />
        <KitchenBrand />
        <span className="hidden h-6 w-px bg-[var(--k-line)] sm:block" />
        <h1 className="min-w-0 flex-1 truncate text-[19px] font-extrabold text-[var(--k-text)]">{title}</h1>
        <div className="flex items-center gap-2">
          {actions}
          <button type="button" onClick={() => navigate('/bep')} className={kBtnGhost} title="Về màn hình nhận món">
            <ClipboardList size={16} />Về màn bếp
          </button>
        </div>
      </header>
      <main className="flex-1 p-4">{children}</main>
      {menu ? <KitchenMenu userName={user?.fullName ?? ''} onClose={() => setMenu(false)} onLogout={() => { setMenu(false); setConfirmLogout(true); }} /> : null}
      {confirmLogout ? <KitchenLogoutDialog onClose={() => setConfirmLogout(false)} /> : null}
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

export function KitchenMenuButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" aria-label="Mở menu" title="Menu" onClick={onClick} className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-[var(--k-fill)] hover:bg-[var(--k-fill-2)]">
      <Menu size={22} />
    </button>
  );
}

/**
 * Menu ☰ của bếp: Màn hình bếp · Kiểm tra nguyên liệu · Công thức; trên màn chính thêm Món tạm hết, Cài đặt màn hình.
 * Cuối menu: người đang đăng nhập + Đăng xuất (bấm thì hỏi lại — onLogout mở hộp xác nhận).
 */
export function KitchenMenu({ userName, soldOutCount = 0, onClose, onSoldOut, onSettings, onLogout }: {
  userName: string;
  soldOutCount?: number;
  onClose: () => void;
  onSoldOut?: () => void;
  onSettings?: () => void;
  onLogout: () => void;
}) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  const item = 'flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-[16px] font-semibold hover:bg-[var(--k-fill)]';
  const page = (to: string, label: string, Icon: typeof BookOpen) => {
    const active = to === '/bep' ? pathname === '/bep' : pathname.startsWith(to);
    return (
      <button
        type="button"
        aria-current={active ? 'page' : undefined}
        className={cn(item, active && 'bg-[var(--k-fill-2)]')}
        onClick={() => { onClose(); if (!active) navigate(to); }}
      >
        <Icon size={20} className="text-[var(--k-muted)]" />{label}
      </button>
    );
  };
  return (
    <div className="fixed inset-0 z-40 flex" role="dialog" aria-label="Menu bếp">
      <button type="button" aria-label="Đóng" className="absolute inset-0 bg-[var(--k-overlay)]" onClick={onClose} />
      <nav className="relative flex h-full w-full max-w-[320px] flex-col bg-[var(--k-surface)] shadow-2xl">
        <div className="flex items-center gap-2 border-b border-[var(--k-line)] px-3 py-3">
          <KitchenBrand />
          <button type="button" aria-label="Đóng menu" onClick={onClose} className={cn(kIconBtn, 'ml-auto')}><X size={18} /></button>
        </div>
        <div className="flex-1 space-y-1 overflow-y-auto p-2">
          {page('/bep', 'Màn hình bếp', ClipboardList)}
          {page('/bep/nguyen-lieu', 'Kiểm tra nguyên liệu', PackageSearch)}
          {page('/bep/cong-thuc', 'Công thức', BookOpen)}
          {onSoldOut || onSettings ? <div className="my-2 h-px bg-[var(--k-line)]" /> : null}
          {onSoldOut ? (
            <button type="button" className={item} onClick={onSoldOut}>
              <Ban size={20} className="text-[var(--k-muted)]" />Món tạm hết
              {soldOutCount ? <span className="ml-auto rounded-full bg-[var(--k-danger)] px-2 font-mono text-[13px] text-white">{soldOutCount}</span> : null}
            </button>
          ) : null}
          {onSettings ? <button type="button" className={item} onClick={onSettings}><Settings size={20} className="text-[var(--k-muted)]" />Cài đặt màn hình</button> : null}
        </div>
        <div className="border-t border-[var(--k-line)] p-2">
          {userName ? <p className="px-3 pb-1 pt-1 text-[13px] text-[var(--k-muted)]">Đang đăng nhập: <b className="text-[var(--k-text)]">{userName}</b></p> : null}
          <button type="button" className={cn(item, 'text-[var(--k-danger)] hover:bg-[var(--k-danger-soft)]')} onClick={onLogout}><LogOut size={20} />Đăng xuất</button>
        </div>
      </nav>
    </div>
  );
}

export function KitchenLogoutDialog({ onClose }: { onClose: () => void }) {
  const logout = useLogout();
  return (
    <KitchenDialog
      title="Đăng xuất khỏi màn hình bếp?"
      onClose={onClose}
      footer={<>
        <button type="button" onClick={onClose} className={kBtnGhost}>Ở lại</button>
        <button type="button" disabled={logout.isPending} onClick={() => logout.mutate()} className={`${kBtn} bg-[var(--k-danger)] text-white`}><LogOut size={15} />Đăng xuất</button>
      </>}
    >
      Màn hình sẽ về trang đăng nhập và ngừng nhận món mới cho tới khi đăng nhập lại.
    </KitchenDialog>
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
