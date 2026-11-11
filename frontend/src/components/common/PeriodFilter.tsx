import * as Popover from '@radix-ui/react-popover';
import { CalendarRange, Check } from 'lucide-react';
import { PERIOD_OPTIONS } from '@/lib/format';
import { cn } from '@/lib/cn';
import type { PeriodKey } from '@/types';

export interface PeriodFilterProps {
  value: PeriodKey;
  onChange: (next: PeriodKey) => void;
  /** Nhãn cho screen reader, ví dụ "Chọn khoảng thời gian cho khối doanh thu". */
  label: string;
  disabled?: boolean;
}

export function PeriodFilter({ value, onChange, label, disabled }: PeriodFilterProps) {
  const current = PERIOD_OPTIONS.find((o) => o.key === value) ?? PERIOD_OPTIONS[0];

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          type="button"
          disabled={disabled}
          aria-label={label}
          className={cn(
            'inline-flex h-9 max-w-full items-center gap-2 rounded-control border border-[var(--border)] px-3',
            'text-[13px] font-semibold text-[var(--text-primary)] transition-colors duration-150',
            'hover:border-[var(--accent)] hover:text-[var(--accent)]',
            'data-[state=open]:border-[var(--accent)] data-[state=open]:bg-[var(--accent-soft)] data-[state=open]:text-[var(--accent)]',
            'disabled:pointer-events-none disabled:opacity-50',
          )}
        >
          <CalendarRange size={15} strokeWidth={1.75} aria-hidden className="shrink-0" />
          <span className="truncate">{current.label}</span>
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          sideOffset={8}
          align="end"
          collisionPadding={12}
          className="z-[60] w-[236px] rounded-item border border-[var(--border)] bg-[var(--bg-surface)] p-1.5 shadow-overlay"
        >
          <p className="px-2.5 pb-1.5 pt-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
            Khoảng thời gian
          </p>
          <ul role="listbox" aria-label={label} className="space-y-0.5">
            {PERIOD_OPTIONS.map((option) => {
              const selected = option.key === value;
              return (
                <li key={option.key} role="none">
                  <button
                    type="button"
                    role="option"
                    aria-selected={selected}
                    onClick={() => onChange(option.key)}
                    className={cn(
                      'flex h-9 w-full items-center justify-between rounded-[9px] px-2.5 text-left text-[13.5px] transition-colors duration-150',
                      selected
                        ? 'bg-[var(--accent-soft)] font-semibold text-[var(--accent)]'
                        : 'text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)]',
                    )}
                  >
                    {option.label}
                    {selected ? (
                      <Check size={15} strokeWidth={2} aria-hidden className="shrink-0" />
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}