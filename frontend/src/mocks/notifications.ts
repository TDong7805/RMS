import type { AppNotification, CurrentUser, PageSuggestion } from '@/types';

const now = Date.now();
const minutesAgo = (m: number) => new Date(now - m * 60_000).toISOString();

/** [FAKE-DATA] Danh sách thông báo mẫu (Đặt bàn + Kho theo Phụ lục A của đặc tả). */
export const notificationSeed: AppNotification[] = [
  {
    id: 'ntf-01',
    type: 'reservation',
    title: 'Yêu cầu đặt bàn mới',
    description: 'Chị Nguyễn Thu Hà đặt bàn 6 người lúc 19:30 hôm nay, khu vực sân vườn.',
    createdAt: minutesAgo(4),
    read: false,
    href: '/dat-ban/lich-su',
  },
  {
    id: 'ntf-02',
    type: 'inventory',
    title: 'Thịt bò Úc thăn ngoại đã hết',
    description: 'Tồn kho về 0 kg, thấp hơn định mức 8 kg. Cần đặt nhà cung cấp ngay.',
    createdAt: minutesAgo(26),
    read: false,
    href: null,
  },
  {
    id: 'ntf-03',
    type: 'reservation',
    title: 'Lịch đặt sắp đến giờ',
    description: 'Bàn VIP 02 – anh Trần Minh Quân, 4 khách, bắt đầu sau 30 phút.',
    createdAt: minutesAgo(52),
    read: false,
    href: '/dat-ban/lich-su',
  },
  {
    id: 'ntf-04',
    type: 'inventory',
    title: 'Tôm sú tươi sắp hết',
    description: 'Còn 2,4 kg trên định mức tối thiểu 6 kg. Đã gợi ý nhà cung cấp Hải sản Phú Quốc.',
    createdAt: minutesAgo(96),
    read: false,
    href: null,
  },
  {
    id: 'ntf-05',
    type: 'reservation',
    title: 'Yêu cầu đặt bàn mới',
    description: 'Anh Lê Hoàng Nam đặt bàn 2 người lúc 20:00, khu vực tầng 2.',
    createdAt: minutesAgo(180),
    read: false,
    href: '/dat-ban/lich-su',
  },
  {
    id: 'ntf-06',
    type: 'inventory',
    title: 'Phiếu mua chờ nhận quá 3 ngày',
    description: 'Phiếu PN-2411 của Công ty Thực phẩm Đại Phát vẫn ở trạng thái Nhận một phần.',
    createdAt: minutesAgo(320),
    read: true,
    href: null,
  },
  {
    id: 'ntf-07',
    type: 'reservation',
    title: 'Đặt bàn đã được xác nhận',
    description: 'Bàn 08 – 4 khách lúc 18:15 đã xác nhận với khách qua điện thoại.',
    createdAt: minutesAgo(520),
    read: true,
    href: '/dat-ban/lich-su',
  },
  {
    id: 'ntf-08',
    type: 'inventory',
    title: 'Rau xà lách Romaine sắp hết',
    description: 'Còn 3,1 kg trên định mức 5 kg, đủ dùng cho khoảng 2 ngày cuối tuần.',
    createdAt: minutesAgo(760),
    read: true,
    href: null,
  },
  {
    id: 'ntf-09',
    type: 'inventory',
    title: 'Dầu olive nguyên chất sắp hết',
    description: 'Còn 4 lít trên định mức 5 lít. Đề xuất nhập thêm 12 lít trong tuần này.',
    createdAt: minutesAgo(1150),
    read: true,
    href: null,
  },
  {
    id: 'ntf-10',
    type: 'reservation',
    title: 'Khách huỷ lịch đặt bàn',
    description: 'Chị Phạm Diễm My đã huỷ bàn 12 (8 khách) dự kiến 19:00 tối nay.',
    createdAt: minutesAgo(1600),
    read: true,
    href: '/dat-ban/lich-su',
  },
  {
    id: 'ntf-11',
    type: 'inventory',
    title: 'Phô mai Parmesan sắp hết',
    description: 'Còn 1,8 kg trên định mức 3 kg, cần nhập trước buổi tối cuối tuần.',
    createdAt: minutesAgo(2100),
    read: true,
    href: null,
  },
  {
    id: 'ntf-12',
    type: 'reservation',
    title: 'Yêu cầu đặt bàn mới',
    description: 'Anh Võ Thành Công đặt tiệc sinh nhật 12 người lúc 18:30 Chủ nhật.',
    createdAt: minutesAgo(2900),
    read: true,
    href: '/dat-ban/lich-su',
  },
];

/** [FAKE-DATA] Tài khoản quản lý đang đăng nhập. */
export const currentUserSeed: CurrentUser = {
  id: 'usr-01',
  name: 'Nguyễn Anh Tuấn',
  role: 'Quản lý nhà hàng',
  email: 'tuan.nguyen@greenlotus.vn',
  initials: 'AT',
  restaurant: 'Green Lotus – Quận 1',
};

/** [FAKE-DATA] Gợi ý trang cho ô tìm kiếm / chuyển trang nhanh. */
export const pageSuggestions: PageSuggestion[] = [
  { id: 'dashboard', label: 'Dashboard', context: 'Tổng quan', path: '/' },
  {
    id: 'reservation-history',
    label: 'Danh sách lịch sử đặt',
    context: 'Quản lý đặt bàn',
    path: '/dat-ban/lich-su',
  },
  {
    id: 'reservation-update',
    label: 'Cập nhật form đặt bàn',
    context: 'Quản lý đặt bàn',
    path: '/dat-ban/cap-nhat',
  },
  { id: 'table-list', label: 'Danh sách bàn', context: 'Quản lý khu vực bàn', path: '/khu-vuc-ban' },
  { id: 'dish-list', label: 'Danh sách món ăn', context: 'Quản lý món ăn', path: '/mon-an' },
  { id: 'dish-create', label: 'Thêm món ăn', context: 'Quản lý món ăn', path: '/mon-an/them' },
  {
    id: 'staff-shifts',
    label: 'Quản lý ca làm',
    context: 'Quản lý nhân viên',
    path: '/nhan-vien/ca-lam',
  },
  { id: 'post-list', label: 'Danh sách tin đăng', context: 'Quản lý bài viết', path: '/bai-viet' },
  { id: 'post-create', label: 'Thêm bài viết', context: 'Quản lý bài viết', path: '/bai-viet/them' },
  { id: 'account-list', label: 'Danh sách tài khoản', context: 'Quản lý tài khoản', path: '/tai-khoan' },
  { id: 'account-create', label: 'Thêm tài khoản', context: 'Quản lý tài khoản', path: '/tai-khoan/them' },
  { id: 'chatbot', label: 'Quản lý Chatbot AI', context: 'Hệ thống', path: '/chatbot' },
  { id: 'notifications', label: 'Thông báo', context: 'Hệ thống', path: '/thong-bao' },
  { id: 'audit-log', label: 'Nhật ký', context: 'Hệ thống', path: '/nhat-ky' },
  { id: 'settings', label: 'Setting', context: 'Hệ thống', path: '/cai-dat' },
];

/** [FAKE-DATA] Đường dẫn đã truy cập gần đây (mới nhất trước). */
export const recentPagePaths: string[] = [
  '/dat-ban/lich-su',
  '/mon-an',
  '/thong-bao',
  '/khu-vuc-ban',
];