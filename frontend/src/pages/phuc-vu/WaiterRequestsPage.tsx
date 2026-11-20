import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { BellRing, Check, Footprints, X } from 'lucide-react';
import { Badge } from '@/components/common/Badge';
import { Button } from '@/components/common/Button';
import { BlockError, EmptyState } from '@/components/common/EmptyState';
import { Skeleton } from '@/components/common/Skeleton';
import { acceptRequest, dropRequest, finishRequest, getWaiterRequests, WAITER_KEYS } from '@/api/waiter';
import { useAuth } from '@/lib/auth';
import { WaiterShell } from '@/features/waiter/WaiterShell';
import { REQUEST_TYPE_LABEL } from '@/features/ordering/requestLabels';
import { minutesSince, REQUEST_STATUS } from '@/features/ordering/cashierParts';
import { formatDateTime } from '@/lib/labels';
import { cn } from '@/lib/cn';

type Tab = 'waiting' | 'done' | 'cancelled';

/**
 * Yêu cầu hỗ trợ của khách (Gọi nhân viên qua QR) trong khu vực của mình. "Tôi đến" → khách thấy tên mình đang đến.
 * Yêu cầu chờ quá 3 phút tô đỏ. Âm báo + rung do WaiterShell phát khi có yêu cầu mới.
 */
export default function WaiterRequestsPage() {
  const qc = useQueryClient();
  const { data: me } = useAuth();
  const [tab, setTab] = useState<Tab>('waiting');
  const list = useQuery({ queryKey: WAITER_KEYS.requests(tab), queryFn: () => getWaiterRequests(tab), refetchInterval: 15_000 });
  const [params, setParams] = useSearchParams();
  const focusId = params.get('id');
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((x) => x + 1), 30_000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    if (!focusId || !list.data) return;
    document.querySelector(`[data-request="${focusId}"]`)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    setParams({}, { replace: true });
  }, [focusId, list.data, setParams]);

  const after = (msg: string) => () => { toast.success(msg); void qc.invalidateQueries({ queryKey: WAITER_KEYS.all }); };
  const onError = (e: unknown) => { toast.error(e instanceof Error ? e.message : 'Không lưu được'); void qc.invalidateQueries({ queryKey: WAITER_KEYS.all }); };
  const accept = useMutation({ mutationFn: acceptRequest, onSuccess: after('Đã nhận — khách thấy "Nhân viên đang đến"'), onError });
  const finish = useMutation({ mutationFn: finishRequest, onSuccess: after('Đã hoàn thành yêu cầu'), onError });
  const drop = useMutation({ mutationFn: dropRequest, onSuccess: after('Đã hủy yêu cầu'), onError });

  return (
    <WaiterShell title="YÊU CẦU CỦA KHÁCH">
      <div className="mx-auto max-w-2xl space-y-3">
        <div className="grid grid-cols-3 gap-1 rounded-[12px] bg-[var(--bg-subtle)] p-1" role="tablist">
          {([['waiting', list.data && tab === 'waiting' ? `Đang chờ (${list.data.waitingCount})` : 'Đang chờ'], ['done', 'Hoàn thành'], ['cancelled', 'Đã hủy']] as const).map(([k, l]) => (
            <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={cn('h-9 rounded-[10px] text-[13px] font-semibold', tab === k ? 'bg-[var(--bg-surface)] text-[var(--accent)] shadow-sm' : 'text-[var(--text-secondary)]')}>{l}</button>
          ))}
        </div>
        {list.isError ? (
          <BlockError onRetry={() => void list.refetch()} retrying={list.isFetching} />
        ) : !list.data ? (
          <Skeleton className="h-40" />
        ) : list.data.items.length === 0 ? (
          <EmptyState icon={BellRing} title={tab === 'waiting' ? 'Không có khách nào đang gọi' : 'Chưa có yêu cầu'} description={tab === 'waiting' ? 'Yêu cầu của bàn trong khu vực của bạn sẽ hiện ở đây kèm âm báo.' : undefined} />
        ) : (
          <ul className="space-y-2">
            {list.data.items.map((r) => {
              const wait = minutesSince(r.createdAt);
              const late = tab === 'waiting' && r.status === 'new' && wait >= 3;
              const mineReq = r.assignedName && r.assignedName === me?.fullName;
              return (
                <li key={r.id} data-request={r.id} className={cn('rounded-[14px] border bg-[var(--bg-surface)] p-3', late ? 'border-[var(--danger)] bg-[var(--danger-soft)]' : 'border-[var(--border)]')}>
                  <div className="flex items-start gap-3">
                    <span className="grid h-12 min-w-12 place-items-center rounded-[12px] bg-[#f97316] px-1 text-[16px] font-extrabold text-white">{r.tableCode}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[15px] font-bold">
                        {REQUEST_TYPE_LABEL[r.type]} <span className="text-[12.5px] font-medium text-[var(--text-muted)]">· {r.areaName}</span>
                      </p>
                      {r.content ? <p className="text-[13.5px]">{r.content}</p> : null}
                      <p className="mt-0.5 text-[12px] text-[var(--text-muted)]">
                        {formatDateTime(r.createdAt)}
                        {tab === 'waiting' ? <span className={cn('ml-1', late && 'font-semibold text-[var(--danger)]')}>· chờ {wait} phút</span> : null}
                      </p>
                      <div className="mt-1"><Badge variant={REQUEST_STATUS[r.status].variant}>{r.status === 'forwarded' ? `${mineReq ? 'Bạn' : r.assignedName ?? 'Nhân viên'} đang đến` : REQUEST_STATUS[r.status].label}</Badge></div>
                    </div>
                  </div>
                  {tab === 'waiting' ? (
                    <div className="mt-3 flex gap-2">
                      {r.status === 'new' ? (
                        <Button className="flex-1" leadingIcon={<Footprints size={16} />} loading={accept.isPending && accept.variables === r.id} onClick={() => accept.mutate(r.id)}>Tôi đến</Button>
                      ) : null}
                      <Button className="flex-1" variant={r.status === 'new' ? 'outline' : 'primary'} leadingIcon={<Check size={16} />} loading={finish.isPending && finish.variables === r.id} onClick={() => finish.mutate(r.id)}>Hoàn thành</Button>
                      <Button variant="ghost" aria-label={`Hủy yêu cầu bàn ${r.tableCode}`} loading={drop.isPending && drop.variables === r.id} onClick={() => drop.mutate(r.id)}><X size={16} /></Button>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </WaiterShell>
  );
}
