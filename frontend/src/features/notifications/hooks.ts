import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'react-router-dom';
import { getNotifications, getUnreadCount, markAllAsRead, markAsRead } from '@/api/notifications';
import { areaFromPath, type AreaKey } from '@/lib/areas';
import type { NotificationResponse } from '@/types';

export const notificationKeys = {
  all: ['notifications'] as const,
  list: (area: AreaKey) => ['notifications', 'list', area] as const,
  unread: (area: AreaKey) => ['notifications', 'unread-count', area] as const,
};

/** Khu vực hiện tại (Quản lý / Kho) theo đường dẫn — mỗi khu có danh sách thông báo riêng. */
export function useCurrentArea(): AreaKey {
  return areaFromPath(useLocation().pathname);
}

/**
 * Danh sách thông báo dùng chung cho chuông, popover và trang Thông báo —
 * nhờ đó badge trên sidebar, chuông và trang luôn khớp nhau.
 */
export function useNotificationsQuery() {
  const area = useCurrentArea();
  return useQuery({
    queryKey: notificationKeys.list(area),
    queryFn: () => getNotifications(area),
    staleTime: 30_000,
  });
}

export function useUnreadCountQuery() {
  const area = useCurrentArea();
  return useQuery({
    queryKey: notificationKeys.unread(area),
    queryFn: () => getUnreadCount(area),
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
  const area = useCurrentArea();
  return useMutation({
    mutationFn: (id: string) => markAsRead(id, area),
    onSuccess: (updated) => {
      qc.setQueryData<NotificationResponse>(notificationKeys.list(area), (prev) => {
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
  const area = useCurrentArea();
  return useMutation({
    mutationFn: () => markAllAsRead(area),
    onSuccess: () => {
      invalidateNotifications(qc);
    },
  });
}
