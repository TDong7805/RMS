import { db, dayKey, payableOf, round3 } from '@/mocks/warehouse';
import { delay, fromDateKey, paginate, toDateKey } from '@/lib/mock';
import { matchesKeyword } from '@/lib/normalize';
import { levelOf, WAREHOUSE_PAGE_SIZE } from './warehouse-ingredients';
import type {
  StockLevel,
  StockMove,
  StockSummaryFilter,
  StockSummaryPage,
  WarehouseDashboard,
  WarehouseRange,
} from '@/types';

const RECEIPTS = new Set(['opening', 'po_receipt', 'direct_receipt']);
const PURCHASES = new Set(['po_receipt', 'direct_receipt']);

/** Từ ngày – đến ngày theo kỳ đã chọn (Tùy chọn: dùng from / to người dùng nhập). */
export function rangeOf(r: WarehouseRange): { from: string; to: string } {
  const todayKey = dayKey(0);
  if (r.period === 'today') return { from: todayKey, to: todayKey };
  if (r.period === 'last7') return { from: dayKey(-6), to: todayKey };
  if (r.period === 'thisMonth') return { from: `${todayKey.slice(0, 8)}01`, to: todayKey };
  return { from: r.from, to: r.to };
}

const keyOf = (m: StockMove) => toDateKey(new Date(m.at));
const valueOf = (m: StockMove) => Math.round(Math.abs(m.qtyChange) * m.unitCost);

function eachDay(from: string, to: string): string[] {
  const days: string[] = [];
  const cur = fromDateKey(from);
  const end = fromDateKey(to);
  while (cur <= end && days.length < 400) {
    days.push(toDateKey(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return days;
}

/**
 * [BACKEND-TODO] UC-KHO-01: GET /api/kho/dashboard?period=&from=&to=
 * Khối "hiện tại" tính tới lúc xem; khối "theo kỳ" tính trong khoảng from – to.
 */
export async function getWarehouseDashboard(r: WarehouseRange): Promise<WarehouseDashboard> {
  await delay(380);
  const { from, to } = rangeOf(r);
  const todayKey = dayKey(0);
  const soonKey = dayKey(2);
  const moves = db.moves.filter((m) => {
    const k = keyOf(m);
    return k >= from && k <= to;
  });

  const active = db.ingredients.filter((it) => it.status === 'active');
  const levels = active.map((it) => ({ it, level: levelOf(it) as StockLevel }));
  const openPos = db.purchaseOrders.filter((po) => po.status === 'ordered' && (po.receiveStatus === 'not_received' || po.receiveStatus === 'partial'));

  const series = eachDay(from, to).map((day) => {
    const ofDay = moves.filter((m) => keyOf(m) === day);
    return {
      label: `${day.slice(8)}/${day.slice(5, 7)}`,
      inValue: ofDay.filter((m) => PURCHASES.has(m.type)).reduce((s, m) => s + valueOf(m), 0),
      outValue: ofDay.filter((m) => m.type.startsWith('issue_')).reduce((s, m) => s + valueOf(m), 0),
    };
  });

  const lossMap = new Map<string, { ingredientId: string; name: string; unit: string; qty: number; value: number; source: 'waste' | 'stocktake' }>();
  moves
    .filter((m) => m.type === 'issue_waste' || (m.type === 'stocktake' && m.qtyChange < 0))
    .forEach((m) => {
      const source = m.type === 'issue_waste' ? 'waste' : 'stocktake';
      const key = `${m.ingredientId}-${source}`;
      const it = db.ingredients.find((x) => x.id === m.ingredientId)!;
      const row = lossMap.get(key) ?? { ingredientId: it.id, name: it.name, unit: it.unit, qty: 0, value: 0, source };
      row.qty = round3(row.qty + Math.abs(m.qtyChange));
      row.value += valueOf(m);
      lossMap.set(key, row);
    });

  return {
    stockValue: Math.round(db.ingredients.reduce((s, it) => s + it.onHand * (it.avgCost ?? 0), 0)),
    lowCount: levels.filter((x) => x.level === 'low').length,
    outCount: levels.filter((x) => x.level === 'out').length,
    pendingPurchaseCount: openPos.length,
    latePurchaseCount: openPos.filter((po) => po.expectedDate && po.expectedDate < todayKey).length,
    debt: db.purchaseOrders.reduce((s, po) => s + Math.max(0, payableOf(po) - po.paid), 0),
    purchaseTotal: moves.filter((m) => PURCHASES.has(m.type)).reduce((s, m) => s + valueOf(m), 0),
    issueValue: moves.filter((m) => m.type.startsWith('issue_')).reduce((s, m) => s + valueOf(m), 0),
    lossValue: [...lossMap.values()].reduce((s, x) => s + x.value, 0),
    series,
    needRestock: levels
      .filter((x) => x.level !== 'ok')
      .sort((a, b) => (a.level === b.level ? a.it.onHand / (a.it.minLevel || 1) - b.it.onHand / (b.it.minLevel || 1) : a.level === 'out' ? -1 : 1))
      .slice(0, 10)
      .map(({ it, level }) => ({ id: it.id, code: it.code, name: it.name, unit: it.unit, onHand: it.onHand, minLevel: it.minLevel, level })),
    pendingPurchases: openPos
      .slice()
      .sort((a, b) => (a.expectedDate ?? '9999').localeCompare(b.expectedDate ?? '9999'))
      .slice(0, 10)
      .map((po) => ({
        id: po.id,
        code: po.code,
        supplierName: db.suppliers.find((s) => s.id === po.supplierId)?.name ?? '—',
        expectedDate: po.expectedDate,
        receiveStatus: po.receiveStatus,
        due: !po.expectedDate ? null : po.expectedDate < todayKey ? 'late' : po.expectedDate <= soonKey ? 'soon' : null,
      })),
    stocktakes: db.stocktakes.filter((k) => k.status === 'pending' || k.status === 'rejected').sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    losses: [...lossMap.values()].sort((a, b) => b.value - a.value).slice(0, 10),
  };
}

/**
 * [BACKEND-TODO] Tab Nhập – xuất – tồn (UC-KHO-01): GET /api/kho/stock-summary?period=&from=&to=&keyword=&group=&page=
 * Tồn cuối kỳ = Tồn đầu kỳ + Nhập − Xuất ± Điều chỉnh.
 */
export async function getStockSummary(r: WarehouseRange, f: StockSummaryFilter): Promise<StockSummaryPage> {
  await delay(320);
  const { from, to } = rangeOf(r);
  const rows = db.ingredients
    .filter((it) => !f.keyword.trim() || matchesKeyword(it.name, f.keyword) || matchesKeyword(it.code, f.keyword))
    .filter((it) => !f.group || it.group === f.group)
    .map((it) => {
      let opening = 0;
      let inQty = 0;
      let outQty = 0;
      let adjustQty = 0;
      db.moves
        .filter((m) => m.ingredientId === it.id)
        .forEach((m) => {
          const k = keyOf(m);
          if (k < from) opening += m.qtyChange;
          else if (k <= to) {
            if (RECEIPTS.has(m.type)) inQty += m.qtyChange;
            else if (m.type.startsWith('issue_')) outQty += -m.qtyChange;
            else adjustQty += m.qtyChange;
          }
        });
      const closing = round3(opening + inQty - outQty + adjustQty);
      return {
        id: it.id,
        code: it.code,
        name: it.name,
        unit: it.unit,
        group: it.group,
        opening: round3(opening),
        inQty: round3(inQty),
        outQty: round3(outQty),
        adjustQty: round3(adjustQty),
        closing,
        closingValue: Math.round(closing * (it.avgCost ?? 0)),
      };
    })
    .sort((a, b) => a.code.localeCompare(b.code));
  const page = paginate(rows, f.page, WAREHOUSE_PAGE_SIZE);
  return { ...page, totalValue: rows.reduce((s, x) => s + x.closingValue, 0) };
}
