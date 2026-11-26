import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import * as Dialog from '@radix-ui/react-dialog';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowRight,
  ClipboardList,
  CornerDownLeft,
  FilePlus2,
  History,
  KeyRound,
  LogOut,
  Moon,
  PackagePlus,
  PanelLeft,
  Search,
  Sun,
  Truck,
  UserPlus,
  UtensilsCrossed,
} from 'lucide-react';
import { getRecentPages, pagesOf, rememberPage } from '@/api/search';
import { areaFromPath, type AreaKey } from '@/lib/areas';
import { useLogout } from '@/lib/auth';
import { cn } from '@/lib/cn';
import { matchesKeyword, splitHighlight } from '@/lib/normalize';
import { useUiStore } from '@/lib/ui-store';
import type { PageSuggestion } from '@/types';

/**
 * Bảng lệnh Ctrl+K (theo Linear — docs/thiet-ke/QUY_TAC_GIAO_DIEN.md):
 * một ô nổi giữa màn để ĐI TỚI trang và LÀM VIỆC nhanh, không phải tìm dữ liệu.
 * Nhóm: Gần đây / Đi tới · Tạo mới · Hệ thống. Mỗi dòng: biểu tượng · tên · ngữ cảnh · phím tắt bên phải.
 * Ô lọc trong từng trang vẫn giữ (lọc dữ liệu của trang đó).
 */

type GroupName = 'Gần đây' | 'Đi tới' | 'Tạo mới' | 'Hệ thống';

interface Command {
  id: string;
  group: GroupName;
  label: string;
  hint?: string;
  icon: ReactNode;
  shortcut?: string[];
  run: () => void;
}

/** Việc tạo mới hay dùng của từng khu (chỉ đường dẫn có thật trong routes.tsx). */
const CREATE: Record<AreaKey, { label: string; hint: string; path: string; icon: ReactNode }[]> = {
  manager: [
    { label: 'Thêm món ăn', hint: 'Thực đơn', path: '/quan-ly/mon-an/them', icon: <UtensilsCrossed size={16} /> },
    { label: 'Thêm set menu', hint: 'Thực đơn › Set menu', path: '/quan-ly/mon-an/set-menu/them', icon: <UtensilsCrossed size={16} /> },
    { label: 'Thêm tài khoản nhân viên', hint: 'Tài khoản', path: '/quan-ly/tai-khoan/them', icon: <UserPlus size={16} /> },
    { label: 'Thêm bài viết', hint: 'Bài viết', path: '/quan-ly/bai-viet/them', icon: <FilePlus2 size={16} /> },
  ],
  warehouse: [
    { label: 'Thêm nguyên liệu', hint: 'Nguyên liệu', path: '/kho/nguyen-lieu/them', icon: <PackagePlus size={16} /> },
    { label: 'Tạo phiếu mua', hint: 'Phiếu mua', path: '/kho/phieu-mua/them', icon: <ClipboardList size={16} /> },
    { label: 'Nhận hàng theo phiếu mua', hint: 'Nhập kho', path: '/kho/nhap-kho/theo-phieu-mua', icon: <Truck size={16} /> },
    { label: 'Nhập kho không phiếu', hint: 'Nhập kho', path: '/kho/nhap-kho/khong-phieu', icon: <PackagePlus size={16} /> },
    { label: 'Tạo phiếu xuất', hint: 'Xuất kho', path: '/kho/xuat-kho/them', icon: <ClipboardList size={16} /> },
    { label: 'Thêm nhà cung cấp', hint: 'Nhà cung cấp', path: '/kho/nha-cung-cap/them', icon: <UserPlus size={16} /> },
  ],
  cashier: [],
};

function Highlight({ text, keyword }: { text: string; keyword: string }) {
  if (!keyword.trim()) return <>{text}</>;
  return (
    <>
      {splitHighlight(text, keyword).map((s, i) =>
        s.matched ? <mark key={i} className="bg-transparent font-semibold text-[var(--accent)]">{s.text}</mark> : <span key={i}>{s.text}</span>,
      )}
    </>
  );
}

function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded-[5px] border border-[var(--border)] bg-[var(--bg-subtle)] px-1 font-mono text-[10.5px] font-medium text-[var(--text-muted)]">
      {children}
    </kbd>
  );
}

export interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const area = areaFromPath(pathname);
  const logout = useLogout();
  const theme = useUiStore((s) => s.theme);
  const toggleTheme = useUiStore((s) => s.toggleTheme);
  const collapsed = useUiStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useUiStore((s) => s.toggleSidebar);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const recent = useQuery({
    queryKey: ['search', 'recent', area],
    queryFn: () => getRecentPages(area),
    enabled: open,
    staleTime: 10_000,
  });

  useEffect(() => {
    if (open) { setQuery(''); setActive(0); }
  }, [open]);

  const go = (path: string) => {
    rememberPage(path, area);
    onOpenChange(false);
    navigate(path);
  };

  const commands = useMemo<Command[]>(() => {
    const keyword = query.trim();
    const pageCmd = (p: PageSuggestion, group: GroupName): Command => ({
      id: `${group}-${p.path}`,
      group,
      label: p.label,
      hint: p.context,
      icon: group === 'Gần đây' ? <History size={16} /> : <ArrowRight size={16} />,
      run: () => go(p.path),
    });
    const create: Command[] = CREATE[area].map((c) => ({
      id: `create-${c.path}-${c.label}`, group: 'Tạo mới', label: c.label, hint: c.hint, icon: c.icon, run: () => go(c.path),
    }));
    const system: Command[] = [
      {
        id: 'theme', group: 'Hệ thống',
        label: theme === 'dark' ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối',
        icon: theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />,
        run: () => { toggleTheme(); onOpenChange(false); },
      },
      {
        id: 'sidebar', group: 'Hệ thống', label: collapsed ? 'Ghim menu trái' : 'Thu gọn menu trái',
        icon: <PanelLeft size={16} />, shortcut: ['['],
        run: () => { toggleSidebar(); onOpenChange(false); },
      },
      { id: 'password', group: 'Hệ thống', label: 'Đổi mật khẩu', icon: <KeyRound size={16} />, run: () => go('/doi-mat-khau') },
      {
        id: 'logout', group: 'Hệ thống', label: 'Đăng xuất', icon: <LogOut size={16} />,
        run: () => { onOpenChange(false); logout.mutate(); },
      },
    ];
    if (!keyword) {
      return [...(recent.data ?? []).slice(0, 5).map((p) => pageCmd(p, 'Gần đây')), ...create, ...system];
    }
    // Trang "thêm mới" đã có trong nhóm Tạo mới → không lặp lại ở Đi tới.
    const createPaths = new Set(CREATE[area].map((c) => c.path));
    const pages = pagesOf(area)
      .filter((p) => !createPaths.has(p.path))
      .filter((p) => matchesKeyword(p.label, keyword) || matchesKeyword(p.context, keyword))
      .slice(0, 8)
      .map((p) => pageCmd(p, 'Đi tới'));
    const match = (c: Command) => matchesKeyword(c.label, keyword) || matchesKeyword(c.hint ?? '', keyword);
    return [...pages, ...create.filter(match), ...system.filter(match)];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, area, recent.data, theme, collapsed]);

  useEffect(() => { setActive(0); }, [query]);

  // Giữ dòng đang chọn trong tầm nhìn khi đi bằng phím mũi tên.
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!commands.length) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => (i + 1) % commands.length); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => (i - 1 + commands.length) % commands.length); }
    else if (e.key === 'Enter') { e.preventDefault(); commands[active]?.run(); }
  };

  let lastGroup: GroupName | null = null;

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[90] bg-[rgba(15,26,20,0.32)] backdrop-blur-[2px] data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <Dialog.Content
          aria-describedby={undefined}
          onKeyDown={onKeyDown}
          className="fixed left-1/2 top-[12vh] z-[91] w-[min(640px,calc(100vw-24px))] -translate-x-1/2 overflow-hidden rounded-[16px] border border-[var(--border)] bg-[var(--bg-surface)] shadow-overlay data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-[0.98]"
        >
          <Dialog.Title className="sr-only">Bảng lệnh</Dialog.Title>
          <div className="flex items-center gap-3 border-b border-[var(--border)] px-4">
            <Search size={17} strokeWidth={1.9} className="shrink-0 text-[var(--text-muted)]" aria-hidden />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Gõ tên trang hoặc việc cần làm…"
              aria-label="Tìm trang hoặc lệnh"
              className="h-[54px] min-w-0 flex-1 bg-transparent text-[15px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none"
            />
            <Kbd>Esc</Kbd>
          </div>

          <div ref={listRef} role="listbox" aria-label="Lệnh" className="max-h-[min(420px,60vh)] overflow-y-auto p-2">
            {commands.length === 0 ? (
              <div className="px-3 py-10 text-center">
                <p className="text-[14px] font-medium text-[var(--text-primary)]">Không có trang hay lệnh phù hợp</p>
                <p className="mt-1 text-[12.5px] text-[var(--text-muted)]">Thử gõ ngắn hơn, ví dụ "món", "phiếu", "lương".</p>
              </div>
            ) : (
              commands.map((c, index) => {
                const header = c.group !== lastGroup ? c.group : null;
                lastGroup = c.group;
                return (
                  <div key={c.id}>
                    {header ? (
                      <p className="px-2.5 pb-1 pt-2.5 text-[11.5px] font-semibold text-[var(--text-muted)] first:pt-1">{header}</p>
                    ) : null}
                    <button
                      type="button"
                      role="option"
                      data-index={index}
                      aria-selected={index === active}
                      onMouseMove={() => setActive(index)}
                      onClick={c.run}
                      className={cn(
                        'flex h-11 w-full items-center gap-3 rounded-[10px] px-2.5 text-left transition-colors duration-75',
                        index === active && 'bg-[var(--accent-soft)]',
                      )}
                    >
                      <span className={cn('grid h-7 w-7 shrink-0 place-items-center rounded-[8px]', index === active ? 'text-[var(--accent)]' : 'text-[var(--text-muted)]')}>
                        {c.icon}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-[14px] font-medium text-[var(--text-primary)]">
                        <Highlight text={c.label} keyword={query} />
                      </span>
                      {c.hint ? <span className="hidden shrink-0 truncate text-[12.5px] text-[var(--text-muted)] sm:block">{c.hint}</span> : null}
                      {c.shortcut ? (
                        <span className="flex shrink-0 gap-1">{c.shortcut.map((k) => <Kbd key={k}>{k}</Kbd>)}</span>
                      ) : null}
                    </button>
                  </div>
                );
              })
            )}
          </div>

          <div className="flex items-center gap-4 border-t border-[var(--border)] px-4 py-2.5 text-[11.5px] text-[var(--text-muted)]">
            <span className="inline-flex items-center gap-1"><Kbd>↑</Kbd><Kbd>↓</Kbd> chọn</span>
            <span className="inline-flex items-center gap-1"><Kbd><CornerDownLeft size={11} /></Kbd> mở</span>
            <span className="ml-auto inline-flex items-center gap-1"><Kbd>Ctrl</Kbd><Kbd>K</Kbd> mở / đóng bảng lệnh</span>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** Lấy gợi ý cho trang hiện tại từ toàn bộ danh sách trang (khớp theo path). */
export function findCurrentPage(pathname: string, pages: PageSuggestion[]): PageSuggestion | null {
  const exact = pages.find((page) => page.path === pathname);
  if (exact) return exact;
  return pages.find((page) => matchesKeyword(page.label, pathname.replace('/', ''))) ?? null;
}
