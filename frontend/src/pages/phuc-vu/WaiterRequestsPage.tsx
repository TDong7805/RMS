import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { BellRing, Check, ClipboardCheck, Footprints, X } from 'lucide-react';
import { Badge } from '@/components/common/Badge';
import { Button } from '@/components/common/Button';
import { BlockError, EmptyState } from '@/components/common/EmptyState';
import { Skeleton } from '@/components/common/Skeleton';
import { acceptRequest, confirmOrder, dropRequest, finishRequest, getConfirmations, getWaiterFloor, getWaiterRequests, WAITER_KEYS, type PendingConfirm } from '@/api/waiter';
import { useAuth } from '@/lib/auth';
import { WaiterShell } from '@/features/waiter/WaiterShell';
import { REQUEST_TYPE_LABEL } from '@/features/ordering/requestLabels';
import { minutesSince, REQUEST_STATUS } from '@/features/ordering/cashierParts';
import { formatDateTime } from '@/lib/labels';
import { cn } from '@/lib/cn';

type Tab = 'waiting' | 'done' | 'cancelled';

/**
 * Việc của khách trong khu vực của mình:
 *  - Đơn chờ xác nhận (V22): món khách gửi qua QR — kiểm tra với khách rồi xác nhận (chuyển bếp, ghi tên mình) hoặc bỏ từng món
 *    kèm lý do. Chờ quá N phút: tô đỏ, mọi phục vụ đã vào ca đều thấy.
 *  - Yêu cầu hỗ trợ (Gọi nhân viên): "Tôi đến" → khách thấy tên mình đang đến. Chờ quá 3 phút tô đỏ.
 * Âm báo + rung do WaiterShell phát. Chưa vào ca: chỉ xem.
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
  const confirms = useQuery({ queryKey: WAITER_KEYS.confirmations, queryFn: getConfirmations, refetchInterval: 15_000 });
  const onDuty = useQuery({ queryKey: WAITER_KEYS.floor, queryFn: getWaiterFloor }).data?.clockedIn ?? false;
  const focusOrder = params.get('order');

  return (
    <WaiterShell title="ĐƠN & YÊU CẦU">
      <fieldset disabled={!onDuty} className="mx-auto m-0 min-w-0 max-w-2xl space-y-3 border-0 p-0">
        {/* Luôn hiện mục này (kể cả khi trống) để nhân viên biết đơn khách gửi phải được xác nhận ở đây. */}
        <section className="space-y-2">
          <h2 className="flex items-center gap-1.5 text-[14px] font-bold text-[#9d174d]"><ClipboardCheck size={16} /> Đơn chờ xác nhận ({confirms.data?.items.length ?? 0})</h2>
          {confirms.data?.items.length ? (
            confirms.data.items.map((c) => <ConfirmCard key={c.orderId} c={c} focus={focusOrder === c.orderId} remindMinutes={confirms.data!.remindMinutes} />)
          ) : (
            <p className="rounded-[14px] border border-dashed border-[#f9a8d4] bg-[var(--bg-surface)] p-4 text-center text-[13px] text-[var(--text-muted)]">
              Chưa có đơn nào chờ xác nhận. Khi khách ở khu của bạn gửi món qua mã QR, đơn sẽ hiện ở đây (kèm âm báo khi bạn đã vào ca) — bạn xác nhận thì món mới chuyển xuống bếp.
            </p>
          )}
        </section>
        <h2 className="flex items-center gap-1.5 pt-1 text-[14px] font-bold"><BellRing size={16} /> Khách gọi nhân viên</h2>
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
      </fieldset>
    </WaiterShell>
  );
}

/** Một bàn có món chờ xác nhận: bấm "Bỏ món" để đánh dấu bỏ (nhập lý do), rồi "Xác nhận, chuyển bếp". */
function ConfirmCard({ c, focus, remindMinutes }: { c: PendingConfirm; focus: boolean; remindMinutes: number }) {
  const qc = useQueryClient();
  const [rejects, setRejects] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  useEffect(() => {
    if (focus) document.querySelector(`[data-confirm="${c.orderId}"]`)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [focus, c.orderId]);
  const m = useMutation({
    mutationFn: () => confirmOrder(c.orderId, Object.entries(rejects).map(([itemId, reason]) => ({ itemId, reason }))),
    onSuccess: () => {
      const n = Object.keys(rejects).length;
      toast.success(`Đã xác nhận đơn bàn ${c.tableCode}${n ? ` (bỏ ${n} món)` : ''} — món chuyển xuống bếp`);
      void qc.invalidateQueries({ queryKey: WAITER_KEYS.all });
    },
    onError: (e) => { toast.error(e instanceof Error ? e.message : 'Không xác nhận được'); void qc.invalidateQueries({ queryKey: WAITER_KEYS.all }); },
  });
  const toggle = (id: string) => setRejects((r) => {
    const next = { ...r };
    if (id in next) delete next[id];
    else next[id] = '';
    return next;
  });
  const submit = () => {
    const err: Record<string, string> = {};
    Object.entries(rejects).forEach(([id, reason]) => { if (!reason.trim()) err[id] = 'Nhập lý do bỏ món'; });
    setErrors(err);
    if (!Object.keys(err).length) m.mutate();
  };
  const kept = c.items.filter((i) => !(i.itemId in rejects)).length;
  return (
    <div data-confirm={c.orderId} className={cn('rounded-[14px] border-2 bg-[var(--bg-surface)] p-3', c.overdue ? 'border-[var(--danger)] bg-[var(--danger-soft)]' : 'border-[#f9a8d4]', focus && 'rms-flash')}>
      <div className="flex items-center gap-3">
        <span className="grid h-12 min-w-12 place-items-center rounded-[12px] bg-[#db2777] px-1 text-[16px] font-extrabold text-white">{c.tableCode}</span>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-bold">{c.items.length} món chờ xác nhận <span className="text-[12.5px] font-medium text-[var(--text-muted)]">· {c.areaName}</span></p>
          <p className={cn('text-[12.5px]', c.overdue ? 'font-semibold text-[var(--danger)]' : 'text-[var(--text-muted)]')}>
            Khách gửi {c.waitingMinutes} phút trước{c.overdue ? ` — quá ${remindMinutes} phút, mọi phục vụ đều thấy` : ''}
          </p>
        </div>
      </div>
      <ul className="mt-2 divide-y divide-[var(--border)] rounded-[12px] border border-[var(--border)] bg-[var(--bg-surface)]">
        {c.items.map((i) => {
          const off = i.itemId in rejects;
          return (
            <li key={i.itemId} className="px-3 py-2">
              <div className="flex items-center gap-2">
                <span className={cn('min-w-0 flex-1 text-[14px]', off && 'text-[var(--text-muted)] line-through')}>
                  <b className="font-mono">{i.qty}×</b> {i.name}
                  {i.setName ? <span className="text-[12px] text-[var(--accent)]"> · {i.setName}</span> : null}
                  {i.note ? <span className="block text-[12.5px] text-[var(--text-muted)]">“{i.note}”</span> : null}
                </span>
                <button type="button" onClick={() => toggle(i.itemId)} className={cn('shrink-0 rounded-full px-2.5 py-1 text-[12px] font-semibold', off ? 'bg-[var(--bg-subtle)] text-[var(--text-secondary)]' : 'border border-[var(--border)] text-[var(--danger)]')}>
                  {off ? 'Giữ lại' : 'Bỏ món'}
                </button>
              </div>
              {off ? (
                <>
                  <input
                    value={rejects[i.itemId]}
                    maxLength={200}
                    onChange={(e) => { setRejects((r) => ({ ...r, [i.itemId]: e.target.value })); setErrors((x) => ({ ...x, [i.itemId]: '' })); }}
                    placeholder="Lý do (khách thấy): gọi nhầm, hết món…"
                    className={cn('mt-1.5 h-9 w-full rounded-[8px] bg-[var(--bg-subtle)] px-2.5 text-[13px] outline-none', errors[i.itemId] && 'ring-2 ring-[var(--danger)]')}
                  />
                  {errors[i.itemId] ? <p className="mt-0.5 text-[12px] text-[var(--danger)]">{errors[i.itemId]}</p> : null}
                  {i.setName ? <p className="mt-0.5 text-[11.5px] text-[var(--text-muted)]">Bỏ món trong set sẽ bỏ cả {i.setName}.</p> : null}
                </>
              ) : null}
            </li>
          );
        })}
      </ul>
      <Button className="mt-2 w-full" leadingIcon={<Check size={16} />} loading={m.isPending} onClick={submit}>
        {kept ? `Xác nhận ${kept} món, chuyển bếp` : 'Bỏ tất cả món'}
      </Button>
    </div>
  );
}
