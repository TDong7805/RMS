import { api } from '@/lib/http';
import type { AppNotification, NotificationResponse } from '@/types';

/**
 * Thông báo của tài khoản đang đăng nhập (dùng chung mọi khu: Quản lý, Kho…).
 * Máy chủ tự chọn thông báo theo người nhận và tính sẵn đường dẫn (href) theo vai trò.
 */

/** GET /api/notifications — mới nhất trước, trong 30 ngày. */
export function getNotifications(): Promise<NotificationResponse> {
  return api.get<NotificationResponse>('/api/notifications');
}

/** GET /api/notifications/unread-count — chuông gọi lại khoảng mỗi phút. */
export async function getUnreadCount(): Promise<number> {
  return (await api.get<{ count: number }>('/api/notifications/unread-count')).count;
}

/** PATCH /api/notifications/{id}/read */
export function markAsRead(id: string): Promise<AppNotification> {
  return api.patch<AppNotification>(`/api/notifications/${encodeURIComponent(id)}/read`);
}

/** PATCH /api/notifications/read-all — trả số thông báo vừa chuyển sang đã đọc. */
export async function markAllAsRead(): Promise<number> {
  return (await api.patch<{ affected: number }>('/api/notifications/read-all')).affected;
}
