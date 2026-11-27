import { NotificationsPanel } from '@/features/notifications/NotificationsPanel';
import { MyInfo } from '@/features/self/MyInfo';
import { StaffPortalShell } from '@/features/self/StaffPortalShell';

/** /nhan-vien — Cổng nhân viên của tài khoản riêng thu ngân / bếp: chấm công, ca làm, lịch sử, phiếu lương, hồ sơ. */
export function PortalHomePage() {
  return (
    <StaffPortalShell>
      <MyInfo />
    </StaffPortalShell>
  );
}

/** /nhan-vien/thong-bao — thông báo riêng (khuôn mặt được duyệt…). Thông báo công việc về màn hình chung. */
export function PortalNotificationsPage() {
  return (
    <StaffPortalShell>
      <NotificationsPanel emptyText="Thông báo riêng của bạn (vd. khuôn mặt được duyệt) sẽ hiện ở đây." />
    </StaffPortalShell>
  );
}
