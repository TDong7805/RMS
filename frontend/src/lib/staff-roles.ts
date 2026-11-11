import { ChefHat, LayoutDashboard, Receipt, Warehouse, type LucideIcon } from 'lucide-react';
import type { StaffRole } from '@/api/auth';

export interface StaffRoleInfo {
  /** Tên ngắn trên tab của trang đăng nhập. */
  tab: string;
  /** Tên đầy đủ của vị trí. */
  title: string;
  icon: LucideIcon;
  /** Một câu mô tả công việc. */
  summary: string;
  /** Việc chính, theo đặc tả đề tài (CodeUC_QLNH.docx, mục 5–6). */
  features: string[];
  /** Trang đến sau khi đăng nhập. */
  destination: string;
}

/**
 * Giới thiệu từng vị trí — dùng chung cho trang đăng nhập (tab giới thiệu) và trang khu vực Thu ngân/Bếp/Kho.
 * Sửa nội dung ở đây là cả hai nơi cùng đổi.
 */
export const STAFF_ROLES: Record<StaffRole, StaffRoleInfo> = {
  manager: {
    tab: 'Quản lý',
    title: 'Quản lý nhà hàng',
    icon: LayoutDashboard,
    summary: 'Theo dõi hoạt động chung và quản lý mọi thiết lập của nhà hàng.',
    features: [
      'Món ăn, sơ đồ bàn và lịch đặt bàn',
      'Tài khoản nhân viên và ca làm việc',
      'Bài viết, Chatbot AI và cấu hình hệ thống',
      'Thống kê doanh thu, điều chỉnh tồn kho',
    ],
    destination: 'Trang quản lý nhà hàng',
  },
  cashier: {
    tab: 'Thu ngân',
    title: 'Thu ngân',
    icon: Receipt,
    summary: 'Đầu mối thanh toán và tiếp nhận yêu cầu của khách tại bàn.',
    features: [
      'Tra cứu đơn hàng và kiểm tra thông tin đơn',
      'Lập hóa đơn dựa trên đơn hàng đã ghi nhận',
      'Nhận thông báo khi khách gọi nhân viên, chuyển tiếp cho người phụ trách',
      'Tính lương nhân viên',
    ],
    destination: 'Khu vực Thu ngân',
  },
  kitchen: {
    tab: 'Bếp',
    title: 'Nhân viên bếp',
    icon: ChefHat,
    summary: 'Nhận món cần chế biến và cập nhật tiến độ cho các bộ phận.',
    features: [
      'Xem danh sách đơn hàng cần chế biến',
      'Xem chi tiết món, số lượng và ghi chú',
      'Kiểm tra tình trạng nguyên liệu',
      'Xác nhận hoàn thành món ăn',
    ],
    destination: 'Khu vực Bếp',
  },
  warehouse: {
    tab: 'Kho',
    title: 'Quản lý kho',
    icon: Warehouse,
    summary: 'Kiểm soát nguyên liệu nhập, xuất và tồn kho của nhà hàng.',
    features: [
      'Nhập kho nguyên liệu và ghi nhận số lượng nhập',
      'Xuất kho nguyên liệu theo nghiệp vụ nhà hàng',
      'Kiểm tra tồn kho, theo dõi số lượng còn lại',
    ],
    destination: 'Khu vực Kho',
  },
};

export const STAFF_ROLE_ORDER: StaffRole[] = ['manager', 'cashier', 'kitchen', 'warehouse'];
