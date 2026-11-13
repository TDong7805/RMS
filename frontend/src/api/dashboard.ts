import { buildRevenueResponse, buildTopDishesResponse } from '@/mocks/dashboard';
import { api } from '@/lib/http';
import type { InventoryResponse, PeriodKey, RevenueResponse, TopDishesResponse } from '@/types';

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * [BACKEND-TODO] Doanh thu theo mốc thời gian: hiện dùng dữ liệu giả ở src/mocks/dashboard.ts.
 * Khi có backend: thay thân hàm getDashboardRevenue bằng gọi API
 * GET /api/dashboard/revenue?period={period}, giữ nguyên kiểu trả về RevenueResponse.
 * Response đã chứa sẵn số liệu kỳ trước nên bật/tắt so sánh không cần gọi lại máy chủ.
 */
export async function getDashboardRevenue(period: PeriodKey): Promise<RevenueResponse> {
  await delay(560);
  return buildRevenueResponse(period, false);
}

/**
 * Thống kê kho trong kỳ (cùng cách tính với Dashboard kho): GET /api/dashboard/inventory?period=
 * Chi phí nhập, phiếu chờ nhận, công nợ nhà cung cấp, nguyên liệu sắp hết / hết hàng.
 */
export function getInventoryStats(period: PeriodKey): Promise<InventoryResponse> {
  return api.get<InventoryResponse>('/api/dashboard/inventory', { period });
}

/**
 * [BACKEND-TODO] Món bán chạy / bán chậm trong kỳ: hiện dùng dữ liệu giả ở src/mocks/dashboard.ts.
 * Khi có backend: thay thân hàm getTopDishes bằng gọi API
 * GET /api/dashboard/top-dishes?period={period}, giữ nguyên kiểu trả về TopDishesResponse.
 */
export async function getTopDishes(period: PeriodKey): Promise<TopDishesResponse> {
  await delay(660);
  return buildTopDishesResponse(period);
}