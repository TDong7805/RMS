import { useEffect, useState, type ReactNode } from 'react';
import {
  Beef,
  Check,
  ChefHat,
  Clock3,
  CookingPot,
  CupSoda,
  Flame,
  HandPlatter,
  IceCreamCone,
  LayoutGrid,
  Leaf,
  Minus,
  Plus,
  Salad,
  Soup,
  Sparkles,
  UtensilsCrossed,
  X,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import type { MenuCategory, MenuDish, OrderView } from '@/types';

/*
 * Thành phần giao diện của trang đặt món cho khách (QR), theo thiết kế Figma của nhóm.
 * Màu / phông lấy từ biến --qr-* trong qr-theme.css (có bản sáng và tối).
 */

/** "65.000đ" — kiểu hiển thị giá quen thuộc của app đặt đồ ăn. */
export const vnd = (n: number) => `${Math.round(n).toLocaleString('vi-VN')}đ`;
export const hhmm = (iso: string) => new Date(iso).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

/** Các lớp dùng chung. */
export const Q = {
  btn: 'inline-flex items-center justify-center gap-2 rounded-2xl bg-[var(--qr-primary)] px-5 py-3.5 text-[15px] font-semibold text-[var(--qr-on-primary)] active:bg-[var(--qr-primary-press)] disabled:opacity-45',
  btnGhost: 'inline-flex items-center justify-center gap-2 rounded-2xl bg-[var(--qr-surface-2)] px-5 py-3.5 text-[15px] font-semibold text-[var(--qr-text)] disabled:opacity-45',
  btnDanger: 'inline-flex items-center justify-center gap-2 rounded-2xl bg-[var(--qr-danger)] px-5 py-3.5 text-[15px] font-semibold text-white disabled:opacity-45',
  card: 'rounded-[20px] border border-[var(--qr-border)] bg-[var(--qr-surface)] shadow-[var(--qr-shadow)]',
  input: 'w-full rounded-2xl border border-[var(--qr-border)] bg-[var(--qr-surface-2)] px-4 py-3 text-[14.5px] text-[var(--qr-text)] outline-none placeholder:text-[var(--qr-muted)] focus:border-[var(--qr-primary)]',
  iconBtn: 'grid h-11 w-11 place-items-center rounded-2xl bg-[var(--qr-surface-2)] text-[var(--qr-text)]',
};

/* ---------------------------------------------------------------- Danh mục: biểu tượng theo tên */

// Thứ tự quan trọng: "Tráng miệng" chứa "mi" (giống "mì"); đồ uống / lẩu xét trước nhóm cơm – mì và món chính.
const ICONS: { match: RegExp; icon: LucideIcon }[] = [
  { match: /tr[aá]ng mi[eệ]ng|ch[eè]|kem|b[aá]nh ng[oọ]t/i, icon: IceCreamCone },
  { match: /u[oố]ng|n[uư][oớ]c|tr[aà] |c[aà] ph[eê]|bia|sinh t[oố]/i, icon: CupSoda },
  { match: /l[aẩ]u/i, icon: CookingPot },
  { match: /khai v|g[oỏ]i|salad/i, icon: Salad },
  { match: /c[oơ]m|m[iì]|ph[oở]|b[uú]n|mi[eế]n/i, icon: Soup },
  { match: /ch[ií]nh|b[oò]|th[iị]t|n[uư][oớ]ng/i, icon: Beef },
];
export const categoryIcon = (name: string | undefined): LucideIcon => ICONS.find((m) => m.match.test(name ?? ''))?.icon ?? UtensilsCrossed;

export const isVeg = (d: MenuDish) => d.tags.some((t) => /chay/i.test(t));

/* ---------------------------------------------------------------- Ảnh món */

/** Ảnh món trên nền xám nhạt; món chưa có ảnh: biểu tượng danh mục màu chính. */
export function DishImage({ dish, categoryName, className, iconSize = 34, fit = 'cover' }: {
  dish: Pick<MenuDish, 'name' | 'image'>;
  categoryName?: string;
  className?: string;
  iconSize?: number;
  fit?: 'cover' | 'contain';
}) {
  const [broken, setBroken] = useState(false);
  if (dish.image && !broken) {
    return (
      <div className={cn('overflow-hidden bg-[var(--qr-surface-2)]', className)}>
        <img src={dish.image} alt={dish.name} loading="lazy" onError={() => setBroken(true)} className={cn('h-full w-full', fit === 'cover' ? 'object-cover' : 'object-contain')} />
      </div>
    );
  }
  const Icon = categoryIcon(categoryName);
  return (
    <div className={cn('grid place-items-center bg-[var(--qr-surface-2)]', className)} aria-hidden>
      <span className="grid place-items-center rounded-full bg-[var(--qr-primary-soft)] text-[var(--qr-primary)]" style={{ width: iconSize * 1.9, height: iconSize * 1.9 }}>
        <Icon size={iconSize} strokeWidth={1.7} />
      </span>
    </div>
  );
}

/* ---------------------------------------------------------------- Số lượng, nhãn */

export function Stepper({ value, onChange, min = 0, max = 20, size = 'md' }: { value: number; onChange: (v: number) => void; min?: number; max?: number; size?: 'sm' | 'md' }) {
  const btn = size === 'sm' ? 'h-8 w-8 rounded-[10px]' : 'h-10 w-10 rounded-xl';
  return (
    <div className="inline-flex items-center gap-2.5">
      <button type="button" aria-label="Giảm" disabled={value <= min} onClick={() => onChange(value - 1)} className={cn(btn, 'grid place-items-center bg-[var(--qr-primary-soft)] text-[var(--qr-primary)] disabled:opacity-35')}>
        <Minus size={size === 'sm' ? 15 : 17} strokeWidth={2.4} />
      </button>
      <span className={cn('min-w-[18px] text-center font-semibold tabular-nums', size === 'sm' ? 'text-[14px]' : 'text-[16px]')}>{value}</span>
      <button type="button" aria-label="Tăng" disabled={value >= max} onClick={() => onChange(value + 1)} className={cn(btn, 'grid place-items-center bg-[var(--qr-primary)] text-white disabled:opacity-35')}>
        <Plus size={size === 'sm' ? 15 : 17} strokeWidth={2.4} />
      </button>
    </div>
  );
}

export function SpicyMark({ level, size = 12 }: { level: number; size?: number }) {
  if (!level) return null;
  return (
    <span className="inline-flex items-center gap-0.5 text-[var(--qr-accent)]" aria-label={`Độ cay ${level}/3`}>
      {Array.from({ length: level }).map((_, i) => <Flame key={i} size={size} fill="currentColor" />)}
    </span>
  );
}

/** Dòng nhãn nhỏ dưới tên món (cay / chay / dị ứng), thay cho "650 kcal" trong thiết kế. */
export function DishMeta({ dish }: { dish: MenuDish }) {
  const bits: ReactNode[] = [];
  if (dish.spicyLevel) bits.push(<span key="s" className="inline-flex items-center gap-1"><SpicyMark level={dish.spicyLevel} size={11} />{['', 'Cay nhẹ', 'Cay vừa', 'Rất cay'][dish.spicyLevel]}</span>);
  if (isVeg(dish)) bits.push(<span key="v" className="inline-flex items-center gap-1 text-[var(--qr-success)]"><Leaf size={11} />Chay</span>);
  if (!bits.length) bits.push(<span key="n" className="inline-flex items-center gap-1"><Flame size={11} className="text-[var(--qr-accent)]" />{dish.allergens.length ? `${dish.allergens.length} chất dị ứng` : 'Không cay'}</span>);
  return <div className="flex h-4 items-center gap-2.5 text-[11.5px] text-[var(--qr-muted)]">{bits}</div>;
}

function AddOrStepper({ dish, inCart, onAdd, onChangeQty }: { dish: MenuDish; inCart: number; onAdd: () => void; onChangeQty: (q: number) => void }) {
  if (dish.soldOut) return <span className="rounded-lg bg-[var(--qr-surface-2)] px-2 py-1 text-[11.5px] font-semibold text-[var(--qr-muted)]">Tạm hết</span>;
  return inCart > 0 ? (
    <Stepper value={inCart} onChange={onChangeQty} size="sm" />
  ) : (
    <button type="button" aria-label={`Thêm ${dish.name}`} onClick={onAdd} className="grid h-8 w-8 place-items-center rounded-[10px] bg-[var(--qr-primary)] text-white active:scale-90">
      <Plus size={17} strokeWidth={2.4} />
    </button>
  );
}

/* ---------------------------------------------------------------- Danh mục dạng viên */

export function CategoryPills({ categories, active, onPick, imageOf }: {
  categories: MenuCategory[];
  active: string;
  onPick: (id: string) => void;
  imageOf: (categoryId: string) => string | null;
}) {
  const all = [{ id: 'all', name: 'Tất cả' }, ...categories];
  return (
    <div className="no-scrollbar flex gap-2.5 overflow-x-auto px-5 py-3">
      {all.map((c) => {
        const on = active === c.id;
        const img = c.id === 'all' ? null : imageOf(c.id);
        const Icon = c.id === 'all' ? LayoutGrid : categoryIcon(c.name);
        return (
          <button
            key={c.id}
            type="button"
            data-chip={c.id}
            aria-pressed={on}
            onClick={() => onPick(c.id)}
            className={cn('inline-flex shrink-0 items-center gap-2 rounded-2xl py-1.5 pl-1.5 pr-4 text-[14px] font-medium transition-colors', on ? 'bg-[var(--qr-primary)] text-white' : 'bg-[var(--qr-surface-2)] text-[var(--qr-text)]')}
          >
            {img ? (
              <img src={img} alt="" className="h-8 w-8 rounded-full object-cover" />
            ) : (
              <span className={cn('grid h-8 w-8 place-items-center rounded-full', on ? 'bg-white/20' : 'bg-[var(--qr-primary-soft)] text-[var(--qr-primary)]')}><Icon size={16} /></span>
            )}
            {c.name}
          </button>
        );
      })}
    </div>
  );
}

/* ---------------------------------------------------------------- Thẻ món */

/** Thẻ dọc (mục "Bán chạy"): ảnh trên nền xám, tên, nhãn, giá, nút +. */
export function PopularCard({ dish, categoryName, rank, inCart, onOpen, onAdd, onChangeQty }: {
  dish: MenuDish;
  categoryName?: string;
  rank?: number;
  inCart: number;
  onOpen: () => void;
  onAdd: () => void;
  onChangeQty: (qty: number) => void;
}) {
  return (
    <div className={cn(Q.card, 'flex w-[168px] shrink-0 flex-col p-2.5', dish.soldOut && 'opacity-60')}>
      <button type="button" onClick={onOpen} className="relative block" aria-label={`Xem ${dish.name}`}>
        <DishImage dish={dish} categoryName={categoryName} className="h-[140px] w-full rounded-2xl" iconSize={30} />
        {rank ? <span className="absolute left-2 top-2 rounded-lg bg-[var(--qr-surface)] px-1.5 py-0.5 text-[11px] font-bold text-[var(--qr-primary)] shadow-sm">#{rank}</span> : null}
      </button>
      <button type="button" onClick={onOpen} className="mt-2.5 text-left">
        <p className="line-clamp-1 text-[15px] font-semibold">{dish.name}</p>
      </button>
      <div className="mt-0.5"><DishMeta dish={dish} /></div>
      <div className="mt-2.5 flex items-center justify-between">
        <span className="text-[15px] font-bold text-[var(--qr-primary)]">{vnd(dish.price)}</span>
        <AddOrStepper dish={dish} inCart={inCart} onAdd={onAdd} onChangeQty={onChangeQty} />
      </div>
    </div>
  );
}

/** Dòng món (mục "Tất cả món"): ảnh trái, tên + mô tả + nhãn, giá, nút +. */
export function DishRow({ dish, categoryName, best, inCart, onOpen, onAdd, onChangeQty }: {
  dish: MenuDish;
  categoryName?: string;
  best?: boolean;
  inCart: number;
  onOpen: () => void;
  onAdd: () => void;
  onChangeQty: (qty: number) => void;
}) {
  return (
    <div className={cn(Q.card, 'flex gap-3 p-2.5', dish.soldOut && 'opacity-60')}>
      <button type="button" onClick={onOpen} className="relative shrink-0" aria-label={`Xem ${dish.name}`}>
        <DishImage dish={dish} categoryName={categoryName} className="h-[96px] w-[96px] rounded-2xl" iconSize={26} />
        {best ? <span className="absolute bottom-1.5 left-1.5 inline-flex items-center gap-0.5 rounded-md bg-[var(--qr-primary)] px-1.5 py-0.5 text-[10px] font-semibold text-white"><Flame size={10} fill="currentColor" />Bán chạy</span> : null}
      </button>
      <div className="flex min-w-0 flex-1 flex-col py-0.5">
        <button type="button" onClick={onOpen} className="text-left">
          <p className="line-clamp-1 text-[15px] font-semibold">{dish.name}</p>
          {dish.description ? <p className="mt-0.5 line-clamp-1 text-[12.5px] text-[var(--qr-muted)]">{dish.description}</p> : null}
        </button>
        <div className="mt-1"><DishMeta dish={dish} /></div>
        <div className="mt-auto flex items-center justify-between pt-1.5">
          <span className="text-[15px] font-bold text-[var(--qr-primary)]">{vnd(dish.price)}</span>
          <AddOrStepper dish={dish} inCart={inCart} onAdd={onAdd} onChangeQty={onChangeQty} />
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- Tấm trượt từ dưới lên */

export function Sheet({ open, onClose, children, title }: { open: boolean; onClose: () => void; children: ReactNode; title?: string }) {
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
      <button type="button" aria-label="Đóng" className="absolute inset-0 bg-[var(--qr-overlay)]" onClick={onClose} />
      <div className="relative flex max-h-[90dvh] w-full max-w-[480px] flex-col overflow-hidden rounded-t-[28px] bg-[var(--qr-bg)] animate-in slide-in-from-bottom">
        <span className="mx-auto mt-2.5 h-1 w-10 shrink-0 rounded-full bg-[var(--qr-border)]" aria-hidden />
        {title ? (
          <div className="flex items-center justify-between px-5 pb-2 pt-3">
            <p className="text-[18px] font-semibold">{title}</p>
            <button type="button" aria-label="Đóng" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-xl bg-[var(--qr-surface-2)]"><X size={17} /></button>
          </div>
        ) : null}
        {children}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- Sắp xếp & lọc */

export type SortKey = 'default' | 'best' | 'priceAsc' | 'priceDesc';
export type FilterKey = 'best' | 'veg' | 'mild' | 'spicy' | 'noAllergen';
export interface MenuFilter {
  sort: SortKey;
  tags: FilterKey[];
}
export const EMPTY_FILTER: MenuFilter = { sort: 'default', tags: [] };

const SORTS: { key: SortKey; label: string }[] = [
  { key: 'default', label: 'Mặc định (theo thực đơn)' },
  { key: 'best', label: 'Bán chạy nhất' },
  { key: 'priceAsc', label: 'Giá: thấp → cao' },
  { key: 'priceDesc', label: 'Giá: cao → thấp' },
];
const TAGS: { key: FilterKey; label: string }[] = [
  { key: 'best', label: 'Bán chạy' },
  { key: 'veg', label: 'Món chay' },
  { key: 'mild', label: 'Không cay' },
  { key: 'spicy', label: 'Có cay' },
  { key: 'noAllergen', label: 'Không chất gây dị ứng' },
];

/** Áp sắp xếp + lọc lên danh sách món (rankOf: hạng bán chạy, 1 = nhất). */
export function applyMenuFilter(dishes: MenuDish[], f: MenuFilter, rankOf: Map<string, number>): MenuDish[] {
  let list = dishes.filter((d) =>
    f.tags.every((t) =>
      t === 'best' ? rankOf.has(d.id) : t === 'veg' ? isVeg(d) : t === 'mild' ? d.spicyLevel === 0 : t === 'spicy' ? d.spicyLevel > 0 : d.allergens.length === 0,
    ),
  );
  if (f.sort === 'priceAsc') list = [...list].sort((a, b) => a.price - b.price);
  if (f.sort === 'priceDesc') list = [...list].sort((a, b) => b.price - a.price);
  if (f.sort === 'best') list = [...list].sort((a, b) => (rankOf.get(a.id) ?? 999) - (rankOf.get(b.id) ?? 999));
  return list;
}

export function FilterSheet({ open, value, onClose, onApply }: { open: boolean; value: MenuFilter; onClose: () => void; onApply: (f: MenuFilter) => void }) {
  const [draft, setDraft] = useState(value);
  useEffect(() => {
    if (open) setDraft(value);
  }, [open, value]);
  const toggle = (k: FilterKey) => setDraft((d) => ({ ...d, tags: d.tags.includes(k) ? d.tags.filter((x) => x !== k) : [...d.tags, k] }));
  return (
    <Sheet open={open} onClose={onClose} title="Sắp xếp & lọc">
      <div className="overflow-y-auto px-5 pb-2">
        <p className="mb-2 text-[13px] text-[var(--qr-muted)]">Sắp xếp</p>
        <div className="space-y-2">
          {SORTS.map((s) => {
            const on = draft.sort === s.key;
            return (
              <button key={s.key} type="button" role="radio" aria-checked={on} onClick={() => setDraft((d) => ({ ...d, sort: s.key }))} className={cn('flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left text-[14.5px]', on ? 'bg-[var(--qr-primary-soft)] font-semibold' : 'bg-[var(--qr-surface-2)]')}>
                {s.label}
                {on ? <span className="grid h-5 w-5 place-items-center rounded-full bg-[var(--qr-primary)] text-white"><Check size={13} strokeWidth={3} /></span> : null}
              </button>
            );
          })}
        </div>
        <p className="mb-2 mt-5 text-[13px] text-[var(--qr-muted)]">Lọc theo</p>
        <div className="flex flex-wrap gap-2">
          {TAGS.map((t) => {
            const on = draft.tags.includes(t.key);
            return (
              <button key={t.key} type="button" aria-pressed={on} onClick={() => toggle(t.key)} className={cn('rounded-xl px-3.5 py-2 text-[13.5px] font-medium', on ? 'bg-[var(--qr-primary)] text-white' : 'bg-[var(--qr-surface-2)] text-[var(--qr-text)]')}>
                {t.label}
              </button>
            );
          })}
        </div>
      </div>
      <div className="flex gap-3 px-5 pb-[max(20px,env(safe-area-inset-bottom))] pt-4">
        <button type="button" onClick={() => setDraft(EMPTY_FILTER)} className={cn(Q.btnGhost, 'flex-1')}>Bỏ lọc</button>
        <button type="button" onClick={() => onApply(draft)} className={cn(Q.btn, 'flex-1')}>Áp dụng</button>
      </div>
    </Sheet>
  );
}

/* ---------------------------------------------------------------- Theo dõi món: giai đoạn của đơn */

export type Stage = 'sent' | 'cooking' | 'almost' | 'ready' | 'served';

/** Giai đoạn chung của các món chưa hủy trong đơn (theo trạng thái món thật). */
export function orderStage(order: OrderView | null): Stage | null {
  const items = (order?.items ?? []).filter((i) => i.status !== 'cancelled');
  if (!items.length) return null;
  const n = (s: string) => items.filter((i) => i.status === s).length;
  if (n('served') === items.length) return 'served';
  if (n('pending') + n('cooking') === 0) return 'ready';
  if (n('done') + n('served') > 0) return 'almost';
  if (n('cooking') > 0) return 'cooking';
  return 'sent';
}

export const STAGE_TEXT: Record<Stage, { title: string; sub: string }> = {
  sent: { title: 'Đã gửi tới bếp!', sub: 'Bếp đã nhận món, sắp bắt tay chế biến.' },
  cooking: { title: 'Bếp đang chuẩn bị món', sub: 'Nhân viên sẽ mang món ra bàn khi xong.' },
  almost: { title: 'Món sắp xong rồi', sub: 'Một số món đã xong, các món còn lại đang làm.' },
  ready: { title: 'Món đã sẵn sàng', sub: 'Nhân viên đang mang món ra bàn của bạn.' },
  served: { title: 'Chúc ngon miệng!', sub: 'Tất cả món đã được mang ra. Cần thêm gì cứ gọi món nhé.' },
};

const STAGE_ICON: Record<Stage, LucideIcon> = { sent: ChefHat, cooking: CookingPot, almost: Clock3, ready: HandPlatter, served: Sparkles };

/**
 * Tranh minh họa giai đoạn: dùng file /qr/tracking/{giai-đoạn}.png nếu có (tranh xuất từ Figma đặt trong
 * frontend/public/qr/tracking), chưa có file thì dùng minh họa đơn giản (biểu tượng lớn trên nền đỏ).
 */
export function StageArt({ stage, className }: { stage: Stage; className?: string }) {
  const [missing, setMissing] = useState(false);
  const Icon = STAGE_ICON[stage];
  if (!missing) {
    return (
      <div className={cn('qr-pattern overflow-hidden', className)}>
        <img src={`/qr/tracking/${stage}.png`} alt="" onError={() => setMissing(true)} className="h-full w-full object-cover" />
      </div>
    );
  }
  return (
    <div className={cn('qr-pattern grid place-items-center overflow-hidden', className)} aria-hidden>
      <span className="grid h-32 w-32 place-items-center rounded-full bg-white/15 ring-8 ring-white/10">
        <Icon size={64} strokeWidth={1.5} className="text-white" />
      </span>
    </div>
  );
}
