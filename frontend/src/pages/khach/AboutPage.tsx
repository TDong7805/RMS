import { Link } from 'react-router-dom';
import { Award, CalendarCheck, Check, ChefHat } from 'lucide-react';
import { HoursList, PageBanner, SiteEmpty, SiteImage, useSiteData, weekdayOf } from '@/features/public-site/parts';

/** Giới thiệu ("Về chúng tôi"): câu chuyện, không gian, điểm nhấn — nội dung do Quản lý nhập ở tab Website khách hàng. */
export default function AboutPage() {
  const site = useSiteData();
  const { brand, about } = site;
  const empty = !about.paragraphs.length && !about.highlights.length;

  return (
    <>
      <PageBanner eyebrow="Về chúng tôi" title={about.title || `Câu chuyện ${brand.name}`} subtitle={brand.slogan} />
      {empty ? (
        <div className="site-container py-16">
          <SiteEmpty icon={ChefHat} title="Nội dung giới thiệu đang được cập nhật" description="Mời bạn xem thực đơn hoặc ghé thăm nhà hàng." action={<Link to="/thuc-don" className="site-btn site-btn-ghost">Xem thực đơn</Link>} />
        </div>
      ) : (
        <section className="site-container grid gap-12 py-16 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
          <div className="space-y-5">
            {brand.award ? (
              <p className="inline-flex items-center gap-2 rounded-full bg-[var(--site-gold-soft)] px-4 py-1.5 text-[13px] font-semibold text-[#7a5a14]">
                <Award size={16} aria-hidden /> {brand.award}
              </p>
            ) : null}
            {about.paragraphs.map((p, i) => (
              <p key={i} className={i === 0 ? 'text-[18px] leading-relaxed' : 'text-[15.5px] leading-relaxed text-[var(--site-muted)]'}>{p}</p>
            ))}
            {about.highlights.length ? (
              <div className="rounded-3xl border border-[var(--site-border)] bg-[var(--site-surface)] p-6">
                <p className="site-display mb-4 text-[22px] font-semibold">Điểm nhấn</p>
                <ul className="grid gap-3 sm:grid-cols-2">
                  {about.highlights.map((h) => (
                    <li key={h} className="flex gap-2.5 text-[14.5px]">
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--site-primary-soft)] text-[var(--site-primary)]">
                        <Check size={13} aria-hidden />
                      </span>
                      {h}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
          <div className="space-y-6">
            <SiteImage src={about.image} alt={`Không gian ${brand.name}`} className="aspect-[4/5] w-full rounded-3xl" eager />
            <div className="rounded-3xl border border-[var(--site-border)] bg-[var(--site-surface)] p-6">
              <p className="mb-3 text-[13px] font-semibold uppercase tracking-[0.16em] text-[var(--site-primary)]">Giờ mở cửa</p>
              <HoursList days={site.openingHours} today={weekdayOf(site.today)} />
              <Link to="/dat-ban" className="site-btn site-btn-primary mt-5 w-full"><CalendarCheck size={17} aria-hidden /> Đặt bàn</Link>
            </div>
          </div>
        </section>
      )}
    </>
  );
}
