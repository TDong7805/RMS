import { useEffect, useState, type ReactNode } from 'react';
import { ArrowLeft, ArrowRight, BellRing, Check, ChefHat, Clock3, NotebookPen, ReceiptText, ShoppingBag, Trash2, UtensilsCrossed } from 'lucide-react';
import { DishImage, PopularCard, Q, SpicyMark, STAGE_TEXT, StageArt, Stepper, isVeg, orderStage, hhmm, vnd } from '@/features/ordering/QrParts';
import { cn } from '@/lib/cn';
import type { CartLine, CustomerRequest, MenuDish, OrderItem, OrderItemStatus, OrderView } from '@/types';

/* Màn hình toàn trang của trang đặt món: chi tiết món, giỏ món, đã gửi bếp, món của tôi (theo dõi món). */

/** Khung màn hình phủ toàn trang (cột giữa như điện thoại), khóa cuộn trang bên dưới. */
export function Screen({ children, label }: { children: ReactNode; label: string }) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);
  return (
    <div className="fixed inset-0 z-40 bg-[var(--qr-page)]" role="dialog" aria-modal="true" aria-label={label}>
      <div className="relative mx-auto flex h-full max-w-[480px] flex-col overflow-hidden bg-[var(--qr-bg)] animate-in fade-in-0 slide-in-from-right-6">{children}</div>
    </div>
  );
}

/** Đầu màn hình: nút quay lại + tiêu đề + (bên phải) "Bạn đang ngồi tại / Bàn". */
export function ScreenHeader({ title, onBack, table, right }: { title: string; onBack: () => void; table?: string; right?: ReactNode }) {
  return (
    <header className="flex items-center gap-3 px-5 pb-3 pt-5">
      <button type="button" aria-label="Quay lại" onClick={onBack} className={Q.iconBtn}><ArrowLeft size={20} /></button>
      <h1 className="flex-1 text-[19px] font-semibold">{title}</h1>
      {right ?? (table ? (
        <div className="text-right leading-tight">
          <p className="text-[11px] text-[var(--qr-muted)]">Bạn đang ngồi tại</p>
          <p className="text-[13.5px] font-semibold">Bàn {table}</p>
        </div>
      ) : null)}
    </header>
  );
}

const QUICK_NOTES = ['Ít cay', 'Không hành', 'Không rau', 'Ít ngọt', 'Không đá', 'Chín kỹ'];

/** UC-KH-02: chi tiết món — ảnh lớn, thẻ thông tin, ghi chú cho bếp (miễn phí), số lượng, thêm vào giỏ. */
export function DishDetailScreen({ dish, categoryName, best, onBack, onAdd }: {
  dish: MenuDish;
  categoryName?: string;
  best?: number;
  onBack: () => void;
  onAdd: (dish: MenuDish, qty: number, note: string) => void;
}) {
  const [qty, setQty] = useState(1);
  const [picked, setPicked] = useState<string[]>([]);
  const [extra, setExtra] = useState('');
  const note = [...picked, extra.trim()].filter(Boolean).join(', ');
  const toggle = (n: string) => setPicked((p) => (p.includes(n) ? p.filter((x) => x !== n) : [...p, n]));

  return (
    <Screen label={dish.name}>
      <div className="flex-1 overflow-y-auto pb-36">
        <div className="relative">
          <DishImage dish={dish} categoryName={categoryName} className="h-[320px] w-full" iconSize={70} />
          <button type="button" aria-label="Quay lại" onClick={onBack} className="absolute left-5 top-5 grid h-11 w-11 place-items-center rounded-2xl bg-[var(--qr-surface)] shadow-md"><ArrowLeft size={20} /></button>
          {best ? <span className="absolute right-5 top-5 rounded-xl bg-[var(--qr-primary)] px-3 py-1.5 text-[12.5px] font-semibold text-white">Bán chạy #{best}</span> : null}
        </div>
        <div className="relative z-10 -mt-10 px-5">
          <div className="rounded-[22px] bg-[var(--qr-primary-soft)] p-4">
            <div className="flex items-start justify-between gap-3">
              <h1 className="text-[21px] font-semibold leading-tight">{dish.name}</h1>
              <span className="shrink-0 text-[20px] font-bold text-[var(--qr-primary)]">{vnd(dish.price)}</span>
            </div>
            {dish.description ? <p className="mt-1.5 text-[13.5px] leading-relaxed text-[var(--qr-muted)]">{dish.description}</p> : null}
            <div className="mt-3 flex flex-wrap gap-2 text-[12px]">
              {categoryName ? <span className="rounded-lg bg-[var(--qr-surface)] px-2.5 py-1">{categoryName}</span> : null}
              <span className="inline-flex items-center gap-1 rounded-lg bg-[var(--qr-surface)] px-2.5 py-1">{dish.spicyLevel ? <SpicyMark level={dish.spicyLevel} size={11} /> : null}{['Không cay', 'Cay nhẹ', 'Cay vừa', 'Rất cay'][dish.spicyLevel]}</span>
              {isVeg(dish) ? <span className="rounded-lg bg-[var(--qr-success-soft)] px-2.5 py-1 text-[var(--qr-success)]">Món chay</span> : null}
            </div>
          </div>
        </div>

        <div className="space-y-5 px-5 pt-5">
          {dish.ingredients ? (
            <section>
              <p className="text-[16px] font-semibold">Thành phần</p>
              <p className="mt-1 text-[14px] leading-relaxed text-[var(--qr-muted)]">{dish.ingredients}</p>
            </section>
          ) : null}
          <section>
            <p className="text-[16px] font-semibold">Lưu ý dị ứng</p>
            {dish.allergens.length ? (
              <div className="mt-2 flex flex-wrap gap-2">{dish.allergens.map((a) => <span key={a} className="rounded-lg bg-[var(--qr-danger-soft)] px-2.5 py-1 text-[12.5px] font-medium text-[var(--qr-danger)]">{a}</span>)}</div>
            ) : (
              <p className="mt-1 text-[13.5px] text-[var(--qr-muted)]">Không có chất gây dị ứng được ghi nhận.</p>
            )}
            <p className="mt-1.5 text-[12.5px] text-[var(--qr-muted)]">Vui lòng báo nhân viên nếu bạn dị ứng thực phẩm.</p>
          </section>

          {dish.soldOut ? (
            <p className="rounded-2xl bg-[var(--qr-surface-2)] p-4 text-center text-[14.5px] font-semibold text-[var(--qr-muted)]">Món này hiện đã tạm hết</p>
          ) : (
            <section>
              <p className="text-[16px] font-semibold">Ghi chú cho bếp</p>
              <p className="text-[12px] text-[var(--qr-muted)]">Không bắt buộc · chọn nhiều</p>
              <div className="mt-2.5 space-y-2">
                {QUICK_NOTES.map((n) => {
                  const on = picked.includes(n);
                  return (
                    <button key={n} type="button" role="checkbox" aria-checked={on} onClick={() => toggle(n)} className={cn('flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left text-[14.5px]', on ? 'border-[var(--qr-primary)] bg-[var(--qr-primary-soft)]' : 'border-[var(--qr-border)] bg-[var(--qr-surface)]')}>
                      {n}
                      <span className="flex items-center gap-2.5 text-[13px] text-[var(--qr-muted)]">
                        Miễn phí
                        <span className={cn('grid h-5 w-5 place-items-center rounded-md border-2', on ? 'border-[var(--qr-primary)] bg-[var(--qr-primary)] text-white' : 'border-[var(--qr-border)]')}>{on ? <Check size={12} strokeWidth={3} /> : null}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
              <textarea value={extra} maxLength={150} rows={2} onChange={(e) => setExtra(e.target.value)} placeholder="Ghi chú khác cho bếp…" aria-label="Ghi chú khác cho bếp" className={cn(Q.input, 'mt-2.5 resize-none')} />
            </section>
          )}
        </div>
      </div>
      {dish.soldOut ? null : (
        <div className="absolute inset-x-0 bottom-0 space-y-3 border-t border-[var(--qr-border)] bg-[var(--qr-bg)] px-5 pb-[max(16px,env(safe-area-inset-bottom))] pt-3">
          <div className="flex items-center justify-between">
            <span className="text-[14.5px] text-[var(--qr-muted)]">Số lượng</span>
            <Stepper value={qty} onChange={setQty} min={1} size="sm" />
          </div>
          <button type="button" onClick={() => onAdd(dish, qty, note.slice(0, 200))} className={cn(Q.btn, 'w-full justify-between')}>
            <span className="inline-flex items-center gap-2"><ShoppingBag size={18} />Thêm vào giỏ</span>
            <span>{vnd(dish.price * qty)}</span>
          </button>
        </div>
      )}
    </Screen>
  );
}

/** UC-KH-03: giỏ món — từng món (số lượng, ghi chú), tổng tạm tính, gửi gọi món. */
export function CartScreen({ table, lines, invalid, sending, suggestions, categoryOf, qtyOf, onBack, onChange, onRemove, onClear, onSend, onOpenDish, onAddDish, disabledReason }: {
  table: string;
  lines: CartLine[];
  invalid: Set<string>;
  sending: boolean;
  suggestions: MenuDish[];
  categoryOf: (dishId: string) => string | undefined;
  qtyOf: (dishId: string) => number;
  onBack: () => void;
  onChange: (key: string, patch: Partial<CartLine>) => void;
  onRemove: (key: string) => void;
  onClear: () => void;
  onSend: () => void;
  onOpenDish: (d: MenuDish) => void;
  onAddDish: (d: MenuDish) => void;
  disabledReason: string | null;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const total = lines.reduce((s, l) => s + l.price * l.qty, 0);
  const count = lines.reduce((s, l) => s + l.qty, 0);
  return (
    <Screen label="Giỏ món">
      <ScreenHeader title="Giỏ món" onBack={onBack} table={table} />
      <div className="flex-1 overflow-y-auto px-5 pb-6">
        {lines.length === 0 ? (
          <>
            <div className="py-14 text-center">
              <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-[var(--qr-primary-soft)] text-[var(--qr-primary)]"><ShoppingBag size={30} /></span>
              <p className="mt-4 text-[16px] font-semibold">Giỏ món đang trống</p>
              <p className="mt-1 text-[13px] text-[var(--qr-muted)]">Thêm vài món ngon để bắt đầu nhé</p>
              <button type="button" onClick={onBack} className={cn(Q.btn, 'mt-5 px-6 py-2.5 text-[14px]')}>Xem thực đơn</button>
            </div>
            {suggestions.length ? (
              <section>
                <p className="mb-3 text-[16px] font-semibold">Gợi ý món bán chạy</p>
                <div className="no-scrollbar -mx-5 flex gap-3 overflow-x-auto px-5 pb-2">
                  {suggestions.map((d, i) => (
                    <PopularCard key={d.id} dish={d} categoryName={categoryOf(d.id)} rank={i + 1} inCart={qtyOf(d.id)} onOpen={() => onOpenDish(d)} onAdd={() => onAddDish(d)} onChangeQty={() => onAddDish(d)} />
                  ))}
                </div>
              </section>
            ) : null}
          </>
        ) : (
          <div className="space-y-3">
            {lines.map((l) => (
              <div key={l.key} className={cn(Q.card, 'p-3', invalid.has(l.dishId) && 'ring-2 ring-[var(--qr-danger)]')}>
                <div className="flex gap-3">
                  <DishImage dish={{ name: l.name, image: l.image }} categoryName={categoryOf(l.dishId)} className="h-[64px] w-[64px] shrink-0 rounded-xl" iconSize={22} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-[14.5px] font-semibold leading-snug">{l.name}</p>
                      <button type="button" aria-label={`Ghi chú ${l.name}`} onClick={() => { setEditing(editing === l.key ? null : l.key); setDraft(l.note); }} className="text-[var(--qr-muted)]"><NotebookPen size={17} /></button>
                    </div>
                    {l.note && editing !== l.key ? <p className="line-clamp-1 text-[12.5px] text-[var(--qr-muted)]">“{l.note}”</p> : null}
                    {invalid.has(l.dishId) ? <p className="text-[12.5px] font-semibold text-[var(--qr-danger)]">Món đã hết — vui lòng xóa khỏi giỏ</p> : null}
                    <div className="mt-1.5 flex items-center justify-between">
                      <span className="text-[14.5px] font-bold text-[var(--qr-primary)]">{vnd(l.price * l.qty)}</span>
                      <Stepper value={l.qty} onChange={(v) => (v <= 0 ? onRemove(l.key) : onChange(l.key, { qty: v }))} size="sm" />
                    </div>
                  </div>
                </div>
                {editing === l.key ? (
                  <div className="mt-3">
                    <p className="mb-1.5 text-[12.5px] text-[var(--qr-muted)]">Ghi chú cho món này</p>
                    <textarea value={draft} maxLength={200} rows={2} onChange={(e) => setDraft(e.target.value)} placeholder="Ví dụ: ít cay, không hành…" className={cn(Q.input, 'resize-none')} autoFocus />
                    <div className="mt-2 flex justify-end">
                      <button type="button" onClick={() => { onChange(l.key, { note: draft.trim() }); setEditing(null); }} className={cn(Q.btn, 'px-5 py-2 text-[13.5px]')}>Lưu</button>
                    </div>
                  </div>
                ) : null}
              </div>
            ))}
            <div className={cn(Q.card, 'p-4')}>
              <p className="mb-2 text-[15px] font-semibold">Tóm tắt</p>
              <div className="flex justify-between text-[13.5px] text-[var(--qr-muted)]"><span>Tạm tính ({count} món)</span><span>{vnd(total)}</span></div>
              <div className="mt-2 flex items-baseline justify-between border-t border-[var(--qr-border)] pt-2.5"><span className="text-[14.5px]">Tổng</span><span className="text-[19px] font-bold text-[var(--qr-primary)]">{vnd(total)}</span></div>
              <p className="mt-2 text-[12px] text-[var(--qr-muted)]">Món gửi đi tới bếp ngay; chỉ hủy được khi bếp chưa bắt đầu chế biến. Thanh toán tại quầy khi dùng bữa xong.</p>
            </div>
            <button type="button" onClick={onClear} className="flex w-full items-center justify-center gap-1.5 py-2 text-[13.5px] font-medium text-[var(--qr-danger)]"><Trash2 size={15} />Xóa hết giỏ món</button>
          </div>
        )}
      </div>
      {lines.length ? (
        <div className="border-t border-[var(--qr-border)] px-5 pb-[max(16px,env(safe-area-inset-bottom))] pt-3">
          {disabledReason ? <p className="mb-2 rounded-xl bg-[var(--qr-warn-soft)] px-3 py-2 text-[13px] text-[var(--qr-warn-text)]">{disabledReason}</p> : null}
          <button type="button" disabled={sending || Boolean(disabledReason)} onClick={onSend} className={cn(Q.btn, 'w-full justify-between')}>
            <span>{sending ? 'Đang gửi…' : 'Gửi gọi món'}</span>
            <span className="inline-flex items-center gap-2">{vnd(total)}<ArrowRight size={18} /></span>
          </button>
        </div>
      ) : null}
    </Screen>
  );
}

/** Sau khi gửi: "Đã gửi tới bếp" (thay màn "Order Confirmed" của thiết kế). */
export function SentScreen({ count, total, onMenu, onTrack }: { count: number; total: number; onMenu: () => void; onTrack: () => void }) {
  return (
    <Screen label="Đã gửi tới bếp">
      <StageArt stage="sent" className="h-[46%] w-full rounded-b-[32px]" />
      <div className="flex flex-1 flex-col px-5 pt-6 text-center">
        <h1 className="text-[22px] font-semibold">Đã gửi tới bếp!</h1>
        <p className="mt-1 text-[14px] text-[var(--qr-muted)]">Ngồi chờ chút nhé, bếp đang chuẩn bị món cho bạn.</p>
        <div className={cn(Q.card, 'mt-5 p-4 text-left')}>
          <div className="flex justify-between text-[13.5px] text-[var(--qr-muted)]"><span>Vừa gửi</span><span>{count} món</span></div>
          <div className="mt-2 flex items-baseline justify-between border-t border-[var(--qr-border)] pt-2.5"><span className="text-[14.5px]">Tạm tính đợt này</span><span className="text-[18px] font-bold text-[var(--qr-primary)]">{vnd(total)}</span></div>
        </div>
        <div className="mt-auto flex gap-3 pb-[max(20px,env(safe-area-inset-bottom))] pt-5">
          <button type="button" onClick={onMenu} className={cn(Q.btnGhost, 'flex-1')}>Về thực đơn</button>
          <button type="button" onClick={onTrack} className={cn(Q.btn, 'flex-1')}>Theo dõi món</button>
        </div>
      </div>
    </Screen>
  );
}

/* ---------------------------------------------------------------- Món của tôi (UC-KH-04 + theo dõi) */

const STATUS_META: Record<OrderItemStatus, { label: string; cls: string }> = {
  pending: { label: 'Chờ chế biến', cls: 'bg-[var(--qr-surface-2)] text-[var(--qr-muted)]' },
  cooking: { label: 'Đang làm', cls: 'bg-[var(--qr-warn-soft)] text-[var(--qr-warn-text)]' },
  done: { label: 'Đã xong', cls: 'bg-[var(--qr-success-soft)] text-[var(--qr-success)]' },
  served: { label: 'Đã mang ra', cls: 'bg-[var(--qr-primary-soft)] text-[var(--qr-primary)]' },
  cancelled: { label: 'Đã hủy', cls: 'bg-[var(--qr-danger-soft)] text-[var(--qr-danger)]' },
};

function Progress({ status }: { status: OrderItemStatus }) {
  if (status === 'cancelled') return null;
  const step = { pending: 1, cooking: 2, done: 3, served: 4 }[status];
  return (
    <div className="mt-2 flex gap-1" aria-hidden>
      {[1, 2, 3].map((s) => <span key={s} className={cn('h-1.5 flex-1 rounded-full', step >= s ? 'bg-[var(--qr-primary)]' : 'bg-[var(--qr-surface-2)]')} />)}
    </div>
  );
}

export function MyOrderScreen({ table, order, support, payment, hasInvoice, onBack, onCancel, onStaff, onPayment }: {
  table: string;
  order: OrderView | null;
  support: CustomerRequest | null;
  payment: CustomerRequest | null;
  hasInvoice: boolean;
  onBack: () => void;
  onCancel: (item: OrderItem) => void;
  onStaff: () => void;
  onPayment: () => void;
}) {
  const stage = orderStage(order);
  const batches = order ? [...new Set(order.items.map((i) => i.batchNo))].sort((a, b) => b - a) : [];
  return (
    <Screen label="Món của tôi">
      <div className="flex-1 overflow-y-auto pb-36">
        {stage ? (
          <div className="relative">
            <StageArt stage={stage} className="h-[260px] w-full rounded-b-[32px]" />
            <button type="button" aria-label="Quay lại" onClick={onBack} className="absolute left-5 top-5 grid h-11 w-11 place-items-center rounded-2xl bg-[var(--qr-surface)] text-[var(--qr-text)] shadow-md"><ArrowLeft size={20} /></button>
            <div className="px-5 pt-5 text-center">
              <h1 className="text-[22px] font-semibold">{STAGE_TEXT[stage].title}</h1>
              <p className="mt-1 text-[13.5px] text-[var(--qr-muted)]">{STAGE_TEXT[stage].sub}</p>
            </div>
          </div>
        ) : (
          <ScreenHeader title="Món của tôi" onBack={onBack} table={table} />
        )}

        <div className="space-y-3 px-5 pt-5">
          {support ? (
            <div className="flex items-center gap-2.5 rounded-2xl bg-[var(--qr-warn-soft)] px-4 py-3 text-[13.5px] text-[var(--qr-warn-text)]">
              <BellRing size={17} className="animate-pulse" />
              {support.status === 'forwarded' && support.assignedName ? `Nhân viên ${support.assignedName} đang đến` : 'Đã gọi nhân viên, vui lòng chờ chút'}
            </div>
          ) : null}
          {order?.locked ? <p className="rounded-2xl bg-[var(--qr-warn-soft)] px-4 py-3 text-[13px] text-[var(--qr-warn-text)]">Bàn đang chờ thanh toán — không gọi thêm hay hủy món được.</p> : null}

          {!order || order.items.length === 0 ? (
            <div className="py-12 text-center">
              <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-[var(--qr-primary-soft)] text-[var(--qr-primary)]"><ChefHat size={30} /></span>
              <p className="mt-4 text-[16px] font-semibold">Bàn chưa gọi món nào</p>
              <p className="mt-1 text-[13px] text-[var(--qr-muted)]">Chọn món ở thực đơn rồi bấm gửi, bếp nhận ngay.</p>
              <button type="button" onClick={onBack} className={cn(Q.btn, 'mt-5 px-6 py-2.5 text-[14px]')}><UtensilsCrossed size={16} />Xem thực đơn</button>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between rounded-2xl bg-[var(--qr-primary)] px-4 py-3.5 text-white">
                <div>
                  <p className="text-[12px] opacity-85">Đơn {order.code} · Bàn {table}</p>
                  <p className="text-[20px] font-bold">{vnd(order.subtotal)}</p>
                </div>
                <p className="text-right text-[12.5px] opacity-90">{order.pendingCount ? `${order.pendingCount} món đang chuẩn bị` : 'Đã chuẩn bị xong'}</p>
              </div>
              {batches.map((b) => {
                const items = order.items.filter((i) => i.batchNo === b);
                return (
                  <div key={b} className={cn(Q.card, 'overflow-hidden')}>
                    <div className="flex items-center gap-1.5 bg-[var(--qr-surface-2)] px-4 py-2 text-[12.5px] text-[var(--qr-muted)]"><Clock3 size={13} />Đợt {b} · {hhmm(items[0].createdAt)}</div>
                    {items.map((i) => (
                      <div key={i.id} className="border-t border-[var(--qr-border)] px-4 py-3 first:border-0">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className={cn('text-[14.5px] font-semibold', i.status === 'cancelled' && 'text-[var(--qr-muted)] line-through')}>{i.qty} × {i.name}</p>
                            {i.note ? <p className="text-[12.5px] text-[var(--qr-muted)]">“{i.note}”</p> : null}
                            {i.status === 'cancelled' && i.cancelReason ? <p className="text-[12.5px] text-[var(--qr-danger)]">{i.cancelSource === 'kitchen' ? 'Bếp báo: ' : ''}{i.cancelReason}</p> : null}
                          </div>
                          <div className="shrink-0 text-right">
                            <span className={cn('inline-block rounded-lg px-2 py-0.5 text-[11.5px] font-semibold', STATUS_META[i.status].cls)}>{STATUS_META[i.status].label}</span>
                            <p className="mt-1 text-[13px] font-semibold">{i.status === 'cancelled' ? '' : vnd(i.price * i.qty)}</p>
                          </div>
                        </div>
                        <Progress status={i.status} />
                        {i.status === 'pending' && !order.locked ? <button type="button" onClick={() => onCancel(i)} className="mt-2 text-[12.5px] font-semibold text-[var(--qr-danger)]">Hủy món</button> : null}
                      </div>
                    ))}
                  </div>
                );
              })}
            </>
          )}
        </div>
      </div>
      <div className="absolute inset-x-0 bottom-0 flex gap-3 border-t border-[var(--qr-border)] bg-[var(--qr-bg)] px-5 pb-[max(16px,env(safe-area-inset-bottom))] pt-3">
        <button type="button" onClick={onStaff} className={cn(Q.btnGhost, 'flex-1', support && 'text-[var(--qr-primary)]')}><BellRing size={17} />{support ? 'Đang chờ NV' : 'Gọi nhân viên'}</button>
        <button type="button" onClick={onPayment} className={cn(Q.btn, 'flex-1')}><ReceiptText size={17} />{hasInvoice ? 'Xem hóa đơn' : payment ? 'Đã yêu cầu' : 'Thanh toán'}</button>
      </div>
    </Screen>
  );
}

