import { api } from '@/lib/http';
import { toDateKey } from '@/lib/mock';
import type { StockSummaryFilter, StockSummaryPage, WarehouseDashboard, WarehouseRange } from '@/types';

/** Kỳ thống kê → khoảng ngày (YYYY-MM-DD). */
export function rangeOf(r: WarehouseRange): { from: string; to: string } {
  const today = new Date();
  const shift = (days: number) => {
    const d = new Date(today);
    d.setDate(d.getDate() + days);
    return toDateKey(d);
  };
  switch (r.period) {
    case 'today':
      return { from: shift(0), to: shift(0) };
    case 'last7':
      return { from: shift(-6), to: shift(0) };
    case 'thisMonth':
      return { from: toDateKey(new Date(today.getFullYear(), today.getMonth(), 1)), to: shift(0) };
    default:
      return { from: r.from, to: r.to };
  }
}

/** UC-KHO-01: GET /api/kho/dashboard?from=&to= — khối "hiện tại" không phụ thuộc kỳ. */
export function getWarehouseDashboard(r: WarehouseRange): Promise<WarehouseDashboard> {
  return api.get<WarehouseDashboard>('/api/kho/dashboard', rangeOf(r));
}

/** Tab Nhập – xuất – tồn. */
export function getStockSummary(r: WarehouseRange, f: StockSummaryFilter): Promise<StockSummaryPage> {
  return api.get<StockSummaryPage>('/api/kho/stock-summary', { ...rangeOf(r), ...f });
}
