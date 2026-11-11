import type {
  InventoryResponse,
  PeriodKey,
  RevenueResponse,
  TopDishesResponse,
} from '@/types';

/**
 * [FAKE-DATA] Doanh thu mẫu theo từng mốc thời gian.
 * Chỉ dùng để dựng giao diện; backend sẽ thay bằng hệ thống thu ngân.
 */
interface RevenueSeed {
  total: number;
  orders: number;
  previousTotal: number;
  previousOrders: number;
  points: { label: string; current: number; previous: number }[];
}

const HOURS = [
  '10:00',
  '11:00',
  '12:00',
  '13:00',
  '14:00',
  '16:00',
  '17:00',
  '18:00',
  '19:00',
  '20:00',
  '21:00',
  '22:00',
];

function hourCurve(scale: number, offset: number): number[] {
  const shape = [4, 9, 16, 14, 7, 5, 8, 15, 22, 20, 12, 5];
  return shape.map((v, i) => Math.round((v * scale + ((i * 37 + offset) % 7) * scale * 0.35) / 1));
}

function buildHourPoints(scale: number, previousScale: number, offset: number) {
  const current = hourCurve(scale, offset);
  const previous = hourCurve(previousScale, offset + 3);
  return HOURS.map((label, i) => ({
    label,
    current: current[i] * 1000,
    previous: previous[i] * 1000,
  }));
}

function buildDayPoints(labels: string[], scale: number, previousScale: number) {
  return labels.map((label, i) => {
    const wave = 1 + Math.sin((i / labels.length) * Math.PI * 1.6) * 0.22;
    const prevWave = 1 + Math.cos((i / labels.length) * Math.PI * 1.4) * 0.18;
    return {
      label,
      current: Math.round(scale * wave * (i % 3 === 0 ? 0.92 : 1.06)),
      previous: Math.round(previousScale * prevWave),
    };
  });
}

const WEEK_LABELS = ['T2 04/11', 'T3 05/11', 'T4 06/11', 'T5 07/11', 'T6 08/11', 'T7 09/11', 'CN 10/11'];
const MONTH_LABELS = ['Tuần 1', 'Tuần 2', 'Tuần 3', 'Tuần 4', 'Tuần 5'];

export const revenueSeeds: Record<PeriodKey, RevenueSeed> = {
  today: {
    total: 12450000,
    orders: 68,
    previousTotal: 11320000,
    previousOrders: 63,
    points: buildHourPoints(90, 82, 1),
  },
  yesterday: {
    total: 11320000,
    orders: 63,
    previousTotal: 10480000,
    previousOrders: 59,
    points: buildHourPoints(82, 76, 4),
  },
  last7: {
    total: 86500000,
    orders: 452,
    previousTotal: 79800000,
    previousOrders: 431,
    points: buildDayPoints(WEEK_LABELS, 12400000, 11300000),
  },
  last30: {
    total: 352400000,
    orders: 1836,
    previousTotal: 338600000,
    previousOrders: 1794,
    points: buildDayPoints(
      ['Tuần 1', 'Tuần 2', 'Tuần 3', 'Tuần 4'],
      88000000,
      84500000,
    ),
  },
  thisMonth: {
    total: 128600000,
    orders: 694,
    previousTotal: 141200000,
    previousOrders: 748,
    points: buildDayPoints(MONTH_LABELS.slice(0, 3), 42000000, 46000000),
  },
  lastMonth: {
    total: 141200000,
    orders: 748,
    previousTotal: 132800000,
    previousOrders: 712,
    points: buildDayPoints(MONTH_LABELS, 35000000, 33000000),
  },
};

export function buildRevenueResponse(
  period: PeriodKey,
  comparing: boolean,
): RevenueResponse {
  const seed = revenueSeeds[period];
  const series = seed.points.map((p) => ({
    label: p.label,
    current: p.current,
    previous: comparing ? p.previous : 0,
  }));
  const change =
    seed.previousTotal > 0
      ? ((seed.total - seed.previousTotal) / seed.previousTotal) * 100
      : null;

  return {
    period,
    total: seed.total,
    orders: seed.orders,
    avgOrder: Math.round(seed.total / Math.max(1, seed.orders)),
    change,
    series,
    comparing,
    hasData: seed.total > 0,
  };
}

/** [FAKE-DATA] Kho: số liệu theo kỳ + danh sách nguyên liệu sắp hết. */
const inventoryByPeriod: Record<PeriodKey, Omit<InventoryResponse, 'period' | 'lowStock' | 'hasData'>> = {
  today: {
    purchaseCost: 3820000,
    pendingReceipts: 3,
    pendingReceiptsValue: 6120000,
    supplierDebt: 9450000,
    totalIngredients: 48,
    lowStockCount: 5,
    outOfStockCount: 1,
  },
  yesterday: {
    purchaseCost: 5140000,
    pendingReceipts: 2,
    pendingReceiptsValue: 4380000,
    supplierDebt: 9100000,
    totalIngredients: 48,
    lowStockCount: 4,
    outOfStockCount: 0,
  },
  last7: {
    purchaseCost: 27400000,
    pendingReceipts: 4,
    pendingReceiptsValue: 8360000,
    supplierDebt: 9450000,
    totalIngredients: 48,
    lowStockCount: 5,
    outOfStockCount: 1,
  },
  last30: {
    purchaseCost: 112800000,
    pendingReceipts: 5,
    pendingReceiptsValue: 11200000,
    supplierDebt: 9450000,
    totalIngredients: 48,
    lowStockCount: 6,
    outOfStockCount: 1,
  },
  thisMonth: {
    purchaseCost: 41800000,
    pendingReceipts: 4,
    pendingReceiptsValue: 8360000,
    supplierDebt: 9450000,
    totalIngredients: 48,
    lowStockCount: 5,
    outOfStockCount: 1,
  },
  lastMonth: {
    purchaseCost: 105600000,
    pendingReceipts: 2,
    pendingReceiptsValue: 3900000,
    supplierDebt: 8720000,
    totalIngredients: 47,
    lowStockCount: 3,
    outOfStockCount: 0,
  },
};

/** Tồn kho hiện tại — không phụ thuộc bộ lọc thời gian. */
export const currentStock: InventoryResponse['lowStock'] = [
  { id: 'ing-01', name: 'Thịt bò Úc thăn ngoại', unit: 'kg', onHand: 0, minLevel: 8, status: 'out' },
  { id: 'ing-02', name: 'Tôm sú tươi', unit: 'kg', onHand: 2.4, minLevel: 6, status: 'low' },
  { id: 'ing-03', name: 'Rau xà lách Romaine', unit: 'kg', onHand: 3.1, minLevel: 5, status: 'low' },
  { id: 'ing-04', name: 'Nấm hương khô', unit: 'kg', onHand: 1.2, minLevel: 2, status: 'low' },
  { id: 'ing-05', name: 'Dầu olive nguyên chất', unit: 'lít', onHand: 4, minLevel: 5, status: 'low' },
  { id: 'ing-06', name: 'Phô mai Parmesan', unit: 'kg', onHand: 1.8, minLevel: 3, status: 'low' },
];

export function buildInventoryResponse(period: PeriodKey): InventoryResponse {
  const base = inventoryByPeriod[period];
  const lowStock = currentStock.slice(0, Math.max(3, base.lowStockCount));
  return {
    period,
    ...base,
    lowStock,
    hasData: base.purchaseCost > 0 || base.totalIngredients > 0,
  };
}

/** [FAKE-DATA] Xếp hạng món bán chạy / bán chậm trong kỳ. */
const dishesByPeriod: Record<PeriodKey, { name: string; category: string; quantity: number; revenue: number }[]> = {
  today: [
    { name: 'Bò lúc lắc sốt tiêu đen', category: 'Món chính', quantity: 42, revenue: 7140000 },
    { name: 'Lẩu Thái hải sản', category: 'Lẩu', quantity: 31, revenue: 5890000 },
    { name: 'Gỏi cuốn tôm thịt', category: 'Khai vị', quantity: 28, revenue: 1960000 },
    { name: 'Cơm chiên hải sản', category: 'Món chính', quantity: 24, revenue: 2160000 },
    { name: 'Chè thái sầu riêng', category: 'Tráng miệng', quantity: 19, revenue: 950000 },
  ],
  yesterday: [
    { name: 'Lẩu Thái hải sản', category: 'Lẩu', quantity: 38, revenue: 7220000 },
    { name: 'Bò lúc lắc sốt tiêu đen', category: 'Món chính', quantity: 35, revenue: 5950000 },
    { name: 'Cơm chiên hải sản', category: 'Món chính', quantity: 29, revenue: 2610000 },
    { name: 'Gỏi cuốn tôm thịt', category: 'Khai vị', quantity: 22, revenue: 1540000 },
    { name: 'Bánh flan caramel', category: 'Tráng miệng', quantity: 17, revenue: 680000 },
  ],
  last7: [
    { name: 'Bò lúc lắc sốt tiêu đen', category: 'Món chính', quantity: 268, revenue: 45560000 },
    { name: 'Lẩu Thái hải sản', category: 'Lẩu', quantity: 214, revenue: 40660000 },
    { name: 'Gỏi cuốn tôm thịt', category: 'Khai vị', quantity: 186, revenue: 13020000 },
    { name: 'Cơm chiên hải sản', category: 'Món chính', quantity: 152, revenue: 13680000 },
    { name: 'Chè thái sầu riêng', category: 'Tráng miệng', quantity: 121, revenue: 6050000 },
  ],
  last30: [
    { name: 'Bò lúc lắc sốt tiêu đen', category: 'Món chính', quantity: 1124, revenue: 191080000 },
    { name: 'Lẩu Thái hải sản', category: 'Lẩu', quantity: 906, revenue: 172140000 },
    { name: 'Gỏi cuốn tôm thịt', category: 'Khai vị', quantity: 804, revenue: 56280000 },
    { name: 'Cơm chiên hải sản', category: 'Món chính', quantity: 668, revenue: 60120000 },
    { name: 'Chè thái sầu riêng', category: 'Tráng miệng', quantity: 512, revenue: 25600000 },
  ],
  thisMonth: [
    { name: 'Bò lúc lắc sốt tiêu đen', category: 'Món chính', quantity: 412, revenue: 70040000 },
    { name: 'Lẩu Thái hải sản', category: 'Lẩu', quantity: 338, revenue: 64220000 },
    { name: 'Gỏi cuốn tôm thịt', category: 'Khai vị', quantity: 296, revenue: 20720000 },
    { name: 'Cơm chiên hải sản', category: 'Món chính', quantity: 244, revenue: 21960000 },
    { name: 'Chè thái sầu riêng', category: 'Tráng miệng', quantity: 188, revenue: 9400000 },
  ],
  lastMonth: [
    { name: 'Lẩu Thái hải sản', category: 'Lẩu', quantity: 446, revenue: 84740000 },
    { name: 'Bò lúc lắc sốt tiêu đen', category: 'Món chính', quantity: 428, revenue: 72760000 },
    { name: 'Gỏi cuốn tôm thịt', category: 'Khai vị', quantity: 312, revenue: 21840000 },
    { name: 'Cơm chiên hải sản', category: 'Món chính', quantity: 258, revenue: 23220000 },
    { name: 'Bánh flan caramel', category: 'Tráng miệng', quantity: 204, revenue: 8160000 },
  ],
};

const slowDishes = [
  { name: 'Súp bào ngư vi cá', category: 'Khai vị', quantity: 3, revenue: 1140000 },
  { name: 'Cá hồi áp chảo sốt chanh dây', category: 'Món chính', quantity: 5, revenue: 1450000 },
  { name: 'Salad củ dền phô mai dê', category: 'Khai vị', quantity: 6, revenue: 720000 },
  { name: 'Trà đào cam sả', category: 'Đồ uống', quantity: 0, revenue: 0 },
  { name: 'Kem flan matcha', category: 'Tráng miệng', quantity: 0, revenue: 0 },
];

export function buildTopDishesResponse(period: PeriodKey): TopDishesResponse {
  const best = dishesByPeriod[period];
  const max = best.reduce((acc, d) => Math.max(acc, d.quantity), 0);

  return {
    period,
    best: best.map((d, i) => ({
      id: `dish-best-${period}-${i}`,
      ...d,
      share: max > 0 ? (d.quantity / max) * 100 : 0,
    })),
    slow: slowDishes.map((d, i) => ({
      id: `dish-slow-${period}-${i}`,
      ...d,
      share: 0,
    })),
    hasData: best.length > 0,
  };
}