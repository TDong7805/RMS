import type { CSSProperties, ReactNode } from 'react';
import { Award, Clock, Flame, Mail, MapPin, Phone } from 'lucide-react';
import { cn } from '@/lib/cn';
import { formatCurrency } from '@/lib/format';
import { WEEKDAYS } from '@/lib/labels';
import type { PublicMenuItem, PublicSetMenu, PublicSite } from '@/types';
import { mondayFirst } from '../parts';
import { cardArea, pageMetrics, setKey, sideOfPage, type BookPage, type Grid, type Metrics } from './pagination';

export interface PageFaceProps {
  page: BookPage;
  /** Chỉ số trang (0 = bìa trước). */
  index: number;
  total: number;
  pageW: number;
  pageH: number;
  spread: boolean;
  site: PublicSite;
  highlightId: string | null;
  onJump: (page: number) => void;
  /** Mục lục đã được lật tới lần đầu → các dòng lần lượt hiện lên (một lần, không nhấp nháy khi lật qua lại). */
  tocRevealed: boolean;
}

/**
 * Nội dung một trang sách. Kích thước (lề, tiêu đề, thẻ món, số dòng mô tả) tính từ pageMetrics — giống lúc chia trang —
 * và truyền vào CSS qua biến --fb-* → thẻ luôn vừa khung, không món nào bị cắt.
 */
export function PageFace({ page, index, total, pageW, pageH, spread, site, highlightId, onJump, tocRevealed }: PageFaceProps) {
  const m = pageMetrics(pageW, pageH, spread);
  const side = sideOfPage(index, spread);
  const style = {
    '--fb-pad': `${m.pad}px`,
    '--fb-footer': `${m.footer}px`,
    '--fb-first-head': `${m.firstHead}px`,
    '--fb-cont-head': `${m.contHead}px`,
    '--fb-gap': `${m.gap}px`,
    '--fb-toc-row': `${m.tocRow}px`,
  } as CSSProperties;
  const label = page.kind === 'category' || page.kind === 'sets' ? page.title : page.kind === 'toc' ? 'Mục lục' : '';

  return (
    <div className={cn('fb-paper', `fb-paper--${side}`, m.compact && 'fb-paper--compact', `fb-paper--${page.kind}`)} style={style}>
      {page.kind === 'cover' ? <Cover site={site} /> : null}
      {page.kind === 'back' ? <Back site={site} /> : null}
      {page.kind === 'blank' ? <div className="fb-blank" aria-hidden><span className="site-display">{site.brand.name}</span></div> : null}
      {page.kind === 'toc' ? (
        <div className="fb-content">
          <Heading title="Mục lục" first={page.first} />
          <ol className={cn('fb-toc', tocRevealed && 'fb-toc--revealed')}>
            {page.entries.map((e, i) => (
              <li key={e.id} style={{ '--i': i } as CSSProperties}>
                <button type="button" className="fb-toc__row" onClick={() => onJump(e.page)}>
                  <span className="fb-toc__thumb" aria-hidden>
                    {e.image ? <img src={e.image} alt="" loading="lazy" draggable={false} /> : <span className="site-display">{e.title.charAt(0)}</span>}
                  </span>
                  <span className="fb-toc__title">{e.title}</span>
                  <span className="fb-toc__dots" aria-hidden />
                  <span className="fb-toc__page">{e.page + 1}</span>
                  <span className="sr-only">, {e.count} món, trang {e.page + 1}</span>
                </button>
              </li>
            ))}
          </ol>
          {!page.entries.length ? <p className="fb-empty">Thực đơn đang được cập nhật.</p> : null}
        </div>
      ) : null}
      {page.kind === 'category' || page.kind === 'sets' ? (
        <div className="fb-content">
          <Heading title={page.title} first={page.first} />
          <CardGrid m={m} grid={page.grid} pageH={pageH} first={page.first}>
            {page.kind === 'category'
              ? page.items.map((item) => <ItemCard key={item.id} item={item} highlight={highlightId === item.id} />)
              : page.sets.map((s) => <SetCard key={s.id} set={s} highlight={highlightId === setKey(s.id)} />)}
          </CardGrid>
        </div>
      ) : null}
      {label ? (
        <footer className="fb-foot">
          <span>{label}</span>
          <span aria-hidden>|</span>
          <span>{site.brand.name}</span>
          <span aria-hidden>|</span>
          <span className="fb-foot__num">{index + 1}<span className="sr-only"> / {total}</span></span>
        </footer>
      ) : null}
    </div>
  );
}

function Heading({ title, first }: { title: string; first: boolean }) {
  return first ? (
    <header className="fb-head fb-head--first">
      <h2 className="site-display">{title}</h2>
      <span className="fb-head__rule" aria-hidden />
    </header>
  ) : (
    <header className="fb-head fb-head--cont">
      <h2 className="site-display">{title} <span>(tiếp)</span></h2>
    </header>
  );
}

/**
 * Lưới thẻ: số hàng cố định theo trang (grid.rows) nên thẻ cao bằng nhau, chia đều vùng nội dung.
 * Số dòng mô tả tính từ chiều cao thẻ còn lại sau ảnh + tên + giá.
 */
function CardGrid({ m, grid, pageH, first, children }: { m: Metrics; grid: Grid; pageH: number; first: boolean; children: ReactNode }) {
  const area = cardArea(m, pageH, first);
  const cardH = (area - (grid.rows - 1) * m.gap) / grid.rows;
  const imgRatio = grid.cols === 2 ? 0.46 : 0.5;
  const imgH = Math.round(cardH * imgRatio);
  const descLine = m.compact ? 19 : 22; // line-height mô tả (px)
  // Thẻ hẹp (2 cột, hoặc trang nhỏ): giá xuống dòng riêng dưới tên (CSS .fb-grid--stack); thẻ rộng: giá cùng hàng tên.
  const stack = grid.cols === 2 || m.compact;
  const nameBlock = m.compact ? (stack ? 66 : 46) : stack ? 84 : 58; // tên tối đa 2 dòng (+ dòng giá khi xếp chồng)
  // Phần đệm trong thẻ: thẻ (trên 8 + dưới 10) + thân (trên 10) + khoảng cách tên–mô tả (6); trang nhỏ gọn hơn.
  const chrome = m.compact ? 24 : 34;
  const descLines = Math.max(0, Math.min(4, Math.floor((cardH - imgH - nameBlock - chrome) / descLine)));
  const style = {
    gridTemplateColumns: `repeat(${grid.cols}, minmax(0, 1fr))`,
    gridTemplateRows: `repeat(${grid.rows}, minmax(0, 1fr))`,
    '--fb-img-h': `${imgH}px`,
    '--fb-desc-lines': descLines,
  } as CSSProperties;
  return <ul className={cn('fb-grid', stack && 'fb-grid--stack')} style={style}>{children}</ul>;
}

function Price({ value, from, original }: { value: number; from?: boolean; original?: number }) {
  return (
    <p className="fb-card__price">
      {from ? <small>từ </small> : null}
      {formatCurrency(value)}
      {original && original > value ? <s>{formatCurrency(original)}</s> : null}
    </p>
  );
}

function ItemCard({ item, highlight }: { item: PublicMenuItem; highlight: boolean }) {
  return (
    <li className={cn('fb-card', item.soldOut && 'fb-card--soldout', highlight && 'fb-card--highlight')} data-item={item.id}>
      <div className="fb-card__img">
        {item.image ? <img src={item.image} alt={item.name} loading="lazy" decoding="async" draggable={false} /> : null}
        {item.soldOut ? <span className="fb-card__badge">Tạm hết hôm nay</span> : null}
      </div>
      <div className="fb-card__body">
        <div className="fb-card__top">
          <h3 className="fb-card__name">
            {item.name}
            {item.spicyLevel > 0 ? (
              <span className="fb-card__spicy" aria-label={`Độ cay ${item.spicyLevel}/3`}>
                {Array.from({ length: item.spicyLevel }, (_, i) => <Flame key={i} size={13} aria-hidden />)}
              </span>
            ) : null}
          </h3>
          <Price value={item.price} from={item.priceFrom} />
        </div>
        <p className="fb-card__desc">{item.variants.length ? item.variants.join(' · ') : item.description}</p>
      </div>
    </li>
  );
}

function SetCard({ set, highlight }: { set: PublicSetMenu; highlight: boolean }) {
  return (
    <li className={cn('fb-card', highlight && 'fb-card--highlight')} data-item={set.id}>
      <div className="fb-card__img">
        {set.image ? <img src={set.image} alt={set.name} loading="lazy" decoding="async" draggable={false} /> : null}
        {set.sellFrom && set.sellTo ? <span className="fb-card__badge">Phục vụ {set.sellFrom.slice(0, 5)} – {set.sellTo.slice(0, 5)}</span> : null}
      </div>
      <div className="fb-card__body">
        <div className="fb-card__top">
          <h3 className="fb-card__name">{set.name}</h3>
          <Price value={set.price} original={set.originalPrice} />
        </div>
        <p className="fb-card__desc">{set.items.join(' · ')}</p>
      </div>
    </li>
  );
}

function Cover({ site }: { site: PublicSite }) {
  const { brand } = site;
  return (
    <div className="fb-cover">
      {brand.heroImage ? <img className="fb-cover__bg" src={brand.heroImage} alt="" draggable={false} /> : null}
      <div className="fb-cover__inner">
        {brand.logo ? <img className="fb-cover__logo" src={brand.logo} alt="" draggable={false} /> : <span className="fb-cover__mono site-display" aria-hidden>{brand.name.charAt(0)}</span>}
        <p className="fb-cover__kicker">Thực đơn</p>
        <h2 className="site-display fb-cover__name">{brand.name}</h2>
        {brand.slogan ? <p className="fb-cover__slogan">{brand.slogan}</p> : null}
        {brand.award ? <p className="fb-cover__award"><Award size={14} aria-hidden /> {brand.award}</p> : null}
        <p className="fb-cover__hint">Kéo góc trang, vuốt hoặc bấm → để mở sách</p>
      </div>
    </div>
  );
}

function Back({ site }: { site: PublicSite }) {
  const { brand, contact } = site;
  return (
    <div className="fb-back">
      <p className="site-display fb-back__name">{brand.name}</p>
      <ul className="fb-back__list">
        <li><MapPin size={15} aria-hidden /><span>{contact.address}</span></li>
        <li><Phone size={15} aria-hidden /><span>{contact.phone}</span></li>
        <li><Mail size={15} aria-hidden /><span>{contact.email}</span></li>
      </ul>
      <div className="fb-back__hours">
        <p><Clock size={15} aria-hidden /> Giờ mở cửa</p>
        <ul>
          {mondayFirst(site.openingHours).map((d) => (
            <li key={d.day}><span>{WEEKDAYS[d.day]}</span><span>{d.open ? `${d.openTime} – ${d.closeTime}` : 'Nghỉ'}</span></li>
          ))}
        </ul>
      </div>
      <p className="fb-back__thanks site-display">Cảm ơn quý khách!</p>
    </div>
  );
}
