/**
 * Đường dẫn gốc của khu vực Quản lý nhà hàng. Trang "/" và các đường dẫn ngắn (/thuc-don, /tin-tuc, /dat-ban)
 * để dành cho website khách hàng; thu ngân, bếp, kho dùng /thu-ngan, /bep, /kho.
 * Phải trùng com.rms.auth.StaffAreas.HOME ở backend.
 */
export const MANAGER_HOME = '/quan-ly';

/** "/mon-an" → "/quan-ly/mon-an" */
export const managerPath = (path: string): string => (path === '/' ? MANAGER_HOME : MANAGER_HOME + path);

/**
 * Đường dẫn cũ (trước khi gom vào /quan-ly) — tự chuyển sang đường dẫn mới để bookmark, link cũ không bị hỏng.
 * Không chuyển "/dat-ban" (để dành cho trang đặt bàn của khách), chỉ chuyển 2 trang con của quản lý.
 */
export const LEGACY_MANAGER_PATHS = [
  '/thong-bao',
  '/dat-ban/lich-su',
  '/dat-ban/cap-nhat',
  '/khu-vuc-ban',
  '/mon-an/*',
  '/nhan-vien/*',
  '/bai-viet/*',
  '/tai-khoan/*',
  '/chatbot',
  '/nhat-ky',
  '/cai-dat',
];
