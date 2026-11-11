export * from './management';

export type PeriodKey =
  | 'today'
  | 'yesterday'
  | 'last7'
  | 'last30'
  | 'thisMonth'
  | 'lastMonth';

export interface PeriodOption {
  key: PeriodKey;
  label: string;
}

export type TrendDirection = 'up' | 'down' | 'flat';

export interface RevenuePoint {
  /** Nhãn trục hoành: "09:00" cho mốc theo giờ, "T2 04/11" cho mốc theo ngày. */
  label: string;
  current: number;
  previous: number;
}

export interface RevenueResponse {
  period: PeriodKey;
  total: number;
  orders: number;
  avgOrder: number;
  /** Phần trăm thay đổi so với kỳ trước; null khi kỳ trước bằng 0 hoặc không có dữ liệu. */
  change: number | null;
  series: RevenuePoint[];
  comparing: boolean;
  hasData: boolean;
}

export type StockStatus = 'ok' | 'low' | 'out';

export interface IngredientStock {
  id: string;
  name: string;
  unit: string;
  onHand: number;
  minLevel: number;
  status: StockStatus;
}

export interface InventoryResponse {
  period: PeriodKey;
  /** Tổng giá trị hàng đã nhận trong kỳ (không gồm phí vận chuyển). */
  purchaseCost: number;
  /** Phiếu "Đã đặt" chưa nhận hoặc nhận một phần. */
  pendingReceipts: number;
  pendingReceiptsValue: number;
  /** Giá trị hàng đã nhận trừ số đã thanh toán. */
  supplierDebt: number;
  totalIngredients: number;
  lowStockCount: number;
  outOfStockCount: number;
  lowStock: IngredientStock[];
  hasData: boolean;
}

export interface DishRank {
  id: string;
  name: string;
  category: string;
  quantity: number;
  revenue: number;
  /** Tỷ trọng số lượng so với món bán chạy nhất trong kỳ (0–100), dùng cho thanh tiến độ ở cả tab Bán chạy và Bán chậm. */
  share: number;
}

export interface TopDishesResponse {
  period: PeriodKey;
  best: DishRank[];
  slow: DishRank[];
  hasData: boolean;
}

export type NotificationType = 'reservation' | 'inventory';

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  description: string;
  /** ISO timestamp. */
  createdAt: string;
  read: boolean;
  href: string | null;
}

export interface NotificationResponse {
  items: AppNotification[];
  unreadCount: number;
  total: number;
}

export interface PageSuggestion {
  id: string;
  label: string;
  /** Nhãn mục cha để người dùng nhận ra vị trí trong menu. */
  context: string;
  path: string;
}

export interface CurrentUser {
  id: string;
  name: string;
  role: string;
  email: string;
  initials: string;
  restaurant: string;
}

export type MenuBadgeSource = 'notifications' | 'static';

export interface MenuSubItem {
  id: string;
  label: string;
  path: string;
}

export interface MenuItem {
  id: string;
  label: string;
  icon: string;
  path?: string;
  children?: MenuSubItem[];
  badge?: {
    source: MenuBadgeSource;
    count?: number;
    variant?: 'accent' | 'danger';
  };
}

export interface MenuGroup {
  id: string;
  /** null cho mục Dashboard nằm trên cùng, không thuộc nhóm. */
  label: string | null;
  items: MenuItem[];
}

export interface MenuResponse {
  groups: MenuGroup[];
}