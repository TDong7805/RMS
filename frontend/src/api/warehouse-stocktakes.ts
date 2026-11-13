import { api } from '@/lib/http';
import type { Paged, StocktakeCreateInput, StocktakeDetail, StocktakeFilter, StocktakeLine, StocktakeLineInput, StocktakeRow, StocktakeStatus } from '@/types';

const path = (id: string) => `/api/kho/stocktakes/${encodeURIComponent(id)}`;

/** UC-KHO-22 */
export function getStocktakes(f: StocktakeFilter): Promise<Paged<StocktakeRow>> {
  return api.get<Paged<StocktakeRow>>('/api/kho/stocktakes', { ...f });
}

export function getStocktake(id: string): Promise<StocktakeDetail> {
  return api.get<StocktakeDetail>(path(id));
}

/** UC-KHO-23: tạo phiếu nháp theo phạm vi; nguyên liệu đang nằm trong phiếu mở khác bị bỏ ra (message). */
export function createStocktake(input: StocktakeCreateInput): Promise<StocktakeDetail> {
  return api.post<StocktakeDetail>('/api/kho/stocktakes', input);
}

/** Tự lưu một dòng khi đếm; đổi SL thực tế thì máy chủ chốt lại tồn sổ sách + thời điểm đếm. */
export function saveStocktakeLine(id: string, lineId: string, input: StocktakeLineInput): Promise<StocktakeLine> {
  return api.put<StocktakeLine>(`${path(id)}/lines/${encodeURIComponent(lineId)}`, input);
}

export function addStocktakeLine(id: string, ingredientId: string): Promise<StocktakeDetail> {
  return api.post<StocktakeDetail>(`${path(id)}/lines`, { ingredientId });
}

export function removeStocktakeLine(id: string, lineId: string): Promise<StocktakeDetail> {
  return api.delete(`${path(id)}/lines/${encodeURIComponent(lineId)}`) as unknown as Promise<StocktakeDetail>;
}

/** "Khớp sổ sách" cho mọi dòng chưa đếm. */
export function matchAllStocktake(id: string): Promise<StocktakeDetail> {
  return api.post<StocktakeDetail>(`${path(id)}/match-all`);
}

/** Gửi duyệt; không có chênh lệch thì phiếu thành "Hoàn tất (khớp sổ sách)". Lỗi dòng: lines.{lineId}.{trường}. */
export function submitStocktake(id: string): Promise<StocktakeDetail> {
  return api.post<StocktakeDetail>(`${path(id)}/submit`);
}

export function deleteStocktakeDraft(id: string): Promise<void> {
  return api.delete(path(id));
}

/** Hủy phiếu bị từ chối (lý do ≥ 5 ký tự). */
export function cancelStocktake(id: string, reason: string): Promise<StocktakeDetail> {
  return api.patch<StocktakeDetail>(`${path(id)}/cancel`, { reason });
}

/* ---------------------------------------------------------------- Khu Quản lý nhà hàng (UC-KHO-24) */

const approval = (id: string) => `/api/stocktake-approvals/${encodeURIComponent(id)}`;

export function getStocktakeApprovals(status: StocktakeStatus | 'all', page: number): Promise<Paged<StocktakeRow>> {
  return api.get<Paged<StocktakeRow>>('/api/stocktake-approvals', { status, page });
}

export function getStocktakeForApproval(id: string): Promise<StocktakeDetail> {
  return api.get<StocktakeDetail>(approval(id));
}

/** Duyệt: điều chỉnh tồn theo chênh lệch (tất cả hoặc không gì). */
export function approveStocktake(id: string): Promise<StocktakeDetail> {
  return api.patch<StocktakeDetail>(`${approval(id)}/approve`);
}

export function rejectStocktake(id: string, reason: string): Promise<StocktakeDetail> {
  return api.patch<StocktakeDetail>(`${approval(id)}/reject`, { reason });
}
