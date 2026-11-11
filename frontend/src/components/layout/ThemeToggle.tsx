import * as Tooltip from '@radix-ui/react-tooltip';
import { Moon, Sun } from 'lucide-react';
import { useUiStore } from '@/lib/ui-store';

export function ThemeToggle() {
  const theme = useUiStore((state) => state.theme);
  const toggleTheme = useUiStore((state) => state.toggleTheme);
  const isDark = theme === 'dark';

  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>
        <button
          type="button"
          onClick={toggleTheme}
          aria-label={isDark ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối'}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-control border border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text-secondary)] transition-colors duration-150 hover:border-[var(--accent)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent)]"
        >
          {isDark ? (
            <Sun size={18} strokeWidth={1.75} aria-hidden />
          ) : (
            <Moon size={18} strokeWidth={1.75} aria-hidden />
          )}
        </button>
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content
          side="bottom"
          sideOffset={8}
          className="z-[70] rounded-[8px] bg-[var(--text-primary)] px-2.5 py-1.5 text-[12px] font-medium text-[var(--bg-surface)] shadow-overlay"
        >
          {isDark ? 'Giao diện sáng' : 'Giao diện tối'}
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}