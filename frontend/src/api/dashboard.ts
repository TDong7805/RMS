import { api } from '@/lib/http';
import type { InventoryResponse, OverviewResponse, PeriodKey } from '@/types';

/**
 * Thống kê kho trong kỳ (cùng cách tính với Dashboard kho): GET /api/dashboard/inventory?period=
 * Chi phí nhập, phiếu chờ nhận, công nợ nhà cung cấp, nguyên liệu sắp hết / hết hàng.
 */
export function getInventoryStats(period: PeriodKey): Promise<InventoryResponse> {
  return api.get<InventoryResponse>('/api/dashboard/inventory', { period });
}

/** Mọi số liệu bán hàng của Dashboard (4 chỉ số, biểu đồ, cơ cấu doanh thu, giờ đông khách, số bán từng món): GET /api/dashboard/overview?period= */
export function getDashboardOverview(period: PeriodKey): Promise<OverviewResponse> {
  return api.get<OverviewResponse>('/api/dashboard/overview', { period });
}
