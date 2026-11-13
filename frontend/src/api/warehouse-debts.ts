import { api } from '@/lib/http';
import type { DebtDetail, DebtFilter, DebtPage, PaymentInput, SupplierPayment } from '@/types';

/** Khu Kho dùng /api/kho/debts; Quản lý nhà hàng (chỉ xem) dùng /api/supplier-debts. */
const base = (manager: boolean) => (manager ? '/api/supplier-debts' : '/api/kho/debts');

/** UC-KHO-25: sắp theo còn nợ giảm dần, kèm thẻ tổng. */
export function getDebts(f: DebtFilter, manager = false): Promise<DebtPage> {
  return api.get<DebtPage>(base(manager), { ...f });
}

export function getDebt(supplierId: string, manager = false): Promise<DebtDetail> {
  return api.get<DebtDetail>(`${base(manager)}/${encodeURIComponent(supplierId)}`);
}

/** UC-KHO-26: không vượt số còn nợ của phiếu; ngày thanh toán 7 ngày trước → hôm nay. */
export function createPayment(input: PaymentInput): Promise<SupplierPayment> {
  return api.post<SupplierPayment>('/api/kho/payments', input);
}

export function cancelPayment(id: string, reason: string): Promise<SupplierPayment> {
  return api.patch<SupplierPayment>(`/api/kho/payments/${encodeURIComponent(id)}/cancel`, { reason });
}
