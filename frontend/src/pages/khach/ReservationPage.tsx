import { Clock, Info, Phone, Users } from 'lucide-react';
import { HoursList, PageBanner, telHref, useSiteData, weekdayOf } from '@/features/public-site/parts';
import { ReservationForm } from '@/features/public-site/ReservationForm';

/**
 * /dat-ban — trang đặt bàn riêng (giữ để gửi link cho khách). Dùng chung form với mục Đặt bàn ở trang chủ.
 * Lịch tạo ra ở trạng thái "Chờ xác nhận" (hoặc "Đã xác nhận" nếu Quản lý bật tự xác nhận), hiện ở Thu ngân →
 * Đặt bàn hôm nay và Quản lý → Đặt bàn, kèm thông báo.
 */
export default function ReservationPage() {
  const site = useSiteData();
  const cfg = site.reservation;

  return (
    <>
      <PageBanner eyebrow="Đặt bàn" title="Đặt bàn trực tuyến" subtitle="Gửi yêu cầu trong một phút — nhà hàng sẽ liên hệ xác nhận qua số điện thoại của bạn." />
      <section className="site-container grid gap-8 py-12 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="rounded-3xl border border-[var(--site-border)] bg-[var(--site-surface)] p-5 shadow-[var(--site-shadow)] sm:p-8">
          <ReservationForm site={site} />
        </div>

        <aside className="space-y-4">
          {cfg.notice ? (
            <div className="flex gap-3 rounded-2xl bg-[var(--site-gold-soft)] p-5 text-[14.5px] text-[#5c4410]">
              <Info size={19} className="mt-0.5 shrink-0" aria-hidden />
              <p>{cfg.notice}</p>
            </div>
          ) : null}
          <div className="rounded-2xl border border-[var(--site-border)] bg-[var(--site-surface)] p-5">
            <p className="mb-3 flex items-center gap-2 font-semibold"><Clock size={17} className="text-[var(--site-primary)]" aria-hidden /> Giờ mở cửa</p>
            <HoursList days={site.openingHours} today={weekdayOf(site.today)} />
          </div>
          <div className="rounded-2xl border border-[var(--site-border)] bg-[var(--site-surface)] p-5 text-[14.5px]">
            <p className="mb-2 flex items-center gap-2 font-semibold"><Users size={17} className="text-[var(--site-primary)]" aria-hidden /> Đoàn đông hoặc đặt tiệc?</p>
            <p className="text-[var(--site-muted)]">Gọi trực tiếp để được tư vấn thực đơn và giữ phòng riêng.</p>
            <a href={telHref(site.contact.phone)} className="site-btn site-btn-ghost mt-4 w-full"><Phone size={16} aria-hidden /> {site.contact.phone}</a>
          </div>
        </aside>
      </section>
    </>
  );
}
