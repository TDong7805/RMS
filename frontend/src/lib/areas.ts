import { MANAGER_HOME } from './paths';

/**
 * Các khu vực dùng chung khung AppShell (menu bên trái, chuông, tìm kiếm, breadcrumb).
 * Bếp dùng màn hình hiển thị riêng (KDS) nên không nằm trong khung này.
 */
export type AreaKey = 'manager' | 'warehouse' | 'cashier';

/** Đường dẫn gốc của khu Quản lý kho. Phải trùng com.rms.auth.StaffAreas ở backend. */
export const WAREHOUSE_HOME = '/kho';

/** Đường dẫn gốc của khu Thu ngân. Phải trùng com.rms.auth.StaffAreas ở backend. */
export const CASHIER_HOME = '/thu-ngan';

export const AREA_HOME: Record<AreaKey, string> = {
  manager: MANAGER_HOME,
  warehouse: WAREHOUSE_HOME,
  cashier: CASHIER_HOME,
};

export const AREA_LABEL: Record<AreaKey, string> = {
  manager: 'Quản lý nhà hàng',
  warehouse: 'Quản lý kho',
  cashier: 'Thu ngân',
};

const startsWith = (path: string, prefix: string) => path === prefix || path.startsWith(prefix + '/');

/** Khu vực của một đường dẫn: "/kho/..." là kho, "/thu-ngan/..." là thu ngân, còn lại là khu quản lý. */
export function areaFromPath(pathname: string): AreaKey {
  if (startsWith(pathname, WAREHOUSE_HOME)) return 'warehouse';
  if (startsWith(pathname, CASHIER_HOME)) return 'cashier';
  return 'manager';
}

/** "/nguyen-lieu" → "/kho/nguyen-lieu" */
export const warehousePath = (path = ''): string => (path ? WAREHOUSE_HOME + path : WAREHOUSE_HOME);
