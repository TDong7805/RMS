/* Kiểu dữ liệu cho các chức năng của Actor Quản lý nhà hàng (theo đặc tả CodeUC_QLNH). */

export interface Paged<T> {
  items: T[];
  total: number;
  page: number;
  pageCount: number;
}

/* ============================== Khu vực & bàn ============================== */

export interface Area {
  id: string;
  name: string;
  description: string;
  active: boolean;
}

export type TableShape = 'square' | 'round' | 'rect';
export type TableStatus = 'available' | 'occupied' | 'reserved' | 'inactive';

export interface DiningTable {
  id: string;
  code: string;
  areaId: string;
  seats: number;
  shape: TableShape;
  /** Vị trí ô trên sơ đồ (cột, hàng), bắt đầu từ 0. */
  x: number;
  y: number;
  status: TableStatus;
  /** Mã trong QR dán trên bàn; trang đặt món của khách là /goi-mon/{qrToken}. */
  qrToken?: string;
}

export interface TableInput {
  code: string;
  areaId: string;
  seats: number;
  shape: TableShape;
  status: TableStatus;
}

export interface AreaInput {
  name: string;
  description: string;
  active: boolean;
}

/* ============================== Đặt bàn ============================== */

export type ReservationStatus =
  | 'pending'
  | 'confirmed'
  | 'seated'
  | 'completed'
  | 'cancelled'
  | 'no_show';

export type ReservationSource = 'website' | 'phone' | 'walk_in';

export interface Reservation {
  id: string;
  code: string;
  customerName: string;
  phone: string;
  guests: number;
  /** ISO timestamp thời điểm khách đến. */
  dateTime: string;
  areaId: string;
  tableId: string | null;
  note: string;
  status: ReservationStatus;
  source: ReservationSource;
  createdAt: string;
  updatedAt: string;
}

export interface ReservationFilter {
  keyword: string;
  /** YYYY-MM-DD hoặc rỗng. */
  date: string;
  areaId: string;
  status: ReservationStatus | 'all';
  page: number;
}

/** Thông tin được phép chỉnh sửa theo đặc tả. */
export interface ReservationInput {
  customerName: string;
  phone: string;
  guests: number;
  date: string;
  time: string;
  areaId: string;
  tableId: string | null;
  note: string;
}

export interface ReservationFormConfig {
  slotMinutes: number;
  durationMinutes: number;
  minGuests: number;
  maxGuests: number;
  leadTimeMinutes: number;
  maxDaysAhead: number;
  requireEmail: boolean;
  allowAreaChoice: boolean;
  allowNote: boolean;
  autoConfirm: boolean;
  notice: string;
  updatedAt: string;
}

/* ============================== Món ăn ============================== */

export type DishStatus = 'selling' | 'stopped';

export interface DishCategory {
  id: string;
  name: string;
  active: boolean;
  sortOrder: number;
  /** Ảnh minh họa (món tách nền) cho dải danh mục ở trang khách gọi món; null = chưa có. */
  image: string | null;
}

export interface Dish {
  id: string;
  code: string;
  name: string;
  categoryId: string;
  price: number;
  description: string;
  image: string | null;
  status: DishStatus;
  /** Thành phần chính — dữ liệu AI tư vấn dùng để trả lời. */
  ingredients: string;
  /** Dị nguyên đã khai báo. */
  allergens: string[];
  /** 0: không cay … 3: rất cay. */
  spicyLevel: number;
  /** Thẻ gợi ý cho Chatbot AI (Ít cay, Chay, Bán chạy...). */
  aiTags: string[];
  /** AI được phép gợi ý món này hay không. */
  aiEnabled: boolean;
  /** Món đã phát sinh trong đơn hàng/hóa đơn → không được xóa cứng. */
  usedInOrders: boolean;
  /** Nhóm hiển thị trên trang gọi món (vd. Nước ngọt có ga); null = món đứng riêng. */
  groupId: string | null;
  /** Tên loại ở khung chọn của nhóm (vd. "Coca-Cola"); null = dùng tên món. */
  variantLabel: string | null;
  createdAt: string;
  updatedAt: string;
  statusUpdatedAt: string;
}

export interface DishFilter {
  keyword: string;
  categoryId: string;
  status: DishStatus | 'all';
  page: number;
}

export interface DishInput {
  name: string;
  categoryId: string;
  price: number;
  description: string;
  image: string | null;
  status: DishStatus;
  ingredients: string;
  allergens: string[];
  spicyLevel: number;
  groupId?: string | null;
  variantLabel?: string | null;
}

/** Nhóm món: gộp nhiều món cùng loại thành một thẻ trên trang gọi món (mỗi loại vẫn là món riêng). */
export interface DishGroup {
  id: string;
  name: string;
  categoryId: string;
  description: string;
  image: string | null;
  sortOrder: number;
  dishCount: number;
}

export interface DishGroupInput {
  name: string;
  categoryId: string;
  description: string;
  /** null = giữ ảnh hiện tại, "" = bỏ ảnh, data URL = ảnh mới. */
  image: string | null;
}

/* ============================== Tài khoản ============================== */

/** Vai trò trong bảng roles. Quản trị viên đã gộp vào manager; waiter (phục vụ) đăng nhập được từ V20. */
export type RoleKey = 'manager' | 'cashier' | 'kitchen' | 'warehouse' | 'waiter';
export type AccountStatus = 'active' | 'locked';

export interface Account {
  id: string;
  username: string;
  fullName: string;
  email: string;
  phone: string;
  role: RoleKey;
  status: AccountStatus;
  /** true: chưa đổi mật khẩu do quản lý cấp (tài khoản mới hoặc vừa đặt lại mật khẩu). */
  mustChangePassword: boolean;
  createdAt: string;
  lastLoginAt: string | null;
}

export interface AccountFilter {
  keyword: string;
  role: RoleKey | 'all';
  status: AccountStatus | 'all';
  page: number;
}

export interface AccountInput {
  username: string;
  fullName: string;
  email: string;
  phone: string;
  /** '' = chưa chọn (form bắt buộc chọn). */
  role: RoleKey | '';
  /** Chỉ dùng khi tạo mới (mọi vai trò đều đăng nhập được từ V20). */
  password?: string;
}

/* ============================== Ca làm việc ============================== */

export interface Shift {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  color: string;
  note: string;
}

export interface ShiftInput {
  name: string;
  startTime: string;
  endTime: string;
  color: string;
  note: string;
}

export interface ShiftAssignment {
  id: string;
  shiftId: string;
  employeeId: string;
  /** YYYY-MM-DD */
  date: string;
  /** Khu vực phụ trách trong ca (chỉ nhân viên phục vụ); null = không gán khu. */
  areaId: string | null;
}

export interface Employee {
  id: string;
  fullName: string;
  role: RoleKey;
  /** active: được phân công mới; locked / deleted (đã nghỉ): chỉ còn hiện ở những tuần từng có ca. */
  status: 'active' | 'locked' | 'deleted';
}

/* ============================== Bài viết ============================== */

export type PostStatus = 'draft' | 'published' | 'hidden';
export type PostCategory = 'news' | 'promotion' | 'event';

export interface Post {
  id: string;
  title: string;
  slug: string;
  summary: string;
  content: string;
  coverImage: string | null;
  category: PostCategory;
  status: PostStatus;
  author: string;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
}

export interface PostFilter {
  keyword: string;
  category: PostCategory | 'all';
  status: PostStatus | 'all';
  page: number;
}

export interface PostInput {
  title: string;
  summary: string;
  content: string;
  coverImage: string | null;
  category: PostCategory;
  status: PostStatus;
}

/* ============================== Chatbot AI ============================== */

export type BotTone = 'friendly' | 'professional' | 'playful';
export type FallbackAction = 'suggest_staff' | 'show_menu' | 'rephrase';

export interface ChatbotConfig {
  botName: string;
  avatar: string;
  /** Công tắc chung: tắt thì ẩn chatbot ở cả trang gọi món tại bàn (QR) lẫn website khách hàng. */
  active: boolean;
  /** Hiện khung chat tư vấn trên website khách hàng (V27); chỉ có tác dụng khi active. */
  websiteEnabled: boolean;
  greeting: string;
  quickReplies: string[];
  fallbackMessage: string;
  fallbackAction: FallbackAction;
  tone: BotTone;
  personality: string;
  allergyDisclaimer: string;
  updatedAt: string;
}

/** Một món trong set: số lượng; allowVariant = khách đổi được sang loại khác cùng nhóm (vd. nước ngọt). */
export interface ComboItem {
  dishId: string;
  qty: number;
  allowVariant: boolean;
}

/** Set menu (trước là combo gợi ý của Chatbot): bán trên thực đơn khi onMenu; Chatbot cũng dùng để gợi ý. */
export interface Combo {
  id: string;
  name: string;
  dishIds: string[];
  note: string;
  active: boolean;
  description: string;
  /** Giá set; null = chỉ là gợi ý của Chatbot. */
  price: number | null;
  /** Tổng giá gọi lẻ hiện tại. */
  originalPrice: number;
  image: string | null;
  onMenu: boolean;
  sellFrom: string | null;
  sellTo: string | null;
  sortOrder: number;
  items: ComboItem[];
}

export interface ComboInput {
  name: string;
  dishIds?: string[];
  note: string;
  active: boolean;
  description: string;
  price: number | null;
  image: string | null;
  onMenu: boolean;
  sellFrom: string | null;
  sellTo: string | null;
  items: ComboItem[];
}

export interface FaqCategory {
  id: string;
  name: string;
}

export interface Faq {
  id: string;
  question: string;
  answer: string;
  categoryId: string;
  active: boolean;
  updatedAt: string;
}

export interface FaqInput {
  question: string;
  answer: string;
  categoryId: string;
  active: boolean;
  /** Câu hỏi chưa giải đáp được dùng làm nguồn (sẽ được đánh dấu đã xử lý). */
  fromUnansweredId?: string | null;
}

export interface UnansweredQuestion {
  id: string;
  question: string;
  askedCount: number;
  lastAskedAt: string;
}

export type ConversationStatus = 'answered' | 'fallback' | 'handoff';

export interface ChatMessage {
  from: 'customer' | 'bot';
  text: string;
  at: string;
}

export interface Conversation {
  id: string;
  tableCode: string;
  startedAt: string;
  status: ConversationStatus;
  messages: ChatMessage[];
  /** Món khách đã thêm vào giỏ sau khi xác nhận gợi ý của AI. */
  addedToCart: string[];
}

export interface ConversationFilter {
  keyword: string;
  date: string;
  status: ConversationStatus | 'all';
  page: number;
}

export interface ChatbotStats {
  totalConversations: number;
  totalMessages: number;
  answerRate: number;
  fallbackRate: number;
  handoffRate: number;
  avgMessages: number;
  cartConversion: number;
  topAskedDishes: { dishId: string; name: string; count: number }[];
  daily: { label: string; conversations: number; fallback: number }[];
}

export interface MenuSyncResult {
  syncedAt: string;
  total: number;
  enabled: number;
  missingData: { id: string; name: string; missing: string[] }[];
}

/* ============================== Nhật ký hoạt động ============================== */

export type AuditModule =
  | 'auth'
  | 'reservation'
  | 'table'
  | 'dish'
  | 'account'
  | 'shift'
  | 'post'
  | 'chatbot'
  | 'settings'
  | 'warehouse'
  | 'kitchen'
  | 'cashier'
  | 'payroll'
  | 'waiter'
  | 'attendance';

export interface AuditLog {
  id: string;
  at: string;
  actor: string;
  actorUsername: string;
  module: AuditModule;
  action: string;
  detail: string;
  ip: string;
}

export interface AuditFilter {
  keyword: string;
  actor: string;
  module: AuditModule | 'all';
  from: string;
  to: string;
  page: number;
}

/* ============================== Cấu hình hệ thống ============================== */

export interface RestaurantInfo {
  name: string;
  legalName: string;
  taxCode: string;
  logo: string | null;
  phone: string;
  email: string;
  address: string;
  website: string;
  /** Ảnh bìa trang đặt món của khách (QR). Gửi data URL khi chọn ảnh mới, rỗng để xóa. */
  coverImage: string | null;
  updatedAt: string;
}

export interface OpeningDay {
  /** 0 = Chủ nhật … 6 = Thứ bảy (giống Date.getDay()). */
  day: number;
  open: boolean;
  openTime: string;
  closeTime: string;
}

export type BackupFrequency = 'daily' | 'weekly';

export interface BackupSchedule {
  enabled: boolean;
  frequency: BackupFrequency;
  /** 0–6, chỉ dùng khi weekly. */
  weekday: number;
  time: string;
  keep: number;
}

export interface BackupFile {
  id: string;
  name: string;
  createdAt: string;
  sizeKb: number;
  kind: 'auto' | 'manual';
}
