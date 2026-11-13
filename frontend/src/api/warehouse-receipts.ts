import { api } from '@/lib/http';
import type { DirectReceiptInput, ReceiptDetail, ReceiptFilter, ReceiptPage, ReceiveInput } from '@/types';

/** UC-KHO-19: lịch sử nhập kho, mặc định 30 ngày; totalValue không tính phiếu đã hủy. */
export function getReceipts(f: ReceiptFilter): Promise<ReceiptPage> {
  return api.get<ReceiptPage>('/api/kho/receipts', { ...f });
}

/** Chi tiết phiếu nhập, kèm canCancel / cannotCancelReason. */
export function getReceipt(id: string): Promise<ReceiptDetail> {
  return api.get<ReceiptDetail>(`/api/kho/receipts/${encodeURIComponent(id)}`);
}

/** UC-KHO-17: nhận hàng theo phiếu mua — tạo một phiếu nhập (tất cả hoặc không gì). */
export function receivePurchaseOrder(poId: string, input: ReceiveInput): Promise<ReceiptDetail> {
  return api.post<ReceiptDetail>(`/api/kho/purchase-orders/${encodeURIComponent(poId)}/receipts`, input);
}

/** UC-KHO-18: nhập kho không phiếu (không phát sinh công nợ). */
export function createDirectReceipt(input: DirectReceiptInput): Promise<ReceiptDetail> {
  return api.post<ReceiptDetail>('/api/kho/receipts/direct', input);
}

/** UC-KHO-19 (A): hủy phiếu nhập vừa lập — tồn, giá vốn, công nợ trở về như trước. */
export function cancelReceipt(id: string, reason: string): Promise<ReceiptDetail> {
  return api.patch<ReceiptDetail>(`/api/kho/receipts/${encodeURIComponent(id)}/cancel`, { reason });
}
