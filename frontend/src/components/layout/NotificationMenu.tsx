import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import * as Popover from '@radix-ui/react-popover';
import * as Tabs from '@radix-ui/react-tabs';
import { Bell, CheckCheck } from 'lucide-react';
import { formatBadgeCount } from '@/components/common/Badge';
import { Button } from '@/components/common/Button';
import { NotificationItem } from '@/features/notifications/NotificationItem';
import {
  useCurrentArea,
  useMarkAllAsRead,
  useMarkAsRead,
  useNotificationsQuery,
} from '@/features/notifications/hooks';
import { AREA_HOME } from '@/lib/areas';
import type { AppNotification } from '@/types';

const TAB_CLASS =
  'relative min-h-[34px] rounded-t-[8px] px-2.5 pb-2 pt-1 text-[13px] font-semibold text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)] data-[state=active]:text-[var(--accent)] data-[state=active]:after:absolute data-[state=active]:after:inset-x-2 data-[state=active]:after:bottom-0 data-[state=active]:after:h-[2px] data-[state=active]:after:rounded-full data-[state=active]:after:bg-[var(--accent)]';

export function NotificationMenu() {
  const navigate = useNavigate();
  const area = useCurrentArea();
  const { data, isLoading, isError, refetch, isFetching } = useNotificationsQuery();
  const markAsRead = useMarkAsRead();
  const markAll = useMarkAllAsRead();

  const unread = useMemo(() => (data?.items ?? []).filter((n) => !n.read), [data]);
  const latest = useMemo(() => (data?.items ?? []).slice(0, 4), [data]);
  const unreadCount = data?.unreadCount ?? 0;

  const handleSelect = (item: AppNotification) => {
    if (!item.read) markAsRead.mutate(item.id);
    if (item.href) navigate(item.href);
  };

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          type="button"
          aria-label={`Thông báo${unreadCount > 0 ? `, ${unreadCount} chưa đọc` : ''}`}
          className="relative grid h-10 w-10 shrink-0 place-items-center rounded-control border border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text-secondary)] transition-colors duration-150 hover:border-[var(--accent)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent)] data-[state=open]:border-[var(--accent)] data-[state=open]:bg-[var(--accent-soft)] data-[state=open]:text-[var(--accent)]"
        >
          <Bell size={18} strokeWidth={1.75} aria-hidden />
          {unreadCount > 0 ? (
            <span
              className="absolute -right-1 -top-1 grid h-[18px] min-w-[18px] place-items-center rounded-full border-2 border-[var(--bg-page)] bg-[var(--danger)] px-1 font-mono text-[10px] font-semibold leading-none text-white"
              aria-hidden
            >
              {formatBadgeCount(unreadCount)}
            </span>
          ) : null}
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          side="bottom"
          align="end"
          sideOffset={10}
          collisionPadding={12}
          className="z-[60] w-[min(384px,calc(100vw-24px))] overflow-hidden rounded-item border border-[var(--border)] bg-[var(--bg-surface)] shadow-overlay"
        >
          <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-3">
            <div className="min-w-0">
              <p className="text-[14px] font-semibold text-[var(--text-primary)]">Thông báo</p>
              <p className="font-mono text-[11.5px] text-[var(--text-muted)]">
                {unreadCount > 0 ? `${unreadCount} chưa đọc` : 'Đã đọc tất cả'}
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => markAll.mutate()}
              disabled={unreadCount === 0}
              loading={markAll.isPending}
              leadingIcon={<CheckCheck size={14} strokeWidth={1.9} aria-hidden />}
            >
              Đánh dấu đã đọc
            </Button>
          </div>

          {isError ? (
            <div className="px-4 py-6 text-center">
              <p className="text-[13px] font-semibold text-[var(--text-primary)]">
                Không tải được thông báo
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={() => void refetch()}
                loading={isFetching}
              >
                Tải lại
              </Button>
            </div>
          ) : isLoading ? (
            <div className="space-y-2 p-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex gap-2.5">
                  <div className="rm-skeleton h-7 w-7 rounded-[8px]" />
                  <div className="flex-1 space-y-1.5 py-1">
                    <div className="rm-skeleton h-2.5 w-2/3 rounded-full" />
                    <div className="rm-skeleton h-2.5 w-full rounded-full" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <Tabs.Root defaultValue="unread">
              <Tabs.List className="flex gap-1 border-b border-[var(--border)] px-2 pt-2">
                {[
                  { value: 'unread', label: 'Chưa đọc', count: unread.length },
                  { value: 'latest', label: 'Mới', count: latest.length },
                ].map((tab) => (
                  <Tabs.Trigger key={tab.value} value={tab.value} className={TAB_CLASS}>
                    {tab.label}
                    <span className="ml-1.5 font-mono text-[11px] font-medium">{tab.count}</span>
                  </Tabs.Trigger>
                ))}
              </Tabs.List>

              <Tabs.Content value="unread" className="max-h-[264px] overflow-y-auto p-1.5">
                {unread.length === 0 ? (
                  <p className="px-3 py-7 text-center text-[12.5px] text-[var(--text-muted)]">
                    Không có thông báo chưa đọc
                  </p>
                ) : (
                  unread.slice(0, 4).map((item) => (
                    <NotificationItem
                      key={item.id}
                      item={item}
                      onOpen={handleSelect}
                      variant="compact"
                    />
                  ))
                )}
              </Tabs.Content>

              <Tabs.Content value="latest" className="max-h-[264px] overflow-y-auto p-1.5">
                {latest.length === 0 ? (
                  <p className="px-3 py-7 text-center text-[12.5px] text-[var(--text-muted)]">
                    Chưa có thông báo
                  </p>
                ) : (
                  latest.map((item) => (
                    <NotificationItem
                      key={item.id}
                      item={item}
                      onOpen={handleSelect}
                      variant="compact"
                    />
                  ))
                )}
              </Tabs.Content>
            </Tabs.Root>
          )}

          <div className="border-t border-[var(--border)] p-2">
            <Button
              variant="ghost"
              className="w-full justify-center text-[13px] text-[var(--accent)] hover:!bg-[var(--accent-soft)]"
              onClick={() => navigate(`${AREA_HOME[area]}/thong-bao`)}
            >
              Xem tất cả thông báo
            </Button>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
