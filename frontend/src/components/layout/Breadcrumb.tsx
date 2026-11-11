import { Link } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';
import { MANAGER_HOME } from '@/lib/paths';

export interface BreadcrumbProps {
  /** Tên trang hiện tại, lấy từ route + dữ liệu menu. */
  current: string;
  /** Nhãn mục cha nếu trang nằm trong một nhóm chức năng. */
  parent?: string;
}

export function Breadcrumb({ current, parent }: BreadcrumbProps) {
  return (
    <nav aria-label="Breadcrumb" className="min-w-0">
      <ol className="flex min-w-0 items-center gap-1.5 text-[13px]">
        <li className="flex shrink-0 items-center">
          <Link
            to={MANAGER_HOME}
            className="inline-flex items-center gap-1.5 rounded-[6px] px-1 py-0.5 text-[var(--text-muted)] transition-colors hover:text-[var(--accent)]"
          >
            <Home size={13} strokeWidth={1.9} aria-hidden />
            Trang chủ
          </Link>
        </li>
        {parent ? (
          <>
            <li aria-hidden className="flex shrink-0 items-center text-[var(--text-muted)]">
              <ChevronRight size={13} strokeWidth={2} />
            </li>
            <li className="min-w-0 shrink-0">
              <span className="block truncate px-1 text-[var(--text-muted)]">{parent}</span>
            </li>
          </>
        ) : null}
        <li aria-hidden className="flex shrink-0 items-center text-[var(--text-muted)]">
          <ChevronRight size={13} strokeWidth={2} />
        </li>
        <li className="min-w-0">
          <span
            aria-current="page"
            className="block truncate px-1 font-semibold text-[var(--text-primary)]"
          >
            {current}
          </span>
        </li>
      </ol>
    </nav>
  );
}