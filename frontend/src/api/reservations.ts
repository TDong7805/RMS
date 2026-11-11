import { api } from '@/lib/http';
import type {
  Paged,
  Reservation,
  ReservationFilter,
  ReservationFormConfig,
  ReservationInput,
  ReservationStatus,
} from '@/types';

export const RESERVATION_PAGE_SIZE = 10;

/** Tìm theo tên khách / SĐT / mã đặt; lọc theo ngày, khu vực, trạng thái. */
export const getReservations = (filter: ReservationFilter) =>
  api.get<Paged<Reservation>>('/api/reservations', { ...filter });

/** Máy chủ trả 404 "Nội dung này không còn tồn tại" nếu bản ghi đã bị xóa. */
export const getReservation = (id: string) => api.get<Reservation>(`/api/reservations/${id}`);

/** 422 kèm lỗi từng trường khi không hợp lệ (sức chứa, trùng lịch, giờ hoạt động…). */
export const updateReservation = (id: string, input: ReservationInput) =>
  api.put<Reservation>(`/api/reservations/${id}`, input);

const NEXT_STATUS: Record<ReservationStatus, ReservationStatus[]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['seated', 'cancelled', 'no_show'],
  seated: ['completed'],
  completed: [],
  cancelled: [],
  no_show: [],
};

/** Chỉ để hiển thị nút; máy chủ vẫn kiểm tra lại (ReservationRules.NEXT_STATUS). */
export function allowedNextStatuses(status: ReservationStatus): ReservationStatus[] {
  return NEXT_STATUS[status];
}

export const setReservationStatus = (id: string, status: ReservationStatus) =>
  api.patch<Reservation>(`/api/reservations/${id}/status`, { status });

/** Thống kê nhanh đầu trang: lịch hôm nay, chờ xác nhận, số khách hôm nay. */
export const getReservationSummary = () =>
  api.get<{ today: number; pending: number; guestsToday: number }>('/api/reservations/summary');

/* ------------------------------------------------------------ Cấu hình form đặt bàn */

export const getReservationFormConfig = () => api.get<ReservationFormConfig>('/api/reservations/form-config');

export const updateReservationFormConfig = (input: Omit<ReservationFormConfig, 'updatedAt'>) =>
  api.put<ReservationFormConfig>('/api/reservations/form-config', input);
