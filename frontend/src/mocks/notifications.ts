import type { PageSuggestion } from '@/types';

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
  { id: 'table-list', label: 'Sơ đồ bàn', context: 'Tầng, khu vực, bàn', path: '/quan-ly/khu-vuc-ban' },
  { id: 'dish-list', label: 'Món ăn', context: 'Thực đơn', path: '/quan-ly/mon-an' },
  { id: 'dish-sets', label: 'Set menu', context: 'Thực đơn', path: '/quan-ly/mon-an/set-menu' },
  { id: 'dish-categories', label: 'Danh mục món', context: 'Thực đơn', path: '/quan-ly/mon-an/danh-muc' },
  { id: 'dish-groups', label: 'Nhóm món', context: 'Thực đơn', path: '/quan-ly/mon-an/nhom-mon' },
  { id: 'dish-create', label: 'Thêm món ăn', context: 'Thực đơn', path: '/quan-ly/mon-an/them' },
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
  { id: 'stocktake-approvals', label: 'Duyệt kiểm kê', context: 'Kho', path: '/quan-ly/kiem-ke' },
  { id: 'supplier-debts', label: 'Công nợ nhà cung cấp', context: 'Kho', path: '/quan-ly/cong-no' },
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

/** [FAKE-DATA] Trang của khu Kho cho ô tìm kiếm (khớp warehouseMenuGroups). */
export const warehousePageSuggestions: PageSuggestion[] = [
  { id: 'kho-dashboard', label: 'Dashboard', context: 'Tổng quan kho', path: '/kho' },
  { id: 'kho-ingredient-list', label: 'Nguyên liệu', context: 'Danh mục', path: '/kho/nguyen-lieu' },
  { id: 'kho-ingredient-create', label: 'Thêm nguyên liệu', context: 'Nguyên liệu', path: '/kho/nguyen-lieu/them' },
  { id: 'kho-supplier-list', label: 'Nhà cung cấp', context: 'Danh mục', path: '/kho/nha-cung-cap' },
  { id: 'kho-supplier-create', label: 'Thêm nhà cung cấp', context: 'Nhà cung cấp', path: '/kho/nha-cung-cap/them' },
  { id: 'kho-purchase-list', label: 'Phiếu mua', context: 'Nhập – xuất kho', path: '/kho/phieu-mua' },
  { id: 'kho-purchase-create', label: 'Tạo phiếu mua', context: 'Phiếu mua', path: '/kho/phieu-mua/them' },
  { id: 'kho-receive', label: 'Nhập kho', context: 'Nhập – xuất kho', path: '/kho/nhap-kho' },
  { id: 'kho-issue', label: 'Xuất kho', context: 'Nhập – xuất kho', path: '/kho/xuat-kho' },
  { id: 'kho-stocktake', label: 'Kiểm kê', context: 'Nhập – xuất kho', path: '/kho/kiem-ke' },
  { id: 'kho-debt', label: 'Công nợ nhà cung cấp', context: 'Tài chính', path: '/kho/cong-no' },
  { id: 'kho-notifications', label: 'Thông báo', context: 'Hệ thống', path: '/kho/thong-bao' },
];

/** [FAKE-DATA] Trang kho đã truy cập gần đây. */
export const warehouseRecentPaths: string[] = ['/kho/nguyen-lieu', '/kho/nha-cung-cap', '/kho/phieu-mua'];
/* ---------------------------------------------------------------- Khu Thu ngân */

/** Trang của khu Thu ngân cho ô tìm kiếm (khớp cashierMenuGroups). */
export const cashierPageSuggestions: PageSuggestion[] = [
  { id: 'tn-floor', label: 'Sơ đồ bàn', context: 'Thu ngân', path: '/thu-ngan' },
  { id: 'tn-order-list', label: 'Đơn hàng', context: 'Bán hàng', path: '/thu-ngan/don-hang' },
  { id: 'tn-requests', label: 'Yêu cầu của khách', context: 'Bán hàng', path: '/thu-ngan/yeu-cau' },
  { id: 'tn-invoices', label: 'Hóa đơn', context: 'Bán hàng', path: '/thu-ngan/hoa-don' },
  { id: 'tn-notifications', label: 'Thông báo', context: 'Hệ thống', path: '/thu-ngan/thong-bao' },
];

export const cashierRecentPaths: string[] = ['/thu-ngan'];
