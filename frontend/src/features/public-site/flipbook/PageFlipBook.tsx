import { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { PageFlip, type FlipController, type Point } from 'page-flip/dist/js/page-flip.module.js';
import type { BookPage } from './pagination';

/** Thời gian một lần lật (ms). */
export const FLIP_MS = 700;
/** Vùng kích hoạt cong góc khi rê chuột: 72px tính từ mỗi góc ngoài (thư viện mặc định 1/5 đường chéo trang). */
export const CORNER_ZONE = 72;

export interface BookHandle {
  next(): void;
  prev(): void;
  /** Lật (có hiệu ứng) tới khung chứa trang `page`. */
  goTo(page: number): void;
  /** Đang lật / đang kéo — bỏ qua phím bấm trong lúc này. */
  busy(): boolean;
}

export interface BookProps {
  pages: BookPage[];
  pageW: number;
  pageH: number;
  spread: boolean;
  /** Trang mở sẵn khi dựng sách (giữ vị trí khi xoay máy / đổi cỡ). */
  startPage: number;
  renderPage: (index: number) => ReactNode;
  onPage: (index: number) => void;
  /** Trạng thái thư viện: "flipping" = đang lật (tự động / sau khi thả tay), "read" = nằm yên. */
  onState?: (state: 'read' | 'flipping' | 'user_fold' | 'fold_corner') => void;
}

/** Thu vùng góc về CORNER_ZONE px (4 góc ngoài của cuốn sách) — ghi đè trên đúng phiên bản sách này. */
function limitCornerZone(fc: FlipController, size: number) {
  fc.isPointOnCorners = function isPointOnCorners(this: FlipController, pos: Point) {
    const rect = this.getBoundsRect();
    const p = this.render.convertToBook(pos);
    return p.x > 0 && p.y > 0 && p.x < rect.width && p.y < rect.height
      && (p.x < size || p.x > rect.width - size) && (p.y < size || p.y > rect.height - size);
  };
}

/**
 * Độ cứng của bìa. Thư viện (showCover) tính hình học lật bìa theo kiểu TRANG CỨNG vì bìa đứng một mình trong khung:
 * để bìa mềm khi lật VỀ bìa trước / TỚI bìa sau thì lá bìa trôi lơ lửng trên trang bên dưới (lỗi hiển thị).
 * Nên: bìa là giấy MỀM chỉ khi sách đang đóng ở chính bìa đó (rê góc cong, gợi ý cong góc, kéo mở sách giống mọi trang),
 * còn khi sách đã mở thì bìa CỨNG → lật về / lật tới bìa đóng lại đúng như bìa sách thật.
 */
function setCoverDensity(pf: PageFlip, count: number) {
  const current = pf.getCurrentPageIndex();
  const set = (i: number, soft: boolean) => {
    try {
      pf.getPage(i).setDensity(soft ? 'soft' : 'hard');
    } catch {
      /* trang không tồn tại */
    }
  };
  set(0, current === 0);
  set(count - 1, current === count - 1);
}

/**
 * Gợi ý trên màn hình cảm ứng (không rê chuột được): góc dưới-phải tự cong nhẹ rồi hạ xuống, một lần mỗi phiên.
 * Dùng chính showCorner() của thư viện nên hình cong / bóng giống hệt khi rê chuột thật.
 */
function hintCorner(pf: PageFlip) {
  const fc = pf.getFlipController();
  const r = pf.getBoundsRect();
  const corner = { x: r.left + r.width - 2, y: r.top + r.height - 2 };
  const t0 = performance.now();
  let raf = 0;
  let timer = 0;
  let stopped = false;
  const release = () => fc.showCorner({ x: -9999, y: -9999 }); // ra khỏi góc → thư viện tự hạ góc
  const step = (now: number) => {
    if (stopped) return;
    // Sách đã rời bìa (người dùng lật bằng nút / phím) hoặc đang lật → không cong góc trang khác.
    if (pf.getCurrentPageIndex() !== 0 || (pf.getState() !== 'read' && pf.getState() !== 'fold_corner')) {
      stopped = true;
      window.removeEventListener('pointerdown', stop, true);
      return;
    }
    const t = Math.min(1, (now - t0) / 650);
    const e = 1 - (1 - t) * (1 - t);
    fc.showCorner({ x: corner.x - e * 60, y: corner.y - e * 42 });
    if (t < 1) raf = requestAnimationFrame(step);
    else timer = window.setTimeout(release, 700);
  };
  // Người dùng chạm / bấm bất cứ đâu trong lúc gợi ý → dừng ngay, hạ góc, nhường thao tác thật.
  const stop = () => {
    if (stopped) return;
    stopped = true;
    cancelAnimationFrame(raf);
    window.clearTimeout(timer);
    window.removeEventListener('pointerdown', stop, true);
    release();
  };
  window.addEventListener('pointerdown', stop, true);
  raf = requestAnimationFrame(step);
  return stop;
}

/**
 * Sách lật trang dùng thư viện page-flip (StPageFlip, MIT): cong góc khi rê chuột (showPageCorners), kéo / vuốt gập
 * theo đường chéo bám con trỏ, bóng đổ dọc nếp gập (drawShadow), thả quá nửa thì lật hẳn, chưa đủ thì bật về.
 *
 * Thư viện tự di chuyển các phần tử trang trong DOM, nên các <div> trang được TẠO BẰNG TAY (React không quản lý);
 * React chỉ vẽ nội dung vào trong qua portal → không xung đột khi thư viện xếp lại trang.
 * Đổi số trang / kích thước (xoay máy) → hủy và dựng lại sách tại startPage.
 */
export const PageFlipBook = forwardRef<BookHandle, BookProps>(function PageFlipBook(
  { pages, pageW, pageH, spread, startPage, renderPage, onPage, onState },
  ref,
) {
  const hostRef = useRef<HTMLDivElement>(null);
  const pfRef = useRef<PageFlip | null>(null);
  const [sheets, setSheets] = useState<HTMLDivElement[]>([]);
  const onPageRef = useRef(onPage);
  onPageRef.current = onPage;
  const onStateRef = useRef(onState);
  onStateRef.current = onState;
  const startRef = useRef(startPage);
  startRef.current = startPage;

  useLayoutEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const block = document.createElement('div');
    block.className = 'fb-pf';
    block.style.width = `${spread ? pageW * 2 : pageW}px`;
    block.style.height = `${pageH}px`;
    host.appendChild(block);
    const nodes = pages.map(() => {
      const el = document.createElement('div');
      el.className = 'fb-sheet';
      // Mọi trang (kể cả bìa) là giấy mềm → góc cong / gập chéo giống nhau ở mọi trang.
      // Muốn bìa cứng (lật thẳng, không cong) thì đặt el.dataset.density = 'hard' cho trang cover / back —
      // lưu ý: khi đó trang kề bìa cũng lật thẳng và gợi ý cong góc ở bìa chỉ "hé bìa".
      block.appendChild(el);
      return el;
    });

    const pf = new PageFlip(block, {
      width: pageW,
      height: pageH,
      size: 'fixed',
      autoSize: false,
      usePortrait: !spread,
      showCover: true,
      startPage: Math.max(0, Math.min(pages.length - 1, startRef.current)),
      flippingTime: FLIP_MS,
      drawShadow: true,
      maxShadowOpacity: 0.5,
      showPageCorners: true,
      disableFlipByClick: true, // chỉ bấm vào góc mới lật — bấm mục lục / chữ trên trang không lật nhầm
      clickEventForward: true,
      mobileScrollSupport: true, // vuốt dọc vẫn cuộn trang
      swipeDistance: 30,
      useMouseEvents: true,
    });
    pf.on('flip', (e) => onPageRef.current(Number(e.data)));
    pf.on('changeState', (e) => onStateRef.current?.(e.data));
    pf.loadFromHTML(nodes);
    // Bộ điều khiển lật chỉ có sau loadFromHTML.
    limitCornerZone(pf.getFlipController(), CORNER_ZONE);
    setCoverDensity(pf, nodes.length);
    pf.on('flip', () => setCoverDensity(pf, nodes.length));
    pf.on('update', () => setCoverDensity(pf, nodes.length));
    pf.on('changeOrientation', () => setCoverDensity(pf, nodes.length));
    pfRef.current = pf;
    setSheets(nodes);
    onPageRef.current(pf.getCurrentPageIndex());

    return () => {
      pfRef.current = null;
      try {
        pf.destroy();
      } catch {
        block.remove();
      }
    };
  }, [pages, pageW, pageH, spread]);

  // Gợi ý cong góc trên màn hình cảm ứng: một lần mỗi phiên, khi sách đang ở bìa.
  useEffect(() => {
    const pf = pfRef.current;
    if (!pf || !sheets.length || !window.matchMedia('(hover: none)').matches) return;
    let shown = false;
    try {
      shown = sessionStorage.getItem('fb-corner-hint') === '1';
    } catch {
      /* chế độ riêng tư: vẫn chạy gợi ý */
    }
    if (shown || pf.getCurrentPageIndex() !== 0) return;
    let stop = () => {};
    // Người dùng chạm / bấm trước khi gợi ý kịp chạy → bỏ gợi ý (họ đã biết thao tác với sách).
    const cancelPending = () => window.clearTimeout(t);
    window.addEventListener('pointerdown', cancelPending, { capture: true, once: true });
    window.addEventListener('keydown', cancelPending, { capture: true, once: true });
    const t = window.setTimeout(() => {
      window.removeEventListener('pointerdown', cancelPending, true);
      window.removeEventListener('keydown', cancelPending, true);
      if (pf.getCurrentPageIndex() !== 0 || pf.getState() !== 'read') return;
      // Ghi "đã gợi ý" khi gợi ý THẬT SỰ chạy (StrictMode chạy effect hai lần — ghi sớm thì lần thật bị bỏ qua).
      try {
        sessionStorage.setItem('fb-corner-hint', '1');
      } catch {
        /* bỏ qua */
      }
      stop = hintCorner(pf);
    }, 900);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener('pointerdown', cancelPending, true);
      window.removeEventListener('keydown', cancelPending, true);
      stop();
    };
  }, [sheets]);

  useImperativeHandle(ref, () => ({
    next: () => pfRef.current?.flipNext('bottom'),
    prev: () => pfRef.current?.flipPrev('bottom'),
    goTo: (page: number) => {
      const pf = pfRef.current;
      if (!pf || page < 0 || page >= pages.length) return;
      pf.flip(page, 'top');
    },
    busy: () => {
      const s = pfRef.current?.getState();
      return Boolean(s && s !== 'read');
    },
  }), [pages.length]);

  return (
    <div ref={hostRef} className="fb-pf-host" style={{ width: spread ? pageW * 2 : pageW, height: pageH }}>
      {sheets.map((el, i) => (i < pages.length ? createPortal(renderPage(i), el, pages[i].key) : null))}
    </div>
  );
});
