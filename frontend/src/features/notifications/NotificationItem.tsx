import { Bell, CalendarCheck, Check, ChefHat, ClipboardCheck, ClipboardList, ConciergeBell, PackageSearch } from 'lucide-react';
import type { ComponentType } from 'react';
import type { LucideProps } from 'lucide-react';
import { Button } from '@/components/common/Button';
import { cn } from '@/lib/cn';
import { formatRelativeTime, formatTime } from '@/lib/format';
import type { AppNotification, NotificationType } from '@/types';

export const NOTIFICATION_TYPE_META: Record<
  NotificationType,
  { label: string; icon: ComponentType<LucideProps> }
> = {
  reservation: { label: 'Đặt bàn', icon: CalendarCheck },
  inventory: { label: 'Tồn kho', icon: PackageSearch },
  purchase: { label: 'Phiếu mua', icon: ClipboardList },
  stocktake: { label: 'Kiểm kê', icon: ClipboardCheck },
  service_request: { label: 'Yêu cầu của khách', icon: ConciergeBell },
  kitchen: { label: 'Bếp', icon: ChefHat },
  system: { label: 'Hệ thống', icon: Bell },
};

export interface NotificationItemProps {
  item: AppNotification;
  onOpen: (item: AppNotification) => void;
  onMarkRead?: (id: string) => void;
  /** Đang gửi thao tác đánh dấu đã đọc cho dòng này. */
  pending?: boolean;
  /** compact dùng trong popover chuông, full dùng ở trang Thông báo. */
  variant?: 'full' | 'compact';
}

export function NotificationItem({
  item,
  onOpen,
  onMarkRead,
  pending = false,
  variant = 'full',
}: NotificationItemProps) {
  const meta = NOTIFICATION_TYPE_META[item.type];
  const Icon = meta.icon;
  const compact = variant === 'compact';

  if (compact) {
    return (
      <button
        type="button"
        onClick={() => onOpen(item)}
        className={cn(
          'flex w-full items-start gap-2.5 rounded-[10px] border-l-[3px] p-2.5 text-left transition-colors duration-150',
          item.read
            ? 'border-transparent hover:bg-[var(--bg-subtle)]'
            : 'border-[var(--accent)] bg-[var(--accent-soft)] hover:bg-[var(--accent-soft)]',
        )}
      >
        <span
          className={cn(
            'mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-[8px]',
            item.read
              ? 'bg-[var(--accent-soft)] text-[var(--accent)]'
              : 'bg-[var(--accent)] text-[var(--accent-contrast)]',
          )}
          aria-hidden
        >
          <Icon size={14} strokeWidth={1.9} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-start gap-1.5">
            <span
              className={cn(
                'line-clamp-1 min-w-0 flex-1 text-[13px] leading-5',
                item.read
                  ? 'font-medium text-[var(--text-primary)]'
                  : 'font-bold text-[var(--accent)]',
              )}
            >
              {item.title}
            </span>
            {!item.read ? (
              <span
                className="mt-[7px] h-2 w-2 shrink-0 rounded-full bg-[var(--accent)] ring-2 ring-[var(--bg-surface)]"
                aria-label="Chưa đọc"
              />
            ) : null}
          </span>
          <span
            className={cn(
              'line-clamp-1 block text-[12px] leading-4',
              item.read ? 'text-[var(--text-secondary)]' : 'text-[var(--text-primary)]/80',
            )}
          >
            {item.description}
          </span>
          <span
            className={cn(
              'mt-0.5 block font-mono text-[11px]',
              item.read ? 'text-[var(--text-muted)]' : 'font-medium text-[var(--accent)]',
            )}
          >
            {meta.label} · {formatRelativeTime(item.createdAt)}
          </span>
        </span>
      </button>
    );
  }

  return (
    <li
      className={cn(
        'flex min-w-0 items-start gap-3 border-l-[3px] px-4 py-3.5 transition-colors sm:px-5',
        item.read
          ? 'border-transparent'
          : 'border-[var(--accent)] bg-[var(--accent-soft)]',
      )}
    >
      <span
        className={cn(
          'mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-[10px]',
          item.read
            ? 'bg-[var(--accent-soft)] text-[var(--accent)]'
            : 'bg-[var(--accent)] text-[var(--accent-contrast)]',
        )}
        aria-hidden
      >
        <Icon size={16} strokeWidth={1.9} />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          <span className="rounded-pill bg-[var(--bg-subtle)] px-2 py-[2px] text-[10.5px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">
            {meta.label}
          </span>
          {!item.read ? (
            <span className="inline-flex items-center gap-1 text-[10.5px] font-semibold text-[var(--accent)]">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" aria-hidden />
              Chưa đọc
            </span>
          ) : null}
          <span className="ml-auto shrink-0 font-mono text-[11px] tabular-nums text-[var(--text-muted)]">
            {formatRelativeTime(item.createdAt)} · {formatTime(item.createdAt)}
          </span>
        </div>

        <button type="button" onClick={() => onOpen(item)} className="mt-1 block w-full text-left">
          <span className="block truncate text-[14px] font-semibold leading-5 text-[var(--text-primary)] hover:text-[var(--accent)]">
            {item.title}
          </span>
          <span className="mt-0.5 line-clamp-2 block text-[12.5px] leading-5 text-[var(--text-secondary)]">
            {item.description}
          </span>
        </button>
      </div>

      {!item.read && onMarkRead ? (
        <Button
          variant="ghost"
          size="sm"
          className="mt-0.5 shrink-0"
          aria-label={`Đánh dấu đã đọc: ${item.title}`}
          loading={pending}
          onClick={() => onMarkRead(item.id)}
          leadingIcon={<Check size={14} strokeWidth={2.2} aria-hidden />}
        >
          <span className="hidden sm:inline">Đã đọc</span>
        </Button>
      ) : null}
    </li>
  );
}

/** Nhãn loại thông báo, dùng lại khi cần hiển thị riêng. */
export function notificationTypeLabel(type: NotificationType): string {
  return NOTIFICATION_TYPE_META[type].label;
}
