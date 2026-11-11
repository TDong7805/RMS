import { Route, Routes } from 'react-router-dom';
import DashboardPage from '@/pages/DashboardPage';
import NotificationsPage from '@/pages/NotificationsPage';
import PlaceholderPage from '@/pages/PlaceholderPage';

interface PlaceholderRoute {
  path: string;
  title: string;
  parent?: string;
  description?: string;
}

const placeholderRoutes: PlaceholderRoute[] = [
  {
    path: '/dat-ban/lich-su',
    title: 'Danh sách lịch sử đặt',
    parent: 'Quản lý đặt bàn',
    description: 'Tra cứu toàn bộ lịch sử đặt bàn đã qua và đang diễn ra.',
  },
  {
    path: '/dat-ban/cap-nhat',
    title: 'Cập nhật form đặt bàn',
    parent: 'Quản lý đặt bàn',
    description: 'Chỉnh sửa thông tin form đặt bàn khách hàng đang sử dụng.',
  },
  {
    path: '/khu-vuc-ban',
    title: 'Danh sách bàn',
    parent: 'Quản lý khu vực bàn',
    description: 'Sơ đồ và trạng thái từng bàn theo khu vực phục vụ.',
  },
  {
    path: '/mon-an',
    title: 'Danh sách món ăn',
    parent: 'Quản lý món ăn',
    description: 'Toàn bộ thực đơn, giá bán và trạng thái đang bán của món.',
  },
  {
    path: '/mon-an/them',
    title: 'Thêm món ăn',
    parent: 'Quản lý món ăn',
    description: 'Tạo món mới với hình ảnh, giá bán và nguyên liệu.',
  },
  {
    path: '/nhan-vien/ca-lam',
    title: 'Quản lý ca làm',
    parent: 'Quản lý nhân viên',
    description: 'Phân ca, đổi ca và theo dõi chấm công của nhân viên.',
  },
  {
    path: '/bai-viet',
    title: 'Danh sách tin đăng',
    parent: 'Quản lý bài viết',
    description: 'Quản lý tin tức, ưu đãi và bài viết trên website nhà hàng.',
  },
  {
    path: '/bai-viet/them',
    title: 'Thêm bài viết',
    parent: 'Quản lý bài viết',
    description: 'Soạn và xuất bản bài viết mới cho website.',
  },
  {
    path: '/tai-khoan',
    title: 'Danh sách tài khoản',
    parent: 'Quản lý tài khoản',
    description: 'Tài khoản nhân viên, vai trò và quyền truy cập hệ thống.',
  },
  {
    path: '/tai-khoan/them',
    title: 'Thêm tài khoản',
    parent: 'Quản lý tài khoản',
    description: 'Cấp tài khoản mới và gán vai trò cho nhân viên.',
  },
  {
    path: '/chatbot',
    title: 'Quản lý Chatbot AI',
    parent: 'Hệ thống',
    description: 'Cấu hình kịch bản trả lời tự động cho khách hàng.',
  },
  {
    path: '/nhat-ky',
    title: 'Nhật ký',
    parent: 'Hệ thống',
    description: 'Lịch sử thao tác của người dùng trên hệ thống quản lý.',
  },
  {
    path: '/cai-dat',
    title: 'Setting',
    parent: 'Hệ thống',
    description: 'Cấu hình chung cho nhà hàng và hệ thống quản lý.',
  },
];

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<DashboardPage />} />
      <Route path="/thong-bao" element={<NotificationsPage />} />
      {placeholderRoutes.map((route) => (
        <Route
          key={route.path}
          path={route.path}
          element={
            <PlaceholderPage
              title={route.title}
              parent={route.parent}
              description={route.description}
            />
          }
        />
      ))}
      <Route
        path="*"
        element={
          <PlaceholderPage
            title="Không tìm thấy trang"
            description="Đường dẫn không tồn tại trong hệ thống quản lý."
          />
        }
      />
    </Routes>
  );
}

export default AppRoutes;