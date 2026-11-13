import { api } from '@/lib/http';
import type {
  Paged,
  PurchaseCancelReason,
  PurchaseCloseReason,
  PurchaseOrderDetail,
  PurchaseOrderFilter,
  PurchaseOrderInput,
  PurchaseOrderRow,
} from '@/types';

const path = (id: string) => `/api/kho/purchase-orders/${encodeURIComponent(id)}`;

/** UC-KHO-12: phiếu tạo gần nhất ở trên; status=waiting gồm Chưa nhận + Nhận một phần. */
export function getPurchaseOrders(f: PurchaseOrderFilter): Promise<Paged<PurchaseOrderRow>> {
  return api.get<Paged<PurchaseOrderRow>>('/api/kho/purchase-orders', { ...f });
}

/** Phiếu đang chờ nhận — chọn phiếu ở trang "Nhận hàng theo phiếu mua". */
export function getWaitingPurchaseOrders(): Promise<PurchaseOrderRow[]> {
  return api.get<PurchaseOrderRow[]>('/api/kho/purchase-orders/waiting');
}

/** UC-KHO-14 */
export function getPurchaseOrder(id: string): Promise<PurchaseOrderDetail> {
  return api.get<PurchaseOrderDetail>(path(id));
}

export type PurchaseAction = 'draft' | 'order';

/** UC-KHO-13: Lưu nháp (chỉ cần NCC + tên phiếu) hoặc Đặt hàng (kiểm tra đủ). Lỗi dòng: lines.{i}.{trường}. */
export function createPurchaseOrder(input: PurchaseOrderInput, action: PurchaseAction): Promise<PurchaseOrderRow> {
  return api.post<PurchaseOrderRow>(`/api/kho/purchase-orders?action=${action}`, input);
}

/** UC-KHO-15: chỉ phiếu Nháp; mã phiếu không đổi. */
export function updatePurchaseOrder(id: string, input: PurchaseOrderInput, action: PurchaseAction): Promise<PurchaseOrderRow> {
  return api.put<PurchaseOrderRow>(`${path(id)}?action=${action}`, input);
}

export function deletePurchaseDraft(id: string): Promise<void> {
  return api.delete(path(id));
}

/** UC-KHO-16: hủy khi Chưa nhận. */
export function cancelPurchaseOrder(id: string, reason: PurchaseCancelReason | '', note: string): Promise<PurchaseOrderRow> {
  return api.patch<PurchaseOrderRow>(`${path(id)}/cancel`, { reason, note });
}

/** UC-KHO-16: kết thúc nhận hàng khi Nhận một phần. */
export function closePurchaseOrder(id: string, reason: PurchaseCloseReason | '', note: string): Promise<PurchaseOrderRow> {
  return api.patch<PurchaseOrderRow>(`${path(id)}/close`, { reason, note });
}
