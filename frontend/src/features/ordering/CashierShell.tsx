import { useEffect, useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Bell, ClipboardList, KeyRound, LayoutGrid, LogOut, Menu, Receipt, Wallet, Wifi, WifiOff, X } from 'lucide-react';
import { CASHIER_STREAM, getCashierFloor } from '@/api/ordering';
import { NotificationMenu } from '@/components/layout/NotificationMenu';
import { ConfirmDialog } from '@/components/common/Modal';
import { useLiveEvents } from '@/features/ordering/live';
import { useAuth, useLogout } from '@/lib/auth';
import { cn } from '@/lib/cn';

/*
 * Khung Thu ngân (D16, 26/11/2026): màn POS làm được hết việc chính trên một màn; thanh trên chỉ còn ☰ · giờ · kết nối · chuông.
 * Menu ☰ chứa mọi trang phụ (Đơn hàng, Yêu cầu thanh toán, Hóa đơn, Thông báo, Đổi mật khẩu, Đăng xuất có hỏi lại) để
 * không bấm nhầm. Trang phụ có nút lớn "Về quầy thu ngân".
 * 27/11/2026: màn này chỉ mở bằng tài khoản MÀN HÌNH CHUNG (khu.thu.ngan). Chấm công nhân viên, Bảng lương chuyển sang
 * Cổng nhân viên của tài khoản riêng thu ngân (/nhan-vien/van-phong/…) — không mở bảng lương trên máy quầy dùng chung.
 */

export const CASHIER_FLOOR_KEY = ['thu-ngan', 'floor'] as const;

function useClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 15_000);
    return () => clearInterval(id);
  }, []);
  return now;
}

export function CashierShell({ children, fill = false }: { children: ReactNode; /** Màn POS (sơ đồ) chiếm hết chiều cao; không có = trang phụ. */ fill?: boolean }) {
  const navigate = useNavigate();
  const now = useClock();
  // Dùng chung dữ liệu sơ đồ bàn để hiện số yêu cầu / hóa đơn chưa thu trong menu (tự cập nhật trực tiếp).
  const floor = useQuery({ queryKey: CASHIER_FLOOR_KEY, queryFn: getCashierFloor, refetchInterval: 10_000 });
  const { connected } = useLiveEvents(CASHIER_STREAM, [CASHIER_FLOOR_KEY, ['thu-ngan']]);
  const [menu, setMenu] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const logout = useLogout();
  const counts = { requests: floor.data?.requestCount ?? 0, unpaid: floor.data?.unpaidCount ?? 0 };

  return (
    <div data-theme="light" className="flex h-dvh flex-col bg-[var(--bg-page)] text-[var(--text-primary)] [color-scheme:light]">
      <header className="flex h-[60px] shrink-0 items-center gap-3 border-b border-[var(--border)] bg-[var(--bg-surface)] px-3">
        <button type="button" aria-label="Mở menu" title="Menu" onClick={() => setMenu(true)} className="relative grid h-11 w-11 shrink-0 place-items-center rounded-[12px] bg-[var(--bg-subtle)] hover:bg-[var(--bg-hover)]">
          <Menu size={22} />
          {counts.requests + counts.unpaid ? <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-[var(--danger)] px-1 font-mono text-[11px] font-bold text-white">{counts.requests + counts.unpaid}</span> : null}
        </button>
        <button type="button" onClick={() => navigate('/thu-ngan')} className="flex items-center gap-2.5 pr-2">
          <span className="grid h-9 w-9 place-items-center rounded-[10px] bg-[var(--accent)] text-[15px] font-extrabold text-white">TN</span>
          <span className="hidden leading-tight sm:block">
            <span className="block text-[15px] font-extrabold tracking-wide">THU NGÂN</span>
            <span className="block text-[12px] text-[var(--text-muted)]">{now.toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit' })}</span>
          </span>
        </button>
        <span className="flex-1" />
        {fill ? null : (
          <button type="button" onClick={() => navigate('/thu-ngan')} className="inline-flex h-11 items-center gap-2 rounded-[12px] bg-[var(--accent)] px-4 text-[14px] font-bold text-white hover:opacity-95">
            <LayoutGrid size={17} />Về quầy thu ngân
          </button>
        )}
        <span className={cn('inline-flex items-center gap-1 text-[12.5px] font-medium', connected ? 'text-[var(--accent)]' : 'text-[var(--danger)]')} title={connected ? 'Đang cập nhật trực tiếp' : 'Mất kết nối – đang thử lại'}>
          {connected ? <Wifi size={17} /> : <WifiOff size={17} />}
          {connected ? null : <span>Mất kết nối</span>}
        </span>
        <span className="hidden font-mono text-[22px] font-bold md:inline">{now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</span>
        <NotificationMenu allHref="/thu-ngan/thong-bao" />
      </header>
      <main className={cn('min-h-0 flex-1', fill ? 'flex flex-col overflow-hidden' : 'overflow-y-auto p-4 md:p-5')}>
        {fill ? children : <div className="mx-auto max-w-[1400px]">{children}</div>}
      </main>
      {menu ? <CashierMenu counts={counts} onClose={() => setMenu(false)} onLogout={() => { setMenu(false); setConfirmLogout(true); }} /> : null}
      <ConfirmDialog
        open={confirmLogout}
        onOpenChange={setConfirmLogout}
        title="Đăng xuất khỏi quầy thu ngân?"
        description="Máy sẽ về trang đăng nhập; đơn và hóa đơn đang mở vẫn được giữ."
        confirmLabel="Đăng xuất"
        cancelLabel="Ở lại"
        tone="danger"
        loading={logout.isPending}
        onConfirm={() => logout.mutate()}
      />
    </div>
  );
}

function CashierMenu({ counts, onClose, onLogout }: { counts: { requests: number; unpaid: number }; onClose: () => void; onLogout: () => void }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { data: user } = useAuth();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  const item = (to: string, label: string, Icon: typeof Menu, badge = 0, end = false) => {
    const active = end ? pathname === to : pathname.startsWith(to);
    return (
      <button
        type="button"
        aria-current={active ? 'page' : undefined}
        onClick={() => { onClose(); if (!active) navigate(to); }}
        className={cn('flex w-full items-center gap-3 rounded-[10px] px-3 py-2.5 text-left text-[15px] font-semibold', active ? 'bg-[var(--accent-soft)] text-[var(--accent)]' : 'hover:bg-[var(--bg-hover)]')}
      >
        <Icon size={19} className={active ? '' : 'text-[var(--text-muted)]'} />{label}
        {badge ? <span className="ml-auto grid h-5 min-w-5 place-items-center rounded-full bg-[var(--danger)] px-1.5 font-mono text-[11px] font-bold text-white">{badge}</span> : null}
      </button>
    );
  };
  return (
    <div className="fixed inset-0 z-50 flex" role="dialog" aria-label="Menu thu ngân">
      <button type="button" aria-label="Đóng" className="absolute inset-0 bg-black/35" onClick={onClose} />
      <nav className="relative flex h-full w-full max-w-[320px] flex-col bg-[var(--bg-surface)] shadow-2xl">
        <div className="flex items-center gap-2.5 border-b border-[var(--border)] px-3 py-3">
          <span className="grid h-9 w-9 place-items-center rounded-[10px] bg-[var(--accent)] text-[15px] font-extrabold text-white">TN</span>
          <span className="text-[15px] font-extrabold">THU NGÂN</span>
          <button type="button" aria-label="Đóng menu" onClick={onClose} className="ml-auto grid h-9 w-9 place-items-center rounded-[10px] bg-[var(--bg-subtle)]"><X size={18} /></button>
        </div>
        <div className="flex-1 space-y-0.5 overflow-y-auto p-2">
          {item('/thu-ngan', 'Quầy thu ngân (sơ đồ bàn)', LayoutGrid, 0, true)}
          {item('/thu-ngan/yeu-cau', 'Yêu cầu thanh toán', Bell, counts.requests)}
          {item('/thu-ngan/hoa-don', 'Hóa đơn', Wallet, counts.unpaid)}
          {item('/thu-ngan/don-hang', 'Đơn hàng', ClipboardList)}
          {item('/thu-ngan/thong-bao', 'Thông báo', Receipt)}
          {item('/doi-mat-khau', 'Đổi mật khẩu', KeyRound)}
        </div>
        <div className="border-t border-[var(--border)] p-2">
          {user ? <p className="px-3 pb-1 pt-1 text-[12.5px] text-[var(--text-muted)]">Đang đăng nhập: <b className="text-[var(--text-primary)]">{user.fullName}</b></p> : null}
          <button type="button" onClick={onLogout} className="flex w-full items-center gap-3 rounded-[10px] px-3 py-2.5 text-left text-[15px] font-semibold text-[var(--danger)] hover:bg-[var(--danger-soft)]">
            <LogOut size={19} />Đăng xuất
          </button>
        </div>
      </nav>
    </div>
  );
}
