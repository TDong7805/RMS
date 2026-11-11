import { useState } from 'react';
import { ArrowDownRight, ArrowUpRight, Minus, Receipt, TrendingUp, Wallet } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Card, CardHeader } from '@/components/common/Card';
import { PeriodFilter } from '@/components/common/PeriodFilter';
import { Skeleton } from '@/components/common/Skeleton';
import { BlockError, EmptyState } from '@/components/common/EmptyState';
import { Button } from '@/components/common/Button';
import { cn } from '@/lib/cn';
import { formatCompactCurrency, formatCurrency, formatNumber, formatPercent } from '@/lib/format';
import type { PeriodKey, TrendDirection } from '@/types';
import { useRevenueQuery } from './hooks';
import { LineChart } from './LineChart';

export interface RevenueCardProps {
  period: PeriodKey;
  onPeriodChange: (period: PeriodKey) => void;
}

interface StatProps {
  icon: LucideIcon;
  label: string;
  value: string;
  hint?: string;
  emphasize?: boolean;
}

function Stat({ icon: Icon, label, value, hint, emphasize }: StatProps) {
  return (
    <div className="min-w-0 rounded-item bg-[var(--bg-subtle)] px-3.5 py-3">
      <div className="flex items-center gap-1.5 text-[var(--text-muted)]">
        <Icon size={14} strokeWidth={1.9} aria-hidden className="shrink-0" />
        <span className="truncate text-[12px] font-medium">{label}</span>
      </div>
      <p
        className={cn(
          'mt-1.5 truncate font-mono font-semibold tabular-nums text-[var(--text-primary)]',
          emphasize ? 'text-[17px] leading-6' : 'text-[15px] leading-6',
        )}
      >
        {value}
      </p>
      {hint ? <p className="mt-0.5 truncate text-[11px] text-[var(--text-muted)]">{hint}</p> : null}
    </div>
  );
}

function ChangePill({ change }: { change: number | null }) {
  if (change === null) {
    return (
      <span className="inline-flex items-center gap-1 rounded-pill bg-[var(--bg-subtle)] px-2 py-1 text-[11.5px] font-semibold text-[var(--text-muted)]">
        <Minus size={12} strokeWidth={2.2} aria-hidden />—
      </span>
    );
  }

  const direction: TrendDirection = change > 0.05 ? 'up' : change < -0.05 ? 'down' : 'flat';
  const Icon = direction === 'up' ? ArrowUpRight : direction === 'down' ? ArrowDownRight : Minus;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-pill px-2 py-1 font-mono text-[11.5px] font-semibold tabular-nums',
        direction === 'up' && 'bg-[var(--success-soft)] text-[var(--accent)]',
        direction === 'down' && 'bg-[var(--danger-soft)] text-[var(--danger)]',
        direction === 'flat' && 'bg-[var(--bg-subtle)] text-[var(--text-muted)]',
      )}
    >
      <Icon size={12} strokeWidth={2.4} aria-hidden />
      {formatPercent(change)}
    </span>
  );
}

function Legend({ comparing }: { comparing: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
      <span className="inline-flex items-center gap-1.5 text-[11.5px] text-[var(--text-secondary)]">
        <span className="h-[2px] w-5 rounded-full bg-[var(--chart-line)]" aria-hidden />
        Kỳ này
      </span>
      {comparing ? (
        <span className="inline-flex items-center gap-1.5 text-[11.5px] text-[var(--text-muted)]">
          <span
            className="h-[2px] w-5 rounded-full"
            style={{
              backgroundImage:
                'repeating-linear-gradient(90deg, var(--chart-line-previous) 0 4px, transparent 4px 7px)',
            }}
            aria-hidden
          />
          Kỳ trước
        </span>
      ) : null}
    </div>
  );
}

export function RevenueCard({ period, onPeriodChange }: RevenueCardProps) {
  const [comparing, setComparing] = useState(false);
  const query = useRevenueQuery(period);

  return (
    <Card padded className="@container/card">
      <CardHeader
        title="Doanh thu"
        description="Hóa đơn đã thanh toán tại nhà hàng trong khoảng thời gian đã chọn."
        icon={<TrendingUp size={17} strokeWidth={1.9} />}
        actions={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button
              variant={comparing ? 'secondary' : 'outline'}
              size="sm"
              aria-pressed={comparing}
              onClick={() => setComparing((value) => !value)}
            >
              So sánh kỳ trước
            </Button>
            <PeriodFilter
              value={period}
              onChange={onPeriodChange}
              label="Chọn khoảng thời gian cho khối doanh thu"
            />
          </div>
        }
      />

      {query.isError ? (
        <div className="mt-5">
          <BlockError onRetry={() => void query.refetch()} retrying={query.isFetching} />
        </div>
      ) : query.isLoading || !query.data ? (
        <div className="mt-5 space-y-4">
          <div className="space-y-2">
            <Skeleton className="h-3 w-24 rounded-full" />
            <Skeleton className="h-9 w-52" />
          </div>
          <Skeleton className="h-[248px] w-full rounded-item sm:h-[292px]" />
          <div className="grid grid-cols-2 gap-3 @xl/card:grid-cols-3">
            <Skeleton className="h-[68px] rounded-item" />
            <Skeleton className="h-[68px] rounded-item" />
            <Skeleton className="h-[68px] rounded-item" />
          </div>
        </div>
      ) : !query.data.hasData ? (
        <div className="mt-5">
          <EmptyState
            title="Chưa có dữ liệu trong khoảng thời gian này"
            description="Doanh thu sẽ xuất hiện khi hệ thống thu ngân ghi nhận hóa đơn đã thanh toán."
          />
        </div>
      ) : (
        <>
          <div className="mt-4 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
            <div className="min-w-0">
              <p className="overline">Tổng doanh thu</p>
              <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1">
                <span className="truncate font-mono text-[30px] font-semibold leading-tight tabular-nums text-[var(--text-primary)] sm:text-[34px]">
                  {formatCurrency(query.data.total)}
                </span>
                <ChangePill change={comparing ? query.data.change : null} />
              </div>
              <p className="mt-1 text-[12px] text-[var(--text-muted)]">
                {comparing ? 'So với kỳ trước cùng độ dài' : 'Bật so sánh để xem mức thay đổi'}
              </p>
            </div>
            <Legend comparing={comparing} />
          </div>

          <div className="mt-3 min-w-0">
            <LineChart
              data={query.data.series}
              comparing={comparing}
              dense={query.data.series.length > 8}
            />
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 @sm/card:grid-cols-3">
            <Stat
              icon={Receipt}
              label="Số đơn đã thanh toán"
              value={formatNumber(query.data.orders)}
              hint="Không gồm đơn đã huỷ"
            />
            <Stat
              icon={Wallet}
              label="Trung bình mỗi đơn"
              value={formatCompactCurrency(query.data.avgOrder)}
              hint="Tổng doanh thu ÷ số đơn"
            />
            <Stat
              icon={TrendingUp}
              label="Đỉnh doanh thu"
              value={formatCompactCurrency(
                Math.max(...query.data.series.map((point) => point.current), 0),
              )}
              hint={query.data.series.reduce(
                (best, point) => (point.current > best.current ? point : best),
                query.data.series[0],
              )?.label}
            />
          </div>
        </>
      )}
    </Card>
  );
}
