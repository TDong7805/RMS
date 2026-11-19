import { useEffect, useRef, type ReactNode } from 'react';
import { useReducedMotion } from 'motion/react';

/**
 * Băng chuyền "Bán chạy": khối nền nâu than tràn ngang (luôn tối, cả khi trang ở chế độ sáng) để tách hẳn khỏi phần
 * "Tất cả món"; đèn vàng chiếu xuống từng thẻ. Thẻ tự trượt chậm **qua lại** (1 → 10 rồi 10 → 1, dừng 1,5 giây ở mỗi đầu,
 * chậm dần khi gần mép); khách chạm / vuốt / rê chuột thì dừng, để yên 4 giây lại chạy tiếp theo chiều đang chạy.
 * Giảm chuyển động: không tự trượt.
 */
export function BestCarousel({ title, children }: { title: string; children: ReactNode }) {
  const scroller = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  useEffect(() => {
    const el = scroller.current;
    if (!el || reduce) return;
    let raf = 0;
    let last = 0;
    let pausedUntil = performance.now() + 2500;
    let visible = true;
    let pos = el.scrollLeft;
    let dir = 1;
    const pause = (ms = 4000) => { pausedUntil = performance.now() + ms; pos = el.scrollLeft; };
    const step = (t: number) => {
      raf = requestAnimationFrame(step);
      const dt = last ? Math.min(64, t - last) : 16;
      last = t;
      if (!visible || document.hidden || t < pausedUntil) return;
      const max = el.scrollWidth - el.clientWidth;
      if (max <= 0) return;
      // Chạy qua lại: tới mép thì dừng 1,5 giây rồi đổi chiều; gần mép chạy chậm dần, rời mép nhanh dần.
      if ((dir > 0 && pos >= max - 0.5) || (dir < 0 && pos <= 0.5)) {
        dir = -dir;
        pause(1500);
        return;
      }
      const edge = dir > 0 ? max - pos : pos; // khoảng cách tới mép đang chạy tới
      const from = dir > 0 ? pos : max - pos; // khoảng cách từ mép vừa rời
      const ease = Math.max(0.35, Math.min(1, edge / 90, (from + 30) / 90));
      pos = Math.max(0, Math.min(max, pos + dir * dt * 0.03 * ease)); // tối đa ~30px / giây
      el.scrollLeft = pos;
    };
    const onUser = () => pause();
    el.addEventListener('pointerdown', onUser, { passive: true });
    el.addEventListener('touchstart', onUser, { passive: true });
    el.addEventListener('wheel', onUser, { passive: true });
    el.addEventListener('mouseenter', onUser);
    el.addEventListener('focusin', onUser);
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; pos = el.scrollLeft; }, { threshold: 0.2 });
    io.observe(el);
    raf = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      el.removeEventListener('pointerdown', onUser);
      el.removeEventListener('touchstart', onUser);
      el.removeEventListener('wheel', onUser);
      el.removeEventListener('mouseenter', onUser);
      el.removeEventListener('focusin', onUser);
    };
  }, [reduce]);

  return (
    <div className="qr-theme qr-best -mx-5 mt-1 overflow-hidden pb-5 pt-4" data-qr-mode="dark">
      <div className="flex items-baseline justify-between px-5">
        <h2 className="text-[22px] font-bold text-[#e6c88f]">{title}</h2>
        <span className="text-[12px] text-[var(--qr-muted)]">Món được gọi nhiều nhất 7 ngày qua</span>
      </div>
      <div ref={scroller} className="no-scrollbar mt-3 flex gap-4 overflow-x-auto px-5 pb-2 pt-3">
        {children}
      </div>
    </div>
  );
}
