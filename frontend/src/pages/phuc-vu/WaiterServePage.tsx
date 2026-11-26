import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChefHat, HandPlatter } from 'lucide-react';
import { BlockError, EmptyState } from '@/components/common/EmptyState';
import { Skeleton } from '@/components/common/Skeleton';
import { getWaiterFloor, WAITER_KEYS } from '@/api/waiter';
import { WaiterShell } from '@/features/waiter/WaiterShell';
import { minutesSince } from '@/features/ordering/floorParts';
import { cn } from '@/lib/cn';

/**
 * Món xong (chỉ xem, D15): món bếp đã nấu xong, đang chờ lấy ở bếp — theo bàn, mặc định chỉ khu của mình, bàn chờ lâu nhất trên.
 * Phục vụ ra bếp lấy món; bếp bấm "Đã mang đi" (món biến khỏi danh sách, khách thấy "Đã mang ra"). Có món mới xong → âm báo (WaiterShell).
 */
export default function WaiterServePage() {
  const q = useQuery({ queryKey: WAITER_KEYS.floor, queryFn: getWaiterFloor, refetchInterval: 15_000 });
  const [onlyMine, setOnlyMine] = useState(true);

  const data = q.data;
  const mine = data?.myAreaIds ?? [];
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
    const oldest = (g: { items: typeof data.floor.ready }) => Math.max(...g.items.map((i) => minutesSince(i.completedAt)));
    return [...m.values()].sort((a, b) => oldest(b) - oldest(a));
  }, [data, onlyMine, mine]);

  return (
    <WaiterShell title="MÓN XONG">
      <div className="mx-auto max-w-2xl space-y-3">
        <p className="flex items-start gap-2 rounded-[14px] bg-[var(--accent-soft)] p-3 text-[13px] text-[var(--text-secondary)]">
          <ChefHat size={17} className="mt-0.5 shrink-0 text-[var(--accent)]" />
          <span>Món bếp đã nấu xong — ra bếp lấy và mang tới bàn. Bếp sẽ bấm <b>Đã mang đi</b> khi bạn lấy món.</span>
        </p>
        {mine.length ? (
          <div className="grid grid-cols-2 gap-1 rounded-full bg-[var(--bg-subtle)] p-1">
            {([[true, 'Khu của tôi'], [false, 'Tất cả khu']] as const).map(([v, l]) => (
              <button key={l} type="button" aria-pressed={onlyMine === v} onClick={() => setOnlyMine(v)} className={cn('h-9 rounded-full text-[13px] font-semibold', onlyMine === v ? 'bg-[var(--accent)] text-white shadow-sm' : 'text-[var(--text-secondary)]')}>{l}</button>
            ))}
          </div>
        ) : null}
        {q.isError ? (
          <BlockError onRetry={() => void q.refetch()} retrying={q.isFetching} />
        ) : !data ? (
          <Skeleton className="h-40" />
        ) : groups.length === 0 ? (
          <EmptyState icon={HandPlatter} title="Chưa có món nào xong" description="Món bếp nấu xong sẽ hiện ở đây, kèm âm báo." />
        ) : (
          groups.map((g) => (
            <div key={g.code} data-ready={g.code} className="rounded-[18px] border border-[var(--border)] bg-[var(--bg-surface)] p-3 shadow-sm">
              <p className="flex items-center gap-2">
                <span className="grid h-10 min-w-10 place-items-center rounded-[12px] bg-[#16a34a] px-1.5 text-[15px] font-extrabold text-white">{g.code}</span>
                <span className="text-[13px] text-[var(--text-muted)]">{g.area} · {g.items.length} món</span>
              </p>
              <ul className="mt-2 space-y-1.5">
                {g.items.map((i) => {
                  const m = minutesSince(i.completedAt);
                  return (
                    <li key={i.id} className="flex items-center gap-2 text-[14px]">
                      <span className="min-w-0 flex-1"><b className="font-mono">{i.qty}×</b> {i.dishName}{i.note ? <span className="text-[var(--text-muted)]"> · {i.note}</span> : null}</span>
                      <span className={cn('rounded-full px-2 py-0.5 font-mono text-[12px]', m >= 5 ? 'bg-[var(--danger-soft)] font-bold text-[var(--danger)]' : 'bg-[var(--bg-subtle)] text-[var(--text-muted)]')} title={`Xong ${m} phút trước`}>{m}′</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))
        )}
      </div>
    </WaiterShell>
  );
}
