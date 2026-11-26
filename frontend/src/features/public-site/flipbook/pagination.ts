import type { PublicCategory, PublicMenu, PublicMenuItem, PublicSetMenu } from '@/types';

/**
 * Chia thực đơn thành các trang sách: bìa trước → mục lục → mỗi danh mục bắt đầu trang mới → set menu → bìa sau.
 * Món là THẺ có ảnh lớn; số thẻ mỗi trang tính từ kích thước trang thật (đo từ màn hình) và chiều cao tối thiểu của thẻ
 * → màn ngang 2–4 món/trang (2 cột), màn dọc 2–3 món/trang (1 cột, ảnh gần hết bề ngang); trang đầu danh mục ít hơn
 * (thẻ to — món nổi bật). Thẻ chia đều chiều cao trang (CSS grid với số hàng cố định) → không món nào bị cắt giữa hai trang.
 * Hàm thuần: cùng dữ liệu + cùng kích thước → cùng kết quả (tính lại khi xoay máy).
 */

export type TocEntry = { id: string; title: string; count: number; page: number; image: string | null };

export type Grid = { rows: number; cols: number };

export type BookPage =
  | { key: string; kind: 'cover' }
  | { key: string; kind: 'toc'; entries: TocEntry[]; first: boolean }
  | { key: string; kind: 'category'; categoryId: string; title: string; items: PublicMenuItem[]; first: boolean; grid: Grid }
  | { key: string; kind: 'sets'; title: string; sets: PublicSetMenu[]; first: boolean; grid: Grid }
  | { key: string; kind: 'blank' }
  | { key: string; kind: 'back' };

/** Kích thước bố cục trang (px) — dùng chung cho chia trang và CSS (truyền qua biến --fb-*). */
export function pageMetrics(pageW: number, pageH: number, spread: boolean) {
  const compact = pageH < 430 || pageW < 300;
  const cols = spread && pageW >= 380 ? 2 : 1;
  return {
    compact,
    cols,
    pad: compact ? 16 : pageW >= 420 ? 30 : 22,
    footer: compact ? 28 : 40,
    firstHead: compact ? 50 : 78,
    contHead: compact ? 30 : 44,
    gap: compact ? 10 : 16,
    /** Chiều cao tối thiểu một thẻ món (ảnh ~45% thẻ + tên, giá, mô tả). */
    minCard: compact ? 140 : cols === 2 ? 230 : 210,
    tocRow: compact ? 34 : 46,
  };
}

export type Metrics = ReturnType<typeof pageMetrics>;

/** Chiều cao vùng thẻ của trang (trừ lề trên, tiêu đề, chân trang) — khớp CSS .fb-paper. */
export const cardArea = (m: Metrics, pageH: number, first: boolean) =>
  pageH - m.pad - m.footer - (first ? m.firstHead : m.contHead) - 2;

const gridFor = (m: Metrics, pageH: number, first: boolean): Grid => ({
  rows: Math.max(1, Math.floor((cardArea(m, pageH, first) + m.gap) / (m.minCard + m.gap))),
  cols: m.cols,
});

const chunk = <T,>(list: T[], firstCap: number, nextCap: number): T[][] => {
  const out: T[][] = [];
  let i = 0;
  while (i < list.length) {
    const cap = Math.max(1, out.length === 0 ? firstCap : nextCap);
    out.push(list.slice(i, i + cap));
    i += cap;
  }
  return out;
};

export function buildPages(menu: PublicMenu, pageW: number, pageH: number, spread: boolean): BookPage[] {
  const m = pageMetrics(pageW, pageH, spread);
  const g1 = gridFor(m, pageH, true);
  const gN = gridFor(m, pageH, false);
  const firstCap = g1.rows * g1.cols;
  const nextCap = gN.rows * gN.cols;

  const groups: { cat: PublicCategory; items: PublicMenuItem[] }[] = menu.categories
    .map((cat) => ({ cat, items: menu.items.filter((i) => i.categoryId === cat.id) }))
    .filter((g) => g.items.length);

  // Mục lục cần biết số trang của chính nó trước khi đánh số các danh mục.
  const tocCount = groups.length + (menu.sets.length ? 1 : 0);
  const tocPerFirst = Math.max(1, Math.floor((pageH - m.pad - m.footer - m.firstHead) / m.tocRow));
  const tocPerNext = Math.max(1, Math.floor((pageH - m.pad - m.footer - m.contHead) / m.tocRow));
  const tocPages = Math.max(1, tocCount <= tocPerFirst ? 1 : 1 + Math.ceil((tocCount - tocPerFirst) / tocPerNext));

  const body: BookPage[] = [];
  const entries: TocEntry[] = [];
  const start = 1 + tocPages; // 0 = bìa trước
  for (const { cat, items } of groups) {
    entries.push({ id: cat.id, title: cat.name, count: items.length, page: start + body.length, image: cat.image ?? items.find((i) => i.image)?.image ?? null });
    chunk(items, firstCap, nextCap).forEach((part, i) =>
      body.push({ key: `cat-${cat.id}-${i}`, kind: 'category', categoryId: cat.id, title: cat.name, items: part, first: i === 0, grid: i === 0 ? g1 : gN }),
    );
  }
  if (menu.sets.length) {
    entries.push({ id: 'set', title: 'Set menu', count: menu.sets.length, page: start + body.length, image: menu.sets.find((s) => s.image)?.image ?? null });
    chunk(menu.sets, firstCap, nextCap).forEach((part, i) =>
      body.push({ key: `sets-${i}`, kind: 'sets', title: 'Set menu', sets: part, first: i === 0, grid: i === 0 ? g1 : gN }),
    );
  }

  const toc: BookPage[] = chunk(entries, tocPerFirst, tocPerNext).map((part, i) => ({ key: `toc-${i}`, kind: 'toc', entries: part, first: i === 0 }));
  if (!toc.length) toc.push({ key: 'toc-0', kind: 'toc', entries: [], first: true });

  const pages: BookPage[] = [{ key: 'cover', kind: 'cover' }, ...toc, ...body];
  // Hai trang mở: bìa sau phải nằm bên TRÁI (chỉ số lẻ) để sách gập lại đúng — thiếu thì chèn một trang trống.
  if (spread && pages.length % 2 === 0) pages.push({ key: 'blank-end', kind: 'blank' });
  pages.push({ key: 'back', kind: 'back' });
  return pages;
}

/* ------------------------------------------------------------ Trang ↔ "khung nhìn" (1 trang hoặc 2 trang mở) */

/** Hai trang mở: khung s gồm trang (2s − 1, 2s); khung 0 chỉ có bìa trước bên phải. Một trang: khung = trang. */
export const viewCount = (pages: number, spread: boolean) => (spread ? Math.floor(pages / 2) + 1 : pages);

export const viewOfPage = (page: number, spread: boolean) => (spread ? Math.floor((page + 1) / 2) : page);

export function pagesOfView(view: number, spread: boolean, total: number): [number | null, number | null] {
  if (!spread) return [null, view < total ? view : null];
  const left = 2 * view - 1;
  const right = 2 * view;
  return [left >= 0 && left < total ? left : null, right < total ? right : null];
}

/** Phía của trang trong sách mở: bìa trước và trang chẵn bên phải, trang lẻ bên trái; một trang thì "single". */
export const sideOfPage = (index: number, spread: boolean): 'left' | 'right' | 'single' =>
  !spread ? 'single' : index % 2 === 1 ? 'left' : 'right';

/** Khóa của set trong sách ("set:" + id) — id set và id món là hai dãy số riêng, có thể trùng nhau. */
export const setKey = (id: string) => `set:${id}`;

/** Trang chứa món (id món hoặc "g" + id nhóm) hoặc set (setKey(id)). */
export function pageOfItem(pages: BookPage[], id: string): number {
  if (id.startsWith('set:')) {
    const sid = id.slice(4);
    return pages.findIndex((p) => p.kind === 'sets' && p.sets.some((s) => s.id === sid));
  }
  return pages.findIndex((p) => p.kind === 'category' && p.items.some((i) => i.id === id));
}

/** "Mốc" của trang đang xem — sau khi chia lại trang (xoay máy) tìm lại đúng chỗ: ưu tiên món đầu tiên, không có thì khóa trang. */
export function anchorOf(page: BookPage | undefined): string | null {
  if (!page) return null;
  if (page.kind === 'category') return `item:${page.items[0]?.id}`;
  if (page.kind === 'sets') return `item:${setKey(page.sets[0]?.id ?? '')}`;
  return `page:${page.key.startsWith('toc') ? 'toc-0' : page.key}`;
}

export function pageOfAnchor(pages: BookPage[], anchor: string | null): number {
  if (!anchor) return 0;
  if (anchor.startsWith('item:')) {
    const i = pageOfItem(pages, anchor.slice(5));
    return i < 0 ? 0 : i;
  }
  const i = pages.findIndex((p) => p.key === anchor.slice(5));
  return i < 0 ? 0 : i;
}

/** Ảnh của một trang (để tải trước các trang sắp lật tới). */
export function imagesOfPage(page: BookPage | undefined): string[] {
  if (!page) return [];
  if (page.kind === 'category') return page.items.map((i) => i.image).filter((x): x is string => Boolean(x));
  if (page.kind === 'sets') return page.sets.map((s) => s.image).filter((x): x is string => Boolean(x));
  return [];
}
