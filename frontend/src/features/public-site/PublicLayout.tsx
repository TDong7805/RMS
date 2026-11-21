import '@fontsource/be-vietnam-pro/400.css';
import '@fontsource/be-vietnam-pro/500.css';
import '@fontsource/be-vietnam-pro/600.css';
import '@fontsource/be-vietnam-pro/700.css';
import '@fontsource-variable/playfair-display';
import './site-theme.css';
import { useEffect, useState, type FormEvent } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { CalendarCheck, Clock, Mail, MapPin, Menu, Phone, Search, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useSite } from './queries';
import { HoursList, SiteError, SiteSkeleton, SocialLinks, telHref, weekdayOf } from './parts';
import type { PublicSite } from '@/types';

/** Menu chính của website khách hàng (đường dẫn ngắn để dành cho khách — xem lib/paths.ts). */
export const SITE_NAV = [
  { to: '/gioi-thieu', label: 'Giới thiệu' },
  { to: '/thuc-don', label: 'Thực đơn' },
  { to: '/dat-ban', label: 'Đặt bàn' },
  { to: '/album', label: 'Album ảnh' },
  { to: '/lien-he', label: 'Liên hệ' },
];

/**
 * Khung chung của website khách hàng: thanh đầu trang (logo, menu, ô tìm món), chân trang (liên hệ, giờ mở cửa,
 * mạng xã hội). Tải thông tin nhà hàng một lần (GET /api/public/site) rồi truyền cho trang con qua Outlet context
 * (useSiteData trong parts.tsx). Tách hẳn khỏi khung trang quản lý (AppShell) — không cần đăng nhập.
 */
export default function PublicLayout() {
  const site = useSite();
  const location = useLocation();

  // Đổi trang → về đầu trang (React Router không tự làm).
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [location.pathname]);

  useEffect(() => {
    if (site.data) document.title = site.data.brand.slogan ? `${site.data.brand.name} – ${site.data.brand.slogan}` : site.data.brand.name;
  }, [site.data]);

  return (
    <div className="site-root flex min-h-screen flex-col">
      <SiteHeader site={site.data} />
      <main id="noi-dung" className="flex-1">
        {site.isError ? (
          <div className="site-container py-20">
            <SiteError onRetry={() => void site.refetch()} retrying={site.isFetching} />
          </div>
        ) : site.data ? (
          <Outlet context={site.data} />
        ) : (
          <div className="site-container space-y-6 py-10" aria-busy="true" aria-label="Đang tải">
            <SiteSkeleton className="h-[420px]" />
            <div className="grid gap-4 md:grid-cols-3">
              <SiteSkeleton className="h-40" />
              <SiteSkeleton className="h-40" />
              <SiteSkeleton className="h-40" />
            </div>
          </div>
        )}
      </main>
      {site.data ? <SiteFooter site={site.data} /> : null}
    </div>
  );
}

/* ------------------------------------------------------------ Thanh đầu trang */

function SiteHeader({ site }: { site: PublicSite | undefined }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [keyword, setKeyword] = useState('');

  useEffect(() => setOpen(false), [location.pathname, location.search]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const k = keyword.trim();
    navigate(k ? `/thuc-don?q=${encodeURIComponent(k)}` : '/thuc-don');
    setKeyword('');
  };

  const name = site?.brand.name ?? '';
  const search = (id: string) => (
    <form role="search" onSubmit={submit} className="relative">
      <label htmlFor={id} className="sr-only">Tìm món ăn</label>
      <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--site-muted)]" aria-hidden />
      <input
        id={id}
        type="search"
        value={keyword}
        onChange={(e) => setKeyword(e.target.value)}
        placeholder="Tìm món ăn…"
        className="site-input h-10 rounded-full pl-10 text-[14px]"
        maxLength={60}
      />
    </form>
  );

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--site-border)] bg-[var(--site-bg-glass)] backdrop-blur">
      <a href="#noi-dung" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:rounded focus:bg-white focus:px-3 focus:py-2">
        Bỏ qua thanh điều hướng
      </a>
      <div className="site-container flex h-[var(--site-header-h)] items-center gap-4">
        <Link to="/" className="flex min-w-0 items-center gap-2.5" aria-label={name ? `${name} – Trang chủ` : 'Trang chủ'}>
          {site?.brand.logo ? (
            <img src={site.brand.logo} alt="" className="h-11 w-11 shrink-0 rounded-full object-cover" />
          ) : (
            <span className="site-display flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--site-primary)] text-[18px] font-bold text-white" aria-hidden>
              {name ? name.charAt(0) : ''}
            </span>
          )}
          {name ? (
            <span className="site-display truncate text-[20px] font-semibold">{name}</span>
          ) : (
            <SiteSkeleton className="h-5 w-32" />
          )}
        </Link>

        <div className="ml-auto flex items-center gap-2">
          <nav aria-label="Menu chính" className="hidden items-center gap-1 lg:flex">
            {SITE_NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    'rounded-full px-3.5 py-2 text-[14.5px] font-medium transition-colors hover:text-[var(--site-primary)]',
                    isActive && 'bg-[var(--site-primary-soft)] text-[var(--site-primary)]',
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
          {/* Màn hình rộng: ô tìm kiếm đầy đủ; laptop nhỏ: nút kính lúp mở trang Thực đơn (có ô tìm). */}
          <div className="hidden w-[220px] xl:block">{search('tim-mon')}</div>
          <Link to="/thuc-don" aria-label="Tìm món ăn" className="hidden h-10 w-10 items-center justify-center rounded-full border border-[var(--site-border)] lg:flex xl:hidden">
            <Search size={18} aria-hidden />
          </Link>
          <Link to="/dat-ban" className="site-btn site-btn-primary hidden h-10 px-4 text-[14px] sm:inline-flex lg:hidden xl:inline-flex">
            <CalendarCheck size={16} aria-hidden /> Đặt bàn
          </Link>
          <button
            type="button"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--site-border)] lg:hidden"
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
        <div id="menu-di-dong" className="border-t border-[var(--site-border)] bg-[var(--site-bg)] lg:hidden">
          <div className="site-container space-y-3 py-4">
            {search('tim-mon-dd')}
            <nav aria-label="Menu chính (điện thoại)" className="grid gap-1">
              {SITE_NAV.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    cn('rounded-xl px-3 py-3 text-[16px] font-medium', isActive ? 'bg-[var(--site-primary-soft)] text-[var(--site-primary)]' : 'hover:bg-[var(--site-surface-2)]')
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>
            {site ? (
              <a href={telHref(site.contact.phone)} className="site-btn site-btn-ghost w-full">
                <Phone size={16} aria-hidden /> Gọi {site.contact.phone}
              </a>
            ) : null}
          </div>
        </div>
      ) : null}
    </header>
  );
}

/* ------------------------------------------------------------ Chân trang */

function SiteFooter({ site }: { site: PublicSite }) {
  const { brand, contact } = site;
  return (
    <footer className="bg-[var(--site-dark)] text-[var(--site-on-dark)]">
      <div className="site-container grid gap-10 py-14 md:grid-cols-2 lg:grid-cols-[1.2fr_1fr_1fr]">
        <div>
          <p className="site-display text-[26px] font-semibold">{brand.name}</p>
          {brand.slogan ? <p className="mt-2 max-w-[360px] text-[14.5px] text-[var(--site-on-dark-muted)]">{brand.slogan}</p> : null}
          <SocialLinks contact={contact} className="mt-5" dark />
        </div>
        <div>
          <p className="mb-4 text-[13px] font-semibold uppercase tracking-[0.16em] text-[var(--site-gold)]">Liên hệ</p>
          <ul className="space-y-3 text-[14.5px]">
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
        </div>
        <div>
          <p className="mb-4 flex items-center gap-2 text-[13px] font-semibold uppercase tracking-[0.16em] text-[var(--site-gold)]">
            <Clock size={15} aria-hidden /> Giờ mở cửa
          </p>
          <HoursList days={site.openingHours} today={weekdayOf(site.today)} dark />
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="site-container flex flex-col gap-2 py-5 text-[13px] text-[var(--site-on-dark-muted)] sm:flex-row sm:items-center sm:justify-between">
          <p>© {site.today.slice(0, 4)} {brand.name}. Bảo lưu mọi quyền.</p>
          <Link to="/dang-nhap" className="hover:text-white hover:underline">Đăng nhập nhân viên</Link>
        </div>
      </div>
    </footer>
  );
}
