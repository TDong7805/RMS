/**
 * Tiện ích dùng chung cho lớp API giả lập (mock). Khi có backend thật, các hàm trong src/api
 * sẽ gọi HTTP thay vì thao tác trên store trong bộ nhớ, nhưng vẫn ném ValidationError
 * (map từ HTTP 422) để form hiển thị lỗi theo từng trường.
 */

export const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

let seq = 1000;
export function uid(prefix: string): string {
  seq += 1;
  return `${prefix}-${Date.now().toString(36)}${seq}`;
}

/** Lỗi nghiệp vụ có chỉ rõ trường sai — dùng cho luồng "Thông tin không hợp lệ". */
export class ValidationError extends Error {
  fields: Record<string, string>;

  constructor(fields: Record<string, string>, message = 'Thông tin chưa hợp lệ') {
    super(message);
    this.name = 'ValidationError';
    this.fields = fields;
  }
}

/** Lỗi nghiệp vụ chung (không gắn với trường cụ thể), ví dụ "Không thể xóa ca làm việc này". */
export class BusinessError extends Error {
  /** Mã HTTP khi lỗi đến từ backend (vd. 401, 403, 409); không có với lỗi của dữ liệu giả. */
  status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = 'BusinessError';
    this.status = status;
  }
}

export function isValidationError(error: unknown): error is ValidationError {
  return error instanceof ValidationError;
}

export function errorMessage(error: unknown, fallback = 'Đã có lỗi xảy ra, vui lòng thử lại'): string {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

/** "2026-11-11" theo giờ địa phương. */
export function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** "2026-11-11" -> Date (00:00 giờ địa phương), tránh lệch ngày do parse theo UTC. */
export function fromDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** "08:30" -> 510 */
export function timeToMinutes(value: string): number {
  const [h, m] = value.split(':').map(Number);
  return h * 60 + m;
}

export function minutesToTime(total: number): string {
  const t = ((total % 1440) + 1440) % 1440;
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
}

export const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
export const PHONE_RE = /^(0|\+84)(3|5|7|8|9)\d{8}$/;
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function paginate<T>(items: T[], page: number, pageSize: number) {
  const total = items.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), pageCount);
  return {
    items: items.slice((safePage - 1) * pageSize, safePage * pageSize),
    total,
    page: safePage,
    pageCount,
  };
}

export function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function collapseSpaces(input: string): string {
  return input.replace(/\s+/g, ' ').trim();
}

/** Tải một chuỗi thành file về máy (dùng cho xuất CSV, tải bản sao lưu). */
export function downloadText(filename: string, content: string, mime = 'text/plain'): void {
  downloadBlob(filename, new Blob([content], { type: `${mime};charset=utf-8` }));
}

/** Lưu một Blob (vd. file sao lưu .zip tải từ máy chủ) xuống máy người dùng. */
export function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

/** Kiểm tra ảnh tải lên: JPG/PNG/WebP, tối đa 2MB. Trả về thông báo lỗi hoặc null. */
export function validateImageFile(file: File): string | null {
  if (!IMAGE_TYPES.includes(file.type)) return 'Chỉ chấp nhận ảnh JPG, PNG hoặc WebP';
  if (file.size > MAX_IMAGE_BYTES) return 'Ảnh vượt quá dung lượng cho phép (2 MB)';
  return null;
}
