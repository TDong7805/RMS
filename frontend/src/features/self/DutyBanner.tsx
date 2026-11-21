import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Lock } from 'lucide-react';
import { getClock, SELF_KEYS } from '@/api/self';

/**
 * Thu ngân / bếp đã chấm công vào ca chưa (V22): chưa vào ca thì việc trong ca bị máy chủ chặn (OnDutyInterceptor).
 * loaded = đã biết trạng thái (tránh nháy thanh nhắc lúc mới mở trang).
 */
export function useClockedIn(): { clockedIn: boolean; loaded: boolean } {
  const q = useQuery({ queryKey: SELF_KEYS.clock, queryFn: getClock, refetchInterval: 30_000, staleTime: 15_000 });
  return { clockedIn: Boolean(q.data?.open), loaded: Boolean(q.data) };
}

/** Thanh nhắc "chưa vào ca" — bấm để tới trang chấm công của khu (home + "/toi"). */
export function DutyBanner({ home }: { home: string }) {
  const navigate = useNavigate();
  const { clockedIn, loaded } = useClockedIn();
  if (!loaded || clockedIn) return null;
  return (
    <button
      type="button"
      onClick={() => navigate(`${home}/toi`)}
      className="flex w-full shrink-0 items-center gap-2 border-b border-[#fcd34d] bg-[#fffbeb] px-4 py-2 text-left text-[13.5px] text-[#92400e]"
    >
      <Lock size={15} className="shrink-0" />
      <span className="min-w-0 flex-1">Bạn chưa vào ca — chỉ xem được. Vào ca (chấm công khuôn mặt) để thao tác.</span>
      <span className="shrink-0 rounded-full bg-[#f59e0b] px-3 py-1 text-[12.5px] font-bold text-white">Vào ca</span>
    </button>
  );
}
