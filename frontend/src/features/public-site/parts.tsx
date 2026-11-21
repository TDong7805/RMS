import { useState, type ComponentType, type ReactNode } from 'react';
import { useOutletContext } from 'react-router-dom';
import { AlertTriangle, Facebook, Flame, ImageOff, Instagram, MessageCircle, Music2, RefreshCw, Youtube, type LucideProps } from 'lucide-react';
import { cn } from '@/lib/cn';
import { formatCurrency } from '@/lib/format';
import { WEEKDAYS } from '@/lib/labels';
import type { OpeningDay, PublicMenuItem, PublicSite, SiteContact } from '@/types';

/** Dữ liệu chung của website (PublicLayout tải một lần rồi truyền cho mọi trang qua Outlet context). */
export function useSiteData(): PublicSite {
  return useOutletContext<PublicSite>();
}

/** "02838226868" → "tel:02838226868" */
export const telHref = (phone: string) => `tel:${phone.replace(/[^\d+]/g, '')}`;

/** Ngày trong tuần của chuỗi yyyy-MM-dd (0 = Chủ nhật), không lệch múi giờ. */
export function weekdayOf(dateKey: string): number {
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** Thứ hai → Chủ nhật, giống thói quen đọc lịch của khách. */
export const mondayFirst = (days: OpeningDay[]) => [...days].sort((a, b) => ((a.day + 6) % 7) - ((b.day + 6) % 7));

/* ------------------------------------------------------------ Bố cục */

export function SectionHeading({ eyebrow, title, description, align = 'center', dark }: {
  eyebrow?: string;
  title: string;
  description?: ReactNode;
  align?: 'center' | 'left';
  dark?: boolean;
}) {
  return (
    <div className={cn('max-w-[680px]', align === 'center' ? 'mx-auto text-center' : '')}>
      {eyebrow ? (
        <p className="mb-2 text-[12.5px] font-semibold uppercase tracking-[0.18em] text-[var(--site-gold)]">{eyebrow}</p>
      ) : null}
      <h2 className={cn('site-display text-[30px] font-semibold leading-tight md:text-[40px]', dark ? 'text-[var(--site-on-dark)]' : '')}>{title}</h2>
      {description ? (
        <p className={cn('mt-3 text-[15.5px] leading-relaxed', dark ? 'text-[var(--site-on-dark-muted)]' : 'text-[var(--site-muted)]')}>{description}</p>
      ) : null}
    </div>
  );
}

/** Dải tiêu đề đầu trang con (Giới thiệu, Thực đơn, Album, Liên hệ, Đặt bàn). */
export function PageBanner({ eyebrow, title, subtitle }: { eyebrow: string; title: string; subtitle?: string }) {
  return (
    <section className="bg-[var(--site-dark)] text-[var(--site-on-dark)]">
      <div className="site-container py-14 md:py-20">
        <SectionHeading eyebrow={eyebrow} title={title} description={subtitle || undefined} dark />
      </div>
    </section>
  );
}

/** Ảnh có khung nền ấm; ảnh lỗi / chưa có thì hiện biểu tượng thay vì ô trống. */
export function SiteImage({ src, alt, className, eager }: { src: string | null; alt: string; className?: string; eager?: boolean }) {
  const [broken, setBroken] = useState(false);
  if (!src || broken) {
    return (
      <div className={cn('site-img flex items-center justify-center text-[var(--site-muted)]', className)} role="img" aria-label={alt}>
        <ImageOff size={28} strokeWidth={1.5} aria-hidden />
      </div>
    );
  }
  return <img src={src} alt={alt} loading={eager ? 'eager' : 'lazy'} onError={() => setBroken(true)} className={cn('site-img', className)} />;
}

/* ------------------------------------------------------------ Trạng thái tải / lỗi / trống */

export function SiteSkeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-2xl bg-[var(--site-surface-2)]', className)} aria-hidden />;
}

export function SiteError({ title = 'Không tải được dữ liệu', message, onRetry, retrying }: {
  title?: string;
  message?: string;
  onRetry: () => void;
  retrying?: boolean;
}) {
  return (
    <div role="alert" className="mx-auto flex max-w-[460px] flex-col items-center rounded-2xl border border-[var(--site-border)] bg-[var(--site-surface)] px-6 py-10 text-center">
      <AlertTriangle size={32} className="text-[var(--site-danger)]" aria-hidden />
      <p className="mt-3 text-[17px] font-semibold">{title}</p>
      <p className="mt-1 text-[14px] text-[var(--site-muted)]">{message ?? 'Kết nối tới nhà hàng đang gián đoạn. Vui lòng thử lại sau ít phút.'}</p>
      <button type="button" className="site-btn site-btn-ghost mt-5" onClick={onRetry} disabled={retrying}>
        <RefreshCw size={16} className={retrying ? 'animate-spin' : ''} aria-hidden /> Thử lại
      </button>
    </div>
  );
}

export function SiteEmpty({ icon: Icon, title, description, action }: {
  icon: ComponentType<LucideProps>;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mx-auto flex max-w-[460px] flex-col items-center px-6 py-12 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--site-primary-soft)] text-[var(--site-primary)]">
        <Icon size={26} aria-hidden />
      </span>
      <p className="mt-4 text-[17px] font-semibold">{title}</p>
      {description ? <p className="mt-1 text-[14px] text-[var(--site-muted)]">{description}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

/* ------------------------------------------------------------ Thực đơn */

export function MenuItemCard({ item }: { item: PublicMenuItem }) {
  return (
    <article className={cn('group flex gap-4 rounded-2xl border border-[var(--site-border)] bg-[var(--site-surface)] p-3 transition-shadow hover:shadow-[var(--site-shadow)]', item.soldOut && 'opacity-75')}>
      <div className="relative h-[104px] w-[104px] shrink-0 overflow-hidden rounded-xl sm:h-[120px] sm:w-[120px]">
        <SiteImage src={item.image} alt={item.name} className="h-full w-full transition-transform duration-500 group-hover:scale-105" />
        {item.soldOut ? (
          <span className="absolute inset-x-0 bottom-0 bg-black/60 py-1 text-center text-[11.5px] font-semibold text-white">Tạm hết hôm nay</span>
        ) : null}
      </div>
      <div className="flex min-w-0 flex-1 flex-col py-0.5">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-[16px] font-semibold leading-snug">{item.name}</h3>
          <p className="shrink-0 text-[15px] font-bold text-[var(--site-primary)]">
            {item.priceFrom ? <span className="mr-1 text-[12px] font-medium text-[var(--site-muted)]">từ</span> : null}
            {formatCurrency(item.price)}
          </p>
        </div>
        {item.description ? <p className="mt-1 line-clamp-2 text-[13.5px] leading-relaxed text-[var(--site-muted)]">{item.description}</p> : null}
        {item.variants.length ? <p className="mt-1 line-clamp-1 text-[13px] text-[var(--site-text)]">{item.variants.join(' · ')}</p> : null}
        <div className="mt-auto flex flex-wrap gap-1.5 pt-2">
          {item.spicyLevel > 0 ? (
            <span className="inline-flex items-center gap-0.5 rounded-full bg-[var(--site-danger-soft)] px-2 py-0.5 text-[11.5px] font-medium text-[var(--site-danger)]">
              {Array.from({ length: item.spicyLevel }, (_, i) => <Flame key={i} size={11} aria-hidden />)}
              <span className="sr-only">Độ cay {item.spicyLevel}/3</span>
            </span>
          ) : null}
          {item.allergens.map((a) => (
            <span key={a} className="rounded-full bg-[var(--site-surface-2)] px-2 py-0.5 text-[11.5px] text-[var(--site-muted)]">Có {a.toLowerCase()}</span>
          ))}
        </div>
      </div>
    </article>
  );
}

/* ------------------------------------------------------------ Giờ mở cửa, mạng xã hội */

export function HoursList({ days, today, dark }: { days: OpeningDay[]; today?: number; dark?: boolean }) {
  return (
    <ul className="space-y-1.5 text-[14.5px]">
      {mondayFirst(days).map((d) => (
        <li
          key={d.day}
          className={cn(
            'flex justify-between gap-4 rounded-lg px-2 py-1',
            d.day === today && (dark ? 'bg-white/10 font-semibold' : 'bg-[var(--site-primary-soft)] font-semibold text-[var(--site-primary)]'),
          )}
        >
          <span>{WEEKDAYS[d.day]}{d.day === today ? ' (hôm nay)' : ''}</span>
          <span className={cn(!d.open && (dark ? 'text-[var(--site-on-dark-muted)]' : 'text-[var(--site-muted)]'))}>
            {d.open ? `${d.openTime} – ${d.closeTime}` : 'Nghỉ'}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function SocialLinks({ contact, className, dark }: { contact: SiteContact; className?: string; dark?: boolean }) {
  const links = [
    { href: contact.facebookUrl, label: 'Facebook', icon: Facebook },
    { href: contact.instagramUrl, label: 'Instagram', icon: Instagram },
    { href: contact.tiktokUrl, label: 'TikTok', icon: Music2 },
    { href: contact.youtubeUrl, label: 'YouTube', icon: Youtube },
    { href: contact.zaloPhone ? `https://zalo.me/${contact.zaloPhone.replace(/^\+84/, '0')}` : '', label: 'Zalo', icon: MessageCircle },
  ].filter((l) => l.href);
  if (!links.length) return null;
  return (
    <div className={cn('flex flex-wrap gap-2', className)}>
      {links.map(({ href, label, icon: Icon }) => (
        <a
          key={label}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={label}
          title={label}
          className={cn(
            'flex h-10 w-10 items-center justify-center rounded-full border transition-colors hover:border-transparent hover:bg-[var(--site-primary)] hover:text-white',
            dark ? 'border-white/20' : 'border-[var(--site-border)] text-[var(--site-primary)]',
          )}
        >
          <Icon size={18} aria-hidden />
        </a>
      ))}
    </div>
  );
}
