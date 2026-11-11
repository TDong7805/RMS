import { reservationFormSeed, reservationSeed } from '@/mocks/reservations';
import { matchesKeyword } from '@/lib/normalize';
import { ACTIVE_RESERVATION, RESERVATION_STATUS, WEEKDAYS } from '@/lib/labels';
import {
  BusinessError,
  PHONE_RE,
  ValidationError,
  collapseSpaces,
  delay,
  minutesToTime,
  paginate,
  timeToMinutes,
  toDateKey,
} from '@/lib/mock';
import { logActivity } from './audit';
import { openingHoursSnapshot } from './settings';
import { areasSnapshot, tablesSnapshot } from './tables';
import type {
  Paged,
  Reservation,
  ReservationFilter,
  ReservationFormConfig,
  ReservationInput,
  ReservationStatus,
} from '@/types';

let store: Reservation[] = reservationSeed.map((r) => ({ ...r }));
let formConfig: ReservationFormConfig = { ...reservationFormSeed };

export const RESERVATION_PAGE_SIZE = 10;

/** Bàn có lịch đặt còn hiệu lực trong tương lai (chặn xóa/chuyển khu vực bàn). */
export function hasUpcomingReservation(tableId: string): boolean {
  const nowTs = Date.now();
  return store.some(
    (r) => r.tableId === tableId && ACTIVE_RESERVATION.includes(r.status) && new Date(r.dateTime).getTime() >= nowTs,
  );
}

/**
 * [BACKEND-TODO] Danh sách đặt bàn: GET /api/reservations?keyword=&date=&areaId=&status=&page=
 * Tìm theo tên khách / số điện thoại; lọc theo ngày đặt, khu vực, trạng thái. Trả về Paged<Reservation>.
 */
export async function getReservations(filter: ReservationFilter): Promise<Paged<Reservation>> {
  await delay(320);
  const keyword = filter.keyword.trim();
  const digits = keyword.replace(/\D/g, '');
  const items = store
    .filter((r) => (filter.status === 'all' ? true : r.status === filter.status))
    .filter((r) => (filter.areaId ? r.areaId === filter.areaId : true))
    .filter((r) => (filter.date ? toDateKey(new Date(r.dateTime)) === filter.date : true))
    .filter(
      (r) =>
        !keyword ||
        matchesKeyword(r.customerName, keyword) ||
        matchesKeyword(r.code, keyword) ||
        (digits.length >= 3 && r.phone.includes(digits)),
    )
    .sort((a, b) => new Date(b.dateTime).getTime() - new Date(a.dateTime).getTime());
  return paginate(items, filter.page, RESERVATION_PAGE_SIZE);
}

/** [BACKEND-TODO] GET /api/reservations/{id} — ném lỗi 404 nếu bản ghi không còn tồn tại. */
export async function getReservation(id: string): Promise<Reservation> {
  await delay(220);
  const found = store.find((r) => r.id === id);
  if (!found) throw new BusinessError('Nội dung này không còn tồn tại');
  return { ...found };
}

/**
 * Kiểm tra thông tin & ràng buộc đặt bàn (bước 9 của đặc tả):
 * bắt buộc, định dạng SĐT, số khách nguyên dương, thời gian không ở quá khứ và trong giờ hoạt động,
 * sức chứa bàn/khu vực, trùng lịch (loại trừ chính bản ghi đang sửa).
 */
function validateReservation(id: string, input: ReservationInput, original: Reservation): Record<string, string> {
  const errors: Record<string, string> = {};
  const name = collapseSpaces(input.customerName);
  if (!name) errors.customerName = 'Vui lòng nhập tên khách hàng';
  else if (name.length > 80) errors.customerName = 'Tên khách hàng tối đa 80 ký tự';

  const phone = input.phone.replace(/[\s.]/g, '');
  if (!phone) errors.phone = 'Vui lòng nhập số điện thoại';
  else if (!PHONE_RE.test(phone)) errors.phone = 'Số điện thoại không đúng định dạng (VD: 0912345678)';

  if (!Number.isInteger(input.guests) || input.guests <= 0) errors.guests = 'Số khách phải là số nguyên dương';
  else if (input.guests > formConfig.maxGuests)
    errors.guests = `Mỗi lịch đặt tối đa ${formConfig.maxGuests} khách theo cấu hình form đặt bàn`;

  if (!input.date) errors.date = 'Vui lòng chọn ngày đặt';
  if (!input.time) errors.time = 'Vui lòng chọn giờ đặt';

  const areas = areasSnapshot();
  const tables = tablesSnapshot();
  const area = areas.find((a) => a.id === input.areaId);
  if (!area) errors.areaId = 'Vui lòng chọn khu vực';
  else if (!area.active) errors.areaId = 'Khu vực đang tạm ngưng phục vụ';

  if (input.note.length > 300) errors.note = 'Ghi chú tối đa 300 ký tự';
  if (Object.keys(errors).length) return errors;

  const start = new Date(`${input.date}T${input.time}:00`);
  const timeChanged = start.getTime() !== new Date(original.dateTime).getTime();
  const capacityChanged =
    timeChanged ||
    input.guests !== original.guests ||
    input.areaId !== original.areaId ||
    input.tableId !== original.tableId;

  if (timeChanged) {
    if (start.getTime() < Date.now()) {
      errors.time = 'Thời gian đặt không được nằm trong quá khứ';
    } else {
      const day = openingHoursSnapshot().find((d) => d.day === start.getDay());
      const startMin = timeToMinutes(input.time);
      if (!day || !day.open) {
        errors.date = `Nhà hàng không mở cửa vào ${WEEKDAYS[start.getDay()]}`;
      } else {
        const latest = timeToMinutes(day.closeTime) - formConfig.durationMinutes;
        if (startMin < timeToMinutes(day.openTime) || startMin > latest) {
          errors.time = `Giờ đặt phải trong khoảng ${day.openTime} – ${minutesToTime(latest)} (giờ hoạt động ${day.openTime}–${day.closeTime}, mỗi lượt ${formConfig.durationMinutes} phút)`;
        }
      }
    }
  }
  if (Object.keys(errors).length) return errors;

  if (capacityChanged) {
    const duration = formConfig.durationMinutes * 60_000;
    const overlaps = (r: Reservation) => {
      const s = new Date(r.dateTime).getTime();
      return start.getTime() < s + duration && s < start.getTime() + duration;
    };
    const others = store.filter((r) => r.id !== id && ACTIVE_RESERVATION.includes(r.status) && overlaps(r));

    if (input.tableId) {
      const table = tables.find((t) => t.id === input.tableId);
      if (!table || table.areaId !== input.areaId) errors.tableId = 'Bàn không thuộc khu vực đã chọn';
      else if (table.status === 'inactive') errors.tableId = `Bàn ${table.code} đang ngưng sử dụng`;
      else if (table.seats < input.guests)
        errors.tableId = `Bàn ${table.code} chỉ có ${table.seats} ghế, không đủ cho ${input.guests} khách`;
      else {
        const clash = others.find((r) => r.tableId === table.id);
        if (clash)
          errors.tableId = `Bàn ${table.code} đã có lịch ${clash.code} lúc ${minutesToTime(new Date(clash.dateTime).getHours() * 60 + new Date(clash.dateTime).getMinutes())} — trùng khung giờ`;
      }
    } else {
      const areaTables = tables.filter((t) => t.areaId === input.areaId && t.status !== 'inactive');
      const busy = new Set(others.map((r) => r.tableId).filter(Boolean));
      const free = areaTables.filter((t) => !busy.has(t.id) && t.seats >= input.guests);
      if (free.length === 0)
        errors.areaId = `Khu vực ${area!.name} không còn bàn trống đủ ${input.guests} chỗ trong khung giờ này`;
    }
  }
  return errors;
}

/** [BACKEND-TODO] PUT /api/reservations/{id} — 422 kèm lỗi từng trường khi không hợp lệ. */
export async function updateReservation(id: string, input: ReservationInput): Promise<Reservation> {
  await delay(450);
  const original = store.find((r) => r.id === id);
  if (!original) throw new BusinessError('Lịch đặt không còn tồn tại');
  if (original.status === 'cancelled' || original.status === 'completed' || original.status === 'no_show')
    throw new BusinessError(`Lịch đặt ở trạng thái "${RESERVATION_STATUS[original.status].label}" không thể chỉnh sửa`);
  const errors = validateReservation(id, input, original);
  if (Object.keys(errors).length) throw new ValidationError(errors);

  const updated: Reservation = {
    ...original,
    customerName: collapseSpaces(input.customerName),
    phone: input.phone.replace(/[\s.]/g, ''),
    guests: input.guests,
    dateTime: new Date(`${input.date}T${input.time}:00`).toISOString(),
    areaId: input.areaId,
    tableId: input.tableId,
    note: input.note.trim(),
    updatedAt: new Date().toISOString(),
  };
  store = store.map((r) => (r.id === id ? updated : r));

  const changes: string[] = [];
  if (original.guests !== updated.guests) changes.push(`số khách ${original.guests} → ${updated.guests}`);
  if (original.dateTime !== updated.dateTime) changes.push('đổi thời gian');
  if (original.tableId !== updated.tableId || original.areaId !== updated.areaId) changes.push('đổi bàn/khu vực');
  if (original.customerName !== updated.customerName || original.phone !== updated.phone) changes.push('thông tin khách');
  if (original.note !== updated.note) changes.push('ghi chú');
  logActivity('reservation', 'Cập nhật đặt bàn', `${updated.code}: ${changes.join(', ') || 'không đổi nội dung'}`);
  return { ...updated };
}

const NEXT_STATUS: Record<ReservationStatus, ReservationStatus[]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['seated', 'cancelled', 'no_show'],
  seated: ['completed'],
  completed: [],
  cancelled: [],
  no_show: [],
};

export function allowedNextStatuses(status: ReservationStatus): ReservationStatus[] {
  return NEXT_STATUS[status];
}

/** [BACKEND-TODO] PATCH /api/reservations/{id}/status { status } */
export async function setReservationStatus(id: string, status: ReservationStatus): Promise<Reservation> {
  await delay(300);
  const original = store.find((r) => r.id === id);
  if (!original) throw new BusinessError('Lịch đặt không còn tồn tại');
  if (!NEXT_STATUS[original.status].includes(status))
    throw new BusinessError('Không thể chuyển sang trạng thái này');
  const updated = { ...original, status, updatedAt: new Date().toISOString() };
  store = store.map((r) => (r.id === id ? updated : r));
  logActivity(
    'reservation',
    'Đổi trạng thái đặt bàn',
    `${original.code}: ${RESERVATION_STATUS[original.status].label} → ${RESERVATION_STATUS[status].label}`,
  );
  return { ...updated };
}

/** Thống kê nhanh cho đầu trang: lịch hôm nay, chờ xác nhận. */
export async function getReservationSummary(): Promise<{ today: number; pending: number; guestsToday: number }> {
  await delay(200);
  const todayKey = toDateKey(new Date());
  const todays = store.filter((r) => toDateKey(new Date(r.dateTime)) === todayKey && ACTIVE_RESERVATION.includes(r.status));
  return {
    today: todays.length,
    pending: store.filter((r) => r.status === 'pending').length,
    guestsToday: todays.reduce((s, r) => s + r.guests, 0),
  };
}

/* ------------------------------------------------------------ Cấu hình form đặt bàn */

/** [BACKEND-TODO] GET /api/reservations/form-config */
export async function getReservationFormConfig(): Promise<ReservationFormConfig> {
  await delay(240);
  return { ...formConfig };
}

/** [BACKEND-TODO] PUT /api/reservations/form-config */
export async function updateReservationFormConfig(
  input: Omit<ReservationFormConfig, 'updatedAt'>,
): Promise<ReservationFormConfig> {
  await delay(400);
  const errors: Record<string, string> = {};
  const int = (v: number) => Number.isInteger(v);
  if (![15, 30, 60].includes(input.slotMinutes)) errors.slotMinutes = 'Bước thời gian là 15, 30 hoặc 60 phút';
  if (!int(input.durationMinutes) || input.durationMinutes < 30 || input.durationMinutes > 360)
    errors.durationMinutes = 'Thời lượng mỗi lượt từ 30 đến 360 phút';
  if (!int(input.minGuests) || input.minGuests < 1) errors.minGuests = 'Tối thiểu 1 khách';
  if (!int(input.maxGuests) || input.maxGuests < input.minGuests)
    errors.maxGuests = 'Số khách tối đa phải lớn hơn hoặc bằng số khách tối thiểu';
  else if (input.maxGuests > 50) errors.maxGuests = 'Tối đa 50 khách cho mỗi lịch đặt';
  if (!int(input.leadTimeMinutes) || input.leadTimeMinutes < 0 || input.leadTimeMinutes > 1440)
    errors.leadTimeMinutes = 'Từ 0 đến 1440 phút';
  if (!int(input.maxDaysAhead) || input.maxDaysAhead < 1 || input.maxDaysAhead > 180)
    errors.maxDaysAhead = 'Từ 1 đến 180 ngày';
  if (input.notice.length > 500) errors.notice = 'Lưu ý tối đa 500 ký tự';
  if (Object.keys(errors).length) throw new ValidationError(errors);
  formConfig = { ...input, notice: input.notice.trim(), updatedAt: new Date().toISOString() };
  logActivity('reservation', 'Cập nhật form đặt bàn', `Lượt ${input.durationMinutes} phút, ${input.minGuests}–${input.maxGuests} khách, đặt trước tối đa ${input.maxDaysAhead} ngày`);
  return { ...formConfig };
}
