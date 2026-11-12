import type { AppNotification, PageSuggestion } from '@/types';

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
    href: '/quan-ly/dat-ban/lich-su?id=13',
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
    description: 'Bàn VIP01 – anh Lê Hoàng Nam, 8 khách, 19:00 hôm nay.',
    createdAt: minutesAgo(52),
    read: false,
    href: '/quan-ly/dat-ban/lich-su?id=15',
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
    description: 'Anh Trần Minh Quân đặt bàn 2 người lúc 20:00, khu vực tầng 1.',
    createdAt: minutesAgo(180),
    read: false,
    href: '/quan-ly/dat-ban/lich-su?id=14',
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
    description: 'Bàn SV01 – 4 khách lúc 12:00 đã xác nhận với khách qua điện thoại.',
    createdAt: minutesAgo(520),
    read: true,
    href: '/quan-ly/dat-ban/lich-su?id=11',
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
    href: '/quan-ly/dat-ban/lich-su?id=999',
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
    description: 'Chị Huỳnh Gia Hân đặt tiệc công ty 12 người lúc 18:30, 2 ngày nữa.',
    createdAt: minutesAgo(2900),
    read: true,
    href: '/quan-ly/dat-ban/lich-su?id=19',
  },
];

/** Danh sách trang cho ô tìm kiếm / chuyển trang nhanh (cấu hình giao diện, không phải dữ liệu nghiệp vụ). */
export const pageSuggestions: PageSuggestion[] = [
  { id: 'dashboard', label: 'Dashboard', context: 'Tổng quan', path: '/quan-ly' },
  {
    id: 'reservation-history',
    label: 'Danh sách lịch sử đặt',
    context: 'Quản lý đặt bàn',
    path: '/quan-ly/dat-ban/lich-su',
  },
  {
    id: 'reservation-update',
    label: 'Cập nhật form đặt bàn',
    context: 'Quản lý đặt bàn',
    path: '/quan-ly/dat-ban/cap-nhat',
  },
  { id: 'table-list', label: 'Danh sách bàn', context: 'Quản lý khu vực bàn', path: '/quan-ly/khu-vuc-ban' },
  { id: 'dish-list', label: 'Danh sách món ăn', context: 'Quản lý món ăn', path: '/quan-ly/mon-an' },
  { id: 'dish-create', label: 'Thêm món ăn', context: 'Quản lý món ăn', path: '/quan-ly/mon-an/them' },
  {
    id: 'staff-shifts',
    label: 'Quản lý ca làm',
    context: 'Quản lý nhân viên',
    path: '/quan-ly/nhan-vien/ca-lam',
  },
  { id: 'post-list', label: 'Danh sách tin đăng', context: 'Quản lý bài viết', path: '/quan-ly/bai-viet' },
  { id: 'post-create', label: 'Thêm bài viết', context: 'Quản lý bài viết', path: '/quan-ly/bai-viet/them' },
  { id: 'account-list', label: 'Danh sách tài khoản', context: 'Quản lý tài khoản', path: '/quan-ly/tai-khoan' },
  { id: 'account-create', label: 'Thêm tài khoản', context: 'Quản lý tài khoản', path: '/quan-ly/tai-khoan/them' },
  { id: 'chatbot', label: 'Quản lý Chatbot AI', context: 'Hệ thống', path: '/quan-ly/chatbot' },
  { id: 'notifications', label: 'Thông báo', context: 'Hệ thống', path: '/quan-ly/thong-bao' },
  { id: 'audit-log', label: 'Nhật ký', context: 'Hệ thống', path: '/quan-ly/nhat-ky' },
  { id: 'settings', label: 'Cấu hình hệ thống', context: 'Hệ thống', path: '/quan-ly/cai-dat' },
];

/** [FAKE-DATA] Đường dẫn đã truy cập gần đây (mới nhất trước). */
export const recentPagePaths: string[] = [
  '/quan-ly/dat-ban/lich-su',
  '/quan-ly/mon-an',
  '/quan-ly/thong-bao',
  '/quan-ly/khu-vuc-ban',
];

/* ---------------------------------------------------------------- Khu Quản lý kho */

/**
 * [FAKE-DATA] Thông báo mẫu của khu Kho (UC-KHO-27): sắp hết / hết hàng, phiếu mua trễ hạn,
 * kết quả duyệt kiểm kê. Id nguyên liệu, phiếu khớp dữ liệu mẫu ở src/mocks/warehouse.ts.
 */
export const warehouseNotificationSeed: AppNotification[] = [
  {
    id: 'kho-ntf-01',
    type: 'inventory',
    title: 'Tôm sú tươi sắp hết',
    description: 'Tồn còn 4,5 kg, thấp hơn mức tối thiểu 6 kg.',
    createdAt: minutesAgo(18),
    read: false,
    href: '/kho/nguyen-lieu/nl-001',
  },
  {
    id: 'kho-ntf-02',
    type: 'inventory',
    title: 'Thịt bò thăn Úc đã hết hàng',
    description: 'Tồn về 0 kg. Cần lập phiếu mua.',
    createdAt: minutesAgo(64),
    read: false,
    href: '/kho/nguyen-lieu/nl-010',
  },
  {
    id: 'kho-ntf-03',
    type: 'inventory',
    title: 'Phiếu mua PM2611-002 trễ hạn',
    description: 'Đã qua ngày dự kiến nhận nhưng Công ty Thực phẩm Đại Phát chưa giao đủ hàng.',
    createdAt: minutesAgo(8 * 60),
    read: false,
    href: '/kho/phieu-mua',
  },
  {
    id: 'kho-ntf-04',
    type: 'inventory',
    title: 'Phiếu kiểm kê KK2611-001 bị từ chối',
    description: 'Lý do: Chênh lệch nấm đông cô quá lớn, đề nghị đếm lại kệ khô.',
    createdAt: minutesAgo(26 * 60),
    read: true,
    href: '/kho/kiem-ke',
  },
  {
    id: 'kho-ntf-05',
    type: 'inventory',
    title: 'Đậu hũ non sắp hết',
    description: 'Tồn còn 16 hộp, thấp hơn mức tối thiểu 20 hộp.',
    createdAt: minutesAgo(30 * 60),
    read: true,
    href: '/kho/nguyen-lieu/nl-005',
  },
];

/** [FAKE-DATA] Trang của khu Kho cho ô tìm kiếm (khớp warehouseMenuGroups). */
export const warehousePageSuggestions: PageSuggestion[] = [
  { id: 'kho-dashboard', label: 'Dashboard', context: 'Tổng quan kho', path: '/kho' },
  { id: 'kho-ingredient-list', label: 'Danh sách nguyên liệu', context: 'Quản lý nguyên liệu', path: '/kho/nguyen-lieu' },
  { id: 'kho-ingredient-create', label: 'Thêm nguyên liệu', context: 'Quản lý nguyên liệu', path: '/kho/nguyen-lieu/them' },
  { id: 'kho-supplier-list', label: 'Danh sách nhà cung cấp', context: 'Quản lý nhà cung cấp', path: '/kho/nha-cung-cap' },
  { id: 'kho-supplier-create', label: 'Thêm nhà cung cấp', context: 'Quản lý nhà cung cấp', path: '/kho/nha-cung-cap/them' },
  { id: 'kho-purchase-list', label: 'Danh sách phiếu mua', context: 'Quản lý phiếu mua', path: '/kho/phieu-mua' },
  { id: 'kho-purchase-create', label: 'Tạo phiếu mua', context: 'Quản lý phiếu mua', path: '/kho/phieu-mua/them' },
  { id: 'kho-receive', label: 'Nhập kho', context: 'Nhập – xuất kho', path: '/kho/nhap-kho' },
  { id: 'kho-issue', label: 'Xuất kho', context: 'Nhập – xuất kho', path: '/kho/xuat-kho' },
  { id: 'kho-stocktake', label: 'Kiểm kê', context: 'Nhập – xuất kho', path: '/kho/kiem-ke' },
  { id: 'kho-debt', label: 'Công nợ nhà cung cấp', context: 'Tài chính', path: '/kho/cong-no' },
  { id: 'kho-notifications', label: 'Thông báo', context: 'Hệ thống', path: '/kho/thong-bao' },
];

/** [FAKE-DATA] Trang kho đã truy cập gần đây. */
export const warehouseRecentPaths: string[] = ['/kho/nguyen-lieu', '/kho/nha-cung-cap', '/kho/phieu-mua'];