/**
 * [FAKE-DATA] Dữ liệu mẫu của phân hệ Quản lý kho — chỉ để dựng giao diện khi chưa có backend.
 *
 * Dữ liệu được tạo bằng cách mô phỏng 35 ngày hoạt động (tồn đầu kỳ → bếp xuất hằng ngày → đặt hàng
 * hằng tuần → nhận hàng → xuất hủy → kiểm kê), nên tồn kho, giá vốn, thẻ kho, công nợ và biểu đồ
 * khớp nhau. Bộ sinh số ngẫu nhiên có hạt cố định: mỗi lần tải trang ra cùng một bộ dữ liệu.
 * 6 nguyên liệu đầu và 2 nhà cung cấp đầu trùng tên với dữ liệu mẫu trong CSDL (db/dev/V1_1).
 *
 * [BACKEND-TODO] Khi có backend: các hàm trong src/api/warehouse-*.ts gọi API thật, bỏ file này.
 */
import type {
  IngredientGroup,
  IngredientStatus,
  PaymentMethod,
  PriceChange,
  PriceRecord,
  PurchaseOrder,
  PurchaseOrderLine,
  StockMove,
  StockMoveType,
  StocktakeSummary,
  SupplierStatus,
  SupplierStatusEvent,
  SupplierStopReason,
  LinkStatus,
} from '@/types';

/* ---------------------------------------------------------------- Bản ghi trong "CSDL giả" */

export interface IngredientRecord {
  id: string;
  code: string;
  name: string;
  group: IngredientGroup;
  unit: string;
  minLevel: number;
  onHand: number;
  avgCost: number | null;
  status: IngredientStatus;
  note: string;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
}

export interface SupplierRecord {
  id: string;
  code: string;
  name: string;
  phone: string;
  paymentMethod: PaymentMethod;
  contact: string;
  email: string;
  website: string;
  taxCode: string;
  address: string;
  note: string;
  status: SupplierStatus;
  stopReason: SupplierStopReason | null;
  stopNote: string;
  createdAt: string;
  updatedAt: string;
}

export interface LinkRecord {
  id: string;
  supplierId: string;
  ingredientId: string;
  purchaseUnit: string;
  factor: number;
  price: number;
  minOrder: number | null;
  effectiveFrom: string;
  status: LinkStatus;
}

export interface PaymentRecord {
  id: string;
  code: string;
  poId: string;
  supplierId: string;
  amount: number;
  method: PaymentMethod;
  paidAt: string;
  status: 'valid' | 'cancelled';
}

export interface WarehouseDb {
  ingredients: IngredientRecord[];
  suppliers: SupplierRecord[];
  links: LinkRecord[];
  prices: PriceRecord[];
  supplierEvents: (SupplierStatusEvent & { supplierId: string })[];
  moves: StockMove[];
  purchaseOrders: PurchaseOrder[];
  payments: PaymentRecord[];
  stocktakes: StocktakeSummary[];
  recipes: { dishCode: string; dishName: string; ingredientId: string; qty: number }[];
  seq: Record<string, number>;
}

export const CURRENT_USER = 'Bùi Phương Thảo';
const MANAGER = 'Nguyễn Anh Tuấn';

/* ---------------------------------------------------------------- Tiện ích thời gian, số */

const DAY = 86_400_000;
const today0 = (() => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
})();

/** Thời điểm "offset ngày so với hôm nay" lúc hh:mm (giờ địa phương), dạng ISO. */
export const dayAt = (offset: number, hour = 9, minute = 0): string =>
  new Date(today0 + offset * DAY + (hour * 60 + minute) * 60_000).toISOString();

/** "2026-11-12" của ngày lệch offset so với hôm nay. */
export function dayKey(offset: number): string {
  const d = new Date(today0 + offset * DAY);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export const round3 = (n: number) => Math.round(n * 1000) / 1000;
export const round2 = (n: number) => Math.round(n * 100) / 100;
export const pad3 = (n: number) => String(n).padStart(3, '0');

/** Đơn vị đếm (cái, quả, lon…) dùng số nguyên; đơn vị cân đo (kg, lít…) cho phép số lẻ. */
const COUNT_UNITS = new Set(['cái', 'quả', 'bó', 'hộp', 'chai', 'lon', 'gói', 'túi']);
const roundQty = (n: number, unit: string) => (COUNT_UNITS.has(unit) ? Math.round(n) : Math.round(n * 10) / 10);

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---------------------------------------------------------------- Mã chứng từ */

/** Mã chứng từ theo tháng: PM2611-001, PN2611-002… (bộ đếm riêng cho từng tiền tố + tháng). */
export function nextDocCode(db: WarehouseDb, prefix: string, iso: string): string {
  const d = new Date(iso);
  const key = `${prefix}${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, '0')}`;
  db.seq[key] = (db.seq[key] ?? 0) + 1;
  return `${key}-${pad3(db.seq[key])}`;
}

/** Mã danh mục tăng dần: NL027, NCC007. */
export function nextCatalogCode(db: WarehouseDb, prefix: 'NL' | 'NCC'): string {
  db.seq[prefix] = (db.seq[prefix] ?? 0) + 1;
  return `${prefix}${pad3(db.seq[prefix])}`;
}

/* ---------------------------------------------------------------- Sổ kho */

const RECEIPT_TYPES: StockMoveType[] = ['opening', 'po_receipt', 'direct_receipt'];

/**
 * Ghi một dòng sổ kho và cập nhật tồn + giá vốn bình quân (mục 5 của đặc tả):
 * nhập thì tính lại giá vốn; xuất và điều chỉnh không đổi giá vốn, ghi theo giá vốn hiện tại.
 */
export function applyMove(
  db: WarehouseDb,
  ingredientId: string,
  type: StockMoveType,
  qty: number,
  unitCost: number,
  at: string,
  docCode: string,
  by = CURRENT_USER,
): StockMove {
  const it = db.ingredients.find((x) => x.id === ingredientId)!;
  const isReceipt = RECEIPT_TYPES.includes(type);
  if (qty > 0 && isReceipt) {
    it.avgCost = it.onHand <= 0 || it.avgCost === null ? round2(unitCost) : round2((it.onHand * it.avgCost + qty * unitCost) / (it.onHand + qty));
  }
  it.onHand = round3(it.onHand + qty);
  const row: StockMove = {
    id: `mv-${db.moves.length + 1}`,
    ingredientId,
    at,
    type,
    docCode,
    qtyChange: round3(qty),
    balanceAfter: it.onHand,
    unitCost: isReceipt ? round2(unitCost) : round2(it.avgCost ?? 0),
    by,
  };
  db.moves.push(row);
  return row;
}

/* ---------------------------------------------------------------- Danh mục mẫu */

interface IngredientSpec {
  name: string;
  group: IngredientGroup;
  unit: string;
  min: number;
  cost: number;
  /** Lượng bếp dùng mỗi ngày (đơn vị kho). */
  use: number;
  supplier: string | null;
  /** Tồn mong muốn lúc hiện tại (để có đủ trạng thái Sắp hết / Hết hàng). */
  target?: number;
  note?: string;
}

const SPECS: IngredientSpec[] = [
  { name: 'Tôm sú tươi', group: 'seafood', unit: 'kg', min: 6, cost: 280000, use: 1.2, supplier: 'NCC001', target: 4.5, note: 'Bảo quản ngăn đá, dùng trong 2 ngày.' },
  { name: 'Thịt ba chỉ', group: 'meat', unit: 'kg', min: 5, cost: 140000, use: 1.0, supplier: 'NCC002' },
  { name: 'Cá basa phi lê', group: 'seafood', unit: 'kg', min: 5, cost: 90000, use: 1.1, supplier: 'NCC001' },
  { name: 'Đùi gà', group: 'meat', unit: 'kg', min: 8, cost: 75000, use: 1.6, supplier: 'NCC002' },
  { name: 'Đậu hũ non', group: 'other', unit: 'hộp', min: 20, cost: 8000, use: 4, supplier: 'NCC003', target: 16 },
  { name: 'Nấm đông cô', group: 'dry', unit: 'kg', min: 2, cost: 220000, use: 0.25, supplier: 'NCC005' },
  { name: 'Mực ống', group: 'seafood', unit: 'kg', min: 4, cost: 210000, use: 0.7, supplier: 'NCC001' },
  { name: 'Nghêu', group: 'seafood', unit: 'kg', min: 5, cost: 60000, use: 1.0, supplier: 'NCC001' },
  { name: 'Sườn non heo', group: 'meat', unit: 'kg', min: 5, cost: 160000, use: 0.8, supplier: 'NCC002' },
  { name: 'Thịt bò thăn Úc', group: 'meat', unit: 'kg', min: 4, cost: 450000, use: 0.6, supplier: 'NCC006', target: 0 },
  { name: 'Rau xà lách', group: 'produce', unit: 'kg', min: 3, cost: 35000, use: 0.9, supplier: 'NCC003' },
  { name: 'Cà chua', group: 'produce', unit: 'kg', min: 4, cost: 28000, use: 0.8, supplier: 'NCC003' },
  { name: 'Hành lá', group: 'produce', unit: 'kg', min: 1, cost: 40000, use: 0.3, supplier: 'NCC003', target: 0.8 },
  { name: 'Rau muống', group: 'produce', unit: 'bó', min: 10, cost: 8000, use: 3, supplier: 'NCC003' },
  { name: 'Gạo ST25', group: 'dry', unit: 'kg', min: 20, cost: 32000, use: 4, supplier: 'NCC002' },
  { name: 'Bún tươi', group: 'other', unit: 'kg', min: 5, cost: 15000, use: 2, supplier: 'NCC003' },
  { name: 'Trứng gà', group: 'dairy', unit: 'quả', min: 60, cost: 3500, use: 18, supplier: 'NCC002', target: 45 },
  { name: 'Sữa tươi không đường', group: 'dairy', unit: 'lít', min: 5, cost: 36000, use: 1, supplier: 'NCC002' },
  { name: 'Nước mắm Phú Quốc', group: 'spice', unit: 'chai', min: 6, cost: 45000, use: 0.5, supplier: 'NCC005' },
  { name: 'Dầu ăn', group: 'spice', unit: 'lít', min: 10, cost: 42000, use: 1.5, supplier: 'NCC005' },
  { name: 'Đường cát trắng', group: 'spice', unit: 'kg', min: 5, cost: 22500, use: 0.6, supplier: 'NCC005' },
  { name: 'Coca-Cola lon', group: 'drink', unit: 'lon', min: 48, cost: 10000, use: 20, supplier: 'NCC004' },
  { name: 'Nước suối Aquafina', group: 'drink', unit: 'chai', min: 48, cost: 5500, use: 15, supplier: 'NCC004' },
  { name: 'Bia Saigon lon', group: 'drink', unit: 'lon', min: 48, cost: 15000, use: 24, supplier: 'NCC004' },
  { name: 'Nước cam ép hộp', group: 'drink', unit: 'hộp', min: 12, cost: 12000, use: 1, supplier: null, note: 'Ngừng phục vụ từ tháng này, dùng hết phần còn lại.' },
  { name: 'Lá chanh', group: 'spice', unit: 'kg', min: 0.3, cost: 0, use: 0, supplier: null, note: 'Mới thêm, chưa nhập hàng.' },
];

interface SupplierSpec {
  name: string;
  phone: string;
  method: PaymentMethod;
  contact: string;
  email: string;
  website: string;
  taxCode: string;
  address: string;
  note: string;
}

const SUPPLIER_SPECS: SupplierSpec[] = [
  { name: 'Hải sản Phú Quốc', phone: '0912000111', method: 'cash', contact: 'Anh Trần Văn Lộc', email: 'hssanphuquoc@gmail.com', website: '', taxCode: '1701234567', address: 'Chợ Bình Điền, Quận 8, TP.HCM', note: 'Giao trước 7 giờ sáng.' },
  { name: 'Công ty Thực phẩm Đại Phát', phone: '0912000222', method: 'transfer', contact: 'Chị Lê Ngọc Mai', email: 'kinhdoanh@daiphatfood.vn', website: 'https://daiphatfood.vn', taxCode: '0312345678', address: 'KCN Tân Bình, TP.HCM', note: 'Công nợ 15 ngày.' },
  { name: 'Rau sạch Đà Lạt Xanh', phone: '0903456789', method: 'cash', contact: 'Anh Nguyễn Hữu Phúc', email: 'dalatxanh@gmail.com', website: '', taxCode: '', address: 'Chợ đầu mối Thủ Đức, TP.HCM', note: '' },
  { name: 'Đại lý nước giải khát Minh Phát', phone: '0287654321', method: 'transfer', contact: 'Anh Võ Minh Phát', email: 'minhphat.beverage@gmail.com', website: '', taxCode: '0309876543', address: '45 Lũy Bán Bích, Tân Phú, TP.HCM', note: 'Giao thùng nguyên đai.' },
  { name: 'Gia vị Hương Việt', phone: '0938111222', method: 'transfer', contact: 'Chị Phạm Thu Hương', email: 'huongviet.spice@gmail.com', website: 'https://giavihuongviet.vn', taxCode: '0315556677', address: '12 Nguyễn Trãi, Quận 5, TP.HCM', note: '' },
  { name: 'Thịt bò nhập khẩu Phương Nam', phone: '0909888777', method: 'transfer', contact: 'Anh Đỗ Quang Huy', email: 'phuongnambeef@gmail.com', website: '', taxCode: '0318889990', address: '88 Tô Hiến Thành, Quận 10, TP.HCM', note: '' },
];

/** Liên kết nguyên liệu – nhà cung cấp: [mã NCC, số thứ tự nguyên liệu, đơn vị mua, hệ số, giá nhập / đơn vị mua, SL tối thiểu]. */
const LINK_SPECS: [string, number, string, number, number, number | null][] = [
  ['NCC001', 1, 'kg', 1, 280000, 2],
  ['NCC001', 3, 'kg', 1, 90000, 3],
  ['NCC001', 7, 'kg', 1, 210000, 2],
  ['NCC001', 8, 'kg', 1, 60000, 5],
  ['NCC002', 1, 'kg', 1, 295000, null],
  ['NCC002', 2, 'kg', 1, 140000, 3],
  ['NCC002', 4, 'kg', 1, 75000, 5],
  ['NCC002', 9, 'kg', 1, 160000, 2],
  ['NCC002', 15, 'bao', 25, 800000, 1],
  ['NCC002', 17, 'khay', 30, 105000, 2],
  ['NCC002', 18, 'lít', 1, 36000, null],
  ['NCC002', 22, 'lốc', 6, 63000, null],
  ['NCC003', 5, 'khay', 10, 80000, 1],
  ['NCC003', 11, 'kg', 1, 35000, null],
  ['NCC003', 12, 'kg', 1, 28000, null],
  ['NCC003', 13, 'kg', 1, 40000, null],
  ['NCC003', 14, 'bó', 1, 8000, 10],
  ['NCC003', 16, 'kg', 1, 15000, 5],
  ['NCC004', 22, 'thùng', 24, 240000, 2],
  ['NCC004', 23, 'thùng', 24, 132000, 2],
  ['NCC004', 24, 'thùng', 24, 360000, 2],
  ['NCC005', 6, 'kg', 1, 220000, null],
  ['NCC005', 19, 'thùng', 12, 540000, null],
  ['NCC005', 20, 'can', 5, 210000, 2],
  ['NCC005', 21, 'kg', 1, 22500, 5],
  ['NCC006', 10, 'kg', 1, 450000, 3],
];

const RECIPES: [string, string, [number, number][]][] = [
  ['MA001', 'Gỏi cuốn tôm thịt', [[1, 0.08], [2, 0.06], [16, 0.05], [11, 0.03]]],
  ['MA002', 'Đậu hũ non sốt nấm', [[5, 1], [6, 0.03]]],
  ['MA003', 'Cá kho tộ', [[3, 0.35], [19, 0.02], [21, 0.02]]],
  ['MA004', 'Gà nướng mật ong', [[4, 0.4]]],
  ['MA006', 'Bò lúc lắc khoai tây', [[10, 0.2], [12, 0.05]]],
  ['MA008', 'Cơm chiên hải sản', [[15, 0.2], [1, 0.05], [7, 0.05], [17, 1]]],
  ['MA011', 'Nghêu hấp sả', [[8, 0.4], [13, 0.02]]],
];

/* ---------------------------------------------------------------- Bộ sinh dữ liệu */

function buildSeed(): WarehouseDb {
  const rand = mulberry32(20261112);
  const db: WarehouseDb = {
    ingredients: [],
    suppliers: [],
    links: [],
    prices: [],
    supplierEvents: [],
    moves: [],
    purchaseOrders: [],
    payments: [],
    stocktakes: [],
    recipes: [],
    seq: {},
  };

  // Nhà cung cấp
  SUPPLIER_SPECS.forEach((s, i) => {
    const id = `ncc-${pad3(i + 1)}`;
    db.suppliers.push({
      id,
      code: nextCatalogCode(db, 'NCC'),
      name: s.name,
      phone: s.phone,
      paymentMethod: s.method,
      contact: s.contact,
      email: s.email,
      website: s.website,
      taxCode: s.taxCode,
      address: s.address,
      note: s.note,
      status: 'active',
      stopReason: null,
      stopNote: '',
      createdAt: dayAt(-35, 8),
      updatedAt: dayAt(-35, 8),
    });
    db.supplierEvents.push({ id: `sev-${id}-0`, supplierId: id, status: 'active', reason: null, note: 'Tạo nhà cung cấp', by: CURRENT_USER, at: dayAt(-35, 8) });
  });
  const supplierByCode = new Map(db.suppliers.map((s) => [s.code, s]));

  // Nguyên liệu
  SPECS.forEach((s, i) => {
    const isNew = s.name === 'Lá chanh';
    const created = isNew ? dayAt(-2, 15) : dayAt(-35, 8);
    db.ingredients.push({
      id: `nl-${pad3(i + 1)}`,
      code: nextCatalogCode(db, 'NL'),
      name: s.name,
      group: s.group,
      unit: s.unit,
      minLevel: s.min,
      onHand: 0,
      avgCost: null,
      status: 'active',
      note: s.note ?? '',
      createdAt: created,
      createdBy: CURRENT_USER,
      updatedAt: created,
    });
  });
  const ing = (n: number) => db.ingredients[n - 1];

  // Liên kết + bản ghi giá đầu tiên
  LINK_SPECS.forEach(([sup, n, unit, factor, price, minOrder], i) => {
    const link: LinkRecord = {
      id: `lk-${pad3(i + 1)}`,
      supplierId: supplierByCode.get(sup)!.id,
      ingredientId: ing(n).id,
      purchaseUnit: unit,
      factor,
      price,
      minOrder,
      effectiveFrom: dayKey(-35),
      status: 'active',
    };
    db.links.push(link);
    db.prices.push(priceRow(link, 'create', dayKey(-35), dayAt(-35, 8)));
  });
  // Lịch sử đổi giá
  changePrice(db, 'lk-001', 270000, 280000, -20);
  changePrice(db, 'lk-009', 780000, 800000, -9);
  changePrice(db, 'lk-019', 228000, 240000, -6);

  db.recipes = RECIPES.flatMap(([dishCode, dishName, items]) =>
    items.map(([n, qty]) => ({ dishCode, dishName, ingredientId: ing(n).id, qty })),
  );

  /* -------- Sổ kho */
  const move = (ingredientId: string, type: StockMoveType, qty: number, unitCost: number, at: string, docCode: string, by = CURRENT_USER) =>
    applyMove(db, ingredientId, type, qty, unitCost, at, docCode, by);

  // Tồn đầu kỳ (mỗi nguyên liệu một phiếu nhập "Tồn đầu kỳ")
  SPECS.forEach((s, i) => {
    if (s.use <= 0) return;
    const at = dayAt(-34, 8, i);
    move(ing(i + 1).id, 'opening', roundQty(s.min * 3, s.unit), s.cost, at, nextDocCode(db, 'PN', at));
  });

  const ORDER_DAYS = [-31, -24, -17, -10, -3];
  const WASTE: Record<number, [number, number][]> = { [-20]: [[11, 0.5], [1, 0.3]], [-11]: [[12, 0.4], [16, 0.6]], [-4]: [[11, 0.4], [8, 0.5]] };

  for (let day = -33; day <= 0; day += 1) {
    // Bếp lấy hàng mỗi sáng (một phiếu xuất cho cả ngày)
    const issueAt = dayAt(day, 7, 30);
    const issueCode = nextDocCode(db, 'PX', issueAt);
    SPECS.forEach((s, i) => {
      if (s.use <= 0) return;
      if (s.name === 'Nước cam ép hộp' && day > -10) return; // ngừng phục vụ
      const it = ing(i + 1);
      const qty = Math.min(it.onHand, roundQty(s.use * (0.7 + rand() * 0.6), s.unit));
      if (qty > 0) move(it.id, 'issue_kitchen', -qty, 0, issueAt, issueCode);
    });

    // Xuất hủy
    if (WASTE[day]) {
      const at = dayAt(day, 21, 15);
      const code = nextDocCode(db, 'PX', at);
      WASTE[day].forEach(([n, qty]) => {
        const it = ing(n);
        if (it.onHand >= qty) move(it.id, 'issue_waste', -qty, 0, at, code);
      });
    }

    // Kiểm kê đã duyệt (chênh lệch nhỏ)
    if (day === -14) {
      const at = dayAt(day, 16);
      const code = nextDocCode(db, 'KK', at);
      const diffs: [number, number][] = [[13, -0.2], [20, -0.5], [17, 2]];
      let inc = 0;
      let dec = 0;
      diffs.forEach(([n, qty]) => {
        const it = ing(n);
        const value = Math.round(Math.abs(qty) * (it.avgCost ?? 0));
        if (qty > 0) inc += value;
        else dec += value;
        move(it.id, 'stocktake', qty, 0, at, code, MANAGER);
      });
      db.stocktakes.push({ id: 'kk-001', code, status: 'approved', createdAt: dayAt(day, 15), createdBy: CURRENT_USER, rejectReason: '', increaseValue: inc, decreaseValue: dec });
    }

    // Đặt hàng hằng tuần: mỗi nhà cung cấp một phiếu cho các nguyên liệu dưới mức đặt lại
    if (ORDER_DAYS.includes(day)) {
      const isLast = day === ORDER_DAYS[ORDER_DAYS.length - 1];
      db.suppliers.forEach((sup) => {
        if (sup.code === 'NCC006' && day > -15) return; // đã ngừng hoạt động
        const lines: PurchaseOrderLine[] = [];
        SPECS.forEach((s, i) => {
          if (s.supplier !== sup.code) return;
          const it = ing(i + 1);
          if (it.onHand >= s.min * 2.2 && !(isLast && lines.length === 0 && sup.code === 'NCC003')) return;
          const link = db.links.find((l) => l.supplierId === sup.id && l.ingredientId === it.id)!;
          const need = s.min * 4 - it.onHand;
          const qtyOrdered = Math.max(link.minOrder ?? 1, Math.ceil(need / link.factor));
          lines.push({ ingredientId: it.id, purchaseUnit: link.purchaseUnit, factor: link.factor, qtyOrdered, qtyReceived: 0, unitPrice: link.price });
        });
        if (lines.length === 0) return;
        const orderedAt = dayAt(day, 9, 30);
        const po: PurchaseOrder = {
          id: `pm-${db.purchaseOrders.length + 1}`,
          code: nextDocCode(db, 'PM', orderedAt),
          name: `Mua ${sup.name} ${dayKey(day).slice(8)}/${dayKey(day).slice(5, 7)}`,
          supplierId: sup.id,
          orderDate: dayKey(day),
          expectedDate: dayKey(day + 1),
          status: 'ordered',
          receiveStatus: 'not_received',
          lines,
          discount: sup.code === 'NCC002' ? 50000 : 0,
          taxPercent: sup.code === 'NCC004' || sup.code === 'NCC002' ? 8 : 0,
          otherCost: sup.code === 'NCC004' ? 30000 : 0,
          paid: 0,
          note: '',
          createdAt: orderedAt,
          createdBy: CURRENT_USER,
        };
        db.purchaseOrders.push(po);

        // Nhận hàng
        let mode: 'full' | 'partial' | 'none' = 'full';
        if (isLast && sup.code === 'NCC002') mode = 'partial';
        if (isLast && sup.code === 'NCC003') mode = 'none';
        if (mode === 'none') {
          po.expectedDate = dayKey(1);
          return;
        }
        const receivedAt = dayAt(day + 1, 10);
        const pnCode = nextDocCode(db, 'PN', receivedAt);
        const subtotal = po.lines.reduce((s, l) => s + Math.round(l.qtyOrdered * l.unitPrice), 0);
        po.lines.forEach((l, idx) => {
          const qty = mode === 'partial' && idx < 2 ? Math.ceil(l.qtyOrdered / 2) : mode === 'partial' ? 0 : l.qtyOrdered;
          if (qty <= 0) return;
          l.qtyReceived = qty;
          const unitCost = (l.unitPrice / l.factor) * (1 - po.discount / subtotal);
          move(l.ingredientId, 'po_receipt', round3(qty * l.factor), unitCost, receivedAt, pnCode);
        });
        po.receiveStatus = po.lines.every((l) => l.qtyReceived >= l.qtyOrdered) ? 'received' : 'partial';

        // Thanh toán: phiếu cũ trả đủ, phiếu gần đây trả một phần hoặc chưa trả
        const payable = payableOf(po);
        if (day <= -10) {
          payFor(db, po, payable, dayAt(day + 4, 14));
        } else if (sup.code === 'NCC005') {
          payFor(db, po, Math.round(payable / 2), dayAt(day + 2, 15));
        }
      });
    }
  }

  // Phiếu nháp và phiếu đã hủy để danh sách phiếu mua có đủ trạng thái
  const draftLink = db.links.find((l) => l.id === 'lk-022')!;
  db.purchaseOrders.push({
    id: `pm-${db.purchaseOrders.length + 1}`,
    code: nextDocCode(db, 'PM', dayAt(0, 8, 45)),
    name: 'Mua gia vị cuối tháng',
    supplierId: draftLink.supplierId,
    orderDate: dayKey(0),
    expectedDate: null,
    status: 'draft',
    receiveStatus: 'not_received',
    lines: [{ ingredientId: draftLink.ingredientId, purchaseUnit: draftLink.purchaseUnit, factor: draftLink.factor, qtyOrdered: 2, qtyReceived: 0, unitPrice: draftLink.price }],
    discount: 0,
    taxPercent: 0,
    otherCost: 0,
    paid: 0,
    note: 'Chờ báo giá nấm mới.',
    createdAt: dayAt(0, 8, 45),
    createdBy: CURRENT_USER,
  });

  // Ngừng hợp tác nhà cung cấp thịt bò
  const beef = supplierByCode.get('NCC006')!;
  beef.status = 'inactive';
  beef.stopReason = 'price';
  beef.stopNote = 'Giá cao hơn thị trường khoảng 15%.';
  beef.updatedAt = dayAt(-15, 16);
  db.supplierEvents.push({ id: 'sev-ncc-006-1', supplierId: beef.id, status: 'inactive', reason: 'price', note: beef.stopNote, by: CURRENT_USER, at: dayAt(-15, 16) });

  // Nguyên liệu ngừng sử dụng
  const juice = db.ingredients.find((x) => x.name === 'Nước cam ép hộp')!;
  juice.status = 'inactive';
  juice.updatedAt = dayAt(-10, 9);

  // Đưa vài nguyên liệu về đúng tình trạng muốn minh họa (Sắp hết / Hết hàng)
  const adjustAt = dayAt(0, 11, 20);
  const adjustCode = nextDocCode(db, 'PX', adjustAt);
  SPECS.forEach((s, i) => {
    if (s.target === undefined) return;
    const it = ing(i + 1);
    const extra = round3(it.onHand - s.target);
    if (extra > 0) move(it.id, 'issue_kitchen', -extra, 0, adjustAt, adjustCode);
  });

  // Phiếu kiểm kê bị từ chối và đang chờ duyệt (chưa ảnh hưởng tồn)
  db.stocktakes.push(
    { id: 'kk-002', code: nextDocCode(db, 'KK', dayAt(-1, 17)), status: 'rejected', createdAt: dayAt(-1, 17), createdBy: CURRENT_USER, rejectReason: 'Chênh lệch nấm đông cô quá lớn, đề nghị đếm lại kệ khô.', increaseValue: 0, decreaseValue: 88000 },
    { id: 'kk-003', code: nextDocCode(db, 'KK', dayAt(0, 9, 10)), status: 'pending', createdAt: dayAt(0, 9, 10), createdBy: CURRENT_USER, rejectReason: '', increaseValue: 21000, decreaseValue: 45000 },
  );

  // Bộ đếm mã danh mục bắt đầu sau dữ liệu mẫu
  db.seq.NL = db.ingredients.length;
  db.seq.NCC = db.suppliers.length;
  return db;
}

function priceRow(link: LinkRecord, change: PriceChange, from: string, at: string, by = CURRENT_USER): PriceRecord {
  return {
    id: `pr-${link.id}-${from}-${change}`,
    linkId: link.id,
    price: link.price,
    purchaseUnit: link.purchaseUnit,
    factor: link.factor,
    minOrder: link.minOrder,
    from,
    to: null,
    change,
    by,
    at,
  };
}

/** Đổi giá trong dữ liệu mẫu: bản ghi cũ kết thúc hôm trước, bản ghi mới áp dụng từ ngày đổi. */
function changePrice(db: WarehouseDb, linkId: string, oldPrice: number, newPrice: number, offset: number) {
  const link = db.links.find((l) => l.id === linkId)!;
  const first = db.prices.find((p) => p.linkId === linkId)!;
  first.price = oldPrice;
  first.to = dayKey(offset - 1);
  link.price = newPrice;
  link.effectiveFrom = dayKey(offset);
  db.prices.push(priceRow(link, 'price', dayKey(offset), dayAt(offset, 10)));
}

/* ---------------------------------------------------------------- Công nợ phiếu mua */

const roundMoney = (n: number) => Math.round(n);

/** Tạm tính theo SL đặt (mỗi dòng làm tròn đến đồng trước khi cộng). */
export function subtotalOf(po: PurchaseOrder): number {
  return po.lines.reduce((s, l) => s + roundMoney(l.qtyOrdered * l.unitPrice), 0);
}

/** Tổng cộng của phiếu = Tạm tính − Giảm giá + Thuế + Chi phí khác. */
export function totalOf(po: PurchaseOrder): number {
  const sub = subtotalOf(po);
  const tax = roundMoney((sub - po.discount) * (po.taxPercent / 100));
  return sub - po.discount + tax + po.otherCost;
}

/** Phải trả theo hàng đã nhận (mục 5 – Quy tắc nghiệp vụ chung của kho). */
export function payableOf(po: PurchaseOrder): number {
  if (po.status !== 'ordered') return 0;
  const sub = subtotalOf(po);
  const subReceived = po.lines.reduce((s, l) => s + roundMoney(l.qtyReceived * l.unitPrice), 0);
  if (subReceived <= 0) return 0;
  const discount = sub > 0 ? roundMoney(po.discount * (subReceived / sub)) : 0;
  const tax = roundMoney((subReceived - discount) * (po.taxPercent / 100));
  return subReceived - discount + tax + po.otherCost;
}

function payFor(db: WarehouseDb, po: PurchaseOrder, amount: number, at: string) {
  if (amount <= 0) return;
  const sup = db.suppliers.find((s) => s.id === po.supplierId)!;
  db.payments.push({ id: `tt-${db.payments.length + 1}`, code: nextDocCode(db, 'TT', at), poId: po.id, supplierId: po.supplierId, amount, method: sup.paymentMethod, paidAt: at, status: 'valid' });
  po.paid += amount;
}

/** "CSDL giả" dùng chung cho các module src/api/warehouse-*.ts (mất khi tải lại trang). */
export const db: WarehouseDb = buildSeed();
