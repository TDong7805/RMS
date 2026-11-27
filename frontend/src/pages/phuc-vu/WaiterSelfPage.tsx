import { MyInfo } from '@/features/self/MyInfo';
import { WaiterShell } from '@/features/waiter/WaiterShell';

/**
 * /phuc-vu/toi — phục vụ tự chấm công bằng khuôn mặt trên điện thoại của mình (+ ca làm, lịch sử, phiếu lương, hồ sơ).
 * Chưa vào ca thì chỉ xem, không nhận thông báo (27/11/2026).
 */
export default function WaiterSelfPage() {
  return (
    <WaiterShell title="CỦA TÔI">
      <MyInfo />
    </WaiterShell>
  );
}
