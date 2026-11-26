import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { getDashboardOverview, getInventoryStats } from '@/api/dashboard';
import type { PeriodKey } from '@/types';

export const dashboardKeys = {
  overview: (period: PeriodKey) => ['dashboard', 'overview', period] as const,
  inventory: (period: PeriodKey) => ['dashboard', 'inventory', period] as const,
};

/** Đổi kỳ thì giữ số liệu cũ (mờ nhẹ) tới khi có số mới, không nháy trắng. */
export function useOverviewQuery(period: PeriodKey) {
  return useQuery({
    queryKey: dashboardKeys.overview(period),
    queryFn: () => getDashboardOverview(period),
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  });
}

export function useInventoryOverviewQuery(period: PeriodKey) {
  return useQuery({
    queryKey: dashboardKeys.inventory(period),
    queryFn: () => getInventoryStats(period),
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  });
}
