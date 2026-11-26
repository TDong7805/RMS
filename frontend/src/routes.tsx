import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { RequireAuth } from '@/components/auth/RequireAuth';
import { LEGACY_MANAGER_PATHS, MANAGER_HOME } from '@/lib/paths';
import LoginPage from '@/pages/LoginPage';
import ChangePasswordPage from '@/pages/ChangePasswordPage';
import DashboardPage from '@/pages/DashboardPage';
import NotificationsPage from '@/pages/NotificationsPage';
import PlaceholderPage from '@/pages/PlaceholderPage';
import { PageLoader } from '@/components/common/PageLoader';

/* Trang đặt món của khách tải riêng (có thư viện chuyển động / tranh động), không làm nặng trang quản lý. */
const QrOrderPage = lazy(() => import('@/pages/goi-mon/QrOrderPage'));
/* Website khách hàng: tải riêng (phông, bộ màu riêng), người vào trang quản lý không phải tải phần này. */
const PublicLayout = lazy(() => import('@/features/public-site/PublicLayout'));
const SiteHomePage = lazy(() => import('@/pages/khach/HomePage'));
const SiteMenuPage = lazy(() => import('@/pages/khach/MenuPage'));
const SiteFlipMenuPage = lazy(() => import('@/pages/khach/FlipMenuPage'));
const SiteReservationPage = lazy(() => import('@/pages/khach/ReservationPage'));
const SiteNotFoundPage = lazy(() => import('@/pages/khach/NotFoundPage'));
import ReservationsPage from '@/pages/ReservationsPage';
import ReservationFormPage from '@/pages/ReservationFormPage';
import TablesPage from '@/pages/TablesPage';
import DishesPage from '@/pages/DishesPage';
import DishFormPage from '@/pages/DishFormPage';
import SetMenuPage from '@/pages/SetMenuPage';
import SetFormPage from '@/pages/SetFormPage';
import MenuCategoriesPage from '@/pages/MenuCategoriesPage';
import MenuGroupsPage from '@/pages/MenuGroupsPage';
import ShiftsPage from '@/pages/ShiftsPage';
import FacesPage from '@/pages/FacesPage';
import PostsPage from '@/pages/PostsPage';
import PostFormPage from '@/pages/PostFormPage';
import AccountsPage from '@/pages/AccountsPage';
import AccountFormPage from '@/pages/AccountFormPage';
import ChatbotPage from '@/pages/ChatbotPage';
import AuditLogPage from '@/pages/AuditLogPage';
import SettingsPage from '@/pages/SettingsPage';
import IngredientsPage from '@/pages/kho/IngredientsPage';
import IngredientFormPage from '@/pages/kho/IngredientFormPage';
import IngredientDetailPage from '@/pages/kho/IngredientDetailPage';
import SuppliersPage from '@/pages/kho/SuppliersPage';
import SupplierFormPage from '@/pages/kho/SupplierFormPage';
import SupplierDetailPage from '@/pages/kho/SupplierDetailPage';
import PurchaseOrdersPage from '@/pages/kho/PurchaseOrdersPage';
import PurchaseOrderFormPage from '@/pages/kho/PurchaseOrderFormPage';
import PurchaseOrderDetailPage from '@/pages/kho/PurchaseOrderDetailPage';
import { ChooseWaitingPurchasePage, ReceivePage } from '@/pages/kho/ReceivePage';
import DirectReceiptPage from '@/pages/kho/DirectReceiptPage';
import { ReceiptDetailPage, ReceiptsPage } from '@/pages/kho/ReceiptsPage';
import { IssueDetailPage, IssueFormPage, IssuesPage } from '@/pages/kho/IssuesPage';
import { StocktakeApprovalDetailPage, StocktakeApprovalsPage, StocktakeDetailPage, StocktakesPage } from '@/pages/kho/StocktakesPage';
import { DebtDetailPage, DebtsPage } from '@/pages/kho/DebtsPage';
import WarehouseDashboardPage from '@/pages/kho/WarehouseDashboardPage';
import KitchenDisplayPage from '@/pages/bep/KitchenDisplayPage';
import StockCheckPage from '@/pages/bep/StockCheckPage';
import RecipesPage from '@/pages/bep/RecipesPage';
import FloorPage from '@/pages/thu-ngan/FloorPage';
import CashierOrderPage from '@/pages/thu-ngan/CashierOrderPage';
import OrdersPage from '@/pages/thu-ngan/OrdersPage';
import RequestsPage from '@/pages/thu-ngan/RequestsPage';
import InvoicesPage from '@/pages/thu-ngan/InvoicesPage';
import AttendancePage from '@/pages/thu-ngan/AttendancePage';
import PayrollPage from '@/pages/thu-ngan/PayrollPage';
import PayrollDetailPage from '@/pages/thu-ngan/PayrollDetailPage';
import WaiterFloorPage from '@/pages/phuc-vu/WaiterFloorPage';
import WaiterRequestsPage from '@/pages/phuc-vu/WaiterRequestsPage';
import WaiterServePage from '@/pages/phuc-vu/WaiterServePage';
import WaiterMenuPage from '@/pages/phuc-vu/WaiterMenuPage';
import WaiterNotificationsPage from '@/pages/phuc-vu/WaiterNotificationsPage';

/**
 * Định tuyến theo vai trò (backend: com.rms.auth.StaffAreas):
 *  - /dang-nhap               ai cũng vào được
 *  - /doi-mat-khau            đã đăng nhập (kể cả khi bị buộc đổi mật khẩu)
 *  - /thu-ngan, /bep, /kho    khu vực Thu ngân / Bếp / Kho
 *  - /phuc-vu                 khu vực Nhân viên phục vụ (giao diện điện thoại)
 *  - /quan-ly/...             Quản lý nhà hàng (MANAGER_HOME trong lib/paths.ts)
 *  - /, /thuc-don, /dat-ban   website khách hàng (công khai, PublicLayout); trang chủ dài một trang, /gioi-thieu,
 *                             /album, /lien-he chuyển về mục tương ứng (/#gioi-thieu, /#khong-gian, /#lien-he);
 *                             đường dẫn lạ cũng hiện trang "không tìm thấy" của website. Nhân viên vào bằng /dang-nhap.
 * Thêm trang cho Thu ngân: đặt route con trong khối roles={['cashier']}, đường dẫn bắt đầu bằng /thu-ngan.
 */

/** /mon-an?x=1 → /quan-ly/mon-an?x=1 */
function LegacyManagerRedirect() {
  const location = useLocation();
  return <Navigate to={MANAGER_HOME + location.pathname + location.search + location.hash} replace />;
}
export function AppRoutes() {
  return (
    <Routes>
      <Route path="/dang-nhap" element={<LoginPage />} />
      {/* Trang đặt món của khách tại bàn: mở bằng mã QR, không đăng nhập */}
      <Route path="/goi-mon/:token" element={<Suspense fallback={<PageLoader />}><QrOrderPage /></Suspense>} />

      <Route element={<RequireAuth allowPasswordChange />}>
        <Route path="/doi-mat-khau" element={<ChangePasswordPage />} />
      </Route>

      <Route element={<RequireAuth roles={['cashier']} />}>
        <Route path="/thu-ngan" element={<FloorPage />} />
        <Route path="/thu-ngan/don/:id" element={<CashierOrderPage />} />
        <Route path="/thu-ngan/thong-bao" element={<NotificationsPage />} />
        <Route path="/thu-ngan/don-hang" element={<OrdersPage />} />
        <Route path="/thu-ngan/yeu-cau" element={<RequestsPage />} />
        <Route path="/thu-ngan/hoa-don" element={<InvoicesPage />} />
        <Route path="/thu-ngan/cham-cong" element={<AttendancePage />} />
        <Route path="/thu-ngan/bang-luong" element={<PayrollPage />} />
        <Route path="/thu-ngan/bang-luong/:id" element={<PayrollDetailPage />} />
        <Route path="/thu-ngan/*" element={<PlaceholderPage title="Không tìm thấy trang" description="Đường dẫn không tồn tại trong khu Thu ngân." />} />
      </Route>
      <Route element={<RequireAuth roles={['waiter']} />}>
        {/* Nhân viên phục vụ — giao diện điện thoại, thanh tab dưới đáy (features/waiter/WaiterShell) */}
        <Route path="/phuc-vu" element={<WaiterFloorPage />} />
        <Route path="/phuc-vu/yeu-cau" element={<WaiterRequestsPage />} />
        <Route path="/phuc-vu/mon-xong" element={<WaiterServePage />} />
        <Route path="/phuc-vu/mang-mon" element={<Navigate to="/phuc-vu/mon-xong" replace />} />
        <Route path="/phuc-vu/thuc-don" element={<WaiterMenuPage />} />
        <Route path="/phuc-vu/goi-mon/:tableId" element={<WaiterMenuPage />} />
        <Route path="/phuc-vu/thong-bao" element={<WaiterNotificationsPage />} />
        <Route path="/phuc-vu/*" element={<Navigate to="/phuc-vu" replace />} />
      </Route>
      <Route element={<RequireAuth roles={['kitchen']} />}>
        {/* Màn hình bếp (KDS) — toàn màn hình, không dùng khung trang quản lý */}
        <Route path="/bep" element={<KitchenDisplayPage />} />
        <Route path="/bep/nguyen-lieu" element={<StockCheckPage />} />
        <Route path="/bep/cong-thuc" element={<RecipesPage />} />
        <Route path="/bep/cong-thuc/:dishId" element={<RecipesPage />} />
        <Route path="/bep/*" element={<Navigate to="/bep" replace />} />
      </Route>
      <Route element={<RequireAuth roles={['warehouse']} />}>
        {/* Quản lý kho (DacTa_UC_QuanLyKho) — các mục chưa làm tạm hiện trang "đang hoàn thiện" */}
        <Route path="/kho" element={<WarehouseDashboardPage />} />
        <Route path="/kho/nguyen-lieu" element={<IngredientsPage />} />
        <Route path="/kho/nguyen-lieu/them" element={<IngredientFormPage />} />
        <Route path="/kho/nguyen-lieu/:id/sua" element={<IngredientFormPage />} />
        <Route path="/kho/nguyen-lieu/:id" element={<IngredientDetailPage />} />
        <Route path="/kho/nha-cung-cap" element={<SuppliersPage />} />
        <Route path="/kho/nha-cung-cap/them" element={<SupplierFormPage />} />
        <Route path="/kho/nha-cung-cap/:id/sua" element={<SupplierFormPage />} />
        <Route path="/kho/nha-cung-cap/:id" element={<SupplierDetailPage />} />
        <Route path="/kho/phieu-mua" element={<PurchaseOrdersPage />} />
        <Route path="/kho/phieu-mua/them" element={<PurchaseOrderFormPage />} />
        <Route path="/kho/phieu-mua/:id/sua" element={<PurchaseOrderFormPage />} />
        <Route path="/kho/phieu-mua/:id/nhan-hang" element={<ReceivePage />} />
        <Route path="/kho/phieu-mua/:id" element={<PurchaseOrderDetailPage />} />
        <Route path="/kho/nhap-kho" element={<ReceiptsPage />} />
        <Route path="/kho/nhap-kho/theo-phieu-mua" element={<ChooseWaitingPurchasePage />} />
        <Route path="/kho/nhap-kho/khong-phieu" element={<DirectReceiptPage />} />
        <Route path="/kho/nhap-kho/:id" element={<ReceiptDetailPage />} />
        <Route path="/kho/xuat-kho" element={<IssuesPage />} />
        <Route path="/kho/xuat-kho/them" element={<IssueFormPage />} />
        <Route path="/kho/xuat-kho/:id" element={<IssueDetailPage />} />
        <Route path="/kho/kiem-ke" element={<StocktakesPage />} />
        <Route path="/kho/kiem-ke/:id" element={<StocktakeDetailPage />} />
        <Route path="/kho/cong-no" element={<DebtsPage />} />
        <Route path="/kho/cong-no/:id" element={<DebtDetailPage />} />
        <Route path="/kho/thong-bao" element={<NotificationsPage />} />
        <Route path="/kho/*" element={<PlaceholderPage title="Không tìm thấy trang" description="Đường dẫn không tồn tại trong khu Kho." />} />
      </Route>

      <Route element={<RequireAuth roles={['manager']} />}>
        <Route path="/quan-ly" element={<DashboardPage />} />
        <Route path="/quan-ly/thong-bao" element={<NotificationsPage />} />

        {/* Kho — phần của Quản lý nhà hàng (UC-KHO-24, 25) */}
        <Route path="/quan-ly/kiem-ke" element={<StocktakeApprovalsPage />} />
        <Route path="/quan-ly/kiem-ke/:id" element={<StocktakeApprovalDetailPage />} />
        <Route path="/quan-ly/cong-no" element={<DebtsPage manager />} />
        <Route path="/quan-ly/cong-no/:id" element={<DebtDetailPage manager />} />

        {/* Quản lý đặt bàn */}
        <Route path="/quan-ly/dat-ban/lich-su" element={<ReservationsPage />} />
        <Route path="/quan-ly/dat-ban/cap-nhat" element={<ReservationFormPage />} />

        {/* Quản lý khu vực bàn */}
        <Route path="/quan-ly/khu-vuc-ban" element={<TablesPage />} />

        {/* Quản lý món ăn */}
        <Route path="/quan-ly/mon-an" element={<DishesPage />} />
        <Route path="/quan-ly/mon-an/them" element={<DishFormPage />} />
        <Route path="/quan-ly/mon-an/set-menu" element={<SetMenuPage />} />
        <Route path="/quan-ly/mon-an/set-menu/them" element={<SetFormPage />} />
        <Route path="/quan-ly/mon-an/set-menu/:id/sua" element={<SetFormPage />} />
        <Route path="/quan-ly/mon-an/danh-muc" element={<MenuCategoriesPage />} />
        <Route path="/quan-ly/mon-an/nhom-mon" element={<MenuGroupsPage />} />
        <Route path="/quan-ly/mon-an/:id/sua" element={<DishFormPage />} />

        {/* Quản lý nhân viên */}
        <Route path="/quan-ly/nhan-vien/ca-lam" element={<ShiftsPage />} />
        <Route path="/quan-ly/nhan-vien/khuon-mat" element={<FacesPage />} />

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

      {/* Website khách hàng (công khai, không đăng nhập) — khung riêng PublicLayout, tải riêng như trang gọi món QR. */}
      <Route element={<Suspense fallback={<PageLoader />}><PublicLayout /></Suspense>}>
        <Route path="/" element={<Suspense fallback={null}><SiteHomePage /></Suspense>} />
        {/* Trang chủ dài một trang (E1): link cũ chuyển về đúng mục ở trang chủ. */}
        <Route path="/gioi-thieu" element={<Navigate to="/#gioi-thieu" replace />} />
        {/* Thực đơn dạng sách lật trang; dạng danh sách cũ giữ ở /thuc-don/danh-sach để có thể quay lại */}
        <Route path="/thuc-don" element={<Suspense fallback={null}><SiteFlipMenuPage /></Suspense>} />
        <Route path="/thuc-don/danh-sach" element={<Suspense fallback={null}><SiteMenuPage /></Suspense>} />
        <Route path="/dat-ban" element={<Suspense fallback={null}><SiteReservationPage /></Suspense>} />
        <Route path="/album" element={<Navigate to="/#khong-gian" replace />} />
        <Route path="/lien-he" element={<Navigate to="/#lien-he" replace />} />
        <Route path="*" element={<Suspense fallback={null}><SiteNotFoundPage /></Suspense>} />
      </Route>
    </Routes>
  );
}

export default AppRoutes;
