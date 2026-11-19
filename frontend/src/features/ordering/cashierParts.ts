import type { BadgeVariant } from '@/components/common/Badge';
import type { InvoiceStatus, OrderRow, RequestStatus } from '@/types';

/** Ngày hôm nay dạng yyyy-MM-dd theo giờ máy. */
export function todayKey(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Lỗi khoảng ngày lọc (tối đa 31 ngày) — trùng quy tắc của máy chủ. */
export function rangeError(from: string, to: string): string {
  if (!from || !to) return 'Vui lòng chọn khoảng ngày';
  if (from > to) return 'Đến ngày phải sau Từ ngày';
  const days = (new Date(to).getTime() - new Date(from).getTime()) / 86_400_000;
  return days >= 31 ? 'Khoảng ngày tối đa 31 ngày' : '';
}

export const minutesSince = (iso: string) => Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60_000));

export const ORDER_ROW_STATUS: Record<OrderRow['status'], { label: string; variant: BadgeVariant }> = {
  open: { label: 'Đang mở', variant: 'accent' },
  awaiting_payment: { label: 'Chờ thanh toán', variant: 'warning' },
  completed: { label: 'Hoàn tất', variant: 'info' },
  cancelled: { label: 'Đã hủy', variant: 'danger' },
};

export const INVOICE_STATUS: Record<InvoiceStatus, { label: string; variant: BadgeVariant }> = {
  unpaid: { label: 'Chưa thanh toán', variant: 'warning' },
  paid: { label: 'Đã thanh toán', variant: 'accent' },
  cancelled: { label: 'Đã hủy', variant: 'danger' },
};

export const REQUEST_STATUS: Record<RequestStatus, { label: string; variant: BadgeVariant }> = {
  new: { label: 'Mới', variant: 'warning' },
  forwarded: { label: 'Đã báo NV', variant: 'info' },
  done: { label: 'Hoàn thành', variant: 'accent' },
  cancelled: { label: 'Đã hủy', variant: 'neutral' },
};
