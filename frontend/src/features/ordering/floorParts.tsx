import type { CSSProperties, ReactNode } from 'react';
import { formatCurrency } from '@/lib/format';
import { cn } from '@/lib/cn';
import '@/features/ordering/pos-floor.css';
import type { CashierFloor, Floor, FloorTable, Wall, WallKind, Zone } from '@/types';

/*
 * Sơ đồ bàn kiểu POS dùng chung cho Thu ngân (pages/thu-ngan/FloorPage) và Nhân viên phục vụ (pages/phuc-vu):
 * bàn vẽ đúng hình và vị trí Quản lý đã xếp (lưới), ghế quanh bàn, màu theo trạng thái, đồng hồ trên bàn.
 */

export const CELL = 128; // px ở mức 100%

/* ---------------------------------------------------------------- Trạng thái bàn trên sơ đồ */

export type TableState = 'available' | 'reserved' | 'occupied' | 'ready' | 'calling' | 'confirm' | 'payment' | 'late' | 'inactive';

export const STATE: Record<TableState, { label: string; bg: string; fg: string }> = {
  available: { label: 'Trống', bg: '#e9edf1', fg: '#5b6673' },
  reserved: { label: 'Đặt trước', bg: '#8b5cf6', fg: '#ffffff' },
  occupied: { label: 'Có khách', bg: '#2563eb', fg: '#ffffff' },
  ready: { label: 'Món chờ mang ra', bg: '#16a34a', fg: '#ffffff' },
  calling: { label: 'Khách gọi', bg: '#f97316', fg: '#ffffff' },
  confirm: { label: 'Chờ xác nhận', bg: '#db2777', fg: '#ffffff' },
  payment: { label: 'Chờ thanh toán', bg: '#eab308', fg: '#1f1600' },
  late: { label: 'Quá giờ', bg: '#dc2626', fg: '#ffffff' },
  inactive: { label: 'Ngừng phục vụ', bg: '#9ca3af', fg: '#ffffff' },
};
export const LEGEND: TableState[] = ['available', 'reserved', 'occupied', 'confirm', 'ready', 'calling', 'payment', 'late', 'inactive'];
export const SOON_MS = 2 * 60 * 60_000; // đặt bàn trong 2 giờ tới thì hiện trên bàn trống

export const minutesSince = (iso: string) => Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60_000));
export const hhmm = (iso: string) => new Date(iso).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
export const elapsed = (iso: string) => {
  const m = minutesSince(iso);
  return m < 60 ? `${m}′` : `${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}`;
};

/** Bàn trống có khách đặt sắp tới (trong 2 giờ tới, hoặc đã tới giờ nhưng chưa nhận bàn). */
export function soonReservation(t: FloorTable) {
  if (!t.reservation) return null;
  const diff = new Date(t.reservation.time).getTime() - Date.now();
  return diff <= SOON_MS ? t.reservation : null;
}

/** Ưu tiên việc cần làm ngay: món chờ xác nhận > khách gọi > chờ thanh toán > quá giờ > món chờ mang ra > có khách. */
export function stateOf(t: FloorTable): TableState {
  if (t.status === 'inactive') return 'inactive';
  const o = t.order;
  if (o) {
    if (o.unconfirmedCount > 0) return 'confirm';
    if (t.supportRequest) return 'calling';
    if (o.locked || t.paymentRequest) return 'payment';
    if (o.lateCount > 0) return 'late';
    if (o.readyCount > 0) return 'ready';
    return 'occupied';
  }
  if (t.status === 'reserved' || soonReservation(t)) return 'reserved';
  return 'available';
}

/** Số khách: thu ngân / phục vụ đã nhập, không thì lấy từ phiếu đặt bàn. */
export const guestsOf = (t: FloorTable) => t.order?.guests ?? (t.order && t.reservation ? t.reservation.guests : null);

/* ---------------------------------------------------------------- Sơ đồ tầng: lưới, vùng khu, tường (mục B7) */

/** Khung đang xem trên sơ đồ tầng (ô): cả tầng, hoặc cắt quanh một khu. */
export interface PlanWindow {
  x: number;
  y: number;
  cols: number;
  rows: number;
}

export interface PlanZone {
  id: string;
  name: string;
  zone: Zone;
  /** Tô đậm hơn (đang chọn / đang vẽ). */
  active?: boolean;
}

export const WALL_STYLE: Record<WallKind, { label: string; width: number; dash?: string; color: string }> = {
  outer: { label: 'Tường ngoài', width: 7, color: '#3f4a55' },
  inner: { label: 'Vách trong', width: 3.5, color: '#6b7682' },
  fence: { label: 'Hàng rào', width: 3, dash: '10 7', color: '#8a7a5c' },
};

/** Khung cả tầng. */
export const floorWindow = (f: Floor): PlanWindow => ({ x: 0, y: 0, cols: f.cols, rows: f.rows });

/**
 * Khung cắt quanh một khu (thu ngân / phục vụ xem từng khu): vùng khu nếu đã vẽ, gộp thêm các bàn của khu,
 * nới 1 ô mỗi phía cho thấy tường quanh khu, không vượt quá tầng.
 */
export function areaWindow(f: Floor | undefined, zone: Zone | null, tables: { x: number; y: number }[]): PlanWindow {
  const xs = tables.map((t) => t.x), ys = tables.map((t) => t.y);
  let x1 = zone ? zone.x : Math.min(...xs, Infinity), y1 = zone ? zone.y : Math.min(...ys, Infinity);
  let x2 = zone ? zone.x + zone.w : Math.max(...xs.map((v) => v + 1), -Infinity), y2 = zone ? zone.y + zone.h : Math.max(...ys.map((v) => v + 1), -Infinity);
  xs.forEach((v) => { x1 = Math.min(x1, v); x2 = Math.max(x2, v + 1); });
  ys.forEach((v) => { y1 = Math.min(y1, v); y2 = Math.max(y2, v + 1); });
  if (!Number.isFinite(x1) || !Number.isFinite(x2)) return { x: 0, y: 0, cols: f?.cols ?? 8, rows: f?.rows ?? 5 };
  const maxC = f?.cols ?? x2 + 1, maxR = f?.rows ?? y2 + 1;
  x1 = Math.max(0, x1 - 1); y1 = Math.max(0, y1 - 1);
  x2 = Math.min(maxC, x2 + 1); y2 = Math.min(maxR, y2 + 1);
  return { x: x1, y: y1, cols: x2 - x1, rows: y2 - y1 };
}

/** Nền sơ đồ: lưới nửa ô, vùng khu tô gạch chéo + tên, tường. Vẽ bằng SVG theo khung đang xem. */
export function PlanBackdrop({ win, cell, walls, zones, children }: { win: PlanWindow; cell: number; walls: Wall[]; zones: PlanZone[]; children?: ReactNode }) {
  const W = win.cols * cell, H = win.rows * cell;
  const X = (v: number) => (v - win.x) * cell, Y = (v: number) => (v - win.y) * cell;
  const k = cell / CELL;
  return (
    <svg width={W} height={H} className="pointer-events-none absolute inset-0 overflow-visible" aria-hidden>
      <defs>
        <pattern id="plan-grid" width={cell / 2} height={cell / 2} patternUnits="userSpaceOnUse" x={0} y={0}>
          <path d={`M ${cell / 2} 0 L 0 0 0 ${cell / 2}`} fill="none" stroke="var(--border)" strokeWidth={1} />
        </pattern>
        <pattern id="plan-hatch" width={10} height={10} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1={0} y1={0} x2={0} y2={10} stroke="var(--accent)" strokeOpacity={0.14} strokeWidth={4} />
        </pattern>
      </defs>
      <rect width={W} height={H} fill="url(#plan-grid)" />
      {zones.map((z) => (
        <g key={z.id}>
          <rect
            x={X(z.zone.x) + 3} y={Y(z.zone.y) + 3} width={z.zone.w * cell - 6} height={z.zone.h * cell - 6} rx={12 * k}
            fill="url(#plan-hatch)" stroke="var(--accent)" strokeOpacity={z.active ? 0.9 : 0.35} strokeWidth={z.active ? 2.5 : 1.5} strokeDasharray={z.active ? undefined : '6 5'}
          />
          {z.name ? (() => {
            // Nhãn tên khu nằm trên đường viền vùng (không bị bàn ở góc vùng che).
            const fs = Math.max(10.5, 13 * k);
            const h = fs + 8;
            const w = z.name.length * fs * 0.56 + 14;
            const lx = X(z.zone.x) + 14, ly = Y(z.zone.y) + 3 - h / 2;
            return (
              <g>
                <rect x={lx} y={ly} width={w} height={h} rx={h / 2} fill="var(--bg-surface)" stroke="var(--accent)" strokeOpacity={0.45} />
                <text x={lx + w / 2} y={ly + h / 2} dominantBaseline="central" textAnchor="middle" fontSize={fs} fontWeight={700} fill="var(--accent)">
                  {z.name}
                </text>
              </g>
            );
          })() : null}
        </g>
      ))}
      {walls.map((w, i) => {
        const st = WALL_STYLE[w.kind];
        return (
          <line key={i} x1={X(w.x1)} y1={Y(w.y1)} x2={X(w.x2)} y2={Y(w.y2)} stroke={st.color} strokeWidth={st.width * Math.max(0.6, k)} strokeLinecap="round" strokeDasharray={st.dash} />
        );
      })}
      {children}
    </svg>
  );
}

/** Vùng khu của các khu trên một tầng (đã vẽ vùng). */
export const zonesOf = (areas: { id: string; name: string; floorId: string; zone: Zone | null }[], floorId: string): PlanZone[] =>
  areas.filter((a) => a.floorId === floorId && a.zone).map((a) => ({ id: a.id, name: a.name, zone: a.zone! }));

export function FloorCanvas({ floor, floorId, win, tables, zoom, selected, onSelect, showZoneNames = true, tableScale = 1 }: {
  floor: CashierFloor;
  floorId: string;
  win: PlanWindow;
  tables: FloorTable[];
  zoom: number;
  selected: string | null;
  onSelect: (id: string) => void;
  showZoneNames?: boolean;
  /** Vẽ bàn to hơn so với ô lưới (màn POS thu ngân xem cả tầng); tối đa ~1,1 để bàn kề nhau không chạm. */
  tableScale?: number;
}) {
  const cell = CELL * zoom;
  const fl = floor.floors.find((x) => x.id === floorId);
  const style: CSSProperties = { width: win.cols * cell, height: win.rows * cell };
  if (!tables.length && !fl) return <p className="py-16 text-center text-[14px] text-[var(--text-muted)]">Khu vực này chưa có bàn.</p>;
  const zones = zonesOf(floor.areas, floorId).map((z) => (showZoneNames ? z : { ...z, name: '' }));
  return (
    <div className="relative mx-auto rounded-[18px] border border-[var(--border)] bg-[var(--bg-surface)]" style={style}>
      <PlanBackdrop win={win} cell={cell} walls={fl?.walls ?? []} zones={zones} />
      {tables.length === 0 ? <p className="absolute inset-0 grid place-items-center text-[14px] text-[var(--text-muted)]">Khu vực này chưa có bàn.</p> : null}
      {tables.map((t) => (
        <div key={t.id} className="absolute grid place-items-center" style={{ left: (t.x - win.x) * cell, top: (t.y - win.y) * cell, width: cell, height: cell }}>
          <TableShape t={t} zoom={zoom * tableScale} selected={selected === t.id} onClick={() => onSelect(t.id)} />
        </div>
      ))}
    </div>
  );
}

/** Vị trí ghế quanh bàn theo số ghế (tối đa 12 ghế được vẽ). */
export function chairs(shape: FloorTable['shape'], seats: number, w: number, h: number) {
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

export function TableShape({ t, zoom, selected, onClick }: { t: FloorTable; zoom: number; selected: boolean; onClick: () => void }) {
  const st = stateOf(t);
  const s = STATE[st];
  const base = 78 * zoom;
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
            <span className="block font-extrabold" style={{ fontSize: Math.max(11, 19 * zoom) }}>{t.code}</span>
            <span className="mt-0.5 block font-mono font-semibold opacity-90" style={{ fontSize: Math.max(8.5, 10.5 * zoom) }}>{g ? `${g}/${t.seats}` : `${t.seats} ghế`}</span>
          </span>
        </span>
        {t.order ? (
          <span className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-[var(--bg-surface)] px-1.5 font-mono font-bold shadow-sm" style={{ top: -10 * zoom, fontSize: Math.max(9, 10.5 * zoom), color: st === 'late' ? '#dc2626' : 'var(--text-primary)' }}>
            {elapsed(t.order.openedAt)}
          </span>
        ) : null}
        {t.order?.readyCount ? (
          <span className="absolute grid place-items-center rounded-full bg-[#16a34a] font-mono font-bold text-white ring-2 ring-white" style={{ right: -6 * zoom, bottom: -6 * zoom, width: 18 * zoom, height: 18 * zoom, fontSize: 10 * zoom }} title={`${t.order.readyCount} món chờ mang ra`}>
            {t.order.readyCount}
          </span>
        ) : null}
      </span>
      <span className={cn('mt-3 max-w-[140px] truncate text-center font-medium', soon ? 'text-[#7c3aed]' : 'text-[var(--text-secondary)]')} style={{ fontSize: Math.max(9, 11.5 * zoom), minHeight: 14 * zoom }}>{label ?? ''}</span>
    </button>
  );
}

