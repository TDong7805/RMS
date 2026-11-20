import { api } from '@/lib/http';
import type { SendLine } from '@/api/ordering';
import type { CashierFloor, CashierOrderDetail, MoveTarget, OrderView, QrMenu, RequestList, ServiceRequest } from '@/types';

/*
 * Khu Nhân viên phục vụ — backend com.rms.waiter.WaiterController (/api/phuc-vu/**).
 * Thao tác bàn dùng chung nghiệp vụ với Thu ngân (CashierService), kết quả cùng kiểu dữ liệu.
 */

const pv = (path: string) => `/api/phuc-vu/${path}`;
const enc = encodeURIComponent;

/** floor: sơ đồ (không có doanh thu); myAreaIds: khu được gán trong ca hiện tại; dutyLabel: "Ca sáng 06:00–14:00 · Tầng 1". */
export interface WaiterFloor {
  floor: CashierFloor;
  myAreaIds: string[];
  dutyLabel: string | null;
}

export const WAITER_STREAM = '/api/phuc-vu/stream';
export const WAITER_KEYS = {
  all: ['phuc-vu'] as const,
  floor: ['phuc-vu', 'floor'] as const,
  order: (id: string) => ['phuc-vu', 'order', id] as const,
  requests: (status: string) => ['phuc-vu', 'requests', status] as const,
  menu: ['phuc-vu', 'menu'] as const,
};

export const getWaiterFloor = () => api.get<WaiterFloor>(pv('floor'));
export const getWaiterOrder = (id: string) => api.get<CashierOrderDetail>(pv(`orders/${enc(id)}`));

export const waiterOpenTable = (tableId: string, guests: number | null, reservationId?: string) =>
  api.post<CashierOrderDetail>(pv(`tables/${enc(tableId)}/open`), { guests, reservationId: reservationId ?? null });
export const waiterCloseTable = (orderId: string) => api.post<CashierOrderDetail>(pv(`orders/${enc(orderId)}/close`));
export const waiterSetGuests = (orderId: string, guests: number | null) =>
  api.post<CashierOrderDetail>(pv(`orders/${enc(orderId)}/guests`), { guests });

export const waiterMoveTargets = () => api.get<MoveTarget[]>(pv('move-targets'));
export const waiterMove = (orderId: string, tableId: string) => api.post<CashierOrderDetail>(pv(`orders/${enc(orderId)}/move`), { tableId });
export const waiterMergeTargets = () => api.get<MoveTarget[]>(pv('merge-targets'));
export const waiterMerge = (orderId: string, tableId: string) => api.post<CashierOrderDetail>(pv(`orders/${enc(orderId)}/merge`), { tableId });

export const getWaiterMenu = () => api.get<QrMenu>(pv('menu'));
/** Gọi món hộ khách (giỏ món như trang QR). Bàn phải đã mở. */
export const waiterSendItems = (tableId: string, items: SendLine[]) => api.post<OrderView>(pv(`tables/${enc(tableId)}/items`), { items });
/** Món Đã xong → Đã mang ra. */
export const waiterServe = (ids: string[]) => api.post<WaiterFloor>(pv('serve'), { ids });

export const getWaiterRequests = (status: 'waiting' | 'done' | 'cancelled') => api.get<RequestList>(pv('requests'), { status });
export const acceptRequest = (id: string) => api.post<ServiceRequest>(pv(`requests/${enc(id)}/accept`));
export const finishRequest = (id: string) => api.post<ServiceRequest>(pv(`requests/${enc(id)}/done`));
export const dropRequest = (id: string) => api.post<ServiceRequest>(pv(`requests/${enc(id)}/cancel`));
