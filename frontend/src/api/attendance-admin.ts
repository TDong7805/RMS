import { api } from '@/lib/http';

/*
 * Chấm công khuôn mặt — phía Quản lý nhà hàng (backend com.rms.selfservice.AttendanceAdminController).
 * Ảnh khuôn mặt / ảnh chấm công chỉ xem qua API có kiểm quyền (thẻ <img> gửi kèm cookie phiên).
 */

export type FaceReviewStatus = 'pending' | 'approved' | 'rejected';

export interface FaceRow {
  id: string;
  userId: string;
  fullName: string;
  username: string;
  roleName: string;
  status: FaceReviewStatus;
  createdAt: string;
  consentAt: string;
  reviewedName: string | null;
  reviewedAt: string | null;
  rejectReason: string | null;
}

export interface AttendanceSettings {
  /** IP / dải mạng WiFi quán, cách nhau dấu phẩy; trống = không kiểm tra. */
  allowedNetworks: string;
  earlyMinutes: number;
  faceThreshold: number;
  photoRetentionDays: number;
  /** IP của máy đang mở trang (để bấm "Dùng IP hiện tại"). */
  currentIp: string;
}

const base = import.meta.env.VITE_API_BASE_URL ?? '';

export const FACE_KEYS = { list: (status: string) => ['faces', status] as const, all: ['faces'] as const };
export const ATTENDANCE_SETTINGS_KEY = ['settings', 'attendance'] as const;

export const getFaces = (status: FaceReviewStatus | 'all') => api.get<FaceRow[]>('/api/faces', { status });
export const facePhotoUrl = (id: string) => `${base}/api/faces/${encodeURIComponent(id)}/photo`;
export const approveFace = (id: string) => api.post<FaceRow>(`/api/faces/${encodeURIComponent(id)}/approve`);
export const rejectFace = (id: string, reason: string) => api.post<FaceRow>(`/api/faces/${encodeURIComponent(id)}/reject`, { reason });
export const resetFace = (id: string) => api.delete(`/api/faces/${encodeURIComponent(id)}`);

export const getAttendanceSettings = () => api.get<AttendanceSettings>('/api/settings/attendance');
export const saveAttendanceSettings = (s: Omit<AttendanceSettings, 'currentIp'>) => api.put<AttendanceSettings>('/api/settings/attendance', s);

/** Ảnh chấm công (kind: in = vào ca, out = tan ca) — quản lý / thu ngân. */
export const attendancePhotoUrl = (id: string, kind: 'in' | 'out', area: 'manager' | 'cashier') =>
  `${base}${area === 'cashier' ? '/api/thu-ngan/attendance' : '/api/attendance'}/${encodeURIComponent(id)}/photo/${kind}`;
