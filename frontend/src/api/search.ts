import { pageSuggestions, recentPagePaths } from '@/mocks/notifications';
import { matchesKeyword } from '@/lib/normalize';
import type { PageSuggestion } from '@/types';

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Bản ghi "đã truy cập gần đây" trong bộ nhớ, mô phỏng lịch sử của một tài khoản. */
let recent: string[] = [...recentPagePaths];

/**
 * [BACKEND-TODO] Tìm kiếm trang theo từ khoá (khớp cả tên mục cha và mục con, bỏ dấu):
 * hiện dùng dữ liệu giả ở src/mocks/notifications.ts. Khi có backend: thay thân hàm
 * searchPages bằng gọi API GET /api/search/pages?q={keyword}, giữ nguyên kiểu trả về
 * PageSuggestion[] — backend lọc theo quyền truy cập thật của tài khoản.
 */
export async function searchPages(keyword: string): Promise<PageSuggestion[]> {
  await delay(280);
  if (!keyword.trim()) return [];
  return pageSuggestions.filter(
    (page) => matchesKeyword(page.label, keyword) || matchesKeyword(page.context, keyword),
  );
}

/**
 * [BACKEND-TODO] Trang truy cập gần đây: hiện dùng dữ liệu giả ở src/mocks/notifications.ts.
 * Khi có backend: thay thân hàm getRecentPages bằng gọi API GET /api/search/recent,
 * giữ nguyên kiểu trả về PageSuggestion[] (lịch sử thật theo tài khoản).
 */
export async function getRecentPages(): Promise<PageSuggestion[]> {
  await delay(200);
  return recent
    .map((path) => pageSuggestions.find((p) => p.path === path))
    .filter((p): p is PageSuggestion => Boolean(p));
}

/**
 * Ghi nhận trang vừa truy cập để gợi ý "Gần đây" (thuộc frontend trong phiên hiện tại).
 * Khi có backend, lịch sử này sẽ do getRecentPages trả về từ máy chủ.
 */
export function rememberPage(path: string): void {
  recent = [path, ...recent.filter((p) => p !== path)].slice(0, 6);
}