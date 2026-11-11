import { useState } from 'react';
import { ChefHat, TrendingDown } from 'lucide-react';
import { Card, CardHeader } from '@/components/common/Card';
import { PeriodFilter } from '@/components/common/PeriodFilter';
import { Skeleton } from '@/components/common/Skeleton';
import { BlockError, EmptyState } from '@/components/common/EmptyState';
import { Segmented } from '@/components/common/Segmented';
import { cn } from '@/lib/cn';
import { formatCompactCurrency, formatNumber } from '@/lib/format';
import type { DishRank, PeriodKey } from '@/types';
import { useTopDishesQuery } from './hooks';

export interface TopDishesCardProps {
  period: PeriodKey;
  onPeriodChange: (period: PeriodKey) => void;
}

type DishTab = 'best' | 'slow';

interface DishRowProps {
  dish: DishRank;
  index: number;
  mode: DishTab;
}

function DishRow({ dish, index, mode }: DishRowProps) {
  return (
    <li className="rounded-[10px] px-1.5 py-2 transition-colors hover:bg-[var(--bg-subtle)]">
      <div className="flex min-w-0 items-center gap-2.5">
        <span
          className={cn(
            'grid h-6 w-6 shrink-0 place-items-center rounded-[7px] font-mono text-[11.5px] font-semibold tabular-nums',
            index === 0 && mode === 'best'
              ? 'bg-[var(--accent)] text-[var(--accent-contrast)]'
              : 'bg-[var(--bg-subtle)] text-[var(--text-muted)]',
          )}
          aria-hidden
        >
          {index + 1}
        </span>

        <div className="min-w-0 flex-1">
          <p
            className="truncate text-[13px] font-semibold leading-5 text-[var(--text-primary)]"
            title={dish.name}
          >
            {dish.name}
          </p>
          <p className="truncate text-[11px] leading-4 text-[var(--text-muted)]">{dish.category}</p>
        </div>

        <div className="flex shrink-0 items-center gap-3 sm:gap-4">
          <div className="min-w-[42px] text-right">
            <p className="whitespace-nowrap font-mono text-[13px] font-semibold tabular-nums leading-5 text-[var(--text-primary)]">
              {formatNumber(dish.quantity)}
            </p>
            <p className="whitespace-nowrap text-[10.5px] leading-4 text-[var(--text-muted)]">phần</p>
          </div>
          <div className="hidden min-w-[72px] text-right @md/card:block">
            <p className="whitespace-nowrap font-mono text-[13px] font-semibold tabular-nums leading-5 text-[var(--text-primary)]">
              {formatCompactCurrency(dish.revenue)}
            </p>
            <p className="whitespace-nowrap text-[10.5px] leading-4 text-[var(--text-muted)]">doanh thu</p>
          </div>
        </div>
      </div>

      {/* % = số phần bán so với món bán chạy nhất trong kỳ (cả hai tab cùng thang để so sánh được). */}
      <div className="mt-1.5 flex min-w-0 items-center gap-2 pl-[34px]">
        <div
          className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-[var(--bg-subtle)]"
          role="presentation"
        >
          {mode === 'slow' && dish.quantity === 0 ? null : (
            <div
              className={cn(
                'h-full rounded-full',
                mode === 'slow'
                  ? 'bg-[var(--warning)] opacity-70'
                  : index === 0
                    ? 'bg-[var(--accent)]'
                    : 'bg-[var(--chart-bar)]',
              )}
              style={{ width: `${Math.max(4, dish.share)}%` }}
            />
          )}
        </div>
        {mode === 'slow' && dish.quantity === 0 ? (
          <span className="shrink-0 whitespace-nowrap text-right text-[10.5px] font-semibold text-[var(--danger)] opacity-80">
            Chưa bán
          </span>
        ) : (
          <span
            className={cn(
              'w-9 shrink-0 text-right font-mono text-[10.5px] tabular-nums',
              mode === 'slow' ? 'text-[var(--warning)]' : 'text-[var(--text-muted)]',
            )}
          >
            {dish.share > 0 && dish.share < 1 ? '<1' : Math.round(dish.share)}%
          </span>
        )}
      </div>
    </li>
  );
}

export function TopDishesCard({ period, onPeriodChange }: TopDishesCardProps) {
  const [tab, setTab] = useState<DishTab>('best');
  const query = useTopDishesQuery(period);
  const rows = tab === 'best' ? query.data?.best ?? [] : query.data?.slow ?? [];

  return (
    <Card padded className="@container/card">
      <CardHeader
        title="Món ăn"
        description="Xếp hạng theo số lượng bán trong kỳ, bằng nhau thì xét doanh thu."
        icon={<ChefHat size={17} strokeWidth={1.9} />}
        actions={
          <PeriodFilter
            value={period}
            onChange={onPeriodChange}
            label="Chọn khoảng thời gian cho khối món ăn"
          />
        }
      />

      <div className="mt-3">
        <Segmented<DishTab>
          ariaLabel="Chọn nhóm món ăn"
          value={tab}
          onChange={setTab}
          options={[
            { value: 'best', label: 'Bán chạy' },
            { value: 'slow', label: 'Bán chậm' },
          ]}
        />
      </div>

      {query.isError ? (
        <div className="mt-4">
          <BlockError onRetry={() => void query.refetch()} retrying={query.isFetching} />
        </div>
      ) : query.isLoading || !query.data ? (
        <div className="mt-4 space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="space-y-1.5 py-1">
              <div className="flex items-center gap-2.5">
                <Skeleton className="h-6 w-6 rounded-[7px]" />
                <Skeleton className="h-3 flex-1 rounded-full" />
                <Skeleton className="h-3 w-9 shrink-0 rounded-full" />
              </div>
              <Skeleton className="ml-[34px] h-1.5 w-[calc(100%-56px)] rounded-full" />
            </div>
          ))}
        </div>
      ) : !query.data.hasData ? (
        <div className="mt-4">
          <EmptyState
            title="Chưa có dữ liệu trong khoảng thời gian này"
            description="Chưa có hóa đơn nào được ghi nhận trong kỳ đã chọn."
          />
        </div>
      ) : (
        <>
          <ul className="mt-2 divide-y divide-[var(--border)]">
            {rows.map((dish, index) => (
              <DishRow key={dish.id} dish={dish} index={index} mode={tab} />
            ))}
          </ul>

          {tab === 'slow' ? (
            <p className="mt-3 flex items-start gap-1.5 rounded-[10px] bg-[var(--warning-soft)] px-2.5 py-2 text-[11.5px] leading-4 text-[var(--warning)]">
              <TrendingDown size={13} strokeWidth={2} aria-hidden className="mt-0.5 shrink-0" />
              <span className="min-w-0">
                Tính trên các món đang bán, gồm cả món chưa bán được phần nào trong kỳ. % là số phần bán
                so với món bán chạy nhất.
              </span>
            </p>
          ) : null}
        </>
      )}
    </Card>
  );
}
