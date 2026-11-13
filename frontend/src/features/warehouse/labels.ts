import type { BadgeVariant } from '@/components/common/Badge';
import type {
  IngredientGroup,
  IssueReason,
  StocktakeEventType,
  StocktakeReason,
  StocktakeScope,
  PaymentMethod,
  PaymentStatus,
  PurchaseCancelReason,
  PurchaseCloseReason,
  PurchaseEventType,
  PurchaseListStatus,
  ReceiptKind,
  PriceChange,
  PurchaseOrderStatus,
  ReceiveStatus,
  StockLevel,
  StockMoveType,
  StocktakeStatus,
  SupplierStopReason,
} from '@/types';

/** Nhóm nguyên liệu — danh sách cố định (UC-KHO-03). */
export const INGREDIENT_GROUPS: Record<IngredientGroup, string> = {
  meat: 'Thịt',
  seafood: 'Hải sản',
  produce: 'Rau củ quả',
  spice: 'Gia vị & nước chấm',
  dry: 'Đồ khô',
  dairy: 'Sữa & trứng',
  drink: 'Đồ uống',
  other: 'Khác',
};
export const INGREDIENT_GROUP_KEYS = Object.keys(INGREDIENT_GROUPS) as IngredientGroup[];

/** Đơn vị kho (UC-KHO-03). */
export const STOCK_UNITS = ['kg', 'g', 'lít', 'ml', 'cái', 'quả', 'bó', 'hộp', 'chai', 'lon', 'gói', 'túi'];

/** Đơn vị mua = đơn vị kho + quy cách đóng gói (UC-KHO-11). */
export const PURCHASE_UNITS = [...STOCK_UNITS, 'thùng', 'bao', 'khay', 'can', 'lốc', 'két', 'bình'];

/** Đơn vị đếm dùng số nguyên; còn lại cho phép số lẻ. */
export const COUNT_UNITS = new Set(['cái', 'quả', 'bó', 'hộp', 'chai', 'lon', 'gói', 'túi', 'thùng', 'bao', 'khay', 'can', 'lốc', 'két', 'bình']);

export const STOCK_LEVEL: Record<StockLevel, { label: string; variant: BadgeVariant }> = {
  ok: { label: 'Đủ hàng', variant: 'accent' },
  low: { label: 'Sắp hết', variant: 'warning' },
  out: { label: 'Hết hàng', variant: 'danger' },
};

export const PAYMENT_METHOD: Record<PaymentMethod, string> = {
  cash: 'Tiền mặt',
  transfer: 'Chuyển khoản',
};

export const SUPPLIER_STOP_REASON: Record<SupplierStopReason, string> = {
  ended: 'Ngừng hợp tác',
  quality: 'Chất lượng không đạt',
  price: 'Giá không cạnh tranh',
  late: 'Giao hàng chậm / không đúng hẹn',
  other: 'Khác',
};

export const PRICE_CHANGE: Record<PriceChange, string> = {
  create: 'Tạo mới',
  price: 'Đổi giá',
  spec: 'Đổi quy cách',
  min: 'Đổi SL tối thiểu',
  reactivate: 'Kích hoạt lại',
};

export const STOCK_MOVE: Record<StockMoveType, { label: string; variant: BadgeVariant }> = {
  opening: { label: 'Tồn đầu kỳ', variant: 'neutral' },
  po_receipt: { label: 'Nhập theo phiếu mua', variant: 'accent' },
  direct_receipt: { label: 'Nhập không phiếu', variant: 'accent' },
  receipt_cancel: { label: 'Hủy phiếu nhập', variant: 'danger' },
  issue_kitchen: { label: 'Xuất cho bếp', variant: 'info' },
  issue_waste: { label: 'Xuất hủy', variant: 'danger' },
  issue_other: { label: 'Xuất khác', variant: 'info' },
  stocktake: { label: 'Điều chỉnh kiểm kê', variant: 'warning' },
};

export const PURCHASE_STATUS: Record<PurchaseOrderStatus, string> = {
  draft: 'Nháp',
  ordered: 'Đã đặt',
  cancelled: 'Đã hủy',
};

export const RECEIVE_STATUS: Record<ReceiveStatus, { label: string; variant: BadgeVariant }> = {
  not_received: { label: 'Chưa nhận', variant: 'info' },
  partial: { label: 'Nhận một phần', variant: 'warning' },
  received: { label: 'Đã nhận đủ', variant: 'accent' },
  closed: { label: 'Đã kết thúc', variant: 'neutral' },
};

export const PAYMENT_STATUS: Record<PaymentStatus, { label: string; variant: BadgeVariant }> = {
  unpaid: { label: 'Chưa thanh toán', variant: 'neutral' },
  partial: { label: 'Thanh toán một phần', variant: 'warning' },
  paid: { label: 'Đã thanh toán', variant: 'accent' },
};

/** Nhãn một cột "Trạng thái" của phiếu mua (UC-KHO-12): Nháp / Đã hủy, hoặc trạng thái nhận khi Đã đặt. */
export function purchaseStatusLabel(status: PurchaseOrderStatus, receive: ReceiveStatus): { label: string; variant: BadgeVariant } {
  if (status === 'draft') return { label: 'Nháp', variant: 'neutral' };
  if (status === 'cancelled') return { label: 'Đã hủy', variant: 'danger' };
  return RECEIVE_STATUS[receive];
}

export const PURCHASE_LIST_STATUS: Record<PurchaseListStatus, string> = {
  all: 'Tất cả trạng thái',
  draft: 'Nháp',
  waiting: 'Đang chờ nhận',
  received: 'Đã nhận đủ',
  closed: 'Đã kết thúc',
  cancelled: 'Đã hủy',
};

export const PURCHASE_CANCEL_REASON: Record<PurchaseCancelReason, string> = {
  supplier_cannot: 'Nhà cung cấp không giao được',
  wrong: 'Đặt nhầm',
  switch: 'Chuyển sang nhà cung cấp khác',
  no_need: 'Không còn nhu cầu',
  other: 'Khác',
};

export const PURCHASE_CLOSE_REASON: Record<PurchaseCloseReason, string> = {
  out_of_stock: 'Nhà cung cấp hết hàng',
  short: 'Nhà cung cấp giao thiếu',
  no_need: 'Không còn nhu cầu',
  other: 'Khác',
};

export const PURCHASE_EVENT: Record<PurchaseEventType, string> = {
  create: 'Tạo phiếu',
  order: 'Đặt hàng',
  cancel: 'Hủy phiếu',
  close: 'Kết thúc nhận hàng',
};

export const RECEIPT_KIND: Record<ReceiptKind, string> = {
  po: 'Theo phiếu mua',
  direct: 'Nhập không phiếu',
  opening: 'Tồn đầu kỳ',
};

export const ISSUE_REASON: Record<IssueReason, { label: string; variant: BadgeVariant }> = {
  kitchen: { label: 'Xuất cho bếp', variant: 'info' },
  damaged: { label: 'Hủy – hư hỏng', variant: 'danger' },
  expired: { label: 'Hủy – hết hạn', variant: 'danger' },
  other: { label: 'Khác', variant: 'neutral' },
};

export const STOCKTAKE_SCOPE: Record<StocktakeScope, string> = {
  all: 'Tất cả nguyên liệu',
  group: 'Theo nhóm',
  pick: 'Chọn từng nguyên liệu',
};

export const STOCKTAKE_REASON: Record<StocktakeReason, string> = {
  natural: 'Hao hụt tự nhiên',
  damaged: 'Hư hỏng / hết hạn chưa xuất hủy',
  wrong_entry: 'Nhập / xuất ghi sai',
  lost: 'Mất mát',
  other: 'Khác',
};

export const STOCKTAKE_EVENT: Record<StocktakeEventType, string> = {
  create: 'Lập phiếu',
  submit: 'Gửi duyệt',
  matched: 'Hoàn tất (khớp sổ sách)',
  approve: 'Duyệt',
  reject: 'Từ chối',
  cancel: 'Hủy phiếu',
};

export const STOCKTAKE_STATUS: Record<StocktakeStatus, { label: string; variant: BadgeVariant }> = {
  draft: { label: 'Nháp', variant: 'neutral' },
  pending: { label: 'Chờ duyệt', variant: 'warning' },
  approved: { label: 'Đã duyệt', variant: 'accent' },
  matched: { label: 'Hoàn tất (khớp sổ sách)', variant: 'accent' },
  rejected: { label: 'Bị từ chối', variant: 'danger' },
  cancelled: { label: 'Đã hủy', variant: 'neutral' },
};

/** "12,5 kg" — đơn vị đếm hiển thị số nguyên, đơn vị cân đo tối đa 3 chữ số thập phân. */
export function formatQty(value: number, unit?: string): string {
  const text = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 3 }).format(value);
  return unit ? `${text} ${unit}` : text;
}

/** "thùng = 24 lon" (đơn vị mua trùng đơn vị kho thì chỉ ghi đơn vị). */
export function formatSpec(purchaseUnit: string, factor: number, stockUnit: string): string {
  if (factor === 1 && purchaseUnit === stockUnit) return stockUnit;
  return `${purchaseUnit} = ${formatQty(factor)} ${stockUnit}`;
}
