import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Button } from './Button';

/**
 * Thanh lưu dính đáy cho form dài (docs/thiet-ke/QUY_TAC_GIAO_DIEN.md, quy tắc 4).
 * Hiện khi có thay đổi chưa lưu (hoặc luôn hiện nếu có idleText / summary): "Có thay đổi chưa lưu · Hủy · Lưu". Có thể kèm tóm tắt bên trái
 * (vd. "Giá vốn 182.000 đ / phần · 35% giá bán" ở trang Công thức) hoặc số chỗ còn lỗi.
 */
export interface StickySaveBarProps {
  dirty: boolean;
  saving?: boolean;
  /** Số chỗ chưa hợp lệ (hiện "Còn n chỗ chưa đúng"). */
  errorCount?: number;
  summary?: ReactNode;
  /** Chữ khi chưa có thay đổi (vd. "Chưa có thay đổi"); có thì thanh luôn hiện, nút Lưu mờ tới khi có thay đổi. */
  idleText?: string;
  saveLabel?: string;
  saveIcon?: ReactNode;
  /** Cho bấm nút chính khi nào (mặc định: khi có thay đổi). Vd. phiếu nháp chưa sửa gì vẫn bấm "Đặt hàng" được. */
  canSave?: boolean;
  /** Nút phụ đứng trước nút chính (vd. "Lưu nháp"). */
  extraActions?: ReactNode;
  onSave: () => void;
  onDiscard?: () => void;
  className?: string;
}

export function StickySaveBar({ dirty, saving, errorCount = 0, summary, idleText, saveLabel = 'Lưu', saveIcon, canSave, extraActions, onSave, onDiscard, className }: StickySaveBarProps) {
  if (!dirty && !summary && !idleText) return null;
  return (
    <div className={cn('sticky bottom-0 z-20 -mx-4 mt-6 border-t border-[var(--border)] bg-[var(--bg-surface)] px-4 py-3 shadow-[0_-6px_16px_-10px_rgba(15,26,20,0.18)] sm:-mx-6 sm:px-6', className)}>
      <div className="mx-auto flex w-full max-w-[1440px] flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1 text-[13.5px]">
          {errorCount > 0 ? (
            <span className="font-semibold text-[var(--danger)]">Còn {errorCount} chỗ chưa đúng</span>
          ) : dirty ? (
            <span className="font-medium text-[var(--warning)]">Có thay đổi chưa lưu</span>
          ) : idleText ? (
            <span className="text-[var(--text-muted)]">{idleText}</span>
          ) : null}
          {summary ? <span className={cn('text-[var(--text-secondary)]', (dirty || errorCount > 0 || idleText) && 'ml-3')}>{summary}</span> : null}
        </div>
        {dirty && onDiscard ? <Button variant="ghost" onClick={onDiscard} disabled={saving}>Hủy thay đổi</Button> : null}
        {extraActions}
        <Button onClick={onSave} loading={saving} disabled={!(canSave ?? dirty)} leadingIcon={saveIcon}>{saveLabel}</Button>
      </div>
    </div>
  );
}

/**
 * Thanh thao tác dính đáy cho trang không có nút Lưu chung (vd. phiếu kiểm kê tự lưu từng dòng):
 * tóm tắt bên trái, nút việc chính bên phải (Gửi duyệt, Duyệt / Từ chối…). Cùng kiểu với StickySaveBar.
 */
export function StickyActionBar({ summary, children, className }: { summary?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={cn('sticky bottom-0 z-20 -mx-4 mt-6 border-t border-[var(--border)] bg-[var(--bg-surface)] px-4 py-3 shadow-[0_-6px_16px_-10px_rgba(15,26,20,0.18)] sm:-mx-6 sm:px-6', className)}>
      <div className="mx-auto flex w-full max-w-[1440px] flex-wrap items-center gap-2">
        <div className="min-w-0 flex-1 text-[13.5px] text-[var(--text-secondary)]">{summary}</div>
        {children}
      </div>
    </div>
  );
}
