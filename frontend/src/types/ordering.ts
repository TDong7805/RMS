/* Kiểu dữ liệu Đặt món (khách tại bàn), Bếp, Thu ngân (DacTa_UC_DatMon_Bep_ThuNgan). */

export type OrderItemStatus = 'pending' | 'cooking' | 'done' | 'served' | 'cancelled';
export type OrderStatus = 'open' | 'completed' | 'cancelled';
export type CancelSource = 'customer' | 'cashier' | 'kitchen';

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
}

/* ---------------------------------------------------------------- Trang đặt món (QR) */

export interface QrTableInfo {
  tableId: string;
  tableCode: string;
  areaName: string;
  restaurantName: string;
  restaurantPhone: string;
  openNow: boolean;
  order: OrderView | null;
}

export interface MenuCategory {
  id: string;
  name: string;
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
}

export interface QrMenu {
  categories: MenuCategory[];
  dishes: MenuDish[];
}

export interface CartLine {
  key: string;
  dishId: string;
  name: string;
  price: number;
  image: string | null;
  qty: number;
  note: string;
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
}

export interface KitchenQueue {
  items: KitchenItem[];
  recent: KitchenItem[];
  pendingCount: number;
  cookingCount: number;
  doneToday: number;
  soldOutCount: number;
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
  order: { id: string; code: string; openedAt: string; subtotal: number; pendingCount: number; readyCount: number; locked: boolean } | null;
  reservation: { time: string; customerName: string; guests: number } | null;
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

export interface CashierFloor {
  cols: number;
  rows: number;
  areas: { id: string; name: string }[];
  tables: FloorTable[];
  ready: ReadyItem[];
  occupiedCount: number;
  tableCount: number;
  revenueToday: number;
}
