# Tiến độ phân hệ Quản lý kho (frontend + backend)

Cập nhật: 13/11/2026. Làm theo đặc tả đã chốt `DacTa_UC_QuanLyKho.docx`.

## Kế hoạch
Mỗi đợt chạy được trọn vẹn: database + API + giao diện.

1. **Đợt 1 — XONG**: Nguyên liệu, Nhà cung cấp (giá theo đơn vị mua), Thông báo dùng chung.
2. **Đợt 2 — XONG**: Phiếu mua + Nhập kho (UC-KHO-12..19), công nợ phát sinh theo hàng đã nhận, thông báo phiếu mua trễ hạn lúc 8:00.
3. **Đợt 3 — XONG**: Xuất kho, Kiểm kê, Công nợ / thanh toán NCC, Dashboard kho; bên quản lý có "Duyệt kiểm kê", "Công nợ NCC (chỉ xem)", thẻ Kho trên Dashboard lấy số thật.

**Phân hệ Quản lý kho đã đủ 27 UC theo đặc tả.**

## Đợt 1 đã làm

### Database
- `db/migration/V7__kho_danh_muc.sql`:
  - Nguyên liệu: thêm nhóm, ghi chú, mức đã cảnh báo, người tạo; giá vốn để trống (NULL) khi chưa từng nhập.
  - Nhà cung cấp: thêm phương thức thanh toán, người liên hệ, website, mã số thuế, lý do ngừng.
  - Bảng mới:
    - `supplier_status_events`: lịch sử ngừng / kích hoạt nhà cung cấp.
    - `supplier_ingredients`: nguyên liệu NCC bán, có đơn vị mua và hệ số quy đổi.
    - `supplier_price_history`: lịch sử giá.
    - `doc_sequences`: bộ đếm mã NL / NCC / PN… theo tháng.
  - Sổ kho có thêm `move_type` và `doc_code`.
  - Thêm loại thông báo `purchase` và `stocktake`.
- `db/dev/V7_1__kho_mau.sql`: dữ liệu mẫu, chỉ nạp ở môi trường dev.
  - File này được sinh tự động bằng `backend/database/kho-seed/gen-v7_1.mjs`.

### Backend
- `com.rms.notification`: API thông báo dùng chung cho mọi vai trò (`/api/notifications`). Thông báo tự xóa sau 30 ngày.
- `com.rms.warehouse`:
  - `IngredientService` / `IngredientController`
  - `SupplierService` / `SupplierController`
  - `StockLedger`: ghi sổ kho, tính giá vốn bình quân, gửi cảnh báo sắp hết / hết hàng, không gửi trùng.
  - `WarehouseCodes`, `WarehouseFormat`
- Phân quyền:
  - `/api/kho/**` chỉ dành cho Quản lý kho.
  - `/api/notifications/**` cho mọi vai trò nội bộ.

### Frontend
- API: `api/warehouse-ingredients.ts`, `api/warehouse-suppliers.ts` và `api/notifications.ts` đã gọi backend thật.
- Trang:
  - Nguyên liệu: danh sách, thêm / sửa, chi tiết kèm thẻ kho.
  - Nhà cung cấp: danh sách, thêm / sửa (thêm được kèm danh sách nguyên liệu), chi tiết (giá, lịch sử giá, ngừng / kích hoạt liên kết).
  - Thông báo.
- Route `/kho/...` đã nối trong `routes.tsx`. Các mục của đợt 2–3 tạm hiện trang "đang hoàn thiện".
- Đã chạy thử trên Chrome với database tạm: 37/37 bước đạt, gồm cả kiểm tra khu Quản lý nhà hàng vẫn chạy.

## Đợt 2 đã làm

### Database
- `db/migration/V8__kho_phieu_mua_nhap_kho.sql`:
  - Phiếu mua: tên phiếu, ngày đặt, người đặt, giảm giá (số tiền hoặc %), thuế, chi phí khác, trạng thái "Đã kết thúc", cờ đã báo trễ hạn.
  - Dòng phiếu mua: chốt đơn vị mua và hệ số; phiếu nháp được để trống SL / đơn giá.
  - Bảng mới:
    - `purchase_order_events`: lịch sử trạng thái phiếu mua.
    - `goods_receipts`, `goods_receipt_items`: phiếu nhập; mỗi dòng lưu tồn và giá vốn trước khi nhập để hủy thì trả về đúng như cũ.
  - Thanh toán NCC có thêm mã và trạng thái (giao diện ở đợt 3).
  - Các phiếu "Tồn đầu kỳ" cũ được tạo phiếu nhập tương ứng.
- `db/dev/V8_1__kho_phieu_mua_mau.sql`: dữ liệu mẫu, sinh bằng `backend/database/kho-seed/gen-v8_1.mjs`.

### Backend (`com.rms.warehouse`)
- `PurchaseOrderService` / `PurchaseOrderController`: danh sách + lọc, chi tiết, lưu nháp / đặt hàng, sửa nháp, xóa nháp, hủy phiếu, kết thúc nhận hàng, thông báo trễ hạn lúc 8:00.
- `ReceiptService` / `ReceiptController`: nhận hàng theo phiếu mua, nhập không phiếu, lịch sử nhập, chi tiết, hủy phiếu nhập (kiểm tra đủ điều kiện).
- `PurchaseMath`: cách tính tạm tính, giảm giá, thuế, tổng cộng, phải trả theo hàng đã nhận, đơn giá nhập kho.
- Thêm nguyên liệu có tồn ban đầu giờ tạo phiếu nhập "Tồn đầu kỳ" thật.

### Frontend
- Trang:
  - Phiếu mua: danh sách, tạo / sửa nháp (cảnh báo SL dưới mức tối thiểu và giá khác giá hiện hành), chi tiết.
  - Nhận hàng theo phiếu mua (kèm trang chọn phiếu đang chờ nhận).
  - Nhập kho không phiếu (cảnh báo đơn giá chênh từ 50%).
  - Lịch sử nhập kho, chi tiết phiếu nhập kèm hủy phiếu nhập.
- Nút "Tạo phiếu mua" ở chi tiết nguyên liệu đã mở form điền sẵn.
- Đã chạy thử trên Chrome với database tạm: 31/31 bước đạt.

## Đợt 3 đã làm

### Database
- `db/migration/V9__kho_xuat_kiem_ke_cong_no.sql`:
  - Bảng mới:
    - `stock_issues`, `stock_issue_items`: phiếu xuất.
    - `stocktakes`, `stocktake_items`, `stocktake_events`: phiếu kiểm kê; mỗi dòng chụp tồn sổ sách lúc đếm.
  - Sổ kho gắn được phiếu xuất / phiếu kiểm kê.
  - Thanh toán NCC có thêm mã tham chiếu.
  - Các dòng xuất kho cũ được tạo phiếu xuất tương ứng.
- `db/dev/V9_1__kho_xuat_kiem_ke_mau.sql`: dữ liệu mẫu, sinh bằng `backend/database/kho-seed/gen-v9_1.mjs`.

### Backend (`com.rms.warehouse`)
- `IssueService` / `IssueController`: tạo phiếu xuất (không vượt tồn, xuất hủy bắt buộc ghi chú), lịch sử, chi tiết, danh sách người nhận.
- `StocktakeService` / `StocktakeController`:
  - Khu Kho: lập phiếu theo phạm vi, tự lưu từng dòng khi đếm, khớp sổ sách, gửi duyệt (không chênh lệch thì tự hoàn tất), xóa nháp, hủy phiếu bị từ chối.
  - Khu Quản lý (`/api/stocktake-approvals`): duyệt (tất cả hoặc không gì, chặn tồn âm), từ chối kèm lý do.
  - Thông báo: chờ duyệt → Quản lý; đã duyệt / bị từ chối → người lập.
- `DebtService` / `DebtController`: công nợ theo NCC (`/api/kho/debts` cho Kho, `/api/supplier-debts` cho Quản lý chỉ xem), ghi nhận / hủy thanh toán.
- `WarehouseDashboardService` / `WarehouseDashboardController`:
  - Dashboard kho và bảng Nhập – xuất – tồn.
  - `/api/dashboard/inventory` cho thẻ Kho của Quản lý nhà hàng.

### Frontend
- Khu Kho:
  - Dashboard: thẻ số liệu, biểu đồ nhập / xuất, nguyên liệu cần nhập, phiếu chờ nhận, kiểm kê cần chú ý, hao hụt, tab Nhập – xuất – tồn.
  - Xuất kho: lịch sử, tạo, chi tiết.
  - Kiểm kê: danh sách, lập phiếu, trang đếm.
  - Công nợ: danh sách, chi tiết NCC, thanh toán / hủy thanh toán.
  - Nút Thanh toán trên danh sách và chi tiết phiếu mua.
- Khu Quản lý:
  - Menu mới **Kho**, gồm "Duyệt kiểm kê" (`/quan-ly/kiem-ke`) và "Công nợ nhà cung cấp" (`/quan-ly/cong-no`, chỉ xem).
  - Thẻ Kho trên Dashboard lấy số liệu thật.
- Đã xóa `mocks/warehouse.ts` và dữ liệu giả của thẻ Kho: toàn bộ phân hệ kho dùng backend thật.
- Đã chạy thử trên Chrome với database tạm: 30/30 bước (1 bước báo sai do bộ chọn của script, biểu đồ hiển thị đúng).

## Còn lại / lưu ý
- Thông báo trễ hạn chạy theo lịch 8:00 nên chưa thử trực tiếp trên trình duyệt; dữ liệu mẫu có sẵn một thông báo trễ hạn.
- Giá trị tồn cuối kỳ trong bảng Nhập – xuất – tồn tính theo giá vốn hiện tại (gần đúng khi giá vốn đã đổi sau kỳ xem).
- Công thức định lượng món do **Bếp** nhập (trang chưa làm). Hiện là dữ liệu mẫu, khu Kho chỉ hiển thị.
