import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowRightLeft, Check, HandPlatter, Merge, Minus, Plus, ShoppingBag, X } from 'lucide-react';
import { Button } from '@/components/common/Button';
import { BlockError } from '@/components/common/EmptyState';
import { Skeleton } from '@/components/common/Skeleton';
import {
  acceptRequest,
  finishRequest,
  getWaiterFloor,
  getWaiterOrder,
  waiterCloseTable,
  waiterMerge,
  waiterMergeTargets,
  waiterMove,
  waiterMoveTargets,
  waiterOpenTable,
  waiterServe,
  waiterSetGuests,
  WAITER_KEYS,
} from '@/api/waiter';
import { WaiterShell } from '@/features/waiter/WaiterShell';
import { MoveTableDialog } from '@/features/ordering/CashierDialogs';
import { elapsed, FloorCanvas, guestsOf, hhmm, LEGEND, soonReservation, STATE, stateOf, type TableState } from '@/features/ordering/floorParts';
import { REQUEST_TYPE_LABEL } from '@/features/ordering/requestLabels';
import { formatCurrency } from '@/lib/format';
import { cn } from '@/lib/cn';
import type { CashierFloor, CashierOrderDetail, FloorTable, OrderItemStatus } from '@/types';

const ZOOM_KEY = 'rms-waiter-zoom';
const errText = (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback);

/**
 * Sơ đồ bàn của Nhân viên phục vụ: vẽ đúng vị trí Quản lý đã xếp (quản lý sửa → cập nhật ngay, có thông báo).
 * Mở sẵn khu được gán trong ca; xem được khu khác để hỗ trợ khi đông. Bấm bàn → bảng thao tác (trượt từ dưới lên trên điện thoại).
 */
export default function WaiterFloorPage() {
  const q = useQuery({ queryKey: WAITER_KEYS.floor, queryFn: getWaiterFloor, refetchInterval: 15_000 });
  const [area, setArea] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [zoom, setZoom] = useState(() => Number(localStorage.getItem(ZOOM_KEY)) || (window.innerWidth < 640 ? 0.6 : 0.9));
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => localStorage.setItem(ZOOM_KEY, String(zoom)), [zoom]);

  const f = q.data?.floor;
  const mine = q.data?.myAreaIds ?? [];
  const areaId = area ?? mine[0] ?? f?.areas[0]?.id ?? null;
  const areaTables = useMemo(() => (f?.tables ?? []).filter((t) => t.areaId === areaId), [f, areaId]);
  const sel = f?.tables.find((t) => t.id === selected) ?? null;
  const counts = useMemo(() => {
    const c = Object.fromEntries(LEGEND.map((k) => [k, 0])) as Record<TableState, number>;
    areaTables.forEach((t) => c[stateOf(t)]++);
    return c;
  }, [areaTables]);

  return (
    <WaiterShell fill>
      {q.isError ? (
        <div className="p-4"><BlockError onRetry={() => void q.refetch()} retrying={q.isFetching} /></div>
      ) : !f ? (
        <div className="grid flex-1 grid-cols-2 gap-3 p-4">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-28" />)}</div>
      ) : (
        <div className="flex min-h-0 flex-1">
          <section className="flex min-w-0 flex-1 flex-col">
            <div className="flex items-center gap-2 border-b border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2">
              <div className="no-scrollbar flex min-w-0 flex-1 gap-1 overflow-x-auto" role="tablist" aria-label="Khu vực">
                {f.areas.map((a) => {
                  const list = f.tables.filter((t) => t.areaId === a.id);
                  const alert = list.some((t) => ['calling', 'late'].includes(stateOf(t)) || (t.order?.readyCount ?? 0) > 0);
                  const on = a.id === areaId;
                  const my = mine.includes(a.id);
                  return (
                    <button
                      key={a.id}
                      type="button"
                      role="tab"
                      aria-selected={on}
                      onClick={() => { setArea(a.id); setSelected(null); }}
                      className={cn('relative inline-flex h-9 shrink-0 items-center gap-1.5 rounded-[10px] px-3 text-[13.5px] font-semibold', on ? 'bg-[var(--accent)] text-white' : 'bg-[var(--bg-subtle)] text-[var(--text-secondary)]')}
                    >
                      {a.name}
                      {my ? <span className={cn('rounded-full px-1.5 text-[10.5px] font-bold', on ? 'bg-white/25' : 'bg-[var(--accent-soft)] text-[var(--accent)]')}>Của tôi</span> : null}
                      {alert ? <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-[#f97316] ring-2 ring-[var(--bg-surface)]" aria-label="Có bàn cần xử lý" /> : null}
                    </button>
                  );
                })}
              </div>
              <div className="flex items-center rounded-[10px] bg-[var(--bg-subtle)] p-0.5">
                <button type="button" aria-label="Thu nhỏ" onClick={() => setZoom((z) => Math.max(0.4, +(z - 0.1).toFixed(1)))} className="grid h-8 w-8 place-items-center rounded-lg"><Minus size={15} /></button>
                <button type="button" aria-label="Phóng to" onClick={() => setZoom((z) => Math.min(1.4, +(z + 0.1).toFixed(1)))} className="grid h-8 w-8 place-items-center rounded-lg"><Plus size={15} /></button>
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-auto p-3" onClick={() => setSelected(null)}>
              <FloorCanvas floor={f} tables={areaTables} zoom={zoom} selected={selected} onSelect={(id) => setSelected(id === selected ? null : id)} />
            </div>
            <footer className="no-scrollbar flex shrink-0 gap-1.5 overflow-x-auto border-t border-[var(--border)] bg-[var(--bg-surface)] px-3 py-1.5">
              {LEGEND.filter((k) => k !== 'payment' || counts[k]).map((k) => (
                <span key={k} className="inline-flex shrink-0 items-center gap-1.5 rounded-[8px] bg-[var(--bg-subtle)] py-0.5 pl-0.5 pr-2 text-[11.5px] font-medium">
                  <span className="grid h-6 min-w-6 place-items-center rounded-md px-1 font-mono text-[12px] font-bold" style={{ background: STATE[k].bg, color: STATE[k].fg }}>{counts[k]}</span>
                  {STATE[k].label}
                </span>
              ))}
            </footer>
          </section>

          {sel ? (
            <>
              <div className="fixed inset-0 z-30 bg-black/30 lg:hidden" onClick={() => setSelected(null)} />
              <aside className="fixed inset-x-0 bottom-0 z-40 flex max-h-[85dvh] flex-col rounded-t-[20px] bg-[var(--bg-surface)] shadow-2xl lg:static lg:z-auto lg:max-h-none lg:w-[380px] lg:rounded-none lg:border-l lg:border-[var(--border)] lg:shadow-none">
                <WaiterTablePanel key={sel.id} table={sel} floor={f} onClose={() => setSelected(null)} />
              </aside>
            </>
          ) : null}
        </div>
      )}
    </WaiterShell>
  );
}

/* ---------------------------------------------------------------- Bảng một bàn */

const ITEM_STATE: Record<OrderItemStatus, string> = { pending: 'Chờ bếp', cooking: 'Đang làm', done: 'Chờ mang ra', served: 'Đã mang', cancelled: 'Hủy' };

function WaiterTablePanel({ table: t, floor, onClose }: { table: FloorTable; floor: CashierFloor; onClose: () => void }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const st = STATE[stateOf(t)];
  const orderId = t.order?.id ?? '';
  const detail = useQuery({ queryKey: WAITER_KEYS.order(orderId), queryFn: () => getWaiterOrder(orderId), enabled: Boolean(orderId), refetchInterval: 10_000 });
  const [moveOpen, setMoveOpen] = useState<'move' | 'merge' | null>(null);
  const [guestsPick, setGuestsPick] = useState<number | null>(null);
  const areaName = floor.areas.find((a) => a.id === t.areaId)?.name ?? '';

  const refresh = () => void qc.invalidateQueries({ queryKey: WAITER_KEYS.all });
  const apply = (d: CashierOrderDetail) => {
    qc.setQueryData(WAITER_KEYS.order(d.order.id), d);
    refresh();
  };
  const onErr = (e: unknown) => toast.error(errText(e, 'Không lưu được'));

  const open = useMutation({
    mutationFn: (v: { reservationId?: string; guests: number | null }) => waiterOpenTable(t.id, v.guests, v.reservationId),
    onSuccess: (d) => { toast.success(`Đã mở bàn ${t.code} — khách quét mã QR để gọi món`); apply(d); },
    onError: onErr,
  });
  const guests = useMutation({ mutationFn: (n: number | null) => waiterSetGuests(orderId, n), onSuccess: apply, onError: onErr });
  const close = useMutation({
    mutationFn: waiterCloseTable,
    onSuccess: () => { toast.success(`Đã đóng bàn ${t.code}`); refresh(); onClose(); },
    onError: onErr,
  });
  const accept = useMutation({ mutationFn: acceptRequest, onSuccess: () => { toast.success('Đã nhận — khách thấy "Nhân viên đang đến"'); void detail.refetch(); refresh(); }, onError: onErr });
  const finish = useMutation({ mutationFn: finishRequest, onSuccess: () => { toast.success('Đã hoàn thành yêu cầu'); void detail.refetch(); refresh(); }, onError: onErr });
  const serve = useMutation({
    mutationFn: waiterServe,
    onSuccess: (_, ids) => { toast.success(`Đã mang ${ids.length} món ra bàn ${t.code}`); void detail.refetch(); refresh(); },
    onError: (e) => { onErr(e); void detail.refetch(); },
  });

  const d = detail.data;
  const o = d?.order;
  const g = d ? d.guests : t.order?.guests ?? null;
  const activeItems = (o?.items ?? []).filter((i) => i.status !== 'cancelled');
  const ready = activeItems.filter((i) => i.status === 'done');
  const supportReqs = (d?.requests ?? []).filter((r) => r.type !== 'payment');
  const payment = (d?.requests ?? []).some((r) => r.type === 'payment') || t.paymentRequest;
  const soon = !t.order ? soonReservation(t) : null;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="mx-auto mt-2 h-1.5 w-10 rounded-full bg-[var(--border)] lg:hidden" />
      <div className="flex items-start gap-3 border-b border-[var(--border)] p-3">
        <span className="grid h-11 min-w-11 place-items-center rounded-[12px] px-2 text-[17px] font-extrabold" style={{ background: st.bg, color: st.fg }}>{t.code}</span>
        <div className="min-w-0 flex-1">
          <p className="text-[16px] font-bold">Bàn {t.code}</p>
          <p className="text-[12.5px] text-[var(--text-muted)]">{areaName} · {t.seats} ghế · <span className="font-semibold">{st.label}</span></p>
        </div>
        <button type="button" aria-label="Đóng" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-lg hover:bg-[var(--bg-hover)]"><X size={18} /></button>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
        {!t.order ? (
          <>
            {t.reservation ? (
              <div className="rounded-[12px] border border-[#c4b5fd] bg-[#f5f3ff] p-3">
                <p className="text-[12px] font-semibold uppercase tracking-wide text-[#7c3aed]">Đặt bàn{soon ? '' : ' (chưa tới giờ)'}</p>
                <p className="mt-0.5 text-[15px] font-bold">{t.reservation.customerName} · {t.reservation.guests} khách</p>
                <p className="text-[13px] text-[var(--text-secondary)]">Đến lúc {hhmm(t.reservation.time)}</p>
              </div>
            ) : null}
            {t.status === 'inactive' ? (
              <p className="rounded-[12px] bg-[var(--bg-subtle)] p-3 text-[13.5px] text-[var(--text-secondary)]">Bàn đang ngừng phục vụ.</p>
            ) : (
              <div className="space-y-3 rounded-[12px] border border-[var(--border)] p-3">
                <p className="text-[13px] text-[var(--text-secondary)]">Mở bàn khi khách đã ngồi — từ lúc này mã QR trên bàn mới gọi món được.</p>
                {t.reservation ? (
                  <Button className="w-full" loading={open.isPending && Boolean(open.variables?.reservationId)} onClick={() => open.mutate({ reservationId: t.reservation!.id, guests: null })}>
                    Khách đặt trước đã đến ({t.reservation.guests} khách)
                  </Button>
                ) : null}
                <div>
                  <p className="mb-1.5 text-[12.5px] font-semibold">Số khách <span className="font-normal text-[var(--text-muted)]">(không bắt buộc)</span></p>
                  <div className="grid grid-cols-6 gap-1.5">
                    {Array.from({ length: Math.max(6, Math.min(12, t.seats)) }, (_, i) => i + 1).map((n) => (
                      <button key={n} type="button" aria-pressed={guestsPick === n} onClick={() => setGuestsPick(guestsPick === n ? null : n)} className={cn('h-10 rounded-[10px] font-mono text-[15px] font-bold', guestsPick === n ? 'bg-[var(--accent)] text-white' : 'bg-[var(--bg-subtle)]')}>{n}</button>
                    ))}
                  </div>
                </div>
                <Button variant={t.reservation ? 'outline' : 'primary'} className="w-full" loading={open.isPending && !open.variables?.reservationId} onClick={() => open.mutate({ guests: guestsPick })}>
                  {t.reservation ? 'Mở bàn cho khách khác' : 'Mở bàn'}
                </Button>
              </div>
            )}
          </>
        ) : (
          <>
            {supportReqs.map((r) => (
              <div key={r.id} className="rounded-[12px] border border-[#fdba74] bg-[#fff7ed] p-3 text-[13.5px]">
                <p className="font-semibold text-[#c2410c]">Khách gọi – {REQUEST_TYPE_LABEL[r.type]} · {hhmm(r.createdAt)}</p>
                {r.content ? <p className="text-[var(--text-secondary)]">{r.content}</p> : null}
                {r.status === 'forwarded' ? <p className="text-[12.5px] text-[var(--text-muted)]">{r.assignedName ?? 'Nhân viên'} đang đến</p> : null}
                <div className="mt-2 flex gap-2">
                  {r.status === 'new' ? <Button size="sm" variant="outline" loading={accept.isPending && accept.variables === r.id} onClick={() => accept.mutate(r.id)}>Tôi đến</Button> : null}
                  <Button size="sm" leadingIcon={<Check size={14} />} loading={finish.isPending && finish.variables === r.id} onClick={() => finish.mutate(r.id)}>Hoàn thành</Button>
                </div>
              </div>
            ))}
            {payment ? <p className="rounded-[12px] bg-[#fefce8] p-3 text-[13px] text-[#854d0e]">Khách đã yêu cầu thanh toán — thu ngân đang xử lý hóa đơn.</p> : null}

            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-[12px] bg-[var(--bg-subtle)] p-2.5">
                <p className="text-[11.5px] text-[var(--text-muted)]">Giờ vào</p>
                <p className="font-mono text-[16px] font-bold">{hhmm(t.order.openedAt)} <span className="text-[12px] font-medium text-[var(--text-muted)]">· {elapsed(t.order.openedAt)}</span></p>
              </div>
              <div className="rounded-[12px] bg-[var(--bg-subtle)] p-2.5">
                <p className="text-[11.5px] text-[var(--text-muted)]">Tạm tính</p>
                <p className="font-mono text-[16px] font-bold text-[var(--accent)]">{formatCurrency(o?.subtotal ?? t.order.subtotal)}</p>
              </div>
            </div>

            <div>
              <p className="mb-1.5 flex justify-between text-[12.5px] font-semibold">Số khách <span className="font-normal text-[var(--text-muted)]">{g ? `${g}/${t.seats} ghế` : guestsOf(t) ? `Theo phiếu đặt: ${guestsOf(t)}` : 'Chưa nhập'}</span></p>
              <div className="flex flex-wrap gap-1.5">
                {Array.from({ length: Math.max(8, Math.min(12, t.seats)) }, (_, i) => i + 1).map((n) => (
                  <button key={n} type="button" disabled={guests.isPending || o?.status !== 'open'} onClick={() => guests.mutate(n === g ? null : n)} aria-pressed={n === g} className={cn('h-9 w-9 rounded-[10px] font-mono text-[14px] font-bold disabled:opacity-50', n === g ? 'bg-[var(--accent)] text-white' : 'bg-[var(--bg-subtle)]')}>{n}</button>
                ))}
              </div>
            </div>

            {ready.length ? (
              <div className="rounded-[12px] border border-[#86efac] bg-[#f0fdf4] p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[13.5px] font-semibold text-[#15803d]">{ready.length} món bếp đã xong — chờ mang ra</p>
                  <Button size="sm" leadingIcon={<HandPlatter size={14} />} loading={serve.isPending} onClick={() => serve.mutate(ready.map((i) => i.id))}>Đã mang hết</Button>
                </div>
              </div>
            ) : null}

            <div>
              <p className="mb-1.5 text-[12.5px] font-semibold">Món ({activeItems.length}){t.order.lateCount ? <span className="ml-2 text-[#dc2626]">{t.order.lateCount} món chờ quá {floor.lateMinutes}′</span> : null}</p>
              {!o ? <Skeleton className="h-20" /> : activeItems.length === 0 ? (
                <p className="rounded-[12px] bg-[var(--bg-subtle)] p-3 text-[13px] text-[var(--text-muted)]">Khách chưa gọi món. Khách quét mã QR trên bàn, hoặc bấm "Gọi món" để gọi giúp khách.</p>
              ) : (
                <ul className="divide-y divide-[var(--border)] rounded-[12px] border border-[var(--border)]">
                  {activeItems.map((i) => (
                    <li key={i.id} className="flex items-center gap-2 px-3 py-2 text-[13.5px]">
                      <span className="min-w-0 flex-1"><b className="font-mono">{i.qty}</b> {i.name}{i.note ? <span className="text-[var(--text-muted)]"> · {i.note}</span> : null}</span>
                      {i.status === 'done' ? (
                        <button type="button" disabled={serve.isPending} onClick={() => serve.mutate([i.id])} className="shrink-0 rounded-full bg-[#16a34a] px-2.5 py-1 text-[11.5px] font-bold text-white">Mang ra</button>
                      ) : (
                        <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[11.5px] font-semibold', i.status === 'served' ? 'bg-[var(--bg-subtle)] text-[var(--text-muted)]' : i.status === 'cooking' ? 'bg-[var(--warning-soft)] text-[var(--warning)]' : 'bg-[var(--info-soft)] text-[var(--info)]')}>{ITEM_STATE[i.status]}</span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </div>

      {t.order && o && o.status === 'open' ? (
        <div className="grid grid-cols-2 gap-2 border-t border-[var(--border)] p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <Button className="col-span-2" leadingIcon={<ShoppingBag size={16} />} disabled={o.locked} onClick={() => navigate(`/phuc-vu/goi-mon/${t.id}`)}>
            {o.locked ? 'Đang chờ thanh toán — không gọi thêm' : 'Gọi món cho khách'}
          </Button>
          <Button variant="outline" leadingIcon={<ArrowRightLeft size={15} />} onClick={() => setMoveOpen('move')}>Chuyển bàn</Button>
          <Button variant="outline" leadingIcon={<Merge size={15} />} disabled={o.locked} onClick={() => setMoveOpen('merge')}>Ghép bàn</Button>
          {activeItems.length === 0 && !o.locked ? (
            <Button variant="ghost" className="col-span-2" leadingIcon={<X size={15} />} loading={close.isPending} onClick={() => close.mutate(o.id)}>Đóng bàn (khách chưa gọi món)</Button>
          ) : null}
        </div>
      ) : null}

      {o ? (
        <MoveTableDialog
          open={moveOpen !== null}
          mode={moveOpen ?? 'move'}
          order={o}
          loadTargets={moveOpen === 'merge' ? waiterMergeTargets : waiterMoveTargets}
          submit={moveOpen === 'merge' ? waiterMerge : waiterMove}
          targetsKey={['phuc-vu', moveOpen === 'merge' ? 'merge-targets' : 'move-targets']}
          onClose={() => setMoveOpen(null)}
          onDone={(x) => { apply(x); onClose(); }}
        />
      ) : null}
    </div>
  );
}
