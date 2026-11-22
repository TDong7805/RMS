import { forwardRef, useEffect, useImperativeHandle, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { cn } from '@/lib/cn';
import type { BookHandle, BookProps } from './PageFlipBook';
import { pagesOfView, viewCount, viewOfPage } from './pagination';

/**
 * Sách KHÔNG có hiệu ứng lật — dùng khi người dùng bật "giảm chuyển động" (prefers-reduced-motion):
 * đổi trang bằng mờ dần ngắn, vẫn vuốt / nút / phím / mục lục như sách lật trang (cùng BookHandle).
 */
export const StaticBook = forwardRef<BookHandle, BookProps>(function StaticBook(
  { pages, pageW, pageH, spread, startPage, renderPage, onPage },
  ref,
) {
  const total = pages.length;
  const views = viewCount(total, spread);
  const [view, setView] = useState(() => viewOfPage(Math.max(0, Math.min(total - 1, startPage)), spread));
  const onPageRef = useRef(onPage);
  onPageRef.current = onPage;

  // Chia lại trang (xoay máy) → mở đúng trang mốc.
  useEffect(() => {
    setView(viewOfPage(Math.max(0, Math.min(total - 1, startPage)), spread));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pages, spread]);

  useEffect(() => {
    const [l, r] = pagesOfView(view, spread, total);
    onPageRef.current(l ?? r ?? 0);
  }, [view, spread, total]);

  const go = (v: number) => setView(Math.max(0, Math.min(views - 1, v)));
  useImperativeHandle(ref, () => ({
    next: () => go(view + 1),
    prev: () => go(view - 1),
    goTo: (page: number) => go(viewOfPage(page, spread)),
    busy: () => false,
  }));

  // Vuốt ngang (không hoạt ảnh) — chạm vào nút / mục lục thì bỏ qua.
  const start = useRef<{ x: number; y: number; id: number } | null>(null);
  const onDown = (e: ReactPointerEvent) => {
    if ((e.target as Element).closest('button, a')) return;
    start.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
  };
  const onUp = (e: ReactPointerEvent) => {
    const s = start.current;
    start.current = null;
    if (!s || s.id !== e.pointerId) return;
    const dx = e.clientX - s.x;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(e.clientY - s.y)) go(view + (dx < 0 ? 1 : -1));
  };

  const [l, r] = pagesOfView(view, spread, total);
  return (
    <div
      className={cn('fb-static', spread ? 'fb-static--spread' : 'fb-static--single')}
      style={{ width: spread ? pageW * 2 : pageW, height: pageH }}
      onPointerDown={onDown}
      onPointerUp={onUp}
    >
      <div key={view} className="fb-static__view">
        {spread ? <div className="fb-static__page">{l !== null ? renderPage(l) : null}</div> : null}
        <div className="fb-static__page">{r !== null ? renderPage(r) : null}</div>
      </div>
    </div>
  );
});
