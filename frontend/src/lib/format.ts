import type { PeriodKey } from '@/types';

const vnd = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 });

/** 1245000 -> "1.245.000" */
export function formatNumber(value: number): string {
  return vnd.format(Math.round(value));
}

/** 1245000 -> "1.245.000 ₫" */
export function formatCurrency(value: number): string {
  return `${vnd.format(Math.round(value))} ₫`;
}

/** Rút gọn cho nhãn biểu đồ: 1200000 -> "1,2 tr" */
export function formatCompactCurrency(value: number): string {
  if (Math.abs(value) >= 1_000_000_000) {
    return `${(value / 1_000_000_000).toFixed(1).replace('.', ',')} tỷ`;
  }
  if (Math.abs(value) >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(value >= 10_000_000 ? 0 : 1).replace('.', ',')} tr`;
  }
  if (Math.abs(value) >= 1_000) {
    return `${(value / 1_000).toFixed(0)}k`;
  }
  return `${vnd.format(value)}`;
}

export function formatPercent(value: number | null, digits = 1): string {
  if (value === null || Number.isNaN(value)) return '—';
  const fixed = Math.abs(value).toFixed(digits).replace('.', ',');
  return `${value > 0 ? '+' : value < 0 ? '−' : ''}${fixed}%`;
}

const VI_MONTHS = [
  '01',
  '02',
  '03',
  '04',
  '05',
  '06',
  '07',
  '08',
  '09',
  '10',
  '11',
  '12',
];

/** 2026-11-10 -> "10/11" */
export function formatDayMonth(date: Date): string {
  return `${String(date.getDate()).padStart(2, '0')}/${VI_MONTHS[date.getMonth()]}`;
}

/** 2026-11-10 -> "10/11/2026" */
export function formatDate(date: Date): string {
  return `${formatDayMonth(date)}/${date.getFullYear()}`;
}

const RELATIVE_UNITS: { limit: number; divisor: number; label: string }[] = [
  { limit: 60, divisor: 1, label: 'giây' },
  { limit: 3600, divisor: 60, label: 'phút' },
  { limit: 86400, divisor: 3600, label: 'giờ' },
  { limit: 604800, divisor: 86400, label: 'ngày' },
];

/** "5 phút trước", "3 giờ trước", "2 ngày trước" — dùng font mono khi hiển thị. */
export function formatRelativeTime(iso: string, now: Date = new Date()): string {
  const diffSeconds = Math.max(
    0,
    Math.floor((now.getTime() - new Date(iso).getTime()) / 1000),
  );

  if (diffSeconds < 30) return 'vừa xong';

  for (const unit of RELATIVE_UNITS) {
    if (diffSeconds < unit.limit) {
      const value = Math.max(1, Math.floor(diffSeconds / unit.divisor));
      return `${value} ${unit.label} trước`;
    }
  }

  const weeks = Math.floor(diffSeconds / 604800);
  if (weeks < 5) return `${weeks} tuần trước`;
  return formatDate(new Date(iso));
}

export function formatTime(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** Nhãn ngắn gọn cho bộ lọc, không kèm ngày cụ thể (theo yêu cầu giao diện). */
export const PERIOD_LABELS: Record<PeriodKey, string> = {
  today: 'Hôm nay',
  yesterday: 'Hôm qua',
  last7: '7 ngày qua',
  last30: '30 ngày qua',
  thisMonth: 'Tháng này',
  lastMonth: 'Tháng trước',
};

export const PERIOD_OPTIONS: { key: PeriodKey; label: string }[] = (
  ['today', 'yesterday', 'last7', 'last30', 'thisMonth', 'lastMonth'] as PeriodKey[]
).map((key) => ({ key, label: PERIOD_LABELS[key] }));

export function statusLabel(status: 'ok' | 'low' | 'out'): string {
  if (status === 'out') return 'Đã hết';
  if (status === 'low') return 'Sắp hết';
  return 'Đủ hàng';
}

/** Chia số lượng để hiển thị dạng "12,5 kg" gọn gàng. */
export function formatQuantity(value: number, unit: string): string {
  const formatted = Number.isInteger(value)
    ? vnd.format(value)
    : value.toFixed(1).replace('.', ',');
  return `${formatted} ${unit}`;
}