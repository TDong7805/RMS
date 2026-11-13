import { api } from '@/lib/http';
import type {
  Ingredient,
  IngredientDetail,
  IngredientFilter,
  IngredientInput,
  IngredientOption,
  IngredientStatus,
  Paged,
  StockCardFilter,
  StockMove,
} from '@/types';

/** Trùng kích thước trang ở backend (IngredientService.PAGE_SIZE — quy ước chung 10 dòng / trang). */
export const WAREHOUSE_PAGE_SIZE = 10;

const path = (id: string) => `/api/kho/ingredients/${encodeURIComponent(id)}`;

/** UC-KHO-02: GET /api/kho/ingredients?keyword=&group=&status=&stock=&page= — sắp theo mã. */
export function getIngredients(f: IngredientFilter): Promise<Paged<Ingredient>> {
  return api.get<Paged<Ingredient>>('/api/kho/ingredients', { ...f });
}

/** UC-KHO-06: chi tiết kèm nhà cung cấp, món dùng nguyên liệu, phần đang chờ nhận. */
export function getIngredient(id: string): Promise<IngredientDetail> {
  return api.get<IngredientDetail>(path(id));
}

/** Danh sách gọn cho ô chọn nguyên liệu (sắp theo tên). */
export function getIngredientOptions(): Promise<IngredientOption[]> {
  return api.get<IngredientOption[]>('/api/kho/ingredients/options');
}

/** Thẻ kho: mới nhất trước, "Tồn sau" tính theo thứ tự ghi sổ. */
export function getStockCard(id: string, f: StockCardFilter): Promise<Paged<StockMove>> {
  return api.get<Paged<StockMove>>(`${path(id)}/moves`, { ...f });
}

/** UC-KHO-03: tồn ban đầu > 0 thì máy chủ lập phiếu nhập "Tồn đầu kỳ" (PN…). */
export function createIngredient(input: IngredientInput): Promise<Ingredient> {
  return api.post<Ingredient>('/api/kho/ingredients', input);
}

/** UC-KHO-04: đơn vị kho bị khóa khi nguyên liệu đã phát sinh dữ liệu. */
export function updateIngredient(id: string, input: IngredientInput): Promise<Ingredient> {
  return api.put<Ingredient>(path(id), input);
}

/** UC-KHO-05: ngừng sử dụng / sử dụng lại. */
export function setIngredientStatus(id: string, status: IngredientStatus): Promise<Ingredient> {
  return api.patch<Ingredient>(`${path(id)}/status`, { status });
}

/** UC-KHO-05: xóa hẳn — 409 nếu đã có sổ kho, phiếu mua, liên kết nhà cung cấp hoặc công thức món. */
export function deleteIngredient(id: string): Promise<void> {
  return api.delete(path(id));
}
