import { useMemo, useState, type ReactNode } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { Check, ChevronRight, Plus, Search, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { matchesKeyword } from '@/lib/normalize';

/**
 * Bộ lọc dạng chip (theo Linear — docs/thiet-ke/QUY_TAC_GIAO_DIEN.md).
 * Mỗi điều kiện đang bật là một chip "[Trường] là [Giá trị] ×" trên đầu danh sách; nút "+ Lọc" mở menu có ô tìm
 * loại lọc → chọn loại → chọn giá trị. Cuối hàng có "Xóa lọc".
 * Chưa gắn vào trang nào: các trang chuyển sang dùng dần khi tới lượt sửa.
 *
 * Ví dụ:
 *   <FilterChips
 *     fields={[{ key: 'status', label: 'Trạng thái', options: [{ value: 'selling', label: 'Đang bán' }, …] }]}
 *     value={{ status: 'selling' }}
 *     onChange={setFilters}
 *   />
 */
export interface FilterOption {
  value: string;
  label: string;
}

export interface FilterField {
  key: string;
  label: string;
  icon?: ReactNode;
  options: FilterOption[];
}

export interface FilterChipsProps {
  fields: FilterField[];
  /** Giá trị đang lọc theo từng trường (bỏ trống / undefined = không lọc trường đó). */
  value: Record<string, string | undefined>;
  onChange: (next: Record<string, string | undefined>) => void;
  className?: string;
}

export function FilterChips({ fields, value, onChange, className }: FilterChipsProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [picking, setPicking] = useState<FilterField | null>(null);

  const active = fields.filter((f) => value[f.key]);
  const set = (key: string, v: string | undefined) => onChange({ ...value, [key]: v });

  const list = useMemo(() => {
    const q = query.trim();
    if (picking) return picking.options.filter((o) => !q || matchesKeyword(o.label, q));
    return fields.filter((f) => !q || matchesKeyword(f.label, q));
  }, [fields, picking, query]);

  const close = () => { setOpen(false); setPicking(null); setQuery(''); };

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      {active.map((f) => {
        const opt = f.options.find((o) => o.value === value[f.key]);
        return (
          <span key={f.key} className="inline-flex h-8 items-center overflow-hidden rounded-[8px] border border-[var(--border)] bg-[var(--bg-surface)] text-[13px]">
            <span className="px-2.5 text-[var(--text-secondary)]">{f.label}</span>
            <span className="border-l border-[var(--border)] px-2 text-[var(--text-muted)]">là</span>
            <button
              type="button"
              onClick={() => { setPicking(f); setOpen(true); }}
              className="border-l border-[var(--border)] px-2.5 font-medium text-[var(--text-primary)] hover:bg-[var(--bg-subtle)]"
            >
              {opt?.label ?? value[f.key]}
            </button>
            <button type="button" aria-label={`Bỏ lọc ${f.label}`} onClick={() => set(f.key, undefined)} className="grid h-full w-7 place-items-center border-l border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--bg-subtle)] hover:text-[var(--danger)]">
              <X size={13} />
            </button>
          </span>
        );
      })}

      <Popover.Root open={open} onOpenChange={(o) => (o ? setOpen(true) : close())}>
        <Popover.Trigger asChild>
          <button
            type="button"
            className="inline-flex h-8 items-center gap-1.5 rounded-[8px] border border-dashed border-[var(--border-strong)] px-2.5 text-[13px] font-medium text-[var(--text-secondary)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
          >
            <Plus size={14} /> Lọc
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content align="start" sideOffset={6} className="z-[60] w-[260px] overflow-hidden rounded-[12px] border border-[var(--border)] bg-[var(--bg-surface)] shadow-overlay">
            <div className="flex items-center gap-2 border-b border-[var(--border)] px-3">
              <Search size={14} className="text-[var(--text-muted)]" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={picking ? `Tìm ${picking.label.toLowerCase()}…` : 'Lọc theo…'}
                className="h-10 min-w-0 flex-1 bg-transparent text-[13.5px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none"
              />
            </div>
            <div className="max-h-[280px] overflow-y-auto p-1.5">
              {list.length === 0 ? (
                <p className="px-2.5 py-4 text-center text-[12.5px] text-[var(--text-muted)]">Không có lựa chọn phù hợp</p>
              ) : picking ? (
                (list as FilterOption[]).map((o) => (
                  <button key={o.value} type="button" onClick={() => { set(picking.key, o.value); close(); }} className="flex h-9 w-full items-center gap-2 rounded-[8px] px-2.5 text-left text-[13.5px] text-[var(--text-primary)] hover:bg-[var(--bg-subtle)]">
                    <span className="min-w-0 flex-1 truncate">{o.label}</span>
                    {value[picking.key] === o.value ? <Check size={14} className="text-[var(--accent)]" /> : null}
                  </button>
                ))
              ) : (
                (list as FilterField[]).map((f) => (
                  <button key={f.key} type="button" onClick={() => { setPicking(f); setQuery(''); }} className="flex h-9 w-full items-center gap-2 rounded-[8px] px-2.5 text-left text-[13.5px] text-[var(--text-primary)] hover:bg-[var(--bg-subtle)]">
                    {f.icon ? <span className="text-[var(--text-muted)]">{f.icon}</span> : null}
                    <span className="min-w-0 flex-1 truncate">{f.label}</span>
                    <ChevronRight size={14} className="text-[var(--text-muted)]" />
                  </button>
                ))
              )}
            </div>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>

      {active.length > 0 ? (
        <button type="button" onClick={() => onChange({})} className="h-8 rounded-[8px] px-2 text-[13px] font-medium text-[var(--text-muted)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)]">
          Xóa lọc
        </button>
      ) : null}
    </div>
  );
}
