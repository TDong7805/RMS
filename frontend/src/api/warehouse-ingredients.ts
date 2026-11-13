import { db, applyMove, CURRENT_USER, nextCatalogCode, nextDocCode, round3, type IngredientRecord } from '@/mocks/warehouse';
import { pushNotification } from '@/api/notifications';
import { BusinessError, ValidationError, delay, paginate, toDateKey } from '@/lib/mock';
import { matchesKeyword, normalizeVi } from '@/lib/normalize';
import { INGREDIENT_GROUPS, STOCK_UNITS } from '@/features/warehouse/labels';
import type {
  Ingredient,
  IngredientDetail,
  IngredientFilter,
  IngredientInput,
  IngredientOption,
  IngredientStatus,
  Paged,
  StockCardFilter,
  StockLevel,
  StockMove,
} from '@/types';

/** Phải trùng kích thước trang ở backend khi có (quy ước chung: 10 dòng / trang). */
export const WAREHOUSE_PAGE_SIZE = 10;

const QTY_RE = /^\d+(\.\d{1,3})?$/;
const validQty = (n: number) => Number.isFinite(n) && n >= 0 && QTY_RE.test(String(n));

/* ---------------------------------------------------------------- Tính toán */

export function levelOf(it: IngredientRecord): StockLevel | null {
  if (it.status === 'inactive') return null;
  if (it.onHand <= 0) return 'out';
  if (it.onHand <= it.minLevel) return 'low';
  return 'ok';
}

function openPurchasesWith(ingredientId: string) {
  return db.purchaseOrders.filter(
    (po) =>
      po.status === 'ordered' &&
      (po.receiveStatus === 'not_received' || po.receiveStatus === 'partial') &&
      po.lines.some((l) => l.ingredientId === ingredientId && l.qtyReceived < l.qtyOrdered),
  );
}

/** Đã có dữ liệu dùng số lượng: sổ kho, phiếu mua, liên kết nhà cung cấp, công thức món. */
function hasUsage(id: string): boolean {
  return (
    db.moves.some((m) => m.ingredientId === id) ||
    db.purchaseOrders.some((po) => po.lines.some((l) => l.ingredientId === id)) ||
    db.links.some((l) => l.ingredientId === id) ||
    db.recipes.some((r) => r.ingredientId === id)
  );
}

function toIngredient(it: IngredientRecord): Ingredient {
  const used = hasUsage(it.id);
  return {
    ...it,
    stockLevel: levelOf(it),
    deletable: !used,
    unitLocked: used,
    openPurchaseCount: openPurchasesWith(it.id).length,
    dishNames: [...new Set(db.recipes.filter((r) => r.ingredientId === it.id).map((r) => r.dishName))],
  };
}

function findRecord(id: string): IngredientRecord {
  const it = db.ingredients.find((x) => x.id === id);
  if (!it) throw new BusinessError('Không tìm thấy nguyên liệu', 404);
  return it;
}

/* ---------------------------------------------------------------- Đọc */

/**
 * [BACKEND-TODO] UC-KHO-02: GET /api/kho/ingredients?keyword=&group=&status=&stock=&page=
 * Trả Paged<Ingredient>, sắp theo mã tăng dần, 10 dòng / trang.
 */
export async function getIngredients(f: IngredientFilter): Promise<Paged<Ingredient>> {
  await delay(260);
  const items = db.ingredients
    .filter((it) => !f.keyword.trim() || matchesKeyword(it.name, f.keyword) || matchesKeyword(it.code, f.keyword))
    .filter((it) => !f.group || it.group === f.group)
    .filter((it) => f.status === 'all' || it.status === f.status)
    .filter((it) => f.stock === 'all' || levelOf(it) === f.stock)
    .sort((a, b) => a.code.localeCompare(b.code))
    .map(toIngredient);
  return paginate(items, f.page, WAREHOUSE_PAGE_SIZE);
}

/** [BACKEND-TODO] UC-KHO-06: GET /api/kho/ingredients/{id} */
export async function getIngredient(id: string): Promise<IngredientDetail> {
  await delay(240);
  const it = findRecord(id);
  const pendingQty = openPurchasesWith(id).reduce(
    (sum, po) => sum + po.lines.filter((l) => l.ingredientId === id).reduce((s, l) => s + (l.qtyOrdered - l.qtyReceived) * l.factor, 0),
    0,
  );
  const suppliers = db.links
    .filter((l) => l.ingredientId === id)
    .map((l) => {
      const sup = db.suppliers.find((s) => s.id === l.supplierId)!;
      return {
        supplierId: sup.id,
        supplierCode: sup.code,
        supplierName: sup.name,
        supplierActive: sup.status === 'active',
        purchaseUnit: l.purchaseUnit,
        factor: l.factor,
        price: l.price,
        minOrder: l.minOrder,
        linkActive: l.status === 'active',
      };
    })
    .sort((a, b) => a.supplierCode.localeCompare(b.supplierCode));
  const dishes = db.recipes
    .filter((r) => r.ingredientId === id)
    .map((r) => ({ code: r.dishCode, name: r.dishName, qty: r.qty }));
  return { ...toIngredient(it), pendingQty: round3(pendingQty), suppliers, dishes };
}

/** [BACKEND-TODO] Danh sách gọn cho ô chọn nguyên liệu: GET /api/kho/ingredients/options */
export async function getIngredientOptions(): Promise<IngredientOption[]> {
  await delay(150);
  return db.ingredients
    .map((it) => ({ id: it.id, code: it.code, name: it.name, unit: it.unit, active: it.status === 'active', avgCost: it.avgCost, onHand: it.onHand }))
    .sort((a, b) => a.name.localeCompare(b.name, 'vi'));
}

/**
 * [BACKEND-TODO] Thẻ kho (UC-KHO-06): GET /api/kho/ingredients/{id}/moves?from=&to=&type=&page=
 * Mới nhất trước; "Tồn sau" tính theo thứ tự ghi sổ.
 */
export async function getStockCard(id: string, f: StockCardFilter): Promise<Paged<StockMove>> {
  await delay(220);
  findRecord(id);
  const inRange = (iso: string) => {
    const key = toDateKey(new Date(iso));
    return (!f.from || key >= f.from) && (!f.to || key <= f.to);
  };
  const typeOk = (m: StockMove) =>
    f.type === 'all' ||
    (f.type === 'in' && (m.type === 'opening' || m.type === 'po_receipt' || m.type === 'direct_receipt')) ||
    (f.type === 'out' && m.type.startsWith('issue_')) ||
    (f.type === 'adjust' && (m.type === 'stocktake' || m.type === 'receipt_cancel'));
  const items = db.moves
    .filter((m) => m.ingredientId === id && inRange(m.at) && typeOk(m))
    .sort((a, b) => (a.at === b.at ? Number(b.id.slice(3)) - Number(a.id.slice(3)) : b.at.localeCompare(a.at)));
  return paginate(items, f.page, WAREHOUSE_PAGE_SIZE);
}

/* ---------------------------------------------------------------- Ghi */

function validate(input: IngredientInput, current: IngredientRecord | null): { name: string } {
  const fields: Record<string, string> = {};
  const name = input.name.trim().replace(/\s+/g, ' ');
  if (!name) fields.name = 'Vui lòng nhập tên nguyên liệu';
  else if (name.length < 2 || name.length > 100) fields.name = 'Tên nguyên liệu dài từ 2 đến 100 ký tự';
  else {
    const dup = db.ingredients.find((x) => x.id !== current?.id && normalizeVi(x.name) === normalizeVi(name));
    if (dup) fields.name = `Nguyên liệu ${dup.name} đã tồn tại (${dup.code})`;
  }
  if (!input.group || !(input.group in INGREDIENT_GROUPS)) fields.group = 'Vui lòng chọn nhóm nguyên liệu';
  if (!input.unit || !STOCK_UNITS.includes(input.unit)) fields.unit = 'Vui lòng chọn đơn vị kho';
  else if (current && current.unit !== input.unit && hasUsage(current.id)) fields.unit = 'Không thể đổi đơn vị kho của nguyên liệu đã có giao dịch';
  if (!validQty(input.minLevel)) fields.minLevel = 'Số lượng phải là số không âm, tối đa 3 chữ số thập phân';
  if (!current) {
    const qty = input.openingQty ?? 0;
    if (!validQty(qty)) fields.openingQty = 'Số lượng phải là số không âm, tối đa 3 chữ số thập phân';
    else if (qty > 0 && !(input.openingCost && input.openingCost > 0)) fields.openingCost = 'Vui lòng nhập giá vốn ban đầu lớn hơn 0';
  }
  if (input.note.length > 300) fields.note = 'Ghi chú tối đa 300 ký tự';
  if (Object.keys(fields).length) throw new ValidationError(fields);
  return { name };
}

/** [BACKEND-TODO] UC-KHO-03: POST /api/kho/ingredients (tồn ban đầu > 0 thì tạo phiếu nhập "Tồn đầu kỳ"). */
export async function createIngredient(input: IngredientInput): Promise<Ingredient> {
  await delay(380);
  const { name } = validate(input, null);
  const now = new Date().toISOString();
  const rec: IngredientRecord = {
    id: `nl-${Date.now().toString(36)}`,
    code: nextCatalogCode(db, 'NL'),
    name,
    group: input.group as IngredientRecord['group'],
    unit: input.unit,
    minLevel: input.minLevel,
    onHand: 0,
    avgCost: null,
    status: 'active',
    note: input.note.trim(),
    createdAt: now,
    createdBy: CURRENT_USER,
    updatedAt: now,
  };
  db.ingredients.push(rec);
  if ((input.openingQty ?? 0) > 0) {
    applyMove(db, rec.id, 'opening', input.openingQty!, input.openingCost!, now, nextDocCode(db, 'PN', now));
  }
  return toIngredient(rec);
}

/** [BACKEND-TODO] UC-KHO-04: PUT /api/kho/ingredients/{id} */
export async function updateIngredient(id: string, input: IngredientInput): Promise<Ingredient> {
  await delay(380);
  const rec = findRecord(id);
  const { name } = validate(input, rec);
  const wasOk = levelOf(rec) === 'ok';
  Object.assign(rec, {
    name,
    group: input.group,
    unit: input.unit,
    minLevel: input.minLevel,
    note: input.note.trim(),
    updatedAt: new Date().toISOString(),
  });
  // Tồn tối thiểu mới làm nguyên liệu chuyển sang "Sắp hết" → thông báo (UC-KHO-04, 6a).
  if (wasOk && levelOf(rec) === 'low') {
    pushNotification('warehouse', {
      type: 'inventory',
      title: `${rec.name} sắp hết`,
      description: `Tồn ${rec.onHand} ${rec.unit}, không quá mức tối thiểu ${rec.minLevel} ${rec.unit}.`,
      href: `/kho/nguyen-lieu/${rec.id}`,
    });
  }
  return toIngredient(rec);
}

/** [BACKEND-TODO] UC-KHO-05: PATCH /api/kho/ingredients/{id}/status */
export async function setIngredientStatus(id: string, status: IngredientStatus): Promise<Ingredient> {
  await delay(300);
  const rec = findRecord(id);
  if (rec.status === status) {
    throw new BusinessError(`Nguyên liệu đã ở trạng thái ${status === 'active' ? 'Đang sử dụng' : 'Ngừng sử dụng'}`, 409);
  }
  rec.status = status;
  rec.updatedAt = new Date().toISOString();
  return toIngredient(rec);
}

/** [BACKEND-TODO] UC-KHO-05 (xóa): DELETE /api/kho/ingredients/{id} — chỉ khi chưa phát sinh dữ liệu. */
export async function deleteIngredient(id: string): Promise<void> {
  await delay(300);
  const rec = findRecord(id);
  if (hasUsage(rec.id)) {
    throw new BusinessError(
      'Nguyên liệu đã có giao dịch kho, phiếu mua, liên kết nhà cung cấp hoặc nằm trong công thức món nên không thể xóa. Bạn có thể ngừng sử dụng nguyên liệu này.',
      409,
    );
  }
  db.ingredients = db.ingredients.filter((x) => x.id !== id);
}
