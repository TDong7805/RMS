import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { RequireAuth } from '@/components/auth/RequireAuth';
import { useAuth } from '@/lib/auth';
import { LEGACY_MANAGER_PATHS, MANAGER_HOME } from '@/lib/paths';
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
 *  - /quan-ly/...             Quản lý nhà hàng (MANAGER_HOME trong lib/paths.ts)
 *  - /, /thuc-don, /tin-tuc, /dat-ban …  để dành cho website khách hàng (chưa làm: "/" tạm chuyển về trang của vai trò)
 * Thêm trang cho Thu ngân: đặt route con trong khối roles={['cashier']}, đường dẫn bắt đầu bằng /thu-ngan.
 */

/** "/" khi chưa có website khách: đã đăng nhập → trang của vai trò; chưa → trang đăng nhập. */
function HomeRedirect() {
  const { data: user, isLoading } = useAuth();
  if (isLoading) return null;
  return <Navigate to={user ? user.home : '/dang-nhap'} replace />;
}

/** /mon-an?x=1 → /quan-ly/mon-an?x=1 */
function LegacyManagerRedirect() {
  const location = useLocation();
  return <Navigate to={MANAGER_HOME + location.pathname + location.search + location.hash} replace />;
}
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
        <Route path="/quan-ly" element={<DashboardPage />} />
        <Route path="/quan-ly/thong-bao" element={<NotificationsPage />} />

        {/* Quản lý đặt bàn */}
        <Route path="/quan-ly/dat-ban/lich-su" element={<ReservationsPage />} />
        <Route path="/quan-ly/dat-ban/cap-nhat" element={<ReservationFormPage />} />

        {/* Quản lý khu vực bàn */}
        <Route path="/quan-ly/khu-vuc-ban" element={<TablesPage />} />

        {/* Quản lý món ăn */}
        <Route path="/quan-ly/mon-an" element={<DishesPage />} />
        <Route path="/quan-ly/mon-an/them" element={<DishFormPage />} />
        <Route path="/quan-ly/mon-an/:id/sua" element={<DishFormPage />} />

        {/* Quản lý nhân viên */}
        <Route path="/quan-ly/nhan-vien/ca-lam" element={<ShiftsPage />} />

        {/* Quản lý bài viết */}
        <Route path="/quan-ly/bai-viet" element={<PostsPage />} />
        <Route path="/quan-ly/bai-viet/them" element={<PostFormPage />} />
        <Route path="/quan-ly/bai-viet/:id/sua" element={<PostFormPage />} />

        {/* Quản lý tài khoản */}
        <Route path="/quan-ly/tai-khoan" element={<AccountsPage />} />
        <Route path="/quan-ly/tai-khoan/them" element={<AccountFormPage />} />
        <Route path="/quan-ly/tai-khoan/:id/sua" element={<AccountFormPage />} />

        {/* Hệ thống */}
        <Route path="/quan-ly/chatbot" element={<ChatbotPage />} />
        <Route path="/quan-ly/nhat-ky" element={<AuditLogPage />} />
        <Route path="/quan-ly/cai-dat" element={<SettingsPage />} />

        <Route
          path="/quan-ly/*"
          element={
            <PlaceholderPage
              title="Không tìm thấy trang"
              description="Đường dẫn không tồn tại trong hệ thống quản lý."
            />
          }
        />
      </Route>

      {/* Đường dẫn cũ của trang quản lý → /quan-ly/... (giữ bookmark, link cũ). */}
      {LEGACY_MANAGER_PATHS.map((path) => (
        <Route key={path} path={path} element={<LegacyManagerRedirect />} />
      ))}

      {/* "/" tạm thời: chưa có website khách hàng → về trang của vai trò (hoặc trang đăng nhập). */}
      <Route path="/" element={<HomeRedirect />} />
      <Route path="*" element={<HomeRedirect />} />
    </Routes>
  );
}

export default AppRoutes;
