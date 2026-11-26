import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowRightLeft, Check, ChefHat, ClipboardCheck, LayoutGrid, List, Merge, ShoppingBag, X } from 'lucide-react';
import { Button } from '@/components/common/Button';
import { BlockError } from '@/components/common/EmptyState';
import { Skeleton } from '@/components/common/Skeleton';
import {
  acceptRequest,
  confirmOrder,
  finishRequest,
  getWaiterFloor,
  getWaiterOrder,
  waiterCloseTable,
  waiterMerge,
  waiterMergeTargets,
  waiterMove,
  waiterMoveTargets,
  waiterOpenTable,
  waiterSetGuests,
  WAITER_KEYS,
} from '@/api/waiter';
import { WaiterShell } from '@/features/waiter/WaiterShell';
import { MoveTableDialog } from '@/features/ordering/CashierDialogs';
import { areaWindow, CELL, elapsed, FloorCanvas, guestsOf, hhmm, LEGEND, soonReservation, STATE, stateOf, type TableState } from '@/features/ordering/floorParts';
import { REQUEST_TYPE_LABEL } from '@/features/ordering/requestLabels';
import { formatCurrency } from '@/lib/format';
import { cn } from '@/lib/cn';
import type { CashierFloor, CashierOrderDetail, FloorTable, OrderItemStatus } from '@/types';

const VIEW_KEY = 'rms-waiter-view';
const errText = (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback);

/** Thứ tự trên danh sách thẻ: việc cần làm ngay lên đầu. */
const PRIORITY: Record<TableState, number> = { confirm: 0, calling: 1, late: 2, ready: 3, payment: 4, occupied: 5, reserved: 6, available: 7, inactive: 8 };

/**
 * Sơ đồ bàn của Nhân viên phục vụ (giao diện điện thoại).
 *  - Mặc định: lưới thẻ bàn chữ to, màu theo trạng thái, bàn cần xử lý (chờ xác nhận, khách gọi, món chờ mang…) lên đầu.
 *  - "Sơ đồ": vị trí thật như Quản lý đã xếp, tự thu vừa màn hình — để kê bàn ghế (quản lý sửa → cập nhật ngay).
 * Mở sẵn khu của ca đang làm (theo lịch ca); xem được khu khác. Chạm bàn → bảng dưới: Mở bàn · Gọi món · Xác nhận đơn · Chuyển / ghép.
 * D15: không khóa theo chấm công; món xong chỉ xem (bếp bấm Đã mang đi).
 */
export default function WaiterFloorPage() {
  const q = useQuery({ queryKey: WAITER_KEYS.floor, queryFn: getWaiterFloor, refetchInterval: 15_000 });
  const [area, setArea] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [view, setView] = useState<'list' | 'map'>(() => (localStorage.getItem(VIEW_KEY) === 'map' ? 'map' : 'list'));
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => localStorage.setItem(VIEW_KEY, view), [view]);

  // Sơ đồ tự thu vừa chiều ngang khung chứa.
  const boxRef = useRef<HTMLDivElement>(null);
  const [boxWidth, setBoxWidth] = useState(360);
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setBoxWidth(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, [view, q.data]);

  const f = q.data?.floor;
  const mine = q.data?.myAreaIds ?? [];
  const areaId = area ?? mine[0] ?? f?.areas[0]?.id ?? null;
  const areaTables = useMemo(() => (f?.tables ?? []).filter((t) => t.areaId === areaId), [f, areaId]);
  const sorted = useMemo(
    () => [...areaTables].sort((a, b) => PRIORITY[stateOf(a)] - PRIORITY[stateOf(b)] || a.code.localeCompare(b.code, 'vi', { numeric: true })),
    [areaTables],
  );
  const sel = f?.tables.find((t) => t.id === selected) ?? null;
  const counts = useMemo(() => {
    const c = Object.fromEntries(LEGEND.map((k) => [k, 0])) as Record<TableState, number>;
    areaTables.forEach((t) => c[stateOf(t)]++);
    return c;
  }, [areaTables]);
  // Sơ đồ chỉ cắt khung quanh khu đang xem (vùng khu + bàn của khu) rồi thu vừa chiều ngang → bàn to nhất có thể trên điện thoại.
  const areaInfo = f?.areas.find((a) => a.id === areaId);
  const win = areaWindow(f?.floors.find((x) => x.id === areaInfo?.floorId), areaInfo?.zone ?? null, areaTables);
  // Tối thiểu 0,5 để bàn vẫn đủ to để chạm; khu rộng (nhiều cột) thì vuốt ngang.
  const fitZoom = Math.max(0.5, Math.min(1.1, (boxWidth - 8) / (win.cols * CELL)));

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
              <div className="no-scrollbar flex min-w-0 flex-1 gap-1 overflow-x-auto rounded-full bg-[var(--bg-subtle)] p-1" role="tablist" aria-label="Khu vực">
                {f.areas.map((a) => {
                  const list = f.tables.filter((t) => t.areaId === a.id);
                  const alert = list.some((t) => ['confirm', 'calling', 'late', 'ready'].includes(stateOf(t)));
                  const on = a.id === areaId;
                  const my = mine.includes(a.id);
                  return (
                    <button
                      key={a.id}
                      type="button"
                      role="tab"
                      aria-selected={on}
                      onClick={() => { setArea(a.id); setSelected(null); }}
                      className={cn('relative inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-4 text-[13.5px] font-semibold transition-colors', on ? 'bg-[var(--accent)] text-white shadow-sm' : 'text-[var(--text-secondary)]')}
                    >
                      {a.name}
                      {my ? <span className={cn('rounded-full px-1.5 text-[10.5px] font-bold', on ? 'bg-white/25' : 'bg-[var(--accent-soft)] text-[var(--accent)]')}>Của tôi</span> : null}
                      {alert ? <span className="absolute right-0.5 top-0.5 h-2.5 w-2.5 rounded-full bg-[#db2777] ring-2 ring-[var(--bg-subtle)]" aria-label="Có bàn cần xử lý" /> : null}
                    </button>
                  );
                })}
              </div>
              <div className="flex items-center rounded-full bg-[var(--bg-subtle)] p-1" role="group" aria-label="Kiểu xem">
                <button type="button" aria-pressed={view === 'list'} aria-label="Danh sách bàn" onClick={() => setView('list')} className={cn('grid h-8 w-9 place-items-center rounded-full', view === 'list' && 'bg-[var(--bg-surface)] text-[var(--accent)] shadow-sm')}><List size={17} /></button>
                <button type="button" aria-pressed={view === 'map'} aria-label="Sơ đồ vị trí bàn" onClick={() => setView('map')} className={cn('grid h-8 w-9 place-items-center rounded-full', view === 'map' && 'bg-[var(--bg-surface)] text-[var(--accent)] shadow-sm')}><LayoutGrid size={17} /></button>
              </div>
            </div>

            <div ref={boxRef} className="min-h-0 flex-1 overflow-auto p-3" onClick={() => view === 'map' && setSelected(null)}>
              {view === 'list' ? (
                sorted.length === 0 ? (
                  <p className="py-16 text-center text-[14px] text-[var(--text-muted)]">Khu vực này chưa có bàn.</p>
                ) : (
                  <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
                    {sorted.map((t) => <TableCard key={t.id} t={t} selected={selected === t.id} onClick={() => setSelected(t.id)} />)}
                  </div>
                )
              ) : (
                <FloorCanvas floor={f} floorId={areaInfo?.floorId ?? ''} win={win} tables={areaTables} zoom={fitZoom} selected={selected} onSelect={(id) => setSelected(id === selected ? null : id)} />
              )}
            </div>
            <footer className="no-scrollbar flex shrink-0 gap-1.5 overflow-x-auto border-t border-[var(--border)] bg-[var(--bg-surface)] px-3 py-1.5">
              {LEGEND.filter((k) => counts[k] || ['available', 'occupied'].includes(k)).map((k) => (
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

/** Thẻ bàn trên danh sách: mã bàn to, trạng thái, một dòng việc cần làm. */
function TableCard({ t, selected, onClick }: { t: FloorTable; selected: boolean; onClick: () => void }) {
  const st = stateOf(t);
  const s = STATE[st];
  const o = t.order;
  const g = guestsOf(t);
  const soon = !o ? soonReservation(t) : null;
  const line =
    st === 'confirm' ? `${o!.unconfirmedCount} món chờ xác nhận`
    : st === 'calling' ? 'Khách đang gọi'
    : st === 'ready' ? `${o!.readyCount} món xong – lấy ở bếp`
    : st === 'late' ? `${o!.lateCount} món chờ lâu`
    : st === 'payment' ? 'Chờ thanh toán'
    : o ? `${g ? `${g} khách · ` : ''}${formatCurrency(o.subtotal)}`
    : soon ? `${soon.customerName} · ${hhmm(soon.time)}`
    : st === 'inactive' ? 'Ngừng phục vụ' : `${t.seats} ghế · Trống`;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Bàn ${t.code}: ${s.label}`}
      data-table={t.code}
      className={cn('flex min-h-[92px] flex-col justify-between rounded-[18px] border-2 bg-[var(--bg-surface)] p-2.5 text-left shadow-sm transition-transform active:scale-[0.98]', selected ? 'border-[var(--text-primary)]' : 'border-transparent', st === 'confirm' || st === 'calling' ? 'pos-call' : '')}
      style={{ borderLeft: `6px solid ${s.bg}` }}
    >
      <span className="flex items-start justify-between gap-1">
        <span className="text-[22px] font-extrabold leading-none">{t.code}</span>
        {o ? <span className="rounded-full bg-[var(--bg-subtle)] px-1.5 font-mono text-[11.5px] font-bold text-[var(--text-secondary)]">{elapsed(o.openedAt)}</span> : null}
      </span>
      <span>
        <span className="mt-1 inline-block rounded-full px-2 py-0.5 text-[11.5px] font-bold" style={{ background: s.bg, color: s.fg }}>{s.label}</span>
        <span className="mt-1 block truncate text-[12.5px] font-medium text-[var(--text-secondary)]">{line}</span>
      </span>
    </button>
  );
}

/* ---------------------------------------------------------------- Bảng một bàn */

const ITEM_STATE: Record<OrderItemStatus, string> = { unconfirmed: 'Chờ xác nhận', pending: 'Chờ bếp', cooking: 'Đang làm', done: 'Xong – lấy ở bếp', served: 'Đã mang', cancelled: 'Hủy' };

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
  const confirm = useMutation({
    mutationFn: () => confirmOrder(orderId),
    onSuccess: () => { toast.success(`Đã xác nhận đơn bàn ${t.code} — món chuyển xuống bếp`); void detail.refetch(); refresh(); },
    onError: (e) => { onErr(e); void detail.refetch(); },
  });

  const d = detail.data;
  const o = d?.order;
  const g = d ? d.guests : t.order?.guests ?? null;
  const activeItems = (o?.items ?? []).filter((i) => i.status !== 'cancelled');
  const ready = activeItems.filter((i) => i.status === 'done');
  const unconfirmed = activeItems.filter((i) => i.status === 'unconfirmed');
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
                <Button variant={t.reservation ? 'outline' : 'primary'} className="h-12 w-full rounded-full text-[15px]" loading={open.isPending && !open.variables?.reservationId} onClick={() => open.mutate({ guests: guestsPick })}>
                  {t.reservation ? 'Mở bàn cho khách khác' : 'Mở bàn'}
                </Button>
              </div>
            )}
          </>
        ) : (
          <>
            {unconfirmed.length ? (
              <div className="rounded-[12px] border-2 border-[#db2777] bg-[#fdf2f8] p-3">
                <p className="flex items-center gap-1.5 text-[13.5px] font-bold text-[#9d174d]"><ClipboardCheck size={15} /> Khách vừa gọi {unconfirmed.length} món — chờ bạn xác nhận</p>
                <ul className="mt-1.5 space-y-0.5 text-[13.5px]">
                  {unconfirmed.map((i) => <li key={i.id}><b className="font-mono">{i.qty}×</b> {i.name}{i.note ? <span className="text-[var(--text-muted)]"> · {i.note}</span> : null}</li>)}
                </ul>
                <div className="mt-2 flex gap-2">
                  <Button size="sm" className="flex-1" leadingIcon={<Check size={14} />} loading={confirm.isPending} onClick={() => confirm.mutate()}>Xác nhận, chuyển bếp</Button>
                  <Button size="sm" variant="outline" onClick={() => navigate(`/phuc-vu/yeu-cau?order=${orderId}`)}>Bỏ bớt món…</Button>
                </div>
              </div>
            ) : null}
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
              <p className="flex items-center gap-2 rounded-[12px] border border-[#86efac] bg-[#f0fdf4] p-3 text-[13.5px] font-semibold text-[#15803d]">
                <ChefHat size={16} className="shrink-0" />{ready.length} món bếp đã xong — ra bếp lấy món (bếp bấm Đã mang đi)
              </p>
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
                      <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[11.5px] font-semibold', i.status === 'done' ? 'bg-[#dcfce7] text-[#15803d]' : i.status === 'served' ? 'bg-[var(--bg-subtle)] text-[var(--text-muted)]' : i.status === 'cooking' ? 'bg-[var(--warning-soft)] text-[var(--warning)]' : 'bg-[var(--info-soft)] text-[var(--info)]')}>{ITEM_STATE[i.status]}</span>
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
          <Button className="col-span-2 h-12 rounded-full text-[15px]" leadingIcon={<ShoppingBag size={17} />} disabled={o.locked} onClick={() => navigate(`/phuc-vu/goi-mon/${t.id}`)}>
            {o.locked ? 'Đang chờ thanh toán — không gọi thêm' : 'Gọi món cho khách'}
          </Button>
          <Button variant="outline" className="rounded-full" leadingIcon={<ArrowRightLeft size={15} />} onClick={() => setMoveOpen('move')}>Chuyển bàn</Button>
          <Button variant="outline" className="rounded-full" leadingIcon={<Merge size={15} />} disabled={o.locked} onClick={() => setMoveOpen('merge')}>Ghép bàn</Button>
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
