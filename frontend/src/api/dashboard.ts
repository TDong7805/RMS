import { api } from '@/lib/http';
import type { InventoryResponse, PeriodKey, RevenueResponse, TopDishesResponse } from '@/types';

/**
 * Doanh thu theo mốc thời gian, tính từ hóa đơn đã thanh toán: GET /api/dashboard/revenue?period=
 * Response đã chứa sẵn số liệu kỳ trước nên bật/tắt so sánh không cần gọi lại máy chủ.
 */
export function getDashboardRevenue(period: PeriodKey): Promise<RevenueResponse> {
  return api.get<RevenueResponse>('/api/dashboard/revenue', { period });
}

/**
 * Thống kê kho trong kỳ (cùng cách tính với Dashboard kho): GET /api/dashboard/inventory?period=
 * Chi phí nhập, phiếu chờ nhận, công nợ nhà cung cấp, nguyên liệu sắp hết / hết hàng.
 */
export function getInventoryStats(period: PeriodKey): Promise<InventoryResponse> {
  return api.get<InventoryResponse>('/api/dashboard/inventory', { period });
}

/** 5 món bán chạy / 5 món bán chậm trong kỳ (theo số lượng trên hóa đơn đã thanh toán): GET /api/dashboard/top-dishes?period= */
export function getTopDishes(period: PeriodKey): Promise<TopDishesResponse> {
  return api.get<TopDishesResponse>('/api/dashboard/top-dishes', { period });
}
