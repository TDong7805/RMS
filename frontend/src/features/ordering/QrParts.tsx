import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { AnimatePresence, motion, useDragControls, useReducedMotion } from 'motion/react';
import { Check, Minus, Plus, X } from '@phosphor-icons/react';
import { cn } from '@/lib/cn';
import { lockScroll } from './scrollLock';
import type { MenuCategory, MenuDish, OrderView } from '@/types';
import { Emoji, dishEmoji, useFly } from './qrMotion';
import { StageLottie, type StageAnim } from './qrScene';

/*
 * Thành phần giao diện của trang đặt món cho khách (QR), theo thiết kế Figma của nhóm + hiệu ứng động.
 * Màu / phông lấy từ biến --qr-* trong qr-theme.css (có bản sáng và tối).
 */

/** "65.000đ" — kiểu hiển thị giá quen thuộc của app đặt đồ ăn. */
export const vnd = (n: number) => `${Math.round(n).toLocaleString('vi-VN')}đ`;
export const hhmm = (iso: string) => new Date(iso).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

/** Lò xo dùng chung: nảy nhẹ, dừng nhanh. */
export const SPRING = { type: 'spring', stiffness: 420, damping: 32, mass: 0.8 } as const;

/** Các lớp dùng chung. */
export const Q = {
  btn: 'inline-flex items-center justify-center gap-2 rounded-2xl bg-[var(--qr-primary)] px-5 py-3.5 text-[15px] font-semibold text-[var(--qr-on-primary)] transition-transform active:scale-[0.97] active:bg-[var(--qr-primary-press)] disabled:opacity-45',
  btnGhost: 'inline-flex items-center justify-center gap-2 rounded-2xl bg-[var(--qr-surface-2)] px-5 py-3.5 text-[15px] font-semibold text-[var(--qr-text)] transition-transform active:scale-[0.97] disabled:opacity-45',
  btnDanger: 'inline-flex items-center justify-center gap-2 rounded-2xl bg-[var(--qr-danger)] px-5 py-3.5 text-[15px] font-semibold text-white transition-transform active:scale-[0.97] disabled:opacity-45',
  card: 'rounded-[20px] border border-[var(--qr-border)] bg-[var(--qr-surface)] shadow-[var(--qr-shadow)]',
  input: 'w-full rounded-2xl border border-[var(--qr-border)] bg-[var(--qr-surface-2)] px-4 py-3 text-[14.5px] text-[var(--qr-text)] outline-none placeholder:text-[var(--qr-muted)] focus:border-[var(--qr-primary)]',
  iconBtn: 'grid h-11 w-11 place-items-center rounded-full bg-[var(--qr-surface-2)] text-[var(--qr-text)] transition-transform active:scale-90',
};

export const isVeg = (d: MenuDish) => d.tags.some((t) => /chay/i.test(t));
export const SPICY_TEXT = ['Không cay', 'Cay nhẹ', 'Cay vừa', 'Rất cay'];

/* ---------------------------------------------------------------- Ảnh món */

/** Ảnh món trên nền xám nhạt; món chưa có ảnh: emoji 3D của danh mục. */
export function DishImage({ dish, categoryName, className, emojiSize = 44, boxRef, soldOut }: {
  dish: Pick<MenuDish, 'name' | 'image'>;
  categoryName?: string;
  className?: string;
  emojiSize?: number;
  boxRef?: RefObject<HTMLDivElement>;
  soldOut?: boolean;
}) {
  const [broken, setBroken] = useState(false);
  const stamp = soldOut ? (
    <span className="absolute inset-0 grid place-items-center bg-black/25">
      <span className="qr-stamp rounded-md border-[2.5px] border-white px-2 py-0.5 text-[13px] font-extrabold tracking-[0.2em] text-white">HẾT</span>
    </span>
  ) : null;
  if (dish.image && !broken) {
    return (
      <div ref={boxRef} className={cn('relative overflow-hidden bg-[var(--qr-surface-2)]', className)}>
        <img src={dish.image} alt={dish.name} loading="lazy" onError={() => setBroken(true)} className="h-full w-full object-cover" />
        {stamp}
      </div>
    );
  }
  return (
    <div ref={boxRef} className={cn('relative grid place-items-center bg-[var(--qr-chip)]', className)} aria-hidden>
      <Emoji name={dishEmoji(dish.name, categoryName)} size={emojiSize} />
      {stamp}
    </div>
  );
}

/* ---------------------------------------------------------------- Số lượng, nhãn */

/** Con số lăn lên / xuống khi đổi. */
export function RollingNumber({ value, className }: { value: number; className?: string }) {
  const prev = useRef(value);
  const dir = value >= prev.current ? 1 : -1;
  useEffect(() => {
    prev.current = value;
  }, [value]);
  return (
    <span className={cn('relative inline-grid overflow-hidden tabular-nums', className)}>
      <AnimatePresence initial={false} mode="popLayout" custom={dir}>
        <motion.span
          key={value}
          custom={dir}
          initial={{ y: dir * 14, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: dir * -14, opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="col-start-1 row-start-1 text-center"
        >
          {value}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

export function Stepper({ value, onChange, min = 0, max = 20, size = 'md' }: { value: number; onChange: (v: number) => void; min?: number; max?: number; size?: 'sm' | 'md' }) {
  const btn = size === 'sm' ? 'h-8 w-8 rounded-full' : 'h-10 w-10 rounded-full';
  return (
    <div className="inline-flex items-center gap-2">
      <motion.button whileTap={{ scale: 0.85 }} type="button" aria-label="Giảm" disabled={value <= min} onClick={() => onChange(value - 1)} className={cn(btn, 'grid place-items-center bg-[var(--qr-primary-soft)] text-[var(--qr-primary)] disabled:opacity-35')}>
        <Minus size={size === 'sm' ? 14 : 16} weight="bold" />
      </motion.button>
      <RollingNumber value={value} className={cn('min-w-[18px] font-semibold', size === 'sm' ? 'text-[14px]' : 'text-[16px]')} />
      <motion.button whileTap={{ scale: 0.85 }} type="button" aria-label="Tăng" disabled={value >= max} onClick={() => onChange(value + 1)} className={cn(btn, 'grid place-items-center bg-[var(--qr-primary)] text-white disabled:opacity-35')}>
        <Plus size={size === 'sm' ? 14 : 16} weight="bold" />
      </motion.button>
    </div>
  );
}

/** Dòng nhãn nhỏ dưới tên món: độ cay (cam), chay (xanh) — chỉ hiện khi có. */
export function DishMeta({ dish }: { dish: MenuDish }) {
  const bits: ReactNode[] = [];
  if (dish.spicyLevel) bits.push(<span key="s" className="font-medium text-[var(--qr-warn-text)]">{SPICY_TEXT[dish.spicyLevel]}</span>);
  if (isVeg(dish)) bits.push(<span key="v" className="font-medium text-[var(--qr-success)]">Chay</span>);
  if (!bits.length) return null;
  return <div className="flex h-4 items-center gap-2.5 text-[11.5px] text-[var(--qr-muted)]">{bits}</div>;
}

/** Nút "+" → biến thành bộ tăng giảm khi món đã vào giỏ. */
function AddOrStepper({ dish, inCart, onAdd, onChangeQty }: { dish: MenuDish; inCart: number; onAdd: () => void; onChangeQty: (q: number) => void }) {
  if (dish.soldOut) return <span className="rounded-full bg-[var(--qr-surface-2)] px-2.5 py-1 text-[11.5px] font-semibold text-[var(--qr-muted)]">Tạm hết</span>;
  return (
    <AnimatePresence initial={false} mode="popLayout">
      {inCart > 0 ? (
        <motion.div key="stepper" initial={{ opacity: 0, scale: 0.6, x: 12 }} animate={{ opacity: 1, scale: 1, x: 0 }} exit={{ opacity: 0, scale: 0.6 }} transition={SPRING}>
          <Stepper value={inCart} onChange={onChangeQty} size="sm" />
        </motion.div>
      ) : (
        <motion.button
          key="add"
          type="button"
          aria-label={`Thêm ${dish.name}`}
          onClick={onAdd}
          initial={{ opacity: 0, scale: 0.6 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.6 }}
          whileTap={{ scale: 0.82 }}
          transition={SPRING}
          className="grid h-8 w-8 place-items-center rounded-full bg-[var(--qr-primary)] text-white shadow-[0_4px_12px_var(--qr-primary-glow)]"
        >
          <Plus size={16} weight="bold" />
        </motion.button>
      )}
    </AnimatePresence>
  );
}

/* ---------------------------------------------------------------- Danh mục: dải vòng tròn cong như bánh xe */

const ARC_DROP = 18; // vòng tròn ở giữa hạ thấp hơn hai bên bao nhiêu px

/**
 * Dải danh mục cong: vòng tròn emoji 3D + tên bên dưới; mục ở giữa hạ thấp, to hơn, có vạch đỏ.
 * Vuốt ngang: bánh xe xoay, mục dừng ở giữa được chọn. Bấm một mục: xoay mục đó vào giữa. Mục đang xem (do cuộn trang) tự xoay vào giữa.
 */
export function CategoryArc({ categories, active, onPick }: { categories: MenuCategory[]; active: string; onPick: (id: string) => void }) {
  const items: MenuCategory[] = [{ id: 'all', name: 'Tất cả', image: null }, ...categories];
  const collage = categories.map((c) => c.image).filter((x): x is string => Boolean(x)).slice(0, 4);
  const scroller = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const quietUntil = useRef(0); // bỏ qua "dừng cuộn" do chính code cuộn
  const settle = useRef<number>();
  const frame = useRef<number>();
  const pickRef = useRef(onPick);
  const activeRef = useRef(active);
  pickRef.current = onPick;
  activeRef.current = active;

  const layout = useCallback(() => {
    const sc = scroller.current;
    if (!sc) return;
    const mid = sc.scrollLeft + sc.clientWidth / 2;
    const radius = sc.clientWidth / 2;
    sc.querySelectorAll<HTMLElement>('[data-chip]').forEach((el) => {
      const c = el.offsetLeft + el.offsetWidth / 2;
      const d = Math.max(-1.3, Math.min(1.3, (c - mid) / radius));
      const k = Math.max(0, 1 - d * d);
      el.style.transform = reduce ? '' : `translate3d(0, ${(ARC_DROP * k).toFixed(1)}px, 0) scale(${(0.9 + 0.16 * k).toFixed(3)})`;
      el.style.opacity = reduce ? '' : String(0.55 + 0.45 * Math.max(0, 1 - Math.abs(d) * 0.8));
    });
  }, [reduce]);

  const centerOn = useCallback((id: string, smooth: boolean) => {
    const sc = scroller.current;
    const el = sc?.querySelector<HTMLElement>(`[data-chip="${id}"]`);
    if (!sc || !el) return;
    quietUntil.current = Date.now() + 900;
    sc.scrollTo({ left: el.offsetLeft + el.offsetWidth / 2 - sc.clientWidth / 2, behavior: smooth && !reduce ? 'smooth' : 'auto' });
  }, [reduce]);

  useLayoutEffect(() => {
    centerOn(activeRef.current, false);
    layout();
  }, [categories.length, centerOn, layout]);

  useEffect(() => {
    centerOn(active, true);
  }, [active, centerOn]);

  useEffect(() => {
    const sc = scroller.current;
    if (!sc) return;
    const onScroll = () => {
      if (frame.current) cancelAnimationFrame(frame.current);
      frame.current = requestAnimationFrame(layout);
      window.clearTimeout(settle.current);
      settle.current = window.setTimeout(() => {
        if (Date.now() < quietUntil.current) return;
        // Khách tự vuốt dải danh mục: mục dừng ở giữa được chọn.
        const mid = sc.scrollLeft + sc.clientWidth / 2;
        let best: { id: string; dist: number } | null = null;
        sc.querySelectorAll<HTMLElement>('[data-chip]').forEach((el) => {
          const dist = Math.abs(el.offsetLeft + el.offsetWidth / 2 - mid);
          if (!best || dist < best.dist) best = { id: el.dataset.chip ?? 'all', dist };
        });
        const picked = (best as { id: string } | null)?.id;
        if (picked && picked !== activeRef.current) pickRef.current(picked);
      }, 160);
    };
    const onResize = () => layout();
    sc.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize);
    return () => {
      sc.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
      window.clearTimeout(settle.current);
    };
  }, [layout]);

  return (
    <div className="relative" style={{ background: 'radial-gradient(ellipse 80% 95% at 50% 0%, var(--qr-arc) 0 62%, transparent 63%)' }}>
      <div ref={scroller} className="qr-arc-scroller flex overflow-x-auto pb-5 pt-2" style={{ paddingInline: 'calc(50% - 41px)' }} role="tablist" aria-label="Danh mục món">
        {items.map((c) => {
          const on = active === c.id;
          return (
            <button
              key={c.id}
              type="button"
              role="tab"
              data-chip={c.id}
              aria-pressed={on}
              aria-selected={on}
              onClick={() => onPick(c.id)}
              className="flex w-[82px] shrink-0 flex-col items-center gap-1.5 will-change-transform"
            >
              <span
                className={cn(
                  'grid h-[66px] w-[66px] place-items-center overflow-hidden rounded-full bg-white transition-shadow duration-300',
                  on ? 'shadow-[0_8px_20px_rgba(60,35,20,0.22),0_0_0_2.5px_var(--qr-primary)]' : 'shadow-[0_3px_10px_rgba(60,20,10,0.12)]',
                )}
              >
                <CategoryPicture category={c} collage={c.id === 'all' ? collage : undefined} />
              </span>
              <span className={cn('line-clamp-2 min-h-[30px] px-0.5 text-center text-[12px] leading-[15px] transition-colors', on ? 'font-semibold text-[var(--qr-primary)]' : 'text-[var(--qr-text)]')}>{c.name}</span>
            </button>
          );
        })}
      </div>
      {/* Vạch chỉ mục đang chọn: cung xám, đoạn giữa đỏ */}
      <svg aria-hidden width="56" height="12" viewBox="0 0 56 12" className="pointer-events-none absolute bottom-1.5 left-1/2 -translate-x-1/2">
        <path d="M3 3 Q28 14 53 3" fill="none" stroke="var(--qr-border)" strokeWidth="3" strokeLinecap="round" />
        <path d="M18 7.1 Q28 9.6 38 7.1" fill="none" stroke="var(--qr-primary)" strokeWidth="3.5" strokeLinecap="round" />
      </svg>
    </div>
  );
}

/**
 * Ảnh trong vòng tròn danh mục: ảnh món tách nền Quản lý tải lên. "Tất cả" ghép 4 ảnh danh mục đầu.
 * Chưa có ảnh thì hiện chữ cái đầu (không dùng emoji / icon).
 */
function CategoryPicture({ category, collage }: { category: MenuCategory; collage?: string[] }) {
  const [broken, setBroken] = useState(false);
  if (collage && collage.length >= 4) {
    return (
      <span className="grid h-full w-full grid-cols-2 gap-[1px] p-2" aria-hidden>
        {collage.map((src) => <img key={src} src={src} alt="" loading="lazy" className="h-full w-full object-contain" />)}
      </span>
    );
  }
  const src = category.image ?? collage?.[0];
  if (src && !broken) {
    return <img src={src} alt="" loading="lazy" draggable={false} onError={() => setBroken(true)} className="h-full w-full object-contain p-1" />;
  }
  return <span aria-hidden className="qr-display text-[26px] font-bold text-[#8e1b22]">{category.name.charAt(0)}</span>;
}

/* ---------------------------------------------------------------- Thẻ món */

interface CardProps {
  dish: MenuDish;
  categoryName?: string;
  inCart: number;
  /** Mở chi tiết; truyền khung ảnh để ảnh phóng to từ đúng chỗ. */
  onOpen: (imageBox: HTMLElement | null) => void;
  onAdd: () => void;
  onChangeQty: (qty: number) => void;
  /** Thay chữ giá (vd. "từ 45.000 ₫" cho thẻ nhóm món có nhiều giá). */
  priceLabel?: string;
  /** Nút + chỉ mở bảng chọn (thẻ nhóm món), chưa thêm gì vào giỏ → không cho ảnh bay vào giỏ. */
  noFly?: boolean;
}

function useCardAdd(dish: MenuDish, categoryName: string | undefined, onAdd: () => void, noFly?: boolean) {
  const img = useRef<HTMLDivElement>(null);
  const { fly } = useFly();
  return {
    img,
    add: () => {
      if (!noFly) fly(img.current, dish.image, dishEmoji(dish.name, categoryName));
      onAdd();
    },
  };
}

/** Thẻ dọc (mục "Bán chạy"): ảnh, hạng, tên, nhãn, giá, nút +. */
/** big: thẻ to trong băng chuyền Bán chạy (nền tối, nhãn vàng đồng "Bán chạy #n", đèn chiếu từ trên). */
export function PopularCard({ dish, categoryName, rank, inCart, onOpen, onAdd, onChangeQty, index = 0, big, priceLabel, noFly }: CardProps & { rank?: number; index?: number; big?: boolean }) {
  const { img, add } = useCardAdd(dish, categoryName, onAdd, noFly);
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '0px -20px' }}
      transition={{ ...SPRING, delay: Math.min(index, 6) * 0.05 }}
      className={cn(Q.card, 'relative flex shrink-0 flex-col overflow-hidden pb-2.5', big ? 'w-[212px] shadow-[0_18px_36px_-14px_rgba(0,0,0,0.8)]' : 'w-[168px]', dish.soldOut && 'opacity-70')}
    >
      <button type="button" onClick={() => onOpen(img.current)} className="relative block" aria-label={`Xem ${dish.name}`}>
        <DishImage dish={dish} categoryName={categoryName} boxRef={img} soldOut={dish.soldOut} className={big ? 'h-[176px] w-full' : 'h-[148px] w-full'} emojiSize={56} />
        {big ? <span aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_55%_at_50%_0%,rgba(255,214,150,0.35),transparent_70%)]" /> : null}
        {dish.image ? <span aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-black/35 to-transparent" /> : null}
        {rank ? (
          big ? (
            <span className="absolute left-2 top-2 rounded-full bg-gradient-to-r from-[#e6c88f] to-[#c9a26b] px-2.5 py-1 text-[11.5px] font-bold text-[#2a1f1a] shadow-md">Bán chạy #{rank}</span>
          ) : (
            <span className="absolute left-2 top-2 rounded-full bg-white/90 px-2 py-0.5 text-[11px] font-bold text-[#8e1b22] shadow-sm">#{rank}</span>
          )
        ) : null}
      </button>
      <button type="button" onClick={() => onOpen(img.current)} className="mt-2.5 px-3 text-left">
        <p className="line-clamp-1 text-[14.5px] font-semibold">{dish.name}</p>
      </button>
      <div className="mt-0.5 h-4 px-3"><DishMeta dish={dish} /></div>
      <div className="mt-2 flex items-center justify-between px-3">
        <span className="text-[15px] font-bold text-[var(--qr-primary)]">{priceLabel ?? vnd(dish.price)}</span>
        <AddOrStepper dish={dish} inCart={inCart} onAdd={add} onChangeQty={onChangeQty} />
      </div>
    </motion.div>
  );
}

/** Dòng món (mục "Tất cả món"): ảnh trái, tên + mô tả + nhãn, giá, nút +. Hiện dần khi cuộn tới. */
/** groupName: món thuộc nhóm hiện riêng (kết quả tìm kiếm) → dòng nhỏ cho biết thuộc nhóm nào. */
export function DishRow({ dish, categoryName, best, inCart, onOpen, onAdd, onChangeQty, priceLabel, noFly, groupName }: CardProps & { best?: boolean; groupName?: string }) {
  const { img, add } = useCardAdd(dish, categoryName, onAdd, noFly);
  return (
    <motion.div
      initial={{ opacity: 0, y: 22 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '0px 0px -30px 0px' }}
      transition={SPRING}
      className={cn(Q.card, 'flex gap-3 p-2.5', dish.soldOut && 'opacity-70')}
    >
      <button type="button" onClick={() => onOpen(img.current)} className="relative shrink-0" aria-label={`Xem ${dish.name}`}>
        <DishImage dish={dish} categoryName={categoryName} boxRef={img} soldOut={dish.soldOut} className="h-[104px] w-[104px] rounded-[16px] shadow-[0_6px_14px_rgba(60,35,20,0.18)]" emojiSize={48} />
        {best ? (
          <span className="absolute bottom-1.5 left-1.5 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-bold text-[#8e1b22] shadow-sm">Bán chạy</span>
        ) : null}
      </button>
      <div className="flex min-w-0 flex-1 flex-col py-0.5">
        <button type="button" onClick={() => onOpen(img.current)} className="text-left">
          <p className="line-clamp-1 text-[15px] font-semibold">{dish.name}</p>
          {groupName ? <p className="text-[12px] font-semibold text-[var(--qr-primary)]">{groupName}</p> : null}
          {dish.description ? <p className="mt-0.5 line-clamp-2 text-[12.5px] leading-snug text-[var(--qr-muted)]">{dish.description}</p> : null}
        </button>
        <div className="mt-1"><DishMeta dish={dish} /></div>
        <div className="mt-auto flex items-center justify-between pt-1.5">
          <span className="text-[15px] font-bold text-[var(--qr-primary)]">{priceLabel ?? vnd(dish.price)}</span>
          <AddOrStepper dish={dish} inCart={inCart} onAdd={add} onChangeQty={onChangeQty} />
        </div>
      </div>
    </motion.div>
  );
}

/* ---------------------------------------------------------------- Tấm trượt từ dưới lên (kéo xuống để đóng) */

export function Sheet({ open, onClose, children, title }: { open: boolean; onClose: () => void; children: ReactNode; title?: string }) {
  useEffect(() => {
    if (!open) return;
    const unlock = lockScroll();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => {
      unlock();
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);
  const drag = useDragControls();
  return (
    <AnimatePresence>
      {open ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true" aria-label={title}>
          <motion.button
            type="button"
            aria-label="Đóng"
            className="absolute inset-0 bg-[var(--qr-overlay)]"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />
          <motion.div
            className="relative flex max-h-[90dvh] w-full max-w-[480px] flex-col overflow-hidden rounded-t-[28px] bg-[var(--qr-bg)]"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={SPRING}
            drag="y"
            dragListener={false}
            dragControls={drag}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.8 }}
            onDragEnd={(_, i) => (i.offset.y > 90 || i.velocity.y > 500) && onClose()}
          >
            <div onPointerDown={(e) => drag.start(e)} className="shrink-0 cursor-grab touch-none">
              <span className="mx-auto mt-2.5 block h-1 w-10 rounded-full bg-[var(--qr-border)]" aria-hidden />
              {title ? (
                <div className="flex items-center justify-between px-5 pb-2 pt-3">
                  <p className="text-[18px] font-semibold">{title}</p>
                  <button type="button" aria-label="Đóng" onClick={onClose} onPointerDown={(e) => e.stopPropagation()} className="grid h-9 w-9 place-items-center rounded-full bg-[var(--qr-surface-2)]"><X size={16} weight="bold" /></button>
                </div>
              ) : <div className="h-2" />}
            </div>
            {children}
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  );
}

/* ---------------------------------------------------------------- Sắp xếp & lọc */

export type SortKey = 'default' | 'best' | 'priceAsc' | 'priceDesc';
export type FilterKey = 'best' | 'mild' | 'spicy' | 'noAllergen';
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
  { key: 'mild', label: 'Không cay' },
  { key: 'spicy', label: 'Có cay' },
  { key: 'noAllergen', label: 'Không chất gây dị ứng' },
];

/** Áp sắp xếp + lọc lên danh sách món (rankOf: hạng bán chạy, 1 = nhất). */
export function applyMenuFilter(dishes: MenuDish[], f: MenuFilter, rankOf: Map<string, number>): MenuDish[] {
  let list = dishes.filter((d) =>
    f.tags.every((t) =>
      t === 'best' ? rankOf.has(d.id) : t === 'mild' ? d.spicyLevel === 0 : t === 'spicy' ? d.spicyLevel > 0 : d.allergens.length === 0,
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
      <div className="overflow-y-auto overscroll-contain px-5 pb-2">
        <p className="mb-2 text-[13px] text-[var(--qr-muted)]">Sắp xếp</p>
        <div className="space-y-2">
          {SORTS.map((s) => {
            const on = draft.sort === s.key;
            return (
              <button key={s.key} type="button" role="radio" aria-checked={on} onClick={() => setDraft((d) => ({ ...d, sort: s.key }))} className={cn('flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left text-[14.5px] transition-colors', on ? 'bg-[var(--qr-primary-soft)] font-semibold' : 'bg-[var(--qr-surface-2)]')}>
                {s.label}
                <AnimatePresence>
                  {on ? (
                    <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} transition={SPRING} className="grid h-5 w-5 place-items-center rounded-full bg-[var(--qr-primary)] text-white"><Check size={12} weight="bold" /></motion.span>
                  ) : null}
                </AnimatePresence>
              </button>
            );
          })}
        </div>
        <p className="mb-2 mt-5 text-[13px] text-[var(--qr-muted)]">Lọc theo</p>
        <div className="flex flex-wrap gap-2">
          {TAGS.map((t) => {
            const on = draft.tags.includes(t.key);
            return (
              <motion.button whileTap={{ scale: 0.92 }} key={t.key} type="button" aria-pressed={on} onClick={() => toggle(t.key)} className={cn('rounded-full px-3.5 py-2 text-[13.5px] font-medium transition-colors', on ? 'bg-[var(--qr-primary)] text-white' : 'bg-[var(--qr-surface-2)] text-[var(--qr-text)]')}>
                {t.label}
              </motion.button>
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

export type Stage = 'sent' | 'cooking' | 'ready' | 'served';
export const STAGES: Stage[] = ['sent', 'cooking', 'ready', 'served'];

/** Giai đoạn chung của các món chưa hủy trong đơn (theo trạng thái món thật). */
export function orderStage(order: OrderView | null): Stage | null {
  const items = (order?.items ?? []).filter((i) => i.status !== 'cancelled');
  if (!items.length) return null;
  const n = (s: string) => items.filter((i) => i.status === s).length;
  if (n('served') === items.length) return 'served';
  if (n('unconfirmed') + n('pending') + n('cooking') === 0) return 'ready';
  // Còn món chờ / đang làm: bếp đã bắt tay (có món đang làm hoặc đã xong) → Đang nấu, chưa thì Đã gửi.
  if (n('cooking') + n('done') + n('served') > 0) return 'cooking';
  return 'sent';
}

export const STAGE_TEXT: Record<Stage, { title: string; sub: string; short: string }> = {
  sent: { title: 'Đã gửi món!', sub: 'Nhân viên sẽ xác nhận với bạn rồi chuyển món xuống bếp.', short: 'Đã gửi' },
  cooking: { title: 'Bếp đang chuẩn bị món', sub: 'Nhân viên sẽ mang món ra bàn khi xong.', short: 'Đang nấu' },
  ready: { title: 'Món đã sẵn sàng', sub: 'Nhân viên đang mang món ra bàn của bạn.', short: 'Sẵn sàng' },
  served: { title: 'Chúc ngon miệng!', sub: 'Tất cả món đã được mang ra. Cần thêm gì cứ gọi món nhé.', short: 'Đã mang ra' },
};

/** Tranh động theo giai đoạn của đơn (Lottie tô màu Royal Beef, xem qrScene.tsx). */
export function StageArt({ art, className, compact, size }: { art: StageAnim; className?: string; compact?: boolean; size?: number }) {
  return <StageLottie name={art} className={className} compact={compact} size={size} />;
}
