import { EMAIL_RE, PHONE_RE, minutesToTime, timeToMinutes } from '@/lib/mock';
import { WEEKDAYS } from '@/lib/labels';
import type { PublicReservationInput, PublicSite } from '@/types';
import { weekdayOf } from './parts';

/**
 * Quy tắc form đặt bàn phía khách — khớp với máy chủ (ReservationRules + PublicReservationService) để báo lỗi ngay khi
 * nhập. Máy chủ vẫn kiểm tra lại toàn bộ (sức chứa, trùng lịch chỉ máy chủ biết) và trả lỗi theo đúng tên trường.
 */

const ZONE = 'Asia/Ho_Chi_Minh';

/** "Bây giờ" theo giờ nhà hàng, tính từ giờ máy chủ lúc tải trang (không tin đồng hồ máy khách). */
export function restaurantNow(site: PublicSite, loadedAt: number): { date: string; minutes: number } {
  const now = new Date(Date.parse(site.serverTime) + (Date.now() - loadedAt));
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONE, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '00';
  return { date: `${get('year')}-${get('month')}-${get('day')}`, minutes: Number(get('hour')) * 60 + Number(get('minute')) };
}

/** yyyy-MM-dd + n ngày */
export function addDays(dateKey: string, n: number): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

/**
 * Các giờ đặt được trong ngày: từ giờ mở cửa tới (giờ đóng − thời lượng một lượt), bước slotMinutes;
 * hôm nay thì bỏ các giờ chưa đủ thời gian đặt trước tối thiểu.
 */
export function timeSlots(site: PublicSite, date: string, now: { date: string; minutes: number }): string[] {
  if (!date) return [];
  const day = site.openingHours.find((d) => d.day === weekdayOf(date));
  if (!day || !day.open) return [];
  const { slotMinutes, durationMinutes, leadTimeMinutes } = site.reservation;
  const open = timeToMinutes(day.openTime);
  const latest = timeToMinutes(day.closeTime) - durationMinutes;
  const earliest = date === now.date ? now.minutes + leadTimeMinutes : date === addDays(now.date, 1) ? now.minutes + leadTimeMinutes - 1440 : -Infinity;
  const out: string[] = [];
  const first = Math.ceil(open / slotMinutes) * slotMinutes;
  for (let t = first; t <= latest; t += slotMinutes) {
    if (t >= earliest) out.push(minutesToTime(t));
  }
  return out;
}

export const normalizePhone = (s: string) => s.trim().replace(/[\s.]/g, '');

export function validateReservation(
  f: PublicReservationInput,
  site: PublicSite,
  now: { date: string; minutes: number },
): Record<string, string> {
  const e: Record<string, string> = {};
  const cfg = site.reservation;
  const name = f.customerName.trim().replace(/\s+/g, ' ');
  if (!name) e.customerName = 'Vui lòng nhập họ tên';
  else if (name.length > 80) e.customerName = 'Họ tên tối đa 80 ký tự';

  const phone = normalizePhone(f.phone);
  if (!phone) e.phone = 'Vui lòng nhập số điện thoại';
  else if (!PHONE_RE.test(phone)) e.phone = 'Số điện thoại không đúng định dạng (VD: 0912345678)';

  const email = f.email.trim();
  if (!email && cfg.requireEmail) e.email = 'Vui lòng nhập email';
  else if (email && !EMAIL_RE.test(email)) e.email = 'Email không đúng định dạng';

  if (f.guests === null || !Number.isInteger(f.guests) || f.guests <= 0) e.guests = 'Số khách phải là số nguyên lớn hơn 0';
  else if (f.guests < cfg.minGuests) e.guests = `Tối thiểu ${cfg.minGuests} khách mỗi lịch đặt`;
  else if (f.guests > cfg.maxGuests) e.guests = `Đặt trực tuyến tối đa ${cfg.maxGuests} khách — đoàn đông hơn vui lòng gọi nhà hàng`;

  const maxDate = addDays(now.date, cfg.maxDaysAhead);
  if (!f.date) e.date = 'Vui lòng chọn ngày';
  else if (f.date < now.date) e.date = 'Ngày đặt không được nằm trong quá khứ';
  else if (f.date > maxDate) e.date = `Chỉ nhận đặt bàn trước tối đa ${cfg.maxDaysAhead} ngày`;
  else {
    const day = site.openingHours.find((d) => d.day === weekdayOf(f.date));
    if (!day?.open) e.date = `Nhà hàng nghỉ vào ${WEEKDAYS[weekdayOf(f.date)]}`;
  }
  if (!e.date) {
    if (!f.time) e.time = 'Vui lòng chọn giờ';
    else if (!timeSlots(site, f.date, now).includes(f.time)) e.time = 'Giờ này không còn nhận đặt, vui lòng chọn giờ khác';
  }
  if (f.note.trim().length > 300) e.note = 'Ghi chú tối đa 300 ký tự';
  return e;
}
