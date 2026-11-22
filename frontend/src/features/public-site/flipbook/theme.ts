/**
 * Nền trang sách thực đơn. Đổi phương án mặc định ở MENU_PAPER; xem thử nhanh bằng ?nen=1|2|3 trên địa chỉ trang.
 * Ảnh nằm ở frontend/public/images/menu/ (ảnh tạm — xem tools/menu-textures/README.md để thay ảnh thật).
 *   cream   — giấy mỹ thuật màu kem / giấy cũ có vân nhẹ (1)
 *   lineart — nền sáng in mờ hoa văn line-art món ăn (2)
 *   kraft   — giấy kraft tông ấm (3)
 * Màu chữ / lớp phủ cho từng nền khai báo trong flipbook.css ([data-paper="…"]) — đã kiểm tra tương phản WCAG AA.
 */
export type MenuPaper = 'cream' | 'lineart' | 'kraft';

export const MENU_PAPER: MenuPaper = 'cream';

const BY_NUMBER: Record<string, MenuPaper> = { '1': 'cream', '2': 'lineart', '3': 'kraft' };

/** Phương án nền đang dùng: ?nen=1|2|3 (xem thử) hoặc MENU_PAPER. */
export function paperFromQuery(value: string | null): MenuPaper {
  return (value && BY_NUMBER[value]) || MENU_PAPER;
}
