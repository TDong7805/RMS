import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { Card } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { Segmented } from '@/components/common/Segmented';
import { Skeleton } from '@/components/common/Skeleton';
import { BlockError, EmptyState } from '@/components/common/EmptyState';
import { NotificationList } from '@/features/notifications/NotificationList';
import {
  useMarkAllAsRead,
  useMarkAsRead,
  useNotificationsQuery,
} from '@/features/notifications/hooks';
import type { AppNotification } from '@/types';

type Filter = 'all' | 'unread';

export function NotificationsPage() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<Filter>('all');
  const { data, isLoading, isError, refetch, isFetching } = useNotificationsQuery();
  const markAsRead = useMarkAsRead();
  const markAll = useMarkAllAsRead();

  const items = useMemo(() => {
    const all = data?.items ?? [];
    return filter === 'unread' ? all.filter((n) => !n.read) : all;
  }, [data, filter]);

  const unreadCount = data?.unreadCount ?? 0;

  const handleOpen = (item: AppNotification) => {
    if (!item.read) markAsRead.mutate(item.id);
    if (item.href) navigate(item.href);
  };

  return (
    <AppShell meta={{ label: 'Thông báo', parent: 'Hệ thống' }}>
      <div className="min-w-0 space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <h1 className="truncate text-[26px] font-bold leading-tight tracking-[-0.02em] text-[var(--text-primary)] sm:text-[30px]">
              Thông báo
            </h1>
            <p className="mt-1 text-[14px] text-[var(--text-secondary)]">
              <span className="font-mono font-semibold tabular-nums text-[var(--accent)]">
                {unreadCount}
              </span>{' '}
              thông báo chưa đọc từ Đặt bàn và Kho.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => markAll.mutate()}
            disabled={unreadCount === 0}
            loading={markAll.isPending}
            leadingIcon={<CheckCheck size={15} strokeWidth={1.9} aria-hidden />}
          >
            Đánh dấu tất cả đã đọc
          </Button>
        </div>

        <Card className="overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] px-4 py-3 sm:px-5">
            <Segmented<Filter>
              ariaLabel="Lọc thông báo"
              value={filter}
              onChange={setFilter}
              options={[
                { value: 'all', label: 'Tất cả', count: data?.items.length ?? 0 },
                { value: 'unread', label: 'Chưa đọc', count: unreadCount },
              ]}
            />
            <span className="font-mono text-[11px] text-[var(--text-muted)]">
              Giữ 30 ngày gần nhất
            </span>
          </div>

          {isError ? (
            <div className="p-5">
              <BlockError onRetry={() => void refetch()} retrying={isFetching} />
            </div>
          ) : isLoading ? (
            <div className="divide-y divide-[var(--border)]">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex gap-3 px-4 py-4 sm:px-5">
                  <Skeleton className="h-9 w-9 shrink-0 rounded-[10px]" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-2.5 w-20 rounded-full" />
                    <Skeleton className="h-3 w-3/5 rounded-full" />
                    <Skeleton className="h-2.5 w-full rounded-full" />
                  </div>
                </div>
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="p-5">
              <EmptyState
                icon={Bell}
                title={filter === 'unread' ? 'Không có thông báo chưa đọc' : 'Chưa có thông báo'}
                description={
                  filter === 'unread'
                    ? 'Bạn đã đọc hết thông báo hiện có.'
                    : 'Thông báo từ Đặt bàn và Kho sẽ xuất hiện tại đây.'
                }
              />
            </div>
          ) : (
            <NotificationList
              items={items}
              onOpen={handleOpen}
              onMarkRead={(id) => markAsRead.mutate(id)}
              pendingId={markAsRead.isPending ? markAsRead.variables ?? null : null}
            />
          )}
        </Card>
      </div>
    </AppShell>
  );
}

export default NotificationsPage;
