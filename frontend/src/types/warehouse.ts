/* Kiểu dữ liệu của phân hệ Quản lý kho (theo DacTa_UC_QuanLyKho.docx). */

import type { Paged } from './management';

export type StockLevel = 'ok' | 'low' | 'out';

/* ---------------------------------------------------------------- Nguyên liệu */

export type IngredientGroup = 'meat' | 'seafood' | 'produce' | 'spice' | 'dry' | 'dairy' | 'drink' | 'other';
export type IngredientStatus = 'active' | 'inactive';

export interface Ingredient {
  id: string;
  code: string;
  name: string;
  group: IngredientGroup;
  /** Đơn vị kho (đơn vị tính): dùng cho tồn, xuất, kiểm kê. */
  unit: string;
  minLevel: number;
  onHand: number;
  /** Giá vốn bình quân cho 1 đơn vị kho; null = chưa có giá vốn (chưa từng nhập). */
  avgCost: number | null;
  status: IngredientStatus;
  note: string;
  /** Tình trạng tồn; null với nguyên liệu ngừng sử dụng. */
  stockLevel: StockLevel | null;
  /** Chưa phát sinh dữ liệu nào nên được xóa hẳn (UC-KHO-05). */
  deletable: boolean;
  /** Đã có dữ liệu dùng số lượng nên không đổi được đơn vị kho (UC-KHO-04). */
  unitLocked: boolean;
  /** Số phiếu mua "Đã đặt" chưa nhận xong có nguyên liệu này (cảnh báo khi ngừng sử dụng). */
  openPurchaseCount: number;
  /** Tên các món đang dùng nguyên liệu trong công thức. */
  dishNames: string[];
  createdAt: string;
  createdBy: string;
  updatedAt: string;
}

export interface IngredientInput {
  name: string;
  group: IngredientGroup | '';
  unit: string;
  minLevel: number;
  note: string;
  /** Chỉ khi thêm mới. */
  openingQty?: number;
  openingCost?: number | null;
}

export interface IngredientFilter {
  keyword: string;
  group: IngredientGroup | '';
  status: IngredientStatus | 'all';
  stock: StockLevel | 'all';
  page: number;
}

export interface IngredientSupplierRow {
  supplierId: string;
  supplierCode: string;
  supplierName: string;
  supplierActive: boolean;
  purchaseUnit: string;
  factor: number;
  price: number;
  minOrder: number | null;
  linkActive: boolean;
}

export interface IngredientDetail extends Ingredient {
  /** Số còn lại trong các phiếu mua đang chờ nhận, quy ra đơn vị kho. */
  pendingQty: number;
  suppliers: IngredientSupplierRow[];
  dishes: { code: string; name: string; qty: number }[];
}

/** Dòng chọn nguyên liệu trong các form (liên kết NCC, phiếu mua…). */
export interface IngredientOption {
  id: string;
  code: string;
  name: string;
  unit: string;
  active: boolean;
  avgCost: number | null;
  onHand: number;
}

/* ---------------------------------------------------------------- Sổ kho */

export type StockMoveType =
  | 'opening'
  | 'po_receipt'
  | 'direct_receipt'
  | 'receipt_cancel'
  | 'issue_kitchen'
  | 'issue_waste'
  | 'issue_other'
  | 'stocktake';

export interface StockMove {
  id: string;
  ingredientId: string;
  at: string;
  type: StockMoveType;
  docCode: string;
  /** Dương = tăng tồn, âm = giảm tồn (đơn vị kho). */
  qtyChange: number;
  balanceAfter: number;
  /** Đơn giá cho 1 đơn vị kho: nhập = giá nhập đã quy đổi, xuất / điều chỉnh = giá vốn. */
  unitCost: number;
  by: string;
}

export interface StockCardFilter {
  from: string;
  to: string;
  type: 'all' | 'in' | 'out' | 'adjust';
  page: number;
}

/* ---------------------------------------------------------------- Nhà cung cấp */

export type SupplierStatus = 'active' | 'inactive';
export type PaymentMethod = 'cash' | 'transfer';
export type SupplierStopReason = 'ended' | 'quality' | 'price' | 'late' | 'other';

export interface Supplier {
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
  activeLinkCount: number;
  /** Đã có phiếu mua (kể cả nháp) → không xóa được. */
  hasPurchases: boolean;
  /** Phiếu "Đã đặt" chưa nhận xong. */
  openPurchaseCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface SupplierLinkInput {
  ingredientId: string;
  purchaseUnit: string;
  factor: number;
  price: number;
  minOrder: number | null;
}

export interface SupplierInput {
  name: string;
  phone: string;
  paymentMethod: PaymentMethod | '';
  contact: string;
  email: string;
  website: string;
  taxCode: string;
  address: string;
  note: string;
  /** Chỉ khi thêm mới (UC-KHO-08). */
  links?: SupplierLinkInput[];
}

export interface SupplierFilter {
  keyword: string;
  status: SupplierStatus | 'all';
  page: number;
}

export type LinkStatus = 'active' | 'inactive';

export interface SupplierLink {
  id: string;
  supplierId: string;
  ingredientId: string;
  ingredientCode: string;
  ingredientName: string;
  stockUnit: string;
  ingredientActive: boolean;
  purchaseUnit: string;
  factor: number;
  price: number;
  minOrder: number | null;
  effectiveFrom: string;
  status: LinkStatus;
}

export type PriceChange = 'create' | 'price' | 'spec' | 'min' | 'reactivate';

export interface PriceRecord {
  id: string;
  linkId: string;
  price: number;
  purchaseUnit: string;
  factor: number;
  minOrder: number | null;
  from: string;
  to: string | null;
  change: PriceChange;
  by: string;
  at: string;
}

export interface SupplierStatusEvent {
  id: string;
  status: SupplierStatus;
  reason: SupplierStopReason | null;
  note: string;
  by: string;
  at: string;
}

export interface SupplierDetail extends Supplier {
  links: SupplierLink[];
  history: SupplierStatusEvent[];
}

/* ---------------------------------------------------------------- Phiếu mua (dữ liệu nền cho Dashboard) */

export type PurchaseOrderStatus = 'draft' | 'ordered' | 'cancelled';
export type ReceiveStatus = 'not_received' | 'partial' | 'received' | 'closed';
export type PaymentStatus = 'unpaid' | 'partial' | 'paid';

export interface PurchaseOrderLine {
  ingredientId: string;
  purchaseUnit: string;
  factor: number;
  qtyOrdered: number;
  qtyReceived: number;
  unitPrice: number;
}

export interface PurchaseOrder {
  id: string;
  code: string;
  name: string;
  supplierId: string;
  orderDate: string | null;
  expectedDate: string | null;
  status: PurchaseOrderStatus;
  receiveStatus: ReceiveStatus;
  lines: PurchaseOrderLine[];
  discount: number;
  taxPercent: number;
  otherCost: number;
  paid: number;
  note: string;
  createdAt: string;
  createdBy: string;
}

export type StocktakeStatus = 'draft' | 'pending' | 'approved' | 'matched' | 'rejected' | 'cancelled';

export interface StocktakeSummary {
  id: string;
  code: string;
  status: StocktakeStatus;
  createdAt: string;
  createdBy: string;
  rejectReason: string;
  increaseValue: number;
  decreaseValue: number;
}

/* ---------------------------------------------------------------- Dashboard kho */

export type WarehousePeriod = 'today' | 'last7' | 'thisMonth' | 'custom';

export interface WarehouseRange {
  period: WarehousePeriod;
  from: string;
  to: string;
}

export interface WarehouseDashboard {
  stockValue: number;
  lowCount: number;
  outCount: number;
  pendingPurchaseCount: number;
  latePurchaseCount: number;
  debt: number;
  purchaseTotal: number;
  issueValue: number;
  lossValue: number;
  series: { label: string; inValue: number; outValue: number }[];
  needRestock: { id: string; code: string; name: string; unit: string; onHand: number; minLevel: number; level: StockLevel }[];
  pendingPurchases: {
    id: string;
    code: string;
    supplierName: string;
    expectedDate: string | null;
    receiveStatus: ReceiveStatus;
    due: 'late' | 'soon' | null;
  }[];
  stocktakes: StocktakeSummary[];
  losses: { ingredientId: string; name: string; unit: string; qty: number; value: number; source: 'waste' | 'stocktake' }[];
}

export interface StockSummaryRow {
  id: string;
  code: string;
  name: string;
  unit: string;
  group: IngredientGroup;
  opening: number;
  inQty: number;
  outQty: number;
  adjustQty: number;
  closing: number;
  closingValue: number;
}

export interface StockSummaryFilter {
  keyword: string;
  group: IngredientGroup | '';
  page: number;
}

export type StockSummaryPage = Paged<StockSummaryRow> & { totalValue: number };
