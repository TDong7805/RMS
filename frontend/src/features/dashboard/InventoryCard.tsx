import { AlertTriangle, Boxes, PackageSearch, Receipt, Wallet } from 'lucide-react';
import { Card, CardHeader } from '@/components/common/Card';
import { PeriodFilter } from '@/components/common/PeriodFilter';
import { Skeleton } from '@/components/common/Skeleton';
import { BlockError, EmptyState } from '@/components/common/EmptyState';
import { Badge } from '@/components/common/Badge';
import { cn } from '@/lib/cn';
import { formatCurrency, formatNumber, formatQuantity, statusLabel } from '@/lib/format';
import type { PeriodKey, StockStatus } from '@/types';
import { useInventoryQuery } from './hooks';

export interface InventoryCardProps {
  period: PeriodKey;
  onPeriodChange: (period: PeriodKey) => void;
}

const STATUS_VARIANT: Record<StockStatus, 'danger' | 'warning' | 'accent'> = {
  out: 'danger',
  low: 'warning',
  ok: 'accent',
};

export function InventoryCard({ period, onPeriodChange }: InventoryCardProps) {
  const query = useInventoryQuery(period);

  return (
    <Card padded className="@container/card">
      <CardHeader
        title="Kho trong kỳ"
        description="Chi phí nhập, phiếu chờ nhận và tồn kho hiện tại."
        icon={<Boxes size={17} strokeWidth={1.9} />}
        actions={
          <PeriodFilter
            value={period}
            onChange={onPeriodChange}
            label="Chọn khoảng thời gian cho khối kho"
          />
        }
      />

      {query.isError ? (
        <div className="mt-5">
          <BlockError onRetry={() => void query.refetch()} retrying={query.isFetching} />
        </div>
      ) : query.isLoading || !query.data ? (
        <div className="mt-5 space-y-3">
          <div className="grid grid-cols-1 gap-2.5 @xs/card:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-[70px] rounded-item" />
            ))}
          </div>
          <Skeleton className="h-4 w-32 rounded-full" />
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-11 rounded-[10px]" />
            ))}
          </div>
        </div>
      ) : !query.data.hasData ? (
        <div className="mt-5">
          <EmptyState
            title="Chưa có dữ liệu trong khoảng thời gian này"
            description="Số liệu kho sẽ hiển thị khi hệ thống kho ghi nhận phiếu nhập hàng."
          />
        </div>
      ) : (
        <>
          <div className="mt-4 grid grid-cols-1 gap-2.5 @xs/card:grid-cols-2">
            <div className="min-w-0 rounded-item bg-[var(--bg-subtle)] px-3.5 py-3">
              <div className="flex items-center gap-1.5 text-[var(--text-muted)]">
                <Receipt size={14} strokeWidth={1.9} aria-hidden className="shrink-0" />
                <span className="truncate text-[12px] font-medium">Chi phí nhập trong kỳ</span>
              </div>
              <p className="mt-1.5 truncate font-mono text-[17px] font-semibold leading-6 tabular-nums text-[var(--text-primary)]">
                {formatCurrency(query.data.purchaseCost)}
              </p>
            </div>

            <div className="min-w-0 rounded-item bg-[var(--bg-subtle)] px-3.5 py-3">
              <div className="flex items-center gap-1.5 text-[var(--text-muted)]">
                <PackageSearch size={14} strokeWidth={1.9} aria-hidden className="shrink-0" />
                <span className="truncate text-[12px] font-medium">Phiếu mua chờ nhận</span>
              </div>
              <p className="mt-1.5 flex items-baseline gap-1.5 truncate font-mono text-[17px] font-semibold leading-6 tabular-nums text-[var(--text-primary)]">
                {formatNumber(query.data.pendingReceipts)}
                <span className="text-[12px] font-medium text-[var(--text-muted)]">phiếu</span>
              </p>
            </div>

            <div className="min-w-0 rounded-item bg-[var(--bg-subtle)] px-3.5 py-3">
              <div className="flex items-center gap-1.5 text-[var(--text-muted)]">
                <Wallet size={14} strokeWidth={1.9} aria-hidden className="shrink-0" />
                <span className="truncate text-[12px] font-medium">Công nợ nhà cung cấp</span>
              </div>
              <p className="mt-1.5 truncate font-mono text-[17px] font-semibold leading-6 tabular-nums text-[var(--text-primary)]">
                {formatCurrency(query.data.supplierDebt)}
              </p>
            </div>

            <div className="min-w-0 rounded-item bg-[var(--bg-subtle)] px-3.5 py-3">
              <div className="flex items-center gap-1.5 text-[var(--text-muted)]">
                <AlertTriangle size={14} strokeWidth={1.9} aria-hidden className="shrink-0" />
                <span className="truncate text-[12px] font-medium">Nguyên liệu cần nhập</span>
              </div>
              <p className="mt-1.5 flex flex-wrap items-baseline gap-x-1.5 truncate font-mono text-[17px] font-semibold leading-6 tabular-nums text-[var(--text-primary)]">
                {formatNumber(query.data.lowStockCount)}
                <span className="text-[12px] font-medium text-[var(--text-muted)]">
                  sắp hết
                </span>
                {query.data.outOfStockCount > 0 ? (
                  <span className="text-[12px] font-medium text-[var(--danger)]">
                    · {formatNumber(query.data.outOfStockCount)} đã hết
                  </span>
                ) : null}
              </p>
            </div>
          </div>

          <div className="mt-4">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <p className="overline">Tồn kho cần chú ý</p>
              <span className="font-mono text-[11px] text-[var(--text-muted)]">
                {formatNumber(query.data.totalIngredients)} nguyên liệu
              </span>
            </div>

            <ul className="divide-y divide-[var(--border)]">
              {query.data.lowStock.map((item) => (
                <li
                  key={item.id}
                  className="flex min-w-0 items-center gap-2 py-2 first:pt-0 last:pb-0"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium text-[var(--text-primary)]" title={item.name}>
                      {item.name}
                    </span>
                    <span className="mt-0.5 block truncate font-mono text-[11px] tabular-nums text-[var(--text-muted)]">
                      Còn {formatQuantity(item.onHand, item.unit)} / định mức{' '}
                      {formatQuantity(item.minLevel, item.unit)}
                    </span>
                  </span>
                  <Badge
                    variant={STATUS_VARIANT[item.status]}
                    className="shrink-0 whitespace-nowrap"
                  >
                    {statusLabel(item.status)}
                  </Badge>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </Card>
  );
}

/** Dải cảnh báo mức tồn kho dùng cho chế độ xem gọn (nếu cần). */
export function StockLevelBar({ onHand, minLevel }: { onHand: number; minLevel: number }) {
  const ratio = minLevel > 0 ? Math.min(100, (onHand / (minLevel * 2)) * 100) : 0;
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--bg-subtle)]" aria-hidden>
      <div
        className={cn(
          'h-full rounded-full',
          onHand === 0
            ? 'bg-[var(--danger)]'
            : onHand <= minLevel
              ? 'bg-[var(--warning)]'
              : 'bg-[var(--accent)]',
        )}
        style={{ width: `${Math.max(4, ratio)}%` }}
      />
    </div>
  );
}
