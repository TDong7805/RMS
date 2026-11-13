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

export interface SupplierOption {
  id: string;
  code: string;
  name: string;
  active: boolean;
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

/* ---------------------------------------------------------------- Phiếu mua (API thật, UC-KHO-12..16) */

/** Bộ lọc trạng thái danh sách: waiting = Chưa nhận + Nhận một phần. */
export type PurchaseListStatus = 'all' | 'draft' | 'waiting' | 'received' | 'closed' | 'cancelled';

export interface PurchaseOrderRow {
  id: string;
  code: string;
  name: string;
  supplierId: string;
  supplierName: string;
  orderDate: string | null;
  expectedDate: string | null;
  status: PurchaseOrderStatus;
  receiveStatus: ReceiveStatus;
  /** Chỉ có khi phiếu Đã đặt. */
  paymentStatus: PaymentStatus | null;
  total: number;
  payable: number;
  paid: number;
  debt: number;
  late: boolean;
  lineCount: number;
  createdAt: string;
}

export interface PurchaseOrderFilter {
  keyword: string;
  supplierId: string;
  status: PurchaseListStatus;
  payment: PaymentStatus | 'all';
  from: string;
  to: string;
  page: number;
}

export interface PurchaseCurrentLink {
  active: boolean;
  purchaseUnit: string;
  factor: number;
  price: number;
  minOrder: number | null;
}

export interface PurchaseOrderLineDetail {
  id: string;
  ingredientId: string;
  ingredientCode: string;
  ingredientName: string;
  stockUnit: string;
  ingredientActive: boolean;
  purchaseUnit: string;
  factor: number;
  qtyOrdered: number | null;
  qtyReceived: number;
  unitPrice: number | null;
  amount: number;
  onHand: number;
  currentLink: PurchaseCurrentLink | null;
}

export type PurchaseEventType = 'create' | 'order' | 'cancel' | 'close';
export type PurchaseCancelReason = 'supplier_cannot' | 'wrong' | 'switch' | 'no_need' | 'other';
export type PurchaseCloseReason = 'out_of_stock' | 'short' | 'no_need' | 'other';

export interface PurchaseOrderDetail {
  id: string;
  code: string;
  name: string;
  supplier: { id: string; code: string; name: string; phone: string; address: string; paymentMethod: PaymentMethod; active: boolean };
  orderDate: string | null;
  expectedDate: string | null;
  note: string;
  status: PurchaseOrderStatus;
  receiveStatus: ReceiveStatus;
  paymentStatus: PaymentStatus | null;
  late: boolean;
  discountPercent: number | null;
  discount: number;
  taxPercent: number;
  otherCost: number;
  subtotal: number;
  tax: number;
  total: number;
  payable: number;
  paid: number;
  debt: number;
  lines: PurchaseOrderLineDetail[];
  receipts: { id: string; code: string; at: string; by: string; value: number; status: ReceiptStatus }[];
  payments: { id: string; code: string; paidAt: string; amount: number; method: PaymentMethod; by: string; status: 'valid' | 'cancelled' }[];
  events: { id: string; event: PurchaseEventType; reason: string | null; note: string; by: string; at: string }[];
  createdBy: string;
  createdAt: string;
  orderedBy: string | null;
  orderedAt: string | null;
}

export interface PurchaseOrderInput {
  supplierId: string;
  name: string;
  orderDate: string;
  expectedDate: string;
  note: string;
  /** null = giảm theo số tiền (discount). */
  discountPercent: number | null;
  discount: number | null;
  taxPercent: number;
  otherCost: number;
  lines: { ingredientId: string; qty: number | null; unitPrice: number | null }[];
}

/* ---------------------------------------------------------------- Phiếu nhập (UC-KHO-17..19) */

export type ReceiptKind = 'po' | 'direct' | 'opening';
export type ReceiptStatus = 'posted' | 'cancelled';

export interface ReceiptRow {
  id: string;
  code: string;
  at: string;
  kind: ReceiptKind;
  purchaseOrderId: string | null;
  purchaseOrderCode: string | null;
  source: string;
  itemCount: number;
  value: number;
  by: string;
  status: ReceiptStatus;
}

export type ReceiptPage = Paged<ReceiptRow> & { totalValue: number };

export interface ReceiptFilter {
  keyword: string;
  kind: ReceiptKind | 'all';
  from: string;
  to: string;
  page: number;
}

export interface ReceiptLine {
  id: string;
  ingredientId: string;
  ingredientCode: string;
  ingredientName: string;
  stockUnit: string;
  unit: string;
  factor: number;
  qty: number;
  stockQty: number;
  unitPrice: number;
  stockUnitCost: number;
  amount: number;
  note: string;
}

export interface ReceiptDetail {
  id: string;
  code: string;
  at: string;
  kind: ReceiptKind;
  purchaseOrderId: string | null;
  purchaseOrderCode: string | null;
  supplierId: string | null;
  source: string;
  note: string;
  value: number;
  by: string;
  status: ReceiptStatus;
  cancelReason: string | null;
  cancelledBy: string | null;
  cancelledAt: string | null;
  canCancel: boolean;
  cannotCancelReason: string | null;
  lines: ReceiptLine[];
}

export interface ReceiveInput {
  lines: { purchaseOrderItemId: string; qty: number; note: string }[];
  note: string;
}

export interface DirectReceiptInput {
  supplierId: string | null;
  sourceName: string;
  note: string;
  lines: { ingredientId: string; unit: string; qty: number | null; unitPrice: number | null }[];
}

/* ---------------------------------------------------------------- Xuất kho (UC-KHO-20, 21) */

export type IssueReason = 'kitchen' | 'damaged' | 'expired' | 'other';

export interface IssueRow {
  id: string;
  code: string;
  at: string;
  reason: IssueReason;
  receiver: string;
  itemCount: number;
  value: number;
  by: string;
  itemNames: string;
}

export type IssuePage = Paged<IssueRow> & { totalValue: number };

export interface IssueFilter {
  keyword: string;
  reason: IssueReason | 'all';
  from: string;
  to: string;
  page: number;
}

export interface IssueDetail {
  id: string;
  code: string;
  at: string;
  reason: IssueReason;
  receiver: string;
  note: string;
  value: number;
  by: string;
  lines: { id: string; ingredientId: string; ingredientCode: string; ingredientName: string; unit: string; qty: number; unitCost: number | null; value: number }[];
}

export interface IssueInput {
  reason: IssueReason;
  receiverId: string;
  note: string;
  lines: { ingredientId: string; qty: number | null }[];
}

export interface WarehouseEmployee {
  id: string;
  fullName: string;
  role: string;
}

/* ---------------------------------------------------------------- Kiểm kê (UC-KHO-22..24) */

export type StocktakeScope = 'all' | 'group' | 'pick';
export type StocktakeReason = 'natural' | 'damaged' | 'wrong_entry' | 'lost' | 'other';
export type StocktakeEventType = 'create' | 'submit' | 'matched' | 'approve' | 'reject' | 'cancel';

export interface StocktakeRow {
  id: string;
  code: string;
  createdAt: string;
  scope: StocktakeScope;
  itemCount: number;
  countedCount: number;
  diffCount: number;
  increaseValue: number;
  decreaseValue: number;
  /** Giá trị tạm tính (chưa duyệt). */
  provisional: boolean;
  status: StocktakeStatus;
  rejectReason: string | null;
  createdBy: string;
  approvedBy: string | null;
  submittedAt: string | null;
}

export interface StocktakeFilter {
  keyword: string;
  status: StocktakeStatus | 'all';
  from: string;
  to: string;
  page: number;
}

export interface StocktakeLine {
  id: string;
  ingredientId: string;
  code: string;
  name: string;
  group: IngredientGroup;
  unit: string;
  active: boolean;
  onHand: number;
  avgCost: number | null;
  bookQty: number | null;
  actualQty: number | null;
  countedAt: string | null;
  diff: number | null;
  reason: StocktakeReason | null;
  note: string;
  estUnitCost: number | null;
  suggestedCost: number | null;
  value: number | null;
}

export interface StocktakeDetail {
  id: string;
  code: string;
  scope: StocktakeScope;
  groups: IngredientGroup[];
  note: string;
  status: StocktakeStatus;
  rejectReason: string | null;
  cancelReason: string | null;
  createdBy: string;
  createdAt: string;
  submittedAt: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  itemCount: number;
  countedCount: number;
  diffCount: number;
  increaseValue: number;
  decreaseValue: number;
  provisional: boolean;
  lines: StocktakeLine[];
  events: { id: string; event: StocktakeEventType; note: string; by: string; at: string }[];
  /** Thông báo kèm theo (VD: một số nguyên liệu bị bỏ vì đang nằm trong phiếu khác). */
  message: string | null;
}

export interface StocktakeCreateInput {
  scope: StocktakeScope;
  groups: IngredientGroup[];
  ingredientIds: string[];
  note: string;
}

export interface StocktakeLineInput {
  actualQty: number | null;
  reason: StocktakeReason | null;
  note: string;
  estUnitCost: number | null;
}

/* ---------------------------------------------------------------- Công nợ NCC (UC-KHO-25, 26) */

export interface DebtRow {
  supplierId: string;
  supplierCode: string;
  supplierName: string;
  payable: number;
  paid: number;
  debt: number;
  openCount: number;
  oldestDate: string | null;
}

export type DebtPage = Paged<DebtRow> & { totalPayable: number; totalPaid: number; totalDebt: number };

export interface DebtFilter {
  keyword: string;
  status: 'all' | 'owing' | 'clear';
  page: number;
}

export interface SupplierPayment {
  id: string;
  code: string;
  paidAt: string;
  purchaseOrderId: string | null;
  purchaseOrderCode: string | null;
  amount: number;
  method: PaymentMethod;
  reference: string;
  note: string;
  by: string;
  status: 'valid' | 'cancelled';
  cancelReason: string | null;
}

export interface DebtDetail {
  supplierId: string;
  supplierCode: string;
  supplierName: string;
  paymentMethod: PaymentMethod;
  payable: number;
  paid: number;
  debt: number;
  orders: PurchaseOrderRow[];
  payments: SupplierPayment[];
}

export interface PaymentInput {
  purchaseOrderId: string;
  amount: number | null;
  method: PaymentMethod | '';
  paidDate: string;
  reference: string;
  note: string;
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
