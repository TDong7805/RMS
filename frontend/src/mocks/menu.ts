import type { MenuGroup } from '@/types';

/**
 * [FAKE-DATA] Cấu trúc menu mặc định — chỉ để dựng giao diện sidebar.
 * [BACKEND-TODO] Dữ liệu menu: hiện dùng dữ liệu giả ở src/mocks/menu.ts. Khi có backend:
 * thay thân hàm getMenu bằng gọi API GET /api/menu, giữ nguyên kiểu trả về MenuResponse
 * (phục vụ phân quyền menu theo vai trò tài khoản).
 */
export const menuGroups: MenuGroup[] = [
  {
    id: 'root',
    label: null,
    items: [
      {
        id: 'dashboard',
        label: 'Dashboard',
        icon: 'layout-dashboard',
        path: '/',
      },
    ],
  },
  {
    id: 'operations',
    label: 'VẬN HÀNH',
    items: [
      {
        id: 'reservations',
        label: 'Quản lý đặt bàn',
        icon: 'calendar-check',
        children: [
          {
            id: 'reservation-history',
            label: 'Danh sách lịch sử đặt',
            path: '/dat-ban/lich-su',
          },
          {
            id: 'reservation-update',
            label: 'Cập nhật form đặt bàn',
            path: '/dat-ban/cap-nhat',
          },
        ],
      },
      {
        id: 'tables',
        label: 'Quản lý khu vực bàn',
        icon: 'layout-grid',
        children: [
          { id: 'table-list', label: 'Danh sách bàn', path: '/khu-vuc-ban' },
        ],
      },
      {
        id: 'dishes',
        label: 'Quản lý món ăn',
        icon: 'utensils',
        children: [
          { id: 'dish-list', label: 'Danh sách món ăn', path: '/mon-an' },
          { id: 'dish-create', label: 'Thêm món ăn', path: '/mon-an/them' },
        ],
      },
      {
        id: 'staff',
        label: 'Quản lý nhân viên',
        icon: 'users',
        children: [
          { id: 'staff-shifts', label: 'Quản lý ca làm', path: '/nhan-vien/ca-lam' },
        ],
      },
    ],
  },
  {
    id: 'content',
    label: 'NỘI DUNG & TƯƠNG TÁC',
    items: [
      {
        id: 'posts',
        label: 'Quản lý bài viết',
        icon: 'newspaper',
        children: [
          { id: 'post-list', label: 'Danh sách tin đăng', path: '/bai-viet' },
          { id: 'post-create', label: 'Thêm bài viết', path: '/bai-viet/them' },
        ],
      },
    ],
  },
  {
    id: 'system',
    label: 'HỆ THỐNG',
    items: [
      {
        id: 'accounts',
        label: 'Quản lý tài khoản',
        icon: 'user-cog',
        children: [
          { id: 'account-list', label: 'Danh sách tài khoản', path: '/tai-khoan' },
          { id: 'account-create', label: 'Thêm tài khoản', path: '/tai-khoan/them' },
        ],
      },
      {
        id: 'chatbot',
        label: 'Quản lý Chatbot AI',
        icon: 'bot',
        path: '/chatbot',
      },
      {
        id: 'notifications',
        label: 'Thông báo',
        icon: 'bell',
        path: '/thong-bao',
        badge: { source: 'notifications', variant: 'danger' },
      },
      {
        id: 'audit-log',
        label: 'Nhật ký',
        icon: 'scroll-text',
        path: '/nhat-ky',
      },
      {
        id: 'settings',
        label: 'Cấu hình hệ thống',
        icon: 'settings',
        path: '/cai-dat',
      },
    ],
  },
];