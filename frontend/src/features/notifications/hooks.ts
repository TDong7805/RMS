import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'react-router-dom';
import { getNotifications, getUnreadCount, markAllAsRead, markAsRead } from '@/api/notifications';
import { areaFromPath, type AreaKey } from '@/lib/areas';
import type { NotificationResponse } from '@/types';

export const notificationKeys = {
  all: ['notifications'] as const,
  list: ['notifications', 'list'] as const,
  unread: ['notifications', 'unread-count'] as const,
};

/** Khu vực hiện tại (Quản lý / Kho) theo đường dẫn — dùng để mở trang Thông báo của đúng khu. */
export function useCurrentArea(): AreaKey {
  return areaFromPath(useLocation().pathname);
}

/**
 * Danh sách thông báo dùng chung cho chuông, popover và trang Thông báo —
 * nhờ đó badge trên sidebar, chuông và trang luôn khớp nhau.
 */
export function useNotificationsQuery() {
  return useQuery({
    queryKey: notificationKeys.list,
    queryFn: getNotifications,
    staleTime: 30_000,
  });
}

export function useUnreadCountQuery() {
  return useQuery({
    queryKey: notificationKeys.unread,
    queryFn: getUnreadCount,
    staleTime: 30_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });
}

function invalidateNotifications(qc: ReturnType<typeof useQueryClient>): void {
  void qc.invalidateQueries({ queryKey: notificationKeys.all });
}

export function useMarkAsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: markAsRead,
    onSuccess: (updated) => {
      qc.setQueryData<NotificationResponse>(notificationKeys.list, (prev) => {
        if (!prev) return prev;
        const items = prev.items.map((n) => (n.id === updated.id ? updated : n));
        return { ...prev, items, unreadCount: items.filter((n) => !n.read).length };
      });
      invalidateNotifications(qc);
    },
  });
}

export function useMarkAllAsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: markAllAsRead,
    onSuccess: () => {
      invalidateNotifications(qc);
    },
  });
}
