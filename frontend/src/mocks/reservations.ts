import type {
  Area,
  DiningTable,
  Reservation,
  ReservationFormConfig,
  ReservationSource,
  ReservationStatus,
  TableShape,
} from '@/types';

export const FLOOR_COLS = 8;
export const FLOOR_ROWS = 5;

/** [FAKE-DATA] Khu vực phục vụ. */
export const areaSeed: Area[] = [
  { id: 'area-1', name: 'Tầng 1', description: 'Sảnh chính, gần quầy thu ngân', active: true },
  { id: 'area-2', name: 'Sân vườn', description: 'Ngoài trời, có mái che di động', active: true },
  { id: 'area-3', name: 'Tầng 2', description: 'Không gian yên tĩnh, phù hợp gia đình', active: true },
  { id: 'area-4', name: 'Phòng VIP', description: 'Phòng riêng có máy lạnh, tối đa 12 khách', active: true },
];

type T = [string, string, number, TableShape, number, number];

const tableRows: T[] = [
  ['T01', 'area-1', 2, 'square', 0, 0],
  ['T02', 'area-1', 2, 'square', 2, 0],
  ['T03', 'area-1', 4, 'square', 4, 0],
  ['T04', 'area-1', 4, 'square', 6, 0],
  ['T05', 'area-1', 4, 'round', 0, 2],
  ['T06', 'area-1', 6, 'rect', 2, 2],
  ['T07', 'area-1', 6, 'rect', 5, 2],
  ['T08', 'area-1', 4, 'round', 1, 4],
  ['T09', 'area-1', 8, 'rect', 4, 4],
  ['SV01', 'area-2', 4, 'round', 0, 0],
  ['SV02', 'area-2', 4, 'round', 3, 0],
  ['SV03', 'area-2', 6, 'round', 6, 0],
  ['SV04', 'area-2', 2, 'square', 1, 3],
  ['SV05', 'area-2', 8, 'rect', 4, 3],
  ['L2-01', 'area-3', 4, 'square', 0, 1],
  ['L2-02', 'area-3', 4, 'square', 2, 1],
  ['L2-03', 'area-3', 6, 'rect', 4, 1],
  ['L2-04', 'area-3', 10, 'rect', 2, 3],
  ['VIP01', 'area-4', 8, 'round', 1, 1],
  ['VIP02', 'area-4', 12, 'rect', 4, 2],
];

export const tableSeed: DiningTable[] = tableRows.map(([code, areaId, seats, shape, x, y], i) => ({
  id: `tbl-${i + 1}`,
  code,
  areaId,
  seats,
  shape,
  x,
  y,
  status: i % 7 === 2 ? 'occupied' : i % 5 === 1 ? 'reserved' : code === 'T08' ? 'inactive' : 'available',
}));

const NAMES = [
  ['Nguyễn Thu Hà', '0903456781'],
  ['Trần Minh Quân', '0912345678'],
  ['Lê Hoàng Nam', '0987654321'],
  ['Phạm Diễm My', '0938123456'],
  ['Võ Thành Công', '0977001122'],
  ['Đặng Bảo Ngọc', '0356789012'],
  ['Huỳnh Gia Hân', '0868111222'],
  ['Bùi Đức Anh', '0702334455'],
  ['Ngô Quỳnh Như', '0829456123'],
  ['Hoàng Văn Lợi', '0945667788'],
  ['Phan Mỹ Duyên', '0389001234'],
  ['Trương Khải', '0919223344'],
];

const NOTES = [
  '',
  'Sinh nhật, cần chuẩn bị bánh kem',
  'Có trẻ nhỏ, xin ghế em bé',
  '',
  'Khách dị ứng đậu phộng',
  'Muốn ngồi gần cửa sổ',
  '',
  'Tiệc công ty, xuất hóa đơn VAT',
];

const now = new Date();

function at(dayOffset: number, hh: number, mm: number): Date {
  const d = new Date(now);
  d.setDate(d.getDate() + dayOffset);
  d.setHours(hh, mm, 0, 0);
  return d;
}

type R = [number, number, number, number, number];
/** [ngày lệch, giờ, phút, index bàn, số khách] */
const resRows: R[] = [
  [-6, 18, 30, 5, 6], [-5, 19, 0, 18, 8], [-4, 12, 0, 2, 3], [-3, 19, 30, 9, 4],
  [-3, 20, 0, 13, 7], [-2, 11, 30, 0, 2], [-2, 18, 0, 19, 10], [-1, 19, 0, 6, 5],
  [-1, 12, 30, 14, 4], [0, 11, 0, 3, 4], [0, 12, 0, 10, 4], [0, 18, 30, 5, 6],
  [0, 19, 30, 11, 6], [0, 20, 0, 1, 2], [0, 19, 0, 18, 8], [1, 18, 0, 2, 4],
  [1, 19, 0, 16, 5], [1, 12, 0, 15, 3], [2, 18, 30, 19, 12], [2, 19, 30, 9, 3],
  [3, 11, 30, 4, 4], [3, 20, 0, 13, 6], [4, 18, 0, 17, 9], [5, 19, 0, 6, 6],
  [6, 12, 0, 0, 2], [7, 18, 30, 12, 2],
];

function statusFor(dayOffset: number, i: number): ReservationStatus {
  if (dayOffset < 0) return i % 6 === 0 ? 'cancelled' : i % 9 === 0 ? 'no_show' : 'completed';
  if (dayOffset === 0) return i % 3 === 0 ? 'seated' : i % 3 === 1 ? 'confirmed' : 'pending';
  return i % 4 === 0 ? 'pending' : i % 7 === 0 ? 'cancelled' : 'confirmed';
}

const SOURCES: ReservationSource[] = ['website', 'phone', 'website', 'walk_in'];

export const reservationSeed: Reservation[] = resRows.map(([day, hh, mm, tableIdx, guests], i) => {
  const table = tableSeed[tableIdx];
  const [customerName, phone] = NAMES[i % NAMES.length];
  const dateTime = at(day, hh, mm);
  const created = new Date(dateTime.getTime() - (2 + (i % 5)) * 86_400_000);
  return {
    id: `res-${i + 1}`,
    code: `DB-${1090 + i}`,
    customerName,
    phone,
    guests,
    dateTime: dateTime.toISOString(),
    areaId: table.areaId,
    tableId: table.id,
    note: NOTES[i % NOTES.length],
    status: statusFor(day, i),
    source: SOURCES[i % SOURCES.length],
    createdAt: created.toISOString(),
    updatedAt: created.toISOString(),
  };
});

/** [FAKE-DATA] Cấu hình form đặt bàn phía khách hàng. */
export const reservationFormSeed: ReservationFormConfig = {
  slotMinutes: 30,
  durationMinutes: 120,
  minGuests: 1,
  maxGuests: 20,
  leadTimeMinutes: 60,
  maxDaysAhead: 30,
  requireEmail: false,
  allowAreaChoice: true,
  allowNote: true,
  autoConfirm: false,
  notice:
    'Nhà hàng giữ bàn tối đa 15 phút sau giờ hẹn. Với nhóm trên 12 khách, vui lòng gọi hotline để được sắp xếp phòng riêng.',
  updatedAt: new Date(now.getTime() - 20 * 86_400_000).toISOString(),
};
