import { useQuery } from '@tanstack/react-query';
import { getWaiterFloor, WAITER_KEYS } from '@/api/waiter';

/** Lời báo khi phục vụ bấm thao tác lúc chưa vào ca / đã tan ca. */
export const WAITER_LOCK_MESSAGE = 'Bạn chưa vào ca (hoặc đã tan ca) — chỉ xem được. Bấm "Chấm công" để vào ca rồi thao tác.';

/**
 * Khóa thao tác của phục vụ theo chấm công (27/11/2026): chưa vào ca / đã tan ca → mọi thao tác (mở / đóng / chuyển / ghép
 * bàn, số khách, gọi món, nhận / xong / hủy yêu cầu, xác nhận đơn) báo lỗi ngay, không gọi máy chủ. Máy chủ vẫn chặn lại
 * lần nữa (WaiterGuard) — đây chỉ để báo sớm, rõ ràng.
 *
 * Dùng: const { locked, guard } = useWaiterLock(); useMutation({ mutationFn: guard(api), ... })
 */
export function useWaiterLock() {
  const floor = useQuery({ queryKey: WAITER_KEYS.floor, queryFn: getWaiterFloor, refetchInterval: 15_000 });
  const locked = floor.data ? !floor.data.clockedIn : false;
  function guard<A extends unknown[], R>(fn: (...args: A) => Promise<R>) {
    return (...args: A): Promise<R> => (locked ? Promise.reject(new Error(WAITER_LOCK_MESSAGE)) : fn(...args));
  }
  return { locked, guard };
}
