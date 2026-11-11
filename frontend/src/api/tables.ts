import { api } from '@/lib/http';
import type { Area, AreaInput, DiningTable, TableInput } from '@/types';

/** Kích thước lưới sơ đồ bàn — khớp TableService.FLOOR_COLS/FLOOR_ROWS ở backend. */
export const FLOOR_COLS = 8;
export const FLOOR_ROWS = 5;

/* ------------------------------------------------------------ Khu vực */

export const getAreas = () => api.get<Area[]>('/api/areas');

export const createArea = (input: AreaInput) => api.post<Area>('/api/areas', input);

export const updateArea = (id: string, input: AreaInput) => api.put<Area>(`/api/areas/${id}`, input);

export const deleteArea = (id: string) => api.delete(`/api/areas/${id}`);

/* ------------------------------------------------------------ Bàn */

export const getTables = () => api.get<DiningTable[]>('/api/tables');

export const createTable = (input: TableInput) => api.post<DiningTable>('/api/tables', input);

export const updateTable = (id: string, input: TableInput) => api.put<DiningTable>(`/api/tables/${id}`, input);

/** Kéo thả trên sơ đồ. */
export const moveTable = (id: string, x: number, y: number) =>
  api.patch<DiningTable>(`/api/tables/${id}/position`, { x, y });

export const deleteTable = (id: string) => api.delete(`/api/tables/${id}`);
