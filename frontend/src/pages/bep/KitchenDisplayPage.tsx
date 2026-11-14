import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Ban, Check, ChefHat, ChevronDown, ChevronUp, LogOut, Play, RotateCcw, Search, Volume2, Wifi, WifiOff, X } from 'lucide-react';
import {
  completeItems,
  getKitchenOrder,
  getKitchenQueue,
  getSoldOutDishes,
  KITCHEN_STREAM,
  kitchenCancelItem,
  setDishSoldOut,
  startItems,
  undoItem,
} from '@/api/ordering';
import { beep, unlockAudio, useLiveEvents } from '@/features/ordering/live';
import { useAuth, useLogout } from '@/lib/auth';
import { cn } from '@/lib/cn';
import type { KitchenCancelReason, KitchenItem, KitchenQueue } from '@/types';

type View = 'table' | 'dish';

const KEYS = { queue: ['bep', 'queue'] as const, dishes: ['bep', 'dishes'] as const };
const WARN_MIN = 15;
const LATE_MIN = 25;

const minutesSince = (iso: string, now: number) => Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60_000));
const clock = (d: Date) => d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

function useNow(intervalMs = 15_000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

/** Nhóm món theo bàn + đợt gọi (mỗi thẻ là một đợt của một bàn). */
function groupByTicket(items: KitchenItem[]) {
  const map = new Map<string, KitchenItem[]>();
  items.forEach((i) => {
    const key = `${i.orderId}-${i.batchNo}`;
    map.set(key, [...(map.get(key) ?? []), i]);
  });
  return [...map.entries()].map(([key, list]) => ({ key, items: list, first: list[0] }));
}

/**
 * Màn hình bếp (UC-BEP-01..05) — kiểu màn hình hiển thị trong bếp (KDS): toàn màn hình, nền tối, chữ to,
 * thẻ theo bàn / đợt gọi, đồng hồ chờ, âm báo món mới. Không dùng khung trang quản lý.
 */
export default function KitchenDisplayPage() {
  const qc = useQueryClient();
  const { data: user } = useAuth();
  const logout = useLogout();
  const now = useNow();
  const [started, setStarted] = useState(() => sessionStorage.getItem('rms-kds-started') === '1');
  const [view, setView] = useState<View>('table');
  const [category, setCategory] = useState('');
  const [soldOutOpen, setSoldOutOpen] = useState(false);
  const [recentOpen, setRecentOpen] = useState(false);
  const [detailOrder, setDetailOrder] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<KitchenItem | null>(null);
  const [flash, setFlash] = useState<Set<string>>(new Set());
  const seen = useRef<Set<string> | null>(null);

  const queue = useQuery({ queryKey: KEYS.queue, queryFn: getKitchenQueue, refetchInterval: 10_000 });
  const { connected } = useLiveEvents(KITCHEN_STREAM, [KEYS.queue, KEYS.dishes]);

  // Món mới (chưa thấy lần trước) → nhấp nháy vài giây + âm báo.
  useEffect(() => {
    const items = queue.data?.items;
    if (!items) return;
    const ids = new Set(items.map((i) => i.id));
    if (seen.current) {
      const fresh = items.filter((i) => i.status === 'pending' && !seen.current!.has(i.id)).map((i) => i.id);
      if (fresh.length) {
        beep(2);
        setFlash((prev) => new Set([...prev, ...fresh]));
        setTimeout(() => setFlash((prev) => new Set([...prev].filter((id) => !fresh.includes(id)))), 6000);
      }
    }
    seen.current = ids;
  }, [queue.data]);

  const setQueue = (q: KitchenQueue) => qc.setQueryData(KEYS.queue, q);
  const onError = (e: unknown) => {
    toast.error(e instanceof Error ? e.message : 'Thao tác không thành công');
    void qc.invalidateQueries({ queryKey: KEYS.queue });
  };
  const start = useMutation({ mutationFn: startItems, onSuccess: setQueue, onError });
  const complete = useMutation({ mutationFn: completeItems, onSuccess: setQueue, onError });
  const undo = useMutation({ mutationFn: undoItem, onSuccess: (q) => { setQueue(q); toast.success('Đã hoàn tác'); }, onError });

  const all = useMemo(() => queue.data?.items ?? [], [queue.data]);
  const categories = useMemo(() => [...new Map(all.map((i) => [i.categoryId, i.categoryName])).entries()], [all]);
  const items = all.filter((i) => !category || i.categoryId === category);
  const pending = groupByTicket(items.filter((i) => i.status === 'pending'));
  const cooking = groupByTicket(items.filter((i) => i.status === 'cooking'));

  const begin = () => {
    unlockAudio();
    beep(1);
    sessionStorage.setItem('rms-kds-started', '1');
    setStarted(true);
  };

  return (
    <div className="flex h-dvh flex-col bg-[#0d1210] text-[#e9efec] [color-scheme:dark]">
      {/* Thanh trên cùng */}
      <header className="flex flex-wrap items-center gap-3 border-b border-white/10 bg-[#121916] px-4 py-2.5">
        <div className="flex items-center gap-2">
          <ChefHat size={26} className="text-[#34d399]" />
          <span className="text-[20px] font-extrabold tracking-wide">BẾP</span>
          <span className="font-mono text-[20px] text-white/70">{clock(new Date(now))}</span>
        </div>
        <div className="flex items-center gap-2 text-[15px]">
          <Counter label="Chờ" value={queue.data?.pendingCount ?? 0} cls="bg-white/10" />
          <Counter label="Đang làm" value={queue.data?.cookingCount ?? 0} cls="bg-[#f59e0b]/20 text-[#fbbf24]" />
          <Counter label="Xong hôm nay" value={queue.data?.doneToday ?? 0} cls="bg-[#10b981]/15 text-[#34d399]" />
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <span className={cn('inline-flex items-center gap-1 text-[13px]', connected ? 'text-[#34d399]' : 'text-[#f87171]')} title={connected ? 'Đang nhận món trực tiếp' : 'Mất kết nối – đang thử lại'}>
            {connected ? <Wifi size={16} /> : <WifiOff size={16} />}{connected ? 'Trực tiếp' : 'Mất kết nối'}
          </span>
          <div className="inline-flex rounded-lg bg-white/10 p-0.5 text-[14px] font-semibold">
            <button type="button" onClick={() => setView('table')} className={cn('rounded-md px-3 py-1.5', view === 'table' && 'bg-white text-[#0d1210]')}>Theo bàn</button>
            <button type="button" onClick={() => setView('dish')} className={cn('rounded-md px-3 py-1.5', view === 'dish' && 'bg-white text-[#0d1210]')}>Theo món</button>
          </div>
          <select aria-label="Lọc danh mục" value={category} onChange={(e) => setCategory(e.target.value)} className="rounded-lg border border-white/15 bg-[#1a2420] px-3 py-1.5 text-[14px]">
            <option value="">Tất cả danh mục</option>
            {categories.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
          </select>
          <button type="button" onClick={() => setSoldOutOpen(true)} className="rounded-lg bg-white/10 px-3 py-1.5 text-[14px] font-semibold hover:bg-white/15">
            Món tạm hết{queue.data?.soldOutCount ? <span className="ml-1.5 rounded-full bg-[#f87171] px-1.5 text-[12px] text-white">{queue.data.soldOutCount}</span> : null}
          </button>
          <span className="hidden text-[13px] text-white/60 md:inline">{user?.fullName}</span>
          <button type="button" aria-label="Đăng xuất" title="Đăng xuất" onClick={() => logout.mutate()} className="grid h-9 w-9 place-items-center rounded-lg bg-white/10 hover:bg-white/15"><LogOut size={16} /></button>
        </div>
      </header>

      {/* Nội dung */}
      {queue.isError ? (
        <div className="grid flex-1 place-items-center text-[18px] text-white/70">
          <div className="text-center">Không tải được dữ liệu<br /><button type="button" onClick={() => void queue.refetch()} className="mt-3 rounded-lg bg-white/10 px-4 py-2 text-[15px]">Tải lại</button></div>
        </div>
      ) : !queue.data ? (
        <div className="grid flex-1 place-items-center text-white/50">Đang tải…</div>
      ) : items.length === 0 ? (
        <div className="grid flex-1 place-items-center">
          <div className="text-center text-white/50"><ChefHat size={64} strokeWidth={1.2} className="mx-auto" /><p className="mt-3 text-[22px] font-semibold">Chưa có món cần chế biến</p></div>
        </div>
      ) : view === 'table' ? (
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-0 lg:grid-cols-2">
          <Column title="Chờ chế biến" count={pending.reduce((s, t) => s + t.items.length, 0)}>
            {pending.map((t) => (
              <Ticket key={t.key} ticket={t} now={now} flash={flash} onTable={() => setDetailOrder(t.first.orderId)}
                primary={{ label: 'BẮT ĐẦU', icon: <Play size={18} fill="currentColor" />, onClick: () => start.mutate(t.items.map((i) => i.id)), busy: start.isPending }}
                onItemDone={(i) => complete.mutate([i.id])} onItemCancel={setCancelTarget} />
            ))}
          </Column>
          <Column title="Đang chế biến" count={cooking.reduce((s, t) => s + t.items.length, 0)} accent>
            {cooking.map((t) => (
              <Ticket key={t.key} ticket={t} now={now} flash={flash} onTable={() => setDetailOrder(t.first.orderId)}
                primary={{ label: 'HOÀN THÀNH', icon: <Check size={20} strokeWidth={3} />, onClick: () => complete.mutate(t.items.map((i) => i.id)), busy: complete.isPending, done: true }}
                onItemDone={(i) => complete.mutate([i.id])} />
            ))}
          </Column>
        </div>
      ) : (
        <DishView items={items} now={now} onStart={(ids) => start.mutate(ids)} onComplete={(ids) => complete.mutate(ids)} />
      )}

      {/* Vừa hoàn thành (hoàn tác bấm nhầm) */}
      <div className="border-t border-white/10 bg-[#121916]">
        <button type="button" onClick={() => setRecentOpen((v) => !v)} className="flex w-full items-center gap-2 px-4 py-2 text-[14px] text-white/70">
          {recentOpen ? <ChevronDown size={16} /> : <ChevronUp size={16} />} Vừa hoàn thành (30 phút) · {queue.data?.recent.length ?? 0}
        </button>
        {recentOpen ? (
          <div className="no-scrollbar flex gap-2 overflow-x-auto px-4 pb-3">
            {(queue.data?.recent ?? []).map((i) => (
              <div key={i.id} className="flex shrink-0 items-center gap-3 rounded-lg bg-white/5 px-3 py-2 text-[14px]">
                <span><b>{i.tableCode}</b> · {i.qty}× {i.dishName}</span>
                <button type="button" onClick={() => undo.mutate(i.id)} className="inline-flex items-center gap-1 rounded-md bg-white/10 px-2 py-1 text-[12.5px]"><RotateCcw size={13} />Hoàn tác</button>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      {!started ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-[#0d1210]/95">
          <div className="text-center">
            <ChefHat size={72} className="mx-auto text-[#34d399]" strokeWidth={1.3} />
            <p className="mt-4 text-[26px] font-extrabold">Màn hình bếp</p>
            <p className="mt-1 text-[15px] text-white/60">Bấm để bắt đầu ca và bật âm báo khi có món mới.</p>
            <button type="button" onClick={begin} className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[#10b981] px-8 py-4 text-[20px] font-bold text-[#06231a]"><Volume2 size={22} />Bắt đầu ca</button>
          </div>
        </div>
      ) : null}

      {soldOutOpen ? <SoldOutPanel onClose={() => setSoldOutOpen(false)} /> : null}
      {detailOrder ? <OrderPanel orderId={detailOrder} onClose={() => setDetailOrder(null)} /> : null}
      {cancelTarget ? <CancelDialog item={cancelTarget} onClose={() => setCancelTarget(null)} onDone={setQueue} /> : null}
    </div>
  );
}

function Counter({ label, value, cls }: { label: string; value: number; cls: string }) {
  return <span className={cn('rounded-lg px-2.5 py-1 font-semibold', cls)}>{label} <b className="font-mono text-[17px]">{value}</b></span>;
}

function Column({ title, count, accent, children }: { title: string; count: number; accent?: boolean; children: React.ReactNode }) {
  return (
    <section className="flex min-h-0 flex-col border-white/10 lg:border-r last:border-r-0">
      <div className={cn('flex items-center justify-between px-4 py-2 text-[15px] font-bold uppercase tracking-wider', accent ? 'text-[#fbbf24]' : 'text-white/70')}>
        <span>{title}</span><span className="font-mono">{count}</span>
      </div>
      <div className="grid flex-1 auto-rows-min grid-cols-1 gap-3 overflow-y-auto px-4 pb-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}

interface TicketProps {
  ticket: { key: string; items: KitchenItem[]; first: KitchenItem };
  now: number;
  flash: Set<string>;
  onTable: () => void;
  primary: { label: string; icon: React.ReactNode; onClick: () => void; busy: boolean; done?: boolean };
  onItemDone: (i: KitchenItem) => void;
  onItemCancel?: (i: KitchenItem) => void;
}

/** Thẻ món của một đợt gọi: đồng hồ chờ, viền đổi màu theo thời gian, nút lớn. */
function Ticket({ ticket, now, flash, onTable, primary, onItemDone, onItemCancel }: TicketProps) {
  const mins = minutesSince(ticket.first.createdAt, now);
  const tone = mins >= LATE_MIN ? 'border-[#ef4444] shadow-[0_0_0_1px_#ef4444]' : mins >= WARN_MIN ? 'border-[#f59e0b]' : 'border-white/10';
  const isFlash = ticket.items.some((i) => flash.has(i.id));
  return (
    <article className={cn('flex flex-col rounded-xl border-2 bg-[#18211d]', tone, isFlash && 'animate-pulse ring-4 ring-[#34d399]/60')}>
      <header className="flex items-start justify-between gap-2 border-b border-white/10 px-3 py-2">
        <button type="button" onClick={onTable} className="text-left">
          <p className="text-[24px] font-extrabold leading-none">{ticket.first.tableCode}</p>
          <p className="mt-0.5 text-[12.5px] text-white/55">{ticket.first.areaName} · Đợt {ticket.first.batchNo}</p>
        </button>
        <span className={cn('rounded-md px-2 py-1 font-mono text-[18px] font-bold', mins >= LATE_MIN ? 'bg-[#ef4444] text-white' : mins >= WARN_MIN ? 'bg-[#f59e0b] text-[#1a1305]' : 'bg-white/10')}>{mins}′</span>
      </header>
      <ul className="flex-1 divide-y divide-white/5">
        {ticket.items.map((i) => (
          <li key={i.id} className="flex items-start gap-2 px-3 py-2">
            <span className="min-w-[34px] font-mono text-[22px] font-extrabold text-[#34d399]">{i.qty}×</span>
            <div className="min-w-0 flex-1">
              <p className="text-[18px] font-semibold leading-snug">{i.dishName}</p>
              {i.note ? <p className="mt-0.5 inline-block rounded bg-[#fde047] px-1.5 text-[14px] font-bold text-[#1a1700]">{i.note}</p> : null}
            </div>
            <div className="flex shrink-0 gap-1">
              <button type="button" aria-label={`Hoàn thành ${i.dishName}`} title="Hoàn thành món này" onClick={() => onItemDone(i)} className="grid h-9 w-9 place-items-center rounded-lg bg-white/10 hover:bg-[#10b981]/40"><Check size={18} /></button>
              {onItemCancel ? <button type="button" aria-label={`Hủy ${i.dishName}`} title="Hủy món (hết nguyên liệu…)" onClick={() => onItemCancel(i)} className="grid h-9 w-9 place-items-center rounded-lg bg-white/10 hover:bg-[#ef4444]/40"><Ban size={16} /></button> : null}
            </div>
          </li>
        ))}
      </ul>
      <button type="button" disabled={primary.busy} onClick={primary.onClick} className={cn('m-2 inline-flex items-center justify-center gap-2 rounded-lg py-3 text-[18px] font-extrabold tracking-wide disabled:opacity-60', primary.done ? 'bg-[#10b981] text-[#06231a]' : 'bg-[#f59e0b] text-[#1a1305]')}>
        {primary.icon}{primary.label}
      </button>
    </article>
  );
}

/** Cách xem "Theo món": gộp cùng món ở mọi bàn (để nấu một lần cho nhiều bàn). */
function DishView({ items, now, onStart, onComplete }: { items: KitchenItem[]; now: number; onStart: (ids: string[]) => void; onComplete: (ids: string[]) => void }) {
  const groups = [...items.reduce((m, i) => m.set(i.dishId, [...(m.get(i.dishId) ?? []), i]), new Map<string, KitchenItem[]>()).values()]
    .sort((a, b) => a[0].createdAt.localeCompare(b[0].createdAt));
  return (
    <div className="grid flex-1 auto-rows-min grid-cols-1 gap-3 overflow-y-auto p-4 sm:grid-cols-2 xl:grid-cols-3">
      {groups.map((g) => {
        const p = g.filter((i) => i.status === 'pending');
        const c = g.filter((i) => i.status === 'cooking');
        const oldest = minutesSince(g[0].createdAt, now);
        return (
          <article key={g[0].dishId} className="rounded-xl border-2 border-white/10 bg-[#18211d] p-3">
            <div className="flex items-start justify-between gap-2">
              <p className="text-[20px] font-bold leading-snug">{g[0].dishName}</p>
              <span className="font-mono text-[26px] font-extrabold text-[#34d399]">×{g.reduce((s, i) => s + i.qty, 0)}</span>
            </div>
            <p className="text-[13px] text-white/55">Chờ lâu nhất {oldest}′</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {g.map((i) => (
                <span key={i.id} className={cn('rounded-md px-2 py-1 text-[14px]', i.status === 'cooking' ? 'bg-[#f59e0b]/25 text-[#fbbf24]' : 'bg-white/10')}>
                  {i.tableCode} ×{i.qty}{i.note ? <b className="ml-1 text-[#fde047]">“{i.note}”</b> : null}
                </span>
              ))}
            </div>
            <div className="mt-3 flex gap-2">
              {p.length ? <button type="button" onClick={() => onStart(p.map((i) => i.id))} className="flex-1 rounded-lg bg-[#f59e0b] py-2.5 text-[16px] font-bold text-[#1a1305]">Bắt đầu ({p.length})</button> : null}
              {c.length ? <button type="button" onClick={() => onComplete(c.map((i) => i.id))} className="flex-1 rounded-lg bg-[#10b981] py-2.5 text-[16px] font-bold text-[#06231a]">Hoàn thành ({c.length})</button> : null}
            </div>
          </article>
        );
      })}
    </div>
  );
}

function Panel({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-40 flex justify-end" role="dialog" aria-label={title}>
      <button type="button" aria-label="Đóng" className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative flex h-full w-full max-w-[460px] flex-col bg-[#121916] shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <p className="text-[18px] font-bold">{title}</p>
          <button type="button" aria-label="Đóng" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-lg bg-white/10"><X size={18} /></button>
        </div>
        {children}
      </div>
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
        <label className="flex items-center gap-2 rounded-lg bg-white/10 px-3 py-2"><Search size={16} className="text-white/50" /><input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="Tìm món…" className="flex-1 bg-transparent text-[15px] outline-none" /></label>
        <p className="mt-2 text-[12.5px] text-white/50">Món tạm hết không gọi được trên trang đặt món. Tự bán lại vào đầu ngày hôm sau.</p>
      </div>
      <div className="flex-1 overflow-y-auto px-2 pb-4">
        {rows.map((d) => (
          <div key={d.id} className="flex items-center gap-3 rounded-lg px-2 py-2.5 hover:bg-white/5">
            <div className="min-w-0 flex-1">
              <p className={cn('text-[16px] font-semibold', d.soldOut && 'text-[#f87171]')}>{d.name}</p>
              <p className="text-[12.5px] text-white/50">{d.categoryName}{d.soldOut && d.soldOutBy ? ` · ${d.soldOutBy} đánh dấu` : ''}{d.pendingCount ? ` · ${d.pendingCount} phần đang chờ` : ''}</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={!d.soldOut}
              aria-label={`${d.name}: ${d.soldOut ? 'Tạm hết' : 'Còn món'}`}
              onClick={() => toggle.mutate({ id: d.id, soldOut: !d.soldOut })}
              className={cn('rounded-full px-3 py-1.5 text-[13px] font-bold', d.soldOut ? 'bg-[#ef4444] text-white' : 'bg-[#10b981]/20 text-[#34d399]')}
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
        {!o ? <p className="text-white/50">Đang tải…</p> : o.status !== 'open' ? <p className="text-white/70">Đơn đã đóng</p> : (
          [...new Set(o.items.map((i) => i.batchNo))].map((b) => (
            <div key={b} className="mb-4">
              <p className="mb-1 text-[13px] font-semibold uppercase tracking-wider text-white/50">Đợt {b}</p>
              {o.items.filter((i) => i.batchNo === b).map((i) => (
                <div key={i.id} className="flex items-start justify-between gap-3 border-b border-white/5 py-2">
                  <div>
                    <p className={cn('text-[16px] font-semibold', i.status === 'cancelled' && 'text-white/40 line-through')}>{i.qty}× {i.name}</p>
                    {i.note ? <p className="text-[13px] text-[#fde047]">{i.note}</p> : null}
                  </div>
                  <span className="shrink-0 text-[13px] text-white/60">{STATUS_TEXT[i.status]}</span>
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
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4" role="dialog" aria-label="Hủy món">
      <div className="w-full max-w-[440px] rounded-2xl bg-[#18211d] p-5">
        <p className="text-[20px] font-bold">Hủy món?</p>
        <p className="mt-1 text-[15px] text-white/70">{item.qty}× {item.dishName} – bàn {item.tableCode}. Thu ngân và khách sẽ được báo.</p>
        <div className="mt-4 space-y-2">
          {REASONS.map((r) => (
            <label key={r.key} className={cn('flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 text-[16px]', reason === r.key ? 'border-[#34d399] bg-[#10b981]/10' : 'border-white/10')}>
              <input type="radio" name="reason" checked={reason === r.key} onChange={() => { setReason(r.key); setMarkSoldOut(r.key === 'out_of_stock'); setError(''); }} />
              {r.label}
            </label>
          ))}
          {reason === 'other' ? <input value={note} maxLength={200} onChange={(e) => { setNote(e.target.value); setError(''); }} placeholder="Nhập lý do" className="w-full rounded-lg border border-white/15 bg-transparent px-3 py-2 text-[15px]" /> : null}
          <label className="flex items-center gap-2 pt-1 text-[15px]"><input type="checkbox" checked={markSoldOut} onChange={(e) => setMarkSoldOut(e.target.checked)} />Đánh dấu món tạm hết hôm nay</label>
          {error ? <p className="text-[14px] text-[#f87171]">{error}</p> : null}
        </div>
        <div className="mt-5 flex gap-2">
          <button type="button" onClick={onClose} className="flex-1 rounded-lg bg-white/10 py-3 text-[16px] font-semibold">Đóng</button>
          <button type="button" disabled={m.isPending} onClick={() => (reason === 'other' && !note.trim() ? setError('Vui lòng nhập lý do') : m.mutate())} className="flex-1 rounded-lg bg-[#ef4444] py-3 text-[16px] font-bold text-white disabled:opacity-60">Hủy món</button>
        </div>
      </div>
    </div>
  );
}

