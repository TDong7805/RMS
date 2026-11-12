import { MANAGER_HOME } from './paths';

/**
 * Các khu vực dùng chung khung AppShell (menu bên trái, chuông, tìm kiếm, breadcrumb).
 * Thu ngân và Bếp sẽ thêm vào đây khi làm phân hệ của họ.
 */
export type AreaKey = 'manager' | 'warehouse';

/** Đường dẫn gốc của khu Quản lý kho. Phải trùng com.rms.auth.StaffAreas ở backend. */
export const WAREHOUSE_HOME = '/kho';

export const AREA_HOME: Record<AreaKey, string> = {
  manager: MANAGER_HOME,
  warehouse: WAREHOUSE_HOME,
};

export const AREA_LABEL: Record<AreaKey, string> = {
  manager: 'Quản lý nhà hàng',
  warehouse: 'Quản lý kho',
};

const startsWith = (path: string, prefix: string) => path === prefix || path.startsWith(prefix + '/');

/** Khu vực của một đường dẫn: "/kho/..." là kho, còn lại là khu quản lý. */
export function areaFromPath(pathname: string): AreaKey {
  return startsWith(pathname, WAREHOUSE_HOME) ? 'warehouse' : 'manager';
}

/** "/nguyen-lieu" → "/kho/nguyen-lieu" */
export const warehousePath = (path = ''): string => (path ? WAREHOUSE_HOME + path : WAREHOUSE_HOME);
