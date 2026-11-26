import { api } from '@/lib/http';
import type { Area, AreaInput, CashierFloor, DiningTable, Floor, FloorInput, FloorLayoutInput, TableInput } from '@/types';

/* ------------------------------------------------------------ Tầng + sơ đồ (mục B7) */

export const getFloors = () => api.get<Floor[]>('/api/floors');

/** Sơ đồ trực tiếp (chỉ xem) cho Quản lý — cùng dữ liệu với sơ đồ thu ngân. */
export const getLiveFloor = () => api.get<CashierFloor>('/api/floors/live');

export const createFloor = (input: FloorInput) => api.post<Floor>('/api/floors', input);

export const updateFloor = (id: string, input: FloorInput) => api.put<Floor>(`/api/floors/${id}`, input);

export const deleteFloor = (id: string) => api.delete(`/api/floors/${id}`);

/** Lưu cả sơ đồ một tầng: tường, vùng khu, vị trí bàn. */
export const saveFloorLayout = (id: string, input: FloorLayoutInput) => api.put<Floor>(`/api/floors/${id}/layout`, input);

/* ------------------------------------------------------------ Khu vực */

export const getAreas = () => api.get<Area[]>('/api/areas');

export const createArea = (input: AreaInput) => api.post<Area>('/api/areas', input);

export const updateArea = (id: string, input: AreaInput) => api.put<Area>(`/api/areas/${id}`, input);

export const deleteArea = (id: string) => api.delete(`/api/areas/${id}`);

/* ------------------------------------------------------------ Bàn */

export const getTables = () => api.get<DiningTable[]>('/api/tables');

export const createTable = (input: TableInput) => api.post<DiningTable>('/api/tables', input);

export const updateTable = (id: string, input: TableInput) => api.put<DiningTable>(`/api/tables/${id}`, input);

export const deleteTable = (id: string) => api.delete(`/api/tables/${id}`);
