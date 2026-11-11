import { api } from '@/lib/http';
import type { Account, AccountFilter, AccountInput, Paged } from '@/types';

/** Phải trùng AccountService.PAGE_SIZE ở backend. */
export const ACCOUNT_PAGE_SIZE = 10;

/** Vai trò được đăng nhập hệ thống (khớp backend com.rms.auth.StaffAreas). Phục vụ thì không. */
export const LOGIN_ROLES = ['manager', 'cashier', 'kitchen', 'warehouse'] as const;
export const canLogin = (role: string): boolean => (LOGIN_ROLES as readonly string[]).includes(role);

/** GET /api/accounts?keyword=&role=&status=&page= — tìm không dấu theo tên đăng nhập, họ tên, email, SĐT. */
export function getAccounts(filter: AccountFilter): Promise<Paged<Account>> {
  return api.get<Paged<Account>>('/api/accounts', {
    keyword: filter.keyword,
    role: filter.role,
    status: filter.status,
    page: filter.page,
  });
}

/** GET /api/accounts/{id} — 404 nếu không tồn tại hoặc đã xóa. */
export function getAccount(id: string): Promise<Account> {
  return api.get<Account>(`/api/accounts/${encodeURIComponent(id)}`);
}

/** POST /api/accounts — backend băm mật khẩu, đặt cờ buộc đổi mật khẩu lần đầu, ghi nhật ký. */
export function createAccount(input: AccountInput): Promise<Account> {
  return api.post<Account>('/api/accounts', input);
}

/** PUT /api/accounts/{id} — sửa thông tin cơ bản + vai trò (không sửa mật khẩu ở đây). */
export function updateAccount(id: string, input: AccountInput): Promise<Account> {
  const { password: _ignored, ...rest } = input;
  return api.put<Account>(`/api/accounts/${encodeURIComponent(id)}`, rest);
}

/** PATCH /api/accounts/{id}/status — khóa có hiệu lực ngay: người đó bị đẩy ra ở thao tác kế tiếp. */
export function setAccountLocked(id: string, locked: boolean): Promise<Account> {
  return api.patch<Account>(`/api/accounts/${encodeURIComponent(id)}/status`, {
    status: locked ? 'locked' : 'active',
  });
}

/** POST /api/accounts/{id}/reset-password → mật khẩu tạm (chỉ trả một lần, không lưu ở đâu khác). */
export async function resetAccountPassword(id: string): Promise<string> {
  const res = await api.post<{ password: string }>(`/api/accounts/${encodeURIComponent(id)}/reset-password`);
  return res.password;
}

/** DELETE /api/accounts/{id} — xóa mềm, lịch sử thao tác vẫn giữ. */
export function deleteAccount(id: string): Promise<void> {
  return api.delete(`/api/accounts/${encodeURIComponent(id)}`);
}
