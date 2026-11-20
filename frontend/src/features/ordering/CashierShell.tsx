import { useEffect, useState, type ReactNode } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Bell, Briefcase, ClipboardList, LayoutGrid, ScanFace, Wallet, Wifi, WifiOff } from 'lucide-react';
import { CASHIER_STREAM, getCashierFloor } from '@/api/ordering';
import { NotificationMenu } from '@/components/layout/NotificationMenu';
import { UserMenu } from '@/components/layout/UserMenu';
import { useLiveEvents } from '@/features/ordering/live';
import { cn } from '@/lib/cn';

/*
 * Khu POS của Thu ngân (việc trong ca): Sơ đồ bàn, Đơn hàng, Yêu cầu thanh toán, Hóa đơn.
 * Toàn màn hình, nền luôn sáng (không theo chế độ tối của trang quản lý), thanh tab trên cùng.
 * Chấm công / Bảng lương / Thông báo ở khu "Văn phòng" (khung trang quản lý).
 */

export const CASHIER_FLOOR_KEY = ['thu-ngan', 'floor'] as const;

const TABS = [
  { to: '/thu-ngan', label: 'Sơ đồ bàn', icon: LayoutGrid, end: true },
  { to: '/thu-ngan/don-hang', label: 'Đơn hàng', icon: ClipboardList, end: false },
  { to: '/thu-ngan/yeu-cau', label: 'Yêu cầu thanh toán', icon: Bell, end: false, badge: 'requests' as const },
  { to: '/thu-ngan/hoa-don', label: 'Hóa đơn', icon: Wallet, end: false, badge: 'unpaid' as const },
];

function useClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 15_000);
    return () => clearInterval(id);
  }, []);
  return now;
}

export function CashierShell({ children, fill = false }: { children: ReactNode; /** Nội dung chiếm hết chiều cao (sơ đồ bàn). */ fill?: boolean }) {
  const navigate = useNavigate();
  const now = useClock();
  // Dùng chung dữ liệu sơ đồ bàn để hiện số yêu cầu / hóa đơn chưa thu trên tab (tự cập nhật trực tiếp).
  const floor = useQuery({ queryKey: CASHIER_FLOOR_KEY, queryFn: getCashierFloor, refetchInterval: 10_000 });
  const { connected } = useLiveEvents(CASHIER_STREAM, [CASHIER_FLOOR_KEY, ['thu-ngan']]);
  const counts = { requests: floor.data?.requestCount ?? 0, unpaid: floor.data?.unpaidCount ?? 0 };

  return (
    <div data-theme="light" className="flex h-dvh flex-col bg-[var(--bg-page)] text-[var(--text-primary)] [color-scheme:light]">
      <header className="flex h-[60px] shrink-0 items-center gap-3 border-b border-[var(--border)] bg-[var(--bg-surface)] px-4">
        <button type="button" onClick={() => navigate('/thu-ngan')} className="flex items-center gap-2.5 pr-2">
          <span className="grid h-9 w-9 place-items-center rounded-[10px] bg-[var(--accent)] text-[15px] font-extrabold text-white">TN</span>
          <span className="hidden leading-tight sm:block">
            <span className="block text-[15px] font-extrabold tracking-wide">THU NGÂN</span>
            <span className="block font-mono text-[12px] text-[var(--text-muted)]">{now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} · {now.toLocaleDateString('vi-VN', { weekday: 'short', day: '2-digit', month: '2-digit' })}</span>
          </span>
        </button>
        <nav className="no-scrollbar flex min-w-0 flex-1 gap-1 overflow-x-auto" aria-label="Khu thu ngân">
          {TABS.map(({ to, label, icon: Icon, end, badge }) => {
            const n = badge ? counts[badge] : 0;
            return (
              <NavLink
                key={to}
                to={to}
                end={end}
                title={label}
                aria-label={label}
                className={({ isActive }) =>
                  cn(
                    'relative inline-flex h-10 shrink-0 items-center gap-2 rounded-[10px] px-3.5 text-[14px] font-semibold transition-colors',
                    isActive ? 'bg-[var(--accent)] text-white' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]',
                  )
                }
              >
                <Icon size={17} />
                <span className="hidden lg:inline">{label}</span>
                {n ? <span className="grid h-5 min-w-5 place-items-center rounded-full bg-[var(--danger)] px-1.5 font-mono text-[11px] font-bold text-white">{n}</span> : null}
              </NavLink>
            );
          })}
        </nav>
        <div className="flex shrink-0 items-center gap-1.5">
          <span className={cn('hidden items-center gap-1 text-[12.5px] font-medium md:inline-flex', connected ? 'text-[var(--accent)]' : 'text-[var(--text-muted)]')} title={connected ? 'Đang cập nhật trực tiếp' : 'Đang kết nối lại…'}>
            {connected ? <Wifi size={15} /> : <WifiOff size={15} />}
            <span className="hidden lg:inline">{connected ? 'Trực tiếp' : 'Mất kết nối'}</span>
          </span>
          <button
            type="button"
            onClick={() => navigate('/thu-ngan/toi')}
            title="Chấm công bằng khuôn mặt, ca làm, phiếu lương của tôi"
            className="inline-flex h-10 items-center gap-2 rounded-[10px] border border-[var(--border)] px-3 text-[13.5px] font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
          >
            <ScanFace size={16} />
            <span className="hidden xl:inline">Chấm công</span>
          </button>
          <button
            type="button"
            onClick={() => navigate('/thu-ngan/cham-cong')}
            title="Chấm công, bảng lương (khu Văn phòng)"
            className="inline-flex h-10 items-center gap-2 rounded-[10px] border border-[var(--border)] px-3 text-[13.5px] font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
          >
            <Briefcase size={16} />
            <span className="hidden xl:inline">Văn phòng</span>
          </button>
          <NotificationMenu />
          <UserMenu />
        </div>
      </header>
      <main className={cn('min-h-0 flex-1', fill ? 'flex flex-col overflow-hidden' : 'overflow-y-auto p-4 md:p-5')}>{children}</main>
    </div>
  );
}
