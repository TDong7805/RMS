import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { animate, useReducedMotion } from 'motion/react';
import type { AnimationItem } from 'lottie-web';
import { cn } from '@/lib/cn';

/*
 * Hiệu ứng của trang đặt món (QR): emoji 3D, tranh động Lottie, món bay vào giỏ, số chạy.
 * Tài nguyên ở frontend/public/qr (xem NGUON_TAI_NGUYEN.md). Điện thoại bật "giảm chuyển động" thì tự tắt hiệu ứng.
 */

/* ---------------------------------------------------------------- Emoji 3D (Fluent Emoji, MIT) */

export type EmojiKey =
  | 'all' | 'hotpot' | 'salad' | 'meat' | 'noodle' | 'rice' | 'drink' | 'coffee' | 'beer' | 'cake' | 'icecream' | 'leaf'
  | 'shrimp' | 'fish' | 'chicken' | 'spaghetti' | 'burger' | 'fries' | 'wine' | 'tea' | 'warning' | 'bell';

export function Emoji({ name, size = 20, className, label }: { name: EmojiKey; size?: number; className?: string; label?: string }) {
  return (
    <img
      src={`/qr/emoji/${name}.webp`}
      width={size}
      height={size}
      alt={label ?? ''}
      aria-hidden={label ? undefined : true}
      draggable={false}
      className={cn('inline-block shrink-0 select-none', className)}
      style={{ width: size, height: size }}
    />
  );
}

// Thứ tự quan trọng: "Tráng miệng" chứa "mi" (giống "mì"); "Món nước" chứa "nước" (giống đồ uống);
// "Tomahawk" chứa "Tom" (giống "tôm") nên tôm / cá / gà so cả từ. Lẩu, món nước xét trước bít tết ("Phở Wagyu", "Lẩu shabu Wagyu").
const CATEGORY_EMOJI: { match: RegExp; emoji: EmojiKey }[] = [
  { match: /tr[aá]ng mi[eệ]ng|ch[eè]|b[aá]nh ng[oọ]t|flan/i, emoji: 'cake' },
  { match: /kem/i, emoji: 'icecream' },
  { match: /c[aà] ph[eê]|coffee/i, emoji: 'coffee' },
  { match: /(^|\s)tr[aà](\s|$)|tea/i, emoji: 'tea' },
  { match: /vang|wine/i, emoji: 'wine' },
  { match: /bia|r[uư][oợ]u/i, emoji: 'beer' },
  { match: /l[aẩ]u/i, emoji: 'hotpot' },
  { match: /m[oó]n n[uư][oớ]c/i, emoji: 'noodle' },
  { match: /u[oố]ng|n[uư][oớ]c|sinh t[oố]|drink/i, emoji: 'drink' },
  { match: /khai v|g[oỏ]i|salad|n[oộ]m|chay/i, emoji: 'salad' },
  { match: /h[aả]i s[aả]n|(^|\s)t[oô]m(\s|$)|(^|\s)cua(\s|$)|gh[eẹ]/i, emoji: 'shrimp' },
  { match: /m[iì] [yý]|spaghetti|pasta/i, emoji: 'spaghetti' },
  { match: /khoai t[aâ]y chi[eê]n|fries/i, emoji: 'fries' },
  { match: /c[oơ]m|x[oô]i/i, emoji: 'rice' },
  { match: /burger/i, emoji: 'burger' },
  { match: /(^|\s)c[aá](\s|$)/i, emoji: 'fish' },
  { match: /(^|\s)g[aà](\s|$)|v[iị]t/i, emoji: 'chicken' },
  { match: /m[iì]|ph[oở]|b[uú]n|mi[eế]n|h[uủ] ti[eế]u/i, emoji: 'noodle' },
  { match: /b[ií]t t[eế]t|steak|ribeye|striploin|tenderloin|t-bone|tomahawk|wagyu/i, emoji: 'meat' },
  { match: /m[uù]a|đ[aặ]c bi[eệ]t/i, emoji: 'leaf' },
  { match: /ch[ií]nh|b[oò]|th[iị]t|n[uư][oớ]ng/i, emoji: 'meat' },
];

/** Emoji của danh mục món, đoán theo tên do quản lý đặt; không đoán được thì 🍽️. */
export const categoryEmoji = (name: string | undefined): EmojiKey => CATEGORY_EMOJI.find((m) => m.match.test(name ?? ''))?.emoji ?? 'all';

/** Emoji cho món chưa có ảnh: đoán theo tên món (Gà nướng → 🍗), không đoán được thì theo danh mục. */
export const dishEmoji = (dishName: string, categoryName: string | undefined): EmojiKey => {
  const own = CATEGORY_EMOJI.find((m) => m.match.test(dishName))?.emoji;
  return own && own !== 'meat' && own !== 'leaf' ? own : categoryEmoji(categoryName);
};

/* ---------------------------------------------------------------- Tranh động Lottie (LottieFiles, miễn phí) */

export type LottieName = 'empty-cart' | 'sent' | 'cooking' | 'ready' | 'served';
const lottieCache = new Map<string, Promise<unknown>>();
const loadJson = (name: string) => {
  if (!lottieCache.has(name)) lottieCache.set(name, fetch(`/qr/lottie/${name}.json`).then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status))))));
  return lottieCache.get(name)!;
};

/** Phát tranh động (tải trình phát khi cần). Giảm chuyển động: dừng ở một khung hình đẹp. */
export function Lottie({ name, loop = true, className, style }: { name: LottieName; loop?: boolean; className?: string; style?: CSSProperties }) {
  const box = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  useEffect(() => {
    let anim: AnimationItem | null = null;
    let cancelled = false;
    Promise.all([import('lottie-web/build/player/lottie_light'), loadJson(name)])
      .then(([mod, data]) => {
        if (cancelled || !box.current) return;
        box.current.innerHTML = '';
        const a = mod.default.loadAnimation({
          container: box.current,
          renderer: 'svg',
          loop,
          autoplay: !reduce,
          animationData: structuredClone(data),
          rendererSettings: { preserveAspectRatio: 'xMidYMid meet' },
        });
        anim = a;
        if (reduce) a.addEventListener('DOMLoaded', () => a.goToAndStop(Math.floor(a.totalFrames * 0.6), true));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
      anim?.destroy();
    };
  }, [name, loop, reduce]);
  return <div ref={box} className={className} style={style} aria-hidden data-lottie={name} />;
}

/* ---------------------------------------------------------------- Món bay vào giỏ */

interface FlyApi {
  /** Ảnh món (hoặc emoji danh mục) bay theo đường cong từ phần tử nguồn vào giỏ. */
  fly: (from: HTMLElement | DOMRect | null, image: string | null, emoji: EmojiKey) => void;
  /** Phần tử đích (biểu tượng giỏ trên thanh nổi). */
  setTarget: (el: HTMLElement | null) => void;
}

const FlyContext = createContext<FlyApi>({ fly: () => undefined, setTarget: () => undefined });
/** Tăng mỗi lần món "chạm" giỏ — tách context riêng để các thẻ món không vẽ lại mỗi lần giỏ nảy. */
const BumpContext = createContext(0);
export const useFly = () => useContext(FlyContext);
export const useFlyBump = () => useContext(BumpContext);

export function FlyProvider({ children }: { children: ReactNode }) {
  const target = useRef<HTMLElement | null>(null);
  const [bump, setBump] = useState(0);
  const reduce = useReducedMotion();

  const fly = useCallback<FlyApi['fly']>(
    (from, image, emoji) => {
      if ('vibrate' in navigator) navigator.vibrate?.(8);
      if (reduce || !from) {
        setBump((b) => b + 1);
        return;
      }
      const a = from instanceof DOMRect ? from : from.getBoundingClientRect();
      const t = target.current?.getBoundingClientRect();
      // Thanh giỏ chưa hiện (giỏ đang trống): bay về giữa đáy màn hình, nơi thanh giỏ sắp trượt lên.
      const end = t && t.width ? { x: t.left + t.width / 2, y: t.top + t.height / 2 } : { x: window.innerWidth / 2, y: window.innerHeight - 44 };
      const size = Math.min(76, Math.max(44, Math.min(a.width, a.height)));
      const start = { x: a.left + a.width / 2, y: a.top + a.height / 2 };
      const el = document.createElement('div');
      el.setAttribute('aria-hidden', 'true');
      el.style.cssText = `position:fixed;left:0;top:0;width:${size}px;height:${size}px;margin:${-size / 2}px 0 0 ${-size / 2}px;z-index:80;pointer-events:none;border-radius:50%;overflow:hidden;box-shadow:0 8px 24px rgba(0,0,0,.25);background:#fff;will-change:transform`;
      const img = document.createElement('img');
      img.src = image ?? `/qr/emoji/${emoji}.webp`;
      img.style.cssText = `width:100%;height:100%;object-fit:${image ? 'cover' : 'contain'};${image ? '' : 'padding:8px'}`;
      el.appendChild(img);
      document.body.appendChild(el);
      const peakY = Math.min(start.y, end.y) - 90;
      const midX = start.x + (end.x - start.x) * 0.45;
      const anim = el.animate(
        [
          { transform: `translate(${start.x}px, ${start.y}px) scale(1)`, easing: 'cubic-bezier(.2,.7,.4,1)' },
          { transform: `translate(${midX}px, ${peakY}px) scale(.8)`, offset: 0.42, easing: 'cubic-bezier(.6,0,.9,.5)' },
          { transform: `translate(${end.x}px, ${end.y}px) scale(.22)`, opacity: 0.85 },
        ],
        { duration: 720, fill: 'forwards' },
      );
      const done = () => {
        el.remove();
        setBump((b) => b + 1);
      };
      anim.onfinish = done;
      anim.oncancel = done;
    },
    [reduce],
  );

  const api = useMemo<FlyApi>(() => ({ fly, setTarget: (el) => { target.current = el; } }), [fly]);
  return (
    <FlyContext.Provider value={api}>
      <BumpContext.Provider value={bump}>{children}</BumpContext.Provider>
    </FlyContext.Provider>
  );
}

/* ---------------------------------------------------------------- Số chạy (tổng tiền) */

/** Số chạy mượt từ giá trị cũ sang giá trị mới (tiền, tổng). */
export function AnimatedNumber({ value, format }: { value: number; format: (n: number) => string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const prev = useRef(value);
  const reduce = useReducedMotion();
  useEffect(() => {
    const el = ref.current;
    const from = prev.current;
    prev.current = value;
    if (!el || reduce || from === value) {
      if (el) el.textContent = format(value);
      return;
    }
    const controls = animate(from, value, { duration: 0.45, ease: 'easeOut', onUpdate: (v) => { el.textContent = format(v); } });
    return () => controls.stop();
  }, [value, format, reduce]);
  return <span ref={ref} className="tabular-nums">{format(value)}</span>;
}
