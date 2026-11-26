import '@fontsource/be-vietnam-pro/400.css';
import '@fontsource/be-vietnam-pro/500.css';
import '@fontsource/be-vietnam-pro/600.css';
import '@fontsource/be-vietnam-pro/700.css';
import '@fontsource-variable/playfair-display';
// Phông tiêu đề xem thử (E1): chọn xong một phông thì bỏ hai phông còn lại.
import '@fontsource/cormorant-garamond/500.css';
import '@fontsource/cormorant-garamond/600.css';
import '@fontsource-variable/noto-serif-display';
import '@fontsource-variable/dancing-script';
import './site-theme.css';
import './home.css';
import { useEffect, useState, type CSSProperties, type MouseEvent } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Award, CalendarCheck, Clock, ExternalLink, Mail, MapPin, Menu, Phone, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useSite } from './queries';
import { HoursList, SiteError, SiteSkeleton, SocialLinks, telHref, weekdayOf } from './parts';
import { useActiveSection, useInView, useScrollY } from './motion';
import type { PublicSite } from '@/types';

/**
 * Menu chính: các mục của trang chủ (cuộn tới) + trang Thực đơn (sách lật trang, trang riêng).
 * Link cũ /gioi-thieu, /album, /lien-he chuyển về đúng mục ở trang chủ (routes.tsx).
 */
export const SITE_NAV: { id?: string; to?: string; label: string }[] = [
  { id: 'mon-dac-trung', label: 'Món đặc trưng' },
  { id: 'trai-nghiem', label: 'Trải nghiệm' },
  { id: 'khong-gian', label: 'Không gian' },
  { id: 'gioi-thieu', label: 'Câu chuyện' },
  { to: '/thuc-don', label: 'Thực đơn' },
  { id: 'lien-he', label: 'Liên hệ' },
];

/** Mọi mục của trang chủ theo thứ tự (để biết đang xem mục nào; mục không có trên menu thì không tô mục nào). */
const SECTION_IDS = ['luu-y', 'mon-dac-trung', 'trai-nghiem', 'khong-gian', 'gioi-thieu', 'bep-truong', 'dat-ban', 'lien-he'];

/** Phông tiêu đề xem thử: ?phong=1|2|3, nhớ trong phiên để chuyển trang vẫn giữ. */
function useSiteFont(): string {
  const { search } = useLocation();
  const q = new URLSearchParams(search).get('phong');
  const fonts: Record<string, string> = { '1': 'playfair', '2': 'cormorant', '3': 'noto' };
  if (q && fonts[q]) {
    try {
      sessionStorage.setItem('site-font', fonts[q]);
    } catch {
      /* chế độ riêng tư */
    }
    return fonts[q];
  }
  try {
    return sessionStorage.getItem('site-font') ?? 'playfair';
  } catch {
    return 'playfair';
  }
}

/** Cuộn tới một mục ở trang chủ (chừa chỗ thanh trên nhờ scroll-margin-top). */
export function scrollToSection(id: string) {
  const el = document.getElementById(id);
  if (!el) return false;
  el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  return true;
}

/**
 * Khung chung của website khách hàng: thanh trên (trang chủ: trong suốt đè lên ảnh, cuộn xuống thì có nền), nút nổi
 * "Đặt bàn ngay", chân trang (liên hệ, giờ mở cửa, mạng xã hội, tên quán chữ cực lớn). Tải thông tin nhà hàng một lần
 * (GET /api/public/site) rồi truyền cho trang con qua Outlet context (useSiteData trong parts.tsx).
 */
export default function PublicLayout() {
  const site = useSite();
  const location = useLocation();
  const font = useSiteFont();
  const home = location.pathname === '/';

  // Đổi trang → về đầu trang (React Router không tự làm). Có #mục thì trang chủ tự cuộn tới mục đó.
  useEffect(() => {
    if (!location.hash) window.scrollTo({ top: 0 });
  }, [location.pathname, location.hash]);

  useEffect(() => {
    if (site.data) document.title = site.data.brand.slogan ? `${site.data.brand.name} – ${site.data.brand.slogan}` : site.data.brand.name;
  }, [site.data]);

  return (
    <div className="site-root flex min-h-screen flex-col" data-font={font}>
      <SiteHeader site={site.data} home={home} />
      <main id="noi-dung" className="flex-1">
        {site.isError ? (
          <div className="site-container py-28">
            <SiteError onRetry={() => void site.refetch()} retrying={site.isFetching} />
          </div>
        ) : site.data ? (
          <Outlet context={site.data} />
        ) : home ? (
          <div className="site-ph h-[100svh]" aria-busy="true" aria-label="Đang tải" />
        ) : (
          <div className="site-container space-y-6 py-10" aria-busy="true" aria-label="Đang tải">
            <SiteSkeleton className="h-[420px]" />
          </div>
        )}
      </main>
      {site.data ? <SiteFooter site={site.data} /> : null}
      {site.data && home ? <FloatingReserve /> : null}
    </div>
  );
}

/* ------------------------------------------------------------ Thanh trên */

function SiteHeader({ site, home }: { site: PublicSite | undefined; home: boolean }) {
  const navigate = useNavigate();
  const location = useLocation();
  const y = useScrollY();
  const [open, setOpen] = useState(false);
  const active = useActiveSection(SECTION_IDS, home);
  const solid = !home || y > 40 || open;

  useEffect(() => setOpen(false), [location.pathname, location.hash]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open]);

  /** Bấm mục của trang chủ: đang ở trang chủ thì cuộn mượt, trang khác thì về trang chủ rồi cuộn. */
  const go = (id: string) => (e: MouseEvent) => {
    e.preventDefault();
    setOpen(false);
    if (home && scrollToSection(id)) window.history.replaceState(null, '', `/#${id}`);
    else navigate(`/#${id}`);
  };

  const name = site?.brand.name ?? '';

  return (
    <header className="site-topbar" data-overlay={home} data-solid={solid} data-open={open}>
      <a href="#noi-dung" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:rounded focus:bg-white focus:px-3 focus:py-2 focus:text-black">
        Bỏ qua thanh điều hướng
      </a>
      <div className="mx-auto flex h-full max-w-[1440px] items-center gap-6 px-4 md:px-8">
        <Link
          to="/"
          onClick={(e) => {
            if (home) {
              e.preventDefault();
              window.scrollTo({ top: 0, behavior: 'smooth' });
              window.history.replaceState(null, '', '/');
            }
          }}
          className="flex min-w-0 items-center gap-2.5"
          aria-label={name ? `${name} – Trang chủ` : 'Trang chủ'}
        >
          {site?.brand.logo ? <img src={site.brand.logo} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover" /> : null}
          {name ? <span className="site-display truncate text-[21px] font-semibold tracking-tight">{name}</span> : <SiteSkeleton className="h-5 w-32" />}
        </Link>

        <nav aria-label="Menu chính" className="ml-auto hidden items-center gap-6 lg:flex xl:gap-8">
          {SITE_NAV.map((item) =>
            item.id ? (
              <a key={item.id} href={`/#${item.id}`} onClick={go(item.id)} className="site-navlink" aria-current={active === item.id ? 'true' : undefined}>
                {item.label}
              </a>
            ) : (
              <Link key={item.to} to={item.to!} className="site-navlink" aria-current={location.pathname.startsWith(item.to!) ? 'page' : undefined}>
                {item.label}
              </Link>
            ),
          )}
        </nav>

        <div className="ml-auto flex items-center gap-2 lg:ml-0">
          {/* Bọc ngoài để ẩn trên điện thoại (đã có nút nổi): .site-btn đặt display riêng nên lớp hidden đặt trên nút không ăn. */}
          <span className="hidden sm:block">
            <a href="/#dat-ban" onClick={go('dat-ban')} className="site-btn site-btn-primary h-10 px-5 text-[14px]">
              <CalendarCheck size={16} aria-hidden /> Đặt bàn ngay
            </a>
          </span>
          <button
            type="button"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-white/30 lg:hidden"
            aria-label={open ? 'Đóng menu' : 'Mở menu'}
            aria-expanded={open}
            aria-controls="menu-di-dong"
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X size={20} aria-hidden /> : <Menu size={20} aria-hidden />}
          </button>
        </div>
      </div>

      {open ? (
        <div id="menu-di-dong" className="site-mobile-menu fixed inset-x-0 bottom-0 top-[var(--site-header-h)] overflow-y-auto bg-[var(--site-ink)] lg:hidden">
          <nav aria-label="Menu chính (điện thoại)" className="px-6 py-8">
            <ul className="space-y-1">
              {SITE_NAV.map((item, i) => (
                <li key={item.label} style={{ '--i': i } as CSSProperties}>
                  {item.id ? (
                    <a href={`/#${item.id}`} onClick={go(item.id)} className="site-display block py-2.5 text-[34px] leading-tight text-[var(--site-cream)]">{item.label}</a>
                  ) : (
                    <Link to={item.to!} className="site-display block py-2.5 text-[34px] leading-tight text-[var(--site-cream)]">{item.label}</Link>
                  )}
                </li>
              ))}
            </ul>
            <a href="/#dat-ban" onClick={go('dat-ban')} className="site-btn site-btn-primary mt-8 w-full">
              <CalendarCheck size={17} aria-hidden /> Đặt bàn ngay
            </a>
            {site ? (
              <a href={telHref(site.contact.phone)} className="site-btn site-btn-outline mt-3 w-full text-[var(--site-cream)]">
                <Phone size={16} aria-hidden /> Gọi {site.contact.phone}
              </a>
            ) : null}
          </nav>
        </div>
      ) : null}
    </header>
  );
}

/** Nút nổi "Đặt bàn ngay": hiện khi đã cuộn qua ảnh đầu trang, ẩn khi form đặt bàn đang trên màn hình. */
function FloatingReserve() {
  const y = useScrollY();
  const formVisible = useInView('dat-ban', true);
  const footerVisible = useInView('lien-he', true);
  const show = y > window.innerHeight * 0.75 && !formVisible && !footerVisible;
  return (
    <button
      type="button"
      className="site-btn site-btn-primary site-float"
      data-show={show}
      tabIndex={show ? 0 : -1}
      aria-hidden={!show}
      onClick={() => scrollToSection('dat-ban')}
    >
      <CalendarCheck size={18} aria-hidden /> Đặt bàn ngay
    </button>
  );
}

/* ------------------------------------------------------------ Chân trang (= mục Liên hệ) */

/** Link nhúng bản đồ của Google (Chia sẻ → Nhúng bản đồ) thì vẽ khung bản đồ; link thường thì hiện nút chỉ đường. */
const isEmbedMap = (url: string) => /^https:\/\/(www\.)?google\.[a-z.]+\/maps\/embed/.test(url);

function SiteFooter({ site }: { site: PublicSite }) {
  const { brand, contact } = site;
  const mapLink = contact.mapUrl && !isEmbedMap(contact.mapUrl)
    ? contact.mapUrl
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(contact.address)}`;
  const heading = 'mb-4 text-[12px] font-medium uppercase tracking-[0.2em] text-[var(--site-gold)]';

  return (
    <footer id="lien-he" className="overflow-hidden bg-[var(--site-ink)] text-[var(--site-cream)]">
      <div className="mx-auto grid max-w-[1440px] gap-10 px-4 pb-12 pt-20 md:grid-cols-2 md:px-8 lg:grid-cols-[1.3fr_1fr_1fr_0.8fr]">
        <div>
          <p className={heading}>Liên hệ</p>
          <ul className="space-y-3 text-[15px] text-[var(--site-cream)]/90">
            <li className="flex gap-3"><MapPin size={18} className="mt-0.5 shrink-0 text-[var(--site-gold)]" aria-hidden />{contact.address}</li>
            <li className="flex gap-3">
              <Phone size={18} className="mt-0.5 shrink-0 text-[var(--site-gold)]" aria-hidden />
              <a href={telHref(contact.phone)} className="hover:underline">{contact.phone}</a>
            </li>
            <li className="flex gap-3">
              <Mail size={18} className="mt-0.5 shrink-0 text-[var(--site-gold)]" aria-hidden />
              <a href={`mailto:${contact.email}`} className="break-all hover:underline">{contact.email}</a>
            </li>
          </ul>
          {contact.mapUrl && isEmbedMap(contact.mapUrl) ? (
            <iframe title={`Bản đồ đường đến ${brand.name}`} src={contact.mapUrl} className="mt-5 h-[180px] w-full max-w-[420px] rounded-xl border border-white/10"
              loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
          ) : null}
          <a href={mapLink} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex items-center gap-1.5 text-[14px] font-semibold text-[var(--site-gold)] hover:underline">
            Chỉ đường trên Google Maps <ExternalLink size={14} aria-hidden />
          </a>
        </div>
        <div>
          <p className={cn(heading, 'flex items-center gap-2')}><Clock size={14} aria-hidden /> Giờ mở cửa</p>
          <HoursList days={site.openingHours} today={weekdayOf(site.today)} dark />
        </div>
        <div>
          <p className={heading}>Theo dõi</p>
          <SocialLinks contact={contact} dark />
          {brand.award ? (
            <p className="mt-6 inline-flex items-center gap-2 text-[13px] text-[var(--site-on-dark-muted)]"><Award size={15} className="text-[var(--site-gold)]" aria-hidden /> {brand.award}</p>
          ) : null}
        </div>
        <div>
          <p className={heading}>{brand.name}</p>
          <ul className="space-y-2.5 text-[14.5px] text-[var(--site-cream)]/85">
            <li><Link to="/thuc-don" className="hover:underline">Thực đơn</Link></li>
            <li><a href="/#dat-ban" className="hover:underline">Đặt bàn</a></li>
            <li><a href="/#khong-gian" className="hover:underline">Không gian</a></li>
            <li><Link to="/dang-nhap" className="hover:underline">Đăng nhập nhân viên</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-[var(--site-ink-line)]">
        <p className="site-giant select-none px-2 pt-6 text-center text-[var(--site-cream)]" aria-hidden>{brand.name}</p>
        <p className="pb-6 pt-10 text-center text-[12.5px] text-[var(--site-on-dark-muted)]">© {site.today.slice(0, 4)} {brand.name}. Bảo lưu mọi quyền.</p>
      </div>
    </footer>
  );
}
