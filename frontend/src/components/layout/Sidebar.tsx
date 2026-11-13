import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import * as Popover from '@radix-ui/react-popover';
import * as Tooltip from '@radix-ui/react-tooltip';
import { ChevronRight, Search, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { getMenuIcon } from '@/lib/icons';
import { matchesKeyword, splitHighlight } from '@/lib/normalize';
import { formatBadgeCount, Badge } from '@/components/common/Badge';
import type { MenuGroup, MenuItem, MenuSubItem } from '@/types';
import { AREA_HOME, areaFromPath } from '@/lib/areas';

export interface SidebarProps {
  groups: MenuGroup[];
  unreadCount: number;
  collapsed: boolean;
  /** Mở được nhiều mục cha cùng lúc (mặc định). false: mở mục này thì tự đóng mục khác. */
  allowMultiple?: boolean;
  /** Gọi sau khi người dùng chọn một trang (dùng để đóng drawer trên mobile). */
  onNavigate?: () => void;
  /** Ẩn ô lọc khi sidebar ở chế độ drawer hẹp. */
  showFilter?: boolean;
}

function Highlight({ text, keyword }: { text: string; keyword: string }): ReactNode {
  if (!keyword.trim()) return text;
  return (
    <>
      {splitHighlight(text, keyword).map((segment, index) =>
        segment.matched ? (
          <mark
            key={index}
            className="bg-[var(--accent-soft)] font-semibold text-[var(--accent)]"
          >
            {segment.text}
          </mark>
        ) : (
          <span key={index}>{segment.text}</span>
        ),
      )}
    </>
  );
}

/**
 * Mục con đang được chọn của một mục cha: khớp chính xác, nếu không thì lấy đường dẫn tiền tố dài nhất.
 * Vd. /mon-an/them → "Thêm món ăn" (không tô cả "Danh sách món ăn"); /mon-an/5/sua → "Danh sách món ăn".
 */
function findActiveChild(children: MenuSubItem[] | undefined, pathname: string): MenuSubItem | null {
  let best: MenuSubItem | null = null;
  for (const child of children ?? []) {
    if (pathname === child.path || pathname.startsWith(child.path + '/')) {
      if (!best || child.path.length > best.path.length) best = child;
    }
  }
  return best;
}

export function Sidebar({
  groups,
  unreadCount,
  collapsed,
  allowMultiple = true,
  onNavigate,
  showFilter = true,
}: SidebarProps) {
  const location = useLocation();
  /** Trang Dashboard của khu đang xem (/quan-ly hoặc /kho): chỉ tô khi đúng đường dẫn đó. */
  const home = AREA_HOME[areaFromPath(location.pathname)];
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const navRef = useRef<HTMLElement>(null);

  const activeParentId = useMemo(() => {
    for (const group of groups) {
      for (const item of group.items) {
        if (findActiveChild(item.children, location.pathname)) return item.id;
      }
    }
    return null;
  }, [groups, location.pathname]);

  // Mục con đang active thì cha tự mở.
  useEffect(() => {
    if (!activeParentId) return;
    setExpanded((prev) => (prev[activeParentId] ? prev : { ...prev, [activeParentId]: true }));
  }, [activeParentId]);

  const filtered = useMemo(() => {
    const keyword = query.trim();
    if (!keyword) return groups;
    return groups
      .map((group) => {
        const items = group.items.flatMap<MenuItem>((item) => {
          const parentMatches = matchesKeyword(item.label, keyword);
          const childMatches = (item.children ?? []).filter((child) =>
            matchesKeyword(child.label, keyword),
          );
          if (!parentMatches && childMatches.length === 0) return [];
          if (!item.children?.length) return parentMatches ? [item] : [];
          return [
            {
              ...item,
              children: parentMatches && childMatches.length === 0 ? item.children : childMatches,
            },
          ];
        });
        return { ...group, items };
      })
      .filter((group) => group.items.length > 0);
  }, [groups, query]);

  const isFiltering = query.trim().length > 0;
  const matchingParents = useMemo(() => {
    const ids = new Set<string>();
    if (isFiltering) {
      filtered.forEach((group) =>
        group.items.forEach((item) => {
          if (item.children?.length) ids.add(item.id);
        }),
      );
    }
    return ids;
  }, [filtered, isFiltering]);

  const isOpen = (itemId: string): boolean =>
    isFiltering ? matchingParents.has(itemId) : Boolean(expanded[itemId]);

  // Không dựa vào danh sách khóa có sẵn trong state: lần đầu vào trang, menu còn đang tải
  // (groups rỗng) nên state khởi tạo là {} — trước đây toggle duyệt khóa của {} và không mở được gì.
  const toggle = (itemId: string): void => {
    setExpanded((prev) =>
      allowMultiple ? { ...prev, [itemId]: !prev[itemId] } : { [itemId]: !prev[itemId] },
    );
  };

  const badgeFor = (item: MenuItem): { count: number; variant: 'accent' | 'danger' } | null => {
    if (!item.badge) return null;
    const count = item.badge.source === 'notifications' ? unreadCount : item.badge.count ?? 0;
    if (count <= 0) return null;
    return { count, variant: item.badge.variant ?? 'accent' };
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLElement>): void => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    const nodes = Array.from(
      navRef.current?.querySelectorAll<HTMLElement>('a[href], button:not([disabled])') ?? [],
    ).filter((node) => node.offsetParent !== null);
    if (nodes.length === 0) return;
    const index = nodes.indexOf(document.activeElement as HTMLElement);
    event.preventDefault();
    const next =
      event.key === 'ArrowDown'
        ? nodes[(index + 1 + nodes.length) % nodes.length]
        : nodes[(index - 1 + nodes.length) % nodes.length];
    next?.focus();
  };

  // Dùng Link + tự tính trạng thái chọn (findActiveChild) thay cho NavLink: NavLink coi /mon-an là đang chọn
  // cả khi ở /mon-an/them nên tô xanh cả hai mục con.
  const renderSubItem = (sub: MenuSubItem, parentId: string, siblings: MenuSubItem[]): ReactNode => {
    const isActive = findActiveChild(siblings, location.pathname)?.id === sub.id;
    return (
      <li key={sub.id}>
        <Link
          to={sub.path}
          onClick={onNavigate}
          aria-current={isActive ? 'page' : undefined}
          className={cn(
            'group relative flex min-h-[36px] items-center rounded-[10px] px-3 py-2 text-[14px] leading-5 transition-colors duration-150',
            'before:absolute before:-left-[13px] before:top-1/2 before:h-[calc(100%-10px)] before:w-[3px] before:-translate-y-1/2 before:rounded-full before:transition-colors',
            isActive
              ? 'bg-[var(--accent-soft)] font-semibold text-[var(--accent)] before:bg-[var(--accent)]'
              : 'text-[var(--text-secondary)] before:bg-transparent hover:bg-[var(--bg-subtle)] hover:text-[var(--accent)]',
          )}
          aria-label={sub.label}
          data-parent={parentId}
        >
          <Highlight text={sub.label} keyword={query} />
        </Link>
      </li>
    );
  };

  const renderItem = (item: MenuItem): ReactNode => {
    const Icon = getMenuIcon(item.icon);
    const hasChildren = Boolean(item.children?.length);
    const open = hasChildren && isOpen(item.id);
    const containsActive = Boolean(findActiveChild(item.children, location.pathname));
    const badge = badgeFor(item);

    if (collapsed) {
      if (hasChildren) {
        return (
          <li key={item.id}>
            <Popover.Root>
              <Popover.Trigger asChild>
                <button
                  type="button"
                  aria-label={item.label}
                  className={cn(
                    'relative flex h-11 w-full items-center justify-center rounded-control transition-colors duration-150',
                    containsActive || activeParentId === item.id
                      ? 'bg-[var(--accent-soft)] text-[var(--accent)]'
                      : 'text-[var(--text-secondary)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent)]',
                  )}
                >
                  <Icon size={20} strokeWidth={1.75} aria-hidden />
                </button>
              </Popover.Trigger>
              <Popover.Portal>
                <Popover.Content
                  side="right"
                  align="start"
                  sideOffset={10}
                  className="z-[60] w-[224px] rounded-item border border-[var(--border)] bg-[var(--bg-surface)] p-2 shadow-overlay"
                >
                  <p className="px-2 pb-1.5 text-[13px] font-semibold text-[var(--text-primary)]">
                    {item.label}
                  </p>
                  <ul className="space-y-0.5">{item.children?.map((sub) => renderSubItem(sub, item.id, item.children ?? []))}</ul>
                </Popover.Content>
              </Popover.Portal>
            </Popover.Root>
          </li>
        );
      }

      return (
        <li key={item.id}>
          <Tooltip.Root>
            <Tooltip.Trigger asChild>
              <NavLink
                to={item.path ?? home}
                end={item.path === home}
                onClick={onNavigate}
                aria-label={item.label}
                className={({ isActive }) =>
                  cn(
                    'relative flex h-11 w-full items-center justify-center rounded-control transition-colors duration-150',
                    isActive
                      ? 'bg-[var(--accent-soft)] text-[var(--accent)]'
                      : 'text-[var(--text-secondary)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent)]',
                  )
                }
              >
                <Icon size={20} strokeWidth={1.75} aria-hidden />
                {badge ? (
                  <span
                    className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-[var(--danger)]"
                    aria-hidden
                  />
                ) : null}
              </NavLink>
            </Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Content
                side="right"
                sideOffset={10}
                className="z-[70] rounded-[8px] bg-[var(--text-primary)] px-2.5 py-1.5 text-[12.5px] font-medium text-[var(--bg-surface)] shadow-overlay"
              >
                {item.label}
                {badge ? <span className="ml-1.5 font-mono">({formatBadgeCount(badge.count)})</span> : null}
              </Tooltip.Content>
            </Tooltip.Portal>
          </Tooltip.Root>
        </li>
      );
    }

    if (!hasChildren) {
      return (
        <li key={item.id}>
          <NavLink
            to={item.path ?? home}
            end={item.path === home}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                'flex min-h-[44px] items-center gap-3 rounded-control px-3 py-2.5 text-[15px] font-medium transition-colors duration-150',
                isActive
                  ? 'bg-[var(--accent-soft)] font-semibold text-[var(--accent)]'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent)]',
              )
            }
          >
            <Icon size={20} strokeWidth={1.75} aria-hidden className="shrink-0" />
            <span className="min-w-0 flex-1 truncate">
              <Highlight text={item.label} keyword={query} />
            </span>
            {badge ? (
              <Badge variant={badge.variant} mono className="shrink-0">
                {formatBadgeCount(badge.count)}
              </Badge>
            ) : null}
          </NavLink>
        </li>
      );
    }

    return (
      <li key={item.id}>
        <button
          type="button"
          onClick={() => toggle(item.id)}
          aria-expanded={open}
          aria-controls={`menu-${item.id}`}
          className={cn(
            'flex min-h-[44px] w-full items-center gap-3 rounded-control px-3 py-2.5 text-left text-[15px] font-medium transition-colors duration-150',
            activeParentId === item.id && !open
              ? 'text-[var(--accent)]'
              : 'text-[var(--text-secondary)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent)]',
            activeParentId === item.id && open && 'text-[var(--accent)]',
          )}
        >
          <Icon size={20} strokeWidth={1.75} aria-hidden className="shrink-0" />
          <span className="min-w-0 flex-1 truncate">
            <Highlight text={item.label} keyword={query} />
          </span>
          {badge ? (
            <Badge variant={badge.variant} mono className="shrink-0">
              {formatBadgeCount(badge.count)}
            </Badge>
          ) : null}
          <ChevronRight
            size={16}
            strokeWidth={2}
            aria-hidden
            className={cn(
              'shrink-0 text-[var(--text-muted)] transition-transform duration-200 ease-smooth',
              open && 'rotate-90',
            )}
          />
        </button>

        <div
          id={`menu-${item.id}`}
          className={cn(
            'grid transition-[grid-template-rows,opacity] duration-200 ease-smooth',
            open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
          )}
          aria-hidden={!open}
        >
          <div className="overflow-hidden">
            <ul className="relative ml-5 mt-1 space-y-0.5 border-l border-[var(--border)] pl-3">
              {item.children?.map((sub) => renderSubItem(sub, item.id, item.children ?? []))}
            </ul>
          </div>
        </div>
      </li>
    );
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      {showFilter ? (
        <div className={cn('shrink-0', collapsed ? 'px-2 py-3' : 'px-3 pb-3 pt-1')}>
          {collapsed ? (
            <div className="flex justify-center">
              <Tooltip.Root>
                <Tooltip.Trigger asChild>
                  <button
                    type="button"
                    aria-label="Lọc menu"
                    className="grid h-10 w-10 place-items-center rounded-control text-[var(--text-muted)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)]"
                  >
                    <Search size={18} strokeWidth={1.75} />
                  </button>
                </Tooltip.Trigger>
                <Tooltip.Portal>
                  <Tooltip.Content
                    side="right"
                    sideOffset={10}
                    className="z-[70] rounded-[8px] bg-[var(--text-primary)] px-2.5 py-1.5 text-[12.5px] text-[var(--bg-surface)]"
                  >
                    Mở rộng sidebar để lọc menu
                  </Tooltip.Content>
                </Tooltip.Portal>
              </Tooltip.Root>
            </div>
          ) : (
            <div className="relative">
              <Search
                size={15}
                strokeWidth={1.75}
                aria-hidden
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
              />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Lọc menu…"
                aria-label="Lọc menu"
                className="h-9 w-full rounded-pill border border-[var(--border)] bg-[var(--bg-subtle)] pl-9 pr-8 text-[13.5px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:bg-[var(--bg-surface)] focus:outline-none"
              />
              {query ? (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  aria-label="Xoá lọc menu"
                  className="absolute right-2 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-full text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
                >
                  <X size={13} strokeWidth={2} />
                </button>
              ) : null}
            </div>
          )}
        </div>
      ) : null}

      <nav
        ref={navRef}
        aria-label="Menu quản lý nhà hàng"
        onKeyDown={handleKeyDown}
        className="ghost-scroll min-h-0 flex-1 px-2 pb-4"
      >
        {filtered.length === 0 ? (
          <p className="px-3 py-6 text-center text-[13px] text-[var(--text-muted)]">
            Không tìm thấy
          </p>
        ) : (
          <div className="space-y-1">
            {filtered.map((group) => (
              <div key={group.id} className={cn(group.label ? 'pt-3 first:pt-0' : '')}>
                {group.label && !collapsed ? (
                  <p className="mb-1.5 truncate px-3 text-[12px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
                    <Highlight text={group.label} keyword={query} />
                  </p>
                ) : null}
                {group.label && collapsed ? (
                  <div className="mx-auto mb-2 mt-1 h-px w-6 bg-[var(--border)]" aria-hidden />
                ) : null}
                <ul className="space-y-0.5">{group.items.map((item) => renderItem(item))}</ul>
              </div>
            ))}
          </div>
        )}
      </nav>
    </div>
  );
}
