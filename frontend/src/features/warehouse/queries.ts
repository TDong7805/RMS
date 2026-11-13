import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { getIngredient, getIngredientOptions, getIngredients, getStockCard } from '@/api/warehouse-ingredients';
import { getPriceHistory, getSupplier, getSupplierOptions, getSuppliers } from '@/api/warehouse-suppliers';
import { getStockSummary, getWarehouseDashboard } from '@/api/warehouse-dashboard';
import { getPurchaseOrder, getPurchaseOrders, getWaitingPurchaseOrders } from '@/api/warehouse-purchases';
import { getReceipt, getReceipts } from '@/api/warehouse-receipts';
import { getIssue, getIssues, getWarehouseEmployees } from '@/api/warehouse-issues';
import { getStocktake, getStocktakeApprovals, getStocktakeForApproval, getStocktakes } from '@/api/warehouse-stocktakes';
import { getDebt, getDebts } from '@/api/warehouse-debts';
import type { DebtFilter, IngredientFilter, IssueFilter, PurchaseOrderFilter, ReceiptFilter, StockCardFilter, StocktakeFilter, StocktakeStatus, StockSummaryFilter, SupplierFilter, WarehouseRange } from '@/types';

/** Khóa query của phân hệ Kho; mọi thao tác ghi đều invalidate wk.all để các màn hình luôn khớp nhau. */
export const wk = {
  all: ['kho'] as const,
  ingredients: ['kho', 'ingredients'] as const,
  suppliers: ['kho', 'suppliers'] as const,
  dashboard: ['kho', 'dashboard'] as const,
  purchases: ['kho', 'purchases'] as const,
  receipts: ['kho', 'receipts'] as const,
  issues: ['kho', 'issues'] as const,
  stocktakes: ['kho', 'stocktakes'] as const,
  debts: ['kho', 'debts'] as const,
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
export const useSupplierOptions = () =>
  useQuery({ queryKey: [...wk.suppliers, 'options'], queryFn: getSupplierOptions, staleTime: 30_000 });
export const usePriceHistory = (linkId: string | null) =>
  useQuery({ queryKey: [...wk.suppliers, 'prices', linkId], queryFn: () => getPriceHistory(linkId!), enabled: Boolean(linkId) });

export const useWarehouseDashboard = (r: WarehouseRange) =>
  useQuery({ queryKey: [...wk.dashboard, r], queryFn: () => getWarehouseDashboard(r), placeholderData: keepPreviousData });
export const useStockSummary = (r: WarehouseRange, f: StockSummaryFilter, enabled: boolean) =>
  useQuery({ queryKey: [...wk.dashboard, 'summary', r, f], queryFn: () => getStockSummary(r, f), enabled, placeholderData: keepPreviousData });

export const usePurchaseOrders = (f: PurchaseOrderFilter) =>
  useQuery({ queryKey: [...wk.purchases, 'list', f], queryFn: () => getPurchaseOrders(f), placeholderData: keepPreviousData });
export const useWaitingPurchaseOrders = () =>
  useQuery({ queryKey: [...wk.purchases, 'waiting'], queryFn: getWaitingPurchaseOrders });
export const usePurchaseOrder = (id: string | undefined) =>
  useQuery({ queryKey: [...wk.purchases, 'detail', id], queryFn: () => getPurchaseOrder(id!), enabled: Boolean(id), retry: false });

export const useReceipts = (f: ReceiptFilter, enabled = true) =>
  useQuery({ queryKey: [...wk.receipts, 'list', f], queryFn: () => getReceipts(f), enabled, placeholderData: keepPreviousData });
export const useReceipt = (id: string | undefined) =>
  useQuery({ queryKey: [...wk.receipts, 'detail', id], queryFn: () => getReceipt(id!), enabled: Boolean(id), retry: false });

export const useIssues = (f: IssueFilter, enabled = true) =>
  useQuery({ queryKey: [...wk.issues, 'list', f], queryFn: () => getIssues(f), enabled, placeholderData: keepPreviousData });
export const useIssue = (id: string | undefined) =>
  useQuery({ queryKey: [...wk.issues, 'detail', id], queryFn: () => getIssue(id!), enabled: Boolean(id), retry: false });
export const useWarehouseEmployees = () =>
  useQuery({ queryKey: [...wk.issues, 'employees'], queryFn: getWarehouseEmployees, staleTime: 60_000 });

export const useStocktakes = (f: StocktakeFilter) =>
  useQuery({ queryKey: [...wk.stocktakes, 'list', f], queryFn: () => getStocktakes(f), placeholderData: keepPreviousData });
export const useStocktake = (id: string | undefined) =>
  useQuery({ queryKey: [...wk.stocktakes, 'detail', id], queryFn: () => getStocktake(id!), enabled: Boolean(id), retry: false });
export const useStocktakeApprovals = (status: StocktakeStatus | 'all', page: number) =>
  useQuery({ queryKey: [...wk.stocktakes, 'approvals', status, page], queryFn: () => getStocktakeApprovals(status, page), placeholderData: keepPreviousData });
export const useStocktakeForApproval = (id: string | undefined) =>
  useQuery({ queryKey: [...wk.stocktakes, 'approval', id], queryFn: () => getStocktakeForApproval(id!), enabled: Boolean(id), retry: false });

export const useDebts = (f: DebtFilter, manager = false) =>
  useQuery({ queryKey: [...wk.debts, 'list', manager, f], queryFn: () => getDebts(f, manager), placeholderData: keepPreviousData });
export const useDebt = (supplierId: string | undefined, manager = false) =>
  useQuery({ queryKey: [...wk.debts, 'detail', manager, supplierId], queryFn: () => getDebt(supplierId!, manager), enabled: Boolean(supplierId), retry: false });
