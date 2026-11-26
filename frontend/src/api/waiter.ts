import { api } from '@/lib/http';
import type { SendLine } from '@/api/ordering';
import type { CashierFloor, CashierOrderDetail, MoveTarget, OrderView, QrMenu, RequestList, ServiceRequest } from '@/types';

/*
 * Khu Nhân viên phục vụ — backend com.rms.waiter.WaiterController (/api/phuc-vu/**).
 * Thao tác bàn dùng chung nghiệp vụ với Thu ngân (CashierService), kết quả cùng kiểu dữ liệu.
 */

const pv = (path: string) => `/api/phuc-vu/${path}`;
const enc = encodeURIComponent;

/**
 * floor: sơ đồ (không có doanh thu); myAreaIds: khu của ca đang làm; dutyLabel: "Ca sáng 06:00–14:00 · Tầng 1".
 * onShift: giờ này có ca theo lịch phân công (D15: không còn khóa theo chấm công). dutyLabel: ca đang diễn ra;
 * nextLabel: ca kế tiếp khi đang ngoài ca. confirmCount: số bàn có món chờ mình xác nhận.
 */
export interface WaiterFloor {
  floor: CashierFloor;
  myAreaIds: string[];
  dutyLabel: string | null;
  onShift: boolean;
  nextLabel: string | null;
  confirmCount: number;
}

/** Một bàn có món khách gửi đang chờ xác nhận (gộp mọi lượt chưa xác nhận). overdue = chờ quá N phút. */
export interface PendingConfirm {
  orderId: string;
  orderCode: string;
  tableId: string;
  tableCode: string;
  areaId: string;
  areaName: string;
  since: string;
  waitingMinutes: number;
  overdue: boolean;
  items: { itemId: string; name: string; qty: number; note: string; setId: string | null; setName: string | null; price: number }[];
}

export interface PendingConfirmList {
  items: PendingConfirm[];
  count: number;
  remindMinutes: number;
}

export const WAITER_STREAM = '/api/phuc-vu/stream';
export const WAITER_KEYS = {
  all: ['phuc-vu'] as const,
  floor: ['phuc-vu', 'floor'] as const,
  order: (id: string) => ['phuc-vu', 'order', id] as const,
  requests: (status: string) => ['phuc-vu', 'requests', status] as const,
  menu: ['phuc-vu', 'menu'] as const,
  confirmations: ['phuc-vu', 'confirmations'] as const,
};

export const getConfirmations = () => api.get<PendingConfirmList>(pv('confirmations'));
/** Xác nhận mọi món đang chờ của đơn → bếp; rejects: món bị bỏ kèm lý do (khách thấy lý do). */
export const confirmOrder = (orderId: string, rejects: { itemId: string; reason: string }[] = []) =>
  api.post<OrderView>(pv(`orders/${enc(orderId)}/confirm`), { rejects });

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

export const getWaiterRequests = (status: 'waiting' | 'done' | 'cancelled') => api.get<RequestList>(pv('requests'), { status });
export const acceptRequest = (id: string) => api.post<ServiceRequest>(pv(`requests/${enc(id)}/accept`));
export const finishRequest = (id: string) => api.post<ServiceRequest>(pv(`requests/${enc(id)}/done`));
export const dropRequest = (id: string) => api.post<ServiceRequest>(pv(`requests/${enc(id)}/cancel`));
