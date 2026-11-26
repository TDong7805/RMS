import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowRightLeft, CalendarPlus, ChevronDown, ExternalLink, Minus, Plus, Printer, Receipt, Wallet, X } from 'lucide-react';
import { Button } from '@/components/common/Button';
import { BlockError } from '@/components/common/EmptyState';
import { Skeleton } from '@/components/common/Skeleton';
import { CASHIER_RES_KEY, closeTable, getCashierFloor, getCashierOrder, getCashierReservations, getInvoice, openTable, setOrderGuests, type CashierReservation } from '@/api/ordering';
import { CashierShell, CASHIER_FLOOR_KEY } from '@/features/ordering/CashierShell';
import { CreateInvoiceDialog, MoveTableDialog, PaymentDialog, printInvoice, printProvisional } from '@/features/ordering/CashierDialogs';
import { CashierReservationDialog, RES_STATUS, todayStr } from '@/features/ordering/CashierReservationDialog';
import { formatCurrency } from '@/lib/format';
import { cn } from '@/lib/cn';
import { CELL, elapsed, FloorCanvas, floorWindow, guestsOf, hhmm, LEGEND, soonReservation, STATE, stateOf, SOON_MS, type TableState } from '@/features/ordering/floorParts';
import type { CashierFloor, CashierOrderDetail, FloorTable, Invoice, OrderItemStatus } from '@/types';

export const CASHIER_KEYS = { floor: CASHIER_FLOOR_KEY, order: (id: string) => ['thu-ngan', 'order', id] as const };

/* ---------------------------------------------------------------- Trang */

const VIEW_KEY = 'rms-pos-floor-view';
const LEFT_KEY = 'rms-pos-left';
type Floors = CashierFloor['floors'];

/**
 * UC-TN-01 (D16): màn POS một màn hình — trái: Yêu cầu thanh toán · Đặt bàn hôm nay (thêm lịch) · Bàn đang có khách;
 * giữa: sơ đồ cả tầng vẽ như trang Sơ đồ bàn của Quản lý (tường, vùng khu, bàn có ghế), tự vừa khung, xem từng tầng
 * hoặc cả các tầng cùng lúc, tab tầng kèm số đếm; phải: chạm bàn → khung chi tiết (món, tạm tính, lập hóa đơn, thu tiền…).
 */
export default function FloorPage() {
  const floor = useQuery({ queryKey: CASHIER_KEYS.floor, queryFn: getCashierFloor, refetchInterval: 10_000 });
  const today = todayStr();
  const reservations = useQuery({ queryKey: CASHIER_RES_KEY(today), queryFn: () => getCashierReservations(today), refetchInterval: 30_000 });
  const [view, setView] = useState<string>(() => localStorage.getItem(VIEW_KEY) ?? 'auto');
  const [selected, setSelected] = useState<string | null>(null);
  const [zoomAdj, setZoomAdj] = useState(0);
  const [resDialog, setResDialog] = useState<{ r: CashierReservation | null } | null>(null);
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => localStorage.setItem(VIEW_KEY, view), [view]);

  // Khung sơ đồ tự đo kích thước để tính mức thu phóng vừa khít.
  const boxRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 900, h: 600 });
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setBox({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, [floor.data, selected]);

  const f = floor.data;
  const floors: Floors = f?.floors ?? [];
  const floorOf = (t: FloorTable) => f?.areas.find((a) => a.id === t.areaId)?.floorId ?? '';
  const tablesOf = (floorId: string) => (f?.tables ?? []).filter((t) => floorOf(t) === floorId);
  const sel = f?.tables.find((t) => t.id === selected) ?? null;
  // Thu phóng vừa khung: một tầng; hoặc nhiều tầng xếp ngang / dọc — chọn cách cho bàn to nhất.
  const PAD = 24;
  const fitFor = (list: Floors): { fit: number; layout: 'row' | 'col' } => {
    if (list.length === 0) return { fit: 1, layout: 'row' };
    if (list.length === 1) return { fit: Math.min((box.w - PAD) / (list[0].cols * CELL), (box.h - PAD) / (list[0].rows * CELL)), layout: 'row' };
    const gap = 20, label = 34;
    const zRow = Math.min((box.w - PAD - gap * (list.length - 1)) / (list.reduce((s, x) => s + x.cols, 0) * CELL), (box.h - PAD - label) / (Math.max(...list.map((x) => x.rows)) * CELL));
    const zCol = Math.min((box.w - PAD) / (Math.max(...list.map((x) => x.cols)) * CELL), (box.h - PAD - (label + gap) * list.length) / (list.reduce((s, x) => s + x.rows, 0) * CELL));
    return zRow >= zCol ? { fit: zRow, layout: 'row' } : { fit: zCol, layout: 'col' };
  };
  // "Tự chọn": màn đủ rộng để bàn vẫn đọc rõ (≥ 50%) thì hiện mọi tầng; không thì một tầng — tầng đang có việc cần xử lý trước.
  const busiest = [...floors].sort((a, b) => {
    const s = (id: string) => { const x = floorStats(tablesOf(id)); return x.payment * 3 + x.calling * 3 + x.busy; };
    return s(b.id) - s(a.id);
  })[0];
  const autoAll = floors.length > 1 && fitFor(floors).fit >= 0.5;
  const shown: Floors = view === 'all' ? floors
    : floors.some((x) => x.id === view) ? floors.filter((x) => x.id === view)
    : autoAll ? floors : busiest ? [busiest] : [];
  const { fit, layout } = fitFor(shown);
  const pick = (t: FloorTable) => {
    setSelected(t.id);
    if (shown.length === 1 && floorOf(t) !== shown[0].id) setView(floorOf(t));
  };
  const zoom = Math.max(0.3, Math.min(1.4, +(fit + zoomAdj).toFixed(2)));

  const counts = useMemo(() => {
    const c = Object.fromEntries(LEGEND.map((k) => [k, 0])) as Record<TableState, number>;
    (f?.tables ?? []).forEach((t) => c[stateOf(t)]++);
    return c;
  }, [f]);
  const seated = (f?.tables ?? []).reduce((s, t) => s + (guestsOf(t) ?? 0), 0);

  return (
    <CashierShell fill>
      {floor.isError ? (
        <div className="p-6"><BlockError onRetry={() => void floor.refetch()} retrying={floor.isFetching} /></div>
      ) : !f ? (
        <div className="grid flex-1 grid-cols-4 gap-4 p-6">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-32" />)}</div>
      ) : (
        <>
          <div className="flex min-h-0 flex-1">
            <LeftColumn floor={f} reservations={reservations.data} onPick={pick} onReservation={(r) => setResDialog({ r })} onAddReservation={() => setResDialog({ r: null })} />

            {/* Sơ đồ */}
            <section className="flex min-w-0 flex-1 flex-col">
              <div className="flex flex-wrap items-center gap-2 border-b border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2">
                <div className="no-scrollbar flex min-w-0 flex-1 gap-1.5 overflow-x-auto" role="tablist" aria-label="Tầng">
                  {floors.length > 1 ? (
                    <FloorTab active={shown.length > 1} onClick={() => setView('all')} title="Tất cả tầng" stats={floorStats(f.tables)} />
                  ) : null}
                  {floors.map((x) => (
                    <FloorTab key={x.id} active={shown.length === 1 && shown[0].id === x.id} onClick={() => setView(x.id)} title={x.name} stats={floorStats(tablesOf(x.id))} />
                  ))}
                </div>
                <div className="flex items-center gap-1 rounded-[10px] bg-[var(--bg-subtle)] p-1">
                  <button type="button" aria-label="Thu nhỏ" onClick={() => setZoomAdj((z) => +(z - 0.1).toFixed(2))} className="grid h-8 w-8 place-items-center rounded-lg hover:bg-[var(--bg-surface)]"><Minus size={15} /></button>
                  <button type="button" onClick={() => setZoomAdj(0)} className="min-w-14 px-1 text-center font-mono text-[12.5px] font-semibold" title="Vừa khung">{zoomAdj ? `${Math.round(zoom * 100)}%` : 'Vừa khung'}</button>
                  <button type="button" aria-label="Phóng to" onClick={() => setZoomAdj((z) => +(z + 0.1).toFixed(2))} className="grid h-8 w-8 place-items-center rounded-lg hover:bg-[var(--bg-surface)]"><Plus size={15} /></button>
                </div>
              </div>
              <div ref={boxRef} className="min-h-0 flex-1 overflow-auto bg-[var(--bg-page)] p-3" onClick={() => setSelected(null)}>
                <div className={cn('flex w-max min-w-full gap-5', layout === 'col' ? 'flex-col items-center' : 'items-start justify-center')}>
                  {shown.map((x) => (
                    <div key={x.id} className="shrink-0" data-floor={x.name}>
                      {shown.length > 1 ? (
                        <p className="mb-1.5 flex items-center gap-2 text-[14px] font-bold">
                          {x.name}<span className="text-[12.5px] font-medium text-[var(--text-muted)]">{statsText(floorStats(tablesOf(x.id)))}</span>
                        </p>
                      ) : null}
                      <div className="rounded-[14px] bg-[var(--bg-surface)] shadow-sm">
                        <FloorCanvas floor={f} floorId={x.id} win={floorWindow(x)} tables={tablesOf(x.id)} zoom={zoom} tableScale={1.1} selected={selected} onSelect={(id) => setSelected(id === selected ? null : id)} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* Khung chi tiết bàn — trượt ra khi chạm bàn */}
            {sel ? (
              <aside className="flex w-[400px] max-w-full shrink-0 flex-col border-l border-[var(--border)] bg-[var(--bg-surface)] shadow-[-8px_0_24px_-16px_rgba(0,0,0,0.25)]">
                <TablePanel key={sel.id} table={sel} floor={f} onClose={() => setSelected(null)} />
              </aside>
            ) : null}
          </div>

          {/* Dải chú thích + số lượng */}
          <footer className="no-scrollbar flex shrink-0 items-center gap-2 overflow-x-auto border-t border-[var(--border)] bg-[var(--bg-surface)] px-3 py-1.5">
            {LEGEND.filter((k) => counts[k] || ['available', 'occupied', 'reserved'].includes(k)).map((k) => (
              <span key={k} className="inline-flex shrink-0 items-center gap-2 rounded-[10px] bg-[var(--bg-subtle)] py-1 pl-1 pr-3 text-[12.5px] font-medium">
                <span className="grid h-6 min-w-6 place-items-center rounded-md px-1.5 font-mono text-[12.5px] font-bold" style={{ background: STATE[k].bg, color: STATE[k].fg }}>{counts[k]}</span>
                {STATE[k].label}
              </span>
            ))}
            <span className="ml-auto inline-flex shrink-0 items-center gap-2 rounded-[10px] bg-[var(--bg-subtle)] py-1 pl-1 pr-3 text-[12.5px] font-medium" title="Tổng số khách đang ngồi (theo số khách đã nhập / phiếu đặt bàn)">
              <span className="grid h-6 min-w-6 place-items-center rounded-md bg-[var(--text-primary)] px-1.5 font-mono text-[12.5px] font-bold text-white">{seated}</span>
              Khách đang ngồi
            </span>
            <span className="inline-flex shrink-0 items-center gap-2 rounded-[10px] bg-[var(--accent-soft)] px-3 py-1 text-[12.5px] font-semibold text-[var(--accent)]">
              Đã thu hôm nay <b className="font-mono">{formatCurrency(f.revenueToday)}</b>
            </span>
          </footer>

          {resDialog ? <CashierReservationDialog key={resDialog.r?.id ?? 'new'} floor={f} reservation={resDialog.r} open onClose={() => setResDialog(null)} /> : null}
        </>
      )}
    </CashierShell>
  );
}

type Stats = { busy: number; total: number; payment: number; calling: number };
const floorStats = (tables: FloorTable[]): Stats => ({
  busy: tables.filter((t) => t.order).length,
  total: tables.length,
  payment: tables.filter((t) => stateOf(t) === 'payment').length,
  calling: tables.filter((t) => stateOf(t) === 'calling').length,
});
const statsText = (s: Stats) => `${s.busy} có khách${s.payment ? ` · ${s.payment} chờ thanh toán` : ''}${s.calling ? ` · ${s.calling} khách gọi` : ''}`;

function FloorTab({ active, onClick, title, stats }: { active: boolean; onClick: () => void; title: string; stats: Stats }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn('relative inline-flex h-11 shrink-0 items-center gap-2 rounded-[12px] px-4 text-left', active ? 'bg-[var(--accent)] text-white' : 'bg-[var(--bg-subtle)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]')}
    >
      <span className="leading-tight">
        <span className="block text-[14px] font-bold">{title}</span>
        <span className={cn('block text-[11.5px]', active ? 'text-white/85' : 'text-[var(--text-muted)]')}>{stats.busy}/{stats.total} có khách</span>
      </span>
      {stats.payment ? <span className="grid h-6 min-w-6 place-items-center rounded-full bg-[#eab308] px-1.5 font-mono text-[12px] font-bold text-[#422006]" title="Chờ thanh toán">{stats.payment}</span> : null}
      {stats.calling ? <span className="grid h-6 min-w-6 place-items-center rounded-full bg-[#f97316] px-1.5 font-mono text-[12px] font-bold text-white" title="Khách gọi">{stats.calling}</span> : null}
    </button>
  );
}

/* ---------------------------------------------------------------- Cột trái: các danh sách gập mở được */

function LeftColumn({ floor, reservations, onPick, onReservation, onAddReservation }: {
  floor: CashierFloor;
  reservations: CashierReservation[] | undefined;
  onPick: (t: FloorTable) => void;
  onReservation: (r: CashierReservation) => void;
  onAddReservation: () => void;
}) {
  const [open, setOpen] = useState<Record<string, boolean>>(() => {
    try { return JSON.parse(localStorage.getItem(LEFT_KEY) ?? '{}'); } catch { return {}; }
  });
  const toggle = (k: string) => setOpen((o) => { const n = { ...o, [k]: !(o[k] ?? true) }; localStorage.setItem(LEFT_KEY, JSON.stringify(n)); return n; });
  const isOpen = (k: string) => open[k] ?? true;
  const [showDone, setShowDone] = useState(false);

  const payment = floor.tables.filter((t) => stateOf(t) === 'payment');
  const busy = floor.tables.filter((t) => t.order).sort((a, b) => a.order!.openedAt.localeCompare(b.order!.openedAt));
  const areaName = (id: string) => floor.areas.find((a) => a.id === id)?.name ?? '';
  const activeRes = (reservations ?? []).filter((r) => ['pending', 'confirmed'].includes(r.status));
  const doneRes = (reservations ?? []).filter((r) => !['pending', 'confirmed'].includes(r.status));
  const byCode = (code: string | null) => floor.tables.find((t) => t.code === code);

  return (
    <aside className="flex w-[300px] shrink-0 flex-col overflow-y-auto border-r border-[var(--border)] bg-[var(--bg-surface)] 2xl:w-[330px]" aria-label="Việc ở quầy">
      <Section k="pay" title="Yêu cầu thanh toán" count={payment.length} tone={payment.length ? 'warn' : undefined} open={isOpen('pay')} onToggle={() => toggle('pay')}>
        {payment.length === 0 ? <Empty>Chưa bàn nào yêu cầu thanh toán.</Empty> : payment.map((t) => (
          <Row key={t.id} onClick={() => onPick(t)} accent="#eab308">
            <span className="font-extrabold">{t.code}</span>
            <span className="min-w-0 flex-1 truncate text-[12.5px] text-[var(--text-muted)]">{areaName(t.areaId)}</span>
            <span className="font-mono text-[13px] font-bold">{formatCurrency(t.order?.subtotal ?? 0)}</span>
          </Row>
        ))}
      </Section>

      <Section
        k="res"
        title="Đặt bàn hôm nay"
        count={activeRes.length}
        open={isOpen('res')}
        onToggle={() => toggle('res')}
        action={<button type="button" onClick={onAddReservation} className="inline-flex h-8 items-center gap-1 rounded-[8px] bg-[var(--accent)] px-2.5 text-[12.5px] font-bold text-white"><CalendarPlus size={14} />Thêm</button>}
      >
        {!reservations ? <Skeleton className="h-16" /> : activeRes.length === 0 ? <Empty>Hôm nay chưa có lịch đặt nào sắp tới.</Empty> : activeRes.map((r) => {
          const diff = new Date(r.dateTime).getTime() - Date.now();
          const t = byCode(r.tableCode);
          return (
            <Row key={r.id} onClick={() => onReservation(r)} accent={diff <= SOON_MS ? '#8b5cf6' : undefined} soft={diff <= SOON_MS}>
              <span className="font-mono text-[15px] font-bold">{hhmm(r.dateTime)}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13.5px] font-semibold">{r.customerName} · {r.guests} khách</span>
                <span className={cn('block truncate text-[12px]', diff < 0 ? 'font-semibold text-[var(--danger)]' : 'text-[var(--text-muted)]')}>
                  {diff < 0 ? `Trễ ${dur(-diff)}` : diff <= SOON_MS ? `Còn ${dur(diff)}` : r.areaName}
                  {r.status === 'pending' ? ' · chờ xác nhận' : ''}
                </span>
              </span>
              {r.tableCode ? (
                <span role="button" tabIndex={0} onClick={(e) => { e.stopPropagation(); if (t) onPick(t); }} onKeyDown={(e) => { if (e.key === 'Enter' && t) { e.stopPropagation(); onPick(t); } }} className="rounded-[8px] bg-[#8b5cf6] px-2 py-0.5 text-[12px] font-bold text-white">{r.tableCode}</span>
              ) : <span className="rounded-[8px] border border-dashed border-[var(--border-strong)] px-1.5 py-0.5 text-[11.5px] text-[var(--text-muted)]">Chưa xếp</span>}
            </Row>
          );
        })}
        {doneRes.length ? (
          <>
            <button type="button" onClick={() => setShowDone((v) => !v)} className="mt-1 w-full rounded-[8px] px-2 py-1.5 text-left text-[12.5px] font-semibold text-[var(--text-muted)] hover:bg-[var(--bg-hover)]">
              {showDone ? 'Ẩn' : 'Xem'} {doneRes.length} lịch đã xử lý (đã đến, hủy, không đến)
            </button>
            {showDone ? doneRes.map((r) => (
              <Row key={r.id} onClick={() => onReservation(r)}>
                <span className="font-mono text-[13px] text-[var(--text-muted)]">{hhmm(r.dateTime)}</span>
                <span className="min-w-0 flex-1 truncate text-[13px] text-[var(--text-secondary)]">{r.customerName} · {r.guests}</span>
                <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold', RES_STATUS[r.status].cls)}>{RES_STATUS[r.status].label}</span>
              </Row>
            )) : null}
          </>
        ) : null}
      </Section>

      <Section k="busy" title="Bàn đang có khách" count={busy.length} open={isOpen('busy')} onToggle={() => toggle('busy')}>
        {busy.length === 0 ? <Empty>Chưa có bàn nào có khách.</Empty> : busy.map((t) => (
          <Row key={t.id} onClick={() => onPick(t)} accent={STATE[stateOf(t)].bg}>
            <span className="w-12 font-extrabold">{t.code}</span>
            <span className="min-w-0 flex-1 truncate text-[12.5px] text-[var(--text-muted)]">{guestsOf(t) ? `${guestsOf(t)} khách · ` : ''}{elapsed(t.order!.openedAt)}</span>
            <span className="font-mono text-[13px] font-semibold">{formatCurrency(t.order!.subtotal)}</span>
          </Row>
        ))}
      </Section>
    </aside>
  );
}

function Section({ title, count, open, onToggle, action, tone, children }: { k: string; title: string; count: number; open: boolean; onToggle: () => void; action?: ReactNode; tone?: 'warn'; children: ReactNode }) {
  return (
    <section className="border-b border-[var(--border)]">
      <div className="flex items-center gap-2 px-3 py-2.5">
        <button type="button" aria-expanded={open} onClick={onToggle} className="flex min-w-0 flex-1 items-center gap-2 text-left">
          <ChevronDown size={16} className={cn('shrink-0 text-[var(--text-muted)] transition-transform', !open && '-rotate-90')} />
          <span className="truncate text-[14px] font-bold">{title}</span>
          <span className={cn('grid h-5 min-w-5 place-items-center rounded-full px-1.5 font-mono text-[11.5px] font-bold', tone === 'warn' ? 'bg-[#eab308] text-[#422006]' : 'bg-[var(--bg-subtle)] text-[var(--text-secondary)]')}>{count}</span>
        </button>
        {action}
      </div>
      {open ? <div className="space-y-1 px-2 pb-2.5">{children}</div> : null}
    </section>
  );
}

function Row({ onClick, accent, soft, children }: { onClick: () => void; accent?: string; soft?: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn('flex w-full items-center gap-2.5 rounded-[10px] border border-transparent px-2.5 py-2 text-left text-[14px] hover:border-[var(--border)] hover:bg-[var(--bg-hover)]', soft && 'bg-[#f5f3ff]')}
      style={accent ? { boxShadow: `inset 3px 0 0 ${accent}` } : undefined}
    >
      {children}
    </button>
  );
}

/** 125 phút → "2 giờ 5 phút". */
const dur = (ms: number) => { const m = Math.round(ms / 60_000); return m < 60 ? `${m} phút` : `${Math.floor(m / 60)} giờ${m % 60 ? ` ${m % 60} phút` : ''}`; };

const Empty = ({ children }: { children: ReactNode }) => <p className="px-2 py-3 text-center text-[12.5px] text-[var(--text-muted)]">{children}</p>;

/* ---------------------------------------------------------------- Mở bàn */

/**
 * Bàn chưa mở: chọn số khách (không bắt buộc) rồi "Mở bàn" — từ lúc này mã QR của bàn mới gửi được món.
 * Bàn có khách đặt trước: nút "Khách đã đến – Mở bàn" lấy luôn số khách từ phiếu đặt và chuyển phiếu sang Đã đến.
 */
function OpenTableBox({ table, onOpened }: { table: FloorTable; onOpened: (d: CashierOrderDetail) => void }) {
  const [guests, setGuests] = useState<number | null>(null);
  const open = useMutation({
    mutationFn: (v: { reservationId?: string; guests: number | null }) => openTable(table.id, v.guests, v.reservationId),
    onSuccess: (d) => { toast.success(`Đã mở bàn ${table.code} — khách quét mã QR để gọi món`); onOpened(d); },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Không mở được bàn'),
  });
  const res = table.reservation;
  return (
    <div className="space-y-3 rounded-[12px] border border-[var(--border)] p-3">
      <p className="text-[13.5px] text-[var(--text-secondary)]">Bàn chưa mở — mã QR trên bàn chỉ xem được thực đơn. Mở bàn khi khách đã ngồi để khách gọi món.</p>
      {res ? (
        <Button className="w-full" loading={open.isPending && Boolean(open.variables?.reservationId)} onClick={() => open.mutate({ reservationId: res.id, guests: null })}>
          Khách đã đến – Mở bàn ({res.guests} khách)
        </Button>
      ) : null}
      <div>
        <p className="mb-1.5 text-[12.5px] font-semibold">Số khách <span className="font-normal text-[var(--text-muted)]">(không bắt buộc)</span></p>
        <div className="grid grid-cols-8 gap-1.5">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
            <button key={n} type="button" aria-pressed={guests === n} onClick={() => setGuests(guests === n ? null : n)} className={cn('h-9 rounded-[10px] font-mono text-[14px] font-bold transition-colors', guests === n ? 'bg-[var(--accent)] text-white' : 'bg-[var(--bg-subtle)] hover:bg-[var(--bg-hover)]', n > table.seats && guests !== n && 'text-[var(--text-muted)]')}>{n}</button>
          ))}
        </div>
      </div>
      <Button variant={res ? 'outline' : 'primary'} className="w-full" loading={open.isPending && !open.variables?.reservationId} onClick={() => open.mutate({ guests })}>
        {res ? 'Mở bàn cho khách khác' : 'Mở bàn'}
      </Button>
    </div>
  );
}

/* ---------------------------------------------------------------- Bảng bên phải: một bàn */

const ITEM_STATE: Record<OrderItemStatus, string> = { unconfirmed: 'Chờ xác nhận', pending: 'Chờ', cooking: 'Đang làm', done: 'Chờ lấy', served: 'Đã mang', cancelled: 'Hủy' };

function TablePanel({ table: t, floor, onClose }: { table: FloorTable; floor: CashierFloor; onClose: () => void }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const st = STATE[stateOf(t)];
  const orderId = t.order?.id ?? '';
  const detail = useQuery({ queryKey: CASHIER_KEYS.order(orderId), queryFn: () => getCashierOrder(orderId), enabled: Boolean(orderId), refetchInterval: 10_000 });
  const [moveOpen, setMoveOpen] = useState(false);
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [paying, setPaying] = useState<Invoice | null>(null);
  const areaName = floor.areas.find((a) => a.id === t.areaId)?.name ?? '';

  const apply = (d: CashierOrderDetail) => {
    qc.setQueryData(CASHIER_KEYS.order(orderId), d);
    void qc.invalidateQueries({ queryKey: CASHIER_KEYS.floor });
  };
  const guests = useMutation({
    mutationFn: (n: number | null) => setOrderGuests(orderId, n),
    onSuccess: apply,
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Không lưu được'),
  });
  const openPay = useMutation({ mutationFn: getInvoice, onSuccess: setPaying, onError: (e) => toast.error(e instanceof Error ? e.message : 'Không mở được hóa đơn') });
  const close = useMutation({
    mutationFn: closeTable,
    onSuccess: () => { toast.success(`Đã đóng bàn ${t.code}`); void qc.invalidateQueries({ queryKey: ['thu-ngan'] }); onClose(); },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Không đóng được bàn'),
  });

  const d = detail.data;
  const o = d?.order;
  const editable = o?.status === 'open' && !o.locked;
  const g = d ? d.guests : t.order?.guests ?? null;
  const resGuests = t.reservation?.guests ?? null;
  const soon = !t.order ? soonReservation(t) : null;
  const activeItems = (o?.items ?? []).filter((i) => i.status !== 'cancelled');
  // Yêu cầu hỗ trợ (gọi nhân viên) do Nhân viên phục vụ xử lý theo khu vực (V20) — thu ngân chỉ thấy yêu cầu thanh toán.
  const payReqs = (d?.requests ?? []).filter((r) => r.type === 'payment');

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-start gap-3 border-b border-[var(--border)] p-4">
        <span className="grid h-12 min-w-12 place-items-center rounded-[12px] px-2 text-[18px] font-extrabold" style={{ background: st.bg, color: st.fg }}>{t.code}</span>
        <div className="min-w-0 flex-1">
          <p className="text-[17px] font-bold">Bàn {t.code}</p>
          <p className="text-[12.5px] text-[var(--text-muted)]">{areaName} · {t.seats} ghế · <span className="font-semibold" style={{ color: st.bg === '#e9edf1' ? undefined : st.bg }}>{st.label}</span></p>
        </div>
        <button type="button" aria-label="Đóng" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-lg hover:bg-[var(--bg-hover)]"><X size={17} /></button>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
        {!t.order ? (
          <>
            {soon || t.reservation ? (
              <div className="rounded-[12px] border border-[#c4b5fd] bg-[#f5f3ff] p-3">
                <p className="text-[12.5px] font-semibold uppercase tracking-wide text-[#7c3aed]">Đặt bàn</p>
                <p className="mt-1 text-[15px] font-bold">{t.reservation!.customerName} · {t.reservation!.guests} khách</p>
                <p className="text-[13px] text-[var(--text-secondary)]">Đến lúc {hhmm(t.reservation!.time)}</p>
              </div>
            ) : null}
            {t.status === 'inactive' ? (
              <p className="rounded-[12px] bg-[var(--bg-subtle)] p-3 text-[13.5px] text-[var(--text-secondary)]">Bàn đang ngừng phục vụ.</p>
            ) : (
              <OpenTableBox table={t} onOpened={(x) => { apply(x); void qc.invalidateQueries({ queryKey: CASHIER_KEYS.floor }); }} />
            )}
          </>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2">
              <Info label="Giờ vào" value={hhmm(t.order.openedAt)} hint={`Đã ngồi ${elapsed(t.order.openedAt)}`} />
              <Info label="Tạm tính" value={formatCurrency(o?.subtotal ?? t.order.subtotal)} accent />
            </div>

            <div>
              <p className="mb-1.5 flex items-baseline justify-between text-[13px] font-semibold">
                Số khách
                <span className="font-normal text-[var(--text-muted)]">{g ? `${g}/${t.seats} ghế` : resGuests ? `Theo phiếu đặt: ${resGuests}` : 'Chưa nhập'}</span>
              </p>
              <div className="flex flex-wrap gap-1.5">
                {Array.from({ length: Math.max(8, Math.min(12, t.seats)) }, (_, i) => i + 1).map((n) => (
                  <button
                    key={n}
                    type="button"
                    disabled={guests.isPending || o?.status !== 'open'}
                    onClick={() => guests.mutate(n === g ? null : n)}
                    className={cn('h-9 w-9 rounded-[10px] font-mono text-[14px] font-bold transition-colors disabled:opacity-50', n === g ? 'bg-[var(--accent)] text-white' : 'bg-[var(--bg-subtle)] hover:bg-[var(--bg-hover)]', n > t.seats && n !== g && 'text-[var(--text-muted)]')}
                    aria-pressed={n === g}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            {d && payReqs.length ? (
              <div className="space-y-2">
                {payReqs.map((r) => (
                  <div key={r.id} className="rounded-[12px] border border-[#fde047] bg-[#fefce8] p-3 text-[13.5px]">
                    <p className="font-semibold text-[#854d0e]">Khách yêu cầu thanh toán · {hhmm(r.createdAt)}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {d.invoice?.status === 'unpaid' ? (
                        <Button size="sm" leadingIcon={<Wallet size={14} />} loading={openPay.isPending} onClick={() => openPay.mutate(d.invoice!.id)}>Thu tiền</Button>
                      ) : (
                        <Button size="sm" leadingIcon={<Receipt size={14} />} disabled={!editable} onClick={() => setInvoiceOpen(true)}>Lập hóa đơn</Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : null}

            {d?.invoice ? (
              <div className="flex items-center justify-between rounded-[12px] bg-[#fefce8] p-3 text-[13.5px]">
                <span><b>Hóa đơn {d.invoice.code}</b> · {formatCurrency(d.invoice.total)} · {d.invoice.status === 'paid' ? 'đã thanh toán' : 'chưa thanh toán'}</span>
              </div>
            ) : null}

            <div>
              <p className="mb-1.5 flex items-baseline justify-between text-[13px] font-semibold">
                Món ({activeItems.length})
                {t.order.lateCount ? <span className="font-semibold text-[#dc2626]">{t.order.lateCount} món chờ quá {floor.lateMinutes}′</span> : null}
              </p>
              {!o ? <Skeleton className="h-24" /> : (
                <ul className="divide-y divide-[var(--border)] rounded-[12px] border border-[var(--border)]">
                  {activeItems.map((i) => (
                    <li key={i.id} className="flex items-center gap-2 px-3 py-2 text-[13.5px]">
                      <span className="min-w-0 flex-1"><b className="font-mono">{i.qty}</b> {i.name}{i.note ? <span className="text-[var(--text-muted)]"> · {i.note}</span> : null}</span>
                      <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[11.5px] font-semibold', i.status === 'served' ? 'bg-[var(--bg-subtle)] text-[var(--text-muted)]' : i.status === 'done' ? 'bg-[var(--success-soft)] text-[var(--success)]' : i.status === 'cooking' ? 'bg-[var(--warning-soft)] text-[var(--warning)]' : 'bg-[var(--info-soft)] text-[var(--info)]')}>{ITEM_STATE[i.status]}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </div>

      {t.order && o && activeItems.length === 0 && o.status === 'open' && !o.locked ? (
        <div className="space-y-2 border-t border-[var(--border)] p-3">
          <p className="text-[12.5px] text-[var(--text-muted)]">Bàn đã mở, khách chưa gọi món. Khách quét mã QR trên bàn để gọi món.</p>
          <Button variant="outline" className="w-full" leadingIcon={<X size={15} />} loading={close.isPending} onClick={() => close.mutate(o.id)}>Đóng bàn</Button>
        </div>
      ) : t.order && o ? (
        <div className="grid grid-cols-2 gap-2 border-t border-[var(--border)] p-3">
          <Button variant="outline" leadingIcon={<Printer size={15} />} onClick={() => printProvisional(o)}>In tạm tính</Button>
          <Button variant="outline" leadingIcon={<ArrowRightLeft size={15} />} disabled={o.status !== 'open'} onClick={() => setMoveOpen(true)}>Chuyển bàn</Button>
          <Button variant="ghost" leadingIcon={<ExternalLink size={15} />} onClick={() => navigate(`/thu-ngan/don/${o.id}`)}>Xem đơn đầy đủ</Button>
          {d?.invoice?.status === 'unpaid' ? (
            <Button leadingIcon={<Wallet size={15} />} loading={openPay.isPending} onClick={() => openPay.mutate(d.invoice!.id)}>Thu tiền</Button>
          ) : (
            <Button leadingIcon={<Receipt size={15} />} disabled={!editable} onClick={() => setInvoiceOpen(true)}>Lập hóa đơn</Button>
          )}
        </div>
      ) : null}

      {o ? (
        <>
          <MoveTableDialog open={moveOpen} order={o} onClose={() => setMoveOpen(false)} onDone={(x) => { apply(x); onClose(); }} />
          <CreateInvoiceDialog
            orderId={o.id}
            open={invoiceOpen}
            onClose={() => setInvoiceOpen(false)}
            onCreated={(inv) => {
              setInvoiceOpen(false);
              setPaying(inv);
              void detail.refetch();
              void qc.invalidateQueries({ queryKey: CASHIER_KEYS.floor });
            }}
          />
          <PaymentDialog
            invoice={paying}
            onClose={() => setPaying(null)}
            onPaid={(inv) => {
              setPaying(null);
              void qc.invalidateQueries({ queryKey: ['thu-ngan'] });
              toast.success(`Bàn ${inv.tableCode} đã thanh toán`, { action: { label: 'In hóa đơn', onClick: () => printInvoice(inv) } });
              onClose();
            }}
          />
        </>
      ) : null}
    </div>
  );
}

function Info({ label, value, hint, accent }: { label: string; value: string; hint?: string; accent?: boolean }) {
  return (
    <div className="rounded-[12px] bg-[var(--bg-subtle)] p-3">
      <p className="text-[12px] text-[var(--text-muted)]">{label}</p>
      <p className={cn('font-mono text-[18px] font-bold', accent && 'text-[var(--accent)]')}>{value}</p>
      {hint ? <p className="text-[12px] text-[var(--text-muted)]">{hint}</p> : null}
    </div>
  );
}
