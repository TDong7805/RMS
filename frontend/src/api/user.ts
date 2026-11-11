import { currentUserSeed } from '@/mocks/notifications';
import type { CurrentUser } from '@/types';

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * [BACKEND-TODO] Người dùng hiện tại / avatar / đăng xuất: hiện dùng dữ liệu giả ở
 * src/mocks/notifications.ts. Khi có backend: thay thân hàm getCurrentUser bằng gọi API
 * GET /api/me, giữ nguyên kiểu trả về CurrentUser.
 */
export async function getCurrentUser(): Promise<CurrentUser> {
  await delay(180);
  return { ...currentUserSeed };
}

/**
 * [BACKEND-TODO] Đăng xuất: hiện chỉ mô phỏng độ trễ, không có phiên thật để huỷ.
 * Khi có backend: thay thân hàm signOut bằng gọi API POST /auth/logout (xoá session/cookie),
 * giữ nguyên kiểu trả về void.
 */
export async function signOut(): Promise<void> {
  await delay(260);
}