import {
  BusinessError,
  EMAIL_RE,
  PHONE_RE,
  TIME_RE,
  ValidationError,
  collapseSpaces,
  delay,
  timeToMinutes,
  uid,
} from '@/lib/mock';
import { WEEKDAYS } from '@/lib/labels';
import { logActivity } from './audit';
import type { BackupFile, BackupSchedule, OpeningDay, RestaurantInfo } from '@/types';

const now = Date.now();

/** [FAKE-DATA] Thông tin nhà hàng mẫu. */
let info: RestaurantInfo = {
  name: 'Green Lotus',
  legalName: 'Công ty TNHH Ẩm thực Green Lotus',
  taxCode: '0315678912',
  logo: null,
  phone: '02838221234',
  email: 'lienhe@greenlotus.vn',
  address: '28 Nguyễn Huệ, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh',
  website: 'https://greenlotus.vn',
  updatedAt: new Date(now - 12 * 86_400_000).toISOString(),
};

/** [FAKE-DATA] Giờ hoạt động theo ngày trong tuần (0 = Chủ nhật). */
let hours: OpeningDay[] = [0, 1, 2, 3, 4, 5, 6].map((day) => ({
  day,
  open: true,
  openTime: day === 0 || day === 6 ? '09:00' : '10:00',
  closeTime: day === 5 || day === 6 ? '23:00' : '22:00',
}));

let schedule: BackupSchedule = { enabled: true, frequency: 'daily', weekday: 1, time: '02:00', keep: 7 };

let backups: BackupFile[] = [0, 1, 2, 3, 4].map((d) => {
  const at = new Date(now - d * 86_400_000);
  at.setHours(2, 0, 0, 0);
  const stamp = `${at.getFullYear()}${String(at.getMonth() + 1).padStart(2, '0')}${String(at.getDate()).padStart(2, '0')}`;
  return {
    id: `bk-${d}`,
    name: `rms-backup-${stamp}-0200.sql.gz`,
    createdAt: at.toISOString(),
    sizeKb: 4820 - d * 37,
    kind: 'auto' as const,
  };
});

/** Đọc đồng bộ giờ hoạt động — dùng khi kiểm tra ràng buộc đặt bàn trong mock. */
export function openingHoursSnapshot(): OpeningDay[] {
  return hours.map((h) => ({ ...h }));
}

/* ------------------------------------------------------------ Thông tin nhà hàng */

/** [BACKEND-TODO] GET /api/settings/restaurant */
export async function getRestaurantInfo(): Promise<RestaurantInfo> {
  await delay(260);
  return { ...info };
}

/** [BACKEND-TODO] PUT /api/settings/restaurant */
export async function updateRestaurantInfo(input: Omit<RestaurantInfo, 'updatedAt'>): Promise<RestaurantInfo> {
  await delay(420);
  const errors: Record<string, string> = {};
  if (!collapseSpaces(input.name)) errors.name = 'Vui lòng nhập tên nhà hàng';
  if (input.taxCode.trim() && !/^\d{10}(-\d{3})?$/.test(input.taxCode.trim()))
    errors.taxCode = 'Mã số thuế gồm 10 số hoặc 13 số (dạng 0123456789-001)';
  if (!PHONE_RE.test(input.phone.trim()) && !/^0\d{9,10}$/.test(input.phone.trim()))
    errors.phone = 'Số điện thoại không hợp lệ';
  if (!EMAIL_RE.test(input.email.trim())) errors.email = 'Email không đúng định dạng';
  if (!collapseSpaces(input.address)) errors.address = 'Vui lòng nhập địa chỉ';
  if (input.website.trim() && !/^https?:\/\/\S+\.\S+/.test(input.website.trim()))
    errors.website = 'Website phải bắt đầu bằng http:// hoặc https://';
  if (Object.keys(errors).length) throw new ValidationError(errors);
  info = {
    ...input,
    name: collapseSpaces(input.name),
    address: collapseSpaces(input.address),
    updatedAt: new Date().toISOString(),
  };
  logActivity('settings', 'Cập nhật thông tin nhà hàng', `Cập nhật thông tin định danh & liên hệ của ${info.name}`);
  return { ...info };
}

/* ------------------------------------------------------------ Giờ hoạt động */

/** [BACKEND-TODO] GET /api/settings/opening-hours */
export async function getOpeningHours(): Promise<OpeningDay[]> {
  await delay(220);
  return openingHoursSnapshot();
}

/** [BACKEND-TODO] PUT /api/settings/opening-hours */
export async function updateOpeningHours(input: OpeningDay[]): Promise<OpeningDay[]> {
  await delay(380);
  const errors: Record<string, string> = {};
  input.forEach((d) => {
    if (!d.open) return;
    if (!TIME_RE.test(d.openTime) || !TIME_RE.test(d.closeTime)) {
      errors[`day-${d.day}`] = 'Giờ không đúng định dạng HH:mm';
    } else if (timeToMinutes(d.closeTime) <= timeToMinutes(d.openTime)) {
      errors[`day-${d.day}`] = 'Giờ đóng cửa phải sau giờ mở cửa';
    }
  });
  if (!input.some((d) => d.open)) errors.general = 'Nhà hàng phải mở cửa ít nhất một ngày trong tuần';
  if (Object.keys(errors).length) throw new ValidationError(errors);
  hours = input.map((d) => ({ ...d }));
  const summary = hours
    .filter((d) => d.open)
    .map((d) => `${WEEKDAYS[d.day]} ${d.openTime}–${d.closeTime}`)
    .slice(0, 2)
    .join('; ');
  logActivity('settings', 'Cập nhật giờ hoạt động', `${summary}…`);
  return openingHoursSnapshot();
}

/* ------------------------------------------------------------ Sao lưu & phục hồi */

/** [BACKEND-TODO] GET /api/backups */
export async function getBackups(): Promise<{ schedule: BackupSchedule; files: BackupFile[] }> {
  await delay(280);
  return {
    schedule: { ...schedule },
    files: [...backups].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
  };
}

/** [BACKEND-TODO] PUT /api/backups/schedule */
export async function updateBackupSchedule(input: BackupSchedule): Promise<BackupSchedule> {
  await delay(320);
  const errors: Record<string, string> = {};
  if (!TIME_RE.test(input.time)) errors.time = 'Giờ không đúng định dạng HH:mm';
  if (!Number.isInteger(input.keep) || input.keep < 1 || input.keep > 60)
    errors.keep = 'Số bản lưu giữ từ 1 đến 60';
  if (Object.keys(errors).length) throw new ValidationError(errors);
  schedule = { ...input };
  logActivity(
    'settings',
    'Cập nhật lịch sao lưu',
    input.enabled
      ? `Tự động sao lưu ${input.frequency === 'daily' ? 'hằng ngày' : `mỗi ${WEEKDAYS[input.weekday]}`} lúc ${input.time}, giữ ${input.keep} bản`
      : 'Tắt sao lưu tự động',
  );
  return { ...schedule };
}

/** [BACKEND-TODO] POST /api/backups — tạo bản sao lưu thủ công. */
export async function createBackup(): Promise<BackupFile> {
  await delay(1200);
  const at = new Date();
  const stamp = `${at.getFullYear()}${String(at.getMonth() + 1).padStart(2, '0')}${String(at.getDate()).padStart(2, '0')}-${String(at.getHours()).padStart(2, '0')}${String(at.getMinutes()).padStart(2, '0')}`;
  const file: BackupFile = {
    id: uid('bk'),
    name: `rms-backup-${stamp}-manual.sql.gz`,
    createdAt: at.toISOString(),
    sizeKb: 4800 + Math.round(Math.random() * 120),
    kind: 'manual',
  };
  backups = [file, ...backups];
  logActivity('settings', 'Sao lưu dữ liệu', `Tạo bản sao lưu thủ công ${file.name}`);
  return file;
}

/** [BACKEND-TODO] POST /api/backups/{id}/restore */
export async function restoreBackup(id: string): Promise<void> {
  await delay(1500);
  const file = backups.find((b) => b.id === id);
  if (!file) throw new BusinessError('Bản sao lưu không tồn tại');
  logActivity('settings', 'Phục hồi dữ liệu', `Phục hồi hệ thống từ ${file.name}`);
}

/** [BACKEND-TODO] GET /api/backups/{id}/download — trả file nhị phân. */
export async function downloadBackup(id: string): Promise<{ name: string; content: string }> {
  await delay(500);
  const file = backups.find((b) => b.id === id);
  if (!file) throw new BusinessError('Bản sao lưu không tồn tại');
  logActivity('settings', 'Tải bản sao lưu', `Tải xuống ${file.name}`);
  return {
    name: file.name.replace('.sql.gz', '.json'),
    content: JSON.stringify(
      { backup: file.name, createdAt: file.createdAt, note: 'Dữ liệu mô phỏng — bản thật do máy chủ cung cấp' },
      null,
      2,
    ),
  };
}

/** [BACKEND-TODO] DELETE /api/backups/{id} */
export async function deleteBackup(id: string): Promise<void> {
  await delay(360);
  const file = backups.find((b) => b.id === id);
  if (!file) throw new BusinessError('Bản sao lưu không tồn tại');
  backups = backups.filter((b) => b.id !== id);
  logActivity('settings', 'Xóa bản sao lưu', `Xóa ${file.name}`);
}
