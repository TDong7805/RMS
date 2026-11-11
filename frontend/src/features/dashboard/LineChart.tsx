import { useId } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart as RechartsLineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { TooltipProps } from 'recharts';
import type { RevenuePoint } from '@/types';
import { formatCompactCurrency, formatCurrency } from '@/lib/format';

export interface LineChartProps {
  data: RevenuePoint[];
  comparing: boolean;
  /** Mốc thời gian để chọn nhãn trục hoành gọn hơn khi nhiều điểm. */
  dense?: boolean;
}

interface ChartTooltipProps extends TooltipProps<number, string> {
  comparing: boolean;
}

function ChartTooltip({ active, payload, label, comparing }: ChartTooltipProps) {
  if (!active || !payload?.length) return null;
  const current = payload.find((p) => p.dataKey === 'current');
  const previous = payload.find((p) => p.dataKey === 'previous');

  return (
    <div className="rounded-[10px] border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2 shadow-overlay">
      <p className="mb-1 font-mono text-[11px] font-medium text-[var(--text-muted)]">{label}</p>
      <p className="flex items-baseline gap-2 text-[12.5px]">
        <span className="h-2 w-2 shrink-0 rounded-full bg-[var(--chart-line)]" aria-hidden />
        <span className="text-[var(--text-secondary)]">Kỳ này</span>
        <span className="ml-auto font-mono font-semibold tabular-nums text-[var(--text-primary)]">
          {formatCurrency(Number(current?.value ?? 0))}
        </span>
      </p>
      {comparing ? (
        <p className="mt-1 flex items-baseline gap-2 text-[12.5px]">
          <span className="h-2 w-2 shrink-0 rounded-full bg-[var(--chart-line-previous)]" aria-hidden />
          <span className="text-[var(--text-secondary)]">Kỳ trước</span>
          <span className="ml-auto font-mono font-semibold tabular-nums text-[var(--text-muted)]">
            {formatCurrency(Number(previous?.value ?? 0))}
          </span>
        </p>
      ) : null}
    </div>
  );
}

export function LineChart({ data, comparing, dense = false }: LineChartProps) {
  const gradientId = `revenue-fill-${useId().replace(/[:]/g, '')}`;
  const tickInterval = data.length > 8 ? Math.ceil(data.length / 6) : 0;

  return (
    <div className="h-[248px] w-full min-w-0 sm:h-[292px]">
      <ResponsiveContainer width="100%" height="100%">
        <RechartsLineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-line)" stopOpacity={0.16} />
              <stop offset="100%" stopColor="var(--chart-line)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid
            strokeDasharray="3 4"
            stroke="var(--chart-grid)"
            vertical={false}
          />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            interval={tickInterval}
            minTickGap={12}
            tick={{ fill: 'var(--text-muted)', fontSize: dense ? 10 : 11, fontFamily: 'JetBrains Mono' }}
            dy={8}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            width={58}
            tickFormatter={(value: number) => formatCompactCurrency(value)}
            tick={{ fill: 'var(--text-muted)', fontSize: 10.5, fontFamily: 'JetBrains Mono' }}
          />
          <Tooltip
            content={<ChartTooltip comparing={comparing} />}
            cursor={{ stroke: 'var(--border-strong)', strokeWidth: 1, strokeDasharray: '3 3' }}
          />
          {comparing ? (
            <Line
              type="monotone"
              dataKey="previous"
              name="Kỳ trước"
              stroke="var(--chart-line-previous)"
              strokeWidth={1.6}
              strokeDasharray="5 4"
              dot={false}
              activeDot={{ r: 3, strokeWidth: 0, fill: 'var(--chart-line-previous)' }}
              isAnimationActive={false}
            />
          ) : null}
          <Line
            type="monotone"
            dataKey="current"
            name="Kỳ này"
            stroke="var(--chart-line)"
            strokeWidth={2.2}
            dot={false}
            activeDot={{
              r: 4,
              strokeWidth: 2,
              stroke: 'var(--bg-surface)',
              fill: 'var(--chart-line)',
            }}
            isAnimationActive={false}
          />
        </RechartsLineChart>
      </ResponsiveContainer>
    </div>
  );
}