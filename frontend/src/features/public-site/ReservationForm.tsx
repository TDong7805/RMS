import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { CalendarCheck, CircleCheckBig } from 'lucide-react';
import { createPublicReservation } from '@/api/public-site';
import { telHref, weekdayOf } from '@/features/public-site/parts';
import { addDays, normalizePhone, restaurantNow, timeSlots, validateReservation } from '@/features/public-site/reservation';
import { useApiMutation } from '@/hooks/use-api-mutation';
import { cn } from '@/lib/cn';
import { WEEKDAYS, formatDateTime } from '@/lib/labels';
import type { PublicReservationInput, PublicReservationResult, PublicSite } from '@/types';

const EMPTY: PublicReservationInput = { customerName: '', phone: '', email: '', guests: 2, date: '', time: '', areaId: '', note: '' };

/** Sự kiện để nơi khác (vd. mục Trải nghiệm ở trang chủ) điền sẵn ghi chú rồi cuộn tới form. */
export const RESERVE_EVENT = 'site:reserve';
export type ReserveEventDetail = { note?: string };

/** Cuộn tới form đặt bàn ở trang chủ, có thể điền sẵn ghi chú (vd. "Tiệc sinh nhật"). */
export function goToReservation(note?: string) {
  window.dispatchEvent(new CustomEvent<ReserveEventDetail>(RESERVE_EVENT, { detail: { note } }));
  document.getElementById('dat-ban')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/**
 * Form đặt bàn trực tuyến (dùng chung cho mục Đặt bàn ở trang chủ và trang /dat-ban): khách nhập họ tên, SĐT, số khách,
 * ngày giờ, ghi chú → POST /api/public/reservations. Lỗi theo từng ô (máy chủ kiểm tra lại toàn bộ).
 * Lịch tạo ra hiện ở Thu ngân → Đặt bàn hôm nay và Quản lý → Đặt bàn, kèm thông báo.
 */
export function ReservationForm({ site, idPrefix = 'rv', compact }: { site: PublicSite; idPrefix?: string; compact?: boolean }) {
  const cfg = site.reservation;
  const loadedAt = useRef(Date.now());
  const now = restaurantNow(site, loadedAt.current);
  const [form, setForm] = useState<PublicReservationInput>({ ...EMPTY, guests: Math.max(cfg.minGuests, Math.min(2, cfg.maxGuests)) });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [done, setDone] = useState<PublicReservationResult | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  const slots = useMemo(() => timeSlots(site, form.date, now), [site, form.date, now.date, now.minutes]); // eslint-disable-line react-hooks/exhaustive-deps
  const dayInfo = form.date ? site.openingHours.find((d) => d.day === weekdayOf(form.date)) : undefined;

  // Điền sẵn ghi chú khi khách bấm "Đặt bàn cho dịp này" ở mục Trải nghiệm.
  useEffect(() => {
    const on = (e: Event) => {
      const note = (e as CustomEvent<ReserveEventDetail>).detail?.note;
      setDone(null);
      if (note && cfg.allowNote) setForm((f) => ({ ...f, note: f.note.includes(note) ? f.note : [note, f.note].filter(Boolean).join('. ') }));
      window.setTimeout(() => document.getElementById(`${idPrefix}-name`)?.focus({ preventScroll: true }), 700);
    };
    window.addEventListener(RESERVE_EVENT, on);
    return () => window.removeEventListener(RESERVE_EVENT, on);
  }, [cfg.allowNote, idPrefix]);

  const mutation = useApiMutation(createPublicReservation, {
    onFieldErrors: (fields) => {
      setErrors(fields);
      focusFirstError(formRef.current, fields);
    },
    onSuccess: (result) => {
      setDone(result);
      boxRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
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

  const id = (k: string) => `${idPrefix}-${k}`;
  const showArea = cfg.allowAreaChoice && site.areas.length > 0;

  return (
    <div ref={boxRef}>
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
          className={cn('grid sm:grid-cols-2', compact ? 'gap-x-5 gap-y-4' : 'gap-5')}
        >
          <SiteField label="Họ và tên" htmlFor={id('name')} required error={errors.customerName} className="sm:col-span-2">
            <input id={id('name')} name="customerName" autoComplete="name" className="site-input" maxLength={80} value={form.customerName}
              aria-invalid={Boolean(errors.customerName)} aria-describedby={errors.customerName ? `${id('name')}-err` : undefined}
              onChange={(e) => set('customerName', e.target.value)} placeholder="Nguyễn Văn A" />
          </SiteField>
          <SiteField label="Số điện thoại" htmlFor={id('phone')} required error={errors.phone}>
            <input id={id('phone')} name="phone" type="tel" inputMode="tel" autoComplete="tel" className="site-input" maxLength={15} value={form.phone}
              aria-invalid={Boolean(errors.phone)} aria-describedby={errors.phone ? `${id('phone')}-err` : undefined}
              onChange={(e) => set('phone', e.target.value)} placeholder="0912 345 678" />
          </SiteField>
          <SiteField label="Số khách" htmlFor={id('guests')} required error={errors.guests} hint={`Từ ${cfg.minGuests} đến ${cfg.maxGuests} khách`}>
            <input id={id('guests')} name="guests" type="number" inputMode="numeric" min={cfg.minGuests} max={cfg.maxGuests} step={1} className="site-input"
              value={form.guests ?? ''} aria-invalid={Boolean(errors.guests)} aria-describedby={errors.guests ? `${id('guests')}-err` : `${id('guests')}-hint`}
              onChange={(e) => set('guests', e.target.value === '' ? null : Number(e.target.value))} />
          </SiteField>
          <SiteField
            label="Ngày"
            htmlFor={id('date')}
            required
            error={errors.date}
            hint={dayInfo ? (dayInfo.open ? `${WEEKDAYS[dayInfo.day]}: mở cửa ${dayInfo.openTime} – ${dayInfo.closeTime}` : `${WEEKDAYS[dayInfo.day]}: nhà hàng nghỉ`) : `Nhận đặt trước tối đa ${cfg.maxDaysAhead} ngày`}
          >
            <input id={id('date')} name="date" type="date" className="site-input" min={now.date} max={addDays(now.date, cfg.maxDaysAhead)} value={form.date}
              aria-invalid={Boolean(errors.date)} aria-describedby={errors.date ? `${id('date')}-err` : `${id('date')}-hint`}
              onChange={(e) => set('date', e.target.value)} />
          </SiteField>
          <SiteField label="Giờ" htmlFor={id('time')} required error={errors.time}
            hint={form.date && dayInfo?.open && !slots.length ? 'Ngày này đã hết giờ nhận đặt, vui lòng chọn ngày khác' : `Mỗi lượt khoảng ${cfg.durationMinutes} phút`}>
            <select id={id('time')} name="time" className="site-input" value={form.time} disabled={!form.date || !slots.length}
              aria-invalid={Boolean(errors.time)} aria-describedby={errors.time ? `${id('time')}-err` : `${id('time')}-hint`}
              onChange={(e) => set('time', e.target.value)}>
              <option value="">{form.date ? 'Chọn giờ' : 'Chọn ngày trước'}</option>
              {slots.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </SiteField>
          {showArea ? (
            <SiteField label="Khu vực mong muốn" htmlFor={id('area')} error={errors.areaId}>
              <select id={id('area')} name="areaId" className="site-input" value={form.areaId} aria-invalid={Boolean(errors.areaId)}
                onChange={(e) => set('areaId', e.target.value)}>
                <option value="">Để nhà hàng sắp xếp</option>
                {site.areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </SiteField>
          ) : null}
          <SiteField label="Email" htmlFor={id('email')} required={cfg.requireEmail} error={errors.email} className={showArea ? undefined : 'sm:col-span-2'}>
            <input id={id('email')} name="email" type="email" autoComplete="email" className="site-input" maxLength={150} value={form.email}
              aria-invalid={Boolean(errors.email)} onChange={(e) => set('email', e.target.value)} placeholder={cfg.requireEmail ? 'ban@email.com' : 'Không bắt buộc'} />
          </SiteField>
          {cfg.allowNote ? (
            <SiteField label="Ghi chú" htmlFor={id('note')} error={errors.note} className="sm:col-span-2" hint={`${form.note.length}/300 — dịp đặc biệt, ghế trẻ em, dị ứng…`}>
              <textarea id={id('note')} name="note" className="site-input" rows={compact ? 2 : 3} maxLength={300} value={form.note}
                aria-invalid={Boolean(errors.note)} onChange={(e) => set('note', e.target.value)} placeholder="VD: Tổ chức sinh nhật, cần 1 ghế trẻ em" />
            </SiteField>
          ) : null}
          <div className="sm:col-span-2">
            <button type="submit" className="site-btn site-btn-primary w-full" disabled={mutation.isPending}>
              <CalendarCheck size={17} aria-hidden /> {mutation.isPending ? 'Đang gửi…' : 'Gửi yêu cầu đặt bàn'}
            </button>
            <p className="mt-3 text-[13px] text-[var(--site-muted)]">
              Bằng việc gửi yêu cầu, bạn đồng ý để nhà hàng liên hệ qua số điện thoại đã nhập để xác nhận lịch.
            </p>
          </div>
        </form>
      )}
    </div>
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
    <div className="site-fade-up py-4 text-center" role="status">
      <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[var(--site-success-soft)] text-[var(--site-success)]">
        <CircleCheckBig size={34} aria-hidden />
      </span>
      <h3 className="site-display mt-5 text-[30px] font-semibold">{confirmed ? 'Đặt bàn thành công!' : 'Đã gửi yêu cầu đặt bàn!'}</h3>
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
