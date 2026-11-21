import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { HandPlatter } from 'lucide-react';
import { Button } from '@/components/common/Button';
import { BlockError, EmptyState } from '@/components/common/EmptyState';
import { Skeleton } from '@/components/common/Skeleton';
import { getWaiterFloor, waiterServe, WAITER_KEYS } from '@/api/waiter';
import { WaiterShell } from '@/features/waiter/WaiterShell';
import { minutesSince } from '@/features/ordering/floorParts';
import { cn } from '@/lib/cn';

/** Món bếp đã làm xong, chờ mang ra — theo bàn, mặc định chỉ khu của mình. Bấm "Đã mang" khi món tới bàn. */
export default function WaiterServePage() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: WAITER_KEYS.floor, queryFn: getWaiterFloor, refetchInterval: 15_000 });
  const [onlyMine, setOnlyMine] = useState(true);
  const serve = useMutation({
    mutationFn: waiterServe,
    onSuccess: (_, ids) => { toast.success(`Đã mang ${ids.length} món`); void qc.invalidateQueries({ queryKey: WAITER_KEYS.all }); },
    onError: (e) => { toast.error(e instanceof Error ? e.message : 'Không lưu được'); void qc.invalidateQueries({ queryKey: WAITER_KEYS.all }); },
  });

  const data = q.data;
  const mine = data?.myAreaIds ?? [];
  const onDuty = data?.clockedIn ?? false;
  const groups = useMemo(() => {
    if (!data) return [];
    const areaOf = new Map(data.floor.tables.map((t) => [t.id, t.areaId]));
    const areaName = new Map(data.floor.areas.map((a) => [a.id, a.name]));
    const m = new Map<string, { code: string; area: string; items: typeof data.floor.ready }>();
    data.floor.ready
      .filter((r) => !onlyMine || mine.length === 0 || mine.includes(areaOf.get(r.tableId) ?? ''))
      .forEach((r) => {
        const g = m.get(r.tableId) ?? { code: r.tableCode, area: areaName.get(areaOf.get(r.tableId) ?? '') ?? '', items: [] };
        g.items.push(r);
        m.set(r.tableId, g);
      });
    return [...m.values()].sort((a, b) => minutesSince(b.items[0].completedAt) - minutesSince(a.items[0].completedAt));
  }, [data, onlyMine, mine]);

  return (
    <WaiterShell title="MANG MÓN">
      <fieldset disabled={!onDuty} className="mx-auto m-0 min-w-0 max-w-2xl space-y-3 border-0 p-0">
        {mine.length ? (
          <div className="grid grid-cols-2 gap-1 rounded-[12px] bg-[var(--bg-subtle)] p-1">
            {([[true, 'Khu của tôi'], [false, 'Tất cả khu']] as const).map(([v, l]) => (
              <button key={l} type="button" aria-pressed={onlyMine === v} onClick={() => setOnlyMine(v)} className={cn('h-9 rounded-[10px] text-[13px] font-semibold', onlyMine === v ? 'bg-[var(--bg-surface)] text-[var(--accent)] shadow-sm' : 'text-[var(--text-secondary)]')}>{l}</button>
            ))}
          </div>
        ) : null}
        {q.isError ? (
          <BlockError onRetry={() => void q.refetch()} retrying={q.isFetching} />
        ) : !data ? (
          <Skeleton className="h-40" />
        ) : groups.length === 0 ? (
          <EmptyState icon={HandPlatter} title="Không có món nào chờ mang ra" description="Món bếp nấu xong sẽ hiện ở đây." />
        ) : (
          groups.map((g) => (
            <div key={g.code} className="rounded-[14px] border border-[var(--border)] bg-[var(--bg-surface)] p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[16px] font-extrabold">Bàn {g.code} <span className="text-[12.5px] font-medium text-[var(--text-muted)]">· {g.area}</span></p>
                <Button size="sm" leadingIcon={<HandPlatter size={14} />} loading={serve.isPending} onClick={() => serve.mutate(g.items.map((i) => i.id))}>Đã mang hết</Button>
              </div>
              <ul className="mt-2 space-y-1.5">
                {g.items.map((i) => {
                  const m = minutesSince(i.completedAt);
                  return (
                    <li key={i.id} className="flex items-center gap-2 text-[14px]">
                      <span className="min-w-0 flex-1"><b className="font-mono">{i.qty}×</b> {i.dishName}{i.note ? <span className="text-[var(--text-muted)]"> · {i.note}</span> : null}</span>
                      <span className={cn('font-mono text-[12px]', m >= 5 ? 'font-bold text-[var(--danger)]' : 'text-[var(--text-muted)]')}>{m}′</span>
                      <button type="button" disabled={serve.isPending} onClick={() => serve.mutate([i.id])} className="rounded-full border border-[var(--border)] px-2.5 py-1 text-[12px] font-semibold">Đã mang</button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))
        )}
      </fieldset>
    </WaiterShell>
  );
}
