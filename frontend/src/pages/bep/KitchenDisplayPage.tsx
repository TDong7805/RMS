import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Ban, Check, ChefHat, CircleCheckBig, Keyboard, LogOut, Play, Plus, RotateCcw, Search, Settings, Timer, Trash2, Volume2, Wifi, WifiOff, X } from 'lucide-react';
import {
  completeItems,
  getKitchenOrder,
  getKitchenQueue,
  getSoldOutDishes,
  KITCHEN_STREAM,
  kitchenCancelItem,
  setDishSoldOut,
  startItems,
  kitchenServeItems,
  undoItem,
} from '@/api/ordering';
import { beep, beepCancel, unlockAudio, useLiveEvents } from '@/features/ordering/live';
import { KitchenBrand, KitchenNav, kIconBtn } from '@/features/ordering/KitchenShell';
import { DutyBanner } from '@/features/self/DutyBanner';
import {
  DEFAULT_KDS_SETTINGS,
  KDS_COLORS,
  MAX_THRESHOLDS,
  TEXT_SIZES,
  thresholdFor,
  useKdsSettings,
  type KdsColor,
  type KdsColumns,
  type KdsSettings,
  type KdsTextSize,
  type KdsThreshold,
} from '@/features/ordering/kdsSettings';
import '@/features/ordering/kds-theme.css';
import { useAuth, useLogout } from '@/lib/auth';
import { cn } from '@/lib/cn';
import type { KitchenCancelReason, KitchenItem, KitchenQueue } from '@/types';

type View = 'table' | 'dish';
type StatusFilter = 'all' | 'pending' | 'cooking';

const KEYS = { queue: ['bep', 'queue'] as const, dishes: ['bep', 'dishes'] as const };

const minutesSince = (iso: string, now: number) => Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60_000));
const clock = (d: Date) => d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
const hhmm = (iso: string | null) => (iso ? clock(new Date(iso)) : '');
const CANCEL_BY: Record<string, string> = { customer: 'Khách hủy', cashier: 'Thu ngân hủy' };

function useNow(intervalMs = 15_000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

/* ---------------------------------------------------------------- Nhóm món: mỗi bàn một thẻ, trong thẻ chia theo đợt gọi */

interface Batch {
  batchNo: number;
  createdAt: string;
  items: KitchenItem[];
  /** Món khách / thu ngân vừa hủy trong đợt này (nhãn ĐÃ ĐỔI). */
  changed: KitchenItem[];
}

interface TableTicket {
  orderId: string;
  first: KitchenItem;
  /** Đợt mới nhất ở trên. */
  batches: Batch[];
  active: KitchenItem[];
  oldest: string;
}

function groupByTable(items: KitchenItem[], changed: KitchenItem[]): TableTicket[] {
  const orders = new Map<string, Map<number, Batch>>();
  const firsts = new Map<string, KitchenItem>();
  const batchOf = (i: KitchenItem) => {
    const byBatch = orders.get(i.orderId) ?? new Map<number, Batch>();
    orders.set(i.orderId, byBatch);
    const b = byBatch.get(i.batchNo) ?? { batchNo: i.batchNo, createdAt: i.createdAt, items: [], changed: [] };
    byBatch.set(i.batchNo, b);
    if (i.createdAt < b.createdAt) b.createdAt = i.createdAt;
    return b;
  };
  items.forEach((i) => {
    if (!firsts.has(i.orderId)) firsts.set(i.orderId, i);
    batchOf(i).items.push(i);
  });
  // Món vừa hủy chỉ hiện trên thẻ của bàn còn món đang chờ / đang làm (bàn hết món thì không giữ thẻ lại).
  changed.filter((i) => orders.has(i.orderId)).forEach((i) => batchOf(i).changed.push(i));
  return [...orders.entries()]
    .map(([orderId, byBatch]) => {
      const batches = [...byBatch.values()].sort((a, b) => b.batchNo - a.batchNo);
      const active = batches.flatMap((b) => b.items);
      const oldest = active.reduce((m, i) => (i.createdAt < m ? i.createdAt : m), active[0].createdAt);
      return { orderId, first: firsts.get(orderId)!, batches, active, oldest };
    })
    .sort((a, b) => a.oldest.localeCompare(b.oldest));
}

/**
 * Màn hình bếp (UC-BEP-01..05) — kiểu màn hình hiển thị trong bếp (KDS): toàn màn hình, mỗi bàn một thẻ chia theo đợt gọi,
 * đồng hồ chờ đổi màu theo mốc tự chỉnh, lọc theo trạng thái / danh mục, phím tắt, cài đặt riêng từng máy (sáng / tối, số cột, cỡ chữ, trạm).
 */
export default function KitchenDisplayPage() {
  const qc = useQueryClient();
  const { data: user } = useAuth();
  const logout = useLogout();
  const now = useNow();
  const [settings, setSettings] = useKdsSettings();
  const [started, setStarted] = useState(() => sessionStorage.getItem('rms-kds-started') === '1');
  const [view, setView] = useState<View>('table');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [catTab, setCatTab] = useState('');
  const [panel, setPanel] = useState<'soldOut' | 'done' | 'settings' | null>(null);
  const [detailOrder, setDetailOrder] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<KitchenItem | null>(null);
  const [flash, setFlash] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<string | null>(null);
  const seen = useRef<Set<string> | null>(null);
  const seenChanged = useRef<Set<string> | null>(null);

  const queue = useQuery({ queryKey: KEYS.queue, queryFn: getKitchenQueue, refetchInterval: 10_000 });
  const { connected } = useLiveEvents(KITCHEN_STREAM, [KEYS.queue, KEYS.dishes]);
  const station = settings.stationCategories;
  const inStation = (i: KitchenItem) => station.length === 0 || station.includes(i.categoryId);

  // Món mới (chưa thấy lần trước) → nháy vài giây + âm báo. Món khách / thu ngân vừa hủy → âm báo riêng + thông báo.
  useEffect(() => {
    const data = queue.data;
    if (!data) return;
    const ids = new Set(data.items.map((i) => i.id));
    if (seen.current) {
      const fresh = data.items.filter((i) => i.status === 'pending' && !seen.current!.has(i.id) && inStation(i)).map((i) => i.id);
      if (fresh.length) {
        beep(2);
        setFlash((prev) => new Set([...prev, ...fresh]));
        setTimeout(() => setFlash((prev) => new Set([...prev].filter((id) => !fresh.includes(id)))), 6000);
      }
    }
    seen.current = ids;
    const changedIds = new Set(data.changed.map((i) => i.id));
    if (seenChanged.current) {
      const fresh = data.changed.filter((i) => !seenChanged.current!.has(i.id) && inStation(i));
      if (fresh.length) {
        beepCancel();
        fresh.forEach((i) => toast.warning(`Bàn ${i.tableCode}: ${CANCEL_BY[i.cancelSource ?? ''] ?? 'Đã hủy'} ${i.qty}× ${i.dishName}`));
      }
    }
    seenChanged.current = changedIds;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queue.data]);

  const setQueue = (q: KitchenQueue) => qc.setQueryData(KEYS.queue, q);
  const onError = (e: unknown) => {
    toast.error(e instanceof Error ? e.message : 'Thao tác không thành công');
    void qc.invalidateQueries({ queryKey: KEYS.queue });
  };
  const start = useMutation({ mutationFn: startItems, onSuccess: setQueue, onError });
  const complete = useMutation({ mutationFn: completeItems, onSuccess: setQueue, onError });

  const all = useMemo(() => queue.data?.items ?? [], [queue.data]);
  const stationItems = all.filter(inStation);
  const statusItems = stationItems.filter((i) => status === 'all' || i.status === status);
  const items = statusItems.filter((i) => !catTab || i.categoryId === catTab);
  const changed = (queue.data?.changed ?? []).filter((i) => inStation(i) && (!catTab || i.categoryId === catTab));
  const tickets = groupByTable(items, status === 'cooking' ? [] : changed);

  const categoryTabs = useMemo(() => {
    const counts = new Map<string, number>();
    statusItems.forEach((i) => counts.set(i.categoryId, (counts.get(i.categoryId) ?? 0) + 1));
    return (queue.data?.categories ?? []).filter((c) => (station.length === 0 || station.includes(c.id)) && (counts.get(c.id) || c.id === catTab))
      .map((c) => ({ ...c, count: counts.get(c.id) ?? 0 }));
  }, [statusItems, queue.data, station, catTab]);
  const stationNames = (queue.data?.categories ?? []).filter((c) => station.includes(c.id)).map((c) => c.name);

  const startTicket = (t: TableTicket) => {
    const ids = t.active.filter((i) => i.status === 'pending').map((i) => i.id);
    if (ids.length) start.mutate(ids);
  };
  const completeTicket = (t: TableTicket) => {
    const cooking = t.active.filter((i) => i.status === 'cooking').map((i) => i.id);
    complete.mutate(cooking.length ? cooking : t.active.map((i) => i.id));
  };

  // Phím tắt (bàn phím rời): số 1–9, 0 = thẻ thứ 10; ← → chuyển thẻ; Space = bắt đầu; Enter = xong; Esc = bỏ chọn.
  const keyState = useRef({ tickets, selected, startTicket, completeTicket });
  keyState.current = { tickets, selected, startTicket, completeTicket };
  const blocked = !started || panel !== null || detailOrder !== null || cancelTarget !== null || view !== 'table';
  useEffect(() => {
    if (blocked) return;
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName))) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const { tickets: list, selected: sel } = keyState.current;
      const idx = list.findIndex((t) => t.orderId === sel);
      if (/^[0-9]$/.test(e.key)) {
        const n = e.key === '0' ? 9 : Number(e.key) - 1;
        if (list[n]) setSelected(list[n].orderId);
        e.preventDefault();
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        if (!list.length) return;
        const next = idx < 0 ? 0 : (idx + (e.key === 'ArrowRight' ? 1 : list.length - 1)) % list.length;
        setSelected(list[next].orderId);
        e.preventDefault();
      } else if (e.key === 'Escape') {
        setSelected(null);
      } else if ((e.key === ' ' || e.key === 'Enter') && idx >= 0) {
        e.preventDefault();
        if (e.key === ' ') keyState.current.startTicket(list[idx]);
        else keyState.current.completeTicket(list[idx]);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [blocked]);

  // Thẻ đang chọn không còn (đã xong hết) → bỏ chọn.
  useEffect(() => {
    if (selected && !tickets.some((t) => t.orderId === selected)) setSelected(null);
  }, [tickets, selected]);

  const begin = () => {
    unlockAudio();
    beep(1);
    sessionStorage.setItem('rms-kds-started', '1');
    setStarted(true);
  };

  const pendingCount = stationItems.filter((i) => i.status === 'pending').length;
  const cookingCount = stationItems.length - pendingCount;
  const avg = queue.data?.avgMinutesToday;
  const zoom = TEXT_SIZES[settings.textSize].zoom;
  const gridStyle: CSSProperties = {
    gridTemplateColumns: settings.columns === 'auto' ? 'repeat(auto-fill, minmax(290px, 1fr))' : `repeat(${settings.columns}, minmax(0, 1fr))`,
    zoom,
  };

  return (
    <div className="kds flex h-dvh flex-col" data-kds-mode={settings.mode}>
      {/* Thanh trên cùng */}
      <header className="flex flex-wrap items-center gap-3 border-b border-[var(--k-line)] bg-[var(--k-header)] px-4 py-2">
        <KitchenBrand>
          <span className="font-mono text-[19px] text-[var(--k-muted)]">{clock(new Date(now))}</span>
        </KitchenBrand>
        <KitchenNav />
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <span className={cn('inline-flex items-center gap-1 text-[13px] font-semibold', connected ? 'text-[var(--k-brand)]' : 'text-[var(--k-danger)]')} title={connected ? 'Đang nhận món trực tiếp' : 'Mất kết nối – đang thử lại'}>
            {connected ? <Wifi size={16} /> : <WifiOff size={16} />}{connected ? 'Trực tiếp' : 'Mất kết nối'}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--k-fill)] px-2.5 py-1.5 text-[13.5px]" title="Thời gian trung bình từ lúc khách gọi đến lúc bếp bấm xong, tính các món đã xong hôm nay">
            <Timer size={15} className="text-[var(--k-muted)]" />TB hôm nay <b className="font-mono">{avg == null ? '—' : `${avg.toLocaleString('vi-VN', { maximumFractionDigits: 1 })} phút`}</b>
          </span>
          <button type="button" onClick={() => setPanel('done')} className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--k-fill)] px-3 py-1.5 text-[14px] font-semibold hover:bg-[var(--k-fill-2)]">
            <CircleCheckBig size={16} className="text-[var(--k-brand)]" />Chờ lấy <span className="font-mono">({queue.data?.recent.length ?? 0})</span>
          </button>
          <button type="button" onClick={() => setPanel('soldOut')} className="rounded-lg bg-[var(--k-fill)] px-3 py-1.5 text-[14px] font-semibold hover:bg-[var(--k-fill-2)]">
            Món tạm hết{queue.data?.soldOutCount ? <span className="ml-1.5 rounded-full bg-[var(--k-danger)] px-1.5 font-mono text-[12px] text-white">{queue.data.soldOutCount}</span> : null}
          </button>
          <button type="button" aria-label="Cài đặt màn hình" title="Cài đặt màn hình" onClick={() => setPanel('settings')} className={kIconBtn}><Settings size={17} /></button>
          <span className="hidden text-[13px] text-[var(--k-muted)] xl:inline">{user?.fullName}</span>
          <button type="button" aria-label="Đăng xuất" title="Đăng xuất" onClick={() => logout.mutate()} className={kIconBtn}><LogOut size={16} /></button>
        </div>
      </header>
      <DutyBanner home="/bep" />

      {/* Dải lọc: trạng thái + danh mục + cách xem */}
      <div className="flex flex-wrap items-center gap-2 border-b border-[var(--k-line)] bg-[var(--k-header)] px-4 py-2">
        <div className="inline-flex rounded-lg bg-[var(--k-fill)] p-0.5 text-[14px] font-semibold" role="tablist" aria-label="Lọc trạng thái">
          <StatusTab active={status === 'all'} onClick={() => setStatus('all')} label="Tất cả" count={stationItems.length} />
          <StatusTab active={status === 'pending'} onClick={() => setStatus('pending')} label="Mới" count={pendingCount} dot="var(--k-new)" />
          <StatusTab active={status === 'cooking'} onClick={() => setStatus('cooking')} label="Đang làm" count={cookingCount} dot="var(--k-cook)" />
        </div>
        <span className="mx-1 hidden h-6 w-px bg-[var(--k-line)] sm:block" />
        {station.length ? (
          <button type="button" onClick={() => setPanel('settings')} className="rounded-full border border-dashed border-[var(--k-line)] px-3 py-1 text-[13px] text-[var(--k-muted)]" title="Danh mục màn hình này phụ trách (đổi trong Cài đặt)">
            Trạm: <b className="text-[var(--k-text)]">{stationNames.join(', ') || '—'}</b>
          </button>
        ) : null}
        <div className="no-scrollbar flex min-w-0 flex-1 gap-1.5 overflow-x-auto" role="tablist" aria-label="Lọc danh mục">
          <CatTab active={!catTab} onClick={() => setCatTab('')} label="Tất cả" count={statusItems.length} />
          {categoryTabs.map((c) => <CatTab key={c.id} active={catTab === c.id} onClick={() => setCatTab(catTab === c.id ? '' : c.id)} label={c.name} count={c.count} />)}
        </div>
        <div className="inline-flex rounded-lg bg-[var(--k-fill)] p-0.5 text-[14px] font-semibold">
          <button type="button" onClick={() => setView('table')} className={cn('rounded-md px-3 py-1.5', view === 'table' && 'bg-[var(--k-invert-bg)] text-[var(--k-invert-text)]')}>Theo bàn</button>
          <button type="button" onClick={() => setView('dish')} className={cn('rounded-md px-3 py-1.5', view === 'dish' && 'bg-[var(--k-invert-bg)] text-[var(--k-invert-text)]')}>Theo món</button>
        </div>
      </div>

      {/* Nội dung */}
      {queue.isError ? (
        <div className="grid flex-1 place-items-center text-[18px] text-[var(--k-muted)]">
          <div className="text-center">Không tải được dữ liệu<br /><button type="button" onClick={() => void queue.refetch()} className="mt-3 rounded-lg bg-[var(--k-fill-2)] px-4 py-2 text-[15px] text-[var(--k-text)]">Tải lại</button></div>
        </div>
      ) : !queue.data ? (
        <div className="grid flex-1 place-items-center text-[var(--k-muted)]">Đang tải…</div>
      ) : items.length === 0 ? (
        <div className="grid flex-1 place-items-center">
          <div className="text-center text-[var(--k-muted)]">
            <ChefHat size={64} strokeWidth={1.2} className="mx-auto" />
            <p className="mt-3 text-[22px] font-semibold">{all.length ? 'Không có món nào khớp bộ lọc' : 'Chưa có món cần chế biến'}</p>
          </div>
        </div>
      ) : view === 'table' ? (
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <div className="grid items-start gap-3" style={gridStyle}>
            {tickets.map((t, idx) => (
              <TableCard
                key={t.orderId}
                ticket={t}
                index={idx}
                now={now}
                thresholds={settings.thresholds}
                flash={flash}
                selected={selected === t.orderId}
                busy={start.isPending || complete.isPending}
                onSelect={() => setSelected(selected === t.orderId ? null : t.orderId)}
                onTable={() => setDetailOrder(t.orderId)}
                onStartAll={() => startTicket(t)}
                onCompleteAll={() => completeTicket(t)}
                onStart={(ids) => start.mutate(ids)}
                onComplete={(ids) => complete.mutate(ids)}
                onCancel={setCancelTarget}
              />
            ))}
          </div>
        </div>
      ) : (
        <DishView items={items} now={now} thresholds={settings.thresholds} style={gridStyle} onStart={(ids) => start.mutate(ids)} onComplete={(ids) => complete.mutate(ids)} />
      )}

      {!started ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-[var(--k-bg)]">
          <div className="text-center">
            <span className="mx-auto grid h-20 w-20 place-items-center rounded-2xl bg-[var(--k-brand)] text-[var(--k-on-brand)]"><ChefHat size={46} strokeWidth={1.5} /></span>
            <p className="mt-4 text-[26px] font-extrabold">Màn hình bếp</p>
            <p className="mt-1 text-[15px] text-[var(--k-muted)]">Bấm để bắt đầu ca và bật âm báo khi có món mới.</p>
            <button type="button" onClick={begin} className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[var(--k-brand-strong)] px-8 py-4 text-[20px] font-bold text-[var(--k-on-brand)]"><Volume2 size={22} />Bắt đầu ca</button>
          </div>
        </div>
      ) : null}

      {panel === 'soldOut' ? <SoldOutPanel onClose={() => setPanel(null)} /> : null}
      {panel === 'done' ? <DonePanel recent={queue.data?.recent ?? []} onDone={setQueue} onError={onError} onClose={() => setPanel(null)} /> : null}
      {panel === 'settings' ? <SettingsPanel settings={settings} categories={queue.data?.categories ?? []} onChange={setSettings} onClose={() => setPanel(null)} /> : null}
      {detailOrder ? <OrderPanel orderId={detailOrder} onClose={() => setDetailOrder(null)} /> : null}
      {cancelTarget ? <CancelDialog item={cancelTarget} onClose={() => setCancelTarget(null)} onDone={setQueue} /> : null}
    </div>
  );
}

function StatusTab({ active, onClick, label, count, dot }: { active: boolean; onClick: () => void; label: string; count: number; dot?: string }) {
  return (
    <button type="button" role="tab" aria-selected={active} onClick={onClick} className={cn('inline-flex items-center gap-1.5 rounded-md px-3 py-1.5', active ? 'bg-[var(--k-surface)] shadow-sm' : 'text-[var(--k-muted)]')}>
      {dot ? <span className="h-2.5 w-2.5 rounded-full" style={{ background: dot }} /> : null}
      {label}<b className="font-mono">{count}</b>
    </button>
  );
}

function CatTab({ active, onClick, label, count }: { active: boolean; onClick: () => void; label: string; count: number }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn('inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-[13.5px] font-semibold', active ? 'border-transparent bg-[var(--k-invert-bg)] text-[var(--k-invert-text)]' : 'border-[var(--k-line)] bg-[var(--k-surface)] text-[var(--k-text)]')}
    >
      {label}<span className={cn('rounded-full px-1.5 font-mono text-[12px]', active ? 'bg-[var(--k-surface)] text-[var(--k-text)]' : 'bg-[var(--k-fill-2)]')}>{count}</span>
    </button>
  );
}

/** Ô đồng hồ chờ: tô theo mốc màu đã vượt. */
function Clock({ minutes, thresholds, size = 'lg' }: { minutes: number; thresholds: KdsThreshold[]; size?: 'lg' | 'sm' }) {
  const t = thresholdFor(minutes, thresholds);
  const style = t ? { background: KDS_COLORS[t.color].bg, color: KDS_COLORS[t.color].text } : undefined;
  return (
    <span
      className={cn('shrink-0 rounded-md font-mono font-bold', size === 'lg' ? 'px-2 py-0.5 text-[18px]' : 'px-1.5 text-[13px]', !t && 'bg-[var(--k-fill-2)]')}
      style={style}
      title={`Đã chờ ${minutes} phút`}
    >
      {minutes}′
    </span>
  );
}

interface TableCardProps {
  ticket: TableTicket;
  index: number;
  now: number;
  thresholds: KdsThreshold[];
  flash: Set<string>;
  selected: boolean;
  busy: boolean;
  onSelect: () => void;
  onTable: () => void;
  onStartAll: () => void;
  onCompleteAll: () => void;
  onStart: (ids: string[]) => void;
  onComplete: (ids: string[]) => void;
  onCancel: (i: KitchenItem) => void;
}

/** Thẻ của một bàn: sọc màu theo trạng thái (xanh dương = còn món mới, cam = đang làm), các đợt gọi (mới nhất ở trên). */
function TableCard({ ticket, index, now, thresholds, flash, selected, busy, onSelect, onTable, onStartAll, onCompleteAll, onStart, onComplete, onCancel }: TableCardProps) {
  const mins = minutesSince(ticket.oldest, now);
  const late = thresholdFor(mins, thresholds);
  const pending = ticket.active.filter((i) => i.status === 'pending').length;
  const cooking = ticket.active.length - pending;
  const firstBatch = ticket.batches[ticket.batches.length - 1];
  const multi = ticket.batches.length > 1;
  return (
    <article
      onClick={onSelect}
      aria-selected={selected}
      data-table={ticket.first.tableCode}
      className={cn('flex cursor-pointer flex-col overflow-hidden rounded-xl border-2 bg-[var(--k-surface)] shadow-[var(--k-shadow)]', !late && 'border-[var(--k-line)]', selected && 'outline outline-[3px] outline-offset-2 outline-[color:var(--k-invert-bg)]')}
      style={late ? { borderColor: KDS_COLORS[late.color].bg } : undefined}
    >
      <div className="h-1.5 shrink-0" style={{ background: pending ? 'var(--k-new)' : 'var(--k-cook)' }} />
      <header className="flex items-start gap-2 px-3 pb-2 pt-2">
        {index < 10 ? <span className="mt-1 grid h-6 w-6 shrink-0 place-items-center rounded-md bg-[var(--k-fill-2)] font-mono text-[12.5px] font-bold" title={`Phím ${(index + 1) % 10}`}>{(index + 1) % 10}</span> : null}
        <button type="button" onClick={(e) => { e.stopPropagation(); onTable(); }} className="min-w-0 flex-1 text-left" title="Xem chi tiết đơn">
          <p className="truncate text-[24px] font-extrabold leading-tight">{ticket.first.tableCode}</p>
          <p className="truncate text-[12.5px] text-[var(--k-muted)]">{ticket.first.areaName} · {ticket.first.orderCode} · gọi {hhmm(firstBatch.createdAt)}</p>
        </button>
        <Clock minutes={mins} thresholds={thresholds} />
      </header>

      <div className="flex-1 border-t border-[var(--k-line)]">
        {ticket.batches.map((b, bi) => {
          const isNewest = multi && bi === 0;
          const bActive = b.items.length > 0;
          return (
            <section key={b.batchNo} className={cn('border-b border-[var(--k-line)] last:border-b-0', b.items.some((i) => flash.has(i.id)) && 'kds-flash')}>
              <div className={cn('flex items-center gap-2 px-3 py-1.5 text-[12.5px] font-bold uppercase tracking-wide', isNewest ? 'bg-[var(--k-new-soft)] text-[var(--k-new)]' : 'bg-[var(--k-surface-2)] text-[var(--k-muted)]')}>
                <span>Đợt {b.batchNo} · {hhmm(b.createdAt)}</span>
                {isNewest ? <span className="rounded bg-[var(--k-new)] px-1.5 text-[11px] text-[var(--k-on-new)]">Mới gọi thêm</span> : null}
                <span className="ml-auto">{bActive ? <Clock minutes={minutesSince(b.createdAt, now)} thresholds={thresholds} size="sm" /> : null}</span>
              </div>
              <ul className="divide-y divide-[var(--k-line)]">
                {b.items.map((i) => <ItemRow key={i.id} item={i} onStart={onStart} onComplete={onComplete} onCancel={onCancel} />)}
                {b.changed.map((i) => (
                  <li key={i.id} className="flex items-start gap-2 px-3 py-2 opacity-80">
                    <span className="min-w-[30px] font-mono text-[18px] font-bold text-[var(--k-danger)] line-through">{i.qty}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[16px] font-semibold text-[var(--k-danger)] line-through">{i.dishName}</p>
                      <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[12px]">
                        <span className="rounded bg-[var(--k-danger)] px-1.5 font-bold text-white">ĐÃ ĐỔI</span>
                        <span className="text-[var(--k-muted)]">{CANCEL_BY[i.cancelSource ?? ''] ?? 'Đã hủy'} lúc {hhmm(i.cancelledAt)} – không làm món này</span>
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>

      <div className="flex gap-2 p-2" onClick={(e) => e.stopPropagation()}>
        {pending ? (
          <button type="button" disabled={busy} onClick={onStartAll} className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-[var(--k-new)] py-2.5 text-[16px] font-extrabold text-[var(--k-on-new)] disabled:opacity-60">
            <Play size={17} fill="currentColor" />Bắt đầu ({pending})
          </button>
        ) : null}
        <button type="button" disabled={busy} onClick={onCompleteAll} className={cn('inline-flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-[16px] font-extrabold disabled:opacity-60', cooking ? 'bg-[var(--k-brand-strong)] text-[var(--k-on-brand)]' : 'bg-[var(--k-fill-2)]')}>
          <Check size={19} strokeWidth={3} />{cooking ? `Xong (${cooking})` : 'Xong cả bàn'}
        </button>
      </div>
    </article>
  );
}

function ItemRow({ item: i, onStart, onComplete, onCancel }: { item: KitchenItem; onStart: (ids: string[]) => void; onComplete: (ids: string[]) => void; onCancel: (i: KitchenItem) => void }) {
  const cooking = i.status === 'cooking';
  return (
    <li className={cn('flex items-start gap-2 px-3 py-2', cooking && 'bg-[var(--k-cook-soft)]')}>
      <span className="min-w-[30px] font-mono text-[20px] font-extrabold text-[var(--k-brand)]">{i.qty}</span>
      <div className="min-w-0 flex-1">
        <p className="text-[17px] font-semibold leading-snug">{i.dishName}</p>
        <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
          {i.setName ? <span className="rounded bg-[var(--k-fill)] px-1.5 text-[11.5px] font-bold text-[var(--k-muted)]" title="Món thuộc set khách gọi">SET · {i.setName.replace(/^Set /, '')}</span> : null}
          {cooking ? <span className="rounded bg-[var(--k-cook)] px-1.5 text-[11.5px] font-bold text-[var(--k-on-cook)]">ĐANG LÀM</span> : null}
          {i.recalledAt ? <span className="rounded bg-[var(--k-recall)] px-1.5 text-[11.5px] font-bold text-white" title={`Bếp trả lại lúc ${hhmm(i.recalledAt)}`}>GỌI LẠI</span> : null}
          {i.note ? <span className="rounded bg-[var(--k-note-bg)] px-1.5 text-[13.5px] font-bold text-[var(--k-note-text)]">{i.note}</span> : null}
        </div>
      </div>
      <div className="flex shrink-0 gap-1" onClick={(e) => e.stopPropagation()}>
        {!cooking ? (
          <button type="button" aria-label={`Bắt đầu ${i.dishName}`} title="Bắt đầu món này" onClick={() => onStart([i.id])} className="grid h-9 w-9 place-items-center rounded-lg bg-[var(--k-new-soft)] text-[var(--k-new)]"><Play size={16} fill="currentColor" /></button>
        ) : null}
        <button type="button" aria-label={`Hoàn thành ${i.dishName}`} title="Xong món này" onClick={() => onComplete([i.id])} className="grid h-9 w-9 place-items-center rounded-lg bg-[var(--k-brand-soft)] text-[var(--k-brand)]"><Check size={18} strokeWidth={3} /></button>
        {!cooking ? (
          <button type="button" aria-label={`Hủy ${i.dishName}`} title="Hủy món (hết nguyên liệu…)" onClick={() => onCancel(i)} className="grid h-9 w-9 place-items-center rounded-lg bg-[var(--k-fill)] text-[var(--k-muted)] hover:bg-[var(--k-danger-soft)] hover:text-[var(--k-danger)]"><Ban size={16} /></button>
        ) : null}
      </div>
    </li>
  );
}

/** Cách xem "Theo món": gộp cùng món ở mọi bàn (để nấu một lần cho nhiều bàn). */
function DishView({ items, now, thresholds, style, onStart, onComplete }: { items: KitchenItem[]; now: number; thresholds: KdsThreshold[]; style: CSSProperties; onStart: (ids: string[]) => void; onComplete: (ids: string[]) => void }) {
  const groups = [...items.reduce((m, i) => m.set(i.dishId, [...(m.get(i.dishId) ?? []), i]), new Map<string, KitchenItem[]>()).values()]
    .sort((a, b) => a[0].createdAt.localeCompare(b[0].createdAt));
  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-4">
      <div className="grid items-start gap-3" style={style}>
        {groups.map((g) => {
          const p = g.filter((i) => i.status === 'pending');
          const c = g.filter((i) => i.status === 'cooking');
          return (
            <article key={g[0].dishId} className="overflow-hidden rounded-xl border-2 border-[var(--k-line)] bg-[var(--k-surface)] shadow-[var(--k-shadow)]">
              <div className="h-1.5" style={{ background: p.length ? 'var(--k-new)' : 'var(--k-cook)' }} />
              <div className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-[20px] font-bold leading-snug">{g[0].dishName}</p>
                  <span className="font-mono text-[26px] font-extrabold text-[var(--k-brand)]">×{g.reduce((s, i) => s + i.qty, 0)}</span>
                </div>
                <p className="mt-0.5 flex items-center gap-1.5 text-[13px] text-[var(--k-muted)]">Chờ lâu nhất <Clock minutes={minutesSince(g[0].createdAt, now)} thresholds={thresholds} size="sm" /></p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {g.map((i) => (
                    <span key={i.id} className={cn('rounded-md px-2 py-1 text-[14px]', i.status === 'cooking' ? 'bg-[var(--k-cook-soft)]' : 'bg-[var(--k-fill)]')}>
                      <b>{i.tableCode}</b> ×{i.qty}{i.note ? <b className="ml-1 rounded bg-[var(--k-note-bg)] px-1 text-[var(--k-note-text)]">{i.note}</b> : null}
                    </span>
                  ))}
                </div>
                <div className="mt-3 flex gap-2">
                  {p.length ? <button type="button" onClick={() => onStart(p.map((i) => i.id))} className="flex-1 rounded-lg bg-[var(--k-new)] py-2.5 text-[16px] font-bold text-[var(--k-on-new)]">Bắt đầu ({p.length})</button> : null}
                  {c.length ? <button type="button" onClick={() => onComplete(c.map((i) => i.id))} className="flex-1 rounded-lg bg-[var(--k-brand-strong)] py-2.5 text-[16px] font-bold text-[var(--k-on-brand)]">Xong ({c.length})</button> : null}
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

function Panel({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-40 flex justify-end" role="dialog" aria-label={title}>
      <button type="button" aria-label="Đóng" className="absolute inset-0 bg-[var(--k-overlay)]" onClick={onClose} />
      <div className={cn('relative flex h-full w-full flex-col bg-[var(--k-surface)] shadow-2xl', wide ? 'max-w-[520px]' : 'max-w-[460px]')}>
        <div className="flex items-center justify-between border-b border-[var(--k-line)] px-4 py-3">
          <p className="text-[18px] font-bold">{title}</p>
          <button type="button" aria-label="Đóng" onClick={onClose} className={kIconBtn}><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

/**
 * Món đã xong đang chờ nhân viên phục vụ lấy ở quầy: bấm **Đã lấy** khi món rời bếp (khách thấy "Đã mang ra");
 * bấm xong nhầm thì **Trả lại** (trong 30 phút) — món quay lại hàng chờ với nhãn GỌI LẠI.
 */
function DonePanel({ recent, onDone, onError, onClose }: { recent: KitchenItem[]; onDone: (q: KitchenQueue) => void; onError: (e: unknown) => void; onClose: () => void }) {
  const [busy, setBusy] = useState(false);
  const groups = useMemo(() => {
    const m = new Map<string, KitchenItem[]>();
    recent.forEach((i) => m.set(`${i.orderId}-${i.batchNo}`, [...(m.get(`${i.orderId}-${i.batchNo}`) ?? []), i]));
    return [...m.entries()];
  }, [recent]);
  const recall = async (list: KitchenItem[]) => {
    setBusy(true);
    try {
      let q: KitchenQueue | null = null;
      for (const i of list) q = await undoItem(i.id);
      if (q) onDone(q);
      toast.success(list.length > 1 ? `Đã trả lại ${list.length} món về hàng chờ` : `Đã trả lại ${list[0].dishName} về hàng chờ`);
    } catch (e) {
      onError(e);
    } finally {
      setBusy(false);
    }
  };
  const serve = async (list: KitchenItem[]) => {
    setBusy(true);
    try {
      onDone(await kitchenServeItems(list.map((i) => i.id)));
      toast.success(list.length > 1 ? `${list[0].tableCode}: đã lấy ${list.length} món` : `${list[0].tableCode}: đã lấy ${list[0].dishName}`);
    } catch (e) {
      onError(e);
    } finally {
      setBusy(false);
    }
  };
  const canRecall = (i: KitchenItem) => !i.completedAt || Date.now() - new Date(i.completedAt).getTime() < 30 * 60_000;
  return (
    <Panel title={`Chờ lấy · ${recent.length} món`} onClose={onClose}>
      <p className="px-4 pt-3 text-[13px] text-[var(--k-muted)]">Món đã xong, chờ nhân viên phục vụ đến quầy lấy. Bấm <b>Đã lấy</b> khi món rời bếp — khách thấy "Đã mang ra". Bấm xong nhầm thì <b>Trả lại</b> (trong 30 phút).</p>
      <div className="flex-1 overflow-y-auto p-4">
        {groups.length === 0 ? <p className="py-10 text-center text-[var(--k-muted)]">Không có món nào đang chờ lấy</p> : null}
        {groups.map(([key, list]) => (
          <div key={key} className="mb-3 overflow-hidden rounded-xl border border-[var(--k-line)]">
            <div className="flex items-center gap-2 bg-[var(--k-surface-2)] px-3 py-2">
              <p className="flex-1 text-[15px]"><b className="text-[17px]">{list[0].tableCode}</b> <span className="text-[var(--k-muted)]">· Đợt {list[0].batchNo} · {list[0].orderCode}</span></p>
              {list.length > 1 ? <button type="button" disabled={busy} onClick={() => void serve(list)} className="inline-flex items-center gap-1 rounded-md bg-[var(--k-brand-strong)] px-2.5 py-1 text-[13px] font-semibold text-[var(--k-on-brand)] disabled:opacity-50"><CircleCheckBig size={14} />Đã lấy cả đợt</button> : null}
            </div>
            {list.map((i) => (
              <div key={i.id} className="flex items-center gap-3 border-t border-[var(--k-line)] px-3 py-2 text-[15px]">
                <span className="min-w-0 flex-1"><b className="font-mono">{i.qty}</b> {i.dishName}</span>
                <span className="font-mono text-[13px] text-[var(--k-muted)]">xong {hhmm(i.completedAt)}</span>
                {canRecall(i) ? <button type="button" disabled={busy} onClick={() => void recall([i])} className="inline-flex items-center gap-1 rounded-md bg-[var(--k-fill-2)] px-2 py-1 text-[12.5px] font-semibold disabled:opacity-50"><RotateCcw size={13} />Trả lại</button> : null}
                <button type="button" disabled={busy} onClick={() => void serve([i])} className="inline-flex items-center gap-1 rounded-md bg-[var(--k-brand-strong)] px-2.5 py-1 text-[13px] font-semibold text-[var(--k-on-brand)] disabled:opacity-50"><CircleCheckBig size={14} />Đã lấy</button>
              </div>
            ))}
          </div>
        ))}
      </div>
    </Panel>
  );
}

const COLUMN_OPTIONS: { value: KdsColumns; label: string }[] = [
  { value: 'auto', label: 'Tự động' }, { value: 2, label: '2' }, { value: 3, label: '3' }, { value: 4, label: '4' }, { value: 5, label: '5' }, { value: 6, label: '6' },
];

function Segmented<T extends string | number>({ value, options, onChange, label }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div className="inline-flex flex-wrap rounded-lg bg-[var(--k-fill)] p-0.5 text-[14px] font-semibold" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={String(o.value)} type="button" role="radio" aria-checked={value === o.value} onClick={() => onChange(o.value)} className={cn('rounded-md px-3 py-1.5', value === o.value ? 'bg-[var(--k-invert-bg)] text-[var(--k-invert-text)]' : 'text-[var(--k-muted)]')}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Cài đặt riêng của màn hình này (lưu trong máy): nền, số cột, cỡ chữ, mốc màu cảnh báo, trạm (danh mục phụ trách). */
function SettingsPanel({ settings, categories, onChange, onClose }: { settings: KdsSettings; categories: { id: string; name: string }[]; onChange: (p: Partial<KdsSettings>) => void; onClose: () => void }) {
  const th = settings.thresholds;
  const setTh = (next: KdsThreshold[]) => onChange({ thresholds: next });
  const usedColors = new Set(th.map((t) => t.color));
  const addTh = () => {
    const color = (Object.keys(KDS_COLORS) as KdsColor[]).find((c) => !usedColors.has(c)) ?? 'red';
    setTh([...th, { minutes: (th[th.length - 1]?.minutes ?? 0) + 10, color }]);
  };
  const toggleCat = (id: string) =>
    onChange({ stationCategories: settings.stationCategories.includes(id) ? settings.stationCategories.filter((x) => x !== id) : [...settings.stationCategories, id] });
  return (
    <Panel title="Cài đặt màn hình này" onClose={onClose} wide>
      <div className="flex-1 space-y-6 overflow-y-auto p-4 text-[14px]">
        <p className="rounded-lg bg-[var(--k-fill)] px-3 py-2 text-[13px] text-[var(--k-muted)]">Cài đặt lưu trên máy này — mỗi màn hình bếp (bếp nóng, quầy pha chế…) có thể cài khác nhau.</p>

        <Field label="Nền">
          <Segmented label="Nền" value={settings.mode} options={[{ value: 'light', label: 'Sáng' }, { value: 'dark', label: 'Tối' }]} onChange={(mode) => onChange({ mode })} />
        </Field>
        <Field label="Số cột thẻ">
          <Segmented label="Số cột" value={settings.columns} options={COLUMN_OPTIONS} onChange={(columns) => onChange({ columns })} />
        </Field>
        <Field label="Cỡ chữ">
          <Segmented label="Cỡ chữ" value={settings.textSize} options={(Object.keys(TEXT_SIZES) as KdsTextSize[]).map((k) => ({ value: k, label: TEXT_SIZES[k].label }))} onChange={(textSize) => onChange({ textSize })} />
        </Field>

        <Field label="Mốc màu cảnh báo" hint={`Đồng hồ chờ và viền thẻ đổi màu khi món chờ quá số phút. Tối đa ${MAX_THRESHOLDS} mốc.`}>
          <div className="space-y-2">
            {th.map((t, idx) => (
              <div key={`${idx}-${t.minutes}-${t.color}`} className="flex flex-wrap items-center gap-2">
                <span className="text-[var(--k-muted)]">Từ</span>
                <input
                  type="number"
                  min={1}
                  max={600}
                  defaultValue={t.minutes}
                  aria-label={`Mốc ${idx + 1}: số phút`}
                  onBlur={(e) => {
                    const v = Math.round(Number(e.target.value));
                    if (!Number.isFinite(v) || v < 1) { e.target.value = String(t.minutes); return; }
                    if (v !== t.minutes) setTh(th.map((x, j) => (j === idx ? { ...x, minutes: v } : x)));
                  }}
                  onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                  className="w-20 rounded-lg border border-[var(--k-line)] bg-[var(--k-surface)] px-2 py-1.5 font-mono"
                />
                <span className="text-[var(--k-muted)]">phút →</span>
                <div className="flex gap-1">
                  {(Object.keys(KDS_COLORS) as KdsColor[]).map((c) => (
                    <button
                      key={c}
                      type="button"
                      aria-label={KDS_COLORS[c].label}
                      title={KDS_COLORS[c].label}
                      aria-pressed={t.color === c}
                      onClick={() => setTh(th.map((x, j) => (j === idx ? { ...x, color: c } : x)))}
                      className={cn('h-7 w-7 rounded-full border-2', t.color === c ? 'border-[var(--k-text)]' : 'border-transparent')}
                      style={{ background: KDS_COLORS[c].bg }}
                    />
                  ))}
                </div>
                <button type="button" aria-label={`Xóa mốc ${idx + 1}`} onClick={() => setTh(th.filter((_, j) => j !== idx))} className="grid h-8 w-8 place-items-center rounded-lg text-[var(--k-muted)] hover:bg-[var(--k-danger-soft)] hover:text-[var(--k-danger)]"><Trash2 size={15} /></button>
              </div>
            ))}
            <div className="flex flex-wrap gap-2 pt-1">
              {th.length < MAX_THRESHOLDS ? <button type="button" onClick={addTh} className="inline-flex items-center gap-1 rounded-lg bg-[var(--k-fill)] px-3 py-1.5 font-semibold"><Plus size={15} />Thêm mốc</button> : null}
              <button type="button" onClick={() => setTh(DEFAULT_KDS_SETTINGS.thresholds)} className="rounded-lg px-3 py-1.5 text-[var(--k-muted)] hover:bg-[var(--k-fill)]">Khôi phục mặc định (10 / 20 / 30 phút)</button>
            </div>
          </div>
        </Field>

        <Field label="Danh mục màn này phụ trách" hint="Chỉ hiện và báo âm cho món thuộc các danh mục đã chọn (ví dụ quầy pha chế chỉ chọn Đồ uống). Không chọn = tất cả.">
          <div className="flex flex-wrap gap-1.5">
            {categories.map((c) => {
              const on = settings.stationCategories.includes(c.id);
              return (
                <button key={c.id} type="button" aria-pressed={on} onClick={() => toggleCat(c.id)} className={cn('inline-flex items-center gap-1 rounded-full border px-3 py-1.5 font-semibold', on ? 'border-transparent bg-[var(--k-brand-strong)] text-[var(--k-on-brand)]' : 'border-[var(--k-line)]')}>
                  {on ? <Check size={14} strokeWidth={3} /> : null}{c.name}
                </button>
              );
            })}
            {settings.stationCategories.length ? <button type="button" onClick={() => onChange({ stationCategories: [] })} className="rounded-full px-3 py-1.5 text-[var(--k-muted)] hover:bg-[var(--k-fill)]">Bỏ chọn (tất cả)</button> : null}
          </div>
        </Field>

        <Field label="Phím tắt (bàn phím rời)">
          <ul className="space-y-1.5 text-[13.5px]">
            {[
              ['1 … 9, 0', 'Chọn thẻ theo số ở góc thẻ (0 = thẻ thứ 10)'],
              ['← →', 'Chuyển sang thẻ trước / sau'],
              ['Space', 'Bắt đầu các món mới của thẻ đang chọn'],
              ['Enter', 'Xong các món đang làm của thẻ đang chọn (không có món đang làm thì xong cả bàn)'],
              ['Esc', 'Bỏ chọn thẻ / đóng bảng'],
            ].map(([k, d]) => (
              <li key={k} className="flex gap-3"><kbd className="min-w-[78px] rounded-md border border-[var(--k-line)] bg-[var(--k-surface-2)] px-2 py-0.5 text-center font-mono text-[12.5px]">{k}</kbd><span className="text-[var(--k-muted)]">{d}</span></li>
            ))}
          </ul>
          <p className="mt-2 inline-flex items-center gap-1.5 text-[12.5px] text-[var(--k-muted)]"><Keyboard size={14} />Chỉ dùng ở cách xem “Theo bàn”.</p>
        </Field>
      </div>
    </Panel>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div>
      <p className="mb-1 text-[14.5px] font-bold">{label}</p>
      {hint ? <p className="mb-2 text-[12.5px] text-[var(--k-muted)]">{hint}</p> : null}
      {children}
    </div>
  );
}

/** UC-BEP-05: món tạm hết trong ngày. */
function SoldOutPanel({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [keyword, setKeyword] = useState('');
  const list = useQuery({ queryKey: KEYS.dishes, queryFn: getSoldOutDishes });
  const toggle = useMutation({
    mutationFn: ({ id, soldOut }: { id: string; soldOut: boolean }) => setDishSoldOut(id, soldOut),
    onSuccess: (d) => {
      toast.success(d.soldOut ? `${d.name} đã tạm hết` : `${d.name} đã bán lại`);
      if (d.soldOut && d.pendingCount) toast.warning(`Còn ${d.pendingCount} phần ${d.name} đang chờ chế biến`);
      void qc.invalidateQueries({ queryKey: KEYS.dishes });
      void qc.invalidateQueries({ queryKey: KEYS.queue });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Không lưu được'),
  });
  const rows = (list.data ?? []).filter((d) => !keyword.trim() || d.name.toLowerCase().includes(keyword.trim().toLowerCase()));
  return (
    <Panel title="Món tạm hết hôm nay" onClose={onClose}>
      <div className="px-4 py-3">
        <label className="flex items-center gap-2 rounded-lg bg-[var(--k-fill)] px-3 py-2"><Search size={16} className="text-[var(--k-muted)]" /><input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="Tìm món…" className="flex-1 bg-transparent text-[15px] outline-none placeholder:text-[var(--k-muted)]" /></label>
        <p className="mt-2 text-[12.5px] text-[var(--k-muted)]">Món tạm hết không gọi được trên trang đặt món. Tự bán lại vào đầu ngày hôm sau.</p>
      </div>
      <div className="flex-1 overflow-y-auto px-2 pb-4">
        {rows.map((d) => (
          <div key={d.id} className="flex items-center gap-3 rounded-lg px-2 py-2.5 hover:bg-[var(--k-fill)]">
            <div className="min-w-0 flex-1">
              <p className={cn('text-[16px] font-semibold', d.soldOut && 'text-[var(--k-danger)]')}>{d.name}</p>
              <p className="text-[12.5px] text-[var(--k-muted)]">{d.categoryName}{d.soldOut && d.soldOutBy ? ` · ${d.soldOutBy} đánh dấu` : ''}{d.pendingCount ? ` · ${d.pendingCount} phần đang chờ` : ''}</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={!d.soldOut}
              aria-label={`${d.name}: ${d.soldOut ? 'Tạm hết' : 'Còn món'}`}
              onClick={() => toggle.mutate({ id: d.id, soldOut: !d.soldOut })}
              className={cn('rounded-full px-3 py-1.5 text-[13px] font-bold', d.soldOut ? 'bg-[var(--k-danger)] text-white' : 'bg-[var(--k-brand-soft)] text-[var(--k-brand)]')}
            >
              {d.soldOut ? 'Tạm hết' : 'Còn món'}
            </button>
          </div>
        ))}
      </div>
    </Panel>
  );
}

const STATUS_TEXT: Record<string, string> = { pending: 'Chờ', cooking: 'Đang làm', done: 'Đã xong', served: 'Đã mang ra', cancelled: 'Đã hủy' };

/** UC-BEP-02: chi tiết đơn của bàn (không hiện giá). */
function OrderPanel({ orderId, onClose }: { orderId: string; onClose: () => void }) {
  const q = useQuery({ queryKey: ['bep', 'order', orderId], queryFn: () => getKitchenOrder(orderId), refetchInterval: 10_000 });
  const o = q.data;
  return (
    <Panel title={o ? `Bàn ${o.tableCode} · ${o.code}` : 'Chi tiết đơn'} onClose={onClose}>
      <div className="flex-1 overflow-y-auto p-4">
        {!o ? <p className="text-[var(--k-muted)]">Đang tải…</p> : o.status !== 'open' ? <p className="text-[var(--k-muted)]">Đơn đã đóng</p> : (
          [...new Set(o.items.map((i) => i.batchNo))].map((b) => (
            <div key={b} className="mb-4">
              <p className="mb-1 text-[13px] font-semibold uppercase tracking-wider text-[var(--k-muted)]">Đợt {b}</p>
              {o.items.filter((i) => i.batchNo === b).map((i) => (
                <div key={i.id} className="flex items-start justify-between gap-3 border-b border-[var(--k-line)] py-2">
                  <div>
                    <p className={cn('text-[16px] font-semibold', i.status === 'cancelled' && 'text-[var(--k-muted)] line-through')}>{i.qty}× {i.name}</p>
                    {i.note ? <p className="mt-0.5 inline-block rounded bg-[var(--k-note-bg)] px-1.5 text-[13px] font-semibold text-[var(--k-note-text)]">{i.note}</p> : null}
                  </div>
                  <span className="shrink-0 text-[13px] text-[var(--k-muted)]">{STATUS_TEXT[i.status]}</span>
                </div>
              ))}
            </div>
          ))
        )}
      </div>
    </Panel>
  );
}

const REASONS: { key: KitchenCancelReason; label: string }[] = [
  { key: 'out_of_stock', label: 'Hết nguyên liệu' },
  { key: 'bad_quality', label: 'Nguyên liệu không đạt' },
  { key: 'other', label: 'Khác' },
];

/** UC-BEP-04: hủy món chưa chế biến kèm lý do; có thể đánh dấu món tạm hết. */
function CancelDialog({ item, onClose, onDone }: { item: KitchenItem; onClose: () => void; onDone: (q: KitchenQueue) => void }) {
  const [reason, setReason] = useState<KitchenCancelReason>('out_of_stock');
  const [note, setNote] = useState('');
  const [markSoldOut, setMarkSoldOut] = useState(true);
  const [error, setError] = useState('');
  const m = useMutation({
    mutationFn: () => kitchenCancelItem(item.id, reason, note, markSoldOut),
    onSuccess: (q) => {
      toast.success(`Đã hủy ${item.dishName} – ${item.tableCode}`);
      onDone(q);
      onClose();
    },
    onError: (e) => setError(e instanceof Error ? e.message : 'Không hủy được món'),
  });
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[var(--k-overlay)] p-4" role="dialog" aria-label="Hủy món">
      <div className="w-full max-w-[440px] rounded-2xl bg-[var(--k-surface)] p-5 shadow-2xl">
        <p className="text-[20px] font-bold">Hủy món?</p>
        <p className="mt-1 text-[15px] text-[var(--k-muted)]">{item.qty}× {item.dishName} – bàn {item.tableCode}. Thu ngân và khách sẽ được báo.</p>
        <div className="mt-4 space-y-2">
          {REASONS.map((r) => (
            <label key={r.key} className={cn('flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 text-[16px]', reason === r.key ? 'border-[var(--k-brand)] bg-[var(--k-brand-soft)]' : 'border-[var(--k-line)]')}>
              <input type="radio" name="reason" checked={reason === r.key} onChange={() => { setReason(r.key); setMarkSoldOut(r.key === 'out_of_stock'); setError(''); }} />
              {r.label}
            </label>
          ))}
          {reason === 'other' ? <input value={note} maxLength={200} onChange={(e) => { setNote(e.target.value); setError(''); }} placeholder="Nhập lý do" className="w-full rounded-lg border border-[var(--k-line)] bg-transparent px-3 py-2 text-[15px]" /> : null}
          <label className="flex items-center gap-2 pt-1 text-[15px]"><input type="checkbox" checked={markSoldOut} onChange={(e) => setMarkSoldOut(e.target.checked)} />Đánh dấu món tạm hết hôm nay</label>
          {error ? <p className="text-[14px] text-[var(--k-danger)]">{error}</p> : null}
        </div>
        <div className="mt-5 flex gap-2">
          <button type="button" onClick={onClose} className="flex-1 rounded-lg bg-[var(--k-fill-2)] py-3 text-[16px] font-semibold">Đóng</button>
          <button type="button" disabled={m.isPending} onClick={() => (reason === 'other' && !note.trim() ? setError('Vui lòng nhập lý do') : m.mutate())} className="flex-1 rounded-lg bg-[var(--k-danger)] py-3 text-[16px] font-bold text-white disabled:opacity-60">Hủy món</button>
        </div>
      </div>
    </div>
  );
}
