import { Link, useLocation } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';
import { AREA_HOME, areaFromPath } from '@/lib/areas';

export interface BreadcrumbProps {
  /** Tên trang hiện tại, lấy từ route + dữ liệu menu. */
  current: string;
  /** Nhãn mục cha nếu trang nằm trong một nhóm chức năng. */
  parent?: string;
  /** Bấm mục cha thì về trang này (vd. Thực đơn → /quan-ly/mon-an). */
  parentTo?: string;
  /** Các cấp giữa mục cha và trang hiện tại (vd. Thực đơn › **Món ăn** › Sửa). */
  trail?: { label: string; to: string }[];
}

const LINK = 'block truncate rounded-[6px] px-1 py-0.5 text-[var(--text-muted)] transition-colors hover:text-[var(--accent)]';
const SEP = (
  <li aria-hidden className="flex shrink-0 items-center text-[var(--text-muted)]">
    <ChevronRight size={13} strokeWidth={2} />
  </li>
);

export function Breadcrumb({ current, parent, parentTo, trail = [] }: BreadcrumbProps) {
  /** "Trang chủ" là Dashboard của khu đang xem (Quản lý: /quan-ly, Kho: /kho). */
  const home = AREA_HOME[areaFromPath(useLocation().pathname)];

  return (
    <nav aria-label="Breadcrumb" className="min-w-0">
      <ol className="flex min-w-0 items-center gap-1.5 text-[13px]">
        <li className="flex shrink-0 items-center">
          <Link
            to={home}
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
              {parentTo ? <Link to={parentTo} className={LINK}>{parent}</Link> : <span className="block truncate px-1 text-[var(--text-muted)]">{parent}</span>}
            </li>
          </>
        ) : null}
        {trail.map((t) => (
          <span key={t.to} className="contents">
            {SEP}
            <li className="min-w-0 shrink-0">
              <Link to={t.to} className={LINK}>{t.label}</Link>
            </li>
          </span>
        ))}
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
