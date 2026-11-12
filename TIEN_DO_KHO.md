# Tiến độ giao diện Quản lý kho (chỉ frontend, dữ liệu giả)

Cập nhật: 12/11/2026. Kiểm tra kiểu (`npx tsc -p tsconfig.app.json --noEmit`) đạt, chưa chạy `npm run lint`.

## Kế hoạch 3 đợt
1. **Đợt 1** (đang làm): khung khu Kho + Dashboard + Nguyên liệu + Nhà cung cấp.
2. **Đợt 2**: Phiếu mua + Nhập kho (UC-KHO-12..19).
3. **Đợt 3**: Xuất kho, Kiểm kê, Công nợ, Thông báo, cùng 2 trang bên quản lý ("Duyệt kiểm kê", "Công nợ NCC chỉ xem").

## Đã xong
Đường dẫn bên dưới tính từ `frontend/src/`.

- **Khung theo khu vực** (manager / warehouse, xác định theo đường dẫn `/kho`):
  - `lib/areas.ts`, `mocks/menu.ts` (menu kho), `api/menu.ts`
  - Thông báo theo khu: `api/notifications.ts`, `mocks/notifications.ts`, `features/notifications/hooks.ts`
  - Tìm trang theo khu: `api/search.ts`
  - Bố cục: `components/layout/*` (AppShell, Sidebar, Breadcrumb, SearchBox, NotificationMenu)
  - `pages/PlaceholderPage.tsx`, `lib/icons.ts`
  - `components/common/Modal.tsx`: ConfirmDialog có thêm `cancelLabel`, `confirmDisabled`, `children`
- **Dữ liệu và API giả:**
  - `types/warehouse.ts`
  - `mocks/warehouse.ts`: mô phỏng 35 ngày, giá vốn bình quân, 26 nguyên liệu, 6 NCC, phiếu mua, kiểm kê
  - `api/warehouse-ingredients.ts`, `api/warehouse-suppliers.ts`, `api/warehouse-dashboard.ts`
  - `features/warehouse/` (queries, labels, parts)
- **Hộp thoại:**
  - `features/warehouse/IngredientDialogs.tsx`: ngừng / dùng lại / xóa nguyên liệu
  - `features/warehouse/SupplierDialogs.tsx`: ngừng / kích hoạt / xóa NCC
  - `features/warehouse/LinkDialogs.tsx`: thêm / sửa / kích hoạt lại liên kết NL–NCC, cảnh báo giá đổi ≥ 50%, ngừng liên kết, lịch sử giá
- **Trang:**
  - `pages/kho/IngredientsPage.tsx` (UC-02)
  - `pages/kho/IngredientFormPage.tsx` (UC-03/04)
  - `pages/kho/IngredientDetailPage.tsx` (UC-06, thẻ kho)
  - `pages/kho/SuppliersPage.tsx` (UC-07, danh sách nhà cung cấp; chưa chạy tsc sau khi thêm)

## Dừng tại đây — việc còn lại của đợt 1
1. `pages/kho/SupplierFormPage.tsx` (UC-08/09):
   - các dòng liên kết chỉ có khi thêm mới; lỗi báo theo key `links.{i}.field`;
   - trước khi lưu, kiểm tra tên trùng bằng `findSupplierByName`;
   - dùng `useLeaveGuard`.
2. `pages/kho/SupplierDetailPage.tsx` (UC-11): thông tin, lịch sử trạng thái, bảng liên kết, dùng các hộp thoại ở `LinkDialogs.tsx`.
3. `pages/kho/WarehouseDashboardPage.tsx` (UC-01):
   - kỳ: Hôm nay / 7 ngày / Tháng này / Tùy chọn;
   - 2 tab: Tổng quan và Nhập – xuất – tồn;
   - dữ liệu lấy từ `useWarehouseDashboard` và `useStockSummary`.
4. Nối route trong `routes.tsx` (phần `RequireAuth roles={['warehouse']}`): thay `/kho/*` StaffAreaPage bằng các trang trên. Các mục chưa làm tạm dùng PlaceholderPage. **Hiện các trang kho chưa nối route nên chưa mở được trên web.**
5. Chạy `npm run lint`, chạy thử bằng tài khoản thao.bui, kiểm tra lại khu quản lý.
6. Cập nhật `DU_LIEU_GIA.md` với dữ liệu giả của kho (`mocks/warehouse.ts`, thông báo kho, menu, gợi ý tìm kiếm).

## Ghi chú
- Đặc tả `DacTa_UC_QuanLyKho.docx` và sơ đồ `docs/so-do-hoat-dong-kho/` được gỡ ra khỏi repo (giữ ở nơi khác). Code giao diện không phụ thuộc vào hai thứ này.
