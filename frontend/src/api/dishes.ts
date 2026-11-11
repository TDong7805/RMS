import { api } from '@/lib/http';
import type { Dish, DishCategory, DishFilter, DishInput, DishStatus, Paged } from '@/types';

/** Phải trùng DishService.PAGE_SIZE ở backend. */
export const DISH_PAGE_SIZE = 10;
/** Khớp cột dishes.description / ingredients_text (VARCHAR(500)). */
export const DESCRIPTION_MAX = 500;

/** GET /api/dishes?keyword=&categoryId=&status=&page= — tìm không dấu theo tên hoặc mã món, mới cập nhật trước. */
export function getDishes(filter: DishFilter): Promise<Paged<Dish>> {
  return api.get<Paged<Dish>>('/api/dishes', {
    keyword: filter.keyword,
    categoryId: filter.categoryId,
    status: filter.status,
    page: filter.page,
  });
}

/** GET /api/dishes/{id} — 404 nếu không tồn tại hoặc đã xóa. */
export function getDish(id: string): Promise<Dish> {
  return api.get<Dish>(`/api/dishes/${encodeURIComponent(id)}`);
}

/**
 * POST /api/dishes. Trường image: null (không ảnh) hoặc data URL của ảnh vừa chọn — backend kiểm tra định dạng thật,
 * dung lượng, thu nhỏ rồi lưu; trả về địa chỉ ảnh (/uploads/dishes/...). Mã món do backend sinh.
 */
export function createDish(input: DishInput): Promise<Dish> {
  return api.post<Dish>('/api/dishes', input);
}

/**
 * PUT /api/dishes/{id}. image giữ nguyên địa chỉ ảnh cũ = không đổi ảnh; data URL = ảnh mới; null = bỏ ảnh.
 * Đổi giá không ảnh hưởng đơn hàng đã tạo (đơn lưu giá lúc bán).
 */
export function updateDish(id: string, input: DishInput): Promise<Dish> {
  return api.put<Dish>(`/api/dishes/${encodeURIComponent(id)}`, input);
}

/** PATCH /api/dishes/{id}/status — ngừng bán thì AI tự tắt gợi ý món này. */
export function setDishStatus(id: string, status: DishStatus): Promise<Dish> {
  return api.patch<Dish>(`/api/dishes/${encodeURIComponent(id)}/status`, { status });
}

/** DELETE /api/dishes/{id} — 409 nếu món đã phát sinh trong đơn hàng (chỉ chuyển "Ngừng bán"). */
export function deleteDish(id: string): Promise<void> {
  return api.delete(`/api/dishes/${encodeURIComponent(id)}`);
}

/* ------------------------------------------------------------ Danh mục, dị nguyên */

/** GET /api/dish-categories — theo thứ tự hiển thị, kèm số món. */
export function getCategories(): Promise<(DishCategory & { dishCount: number })[]> {
  return api.get<(DishCategory & { dishCount: number })[]>('/api/dish-categories');
}

/** POST /api/dish-categories | PUT /api/dish-categories/{id} */
export function saveCategory(input: { id?: string; name: string; active: boolean }): Promise<DishCategory> {
  const body = { name: input.name, active: input.active };
  return input.id
    ? api.put<DishCategory>(`/api/dish-categories/${encodeURIComponent(input.id)}`, body)
    : api.post<DishCategory>('/api/dish-categories', body);
}

/** GET /api/allergens — danh sách dị nguyên nhà hàng khai báo (bảng allergens). */
export function getAllergens(): Promise<string[]> {
  return api.get<string[]>('/api/allergens');
}
