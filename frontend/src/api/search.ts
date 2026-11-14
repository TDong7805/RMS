import {
  pageSuggestions,
  recentPagePaths,
  warehousePageSuggestions,
  warehouseRecentPaths,
  cashierPageSuggestions,
  cashierRecentPaths,
} from '@/mocks/notifications';
import { matchesKeyword } from '@/lib/normalize';
import type { AreaKey } from '@/lib/areas';
import type { PageSuggestion } from '@/types';

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const PAGES: Record<AreaKey, PageSuggestion[]> = { manager: pageSuggestions, warehouse: warehousePageSuggestions, cashier: cashierPageSuggestions };

/** Bản ghi "đã truy cập gần đây" trong bộ nhớ, mô phỏng lịch sử của một tài khoản (mỗi khu một danh sách). */
const recent: Record<AreaKey, string[]> = { manager: [...recentPagePaths], warehouse: [...warehouseRecentPaths], cashier: [...cashierRecentPaths] };

/** Danh sách trang của một khu — dùng để tìm tên trang hiện tại cho breadcrumb / ô tìm kiếm. */
export function pagesOf(area: AreaKey): PageSuggestion[] {
  return PAGES[area];
}

/**
 * [BACKEND-TODO] Tìm kiếm trang theo từ khoá (khớp cả tên mục cha và mục con, bỏ dấu):
 * hiện dùng dữ liệu giả ở src/mocks/notifications.ts. Khi có backend: thay thân hàm
 * searchPages bằng gọi API GET /api/search/pages?q={keyword}, giữ nguyên kiểu trả về
 * PageSuggestion[] — backend lọc theo quyền truy cập thật của tài khoản (không cần tham số area).
 */
export async function searchPages(keyword: string, area: AreaKey = 'manager'): Promise<PageSuggestion[]> {
  await delay(280);
  if (!keyword.trim()) return [];
  return PAGES[area].filter(
    (page) => matchesKeyword(page.label, keyword) || matchesKeyword(page.context, keyword),
  );
}

/**
 * [BACKEND-TODO] Trang truy cập gần đây: hiện dùng dữ liệu giả ở src/mocks/notifications.ts.
 * Khi có backend: thay thân hàm getRecentPages bằng gọi API GET /api/search/recent,
 * giữ nguyên kiểu trả về PageSuggestion[] (lịch sử thật theo tài khoản).
 */
export async function getRecentPages(area: AreaKey = 'manager'): Promise<PageSuggestion[]> {
  await delay(200);
  return recent[area]
    .map((path) => PAGES[area].find((p) => p.path === path))
    .filter((p): p is PageSuggestion => Boolean(p));
}

/**
 * Ghi nhận trang vừa truy cập để gợi ý "Gần đây" (thuộc frontend trong phiên hiện tại).
 * Khi có backend, lịch sử này sẽ do getRecentPages trả về từ máy chủ.
 */
export function rememberPage(path: string, area: AreaKey = 'manager'): void {
  recent[area] = [path, ...recent[area].filter((p) => p !== path)].slice(0, 6);
}
