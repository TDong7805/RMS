import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowRightLeft, ExternalLink, Minus, Plus, Printer, Receipt, Wallet, X } from 'lucide-react';
import { Button } from '@/components/common/Button';
import { BlockError } from '@/components/common/EmptyState';
import { Skeleton } from '@/components/common/Skeleton';
import { closeTable, completeRequest, forwardRequest, getCashierFloor, getCashierOrder, getInvoice, openTable, setOrderGuests } from '@/api/ordering';
import { CashierShell, CASHIER_FLOOR_KEY } from '@/features/ordering/CashierShell';
import { CreateInvoiceDialog, MoveTableDialog, PaymentDialog, printInvoice, printProvisional } from '@/features/ordering/CashierDialogs';
import { REQUEST_TYPE_LABEL } from '@/features/ordering/requestLabels';
import { formatCurrency } from '@/lib/format';
import { cn } from '@/lib/cn';
import '@/features/ordering/pos-floor.css';
import type { CashierFloor, CashierOrderDetail, FloorTable, Invoice, OrderItemStatus } from '@/types';

export const CASHIER_KEYS = { floor: CASHIER_FLOOR_KEY, order: (id: string) => ['thu-ngan', 'order', id] as const };

/* ---------------------------------------------------------------- Trạng thái bàn trên sơ đồ */

type TableState = 'available' | 'reserved' | 'occupied' | 'ready' | 'calling' | 'payment' | 'late' | 'inactive';

const STATE: Record<TableState, { label: string; bg: string; fg: string }> = {
  available: { label: 'Trống', bg: '#e9edf1', fg: '#5b6673' },
  reserved: { label: 'Đặt trước', bg: '#8b5cf6', fg: '#ffffff' },
  occupied: { label: 'Có khách', bg: '#2563eb', fg: '#ffffff' },
  ready: { label: 'Món chờ mang ra', bg: '#16a34a', fg: '#ffffff' },
  calling: { label: 'Khách gọi', bg: '#f97316', fg: '#ffffff' },
  payment: { label: 'Chờ thanh toán', bg: '#eab308', fg: '#1f1600' },
  late: { label: 'Quá giờ', bg: '#dc2626', fg: '#ffffff' },
  inactive: { label: 'Ngừng phục vụ', bg: '#9ca3af', fg: '#ffffff' },
};
const LEGEND: TableState[] = ['available', 'reserved', 'occupied', 'ready', 'calling', 'payment', 'late', 'inactive'];
const SOON_MS = 2 * 60 * 60_000; // đặt bàn trong 2 giờ tới thì hiện trên bàn trống

const minutesSince = (iso: string) => Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60_000));
const hhmm = (iso: string) => new Date(iso).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
const elapsed = (iso: string) => {
  const m = minutesSince(iso);
  return m < 60 ? `${m}′` : `${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}`;
};

/** Bàn trống có khách đặt sắp tới (trong 2 giờ tới, hoặc đã tới giờ nhưng chưa nhận bàn). */
function soonReservation(t: FloorTable) {
  if (!t.reservation) return null;
  const diff = new Date(t.reservation.time).getTime() - Date.now();
  return diff <= SOON_MS ? t.reservation : null;
}

/** Ưu tiên việc cần làm ngay: khách gọi > chờ thanh toán > quá giờ > món chờ mang ra > có khách. */
function stateOf(t: FloorTable): TableState {
  if (t.status === 'inactive') return 'inactive';
  const o = t.order;
  if (o) {
    if (t.supportRequest) return 'calling';
    if (o.locked || t.paymentRequest) return 'payment';
    if (o.lateCount > 0) return 'late';
    if (o.readyCount > 0) return 'ready';
    return 'occupied';
  }
  if (t.status === 'reserved' || soonReservation(t)) return 'reserved';
  return 'available';
}

/** Số khách: thu ngân đã nhập, không thì lấy từ phiếu đặt bàn. */
const guestsOf = (t: FloorTable) => t.order?.guests ?? (t.order && t.reservation ? t.reservation.guests : null);

/* ---------------------------------------------------------------- Trang */

const ZOOM_KEY = 'rms-pos-zoom';
const CELL = 128; // px ở mức 100%

/**
 * UC-TN-01: Sơ đồ bàn kiểu POS — tab khu vực, bàn vẽ đúng hình và vị trí Quản lý đã xếp (lưới), ghế quanh bàn,
 * màu theo trạng thái, đồng hồ trên bàn; bấm bàn mở bảng bên phải; dải chú thích có số lượng ở đáy.
 */
export default function FloorPage() {
  const floor = useQuery({ queryKey: CASHIER_KEYS.floor, queryFn: getCashierFloor, refetchInterval: 10_000 });
  const [area, setArea] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [zoom, setZoom] = useState(() => Number(localStorage.getItem(ZOOM_KEY)) || 1);
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => localStorage.setItem(ZOOM_KEY, String(zoom)), [zoom]);

  const f = floor.data;
  const areaId = area ?? f?.areas[0]?.id ?? null;
  const areaTables = useMemo(() => (f?.tables ?? []).filter((t) => t.areaId === areaId), [f, areaId]);
  const sel = f?.tables.find((t) => t.id === selected) ?? null;
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
            {/* Sơ đồ */}
            <section className="flex min-w-0 flex-1 flex-col">
              <div className="flex flex-wrap items-center gap-2 border-b border-[var(--border)] bg-[var(--bg-surface)] px-4 py-2">
                <div className="no-scrollbar flex min-w-0 flex-1 gap-1 overflow-x-auto" role="tablist" aria-label="Khu vực">
                  {f.areas.map((a) => {
                    const list = f.tables.filter((t) => t.areaId === a.id);
                    const busy = list.filter((t) => t.order).length;
                    const alert = list.some((t) => ['calling', 'late', 'payment'].includes(stateOf(t)));
                    const on = a.id === areaId;
                    return (
                      <button
                        key={a.id}
                        type="button"
                        role="tab"
                        aria-selected={on}
                        onClick={() => setArea(a.id)}
                        className={cn('relative inline-flex h-10 shrink-0 items-center gap-2 rounded-[10px] px-4 text-[14px] font-semibold', on ? 'bg-[var(--accent)] text-white' : 'bg-[var(--bg-subtle)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]')}
                      >
                        {a.name}
                        <span className={cn('rounded-full px-1.5 font-mono text-[11.5px]', on ? 'bg-white/25' : 'bg-[var(--bg-surface)]')}>{busy}/{list.length}</span>
                        {alert ? <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-[#f97316] ring-2 ring-[var(--bg-surface)]" aria-label="Có bàn cần xử lý" /> : null}
                      </button>
                    );
                  })}
                </div>
                <div className="flex items-center gap-1 rounded-[10px] bg-[var(--bg-subtle)] p-1">
                  <button type="button" aria-label="Thu nhỏ" onClick={() => setZoom((z) => Math.max(0.6, +(z - 0.1).toFixed(1)))} className="grid h-8 w-8 place-items-center rounded-lg hover:bg-[var(--bg-surface)]"><Minus size={15} /></button>
                  <button type="button" onClick={() => setZoom(1)} className="w-12 text-center font-mono text-[12.5px] font-semibold" title="Về 100%">{Math.round(zoom * 100)}%</button>
                  <button type="button" aria-label="Phóng to" onClick={() => setZoom((z) => Math.min(1.5, +(z + 0.1).toFixed(1)))} className="grid h-8 w-8 place-items-center rounded-lg hover:bg-[var(--bg-surface)]"><Plus size={15} /></button>
                </div>
              </div>
              <div className="min-h-0 flex-1 overflow-auto bg-[var(--bg-page)] p-5" onClick={() => setSelected(null)}>
                <FloorCanvas floor={f} tables={areaTables} zoom={zoom} selected={selected} onSelect={(id) => setSelected(id === selected ? null : id)} />
              </div>
            </section>

            {/* Bảng bên phải */}
            <aside className={cn('w-[380px] max-w-full shrink-0 flex-col border-l border-[var(--border)] bg-[var(--bg-surface)] lg:static lg:flex lg:shadow-none', sel ? 'fixed bottom-[52px] right-0 top-[60px] z-30 flex shadow-2xl' : 'hidden')}>
              {sel ? <TablePanel key={sel.id} table={sel} floor={f} onClose={() => setSelected(null)} /> : <IdlePanel floor={f} onPickTable={(code) => {
                const t = f.tables.find((x) => x.code === code);
                if (t) { setArea(t.areaId); setSelected(t.id); }
              }} />}
            </aside>
          </div>

          {/* Dải chú thích + số lượng */}
          <footer className="no-scrollbar flex shrink-0 items-center gap-2 overflow-x-auto border-t border-[var(--border)] bg-[var(--bg-surface)] px-4 py-2">
            {LEGEND.map((k) => (
              <span key={k} className="inline-flex shrink-0 items-center gap-2 rounded-[10px] bg-[var(--bg-subtle)] py-1 pl-1 pr-3 text-[12.5px] font-medium">
                <span className="grid h-7 min-w-7 place-items-center rounded-lg px-1.5 font-mono text-[13px] font-bold" style={{ background: STATE[k].bg, color: STATE[k].fg }}>{counts[k]}</span>
                {STATE[k].label}
              </span>
            ))}
            <span className="ml-auto inline-flex shrink-0 items-center gap-2 rounded-[10px] bg-[var(--bg-subtle)] py-1 pl-1 pr-3 text-[12.5px] font-medium" title="Tổng số khách đang ngồi (theo số khách đã nhập / phiếu đặt bàn)">
              <span className="grid h-7 min-w-7 place-items-center rounded-lg bg-[var(--text-primary)] px-1.5 font-mono text-[13px] font-bold text-white">{seated}</span>
              Khách đang ngồi
            </span>
            <span className="inline-flex shrink-0 items-center gap-2 rounded-[10px] bg-[var(--accent-soft)] px-3 py-1.5 text-[12.5px] font-semibold text-[var(--accent)]">
              Đã thu hôm nay <b className="font-mono">{formatCurrency(f.revenueToday)}</b>
            </span>
          </footer>
        </>
      )}
    </CashierShell>
  );
}

/* ---------------------------------------------------------------- Sơ đồ (lưới ô) */

function FloorCanvas({ floor, tables, zoom, selected, onSelect }: { floor: CashierFloor; tables: FloorTable[]; zoom: number; selected: string | null; onSelect: (id: string) => void }) {
  const cell = CELL * zoom;
  const style: CSSProperties = {
    width: floor.cols * cell,
    height: floor.rows * cell,
    backgroundImage: 'linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px)',
    backgroundSize: `${cell / 2}px ${cell / 2}px`,
  };
  if (!tables.length) return <p className="py-16 text-center text-[14px] text-[var(--text-muted)]">Khu vực này chưa có bàn.</p>;
  return (
    <div className="relative mx-auto rounded-[18px] border border-[var(--border)] bg-[var(--bg-surface)]" style={style}>
      {tables.map((t) => (
        <div key={t.id} className="absolute grid place-items-center" style={{ left: t.x * cell, top: t.y * cell, width: cell, height: cell }}>
          <TableShape t={t} zoom={zoom} selected={selected === t.id} onClick={() => onSelect(t.id)} />
        </div>
      ))}
    </div>
  );
}

/** Vị trí ghế quanh bàn theo số ghế (tối đa 12 ghế được vẽ). */
function chairs(shape: FloorTable['shape'], seats: number, w: number, h: number) {
  const n = Math.min(seats, 12);
  const out: { x: number; y: number; r: number }[] = [];
  if (shape === 'round') {
    const R = w / 2 + 9;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 - Math.PI / 2;
      out.push({ x: w / 2 + Math.cos(a) * R, y: h / 2 + Math.sin(a) * R, r: (a * 180) / Math.PI + 90 });
    }
    return out;
  }
  // Bàn vuông / chữ nhật: chia ghế cho 4 cạnh (cạnh dài nhận nhiều hơn).
  const longTB = w >= h;
  const sides = { top: 0, bottom: 0, left: 0, right: 0 };
  const order: (keyof typeof sides)[] = longTB ? ['top', 'bottom', 'top', 'bottom', 'left', 'right'] : ['left', 'right', 'left', 'right', 'top', 'bottom'];
  for (let i = 0; i < n; i++) sides[order[i % order.length]]++;
  const place = (count: number, side: keyof typeof sides) => {
    for (let i = 0; i < count; i++) {
      const p = (i + 1) / (count + 1);
      if (side === 'top') out.push({ x: w * p, y: -9, r: 0 });
      if (side === 'bottom') out.push({ x: w * p, y: h + 9, r: 180 });
      if (side === 'left') out.push({ x: -9, y: h * p, r: 270 });
      if (side === 'right') out.push({ x: w + 9, y: h * p, r: 90 });
    }
  };
  (Object.keys(sides) as (keyof typeof sides)[]).forEach((s) => place(sides[s], s));
  return out;
}

function TableShape({ t, zoom, selected, onClick }: { t: FloorTable; zoom: number; selected: boolean; onClick: () => void }) {
  const st = stateOf(t);
  const s = STATE[st];
  const base = 70 * zoom;
  const w = t.shape === 'rect' ? base * 1.45 : base;
  const h = t.shape === 'rect' ? base * 0.85 : base;
  const g = guestsOf(t);
  const soon = !t.order ? soonReservation(t) : null;
  const label = t.order ? formatCurrency(t.order.subtotal) : soon ? `${soon.customerName} · ${hhmm(soon.time)}` : null;
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      aria-label={`Bàn ${t.code}: ${s.label}`}
      aria-pressed={selected}
      data-table={t.code}
      className="group relative flex flex-col items-center outline-none"
    >
      <span className="relative block transition-transform group-hover:scale-[1.04]" style={{ width: w, height: h }}>
        {chairs(t.shape, t.seats, w, h).map((c, i) => (
          <span
            key={i}
            className="absolute block rounded-[4px]"
            style={{ width: 16 * zoom, height: 7 * zoom, left: c.x, top: c.y, transform: `translate(-50%, -50%) rotate(${c.r}deg)`, background: st === 'available' ? '#c9d1d9' : s.bg, opacity: st === 'available' ? 1 : 0.55 }}
          />
        ))}
        <span
          className={cn('absolute inset-0 grid place-items-center shadow-[0_4px_10px_rgba(15,26,20,0.12)]', st === 'calling' && 'pos-call', selected && 'ring-[3px] ring-[var(--text-primary)] ring-offset-2')}
          style={{
            background: st === 'inactive' ? `repeating-linear-gradient(135deg, ${s.bg} 0 6px, #b8bec6 6px 12px)` : s.bg,
            color: s.fg,
            borderRadius: t.shape === 'round' ? '50%' : 14 * zoom,
          }}
        >
          <span className="text-center leading-none">
            <span className="block font-extrabold" style={{ fontSize: 19 * zoom }}>{t.code}</span>
            <span className="mt-0.5 block font-mono font-semibold opacity-90" style={{ fontSize: 10.5 * zoom }}>{g ? `${g}/${t.seats}` : `${t.seats} ghế`}</span>
          </span>
        </span>
        {t.order ? (
          <span className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-[var(--bg-surface)] px-1.5 font-mono font-bold shadow-sm" style={{ top: -10 * zoom, fontSize: 10.5 * zoom, color: st === 'late' ? '#dc2626' : 'var(--text-primary)' }}>
            {elapsed(t.order.openedAt)}
          </span>
        ) : null}
        {t.order?.readyCount ? (
          <span className="absolute grid place-items-center rounded-full bg-[#16a34a] font-mono font-bold text-white ring-2 ring-white" style={{ right: -6 * zoom, bottom: -6 * zoom, width: 18 * zoom, height: 18 * zoom, fontSize: 10 * zoom }} title={`${t.order.readyCount} món chờ mang ra`}>
            {t.order.readyCount}
          </span>
        ) : null}
      </span>
      <span className={cn('mt-3 max-w-[140px] truncate text-center font-medium', soon ? 'text-[#7c3aed]' : 'text-[var(--text-secondary)]')} style={{ fontSize: 11.5 * zoom, minHeight: 14 * zoom }}>{label ?? ''}</span>
    </button>
  );
}

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

/* ---------------------------------------------------------------- Bảng bên phải: chưa chọn bàn */

function IdlePanel({ floor, onPickTable }: { floor: CashierFloor; onPickTable: (code: string) => void }) {
  const [tab, setTab] = useState<'ready' | 'res'>(floor.ready.length ? 'ready' : 'res');
  const readyByTable = useMemo(() => {
    const m = new Map<string, CashierFloor['ready']>();
    floor.ready.forEach((r) => m.set(r.tableCode, [...(m.get(r.tableCode) ?? []), r]));
    return [...m.entries()];
  }, [floor.ready]);
  const upcoming = floor.reservations.filter((r) => r.status !== 'seated');

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="grid grid-cols-2 gap-1 border-b border-[var(--border)] p-2" role="tablist">
        {([['ready', `Chờ mang ra (${floor.ready.length})`], ['res', `Đặt bàn hôm nay (${upcoming.length})`]] as const).map(([k, l]) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={cn('h-10 rounded-[10px] text-[13.5px] font-semibold', tab === k ? 'bg-[var(--accent)] text-white' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]')}>{l}</button>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {tab === 'ready' ? (
          readyByTable.length === 0 ? (
            <p className="py-10 text-center text-[13.5px] text-[var(--text-muted)]">Không có món nào chờ mang ra.</p>
          ) : (
            <div className="space-y-2.5">
              <p className="text-[12.5px] text-[var(--text-muted)]">Món bếp đã nấu xong, đang chờ nhân viên phục vụ lấy. Bếp bấm "Đã lấy" khi món rời quầy.</p>
              {readyByTable.map(([code, items]) => (
                <div key={code} className="rounded-[12px] border border-[var(--border)] p-3">
                  <div className="flex items-center justify-between gap-2">
                    <button type="button" className="text-[15px] font-bold hover:text-[var(--accent)]" onClick={() => onPickTable(code)}>Bàn {code}</button>
                    <span className="text-[12.5px] text-[var(--text-muted)]">{items.length} món</span>
                  </div>
                  <ul className="mt-2 space-y-1">
                    {items.map((i) => (
                      <li key={i.id} className="flex items-center justify-between gap-2 text-[13.5px]">
                        <span className="min-w-0"><b>{i.qty}×</b> {i.dishName}{i.note ? <span className="text-[var(--text-muted)]"> · {i.note}</span> : null}<span className="ml-1 text-[12px] text-[var(--text-muted)]">({minutesSince(i.completedAt)}′)</span></span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )
        ) : upcoming.length === 0 ? (
          <p className="py-10 text-center text-[13.5px] text-[var(--text-muted)]">Hôm nay chưa có đặt bàn nào sắp tới.</p>
        ) : (
          <ul className="space-y-2">
            {upcoming.map((r) => {
              const diff = new Date(r.time).getTime() - Date.now();
              const soon = diff <= SOON_MS;
              return (
                <li key={r.id} className={cn('rounded-[12px] border p-3', soon ? 'border-[#c4b5fd] bg-[#f5f3ff]' : 'border-[var(--border)]')}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[16px] font-bold">{hhmm(r.time)}</span>
                    {r.tableCode ? <button type="button" onClick={() => onPickTable(r.tableCode!)} className="rounded-lg bg-[#8b5cf6] px-2 py-0.5 text-[12.5px] font-bold text-white">Bàn {r.tableCode}</button> : <span className="text-[12.5px] text-[var(--text-muted)]">Chưa xếp bàn</span>}
                  </div>
                  <p className="mt-1 text-[14px] font-semibold">{r.customerName} · {r.guests} khách</p>
                  <p className="text-[12.5px] text-[var(--text-muted)]">{r.phone}{diff < 0 ? ' · đã tới giờ' : soon ? ` · còn ${Math.round(diff / 60_000)} phút` : ''}</p>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- Bảng bên phải: một bàn */

const ITEM_STATE: Record<OrderItemStatus, string> = { pending: 'Chờ', cooking: 'Đang làm', done: 'Chờ lấy', served: 'Đã mang', cancelled: 'Hủy' };

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
  // Xử lý yêu cầu của khách ngay trên bảng bàn (không phải sang trang Yêu cầu).
  const reqDone = () => { void detail.refetch(); void qc.invalidateQueries({ queryKey: ['thu-ngan'] }); };
  const reqErr = (e: unknown) => toast.error(e instanceof Error ? e.message : 'Không lưu được');
  const close = useMutation({
    mutationFn: closeTable,
    onSuccess: () => { toast.success(`Đã đóng bàn ${t.code}`); void qc.invalidateQueries({ queryKey: ['thu-ngan'] }); onClose(); },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Không đóng được bàn'),
  });
  const forward = useMutation({ mutationFn: forwardRequest, onSuccess: () => { toast.success('Đã ghi nhận: nhân viên đang đến bàn'); reqDone(); }, onError: reqErr });
  const complete = useMutation({ mutationFn: completeRequest, onSuccess: () => { toast.success('Đã hoàn thành yêu cầu'); reqDone(); }, onError: reqErr });

  const d = detail.data;
  const o = d?.order;
  const editable = o?.status === 'open' && !o.locked;
  const g = d ? d.guests : t.order?.guests ?? null;
  const resGuests = t.reservation?.guests ?? null;
  const soon = !t.order ? soonReservation(t) : null;
  const activeItems = (o?.items ?? []).filter((i) => i.status !== 'cancelled');

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

            {d?.requests.length ? (
              <div className="space-y-2">
                {d.requests.map((r) => (
                  <div key={r.id} className={cn('rounded-[12px] border p-3 text-[13.5px]', r.type === 'payment' ? 'border-[#fde047] bg-[#fefce8]' : 'border-[#fdba74] bg-[#fff7ed]')}>
                    <p className={cn('font-semibold', r.type === 'payment' ? 'text-[#854d0e]' : 'text-[#c2410c]')}>
                      {r.type === 'payment' ? 'Khách yêu cầu thanh toán' : `Khách gọi – ${REQUEST_TYPE_LABEL[r.type]}`} · {hhmm(r.createdAt)}
                      {r.status === 'forwarded' ? <span className="ml-1 font-normal text-[var(--text-muted)]">· đã báo nhân viên</span> : null}
                    </p>
                    {r.content ? <p className="text-[var(--text-secondary)]">{r.content}</p> : null}
                    <div className="mt-2 flex flex-wrap gap-2">
                      {r.type === 'payment' ? (
                        d.invoice?.status === 'unpaid' ? (
                          <Button size="sm" leadingIcon={<Wallet size={14} />} loading={openPay.isPending} onClick={() => openPay.mutate(d.invoice!.id)}>Thu tiền</Button>
                        ) : (
                          <Button size="sm" leadingIcon={<Receipt size={14} />} disabled={!editable} onClick={() => setInvoiceOpen(true)}>Lập hóa đơn</Button>
                        )
                      ) : (
                        <>
                          {r.status === 'new' ? (
                            <Button size="sm" variant="outline" loading={forward.isPending && forward.variables === r.id} onClick={() => forward.mutate(r.id)}>Đã báo nhân viên</Button>
                          ) : null}
                          <Button size="sm" loading={complete.isPending && complete.variables === r.id} onClick={() => complete.mutate(r.id)}>Hoàn thành</Button>
                        </>
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
