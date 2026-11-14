import { useEffect, useState, type ReactNode } from 'react';
import { ChefHat, Clock3, Flame, Leaf, Minus, Plus, Trash2, UtensilsCrossed, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { CartLine, MenuDish, OrderItem, OrderItemStatus, OrderView } from '@/types';

/** "65.000đ" — kiểu hiển thị giá quen thuộc của app đặt đồ ăn. */
export const vnd = (n: number) => `${Math.round(n).toLocaleString('vi-VN')}đ`;
export const hhmm = (iso: string) => new Date(iso).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

const PALETTE = ['#e8f5ee', '#fdf0e3', '#eaf1fd', '#fbeaea', '#f1ecfb', '#e9f6f6'];

/** Ảnh món; món chưa có ảnh dùng ô màu kèm biểu tượng. */
export function DishImage({ dish, className }: { dish: Pick<MenuDish, 'name' | 'image' | 'id'>; className?: string }) {
  const [broken, setBroken] = useState(false);
  if (dish.image && !broken) {
    return <img src={dish.image} alt={dish.name} loading="lazy" onError={() => setBroken(true)} className={cn('object-cover', className)} />;
  }
  const bg = PALETTE[Number(dish.id) % PALETTE.length] ?? PALETTE[0];
  return (
    <div className={cn('grid place-items-center text-[#0f7b5a]/70', className)} style={{ background: bg }} aria-hidden>
      <UtensilsCrossed size={26} strokeWidth={1.6} />
    </div>
  );
}

export function Stepper({ value, onChange, min = 0, max = 20, size = 'md' }: { value: number; onChange: (v: number) => void; min?: number; max?: number; size?: 'sm' | 'md' }) {
  const btn = size === 'sm' ? 'h-7 w-7' : 'h-9 w-9';
  return (
    <div className="inline-flex items-center gap-2.5">
      <button type="button" aria-label="Giảm" disabled={value <= min} onClick={() => onChange(value - 1)} className={cn(btn, 'grid place-items-center rounded-full border border-[#0f7b5a] text-[#0f7b5a] disabled:opacity-30')}>
        <Minus size={size === 'sm' ? 14 : 16} />
      </button>
      <span className="min-w-[18px] text-center text-[15px] font-semibold tabular-nums">{value}</span>
      <button type="button" aria-label="Tăng" disabled={value >= max} onClick={() => onChange(value + 1)} className={cn(btn, 'grid place-items-center rounded-full bg-[#0f7b5a] text-white disabled:opacity-30')}>
        <Plus size={size === 'sm' ? 14 : 16} />
      </button>
    </div>
  );
}

function SpicyMark({ level }: { level: number }) {
  if (!level) return null;
  return (
    <span className="inline-flex items-center gap-0.5 text-[11.5px] font-medium text-[#e0582b]">
      {Array.from({ length: level }).map((_, i) => <Flame key={i} size={11} fill="currentColor" />)}
    </span>
  );
}

const isVeg = (d: MenuDish) => d.tags.some((t) => /chay/i.test(t));

/** Một dòng món trong thực đơn (ảnh trái, thông tin phải, nút + hoặc bộ tăng giảm). */
export function DishRow({ dish, inCart, onOpen, onAdd, onChangeQty }: { dish: MenuDish; inCart: number; onOpen: () => void; onAdd: () => void; onChangeQty: (qty: number) => void }) {
  return (
    <div className={cn('flex gap-3 py-3', dish.soldOut && 'opacity-55')}>
      <button type="button" onClick={onOpen} className="relative h-[88px] w-[88px] shrink-0 overflow-hidden rounded-xl" aria-label={`Xem ${dish.name}`}>
        <DishImage dish={dish} className="h-full w-full" />
        {dish.soldOut ? <span className="absolute inset-x-0 bottom-0 bg-black/60 py-0.5 text-center text-[11px] font-semibold text-white">Tạm hết</span> : null}
      </button>
      <div className="flex min-w-0 flex-1 flex-col">
        <button type="button" onClick={onOpen} className="text-left">
          <p className="line-clamp-2 text-[15px] font-semibold leading-snug text-[#1b1f1d]">{dish.name}</p>
          {dish.description ? <p className="mt-0.5 line-clamp-2 text-[12.5px] leading-snug text-[#6b7570]">{dish.description}</p> : null}
        </button>
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          <SpicyMark level={dish.spicyLevel} />
          {isVeg(dish) ? <span className="inline-flex items-center gap-0.5 text-[11.5px] text-[#1f9d55]"><Leaf size={11} />Chay</span> : null}
          {dish.tags.filter((t) => /bán chạy/i.test(t)).map((t) => <span key={t} className="rounded bg-[#fff1e6] px-1.5 text-[11px] font-semibold text-[#e0582b]">{t}</span>)}
        </div>
        <div className="mt-auto flex items-end justify-between pt-1.5">
          <span className="text-[15px] font-bold text-[#1b1f1d]">{vnd(dish.price)}</span>
          {dish.soldOut ? null : inCart > 0 ? (
            <Stepper value={inCart} onChange={onChangeQty} size="sm" />
          ) : (
            <button type="button" aria-label={`Thêm ${dish.name}`} onClick={onAdd} className="grid h-7 w-7 place-items-center rounded-full bg-[#0f7b5a] text-white shadow-sm active:scale-95">
              <Plus size={16} strokeWidth={2.4} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/** Tấm trượt từ dưới lên (dùng cho chi tiết món, giỏ món, hộp xác nhận). */
export function Sheet({ open, onClose, children, title, full = false }: { open: boolean; onClose: () => void; children: ReactNode; title?: string; full?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" aria-label="Đóng" className="absolute inset-0 bg-black/45" onClick={onClose} />
      <div className={cn('relative flex w-full max-w-[480px] flex-col overflow-hidden rounded-t-2xl bg-white animate-in slide-in-from-bottom', full ? 'h-[92dvh]' : 'max-h-[90dvh]')}>
        {title ? (
          <div className="flex items-center justify-between border-b border-[#eef1ef] px-4 py-3">
            <p className="text-[16px] font-bold">{title}</p>
            <button type="button" aria-label="Đóng" onClick={onClose} className="grid h-8 w-8 place-items-center rounded-full bg-[#f2f4f3]"><X size={16} /></button>
          </div>
        ) : null}
        {children}
      </div>
    </div>
  );
}

const QUICK_NOTES = ['Ít cay', 'Không hành', 'Không rau', 'Ít ngọt', 'Không đá'];

/** UC-KH-02: chi tiết món + chọn số lượng, ghi chú, thêm vào giỏ. */
export function DishSheet({ dish, onClose, onAdd }: { dish: MenuDish | null; onClose: () => void; onAdd: (dish: MenuDish, qty: number, note: string) => void }) {
  const [qty, setQty] = useState(1);
  const [note, setNote] = useState('');
  useEffect(() => {
    setQty(1);
    setNote('');
  }, [dish?.id]);
  if (!dish) return null;
  const toggleNote = (n: string) => setNote((cur) => (cur.includes(n) ? cur.replace(n, '').replace(/^,\s*|,\s*$/g, '').replace(/,\s*,/g, ',').trim() : cur ? `${cur}, ${n}` : n));
  return (
    <Sheet open onClose={onClose} title={undefined}>
      <div className="overflow-y-auto">
        <div className="relative">
          <DishImage dish={dish} className="h-[220px] w-full" />
          <button type="button" aria-label="Đóng" onClick={onClose} className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-white/90 shadow"><X size={18} /></button>
        </div>
        <div className="space-y-3 p-4">
          <div>
            <h2 className="text-[19px] font-bold leading-tight">{dish.name}</h2>
            <p className="mt-1 text-[18px] font-bold text-[#0f7b5a]">{vnd(dish.price)}</p>
            <div className="mt-1 flex items-center gap-2"><SpicyMark level={dish.spicyLevel} />{isVeg(dish) ? <span className="text-[12px] text-[#1f9d55]">Món chay</span> : null}</div>
          </div>
          {dish.description ? <p className="text-[14px] leading-relaxed text-[#4a524e]">{dish.description}</p> : null}
          {dish.ingredients ? (
            <div><p className="text-[12.5px] font-semibold uppercase tracking-wide text-[#8a938e]">Thành phần</p><p className="text-[14px] text-[#2c3330]">{dish.ingredients}</p></div>
          ) : null}
          <div className="rounded-xl bg-[#fff7ed] px-3 py-2 text-[13px] text-[#8a4b12]">
            {dish.allergens.length ? <p><b>Có thể chứa:</b> {dish.allergens.join(', ')}.</p> : null}
            <p>Vui lòng báo nhân viên nếu bạn dị ứng thực phẩm.</p>
          </div>
          {dish.soldOut ? (
            <p className="rounded-xl bg-[#f3f4f4] p-3 text-center text-[14px] font-semibold text-[#6b7570]">Món này hiện đã tạm hết</p>
          ) : (
            <>
              <div>
                <p className="mb-1.5 text-[13.5px] font-semibold">Ghi chú cho bếp</p>
                <div className="mb-2 flex flex-wrap gap-1.5">
                  {QUICK_NOTES.map((n) => (
                    <button key={n} type="button" onClick={() => toggleNote(n)} className={cn('rounded-full border px-3 py-1 text-[12.5px]', note.includes(n) ? 'border-[#0f7b5a] bg-[#e8f5ee] text-[#0f7b5a]' : 'border-[#dfe4e1] text-[#4a524e]')}>{n}</button>
                  ))}
                </div>
                <textarea value={note} maxLength={200} rows={2} onChange={(e) => setNote(e.target.value)} placeholder="Ví dụ: ít cay, không hành…" className="w-full resize-none rounded-xl border border-[#dfe4e1] px-3 py-2 text-[14px] outline-none focus:border-[#0f7b5a]" />
              </div>
            </>
          )}
        </div>
      </div>
      {dish.soldOut ? null : (
        <div className="flex items-center gap-3 border-t border-[#eef1ef] p-3 pb-[max(12px,env(safe-area-inset-bottom))]">
          <Stepper value={qty} onChange={setQty} min={1} />
          <button type="button" onClick={() => onAdd(dish, qty, note.trim())} className="flex-1 rounded-xl bg-[#0f7b5a] py-3 text-[15px] font-bold text-white active:scale-[0.99]">
            Thêm vào giỏ · {vnd(dish.price * qty)}
          </button>
        </div>
      )}
    </Sheet>
  );
}

/** UC-KH-03: giỏ món. */
export function CartSheet({ open, lines, invalid, sending, onClose, onChange, onRemove, onSend, disabledReason }: {
  open: boolean;
  lines: CartLine[];
  invalid: Set<string>;
  sending: boolean;
  onClose: () => void;
  onChange: (key: string, patch: Partial<CartLine>) => void;
  onRemove: (key: string) => void;
  onSend: () => void;
  disabledReason: string | null;
}) {
  const total = lines.reduce((s, l) => s + l.price * l.qty, 0);
  const count = lines.reduce((s, l) => s + l.qty, 0);
  return (
    <Sheet open={open} onClose={onClose} title="Giỏ món" full>
      <div className="flex-1 overflow-y-auto px-4">
        {lines.length === 0 ? (
          <div className="py-16 text-center text-[14px] text-[#6b7570]">Giỏ món đang trống</div>
        ) : (
          lines.map((l) => (
            <div key={l.key} className={cn('flex gap-3 border-b border-[#f0f2f1] py-3', invalid.has(l.dishId) && 'rounded-lg bg-[#fdecec] px-2')}>
              <DishImage dish={{ id: l.dishId, name: l.name, image: l.image }} className="h-14 w-14 shrink-0 rounded-lg" />
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-[14.5px] font-semibold leading-snug">{l.name}</p>
                  <button type="button" aria-label={`Xóa ${l.name}`} onClick={() => onRemove(l.key)} className="text-[#9aa39e]"><Trash2 size={16} /></button>
                </div>
                {invalid.has(l.dishId) ? <p className="text-[12.5px] font-semibold text-[#d33]">Món đã hết — vui lòng xóa khỏi giỏ</p> : null}
                <input
                  value={l.note}
                  maxLength={200}
                  onChange={(e) => onChange(l.key, { note: e.target.value })}
                  placeholder="Thêm ghi chú…"
                  className="mt-1 w-full border-b border-dashed border-[#dfe4e1] bg-transparent py-0.5 text-[13px] text-[#4a524e] outline-none focus:border-[#0f7b5a]"
                />
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-[14.5px] font-bold">{vnd(l.price * l.qty)}</span>
                  <Stepper value={l.qty} onChange={(v) => (v <= 0 ? onRemove(l.key) : onChange(l.key, { qty: v }))} size="sm" />
                </div>
              </div>
            </div>
          ))
        )}
      </div>
      <div className="border-t border-[#eef1ef] p-4 pb-[max(16px,env(safe-area-inset-bottom))]">
        <div className="mb-3 flex items-center justify-between text-[15px]"><span className="text-[#4a524e]">Tạm tính ({count} món)</span><span className="text-[18px] font-bold">{vnd(total)}</span></div>
        {disabledReason ? <p className="mb-2 rounded-lg bg-[#fff7ed] px-3 py-2 text-[13px] text-[#8a4b12]">{disabledReason}</p> : null}
        <button type="button" disabled={!lines.length || sending || Boolean(disabledReason)} onClick={onSend} className="w-full rounded-xl bg-[#0f7b5a] py-3.5 text-[16px] font-bold text-white disabled:opacity-40">
          {sending ? 'Đang gửi…' : 'Gửi đặt món'}
        </button>
      </div>
    </Sheet>
  );
}

const STATUS_META: Record<OrderItemStatus, { label: string; cls: string }> = {
  pending: { label: 'Chờ chế biến', cls: 'bg-[#f2f4f3] text-[#4a524e]' },
  cooking: { label: 'Đang chế biến', cls: 'bg-[#fff1e6] text-[#d4581f]' },
  done: { label: 'Đã xong', cls: 'bg-[#e8f5ee] text-[#0f7b5a]' },
  served: { label: 'Đã mang ra', cls: 'bg-[#eaf1fd] text-[#2563eb]' },
  cancelled: { label: 'Đã hủy', cls: 'bg-[#fdecec] text-[#c62828]' },
};

function Progress({ status }: { status: OrderItemStatus }) {
  if (status === 'cancelled') return null;
  const step = { pending: 1, cooking: 2, done: 3, served: 4 }[status];
  return (
    <div className="mt-2 flex items-center gap-1" aria-hidden>
      {[1, 2, 3].map((s) => <span key={s} className={cn('h-1 flex-1 rounded-full', step >= s ? 'bg-[#0f7b5a]' : 'bg-[#e4e8e6]')} />)}
    </div>
  );
}

/** UC-KH-04: món đã gọi theo đợt, trạng thái từng món, hủy món chưa chế biến. */
export function OrdersTab({ order, onCancel, onBrowse }: { order: OrderView | null; onCancel: (item: OrderItem) => void; onBrowse: () => void }) {
  if (!order || order.items.length === 0) {
    return (
      <div className="px-6 py-20 text-center">
        <ChefHat size={44} className="mx-auto text-[#c4ccc8]" strokeWidth={1.4} />
        <p className="mt-3 text-[15px] font-semibold">Bàn chưa gọi món nào</p>
        <button type="button" onClick={onBrowse} className="mt-4 rounded-full bg-[#0f7b5a] px-5 py-2 text-[14px] font-semibold text-white">Xem thực đơn</button>
      </div>
    );
  }
  const batches = [...new Set(order.items.map((i) => i.batchNo))].sort((a, b) => b - a);
  return (
    <div className="space-y-3 px-4 pb-6 pt-3">
      <div className="rounded-2xl bg-[#0f7b5a] p-4 text-white">
        <p className="text-[12.5px] opacity-80">Đơn {order.code}</p>
        <p className="mt-0.5 text-[22px] font-bold">{vnd(order.subtotal)}</p>
        <p className="text-[12.5px] opacity-90">{order.pendingCount ? `${order.pendingCount} món đang được chuẩn bị` : 'Các món đã được chuẩn bị xong'}</p>
      </div>
      {order.locked ? <p className="rounded-xl bg-[#fff7ed] px-3 py-2 text-[13px] text-[#8a4b12]">Bàn đang chờ thanh toán — không gọi thêm hay hủy món được.</p> : null}
      {batches.map((b) => {
        const items = order.items.filter((i) => i.batchNo === b);
        return (
          <div key={b} className="rounded-2xl border border-[#eef1ef] bg-white">
            <div className="flex items-center gap-1.5 border-b border-[#f0f2f1] px-4 py-2 text-[12.5px] text-[#6b7570]"><Clock3 size={13} />Đợt {b} · {hhmm(items[0].createdAt)}</div>
            {items.map((i) => (
              <div key={i.id} className="border-b border-[#f6f7f6] px-4 py-3 last:border-0">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className={cn('text-[14.5px] font-semibold', i.status === 'cancelled' && 'text-[#9aa39e] line-through')}>{i.qty} × {i.name}</p>
                    {i.note ? <p className="text-[12.5px] text-[#6b7570]">“{i.note}”</p> : null}
                    {i.status === 'cancelled' && i.cancelReason ? <p className="text-[12.5px] text-[#c62828]">{i.cancelSource === 'kitchen' ? 'Bếp báo: ' : ''}{i.cancelReason}</p> : null}
                  </div>
                  <div className="shrink-0 text-right">
                    <span className={cn('inline-block rounded-full px-2 py-0.5 text-[11.5px] font-semibold', STATUS_META[i.status].cls)}>{STATUS_META[i.status].label}</span>
                    <p className="mt-1 text-[13px] font-semibold">{i.status === 'cancelled' ? '' : vnd(i.price * i.qty)}</p>
                  </div>
                </div>
                <Progress status={i.status} />
                {i.status === 'pending' && !order.locked ? (
                  <button type="button" onClick={() => onCancel(i)} className="mt-2 text-[12.5px] font-semibold text-[#c62828]">Hủy món</button>
                ) : null}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
