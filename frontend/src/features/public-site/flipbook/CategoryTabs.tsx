import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { BookOpen } from 'lucide-react';
import { cn } from '@/lib/cn';

export interface TabItem {
  /** "toc" = trang mục lục, "set" = set menu, còn lại là id danh mục. */
  id: string;
  name: string;
}

/**
 * Thanh mục lục của sách thực đơn — phong cách website (chữ thanh lịch, vàng đồng), không phải dải vòng tròn của trang QR:
 *  - Tên danh mục dạng chữ, gạch chân vàng đồng TRƯỢT tới mục đang xem.
 *  - Lật sách tới danh mục nào → gạch chân trượt tới đó, thanh tự cuộn để mục đó nằm giữa.
 *  - Bấm một mục → sách lật tới danh mục đó. Hai đầu thanh mờ dần khi còn mục bị khuất.
 */
export function CategoryTabs({ items, active, onPick }: { items: TabItem[]; active: string; onPick: (id: string) => void }) {
  const scroller = useRef<HTMLDivElement>(null);
  const [ink, setInk] = useState<{ x: number; w: number } | null>(null);
  const [edges, setEdges] = useState({ left: false, right: false });

  const measure = useCallback(() => {
    const sc = scroller.current;
    const el = sc?.querySelector<HTMLElement>(`[data-tab="${CSS.escape(active)}"]`);
    if (!sc || !el) return;
    setInk({ x: el.offsetLeft + 12, w: Math.max(12, el.offsetWidth - 24) });
    setEdges({ left: sc.scrollLeft > 4, right: sc.scrollLeft + sc.clientWidth < sc.scrollWidth - 4 });
  }, [active]);

  // Đổi mục đang xem → đặt gạch chân + cuộn mục đó vào giữa thanh.
  useLayoutEffect(() => {
    measure();
    const sc = scroller.current;
    const el = sc?.querySelector<HTMLElement>(`[data-tab="${CSS.escape(active)}"]`);
    if (!sc || !el) return;
    // Website luôn bật hiệu ứng (QUY_TAC_GIAO_DIEN K3).
    sc.scrollTo({ left: el.offsetLeft + el.offsetWidth / 2 - sc.clientWidth / 2, behavior: 'smooth' });
  }, [active, items.length, measure]);

  useEffect(() => {
    const sc = scroller.current;
    if (!sc) return;
    const onScroll = () => setEdges({ left: sc.scrollLeft > 4, right: sc.scrollLeft + sc.clientWidth < sc.scrollWidth - 4 });
    const ro = new ResizeObserver(measure);
    ro.observe(sc);
    sc.addEventListener('scroll', onScroll, { passive: true });
    // Phông chữ tải xong → độ rộng chữ đổi → đặt lại gạch chân.
    void document.fonts?.ready.then(measure);
    return () => {
      ro.disconnect();
      sc.removeEventListener('scroll', onScroll);
    };
  }, [measure]);

  return (
    <nav className={cn('fb-tabs', edges.left && 'fb-tabs--fade-left', edges.right && 'fb-tabs--fade-right')} aria-label="Mục lục thực đơn">
      <div ref={scroller} className="fb-tabs__scroller">
        {items.map((t) => {
          const on = t.id === active;
          return (
            <button
              key={t.id}
              type="button"
              data-tab={t.id}
              aria-current={on ? 'true' : undefined}
              className={cn('fb-tabs__tab', on && 'fb-tabs__tab--on', t.id === 'toc' && 'fb-tabs__tab--toc')}
              onClick={() => onPick(t.id)}
            >
              {t.id === 'toc' ? <BookOpen size={15} aria-hidden /> : null}
              {t.name}
            </button>
          );
        })}
        {ink ? <span className="fb-tabs__ink" aria-hidden style={{ transform: `translateX(${ink.x}px)`, width: ink.w }} /> : null}
      </div>
    </nav>
  );
}
