import { useEffect, useRef, type ReactNode } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { BellRing, BookOpen, HandPlatter, LayoutGrid, ScanFace, UserRound, Wifi, WifiOff } from 'lucide-react';
import { getConfirmations, getWaiterFloor, getWaiterRequests, WAITER_KEYS, WAITER_STREAM } from '@/api/waiter';
import { NotificationMenu } from '@/components/layout/NotificationMenu';
import { UserMenu } from '@/components/layout/UserMenu';
import { beep, unlockAudio, useLiveEvents } from '@/features/ordering/live';
import { cn } from '@/lib/cn';

/*
 * Khu Nhân viên phục vụ — thiết kế cho điện thoại: thanh trên (ca theo lịch, trạng thái kết nối, chuông, tài khoản),
 * nội dung ở giữa, thanh tab dưới đáy (dễ bấm bằng ngón cái). Nền luôn sáng như khu Thu ngân.
 * Cập nhật trực tiếp qua SSE /api/phuc-vu/stream: "change" → tải lại; "layout" → quản lý vừa sửa sơ đồ bàn.
 * Có yêu cầu hỗ trợ / đơn chờ xác nhận / món bếp vừa xong mới trong khu của mình → âm báo + rung.
 * 27/11/2026: phục vụ tự chấm công trên điện thoại của mình (/phuc-vu/toi). Chưa vào ca / đã tan ca → dải nhắc, chỉ xem
 * (máy chủ chặn thao tác — WaiterGuard), không âm báo / thông báo. Đăng nhập lúc đang có ca mà chưa chấm → tự mở trang chấm công một lần.
 */

const TABS = [
  { to: '/phuc-vu', label: 'Sơ đồ', icon: LayoutGrid, end: true },
  { to: '/phuc-vu/yeu-cau', label: 'Yêu cầu', icon: BellRing, end: false, badge: 'requests' as const },
  { to: '/phuc-vu/mon-xong', label: 'Món xong', icon: HandPlatter, end: false, badge: 'ready' as const },
  { to: '/phuc-vu/thuc-don', label: 'Thực đơn', icon: BookOpen, end: false },
  // Của tôi: chấm công / tan ca, lịch làm, lịch sử chấm công, phiếu lương, hồ sơ.
  { to: '/phuc-vu/toi', label: 'Của tôi', icon: UserRound, end: false, badge: 'clock' as const },
];

/** Mỗi phiên trình duyệt chỉ tự mở trang chấm công một lần. */
const CLOCK_PROMPTED = 'rms.waiter.clockPrompted';

export function WaiterShell({ children, title, fill = false }: { children: ReactNode; title?: string; /** Nội dung chiếm hết chiều cao (sơ đồ). */ fill?: boolean }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const floor = useQuery({ queryKey: WAITER_KEYS.floor, queryFn: getWaiterFloor, refetchInterval: 15_000 });
  const waiting = useQuery({ queryKey: WAITER_KEYS.requests('waiting'), queryFn: () => getWaiterRequests('waiting'), refetchInterval: 15_000 });
  const confirms = useQuery({ queryKey: WAITER_KEYS.confirmations, queryFn: getConfirmations, refetchInterval: 15_000 });
  const { connected } = useLiveEvents(WAITER_STREAM, [WAITER_KEYS.all], undefined, {
    layout: (data) => {
      let area = '';
      try {
        area = (JSON.parse(data) as { areaName?: string | null }).areaName ?? '';
      } catch {
        area = '';
      }
      toast.info(area ? `Quản lý vừa thay đổi sơ đồ ${area}` : 'Quản lý vừa thay đổi sơ đồ bàn', {
        description: 'Sơ đồ đã cập nhật — kiểm tra lại cách kê bàn ghế.',
        action: { label: 'Xem sơ đồ', onClick: () => navigate('/phuc-vu') },
      });
    },
  });

  // Trình duyệt chỉ cho phát âm thanh sau lần chạm đầu tiên.
  useEffect(() => {
    const on = () => unlockAudio();
    window.addEventListener('pointerdown', on, { once: true });
    return () => window.removeEventListener('pointerdown', on);
  }, []);

  // Món chờ lấy ở bếp: chỉ khu của mình (khớp mặc định trang Món xong); chưa gán khu → mọi khu.
  const mine = floor.data?.myAreaIds ?? [];
  const areaOf = new Map((floor.data?.floor.tables ?? []).map((t) => [t.id, t.areaId]));
  const readyMine = (floor.data?.floor.ready ?? []).filter((r) => mine.length === 0 || mine.includes(areaOf.get(r.tableId) ?? ''));

  // Yêu cầu Mới / đơn chờ xác nhận mới (hoặc vừa quá giờ) / món vừa xong trong khu của mình → âm báo + rung.
  const seen = useRef<Set<string> | null>(null);
  useEffect(() => {
    if (!waiting.data || !confirms.data || !floor.data) return;
    const ids = new Set([
      ...waiting.data.items.filter((r) => r.status === 'new').map((r) => 'r' + r.id),
      ...confirms.data.items.map((c) => `c${c.orderId}:${c.items.length}:${c.overdue ? 1 : 0}`),
      ...readyMine.map((r) => 'd' + r.id),
    ]);
    // Chưa vào ca / đã tan ca: không âm báo, không rung.
    if (seen.current && floor.data.clockedIn && [...ids].some((id) => !seen.current!.has(id))) {
      beep(3);
      // Trình duyệt chỉ cho rung sau khi người dùng đã chạm vào trang.
      if ((navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }).userActivation?.hasBeenActive) navigator.vibrate?.([200, 100, 200]);
    }
    seen.current = ids;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [waiting.data, confirms.data, floor.data]);

  const counts = {
    requests: (waiting.data?.items.filter((r) => r.status === 'new').length ?? 0) + (confirms.data?.count ?? 0),
    ready: readyMine.length,
    // Chấm đỏ ở "Của tôi" khi đang có ca mà chưa chấm công.
    clock: floor.data && floor.data.onShift && !floor.data.clockedIn ? 1 : 0,
  };
  const f = floor.data;
  const duty = !f ? '' : f.onShift ? f.dutyLabel : f.nextLabel ? `Ngoài ca · ca tới ${f.nextLabel}` : 'Ngoài ca';
  const onClockPage = pathname === '/phuc-vu/toi';

  // Vừa đăng nhập, đang có ca mà chưa chấm công → mở trang chấm công (một lần mỗi phiên, bấm quay lại vẫn xem được).
  useEffect(() => {
    if (!f || f.clockedIn || !f.onShift || onClockPage) return;
    if (sessionStorage.getItem(CLOCK_PROMPTED)) return;
    sessionStorage.setItem(CLOCK_PROMPTED, '1');
    navigate('/phuc-vu/toi');
  }, [f, onClockPage, navigate]);

  return (
    <div data-theme="light" className="flex h-dvh flex-col bg-[var(--bg-page)] text-[var(--text-primary)] [color-scheme:light]">
      <header className="flex h-14 shrink-0 items-center gap-2 border-b border-[var(--border)] bg-[var(--bg-surface)] px-3">
        <button type="button" onClick={() => navigate('/phuc-vu')} className="flex min-w-0 items-center gap-2">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-[var(--accent)] text-[14px] font-extrabold text-white">PV</span>
          <span className="min-w-0 text-left leading-tight">
            <span className="block truncate text-[14px] font-extrabold">{title ?? 'PHỤC VỤ'}</span>
            <span className="block truncate text-[11.5px] text-[var(--text-muted)]">{duty}</span>
          </span>
        </button>
        <span className="ml-auto" />
        {f?.clockedIn && !onClockPage ? (
          <button type="button" onClick={() => navigate('/phuc-vu/toi')} title="Chấm công / tan ca, ca làm, phiếu lương" className="inline-flex h-8 items-center gap-1 rounded-[9px] bg-[var(--accent-soft)] px-2 text-[12px] font-bold text-[var(--accent)]">
            <ScanFace size={15} />Đã vào ca
          </button>
        ) : null}
        <span className={cn('grid h-8 w-8 place-items-center', connected ? 'text-[var(--accent)]' : 'text-[var(--text-muted)]')} title={connected ? 'Đang cập nhật trực tiếp' : 'Đang kết nối lại…'}>
          {connected ? <Wifi size={17} /> : <WifiOff size={17} />}
        </span>
        <NotificationMenu allHref="/phuc-vu/thong-bao" />
        <UserMenu />
      </header>

      {f && !f.clockedIn && !onClockPage ? (
        <div className="flex shrink-0 items-center gap-2 border-b border-[var(--border)] bg-[var(--warning-soft)] px-3 py-2 text-[12.5px]">
          <span className="min-w-0 flex-1 leading-snug">
            <b>Chưa vào ca</b> — chỉ xem được, không nhận thông báo. Chấm công khuôn mặt (trong WiFi quán) để bắt đầu làm việc.
          </span>
          <button type="button" onClick={() => navigate('/phuc-vu/toi')} className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-[10px] bg-[var(--accent)] px-3 text-[13px] font-bold text-white">
            <ScanFace size={16} />Chấm công
          </button>
        </div>
      ) : null}

      <main className={cn('min-h-0 flex-1', fill ? 'flex flex-col overflow-hidden' : 'overflow-y-auto p-3 sm:p-4')}>{children}</main>

      <nav className="grid shrink-0 grid-cols-5 border-t border-[var(--border)] bg-[var(--bg-surface)] pb-[env(safe-area-inset-bottom)]" aria-label="Khu phục vụ">
        {TABS.map(({ to, label, icon: Icon, end, badge }) => {
          const n = badge ? counts[badge] : 0;
          const dot = badge === 'clock';
          return (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn('relative flex h-[58px] flex-col items-center justify-center gap-0.5 text-[11.5px] font-semibold', isActive ? 'text-[var(--accent)]' : 'text-[var(--text-muted)]')
              }
            >
              <Icon size={21} />
              {label}
              {n && dot ? <span className="absolute left-1/2 top-2 ml-2 h-2.5 w-2.5 rounded-full bg-[var(--danger)]" aria-label="Chưa chấm công" /> : null}
              {n && !dot ? (
                <span className="absolute left-1/2 top-1.5 ml-2 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-[var(--danger)] px-1 font-mono text-[10.5px] font-bold text-white">{n}</span>
              ) : null}
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
}
