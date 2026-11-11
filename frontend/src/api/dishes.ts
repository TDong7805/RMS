import { categorySeed, dishSeed } from '@/mocks/dishes';
import { matchesKeyword } from '@/lib/normalize';
import { DISH_STATUS } from '@/lib/labels';
import { formatCurrency } from '@/lib/format';
import { BusinessError, ValidationError, collapseSpaces, delay, paginate, uid } from '@/lib/mock';
import { logActivity } from './audit';
import type { Dish, DishCategory, DishFilter, DishInput, DishStatus, Paged } from '@/types';

let dishes: Dish[] = dishSeed.map((d) => ({ ...d, allergens: [...d.allergens], aiTags: [...d.aiTags] }));
let categories: DishCategory[] = categorySeed.map((c) => ({ ...c }));

export const DISH_PAGE_SIZE = 10;
export const DESCRIPTION_MAX = 500;

/** Đọc đồng bộ cho phân hệ Chatbot AI (đồng bộ thực đơn). */
export function dishesSnapshot(): Dish[] {
  return dishes.map((d) => ({ ...d }));
}

/** Cập nhật dữ liệu dành riêng cho AI (thẻ, bật/tắt gợi ý) — gọi từ phân hệ Chatbot. */
export function patchDishAi(id: string, patch: Partial<Pick<Dish, 'aiTags' | 'aiEnabled'>>): Dish {
  const current = dishes.find((d) => d.id === id);
  if (!current) throw new BusinessError('Món ăn không tồn tại');
  const updated = { ...current, ...patch };
  dishes = dishes.map((d) => (d.id === id ? updated : d));
  return { ...updated };
}

function nextCode(): string {
  const max = dishes.reduce((m, d) => Math.max(m, Number(d.code.replace(/\D/g, '')) || 0), 0);
  return `MA${String(max + 1).padStart(3, '0')}`;
}

/** [BACKEND-TODO] GET /api/dishes?keyword=&categoryId=&status=&page= → Paged<Dish> */
export async function getDishes(filter: DishFilter): Promise<Paged<Dish>> {
  await delay(300);
  const items = dishes
    .filter((d) => (filter.categoryId ? d.categoryId === filter.categoryId : true))
    .filter((d) => (filter.status === 'all' ? true : d.status === filter.status))
    .filter((d) => !filter.keyword.trim() || matchesKeyword(d.name, filter.keyword) || matchesKeyword(d.code, filter.keyword))
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  return paginate(items, filter.page, DISH_PAGE_SIZE);
}

/** [BACKEND-TODO] GET /api/dishes/{id} */
export async function getDish(id: string): Promise<Dish> {
  await delay(220);
  const found = dishes.find((d) => d.id === id);
  if (!found) throw new BusinessError('Món ăn không tồn tại hoặc đã bị xóa');
  return { ...found };
}

function validateDish(input: DishInput, editingId: string | null): Record<string, string> {
  const errors: Record<string, string> = {};
  const name = collapseSpaces(input.name);
  if (!name) errors.name = 'Vui lòng nhập tên món';
  else if (name.length > 120) errors.name = 'Tên món tối đa 120 ký tự';

  const category = categories.find((c) => c.id === input.categoryId);
  if (!category) errors.categoryId = 'Vui lòng chọn danh mục món';
  else if (!category.active) errors.categoryId = 'Danh mục đang ngừng hoạt động, hãy chọn danh mục khác';

  if (!Number.isFinite(input.price) || input.price < 0) errors.price = 'Đơn giá phải là số không âm';
  else if (!Number.isInteger(input.price)) errors.price = 'Đơn giá tính theo VND, không có phần lẻ';
  else if (input.price > 100_000_000) errors.price = 'Đơn giá vượt quá giới hạn cho phép';

  if (input.description.length > DESCRIPTION_MAX) errors.description = `Mô tả tối đa ${DESCRIPTION_MAX} ký tự`;
  if (input.ingredients.length > 500) errors.ingredients = 'Thành phần tối đa 500 ký tự';

  if (!errors.name && !errors.categoryId) {
    const dup = dishes.find(
      (d) => d.id !== editingId && d.categoryId === input.categoryId && d.name.toLowerCase() === name.toLowerCase(),
    );
    if (dup) errors.name = `Đã có món "${dup.name}" (${dup.code}) trong danh mục này`;
  }
  return errors;
}

/** [BACKEND-TODO] POST /api/dishes (multipart nếu có ảnh) */
export async function createDish(input: DishInput): Promise<Dish> {
  await delay(500);
  const errors = validateDish(input, null);
  if (Object.keys(errors).length) throw new ValidationError(errors);
  const ts = new Date().toISOString();
  const dish: Dish = {
    id: uid('dish'),
    code: nextCode(),
    ...input,
    name: collapseSpaces(input.name),
    description: input.description.trim(),
    ingredients: input.ingredients.trim(),
    aiTags: [],
    aiEnabled: input.status === 'selling',
    usedInOrders: false,
    createdAt: ts,
    updatedAt: ts,
    statusUpdatedAt: ts,
  };
  dishes = [dish, ...dishes];
  logActivity('dish', 'Thêm món ăn', `Thêm món ${dish.name} (${formatCurrency(dish.price)})`);
  return { ...dish };
}

/** [BACKEND-TODO] PUT /api/dishes/{id} — giá của đơn hàng đã tạo không bị ảnh hưởng. */
export async function updateDish(id: string, input: DishInput): Promise<Dish> {
  await delay(480);
  const current = dishes.find((d) => d.id === id);
  if (!current) throw new BusinessError('Món ăn không tồn tại hoặc đã bị xóa');
  const errors = validateDish(input, id);
  if (Object.keys(errors).length) throw new ValidationError(errors);
  const ts = new Date().toISOString();
  const updated: Dish = {
    ...current,
    ...input,
    name: collapseSpaces(input.name),
    description: input.description.trim(),
    ingredients: input.ingredients.trim(),
    aiEnabled: input.status === 'stopped' ? false : current.aiEnabled,
    updatedAt: ts,
    statusUpdatedAt: current.status !== input.status ? ts : current.statusUpdatedAt,
  };
  dishes = dishes.map((d) => (d.id === id ? updated : d));
  const priceNote = current.price !== updated.price ? ` (giá ${formatCurrency(current.price)} → ${formatCurrency(updated.price)})` : '';
  logActivity('dish', 'Cập nhật món ăn', `${updated.code} ${updated.name}${priceNote}`);
  return { ...updated };
}

/** [BACKEND-TODO] PATCH /api/dishes/{id}/status { status } */
export async function setDishStatus(id: string, status: DishStatus): Promise<Dish> {
  await delay(280);
  const current = dishes.find((d) => d.id === id);
  if (!current) throw new BusinessError('Món ăn không tồn tại hoặc đã bị xóa');
  if (status === 'selling') {
    const cat = categories.find((c) => c.id === current.categoryId);
    if (cat && !cat.active) throw new BusinessError(`Danh mục "${cat.name}" đang ngừng hoạt động, hãy bật danh mục trước`);
  }
  const ts = new Date().toISOString();
  const updated: Dish = {
    ...current,
    status,
    aiEnabled: status === 'stopped' ? false : current.aiEnabled,
    updatedAt: ts,
    statusUpdatedAt: ts,
  };
  dishes = dishes.map((d) => (d.id === id ? updated : d));
  logActivity('dish', 'Đổi trạng thái món', `${current.name}: ${DISH_STATUS[current.status].label} → ${DISH_STATUS[status].label}`);
  return { ...updated };
}

/** [BACKEND-TODO] DELETE /api/dishes/{id} — máy chủ trả 409 nếu món đã phát sinh giao dịch. */
export async function deleteDish(id: string): Promise<void> {
  await delay(380);
  const current = dishes.find((d) => d.id === id);
  if (!current) throw new BusinessError('Món ăn không tồn tại hoặc đã bị xóa');
  if (current.usedInOrders)
    throw new BusinessError(
      'Món đã xuất hiện trong đơn hàng/hóa đơn nên không thể xóa. Hãy chuyển sang "Ngừng bán" để bảo toàn lịch sử giao dịch.',
    );
  dishes = dishes.filter((d) => d.id !== id);
  logActivity('dish', 'Xóa món ăn', `Xóa món ${current.code} ${current.name}`);
}

/* ------------------------------------------------------------ Danh mục */

/** [BACKEND-TODO] GET /api/dish-categories */
export async function getCategories(): Promise<(DishCategory & { dishCount: number })[]> {
  await delay(180);
  return [...categories]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((c) => ({ ...c, dishCount: dishes.filter((d) => d.categoryId === c.id).length }));
}

/** [BACKEND-TODO] POST /api/dish-categories | PUT /api/dish-categories/{id} */
export async function saveCategory(input: { id?: string; name: string; active: boolean }): Promise<DishCategory> {
  await delay(320);
  const name = collapseSpaces(input.name);
  if (!name) throw new ValidationError({ name: 'Vui lòng nhập tên danh mục' });
  if (name.length > 50) throw new ValidationError({ name: 'Tên danh mục tối đa 50 ký tự' });
  if (categories.some((c) => c.id !== input.id && c.name.toLowerCase() === name.toLowerCase()))
    throw new ValidationError({ name: 'Tên danh mục đã tồn tại' });
  if (input.id) {
    const current = categories.find((c) => c.id === input.id);
    if (!current) throw new BusinessError('Danh mục không tồn tại');
    const updated = { ...current, name, active: input.active };
    categories = categories.map((c) => (c.id === input.id ? updated : c));
    logActivity('dish', 'Cập nhật danh mục', `${name}${current.active !== input.active ? (input.active ? ' (bật)' : ' (tắt)') : ''}`);
    return { ...updated };
  }
  const created: DishCategory = {
    id: uid('cat'),
    name,
    active: input.active,
    sortOrder: Math.max(0, ...categories.map((c) => c.sortOrder)) + 1,
  };
  categories = [...categories, created];
  logActivity('dish', 'Thêm danh mục', name);
  return { ...created };
}
