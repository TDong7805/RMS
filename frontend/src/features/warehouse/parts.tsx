import { useCallback, useState, type ReactNode } from 'react';
import { Badge } from '@/components/common/Badge';
import { ConfirmDialog } from '@/components/common/Modal';
import { toDateKey } from '@/lib/mock';
import { STOCK_LEVEL } from './labels';
import type { StockLevel } from '@/types';

/** "2026-11-12" của ngày lệch offset ngày so với hôm nay (giờ địa phương). */
export function dateKeyOffset(offset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return toDateKey(d);
}

export function StockLevelBadge({ level }: { level: StockLevel | null }) {
  if (!level) return <span className="text-[12.5px] text-[var(--text-muted)]">—</span>;
  return <Badge variant={STOCK_LEVEL[level].variant}>{STOCK_LEVEL[level].label}</Badge>;
}

export function ActiveBadge({ active, activeLabel, inactiveLabel }: { active: boolean; activeLabel: string; inactiveLabel: string }) {
  return <Badge variant={active ? 'accent' : 'neutral'}>{active ? activeLabel : inactiveLabel}</Badge>;
}

/** "1.250.000" / "1250000" → 1250000; rỗng hoặc sai → NaN. */
export function parseMoney(text: string): number {
  const raw = text.replace(/[.\s₫đ]/g, '').trim();
  if (!raw) return NaN;
  return /^\d+$/.test(raw) ? Number(raw) : NaN;
}

/** "2,5" / "2.5" → 2.5; rỗng hoặc sai → NaN. */
export function parseQty(text: string): number {
  const raw = text.replace(/\s/g, '').replace(',', '.');
  if (!raw) return NaN;
  return /^\d+(\.\d+)?$/.test(raw) ? Number(raw) : NaN;
}

/** Số lượng đúng quy ước: không âm, tối đa 3 chữ số thập phân. */
export const isQty = (n: number) => Number.isFinite(n) && n >= 0 && Math.abs(Math.round(n * 1000) - n * 1000) < 1e-6;

/**
 * Quy ước chung "Hủy form thêm / sửa": form đã có thay đổi thì hỏi "Bỏ thay đổi?" trước khi rời;
 * chưa thay đổi thì rời ngay. Trả về hàm bọc thao tác rời trang và hộp xác nhận để đặt vào trang.
 */
export function useLeaveGuard(dirty: boolean): { guard: (leave: () => void) => void; dialog: ReactNode } {
  const [pending, setPending] = useState<(() => void) | null>(null);
  const guard = useCallback(
    (leave: () => void) => {
      if (dirty) setPending(() => leave);
      else leave();
    },
    [dirty],
  );
  const dialog = (
    <ConfirmDialog
      open={Boolean(pending)}
      onOpenChange={(open) => !open && setPending(null)}
      title="Bỏ thay đổi?"
      description="Dữ liệu chưa được lưu sẽ bị mất."
      cancelLabel="Ở lại"
      confirmLabel="Bỏ thay đổi"
      onConfirm={() => {
        const leave = pending;
        setPending(null);
        leave?.();
      }}
    />
  );
  return { guard, dialog };
}

/** Ô thông tin nhỏ trong trang chi tiết. */
export function InfoItem({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-[12px] font-medium text-[var(--text-muted)]">{label}</p>
      <div className="mt-0.5 break-words text-[14px] text-[var(--text-primary)]">{children}</div>
    </div>
  );
}
