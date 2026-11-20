import { api } from '@/lib/http';
import type { AttendanceRow, Payslip } from '@/types';

/*
 * "Thông tin của tôi" + chấm công khuôn mặt — Nhân viên phục vụ, Thu ngân, Nhân viên bếp
 * (backend com.rms.selfservice.SelfController, /api/toi/**).
 */

export interface MyShift {
  id: string;
  date: string;
  shiftName: string;
  /** ISO, giờ thực tế (ca qua đêm kết thúc hôm sau). */
  start: string;
  end: string;
  areaName: string | null;
  attended: boolean;
}

export interface MyProfile {
  id: string;
  username: string;
  fullName: string;
  email: string;
  phone: string;
  role: string;
  roleName: string;
  hourlyRate: number;
  createdAt: string;
}

export interface MyPayslipRow {
  periodId: string;
  name: string;
  startDate: string;
  endDate: string;
  closedAt: string | null;
  hours: number;
  total: number;
}

export type FaceState = 'none' | 'pending' | 'approved' | 'rejected';

export interface FaceStatus {
  status: FaceState;
  rejectReason: string | null;
  createdAt: string | null;
  reviewedAt: string | null;
}

export interface DutyBrief {
  assignmentId: string;
  shiftName: string;
  start: string;
  end: string;
  areaName: string | null;
}

/** Màn hình chấm công: current = ca đang cho vào (chưa chấm); open = lần vào ca chưa tan. */
export interface ClockStatus {
  ip: string;
  networkChecked: boolean;
  networkOk: boolean;
  face: FaceStatus;
  threshold: number;
  current: DutyBrief | null;
  next: DutyBrief | null;
  open: { id: string; checkIn: string; shiftName: string | null; lateMinutes: number | null } | null;
  recent: { id: string; date: string; checkIn: string; checkOut: string | null; lateMinutes: number | null; earlyMinutes: number | null; source: string }[];
}

/** Kết quả camera: mã khuôn mặt 128 số (face-api) + ảnh JPEG (data URL) + đã qua bước người thật. */
export interface FaceCapture {
  descriptor: number[];
  photo: string;
  liveness: boolean;
}

export const SELF_KEYS = {
  all: ['toi'] as const,
  shifts: (from: string, to: string) => ['toi', 'shifts', from, to] as const,
  profile: ['toi', 'profile'] as const,
  clock: ['toi', 'clock'] as const,
  attendance: (from: string, to: string) => ['toi', 'attendance', from, to] as const,
  payslips: ['toi', 'payslips'] as const,
};

export const getMyShifts = (from: string, to: string) => api.get<MyShift[]>('/api/toi/shifts', { from, to });
export const getMyProfile = () => api.get<MyProfile>('/api/toi/profile');
export const updateMyProfile = (body: { email: string; phone: string }) => api.put<MyProfile>('/api/toi/profile', body);
export const getMyAttendance = (from: string, to: string) => api.get<AttendanceRow[]>('/api/toi/attendance', { from, to });
export const myAttendancePhotoUrl = (id: string, kind: 'in' | 'out') => `${import.meta.env.VITE_API_BASE_URL ?? ''}/api/toi/attendance/${encodeURIComponent(id)}/photo/${kind}`;
export const getMyPayslips = () => api.get<MyPayslipRow[]>('/api/toi/payslips');
export const getMyPayslip = (periodId: string) => api.get<Payslip>(`/api/toi/payslips/${encodeURIComponent(periodId)}`);

export const getClock = () => api.get<ClockStatus>('/api/toi/clock');
export const clockIn = (c: FaceCapture) => api.post<ClockStatus>('/api/toi/clock/in', c);
export const clockOut = (c: FaceCapture) => api.post<ClockStatus>('/api/toi/clock/out', c);
export const enrollFace = (c: { descriptor: number[]; photo: string; consent: boolean }) => api.post<FaceStatus>('/api/toi/face', c);
export const myFacePhotoUrl = () => `${import.meta.env.VITE_API_BASE_URL ?? ''}/api/toi/face/photo`;
