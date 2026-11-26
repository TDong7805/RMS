import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

/**
 * Đầu trang con (docs/thiet-ke/QUY_TAC_GIAO_DIEN.md, quy tắc 4 + mục B8, C):
 * - Trang thêm / sửa: tiêu đề + mô tả bên trái, nút "Quay lại" có viền bên phải. Nút Lưu chỉ nằm ở thanh dính đáy.
 * - Trang chi tiết: thêm nhãn trạng thái cạnh tiêu đề (`badge`) và nút thao tác bên phải (`actions`), sau nút Quay lại.
 * Rời trang khi chưa lưu thì useUnsavedGuard hỏi trước (nút Quay lại là Link nên cũng được hỏi).
 */
export function SubPageHeader({ title, description, backTo, backLabel = 'Quay lại', badge, actions }: {
  title: ReactNode;
  description?: ReactNode;
  backTo: string;
  backLabel?: string;
  badge?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 sm:flex-nowrap">
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
          <h1 className="min-w-0 truncate text-[26px] font-bold leading-tight tracking-[-0.02em] text-[var(--text-primary)] sm:text-[30px]">{title}</h1>
          {badge}
        </div>
        {description ? <div className="mt-1 text-[13.5px] text-[var(--text-secondary)]">{description}</div> : null}
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <Link
          to={backTo}
          className="inline-flex h-9 items-center gap-1.5 rounded-control border border-[var(--border-strong)] bg-[var(--bg-surface)] px-3.5 text-[13.5px] font-semibold text-[var(--text-primary)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
        >
          <ArrowLeft size={15} /> {backLabel}
        </Link>
        {actions}
      </div>
    </div>
  );
}
