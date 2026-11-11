import { notificationSeed } from '@/mocks/notifications';
import type { AppNotification, NotificationResponse } from '@/types';

/** Trạng thái đọc là dữ liệu giả trong bộ nhớ, mô phỏng phiên của một tài khoản. */
let store: AppNotification[] = notificationSeed.map((n) => ({ ...n }));

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * [BACKEND-TODO] Danh sách thông báo: hiện dùng dữ liệu giả ở src/mocks/notifications.ts.
 * Khi có backend: thay thân hàm getNotifications bằng gọi API
 * GET /api/notifications, giữ nguyên kiểu trả về NotificationResponse
 * (đã sắp mới nhất trước, kèm unreadCount của tài khoản).
 */
export async function getNotifications(): Promise<NotificationResponse> {
  await delay(420);
  const items = [...store].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
  return { items, unreadCount: items.filter((n) => !n.read).length, total: items.length };
}

/**
 * [BACKEND-TODO] Số thông báo chưa đọc: hiện dùng dữ liệu giả ở src/mocks/notifications.ts.
 * Khi có backend: thay thân hàm getUnreadCount bằng gọi API
 * GET /api/notifications/unread-count, giữ nguyên kiểu trả về number.
 */
export async function getUnreadCount(): Promise<number> {
  await delay(160);
  return store.filter((n) => !n.read).length;
}

/**
 * [BACKEND-TODO] Đánh dấu đã đọc: hiện dùng dữ liệu giả ở src/mocks/notifications.ts.
 * Khi có backend: thay thân hàm markAsRead bằng gọi API
 * PATCH /api/notifications/{id}/read, giữ nguyên kiểu trả về AppNotification.
 */
export async function markAsRead(id: string): Promise<AppNotification> {
  await delay(220);
  const found = store.find((n) => n.id === id);
  if (!found) throw new Error('Không tìm thấy thông báo');
  found.read = true;
  return { ...found };
}

/**
 * [BACKEND-TODO] Đánh dấu tất cả đã đọc: hiện dùng dữ liệu giả ở src/mocks/notifications.ts.
 * Khi có backend: thay thân hàm markAllAsRead bằng gọi API
 * PATCH /api/notifications/read-all, giữ nguyên kiểu trả về number (số bản ghi đã cập nhật).
 */
export async function markAllAsRead(): Promise<number> {
  await delay(280);
  const affected = store.filter((n) => !n.read).length;
  store = store.map((n) => ({ ...n, read: true }));
  return affected;
}