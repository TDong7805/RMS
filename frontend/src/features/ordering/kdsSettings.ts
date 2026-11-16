import { useSyncExternalStore } from 'react';

/**
 * Cài đặt hiển thị của màn hình bếp — lưu trong máy (localStorage), mỗi màn hình bếp một cài đặt riêng:
 * nền sáng / tối, số cột, cỡ chữ, các mốc màu cảnh báo theo thời gian chờ, danh mục món màn này phụ trách (trạm).
 */

export type KdsMode = 'light' | 'dark';
export type KdsColumns = 'auto' | 2 | 3 | 4 | 5 | 6;
export type KdsTextSize = 'sm' | 'md' | 'lg' | 'xl';
export type KdsColor = 'yellow' | 'orange' | 'red' | 'purple';

export interface KdsThreshold {
  minutes: number;
  color: KdsColor;
}

export interface KdsSettings {
  mode: KdsMode;
  columns: KdsColumns;
  textSize: KdsTextSize;
  /** Tối đa 4 mốc, sắp tăng dần theo phút. */
  thresholds: KdsThreshold[];
  /** Danh mục món màn này phụ trách; rỗng = tất cả. */
  stationCategories: string[];
}

export const KDS_COLORS: Record<KdsColor, { label: string; bg: string; text: string }> = {
  yellow: { label: 'Vàng', bg: '#eab308', text: '#1a1400' },
  orange: { label: 'Cam', bg: '#f97316', text: '#ffffff' },
  red: { label: 'Đỏ', bg: '#dc2626', text: '#ffffff' },
  purple: { label: 'Tím', bg: '#9333ea', text: '#ffffff' },
};

export const TEXT_SIZES: Record<KdsTextSize, { label: string; zoom: number }> = {
  sm: { label: 'Nhỏ', zoom: 0.9 },
  md: { label: 'Vừa', zoom: 1 },
  lg: { label: 'Lớn', zoom: 1.15 },
  xl: { label: 'Rất lớn', zoom: 1.3 },
};

export const MAX_THRESHOLDS = 4;

export const DEFAULT_KDS_SETTINGS: KdsSettings = {
  mode: 'light',
  columns: 'auto',
  textSize: 'md',
  thresholds: [
    { minutes: 10, color: 'yellow' },
    { minutes: 20, color: 'orange' },
    { minutes: 30, color: 'red' },
  ],
  stationCategories: [],
};

const KEY = 'rms-kds-settings';
const listeners = new Set<() => void>();

function sanitize(raw: unknown): KdsSettings {
  const d = DEFAULT_KDS_SETTINGS;
  if (!raw || typeof raw !== 'object') return d;
  const r = raw as Partial<KdsSettings>;
  const thresholds = Array.isArray(r.thresholds)
    ? r.thresholds
        .filter((t) => t && Number.isFinite(t.minutes) && t.minutes > 0 && t.color in KDS_COLORS)
        .map((t) => ({ minutes: Math.min(600, Math.round(t.minutes)), color: t.color }))
        .sort((a, b) => a.minutes - b.minutes)
        .slice(0, MAX_THRESHOLDS)
    : d.thresholds;
  return {
    mode: r.mode === 'dark' ? 'dark' : 'light',
    columns: r.columns === 'auto' || [2, 3, 4, 5, 6].includes(r.columns as number) ? (r.columns as KdsColumns) : d.columns,
    textSize: r.textSize && r.textSize in TEXT_SIZES ? r.textSize : d.textSize,
    thresholds,
    stationCategories: Array.isArray(r.stationCategories) ? r.stationCategories.filter((x) => typeof x === 'string') : [],
  };
}

let cache: KdsSettings | null = null;

function read(): KdsSettings {
  if (cache) return cache;
  try {
    cache = sanitize(JSON.parse(localStorage.getItem(KEY) ?? 'null'));
  } catch {
    cache = DEFAULT_KDS_SETTINGS;
  }
  return cache;
}

export function saveKdsSettings(next: KdsSettings): void {
  cache = sanitize(next);
  try {
    localStorage.setItem(KEY, JSON.stringify(cache));
  } catch {
    /* Máy chặn lưu trữ: vẫn dùng được trong phiên này. */
  }
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      cache = null;
      l();
    }
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(l);
    window.removeEventListener('storage', onStorage);
  };
}

export function useKdsSettings(): [KdsSettings, (patch: Partial<KdsSettings>) => void] {
  const s = useSyncExternalStore(subscribe, read, () => DEFAULT_KDS_SETTINGS);
  return [s, (patch) => saveKdsSettings({ ...read(), ...patch })];
}

/** Mốc màu áp dụng cho số phút chờ (mốc lớn nhất đã vượt), chưa tới mốc nào thì null. */
export function thresholdFor(minutes: number, thresholds: KdsThreshold[]): KdsThreshold | null {
  let hit: KdsThreshold | null = null;
  for (const t of thresholds) if (minutes >= t.minutes) hit = t;
  return hit;
}
