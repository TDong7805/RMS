import { api } from '@/lib/http';
import { BusinessError } from '@/lib/mock';

/** Vai trò được đăng nhập trang nội bộ (khớp backend com.rms.auth.StaffAreas). */
export type StaffRole = 'manager' | 'cashier' | 'kitchen' | 'warehouse' | 'waiter';

export interface AuthUser {
  id: string;
  username: string;
  fullName: string;
  email: string;
  role: StaffRole;
  /** Tên vai trò hiển thị, lấy từ bảng roles (vd. "Quản lý nhà hàng"). */
  roleLabel: string;
  /** true: tài khoản mới tạo hoặc vừa được đặt lại mật khẩu → phải đổi trước khi dùng. */
  mustChangePassword: boolean;
  /** Trang chủ: "/quan-ly", "/thu-ngan", "/bep", "/kho", "/phuc-vu"; tài khoản riêng thu ngân / bếp → "/nhan-vien". */
  home: string;
  /**
   * true: tài khoản MÀN HÌNH CHUNG ở quầy / bếp (vd. khu.thu.ngan, khu.bep) — chỉ màn làm việc.
   * false với thu ngân / bếp: tài khoản riêng — chỉ Cổng nhân viên /nhan-vien. Vai trò khác luôn false.
   */
  sharedScreen: boolean;
}

export interface LoginInput {
  username: string;
  password: string;
  remember: boolean;
}

export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

/** POST /api/auth/login — sai thông tin: BusinessError 401; bỏ trống: ValidationError; bị khóa: 403. */
export function login(input: LoginInput): Promise<AuthUser> {
  return api.post<AuthUser>('/api/auth/login', input);
}

/** GET /api/auth/me — chưa đăng nhập thì trả null (không ném lỗi). */
export async function getMe(): Promise<AuthUser | null> {
  try {
    return await api.get<AuthUser>('/api/auth/me');
  } catch (error) {
    if (error instanceof BusinessError && error.status === 401) return null;
    throw error;
  }
}

/** POST /api/auth/change-password — lỗi theo ô: currentPassword, newPassword, confirmPassword. */
export function changePassword(input: ChangePasswordInput): Promise<AuthUser> {
  return api.post<AuthUser>('/api/auth/change-password', input);
}

/** POST /api/auth/logout */
export async function logout(): Promise<void> {
  await api.post('/api/auth/logout');
}
