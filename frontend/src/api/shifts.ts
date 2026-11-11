import { BusinessError, TIME_RE, ValidationError, collapseSpaces, delay, fromDateKey, timeToMinutes, toDateKey, uid } from '@/lib/mock';
import { formatDate } from '@/lib/format';
import { logActivity } from './audit';
import { getEmployees } from './accounts';
import type { Shift, ShiftAssignment, ShiftInput } from '@/types';

/** [FAKE-DATA] Ca làm việc mẫu. */
let shifts: Shift[] = [
  { id: 'sh-1', name: 'Ca sáng', startTime: '06:00', endTime: '14:00', color: '#0f7b5a', note: 'Chuẩn bị nguyên liệu, phục vụ bữa trưa' },
  { id: 'sh-2', name: 'Ca chiều', startTime: '14:00', endTime: '22:00', color: '#2563eb', note: 'Phục vụ bữa tối' },
  { id: 'sh-3', name: 'Ca gãy', startTime: '10:00', endTime: '14:00', color: '#d97706', note: 'Tăng cường giờ cao điểm trưa' },
  { id: 'sh-4', name: 'Ca tối', startTime: '17:00', endTime: '23:00', color: '#7c3aed', note: 'Cao điểm tối & dọn dẹp cuối ngày' },
];

function seedAssignments(): ShiftAssignment[] {
  const result: ShiftAssignment[] = [];
  const base = new Date();
  base.setDate(base.getDate() - ((base.getDay() + 6) % 7)); // Thứ hai tuần này
  const plan: [string, string[]][] = [
    ['usr-03', ['sh-1']],
    ['usr-04', ['sh-2']],
    ['usr-05', ['sh-1']],
    ['usr-06', ['sh-2']],
    ['usr-07', ['sh-4']],
    ['usr-08', ['sh-1']],
    ['usr-09', ['sh-3', 'sh-4']],
    ['usr-10', ['sh-2']],
    ['usr-11', ['sh-1']],
    ['usr-13', ['sh-4']],
    ['usr-14', ['sh-3']],
  ];
  for (let d = -7; d < 14; d += 1) {
    const date = new Date(base);
    date.setDate(base.getDate() + d);
    plan.forEach(([employeeId, ids], i) => {
      if ((d + i) % 7 === 6) return; // mỗi người nghỉ 1 ngày/tuần
      ids.forEach((shiftId) => result.push({ id: `as-${result.length + 1}`, shiftId, employeeId, date: toDateKey(date) }));
    });
  }
  return result;
}

let assignments: ShiftAssignment[] = seedAssignments();

/** Khoảng phút trong ngày; ca qua đêm (kết thúc ≤ bắt đầu) được cộng 24h. */
function range(s: Pick<Shift, 'startTime' | 'endTime'>): [number, number] {
  const start = timeToMinutes(s.startTime);
  let end = timeToMinutes(s.endTime);
  if (end <= start) end += 1440;
  return [start, end];
}

export function shiftHours(s: Pick<Shift, 'startTime' | 'endTime'>): number {
  const [a, b] = range(s);
  return (b - a) / 60;
}

function overlap(a: Shift, b: Shift): boolean {
  const [as, ae] = range(a);
  const [bs, be] = range(b);
  return as < be && bs < ae;
}

function validateShift(input: ShiftInput, editingId: string | null) {
  const errors: Record<string, string> = {};
  const name = collapseSpaces(input.name);
  if (!name) errors.name = 'Vui lòng nhập tên ca';
  else if (name.length > 40) errors.name = 'Tên ca tối đa 40 ký tự';
  if (!TIME_RE.test(input.startTime)) errors.startTime = 'Giờ bắt đầu không đúng định dạng HH:mm';
  if (!TIME_RE.test(input.endTime)) errors.endTime = 'Giờ kết thúc không đúng định dạng HH:mm';
  else if (!errors.startTime && input.startTime === input.endTime) errors.endTime = 'Giờ kết thúc phải khác giờ bắt đầu';
  if (Object.keys(errors).length) throw new ValidationError(errors);

  const dupName = shifts.find((s) => s.id !== editingId && s.name.toLowerCase() === name.toLowerCase());
  const dupTime = shifts.find((s) => s.id !== editingId && s.startTime === input.startTime && s.endTime === input.endTime);
  if (dupName || dupTime) {
    throw new ValidationError(
      {
        ...(dupName ? { name: `Trùng tên với ca "${dupName.name}"` } : {}),
        ...(dupTime ? { startTime: `Trùng khung giờ với ca "${dupTime.name}"` } : {}),
      },
      'Dữ liệu bị trùng lặp',
    );
  }
  return name;
}

/** [BACKEND-TODO] GET /api/shifts — kèm số lượt phân công để hiển thị. */
export async function getShifts(): Promise<(Shift & { assignmentCount: number })[]> {
  await delay(240);
  return [...shifts]
    .sort((a, b) => a.startTime.localeCompare(b.startTime))
    .map((s) => ({ ...s, assignmentCount: assignments.filter((a) => a.shiftId === s.id).length }));
}

/** [BACKEND-TODO] POST /api/shifts */
export async function createShift(input: ShiftInput): Promise<Shift> {
  await delay(380);
  const name = validateShift(input, null);
  const shift: Shift = { id: uid('sh'), ...input, name, note: input.note.trim() };
  shifts = [...shifts, shift];
  logActivity('shift', 'Thêm ca làm việc', `Thêm ${name} (${input.startTime} – ${input.endTime})`);
  return { ...shift };
}

/** [BACKEND-TODO] PUT /api/shifts/{id} */
export async function updateShift(id: string, input: ShiftInput): Promise<Shift> {
  await delay(380);
  const current = shifts.find((s) => s.id === id);
  if (!current) throw new BusinessError('Ca làm việc không tồn tại');
  const name = validateShift(input, id);
  const updated: Shift = { ...current, ...input, name, note: input.note.trim() };

  // Đổi giờ không được làm phát sinh trùng lịch với phân công hiện có.
  if (current.startTime !== input.startTime || current.endTime !== input.endTime) {
    const mine = assignments.filter((a) => a.shiftId === id);
    for (const a of mine) {
      const clash = assignments.find((b) => {
        if (b.id === a.id || b.employeeId !== a.employeeId || b.date !== a.date) return false;
        const other = shifts.find((s) => s.id === b.shiftId);
        return other ? overlap(updated, other) : false;
      });
      if (clash) {
        const other = shifts.find((s) => s.id === clash.shiftId)!;
        throw new ValidationError(
          { startTime: `Giờ mới trùng với "${other.name}" của nhân viên đã được phân công ngày ${formatDate(fromDateKey(a.date))}` },
          'Trùng lịch làm việc',
        );
      }
    }
  }
  shifts = shifts.map((s) => (s.id === id ? updated : s));
  logActivity('shift', 'Sửa ca làm việc', `${name} (${input.startTime} – ${input.endTime})`);
  return { ...updated };
}

/** [BACKEND-TODO] DELETE /api/shifts/{id} */
export async function deleteShift(id: string): Promise<void> {
  await delay(320);
  const current = shifts.find((s) => s.id === id);
  if (!current) throw new BusinessError('Ca làm việc không tồn tại');
  if (assignments.some((a) => a.shiftId === id))
    throw new BusinessError('Không thể xóa ca làm việc này vì đã có nhân viên được phân công hoặc đã có lịch sử làm việc.');
  shifts = shifts.filter((s) => s.id !== id);
  logActivity('shift', 'Xóa ca làm việc', `Xóa ${current.name}`);
}

/* ------------------------------------------------------------ Phân công */

/** [BACKEND-TODO] GET /api/shift-assignments?from=&to= */
export async function getAssignments(from: string, to: string): Promise<ShiftAssignment[]> {
  await delay(260);
  return assignments.filter((a) => a.date >= from && a.date <= to).map((a) => ({ ...a }));
}

/**
 * [BACKEND-TODO] POST /api/shift-assignments { employeeId, shiftId, dates[] }
 * Kiểm tra trùng lịch: nhân viên không được có hai ca chồng giờ trong cùng ngày.
 */
export async function assignShift(employeeId: string, shiftId: string, dates: string[]): Promise<ShiftAssignment[]> {
  await delay(420);
  const errors: Record<string, string> = {};
  const employees = await getEmployees();
  const employee = employees.find((e) => e.id === employeeId);
  const shift = shifts.find((s) => s.id === shiftId);
  if (!employee) errors.employeeId = 'Vui lòng chọn nhân viên';
  if (!shift) errors.shiftId = 'Vui lòng chọn ca làm việc';
  if (dates.length === 0) errors.dates = 'Chọn ít nhất một ngày';
  if (Object.keys(errors).length) throw new ValidationError(errors);

  const todayKey = toDateKey(new Date());
  if (dates.some((d) => d < todayKey)) throw new ValidationError({ dates: 'Không thể phân công cho ngày đã qua' });

  for (const date of dates) {
    const same = assignments.filter((a) => a.employeeId === employeeId && a.date === date);
    if (same.some((a) => a.shiftId === shiftId))
      throw new ValidationError({ dates: `${employee!.fullName} đã có ${shift!.name} ngày ${formatDate(fromDateKey(date))}` }, 'Trùng lịch làm việc');
    const clash = same.find((a) => {
      const other = shifts.find((s) => s.id === a.shiftId);
      return other ? overlap(shift!, other) : false;
    });
    if (clash) {
      const other = shifts.find((s) => s.id === clash.shiftId)!;
      throw new ValidationError(
        { dates: `Trùng lịch làm việc: ngày ${formatDate(fromDateKey(date))} ${employee!.fullName} đã có "${other.name}" (${other.startTime}–${other.endTime})` },
        'Trùng lịch làm việc',
      );
    }
  }

  const created = dates.map((date) => ({ id: uid('as'), employeeId, shiftId, date }));
  assignments = [...assignments, ...created];
  logActivity(
    'shift',
    'Phân công ca',
    `Phân công ${employee!.fullName} vào ${shift!.name} (${dates.length} ngày: ${dates.map((d) => formatDate(fromDateKey(d)).slice(0, 5)).join(', ')})`,
  );
  return created;
}

/** [BACKEND-TODO] DELETE /api/shift-assignments/{id} */
export async function unassignShift(id: string): Promise<void> {
  await delay(260);
  const current = assignments.find((a) => a.id === id);
  if (!current) throw new BusinessError('Phân công không tồn tại');
  if (current.date < toDateKey(new Date()))
    throw new BusinessError('Không thể hủy phân công của ngày đã qua (đã thuộc lịch sử làm việc)');
  assignments = assignments.filter((a) => a.id !== id);
  const shift = shifts.find((s) => s.id === current.shiftId);
  logActivity('shift', 'Hủy phân công', `Hủy ${shift?.name ?? 'ca'} ngày ${formatDate(fromDateKey(current.date))}`);
}
