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
        // Một mục "Sơ đồ bàn": tầng, khu vực, bàn (QUY_TAC_GIAO_DIEN.md, mục B7).
        id: 'tables',
        label: 'Sơ đồ bàn',
        icon: 'layout-grid',
        path: '/quan-ly/khu-vuc-ban',
      },
      {
        // Một mục "Thực đơn": trang có 4 tab Món ăn · Set menu · Danh mục · Nhóm món (QUY_TAC_GIAO_DIEN.md, mục B8).
        id: 'dishes',
        label: 'Thực đơn',
        icon: 'utensils',
        path: '/quan-ly/mon-an',
      },
      {
        id: 'staff',
        label: 'Quản lý nhân viên',
        icon: 'users',
        children: [
          { id: 'staff-shifts', label: 'Quản lý ca làm', path: '/quan-ly/nhan-vien/ca-lam' },
          { id: 'staff-faces', label: 'Khuôn mặt chấm công', path: '/quan-ly/nhan-vien/khuon-mat' },
        ],
      },
      {
        id: 'warehouse',
        label: 'Kho',
        icon: 'package',
        children: [
          { id: 'stocktake-approvals', label: 'Duyệt kiểm kê', path: '/quan-ly/kiem-ke' },
          { id: 'supplier-debts', label: 'Công nợ nhà cung cấp', path: '/quan-ly/cong-no' },
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

/**
 * [FAKE-DATA] Menu khu Quản lý kho (/kho) theo đặc tả UC Quản lý kho (DacTa_UC_QuanLyKho.docx, mục 3).
 * [BACKEND-TODO] Như menuGroups: khi có backend, GET /api/menu trả menu theo vai trò đang đăng nhập.
 */
export const warehouseMenuGroups: MenuGroup[] = [
  {
    id: 'kho-root',
    label: null,
    items: [{ id: 'kho-dashboard', label: 'Dashboard', icon: 'layout-dashboard', path: '/kho' }],
  },
  {
    id: 'kho-catalog',
    label: 'DANH MỤC',
    items: [
      { id: 'kho-ingredients', label: 'Nguyên liệu', icon: 'package', path: '/kho/nguyen-lieu' },
      { id: 'kho-suppliers', label: 'Nhà cung cấp', icon: 'truck', path: '/kho/nha-cung-cap' },
    ],
  },
  {
    id: 'kho-stock',
    label: 'NHẬP – XUẤT KHO',
    items: [
      { id: 'kho-purchase', label: 'Phiếu mua', icon: 'clipboard-list', path: '/kho/phieu-mua' },
      { id: 'kho-receive', label: 'Nhập kho', icon: 'package-plus', path: '/kho/nhap-kho' },
      { id: 'kho-issue', label: 'Xuất kho', icon: 'package-minus', path: '/kho/xuat-kho' },
      { id: 'kho-stocktake', label: 'Kiểm kê', icon: 'clipboard-check', path: '/kho/kiem-ke' },
    ],
  },
  {
    id: 'kho-finance',
    label: 'TÀI CHÍNH',
    items: [{ id: 'kho-debt', label: 'Công nợ nhà cung cấp', icon: 'wallet', path: '/kho/cong-no' }],
  },
  {
    id: 'kho-system',
    label: 'HỆ THỐNG',
    items: [
      {
        id: 'kho-notifications',
        label: 'Thông báo',
        icon: 'bell',
        path: '/kho/thong-bao',
        badge: { source: 'notifications', variant: 'danger' },
      },
    ],
  },
];
/* ---------------------------------------------------------------- Khu Thu ngân (DacTa_UC_DatMon_Bep_ThuNgan) */

export const cashierMenuGroups: MenuGroup[] = [
  {
    id: 'tn-root',
    label: null,
    // Màn hình chung ở quầy (27/11/2026): Chấm công / Bảng lương chuyển sang Cổng nhân viên của tài khoản riêng thu ngân.
    items: [{ id: 'tn-floor', label: 'Về quầy thu ngân', icon: 'layout-grid', path: '/thu-ngan' }],
  },
  {
    id: 'tn-system',
    label: 'HỆ THỐNG',
    items: [{ id: 'tn-notifications', label: 'Thông báo', icon: 'bell', path: '/thu-ngan/thong-bao', badge: { source: 'notifications', variant: 'danger' } }],
  },
];
