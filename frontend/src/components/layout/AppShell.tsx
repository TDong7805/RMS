import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import * as Tooltip from '@radix-ui/react-tooltip';
import { Menu, PanelLeft, PanelLeftClose, Pin, Search, X } from 'lucide-react';
import { getMenu } from '@/api/menu';
import { useNotificationsQuery } from '@/features/notifications/hooks';
import { AREA_LABEL, areaFromPath } from '@/lib/areas';
import { cn } from '@/lib/cn';
import { useUiStore } from '@/lib/ui-store';
import { CommandPalette } from './CommandPalette';
import { Sidebar } from './Sidebar';
import { Breadcrumb } from './Breadcrumb';
import { ThemeToggle } from './ThemeToggle';
import { UserMenu } from './UserMenu';
import { NotificationMenu } from './NotificationMenu';

export interface PageMeta {
  /** Tên trang hiện tại hiển thị ở breadcrumb. */
  label: string;
  /** Nhãn mục cha (nếu có) hiển thị trước tên trang. */
  parent?: string;
  /** Mục cha bấm được (về trang này). */
  parentTo?: string;
  /** Các cấp giữa mục cha và trang hiện tại. */
  trail?: { label: string; to: string }[];
}

export interface AppShellProps {
  meta: PageMeta;
  children: ReactNode;
}

function Tip({ label, side = 'bottom', children }: { label: ReactNode; side?: 'bottom' | 'right'; children: ReactNode }) {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>{children}</Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content
          side={side}
          sideOffset={8}
          className="z-[95] rounded-[8px] bg-[var(--text-primary)] px-2.5 py-1.5 text-[12px] font-medium text-[var(--bg-surface)] shadow-overlay"
        >
          {label}
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

/**
 * Khung trang Quản lý / Kho. Menu trái theo Linear (docs/thiet-ke/QUY_TAC_GIAO_DIEN.md):
 *  - Ghim (mặc định): menu cố định bên trái.
 *  - Thu gọn: menu ẩn hẳn, nội dung rộng hết màn. Rê chuột vào nút mở menu / mép trái → menu trượt ra nổi trên trang,
 *    rời chuột thì tự ẩn; bấm nút thì ghim lại. Máy tính bảng: chạm nút để mở. Phím [ để thu gọn / ghim.
 *  - Điện thoại: menu dạng ngăn kéo như cũ.
 * Chấm đỏ số thông báo nằm trên nút mở menu khi menu đang ẩn.
 * Ô trên thanh trên là bảng lệnh Ctrl+K (CommandPalette).
 */
export function AppShell({ meta, children }: AppShellProps) {
  const location = useLocation();
  const [width, setWidth] = useState(() => (typeof window === 'undefined' ? 1280 : window.innerWidth));
  const [peek, setPeek] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const leaveTimer = useRef<number>();

  const sidebarCollapsed = useUiStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useUiStore((s) => s.toggleSidebar);
  const setSidebarCollapsed = useUiStore((s) => s.setSidebarCollapsed);
  const mobileNavOpen = useUiStore((s) => s.mobileNavOpen);
  const setMobileNavOpen = useUiStore((s) => s.setMobileNavOpen);

  const isMobile = width < 768;
  const isTablet = width >= 768 && width < 1024;
  /** Menu đang ghim cố định (chỉ trên máy tính); máy tính bảng luôn ở chế độ ẩn + mở nổi. */
  const pinned = !isMobile && !isTablet && !sidebarCollapsed;
  const hidden = !isMobile && !pinned;

  useEffect(() => {
    const onResize = () => {
      setWidth(window.innerWidth);
      if (window.innerWidth >= 768) setMobileNavOpen(false);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [setMobileNavOpen]);

  // Ctrl+K: bảng lệnh · [ : thu gọn / ghim menu (khi không gõ trong ô nhập).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((v) => !v);
        return;
      }
      const t = e.target as HTMLElement | null;
      const typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
      if (e.key === '[' && !typing && !e.ctrlKey && !e.metaKey && !e.altKey && !isMobile) {
        e.preventDefault();
        if (isTablet) setPeek((v) => !v);
        else { toggleSidebar(); setPeek(false); }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isMobile, isTablet, toggleSidebar]);

  // Ngăn kéo điện thoại: Esc đóng, khóa cuộn trang.
  useEffect(() => {
    if (!mobileNavOpen) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setMobileNavOpen(false); };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [mobileNavOpen, setMobileNavOpen]);

  // Chuyển trang thì đóng menu đang mở nổi.
  useEffect(() => { setPeek(false); }, [location.pathname]);

  const area = areaFromPath(location.pathname);
  const { data: menuData } = useQuery({ queryKey: ['menu', area], queryFn: () => getMenu(area), staleTime: 10 * 60_000 });
  const { data: notificationData } = useNotificationsQuery();
  const groups = useMemo(() => menuData?.groups ?? [], [menuData]);
  const unreadCount = notificationData?.unreadCount ?? 0;

  const openPeek = () => { window.clearTimeout(leaveTimer.current); setPeek(true); };
  const closePeekSoon = () => { window.clearTimeout(leaveTimer.current); leaveTimer.current = window.setTimeout(() => setPeek(false), 180); };

  const brand = (
    <div className="flex min-w-0 items-center gap-2.5">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[11px] bg-[var(--brand)] font-mono text-[14px] font-bold text-[var(--brand-contrast)]" aria-hidden>
        RB
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[14.5px] font-bold leading-5 text-[var(--text-primary)]">Royal Beef</span>
        <span className="block truncate text-[11px] uppercase tracking-[0.08em] text-[var(--text-muted)]">
          {area === 'manager' ? 'Restaurant Manager' : AREA_LABEL[area]}
        </span>
      </span>
    </div>
  );

  /** Nút mở menu khi menu đang ẩn: rê chuột = xem nhanh, bấm = ghim (máy tính) / mở (máy tính bảng). Có chấm thông báo. */
  // Không gắn chú thích nổi: rê chuột là menu trượt ra ngay, chú thích sẽ đè lên menu.
  const menuToggle = hidden ? (
      <button
        title={isTablet ? 'Mở menu' : 'Bấm để ghim menu ( [ )'}
        type="button"
        aria-label={isTablet ? 'Mở menu' : 'Ghim menu trái'}
        onMouseEnter={isTablet ? undefined : openPeek}
        onMouseLeave={isTablet ? undefined : closePeekSoon}
        onClick={() => {
          if (isTablet) setPeek((v) => !v);
          else { setSidebarCollapsed(false); setPeek(false); }
        }}
        className="relative grid h-10 w-10 shrink-0 place-items-center rounded-control border border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text-secondary)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
      >
        <PanelLeft size={18} strokeWidth={1.8} />
        {unreadCount > 0 ? (
          <span className="absolute -right-1 -top-1 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-[var(--danger)] px-1 font-mono text-[10px] font-bold text-white ring-2 ring-[var(--bg-page)]">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        ) : null}
      </button>
  ) : null;

  const sidebarBody = (onNavigate?: () => void) => (
    <div className="flex min-h-0 flex-1 flex-col pt-3">
      <Sidebar groups={groups} unreadCount={unreadCount} collapsed={false} onNavigate={onNavigate} />
    </div>
  );

  return (
    <Tooltip.Provider delayDuration={150}>
      <div className="min-h-screen bg-[var(--bg-page)]">
        {/* Menu ghim cố định (máy tính) */}
        {pinned ? (
          <aside style={{ width: 'var(--sidebar-w)' }} className="fixed inset-y-0 left-0 z-40 flex flex-col border-r border-[var(--border)] bg-[var(--bg-surface)]">
            <div className="flex h-[68px] shrink-0 items-center justify-between gap-2 border-b border-[var(--border)] px-4">
              {brand}
              <Tip label={<span>Thu gọn menu <span className="ml-1 opacity-70">[</span></span>}>
                <button
                  type="button"
                  onClick={() => { setSidebarCollapsed(true); setPeek(false); }}
                  aria-label="Thu gọn menu"
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-[8px] text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)]"
                >
                  <PanelLeftClose size={17} strokeWidth={1.75} />
                </button>
              </Tip>
            </div>
            {sidebarBody()}
          </aside>
        ) : null}

        {/* Menu ẩn: vùng mép trái để rê chuột (máy tính) + menu trượt ra nổi trên trang */}
        {hidden ? (
          <>
            {!isTablet ? <div aria-hidden onMouseEnter={openPeek} onMouseLeave={closePeekSoon} className="fixed inset-y-0 left-0 z-40 w-2" /> : null}
            {isTablet && peek ? <div aria-hidden onClick={() => setPeek(false)} className="fixed inset-0 z-[49] bg-[rgba(15,26,20,0.28)]" /> : null}
            <aside
              aria-hidden={!peek}
              onMouseEnter={isTablet ? undefined : openPeek}
              onMouseLeave={isTablet ? undefined : closePeekSoon}
              style={{ width: 'var(--sidebar-w)' }}
              className={cn(
                'fixed bottom-3 left-3 top-3 z-50 flex flex-col overflow-hidden rounded-[16px] border border-[var(--border)] bg-[var(--bg-surface)] shadow-overlay transition-[transform,opacity] duration-200 ease-smooth',
                peek ? 'translate-x-0 opacity-100' : 'pointer-events-none -translate-x-[calc(100%+16px)] opacity-0',
              )}
            >
              <div className="flex h-[60px] shrink-0 items-center justify-between gap-2 border-b border-[var(--border)] px-4">
                {brand}
                {isTablet ? (
                  <button type="button" onClick={() => setPeek(false)} aria-label="Đóng menu" className="grid h-8 w-8 shrink-0 place-items-center rounded-[8px] text-[var(--text-muted)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)]">
                    <X size={17} strokeWidth={1.9} />
                  </button>
                ) : (
                  <Tip label="Ghim menu">
                    <button
                      type="button"
                      onClick={() => { setSidebarCollapsed(false); setPeek(false); }}
                      aria-label="Ghim menu"
                      className="grid h-8 w-8 shrink-0 place-items-center rounded-[8px] text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-subtle)] hover:text-[var(--accent)]"
                    >
                      <Pin size={16} strokeWidth={1.8} />
                    </button>
                  </Tip>
                )}
              </div>
              {sidebarBody(() => setPeek(false))}
            </aside>
          </>
        ) : null}

        {/* Điện thoại: ngăn kéo */}
        {isMobile ? (
          <>
            <div
              aria-hidden={!mobileNavOpen}
              onClick={() => setMobileNavOpen(false)}
              className={cn('fixed inset-0 z-[70] bg-[rgba(15,26,20,0.42)] transition-opacity duration-200', mobileNavOpen ? 'opacity-100' : 'pointer-events-none opacity-0')}
            />
            <aside
              role="dialog"
              aria-modal="true"
              aria-label="Menu"
              aria-hidden={!mobileNavOpen}
              className={cn(
                'fixed inset-y-0 left-0 z-[80] flex w-[min(var(--sidebar-w),86vw)] flex-col border-r border-[var(--border)] bg-[var(--bg-surface)]',
                mobileNavOpen ? 'rm-drawer-in' : '-translate-x-full',
              )}
            >
              <div className="flex h-[68px] shrink-0 items-center justify-between border-b border-[var(--border)] px-4">
                {brand}
                <button type="button" onClick={() => setMobileNavOpen(false)} aria-label="Đóng menu" className="grid h-9 w-9 place-items-center rounded-[9px] text-[var(--text-muted)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)]">
                  <X size={18} strokeWidth={1.9} />
                </button>
              </div>
              {sidebarBody(() => setMobileNavOpen(false))}
            </aside>
          </>
        ) : null}

        <div className={cn('flex min-h-screen min-w-0 flex-col', pinned && 'pl-[var(--sidebar-w)]')}>
          <header className="sticky top-0 z-30 border-b border-[var(--border)] bg-[var(--bg-page)]/92 backdrop-blur supports-[backdrop-filter]:bg-[var(--bg-page)]/78">
            <div className="flex h-[68px] items-center gap-2 px-4 sm:px-6">
              {isMobile ? (
                <button
                  type="button"
                  onClick={() => setMobileNavOpen(true)}
                  aria-label="Mở menu"
                  className="relative grid h-10 w-10 shrink-0 place-items-center rounded-control border border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
                >
                  <Menu size={19} strokeWidth={1.9} />
                  {unreadCount > 0 ? <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-[var(--danger)] ring-2 ring-[var(--bg-page)]" aria-hidden /> : null}
                </button>
              ) : null}
              {menuToggle}

              {/* Bảng lệnh Ctrl+K: đi tới trang, tạo mới, đổi giao diện, đăng xuất… */}
              <button
                type="button"
                onClick={() => setPaletteOpen(true)}
                aria-label="Mở bảng lệnh (Ctrl+K)"
                className={cn(
                  'flex h-10 items-center gap-2 rounded-pill border border-[var(--border)] bg-[var(--bg-subtle)] text-left text-[var(--text-muted)] transition-colors hover:border-[var(--border-strong)] hover:text-[var(--text-secondary)]',
                  isMobile ? 'w-10 justify-center' : 'w-full max-w-[420px] min-w-0 pl-3.5 pr-2.5',
                )}
              >
                <Search size={16} strokeWidth={1.75} aria-hidden className="shrink-0" />
                {isMobile ? null : (
                  <>
                    <span className="min-w-0 flex-1 truncate text-[14px]">Tìm trang, lệnh…</span>
                    <span className="flex shrink-0 gap-1">
                      <kbd className="rounded-[5px] border border-[var(--border)] bg-[var(--bg-surface)] px-1.5 py-0.5 font-mono text-[10.5px]">Ctrl</kbd>
                      <kbd className="rounded-[5px] border border-[var(--border)] bg-[var(--bg-surface)] px-1.5 py-0.5 font-mono text-[10.5px]">K</kbd>
                    </span>
                  </>
                )}
              </button>

              <div className="ml-auto flex shrink-0 items-center gap-2">
                <NotificationMenu />
                <ThemeToggle />
                <UserMenu />
              </div>
            </div>

            <div className="flex h-11 items-center border-t border-[var(--border)] px-4 sm:px-6">
              <Breadcrumb current={meta.label} parent={meta.parent} parentTo={meta.parentTo} trail={meta.trail} />
            </div>
          </header>

          <main className="min-w-0 flex-1 px-4 pb-10 pt-5 sm:px-6 sm:pt-6">
            <div className="mx-auto w-full max-w-[1440px]">{children}</div>
          </main>
        </div>

        <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
      </div>
    </Tooltip.Provider>
  );
}
