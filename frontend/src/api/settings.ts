import { api, http } from '@/lib/http';
import type { BackupFile, BackupSchedule, OpeningDay, RestaurantInfo } from '@/types';

/* ------------------------------------------------------------ Thông tin nhà hàng */

export const getRestaurantInfo = () => api.get<RestaurantInfo>('/api/settings/restaurant');

export const updateRestaurantInfo = (input: Omit<RestaurantInfo, 'updatedAt'>) =>
  api.put<RestaurantInfo>('/api/settings/restaurant', input);

/* ------------------------------------------------------------ Giờ hoạt động */

export const getOpeningHours = () => api.get<OpeningDay[]>('/api/settings/opening-hours');

/** Lỗi trả về theo khóa "day-{0..6}" và "general". */
export const updateOpeningHours = (input: OpeningDay[]) => api.put<OpeningDay[]>('/api/settings/opening-hours', input);

/* ------------------------------------------------------------ Sao lưu & phục hồi (dữ liệu thật) */

export const updateBackupSchedule = (input: BackupSchedule) =>
  api.put<BackupSchedule>('/api/settings/backup-schedule', input);

/** Lịch tự động + danh sách bản sao lưu (file .zip: dữ liệu + ảnh tải lên) trên máy chủ. */
export async function getBackups(): Promise<{ schedule: BackupSchedule; files: BackupFile[] }> {
  const [schedule, files] = await Promise.all([
    api.get<BackupSchedule>('/api/settings/backup-schedule'),
    api.get<BackupFile[]>('/api/backups'),
  ]);
  return { schedule, files };
}

/** POST /api/backups — sao lưu ngay. */
export function createBackup(): Promise<BackupFile> {
  return api.post<BackupFile>('/api/backups');
}

export interface RestoreResult {
  restoredFrom: string;
  /** Bản sao lưu dữ liệu ngay trước khi phục hồi — dùng để quay lại nếu phục hồi nhầm. */
  safetyBackup: BackupFile;
  tables: number;
  rows: number;
  uploads: number;
}

/**
 * POST /api/backups/{id}/restore. Máy chủ tự tạo bản an toàn trước, phục hồi trong một giao dịch (lỗi thì dữ liệu
 * giữ nguyên) và không ghi đè nhật ký hoạt động.
 */
export function restoreBackup(id: string): Promise<RestoreResult> {
  return api.post<RestoreResult>(`/api/backups/${encodeURIComponent(id)}/restore`);
}

/** GET /api/backups/{id}/download — file .zip. */
export async function downloadBackup(id: string): Promise<Blob> {
  const res = await http.get<Blob>(`/api/backups/${encodeURIComponent(id)}/download`, { responseType: 'blob', timeout: 120_000 });
  return res.data;
}

/** DELETE /api/backups/{id} */
export function deleteBackup(id: string): Promise<void> {
  return api.delete(`/api/backups/${encodeURIComponent(id)}`);
}
