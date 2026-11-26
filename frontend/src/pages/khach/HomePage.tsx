import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Award, CalendarCheck, Clock, Images, MapPin, NotebookPen, Phone, Sofa, UtensilsCrossed, X } from 'lucide-react';
import { useGallery, usePublicMenu } from '@/features/public-site/queries';
import { mondayFirst, telHref, useSiteData } from '@/features/public-site/parts';
import { ReservationForm, goToReservation } from '@/features/public-site/ReservationForm';
import { scrollToSection } from '@/features/public-site/PublicLayout';
import { useAutoAdvance, useReveal, useScrollY } from '@/features/public-site/motion';
import { cn } from '@/lib/cn';
import { formatCurrency } from '@/lib/format';
import { WEEKDAYS } from '@/lib/labels';
import type { GalleryPhoto, OpeningDay, PublicSite, SiteHighlight } from '@/types';

const ALL = { keyword: '', categoryId: '' };
const d = (ms: number) => ({ '--d': `${ms}ms` }) as CSSProperties;

/**
 * Trang chủ website kiểu dài một trang (E1, phong cách ảnh docs/thiet-ke/tham-khao/dot-E-WebsiteKH/E1.png):
 * Đầu trang → Trước khi đặt bàn → Món đặc trưng → Trải nghiệm → Không gian → Câu chuyện → Lời bếp trưởng → Đặt bàn
 * → chân trang (Liên hệ). Nội dung lấy từ Cấu hình → Website; mục nào chưa có nội dung thì ẩn.
 * Link /#mục (từ menu hoặc link cũ /gioi-thieu, /album, /lien-he) tự cuộn tới mục đó.
 */
export default function HomePage() {
  const site = useSiteData();
  const menu = usePublicMenu(ALL);
  const gallery = useGallery();
  const root = useRef<HTMLDivElement>(null);
  const { hash } = useLocation();

  useReveal(root, [Boolean(menu.data), Boolean(gallery.data)]);

  // Mở bằng /#mục: đợi các mục vẽ xong rồi cuộn tới.
  useEffect(() => {
    const id = hash.replace('#', '');
    if (!id) return;
    let tries = 0;
    const t = window.setInterval(() => {
      if (scrollToSection(id) || ++tries > 20) window.clearInterval(t);
    }, 120);
    return () => window.clearInterval(t);
  }, [hash]);

  // Món đặc trưng do Quản lý nhập; chưa có thì dùng món bán chạy có ảnh.
  const signatures = useMemo<SiteHighlight[]>(() => {
    if (site.signatures.length) return site.signatures;
    const items = menu.data?.items ?? [];
    return (menu.data?.featured ?? [])
      .map((id) => items.find((i) => i.id === id))
      .filter((i) => i !== undefined && i.image)
      .slice(0, 4)
      .map((i) => ({ id: i!.id, title: i!.name, subtitle: formatCurrency(i!.price) + (i!.priceFrom ? ' trở lên' : ''), description: i!.description, image: i!.image }));
  }, [site.signatures, menu.data]);

  return (
    <div ref={root}>
      <Hero site={site} />
      <Notice site={site} />
      {signatures.length ? <Signatures items={signatures} /> : null}
      <Experiences site={site} sets={menu.data?.sets ?? []} />
      <Space site={site} photos={gallery.data ?? []} />
      <About site={site} />
      {site.chef ? <ChefLetter chef={site.chef} /> : null}
      <Reserve site={site} />
    </div>
  );
}

/* ================================================================ Đầu trang */

function Hero({ site }: { site: PublicSite }) {
  const { brand, about } = site;
  const y = useScrollY();
  const intro = about.paragraphs[0] ?? '';
  return (
    <section className="relative isolate flex h-[100svh] min-h-[620px] flex-col overflow-hidden bg-[var(--site-ink)] text-[var(--site-cream)]" aria-label={brand.name}>
      <div className="absolute inset-0 -z-10" style={{ transform: `translateY(${Math.min(y, 900) * 0.35}px)` }}>
        {brand.heroImage ? (
          <img src={brand.heroImage} alt="" className="site-kenburns h-full w-full object-cover" loading="eager" />
        ) : (
          <div className="site-ph h-full w-full" />
        )}
      </div>
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-black/55 via-black/25 to-black/75" aria-hidden />

      <div className="mx-auto w-full max-w-[1440px] px-4 pt-[calc(var(--site-header-h)+3vh)] md:px-8">
        <h1 className="site-hero-name text-center" aria-label={brand.name}>
          {Array.from(brand.name).map((ch, i) => (
            <span key={i} className="site-letter" style={{ '--i': i } as CSSProperties} aria-hidden>
              {ch === ' ' ? ' ' : ch}
            </span>
          ))}
        </h1>
      </div>

      <div className="mx-auto mt-auto flex w-full max-w-[1440px] flex-col gap-6 px-4 pb-10 md:flex-row md:items-end md:justify-between md:px-8 md:pb-14">
        <div className="site-rise" style={d(900)}>
          {brand.award ? (
            <p className="inline-flex items-center gap-2 border-b border-[var(--site-gold-line)] pb-1 text-[12.5px] uppercase tracking-[0.2em] text-[var(--site-gold)]">
              <Award size={15} aria-hidden /> {brand.award}
            </p>
          ) : null}
          <button type="button" onClick={() => scrollToSection('luu-y')} className="mt-6 hidden items-center gap-3 text-[12px] uppercase tracking-[0.2em] text-white/70 hover:text-white md:flex">
            <span className="relative block h-9 w-[22px] rounded-full border border-white/50" aria-hidden>
              <span className="site-scroll-dot absolute left-1/2 top-1.5 -ml-[2px] block h-1.5 w-1 rounded-full bg-white" />
            </span>
            Cuộn xuống
          </button>
        </div>
        <div className="site-rise max-w-[440px]" style={d(1100)}>
          {brand.slogan ? <p className="site-display text-[22px] leading-snug md:text-[26px]">{brand.slogan}</p> : null}
          {intro ? <p className="mt-3 line-clamp-3 text-[14.5px] leading-relaxed text-white/75">{intro}</p> : null}
          <div className="mt-6 flex flex-wrap gap-3">
            <button type="button" onClick={() => goToReservation()} className="site-btn site-btn-primary">
              <CalendarCheck size={17} aria-hidden /> Đặt bàn ngay
            </button>
            <Link to="/thuc-don" className="site-btn site-btn-outline text-[var(--site-cream)]">
              <UtensilsCrossed size={17} aria-hidden /> Xem thực đơn
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ================================================================ Trước khi đặt bàn */

/** "Thứ hai – Chủ nhật: 10:00 – 22:00"; gộp các ngày liền nhau cùng giờ, ngày nghỉ ghi riêng. */
function hoursLines(days: OpeningDay[]): string[] {
  const list = mondayFirst(days);
  if (!list.some((x) => x.open)) return ['Nhà hàng đang tạm nghỉ'];
  const groups: { from: OpeningDay; to: OpeningDay }[] = [];
  for (const day of list.filter((x) => x.open)) {
    const g = groups[groups.length - 1];
    const prevIdx = g ? list.indexOf(g.to) : -2;
    if (g && list.indexOf(day) === prevIdx + 1 && g.to.openTime === day.openTime && g.to.closeTime === day.closeTime) g.to = day;
    else groups.push({ from: day, to: day });
  }
  const lines = groups.map((g) => {
    const label = g.from === g.to ? WEEKDAYS[g.from.day] : `${WEEKDAYS[g.from.day]} – ${WEEKDAYS[g.to.day]}`;
    return `${label}: ${g.from.openTime} – ${g.from.closeTime}`;
  });
  if (lines.length === 1 && list.every((x) => x.open)) return [`Mở cửa mỗi ngày ${groups[0].from.openTime} – ${groups[0].from.closeTime}`];
  const closed = list.filter((x) => !x.open).map((x) => WEEKDAYS[x.day]);
  if (closed.length) lines.push(`Nghỉ: ${closed.join(', ')}`);
  return lines;
}

const lead = (min: number) => (min >= 60 && min % 60 === 0 ? `${min / 60} giờ` : `${min} phút`);

function Notice({ site }: { site: PublicSite }) {
  const r = site.reservation;
  const { space } = site;
  const areaNames = site.areas.map((a) => a.name);
  const cards: { img: string; icon: typeof Clock; title: string; lines: string[] }[] = [
    { img: '/images/site/luu-y-1-gio-phuc-vu.jpg', icon: Clock, title: 'Giờ phục vụ', lines: hoursLines(site.openingHours) },
    {
      img: '/images/site/luu-y-2-dat-ban.png',
      icon: NotebookPen,
      title: 'Quy định đặt bàn',
      lines: [
        `Đặt trước ít nhất ${lead(r.leadTimeMinutes)}, tối đa ${r.maxDaysAhead} ngày.`,
        `Mỗi lịch từ ${r.minGuests} đến ${r.maxGuests} khách, giữ bàn khoảng ${lead(r.durationMinutes)}.`,
        ...(r.notice ? [r.notice] : []),
      ],
    },
    {
      img: '/images/site/luu-y-3-phong-rieng.png',
      icon: Sofa,
      title: 'Khu vực & phòng riêng',
      lines: [
        space.tables ? `${space.floors} tầng, ${space.tables} bàn, khoảng ${space.seats} chỗ ngồi.` : 'Nhiều khu cho gia đình, nhóm bạn và tiếp khách.',
        ...(areaNames.length ? [`Chọn khu khi đặt: ${areaNames.join(', ')}.`] : []),
        'Đoàn đông hoặc cần phòng riêng, hãy ghi chú hoặc gọi trước.',
      ],
    },
  ];
  return (
    <section id="luu-y" className="bg-[var(--site-cream)] py-24 text-[var(--site-ink)] md:py-32">
      <div className="mx-auto max-w-[1200px] px-4 md:px-8">
        <div className="text-center">
          <p className="site-eyebrow" data-reveal="fade">Lưu ý</p>
          <h2 className="site-display mx-auto mt-5 max-w-[640px] text-[36px] leading-[1.1] md:text-[52px]" data-reveal style={d(100)}>
            Những điều nên biết trước khi đặt bàn
          </h2>
          <p className="mx-auto mt-4 max-w-[520px] text-[15px] text-[#6d5e52]" data-reveal style={d(200)}>
            Để buổi tối của bạn trọn vẹn, nhà hàng xin gửi vài lưu ý nhỏ về giờ phục vụ, cách đặt bàn và khu vực ngồi.
          </p>
        </div>
        <div className="mt-14 grid gap-5 md:grid-cols-3">
          {cards.map((c, i) => (
            <NoticeCard key={c.title} {...c} delay={150 * i} />
          ))}
        </div>
      </div>
    </section>
  );
}

function NoticeCard({ img, icon: Icon, title, lines, delay }: { img: string; icon: typeof Clock; title: string; lines: string[]; delay: number }) {
  const [broken, setBroken] = useState(false);
  return (
    <article className="group flex flex-col overflow-hidden bg-[var(--site-ink)] text-[var(--site-cream)]" data-reveal style={d(delay)}>
      <div className="relative aspect-[4/3] overflow-hidden">
        {broken ? (
          <div className="site-ph flex h-full w-full items-center justify-center">
            <Icon size={64} strokeWidth={0.8} className="text-[var(--site-cream)]/70 transition-transform duration-700 group-hover:scale-110" aria-hidden />
          </div>
        ) : (
          <img src={img} alt="" loading="lazy" onError={() => setBroken(true)} className="h-full w-full object-cover transition-transform duration-[1.2s] group-hover:scale-105" />
        )}
      </div>
      <div className="flex flex-1 flex-col p-6">
        <h3 className="site-display text-[24px]">{title}</h3>
        <ul className="mt-3 space-y-1.5 text-[14px] leading-relaxed text-[var(--site-cream)]/75">
          {lines.map((l) => <li key={l}>{l}</li>)}
        </ul>
      </div>
    </article>
  );
}

/* ================================================================ Món đặc trưng (ảnh toàn khổ tự trượt) */

function Signatures({ items }: { items: SiteHighlight[] }) {
  const [hover, setHover] = useState(false);
  const [index, setIndex] = useAutoAdvance(items.length, 6500, hover);
  const go = (n: number) => setIndex((n + items.length) % items.length);
  return (
    <section
      id="mon-dac-trung"
      className="relative isolate h-[92svh] min-h-[600px] overflow-hidden bg-[var(--site-ink)] text-[var(--site-cream)]"
      aria-roledescription="băng chuyền"
      aria-label="Món đặc trưng"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {items.map((it, i) => (
        <div key={it.id} className={cn('site-slide', i === index && 'is-active')} aria-hidden={i !== index}>
          {it.image ? <img src={it.image} alt="" loading={i === 0 ? 'eager' : 'lazy'} className="absolute inset-0 h-full w-full object-cover" /> : <div className="site-ph absolute inset-0" />}
          <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/20 to-black/70" />
          <div className="site-slide-text relative flex h-full flex-col items-center justify-center px-4 text-center">
            <p className="site-eyebrow text-[var(--site-cream)]/85">Món đặc trưng</p>
            {it.subtitle ? <p className="mt-6 text-[13px] uppercase tracking-[0.22em] text-[var(--site-gold)]">{it.subtitle}</p> : null}
            <h2 className="site-big-title mt-3 max-w-[1100px]">{it.title}</h2>
            {it.description ? <p className="mt-5 max-w-[560px] text-[15px] leading-relaxed text-white/80">{it.description}</p> : null}
            <Link to="/thuc-don" className="site-btn mt-8 bg-[var(--site-cream)] text-[var(--site-ink)] hover:bg-white" tabIndex={i === index ? 0 : -1}>
              Xem thực đơn <ArrowRight size={16} aria-hidden />
            </Link>
          </div>
        </div>
      ))}
      {items.length > 1 ? (
        <>
          <div className="absolute inset-x-0 bottom-8 z-10 flex justify-center gap-2">
            {items.map((it, i) => (
              <button key={it.id} type="button" className="site-dot" aria-current={i === index} aria-label={`Xem ${it.title}`} onClick={() => go(i)} />
            ))}
          </div>
          <button type="button" className="site-arrow absolute left-4 top-1/2 z-10 -translate-y-1/2 md:left-8" aria-label="Món trước" onClick={() => go(index - 1)}>
            <ArrowLeft size={20} aria-hidden />
          </button>
          <button type="button" className="site-arrow absolute right-4 top-1/2 z-10 -translate-y-1/2 md:right-8" aria-label="Món tiếp theo" onClick={() => go(index + 1)}>
            <ArrowRight size={20} aria-hidden />
          </button>
        </>
      ) : null}
    </section>
  );
}

/* ================================================================ Trải nghiệm */

type Exp = { key: string; title: string; description: string; image: string | null; action: ReactNode };

function Experiences({ site, sets }: { site: PublicSite; sets: { id: string; name: string; image: string | null; price: number }[] }) {
  const list = useMemo<Exp[]>(() => {
    const out: Exp[] = [];
    if (sets.length) {
      const min = Math.min(...sets.map((s) => s.price));
      out.push({
        key: 'set',
        title: 'Set menu',
        description: `${sets.length} set chọn sẵn cho cặp đôi và nhóm bạn: ${sets.map((s) => s.name).join(', ')}. Giá từ ${formatCurrency(min)}.`,
        image: sets.find((s) => s.image)?.image ?? null,
        action: <Link to="/thuc-don" className="site-btn site-btn-primary h-11 px-5 text-[14px]">Xem các set <ArrowRight size={15} aria-hidden /></Link>,
      });
    }
    for (const e of site.experiences) {
      out.push({
        key: e.id,
        title: e.title,
        description: e.description,
        image: e.image,
        action: (
          <button type="button" className="site-btn site-btn-primary h-11 px-5 text-[14px]" onClick={() => goToReservation(e.title)}>
            <CalendarCheck size={15} aria-hidden /> Đặt bàn cho dịp này
          </button>
        ),
      });
    }
    return out;
  }, [sets, site.experiences]);
  const [active, setActive] = useState(0);
  if (!list.length) return null;
  const current = Math.min(active, list.length - 1);

  return (
    <section id="trai-nghiem" className="bg-[var(--site-cream)] py-24 text-[var(--site-ink)] md:py-32">
      <div className="mx-auto max-w-[1200px] px-4 md:px-8">
        <div className="text-center">
          <p className="site-eyebrow" data-reveal="fade">Trải nghiệm</p>
          <h2 className="site-display mx-auto mt-5 max-w-[720px] text-[36px] leading-[1.1] md:text-[52px]" data-reveal style={d(100)}>
            Tại {site.brand.name}, mỗi bữa ăn là một dịp đáng nhớ
          </h2>
        </div>
        <div className="mt-14 grid items-stretch gap-10 md:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] md:gap-16">
          <ul className="divide-y divide-[#d8ccba] self-center" data-reveal="left">
            {list.map((e, i) => (
              <li key={e.key} className="site-exp-item py-5" data-open={i === current}>
                <button
                  type="button"
                  className={cn('site-display w-full text-left text-[26px] leading-tight transition-colors md:text-[30px]', i === current ? 'text-[var(--site-ink)]' : 'text-[#9b8b7c] hover:text-[var(--site-ink)]')}
                  aria-expanded={i === current}
                  onClick={() => setActive(i)}
                  onMouseEnter={() => setActive(i)}
                >
                  {e.title}
                </button>
                <div className="site-exp-body">
                  <div className="overflow-hidden">
                    {e.description ? <p className="mt-3 max-w-[460px] text-[14.5px] leading-relaxed text-[#6d5e52]">{e.description}</p> : null}
                    <div className="mt-5">{e.action}</div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
          <div className="relative aspect-[4/5] overflow-hidden bg-[var(--site-ink)]" data-reveal="right">
            {list.map((e, i) => (
              <div key={e.key} className={cn('site-exp-img', i === current && 'is-active')} aria-hidden={i !== current}>
                {e.image ? <img src={e.image} alt="" loading="lazy" className="h-full w-full object-cover" /> : <div className="site-ph h-full w-full" />}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ================================================================ Không gian */

function Space({ site, photos }: { site: PublicSite; photos: GalleryPhoto[] }) {
  const { space, contact } = site;
  const [hover, setHover] = useState(false);
  const [index, setIndex] = useAutoAdvance(photos.length, 5500, hover);
  const [viewer, setViewer] = useState<number | null>(null);
  const go = (n: number) => setIndex((n + photos.length) % photos.length);
  const stats = [
    space.floors ? `${space.floors} tầng` : '',
    space.tables ? `${space.tables} bàn` : '',
    space.seats ? `${space.seats} chỗ ngồi` : '',
  ].filter(Boolean);

  return (
    <section
      id="khong-gian"
      className="relative isolate h-[88svh] min-h-[560px] overflow-hidden bg-[var(--site-ink)] text-[var(--site-cream)]"
      aria-label="Không gian"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {photos.length ? (
        photos.map((p, i) => (
          <div key={p.id} className={cn('site-slide', i === index && 'is-active')} aria-hidden={i !== index}>
            <img src={p.image} alt={p.caption || 'Không gian nhà hàng'} loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
          </div>
        ))
      ) : (
        <div className="site-ph absolute inset-0" />
      )}
      <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/30 to-black/70" />

      <div className="relative flex h-full flex-col items-center px-4 pb-10 pt-20 text-center">
        <h2 className="site-big-title" data-reveal>Không gian</h2>
        <div className="my-auto" data-reveal style={d(150)}>
          {stats.length ? (
            <p className="text-[15px] font-semibold uppercase tracking-[0.18em] md:text-[18px]">{stats.join('  |  ')}</p>
          ) : null}
          {photos[index]?.caption ? <p className="mt-3 text-[14.5px] text-white/80">{photos[index].caption}</p> : null}
          {photos.length ? (
            <button type="button" onClick={() => setViewer(index)} className="site-btn site-btn-outline mt-6 h-11 px-5 text-[14px] text-[var(--site-cream)]">
              <Images size={16} aria-hidden /> Xem tất cả {photos.length} ảnh
            </button>
          ) : null}
        </div>
        <p className="flex items-center gap-2 text-[13px] uppercase tracking-[0.16em] text-white/80">
          <MapPin size={15} aria-hidden /> {contact.address}
        </p>
      </div>
      {photos.length > 1 ? (
        <>
          <button type="button" className="site-arrow absolute left-4 top-1/2 z-10 -translate-y-1/2 md:left-8" aria-label="Ảnh trước" onClick={() => go(index - 1)}>
            <ArrowLeft size={20} aria-hidden />
          </button>
          <button type="button" className="site-arrow absolute right-4 top-1/2 z-10 -translate-y-1/2 md:right-8" aria-label="Ảnh tiếp theo" onClick={() => go(index + 1)}>
            <ArrowRight size={20} aria-hidden />
          </button>
        </>
      ) : null}
      {viewer !== null ? <Lightbox photos={photos} start={viewer} onClose={() => setViewer(null)} /> : null}
    </section>
  );
}

/** Xem ảnh lớn: ← → đổi ảnh, Esc đóng, dải ảnh nhỏ phía dưới. */
function Lightbox({ photos, start, onClose }: { photos: GalleryPhoto[]; start: number; onClose: () => void }) {
  const [i, setI] = useState(start);
  const closeRef = useRef<HTMLButtonElement>(null);
  const go = (n: number) => setI((n + photos.length) % photos.length);
  useEffect(() => {
    closeRef.current?.focus();
    const on = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') setI((x) => (x - 1 + photos.length) % photos.length);
      if (e.key === 'ArrowRight') setI((x) => (x + 1) % photos.length);
    };
    window.addEventListener('keydown', on);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', on);
      document.body.style.overflow = '';
    };
  }, [onClose, photos.length]);
  const p = photos[i];
  return (
    <div className="site-lightbox fixed inset-0 z-[60] flex flex-col bg-black/95 text-[var(--site-cream)]" role="dialog" aria-modal="true" aria-label="Album không gian">
      <div className="flex items-center justify-between px-4 py-3 md:px-8">
        <p className="text-[14px] text-white/70">{i + 1} / {photos.length}{p.caption ? ` · ${p.caption}` : ''}</p>
        <button ref={closeRef} type="button" onClick={onClose} className="site-arrow h-10 w-10" aria-label="Đóng"><X size={18} aria-hidden /></button>
      </div>
      <div className="relative flex min-h-0 flex-1 items-center justify-center px-4 md:px-20">
        <img key={p.id} src={p.image} alt={p.caption || 'Không gian nhà hàng'} className="site-fade-up max-h-full max-w-full object-contain" />
        {photos.length > 1 ? (
          <>
            <button type="button" className="site-arrow absolute left-3 top-1/2 -translate-y-1/2 md:left-6" aria-label="Ảnh trước" onClick={() => go(i - 1)}><ArrowLeft size={20} aria-hidden /></button>
            <button type="button" className="site-arrow absolute right-3 top-1/2 -translate-y-1/2 md:right-6" aria-label="Ảnh tiếp theo" onClick={() => go(i + 1)}><ArrowRight size={20} aria-hidden /></button>
          </>
        ) : null}
      </div>
      <div className="flex justify-center gap-2 overflow-x-auto px-4 py-4">
        {photos.map((x, n) => (
          <button key={x.id} type="button" onClick={() => setI(n)} aria-label={`Ảnh ${n + 1}`} aria-current={n === i}
            className={cn('h-14 w-20 shrink-0 overflow-hidden rounded-md border-2 transition-opacity', n === i ? 'border-[var(--site-gold)]' : 'border-transparent opacity-50 hover:opacity-90')}>
            <img src={x.image} alt="" className="h-full w-full object-cover" />
          </button>
        ))}
      </div>
    </div>
  );
}

/* ================================================================ Câu chuyện (Về chúng tôi) */

function About({ site }: { site: PublicSite }) {
  const { about, brand } = site;
  if (!about.paragraphs.length && !about.highlights.length) return null;
  return (
    <section id="gioi-thieu" className="grid bg-[var(--site-cream)] text-[var(--site-ink)] md:min-h-[720px] md:grid-cols-2">
      <div className="flex flex-col justify-center px-6 py-20 md:px-14 lg:px-20">
        <p className="site-eyebrow self-start" data-reveal="fade">Câu chuyện của chúng tôi</p>
        <h2 className="site-display mt-5 text-[36px] leading-[1.1] md:text-[48px]" data-reveal style={d(100)}>{about.title || `Câu chuyện ${brand.name}`}</h2>
        <div className="mt-6 max-w-[560px] space-y-4 text-[15px] leading-relaxed text-[#5d4f45]" data-reveal style={d(200)}>
          {about.paragraphs.map((p) => <p key={p}>{p}</p>)}
        </div>
        {about.highlights.length ? (
          <ul className="mt-8 grid max-w-[560px] gap-x-6 gap-y-3 border-t border-[#d8ccba] pt-6 sm:grid-cols-2" data-reveal style={d(300)}>
            {about.highlights.map((h) => (
              <li key={h} className="text-[12.5px] font-semibold uppercase tracking-[0.12em]">{h}</li>
            ))}
          </ul>
        ) : null}
        <div className="mt-10" data-reveal style={d(400)}>
          <button type="button" className="site-btn h-11 bg-[var(--site-ink)] px-6 text-[14px] text-[var(--site-cream)] hover:bg-black" onClick={() => goToReservation()}>
            Giữ chỗ cho bạn <ArrowRight size={15} aria-hidden />
          </button>
        </div>
      </div>
      <div className="relative min-h-[420px] overflow-hidden bg-[var(--site-ink)]" data-reveal="zoom">
        {about.image ? <img src={about.image} alt={`Không gian ${brand.name}`} loading="lazy" className="absolute inset-0 h-full w-full object-cover" /> : <div className="site-ph absolute inset-0" />}
      </div>
    </section>
  );
}

/* ================================================================ Lời từ bếp trưởng */

function ChefLetter({ chef }: { chef: NonNullable<PublicSite['chef']> }) {
  const [first, ...rest] = chef.paragraphs;
  return (
    <section id="bep-truong" className="bg-[var(--site-ink)] py-24 text-[var(--site-cream)] md:py-32">
      <div className="mx-auto max-w-[1200px] px-4 md:px-8">
        <div className="text-center">
          <p className="site-eyebrow text-[var(--site-cream)]/80" data-reveal="fade">Đôi lời gửi bạn</p>
          <h2 className="site-display mt-5 text-[36px] leading-[1.1] md:text-[48px]" data-reveal style={d(100)}>Lá thư từ {chef.title ? chef.title.toLowerCase() : 'bếp trưởng'}</h2>
        </div>
        <div className="mt-14 grid items-center gap-12 md:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <div className="site-script space-y-5 text-[22px] leading-[1.55] text-[var(--site-cream)]/90 md:text-[27px]">
            {[first, ...rest].map((p, i) => (
              <p key={i} data-reveal="fade" style={d(150 * i)}>
                <span className="site-letter-line" style={d(250 * i + 200)}>{p}</span>
              </p>
            ))}
          </div>
          <figure className="mx-auto w-full max-w-[340px]" data-reveal="right">
            <div className="aspect-[3/4] overflow-hidden bg-[var(--site-ink-2)]">
              {chef.image ? <img src={chef.image} alt={chef.name} loading="lazy" className="h-full w-full object-cover" /> : <div className="site-ph h-full w-full" />}
            </div>
            <figcaption className="mt-5">
              <span className="site-script block text-[30px] leading-none text-[var(--site-gold)]">Thân mến,</span>
              <span className="site-script mt-2 block text-[34px] leading-none">{chef.name}</span>
              {chef.title ? <span className="mt-2 block text-[12px] uppercase tracking-[0.2em] text-[var(--site-cream)]/60">{chef.title}</span> : null}
            </figcaption>
          </figure>
        </div>
      </div>
    </section>
  );
}

/* ================================================================ Đặt bàn */

function Reserve({ site }: { site: PublicSite }) {
  return (
    <section id="dat-ban" className="grid bg-[var(--site-cream)] text-[var(--site-ink)] md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <div className="relative min-h-[360px] overflow-hidden bg-[var(--site-ink)]" data-reveal="zoom">
        {site.reserveImage ? <img src={site.reserveImage} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" /> : <div className="site-ph absolute inset-0" />}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-8 text-[var(--site-cream)] md:p-12">
          <p className="site-display max-w-[420px] text-[28px] leading-tight md:text-[34px]">Giữ chỗ trước để có bàn đẹp nhất trong tối nay.</p>
          <a href={telHref(site.contact.phone)} className="mt-5 inline-flex items-center gap-2 text-[15px] font-semibold text-[var(--site-gold)] hover:underline">
            <Phone size={16} aria-hidden /> Hoặc gọi {site.contact.phone}
          </a>
        </div>
      </div>
      <div className="site-on-cream px-6 py-16 md:px-14 md:py-20 lg:px-20">
        <p className="site-eyebrow" data-reveal="fade">Đặt bàn</p>
        <h2 className="site-display mt-5 text-[36px] leading-[1.1] md:text-[46px]" data-reveal style={d(100)}>Dành riêng một bàn cho bạn</h2>
        <p className="mt-3 max-w-[480px] text-[14.5px] text-[#6d5e52]" data-reveal style={d(150)}>
          Gửi yêu cầu trong một phút, nhà hàng sẽ gọi lại xác nhận qua số điện thoại của bạn.
        </p>
        <div className="mt-8 max-w-[620px]" data-reveal style={d(200)}>
          <ReservationForm site={site} idPrefix="home-rv" compact />
        </div>
      </div>
    </section>
  );
}
