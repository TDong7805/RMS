import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { AnimatePresence, motion, useDragControls, useReducedMotion, useScroll, useTransform } from 'motion/react';
import { ArrowLeft, ArrowRight, BellRinging, CaretDown, Check, CornersOut, NotePencil, Receipt, X } from '@phosphor-icons/react';
import { DishImage, PopularCard, Q, SPICY_TEXT, SPRING, STAGES, STAGE_TEXT, StageArt, Stepper, isVeg, orderStage, hhmm, vnd, type Stage } from '@/features/ordering/QrParts';
import { AnimatedNumber, Emoji, Lottie } from '@/features/ordering/qrMotion';
import { buildNote, dishOptions } from '@/features/ordering/dishOptions';
import { cn } from '@/lib/cn';
import { lockScroll } from '@/features/ordering/scrollLock';
import type { CartLine, CustomerRequest, MenuDish, OrderItem, OrderItemStatus, OrderView } from '@/types';

/* Màn hình toàn trang của trang đặt món: chi tiết món, giỏ món, đã gửi bếp, món của tôi (theo dõi món). */

const lockBody = lockScroll;

/** Kéo phần đầu màn hình xuống để đóng (do Screen cung cấp cho ScreenHeader). */
const DragStart = createContext<((e: ReactPointerEvent) => void) | null>(null);

/** Khung màn hình trượt từ dưới lên, phủ cột giữa như điện thoại; kéo phần đầu xuống để đóng. */
export function Screen({ children, label, onClose }: { children: ReactNode; label: string; onClose?: () => void }) {
  useEffect(lockBody, []);
  const drag = useDragControls();
  const start = useCallback((e: ReactPointerEvent) => drag.start(e), [drag]);
  return (
    <motion.div className="fixed inset-0 z-40" role="dialog" aria-modal="true" aria-label={label} initial={{ backgroundColor: 'rgba(0,0,0,0)' }} animate={{ backgroundColor: 'rgba(0,0,0,0.35)' }} exit={{ backgroundColor: 'rgba(0,0,0,0)' }}>
      <motion.div
        className="relative mx-auto flex h-full max-w-[480px] flex-col overflow-hidden bg-[var(--qr-bg)]"
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={SPRING}
        drag={onClose ? 'y' : false}
        dragListener={false}
        dragControls={drag}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0, bottom: 0.85 }}
        onDragEnd={(_, i) => onClose && (i.offset.y > 120 || i.velocity.y > 600) && onClose()}
      >
        <DragStart.Provider value={onClose ? start : null}>{children}</DragStart.Provider>
      </motion.div>
    </motion.div>
  );
}

/** Đầu màn hình: vạch kéo, nút quay lại + tiêu đề + (bên phải) "Bạn đang ngồi tại / Bàn". */
export function ScreenHeader({ title, onBack, table, right }: { title: string; onBack: () => void; table?: string; right?: ReactNode }) {
  const dragStart = useContext(DragStart);
  return (
    <header onPointerDown={(e) => dragStart?.(e)} className={cn('shrink-0 px-5 pb-3 pt-2', dragStart && 'cursor-grab touch-none')}>
      <span className="mx-auto mb-2 block h-1 w-10 rounded-full bg-[var(--qr-border)]" aria-hidden />
      <div className="flex items-center gap-3">
        <button type="button" aria-label="Quay lại" onClick={onBack} onPointerDown={(e) => e.stopPropagation()} className={Q.iconBtn}><ArrowLeft size={20} weight="bold" /></button>
        <h1 className="flex-1 text-[19px] font-semibold">{title}</h1>
        {right ?? (table ? (
          <div className="text-right leading-tight">
            <p className="text-[11px] text-[var(--qr-muted)]">Bạn đang ngồi tại</p>
            <p className="text-[13.5px] font-semibold">Bàn {table}</p>
          </div>
        ) : null)}
      </div>
    </header>
  );
}

/* ---------------------------------------------------------------- Chi tiết món (UC-KH-02) */

/** Hiện lần lượt từng khối nội dung khi màn chi tiết mở. */
const STAGGER = { show: { transition: { staggerChildren: 0.045, delayChildren: 0.14 } } };
const RISE = { hide: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 380, damping: 30 } } } as const;
const TOP_H = 300;

/**
 * Chi tiết món: bảng trượt từ dưới lên; phía trên là ảnh món làm mờ làm nền, ảnh món bo tròn nổi ở giữa (phóng nhẹ khi mở,
 * thu nhỏ khi cuộn); bên dưới là các khối: tên + giá, thông tin, Độ chín / Sốt (bít tết), thành phần, dị ứng, ghi chú
 * theo loại món (dishOptions). Bấm "Thêm": nút đổi "Đã thêm" rồi màn thu xuống — món bay vào giỏ sau khi màn
 * đã đóng (do trang gọi), để hai hiệu ứng không chạy chồng gây giật.
 */
export function DishDetailScreen({ dish, categoryName, best, onBack, onAdd, addonSlot }: {
  dish: MenuDish;
  categoryName?: string;
  best?: number;
  onBack: () => void;
  onAdd: (dish: MenuDish, qty: number, note: string) => void;
  /** Hàng "Gọi thêm cho món này" (món gọi thêm thêm vào giỏ thành dòng riêng). */
  addonSlot?: ReactNode;
}) {
  useEffect(lockBody, []);
  const reduce = useReducedMotion();
  const drag = useDragControls();
  const opts = useMemo(() => dishOptions(categoryName, dish.name), [categoryName, dish.name]);
  const [chosen, setChosen] = useState<Record<string, string>>(() => Object.fromEntries(opts.groups.map((g) => [g.key, g.initial])));
  const [qty, setQty] = useState(1);
  const [picked, setPicked] = useState<string[]>([]);
  const [extra, setExtra] = useState('');
  const [extraOpen, setExtraOpen] = useState(false);
  const [added, setAdded] = useState(false);
  const [zoom, setZoom] = useState(false);
  const note = buildNote(opts.groups, chosen, picked, extra);
  const toggle = (n: string) => setPicked((p) => (p.includes(n) ? p.filter((x) => x !== n) : [...p, n]));
  const ingredients = (dish.ingredients ?? '').split(/[,;\n]/).map((s) => s.trim()).filter(Boolean);
  const meta = [categoryName, SPICY_TEXT[dish.spicyLevel], isVeg(dish) ? 'Món chay' : ''].filter(Boolean);

  const scroller = useRef<HTMLDivElement>(null);
  const { scrollY } = useScroll({ container: scroller });
  const cardScale = useTransform(scrollY, [-120, 0, 240], [1.08, 1, 0.84]);
  const cardY = useTransform(scrollY, [0, 240], [0, 40]);
  const backdropOpacity = useTransform(scrollY, [0, 220], [1, 0.35]);
  const miniOpacity = useTransform(scrollY, [200, 260], [0, 1]);

  const add = () => {
    if (added) return;
    setAdded(true);
    window.setTimeout(() => onAdd(dish, qty, note.slice(0, 200)), reduce ? 0 : 320);
  };

  return (
    <motion.div className="fixed inset-0 z-40" role="dialog" aria-modal="true" aria-label={dish.name} initial={{ backgroundColor: 'rgba(0,0,0,0)' }} animate={{ backgroundColor: 'rgba(0,0,0,0.45)' }} exit={{ backgroundColor: 'rgba(0,0,0,0)' }} transition={{ duration: 0.25 }}>
      <motion.div
        className="relative mx-auto h-full max-w-[480px] overflow-hidden bg-[var(--qr-bg)]"
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%', transition: { duration: 0.26, ease: [0.4, 0, 1, 1] } }}
        transition={{ type: 'spring', stiffness: 300, damping: 34 }}
        drag="y"
        dragListener={false}
        dragControls={drag}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0, bottom: 0.85 }}
        onDragEnd={(_, i) => (i.offset.y > 120 || i.velocity.y > 600) && onBack()}
      >
        {/* Nền: ảnh món làm mờ + phủ tối dần xuống màu nền */}
        <motion.div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 overflow-hidden" style={{ height: TOP_H + 40, opacity: backdropOpacity }}>
          {dish.image ? (
            <img src={dish.image} alt="" className="absolute inset-0 h-full w-full scale-125 object-cover blur-2xl saturate-150" />
          ) : (
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,#7a2a22,#2a1410)]" />
          )}
          <div className="absolute inset-0 bg-gradient-to-b from-black/35 via-black/10 to-[var(--qr-bg)]" />
        </motion.div>

        {/* Thanh nhỏ ghi tên món khi đã cuộn qua ảnh */}
        <motion.div style={{ opacity: miniOpacity }} className="pointer-events-none absolute inset-x-0 top-0 z-20 flex h-[68px] items-center border-b border-[var(--qr-border)] bg-[var(--qr-bg)] px-[72px]">
          <p className="truncate text-[16px] font-semibold">{dish.name}</p>
        </motion.div>
        <div className="absolute inset-x-5 top-3 z-30 flex justify-between">
          <motion.button whileTap={{ scale: 0.88 }} type="button" aria-label="Đóng" onClick={onBack} className="grid h-11 w-11 place-items-center rounded-full bg-black/30 text-white backdrop-blur"><CaretDown size={20} weight="bold" /></motion.button>
          {dish.image ? (
            <motion.button whileTap={{ scale: 0.88 }} type="button" aria-label="Xem ảnh lớn" onClick={() => setZoom(true)} className="grid h-11 w-11 place-items-center rounded-full bg-black/30 text-white backdrop-blur"><CornersOut size={20} weight="bold" /></motion.button>
          ) : null}
        </div>

        <div ref={scroller} className="relative z-10 h-full overflow-y-auto overscroll-contain">
          {/* Ảnh món nổi */}
          <motion.div style={{ scale: cardScale, y: cardY }} className="mx-auto w-[82%] origin-bottom pt-[64px]" onPointerDown={(e) => drag.start(e)}>
            <motion.div
              initial={reduce ? false : { scale: 0.82, opacity: 0, y: 30 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 240, damping: 22, delay: 0.1 }}
              className="relative aspect-[4/3] touch-none overflow-hidden rounded-[28px] bg-[var(--qr-surface-2)] shadow-[0_26px_50px_-12px_rgba(0,0,0,0.55)] ring-1 ring-white/25"
            >
              <DishImage dish={dish} categoryName={categoryName} soldOut={dish.soldOut} className="h-full w-full" emojiSize={110} />
              {best ? <span className="absolute left-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-[12px] font-bold text-[var(--qr-primary)] shadow">Bán chạy #{best}</span> : null}
            </motion.div>
          </motion.div>

          <motion.div variants={STAGGER} initial={reduce ? false : 'hide'} animate="show" className="space-y-3 px-4 pb-36 pt-6">
            <motion.section variants={RISE} className="px-1">
              <h1 className="text-[24px] font-bold leading-tight tracking-[-0.01em]">{dish.name}</h1>
              <div className="mt-1.5 flex items-baseline justify-between gap-3">
                <p className="text-[22px] font-bold text-[var(--qr-primary)]">{vnd(dish.price)}</p>
                <p className="text-right text-[12.5px] text-[var(--qr-muted)]">{meta.join(' · ')}</p>
              </div>
              {dish.description ? <p className="mt-3 text-[14px] leading-relaxed text-[var(--qr-muted)]">{dish.description}</p> : null}
            </motion.section>

            {dish.soldOut ? (
              <motion.p variants={RISE} className="rounded-[20px] bg-[var(--qr-surface-2)] p-4 text-center text-[14.5px] font-semibold text-[var(--qr-muted)]">Món này hiện đã tạm hết</motion.p>
            ) : (
              opts.groups.map((g) => (
                <motion.section key={g.key} variants={RISE} className={DETAIL_BLOCK}>
                  <BlockTitle title={g.title} hint="Chọn 1" />
                  {g.doneness ? (
                    <Doneness value={chosen[g.key]} options={g.options} onChange={(v) => setChosen((c) => ({ ...c, [g.key]: v }))} />
                  ) : (
                    <div className="mt-3 flex flex-wrap gap-2" role="radiogroup" aria-label={g.title}>
                      {g.options.map((o) => (
                        <ChoicePill key={o} group={g.key} on={chosen[g.key] === o} onClick={() => setChosen((c) => ({ ...c, [g.key]: o }))}>{o}</ChoicePill>
                      ))}
                    </div>
                  )}
                </motion.section>
              ))
            )}

            {ingredients.length ? (
              <motion.section variants={RISE} className={DETAIL_BLOCK}>
                <BlockTitle title="Thành phần" />
                <p className="mt-2 text-[14px] leading-relaxed text-[var(--qr-muted)]">{ingredients.join(' · ')}</p>
              </motion.section>
            ) : null}

            {dish.allergens.length ? (
              <motion.section variants={RISE} className="flex items-start gap-3 rounded-[20px] bg-[var(--qr-danger-soft)] p-4">
                <Emoji name="warning" size={26} />
                <div className="text-[13.5px]">
                  <p className="font-semibold text-[var(--qr-danger)]">Có: {dish.allergens.join(', ')}</p>
                  <p className="mt-0.5 text-[12.5px] text-[var(--qr-muted)]">Vui lòng báo nhân viên nếu bạn dị ứng thực phẩm.</p>
                </div>
              </motion.section>
            ) : null}

            {dish.soldOut || !addonSlot ? null : <motion.section variants={RISE}>{addonSlot}</motion.section>}

            {dish.soldOut || !opts.quickNotes.length ? null : (
              <motion.section variants={RISE} className={DETAIL_BLOCK}>
                <BlockTitle title="Ghi chú cho bếp" hint="Tùy chọn" />
                <div className="mt-3 flex flex-wrap gap-2">
                  {opts.quickNotes.map((n) => (
                    <ChoicePill key={n} on={picked.includes(n)} multi onClick={() => toggle(n)}>{n}</ChoicePill>
                  ))}
                  {!extraOpen ? (
                    <motion.button whileTap={{ scale: 0.92 }} type="button" onClick={() => setExtraOpen(true)} className="rounded-full border border-dashed border-[var(--qr-border)] px-3.5 py-2 text-[13.5px] font-medium text-[var(--qr-muted)]">
                      Ghi chú khác
                    </motion.button>
                  ) : null}
                </div>
                <AnimatePresence initial={false}>
                  {extraOpen ? (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                      <textarea value={extra} maxLength={150} rows={2} autoFocus onChange={(e) => setExtra(e.target.value)} placeholder="Ghi chú khác cho bếp…" aria-label="Ghi chú khác cho bếp" className={cn(Q.input, 'mt-3 resize-none')} />
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </motion.section>
            )}
          </motion.div>
        </div>

        {dish.soldOut ? null : (
          <motion.div initial={reduce ? false : { y: 90 }} animate={{ y: 0 }} transition={{ ...SPRING, delay: 0.18 }} className="absolute inset-x-0 bottom-0 z-20 flex items-center gap-3 border-t border-[var(--qr-border)] bg-[var(--qr-bg)] px-5 pb-[max(14px,env(safe-area-inset-bottom))] pt-3">
            <Stepper value={qty} onChange={setQty} min={1} />
            <motion.button whileTap={{ scale: 0.96 }} type="button" onClick={add} className={cn(Q.btn, 'relative flex-1 overflow-hidden px-4 transition-colors', added && 'bg-[var(--qr-success)]')}>
              <AnimatePresence mode="wait" initial={false}>
                {added ? (
                  <motion.span key="ok" initial={{ y: 18, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ opacity: 0 }} className="inline-flex items-center gap-1.5"><Check size={18} weight="bold" />Đã thêm</motion.span>
                ) : (
                  <motion.span key="add" exit={{ y: -18, opacity: 0 }} className="inline-flex items-center gap-1.5">Thêm · <AnimatedNumber value={dish.price * qty} format={vnd} /></motion.span>
                )}
              </AnimatePresence>
            </motion.button>
          </motion.div>
        )}

        <AnimatePresence>{zoom && dish.image ? <ImageViewer src={dish.image} alt={dish.name} onClose={() => setZoom(false)} /> : null}</AnimatePresence>
      </motion.div>
    </motion.div>
  );
}

const DETAIL_BLOCK = 'rounded-[20px] border border-[var(--qr-border)] bg-[var(--qr-surface)] p-4';

function BlockTitle({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <p className="text-[15.5px] font-semibold">{title}</p>
      {hint ? <span className="text-[12px] font-medium text-[var(--qr-muted)]">{hint}</span> : null}
    </div>
  );
}

/** Viên chọn: chọn 1 trong nhóm (nền đỏ trượt sang viên được chọn) hoặc chọn nhiều (ghi chú nhanh). */
function ChoicePill({ on, group, multi, onClick, children }: { on: boolean; group?: string; multi?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <motion.button
      type="button"
      role={multi ? 'checkbox' : 'radio'}
      aria-checked={on}
      onClick={onClick}
      whileTap={{ scale: 0.92 }}
      className={cn('relative rounded-full border px-3.5 py-2 text-[13.5px] font-medium transition-colors duration-200', on ? 'border-transparent text-white' : 'border-[var(--qr-border)] bg-[var(--qr-surface)]')}
    >
      {on ? (
        group ? (
          <motion.span layoutId={`pick-${group}`} className="absolute inset-0 rounded-full bg-[var(--qr-primary)]" transition={{ type: 'spring', stiffness: 500, damping: 36 }} />
        ) : (
          <motion.span initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="absolute inset-0 rounded-full bg-[var(--qr-primary)]" />
        )
      ) : null}
      <span className="relative">{children}</span>
    </motion.button>
  );
}

/** Màu thịt theo độ chín (đỏ hồng → nâu) và mô tả ngắn cho khách. */
const DONENESS_LOOK: Record<string, { color: string; hint: string }> = {
  'Tái': { color: '#c0283f', hint: 'Đỏ bên trong, mềm nhất' },
  'Medium rare': { color: '#d9485f', hint: 'Hồng đỏ, mềm mọng — bếp khuyên dùng' },
  'Medium': { color: '#c4614a', hint: 'Hồng ở giữa, vừa mềm vừa chắc' },
  'Medium well': { color: '#9a5a3c', hint: 'Hồng nhạt, chắc thịt' },
  'Chín kỹ': { color: '#6b4228', hint: 'Chín đều, không còn hồng' },
};

/**
 * Độ chín: thanh kéo có dải màu thịt (kéo nút hoặc bấm vào dải / tên mức đều được, tự bắt vào mức gần nhất).
 * Dùng input range của trình duyệt nên dùng được bằng bàn phím và trình đọc màn hình.
 */
function Doneness({ value, options, onChange }: { value: string; options: string[]; onChange: (v: string) => void }) {
  const i = Math.max(0, options.indexOf(value));
  const look = DONENESS_LOOK[value] ?? { color: 'var(--qr-primary)', hint: '' };
  const stops = options.map((o, k) => `${DONENESS_LOOK[o]?.color ?? '#999'} ${(k / (options.length - 1)) * 100}%`).join(', ');
  return (
    <div className="mt-3">
      <div className="flex items-center gap-2.5">
        <motion.span key={value} initial={{ scale: 0.6 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 500, damping: 22 }} className="h-4 w-4 shrink-0 rounded-full ring-2 ring-white" style={{ background: look.color, boxShadow: `0 0 0 4px ${look.color}33` }} aria-hidden />
        <div className="min-w-0">
          <p className="text-[16px] font-bold" style={{ color: look.color }}>{value}</p>
          <p className="text-[12.5px] text-[var(--qr-muted)]">{look.hint}</p>
        </div>
      </div>
      <input
        type="range"
        min={0}
        max={options.length - 1}
        step={1}
        value={i}
        onChange={(e) => onChange(options[Number(e.target.value)])}
        aria-label="Độ chín"
        aria-valuetext={value}
        className="qr-doneness mt-4 w-full"
        style={{ ['--track' as string]: `linear-gradient(90deg, ${stops})`, ['--thumb' as string]: look.color }}
      />
      <div className="mt-1.5 grid" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
        {options.map((o, k) => (
          <button
            key={o}
            type="button"
            onClick={() => onChange(o)}
            className={cn('px-0.5 py-1 text-[11.5px] leading-tight transition-colors', k === 0 ? 'text-left' : k === options.length - 1 ? 'text-right' : 'text-center', o === value ? 'font-bold text-[var(--qr-text)]' : 'text-[var(--qr-muted)]')}
          >
            {o}
          </button>
        ))}
      </div>
    </div>
  );
}

function ImageViewer({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  const [big, setBig] = useState(false);
  return (
    <motion.div className="absolute inset-0 z-50 grid place-items-center bg-black" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} role="dialog" aria-label="Ảnh món">
      <button type="button" aria-label="Đóng ảnh" onClick={onClose} className="absolute right-4 top-4 z-10 grid h-11 w-11 place-items-center rounded-full bg-white/15 text-white"><X size={20} weight="bold" /></button>
      <motion.img
        src={src}
        alt={alt}
        draggable={false}
        onDoubleClick={() => setBig((v) => !v)}
        onClick={() => setBig((v) => !v)}
        animate={{ scale: big ? 2.2 : 1 }}
        transition={SPRING}
        drag={big ? true : 'y'}
        dragConstraints={big ? { left: -200, right: 200, top: -260, bottom: 260 } : { top: 0, bottom: 0 }}
        dragElastic={big ? 0.2 : 0.7}
        onDragEnd={(_, i) => !big && (i.offset.y > 120 || i.velocity.y > 600) && onClose()}
        className="max-h-full w-full touch-none object-contain"
      />
      <p className="absolute bottom-6 text-[12.5px] text-white/70">Chạm để phóng to · kéo xuống để đóng</p>
    </motion.div>
  );
}

/* ---------------------------------------------------------------- Giỏ món (UC-KH-03) */

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
  onOpenDish: (d: MenuDish, from: HTMLElement | null) => void;
  onAddDish: (d: MenuDish) => void;
  disabledReason: string | null;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const total = lines.reduce((s, l) => s + l.price * l.qty, 0);
  const count = lines.reduce((s, l) => s + l.qty, 0);
  return (
    <Screen label="Giỏ món" onClose={onBack}>
      <ScreenHeader title="Giỏ món" onBack={onBack} table={table} />
      <div className="flex-1 overflow-y-auto overscroll-contain px-5 pb-6">
        {lines.length === 0 ? (
          <>
            <div className="pb-10 pt-4 text-center">
              <Lottie name="empty-cart" className="mx-auto h-[170px] w-[170px]" />
              <p className="mt-2 text-[16px] font-semibold">Giỏ món đang trống</p>
              <p className="mt-1 text-[13px] text-[var(--qr-muted)]">Thêm vài món ngon để bắt đầu nhé</p>
              <button type="button" onClick={onBack} className={cn(Q.btn, 'mt-5 px-6 py-2.5 text-[14px]')}>Xem thực đơn</button>
            </div>
            {suggestions.length ? (
              <section>
                <p className="mb-3 text-[16px] font-semibold">Gợi ý món bán chạy</p>
                <div className="no-scrollbar -mx-5 flex gap-3 overflow-x-auto px-5 pb-2">
                  {suggestions.map((d, i) => (
                    <PopularCard key={d.id} index={i} dish={d} categoryName={categoryOf(d.id)} rank={i + 1} inCart={qtyOf(d.id)} onOpen={(el) => onOpenDish(d, el)} onAdd={() => onAddDish(d)} onChangeQty={() => onAddDish(d)} />
                  ))}
                </div>
              </section>
            ) : null}
          </>
        ) : (
          <div className="space-y-3">
            <AnimatePresence initial={false}>
              {lines.map((l) => (
                <motion.div
                  key={l.key}
                  layout
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -60, height: 0, marginTop: 0, transition: { duration: 0.22 } }}
                  transition={SPRING}
                  className={cn(Q.card, 'overflow-hidden p-3', invalid.has(l.key) && 'ring-2 ring-[var(--qr-danger)]')}
                >
                  <div className="flex gap-3">
                    <DishImage dish={{ name: l.name, image: l.image }} categoryName={categoryOf(l.dishId)} className="h-[64px] w-[64px] shrink-0 rounded-xl" emojiSize={34} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-[14.5px] font-semibold leading-snug">{l.name}</p>
                        {l.setId ? null : <button type="button" aria-label={`Ghi chú ${l.name}`} onClick={() => { setEditing(editing === l.key ? null : l.key); setDraft(l.note); }} className="grid h-8 w-8 place-items-center rounded-full text-[var(--qr-muted)] active:bg-[var(--qr-surface-2)]"><NotePencil size={18} weight="duotone" /></button>}
                      </div>
                      {l.setId && l.parts ? (
                        <ul className="mt-0.5 space-y-0.5 text-[12.5px] leading-snug text-[var(--qr-muted)]">
                          {l.parts.map((p, k) => <li key={k}>{p.name}{p.qty > 1 ? ` ×${p.qty}` : ''}{p.note ? ` · ${p.note}` : ''}</li>)}
                        </ul>
                      ) : null}
                      {l.note && editing !== l.key ? <p className="line-clamp-1 text-[12.5px] text-[var(--qr-muted)]">“{l.note}”</p> : null}
                      {invalid.has(l.key) ? <p className="text-[12.5px] font-semibold text-[var(--qr-danger)]">{l.setId ? 'Set hiện chưa phục vụ được — vui lòng xóa khỏi giỏ' : 'Món đã hết — vui lòng xóa khỏi giỏ'}</p> : null}
                      <div className="mt-1.5 flex items-center justify-between">
                        <span className="text-[14.5px] font-bold text-[var(--qr-primary)]"><AnimatedNumber value={l.price * l.qty} format={vnd} /></span>
                        <Stepper value={l.qty} onChange={(v) => (v <= 0 ? onRemove(l.key) : onChange(l.key, { qty: v }))} size="sm" />
                      </div>
                    </div>
                  </div>
                  <AnimatePresence initial={false}>
                    {editing === l.key ? (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                        <p className="mb-1.5 mt-3 text-[12.5px] text-[var(--qr-muted)]">Ghi chú cho món này</p>
                        <textarea value={draft} maxLength={200} rows={2} onChange={(e) => setDraft(e.target.value)} placeholder="Ví dụ: ít cay, không hành…" className={cn(Q.input, 'resize-none')} autoFocus />
                        <div className="mt-2 flex justify-end">
                          <button type="button" onClick={() => { onChange(l.key, { note: draft.trim() }); setEditing(null); }} className={cn(Q.btn, 'px-5 py-2 text-[13.5px]')}>Lưu</button>
                        </div>
                      </motion.div>
                    ) : null}
                  </AnimatePresence>
                </motion.div>
              ))}
            </AnimatePresence>
            <motion.div layout className={cn(Q.card, 'p-4')}>
              <p className="mb-2 text-[15px] font-semibold">Tóm tắt</p>
              <div className="flex justify-between text-[13.5px] text-[var(--qr-muted)]"><span>Tạm tính ({count} món)</span><AnimatedNumber value={total} format={vnd} /></div>
              <div className="mt-2 flex items-baseline justify-between border-t border-[var(--qr-border)] pt-2.5"><span className="text-[14.5px]">Tổng</span><span className="text-[19px] font-bold text-[var(--qr-primary)]"><AnimatedNumber value={total} format={vnd} /></span></div>
              <p className="mt-2 text-[12px] text-[var(--qr-muted)]">Món gửi đi tới bếp ngay; chỉ hủy được khi bếp chưa bắt đầu chế biến. Thanh toán tại quầy khi dùng bữa xong.</p>
            </motion.div>
            <motion.button layout type="button" onClick={onClear} className="w-full py-2 text-center text-[13.5px] font-medium text-[var(--qr-danger)]">Xóa hết giỏ món</motion.button>
          </div>
        )}
      </div>
      {lines.length ? (
        <div className="border-t border-[var(--qr-border)] px-5 pb-[max(16px,env(safe-area-inset-bottom))] pt-3">
          {disabledReason ? <p className="mb-2 rounded-xl bg-[var(--qr-warn-soft)] px-3 py-2 text-[13px] text-[var(--qr-warn-text)]">{disabledReason}</p> : null}
          <button type="button" disabled={sending || Boolean(disabledReason)} onClick={onSend} className={cn(Q.btn, 'w-full justify-between')}>
            <span>{sending ? 'Đang gửi…' : 'Gửi gọi món'}</span>
            <span className="inline-flex items-center gap-2"><AnimatedNumber value={total} format={vnd} /><ArrowRight size={18} weight="bold" /></span>
          </button>
        </div>
      ) : null}
    </Screen>
  );
}

/* ---------------------------------------------------------------- Đã gửi bếp */

const rise = (i: number) => ({ initial: { opacity: 0, y: 18 }, animate: { opacity: 1, y: 0 }, transition: { ...SPRING, delay: 0.15 + i * 0.07 } });

/** Sau khi gửi: tranh động dấu ✓ + pháo giấy, "Đã gửi tới bếp" (thay màn "Order Confirmed" của thiết kế). */
export function SentScreen({ count, total, lines, onMenu, onTrack }: { count: number; total: number; lines: { name: string; qty: number; note: string }[]; onMenu: () => void; onTrack: () => void }) {
  return (
    <Screen label="Đã gửi tới bếp">
      <StageArt art="sent" size={190} className="mt-[max(16px,env(safe-area-inset-top))] h-[250px] w-full shrink-0" />
      <div className="flex flex-1 flex-col px-5 text-center">
        <motion.h1 {...rise(0)} className="text-[23px] font-bold">Đã gửi tới bếp!</motion.h1>
        <motion.p {...rise(1)} className="mt-1 text-[14px] text-[var(--qr-muted)]">Ngồi chờ chút nhé, bếp đang chuẩn bị món cho bạn.</motion.p>
        <motion.div {...rise(2)} className={cn(Q.card, 'mt-5 p-4 text-left')}>
          <div className="flex justify-between text-[13.5px] text-[var(--qr-muted)]"><span>Vừa gửi</span><span>{count} món</span></div>
          <ul className="mt-2 max-h-[150px] space-y-1.5 overflow-y-auto">
            {lines.map((l, i) => (
              <li key={i} className="flex gap-2 text-[14px]">
                <b className="w-7 shrink-0 tabular-nums text-[var(--qr-primary)]">{l.qty}×</b>
                <span className="min-w-0 flex-1">{l.name}{l.note ? <span className="block text-[12.5px] text-[var(--qr-muted)]">“{l.note}”</span> : null}</span>
              </li>
            ))}
          </ul>
          <div className="mt-2.5 flex items-baseline justify-between border-t border-[var(--qr-border)] pt-2.5"><span className="text-[14.5px]">Tạm tính đợt này</span><span className="text-[18px] font-bold text-[var(--qr-primary)]">{vnd(total)}</span></div>
        </motion.div>
        <motion.div {...rise(3)} className="mt-auto flex gap-3 pb-[max(20px,env(safe-area-inset-bottom))] pt-5">
          <button type="button" onClick={onMenu} className={cn(Q.btnGhost, 'flex-1')}>Về thực đơn</button>
          <button type="button" onClick={onTrack} className={cn(Q.btn, 'flex-1')}>Theo dõi món</button>
        </motion.div>
      </div>
    </Screen>
  );
}

/* ---------------------------------------------------------------- Món của tôi (UC-KH-04 + theo dõi) */

const STATUS_META: Record<OrderItemStatus, { label: string; cls: string }> = {
  unconfirmed: { label: 'Chờ nhân viên xác nhận', cls: 'bg-[var(--qr-warn-soft)] text-[var(--qr-warn-text)]' },
  pending: { label: 'Chờ chế biến', cls: 'bg-[var(--qr-surface-2)] text-[var(--qr-muted)]' },
  cooking: { label: 'Đang làm', cls: 'bg-[var(--qr-warn-soft)] text-[var(--qr-warn-text)]' },
  done: { label: 'Đã xong', cls: 'bg-[var(--qr-success-soft)] text-[var(--qr-success)]' },
  served: { label: 'Đã mang ra', cls: 'bg-[var(--qr-primary-soft)] text-[var(--qr-primary)]' },
  cancelled: { label: 'Đã hủy', cls: 'bg-[var(--qr-danger-soft)] text-[var(--qr-danger)]' },
};

function Progress({ status }: { status: OrderItemStatus }) {
  if (status === 'cancelled') return null;
  const step = { unconfirmed: 0.4, pending: 1, cooking: 2, done: 3, served: 3 }[status];
  return (
    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--qr-surface-2)]" aria-hidden>
      <motion.div className="h-full rounded-full bg-[var(--qr-primary)]" initial={{ width: 0 }} animate={{ width: `${(step / 3) * 100}%` }} transition={{ type: 'spring', stiffness: 120, damping: 20 }} />
    </div>
  );
}

/** Thanh 4 bước của đơn (Đã gửi → Đang nấu → Sẵn sàng → Đã mang ra): đường đỏ chạy tới bước hiện tại, chấm hiện tại nhấp nháy. */
function StageTracker({ stage }: { stage: Stage }) {
  const at = STAGES.indexOf(stage);
  return (
    <div className="relative mx-1 mt-4" aria-label={`Tiến độ: ${STAGE_TEXT[stage].short}`}>
      <div className="absolute left-[12.5%] right-[12.5%] top-[9px] h-1 rounded-full bg-[var(--qr-surface-2)]" />
      <motion.div className="absolute left-[12.5%] top-[9px] h-1 rounded-full bg-[var(--qr-primary)]" initial={{ width: 0 }} animate={{ width: `${(at / (STAGES.length - 1)) * 75}%` }} transition={{ type: 'spring', stiffness: 90, damping: 18 }} />
      <div className="relative grid grid-cols-4">
        {STAGES.map((s, i) => (
          <div key={s} className="flex flex-col items-center gap-1.5">
            <span className="relative grid h-[22px] w-[22px] place-items-center">
              {i === at ? <motion.span className="absolute inset-0 rounded-full bg-[var(--qr-primary)]" animate={{ scale: [1, 1.7], opacity: [0.45, 0] }} transition={{ duration: 1.4, repeat: Infinity }} /> : null}
              <motion.span
                className={cn('relative grid h-[22px] w-[22px] place-items-center rounded-full border-2', i <= at ? 'border-[var(--qr-primary)] bg-[var(--qr-primary)] text-white' : 'border-[var(--qr-border)] bg-[var(--qr-bg)]')}
                initial={false}
                animate={{ scale: i === at ? 1.1 : 1 }}
              >
                {i < at ? <Check size={11} weight="bold" /> : null}
              </motion.span>
            </span>
            <span className={cn('text-center text-[11px] leading-tight', i === at ? 'font-semibold text-[var(--qr-primary)]' : 'text-[var(--qr-muted)]')}>{STAGE_TEXT[s].short}</span>
          </div>
        ))}
      </div>
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
    <Screen label="Món của tôi" onClose={onBack}>
      <ScreenHeader title="Món của tôi" onBack={onBack} table={table} />
      <div className="flex-1 overflow-y-auto overscroll-contain pb-36">
        {stage ? (
          <div className="px-5">
            <StageArt art={stage} size={175} className="h-[230px] w-full" />
            <AnimatePresence mode="wait" initial={false}>
              <motion.div key={stage} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="pt-3 text-center">
                <h2 className="text-[21px] font-bold">{STAGE_TEXT[stage].title}</h2>
                <p className="mt-0.5 text-[13.5px] text-[var(--qr-muted)]">{STAGE_TEXT[stage].sub}</p>
              </motion.div>
            </AnimatePresence>
            <StageTracker stage={stage} />
          </div>
        ) : null}

        <div className="space-y-3 px-5 pt-5">
          {order && order.unconfirmedCount > 0 ? (
            <div className="rounded-2xl bg-[var(--qr-warn-soft)] px-4 py-3 text-[13.5px] text-[var(--qr-warn-text)]">
              <b>{order.unconfirmedCount} món đang chờ nhân viên xác nhận.</b> Nhân viên sẽ kiểm tra với bạn rồi chuyển món xuống bếp.
            </div>
          ) : null}
          {support ? (
            <div className="flex items-center gap-2.5 rounded-2xl bg-[var(--qr-warn-soft)] px-4 py-3 text-[13.5px] text-[var(--qr-warn-text)]">
              <span className="qr-wiggle inline-flex"><Emoji name="bell" size={20} /></span>
              {support.status === 'forwarded' ? `Nhân viên${support.assignedName ? ' ' + support.assignedName : ''} đang đến bàn bạn` : 'Đã gọi nhân viên, vui lòng chờ chút'}
            </div>
          ) : null}
          {order?.locked ? <p className="rounded-2xl bg-[var(--qr-warn-soft)] px-4 py-3 text-[13px] text-[var(--qr-warn-text)]">Bàn đang chờ thanh toán — không gọi thêm hay hủy món được.</p> : null}

          {!order || order.items.length === 0 ? (
            <div className="py-6 text-center">
              <Lottie name="empty-cart" className="mx-auto h-[150px] w-[150px]" />
              <p className="mt-2 text-[16px] font-semibold">Bàn chưa gọi món nào</p>
              <p className="mt-1 text-[13px] text-[var(--qr-muted)]">Chọn món ở thực đơn rồi bấm gửi, bếp nhận ngay.</p>
              <button type="button" onClick={onBack} className={cn(Q.btn, 'mt-5 px-6 py-2.5 text-[14px]')}>Xem thực đơn</button>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between rounded-2xl bg-[var(--qr-primary)] px-4 py-3.5 text-white">
                <div>
                  <p className="text-[12px] opacity-85">Đơn {order.code} · Bàn {table}</p>
                  <p className="text-[20px] font-bold"><AnimatedNumber value={order.subtotal} format={vnd} /></p>
                </div>
                <p className="text-right text-[12.5px] opacity-90">{order.pendingCount ? `${order.pendingCount} món đang chuẩn bị` : 'Đã chuẩn bị xong'}</p>
              </div>
              {batches.map((b, bi) => {
                const items = order.items.filter((i) => i.batchNo === b);
                return (
                  <motion.div key={b} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ ...SPRING, delay: bi * 0.06 }} className={cn(Q.card, 'overflow-hidden')}>
                    <div className="bg-[var(--qr-surface-2)] px-4 py-2 text-[12.5px] font-medium text-[var(--qr-muted)]">Đợt {b} · {hhmm(items[0].createdAt)}</div>
                    {items.map((i) => (
                      <div key={i.id} className="border-t border-[var(--qr-border)] px-4 py-3 first:border-0">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className={cn('text-[14.5px] font-semibold', i.status === 'cancelled' && 'text-[var(--qr-muted)] line-through')}>{i.qty} × {i.name}</p>
                            {i.setName ? <p className="text-[12px] font-semibold text-[#b8925a]">{i.setName}</p> : null}
                            {i.note ? <p className="text-[12.5px] text-[var(--qr-muted)]">“{i.note}”</p> : null}
                            {i.status === 'cancelled' && i.cancelReason ? <p className="text-[12.5px] text-[var(--qr-danger)]">{i.cancelSource === 'kitchen' ? 'Bếp báo: ' : ''}{i.cancelReason}</p> : null}
                          </div>
                          <div className="shrink-0 text-right">
                            <AnimatePresence mode="wait" initial={false}>
                              <motion.span key={i.status} initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.6, opacity: 0 }} transition={SPRING} className={cn('inline-block rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold', STATUS_META[i.status].cls)}>{STATUS_META[i.status].label}</motion.span>
                            </AnimatePresence>
                            <p className="mt-1 text-[13px] font-semibold">{i.status === 'cancelled' || i.setId ? '' : vnd(i.price * i.qty)}</p>
                          </div>
                        </div>
                        <Progress status={i.status} />
                        {(i.status === 'pending' || i.status === 'unconfirmed') && !order.locked ? <button type="button" onClick={() => onCancel(i)} className="mt-2 text-[12.5px] font-semibold text-[var(--qr-danger)]">{i.setId ? 'Hủy cả set' : 'Hủy món'}</button> : null}
                      </div>
                    ))}
                  </motion.div>
                );
              })}
            </>
          )}
        </div>
      </div>
      <div className="absolute inset-x-0 bottom-0 flex gap-3 border-t border-[var(--qr-border)] bg-[var(--qr-bg)] px-5 pb-[max(16px,env(safe-area-inset-bottom))] pt-3">
        <button type="button" onClick={onStaff} className={cn(Q.btnGhost, 'flex-1', support && 'text-[var(--qr-primary)]')}>
          <span className={cn('inline-flex', support && 'qr-wiggle')}><BellRinging size={19} weight="duotone" /></span>{support ? 'Đang chờ NV' : 'Gọi nhân viên'}
        </button>
        <button type="button" onClick={onPayment} className={cn(Q.btn, 'flex-1')}><Receipt size={19} weight="duotone" />{hasInvoice ? 'Xem hóa đơn' : payment ? 'Đã yêu cầu' : 'Thanh toán'}</button>
      </div>
    </Screen>
  );
}
