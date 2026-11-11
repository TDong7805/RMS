import { useEffect, useMemo, useState } from 'react';
import { CalendarRange, ChevronLeft, ChevronRight, Clock, Pencil, Plus, Trash2, UserPlus, X } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { Card } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { BlockError, EmptyState } from '@/components/common/EmptyState';
import { Field, SelectInput, TextArea, TextInput } from '@/components/common/Form';
import { ConfirmDialog, Modal } from '@/components/common/Modal';
import { DataTable, PageHeader, PageTabs, TableSkeleton, Td, Th } from '@/components/common/PageParts';
import { assignShift, createShift, deleteShift, shiftHours, unassignShift, updateShift } from '@/api/shifts';
import { qk, useAssignments, useEmployees, useShifts } from '@/features/management/queries';
import { useApiMutation } from '@/hooks/use-api-mutation';
import { cn } from '@/lib/cn';
import { ROLES, ROLE_KEYS, WEEKDAYS_SHORT } from '@/lib/labels';
import { formatDayMonth } from '@/lib/format';
import { fromDateKey, toDateKey } from '@/lib/mock';
import type { Employee, RoleKey, Shift, ShiftInput } from '@/types';

type Tab = 'shifts' | 'schedule';
const COLORS = ['#0f7b5a', '#2563eb', '#d97706', '#7c3aed', '#db2777', '#0891b2', '#64748b'];

function mondayOf(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
}

export function ShiftsPage() {
  const [tab, setTab] = useState<Tab>('schedule');
  return (
    <AppShell meta={{ label: 'Quản lý ca làm', parent: 'Quản lý nhân viên' }}>
      <div className="min-w-0 space-y-4">
        <PageHeader title="Quản lý ca làm việc" description="Thiết lập ca làm việc và phân công nhân viên theo tuần, hệ thống tự kiểm tra trùng lịch." />
        <PageTabs<Tab>
          ariaLabel="Chức năng ca làm việc"
          value={tab}
          onChange={setTab}
          items={[
            { value: 'schedule', label: 'Phân công ca', icon: <CalendarRange size={16} /> },
            { value: 'shifts', label: 'Danh sách ca', icon: <Clock size={16} /> },
          ]}
        />
        {tab === 'shifts' ? <ShiftList /> : <ScheduleBoard />}
      </div>
    </AppShell>
  );
}

/* =========================================================== Danh sách ca */

function ShiftList() {
  const query = useShifts();
  const [modal, setModal] = useState<{ open: boolean; shift: Shift | null }>({ open: false, shift: null });
  const [toDelete, setToDelete] = useState<(Shift & { assignmentCount: number }) | null>(null);

  const deleteMutation = useApiMutation((s: Shift) => deleteShift(s.id), {
    invalidate: [qk.shifts],
    success: 'Xóa thành công',
    onSuccess: () => setToDelete(null),
  });

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between gap-2 border-b border-[var(--border)] px-4 py-3 sm:px-5">
        <p className="text-[13px] text-[var(--text-muted)]">Ca qua đêm được hỗ trợ (giờ kết thúc nhỏ hơn giờ bắt đầu).</p>
        <Button size="sm" leadingIcon={<Plus size={15} />} onClick={() => setModal({ open: true, shift: null })}>Thêm ca</Button>
      </div>
      {query.isError ? (
        <div className="p-5"><BlockError onRetry={() => void query.refetch()} /></div>
      ) : query.isLoading || !query.data ? (
        <TableSkeleton rows={4} />
      ) : query.data.length === 0 ? (
        <div className="p-5"><EmptyState icon={Clock} title="Chưa có ca làm việc" description="Thêm ca đầu tiên để bắt đầu phân công." /></div>
      ) : (
        <DataTable minWidth={720}>
          <thead>
            <tr>
              <Th>Tên ca</Th>
              <Th>Khung giờ</Th>
              <Th className="text-right">Số giờ</Th>
              <Th>Ghi chú</Th>
              <Th className="text-right">Lượt phân công</Th>
              <Th className="text-right">Thao tác</Th>
            </tr>
          </thead>
          <tbody>
            {query.data.map((s) => (
              <tr key={s.id} className="hover:bg-[var(--bg-subtle)]">
                <Td>
                  <span className="inline-flex items-center gap-2 font-semibold">
                    <span className="h-3 w-3 rounded-full" style={{ background: s.color }} />
                    {s.name}
                  </span>
                </Td>
                <Td className="font-mono">{s.startTime} – {s.endTime}</Td>
                <Td className="text-right font-mono">{shiftHours(s).toString().replace('.', ',')}h</Td>
                <Td className="max-w-[280px] truncate text-[var(--text-secondary)]">{s.note || '—'}</Td>
                <Td className="text-right font-mono">{s.assignmentCount}</Td>
                <Td className="text-right">
                  <div className="inline-flex gap-0.5">
                    <Button size="sm" variant="ghost" aria-label={`Sửa ${s.name}`} onClick={() => setModal({ open: true, shift: s })}><Pencil size={14} /></Button>
                    <Button size="sm" variant="ghost" aria-label={`Xóa ${s.name}`} onClick={() => setToDelete(s)}><Trash2 size={14} /></Button>
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </DataTable>
      )}

      <ShiftModal state={modal} onClose={() => setModal({ open: false, shift: null })} />
      <ConfirmDialog
        open={Boolean(toDelete)}
        onOpenChange={(o) => !o && setToDelete(null)}
        title="Xóa ca làm việc?"
        description={
          toDelete && toDelete.assignmentCount > 0
            ? `“${toDelete.name}” đang có lượt phân công nên hệ thống sẽ không cho xóa. Hãy hủy các phân công trước.`
            : `Ca “${toDelete?.name}” sẽ bị xóa khỏi hệ thống.`
        }
        confirmLabel="Xóa"
        loading={deleteMutation.isPending}
        onConfirm={() => toDelete && deleteMutation.mutate(toDelete)}
      />
    </Card>
  );
}

function ShiftModal({ state, onClose }: { state: { open: boolean; shift: Shift | null }; onClose: () => void }) {
  const [form, setForm] = useState<ShiftInput>({ name: '', startTime: '08:00', endTime: '16:00', color: COLORS[0], note: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!state.open) return;
    const s = state.shift;
    setForm(s ? { name: s.name, startTime: s.startTime, endTime: s.endTime, color: s.color, note: s.note } : { name: '', startTime: '08:00', endTime: '16:00', color: COLORS[0], note: '' });
    setErrors({});
  }, [state]);

  const mutation = useApiMutation((input: ShiftInput) => (state.shift ? updateShift(state.shift.id, input) : createShift(input)), {
    invalidate: [qk.shifts, qk.assignments],
    success: state.shift ? 'Cập nhật ca làm việc thành công' : 'Thêm ca làm việc thành công',
    onFieldErrors: setErrors,
    onSuccess: onClose,
  });

  const set = <K extends keyof ShiftInput>(k: K, v: ShiftInput[K]) => {
    setForm((p) => ({ ...p, [k]: v }));
    setErrors((p) => ({ ...p, [k]: '' }));
  };

  return (
    <Modal
      open={state.open}
      onOpenChange={(o) => !o && onClose()}
      size="sm"
      title={state.shift ? `Sửa ${state.shift.name}` : 'Thêm ca làm việc'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Hủy</Button>
          <Button type="submit" form="shift-form" loading={mutation.isPending}>{state.shift ? 'Cập nhật' : 'Lưu'}</Button>
        </>
      }
    >
      <form
        id="shift-form"
        noValidate
        className="grid grid-cols-2 gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!form.name.trim()) return setErrors({ name: 'Vui lòng nhập tên ca' });
          mutation.mutate(form);
        }}
      >
        <Field label="Tên ca" htmlFor="s-name" required error={errors.name} className="col-span-2">
          <TextInput id="s-name" value={form.name} maxLength={40} invalid={Boolean(errors.name)} onChange={(e) => set('name', e.target.value)} placeholder="VD: Ca sáng" />
        </Field>
        <Field label="Giờ bắt đầu" htmlFor="s-start" required error={errors.startTime}>
          <TextInput id="s-start" type="time" value={form.startTime} invalid={Boolean(errors.startTime)} onChange={(e) => set('startTime', e.target.value)} />
        </Field>
        <Field label="Giờ kết thúc" htmlFor="s-end" required error={errors.endTime}>
          <TextInput id="s-end" type="time" value={form.endTime} invalid={Boolean(errors.endTime)} onChange={(e) => set('endTime', e.target.value)} />
        </Field>
        <Field label="Màu hiển thị" className="col-span-2">
          <div className="flex gap-2">
            {COLORS.map((c) => (
              <button key={c} type="button" aria-label={`Chọn màu ${c}`} aria-pressed={form.color === c} onClick={() => set('color', c)} className={cn('h-7 w-7 rounded-full ring-offset-2 ring-offset-[var(--bg-surface)]', form.color === c && 'ring-2 ring-[var(--text-primary)]')} style={{ background: c }} />
            ))}
          </div>
        </Field>
        <Field label="Ghi chú" htmlFor="s-note" className="col-span-2">
          <TextArea id="s-note" rows={2} maxLength={200} value={form.note} onChange={(e) => set('note', e.target.value)} />
        </Field>
      </form>
    </Modal>
  );
}

/* =========================================================== Phân công */

function ScheduleBoard() {
  const [weekStart, setWeekStart] = useState(() => mondayOf(new Date()));
  const [role, setRole] = useState<RoleKey | ''>('');
  const [assign, setAssign] = useState<{ employeeId: string; date: string } | null>(null);

  const days = useMemo(
    () =>
      Array.from({ length: 7 }).map((_, i) => {
        const d = new Date(weekStart);
        d.setDate(weekStart.getDate() + i);
        return d;
      }),
    [weekStart],
  );
  const from = toDateKey(days[0]);
  const to = toDateKey(days[6]);
  const todayKey = toDateKey(new Date());

  const employeesQuery = useEmployees();
  const shiftsQuery = useShifts();
  const assignmentsQuery = useAssignments(from, to);
  const shifts = shiftsQuery.data ?? [];
  const employees = (employeesQuery.data ?? []).filter((e) => !role || e.role === role);

  const unassignMutation = useApiMutation((id: string) => unassignShift(id), {
    invalidate: [qk.assignments, qk.shifts],
    success: 'Đã hủy phân công',
  });

  const moveWeek = (delta: number) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + delta * 7);
    setWeekStart(d);
  };

  const loading = employeesQuery.isLoading || shiftsQuery.isLoading || assignmentsQuery.isLoading;

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] px-4 py-3 sm:px-5">
        <div className="flex items-center gap-1.5">
          <Button size="icon" variant="outline" aria-label="Tuần trước" onClick={() => moveWeek(-1)} className="h-9 w-9"><ChevronLeft size={16} /></Button>
          <Button size="sm" variant="outline" onClick={() => setWeekStart(mondayOf(new Date()))}>Tuần này</Button>
          <Button size="icon" variant="outline" aria-label="Tuần sau" onClick={() => moveWeek(1)} className="h-9 w-9"><ChevronRight size={16} /></Button>
          <span className="ml-2 font-mono text-[13px] font-semibold">{formatDayMonth(days[0])} – {formatDayMonth(days[6])}/{days[6].getFullYear()}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SelectInput aria-label="Lọc theo vai trò" value={role} onChange={(e) => setRole(e.target.value as RoleKey | '')} placeholder="Tất cả bộ phận" options={ROLE_KEYS.filter((r) => r !== 'admin').map((r) => ({ value: r, label: ROLES[r].label }))} className="w-[190px]" />
          <Button size="sm" leadingIcon={<UserPlus size={15} />} onClick={() => setAssign({ employeeId: '', date: from < todayKey ? todayKey : from })}>
            Phân công
          </Button>
        </div>
      </div>

      {employeesQuery.isError || assignmentsQuery.isError ? (
        <div className="p-5"><BlockError onRetry={() => { void employeesQuery.refetch(); void assignmentsQuery.refetch(); }} /></div>
      ) : loading ? (
        <TableSkeleton rows={6} cols={8} />
      ) : (
        <div className={cn('overflow-x-auto', assignmentsQuery.isFetching && 'opacity-60')}>
          <table className="w-full min-w-[980px] border-collapse text-[13px]">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 w-[200px] border-b border-r border-[var(--border)] bg-[var(--bg-subtle)] px-4 py-2.5 text-left text-[11.5px] font-semibold uppercase tracking-[0.05em] text-[var(--text-muted)]">Nhân viên</th>
                {days.map((d) => {
                  const key = toDateKey(d);
                  return (
                    <th key={key} className={cn('border-b border-[var(--border)] px-2 py-2 text-center', key === todayKey ? 'bg-[var(--accent-soft)] text-[var(--accent)]' : 'bg-[var(--bg-subtle)] text-[var(--text-muted)]')}>
                      <span className="block text-[11.5px] font-semibold uppercase">{WEEKDAYS_SHORT[d.getDay()]}</span>
                      <span className="block font-mono text-[12px]">{formatDayMonth(d)}</span>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {employees.map((emp) => (
                <tr key={emp.id}>
                  <td className="sticky left-0 z-10 border-b border-r border-[var(--border)] bg-[var(--bg-surface)] px-4 py-2">
                    <p className="truncate font-semibold">{emp.fullName}</p>
                    <p className="text-[11.5px] text-[var(--text-muted)]">{ROLES[emp.role].label}</p>
                  </td>
                  {days.map((d) => {
                    const key = toDateKey(d);
                    const past = key < todayKey;
                    const items = (assignmentsQuery.data ?? []).filter((a) => a.employeeId === emp.id && a.date === key);
                    return (
                      <td key={key} className={cn('group border-b border-[var(--border)] px-1.5 py-1.5 align-top', past && 'bg-[var(--bg-subtle)]/60')}>
                        <div className="flex min-h-[44px] flex-col gap-1">
                          {items.map((a) => {
                            const s = shifts.find((x) => x.id === a.shiftId);
                            if (!s) return null;
                            return (
                              <span key={a.id} className="group/chip flex items-center justify-between gap-1 rounded-[8px] px-2 py-1 text-[11.5px] font-semibold text-white" style={{ background: s.color, opacity: past ? 0.6 : 1 }} title={`${s.name} ${s.startTime}–${s.endTime}`}>
                                <span className="truncate">{s.name}</span>
                                {!past ? (
                                  <button type="button" aria-label={`Hủy ${s.name} của ${emp.fullName}`} onClick={() => unassignMutation.mutate(a.id)} className="hidden rounded-full hover:bg-white/25 group-hover/chip:block">
                                    <X size={12} />
                                  </button>
                                ) : null}
                              </span>
                            );
                          })}
                          {!past ? (
                            <button
                              type="button"
                              aria-label={`Phân công ${emp.fullName} ngày ${formatDayMonth(d)}`}
                              onClick={() => setAssign({ employeeId: emp.id, date: key })}
                              className="grid h-6 place-items-center rounded-[8px] border border-dashed border-[var(--border-strong)] text-[var(--text-muted)] opacity-0 transition-opacity hover:border-[var(--accent)] hover:text-[var(--accent)] focus:opacity-100 group-hover:opacity-100"
                            >
                              <Plus size={12} />
                            </button>
                          ) : null}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex flex-wrap gap-3 px-4 py-3 sm:px-5">
            {shifts.map((s) => (
              <span key={s.id} className="inline-flex items-center gap-1.5 text-[12px] text-[var(--text-secondary)]">
                <span className="h-3 w-3 rounded-[4px]" style={{ background: s.color }} />
                {s.name} ({s.startTime}–{s.endTime})
              </span>
            ))}
          </div>
        </div>
      )}

      <AssignModal
        state={assign}
        days={days}
        employees={employeesQuery.data ?? []}
        shifts={shifts}
        onClose={() => setAssign(null)}
      />
    </Card>
  );
}

function AssignModal({
  state,
  days,
  employees,
  shifts,
  onClose,
}: {
  state: { employeeId: string; date: string } | null;
  days: Date[];
  employees: Employee[];
  shifts: Shift[];
  onClose: () => void;
}) {
  const [employeeId, setEmployeeId] = useState('');
  const [shiftId, setShiftId] = useState('');
  const [dates, setDates] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const todayKey = toDateKey(new Date());

  useEffect(() => {
    if (!state) return;
    setEmployeeId(state.employeeId);
    setShiftId('');
    setDates(state.date ? [state.date] : []);
    setErrors({});
  }, [state]);

  const mutation = useApiMutation(() => assignShift(employeeId, shiftId, [...dates].sort()), {
    invalidate: [qk.assignments, qk.shifts],
    success: 'Phân công ca làm việc thành công',
    onFieldErrors: setErrors,
    onSuccess: onClose,
  });

  const toggleDate = (key: string) => {
    setErrors((p) => ({ ...p, dates: '' }));
    setDates((prev) => (prev.includes(key) ? prev.filter((d) => d !== key) : [...prev, key]));
  };

  return (
    <Modal
      open={Boolean(state)}
      onOpenChange={(o) => !o && onClose()}
      size="md"
      title="Phân công ca làm việc"
      description="Hệ thống sẽ cảnh báo nếu nhân viên bị trùng lịch với ca khác trong cùng ngày."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Hủy</Button>
          <Button loading={mutation.isPending} onClick={() => mutation.mutate(undefined)}>Xác nhận phân công</Button>
        </>
      }
    >
      <div className="grid gap-4">
        <Field label="Nhân viên" htmlFor="as-emp" required error={errors.employeeId}>
          <SelectInput id="as-emp" value={employeeId} invalid={Boolean(errors.employeeId)} onChange={(e) => { setEmployeeId(e.target.value); setErrors({}); }} placeholder="— Chọn nhân viên —" options={employees.map((e) => ({ value: e.id, label: `${e.fullName} · ${ROLES[e.role].label}` }))} />
        </Field>
        <Field label="Ca làm việc" htmlFor="as-shift" required error={errors.shiftId}>
          <SelectInput id="as-shift" value={shiftId} invalid={Boolean(errors.shiftId)} onChange={(e) => { setShiftId(e.target.value); setErrors({}); }} placeholder="— Chọn ca —" options={shifts.map((s) => ({ value: s.id, label: `${s.name} (${s.startTime} – ${s.endTime})` }))} />
        </Field>
        <Field label="Ngày làm việc trong tuần" required error={errors.dates} hint="Có thể chọn nhiều ngày; ngày đã qua không thể phân công">
          <div className="grid grid-cols-7 gap-1.5">
            {days.map((d) => {
              const key = toDateKey(d);
              const past = key < todayKey;
              const selected = dates.includes(key);
              return (
                <button
                  key={key}
                  type="button"
                  disabled={past}
                  aria-pressed={selected}
                  onClick={() => toggleDate(key)}
                  className={cn(
                    'rounded-[10px] border px-1 py-2 text-center transition-colors disabled:cursor-not-allowed disabled:opacity-35',
                    selected ? 'border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-contrast)]' : 'border-[var(--border-strong)] hover:border-[var(--accent)]',
                  )}
                >
                  <span className="block text-[11px] font-semibold">{WEEKDAYS_SHORT[d.getDay()]}</span>
                  <span className="block font-mono text-[12px]">{formatDayMonth(fromDateKey(key))}</span>
                </button>
              );
            })}
          </div>
        </Field>
      </div>
    </Modal>
  );
}

export default ShiftsPage;
