import { api } from '@/lib/http';
import type { CashierFloor, KitchenCancelReason, KitchenQueue, OrderView, QrMenu, QrTableInfo, SoldOutDish } from '@/types';

/* ---------------------------------------------------------------- Trang đặt món (công khai, nhận diện bàn bằng mã QR) */

const qr = (token: string) => `/api/public/qr/${encodeURIComponent(token)}`;

/** UC-KH-01: thông tin bàn, nhà hàng, đang trong giờ phục vụ, đơn đang mở của bàn. */
export function getQrTable(token: string): Promise<QrTableInfo> {
  return api.get<QrTableInfo>(qr(token));
}

/** UC-KH-02: món đang bán (cờ soldOut = tạm hết hôm nay). */
export function getQrMenu(token: string): Promise<QrMenu> {
  return api.get<QrMenu>(`${qr(token)}/menu`);
}

export async function getQrOrder(token: string): Promise<OrderView | null> {
  return (await api.get<{ order: OrderView | null }>(`${qr(token)}/order`)).order;
}

/** UC-KH-03: gửi giỏ món (tất cả hoặc không gì). */
export function sendQrOrder(token: string, items: { dishId: string; qty: number; note: string }[]): Promise<OrderView> {
  return api.post<OrderView>(`${qr(token)}/orders`, { items });
}

/** UC-KH-04: hủy món còn Chờ chế biến. */
export function cancelQrItem(token: string, itemId: string): Promise<OrderView> {
  return api.post<OrderView>(`${qr(token)}/items/${encodeURIComponent(itemId)}/cancel`);
}

export const qrStreamUrl = (token: string) => `${qr(token)}/stream`;

/* ---------------------------------------------------------------- Bếp */

export function getKitchenQueue(): Promise<KitchenQueue> {
  return api.get<KitchenQueue>('/api/bep/queue');
}

export function startItems(ids: string[]): Promise<KitchenQueue> {
  return api.post<KitchenQueue>('/api/bep/items/start', { ids });
}

export function completeItems(ids: string[]): Promise<KitchenQueue> {
  return api.post<KitchenQueue>('/api/bep/items/complete', { ids });
}

export function undoItem(id: string): Promise<KitchenQueue> {
  return api.post<KitchenQueue>(`/api/bep/items/${encodeURIComponent(id)}/undo`);
}

export function kitchenCancelItem(id: string, reason: KitchenCancelReason, note: string, markSoldOut: boolean): Promise<KitchenQueue> {
  return api.post<KitchenQueue>(`/api/bep/items/${encodeURIComponent(id)}/cancel`, { reason, note, markSoldOut });
}

export function getKitchenOrder(orderId: string): Promise<OrderView> {
  return api.get<OrderView>(`/api/bep/orders/${encodeURIComponent(orderId)}`);
}

export function getSoldOutDishes(): Promise<SoldOutDish[]> {
  return api.get<SoldOutDish[]>('/api/bep/dishes');
}

export function setDishSoldOut(dishId: string, soldOut: boolean): Promise<SoldOutDish> {
  return api.patch<SoldOutDish>(`/api/bep/dishes/${encodeURIComponent(dishId)}/sold-out`, { soldOut });
}

export const KITCHEN_STREAM = '/api/bep/stream';

/* ---------------------------------------------------------------- Thu ngân */

export function getCashierFloor(): Promise<CashierFloor> {
  return api.get<CashierFloor>('/api/thu-ngan/floor');
}

export function getCashierOrder(id: string): Promise<OrderView> {
  return api.get<OrderView>(`/api/thu-ngan/orders/${encodeURIComponent(id)}`);
}

/** UC-TN-03: món Đã xong → Đã mang ra. */
export function serveItems(ids: string[]): Promise<OrderView> {
  return api.post<OrderView>('/api/thu-ngan/items/serve', { ids });
}

export const CASHIER_STREAM = '/api/thu-ngan/stream';
