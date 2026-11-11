import { api } from '@/lib/http';
import { timeToMinutes } from '@/lib/mock';
import type { Employee, Shift, ShiftAssignment, ShiftInput } from '@/types';

/**
 * GET /api/employees?from=&to= — nhân viên cho lịch phân công (cùng nguồn bảng users với trang Tài khoản):
 * người đang hoạt động + người đã khóa / đã nghỉ nhưng có ca trong khoảng ngày (để lịch cũ vẫn đủ).
 */
export function getEmployees(from: string, to: string): Promise<Employee[]> {
  return api.get<Employee[]>('/api/employees', { from, to });
}

/** Số giờ của ca; ca qua đêm (kết thúc ≤ bắt đầu) được cộng 24h. */
export function shiftHours(s: Pick<Shift, 'startTime' | 'endTime'>): number {
  const start = timeToMinutes(s.startTime);
  let end = timeToMinutes(s.endTime);
  if (end <= start) end += 1440;
  return (end - start) / 60;
}

/** GET /api/shifts — theo giờ bắt đầu, kèm số lượt phân công. */
export function getShifts(): Promise<(Shift & { assignmentCount: number })[]> {
  return api.get<(Shift & { assignmentCount: number })[]>('/api/shifts');
}

/** POST /api/shifts — 422 "Dữ liệu bị trùng lặp" nếu trùng tên hoặc khung giờ với ca khác. */
export function createShift(input: ShiftInput): Promise<Shift> {
  return api.post<Shift>('/api/shifts', input);
}

/** PUT /api/shifts/{id} — đổi giờ không được làm nhân viên đã phân công bị trùng lịch. */
export function updateShift(id: string, input: ShiftInput): Promise<Shift> {
  return api.put<Shift>(`/api/shifts/${encodeURIComponent(id)}`, input);
}

/** DELETE /api/shifts/{id} — 409 "Không thể xóa ca làm việc này" nếu đã có phân công. */
export function deleteShift(id: string): Promise<void> {
  return api.delete(`/api/shifts/${encodeURIComponent(id)}`);
}

/* ------------------------------------------------------------ Phân công */

/** GET /api/shift-assignments?from=&to= (YYYY-MM-DD). */
export function getAssignments(from: string, to: string): Promise<ShiftAssignment[]> {
  return api.get<ShiftAssignment[]>('/api/shift-assignments', { from, to });
}

/**
 * POST /api/shift-assignments { employeeId, shiftId, dates[] }.
 * Máy chủ chặn trùng lịch theo giờ thực tế (ca qua đêm chồng sang sáng hôm sau cũng tính) và ngày đã qua.
 */
export function assignShift(employeeId: string, shiftId: string, dates: string[]): Promise<ShiftAssignment[]> {
  return api.post<ShiftAssignment[]>('/api/shift-assignments', { employeeId, shiftId, dates });
}

/** DELETE /api/shift-assignments/{id} — không hủy được phân công của ngày đã qua. */
export function unassignShift(id: string): Promise<void> {
  return api.delete(`/api/shift-assignments/${encodeURIComponent(id)}`);
}
