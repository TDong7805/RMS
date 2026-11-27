import { CashierShell } from '@/features/ordering/CashierShell';
import { NotificationsPanel } from '@/features/notifications/NotificationsPanel';

/**
 * /thu-ngan/thong-bao — thông báo của quầy (màn hình chung khu.thu.ngan): yêu cầu thanh toán, bếp hủy món, đặt bàn website…
 * Dùng khung POS có nút "Về quầy thu ngân" (không dùng khung quản lý — tránh lộ menu Chấm công / Bảng lương).
 */
export default function CashierNotificationsPage() {
  return (
    <CashierShell>
      <NotificationsPanel emptyText="Yêu cầu thanh toán, món bếp hủy, lịch đặt bàn mới sẽ hiện ở đây." />
    </CashierShell>
  );
}
