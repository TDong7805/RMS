import { Link } from 'react-router-dom';
import { ArrowRight, Award, CalendarCheck, Check, MapPin, Phone, UtensilsCrossed } from 'lucide-react';
import { useGallery, usePublicMenu } from '@/features/public-site/queries';
import { HoursList, MenuItemCard, SectionHeading, SiteError, SiteImage, SiteSkeleton, telHref, useSiteData, weekdayOf } from '@/features/public-site/parts';

const ALL = { keyword: '', categoryId: '' };

/** Trang chủ website khách hàng: banner (danh hiệu, slogan), giới thiệu ngắn, món nổi bật, album, liên hệ. */
export default function HomePage() {
  const site = useSiteData();
  const { brand, about, contact } = site;

  return (
    <>
      {/* ---------------------------------------------------- Banner */}
      <section className="relative isolate overflow-hidden bg-[var(--site-dark)] text-[var(--site-on-dark)]">
        {brand.heroImage ? (
          <img src={brand.heroImage} alt="" className="absolute inset-0 -z-10 h-full w-full object-cover" />
        ) : null}
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-black/80 via-black/55 to-black/20" aria-hidden />
        <div className="site-container flex min-h-[560px] flex-col justify-center py-20 md:min-h-[640px]">
          <div className="site-fade-up max-w-[640px]">
            {brand.award ? (
              <p className="inline-flex items-center gap-2 rounded-full border border-[var(--site-gold-line)] bg-black/30 px-4 py-1.5 text-[13px] font-semibold uppercase tracking-[0.14em] text-[var(--site-gold)]">
                <Award size={16} aria-hidden /> {brand.award}
              </p>
            ) : null}
            <h1 className="site-display mt-5 text-[44px] font-semibold leading-[1.05] md:text-[68px]">{brand.name}</h1>
            {brand.slogan ? <p className="mt-4 text-[18px] leading-relaxed text-white/85 md:text-[21px]">{brand.slogan}</p> : null}
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/thuc-don" className="site-btn site-btn-primary">
                <UtensilsCrossed size={17} aria-hidden /> Xem thực đơn
              </Link>
              <Link to="/dat-ban" className="site-btn site-btn-outline">
                <CalendarCheck size={17} aria-hidden /> Đặt bàn ngay
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------- Về chúng tôi (rút gọn) */}
      {about.paragraphs.length || about.highlights.length ? (
        <section className="site-container grid items-center gap-10 py-20 md:grid-cols-2">
          <SiteImage src={about.image} alt={`Không gian ${brand.name}`} className="aspect-[4/3] w-full rounded-3xl" />
          <div>
            <SectionHeading eyebrow="Về chúng tôi" title={about.title || `Câu chuyện ${brand.name}`} align="left" />
            {about.paragraphs[0] ? <p className="mt-4 text-[15.5px] leading-relaxed text-[var(--site-muted)]">{about.paragraphs[0]}</p> : null}
            {about.highlights.length ? (
              <ul className="mt-6 grid gap-3 sm:grid-cols-2">
                {about.highlights.map((h) => (
                  <li key={h} className="flex gap-2.5 text-[14.5px]">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--site-primary-soft)] text-[var(--site-primary)]">
                      <Check size={13} aria-hidden />
                    </span>
                    {h}
                  </li>
                ))}
              </ul>
            ) : null}
            <Link to="/gioi-thieu" className="mt-7 inline-flex items-center gap-1.5 font-semibold text-[var(--site-primary)] hover:underline">
              Tìm hiểu thêm <ArrowRight size={16} aria-hidden />
            </Link>
          </div>
        </section>
      ) : null}

      <FeaturedSection />
      <GalleryPreview />

      {/* ---------------------------------------------------- Liên hệ nhanh */}
      <section className="bg-[var(--site-dark-2)] text-[var(--site-on-dark)]">
        <div className="site-container grid gap-10 py-16 md:grid-cols-2">
          <div>
            <SectionHeading eyebrow="Ghé thăm" title="Hẹn gặp bạn tại nhà hàng" align="left" dark />
            <ul className="mt-6 space-y-3 text-[15px]">
              <li className="flex gap-3"><MapPin size={19} className="mt-0.5 shrink-0 text-[var(--site-gold)]" aria-hidden />{contact.address}</li>
              <li className="flex gap-3">
                <Phone size={19} className="mt-0.5 shrink-0 text-[var(--site-gold)]" aria-hidden />
                <a href={telHref(contact.phone)} className="hover:underline">{contact.phone}</a>
              </li>
            </ul>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link to="/dat-ban" className="site-btn site-btn-primary"><CalendarCheck size={17} aria-hidden /> Đặt bàn</Link>
              <Link to="/lien-he" className="site-btn site-btn-outline">Chỉ đường &amp; liên hệ</Link>
            </div>
          </div>
          <div className="rounded-3xl bg-white/5 p-6">
            <p className="mb-3 text-[13px] font-semibold uppercase tracking-[0.16em] text-[var(--site-gold)]">Giờ mở cửa</p>
            <HoursList days={site.openingHours} today={weekdayOf(site.today)} dark />
          </div>
        </div>
      </section>
    </>
  );
}

function FeaturedSection() {
  const menu = usePublicMenu(ALL);
  const featured = (menu.data?.featured ?? [])
    .map((id) => menu.data?.items.find((i) => i.id === id))
    .filter((i) => i !== undefined);

  if (menu.data && !featured.length) return null;
  return (
    <section className="bg-[var(--site-surface-2)] py-20">
      <div className="site-container">
        <SectionHeading eyebrow="Thực đơn" title="Món được yêu thích" description="Những món thực khách gọi nhiều nhất tại nhà hàng." />
        <div className="mt-10">
          {menu.isError ? (
            <SiteError onRetry={() => void menu.refetch()} retrying={menu.isFetching} />
          ) : !menu.data ? (
            <div className="grid gap-4 md:grid-cols-2">
              {Array.from({ length: 4 }, (_, i) => <SiteSkeleton key={i} className="h-[136px]" />)}
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {featured.map((item) => <MenuItemCard key={item.id} item={item} />)}
            </div>
          )}
        </div>
        <div className="mt-10 text-center">
          <Link to="/thuc-don" className="site-btn site-btn-ghost">Xem toàn bộ thực đơn <ArrowRight size={16} aria-hidden /></Link>
        </div>
      </div>
    </section>
  );
}

/** Xem trước album: ẩn hẳn khi chưa có ảnh (trang Album vẫn có thông báo trống). */
function GalleryPreview() {
  const gallery = useGallery();
  const photos = gallery.data?.slice(0, 6) ?? [];
  if (gallery.isError || (gallery.data && !photos.length)) return null;
  return (
    <section className="site-container py-20">
      <SectionHeading eyebrow="Album ảnh" title="Không gian & món ngon" />
      <div className="mt-10 grid grid-cols-2 gap-3 md:grid-cols-3">
        {!gallery.data
          ? Array.from({ length: 6 }, (_, i) => <SiteSkeleton key={i} className="aspect-square" />)
          : photos.map((p, i) => (
              <Link key={p.id} to="/album" className={i === 0 ? 'col-span-2 row-span-2 md:col-span-1 md:row-span-1' : ''}>
                <SiteImage src={p.image} alt={p.caption || 'Ảnh nhà hàng'} className="aspect-square h-full w-full rounded-2xl transition-opacity hover:opacity-90" />
              </Link>
            ))}
      </div>
      <div className="mt-8 text-center">
        <Link to="/album" className="site-btn site-btn-ghost">Xem album <ArrowRight size={16} aria-hidden /></Link>
      </div>
    </section>
  );
}
