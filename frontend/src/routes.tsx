import { Route, Routes } from 'react-router-dom';
import { RequireAuth } from '@/components/auth/RequireAuth';
import LoginPage from '@/pages/LoginPage';
import ChangePasswordPage from '@/pages/ChangePasswordPage';
import StaffAreaPage from '@/pages/StaffAreaPage';
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

/**
 * Định tuyến theo vai trò (backend: com.rms.auth.StaffAreas):
 *  - /dang-nhap               ai cũng vào được
 *  - /doi-mat-khau            đã đăng nhập (kể cả khi bị buộc đổi mật khẩu)
 *  - /thu-ngan, /bep, /kho    khu vực Thu ngân / Bếp / Kho
 *  - còn lại                  Quản lý nhà hàng
 * Thêm trang cho Thu ngân: đặt route con trong khối roles={['cashier']}, đường dẫn bắt đầu bằng /thu-ngan.
 */
export function AppRoutes() {
  return (
    <Routes>
      <Route path="/dang-nhap" element={<LoginPage />} />

      <Route element={<RequireAuth allowPasswordChange />}>
        <Route path="/doi-mat-khau" element={<ChangePasswordPage />} />
      </Route>

      <Route element={<RequireAuth roles={['cashier']} />}>
        <Route path="/thu-ngan/*" element={<StaffAreaPage area="cashier" />} />
      </Route>
      <Route element={<RequireAuth roles={['kitchen']} />}>
        <Route path="/bep/*" element={<StaffAreaPage area="kitchen" />} />
      </Route>
      <Route element={<RequireAuth roles={['warehouse']} />}>
        <Route path="/kho/*" element={<StaffAreaPage area="warehouse" />} />
      </Route>

      <Route element={<RequireAuth roles={['manager']} />}>
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
      </Route>
    </Routes>
  );
}

export default AppRoutes;
