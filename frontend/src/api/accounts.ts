import { accountSeed } from '@/mocks/accounts';
import { currentUserSeed } from '@/mocks/notifications';
import { matchesKeyword } from '@/lib/normalize';
import { ROLES } from '@/lib/labels';
import {
  BusinessError,
  EMAIL_RE,
  PHONE_RE,
  ValidationError,
  collapseSpaces,
  delay,
  paginate,
  uid,
} from '@/lib/mock';
import { logActivity } from './audit';
import type { Account, AccountFilter, AccountInput, Employee, Paged } from '@/types';

let store: Account[] = accountSeed.map((a) => ({ ...a }));

export const ACCOUNT_PAGE_SIZE = 10;
export const CURRENT_USER_ID = currentUserSeed.id;

const USERNAME_RE = /^[a-z0-9._]{4,30}$/;

function validate(input: AccountInput, editingId: string | null): Record<string, string> {
  const errors: Record<string, string> = {};
  const username = input.username.trim().toLowerCase();
  const email = input.email.trim().toLowerCase();

  if (!username) errors.username = 'Vui lòng nhập tên đăng nhập';
  else if (!USERNAME_RE.test(username))
    errors.username = '4–30 ký tự, chỉ gồm chữ thường không dấu, số, dấu chấm hoặc gạch dưới';
  else if (store.some((a) => a.id !== editingId && a.username === username))
    errors.username = 'Tên đăng nhập đã tồn tại';

  if (!collapseSpaces(input.fullName)) errors.fullName = 'Vui lòng nhập họ tên';

  if (!email) errors.email = 'Vui lòng nhập email';
  else if (!EMAIL_RE.test(email)) errors.email = 'Email không đúng định dạng';
  else if (store.some((a) => a.id !== editingId && a.email.toLowerCase() === email))
    errors.email = 'Email đã được sử dụng cho tài khoản khác';

  if (input.phone.trim() && !PHONE_RE.test(input.phone.trim()))
    errors.phone = 'Số điện thoại không đúng định dạng (VD: 0912345678)';

  if (!ROLES[input.role]) errors.role = 'Vui lòng phân vai trò cho tài khoản';

  if (editingId === null) {
    const pw = input.password ?? '';
    if (pw.length < 8 || !/[A-Za-z]/.test(pw) || !/\d/.test(pw))
      errors.password = 'Mật khẩu tối thiểu 8 ký tự, gồm cả chữ và số';
  }
  return errors;
}

/** Quản lý nhà hàng không thao tác trên tài khoản Quản trị viên và tài khoản của chính mình. */
function assertManageable(account: Account, action: string): void {
  if (account.id === CURRENT_USER_ID) throw new BusinessError(`Không thể ${action} tài khoản đang đăng nhập`);
  if (account.role === 'admin') throw new BusinessError(`Không có quyền ${action} tài khoản Quản trị viên`);
}

function find(id: string): Account {
  const found = store.find((a) => a.id === id);
  if (!found) throw new BusinessError('Tài khoản không tồn tại hoặc đã bị xóa');
  return found;
}

/** [BACKEND-TODO] GET /api/accounts?keyword=&role=&status=&page= → Paged<Account> */
export async function getAccounts(filter: AccountFilter): Promise<Paged<Account>> {
  await delay(300);
  const items = store
    .filter((a) => (filter.role === 'all' ? true : a.role === filter.role))
    .filter((a) => (filter.status === 'all' ? true : a.status === filter.status))
    .filter(
      (a) =>
        !filter.keyword.trim() ||
        matchesKeyword(a.username, filter.keyword) ||
        matchesKeyword(a.fullName, filter.keyword) ||
        matchesKeyword(a.email, filter.keyword) ||
        a.phone.includes(filter.keyword.trim()),
    )
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return paginate(items, filter.page, ACCOUNT_PAGE_SIZE);
}

/** [BACKEND-TODO] GET /api/accounts/{id} */
export async function getAccount(id: string): Promise<Account> {
  await delay(200);
  return { ...find(id) };
}

/** [BACKEND-TODO] POST /api/accounts — máy chủ băm mật khẩu và ghi log. */
export async function createAccount(input: AccountInput): Promise<Account> {
  await delay(450);
  const errors = validate(input, null);
  if (Object.keys(errors).length) throw new ValidationError(errors);
  const account: Account = {
    id: uid('usr'),
    username: input.username.trim().toLowerCase(),
    fullName: collapseSpaces(input.fullName),
    email: input.email.trim().toLowerCase(),
    phone: input.phone.trim(),
    role: input.role,
    status: 'active',
    createdAt: new Date().toISOString(),
    lastLoginAt: null,
  };
  store = [account, ...store];
  logActivity('account', 'Tạo tài khoản', `Tạo tài khoản ${account.username} – ${ROLES[account.role].label}`);
  return { ...account };
}

/** [BACKEND-TODO] PUT /api/accounts/{id} */
export async function updateAccount(id: string, input: AccountInput): Promise<Account> {
  await delay(420);
  const current = find(id);
  if (current.role === 'admin') throw new BusinessError('Không có quyền sửa tài khoản Quản trị viên');
  if (id === CURRENT_USER_ID && input.role !== current.role)
    throw new ValidationError({ role: 'Không thể tự thay đổi vai trò của chính mình' });
  const errors = validate(input, id);
  if (Object.keys(errors).length) throw new ValidationError(errors);
  const updated: Account = {
    ...current,
    username: input.username.trim().toLowerCase(),
    fullName: collapseSpaces(input.fullName),
    email: input.email.trim().toLowerCase(),
    phone: input.phone.trim(),
    role: input.role,
  };
  store = store.map((a) => (a.id === id ? updated : a));
  const roleNote = current.role !== updated.role ? ` (vai trò: ${ROLES[current.role].label} → ${ROLES[updated.role].label})` : '';
  logActivity('account', 'Cập nhật tài khoản', `Cập nhật ${updated.username}${roleNote}`);
  return { ...updated };
}

/** [BACKEND-TODO] PATCH /api/accounts/{id}/status { status } */
export async function setAccountLocked(id: string, locked: boolean): Promise<Account> {
  await delay(300);
  const current = find(id);
  assertManageable(current, locked ? 'khóa' : 'mở khóa');
  const updated: Account = { ...current, status: locked ? 'locked' : 'active' };
  store = store.map((a) => (a.id === id ? updated : a));
  logActivity('account', locked ? 'Khóa tài khoản' : 'Mở khóa tài khoản', `${locked ? 'Khóa' : 'Mở khóa'} tài khoản ${current.username}`);
  return { ...updated };
}

/** [BACKEND-TODO] POST /api/accounts/{id}/reset-password → mật khẩu tạm (hiển thị một lần). */
export async function resetAccountPassword(id: string): Promise<string> {
  await delay(400);
  const current = find(id);
  assertManageable(current, 'đặt lại mật khẩu');
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  let pw = '';
  for (let i = 0; i < 10; i += 1) pw += chars[Math.floor(Math.random() * chars.length)];
  pw = `${pw.slice(0, 8)}${Math.floor(Math.random() * 90 + 10)}`;
  logActivity('account', 'Đặt lại mật khẩu', `Đặt lại mật khẩu cho ${current.username}`);
  return pw;
}

/** [BACKEND-TODO] DELETE /api/accounts/{id} */
export async function deleteAccount(id: string): Promise<void> {
  await delay(380);
  const current = find(id);
  assertManageable(current, 'xóa');
  store = store.filter((a) => a.id !== id);
  logActivity('account', 'Xóa tài khoản', `Xóa tài khoản ${current.username}`);
}

/**
 * Nhân viên có thể được phân ca (tài khoản đang hoạt động, trừ Quản trị viên).
 * [BACKEND-TODO] GET /api/employees
 */
export async function getEmployees(): Promise<Employee[]> {
  await delay(180);
  return store
    .filter((a) => a.status === 'active' && a.role !== 'admin')
    .map((a) => ({ id: a.id, fullName: a.fullName, role: a.role }))
    .sort((a, b) => a.role.localeCompare(b.role) || a.fullName.localeCompare(b.fullName, 'vi'));
}
