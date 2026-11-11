import { Route, Routes } from 'react-router-dom';
import DashboardPage from '@/pages/DashboardPage';
import NotificationsPage from '@/pages/NotificationsPage';
import PlaceholderPage from '@/pages/PlaceholderPage';
import ReservationsPage from '@/pages/ReservationsPage';
import ReservationFormPage from '@/pages/ReservationFormPage';
import TablesPage from '@/pages/TablesPage';
import DishesPage from '@/pages/DishesPage';
import DishFormPage from '@/pages/DishFormPage';
import ShiftsPage from '@/pages/ShiftsPage';
import PostsPage from '@/pages/PostsPage';
import PostFormPage from '@/pages/PostFormPage';
import AccountsPage from '@/pages/AccountsPage';
import AccountFormPage from '@/pages/AccountFormPage';
import ChatbotPage from '@/pages/ChatbotPage';
import AuditLogPage from '@/pages/AuditLogPage';
import SettingsPage from '@/pages/SettingsPage';

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<DashboardPage />} />
      <Route path="/thong-bao" element={<NotificationsPage />} />

      {/* Quản lý đặt bàn */}
      <Route path="/dat-ban/lich-su" element={<ReservationsPage />} />
      <Route path="/dat-ban/cap-nhat" element={<ReservationFormPage />} />

      {/* Quản lý khu vực bàn */}
      <Route path="/khu-vuc-ban" element={<TablesPage />} />

      {/* Quản lý món ăn */}
      <Route path="/mon-an" element={<DishesPage />} />
      <Route path="/mon-an/them" element={<DishFormPage />} />
      <Route path="/mon-an/:id/sua" element={<DishFormPage />} />

      {/* Quản lý nhân viên */}
      <Route path="/nhan-vien/ca-lam" element={<ShiftsPage />} />

      {/* Quản lý bài viết */}
      <Route path="/bai-viet" element={<PostsPage />} />
      <Route path="/bai-viet/them" element={<PostFormPage />} />
      <Route path="/bai-viet/:id/sua" element={<PostFormPage />} />

      {/* Quản lý tài khoản */}
      <Route path="/tai-khoan" element={<AccountsPage />} />
      <Route path="/tai-khoan/them" element={<AccountFormPage />} />
      <Route path="/tai-khoan/:id/sua" element={<AccountFormPage />} />

      {/* Hệ thống */}
      <Route path="/chatbot" element={<ChatbotPage />} />
      <Route path="/nhat-ky" element={<AuditLogPage />} />
      <Route path="/cai-dat" element={<SettingsPage />} />

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
