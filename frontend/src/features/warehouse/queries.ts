import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { getIngredient, getIngredientOptions, getIngredients, getStockCard } from '@/api/warehouse-ingredients';
import { getPriceHistory, getSupplier, getSuppliers } from '@/api/warehouse-suppliers';
import { getStockSummary, getWarehouseDashboard } from '@/api/warehouse-dashboard';
import type { IngredientFilter, StockCardFilter, StockSummaryFilter, SupplierFilter, WarehouseRange } from '@/types';

/** Khóa query của phân hệ Kho; mọi thao tác ghi đều invalidate wk.all để các màn hình luôn khớp nhau. */
export const wk = {
  all: ['kho'] as const,
  ingredients: ['kho', 'ingredients'] as const,
  suppliers: ['kho', 'suppliers'] as const,
  dashboard: ['kho', 'dashboard'] as const,
};

export const useIngredients = (f: IngredientFilter) =>
  useQuery({ queryKey: [...wk.ingredients, 'list', f], queryFn: () => getIngredients(f), placeholderData: keepPreviousData });
export const useIngredient = (id: string | undefined) =>
  useQuery({ queryKey: [...wk.ingredients, 'detail', id], queryFn: () => getIngredient(id!), enabled: Boolean(id), retry: false });
export const useIngredientOptions = () =>
  useQuery({ queryKey: [...wk.ingredients, 'options'], queryFn: getIngredientOptions, staleTime: 30_000 });
export const useStockCard = (id: string | undefined, f: StockCardFilter) =>
  useQuery({ queryKey: [...wk.ingredients, 'card', id, f], queryFn: () => getStockCard(id!, f), enabled: Boolean(id), placeholderData: keepPreviousData });

export const useSuppliers = (f: SupplierFilter) =>
  useQuery({ queryKey: [...wk.suppliers, 'list', f], queryFn: () => getSuppliers(f), placeholderData: keepPreviousData });
export const useSupplier = (id: string | undefined) =>
  useQuery({ queryKey: [...wk.suppliers, 'detail', id], queryFn: () => getSupplier(id!), enabled: Boolean(id), retry: false });
export const usePriceHistory = (linkId: string | null) =>
  useQuery({ queryKey: [...wk.suppliers, 'prices', linkId], queryFn: () => getPriceHistory(linkId!), enabled: Boolean(linkId) });

export const useWarehouseDashboard = (r: WarehouseRange) =>
  useQuery({ queryKey: [...wk.dashboard, r], queryFn: () => getWarehouseDashboard(r), placeholderData: keepPreviousData });
export const useStockSummary = (r: WarehouseRange, f: StockSummaryFilter, enabled: boolean) =>
  useQuery({ queryKey: [...wk.dashboard, 'summary', r, f], queryFn: () => getStockSummary(r, f), enabled, placeholderData: keepPreviousData });
