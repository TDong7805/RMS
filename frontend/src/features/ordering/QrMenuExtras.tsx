import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Check, Plus } from '@phosphor-icons/react';
import { DishImage, Q, SPRING, Sheet, Stepper, vnd } from '@/features/ordering/QrParts';
import { Screen, ScreenHeader } from '@/features/ordering/QrScreens';
import { buildNote, dishOptions } from '@/features/ordering/dishOptions';
import { AnimatedNumber } from '@/features/ordering/qrMotion';
import { cn } from '@/lib/cn';
import type { CartSetPart, MenuDish, QrMenuGroup, MenuSet } from '@/types';

/*
 * Phần thêm của trang gọi món cho thực đơn có nhóm món, set menu và món gọi thêm:
 *  - GroupPickSheet: bấm thẻ nhóm (vd. Nước ngọt có ga) → chọn số lượng từng loại (− / +) rồi bấm "Thêm vào giỏ".
 *  - SetSection / SetSlide: khung Set menu kiểu "tờ thực đơn in" (giấy kem, viền đôi vàng đồng), trượt từng set, chấm báo vị trí, ruy-băng % tiết kiệm.
 *  - SetDetailScreen: xem món trong set, chọn độ chín / sốt cho bít tết, chia số lon nước ngọt theo loại.
 *  - AddonStrip: hàng "Gọi thêm cho món này" trong màn chi tiết món.
 */

/* ---------------------------------------------------------------- Nhóm món: chọn loại */

/**
 * Bảng chọn loại trong nhóm (vd. Nước ngọt có ga): mỗi loại một dòng có − / +, số lượng chỉ là nháp trong bảng.
 * Bấm nút đáy "Thêm vào giỏ" / "Cập nhật giỏ" giỏ mới đổi (và ảnh mới bay vào giỏ). Đóng bảng = bỏ nháp.
 * Chạm ảnh / tên một loại → mở chi tiết món như bình thường.
 */
export function GroupPickSheet({ group, members, categoryName, qtyOf, onApply, onOpenDish, onClose }: {
  group: QrMenuGroup | null;
  members: MenuDish[];
  categoryName?: string;
  qtyOf: (dishId: string) => number;
  /** Số phần mới của từng loại (cả loại giảm về 0) + ghi chú nhanh áp cho phần thêm mới. */
  onApply: (changes: { dish: MenuDish; qty: number }[], note: string) => void;
  onOpenDish: (dish: MenuDish) => void;
  onClose: () => void;
}) {
  const [picked, setPicked] = useState<string[]>([]);
  const [draft, setDraft] = useState<Record<string, number>>({});
  const groupId = group?.id;
  // Mở bảng: nháp bắt đầu bằng số đang có trong giỏ.
  useEffect(() => {
    if (!groupId) return;
    setDraft(Object.fromEntries(members.map((m) => [m.id, qtyOf(m.id)])));
    setPicked([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId]);
  const notes = useMemo(() => (members[0] ? dishOptions(categoryName, members[0].name).quickNotes : []), [members, categoryName]);
  const toggle = (n: string) => setPicked((p) => (p.includes(n) ? p.filter((x) => x !== n) : [...p, n]));
  const q = (m: MenuDish) => draft[m.id] ?? 0;
  const before = members.reduce((sum, m) => sum + qtyOf(m.id), 0);
  const count = members.reduce((sum, m) => sum + q(m), 0);
  const total = members.reduce((sum, m) => sum + q(m) * m.price, 0);
  const changed = members.filter((m) => q(m) !== qtyOf(m.id));
  const label = !changed.length
    ? before ? 'Chưa thay đổi' : 'Chọn số lượng'
    : count === 0 ? 'Bỏ khỏi giỏ'
      : `${before ? 'Cập nhật giỏ' : 'Thêm vào giỏ'} · ${count} món · ${vnd(total)}`;
  return (
    <Sheet open={Boolean(group)} onClose={onClose} title={group?.name}>
      {/* Danh sách cuộn được; nút xác nhận luôn dính đáy bảng */}
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-3">
        {group?.description ? <p className="-mt-1 text-[13.5px] text-[var(--qr-muted)]">{group.description}</p> : null}
        <ul className="mt-3 divide-y divide-[var(--qr-border)]">
          {members.map((m) => (
            <li key={m.id} className={cn('flex items-center gap-3 py-2.5', m.soldOut && 'opacity-55')}>
              <button type="button" onClick={() => onOpenDish(m)} className="flex min-w-0 flex-1 items-center gap-3 text-left" aria-label={`Xem ${m.variantLabel ?? m.name}`}>
                <DishImage dish={m} categoryName={categoryName} soldOut={m.soldOut} className="h-[54px] w-[54px] shrink-0 rounded-[14px]" emojiSize={28} />
                <span className="min-w-0">
                  <span className="line-clamp-1 block text-[14.5px] font-semibold">{m.variantLabel ?? m.name}</span>
                  <span className="block text-[13px] font-bold text-[var(--qr-primary)]">{m.soldOut ? <span className="font-semibold text-[var(--qr-muted)]">Tạm hết</span> : vnd(m.price)}</span>
                </span>
              </button>
              {m.soldOut && !q(m) ? null : (
                <Stepper value={q(m)} max={m.soldOut ? q(m) : 20} onChange={(v) => setDraft((d) => ({ ...d, [m.id]: v }))} size="sm" />
              )}
            </li>
          ))}
        </ul>
        {notes.length ? (
          <div className="mt-3">
            <p className="mb-2 text-[13px] font-semibold text-[var(--qr-muted)]">Ghi chú cho phần thêm mới (tùy chọn)</p>
            <div className="flex flex-wrap gap-2">
              {notes.map((n) => (
                <button key={n} type="button" aria-pressed={picked.includes(n)} onClick={() => toggle(n)} className={cn('rounded-full border px-3.5 py-1.5 text-[13px] font-medium transition-colors', picked.includes(n) ? 'border-transparent bg-[var(--qr-primary)] text-white' : 'border-[var(--qr-border)]')}>{n}</button>
              ))}
            </div>
          </div>
        ) : null}
      </div>
      <div className="shrink-0 border-t border-[var(--qr-border)] px-5 pb-[max(16px,env(safe-area-inset-bottom))] pt-3">
        <motion.button
          whileTap={{ scale: 0.97 }}
          type="button"
          disabled={!changed.length}
          onClick={() => onApply(changed.map((m) => ({ dish: m, qty: q(m) })), picked.join(', '))}
          className="w-full rounded-full bg-[var(--qr-primary)] py-3.5 text-[15px] font-semibold text-white shadow-[0_10px_24px_var(--qr-primary-glow)] disabled:bg-[var(--qr-surface-2)] disabled:text-[var(--qr-muted)] disabled:shadow-none"
        >
          {label}
        </motion.button>
      </div>
    </Sheet>
  );
}

/* ---------------------------------------------------------------- Set menu: khung trượt kiểu tờ thực đơn in */

/** Màu cố định (không theo sáng / tối): tờ thực đơn giấy kem nổi trên nền trang. */
const PAPER = 'bg-[#fbf5ea] text-[#2a1f1a]';
const GOLD = '#b8925a';
/** Viền khung Set: vàng đồng đậm hơn để vẫn rõ khi giấy kem nằm trên nền trang sáng. */
const GOLD_DEEP = '#a47a3f';
const WINE = '#8e1b22';
/** Thời gian mỗi set đứng yên trước khi tự sang set kế. */
const SLIDE_MS = 9000;

const saving = (s: MenuSet) => Math.max(0, s.originalPrice - s.price);
/** % tiết kiệm làm tròn xuống (không ghi quá mức thật); dưới 5% coi như không nêu. */
const savePercent = (s: MenuSet) => {
  if (!s.originalPrice) return 0;
  const p = Math.floor((saving(s) / s.originalPrice) * 100);
  return p >= 5 ? p : 0;
};

/**
 * Khu Set menu: một khung giấy kem viền đôi vàng đồng, mỗi lần hiện trọn một set.
 * Vuốt ngang để đổi set (hít đúng trang); tự sang set kế sau ~9 giây, tới set cuối thì chạy ngược lại.
 * Hàng chấm ở đáy chỉ báo có mấy set và đang ở set nào. Dừng tự chạy khi đang mở màn khác / ra khỏi màn hình / giảm chuyển động.
 */
export function SetSection({ sets, onOpen, paused }: { sets: MenuSet[]; onOpen: (s: MenuSet) => void; paused?: boolean }) {
  const scroller = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(false);
  const [touchedAt, setTouchedAt] = useState(0);
  const dir = useRef(1);
  const indexRef = useRef(0);
  indexRef.current = index;
  const n = sets.length;

  // Vị trí trang theo thanh cuộn (cả khi khách vuốt lẫn khi tự chạy).
  useEffect(() => {
    const sc = scroller.current;
    if (!sc) return;
    const onScroll = () => {
      const i = Math.round(sc.scrollLeft / Math.max(1, sc.clientWidth));
      if (i !== indexRef.current) setIndex(Math.max(0, Math.min(n - 1, i)));
    };
    sc.addEventListener('scroll', onScroll, { passive: true });
    return () => sc.removeEventListener('scroll', onScroll);
  }, [n]);

  // Chỉ tự chạy khi khung đang nằm trong màn hình.
  useEffect(() => {
    const sc = scroller.current;
    if (!sc || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold: 0.4 });
    io.observe(sc);
    return () => io.disconnect();
  }, []);

  // Tự sang trang: chuyển nhanh rồi đứng yên; tới đầu / cuối thì đổi chiều. Khách vừa chạm thì tính lại từ đầu.
  useEffect(() => {
    if (n < 2 || reduce || paused || !visible) return;
    const t = window.setTimeout(() => {
      const sc = scroller.current;
      if (!sc || document.hidden) return;
      const cur = indexRef.current;
      if (cur + dir.current > n - 1 || cur + dir.current < 0) dir.current = -dir.current;
      const next = cur + dir.current;
      sc.scrollTo({ left: next * sc.clientWidth, behavior: 'smooth' });
      setIndex(next);
    }, SLIDE_MS);
    return () => window.clearTimeout(t);
  }, [index, n, reduce, paused, visible, touchedAt]);

  if (!n) return null;
  const best = Math.max(...sets.map(savePercent));
  return (
    <section className="pt-5">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="qr-display text-[21px] font-bold">Set menu</h2>
        {best > 0 ? <span className="text-[12.5px] font-semibold" style={{ color: GOLD }}>Tiết kiệm đến {best}%</span> : null}
      </div>
      <motion.div
        initial={{ opacity: 0, y: 22 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '0px 0px -30px 0px' }}
        transition={SPRING}
        className={cn(PAPER, 'relative rounded-[24px] p-[6px]')}
        style={{ boxShadow: `inset 0 0 0 2px ${GOLD_DEEP}, 0 18px 36px -16px rgba(40,20,10,0.55), 0 2px 6px rgba(40,20,10,0.12)` }}
        aria-roledescription="carousel"
        aria-label="Set menu"
      >
        {/* Viền đôi: đường chỉ vàng thứ hai bên trong */}
        <div className="rounded-[19px] pb-3" style={{ boxShadow: `inset 0 0 0 1px ${GOLD_DEEP}cc` }}>
          <div
            ref={scroller}
            onPointerDown={() => setTouchedAt(Date.now())}
            onTouchStart={() => setTouchedAt(Date.now())}
            className="no-scrollbar flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain"
          >
            {sets.map((s, i) => (
              <div key={s.id} className="w-full shrink-0 snap-center snap-always" aria-roledescription="slide" aria-label={`${i + 1} / ${n}`} aria-hidden={i !== index}>
                <SetSlide set={s} onOpen={() => onOpen(s)} />
              </div>
            ))}
          </div>
          {n > 1 ? (
            <div className="mt-1 flex justify-center gap-1.5" aria-hidden>
              {sets.map((s, i) => (
                <span
                  key={s.id}
                  className="h-[7px] rounded-full transition-all duration-300"
                  style={i === index ? { width: 20, background: WINE } : { width: 7, boxShadow: `inset 0 0 0 1.5px ${GOLD}` }}
                />
              ))}
            </div>
          ) : null}
        </div>
      </motion.div>
    </section>
  );
}

function SetSlide({ set, onOpen }: { set: MenuSet; onOpen: () => void }) {
  const save = saving(set);
  const pct = savePercent(set);
  return (
    <div className="flex h-full flex-col p-2">
      <button type="button" onClick={onOpen} className="block w-full text-left" aria-label={`Xem ${set.name}`}>
        <div className="relative overflow-hidden rounded-[16px]">
          <DishImage dish={{ name: set.name, image: set.image }} className="aspect-[16/10] w-full" emojiSize={56} />
          {pct ? (
            // Ruy-băng chéo góc trên trái
            <span aria-label={`Giảm ${pct}%`} className="pointer-events-none absolute -left-[38px] top-[16px] w-[140px] -rotate-45 py-1.5 text-center text-[15px] font-extrabold tracking-wide text-white shadow-[0_4px_10px_rgba(0,0,0,0.35)]" style={{ background: `linear-gradient(180deg, #a8242c, ${WINE})`, borderTop: `1px solid ${GOLD}`, borderBottom: `1px solid ${GOLD}` }}>
              -{pct}%
            </span>
          ) : null}
          {set.sellFrom ? <span className="absolute right-2.5 top-2.5 rounded-full bg-black/55 px-2.5 py-1 text-[11.5px] font-semibold text-white backdrop-blur">Bán {set.sellFrom.slice(0, 5)}–{set.sellTo?.slice(0, 5)}</span> : null}
        </div>
        <div className="px-2 pt-3">
          <p className="qr-display text-center text-[19px] font-bold leading-tight tracking-wide">{set.name}</p>
          <div className="mx-auto mt-2 h-px w-16" style={{ background: GOLD }} />
          <ul className="mt-2.5 space-y-1">
            {set.items.map((it) => (
              <li key={it.dishId} className="flex items-end gap-1.5 text-[13px] leading-snug">
                <span className="line-clamp-1 shrink">{it.allowVariant ? 'Nước ngọt (chọn loại)' : it.name}</span>
                <span aria-hidden className="mb-1 min-w-4 flex-1 border-b border-dotted" style={{ borderColor: `${GOLD}aa` }} />
                <span className="shrink-0 font-semibold">×{it.qty}</span>
              </li>
            ))}
          </ul>
        </div>
      </button>
      {/* Đệm giãn: các trang cao bằng nhau (theo set nhiều món nhất), dòng giá luôn nằm đáy */}
      <div className="min-h-3 flex-1" />
      <div className="flex items-center justify-between border-t px-2 pt-2.5" style={{ borderColor: `${GOLD}55` }}>
        <span className="min-w-0">
          <span className="flex items-baseline gap-2">
            <span className="text-[18px] font-bold" style={{ color: WINE }}>{vnd(set.price)}</span>
            {save > 0 ? <span className="text-[12.5px] text-[#2a1f1a]/55 line-through">{vnd(set.originalPrice)}</span> : null}
          </span>
          {save > 0 ? <span className="block text-[12px] font-semibold" style={{ color: GOLD }}>Tiết kiệm {vnd(save)}</span> : null}
        </span>
        <motion.button whileTap={{ scale: 0.86 }} type="button" onClick={onOpen} aria-label={`Chọn ${set.name}`} className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-white shadow-[0_4px_12px_rgba(142,27,34,0.35)]" style={{ background: WINE }}>
          <Plus size={17} weight="bold" />
        </motion.button>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- Chi tiết set */

/** Lựa chọn cho từng phần bít tết trong set (mỗi phần một độ chín / sốt). */
type SteakPick = Record<string, string>;

export function SetDetailScreen({ set, dishById, categoryOf, onBack, onAdd }: {
  set: MenuSet;
  dishById: Map<string, MenuDish>;
  categoryOf: (dishId: string) => string | undefined;
  onBack: () => void;
  onAdd: (set: MenuSet, parts: CartSetPart[], qty: number) => void;
}) {
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  // Bít tết: mỗi phần một bộ lựa chọn; nước ngọt: số lon theo loại.
  const [steak, setSteak] = useState<Record<string, SteakPick[]>>(() =>
    Object.fromEntries(set.items.map((it) => {
      const g = dishOptions(categoryOf(it.dishId), it.name).groups;
      return [it.dishId, g.length ? Array.from({ length: it.qty }, () => Object.fromEntries(g.map((x) => [x.key, x.initial]))) : []];
    })),
  );
  const [variants, setVariants] = useState<Record<string, Record<string, number>>>(() =>
    Object.fromEntries(set.items.filter((it) => it.allowVariant).map((it) => [it.dishId, { [it.dishId]: it.qty }])),
  );
  const members = (groupId: string | null) => [...dishById.values()].filter((d) => groupId && d.groupId === groupId && !d.soldOut);
  const variantLeft = (it: MenuSet['items'][number]) => it.qty - Object.values(variants[it.dishId] ?? {}).reduce((a, b) => a + b, 0);
  const ready = set.items.every((it) => !it.allowVariant || variantLeft(it) === 0);

  const parts = (): CartSetPart[] =>
    set.items.flatMap((it) => {
      if (it.allowVariant) {
        return Object.entries(variants[it.dishId] ?? {}).filter(([, q]) => q > 0)
          .map(([id, q]) => ({ dishId: id, name: dishById.get(id)?.name ?? it.name, qty: q, note: '' }));
      }
      const picks = steak[it.dishId] ?? [];
      if (picks.length) {
        const groups = dishOptions(categoryOf(it.dishId), it.name).groups;
        return picks.map((p) => ({ dishId: it.dishId, name: it.name, qty: 1, note: buildNote(groups, p, [], '') }));
      }
      return [{ dishId: it.dishId, name: it.name, qty: it.qty, note: '' }];
    });

  const add = () => {
    if (added || !ready) return;
    setAdded(true);
    window.setTimeout(() => onAdd(set, parts(), qty), 320);
  };
  const save = saving(set);

  return (
    <Screen label={set.name} onClose={onBack}>
      <ScreenHeader title="Set menu" onBack={onBack} />
      <div className="flex-1 overflow-y-auto overscroll-contain px-5 pb-32">
        <div className="overflow-hidden rounded-[22px] shadow-[0_18px_36px_-16px_rgba(0,0,0,0.5)]">
          <DishImage dish={{ name: set.name, image: set.image }} className="aspect-[4/3] w-full" emojiSize={80} />
        </div>
        <h1 className="qr-display mt-4 text-[24px] font-bold leading-tight">{set.name}</h1>
        <div className="mt-1 flex items-baseline gap-2.5">
          <span className="text-[22px] font-bold text-[var(--qr-primary)]">{vnd(set.price)}</span>
          {save > 0 ? <span className="text-[14px] text-[var(--qr-muted)] line-through">{vnd(set.originalPrice)}</span> : null}
          {save > 0 ? <span className="rounded-full bg-[var(--qr-primary-soft)] px-2 py-0.5 text-[12px] font-bold text-[var(--qr-primary)]">−{vnd(save)}</span> : null}
        </div>
        {set.description ? <p className="mt-2 text-[14px] leading-relaxed text-[var(--qr-muted)]">{set.description}</p> : null}
        {set.sellFrom ? <p className="mt-1 text-[13px] font-semibold text-[var(--qr-warn-text)]">Chỉ bán {set.sellFrom.slice(0, 5)}–{set.sellTo?.slice(0, 5)}</p> : null}

        <p className="mb-2 mt-5 text-[15.5px] font-semibold">Gồm {set.items.reduce((a, i) => a + i.qty, 0)} món</p>
        <div className="space-y-2.5">
          {set.items.map((it) => {
            const dish = dishById.get(it.dishId);
            const groups = dishOptions(categoryOf(it.dishId), it.name).groups;
            return (
              <div key={it.dishId} className="rounded-[18px] border border-[var(--qr-border)] bg-[var(--qr-surface)] p-3">
                <div className="flex items-center gap-3">
                  <DishImage dish={dish ?? { name: it.name, image: null }} categoryName={categoryOf(it.dishId)} className="h-[52px] w-[52px] shrink-0 rounded-xl" emojiSize={28} />
                  <p className="min-w-0 flex-1 text-[14.5px] font-semibold leading-snug">{it.allowVariant ? 'Nước ngọt có ga' : it.name}</p>
                  <span className="shrink-0 text-[14px] font-bold">×{it.qty}</span>
                </div>
                {groups.length && !it.allowVariant ? (
                  <div className="mt-3 space-y-3">
                    {(steak[it.dishId] ?? []).map((pick, k) => (
                      <div key={k} className="rounded-xl bg-[var(--qr-surface-2)] p-2.5">
                        {it.qty > 1 ? <p className="mb-1.5 text-[12px] font-semibold text-[var(--qr-muted)]">Phần {k + 1}</p> : null}
                        {groups.map((g) => (
                          <div key={g.key} className="mt-1 first:mt-0">
                            <p className="mb-1 text-[12px] text-[var(--qr-muted)]">{g.title}</p>
                            <div className="flex flex-wrap gap-1.5">
                              {g.options.map((o) => (
                                <button key={o} type="button" aria-pressed={pick[g.key] === o}
                                  onClick={() => setSteak((s) => ({ ...s, [it.dishId]: s[it.dishId].map((p, i) => (i === k ? { ...p, [g.key]: o } : p)) }))}
                                  className={cn('rounded-full border px-3 py-1 text-[12.5px] font-medium transition-colors', pick[g.key] === o ? 'border-transparent bg-[var(--qr-primary)] text-white' : 'border-[var(--qr-border)] bg-[var(--qr-surface)]')}>
                                  {o}
                                </button>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                ) : null}
                {it.allowVariant ? (
                  <div className="mt-3">
                    <p className={cn('mb-2 text-[12.5px] font-semibold', variantLeft(it) ? 'text-[var(--qr-warn-text)]' : 'text-[var(--qr-success)]')}>
                      {variantLeft(it) > 0 ? `Chọn thêm ${variantLeft(it)} lon` : variantLeft(it) < 0 ? `Bớt ${-variantLeft(it)} lon` : 'Đã chọn đủ'}
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      {members(it.groupId).map((m) => {
                        const q = variants[it.dishId]?.[m.id] ?? 0;
                        return (
                          <div key={m.id} className={cn('flex items-center gap-2 rounded-xl border p-1.5', q ? 'border-[var(--qr-primary)]' : 'border-[var(--qr-border)]')}>
                            <DishImage dish={m} className="h-9 w-9 shrink-0 rounded-lg" emojiSize={20} />
                            <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium">{m.variantLabel ?? m.name}</span>
                            <Stepper value={q} min={0} max={it.qty} size="sm" onChange={(v) => setVariants((s) => ({ ...s, [it.dishId]: { ...s[it.dishId], [m.id]: Math.max(0, v) } }))} />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
      <div className="absolute inset-x-0 bottom-0 z-20 flex items-center gap-3 border-t border-[var(--qr-border)] bg-[var(--qr-bg)] px-5 pb-[max(14px,env(safe-area-inset-bottom))] pt-3">
        <Stepper value={qty} onChange={setQty} min={1} />
        <motion.button whileTap={{ scale: 0.96 }} type="button" disabled={!ready} onClick={add} className={cn(Q.btn, 'relative flex-1 overflow-hidden px-4 transition-colors', added && 'bg-[var(--qr-success)]')}>
          <AnimatePresence mode="wait" initial={false}>
            {added ? (
              <motion.span key="ok" initial={{ y: 18, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ opacity: 0 }} className="inline-flex items-center gap-1.5"><Check size={18} weight="bold" />Đã thêm</motion.span>
            ) : (
              <motion.span key="add" exit={{ y: -18, opacity: 0 }} className="inline-flex items-center gap-1.5">{ready ? <>Thêm set · <AnimatedNumber value={set.price * qty} format={vnd} /></> : 'Chọn đủ nước ngọt'}</motion.span>
            )}
          </AnimatePresence>
        </motion.button>
      </div>
    </Screen>
  );
}

/* ---------------------------------------------------------------- Gọi thêm trong chi tiết món */

export function AddonStrip({ addons, categoryOf, qtyOf, onAdd }: {
  addons: MenuDish[];
  categoryOf: (dishId: string) => string | undefined;
  qtyOf: (dishId: string) => number;
  onAdd: (d: MenuDish) => void;
}) {
  if (!addons.length) return null;
  return (
    <div className="rounded-[20px] border border-[var(--qr-border)] bg-[var(--qr-surface)] p-4">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-[15.5px] font-semibold">Gọi thêm cho món này</p>
        <span className="text-[12px] font-medium text-[var(--qr-muted)]">Tính tiền riêng</span>
      </div>
      <div className="no-scrollbar -mx-4 mt-3 flex gap-2.5 overflow-x-auto px-4 pb-1">
        {addons.map((a) => {
          const q = qtyOf(a.id);
          return (
            <div key={a.id} className={cn('relative w-[118px] shrink-0 overflow-hidden rounded-2xl border bg-[var(--qr-bg)]', q ? 'border-[var(--qr-primary)]' : 'border-[var(--qr-border)]', a.soldOut && 'opacity-55')}>
              <DishImage dish={a} categoryName={categoryOf(a.id)} soldOut={a.soldOut} className="aspect-[4/3] w-full" emojiSize={30} />
              <div className="px-2 pb-2 pt-1.5">
                <p className="line-clamp-2 min-h-[32px] text-[12.5px] font-semibold leading-tight">{a.name}</p>
                <div className="mt-1 flex items-center justify-between">
                  <span className="text-[12.5px] font-bold text-[var(--qr-primary)]">{vnd(a.price)}</span>
                  <motion.button whileTap={{ scale: 0.85 }} type="button" disabled={a.soldOut} onClick={() => onAdd(a)} aria-label={`Gọi thêm ${a.name}`} className="relative grid h-7 w-7 place-items-center rounded-full bg-[var(--qr-primary)] text-white disabled:opacity-40">
                    <Plus size={14} weight="bold" />
                    {q ? <span className="absolute -right-1.5 -top-1.5 grid h-[17px] min-w-[17px] place-items-center rounded-full bg-[var(--qr-text)] px-1 text-[10px] font-bold text-[var(--qr-bg)]">{q}</span> : null}
                  </motion.button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
