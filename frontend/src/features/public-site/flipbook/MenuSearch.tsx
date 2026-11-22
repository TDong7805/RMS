import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { cn } from '@/lib/cn';
import { formatCurrency } from '@/lib/format';
import { SearchField } from '../SearchField';

export interface SearchEntry {
  id: string;
  name: string;
  /** Tên đã bỏ dấu — để xếp món khớp TÊN lên trước món chỉ khớp mô tả. */
  nameKey: string;
  category: string;
  price: number;
  /** Chuỗi để tìm: tên, mô tả, loại, danh mục. */
  haystack: string;
}

/** "Phở Bò" → "pho bo" (bỏ dấu, chữ thường) — tìm không cần gõ dấu, giống máy chủ (Vi.normalize). */
export const normalizeVi = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().trim();

const MAX_RESULTS = 8;

/**
 * Ô tìm món của sách thực đơn (combobox WAI-ARIA): gõ → danh sách gợi ý; ↑ ↓ chọn, Enter lật tới món, Esc đóng.
 * Tìm ngay trên dữ liệu đã tải (không gọi lại máy chủ) nên kết quả hiện tức thì.
 */
export function MenuSearch({ entries, initial, onPick }: { entries: SearchEntry[]; initial: string; onPick: (id: string) => void }) {
  const [value, setValue] = useState(initial);
  const [open, setOpen] = useState(Boolean(initial));
  const [active, setActive] = useState(0);
  const listId = useId();
  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setValue(initial);
    if (initial) setOpen(true);
  }, [initial]);

  const results = useMemo(() => {
    const k = normalizeVi(value);
    if (!k) return [];
    const words = k.split(/\s+/);
    // Xếp hạng: tên chứa nguyên cụm → tên chứa đủ các chữ → chỉ khớp mô tả / loại / danh mục.
    const rank = (e: SearchEntry) => (e.nameKey.includes(k) ? 0 : words.every((w) => e.nameKey.includes(w)) ? 1 : 2);
    return entries
      .filter((e) => words.every((w) => e.haystack.includes(w)))
      .map((e, i) => ({ e, r: rank(e), i }))
      .sort((a, b) => a.r - b.r || a.i - b.i)
      .slice(0, MAX_RESULTS)
      .map((x) => x.e);
  }, [entries, value]);
  useEffect(() => setActive(0), [value]);

  // Bấm ra ngoài → đóng danh sách.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [open]);

  const pick = (id: string) => {
    setOpen(false);
    inputRef.current?.blur(); // điện thoại: ẩn bàn phím để thấy trang vừa lật tới
    onPick(id);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setActive((a) => Math.min(a + 1, Math.max(results.length - 1, 0)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (results[active]) pick(results[active].id);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  const showList = open && value.trim().length > 0;
  return (
    <div ref={boxRef} className="fb-search">
      <SearchField
        ref={inputRef}
        id="fb-search"
        label="Tìm món trong thực đơn"
        value={value}
        onChange={(v) => { setValue(v); setOpen(true); }}
        onClear={() => { setValue(''); setOpen(false); inputRef.current?.focus(); }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder="Tìm món: bít tết, phở, lẩu…"
        maxLength={60}
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={showList && results[active] ? `${listId}-${active}` : undefined}
      />
      {showList ? (
        <ul id={listId} role="listbox" aria-label="Kết quả tìm món" className="fb-search__list">
          {results.length ? (
            results.map((r, i) => (
              <li
                key={r.id}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === active}
                className={cn('fb-search__option', i === active && 'fb-search__option--active')}
                onPointerDown={(e) => e.preventDefault()}
                onClick={() => pick(r.id)}
                onMouseEnter={() => setActive(i)}
              >
                <span className="fb-search__name">{r.name}</span>
                <span className="fb-search__meta">{r.category} · {formatCurrency(r.price)}</span>
              </li>
            ))
          ) : (
            <li className="fb-search__empty" role="option" aria-selected={false} aria-disabled>Không tìm thấy món phù hợp</li>
          )}
        </ul>
      ) : null}
    </div>
  );
}
