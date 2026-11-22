import { forwardRef, type InputHTMLAttributes } from 'react';
import { Search, X } from 'lucide-react';
import { cn } from '@/lib/cn';

export interface SearchFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value' | 'size'> {
  id: string;
  value: string;
  onChange: (value: string) => void;
  /** Nhãn đọc cho trình đọc màn hình (ô tìm không có nhãn hiển thị). */
  label: string;
  /** Có thì hiện nút X bên phải khi đã gõ chữ. */
  onClear?: () => void;
  /** compact: cao 40px (thanh đầu trang); mặc định 46px. */
  compact?: boolean;
  className?: string;
}

/**
 * Ô tìm kiếm của website khách hàng: kính lúp bên trái, nút xóa (X) bên phải.
 * Kích thước, khoảng cách viết trong site-theme.css (.site-search…) — KHÔNG dùng class Tailwind pl-…/pr-… vì rule
 * .site-root .site-input (ưu tiên cao hơn) sẽ ghi đè, làm chữ chạy xuống dưới icon (lỗi chồng chữ trước đây).
 */
export const SearchField = forwardRef<HTMLInputElement, SearchFieldProps>(function SearchField(
  { id, value, onChange, label, onClear, compact, className, ...rest },
  ref,
) {
  const clearable = Boolean(onClear && value);
  return (
    <div className={cn('site-search', compact && 'site-search--compact', clearable && 'site-search--clearable', className)}>
      <label htmlFor={id} className="sr-only">{label}</label>
      <Search className="site-search__icon" aria-hidden />
      <input
        ref={ref}
        id={id}
        type="search"
        enterKeyHint="search"
        autoComplete="off"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="site-search__input"
        {...rest}
      />
      {clearable ? (
        <button type="button" className="site-search__clear" onClick={onClear} aria-label="Xóa từ khóa">
          <X size={16} aria-hidden />
        </button>
      ) : null}
    </div>
  );
});
