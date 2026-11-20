import type { CSSProperties } from 'react';
import { formatCurrency } from '@/lib/format';
import { cn } from '@/lib/cn';
import '@/features/ordering/pos-floor.css';
import type { CashierFloor, FloorTable } from '@/types';

/*
 * Sơ đồ bàn kiểu POS dùng chung cho Thu ngân (pages/thu-ngan/FloorPage) và Nhân viên phục vụ (pages/phuc-vu):
 * bàn vẽ đúng hình và vị trí Quản lý đã xếp (lưới), ghế quanh bàn, màu theo trạng thái, đồng hồ trên bàn.
 */

export const CELL = 128; // px ở mức 100%

/* ---------------------------------------------------------------- Trạng thái bàn trên sơ đồ */

export type TableState = 'available' | 'reserved' | 'occupied' | 'ready' | 'calling' | 'payment' | 'late' | 'inactive';

export const STATE: Record<TableState, { label: string; bg: string; fg: string }> = {
  available: { label: 'Trống', bg: '#e9edf1', fg: '#5b6673' },
  reserved: { label: 'Đặt trước', bg: '#8b5cf6', fg: '#ffffff' },
  occupied: { label: 'Có khách', bg: '#2563eb', fg: '#ffffff' },
  ready: { label: 'Món chờ mang ra', bg: '#16a34a', fg: '#ffffff' },
  calling: { label: 'Khách gọi', bg: '#f97316', fg: '#ffffff' },
  payment: { label: 'Chờ thanh toán', bg: '#eab308', fg: '#1f1600' },
  late: { label: 'Quá giờ', bg: '#dc2626', fg: '#ffffff' },
  inactive: { label: 'Ngừng phục vụ', bg: '#9ca3af', fg: '#ffffff' },
};
export const LEGEND: TableState[] = ['available', 'reserved', 'occupied', 'ready', 'calling', 'payment', 'late', 'inactive'];
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

/** Ưu tiên việc cần làm ngay: khách gọi > chờ thanh toán > quá giờ > món chờ mang ra > có khách. */
export function stateOf(t: FloorTable): TableState {
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

/** Số khách: thu ngân / phục vụ đã nhập, không thì lấy từ phiếu đặt bàn. */
export const guestsOf = (t: FloorTable) => t.order?.guests ?? (t.order && t.reservation ? t.reservation.guests : null);

/* ---------------------------------------------------------------- Sơ đồ (lưới ô) */

export function FloorCanvas({ floor, tables, zoom, selected, onSelect }: { floor: CashierFloor; tables: FloorTable[]; zoom: number; selected: string | null; onSelect: (id: string) => void }) {
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

