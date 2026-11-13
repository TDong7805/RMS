import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import * as Tooltip from '@radix-ui/react-tooltip';
import { Menu, PanelLeftClose, PanelLeftOpen, Search, X } from 'lucide-react';
import { getMenu } from '@/api/menu';
import { pagesOf } from '@/api/search';
import { useNotificationsQuery } from '@/features/notifications/hooks';
import { AREA_LABEL, areaFromPath } from '@/lib/areas';
import { cn } from '@/lib/cn';
import { useUiStore } from '@/lib/ui-store';
import { findCurrentPage, SearchBox } from './SearchBox';
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
}

export interface AppShellProps {
  meta: PageMeta;
  children: ReactNode;
}

export function AppShell({ meta, children }: AppShellProps) {
  const location = useLocation();
  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window === 'undefined' ? true : window.innerWidth >= 1024,
  );
  const [isMobileQuery, setIsMobileQuery] = useState(() =>
    typeof window === 'undefined' ? false : window.innerWidth < 768,
  );
  /** Dải 768–1023px: sidebar tự thu gọn thành cột icon, vẫn cố định. */
  const [isTablet, setIsTablet] = useState(() =>
    typeof window === 'undefined' ? false : window.innerWidth >= 768 && window.innerWidth < 1024,
  );
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);

  const sidebarCollapsed = useUiStore((s) => s.sidebarCollapsed);
  const mobileNavOpen = useUiStore((s) => s.mobileNavOpen);
  const setMobileNavOpen = useUiStore((s) => s.setMobileNavOpen);
  const toggleSidebar = useUiStore((s) => s.toggleSidebar);

  useEffect(() => {
    const onResize = () => {
      const width = window.innerWidth;
      setIsDesktop(width >= 1024);
      setIsMobileQuery(width < 768);
      setIsTablet(width >= 768 && width < 1024);
      if (width >= 768) setMobileNavOpen(false);
    };
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [setMobileNavOpen]);

  // Đóng drawer bằng Esc.
  useEffect(() => {
    if (!mobileNavOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileNavOpen(false);
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [mobileNavOpen, setMobileNavOpen]);

  useEffect(() => {
    setMobileSearchOpen(false);
  }, [location.pathname]);

  /** Khu đang xem (Quản lý nhà hàng / Quản lý kho) quyết định menu, thông báo và gợi ý tìm kiếm. */
  const area = areaFromPath(location.pathname);

  const { data: menuData } = useQuery({
    queryKey: ['menu', area],
    queryFn: () => getMenu(area),
    staleTime: 10 * 60_000,
  });

  const { data: notificationData } = useNotificationsQuery();

  const groups = useMemo(() => menuData?.groups ?? [], [menuData]);
  const unreadCount = notificationData?.unreadCount ?? 0;
  const showDrawer = !isDesktop && !isTablet;
  const collapsed = showDrawer ? false : isTablet || sidebarCollapsed;

  const currentPage = useMemo(
    () => findCurrentPage(location.pathname, pagesOf(area)),
    [location.pathname, area],
  );

  const brand = (
    <div className={cn('flex items-center gap-2.5', collapsed && 'justify-center')}>
      <span
        className="grid h-9 w-9 shrink-0 place-items-center rounded-[11px] bg-[var(--accent)] font-mono text-[14px] font-bold text-[var(--accent-contrast)]"
        aria-hidden
      >
        GL
      </span>
      {collapsed ? null : (
        <span className="min-w-0">
          <span className="block truncate text-[14.5px] font-bold leading-5 text-[var(--text-primary)]">
            Green Lotus
          </span>
          <span className="block truncate text-[11px] uppercase tracking-[0.08em] text-[var(--text-muted)]">
            {area === 'manager' ? 'Restaurant Manager' : AREA_LABEL[area]}
          </span>
        </span>
      )}
    </div>
  );

  return (
    <Tooltip.Provider delayDuration={150}>
      <div className="min-h-screen bg-[var(--bg-page)]">
        {/* Sidebar cố định trên desktop */}
        {!showDrawer ? (
          <aside
            style={{ width: collapsed ? 'var(--sidebar-w-collapsed)' : 'var(--sidebar-w)' }}
            className="fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-[var(--border)] bg-[var(--bg-surface)] transition-[width] duration-200 ease-smooth md:flex"
          >
            <div
              className={cn(
                'flex h-[68px] shrink-0 items-center border-b border-[var(--border)]',
                collapsed ? 'justify-center px-2' : 'justify-between px-4',
              )}
            >
              {brand}
              {isTablet || collapsed ? null : (
                <Tooltip.Root>
                  <Tooltip.Trigger asChild>
                    <button
                      type="button"
                      onClick={toggleSidebar}
                      aria-label="Thu gọn sidebar"
                      className="grid h-8 w-8 shrink-0 place-items-center rounded-[8px] text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)]"
                    >
                      <PanelLeftClose size={17} strokeWidth={1.75} />
                    </button>
                  </Tooltip.Trigger>
                  <Tooltip.Portal>
                    <Tooltip.Content
                      side="bottom"
                      sideOffset={8}
                      className="z-[70] rounded-[8px] bg-[var(--text-primary)] px-2.5 py-1.5 text-[12px] text-[var(--bg-surface)]"
                    >
                      Thu gọn sidebar
                    </Tooltip.Content>
                  </Tooltip.Portal>
                </Tooltip.Root>
              )}
            </div>
            <div className="flex min-h-0 flex-1 flex-col pt-3">
              <Sidebar groups={groups} unreadCount={unreadCount} collapsed={collapsed} />
            </div>
            {collapsed && !isTablet ? (
              <div className="shrink-0 border-t border-[var(--border)] p-2">
                <Tooltip.Root>
                  <Tooltip.Trigger asChild>
                    <button
                      type="button"
                      onClick={toggleSidebar}
                      aria-label="Mở rộng sidebar"
                      className="grid h-10 w-full place-items-center rounded-control text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)]"
                    >
                      <PanelLeftOpen size={18} strokeWidth={1.75} />
                    </button>
                  </Tooltip.Trigger>
                  <Tooltip.Portal>
                    <Tooltip.Content
                      side="right"
                      sideOffset={10}
                      className="z-[70] rounded-[8px] bg-[var(--text-primary)] px-2.5 py-1.5 text-[12px] text-[var(--bg-surface)]"
                    >
                      Mở rộng sidebar
                    </Tooltip.Content>
                  </Tooltip.Portal>
                </Tooltip.Root>
              </div>
            ) : null}
          </aside>
        ) : null}

        {/* Drawer cho mobile / tablet nhỏ */}
        {showDrawer ? (
          <>
            <div
              aria-hidden={!mobileNavOpen}
              onClick={() => setMobileNavOpen(false)}
              className={cn(
                'fixed inset-0 z-[70] bg-[rgba(15,26,20,0.42)] transition-opacity duration-200',
                mobileNavOpen ? 'opacity-100' : 'pointer-events-none opacity-0',
              )}
            />
            <aside
              role="dialog"
              aria-modal="true"
              aria-label="Menu quản lý"
              aria-hidden={!mobileNavOpen}
              className={cn(
                'fixed inset-y-0 left-0 z-[80] flex w-[min(var(--sidebar-w),86vw)] flex-col border-r border-[var(--border)] bg-[var(--bg-surface)]',
                mobileNavOpen ? 'rm-drawer-in' : '-translate-x-full',
              )}
            >
              <div className="flex h-[68px] shrink-0 items-center justify-between border-b border-[var(--border)] px-4">
                {brand}
                <button
                  type="button"
                  onClick={() => setMobileNavOpen(false)}
                  aria-label="Đóng menu"
                  className="grid h-9 w-9 place-items-center rounded-[9px] text-[var(--text-muted)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)]"
                >
                  <X size={18} strokeWidth={1.9} />
                </button>
              </div>
              <div className="min-h-0 flex-1 pt-3">
                <Sidebar
                  groups={groups}
                  unreadCount={unreadCount}
                  collapsed={false}
                  onNavigate={() => setMobileNavOpen(false)}
                />
              </div>
            </aside>
          </>
        ) : null}

        <div
          className={cn(
            'flex min-h-screen min-w-0 flex-col transition-[padding] duration-200 ease-smooth',
            !showDrawer
              ? collapsed
                ? 'md:pl-[var(--sidebar-w-collapsed)]'
                : 'md:pl-[var(--sidebar-w)]'
              : '',
          )}
        >
          <header className="sticky top-0 z-30 border-b border-[var(--border)] bg-[var(--bg-page)]/92 backdrop-blur supports-[backdrop-filter]:bg-[var(--bg-page)]/78">
            <div className="flex h-[68px] items-center gap-2 px-4 sm:px-6">
              {showDrawer ? (
                <button
                  type="button"
                  onClick={() => setMobileNavOpen(true)}
                  aria-label="Mở menu"
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-control border border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
                >
                  <Menu size={19} strokeWidth={1.9} />
                </button>
              ) : null}

              {/* Vùng 1: tìm kiếm, chuông, theme, avatar */}
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <div className="hidden min-w-0 max-w-[420px] flex-1 sm:block">
                  <SearchBox currentPage={currentPage} />
                </div>
                {isMobileQuery ? (
                  <div className="sm:hidden">
                    <button
                      type="button"
                      onClick={() => setMobileSearchOpen((v) => !v)}
                      aria-label="Tìm kiếm trang"
                      aria-expanded={mobileSearchOpen}
                      className="grid h-10 w-10 place-items-center rounded-control border border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
                    >
                      <Search size={18} strokeWidth={1.9} />
                    </button>
                  </div>
                ) : null}

                <div className="ml-auto flex shrink-0 items-center gap-2">
                  <NotificationMenu />
                  <ThemeToggle />
                  <UserMenu />
                </div>
              </div>
            </div>

            {isMobileQuery && mobileSearchOpen ? (
              <div className="border-t border-[var(--border)] px-4 pb-3 pt-2 sm:hidden">
                <SearchBox currentPage={currentPage} />
              </div>
            ) : null}

            {/* Vùng 2: breadcrumb */}
            <div className="flex h-11 items-center border-t border-[var(--border)] px-4 sm:px-6">
              <Breadcrumb current={meta.label} parent={meta.parent} />
            </div>
          </header>

          <main className="min-w-0 flex-1 px-4 pb-10 pt-5 sm:px-6 sm:pt-6">
            <div className="mx-auto w-full max-w-[1440px]">{children}</div>
          </main>
        </div>
      </div>
    </Tooltip.Provider>
  );
}