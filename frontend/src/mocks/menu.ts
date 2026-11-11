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
        path: '/quan-ly',
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
            path: '/quan-ly/dat-ban/lich-su',
          },
          {
            id: 'reservation-update',
            label: 'Cập nhật form đặt bàn',
            path: '/quan-ly/dat-ban/cap-nhat',
          },
        ],
      },
      {
        id: 'tables',
        label: 'Quản lý khu vực bàn',
        icon: 'layout-grid',
        children: [
          { id: 'table-list', label: 'Danh sách bàn', path: '/quan-ly/khu-vuc-ban' },
        ],
      },
      {
        id: 'dishes',
        label: 'Quản lý món ăn',
        icon: 'utensils',
        children: [
          { id: 'dish-list', label: 'Danh sách món ăn', path: '/quan-ly/mon-an' },
          { id: 'dish-create', label: 'Thêm món ăn', path: '/quan-ly/mon-an/them' },
        ],
      },
      {
        id: 'staff',
        label: 'Quản lý nhân viên',
        icon: 'users',
        children: [
          { id: 'staff-shifts', label: 'Quản lý ca làm', path: '/quan-ly/nhan-vien/ca-lam' },
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
          { id: 'post-list', label: 'Danh sách tin đăng', path: '/quan-ly/bai-viet' },
          { id: 'post-create', label: 'Thêm bài viết', path: '/quan-ly/bai-viet/them' },
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
          { id: 'account-list', label: 'Danh sách tài khoản', path: '/quan-ly/tai-khoan' },
          { id: 'account-create', label: 'Thêm tài khoản', path: '/quan-ly/tai-khoan/them' },
        ],
      },
      {
        id: 'chatbot',
        label: 'Quản lý Chatbot AI',
        icon: 'bot',
        path: '/quan-ly/chatbot',
      },
      {
        id: 'notifications',
        label: 'Thông báo',
        icon: 'bell',
        path: '/quan-ly/thong-bao',
        badge: { source: 'notifications', variant: 'danger' },
      },
      {
        id: 'audit-log',
        label: 'Nhật ký',
        icon: 'scroll-text',
        path: '/quan-ly/nhat-ky',
      },
      {
        id: 'settings',
        label: 'Cấu hình hệ thống',
        icon: 'settings',
        path: '/quan-ly/cai-dat',
      },
    ],
  },
];