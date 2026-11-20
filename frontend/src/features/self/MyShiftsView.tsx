import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CalendarClock, ChevronLeft, ChevronRight, MapPin } from 'lucide-react';
import { BlockError, EmptyState } from '@/components/common/EmptyState';
import { Skeleton } from '@/components/common/Skeleton';
import { getMyShifts, SELF_KEYS } from '@/api/self';
import { cn } from '@/lib/cn';

const pad = (n: number) => String(n).padStart(2, '0');
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const hhmm = (iso: string) => new Date(iso).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

/** Thứ Hai của tuần chứa ngày d. */
function monday(d: Date) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
}

/** Ca làm của tôi theo tuần (ca, giờ, khu vực phụ trách, đã chấm công hay chưa). */
export function MyShiftsView() {
  const [week, setWeek] = useState(() => monday(new Date()));
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => new Date(week.getFullYear(), week.getMonth(), week.getDate() + i)), [week]);
  const from = ymd(days[0]);
  const to = ymd(days[6]);
  const q = useQuery({ queryKey: SELF_KEYS.shifts(from, to), queryFn: () => getMyShifts(from, to) });
  const today = ymd(new Date());
  const shift = (n: number) => setWeek((w) => new Date(w.getFullYear(), w.getMonth(), w.getDate() + n * 7));

  return (
      <div className="space-y-3">
        <div className="flex items-center justify-between rounded-[12px] bg-[var(--bg-surface)] p-1.5">
          <button type="button" aria-label="Tuần trước" onClick={() => shift(-1)} className="grid h-9 w-9 place-items-center rounded-lg hover:bg-[var(--bg-hover)]"><ChevronLeft size={18} /></button>
          <button type="button" onClick={() => setWeek(monday(new Date()))} className="text-[14px] font-semibold">
            {days[0].toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })} – {days[6].toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })}
          </button>
          <button type="button" aria-label="Tuần sau" onClick={() => shift(1)} className="grid h-9 w-9 place-items-center rounded-lg hover:bg-[var(--bg-hover)]"><ChevronRight size={18} /></button>
        </div>
        {q.isError ? (
          <BlockError onRetry={() => void q.refetch()} retrying={q.isFetching} />
        ) : !q.data ? (
          <Skeleton className="h-60" />
        ) : q.data.length === 0 ? (
          <EmptyState icon={CalendarClock} title="Tuần này bạn chưa có ca nào" />
        ) : (
          <ul className="space-y-2">
            {days.map((d) => {
              const key = ymd(d);
              const list = q.data.filter((s) => s.date === key);
              return (
                <li key={key} className={cn('rounded-[14px] border bg-[var(--bg-surface)] p-3', key === today ? 'border-[var(--accent)]' : 'border-[var(--border)]')}>
                  <p className={cn('text-[13px] font-bold first-letter:uppercase', key === today ? 'text-[var(--accent)]' : 'text-[var(--text-secondary)]')}>
                    {d.toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit' })}{key === today ? ' · Hôm nay' : ''}
                  </p>
                  {list.length === 0 ? (
                    <p className="mt-1 text-[13px] text-[var(--text-muted)]">Nghỉ</p>
                  ) : (
                    list.map((s) => (
                      <div key={s.id} className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span className="text-[15px] font-bold">{s.shiftName}</span>
                        <span className="font-mono text-[14px]">{hhmm(s.start)}–{hhmm(s.end)}</span>
                        {s.areaName ? <span className="inline-flex items-center gap-1 rounded-full bg-[var(--accent-soft)] px-2 py-0.5 text-[12px] font-semibold text-[var(--accent)]"><MapPin size={12} />{s.areaName}</span> : null}
                        {s.attended ? <span className="rounded-full bg-[var(--success-soft)] px-2 py-0.5 text-[12px] font-semibold text-[var(--success)]">Đã chấm công</span> : null}
                      </div>
                    ))
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
  );
}
