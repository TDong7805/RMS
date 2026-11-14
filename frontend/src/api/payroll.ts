import { api, http } from '@/lib/http';
import type {
  AttendanceInput,
  AttendanceList,
  AttendancePreview,
  AttendanceRow,
  PayrollEmployee,
  ImportResult,
  RecipeIngredientOption,
  PayrollDetail,
  PayrollPeriod,
  Payslip,
  RawAttendanceLine,
  Recipe,
  RecipeList,
  StockCheck,
} from '@/types';

const enc = encodeURIComponent;

/* ---------------------------------------------------------------- Thu ngân: chấm công (UC-TN-10, UC-TN-11) */

export function getEmployees(): Promise<PayrollEmployee[]> {
  return api.get<PayrollEmployee[]>('/api/thu-ngan/employees');
}

export function getAttendance(params: { userId?: string; from?: string; to?: string }): Promise<AttendanceList> {
  return api.get<AttendanceList>('/api/thu-ngan/attendance', params);
}

export function createAttendance(input: AttendanceInput): Promise<AttendanceRow> {
  return api.post<AttendanceRow>('/api/thu-ngan/attendance', input);
}

export function updateAttendance(id: string, input: AttendanceInput): Promise<AttendanceRow> {
  return api.put<AttendanceRow>(`/api/thu-ngan/attendance/${enc(id)}`, input);
}

export function deleteAttendance(id: string): Promise<void> {
  return api.delete(`/api/thu-ngan/attendance/${enc(id)}`);
}

export async function downloadAttendanceTemplate(): Promise<Blob> {
  return (await http.get<Blob>('/api/thu-ngan/attendance/template', { responseType: 'blob' })).data;
}

/** Đọc file, kiểm tra từng dòng (chưa lưu). */
export async function previewAttendanceFile(file: File): Promise<AttendancePreview> {
  const form = new FormData();
  form.append('file', file);
  return (await http.post<AttendancePreview>('/api/thu-ngan/attendance/preview', form, { timeout: 60_000 })).data;
}

export function importAttendance(fileName: string, duplicateMode: 'skip' | 'overwrite', lines: RawAttendanceLine[]): Promise<ImportResult> {
  return api.post<ImportResult>('/api/thu-ngan/attendance/import', { fileName, duplicateMode, lines });
}

export async function downloadAttendanceErrors(lines: RawAttendanceLine[]): Promise<Blob> {
  return (await http.post<Blob>('/api/thu-ngan/attendance/errors', { lines }, { responseType: 'blob' })).data;
}

/* ---------------------------------------------------------------- Thu ngân: bảng lương (UC-TN-12) */

export function getPayrollPeriods(): Promise<PayrollPeriod[]> {
  return api.get<PayrollPeriod[]>('/api/thu-ngan/payroll');
}

export function createPayrollPeriod(input: { name: string; startDate: string; endDate: string }): Promise<PayrollDetail> {
  return api.post<PayrollDetail>('/api/thu-ngan/payroll', input);
}

export function getPayroll(id: string): Promise<PayrollDetail> {
  return api.get<PayrollDetail>(`/api/thu-ngan/payroll/${enc(id)}`);
}

export function recalculatePayroll(id: string): Promise<PayrollDetail> {
  return api.post<PayrollDetail>(`/api/thu-ngan/payroll/${enc(id)}/recalculate`);
}

export function updatePayrollLine(id: string, userId: string, body: { allowance: number; deduction: number; note: string }): Promise<PayrollDetail> {
  return api.put<PayrollDetail>(`/api/thu-ngan/payroll/${enc(id)}/lines/${enc(userId)}`, body);
}

export function closePayroll(id: string): Promise<PayrollDetail> {
  return api.post<PayrollDetail>(`/api/thu-ngan/payroll/${enc(id)}/close`);
}

export function getPayslip(id: string, userId: string): Promise<Payslip> {
  return api.get<Payslip>(`/api/thu-ngan/payroll/${enc(id)}/lines/${enc(userId)}/payslip`);
}

/* ---------------------------------------------------------------- Bếp: công thức (UC-BEP-07), kiểm tra nguyên liệu (UC-BEP-06) */

export function getRecipes(): Promise<RecipeList> {
  return api.get<RecipeList>('/api/bep/recipes');
}

export function getRecipe(dishId: string): Promise<Recipe> {
  return api.get<Recipe>(`/api/bep/recipes/${enc(dishId)}`);
}

export function saveRecipe(dishId: string, lines: { ingredientId: string; qty: number }[]): Promise<Recipe> {
  return api.put<Recipe>(`/api/bep/recipes/${enc(dishId)}`, { lines });
}

export function getIngredientOptions(): Promise<RecipeIngredientOption[]> {
  return api.get<RecipeIngredientOption[]>('/api/bep/ingredient-options');
}

export function getStockCheck(): Promise<StockCheck> {
  return api.get<StockCheck>('/api/bep/stock-check');
}
