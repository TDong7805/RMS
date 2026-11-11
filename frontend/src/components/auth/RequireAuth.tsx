import { useEffect } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2, ServerCrash } from 'lucide-react';
import { toast } from 'sonner';
import type { StaffRole } from '@/api/auth';
import { Button } from '@/components/common/Button';
import { AUTH_KEY, setSignedInUser, useAuth } from '@/lib/auth';
import { setUnauthorizedHandler } from '@/lib/http';

export interface RequireAuthProps {
  /** Vai trò được vào. Bỏ trống = mọi người đã đăng nhập. */
  roles?: StaffRole[];
  /** Cho vào khi đang bị buộc đổi mật khẩu (chỉ dùng cho trang đổi mật khẩu). */
  allowPasswordChange?: boolean;
}

/**
 * Bọc các route cần đăng nhập:
 *  - chưa đăng nhập        → /dang-nhap?next=<trang đang mở>
 *  - phải đổi mật khẩu     → /doi-mat-khau
 *  - sai vai trò           → trang chủ của vai trò mình (vd. thu ngân gõ /khu-vuc-ban → /thu-ngan)
 * Đây chỉ là lớp giao diện; backend vẫn kiểm tra quyền ở từng API.
 */
export function RequireAuth({ roles, allowPasswordChange = false }: RequireAuthProps) {
  const location = useLocation();
  const { data: user, isPending, isError, refetch, isRefetching } = useAuth();

  if (isPending) {
    return (
      <div className="grid min-h-screen place-items-center bg-[var(--bg-page)]">
        <Loader2 size={28} className="animate-spin text-[var(--accent)]" aria-label="Đang tải" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="grid min-h-screen place-items-center bg-[var(--bg-page)] p-6">
        <div className="max-w-sm text-center">
          <ServerCrash size={36} strokeWidth={1.5} className="mx-auto text-[var(--text-muted)]" aria-hidden />
          <h1 className="mt-3 text-[18px] font-bold">Không kết nối được máy chủ</h1>
          <p className="mt-1.5 text-[14px] text-[var(--text-secondary)]">
            Kiểm tra backend đã chạy chưa rồi thử lại.
          </p>
          <Button className="mt-4" onClick={() => refetch()} loading={isRefetching}>
            Thử lại
          </Button>
        </div>
      </div>
    );
  }

  if (!user) {
    const here = location.pathname + location.search;
    const target = here === '/' ? '/dang-nhap' : `/dang-nhap?next=${encodeURIComponent(here)}`;
    return <Navigate to={target} replace />;
  }
  if (user.mustChangePassword && !allowPasswordChange) return <Navigate to="/doi-mat-khau" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to={user.home} replace />;

  return <Outlet />;
}

/**
 * Đặt một lần trong App: khi bất kỳ API nào trả 401 (hết phiên, bị khóa) → xóa phiên phía giao diện;
 * RequireAuth sẽ tự đưa về trang đăng nhập và giữ lại trang đang mở trong "next".
 */
export function SessionWatcher() {
  const queryClient = useQueryClient();
  useEffect(() => {
    setUnauthorizedHandler((message) => {
      if (!queryClient.getQueryData(AUTH_KEY)) return;
      setSignedInUser(queryClient, null);
      toast.warning(message, { duration: 8000 });
    });
    return () => setUnauthorizedHandler(null);
  }, [queryClient]);
  return null;
}
