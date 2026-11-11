import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as Popover from '@radix-ui/react-popover';
import { useQuery } from '@tanstack/react-query';
import { CornerDownLeft, History, Loader2, Search, X } from 'lucide-react';
import { getRecentPages, rememberPage, searchPages } from '@/api/search';
import { cn } from '@/lib/cn';
import { matchesKeyword, splitHighlight } from '@/lib/normalize';
import type { PageSuggestion } from '@/types';

export interface SearchBoxProps {
  /** Tên trang hiện tại để ghim lên đầu danh sách "Gần đây" với nhãn "Đang xem". */
  currentPage: PageSuggestion | null;
  /** Chế độ chỉ hiện nút biểu tượng (mobile). */
  compact?: boolean;
}

function Highlight({ text, keyword }: { text: string; keyword: string }) {
  if (!keyword.trim()) return <>{text}</>;
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

export function SearchBox({ currentPage, compact = false }: SearchBoxProps) {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [debounced, setDebounced] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(keyword.trim()), 180);
    return () => clearTimeout(timer);
  }, [keyword]);

  const recentQuery = useQuery({
    queryKey: ['search', 'recent'],
    queryFn: getRecentPages,
    enabled: open && debounced.length === 0,
    staleTime: 10_000,
  });

  const searchQuery = useQuery({
    queryKey: ['search', 'pages', debounced],
    queryFn: () => searchPages(debounced),
    enabled: open && debounced.length > 0,
    staleTime: 30_000,
  });

  const suggestions = useMemo<PageSuggestion[]>(() => {
    if (debounced.length > 0) return searchQuery.data ?? [];
    const base: PageSuggestion[] = [];
    if (currentPage) base.push(currentPage);
    (recentQuery.data ?? []).forEach((page) => {
      if (page.path !== currentPage?.path) base.push(page);
    });
    return base.slice(0, 6);
  }, [currentPage, debounced, recentQuery.data, searchQuery.data]);

  const isLoading =
    debounced.length > 0 ? searchQuery.isFetching : recentQuery.isFetching && open;

  const go = useCallback(
    (page: PageSuggestion) => {
      rememberPage(page.path);
      navigate(page.path);
      setKeyword('');
      setDebounced('');
      setOpen(false);
      inputRef.current?.blur();
    },
    [navigate],
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen(true);
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    setActiveIndex(0);
  }, [debounced, open]);

  const handleInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      setOpen(false);
      inputRef.current?.blur();
      return;
    }
    if (suggestions.length === 0) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((index) => (index + 1) % suggestions.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((index) => (index - 1 + suggestions.length) % suggestions.length);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const target = suggestions[activeIndex] ?? suggestions[0];
      if (target) go(target);
    }
  };

  const filtered = Boolean(debounced) && !isLoading && suggestions.length === 0;

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Anchor asChild>
        <div className={cn('relative', compact ? 'w-10' : 'w-full')}>
          <Popover.Trigger asChild>
            <button
              type="button"
              aria-label="Tìm kiếm hoặc chuyển trang nhanh"
              onClick={() => {
                setOpen(true);
                inputRef.current?.focus();
              }}
              className={cn(
                'flex items-center gap-2 rounded-pill border border-[var(--border)] bg-[var(--bg-subtle)] text-left transition-colors duration-150 hover:border-[var(--border-strong)]',
                compact ? 'h-10 w-10 justify-center' : 'h-10 w-full pl-3.5 pr-2.5',
              )}
            >
              <Search size={16} strokeWidth={1.75} aria-hidden className="shrink-0 text-[var(--text-muted)]" />
              {compact ? null : (
                <>
                  <input
                    ref={inputRef}
                    value={keyword}
                    onChange={(event) => setKeyword(event.target.value)}
                    onKeyDown={handleInputKeyDown}
                    onFocus={() => setOpen(true)}
                    placeholder="Tìm trang, chức năng…"
                    aria-label="Tìm kiếm hoặc chuyển trang nhanh"
                    aria-expanded={open}
                    aria-autocomplete="list"
                    className="h-full min-w-0 flex-1 bg-transparent text-[14px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none"
                  />
                  {keyword ? (
                    <span
                      role="button"
                      tabIndex={0}
                      aria-label="Xoá từ khoá"
                      onClick={(event) => {
                        event.stopPropagation();
                        setKeyword('');
                        inputRef.current?.focus();
                      }}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          setKeyword('');
                        }
                      }}
                      className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
                    >
                      <X size={13} strokeWidth={2} />
                    </span>
                  ) : (
                    <kbd className="hidden shrink-0 items-center gap-0.5 rounded-[6px] border border-[var(--border)] bg-[var(--bg-surface)] px-1.5 py-0.5 font-mono text-[10.5px] text-[var(--text-muted)] sm:inline-flex">
                      ⌘K
                    </kbd>
                  )}
                </>
              )}
            </button>
          </Popover.Trigger>
        </div>
      </Popover.Anchor>

      <Popover.Portal>
        <Popover.Content
          side="bottom"
          align="start"
          sideOffset={8}
          collisionPadding={12}
          onOpenAutoFocus={(event) => {
            if (compact) return;
            event.preventDefault();
            inputRef.current?.focus();
          }}
          className="z-[60] w-[min(420px,calc(100vw-24px))] overflow-hidden rounded-item border border-[var(--border)] bg-[var(--bg-surface)] shadow-overlay"
        >
          {compact ? (
            <div className="border-b border-[var(--border)] p-2">
              <div className="relative">
                <Search
                  size={15}
                  strokeWidth={1.75}
                  aria-hidden
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
                />
                <input
                  autoFocus
                  value={keyword}
                  onChange={(event) => setKeyword(event.target.value)}
                  onKeyDown={handleInputKeyDown}
                  placeholder="Tìm trang, chức năng…"
                  aria-label="Tìm kiếm trang"
                  className="h-9 w-full rounded-pill border border-[var(--border)] bg-[var(--bg-subtle)] pl-9 pr-3 text-[14px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:bg-[var(--bg-surface)] focus:outline-none"
                />
              </div>
            </div>
          ) : null}

          <div className="px-3 pb-1.5 pt-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
              {debounced ? 'Kết quả' : 'Gần đây'}
            </p>
          </div>

          <div role="listbox" aria-label="Trang gợi ý" className="max-h-[300px] overflow-y-auto px-1.5 pb-1.5">
            {isLoading ? (
              <div className="flex items-center gap-2 px-3 py-4 text-[13px] text-[var(--text-muted)]">
                <Loader2 size={14} className="animate-spin" aria-hidden />
                Đang tìm…
              </div>
            ) : filtered ? (
              <p className="px-3 py-5 text-center text-[13px] text-[var(--text-muted)]">
                Không tìm thấy trang phù hợp
              </p>
            ) : suggestions.length === 0 ? (
              <p className="px-3 py-5 text-center text-[13px] text-[var(--text-muted)]">
                Chưa có trang nào gần đây
              </p>
            ) : (
              suggestions.map((page, index) => {
                const isCurrent = !debounced && currentPage?.path === page.path;
                return (
                  <button
                    key={`${page.id}-${index}`}
                    type="button"
                    role="option"
                    aria-selected={index === activeIndex}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => go(page)}
                    className={cn(
                      'flex min-h-[42px] w-full items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-left transition-colors duration-100',
                      index === activeIndex ? 'bg-[var(--accent-soft)]' : 'hover:bg-[var(--bg-subtle)]',
                    )}
                  >
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-[8px] bg-[var(--bg-subtle)] text-[var(--text-muted)]">
                      <History size={14} strokeWidth={1.75} aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13.5px] font-medium text-[var(--text-primary)]">
                        <Highlight text={page.label} keyword={debounced} />
                      </span>
                      <span className="block truncate text-[11.5px] text-[var(--text-muted)]">
                        <Highlight text={page.context} keyword={debounced} />
                      </span>
                    </span>
                    {isCurrent ? (
                      <span className="shrink-0 rounded-pill bg-[var(--accent-soft)] px-2 py-[3px] text-[10.5px] font-semibold text-[var(--accent)]">
                        Đang xem
                      </span>
                    ) : null}
                  </button>
                );
              })
            )}
          </div>

          <div className="flex items-center justify-between gap-2 border-t border-[var(--border)] px-3 py-2 text-[11px] text-[var(--text-muted)]">
            <span className="inline-flex items-center gap-1">
              <kbd className="rounded-[4px] border border-[var(--border)] px-1 font-mono">↑</kbd>
              <kbd className="rounded-[4px] border border-[var(--border)] px-1 font-mono">↓</kbd>
              để chọn
            </span>
            <span className="inline-flex items-center gap-1">
              <CornerDownLeft size={12} aria-hidden />
              mở trang
            </span>
            <span className="inline-flex items-center gap-1">
              <kbd className="rounded-[4px] border border-[var(--border)] px-1 font-mono">Esc</kbd>
              đóng
            </span>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

/** Lấy gợi ý cho trang hiện tại từ toàn bộ danh sách trang (khớp theo path). */
export function findCurrentPage(
  pathname: string,
  pages: PageSuggestion[],
): PageSuggestion | null {
  const exact = pages.find((page) => page.path === pathname);
  if (exact) return exact;
  return (
    pages.find((page) => matchesKeyword(page.label, pathname.replace('/', ''))) ?? null
  );
}