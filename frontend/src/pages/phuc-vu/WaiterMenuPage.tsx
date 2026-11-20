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
import { formatCurrency } from '@/lib/format';
import { matchesKeyword } from '@/lib/normalize';
import { cn } from '@/lib/cn';
import type { MenuDish, MenuSet } from '@/types';

const SETS = '__sets';

/** Một dòng giỏ: món lẻ hoặc set (món mặc định của set). */
type Line = { key: string; dishId?: string; setId?: string; name: string; price: number; qty: number; note: string };

/**
 * Thực đơn cho Nhân viên phục vụ.
 *  - /phuc-vu/thuc-don          : tra cứu (thành phần, dị nguyên, độ cay, món đã hết) để tư vấn khách.
 *  - /phuc-vu/goi-mon/:tableId  : gọi món hộ khách — chọn món, số lượng, ghi chú rồi gửi bếp (bàn phải đã mở).
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
  const groupName = (d: MenuDish) => (d.groupId ? m?.groups.find((g) => g.id === d.groupId)?.name : null);

  const qtyOf = (key: string) => cart.find((l) => l.key === key)?.qty ?? 0;
  const add = (line: Omit<Line, 'qty' | 'note'>, delta: number) =>
    setCart((c) => {
      const cur = c.find((l) => l.key === line.key);
      if (!cur) return delta > 0 ? [...c, { ...line, qty: delta, note: '' }] : c;
      const qty = Math.min(50, cur.qty + delta);
      return qty <= 0 ? c.filter((l) => l.key !== line.key) : c.map((l) => (l.key === line.key ? { ...l, qty } : l));
    });
  const dishLine = (d: MenuDish) => ({ key: `d${d.id}`, dishId: d.id, name: d.variantLabel ? `${groupName(d) ?? ''} – ${d.variantLabel}` : d.name, price: d.price });
  const setLine = (s: MenuSet) => ({ key: `s${s.id}`, setId: s.id, name: s.name, price: s.price });
  const total = cart.reduce((s, l) => s + l.price * l.qty, 0);
  const count = cart.reduce((s, l) => s + l.qty, 0);

  const send = useMutation({
    mutationFn: () => waiterSendItems(tableId!, cart.map<SendLine>((l) => (l.setId ? { setId: l.setId, qty: l.qty } : { dishId: l.dishId, qty: l.qty, note: l.note }))),
    onSuccess: () => {
      toast.success(`Đã gửi ${count} món của bàn ${table?.code ?? ''} cho bếp`);
      setCart([]);
      void qc.invalidateQueries({ queryKey: WAITER_KEYS.all });
      navigate('/phuc-vu');
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Không gửi được món'),
  });

  const stepper = (key: string, onMinus: () => void, onPlus: () => void, disabled?: boolean) => {
    const n = qtyOf(key);
    return n ? (
      <div className="flex items-center gap-1">
        <button type="button" aria-label="Bớt" onClick={onMinus} className="grid h-8 w-8 place-items-center rounded-full bg-[var(--bg-subtle)]"><Minus size={15} /></button>
        <span className="w-6 text-center font-mono text-[15px] font-bold">{n}</span>
        <button type="button" aria-label="Thêm" onClick={onPlus} className="grid h-8 w-8 place-items-center rounded-full bg-[var(--accent)] text-white"><Plus size={15} /></button>
      </div>
    ) : (
      <button type="button" disabled={disabled} onClick={onPlus} className="grid h-8 w-8 place-items-center rounded-full bg-[var(--accent)] text-white disabled:bg-[var(--bg-subtle)] disabled:text-[var(--text-muted)]" aria-label="Thêm"><Plus size={16} /></button>
    );
  };

  return (
    <WaiterShell title={ordering ? `GỌI MÓN – BÀN ${table?.code ?? ''}` : 'THỰC ĐƠN'} fill>
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="space-y-2 border-b border-[var(--border)] bg-[var(--bg-surface)] p-3">
          <div className="flex items-center gap-2">
            {ordering ? (
              <button type="button" aria-label="Quay lại sơ đồ" onClick={() => navigate('/phuc-vu')} className="grid h-10 w-10 shrink-0 place-items-center rounded-[10px] bg-[var(--bg-subtle)]"><ArrowLeft size={18} /></button>
            ) : null}
            <label className="flex h-10 flex-1 items-center gap-2 rounded-[10px] bg-[var(--bg-subtle)] px-3">
              <Search size={16} className="text-[var(--text-muted)]" />
              <input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="Tìm món, thành phần…" className="min-w-0 flex-1 bg-transparent text-[14px] outline-none" />
              {keyword ? <button type="button" aria-label="Xóa tìm kiếm" onClick={() => setKeyword('')}><X size={15} /></button> : null}
            </label>
          </div>
          {!keyword.trim() && m ? (
            <div className="no-scrollbar flex gap-1 overflow-x-auto">
              {[...m.categories.map((c) => ({ id: c.id, name: c.name })), ...(m.sets.length ? [{ id: SETS, name: 'Set menu' }] : [])].map((c) => (
                <button key={c.id} type="button" onClick={() => setCat(c.id)} className={cn('h-8 shrink-0 rounded-full px-3 text-[13px] font-semibold', c.id === catId ? 'bg-[var(--accent)] text-white' : 'bg-[var(--bg-subtle)] text-[var(--text-secondary)]')}>{c.name}</button>
              ))}
            </div>
          ) : null}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          {menu.isError ? (
            <BlockError onRetry={() => void menu.refetch()} retrying={menu.isFetching} />
          ) : !m ? (
            <Skeleton className="h-60" />
          ) : sets.length ? (
            <ul className="mx-auto max-w-2xl space-y-2">
              {sets.map((s) => (
                <li key={s.id} className="rounded-[14px] border border-[var(--border)] bg-[var(--bg-surface)] p-3">
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-[15px] font-bold">{s.name}</p>
                      <p className="text-[12.5px] text-[var(--text-muted)]">{s.items.map((i) => `${i.qty}× ${i.name}`).join(' · ')}</p>
                      <p className="mt-1 font-mono text-[14px] font-bold text-[var(--accent)]">{formatCurrency(s.price)} <span className="text-[12px] font-normal text-[var(--text-muted)] line-through">{formatCurrency(s.originalPrice)}</span></p>
                    </div>
                    {ordering ? stepper(`s${s.id}`, () => add(setLine(s), -1), () => add(setLine(s), 1)) : null}
                  </div>
                </li>
              ))}
            </ul>
          ) : dishes.length === 0 ? (
            <EmptyState icon={UtensilsCrossed} title="Không có món phù hợp" />
          ) : (
            <ul className="mx-auto max-w-2xl space-y-2">
              {dishes.map((d) => (
                <li key={d.id} className={cn('flex gap-3 rounded-[14px] border border-[var(--border)] bg-[var(--bg-surface)] p-2.5', d.soldOut && 'opacity-60')}>
                  <button type="button" onClick={() => setDetail(d)} className="flex min-w-0 flex-1 gap-3 text-left">
                    {d.image ? <img src={d.image} alt="" className="h-16 w-16 shrink-0 rounded-[10px] object-cover" loading="lazy" /> : <span className="grid h-16 w-16 shrink-0 place-items-center rounded-[10px] bg-[var(--bg-subtle)]"><UtensilsCrossed size={20} className="text-[var(--text-muted)]" /></span>}
                    <span className="min-w-0 flex-1">
                      <span className="block text-[14.5px] font-bold leading-snug">{d.variantLabel ? `${groupName(d) ?? d.name} – ${d.variantLabel}` : d.name}</span>
                      <span className="mt-0.5 flex flex-wrap items-center gap-1.5">
                        <span className="font-mono text-[13.5px] font-bold text-[var(--accent)]">{formatCurrency(d.price)}</span>
                        {d.soldOut ? <span className="rounded-full bg-[var(--danger-soft)] px-1.5 text-[11px] font-bold text-[var(--danger)]">Hết món</span> : null}
                        {d.spicyLevel > 0 ? <span className="inline-flex text-[#dc2626]">{Array.from({ length: d.spicyLevel }, (_, i) => <Flame key={i} size={12} />)}</span> : null}
                        {d.allergens.length ? <span className="rounded-full bg-[var(--warning-soft)] px-1.5 text-[11px] font-semibold text-[var(--warning)]">Dị nguyên: {d.allergens.join(', ')}</span> : null}
                      </span>
                    </span>
                  </button>
                  {ordering ? <div className="self-center">{stepper(`d${d.id}`, () => add(dishLine(d), -1), () => add(dishLine(d), 1), d.soldOut)}</div> : null}
                </li>
              ))}
            </ul>
          )}
        </div>

        {ordering && count ? (
          <div className="border-t border-[var(--border)] bg-[var(--bg-surface)] p-3">
            <Button className="w-full" leadingIcon={<ShoppingBag size={17} />} onClick={() => setCartOpen(true)}>
              Xem giỏ · {count} món · {formatCurrency(total)}
            </Button>
          </div>
        ) : null}
      </div>

      {detail ? (
        <Sheet onClose={() => setDetail(null)} title={detail.variantLabel ? `${groupName(detail) ?? detail.name} – ${detail.variantLabel}` : detail.name}>
          {detail.image ? <img src={detail.image} alt="" className="mb-3 aspect-[16/10] w-full rounded-[12px] object-cover" /> : null}
          <p className="font-mono text-[16px] font-bold text-[var(--accent)]">{formatCurrency(detail.price)}{detail.soldOut ? <span className="ml-2 text-[13px] text-[var(--danger)]">· Hết món hôm nay</span> : null}</p>
          {detail.description ? <p className="mt-2 text-[14px] text-[var(--text-secondary)]">{detail.description}</p> : null}
          <dl className="mt-3 space-y-2 text-[13.5px]">
            <div><dt className="font-semibold">Thành phần</dt><dd className="text-[var(--text-secondary)]">{detail.ingredients || 'Chưa cập nhật'}</dd></div>
            <div><dt className="font-semibold">Dị nguyên</dt><dd className={detail.allergens.length ? 'font-semibold text-[var(--warning)]' : 'text-[var(--text-secondary)]'}>{detail.allergens.length ? detail.allergens.join(', ') : 'Không có'}</dd></div>
            <div><dt className="font-semibold">Độ cay</dt><dd className="text-[var(--text-secondary)]">{['Không cay', 'Cay nhẹ', 'Cay vừa', 'Rất cay'][detail.spicyLevel] ?? '—'}</dd></div>
          </dl>
        </Sheet>
      ) : null}

      {cartOpen ? (
        <Sheet onClose={() => setCartOpen(false)} title={`Giỏ món – bàn ${table?.code ?? ''}`}>
          {cart.length === 0 ? <p className="text-[13.5px] text-[var(--text-muted)]">Giỏ trống.</p> : (
            <ul className="space-y-2">
              {cart.map((l) => (
                <li key={l.key} className="rounded-[12px] border border-[var(--border)] p-2.5">
                  <div className="flex items-center gap-2">
                    <span className="min-w-0 flex-1 text-[14px] font-semibold">{l.name}</span>
                    {stepper(l.key, () => add(l, -1), () => add(l, 1))}
                  </div>
                  {l.dishId ? (
                    <input
                      value={l.note}
                      maxLength={200}
                      onChange={(e) => setCart((c) => c.map((x) => (x.key === l.key ? { ...x, note: e.target.value } : x)))}
                      placeholder="Ghi chú cho bếp (ít cay, không hành…)"
                      className="mt-2 h-9 w-full rounded-[8px] bg-[var(--bg-subtle)] px-2.5 text-[13px] outline-none"
                    />
                  ) : <p className="mt-1 text-[12px] text-[var(--text-muted)]">Set gồm các món mặc định</p>}
                </li>
              ))}
            </ul>
          )}
          <div className="mt-4 flex items-center justify-between text-[15px] font-bold"><span>Tạm tính</span><span className="font-mono text-[var(--accent)]">{formatCurrency(total)}</span></div>
          <Button className="mt-3 w-full" leadingIcon={<Send size={16} />} disabled={!cart.length} loading={send.isPending} onClick={() => send.mutate()}>Gửi bếp</Button>
        </Sheet>
      ) : null}
    </WaiterShell>
  );
}

/** Bảng trượt từ dưới lên (điện thoại) / hộp giữa màn hình (máy lớn). */
function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />
      <div role="dialog" aria-label={title} className="fixed inset-x-0 bottom-0 z-50 max-h-[88dvh] overflow-y-auto rounded-t-[20px] bg-[var(--bg-surface)] p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl sm:inset-x-auto sm:left-1/2 sm:top-1/2 sm:bottom-auto sm:w-[480px] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-[20px]">
        <div className="mb-3 flex items-start justify-between gap-2">
          <h2 className="text-[17px] font-bold">{title}</h2>
          <button type="button" aria-label="Đóng" onClick={onClose} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg hover:bg-[var(--bg-hover)]"><X size={17} /></button>
        </div>
        {children}
      </div>
    </>
  );
}
