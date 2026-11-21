import { Link } from 'react-router-dom';
import { CalendarCheck, Clock, ExternalLink, Globe, Mail, MapPin, Phone, type LucideIcon } from 'lucide-react';
import { HoursList, PageBanner, SocialLinks, telHref, useSiteData, weekdayOf } from '@/features/public-site/parts';
import type { ReactNode } from 'react';

/** Link nhúng bản đồ của Google (Chia sẻ → Nhúng bản đồ) thì vẽ khung bản đồ; link thường thì hiện nút mở Google Maps. */
const isEmbedMap = (url: string) => /^https:\/\/(www\.)?google\.[a-z.]+\/maps\/embed/.test(url);

/** Liên hệ: địa chỉ, điện thoại, email, giờ mở cửa, mạng xã hội, bản đồ — lấy từ Cấu hình hệ thống. */
export default function ContactPage() {
  const site = useSiteData();
  const { brand, contact } = site;
  const mapLink = contact.mapUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(contact.address)}`;

  return (
    <>
      <PageBanner eyebrow="Liên hệ" title={`Ghé thăm ${brand.name}`} subtitle="Liên hệ nhà hàng để đặt tiệc, hỏi món hoặc góp ý — chúng tôi luôn sẵn lòng lắng nghe." />
      <section className="site-container grid gap-8 py-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <div className="space-y-4">
          <InfoCard icon={MapPin} title="Địa chỉ">
            <p>{contact.address}</p>
            <a href={mapLink} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1.5 text-[14px] font-semibold text-[var(--site-primary)] hover:underline">
              Chỉ đường trên Google Maps <ExternalLink size={14} aria-hidden />
            </a>
          </InfoCard>
          <InfoCard icon={Phone} title="Điện thoại">
            <a href={telHref(contact.phone)} className="text-[18px] font-semibold hover:underline">{contact.phone}</a>
          </InfoCard>
          <InfoCard icon={Mail} title="Email">
            <a href={`mailto:${contact.email}`} className="break-all hover:underline">{contact.email}</a>
          </InfoCard>
          {contact.website ? (
            <InfoCard icon={Globe} title="Website">
              <a href={contact.website} target="_blank" rel="noopener noreferrer" className="break-all hover:underline">{contact.website}</a>
            </InfoCard>
          ) : null}
          <InfoCard icon={Clock} title="Giờ mở cửa">
            <HoursList days={site.openingHours} today={weekdayOf(site.today)} />
          </InfoCard>
          <SocialLinks contact={contact} />
        </div>

        <div className="space-y-4">
          {contact.mapUrl && isEmbedMap(contact.mapUrl) ? (
            <iframe
              title={`Bản đồ đường đến ${brand.name}`}
              src={contact.mapUrl}
              className="h-[420px] w-full rounded-3xl border border-[var(--site-border)]"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          ) : (
            <a
              href={mapLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-[320px] flex-col items-center justify-center gap-3 rounded-3xl border border-[var(--site-border)] bg-[var(--site-surface-2)] text-center hover:border-[var(--site-primary)]"
            >
              <MapPin size={40} className="text-[var(--site-primary)]" aria-hidden />
              <span className="site-display text-[22px] font-semibold">Xem bản đồ</span>
              <span className="max-w-[360px] px-4 text-[14px] text-[var(--site-muted)]">{contact.address}</span>
            </a>
          )}
          <div className="rounded-3xl bg-[var(--site-dark)] p-8 text-[var(--site-on-dark)]">
            <p className="site-display text-[26px] font-semibold">Đặt bàn trước để có chỗ đẹp</p>
            <p className="mt-2 text-[15px] text-[var(--site-on-dark-muted)]">Gửi yêu cầu trực tuyến, nhà hàng sẽ gọi lại xác nhận cho bạn.</p>
            <Link to="/dat-ban" className="site-btn site-btn-primary mt-5"><CalendarCheck size={17} aria-hidden /> Đặt bàn trực tuyến</Link>
          </div>
        </div>
      </section>
    </>
  );
}

function InfoCard({ icon: Icon, title, children }: { icon: LucideIcon; title: string; children: ReactNode }) {
  return (
    <div className="flex gap-4 rounded-2xl border border-[var(--site-border)] bg-[var(--site-surface)] p-5">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--site-primary-soft)] text-[var(--site-primary)]">
        <Icon size={20} aria-hidden />
      </span>
      <div className="min-w-0 flex-1 text-[15px]">
        <p className="mb-1 text-[13px] font-semibold uppercase tracking-[0.12em] text-[var(--site-muted)]">{title}</p>
        {children}
      </div>
    </div>
  );
}
