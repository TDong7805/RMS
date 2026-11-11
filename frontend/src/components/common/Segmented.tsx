import { cn } from '@/lib/cn';

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  count?: number;
}

export interface SegmentedProps<T extends string> {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
  className?: string;
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  className,
}: SegmentedProps<T>) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn(
        'inline-flex max-w-full items-center gap-0.5 rounded-control bg-[var(--bg-subtle)] p-0.5',
        className,
      )}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(option.value)}
            className={cn(
              'inline-flex h-8 min-w-0 items-center gap-1.5 rounded-[9px] px-3 text-[12.5px] font-semibold whitespace-nowrap transition-colors duration-150',
              selected
                ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-soft'
                : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]',
            )}
          >
            <span className="truncate">{option.label}</span>
            {typeof option.count === 'number' ? (
              <span
                className={cn(
                  'font-mono text-[11px] tabular-nums',
                  selected ? 'text-[var(--accent)]' : 'text-[var(--text-muted)]',
                )}
              >
                {option.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}