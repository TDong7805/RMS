import { useQuery } from '@tanstack/react-query';
import { getDashboardRevenue, getInventoryStats, getTopDishes } from '@/api/dashboard';
import type { PeriodKey } from '@/types';

/** Mỗi khối dashboard có query key riêng theo mốc thời gian để tải độc lập. */
export const dashboardKeys = {
  revenue: (period: PeriodKey) => ['dashboard', 'revenue', period] as const,
  inventory: (period: PeriodKey) => ['dashboard', 'inventory', period] as const,
  topDishes: (period: PeriodKey) => ['dashboard', 'top-dishes', period] as const,
};

export function useRevenueQuery(period: PeriodKey) {
  return useQuery({
    queryKey: dashboardKeys.revenue(period),
    queryFn: () => getDashboardRevenue(period),
    staleTime: 60_000,
  });
}

export function useInventoryQuery(period: PeriodKey) {
  return useQuery({
    queryKey: dashboardKeys.inventory(period),
    queryFn: () => getInventoryStats(period),
    staleTime: 60_000,
  });
}

export function useTopDishesQuery(period: PeriodKey) {
  return useQuery({
    queryKey: dashboardKeys.topDishes(period),
    queryFn: () => getTopDishes(period),
    staleTime: 60_000,
  });
}