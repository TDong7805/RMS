import { db, CURRENT_USER, dayKey, nextCatalogCode, type LinkRecord, type SupplierRecord } from '@/mocks/warehouse';
import { BusinessError, EMAIL_RE, PHONE_RE, ValidationError, delay, paginate } from '@/lib/mock';
import { matchesKeyword, normalizeVi } from '@/lib/normalize';
import { PURCHASE_UNITS } from '@/features/warehouse/labels';
import { WAREHOUSE_PAGE_SIZE } from './warehouse-ingredients';
import type {
  Paged,
  PriceChange,
  PriceRecord,
  Supplier,
  SupplierDetail,
  SupplierFilter,
  SupplierInput,
  SupplierLink,
  SupplierLinkInput,
  SupplierStopReason,
} from '@/types';

/** Số máy bàn: 02x + 8 chữ số (ví dụ 02838123456). Di động dùng PHONE_RE như trang quản lý. */
const LANDLINE_RE = /^02\d{9}$/;
const WEBSITE_RE = /^https?:\/\/\S+$/i;
const TAX_RE = /^\d{10}(-\d{3})?$/;
const FACTOR_RE = /^\d+(\.\d{1,3})?$/;

const today = () => dayKey(0);
const yesterday = () => dayKey(-1);

/* ---------------------------------------------------------------- Chuyển đổi */

function toSupplier(s: SupplierRecord): Supplier {
  const pos = db.purchaseOrders.filter((po) => po.supplierId === s.id);
  return {
    ...s,
    activeLinkCount: db.links.filter((l) => l.supplierId === s.id && l.status === 'active').length,
    hasPurchases: pos.length > 0,
    openPurchaseCount: pos.filter((po) => po.status === 'ordered' && (po.receiveStatus === 'not_received' || po.receiveStatus === 'partial')).length,
  };
}

function toLink(l: LinkRecord): SupplierLink {
  const it = db.ingredients.find((x) => x.id === l.ingredientId)!;
  return {
    ...l,
    ingredientCode: it.code,
    ingredientName: it.name,
    stockUnit: it.unit,
    ingredientActive: it.status === 'active',
  };
}

function findSupplier(id: string): SupplierRecord {
  const s = db.suppliers.find((x) => x.id === id);
  if (!s) throw new BusinessError('Không tìm thấy nhà cung cấp', 404);
  return s;
}

function findLink(id: string): LinkRecord {
  const l = db.links.find((x) => x.id === id);
  if (!l) throw new BusinessError('Không tìm thấy liên kết nguyên liệu', 404);
  return l;
}

/* ---------------------------------------------------------------- Đọc */

/** [BACKEND-TODO] UC-KHO-07: GET /api/kho/suppliers?keyword=&status=&page= (sắp theo mã, 10 dòng / trang). */
export async function getSuppliers(f: SupplierFilter): Promise<Paged<Supplier>> {
  await delay(260);
  const items = db.suppliers
    .filter((s) => !f.keyword.trim() || matchesKeyword(s.name, f.keyword) || matchesKeyword(s.code, f.keyword) || s.phone.includes(f.keyword.trim()))
    .filter((s) => f.status === 'all' || s.status === f.status)
    .sort((a, b) => a.code.localeCompare(b.code))
    .map(toSupplier);
  return paginate(items, f.page, WAREHOUSE_PAGE_SIZE);
}

/** [BACKEND-TODO] UC-KHO-11: GET /api/kho/suppliers/{id} (kèm liên kết nguyên liệu và lịch sử trạng thái). */
export async function getSupplier(id: string): Promise<SupplierDetail> {
  await delay(240);
  const s = findSupplier(id);
  return {
    ...toSupplier(s),
    links: db.links
      .filter((l) => l.supplierId === id)
      .map(toLink)
      .sort((a, b) => a.ingredientCode.localeCompare(b.ingredientCode)),
    history: db.supplierEvents
      .filter((e) => e.supplierId === id)
      .map(({ supplierId: _ignored, ...e }) => e)
      .sort((a, b) => b.at.localeCompare(a.at)),
  };
}

/** Kiểm tra trùng tên (UC-KHO-08 7j, UC-KHO-09 5g) — chỉ cảnh báo, người dùng vẫn được lưu. */
export async function findSupplierByName(name: string, exceptId?: string): Promise<{ id: string; code: string; name: string } | null> {
  await delay(120);
  const key = normalizeVi(name.trim().replace(/\s+/g, ' '));
  const dup = db.suppliers.find((s) => s.id !== exceptId && normalizeVi(s.name) === key);
  return dup ? { id: dup.id, code: dup.code, name: dup.name } : null;
}

/** [BACKEND-TODO] GET /api/kho/supplier-links/{id}/prices — mới nhất trước. */
export async function getPriceHistory(linkId: string): Promise<PriceRecord[]> {
  await delay(200);
  findLink(linkId);
  return db.prices.filter((p) => p.linkId === linkId).sort((a, b) => b.from.localeCompare(a.from) || b.at.localeCompare(a.at));
}

/* ---------------------------------------------------------------- Kiểm tra dữ liệu */

function validateInfo(input: SupplierInput, currentId: string | null, fields: Record<string, string>): string {
  const name = input.name.trim().replace(/\s+/g, ' ');
  if (!name) fields.name = 'Vui lòng nhập tên nhà cung cấp';
  else if (name.length < 2 || name.length > 150) fields.name = 'Tên nhà cung cấp dài từ 2 đến 150 ký tự';
  const phone = input.phone.trim();
  if (!phone) fields.phone = 'Vui lòng nhập số điện thoại';
  else if (!PHONE_RE.test(phone) && !LANDLINE_RE.test(phone)) fields.phone = 'Số điện thoại không đúng định dạng (VD: 0912345678)';
  if (!input.paymentMethod) fields.paymentMethod = 'Vui lòng chọn phương thức thanh toán';
  if (input.contact.trim().length > 100) fields.contact = 'Người liên hệ tối đa 100 ký tự';
  const email = input.email.trim();
  if (email && (!EMAIL_RE.test(email) || email.length > 150)) fields.email = 'Email không đúng định dạng';
  const website = input.website.trim();
  if (website && (!WEBSITE_RE.test(website) || website.length > 200)) fields.website = 'Website phải bắt đầu bằng http:// hoặc https://';
  const tax = input.taxCode.trim();
  if (tax && !TAX_RE.test(tax)) fields.taxCode = 'Mã số thuế gồm 10 chữ số hoặc có dạng 0123456789-001';
  else if (tax) {
    const dup = db.suppliers.find((s) => s.id !== currentId && s.taxCode === tax);
    if (dup) fields.taxCode = `Mã số thuế đã được dùng cho nhà cung cấp ${dup.name} (${dup.code})`;
  }
  if (input.address.trim().length > 300) fields.address = 'Địa chỉ tối đa 300 ký tự';
  if (input.note.trim().length > 500) fields.note = 'Ghi chú tối đa 500 ký tự';
  return name;
}

/** Kiểm tra một dòng liên kết; key là tiền tố tên trường để báo lỗi đúng dòng. */
function validateLink(link: SupplierLinkInput, key: string, fields: Record<string, string>, stockUnitOf: (id: string) => string | null) {
  if (!link.ingredientId) fields[`${key}ingredientId`] = 'Vui lòng chọn nguyên liệu';
  else {
    const it = db.ingredients.find((x) => x.id === link.ingredientId);
    if (!it) fields[`${key}ingredientId`] = 'Không tìm thấy nguyên liệu';
    else if (it.status !== 'active') fields[`${key}ingredientId`] = `Nguyên liệu ${it.name} đã ngừng sử dụng, vui lòng bỏ dòng này`;
  }
  if (!PURCHASE_UNITS.includes(link.purchaseUnit)) fields[`${key}purchaseUnit`] = 'Vui lòng chọn đơn vị mua';
  if (!(link.factor > 0) || !FACTOR_RE.test(String(link.factor))) fields[`${key}factor`] = 'Hệ số quy đổi phải lớn hơn 0';
  else if (link.ingredientId && stockUnitOf(link.ingredientId) === link.purchaseUnit && link.factor !== 1) {
    fields[`${key}factor`] = 'Đơn vị mua trùng đơn vị kho thì hệ số bằng 1';
  }
  if (!(link.price > 0) || !Number.isInteger(link.price)) fields[`${key}price`] = 'Giá nhập phải lớn hơn 0';
  if (link.minOrder !== null && !(link.minOrder > 0)) fields[`${key}minOrder`] = 'Số lượng tối thiểu phải là số dương';
}

const stockUnitOf = (id: string) => db.ingredients.find((x) => x.id === id)?.unit ?? null;

function pushPrice(link: LinkRecord, change: PriceChange) {
  const now = new Date().toISOString();
  const current = db.prices.find((p) => p.linkId === link.id && p.to === null);
  // Đổi lần nữa trong cùng ngày: cập nhật bản ghi của hôm nay, không tạo thêm (UC-KHO-11).
  if (current && current.from === today()) {
    Object.assign(current, { price: link.price, purchaseUnit: link.purchaseUnit, factor: link.factor, minOrder: link.minOrder, change, by: CURRENT_USER, at: now });
    return;
  }
  if (current) current.to = yesterday();
  db.prices.push({
    id: `pr-${link.id}-${Date.now().toString(36)}`,
    linkId: link.id,
    price: link.price,
    purchaseUnit: link.purchaseUnit,
    factor: link.factor,
    minOrder: link.minOrder,
    from: today(),
    to: null,
    change,
    by: CURRENT_USER,
    at: now,
  });
  link.effectiveFrom = today();
}

/* ---------------------------------------------------------------- Ghi: nhà cung cấp */

/** [BACKEND-TODO] UC-KHO-08: POST /api/kho/suppliers (kèm liên kết nguyên liệu, lưu tất cả hoặc không gì). */
export async function createSupplier(input: SupplierInput): Promise<Supplier> {
  await delay(420);
  const fields: Record<string, string> = {};
  const name = validateInfo(input, null, fields);
  const links = input.links ?? [];
  const seen = new Set<string>();
  links.forEach((l, i) => {
    validateLink(l, `links.${i}.`, fields, stockUnitOf);
    if (l.ingredientId && seen.has(l.ingredientId)) fields[`links.${i}.ingredientId`] = 'Nguyên liệu bị chọn trùng';
    seen.add(l.ingredientId);
  });
  if (Object.keys(fields).length) throw new ValidationError(fields);

  const now = new Date().toISOString();
  const rec: SupplierRecord = {
    id: `ncc-${Date.now().toString(36)}`,
    code: nextCatalogCode(db, 'NCC'),
    name,
    phone: input.phone.trim(),
    paymentMethod: input.paymentMethod as SupplierRecord['paymentMethod'],
    contact: input.contact.trim(),
    email: input.email.trim(),
    website: input.website.trim(),
    taxCode: input.taxCode.trim(),
    address: input.address.trim(),
    note: input.note.trim(),
    status: 'active',
    stopReason: null,
    stopNote: '',
    createdAt: now,
    updatedAt: now,
  };
  db.suppliers.push(rec);
  db.supplierEvents.push({ id: `sev-${rec.id}-0`, supplierId: rec.id, status: 'active', reason: null, note: 'Tạo nhà cung cấp', by: CURRENT_USER, at: now });
  links.forEach((l, i) => {
    const link: LinkRecord = { id: `lk-${Date.now().toString(36)}${i}`, supplierId: rec.id, ...l, effectiveFrom: today(), status: 'active' };
    db.links.push(link);
    pushPrice(link, 'create');
  });
  return toSupplier(rec);
}

/** [BACKEND-TODO] UC-KHO-09: PUT /api/kho/suppliers/{id} (chỉ thông tin, không gồm liên kết). */
export async function updateSupplier(id: string, input: SupplierInput): Promise<Supplier> {
  await delay(380);
  const rec = findSupplier(id);
  const fields: Record<string, string> = {};
  const name = validateInfo(input, id, fields);
  if (Object.keys(fields).length) throw new ValidationError(fields);
  Object.assign(rec, {
    name,
    phone: input.phone.trim(),
    paymentMethod: input.paymentMethod,
    contact: input.contact.trim(),
    email: input.email.trim(),
    website: input.website.trim(),
    taxCode: input.taxCode.trim(),
    address: input.address.trim(),
    note: input.note.trim(),
    updatedAt: new Date().toISOString(),
  });
  return toSupplier(rec);
}

/** [BACKEND-TODO] UC-KHO-10: PATCH /api/kho/suppliers/{id}/stop */
export async function stopSupplier(id: string, reason: SupplierStopReason | '', note: string): Promise<Supplier> {
  await delay(320);
  const rec = findSupplier(id);
  const fields: Record<string, string> = {};
  if (!reason) fields.reason = 'Vui lòng chọn lý do ngừng hoạt động';
  if (reason === 'other' && !note.trim()) fields.note = 'Vui lòng nhập ghi chú cho lý do Khác';
  if (note.length > 255) fields.note = 'Ghi chú tối đa 255 ký tự';
  if (Object.keys(fields).length) throw new ValidationError(fields);
  if (rec.status === 'inactive') throw new BusinessError('Nhà cung cấp đã ở trạng thái Ngừng hoạt động', 409);
  const now = new Date().toISOString();
  Object.assign(rec, { status: 'inactive', stopReason: reason, stopNote: note.trim(), updatedAt: now });
  db.supplierEvents.push({ id: `sev-${rec.id}-${Date.now().toString(36)}`, supplierId: rec.id, status: 'inactive', reason: reason as SupplierStopReason, note: note.trim(), by: CURRENT_USER, at: now });
  return toSupplier(rec);
}

/** [BACKEND-TODO] UC-KHO-10: PATCH /api/kho/suppliers/{id}/activate */
export async function activateSupplier(id: string): Promise<Supplier> {
  await delay(320);
  const rec = findSupplier(id);
  if (rec.status === 'active') throw new BusinessError('Nhà cung cấp đã ở trạng thái Đang hoạt động', 409);
  const now = new Date().toISOString();
  Object.assign(rec, { status: 'active', updatedAt: now });
  db.supplierEvents.push({ id: `sev-${rec.id}-${Date.now().toString(36)}`, supplierId: rec.id, status: 'active', reason: null, note: '', by: CURRENT_USER, at: now });
  return toSupplier(rec);
}

/** [BACKEND-TODO] UC-KHO-10: DELETE /api/kho/suppliers/{id} — chỉ khi chưa có phiếu mua nào (kể cả nháp). */
export async function deleteSupplier(id: string): Promise<void> {
  await delay(320);
  findSupplier(id);
  if (db.purchaseOrders.some((po) => po.supplierId === id)) {
    throw new BusinessError('Nhà cung cấp đã có phiếu mua nên không thể xóa. Bạn có thể ngừng hoạt động nhà cung cấp này.', 409);
  }
  const linkIds = new Set(db.links.filter((l) => l.supplierId === id).map((l) => l.id));
  db.prices = db.prices.filter((p) => !linkIds.has(p.linkId));
  db.links = db.links.filter((l) => l.supplierId !== id);
  db.supplierEvents = db.supplierEvents.filter((e) => e.supplierId !== id);
  db.suppliers = db.suppliers.filter((s) => s.id !== id);
}

/* ---------------------------------------------------------------- Ghi: liên kết nguyên liệu (UC-KHO-11) */

/** [BACKEND-TODO] POST /api/kho/suppliers/{id}/links */
export async function addLink(supplierId: string, input: SupplierLinkInput): Promise<SupplierLink> {
  await delay(320);
  findSupplier(supplierId);
  const fields: Record<string, string> = {};
  validateLink(input, '', fields, stockUnitOf);
  if (!fields.ingredientId && db.links.some((l) => l.supplierId === supplierId && l.ingredientId === input.ingredientId)) {
    const it = db.ingredients.find((x) => x.id === input.ingredientId)!;
    fields.ingredientId = `${it.name} đã có trong danh sách cung cấp của nhà cung cấp này`;
  }
  if (Object.keys(fields).length) throw new ValidationError(fields);
  const link: LinkRecord = { id: `lk-${Date.now().toString(36)}`, supplierId, ...input, effectiveFrom: today(), status: 'active' };
  db.links.push(link);
  pushPrice(link, 'create');
  return toLink(link);
}

/** [BACKEND-TODO] PUT /api/kho/supplier-links/{id} — đổi giá, quy cách (đơn vị mua, hệ số) hoặc SL tối thiểu. */
export async function updateLink(linkId: string, input: SupplierLinkInput): Promise<SupplierLink> {
  await delay(320);
  const link = findLink(linkId);
  const fields: Record<string, string> = {};
  validateLink({ ...input, ingredientId: link.ingredientId }, '', fields, stockUnitOf);
  if (fields.ingredientId) throw new BusinessError('Nguyên liệu đang ngừng sử dụng, không thể đổi giá hoặc kích hoạt lại liên kết', 409);
  if (Object.keys(fields).length) throw new ValidationError(fields);
  const priceChanged = input.price !== link.price;
  const specChanged = input.purchaseUnit !== link.purchaseUnit || input.factor !== link.factor;
  const minChanged = input.minOrder !== link.minOrder;
  if (!priceChanged && !specChanged && !minChanged) return toLink(link);
  Object.assign(link, { price: input.price, purchaseUnit: input.purchaseUnit, factor: input.factor, minOrder: input.minOrder });
  pushPrice(link, priceChanged ? 'price' : specChanged ? 'spec' : 'min');
  return toLink(link);
}

/** [BACKEND-TODO] PATCH /api/kho/supplier-links/{id}/stop — giá hiện hành kết thúc hôm nay. */
export async function stopLink(linkId: string): Promise<SupplierLink> {
  await delay(280);
  const link = findLink(linkId);
  if (link.status === 'inactive') throw new BusinessError('Liên kết đã ngừng', 409);
  link.status = 'inactive';
  const current = db.prices.find((p) => p.linkId === link.id && p.to === null);
  if (current) current.to = today();
  return toLink(link);
}

/** [BACKEND-TODO] PATCH /api/kho/supplier-links/{id}/activate — bắt buộc nhập giá mới. */
export async function reactivateLink(linkId: string, input: SupplierLinkInput): Promise<SupplierLink> {
  await delay(320);
  const link = findLink(linkId);
  const fields: Record<string, string> = {};
  validateLink({ ...input, ingredientId: link.ingredientId }, '', fields, stockUnitOf);
  if (fields.ingredientId) throw new BusinessError('Nguyên liệu đang ngừng sử dụng, không thể đổi giá hoặc kích hoạt lại liên kết', 409);
  if (Object.keys(fields).length) throw new ValidationError(fields);
  Object.assign(link, { status: 'active', price: input.price, purchaseUnit: input.purchaseUnit, factor: input.factor, minOrder: input.minOrder });
  // Bản ghi cuối đã đóng khi ngừng: mở bản ghi mới từ hôm nay (hôm nay đã có thì cập nhật).
  const last = db.prices.filter((p) => p.linkId === link.id).sort((a, b) => b.from.localeCompare(a.from))[0];
  if (last && last.from === today()) {
    Object.assign(last, { price: link.price, purchaseUnit: link.purchaseUnit, factor: link.factor, minOrder: link.minOrder, to: null, change: 'reactivate', by: CURRENT_USER, at: new Date().toISOString() });
  } else {
    if (last && last.to === today()) last.to = yesterday();
    pushPrice(link, 'reactivate');
  }
  return toLink(link);
}
