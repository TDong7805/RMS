import { MyInfo } from '@/features/self/MyInfo';
import { SelfShell } from '@/features/self/SelfShell';
import { WaiterShell } from '@/features/waiter/WaiterShell';

/** "Thông tin của tôi" (chấm công khuôn mặt, ca làm, lịch sử, phiếu lương, hồ sơ) theo từng khu. */
export function WaiterSelfPage() {
  return (
    <WaiterShell title="THÔNG TIN CỦA TÔI">
      <MyInfo />
    </WaiterShell>
  );
}

export function CashierSelfPage() {
  return (
    <SelfShell home="/thu-ngan" homeLabel="Về khu Thu ngân">
      <MyInfo />
    </SelfShell>
  );
}

export function KitchenSelfPage() {
  return (
    <SelfShell home="/bep" homeLabel="Về màn hình bếp">
      <MyInfo />
    </SelfShell>
  );
}
