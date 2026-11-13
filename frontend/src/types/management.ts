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
}

/* ============================== Tài khoản ============================== */

/** Vai trò trong bảng roles. Quản trị viên đã gộp vào manager; waiter không đăng nhập (chỉ để xếp ca, tính lương). */
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
  /** Chỉ dùng khi tạo mới; bỏ trống với nhân viên phục vụ (không đăng nhập). */
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
  active: boolean;
  greeting: string;
  quickReplies: string[];
  fallbackMessage: string;
  fallbackAction: FallbackAction;
  tone: BotTone;
  personality: string;
  allergyDisclaimer: string;
  updatedAt: string;
}

export interface Combo {
  id: string;
  name: string;
  dishIds: string[];
  note: string;
  active: boolean;
}

export interface ComboInput {
  name: string;
  dishIds: string[];
  note: string;
  active: boolean;
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
  | 'warehouse';

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
