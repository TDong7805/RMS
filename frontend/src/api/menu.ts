import { menuGroups, warehouseMenuGroups } from '@/mocks/menu';
import type { AreaKey } from '@/lib/areas';
import type { MenuResponse } from '@/types';

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * [BACKEND-TODO] Dữ liệu menu sidebar: hiện dùng dữ liệu giả ở src/mocks/menu.ts.
 * Khi có backend: thay thân hàm getMenu bằng gọi API GET /api/menu, giữ nguyên kiểu trả về
 * MenuResponse — backend trả menu theo vai trò/quyền của tài khoản đang đăng nhập
 * (khi đó tham số area không còn cần).
 */
export async function getMenu(area: AreaKey = 'manager'): Promise<MenuResponse> {
  await delay(120);
  return { groups: area === 'warehouse' ? warehouseMenuGroups : menuGroups };
}
