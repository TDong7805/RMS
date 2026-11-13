import {
  forwardRef,
  useRef,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { ChevronDown, ImagePlus, Search, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/cn';
import { prepareImage } from '@/lib/image';
import { validateImageFile } from '@/lib/mock';

const CONTROL =
  'w-full rounded-control border bg-[var(--bg-surface)] text-[14px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] transition-colors focus:outline-none disabled:cursor-not-allowed disabled:bg-[var(--bg-subtle)] disabled:text-[var(--text-muted)]';

export function controlClass(invalid?: boolean): string {
  return cn(
    CONTROL,
    invalid
      ? 'border-[var(--danger)] focus:border-[var(--danger)]'
      : 'border-[var(--border-strong)] hover:border-[var(--accent)]/60 focus:border-[var(--accent)]',
  );
}

export interface FieldProps {
  label: string;
  htmlFor?: string;
  required?: boolean;
  error?: string;
  hint?: ReactNode;
  className?: string;
  children: ReactNode;
}

export function Field({ label, htmlFor, required, error, hint, className, children }: FieldProps) {
  return (
    <div className={cn('min-w-0', className)}>
      <label
        htmlFor={htmlFor}
        className="mb-1.5 block text-[13px] font-semibold text-[var(--text-primary)]"
      >
        {label}
        {required ? <span className="ml-0.5 text-[var(--danger)]">*</span> : null}
      </label>
      {children}
      {error ? (
        <p role="alert" className="mt-1 text-[12px] font-medium text-[var(--danger)]">
          {error}
        </p>
      ) : hint ? (
        <p className="mt-1 text-[12px] text-[var(--text-muted)]">{hint}</p>
      ) : null}
    </div>
  );
}

export interface TextInputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

export const TextInput = forwardRef<HTMLInputElement, TextInputProps>(function TextInput(
  { invalid, className, ...rest },
  ref,
) {
  return (
    <input
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(controlClass(invalid), 'h-10 px-3', className)}
      {...rest}
    />
  );
});

export interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
}

export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(function TextArea(
  { invalid, className, rows = 3, ...rest },
  ref,
) {
  return (
    <textarea
      ref={ref}
      rows={rows}
      aria-invalid={invalid || undefined}
      className={cn(controlClass(invalid), 'resize-y px-3 py-2 leading-6', className)}
      {...rest}
    />
  );
});

export interface SelectInputProps extends SelectHTMLAttributes<HTMLSelectElement> {
  invalid?: boolean;
  options: { value: string; label: string; disabled?: boolean }[];
  placeholder?: string;
}

export const SelectInput = forwardRef<HTMLSelectElement, SelectInputProps>(function SelectInput(
  { invalid, className, options, placeholder, ...rest },
  ref,
) {
  return (
    <div className={cn('relative', className)}>
      <select
        ref={ref}
        aria-invalid={invalid || undefined}
        className={cn(controlClass(invalid), 'h-10 appearance-none pl-3 pr-9')}
        {...rest}
      >
        {placeholder !== undefined ? <option value="">{placeholder}</option> : null}
        {options.map((o) => (
          <option key={o.value} value={o.value} disabled={o.disabled}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown
        size={15}
        aria-hidden
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
      />
    </div>
  );
});

export interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  ariaLabel?: string;
}

export function SearchInput({ value, onChange, placeholder, className, ariaLabel }: SearchInputProps) {
  return (
    <div className={cn('relative min-w-0', className)}>
      <Search
        size={15}
        aria-hidden
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
      />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel ?? placeholder}
        className={cn(controlClass(false), 'h-10 pl-9 pr-8')}
      />
      {value ? (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label="Xóa từ khóa"
          className="absolute right-2 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-full text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
        >
          <X size={13} />
        </button>
      ) : null}
    </div>
  );
}

export interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
  id?: string;
}

/** Công tắc bật/tắt gọn, dùng chung token màu của hệ thống. */
export function Toggle({ checked, onChange, label, disabled, id }: ToggleProps) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-150 disabled:opacity-50',
        checked ? 'bg-[var(--accent)]' : 'bg-[var(--border-strong)]',
      )}
    >
      <span
        className={cn(
          'inline-block h-5 w-5 rounded-full bg-white shadow-soft transition-transform duration-150',
          checked ? 'translate-x-[22px]' : 'translate-x-0.5',
        )}
      />
    </button>
  );
}

export interface ToggleRowProps extends ToggleProps {
  title: string;
  description?: string;
}

export function ToggleRow({ title, description, ...toggle }: ToggleRowProps) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-item border border-[var(--border)] px-4 py-3">
      <div className="min-w-0">
        <p className="text-[14px] font-semibold text-[var(--text-primary)]">{title}</p>
        {description ? (
          <p className="mt-0.5 text-[12.5px] leading-5 text-[var(--text-muted)]">{description}</p>
        ) : null}
      </div>
      <Toggle {...toggle} label={toggle.label ?? title} />
    </div>
  );
}

export interface ChipSelectProps {
  options: string[];
  value: string[];
  onChange: (value: string[]) => void;
  ariaLabel: string;
}

/** Chọn nhiều giá trị dạng chip (dị nguyên, thẻ AI...). */
export function ChipSelect({ options, value, onChange, ariaLabel }: ChipSelectProps) {
  return (
    <div role="group" aria-label={ariaLabel} className="flex flex-wrap gap-1.5">
      {options.map((option) => {
        const selected = value.includes(option);
        return (
          <button
            key={option}
            type="button"
            aria-pressed={selected}
            onClick={() =>
              onChange(selected ? value.filter((v) => v !== option) : [...value, option])
            }
            className={cn(
              'rounded-pill border px-3 py-1 text-[12.5px] font-medium transition-colors',
              selected
                ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]'
                : 'border-[var(--border-strong)] text-[var(--text-secondary)] hover:border-[var(--accent)] hover:text-[var(--accent)]',
            )}
          >
            {option}
          </button>
        );
      })}
    </div>
  );
}

export interface ImageUploadProps {
  value: string | null;
  onChange: (value: string | null) => void;
  error?: string;
  onError?: (message: string) => void;
  aspect?: 'square' | 'wide';
  label?: string;
}

/** Chọn ảnh JPG/PNG/WebP ≤ 2MB, xem trước ngay (mock upload bằng data URL). */
export function ImageUpload({
  value,
  onChange,
  error,
  onError,
  aspect = 'square',
  label = 'Chọn ảnh',
}: ImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    const problem = validateImageFile(file);
    if (problem) {
      if (onError) onError(problem);
      else toast.error(problem);
      return;
    }
    try {
      onChange(await prepareImage(file));
    } catch {
      const message = 'Không đọc được ảnh, file có thể bị hỏng. Vui lòng chọn ảnh khác';
      if (onError) onError(message);
      else toast.error(message);
    }
  };

  return (
    <div>
      <div
        className={cn(
          'relative overflow-hidden rounded-item border border-dashed bg-[var(--bg-subtle)]',
          error ? 'border-[var(--danger)]' : 'border-[var(--border-strong)]',
          aspect === 'square' ? 'w-full max-w-[220px]' : 'w-full',
        )}
        style={{ aspectRatio: aspect === 'square' ? '1 / 1' : '16 / 9' }}
      >
        {value ? (
          <>
            <img src={value} alt="Ảnh xem trước" className="h-full w-full object-cover" />
            <button
              type="button"
              onClick={() => onChange(null)}
              aria-label="Gỡ ảnh"
              className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-black/55 text-white hover:bg-black/70"
            >
              <Trash2 size={14} />
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex h-full w-full flex-col items-center justify-center gap-1.5 text-[var(--text-muted)] hover:text-[var(--accent)]"
          >
            <ImagePlus size={22} strokeWidth={1.6} />
            <span className="text-[12.5px] font-semibold">{label}</span>
            <span className="text-[11px]">JPG, PNG, WebP · tối đa 2 MB</span>
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          void handleFile(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
      {value ? (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="mt-2 text-[12.5px] font-semibold text-[var(--accent)] hover:underline"
        >
          Đổi ảnh khác
        </button>
      ) : null}
      {error ? <p className="mt-1 text-[12px] font-medium text-[var(--danger)]">{error}</p> : null}
    </div>
  );
}
