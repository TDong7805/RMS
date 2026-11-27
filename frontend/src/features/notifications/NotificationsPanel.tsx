import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck } from 'lucide-react';
import { Button } from '@/components/common/Button';
import { BlockError, EmptyState } from '@/components/common/EmptyState';
import { Skeleton } from '@/components/common/Skeleton';
import { NotificationList } from '@/features/notifications/NotificationList';
import { useMarkAllAsRead, useMarkAsRead, useNotificationsQuery } from '@/features/notifications/hooks';
import type { AppNotification } from '@/types';

/**
 * Danh sách thông báo gọn (không có khung trang) — dùng trong khung riêng của từng khu: quầy thu ngân (màn hình chung),
 * Cổng nhân viên.
 */
export function NotificationsPanel({ emptyText }: { emptyText?: string }) {
  const navigate = useNavigate();
  const { data, isLoading, isError, refetch, isFetching } = useNotificationsQuery();
  const markAsRead = useMarkAsRead();
  const markAll = useMarkAllAsRead();
  const open = (item: AppNotification) => {
    if (!item.read) markAsRead.mutate(item.id);
    if (item.href) navigate(item.href);
  };
  return (
    <div className="mx-auto max-w-2xl space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-[17px] font-extrabold">Thông báo</h1>
        <Button variant="outline" size="sm" disabled={!data?.unreadCount} loading={markAll.isPending} leadingIcon={<CheckCheck size={15} />} onClick={() => markAll.mutate()}>
          Đánh dấu tất cả đã đọc
        </Button>
      </div>
      <div className="overflow-hidden rounded-[14px] border border-[var(--border)] bg-[var(--bg-surface)]">
        {isError ? (
          <div className="p-4"><BlockError onRetry={() => void refetch()} retrying={isFetching} /></div>
        ) : isLoading ? (
          <Skeleton className="h-40" />
        ) : !data?.items.length ? (
          <div className="p-4"><EmptyState icon={Bell} title="Chưa có thông báo" description={emptyText} /></div>
        ) : (
          <NotificationList items={data.items} onOpen={open} onMarkRead={(id) => markAsRead.mutate(id)} pendingId={markAsRead.isPending ? markAsRead.variables : undefined} />
        )}
      </div>
    </div>
  );
}
