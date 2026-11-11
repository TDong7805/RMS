import type { ReactNode, ThHTMLAttributes, TdHTMLAttributes } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Skeleton } from './Skeleton';

/* ---------------------------------------------------------------- PageHeader */

export interface PageHeaderProps {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}

export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="truncate text-[26px] font-bold leading-tight tracking-[-0.02em] text-[var(--text-primary)] sm:text-[30px]">
          {title}
        </h1>
        {description ? (
          <p className="mt-1 text-[14px] text-[var(--text-secondary)]">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

/* ---------------------------------------------------------------- Toolbar */

export function Toolbar({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-2 border-b border-[var(--border)] px-4 py-3 sm:px-5',
        className,
      )}
    >
      {children}
    </div>
  );
}

/* ---------------------------------------------------------------- Table */

export function DataTable({ children, minWidth = 720 }: { children: ReactNode; minWidth?: number }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left text-[13.5px]" style={{ minWidth }}>
        {children}
      </table>
    </div>
  );
}

export function Th({ className, ...rest }: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cn(
        'whitespace-nowrap border-b border-[var(--border)] bg-[var(--bg-subtle)] px-4 py-2.5 text-[11.5px] font-semibold uppercase tracking-[0.05em] text-[var(--text-muted)] first:pl-5 last:pr-5',
        className,
      )}
      {...rest}
    />
  );
}

export function Td({ className, ...rest }: TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td
      className={cn(
        'border-b border-[var(--border)] px-4 py-3 align-middle text-[var(--text-primary)] first:pl-5 last:pr-5',
        className,
      )}
      {...rest}
    />
  );
}

export function TableSkeleton({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="divide-y divide-[var(--border)]">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex items-center gap-4 px-5 py-3.5">
          {Array.from({ length: cols }).map((__, c) => (
            <Skeleton key={c} className={cn('h-3 rounded-full', c === 0 ? 'w-16' : 'flex-1')} />
          ))}
        </div>
      ))}
    </div>
  );
}

/* ---------------------------------------------------------------- Pagination */

export interface PaginationProps {
  page: number;
  pageCount: number;
  total: number;
  pageSize: number;
  onChange: (page: number) => void;
  unit?: string;
}

export function Pagination({ page, pageCount, total, pageSize, onChange, unit = 'bản ghi' }: PaginationProps) {
  if (total === 0) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);

  const pages: (number | '…')[] = [];
  for (let p = 1; p <= pageCount; p += 1) {
    if (p === 1 || p === pageCount || Math.abs(p - page) <= 1) pages.push(p);
    else if (pages[pages.length - 1] !== '…') pages.push('…');
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 sm:px-5">
      <p className="text-[12.5px] text-[var(--text-muted)]">
        Hiển thị <span className="font-mono font-semibold text-[var(--text-primary)]">{from}–{to}</span> trên{' '}
        <span className="font-mono font-semibold text-[var(--text-primary)]">{total}</span> {unit}
      </p>
      {pageCount > 1 ? (
        <nav aria-label="Phân trang" className="flex items-center gap-1">
          <PageButton disabled={page <= 1} onClick={() => onChange(page - 1)} label="Trang trước">
            <ChevronLeft size={15} />
          </PageButton>
          {pages.map((p, i) =>
            p === '…' ? (
              <span key={`gap-${i}`} className="px-1 text-[12px] text-[var(--text-muted)]">
                …
              </span>
            ) : (
              <PageButton key={p} active={p === page} onClick={() => onChange(p)} label={`Trang ${p}`}>
                {p}
              </PageButton>
            ),
          )}
          <PageButton disabled={page >= pageCount} onClick={() => onChange(page + 1)} label="Trang sau">
            <ChevronRight size={15} />
          </PageButton>
        </nav>
      ) : null}
    </div>
  );
}

function PageButton({
  children,
  active,
  disabled,
  onClick,
  label,
}: {
  children: ReactNode;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-current={active ? 'page' : undefined}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'grid h-8 min-w-8 place-items-center rounded-[9px] px-2 font-mono text-[12.5px] font-semibold transition-colors disabled:opacity-40',
        active
          ? 'bg-[var(--accent)] text-[var(--accent-contrast)]'
          : 'text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)]',
      )}
    >
      {children}
    </button>
  );
}

/* ---------------------------------------------------------------- Tabs */

export interface TabItem<T extends string> {
  value: T;
  label: string;
  icon?: ReactNode;
}

export function PageTabs<T extends string>({
  items,
  value,
  onChange,
  ariaLabel,
}: {
  items: TabItem<T>[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
}) {
  return (
    <div role="tablist" aria-label={ariaLabel} className="flex gap-1 overflow-x-auto border-b border-[var(--border)]">
      {items.map((item) => {
        const active = item.value === value;
        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(item.value)}
            className={cn(
              '-mb-px inline-flex shrink-0 items-center gap-2 border-b-2 px-3 py-2.5 text-[14px] font-semibold transition-colors',
              active
                ? 'border-[var(--accent)] text-[var(--accent)]'
                : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]',
            )}
          >
            {item.icon}
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

/* ---------------------------------------------------------------- Detail list */

export function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[130px_minmax(0,1fr)] gap-3 border-b border-[var(--border)] py-2.5 last:border-b-0 sm:grid-cols-[160px_minmax(0,1fr)]">
      <dt className="text-[13px] text-[var(--text-muted)]">{label}</dt>
      <dd className="min-w-0 break-words text-[14px] text-[var(--text-primary)]">{children}</dd>
    </div>
  );
}

/* ---------------------------------------------------------------- Stat tile */

export function StatTile({
  label,
  value,
  hint,
  tone = 'default',
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: 'default' | 'warning' | 'danger' | 'accent';
}) {
  return (
    <div className="rounded-item border border-[var(--border)] bg-[var(--bg-surface)] px-4 py-3.5">
      <p className="text-[12.5px] font-medium text-[var(--text-muted)]">{label}</p>
      <p
        className={cn(
          'mt-1 font-mono text-[24px] font-bold tabular-nums leading-tight',
          tone === 'warning' && 'text-[var(--warning)]',
          tone === 'danger' && 'text-[var(--danger)]',
          tone === 'accent' && 'text-[var(--accent)]',
          tone === 'default' && 'text-[var(--text-primary)]',
        )}
      >
        {value}
      </p>
      {hint ? <p className="mt-0.5 text-[12px] text-[var(--text-muted)]">{hint}</p> : null}
    </div>
  );
}
