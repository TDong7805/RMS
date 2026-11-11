import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { getMe, logout, type AuthUser, type StaffRole } from '@/api/auth';

/** Khóa cache của người đang đăng nhập. null = chưa đăng nhập. */
export const AUTH_KEY = ['auth', 'me'] as const;

/** Người đang đăng nhập. data: AuthUser | null; isPending khi đang hỏi backend lần đầu. */
export function useAuth() {
  return useQuery({
    queryKey: AUTH_KEY,
    queryFn: getMe,
    staleTime: Infinity,
    retry: false,
  });
}

/** Ghi người dùng mới vào cache và xóa dữ liệu của phiên trước (tránh người sau thấy dữ liệu người trước). */
export function setSignedInUser(queryClient: QueryClient, user: AuthUser | null): void {
  queryClient.removeQueries({ predicate: (q) => q.queryKey[0] !== AUTH_KEY[0] });
  queryClient.setQueryData(AUTH_KEY, user);
}

export function useLogout() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  return useMutation({
    mutationFn: logout,
    // Phiên phía máy chủ có thể đã hết hạn sẵn: vẫn đăng xuất phía giao diện.
    onSettled: () => {
      setSignedInUser(queryClient, null);
      navigate('/dang-nhap', { replace: true });
    },
  });
}

/** Tiền tố đường dẫn của các khu vực không phải Quản lý nhà hàng. */
const AREA_PREFIXES: Record<Exclude<StaffRole, 'manager'>, string> = {
  cashier: '/thu-ngan',
  kitchen: '/bep',
  warehouse: '/kho',
};

const PUBLIC_PATHS = ['/dang-nhap', '/doi-mat-khau'];

function startsWithSegment(path: string, prefix: string): boolean {
  return path === prefix || path.startsWith(prefix + '/') || path.startsWith(prefix + '?');
}

/** Vai trò có được vào đường dẫn này không (dùng để quyết định có quay lại trang "next" sau đăng nhập). */
export function canAccessPath(role: StaffRole, path: string): boolean {
  if (PUBLIC_PATHS.some((p) => startsWithSegment(path, p))) return false;
  const areas = Object.values(AREA_PREFIXES);
  if (role === 'manager') return !areas.some((p) => startsWithSegment(path, p));
  return startsWithSegment(path, AREA_PREFIXES[role]);
}

/**
 * Trang đến sau khi đăng nhập: "next" trên URL nếu an toàn và đúng quyền, ngược lại trang chủ của vai trò.
 * Chỉ nhận đường dẫn nội bộ ("/..."), chặn "//trang-khac.com" để không bị lợi dụng chuyển hướng ra ngoài.
 */
export function destinationAfterLogin(user: AuthUser, next: string | null): string {
  if (user.mustChangePassword) return '/doi-mat-khau';
  if (next && next.startsWith('/') && !next.startsWith('//') && canAccessPath(user.role, next)) return next;
  return user.home;
}

/** "Nguyễn Anh Tuấn" → "AT" (hai chữ cuối của họ tên). */
export function initialsOf(fullName: string): string {
  const words = fullName.trim().split(/\s+/).filter(Boolean);
  return words
    .slice(-2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}
