import type { BadgeVariant } from '@/components/common/Badge';
import type {
  AccountStatus,
  AuditModule,
  BotTone,
  ConversationStatus,
  DishStatus,
  FallbackAction,
  PostCategory,
  PostStatus,
  ReservationSource,
  ReservationStatus,
  RoleKey,
  TableShape,
  TableStatus,
} from '@/types';

type Meta = { label: string; variant: BadgeVariant };

export const RESERVATION_STATUS: Record<ReservationStatus, Meta> = {
  pending: { label: 'Chờ xác nhận', variant: 'warning' },
  confirmed: { label: 'Đã xác nhận', variant: 'info' },
  seated: { label: 'Đã đến', variant: 'accent' },
  completed: { label: 'Hoàn tất', variant: 'neutral' },
  cancelled: { label: 'Đã hủy', variant: 'danger' },
  no_show: { label: 'Không đến', variant: 'danger' },
};

export const RESERVATION_SOURCE: Record<ReservationSource, string> = {
  website: 'Website',
  phone: 'Điện thoại',
  walk_in: 'Tại quầy',
};

/** Các trạng thái còn giữ bàn — dùng khi kiểm tra trùng lịch. */
export const ACTIVE_RESERVATION: ReservationStatus[] = ['pending', 'confirmed', 'seated'];

export const TABLE_STATUS: Record<TableStatus, Meta> = {
  available: { label: 'Trống', variant: 'accent' },
  reserved: { label: 'Đã đặt', variant: 'info' },
  occupied: { label: 'Đang phục vụ', variant: 'warning' },
  inactive: { label: 'Ngưng sử dụng', variant: 'neutral' },
};

export const TABLE_SHAPE: Record<TableShape, string> = {
  square: 'Vuông',
  round: 'Tròn',
  rect: 'Chữ nhật',
};

export const DISH_STATUS: Record<DishStatus, Meta> = {
  selling: { label: 'Đang bán', variant: 'accent' },
  stopped: { label: 'Ngừng bán', variant: 'neutral' },
};

export const SPICY_LEVELS = ['Không cay', 'Cay nhẹ', 'Cay vừa', 'Rất cay'];

export const ALLERGENS = [
  'Đậu phộng',
  'Hải sản có vỏ',
  'Cá',
  'Sữa',
  'Trứng',
  'Gluten (lúa mì)',
  'Đậu nành',
  'Mè (vừng)',
  'Hạt cây (hạnh nhân, óc chó…)',
];

export const ROLES: Record<RoleKey, { label: string; description: string }> = {
  manager: { label: 'Quản lý nhà hàng', description: 'Toàn bộ nghiệp vụ quản lý, gồm tài khoản, cấu hình AI và hệ thống' },
  cashier: { label: 'Thu ngân', description: 'Tra cứu đơn, lập hóa đơn, nhận yêu cầu khách' },
  kitchen: { label: 'Nhân viên bếp', description: 'Xem đơn, kiểm tra nguyên liệu, xác nhận món' },
  warehouse: { label: 'Quản lý kho', description: 'Nhập kho, xuất kho, kiểm tra tồn kho' },
  waiter: { label: 'Nhân viên phục vụ', description: 'Chỉ để xếp ca và tính lương — không đăng nhập hệ thống' },
};

export const ROLE_KEYS = Object.keys(ROLES) as RoleKey[];

export const ACCOUNT_STATUS: Record<AccountStatus, Meta> = {
  active: { label: 'Hoạt động', variant: 'accent' },
  locked: { label: 'Đã khóa', variant: 'danger' },
};

export const POST_STATUS: Record<PostStatus, Meta> = {
  draft: { label: 'Bản nháp', variant: 'neutral' },
  published: { label: 'Đã xuất bản', variant: 'accent' },
  hidden: { label: 'Đã ẩn', variant: 'warning' },
};

export const POST_CATEGORY: Record<PostCategory, string> = {
  news: 'Tin tức',
  promotion: 'Ưu đãi',
  event: 'Sự kiện',
};

export const BOT_TONE: Record<BotTone, { label: string; description: string }> = {
  friendly: { label: 'Thân thiện', description: 'Gần gũi, xưng "mình – bạn", câu ngắn gọn' },
  professional: { label: 'Chuyên nghiệp', description: 'Lịch sự, xưng "chúng tôi – quý khách"' },
  playful: { label: 'Vui vẻ', description: 'Năng động, có thể dùng emoji vừa phải' },
};

export const FALLBACK_ACTION: Record<FallbackAction, string> = {
  suggest_staff: 'Gợi ý khách bấm "Gọi nhân viên"',
  show_menu: 'Hiển thị thực đơn để khách tự xem',
  rephrase: 'Đề nghị khách diễn đạt lại câu hỏi',
};

export const CONVERSATION_STATUS: Record<ConversationStatus, Meta> = {
  answered: { label: 'Đã trả lời', variant: 'accent' },
  fallback: { label: 'Ngoài phạm vi', variant: 'warning' },
  handoff: { label: 'Chuyển nhân viên', variant: 'info' },
};

export const AUDIT_MODULE: Record<AuditModule, string> = {
  auth: 'Đăng nhập',
  reservation: 'Đặt bàn',
  table: 'Khu vực bàn',
  dish: 'Món ăn',
  account: 'Tài khoản',
  shift: 'Ca làm việc',
  post: 'Bài viết',
  chatbot: 'Chatbot AI',
  settings: 'Cấu hình hệ thống',
};

export const WEEKDAYS = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy'];
export const WEEKDAYS_SHORT = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

/** "2026-11-11T19:30:00" -> "19:30 · 11/11/2026" */
export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  return `${hh}:${mm} · ${dd}/${mo}/${d.getFullYear()}`;
}

export function formatDateOnly(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}
