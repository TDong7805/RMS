import { notificationSeed, warehouseNotificationSeed } from '@/mocks/notifications';
import type { AreaKey } from '@/lib/areas';
import type { AppNotification, NotificationResponse } from '@/types';

/**
 * Trạng thái đọc là dữ liệu giả trong bộ nhớ, mô phỏng phiên của một tài khoản.
 * Mỗi khu (Quản lý, Kho) có danh sách riêng — khi có backend, danh sách theo tài khoản đang đăng nhập
 * nên tham số area sẽ không còn cần.
 */
const stores: Record<AreaKey, AppNotification[]> = {
  manager: notificationSeed.map((n) => ({ ...n })),
  warehouse: warehouseNotificationSeed.map((n) => ({ ...n })),
};

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * [BACKEND-TODO] Danh sách thông báo: hiện dùng dữ liệu giả ở src/mocks/notifications.ts.
 * Khi có backend: thay thân hàm getNotifications bằng gọi API
 * GET /api/notifications, giữ nguyên kiểu trả về NotificationResponse
 * (đã sắp mới nhất trước, kèm unreadCount của tài khoản).
 */
export async function getNotifications(area: AreaKey = 'manager'): Promise<NotificationResponse> {
  await delay(420);
  const items = [...stores[area]].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
  return { items, unreadCount: items.filter((n) => !n.read).length, total: items.length };
}

/**
 * [BACKEND-TODO] Số thông báo chưa đọc: hiện dùng dữ liệu giả ở src/mocks/notifications.ts.
 * Khi có backend: thay thân hàm getUnreadCount bằng gọi API
 * GET /api/notifications/unread-count, giữ nguyên kiểu trả về number.
 */
export async function getUnreadCount(area: AreaKey = 'manager'): Promise<number> {
  await delay(160);
  return stores[area].filter((n) => !n.read).length;
}

/**
 * [BACKEND-TODO] Đánh dấu đã đọc: hiện dùng dữ liệu giả ở src/mocks/notifications.ts.
 * Khi có backend: thay thân hàm markAsRead bằng gọi API
 * PATCH /api/notifications/{id}/read, giữ nguyên kiểu trả về AppNotification.
 */
export async function markAsRead(id: string, area: AreaKey = 'manager'): Promise<AppNotification> {
  await delay(220);
  const found = stores[area].find((n) => n.id === id);
  if (!found) throw new Error('Không tìm thấy thông báo');
  found.read = true;
  return { ...found };
}

/**
 * [BACKEND-TODO] Đánh dấu tất cả đã đọc: hiện dùng dữ liệu giả ở src/mocks/notifications.ts.
 * Khi có backend: thay thân hàm markAllAsRead bằng gọi API
 * PATCH /api/notifications/read-all, giữ nguyên kiểu trả về number (số bản ghi đã cập nhật).
 */
export async function markAllAsRead(area: AreaKey = 'manager'): Promise<number> {
  await delay(280);
  const affected = stores[area].filter((n) => !n.read).length;
  stores[area] = stores[area].map((n) => ({ ...n, read: true }));
  return affected;
}

/**
 * [BACKEND-TODO] Dùng cho dữ liệu giả của kho: thêm thông báo khi một thao tác làm nguyên liệu
 * xuống mức sắp hết. Khi có backend, thông báo do máy chủ tạo; bỏ hàm này.
 */
export function pushNotification(area: AreaKey, item: Omit<AppNotification, 'id' | 'createdAt' | 'read'>): void {
  stores[area] = [
    { ...item, id: `${area}-ntf-${Date.now().toString(36)}`, createdAt: new Date().toISOString(), read: false },
    ...stores[area],
  ];
}
