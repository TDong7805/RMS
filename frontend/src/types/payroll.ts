/* Kiểu dữ liệu đợt 3: chấm công, bảng lương (Thu ngân) và công thức định lượng, kiểm tra nguyên liệu (Bếp). */

/* ---------------------------------------------------------------- Chấm công */

export interface PayrollEmployee {
  id: string;
  name: string;
  username: string;
  roleName: string;
  locked: boolean;
}

export interface AttendanceRow {
  id: string;
  userId: string;
  userName: string;
  username: string;
  roleName: string;
  /** yyyy-MM-dd */
  date: string;
  checkIn: string;
  checkOut: string | null;
  /** Ca qua đêm (ra sáng hôm sau). */
  overnight: boolean;
  hours: number;
  source: 'excel' | 'manual';
  note: string;
  missingOut: boolean;
  /** Thuộc kỳ lương đã chốt — không sửa / xóa được. */
  locked: boolean;
}

export interface AttendanceTotal {
  userId: string;
  userName: string;
  roleName: string;
  days: number;
  hours: number;
  missingOut: number;
}

export interface AttendanceList {
  items: AttendanceRow[];
  totals: AttendanceTotal[];
  totalHours: number;
  missingOutCount: number;
}

export interface AttendanceInput {
  userId: string;
  date: string;
  checkIn: string;
  checkOut: string;
  note: string;
}

export interface RawAttendanceLine {
  rowNo: number;
  user: string;
  date: string;
  checkIn: string;
  checkOut: string;
  note: string;
}

export interface PreviewLine extends RawAttendanceLine {
  userId: string | null;
  userName: string | null;
  workDate: string | null;
  hours: number;
  missingOut: boolean;
  status: 'valid' | 'duplicate' | 'error';
  error: string | null;
}

export interface AttendancePreview {
  fileName: string;
  lines: PreviewLine[];
  validCount: number;
  duplicateCount: number;
  errorCount: number;
}

export interface ImportResult {
  imported: number;
  overwritten: number;
  skipped: number;
  errors: number;
}

/* ---------------------------------------------------------------- Bảng lương */

export interface PayrollPeriod {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: 'draft' | 'closed';
  employeeCount: number;
  total: number;
  createdBy: string | null;
  createdAt: string;
  closedBy: string | null;
  closedAt: string | null;
}

export interface PayrollLine {
  userId: string;
  userName: string;
  username: string;
  roleName: string | null;
  hours: number;
  hourlyRate: number;
  baseSalary: number;
  allowance: number;
  deduction: number;
  total: number;
  note: string;
  missingOut: number;
}

export interface PayrollDetail {
  period: PayrollPeriod;
  lines: PayrollLine[];
  totalHours: number;
  totalAllowance: number;
  totalDeduction: number;
  total: number;
  missingOutCount: number;
}

export interface Payslip {
  period: PayrollPeriod;
  line: PayrollLine;
  days: AttendanceRow[];
  restaurant: { name: string; address: string; phone: string };
}

/* ---------------------------------------------------------------- Bếp: công thức, kiểm tra nguyên liệu */

export interface RecipeDishRow {
  id: string;
  name: string;
  categoryId: string;
  categoryName: string;
  status: 'selling' | 'stopped';
  price: number;
  ingredientCount: number;
  cost: number;
}

export interface RecipeList {
  categories: { id: string; name: string }[];
  dishes: RecipeDishRow[];
}

export interface RecipeLine {
  ingredientId: string;
  code: string;
  name: string;
  unit: string;
  qty: number;
  avgCost: number | null;
  lineCost: number;
  active: boolean;
}

export interface Recipe {
  dishId: string;
  name: string;
  categoryName: string;
  status: 'selling' | 'stopped';
  price: number;
  lines: RecipeLine[];
  cost: number;
}

export interface RecipeIngredientOption {
  id: string;
  code: string;
  name: string;
  unit: string;
  avgCost: number | null;
  stock: number;
}

export interface DishStock {
  id: string;
  name: string;
  categoryId: string;
  categoryName: string;
  selling: boolean;
  soldOut: boolean;
  hasRecipe: boolean;
  portions: number | null;
  limiting: string[];
}

export interface KitchenIngredientStock {
  id: string;
  code: string;
  name: string;
  unit: string;
  stock: number;
  minLevel: number;
  level: 'ok' | 'low' | 'out';
  dishes: string[];
}

export interface StockCheck {
  categories: { id: string; name: string }[];
  dishes: DishStock[];
  ingredients: KitchenIngredientStock[];
}
