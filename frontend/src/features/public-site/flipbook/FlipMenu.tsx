import './flipbook.css';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, List } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { PublicMenu, PublicSite } from '@/types';
import { CategoryTabs, type TabItem } from './CategoryTabs';
import { PageFace } from './FlipPages';
import { FlipGuide } from './FlipGuide';
import { MenuSearch, normalizeVi, type SearchEntry } from './MenuSearch';
import { PageFlipBook, type BookHandle } from './PageFlipBook';
import { StaticBook } from './StaticBook';
import type { MenuPaper } from './theme';
import {
  anchorOf,
  buildPages,
  imagesOfPage,
  pageOfAnchor,
  pageOfItem,
  pagesOfView,
  viewCount,
  setKey,
  viewOfPage,
  type BookPage,
} from './pagination';

const RESIZE_DEBOUNCE = 150;

function useMedia(query: string): boolean {
  const [match, setMatch] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setMatch(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [query]);
  return match;
}

/**
 * Thực đơn dạng sách lật trang.
 *  - Hiệu ứng lật: PageFlipBook (thư viện page-flip — cong góc khi rê chuột, gập chéo khi kéo / vuốt, bóng đổ);
 *    bật "giảm chuyển động" → StaticBook (mờ dần, không lật).
 *  - Màn hình ngang: hai trang mở; màn hình dọc: một trang. Xoay máy / đổi cỡ cửa sổ: chia lại trang theo kích thước
 *    mới, dựng lại sách và mở đúng món đang xem (mốc = món đầu trang).
 *  - Thanh trên cùng (không lật theo trang): ô tìm món (chọn kết quả → lật tới món), mục lục, ‹ ›, số trang.
 *  - Phím ← → (trừ khi đang gõ trong ô tìm). Tải trước ảnh 1–2 khung kế tiếp.
 */
/** Món cần mở sẵn (chatbot website: /thuc-don?mon=… | ?set=…); nonce đổi mỗi lần điều hướng để bấm lại cùng món vẫn lật tới. */
export interface MenuFocus {
  kind: 'dish' | 'set';
  id: string;
  nonce: string;
}

export function FlipMenu({ menu, site, initialQuery, paper, focus }: {
  menu: PublicMenu; site: PublicSite; initialQuery: string; paper: MenuPaper; focus?: MenuFocus | null;
}) {
  const rootRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const bookRef = useRef<BookHandle>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const landscape = useMedia('(orientation: landscape)');
  // Website luôn bật đủ hiệu ứng, kể cả khi máy bật "giảm chuyển động" (QUY_TAC_GIAO_DIEN K3, chốt 24/11/2026).
  // Sách tĩnh (StaticBook) giữ lại để dùng khi cần, hiện không bật.
  const reduce = false;
  const shortLandscape = useMedia('(orientation: landscape) and (max-height: 520px)');

  /* ---------------------------------------------------- Đo khung (có debounce) */
  useLayoutEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    measure();
    let timer = 0;
    const later = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(measure, RESIZE_DEBOUNCE);
    };
    const ro = new ResizeObserver(later);
    ro.observe(el);
    window.addEventListener('orientationchange', later);
    return () => {
      ro.disconnect();
      window.removeEventListener('orientationchange', later);
      window.clearTimeout(timer);
    };
  }, []);

  // Điện thoại xoay ngang (màn thấp): thanh đầu trang không dính (CSS) → cuộn để sách chiếm trọn màn hình.
  useEffect(() => {
    if (shortLandscape) rootRef.current?.scrollIntoView({ block: 'start' });
  }, [shortLandscape]);

  const layout = useMemo(() => {
    if (!size || size.w < 50 || size.h < 50) return null;
    const spread = landscape && size.w >= 560;
    const side = size.w >= 760 && size.h >= 480 ? 64 : 10; // chừa chỗ nút ‹ › hai bên khi màn rộng và đủ cao
    const maxW = spread ? (size.w - 2 * side) / 2 : size.w - 2 * side;
    const pageH = Math.floor(Math.max(220, Math.min(size.h - 24, (maxW * 4) / 3)));
    const pageW = Math.floor((pageH * 3) / 4);
    return { spread, pageW, pageH, sideNav: side > 10 };
  }, [size, landscape]);

  const pages: BookPage[] = useMemo(
    () => (layout ? buildPages(menu, layout.pageW, layout.pageH, layout.spread) : []),
    [menu, layout],
  );
  const spread = layout?.spread ?? false;
  const total = pages.length;
  const views = viewCount(total, spread);

  /* ---------------------------------------------------- Trang đang xem + mốc giữ vị trí khi chia lại trang */
  const [current, setCurrent] = useState(0);
  const focusId = focus ? (focus.kind === 'set' ? setKey(focus.id) : focus.id) : null;
  // Mở trang từ chatbot: sách dựng lần đầu mở ngay tại trang có món (không lật từ bìa).
  const anchorRef = useRef<string | null>(focusId ? `item:${focusId}` : null);
  // Trang mở khi (dựng lại) sách: tính từ mốc của lần chia trang trước.
  const startPage = useMemo(() => pageOfAnchor(pages, anchorRef.current), [pages]);
  const view = viewOfPage(current, spread);

  const onPage = useCallback((index: number) => {
    setCurrent(index);
    const [l, r] = pagesOfView(viewOfPage(index, spread), spread, pages.length);
    anchorRef.current = anchorOf(pages[l ?? r ?? index]);
  }, [pages, spread]);

  const next = useCallback(() => bookRef.current?.next(), []);
  const prev = useCallback(() => bookRef.current?.prev(), []);
  const jumpToPage = useCallback((p: number) => bookRef.current?.goTo(p), []);

  /* ---------------------------------------------------- Phím ← → */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
      const t = e.target as HTMLElement | null;
      if (t && t.closest('input, textarea, select, [contenteditable="true"]')) return; // đang gõ tìm kiếm
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      e.preventDefault();
      if (bookRef.current?.busy()) return;
      if (e.key === 'ArrowRight') next();
      else prev();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [next, prev]);

  /* ---------------------------------------------------- Tải trước ảnh 1–2 khung kế tiếp */
  const preloaded = useRef(new Set<string>());
  useEffect(() => {
    if (!pages.length) return;
    for (const v of [view + 1, view + 2, view - 1]) {
      if (v < 0 || v >= views) continue;
      for (const p of pagesOfView(v, spread, total)) {
        for (const src of imagesOfPage(p === null ? undefined : pages[p])) {
          if (preloaded.current.has(src)) continue;
          preloaded.current.add(src);
          const img = new Image();
          img.decoding = 'async';
          img.src = src;
        }
      }
    }
  }, [view, pages, spread, total, views]);

  /* ---------------------------------------------------- Tìm kiếm, mục lục */
  const [highlight, setHighlight] = useState<string | null>(null);
  useEffect(() => {
    if (!highlight) return;
    const t = window.setTimeout(() => setHighlight(null), 2800);
    return () => window.clearTimeout(t);
  }, [highlight]);

  const entries: SearchEntry[] = useMemo(() => {
    const cat = new Map(menu.categories.map((c) => [c.id, c.name]));
    return [
      ...menu.items.map((i) => ({
        id: i.id, name: i.name, nameKey: normalizeVi(i.name), category: cat.get(i.categoryId) ?? '', price: i.price,
        haystack: normalizeVi([i.name, i.description, i.variants.join(' '), cat.get(i.categoryId) ?? ''].join(' ')),
      })),
      ...menu.sets.map((s) => ({
        id: setKey(s.id), name: s.name, nameKey: normalizeVi(s.name), category: 'Set menu', price: s.price,
        haystack: normalizeVi([s.name, s.description, s.items.join(' '), 'set menu'].join(' ')),
      })),
    ];
  }, [menu]);

  const pick = (id: string) => {
    const p = pageOfItem(pages, id);
    if (p < 0) return;
    setHighlight(id);
    if (viewOfPage(p, spread) !== view) jumpToPage(p);
  };

  // Chatbot gửi món tới (?mon= / ?set=): làm nổi bật; sách đang mở sẵn thì lật tới món. Mỗi lần điều hướng chỉ chạy một lần.
  const focusDone = useRef<string | null>(null);
  useEffect(() => {
    if (!focus || !focusId || !pages.length || focusDone.current === focus.nonce) return;
    focusDone.current = focus.nonce;
    pick(focusId);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chỉ chạy khi có yêu cầu mới / sách vừa chia trang
  }, [focus?.nonce, focusId, pages.length]);

  const tocTargets = useMemo(() => {
    const out: { id: string; label: string; page: number }[] = [];
    pages.forEach((p, i) => {
      if (p.kind === 'category' && p.first) out.push({ id: p.categoryId, label: p.title, page: i });
      if (p.kind === 'sets' && p.first) out.push({ id: 'set', label: p.title, page: i });
    });
    return out;
  }, [pages]);

  /* ---------------------------------------------------- Thanh mục lục (chữ + gạch chân vàng đồng trượt) */
  const tabItems: TabItem[] = useMemo(
    () => [{ id: 'toc', name: 'Mục lục' }, ...tocTargets.map((t) => ({ id: t.id, name: t.label }))],
    [tocTargets],
  );

  /**
   * Danh mục của khung đang xem: ưu tiên trang BẮT ĐẦU một danh mục (vd. trái "Bò nướng (tiếp)", phải "Lẩu bò" → Lẩu bò),
   * không có thì trang nội dung đầu tiên; bìa / mục lục → "Mục lục".
   */
  // Mục khách vừa bấm trên thanh: nếu đang hiện trong khung thì ưu tiên (khung 2 trang có thể mở đầu HAI danh mục).
  const [pickedTab, setPickedTab] = useState<string | null>(null);
  const activeTab = (() => {
    const shown = pagesOfView(view, spread, total).map((i) => (i === null ? undefined : pages[i]));
    const idOf = (p: BookPage | undefined) => (p?.kind === 'category' ? p.categoryId : p?.kind === 'sets' ? 'set' : null);
    if (pickedTab && shown.some((p) => idOf(p) === pickedTab)) return pickedTab;
    const starting = shown.find((p) => (p?.kind === 'category' || p?.kind === 'sets') && p.first);
    return idOf(starting) ?? shown.map(idOf).find(Boolean) ?? 'toc';
  })();

  const pickTab = (id: string) => {
    setPickedTab(id);
    if (id === 'toc') jumpToPage(pages.findIndex((x) => x.kind === 'toc'));
    else {
      const t = tocTargets.find((x) => x.id === id);
      if (t) jumpToPage(t.page);
    }
  };

  // Lần đầu lật tới trang mục lục (đã nằm yên) → các dòng mục lục lần lượt hiện lên. Giảm chuyển động: hiện ngay.
  const [tocRevealed, setTocRevealed] = useState(reduce);
  const tocInView = pagesOfView(view, spread, total).some((i) => i !== null && pages[i]?.kind === 'toc');
  useEffect(() => {
    if (tocInView || reduce) setTocRevealed(true);
  }, [tocInView, reduce]);

  const renderPage = (index: number) =>
    layout ? (
      <PageFace page={pages[index]} index={index} total={total} pageW={layout.pageW} pageH={layout.pageH} spread={spread}
        site={site} highlightId={highlight} onJump={jumpToPage} tocRevealed={tocRevealed} />
    ) : null;

  const indicator = (() => {
    const [l, r] = pagesOfView(view, spread, total);
    if (l !== null && r !== null) return `${l + 1}–${r + 1}`;
    return String((l ?? r ?? 0) + 1);
  })();

  const Book = reduce ? StaticBook : PageFlipBook;

  // Hai trang mở nhưng chỉ có một trang (bìa trước nằm phải / bìa sau nằm lẻ bên trái) → dời để sách nằm giữa.
  // Đang ở bìa mà thư viện bắt đầu lật (tự động / sau khi thả tay) → chắc chắn là MỞ sách → trượt về giữa ngay
  // (cùng lúc lật, không đợi lật xong). Không trượt khi khách còn đang kéo tay (user_fold) để sách không chạy khỏi ngón tay.
  const [opening, setOpening] = useState(false);
  const onState = useCallback((s: 'read' | 'flipping' | 'user_fold' | 'fold_corner') => {
    if (s === 'flipping') setOpening(true);
    else if (s === 'read') setOpening(false);
  }, []);
  const bookShift = (() => {
    if (!spread || !layout || opening) return 0;
    const [l, r] = pagesOfView(view, spread, total);
    if (l === null && r !== null) return -layout.pageW / 2;
    if (r === null && l !== null) return layout.pageW / 2;
    return 0;
  })();

  return (
    <section ref={rootRef} className={cn('fb-root', reduce && 'fb-root--reduce')} data-paper={paper} aria-label="Thực đơn dạng sách">
      <div className="fb-toolbar">
        <MenuSearch entries={entries} initial={initialQuery} onPick={pick} />
        <div className="fb-toolbar__nav">
          <button type="button" className="fb-icon-btn" onClick={prev} disabled={view <= 0} aria-label="Trang trước">
            <ChevronLeft size={20} aria-hidden />
          </button>
          <p className="fb-indicator" aria-live="polite">
            <span className="sr-only">Đang xem trang </span>{indicator} / {total}
          </p>
          <button type="button" className="fb-icon-btn" onClick={next} disabled={view >= views - 1} aria-label="Trang sau">
            <ChevronRight size={20} aria-hidden />
          </button>
          <Link to="/thuc-don/danh-sach" className="fb-icon-btn" aria-label="Xem dạng danh sách" title="Xem dạng danh sách">
            <List size={18} aria-hidden />
          </Link>
        </div>
        {pages.length ? <CategoryTabs items={tabItems} active={activeTab} onPick={pickTab} /> : null}
      </div>

      <div ref={stageRef} className="fb-stage">
        {layout && pages.length ? (
          <>
            {layout.sideNav ? (
              <button type="button" className="fb-side fb-side--prev" onClick={prev} disabled={view <= 0} aria-label="Trang trước">
                <ChevronLeft size={26} aria-hidden />
              </button>
            ) : null}
            {/* Sách gập (chỉ bìa trước bên phải / bìa sau bên trái) → dời nửa trang để cuốn sách nằm giữa khung. */}
            <div className="fb-book-shift" style={{ transform: `translateX(${bookShift}px)` }}>
              <Book
                ref={bookRef}
                pages={pages}
                pageW={layout.pageW}
                pageH={layout.pageH}
                spread={spread}
                startPage={startPage}
                renderPage={renderPage}
                onPage={onPage}
                onState={onState}
              />
            </div>
            <FlipGuide atCover={view === 0} />
            {layout.sideNav ? (
              <button type="button" className="fb-side fb-side--next" onClick={next} disabled={view >= views - 1} aria-label="Trang sau">
                <ChevronRight size={26} aria-hidden />
              </button>
            ) : null}
          </>
        ) : null}
      </div>
    </section>
  );
}
