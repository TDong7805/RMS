import type { AppNotification } from '@/types';
import { NotificationItem } from './NotificationItem';

export interface NotificationListProps {
  items: AppNotification[];
  onOpen: (item: AppNotification) => void;
  onMarkRead: (id: string) => void;
  pendingId?: string | null;
}

export function NotificationList({ items, onOpen, onMarkRead, pendingId }: NotificationListProps) {
  return (
    <ul className="divide-y divide-[var(--border)]">
      {items.map((item) => (
        <NotificationItem
          key={item.id}
          item={item}
          onOpen={onOpen}
          onMarkRead={onMarkRead}
          pending={pendingId === item.id}
        />
      ))}
    </ul>
  );
}

export default NotificationList;