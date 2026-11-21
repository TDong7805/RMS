import { useMemo, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { CalendarCheck, CircleCheckBig, Clock, Info, Phone, Users } from 'lucide-react';
import { createPublicReservation } from '@/api/public-site';
import { HoursList, PageBanner, telHref, useSiteData, weekdayOf } from '@/features/public-site/parts';
import { addDays, normalizePhone, restaurantNow, timeSlots, validateReservation } from '@/features/public-site/reservation';
import { useApiMutation } from '@/hooks/use-api-mutation';
import { cn } from '@/lib/cn';
import { WEEKDAYS, formatDateTime } from '@/lib/labels';
import type { PublicReservationInput, PublicReservationResult } from '@/types';

const EMPTY: PublicReservationInput = { customerName: '', phone: '', email: '', guests: 2, date: '', time: '', areaId: '', note: '' };

/**
 * Đặt bàn trực tuyến: khách nhập họ tên, SĐT, số khách, ngày giờ, ghi chú → POST /api/public/reservations.
 * Lịch tạo ra ở trạng thái "Chờ xác nhận" (hoặc "Đã xác nhận" nếu Quản lý bật tự xác nhận) và hiện ngay ở
 * Quản lý → Đặt bàn → Lịch sử đặt bàn, kèm thông báo cho Quản lý nhà hàng.
 */
export default function ReservationPage() {
  const site = useSiteData();
  const cfg = site.reservation;
  const loadedAt = useRef(Date.now());
  const now = restaurantNow(site, loadedAt.current);
  const [form, setForm] = useState<PublicReservationInput>({ ...EMPTY, guests: Math.max(cfg.minGuests, Math.min(2, cfg.maxGuests)) });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [done, setDone] = useState<PublicReservationResult | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const slots = useMemo(() => timeSlots(site, form.date, now), [site, form.date, now.date, now.minutes]); // eslint-disable-line react-hooks/exhaustive-deps
  const dayInfo = form.date ? site.openingHours.find((d) => d.day === weekdayOf(form.date)) : undefined;

  const mutation = useApiMutation(createPublicReservation, {
    onFieldErrors: (fields) => {
      setErrors(fields);
      focusFirstError(formRef.current, fields);
    },
    onSuccess: (result) => {
      setDone(result);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
  });

  const set = <K extends keyof PublicReservationInput>(key: K, value: PublicReservationInput[K]) => {
    setForm((f) => ({ ...f, [key]: value, ...(key === 'date' ? { time: '' } : {}) }));
    setErrors((p) => ({ ...p, [key]: '', ...(key === 'date' ? { time: '' } : {}) }));
  };

  const submit = () => {
    const local = validateReservation(form, site, now);
    if (Object.keys(local).length) {
      setErrors(local);
      focusFirstError(formRef.current, local);
      return;
    }
    mutation.mutate({
      ...form,
      customerName: form.customerName.trim().replace(/\s+/g, ' '),
      phone: normalizePhone(form.phone),
      email: form.email.trim(),
      note: cfg.allowNote ? form.note.trim() : '',
    });
  };

  return (
    <>
      <PageBanner eyebrow="Đặt bàn" title="Đặt bàn trực tuyến" subtitle="Gửi yêu cầu trong một phút — nhà hàng sẽ liên hệ xác nhận qua số điện thoại của bạn." />
      <section className="site-container grid gap-8 py-12 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="rounded-3xl border border-[var(--site-border)] bg-[var(--site-surface)] p-5 shadow-[var(--site-shadow)] sm:p-8">
          {done ? (
            <Success result={done} phone={site.contact.phone} onAgain={() => { setDone(null); setForm({ ...form, date: '', time: '', note: '' }); }} />
          ) : (
            <form
              ref={formRef}
              noValidate
              onSubmit={(e) => {
                e.preventDefault();
                submit();
              }}
              className="grid gap-5 sm:grid-cols-2"
            >
              <SiteField label="Họ và tên" htmlFor="rv-name" required error={errors.customerName} className="sm:col-span-2">
                <input id="rv-name" name="customerName" autoComplete="name" className="site-input" maxLength={80} value={form.customerName}
                  aria-invalid={Boolean(errors.customerName)} aria-describedby={errors.customerName ? 'rv-name-err' : undefined}
                  onChange={(e) => set('customerName', e.target.value)} placeholder="Nguyễn Văn A" />
              </SiteField>
              <SiteField label="Số điện thoại" htmlFor="rv-phone" required error={errors.phone}>
                <input id="rv-phone" name="phone" type="tel" inputMode="tel" autoComplete="tel" className="site-input" maxLength={15} value={form.phone}
                  aria-invalid={Boolean(errors.phone)} aria-describedby={errors.phone ? 'rv-phone-err' : undefined}
                  onChange={(e) => set('phone', e.target.value)} placeholder="0912 345 678" />
              </SiteField>
              <SiteField label="Số khách" htmlFor="rv-guests" required error={errors.guests} hint={`Từ ${cfg.minGuests} đến ${cfg.maxGuests} khách`}>
                <input id="rv-guests" name="guests" type="number" inputMode="numeric" min={cfg.minGuests} max={cfg.maxGuests} step={1} className="site-input"
                  value={form.guests ?? ''} aria-invalid={Boolean(errors.guests)} aria-describedby={errors.guests ? 'rv-guests-err' : 'rv-guests-hint'}
                  onChange={(e) => set('guests', e.target.value === '' ? null : Number(e.target.value))} />
              </SiteField>
              <SiteField
                label="Ngày"
                htmlFor="rv-date"
                required
                error={errors.date}
                hint={dayInfo ? (dayInfo.open ? `${WEEKDAYS[dayInfo.day]}: mở cửa ${dayInfo.openTime} – ${dayInfo.closeTime}` : `${WEEKDAYS[dayInfo.day]}: nhà hàng nghỉ`) : `Nhận đặt trước tối đa ${cfg.maxDaysAhead} ngày`}
              >
                <input id="rv-date" name="date" type="date" className="site-input" min={now.date} max={addDays(now.date, cfg.maxDaysAhead)} value={form.date}
                  aria-invalid={Boolean(errors.date)} aria-describedby={errors.date ? 'rv-date-err' : 'rv-date-hint'}
                  onChange={(e) => set('date', e.target.value)} />
              </SiteField>
              <SiteField label="Giờ" htmlFor="rv-time" required error={errors.time}
                hint={form.date && dayInfo?.open && !slots.length ? 'Ngày này đã hết giờ nhận đặt, vui lòng chọn ngày khác' : `Mỗi lượt khoảng ${cfg.durationMinutes} phút`}>
                <select id="rv-time" name="time" className="site-input" value={form.time} disabled={!form.date || !slots.length}
                  aria-invalid={Boolean(errors.time)} aria-describedby={errors.time ? 'rv-time-err' : 'rv-time-hint'}
                  onChange={(e) => set('time', e.target.value)}>
                  <option value="">{form.date ? 'Chọn giờ' : 'Chọn ngày trước'}</option>
                  {slots.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </SiteField>
              {cfg.allowAreaChoice && site.areas.length ? (
                <SiteField label="Khu vực mong muốn" htmlFor="rv-area" error={errors.areaId}>
                  <select id="rv-area" name="areaId" className="site-input" value={form.areaId} aria-invalid={Boolean(errors.areaId)}
                    onChange={(e) => set('areaId', e.target.value)}>
                    <option value="">Để nhà hàng sắp xếp</option>
                    {site.areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </SiteField>
              ) : null}
              <SiteField label="Email" htmlFor="rv-email" required={cfg.requireEmail} error={errors.email}
                className={cfg.allowAreaChoice && site.areas.length ? undefined : 'sm:col-span-2'}>
                <input id="rv-email" name="email" type="email" autoComplete="email" className="site-input" maxLength={150} value={form.email}
                  aria-invalid={Boolean(errors.email)} onChange={(e) => set('email', e.target.value)} placeholder={cfg.requireEmail ? 'ban@email.com' : 'Không bắt buộc'} />
              </SiteField>
              {cfg.allowNote ? (
                <SiteField label="Ghi chú" htmlFor="rv-note" error={errors.note} className="sm:col-span-2" hint={`${form.note.length}/300 — dịp đặc biệt, ghế trẻ em, dị ứng…`}>
                  <textarea id="rv-note" name="note" className="site-input" maxLength={300} value={form.note}
                    aria-invalid={Boolean(errors.note)} onChange={(e) => set('note', e.target.value)} placeholder="VD: Tổ chức sinh nhật, cần 1 ghế trẻ em" />
                </SiteField>
              ) : null}
              <div className="sm:col-span-2">
                <button type="submit" className="site-btn site-btn-primary w-full sm:w-auto" disabled={mutation.isPending}>
                  <CalendarCheck size={17} aria-hidden /> {mutation.isPending ? 'Đang gửi…' : 'Gửi yêu cầu đặt bàn'}
                </button>
                <p className="mt-3 text-[13px] text-[var(--site-muted)]">
                  Bằng việc gửi yêu cầu, bạn đồng ý để nhà hàng liên hệ qua số điện thoại đã nhập để xác nhận lịch.
                </p>
              </div>
            </form>
          )}
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

function SiteField({ label, htmlFor, required, error, hint, className, children }: {
  label: string;
  htmlFor: string;
  required?: boolean;
  error?: string;
  hint?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={className}>
      <label htmlFor={htmlFor} className="mb-1.5 block text-[14px] font-semibold">
        {label} {required ? <span className="text-[var(--site-danger)]" aria-hidden>*</span> : null}
      </label>
      {children}
      {error ? (
        <p id={`${htmlFor}-err`} role="alert" className="mt-1.5 text-[13px] text-[var(--site-danger)]">{error}</p>
      ) : hint ? (
        <p id={`${htmlFor}-hint`} className="mt-1.5 text-[12.5px] text-[var(--site-muted)]">{hint}</p>
      ) : null}
    </div>
  );
}

/** Đưa con trỏ tới ô lỗi đầu tiên (theo thứ tự trên form) để khách sửa ngay, nhất là trên điện thoại. */
function focusFirstError(form: HTMLFormElement | null, fields: Record<string, string>) {
  if (!form) return;
  const el = Array.from(form.querySelectorAll<HTMLElement>('[name]')).find((x) => fields[x.getAttribute('name') ?? '']);
  el?.focus();
}

function Success({ result, phone, onAgain }: { result: PublicReservationResult; phone: string; onAgain: () => void }) {
  const confirmed = result.status === 'confirmed';
  return (
    <div className="site-fade-up py-6 text-center" role="status">
      <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[var(--site-success-soft)] text-[var(--site-success)]">
        <CircleCheckBig size={34} aria-hidden />
      </span>
      <h2 className="site-display mt-5 text-[30px] font-semibold">{confirmed ? 'Đặt bàn thành công!' : 'Đã gửi yêu cầu đặt bàn!'}</h2>
      <p className="mx-auto mt-2 max-w-[460px] text-[15px] text-[var(--site-muted)]">
        {confirmed
          ? 'Lịch của bạn đã được xác nhận. Hẹn gặp bạn tại nhà hàng!'
          : 'Nhà hàng sẽ gọi lại cho bạn để xác nhận trong thời gian sớm nhất.'}
      </p>
      <dl className="mx-auto mt-6 grid max-w-[420px] gap-2 rounded-2xl bg-[var(--site-surface-2)] p-5 text-left text-[14.5px]">
        <Row label="Mã đặt bàn"><span className="font-bold text-[var(--site-primary)]">{result.code}</span></Row>
        <Row label="Khách">{result.customerName}</Row>
        <Row label="Thời gian">{formatDateTime(result.dateTime)}</Row>
        <Row label="Số khách">{result.guests} khách</Row>
        <Row label="Khu vực">{result.areaName}</Row>
        <Row label="Trạng thái">
          <span className={cn('font-semibold', confirmed ? 'text-[var(--site-success)]' : 'text-[#9a6a00]')}>{confirmed ? 'Đã xác nhận' : 'Chờ xác nhận'}</span>
        </Row>
      </dl>
      <p className="mt-4 text-[13.5px] text-[var(--site-muted)]">
        Cần đổi hoặc hủy lịch? Gọi <a href={telHref(phone)} className="font-semibold text-[var(--site-primary)] hover:underline">{phone}</a> và đọc mã đặt bàn.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <button type="button" className="site-btn site-btn-ghost" onClick={onAgain}>Đặt thêm lịch khác</button>
        <Link to="/thuc-don" className="site-btn site-btn-primary">Xem thực đơn</Link>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-[var(--site-muted)]">{label}</dt>
      <dd className="text-right font-medium">{children}</dd>
    </div>
  );
}
