import type { ReactNode } from 'react';
import * as Menu from '@radix-ui/react-dropdown-menu';
import { MoreHorizontal } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Button } from './Button';

/**
 * Thao tác mỗi dòng trong danh sách (docs/thiet-ke/QUY_TAC_GIAO_DIEN.md, quy tắc 3 và mục B8):
 * nút chính có chữ ("Sửa") + menu "⋯" chứa các việc còn lại, mỗi việc có chữ rõ; việc nguy hiểm (Xóa) tô đỏ, nằm cuối.
 */
export interface RowAction {
  label: string;
  icon?: ReactNode;
  onSelect: () => void;
  danger?: boolean;
  disabled?: boolean;
}

export function RowActions({ name, primaryLabel = 'Sửa', onPrimary, items, inHeader = false }: {
  /** Tên dòng (món, set…) để đọc màn hình: "Sửa Bò lúc lắc", "Thêm thao tác cho Bò lúc lắc". */
  name: string;
  primaryLabel?: string;
  onPrimary?: () => void;
  items: RowAction[];
  /** Đặt ở đầu trang chi tiết: nút ⋯ có viền, cao bằng nút thường. */
  inHeader?: boolean;
}) {
  const normal = items.filter((i) => !i.danger);
  const danger = items.filter((i) => i.danger);
  return (
    <div className="inline-flex items-center gap-1">
      {onPrimary ? (
        <Button size="sm" variant="outline" onClick={onPrimary} aria-label={`${primaryLabel} ${name}`}>
          {primaryLabel}
        </Button>
      ) : null}
      {items.length ? (
        <Menu.Root modal={false}>
          <Menu.Trigger asChild>
            <button
              type="button"
              aria-label={`Thêm thao tác cho ${name}`}
              className={cn(
                'grid place-items-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]',
                inHeader
                  ? 'h-9 w-9 rounded-control border border-[var(--border-strong)] bg-[var(--bg-surface)] text-[var(--text-primary)] hover:border-[var(--accent)] hover:text-[var(--accent)]'
                  : 'h-8 w-8 rounded-[8px] text-[var(--text-muted)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)] data-[state=open]:bg-[var(--bg-subtle)] data-[state=open]:text-[var(--text-primary)]',
              )}
            >
              <MoreHorizontal size={16} />
            </button>
          </Menu.Trigger>
          <Menu.Portal>
            <Menu.Content
              align="end"
              sideOffset={4}
              collisionPadding={12}
              className="z-[60] min-w-[180px] rounded-[12px] border border-[var(--border)] bg-[var(--bg-surface)] p-1.5 shadow-overlay"
            >
              {normal.map((i) => <Item key={i.label} item={i} />)}
              {normal.length && danger.length ? <Menu.Separator className="my-1 h-px bg-[var(--border)]" /> : null}
              {danger.map((i) => <Item key={i.label} item={i} />)}
            </Menu.Content>
          </Menu.Portal>
        </Menu.Root>
      ) : null}
    </div>
  );
}

function Item({ item }: { item: RowAction }) {
  return (
    <Menu.Item
      disabled={item.disabled}
      onSelect={item.onSelect}
      className={cn(
        'flex h-9 cursor-pointer select-none items-center gap-2.5 rounded-[8px] px-2.5 text-[13.5px] outline-none',
        'data-[disabled]:cursor-not-allowed data-[disabled]:opacity-45',
        item.danger
          ? 'text-[var(--danger)] data-[highlighted]:bg-[var(--danger-soft)]'
          : 'text-[var(--text-primary)] data-[highlighted]:bg-[var(--bg-subtle)]',
      )}
    >
      {item.icon ? <span className="shrink-0 opacity-80">{item.icon}</span> : null}
      {item.label}
    </Menu.Item>
  );
}
