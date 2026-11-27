import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, Flame, Minus, Plus, Search, Send, ShoppingBag, UtensilsCrossed, X } from 'lucide-react';
import { Button } from '@/components/common/Button';
import { BlockError, EmptyState } from '@/components/common/EmptyState';
import { Skeleton } from '@/components/common/Skeleton';
import { getWaiterFloor, getWaiterMenu, waiterSendItems, WAITER_KEYS } from '@/api/waiter';
import type { SendLine } from '@/api/ordering';
import { WaiterShell } from '@/features/waiter/WaiterShell';
import { SetDetailScreen } from '@/features/ordering/QrMenuExtras';
import '@/features/ordering/qr-theme.css';
import { formatCurrency } from '@/lib/format';
import { matchesKeyword } from '@/lib/normalize';
import { cn } from '@/lib/cn';
import type { CartSetPart, MenuDish, MenuSet } from '@/types';
import { useWaiterLock } from '@/features/waiter/lock';

const SETS = '__sets';

/** Một dòng giỏ: món lẻ hoặc set (kèm các món con đã chọn loại / độ chín). */
type Line = { key: string; dishId?: string; setId?: string; name: string; image: string | null; price: number; qty: number; note: string; parts?: CartSetPart[] };

/**
 * Thực đơn cho Nhân viên phục vụ (D15 — giao diện kiểu Square: khối bo tròn, ảnh món tròn, nút lớn cuối màn).
 *  - /phuc-vu/thuc-don          : tra cứu (thành phần, dị nguyên, độ cay, món đã hết) để tư vấn khách.
 *  - /phuc-vu/goi-mon/:tableId  : gọi món hộ khách — lưới món có nút +, set mở màn chi tiết như trang QR (chọn độ chín,
 *    loại nước), giỏ dạng danh sách (ảnh, giá, ghi chú, − / +), nút lớn "Gửi bếp · tổng tiền".
 */
export default function WaiterMenuPage() {
  const { tableId } = useParams();
  const ordering = Boolean(tableId);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const menu = useQuery({ queryKey: WAITER_KEYS.menu, queryFn: getWaiterMenu, staleTime: 60_000 });
  const floor = useQuery({ queryKey: WAITER_KEYS.floor, queryFn: getWaiterFloor, enabled: ordering });
  const table = floor.data?.floor.tables.find((t) => t.id === tableId);
  const [cat, setCat] = useState<string>('');
  const [keyword, setKeyword] = useState('');
  const [detail, setDetail] = useState<MenuDish | null>(null);
  const [openSet, setOpenSet] = useState<MenuSet | null>(null);
  const [cart, setCart] = useState<Line[]>([]);
  const [cartOpen, setCartOpen] = useState(false);

  const m = menu.data;
  const catId = cat || m?.categories[0]?.id || '';
  const dishes = useMemo(() => {
    if (!m) return [];
    const kw = keyword.trim();
    return m.dishes.filter((d) => (kw ? matchesKeyword(`${d.name} ${d.variantLabel ?? ''} ${d.ingredients}`, kw) : d.categoryId === catId));
  }, [m, catId, keyword]);
  const sets = !keyword.trim() && catId === SETS ? m?.sets ?? [] : [];
  const byId = useMemo(() => new Map((m?.dishes ?? []).map((d) => [d.id, d])), [m]);
  const catName = (dishId: string) => { const d = byId.get(dishId); return d ? m?.categories.find((c) => c.id === d.categoryId)?.name : undefined; };
  const groupName = (d: MenuDish) => (d.groupId ? m?.groups.find((g) => g.id === d.groupId)?.name : null);
  const dishTitle = (d: MenuDish) => (d.variantLabel ? `${groupName(d) ?? d.name} – ${d.variantLabel}` : d.name);

  const qtyOf = (key: string) => cart.find((l) => l.key === key)?.qty ?? 0;
  const setQty = (key: string, qty: number) => setCart((c) => (qty <= 0 ? c.filter((l) => l.key !== key) : c.map((l) => (l.key === key ? { ...l, qty: Math.min(50, qty) } : l))));
  const addDish = (d: MenuDish, delta: number) => {
    const key = `d${d.id}`;
    const cur = qtyOf(key);
    if (cur) setQty(key, cur + delta);
    else if (delta > 0) setCart((c) => [...c, { key, dishId: d.id, name: dishTitle(d), image: d.image, price: d.price, qty: delta, note: '' }]);
  };
  const addSet = (s: MenuSet, parts: CartSetPart[], qty: number) => {
    const key = `s${s.id}|${parts.map((p) => `${p.dishId}:${p.qty}:${p.note}`).join(',')}`;
    const cur = qtyOf(key);
    if (cur) setQty(key, cur + qty);
    else setCart((c) => [...c, { key, setId: s.id, name: s.name, image: s.image, price: s.price, qty, note: '', parts }]);
  };
  const setCount = (s: MenuSet) => cart.filter((l) => l.setId === s.id).reduce((a, l) => a + l.qty, 0);
  const total = cart.reduce((s, l) => s + l.price * l.qty, 0);
  const count = cart.reduce((s, l) => s + l.qty, 0);

  const { guard } = useWaiterLock();
  const send = useMutation({
    mutationFn: guard(() => waiterSendItems(tableId!, cart.map<SendLine>((l) => (l.setId
      ? { setId: l.setId, qty: l.qty, parts: l.parts?.map((p) => ({ dishId: p.dishId, qty: p.qty, note: p.note })) }
      : { dishId: l.dishId, qty: l.qty, note: l.note })))),
    onSuccess: () => {
      toast.success(`Đã gửi ${count} món của bàn ${table?.code ?? ''} cho bếp`);
      setCart([]);
      void qc.invalidateQueries({ queryKey: WAITER_KEYS.all });
      navigate('/phuc-vu');
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Không gửi được món'),
  });

  return (
    <WaiterShell title={ordering ? `GỌI MÓN – BÀN ${table?.code ?? ''}` : 'THỰC ĐƠN'} fill>
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="space-y-2.5 border-b border-[var(--border)] bg-[var(--bg-surface)] p-3">
          <div className="flex items-center gap-2">
            {ordering ? (
              <button type="button" aria-label="Quay lại sơ đồ" onClick={() => navigate('/phuc-vu')} className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[var(--bg-subtle)]"><ArrowLeft size={19} /></button>
            ) : null}
            <label className="flex h-11 flex-1 items-center gap-2 rounded-full bg-[var(--bg-subtle)] px-4">
              <Search size={17} className="text-[var(--text-muted)]" />
              <input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="Tìm món, thành phần…" className="min-w-0 flex-1 bg-transparent text-[14px] outline-none" />
              {keyword ? <button type="button" aria-label="Xóa tìm kiếm" onClick={() => setKeyword('')}><X size={15} /></button> : null}
            </label>
          </div>
          {!keyword.trim() && m ? (
            <div className="no-scrollbar flex gap-1.5 overflow-x-auto" role="tablist" aria-label="Danh mục">
              {[...m.categories.map((c) => ({ id: c.id, name: c.name })), ...(m.sets.length ? [{ id: SETS, name: 'Set menu' }] : [])].map((c) => (
                <button key={c.id} type="button" role="tab" aria-selected={c.id === catId} onClick={() => setCat(c.id)} className={cn('h-9 shrink-0 rounded-full px-4 text-[13.5px] font-semibold', c.id === catId ? 'bg-[var(--accent)] text-white' : 'bg-[var(--bg-subtle)] text-[var(--text-secondary)]')}>{c.name}</button>
              ))}
            </div>
          ) : null}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto bg-[var(--bg-page)] p-3">
          {menu.isError ? (
            <BlockError onRetry={() => void menu.refetch()} retrying={menu.isFetching} />
          ) : !m ? (
            <div className="grid grid-cols-2 gap-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-48 rounded-[20px]" />)}</div>
          ) : sets.length ? (
            <div className="mx-auto grid max-w-3xl grid-cols-2 gap-3 sm:grid-cols-3">
              {sets.map((s) => (
                <MenuCard
                  key={s.id}
                  name={s.name}
                  image={s.image}
                  price={s.price}
                  sub={`${s.items.length} món · gọi lẻ ${formatCurrency(s.originalPrice)}`}
                  onOpen={() => setOpenSet(s)}
                  action={ordering ? <RoundAdd count={setCount(s)} label={`Chọn ${s.name}`} onClick={() => setOpenSet(s)} /> : null}
                />
              ))}
            </div>
          ) : dishes.length === 0 ? (
            <EmptyState icon={UtensilsCrossed} title="Không có món phù hợp" />
          ) : (
            <div className="mx-auto grid max-w-3xl grid-cols-2 gap-3 sm:grid-cols-3">
              {dishes.map((d) => (
                <MenuCard
                  key={d.id}
                  name={dishTitle(d)}
                  image={d.image}
                  price={d.price}
                  soldOut={d.soldOut}
                  spicy={d.spicyLevel}
                  stacked={ordering && qtyOf(`d${d.id}`) > 0}
                  onOpen={() => setDetail(d)}
                  action={ordering ? (
                    qtyOf(`d${d.id}`) ? (
                      <Stepper value={qtyOf(`d${d.id}`)} onMinus={() => addDish(d, -1)} onPlus={() => addDish(d, 1)} />
                    ) : (
                      <RoundAdd count={0} label={`Thêm ${dishTitle(d)}`} disabled={d.soldOut} onClick={() => addDish(d, 1)} />
                    )
                  ) : null}
                />
              ))}
            </div>
          )}
        </div>

        {ordering && count ? (
          <div className="border-t border-[var(--border)] bg-[var(--bg-surface)] p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <button type="button" onClick={() => setCartOpen(true)} className="flex h-14 w-full items-center gap-3 rounded-full bg-[var(--accent)] px-5 text-white shadow-lg active:scale-[0.99]">
              <ShoppingBag size={19} />
              <span className="flex-1 text-left text-[16px] font-bold">Xem giỏ · {count} món</span>
              <span className="font-mono text-[16px] font-bold">{formatCurrency(total)}</span>
            </button>
          </div>
        ) : null}
      </div>

      {detail ? (
        <Sheet onClose={() => setDetail(null)} title={dishTitle(detail)}>
          {detail.image ? <img src={detail.image} alt="" className="mx-auto mb-3 aspect-square w-44 rounded-full object-cover shadow-md" /> : null}
          <p className="text-center font-mono text-[18px] font-bold text-[var(--accent)]">{formatCurrency(detail.price)}{detail.soldOut ? <span className="ml-2 text-[13px] text-[var(--danger)]">· Hết món hôm nay</span> : null}</p>
          {detail.description ? <p className="mt-2 text-[14px] text-[var(--text-secondary)]">{detail.description}</p> : null}
          <dl className="mt-3 space-y-2 rounded-[16px] bg-[var(--bg-subtle)] p-3 text-[13.5px]">
            <div><dt className="font-semibold">Thành phần</dt><dd className="text-[var(--text-secondary)]">{detail.ingredients || 'Chưa cập nhật'}</dd></div>
            <div><dt className="font-semibold">Dị nguyên</dt><dd className={detail.allergens.length ? 'font-semibold text-[var(--warning)]' : 'text-[var(--text-secondary)]'}>{detail.allergens.length ? detail.allergens.join(', ') : 'Không có'}</dd></div>
            <div><dt className="font-semibold">Độ cay</dt><dd className="text-[var(--text-secondary)]">{['Không cay', 'Cay nhẹ', 'Cay vừa', 'Rất cay'][detail.spicyLevel] ?? '—'}</dd></div>
          </dl>
          {ordering && !detail.soldOut ? (
            <Button className="mt-4 h-12 w-full rounded-full text-[15px]" leadingIcon={<Plus size={17} />} onClick={() => { addDish(detail, 1); setDetail(null); }}>Thêm vào giỏ · {formatCurrency(detail.price)}</Button>
          ) : null}
        </Sheet>
      ) : null}

      {openSet ? (
        ordering ? (
          <div className="qr-theme" data-qr-mode="light">
            <SetDetailScreen
              key={openSet.id}
              set={openSet}
              dishById={byId}
              categoryOf={catName}
              onBack={() => setOpenSet(null)}
              onAdd={(s, parts, q) => { addSet(s, parts, q); setOpenSet(null); toast.success(`Đã thêm ${s.name}`); }}
            />
          </div>
        ) : (
          <Sheet onClose={() => setOpenSet(null)} title={openSet.name}>
            {openSet.image ? <img src={openSet.image} alt="" className="mb-3 aspect-[16/10] w-full rounded-[16px] object-cover" /> : null}
            <p className="font-mono text-[18px] font-bold text-[var(--accent)]">{formatCurrency(openSet.price)} <span className="text-[13px] font-normal text-[var(--text-muted)] line-through">{formatCurrency(openSet.originalPrice)}</span></p>
            {openSet.description ? <p className="mt-2 text-[14px] text-[var(--text-secondary)]">{openSet.description}</p> : null}
            <ul className="mt-3 space-y-1 rounded-[16px] bg-[var(--bg-subtle)] p-3 text-[14px]">
              {openSet.items.map((i) => <li key={i.dishId}><b className="font-mono">{i.qty}×</b> {i.name}{i.allowVariant ? <span className="text-[12.5px] text-[var(--text-muted)]"> · đổi loại được</span> : null}</li>)}
            </ul>
          </Sheet>
        )
      ) : null}

      {cartOpen ? (
        <Sheet onClose={() => setCartOpen(false)} title={`Giỏ món – bàn ${table?.code ?? ''}`}>
          {cart.length === 0 ? <p className="text-[13.5px] text-[var(--text-muted)]">Giỏ trống.</p> : (
            <ul className="space-y-2.5">
              {cart.map((l) => (
                <li key={l.key} className="flex gap-3 rounded-[20px] bg-[var(--bg-subtle)] p-3">
                  <Thumb image={l.image} size={64} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[14.5px] font-semibold leading-snug">{l.name}</p>
                    <p className="font-mono text-[15px] font-bold">{formatCurrency(l.price * l.qty)}</p>
                    {l.parts ? (
                      <p className="mt-0.5 text-[12px] text-[var(--text-muted)]">{l.parts.map((p) => `${p.qty}× ${p.name}${p.note ? ` (${p.note})` : ''}`).join(' · ')}</p>
                    ) : (
                      <input
                        value={l.note}
                        maxLength={200}
                        aria-label={`Ghi chú ${l.name}`}
                        onChange={(e) => setCart((c) => c.map((x) => (x.key === l.key ? { ...x, note: e.target.value } : x)))}
                        placeholder="Thêm ghi chú (ít cay, không hành…)"
                        className="mt-1 h-8 w-full rounded-full bg-[var(--bg-surface)] px-3 text-[12.5px] outline-none placeholder:text-[var(--text-muted)]"
                      />
                    )}
                  </div>
                  <div className="self-center"><Stepper value={l.qty} onMinus={() => setQty(l.key, l.qty - 1)} onPlus={() => setQty(l.key, l.qty + 1)} /></div>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-4 flex items-center justify-between border-t border-dashed border-[var(--border)] pt-3 text-[17px] font-bold"><span>Tổng</span><span className="font-mono">{formatCurrency(total)}</span></div>
          <button
            type="button"
            disabled={!cart.length || send.isPending}
            onClick={() => send.mutate()}
            className="mt-3 flex h-14 w-full items-center gap-3 rounded-full bg-[var(--accent)] px-5 text-white shadow-lg disabled:opacity-60"
          >
            <Send size={18} />
            <span className="flex-1 text-left text-[16px] font-bold">{send.isPending ? 'Đang gửi…' : 'Gửi bếp'}</span>
            <span className="font-mono text-[16px] font-bold">{formatCurrency(total)}</span>
          </button>
        </Sheet>
      ) : null}
    </WaiterShell>
  );
}

function Thumb({ image, size }: { image: string | null; size: number }) {
  return image ? (
    <img src={image} alt="" loading="lazy" className="shrink-0 rounded-full object-cover shadow-sm" style={{ width: size, height: size }} />
  ) : (
    <span className="grid shrink-0 place-items-center rounded-full bg-[var(--bg-surface)]" style={{ width: size, height: size }}><UtensilsCrossed size={size / 3} className="text-[var(--text-muted)]" /></span>
  );
}

/** Thẻ món / set trên lưới: ảnh tròn, tên, giá, nút + / bộ đếm ở góc dưới. */
function MenuCard({ name, image, price, sub, soldOut, spicy = 0, onOpen, action, stacked }: {
  name: string; image: string | null; price: number; sub?: string; soldOut?: boolean; spicy?: number; onOpen: () => void; action: React.ReactNode;
  /** Bộ đếm − n + (rộng) xuống dòng riêng dưới giá, để giá không bị bẻ dòng trên thẻ hẹp. */
  stacked?: boolean;
}) {
  return (
    <div className={cn('flex flex-col rounded-[22px] bg-[var(--bg-surface)] p-3 shadow-sm', soldOut && 'opacity-60')}>
      <button type="button" onClick={onOpen} className="flex flex-1 flex-col items-center text-center" aria-label={`Xem ${name}`}>
        <Thumb image={image} size={96} />
        <span className="mt-2 line-clamp-2 text-[14px] font-semibold leading-snug">{name}</span>
        {sub ? <span className="mt-0.5 text-[11.5px] text-[var(--text-muted)]">{sub}</span> : null}
        <span className="mt-1 flex items-center gap-1.5">
          {soldOut ? <span className="rounded-full bg-[var(--danger-soft)] px-2 text-[11px] font-bold text-[var(--danger)]">Hết món</span> : null}
          {spicy > 0 ? <span className="inline-flex text-[#dc2626]">{Array.from({ length: spicy }, (_, i) => <Flame key={i} size={12} />)}</span> : null}
        </span>
      </button>
      {stacked ? (
        <>
          <span className="mt-2 whitespace-nowrap text-center font-mono text-[15px] font-bold">{formatCurrency(price)}</span>
          <div className="mt-2">{action}</div>
        </>
      ) : (
        <div className="mt-2 flex items-center justify-between gap-2">
          <span className="whitespace-nowrap font-mono text-[15px] font-bold">{formatCurrency(price)}</span>
          {action}
        </div>
      )}
    </div>
  );
}

function RoundAdd({ count, label, disabled, onClick }: { count: number; label: string; disabled?: boolean; onClick: () => void }) {
  return (
    <button type="button" aria-label={label} disabled={disabled} onClick={onClick} className="relative grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[var(--accent)] text-white shadow-md active:scale-95 disabled:bg-[var(--bg-subtle)] disabled:text-[var(--text-muted)] disabled:shadow-none">
      <Plus size={19} />
      {count ? <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-[var(--text-primary)] px-1 font-mono text-[11px] font-bold text-white">{count}</span> : null}
    </button>
  );
}

function Stepper({ value, onMinus, onPlus }: { value: number; onMinus: () => void; onPlus: () => void }) {
  return (
    <div className="flex items-center justify-between gap-1 rounded-full bg-[var(--accent)] p-1 text-white">
      <button type="button" aria-label="Bớt" onClick={onMinus} className="grid h-8 w-8 place-items-center rounded-full bg-white/20"><Minus size={15} /></button>
      <span className="w-5 text-center font-mono text-[14px] font-bold">{value}</span>
      <button type="button" aria-label="Thêm" onClick={onPlus} className="grid h-8 w-8 place-items-center rounded-full bg-white/20"><Plus size={15} /></button>
    </div>
  );
}

/** Bảng trượt từ dưới lên (điện thoại) / hộp giữa màn hình (máy lớn). */
function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />
      <div role="dialog" aria-label={title} className="fixed inset-x-0 bottom-0 z-50 max-h-[88dvh] overflow-y-auto rounded-t-[28px] bg-[var(--bg-surface)] p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl sm:inset-x-auto sm:left-1/2 sm:top-1/2 sm:bottom-auto sm:w-[480px] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-[28px]">
        <div className="mx-auto mb-2 h-1.5 w-10 rounded-full bg-[var(--border)] sm:hidden" />
        <div className="mb-3 flex items-start justify-between gap-2">
          <h2 className="text-[17px] font-bold">{title}</h2>
          <button type="button" aria-label="Đóng" onClick={onClose} className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--bg-subtle)]"><X size={17} /></button>
        </div>
        {children}
      </div>
    </>
  );
}
