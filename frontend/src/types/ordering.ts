/* Kiểu dữ liệu Đặt món (khách tại bàn), Bếp, Thu ngân (DacTa_UC_DatMon_Bep_ThuNgan). */

/** unconfirmed = khách gửi qua QR, chờ nhân viên phục vụ xác nhận (bếp chưa thấy) — từ V22. */
export type OrderItemStatus = 'unconfirmed' | 'pending' | 'cooking' | 'done' | 'served' | 'cancelled';
export type OrderStatus = 'open' | 'completed' | 'cancelled';
export type CancelSource = 'customer' | 'cashier' | 'kitchen' | 'waiter';

export interface OrderItem {
  id: string;
  dishId: string;
  name: string;
  price: number;
  qty: number;
  note: string;
  status: OrderItemStatus;
  batchNo: number;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  servedAt: string | null;
  cancelSource: CancelSource | null;
  cancelReason: string | null;
  cancelledBy: string | null;
  /** Món con của một set khách gọi (null = món gọi lẻ); price của món con là phần giá set đã chia. */
  setId: string | null;
  setName: string | null;
  /** Người xác nhận món (phục vụ xác nhận đơn khách, hoặc người gọi hộ) — người chịu trách nhiệm. */
  confirmedBy: string | null;
  confirmedAt: string | null;
}

/** Set khách đã gọi trong đơn: price = giá set lúc gọi; activeTotal = tổng món con chưa hủy. */
export interface OrderSetLine {
  id: string;
  name: string;
  price: number;
  activeTotal: number;
}

export interface OrderView {
  id: string;
  code: string;
  tableId: string;
  tableCode: string;
  areaName: string;
  status: OrderStatus;
  /** Đang có hóa đơn chưa thanh toán: không gọi thêm, không hủy món. */
  locked: boolean;
  createdAt: string;
  subtotal: number;
  pendingCount: number;
  readyCount: number;
  items: OrderItem[];
  sets: OrderSetLine[];
  /** Số món khách gửi đang chờ phục vụ xác nhận. */
  unconfirmedCount: number;
}

/* ---------------------------------------------------------------- Trang đặt món (QR) */

export interface QrTableInfo {
  tableId: string;
  tableCode: string;
  areaName: string;
  restaurantName: string;
  restaurantPhone: string;
  /** Ảnh bìa đầu trang (Quản lý tải ở Cấu hình hệ thống), null nếu chưa có. */
  coverImage: string | null;
  openNow: boolean;
  /** Ngoài giờ: lần mở cửa kế tiếp (ISO), không có thì null. */
  reopenAt: string | null;
  order: OrderView | null;
  /** Yêu cầu hỗ trợ đang chờ (Mới / Đã chuyển). */
  support: CustomerRequest | null;
  /** Yêu cầu thanh toán đang chờ. */
  payment: CustomerRequest | null;
  /** Hóa đơn chưa thanh toán (đơn đã khóa). */
  invoice: QrInvoice | null;
  /** Vừa thanh toán xong (15 phút, bàn chưa có đơn mới). */
  paid: { code: string; total: number; paidAt: string } | null;
}

export interface MenuCategory {
  id: string;
  name: string;
  /** Ảnh minh họa danh mục (món tách nền); null = hiện chữ cái đầu. */
  image: string | null;
}

export interface MenuDish {
  id: string;
  name: string;
  categoryId: string;
  price: number;
  description: string;
  image: string | null;
  ingredients: string;
  allergens: string[];
  spicyLevel: number;
  tags: string[];
  soldOut: boolean;
  /** Món thuộc nhóm (vd. Nước ngọt có ga) → hiện chung một thẻ; variantLabel = tên ở khung chọn loại. */
  groupId: string | null;
  variantLabel: string | null;
}

/** Nhóm món: một thẻ trên thực đơn, bấm vào chọn loại. dishIds theo thứ tự hiển thị. */
export interface QrMenuGroup {
  id: string;
  name: string;
  categoryId: string;
  description: string;
  image: string | null;
  dishIds: string[];
}

export interface MenuSetItem {
  /** Món mặc định (món cho đổi loại: loại đang còn hàng). */
  dishId: string;
  name: string;
  qty: number;
  /** Khách được đổi sang loại khác cùng nhóm (vd. nước ngọt). */
  allowVariant: boolean;
  groupId: string | null;
}

/** Set đang bán được lúc này (đang bật, trong giờ bán, mọi món còn phục vụ). */
export interface MenuSet {
  id: string;
  name: string;
  description: string;
  image: string | null;
  price: number;
  /** Tổng giá gọi lẻ. */
  originalPrice: number;
  sellFrom: string | null;
  sellTo: string | null;
  items: MenuSetItem[];
}

export interface QrMenu {
  categories: MenuCategory[];
  dishes: MenuDish[];
  groups: QrMenuGroup[];
  sets: MenuSet[];
  /** Bán chạy 7 ngày qua, nhiều nhất trước, tối đa 10: id món, hoặc "g" + id nhóm (cộng chung các loại). */
  bestSellers: string[];
}

/** Một món con của set trong giỏ (đã chọn loại, độ chín…). */
export interface CartSetPart {
  dishId: string;
  name: string;
  qty: number;
  note: string;
}

export interface CartLine {
  key: string;
  /** Món lẻ: id món. Set: id món đầu tiên (chỉ để hiển thị) — dùng setId để phân biệt. */
  dishId: string;
  name: string;
  price: number;
  image: string | null;
  qty: number;
  note: string;
  /** Có giá trị khi dòng là set. */
  setId?: string;
  parts?: CartSetPart[];
}

/* ---------------------------------------------------------------- Bếp */

export interface KitchenItem {
  id: string;
  orderId: string;
  orderCode: string;
  tableId: string;
  tableCode: string;
  areaName: string;
  batchNo: number;
  dishId: string;
  dishName: string;
  categoryId: string;
  categoryName: string;
  qty: number;
  note: string;
  status: OrderItemStatus;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  /** Bếp hoàn tác "Đã xong" → món quay lại hàng chờ (nhãn GỌI LẠI). */
  recalledAt: string | null;
  cancelSource: 'customer' | 'cashier' | 'kitchen' | null;
  cancelledAt: string | null;
  /** Món con của set (bếp vẫn làm từng món) — hiện nhãn tên set. */
  setName: string | null;
}

export interface KitchenQueue {
  items: KitchenItem[];
  recent: KitchenItem[];
  /** Món khách / thu ngân vừa hủy (10 phút) — nhãn ĐÃ ĐỔI. */
  changed: KitchenItem[];
  pendingCount: number;
  cookingCount: number;
  doneToday: number;
  soldOutCount: number;
  /** Thời gian ra món trung bình hôm nay (phút), chưa có món xong thì null. */
  avgMinutesToday: number | null;
  categories: { id: string; name: string }[];
}

export type KitchenCancelReason = 'out_of_stock' | 'bad_quality' | 'other';

export interface SoldOutDish {
  id: string;
  name: string;
  categoryName: string;
  soldOut: boolean;
  soldOutBy: string | null;
  pendingCount: number;
}

/* ---------------------------------------------------------------- Thu ngân */

export interface FloorTable {
  id: string;
  code: string;
  areaId: string;
  seats: number;
  shape: 'square' | 'round' | 'rect';
  x: number;
  y: number;
  status: 'available' | 'reserved' | 'occupied' | 'inactive';
  order: { id: string; code: string; openedAt: string; subtotal: number; pendingCount: number; readyCount: number; locked: boolean; guests: number | null; lateCount: number; unconfirmedCount: number } | null;
  reservation: { id: string; time: string; customerName: string; guests: number } | null;
  supportRequest: boolean;
  paymentRequest: boolean;
}

export interface ReadyItem {
  id: string;
  orderId: string;
  tableId: string;
  tableCode: string;
  dishName: string;
  qty: number;
  note: string | null;
  completedAt: string;
}

export interface FloorReservation {
  id: string;
  time: string;
  customerName: string;
  phone: string;
  guests: number;
  tableCode: string | null;
  status: 'pending' | 'confirmed' | 'seated';
}

export interface CashierFloor {
  cols: number;
  rows: number;
  areas: { id: string; name: string }[];
  tables: FloorTable[];
  ready: ReadyItem[];
  occupiedCount: number;
  tableCount: number;
  revenueToday: number;
  requestCount: number;
  unpaidCount: number;
  reservations: FloorReservation[];
  /** Món chờ quá số phút này → bàn "Quá giờ". */
  lateMinutes: number;
}

/* ---------------------------------------------------------------- Đợt 2: yêu cầu, hóa đơn, thanh toán */

export type RequestType = 'support' | 'consult' | 'payment' | 'other';
export type RequestStatus = 'new' | 'forwarded' | 'done' | 'cancelled';
export type PayMethod = 'cash' | 'card' | 'transfer' | 'ewallet';
export type InvoiceStatus = 'unpaid' | 'paid' | 'cancelled';

/** Mã QR chuyển khoản VietQR (payload dựng thành ảnh QR ở trình duyệt). */
export interface TransferQr {
  bankName: string;
  accountNo: string;
  accountName: string;
  amount: number;
  content: string;
  payload: string;
}

export interface InvoiceLine {
  name: string;
  price: number;
  qty: number;
  amount: number;
  /** Dòng set: danh sách món trong set; null = món gọi lẻ. */
  detail: string | null;
}

export interface CustomerRequest {
  id: string;
  type: RequestType;
  content: string;
  status: RequestStatus;
  assignedName: string | null;
  createdAt: string;
  paymentMethod: PayMethod | null;
}

export interface QrInvoice {
  id: string;
  code: string;
  lines: InvoiceLine[];
  total: number;
  transfer: TransferQr | null;
}

export interface ServiceRequest {
  id: string;
  tableId: string;
  tableCode: string;
  areaName: string;
  orderId: string | null;
  orderCode: string | null;
  type: RequestType;
  content: string;
  paymentMethod: PayMethod | null;
  vatCompany: string;
  vatTaxCode: string;
  status: RequestStatus;
  assignedName: string | null;
  receivedName: string | null;
  createdAt: string;
  forwardedAt: string | null;
  doneAt: string | null;
  cancelledAt: string | null;
  invoiceId: string | null;
}

export interface RequestList {
  items: ServiceRequest[];
  waitingCount: number;
}

export interface CashierOrderDetail {
  order: OrderView;
  closedAt: string | null;
  requests: ServiceRequest[];
  invoice: { id: string; code: string; status: InvoiceStatus; total: number } | null;
  /** Số khách thu ngân nhập (null = chưa nhập). */
  guests: number | null;
}

export type CashierCancelReason = 'changed_mind' | 'wrong_order' | 'left' | 'other';

export interface MoveTarget {
  id: string;
  code: string;
  areaId: string;
  areaName: string;
  seats: number;
  status: 'available' | 'reserved' | 'occupied';
  reservation: { id: string; time: string; customerName: string; guests: number } | null;
}

export type OrderListStatus = '' | 'open' | 'awaiting_payment' | 'completed' | 'cancelled';

export interface OrderRow {
  id: string;
  code: string;
  tableCode: string;
  areaName: string;
  openedAt: string;
  closedAt: string | null;
  itemCount: number;
  total: number;
  status: 'open' | 'awaiting_payment' | 'completed' | 'cancelled';
  invoiceId: string | null;
  invoiceCode: string | null;
}

export interface OrderList {
  items: OrderRow[];
  count: number;
  completedTotal: number;
}

export interface InvoicePreview {
  orderId: string;
  orderCode: string;
  tableCode: string;
  lines: InvoiceLine[];
  total: number;
  vatCompany: string;
  vatTaxCode: string;
  requestedMethod: PayMethod | null;
  /** Món còn Chờ / Đang chế biến (chặn lập hóa đơn). */
  blockers: string[];
}

export interface InvoicePayment {
  method: PayMethod;
  amount: number;
  cashGiven: number | null;
  change: number | null;
  transactionRef: string | null;
  paidAt: string;
  receivedBy: string | null;
}

export interface Invoice {
  id: string;
  code: string;
  orderId: string;
  orderCode: string;
  tableId: string;
  tableCode: string;
  areaName: string;
  status: InvoiceStatus;
  lines: InvoiceLine[];
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  vatCompany: string;
  vatTaxCode: string;
  cashierName: string | null;
  createdAt: string;
  paidAt: string | null;
  cancelReason: string | null;
  cancelledBy: string | null;
  cancelledAt: string | null;
  payments: InvoicePayment[];
  requestedMethod: PayMethod | null;
  transfer: TransferQr | null;
  restaurant: { name: string; address: string; phone: string; taxCode: string };
}

export interface InvoiceRow {
  id: string;
  code: string;
  orderId: string;
  orderCode: string;
  tableCode: string;
  createdAt: string;
  paidAt: string | null;
  total: number;
  methods: PayMethod[];
  cashierName: string | null;
  status: InvoiceStatus;
}

export interface InvoiceList {
  items: InvoiceRow[];
  count: number;
  paidTotal: number;
  byMethod: Record<PayMethod, number>;
}

export interface PaymentLineInput {
  method: PayMethod;
  amount: number;
  cashGiven: number | null;
  transactionRef: string;
}

export interface BankAccount {
  bankBin: string;
  bankName: string;
  accountNo: string;
  accountName: string;
  configured: boolean;
}
