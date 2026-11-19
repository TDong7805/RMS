import { useRef } from 'react';
import { animate, motion, useMotionValue, useReducedMotion, useTransform, type PanInfo } from 'motion/react';
import { cn } from '@/lib/cn';

/**
 * Nút sáng / tối dạng đèn thả chụp vàng đồng treo từ mép trên ảnh bìa, có sợi dây kéo.
 * Kéo núm dây xuống rồi thả (hoặc bấm núm / bấm đèn / phím Enter) để bật – tắt: đèn sáng = nền sáng, tắt = nền tối.
 * Thả tay thì dây nảy lên, đèn đung đưa vài nhịp. onToggle nhận vị trí núm để màn hình đổi màu lan ra từ đó.
 */
export function LampSwitch({ on, onToggle, className }: { on: boolean; onToggle: (origin: { x: number; y: number }) => void; className?: string }) {
  const reduce = useReducedMotion();
  const pull = useMotionValue(0);
  const cordLen = useTransform(pull, (v) => 34 + Math.max(0, v));
  const swing = useMotionValue(0);
  const knob = useRef<HTMLButtonElement>(null);

  const fire = () => {
    const r = knob.current?.getBoundingClientRect();
    onToggle(r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : { x: window.innerWidth - 40, y: 80 });
    if (!reduce) animate(swing, [0, 9, -7, 5, -3, 1.5, 0], { duration: 1.6, ease: 'easeOut' });
  };
  const onDragEnd = (_: unknown, i: PanInfo) => {
    if (i.offset.y > 16) fire();
    animate(pull, 0, { type: 'spring', stiffness: 520, damping: reduce ? 40 : 9 });
  };

  return (
    <motion.div className={cn('pointer-events-none absolute right-5 top-0 z-10 flex w-14 flex-col items-center', className)} style={{ rotate: swing, transformOrigin: '50% 0%' }}>
      {/* Dây treo */}
      <span aria-hidden className="h-6 w-[2px] bg-gradient-to-b from-black/50 to-[#7a5a32]" />
      {/* Chụp đèn */}
      <button type="button" onClick={fire} aria-label={on ? 'Tắt đèn – chuyển sang nền tối' : 'Bật đèn – chuyển sang nền sáng'} className="pointer-events-auto relative">
        <svg width="46" height="30" viewBox="0 0 46 30" aria-hidden>
          <defs>
            <linearGradient id="lamp-shade" x1="0" x2="1">
              <stop offset="0" stopColor="#8a6a3c" />
              <stop offset="0.45" stopColor="#e6c88f" />
              <stop offset="1" stopColor="#9b7742" />
            </linearGradient>
          </defs>
          <rect x="19" y="0" width="8" height="5" rx="1.5" fill="#6b4f2b" />
          <path d="M23 4 C10 6 4 16 2 27 L44 27 C42 16 36 6 23 4 Z" fill="url(#lamp-shade)" stroke="#5a4222" strokeWidth="1" />
          <rect x="1" y="26" width="44" height="3" rx="1.5" fill="#5a4222" />
        </svg>
        {/* Bóng đèn */}
        <span
          aria-hidden
          className={cn('absolute left-1/2 top-[25px] h-3 w-5 -translate-x-1/2 rounded-b-full transition-colors duration-300', on ? 'bg-[#fff1c9] shadow-[0_0_14px_6px_rgba(255,214,140,0.85)]' : 'bg-[#5b5048]')}
        />
      </button>
      {/* Vệt sáng hắt xuống ảnh bìa khi đèn bật */}
      <span
        aria-hidden
        className={cn('absolute top-[50px] h-[130px] w-[150px] transition-opacity duration-500', on ? 'opacity-100' : 'opacity-0')}
        style={{ background: 'radial-gradient(ellipse 50% 100% at 50% 0%, rgba(255,214,140,0.45), rgba(255,214,140,0.08) 60%, transparent 75%)', clipPath: 'polygon(36% 0, 64% 0, 100% 100%, 0 100%)', mixBlendMode: 'screen' }}
      />
      {/* Dây kéo + núm */}
      <motion.span aria-hidden className="mt-1 w-px bg-[#c9a26b]" style={{ height: cordLen }} />
      <motion.button
        ref={knob}
        type="button"
        tabIndex={-1}
        aria-hidden
        // Kéo bằng cử chỉ "pan": dây dài ra theo tay (tối đa ~40px), núm đi theo đầu dây.
        onPan={(_, i) => pull.set(Math.max(0, Math.min(40, i.offset.y * 0.8)))}
        onPanEnd={onDragEnd}
        onClick={fire}
        whileTap={{ scale: 1.15 }}
        className="pointer-events-auto -mt-px h-[15px] w-[11px] touch-none rounded-full bg-gradient-to-b from-[#f0d9a8] to-[#a8823f] shadow-[0_2px_4px_rgba(0,0,0,0.4)]"
      />
    </motion.div>
  );
}
