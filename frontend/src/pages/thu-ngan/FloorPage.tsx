import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Check, Clock3, Users, Wifi, WifiOff } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { Card, CardHeader } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { BlockError } from '@/components/common/EmptyState';
import { PageHeader, StatTile } from '@/components/common/PageParts';
import { Segmented } from '@/components/common/Segmented';
import { Skeleton } from '@/components/common/Skeleton';
import { CASHIER_STREAM, getCashierFloor, serveItems } from '@/api/ordering';
import { useLiveEvents } from '@/features/ordering/live';
import { formatCurrency } from '@/lib/format';
import { cn } from '@/lib/cn';
import type { FloorTable } from '@/types';

export const CASHIER_KEYS = { floor: ['thu-ngan', 'floor'] as const, order: (id: string) => ['thu-ngan', 'order', id] as const };

type Quick = 'all' | 'occupied' | 'available' | 'ready';

const minutesSince = (iso: string) => Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60_000));
const hhmm = (iso: string) => new Date(iso).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

const STATUS_STYLE: Record<FloorTable['status'], { label: string; card: string; dot: string }> = {
  available: { label: 'Trống', card: 'border-[var(--border)] bg-[var(--bg-surface)]', dot: 'bg-[var(--text-muted)]' },
  occupied: { label: 'Có khách', card: 'border-[var(--accent)] bg-[var(--accent-soft)]', dot: 'bg-[var(--accent)]' },
  reserved: { label: 'Đặt trước', card: 'border-[var(--info)] bg-[var(--info-soft)]', dot: 'bg-[var(--info)]' },
  inactive: { label: 'Ngừng', card: 'border-dashed border-[var(--border)] bg-[var(--bg-subtle)] opacity-60', dot: 'bg-[var(--text-muted)]' },
};

/** UC-TN-01: Sơ đồ bàn — trang đầu của khu Thu ngân, tự cập nhật khi khách gọi món / bếp làm xong. */
export default function FloorPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [area, setArea] = useState('all');
  const [quick, setQuick] = useState<Quick>('all');
  const floor = useQuery({ queryKey: CASHIER_KEYS.floor, queryFn: getCashierFloor, refetchInterval: 10_000 });
  const { connected } = useLiveEvents(CASHIER_STREAM, [CASHIER_KEYS.floor, ['thu-ngan', 'order']]);

  const serve = useMutation({
    mutationFn: serveItems,
    onSuccess: () => {
      toast.success('Đã đánh dấu đã mang ra');
      void qc.invalidateQueries({ queryKey: CASHIER_KEYS.floor });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Không lưu được'),
  });

  const f = floor.data;
  const tables = useMemo(
    () =>
      (f?.tables ?? [])
        .filter((t) => area === 'all' || t.areaId === area)
        .filter((t) => quick === 'all' || (quick === 'occupied' ? Boolean(t.order) : quick === 'available' ? !t.order && t.status !== 'inactive' : (t.order?.readyCount ?? 0) > 0)),
    [f, area, quick],
  );
  const readyByTable = useMemo(() => {
    const m = new Map<string, NonNullable<typeof f>['ready']>();
    (f?.ready ?? []).forEach((r) => m.set(r.tableCode, [...(m.get(r.tableCode) ?? []), r]));
    return [...m.entries()];
  }, [f]);

  return (
    <AppShell meta={{ label: 'Sơ đồ bàn' }}>
      <div className="min-w-0 space-y-4">
        <PageHeader
          title="Sơ đồ bàn"
          description="Bàn có khách, món đang làm và món bếp đã xong chờ mang ra. Tự cập nhật khi khách gọi món qua QR."
          actions={
            <span className={cn('inline-flex items-center gap-1.5 text-[13px] font-medium', connected ? 'text-[var(--accent)]' : 'text-[var(--text-muted)]')}>
              {connected ? <Wifi size={15} /> : <WifiOff size={15} />}{connected ? 'Cập nhật trực tiếp' : 'Đang kết nối lại…'}
            </span>
          }
        />
        {floor.isError ? (
          <BlockError onRetry={() => void floor.refetch()} retrying={floor.isFetching} />
        ) : !f ? (
          <div className="grid gap-3 sm:grid-cols-4">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-28" />)}</div>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <StatTile label="Bàn có khách" value={`${f.occupiedCount}/${f.tableCount}`} />
              <StatTile label="Món chờ mang ra" value={f.ready.length} tone={f.ready.length ? 'warning' : 'default'} />
              <StatTile label="Món đang làm" value={f.tables.reduce((s, t) => s + (t.order?.pendingCount ?? 0), 0)} />
              <StatTile label="Đã thu hôm nay" value={formatCurrency(f.revenueToday)} tone="accent" hint="Có số liệu khi làm phần thanh toán (đợt 2)" />
            </div>

            <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
              <Card className="overflow-hidden">
                <div className="flex flex-wrap items-center gap-2 border-b border-[var(--border)] p-3">
                  <Segmented<string>
                    ariaLabel="Khu vực"
                    value={area}
                    onChange={setArea}
                    options={[{ value: 'all', label: 'Tất cả' }, ...f.areas.map((a) => ({ value: a.id, label: a.name }))]}
                  />
                  <Segmented<Quick>
                    ariaLabel="Lọc nhanh"
                    value={quick}
                    onChange={setQuick}
                    options={[
                      { value: 'all', label: 'Mọi bàn' },
                      { value: 'occupied', label: 'Có khách' },
                      { value: 'available', label: 'Trống' },
                      { value: 'ready', label: 'Có món chờ mang ra' },
                    ]}
                  />
                </div>
                {tables.length === 0 ? (
                  <p className="p-6 text-center text-[13.5px] text-[var(--text-muted)]">Không có bàn nào khớp bộ lọc.</p>
                ) : (
                  <div className="space-y-5 p-4">
                    {f.areas.filter((a) => area === 'all' || a.id === area).map((a) => {
                      const list = tables.filter((t) => t.areaId === a.id);
                      if (!list.length) return null;
                      return (
                        <div key={a.id}>
                          <p className="mb-2 text-[12.5px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">{a.name}</p>
                          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
                            {list.map((t) => <TableCard key={t.id} t={t} onOpen={() => t.order && navigate(`/thu-ngan/don/${t.order.id}`)} />)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>

              <Card padded className="h-fit">
                <CardHeader title="Món chờ mang ra" description="Bếp đã làm xong — bấm khi nhân viên đã mang ra bàn." />
                {readyByTable.length === 0 ? (
                  <p className="mt-4 text-[13.5px] text-[var(--text-muted)]">Không có món nào chờ mang ra.</p>
                ) : (
                  <div className="mt-3 space-y-3">
                    {readyByTable.map(([code, items]) => (
                      <div key={code} className="rounded-item border border-[var(--border)] p-3">
                        <div className="flex items-center justify-between">
                          <button type="button" className="text-[15px] font-bold hover:text-[var(--accent)]" onClick={() => navigate(`/thu-ngan/don/${items[0].orderId}`)}>Bàn {code}</button>
                          <Button size="sm" variant="outline" loading={serve.isPending} onClick={() => serve.mutate(items.map((i) => i.id))}>Đã mang ra tất cả</Button>
                        </div>
                        <ul className="mt-2 space-y-1.5">
                          {items.map((i) => (
                            <li key={i.id} className="flex items-center justify-between gap-2 text-[13.5px]">
                              <span className="min-w-0">
                                <b>{i.qty}×</b> {i.dishName}{i.note ? <span className="text-[var(--text-muted)]"> · {i.note}</span> : null}
                                <span className="ml-1 text-[12px] text-[var(--text-muted)]">({minutesSince(i.completedAt)}′)</span>
                              </span>
                              <Button size="sm" variant="ghost" aria-label={`Đã mang ra ${i.dishName} bàn ${code}`} onClick={() => serve.mutate([i.id])}><Check size={15} /></Button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}

function TableCard({ t, onOpen }: { t: FloorTable; onOpen: () => void }) {
  const st = STATUS_STYLE[t.order ? 'occupied' : t.status];
  return (
    <button
      type="button"
      onClick={onOpen}
      disabled={!t.order}
      className={cn('relative flex min-h-[112px] flex-col rounded-item border-2 p-3 text-left transition-shadow enabled:hover:shadow-soft', st.card, (t.order?.readyCount ?? 0) > 0 && 'ring-2 ring-[var(--warning)]')}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-[19px] font-extrabold leading-none">{t.code}</span>
        <span className="inline-flex items-center gap-1 text-[12px] text-[var(--text-muted)]"><Users size={12} />{t.seats}</span>
      </div>
      <span className="mt-1 inline-flex items-center gap-1.5 text-[12px] font-semibold"><span className={cn('h-2 w-2 rounded-full', st.dot)} />{st.label}</span>
      {t.order ? (
        <div className="mt-auto space-y-0.5 pt-2 text-[12.5px]">
          <p className="font-mono text-[14px] font-bold">{formatCurrency(t.order.subtotal)}</p>
          <p className="inline-flex items-center gap-1 text-[var(--text-muted)]"><Clock3 size={12} />{minutesSince(t.order.openedAt)} phút</p>
          <div className="flex flex-wrap gap-1">
            {t.order.pendingCount ? <span className="rounded bg-[var(--bg-subtle)] px-1.5 text-[11.5px]">{t.order.pendingCount} đang làm</span> : null}
            {t.order.readyCount ? <span className="rounded bg-[var(--warning-soft)] px-1.5 text-[11.5px] font-semibold text-[var(--warning)]">{t.order.readyCount} chờ mang ra</span> : null}
          </div>
        </div>
      ) : t.reservation ? (
        <p className="mt-auto pt-2 text-[12px] text-[var(--info)]">{hhmm(t.reservation.time)} · {t.reservation.customerName} ({t.reservation.guests})</p>
      ) : null}
    </button>
  );
}
