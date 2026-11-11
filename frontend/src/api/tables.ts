import { FLOOR_COLS, FLOOR_ROWS, areaSeed, tableSeed } from '@/mocks/reservations';
import { BusinessError, ValidationError, collapseSpaces, delay, uid } from '@/lib/mock';
import { logActivity } from './audit';
import { hasUpcomingReservation } from './reservations';
import type { Area, AreaInput, DiningTable, TableInput } from '@/types';

let areas: Area[] = areaSeed.map((a) => ({ ...a }));
let tables: DiningTable[] = tableSeed.map((t) => ({ ...t }));

export { FLOOR_COLS, FLOOR_ROWS };

/** Đọc đồng bộ cho các API khác (kiểm tra sức chứa khi đặt bàn). */
export function tablesSnapshot(): DiningTable[] {
  return tables.map((t) => ({ ...t }));
}
export function areasSnapshot(): Area[] {
  return areas.map((a) => ({ ...a }));
}

/* ------------------------------------------------------------ Khu vực */

/** [BACKEND-TODO] GET /api/areas */
export async function getAreas(): Promise<Area[]> {
  await delay(180);
  return areasSnapshot();
}

function validateArea(input: AreaInput, editingId: string | null) {
  const name = collapseSpaces(input.name);
  const errors: Record<string, string> = {};
  if (!name) errors.name = 'Vui lòng nhập tên khu vực';
  else if (areas.some((a) => a.id !== editingId && a.name.toLowerCase() === name.toLowerCase()))
    errors.name = 'Tên khu vực đã tồn tại';
  if (input.description.length > 200) errors.description = 'Mô tả tối đa 200 ký tự';
  if (Object.keys(errors).length) throw new ValidationError(errors);
  return name;
}

/** [BACKEND-TODO] POST /api/areas */
export async function createArea(input: AreaInput): Promise<Area> {
  await delay(320);
  const name = validateArea(input, null);
  const area: Area = { id: uid('area'), name, description: input.description.trim(), active: input.active };
  areas = [...areas, area];
  logActivity('table', 'Thêm khu vực', `Thêm khu vực ${name}`);
  return { ...area };
}

/** [BACKEND-TODO] PUT /api/areas/{id} */
export async function updateArea(id: string, input: AreaInput): Promise<Area> {
  await delay(320);
  const name = validateArea(input, id);
  const area = areas.find((a) => a.id === id);
  if (!area) throw new BusinessError('Khu vực không tồn tại');
  const updated = { ...area, name, description: input.description.trim(), active: input.active };
  areas = areas.map((a) => (a.id === id ? updated : a));
  logActivity('table', 'Cập nhật khu vực', `Cập nhật khu vực ${name}`);
  return { ...updated };
}

/** [BACKEND-TODO] DELETE /api/areas/{id} */
export async function deleteArea(id: string): Promise<void> {
  await delay(320);
  const area = areas.find((a) => a.id === id);
  if (!area) throw new BusinessError('Khu vực không tồn tại');
  if (tables.some((t) => t.areaId === id))
    throw new BusinessError('Khu vực vẫn còn bàn. Hãy chuyển hoặc xóa các bàn trước khi xóa khu vực.');
  areas = areas.filter((a) => a.id !== id);
  logActivity('table', 'Xóa khu vực', `Xóa khu vực ${area.name}`);
}

/* ------------------------------------------------------------ Bàn */

/** [BACKEND-TODO] GET /api/tables */
export async function getTables(): Promise<DiningTable[]> {
  await delay(220);
  return tablesSnapshot();
}

function validateTable(input: TableInput, editingId: string | null): string {
  const code = input.code.trim().toUpperCase();
  const errors: Record<string, string> = {};
  if (!code) errors.code = 'Vui lòng nhập mã bàn';
  else if (!/^[A-Z0-9-]{2,10}$/.test(code)) errors.code = '2–10 ký tự: chữ, số hoặc dấu gạch';
  else if (tables.some((t) => t.id !== editingId && t.code === code)) errors.code = 'Mã bàn đã tồn tại';
  if (!areas.some((a) => a.id === input.areaId)) errors.areaId = 'Vui lòng chọn khu vực';
  if (!Number.isInteger(input.seats) || input.seats < 1 || input.seats > 20)
    errors.seats = 'Số ghế là số nguyên từ 1 đến 20';
  if (Object.keys(errors).length) throw new ValidationError(errors);
  return code;
}

function firstFreeCell(areaId: string, ignoreId: string | null): { x: number; y: number } | null {
  for (let y = 0; y < FLOOR_ROWS; y += 1) {
    for (let x = 0; x < FLOOR_COLS; x += 1) {
      if (!tables.some((t) => t.areaId === areaId && t.id !== ignoreId && t.x === x && t.y === y)) return { x, y };
    }
  }
  return null;
}

/** [BACKEND-TODO] POST /api/tables */
export async function createTable(input: TableInput): Promise<DiningTable> {
  await delay(320);
  const code = validateTable(input, null);
  const cell = firstFreeCell(input.areaId, null);
  if (!cell) throw new BusinessError('Sơ đồ khu vực này đã kín chỗ, không thể thêm bàn');
  const table: DiningTable = { id: uid('tbl'), ...input, code, ...cell };
  tables = [...tables, table];
  logActivity('table', 'Thêm bàn', `Thêm bàn ${code} (${input.seats} ghế)`);
  return { ...table };
}

/** [BACKEND-TODO] PUT /api/tables/{id} */
export async function updateTable(id: string, input: TableInput): Promise<DiningTable> {
  await delay(320);
  const code = validateTable(input, id);
  const current = tables.find((t) => t.id === id);
  if (!current) throw new BusinessError('Bàn không tồn tại');
  let pos = { x: current.x, y: current.y };
  if (current.areaId !== input.areaId) {
    if (hasUpcomingReservation(id))
      throw new BusinessError('Bàn đang có lịch đặt sắp tới, không thể chuyển sang khu vực khác');
    const cell = firstFreeCell(input.areaId, id);
    if (!cell) throw new BusinessError('Khu vực đích đã kín chỗ trên sơ đồ');
    pos = cell;
  }
  const updated: DiningTable = { ...current, ...input, code, ...pos };
  tables = tables.map((t) => (t.id === id ? updated : t));
  logActivity('table', 'Cập nhật bàn', `Cập nhật bàn ${code}`);
  return { ...updated };
}

/** [BACKEND-TODO] PATCH /api/tables/{id}/position { x, y } — kéo thả trên sơ đồ. */
export async function moveTable(id: string, x: number, y: number): Promise<DiningTable> {
  await delay(160);
  const current = tables.find((t) => t.id === id);
  if (!current) throw new BusinessError('Bàn không tồn tại');
  if (x < 0 || y < 0 || x >= FLOOR_COLS || y >= FLOOR_ROWS) throw new BusinessError('Vị trí nằm ngoài sơ đồ');
  if (tables.some((t) => t.id !== id && t.areaId === current.areaId && t.x === x && t.y === y))
    throw new BusinessError('Ô này đã có bàn khác');
  const updated = { ...current, x, y };
  tables = tables.map((t) => (t.id === id ? updated : t));
  logActivity('table', 'Cập nhật sơ đồ bàn', `Di chuyển bàn ${current.code}`);
  return { ...updated };
}

/** [BACKEND-TODO] DELETE /api/tables/{id} */
export async function deleteTable(id: string): Promise<void> {
  await delay(320);
  const current = tables.find((t) => t.id === id);
  if (!current) throw new BusinessError('Bàn không tồn tại');
  if (hasUpcomingReservation(id))
    throw new BusinessError('Bàn đang có lịch đặt sắp tới. Hãy chuyển lịch đặt sang bàn khác trước khi xóa.');
  tables = tables.filter((t) => t.id !== id);
  logActivity('table', 'Xóa bàn', `Xóa bàn ${current.code}`);
}
