import { useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { PeriodFilter } from '@/components/common/PeriodFilter';
import { Button } from '@/components/common/Button';
import { Card } from '@/components/common/Card';
import { Skeleton } from '@/components/common/Skeleton';
import { BlockError } from '@/components/common/EmptyState';
import { cn } from '@/lib/cn';
import { useInventoryOverviewQuery, useOverviewQuery } from '@/features/dashboard/hooks';
import {
  DishesBlock, KpiRow, NoSalesState, PeakHoursBlock, RevenueBlock, RevenueMixBlock, StockWatchBlock, TrendingBlock,
} from '@/features/dashboard/OverviewBlocks';
import type { PeriodKey } from '@/types';

/**
 * Dashboard Quản lý (docs/thiet-ke/QUY_TAC_GIAO_DIEN.md, mục B5) — đọc từ trên xuống: hôm nay thế nào → vì sao → làm gì tiếp.
 * Một bộ chọn thời gian chung cho cả trang. Đổi kỳ thì giữ số cũ mờ nhẹ tới khi có số mới (không nháy trắng).
 */
export function DashboardPage() {
  const [period, setPeriod] = useState<PeriodKey>('today');
  const [comparing, setComparing] = useState(false);
  const overview = useOverviewQuery(period);
  const inventory = useInventoryOverviewQuery(period);
  const data = overview.data;
  const switching = overview.isPlaceholderData;

  return (
    <AppShell meta={{ label: 'Dashboard' }}>
      <div className="min-w-0 space-y-4 sm:space-y-5">
        <div className="flex min-w-0 flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <h1 className="truncate text-[26px] font-bold leading-tight tracking-[-0.02em] text-[var(--text-primary)] sm:text-[32px]">
              Tổng quan nhà hàng
            </h1>
            <p className="mt-1 text-[14px] text-[var(--text-secondary)]">Tình hình bán hàng và kho trong một màn hình.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant={comparing ? 'secondary' : 'outline'} size="sm" aria-pressed={comparing} onClick={() => setComparing((v) => !v)}>
              So sánh kỳ trước
            </Button>
            <PeriodFilter value={period} onChange={setPeriod} label="Chọn khoảng thời gian cho cả trang" />
          </div>
        </div>

        {overview.isError && !data ? (
          <Card padded>
            <BlockError onRetry={() => void overview.refetch()} retrying={overview.isFetching} />
          </Card>
        ) : !data ? (
          <DashboardSkeleton />
        ) : (
          <div className={cn('min-w-0 space-y-4 transition-opacity duration-200 sm:space-y-5', switching && 'opacity-60')} aria-busy={switching}>
            <KpiRow data={data} period={period} />

            {!data.hasData ? (
              <Card padded>
                <NoSalesState />
              </Card>
            ) : (
              <>
                <div className="grid min-w-0 grid-cols-1 gap-4 sm:gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
                  <RevenueBlock data={data} comparing={comparing} />
                  <RevenueMixBlock data={data} />
                </div>
                <div className="grid min-w-0 grid-cols-1 gap-4 sm:gap-5 xl:grid-cols-2">
                  <PeakHoursBlock hours={data.peakHours} />
                  <DishesBlock dishes={data.dishes} />
                </div>
              </>
            )}

            <div className="grid min-w-0 grid-cols-1 gap-4 sm:gap-5 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
              {data.hasData ? <TrendingBlock dishes={data.dishes} period={period} /> : null}
              <div className={cn(!data.hasData && 'xl:col-span-2')}>
                <StockWatchBlock data={inventory.data} />
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-4 sm:space-y-5" aria-busy>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[132px] rounded-card" />)}
      </div>
      <div className="grid grid-cols-1 gap-4 sm:gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Skeleton className="h-[380px] rounded-card" />
        <Skeleton className="h-[380px] rounded-card" />
      </div>
    </div>
  );
}

export default DashboardPage;
