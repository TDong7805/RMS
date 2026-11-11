import { BusinessError, delay, uid } from '@/lib/mock';
import { api } from '@/lib/http';
import type { BackupFile, BackupSchedule, OpeningDay, RestaurantInfo } from '@/types';

/* ------------------------------------------------------------ Thông tin nhà hàng */

export const getRestaurantInfo = () => api.get<RestaurantInfo>('/api/settings/restaurant');

export const updateRestaurantInfo = (input: Omit<RestaurantInfo, 'updatedAt'>) =>
  api.put<RestaurantInfo>('/api/settings/restaurant', input);

/* ------------------------------------------------------------ Giờ hoạt động */

export const getOpeningHours = () => api.get<OpeningDay[]>('/api/settings/opening-hours');

/** Lỗi trả về theo khóa "day-{0..6}" và "general". */
export const updateOpeningHours = (input: OpeningDay[]) => api.put<OpeningDay[]>('/api/settings/opening-hours', input);

/* ------------------------------------------------------------ Sao lưu & phục hồi */

export const updateBackupSchedule = (input: BackupSchedule) =>
  api.put<BackupSchedule>('/api/settings/backup-schedule', input);

/**
 * Lịch sao lưu lấy từ máy chủ. Danh sách file sao lưu và các thao tác tạo/phục hồi/tải/xóa
 * bên dưới VẪN LÀ GIẢ LẬP — [BACKEND-TODO] cần backend chạy mysqldump/mysql thật.
 */
export async function getBackups(): Promise<{ schedule: BackupSchedule; files: BackupFile[] }> {
  const schedule = await api.get<BackupSchedule>('/api/settings/backup-schedule');
  return {
    schedule,
    files: [...backups].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
  };
}

const now = Date.now();

/** [FAKE-DATA] Danh sách file sao lưu mô phỏng. */
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

/** [BACKEND-TODO] POST /api/backups — tạo bản sao lưu thủ công (giả lập). */
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
  return file;
}

/** [BACKEND-TODO] POST /api/backups/{id}/restore (giả lập). */
export async function restoreBackup(id: string): Promise<void> {
  await delay(1500);
  if (!backups.some((b) => b.id === id)) throw new BusinessError('Bản sao lưu không tồn tại');
}

/** [BACKEND-TODO] GET /api/backups/{id}/download — trả file nhị phân (giả lập). */
export async function downloadBackup(id: string): Promise<{ name: string; content: string }> {
  await delay(500);
  const file = backups.find((b) => b.id === id);
  if (!file) throw new BusinessError('Bản sao lưu không tồn tại');
  return {
    name: file.name.replace('.sql.gz', '.json'),
    content: JSON.stringify(
      { backup: file.name, createdAt: file.createdAt, note: 'Dữ liệu mô phỏng — bản thật do máy chủ cung cấp' },
      null,
      2,
    ),
  };
}

/** [BACKEND-TODO] DELETE /api/backups/{id} (giả lập). */
export async function deleteBackup(id: string): Promise<void> {
  await delay(360);
  if (!backups.some((b) => b.id === id)) throw new BusinessError('Bản sao lưu không tồn tại');
  backups = backups.filter((b) => b.id !== id);
}
