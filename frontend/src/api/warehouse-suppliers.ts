import { api } from '@/lib/http';
import type {
  Paged,
  PriceRecord,
  Supplier,
  SupplierDetail,
  SupplierFilter,
  SupplierInput,
  SupplierLink,
  SupplierLinkInput,
  SupplierOption,
  SupplierStopReason,
} from '@/types';

const path = (id: string) => `/api/kho/suppliers/${encodeURIComponent(id)}`;
const linkPath = (id: string) => `/api/kho/supplier-links/${encodeURIComponent(id)}`;

/** UC-KHO-07: GET /api/kho/suppliers?keyword=&status=&page= — tìm theo mã, tên, SĐT. */
export function getSuppliers(f: SupplierFilter): Promise<Paged<Supplier>> {
  return api.get<Paged<Supplier>>('/api/kho/suppliers', { ...f });
}

/** Ô chọn nhà cung cấp (bộ lọc, phiếu mua, nhập không phiếu), sắp theo mã. */
export function getSupplierOptions(): Promise<SupplierOption[]> {
  return api.get<SupplierOption[]>('/api/kho/suppliers/options');
}

/** UC-KHO-11: chi tiết kèm liên kết nguyên liệu và lịch sử trạng thái. */
export function getSupplier(id: string): Promise<SupplierDetail> {
  return api.get<SupplierDetail>(path(id));
}

/** Trùng tên chỉ cảnh báo (UC-KHO-08 / 09): form hỏi lại rồi vẫn cho lưu. */
export async function findSupplierByName(name: string, exceptId?: string): Promise<{ id: string; code: string; name: string } | null> {
  const res = await api.get<{ match: { id: string; code: string; name: string } | null }>('/api/kho/suppliers/name-check', {
    name,
    exceptId: exceptId ?? '',
  });
  return res.match;
}

/** Lịch sử giá nhập của một liên kết, mới nhất trước. */
export function getPriceHistory(linkId: string): Promise<PriceRecord[]> {
  return api.get<PriceRecord[]>(`${linkPath(linkId)}/prices`);
}

/** UC-KHO-08: lưu thông tin + các dòng nguyên liệu cung cấp cùng lúc (lỗi dòng: links.{i}.{trường}). */
export function createSupplier(input: SupplierInput): Promise<Supplier> {
  return api.post<Supplier>('/api/kho/suppliers', input);
}

/** UC-KHO-09: chỉ thông tin, không gồm liên kết. */
export function updateSupplier(id: string, input: SupplierInput): Promise<Supplier> {
  return api.put<Supplier>(path(id), { ...input, links: undefined });
}

/** UC-KHO-10: ngừng hoạt động (bắt buộc lý do; "Khác" bắt buộc ghi chú). */
export function stopSupplier(id: string, reason: SupplierStopReason | '', note: string): Promise<Supplier> {
  return api.patch<Supplier>(`${path(id)}/stop`, { reason, note });
}

export function activateSupplier(id: string): Promise<Supplier> {
  return api.patch<Supplier>(`${path(id)}/activate`);
}

/** Chỉ xóa được khi chưa có phiếu mua nào (kể cả nháp). */
export function deleteSupplier(id: string): Promise<void> {
  return api.delete(path(id));
}

/* ---------------------------------------------------------------- Liên kết nguyên liệu (UC-KHO-11) */

export function addLink(supplierId: string, input: SupplierLinkInput): Promise<SupplierLink> {
  return api.post<SupplierLink>(`${path(supplierId)}/links`, input);
}

/** Đổi giá, quy cách (đơn vị mua, hệ số) hoặc SL tối thiểu — không đổi gì thì máy chủ trả nguyên trạng. */
export function updateLink(linkId: string, input: SupplierLinkInput): Promise<SupplierLink> {
  return api.put<SupplierLink>(linkPath(linkId), input);
}

/** Ngừng liên kết: giá hiện hành kết thúc hôm nay. */
export function stopLink(linkId: string): Promise<SupplierLink> {
  return api.patch<SupplierLink>(`${linkPath(linkId)}/stop`);
}

/** Kích hoạt lại: bắt buộc nhập giá mới. */
export function reactivateLink(linkId: string, input: SupplierLinkInput): Promise<SupplierLink> {
  return api.patch<SupplierLink>(`${linkPath(linkId)}/activate`, input);
}
