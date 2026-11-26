import { useEffect, useRef, useState, type RefObject } from 'react';

/**
 * Hiệu ứng cuộn của website khách (luôn bật — QUY_TAC_GIAO_DIEN K3).
 *
 * useReveal: mọi phần tử có thuộc tính data-reveal trong khung được "hiện dần" (thêm class is-in) khi cuộn tới,
 * mỗi phần tử một lần. Độ trễ đặt bằng biến CSS --d (vd. style={{ '--d': '120ms' }}). Kiểu hiện: data-reveal="up"
 * (trượt lên, mặc định), "fade" (chỉ mờ dần), "zoom" (thu nhỏ về đúng cỡ), "left" / "right" (trượt ngang).
 * `deps` đổi (vd. dữ liệu tải xong, có thêm phần tử) thì quét lại.
 */
export function useReveal(root: RefObject<HTMLElement | null>, deps: unknown[] = []) {
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add('is-in');
            io.unobserve(e.target);
          }
        }
      },
      { rootMargin: '0px 0px -12% 0px', threshold: 0.08 },
    );
    el.querySelectorAll('[data-reveal]:not(.is-in)').forEach((n) => io.observe(n));
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

/** Vị trí cuộn dọc, cập nhật theo khung hình (requestAnimationFrame) — dùng cho thị sai (parallax) và thanh trên. */
export function useScrollY(): number {
  const [y, setY] = useState(() => (typeof window === 'undefined' ? 0 : window.scrollY));
  useEffect(() => {
    let frame = 0;
    const on = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        setY(window.scrollY);
      });
    };
    window.addEventListener('scroll', on, { passive: true });
    return () => {
      window.removeEventListener('scroll', on);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);
  return y;
}

/** Id mục đang nằm giữa màn hình (để tô mục tương ứng trên thanh menu). */
export function useActiveSection(ids: string[], enabled: boolean): string {
  const [active, setActive] = useState('');
  const key = ids.join(',');
  useEffect(() => {
    if (!enabled) {
      setActive('');
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setActive(e.target.id);
      },
      { rootMargin: '-45% 0px -50% 0px' },
    );
    // Trang chủ vẽ các mục sau khi tải dữ liệu: quét lại vài lần cho chắc.
    const scan = () => ids.forEach((id) => {
      const n = document.getElementById(id);
      if (n) io.observe(n);
    });
    scan();
    const t = window.setTimeout(scan, 800);
    return () => {
      window.clearTimeout(t);
      io.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled]);
  return active;
}

/** Phần tử có đang trong khung nhìn không (vd. ẩn nút nổi "Đặt bàn ngay" khi form đặt bàn đang hiện). */
export function useInView(id: string, enabled: boolean): boolean {
  const [inView, setInView] = useState(false);
  useEffect(() => {
    if (!enabled) return;
    let io: IntersectionObserver | null = null;
    const attach = () => {
      const n = document.getElementById(id);
      if (!n || io) return;
      io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: 0.15 });
      io.observe(n);
    };
    attach();
    const t = window.setInterval(attach, 600);
    return () => {
      window.clearInterval(t);
      io?.disconnect();
    };
  }, [id, enabled]);
  return inView;
}

/** Tự chuyển ảnh sau mỗi `ms`; dừng khi rê chuột / đang chạm (hover = true) hoặc tab bị ẩn. */
export function useAutoAdvance(count: number, ms: number, paused: boolean) {
  const [index, setIndex] = useState(0);
  const timer = useRef(0);
  useEffect(() => {
    if (count < 2 || paused) return;
    timer.current = window.setInterval(() => {
      if (!document.hidden) setIndex((i) => (i + 1) % count);
    }, ms);
    return () => window.clearInterval(timer.current);
  }, [count, ms, paused, index]);
  useEffect(() => {
    if (index >= count) setIndex(0);
  }, [count, index]);
  return [index, setIndex] as const;
}
