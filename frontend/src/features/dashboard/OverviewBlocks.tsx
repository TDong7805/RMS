import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useReducedMotion } from 'motion/react';
import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import {
  ArrowDownRight, ArrowRight, ArrowUpRight, Boxes, ChefHat, Clock3, Info, Minus, PieChart as PieIcon, Receipt, TrendingUp, Users, Wallet,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Card, CardHeader } from '@/components/common/Card';
import { CountUp } from '@/components/common/CountUp';
import { EmptyState } from '@/components/common/EmptyState';
import { Segmented } from '@/components/common/Segmented';
import { Badge } from '@/components/common/Badge';
import { DishThumb } from '@/features/dishes/DishParts';
import { cn } from '@/lib/cn';
import { formatCompactCurrency, formatCurrency, formatNumber, formatPercent, formatQuantity, statusLabel } from '@/lib/format';
import type { DishKind, DishStat, HourLoad, InventoryResponse, Kpi, OverviewResponse, PeriodKey, Slice } from '@/types';
import { LineChart } from './LineChart';

/** Câu "so với …" theo kỳ đang xem. */
export const COMPARE_LABEL: Record<PeriodKey, string> = {
  today: 'so với hôm qua',
  yesterday: 'so với hôm kia',
  last7: 'so với 7 ngày trước đó',
  last30: 'so với 30 ngày trước đó',
  thisMonth: 'so với cùng kỳ tháng trước',
  lastMonth: 'so với tháng trước nữa',
};

/* ------------------------------------------------------------------ 1. Thẻ số chính */

function ChangePill({ change }: { change: number | null }) {
  if (change === null) {
    return (
      <span className="inline-flex items-center gap-1 rounded-pill bg-[var(--bg-subtle)] px-2 py-0.5 text-[11.5px] font-semibold text-[var(--text-muted)]">
        <Minus size={12} strokeWidth={2.2} aria-hidden />
        Kỳ trước chưa có
      </span>
    );
  }
  const dir = change > 0.05 ? 'up' : change < -0.05 ? 'down' : 'flat';
  const Icon = dir === 'up' ? ArrowUpRight : dir === 'down' ? ArrowDownRight : Minus;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-pill px-2 py-0.5 font-mono text-[11.5px] font-semibold tabular-nums',
        dir === 'up' && 'bg-[var(--success-soft)] text-[var(--accent)]',
        dir === 'down' && 'bg-[var(--danger-soft)] text-[var(--danger)]',
        dir === 'flat' && 'bg-[var(--bg-subtle)] text-[var(--text-muted)]',
      )}
    >
      <Icon size={12} strokeWidth={2.4} aria-hidden />
      {formatPercent(change)}
    </span>
  );
}

function KpiCard({ icon: Icon, label, kpi, format, compareLabel, note }: {
  icon: LucideIcon; label: string; kpi: Kpi; format: (n: number) => string; compareLabel: string; note?: string;
}) {
  return (
    <Card padded className="min-w-0">
      <div className="flex items-center gap-2 text-[var(--text-muted)]">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[9px] bg-[var(--accent-soft)] text-[var(--accent)]" aria-hidden>
          <Icon size={16} strokeWidth={1.9} />
        </span>
        <span className="text-[13px] font-medium leading-4 text-[var(--text-secondary)]">{label}</span>
        {note ? (
          <span title={note} aria-label={note} className="shrink-0 cursor-help text-[var(--text-muted)]">
            <Info size={14} strokeWidth={1.9} />
          </span>
        ) : null}
      </div>
      <p className="mt-3 truncate font-mono text-[18px] font-semibold leading-tight tabular-nums text-[var(--text-primary)] sm:text-[26px]">
        <CountUp value={kpi.value} format={format} />
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
        <ChangePill change={kpi.change} />
        <span className="hidden truncate text-[11.5px] text-[var(--text-muted)] sm:inline">{compareLabel}</span>
      </div>
    </Card>
  );
}

export function KpiRow({ data, period }: { data: OverviewResponse; period: PeriodKey }) {
  const cmp = COMPARE_LABEL[period];
  return (
    <div className="grid min-w-0 grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
      <KpiCard icon={TrendingUp} label="Doanh thu" kpi={data.revenue} format={formatCurrency} compareLabel={cmp} />
      <KpiCard icon={Receipt} label="Số đơn đã thanh toán" kpi={data.orders} format={formatNumber} compareLabel={cmp} />
      <KpiCard icon={Wallet} label="Trung bình mỗi đơn" kpi={data.avgOrder} format={formatCurrency} compareLabel={cmp} />
      <KpiCard
        icon={Users}
        label="Số khách"
        kpi={data.guests}
        format={formatNumber}
        compareLabel={cmp}
        note={data.guests.value < data.orders.value ? 'Chỉ đếm bàn có ghi số khách lúc mở bàn.' : undefined}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ 2a. Doanh thu theo thời gian */

export function RevenueBlock({ data, comparing }: { data: OverviewResponse; comparing: boolean }) {
  const reduce = useReducedMotion();
  const peak = data.series.reduce((best, p) => (p.current > best.current ? p : best), data.series[0]);
  return (
    <Card padded className="flex min-w-0 flex-col">
      <CardHeader
        title="Doanh thu theo thời gian"
        description={peak && peak.current > 0 ? `Cao nhất ${peak.label}: ${formatCurrency(peak.current)}` : 'Hóa đơn đã thanh toán trong kỳ.'}
        icon={<TrendingUp size={17} strokeWidth={1.9} />}
        actions={
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 pt-1">
            <span className="inline-flex items-center gap-1.5 text-[11.5px] text-[var(--text-secondary)]">
              <span className="h-[2px] w-5 rounded-full bg-[var(--chart-line)]" aria-hidden />
              Kỳ này
            </span>
            {comparing ? (
              <span className="inline-flex items-center gap-1.5 text-[11.5px] text-[var(--text-muted)]">
                <span
                  className="h-[2px] w-5 rounded-full"
                  style={{ backgroundImage: 'repeating-linear-gradient(90deg, var(--chart-line-previous) 0 4px, transparent 4px 7px)' }}
                  aria-hidden
                />
                Kỳ trước
              </span>
            ) : null}
          </div>
        }
      />
      <div className="mt-3 min-h-[248px] min-w-0 flex-1">
        <LineChart data={data.series} comparing={comparing} dense={data.series.length > 8} animate={!reduce} fill />
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ 2b. Cơ cấu doanh thu */

const SLICE_COLORS = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)'];
const OTHER_COLOR = 'var(--chart-line-previous)';

/** Tối đa 5 phần lớn nhất, còn lại gộp thành "Khác". */
function topSlices(slices: Slice[]): Slice[] {
  const sorted = [...slices].filter((s) => s.value > 0).sort((a, b) => b.value - a.value);
  if (sorted.length <= 6) return sorted;
  const rest = sorted.slice(5).reduce((sum, s) => sum + s.value, 0);
  return [...sorted.slice(0, 5), { key: 'other', label: 'Khác', value: rest }];
}

type MixMode = 'category' | 'payment';

export function RevenueMixBlock({ data }: { data: OverviewResponse }) {
  const [mode, setMode] = useState<MixMode>('category');
  const reduce = useReducedMotion();
  const slices = useMemo(() => topSlices(mode === 'category' ? data.byCategory : data.byPayment), [data, mode]);
  const total = slices.reduce((sum, s) => sum + s.value, 0);
  const colorOf = (s: Slice, i: number) => (s.key === 'other' ? OTHER_COLOR : SLICE_COLORS[i % SLICE_COLORS.length]);

  return (
    <Card padded className="min-w-0">
      <CardHeader title="Cơ cấu doanh thu" icon={<PieIcon size={17} strokeWidth={1.9} />} />
      <div className="mt-3">
        <Segmented<MixMode>
          ariaLabel="Xem cơ cấu doanh thu theo"
          value={mode}
          onChange={setMode}
          options={[
            { value: 'category', label: 'Theo danh mục' },
            { value: 'payment', label: 'Theo cách trả tiền' },
          ]}
        />
      </div>
      {total <= 0 ? (
        <p className="mt-6 text-center text-[13px] text-[var(--text-muted)]">Chưa có số liệu để chia.</p>
      ) : (
        <>
          <div className="relative mx-auto mt-3 h-[188px] w-[188px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={slices}
                  dataKey="value"
                  nameKey="label"
                  innerRadius={62}
                  outerRadius={90}
                  paddingAngle={slices.length > 1 ? 1.5 : 0}
                  stroke="none"
                  isAnimationActive={!reduce}
                  animationDuration={450}
                >
                  {slices.map((s, i) => <Cell key={s.key} fill={colorOf(s, i)} />)}
                </Pie>
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const s = payload[0].payload as Slice;
                    return (
                      <div className="rounded-[10px] border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2 text-[12.5px] shadow-overlay">
                        <p className="font-semibold text-[var(--text-primary)]">{s.label}</p>
                        <p className="font-mono tabular-nums text-[var(--text-secondary)]">
                          {formatCurrency(s.value)} · {Math.round((s.value * 100) / total)}%
                        </p>
                      </div>
                    );
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
              <div>
                <p className="text-[11px] text-[var(--text-muted)]">Tổng</p>
                <p className="font-mono text-[16px] font-semibold tabular-nums text-[var(--text-primary)]">
                  <CountUp value={total} format={formatCompactCurrency} />
                </p>
              </div>
            </div>
          </div>
          <ul className="mt-3 space-y-1.5">
            {slices.map((s, i) => (
              <li key={s.key} className="flex min-w-0 items-center gap-2 text-[12.5px]">
                <span className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: colorOf(s, i) }} aria-hidden />
                <span className="min-w-0 flex-1 truncate text-[var(--text-secondary)]">{s.label}</span>
                <span className="font-mono tabular-nums text-[var(--text-primary)]">{formatCompactCurrency(s.value)}</span>
                <span className="w-10 text-right font-mono tabular-nums text-[var(--text-muted)]">{Math.round((s.value * 100) / total)}%</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </Card>
  );
}

/* ------------------------------------------------------------------ 3a. Giờ cao điểm */

type LoadMode = 'orders' | 'guests';

export function PeakHoursBlock({ hours }: { hours: HourLoad[] }) {
  const [mode, setMode] = useState<LoadMode>('orders');
  const reduce = useReducedMotion();
  const total = hours.reduce((sum, h) => sum + h[mode], 0);
  const busiest = hours.reduce<HourLoad | null>((best, h) => (h[mode] > (best?.[mode] ?? 0) ? h : best), null);
  const unit = mode === 'orders' ? 'đơn' : 'khách';

  return (
    <Card padded className="flex min-w-0 flex-col">
      <CardHeader
        title="Giờ đông khách"
        description={
          busiest && total > 0
            ? `Đông nhất ${String(busiest.hour).padStart(2, '0')}:00–${String(busiest.hour + 1).padStart(2, '0')}:00 · ${Math.round((busiest[mode] * 100) / total)}% ${unit}`
            : 'Tính theo giờ khách vào bàn.'
        }
        icon={<Clock3 size={17} strokeWidth={1.9} />}
        actions={
          <Segmented<LoadMode>
            ariaLabel="Đếm theo"
            value={mode}
            onChange={setMode}
            options={[
              { value: 'orders', label: 'Số đơn' },
              { value: 'guests', label: 'Số khách' },
            ]}
          />
        }
      />
      {total <= 0 ? (
        <p className="mt-6 grid flex-1 place-items-center text-center text-[13px] text-[var(--text-muted)]">
          {mode === 'guests' ? 'Các đơn trong kỳ chưa ghi số khách.' : 'Chưa có đơn nào trong kỳ.'}
        </p>
      ) : (
        <div className="mt-4 min-h-[220px] w-full min-w-0 flex-1">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={hours} margin={{ top: 4, right: 4, bottom: 0, left: -24 }}>
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                interval={hours.length > 12 ? 1 : 0}
                tick={{ fill: 'var(--text-muted)', fontSize: 10.5 }}
              />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: 'var(--text-muted)', fontSize: 10.5 }} />
              <Tooltip
                cursor={{ fill: 'var(--bg-subtle)' }}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const h = payload[0].payload as HourLoad;
                  return (
                    <div className="rounded-[10px] border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2 text-[12.5px] shadow-overlay">
                      <p className="font-mono text-[11px] text-[var(--text-muted)]">
                        {String(h.hour).padStart(2, '0')}:00–{String(h.hour + 1).padStart(2, '0')}:00
                      </p>
                      <p className="text-[var(--text-primary)]">
                        <b className="font-mono tabular-nums">{formatNumber(h.orders)}</b> đơn · <b className="font-mono tabular-nums">{formatNumber(h.guests)}</b> khách
                      </p>
                    </div>
                  );
                }}
              />
              <Bar dataKey={mode} radius={[5, 5, 0, 0]} isAnimationActive={!reduce} animationDuration={450}>
                {hours.map((h) => (
                  <Cell key={h.hour} fill={busiest && h.hour === busiest.hour ? 'var(--chart-line)' : 'var(--chart-bar)'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}

/* ------------------------------------------------------------------ 3b. Món bán chạy / bán chậm */

type DishTab = 'best' | 'slow';
export type DishScope = 'food' | 'drink' | 'all';

const inScope = (d: DishStat, scope: DishScope) => scope === 'all' || d.kind === (scope as DishKind);

export function rankDishes(dishes: DishStat[], scope: DishScope) {
  const list = dishes.filter((d) => inScope(d, scope));
  const max = Math.max(0, ...list.map((d) => d.quantity));
  const best = list
    .filter((d) => d.quantity > 0)
    .sort((a, b) => b.quantity - a.quantity || b.revenue - a.revenue)
    .slice(0, 5);
  const bestIds = new Set(best.map((d) => d.id));
  // Bán chậm: món đang bán có số phần thấp nhất (kể cả chưa bán được phần nào), không trùng nhóm bán chạy.
  const slow = list
    .filter((d) => d.selling && !bestIds.has(d.id))
    .sort((a, b) => a.quantity - b.quantity || a.name.localeCompare(b.name, 'vi'))
    .slice(0, 5);
  return { best, slow, max };
}

function DishRow({ dish, index, mode, max }: { dish: DishStat; index: number; mode: DishTab; max: number }) {
  const share = max > 0 ? (dish.quantity * 100) / max : 0;
  const unsold = mode === 'slow' && dish.quantity === 0;
  return (
    <li className="flex min-w-0 items-center gap-3 py-2.5">
      <span className="w-4 shrink-0 text-center font-mono text-[12px] font-semibold tabular-nums text-[var(--text-muted)]">{index + 1}</span>
      <DishThumb dish={{ image: dish.imageUrl ?? '', name: dish.name }} size={38} />
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-baseline gap-2">
          <p className="min-w-0 flex-1 truncate text-[13.5px] font-semibold text-[var(--text-primary)]" title={dish.name}>{dish.name}</p>
          <span className="shrink-0 font-mono text-[13px] font-semibold tabular-nums text-[var(--text-primary)]">
            {formatNumber(dish.quantity)} <span className="text-[11px] font-medium text-[var(--text-muted)]">phần</span>
          </span>
        </div>
        <div className="mt-1 flex min-w-0 items-center gap-2">
          <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-[var(--bg-subtle)]" role="presentation">
            {unsold ? null : (
              <div
                className={cn(
                  'h-full rounded-full transition-[width] duration-500',
                  mode === 'slow' ? 'bg-[var(--warning)] opacity-70' : index === 0 ? 'bg-[var(--accent)]' : 'bg-[var(--chart-bar)]',
                )}
                style={{ width: `${Math.max(4, share)}%` }}
              />
            )}
          </div>
          {unsold ? (
            <span className="shrink-0 text-[11px] font-semibold text-[var(--danger)]">Chưa bán</span>
          ) : (
            <span className="w-[64px] shrink-0 text-right font-mono text-[11.5px] tabular-nums text-[var(--text-muted)]">
              {formatCompactCurrency(dish.revenue)}
            </span>
          )}
        </div>
      </div>
    </li>
  );
}

export function DishesBlock({ dishes }: { dishes: DishStat[] }) {
  const [tab, setTab] = useState<DishTab>('best');
  const [scope, setScope] = useState<DishScope>('food');
  const { best, slow, max } = useMemo(() => rankDishes(dishes, scope), [dishes, scope]);
  const rows = tab === 'best' ? best : slow;

  return (
    <Card padded className="min-w-0">
      <CardHeader
        title={tab === 'best' ? 'Món bán chạy' : 'Món bán chậm'}
        description={tab === 'best' ? 'Theo số phần bán trong kỳ.' : 'Món đang bán có số phần ít nhất, kể cả món chưa bán được phần nào.'}
        icon={<ChefHat size={17} strokeWidth={1.9} />}
      />
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <Segmented<DishTab>
          ariaLabel="Bán chạy hay bán chậm"
          value={tab}
          onChange={setTab}
          options={[
            { value: 'best', label: 'Bán chạy' },
            { value: 'slow', label: 'Bán chậm' },
          ]}
        />
        <Segmented<DishScope>
          ariaLabel="Loại món"
          value={scope}
          onChange={setScope}
          options={[
            { value: 'food', label: 'Món ăn' },
            { value: 'drink', label: 'Đồ uống' },
            { value: 'all', label: 'Tất cả' },
          ]}
        />
      </div>
      {rows.length === 0 ? (
        <p className="mt-6 text-center text-[13px] text-[var(--text-muted)]">
          {tab === 'best' ? 'Chưa bán được món nào thuộc loại này trong kỳ.' : 'Không có món nào để xếp.'}
        </p>
      ) : (
        <ul className="mt-2 divide-y divide-[var(--border)]">
          {rows.map((d, i) => <DishRow key={d.id} dish={d} index={i} mode={tab} max={max} />)}
        </ul>
      )}
    </Card>
  );
}

/* ------------------------------------------------------------------ 4a. Đang lên / đang xuống */

/** Món có ít nhất 3 phần ở một trong hai kỳ mới xét, tránh "tăng 100%" chỉ vì bán 1 → 2 phần. */
const MIN_QTY = 3;

export function trending(dishes: DishStat[]) {
  const rows = dishes
    .filter((d) => d.kind !== 'extra' && Math.max(d.quantity, d.prevQuantity) >= MIN_QTY)
    .map((d) => ({ dish: d, change: d.prevQuantity > 0 ? ((d.quantity - d.prevQuantity) * 100) / d.prevQuantity : null }));
  const up = rows
    .filter((r) => r.change === null || r.change > 0)
    .sort((a, b) => (b.change ?? Infinity) - (a.change ?? Infinity) || b.dish.quantity - a.dish.quantity)
    .slice(0, 3);
  const down = rows
    .filter((r) => r.change !== null && r.change < 0)
    .sort((a, b) => (a.change ?? 0) - (b.change ?? 0))
    .slice(0, 3);
  return { up, down };
}

function TrendRow({ dish, change }: { dish: DishStat; change: number | null }) {
  const up = change === null || change > 0;
  return (
    <li className="flex min-w-0 items-center gap-2.5 py-2">
      <DishThumb dish={{ image: dish.imageUrl ?? '', name: dish.name }} size={32} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-semibold text-[var(--text-primary)]" title={dish.name}>{dish.name}</p>
        <p className="font-mono text-[11px] tabular-nums text-[var(--text-muted)]">
          {formatNumber(dish.prevQuantity)} → {formatNumber(dish.quantity)} phần
        </p>
      </div>
      <span
        className={cn(
          'inline-flex shrink-0 items-center gap-0.5 rounded-pill px-2 py-0.5 font-mono text-[11.5px] font-semibold tabular-nums',
          up ? 'bg-[var(--success-soft)] text-[var(--accent)]' : 'bg-[var(--danger-soft)] text-[var(--danger)]',
        )}
      >
        {up ? <ArrowUpRight size={12} strokeWidth={2.4} aria-hidden /> : <ArrowDownRight size={12} strokeWidth={2.4} aria-hidden />}
        {change === null ? 'Mới bán' : formatPercent(change, 0)}
      </span>
    </li>
  );
}

export function TrendingBlock({ dishes, period }: { dishes: DishStat[]; period: PeriodKey }) {
  const { up, down } = useMemo(() => trending(dishes), [dishes]);
  return (
    <Card padded className="flex min-w-0 flex-col">
      <CardHeader
        title="Món đang lên / đang xuống"
        description={`Số phần bán ${COMPARE_LABEL[period]}.`}
        icon={<TrendingUp size={17} strokeWidth={1.9} />}
      />
      {up.length === 0 && down.length === 0 ? (
        <p className="mt-6 text-center text-[13px] text-[var(--text-muted)]">Chưa đủ số liệu hai kỳ để so sánh.</p>
      ) : (
        <div className="mt-3 grid min-w-0 flex-1 grid-cols-1 gap-x-6 gap-y-3 md:grid-cols-2">
          <div className="flex min-w-0 flex-col">
            <p className="overline text-[var(--accent)]">Đang lên</p>
            {up.length ? (
              <ul className="mt-1 flex flex-1 flex-col justify-around divide-y divide-[var(--border)]">{up.map((r) => <TrendRow key={r.dish.id} {...r} />)}</ul>
            ) : (
              <p className="mt-2 text-[12.5px] text-[var(--text-muted)]">Không có món nào bán tăng.</p>
            )}
          </div>
          <div className="flex min-w-0 flex-col">
            <p className="overline text-[var(--danger)]">Đang xuống</p>
            {down.length ? (
              <ul className="mt-1 flex flex-1 flex-col justify-around divide-y divide-[var(--border)]">{down.map((r) => <TrendRow key={r.dish.id} {...r} />)}</ul>
            ) : (
              <p className="mt-2 text-[12.5px] text-[var(--text-muted)]">Không có món nào bán giảm.</p>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}

/* ------------------------------------------------------------------ 4b. Kho cần chú ý */

const STOCK_VARIANT = { out: 'danger', low: 'warning', ok: 'accent' } as const;

export function StockWatchBlock({ data }: { data: InventoryResponse | undefined }) {
  const need = data ? data.lowStockCount + data.outOfStockCount : 0;
  return (
    <Card padded className="min-w-0">
      <CardHeader title="Kho cần chú ý" icon={<Boxes size={17} strokeWidth={1.9} />} />
      {!data ? (
        <p className="mt-6 text-center text-[13px] text-[var(--text-muted)]">Đang tải…</p>
      ) : (
        <>
          <div className="mt-3 grid grid-cols-3 gap-2">
            <div className="min-w-0 rounded-item bg-[var(--bg-subtle)] px-3 py-2.5">
              <p className="text-[11.5px] leading-4 text-[var(--text-muted)]">Cần nhập thêm</p>
              <p className={cn('font-mono text-[17px] font-semibold tabular-nums', need > 0 ? 'text-[var(--warning)]' : 'text-[var(--text-primary)]')}>
                {formatNumber(need)}
              </p>
            </div>
            <div className="min-w-0 rounded-item bg-[var(--bg-subtle)] px-3 py-2.5">
              <p className="text-[11.5px] leading-4 text-[var(--text-muted)]">Phiếu chờ nhận</p>
              <p className="font-mono text-[17px] font-semibold tabular-nums text-[var(--text-primary)]">{formatNumber(data.pendingReceipts)}</p>
            </div>
            <Link to="/quan-ly/cong-no" className="min-w-0 rounded-item bg-[var(--bg-subtle)] px-3 py-2.5 hover:bg-[var(--bg-hover)]">
              <p className="text-[11.5px] leading-4 text-[var(--text-muted)]">Nợ nhà cung cấp</p>
              <p className="truncate font-mono text-[17px] font-semibold tabular-nums text-[var(--text-primary)]">{formatCompactCurrency(data.supplierDebt)}</p>
            </Link>
          </div>
          {data.lowStock.length === 0 ? (
            <p className="mt-4 text-[12.5px] text-[var(--text-muted)]">Nguyên liệu nào cũng còn đủ.</p>
          ) : (
            <ul className="mt-3 divide-y divide-[var(--border)]">
              {data.lowStock.slice(0, 3).map((item) => (
                <li key={item.id} className="flex min-w-0 items-center gap-2 py-2">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium text-[var(--text-primary)]">{item.name}</span>
                    <span className="block truncate font-mono text-[11px] tabular-nums text-[var(--text-muted)]">
                      Còn {formatQuantity(item.onHand, item.unit)} / tối thiểu {formatQuantity(item.minLevel, item.unit)}
                    </span>
                  </span>
                  <Badge variant={STOCK_VARIANT[item.status]} className="shrink-0 whitespace-nowrap">{statusLabel(item.status)}</Badge>
                </li>
              ))}
            </ul>
          )}
          <Link to="/quan-ly/cong-no" className="mt-2 inline-flex items-center gap-1 text-[12.5px] font-medium text-[var(--accent)] hover:underline">
            Xem công nợ nhà cung cấp <ArrowRight size={13} aria-hidden />
          </Link>
        </>
      )}
    </Card>
  );
}

export function NoSalesState() {
  return (
    <EmptyState
      title="Kỳ này chưa có hóa đơn nào được thanh toán"
      description="Số liệu sẽ hiện khi thu ngân thanh toán hóa đơn. Thử chọn khoảng thời gian khác ở góc trên."
    />
  );
}
