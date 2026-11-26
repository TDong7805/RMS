import { useEffect, useMemo, useState } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { CalendarRange, ChevronLeft, ChevronRight, Clock, Pencil, Plus, Trash2, UserPlus, X } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { Card } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { BlockError, EmptyState } from '@/components/common/EmptyState';
import { Field, SelectInput, TextArea, TextInput } from '@/components/common/Form';
import { ConfirmDialog, Modal } from '@/components/common/Modal';
import { DataTable, PageHeader, PageTabs, TableSkeleton, Td, Th } from '@/components/common/PageParts';
import { assignShift, createShift, deleteShift, setAssignmentArea, shiftHours, unassignShift, updateShift } from '@/api/shifts';
import { qk, useAreas, useAssignments, useEmployees, useShifts } from '@/features/management/queries';
import { useApiMutation } from '@/hooks/use-api-mutation';
import { cn } from '@/lib/cn';
import { ROLES, ROLE_KEYS, WEEKDAYS_SHORT } from '@/lib/labels';
import { formatDayMonth } from '@/lib/format';
import { fromDateKey, toDateKey } from '@/lib/mock';
import type { Employee, RoleKey, Shift, ShiftAssignment, ShiftInput } from '@/types';

type Tab = 'shifts' | 'schedule';
const COLORS = ['#0f7b5a', '#2563eb', '#d97706', '#7c3aed', '#db2777', '#0891b2', '#64748b'];

/** "06:00"–"14:30" → "6–14:30" (ghi trong ô lịch theo nhân viên). */
function shortHours(s: Shift): string {
  const t = (v: string) => {
    const [h, m] = v.slice(0, 5).split(':');
    return m === '00' ? String(Number(h)) : `${Number(h)}:${m}`;
  };
  return `${t(s.startTime)}–${t(s.endTime)}`;
}

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
  const [assign, setAssign] = useState<{ employeeId: string; date: string; shiftId?: string } | null>(null);
  // Mặc định xem theo ca (hàng = ca); "Theo nhân viên" là kiểu cũ (hàng = nhân viên). Nhớ lựa chọn trên máy.
  const [view, setView] = useState<'shift' | 'staff'>(() => (localStorage.getItem('rms-schedule-view') === 'staff' ? 'staff' : 'shift'));
  useEffect(() => localStorage.setItem('rms-schedule-view', view), [view]);
  const [areaEdit, setAreaEdit] = useState<{ id: string; label: string; areaId: string | null } | null>(null);
  const areas = useAreas().data ?? [];
  const areaName = (id: string | null) => (id ? areas.find((a) => a.id === id)?.name ?? null : null);

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

  const employeesQuery = useEmployees(from, to);
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
          <div className="flex rounded-[10px] bg-[var(--bg-subtle)] p-1" role="group" aria-label="Kiểu xem lịch">
            {([['shift', 'Theo ca'], ['staff', 'Theo nhân viên']] as const).map(([v, l]) => (
              <button key={v} type="button" aria-pressed={view === v} onClick={() => setView(v)} className={cn('h-8 rounded-[8px] px-3 text-[13px] font-semibold', view === v ? 'bg-[var(--bg-surface)] text-[var(--accent)] shadow-sm' : 'text-[var(--text-secondary)]')}>{l}</button>
            ))}
          </div>
          <SelectInput aria-label="Lọc theo vai trò" value={role} onChange={(e) => setRole(e.target.value as RoleKey | '')} placeholder="Tất cả bộ phận" options={ROLE_KEYS.map((r) => ({ value: r, label: ROLES[r].label }))} className="w-[190px]" />
          <Button size="sm" leadingIcon={<UserPlus size={15} />} onClick={() => setAssign({ employeeId: '', date: from < todayKey ? todayKey : from })}>
            Phân công
          </Button>
        </div>
        {view === 'staff' && shifts.length ? (
          <div className="flex w-full flex-wrap items-center gap-1.5 pt-1" aria-label="Chú thích ca">
            {[...shifts].sort((a, b) => a.startTime.localeCompare(b.startTime)).map((s) => (
              <span key={s.id} className="inline-flex items-center gap-1.5 rounded-pill border border-[var(--border)] px-2.5 py-0.5 text-[12px] text-[var(--text-secondary)]">
                <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: s.color }} />
                <span className="font-semibold text-[var(--text-primary)]">{s.name}</span>
                <span className="font-mono">{s.startTime}–{s.endTime}</span>
              </span>
            ))}
          </div>
        ) : null}
      </div>

      {employeesQuery.isError || assignmentsQuery.isError ? (
        <div className="p-5"><BlockError onRetry={() => { void employeesQuery.refetch(); void assignmentsQuery.refetch(); }} /></div>
      ) : loading ? (
        <TableSkeleton rows={6} cols={8} />
      ) : view === 'shift' ? (
        <div className={cn(assignmentsQuery.isFetching && 'opacity-60')}>
          <ShiftGrid
            days={days}
            shifts={shifts}
            assignments={assignmentsQuery.data ?? []}
            employees={employeesQuery.data ?? []}
            roleFilter={role}
            areaName={areaName}
            todayKey={todayKey}
            onAdd={(date, shiftId) => setAssign({ employeeId: '', date, shiftId })}
            onUnassign={(id) => unassignMutation.mutate(id)}
            onArea={(a, label) => setAreaEdit({ id: a.id, label, areaId: a.areaId })}
          />
        </div>
      ) : (
        <div className={cn(SCROLL_BOX, assignmentsQuery.isFetching && 'opacity-60')}>
          <table className="w-full min-w-[1040px] border-separate border-spacing-0 text-[13px]">
            <thead>
              <tr>
                <th className="sticky left-0 top-0 z-30 w-[200px] border-b border-r border-[var(--border)] bg-[var(--bg-subtle)] px-4 py-2.5 text-left text-[11.5px] font-semibold uppercase tracking-[0.05em] text-[var(--text-muted)]">Nhân viên</th>
                {days.map((d) => <DayHead key={toDateKey(d)} d={d} todayKey={todayKey} />)}
              </tr>
            </thead>
            <tbody>
              {employees.map((emp) => (
                <tr key={emp.id}>
                  <td className="sticky left-0 z-10 border-b border-r border-[var(--border)] bg-[var(--bg-surface)] px-4 py-2">
                    <p className="truncate font-semibold">{emp.fullName}</p>
                    <p className="text-[11.5px] text-[var(--text-muted)]">
                      {ROLES[emp.role].label}
                      {emp.status !== 'active' ? (
                        <span className="ml-1.5 rounded-full bg-[var(--bg-subtle)] px-1.5 py-px text-[10.5px] font-semibold text-[var(--text-secondary)]">
                          {emp.status === 'locked' ? 'Đã khóa' : 'Đã nghỉ'}
                        </span>
                      ) : null}
                    </p>
                  </td>
                  {days.map((d) => {
                    const key = toDateKey(d);
                    const past = key < todayKey;
                    const items = (assignmentsQuery.data ?? []).filter((a) => a.employeeId === emp.id && a.date === key);
                    return (
                      <td key={key} className={cn('group border-b border-l border-[var(--border)] px-1.5 py-1.5 align-top', past && 'bg-[var(--bg-subtle)]/50', key === todayKey && 'bg-[var(--accent-soft)]/40')}>
                        <div className="flex min-h-[44px] flex-col gap-1">
                          {items.map((a) => {
                            const s = shifts.find((x) => x.id === a.shiftId);
                            if (!s) return null;
                            const area = areaName(a.areaId);
                            const waiter = emp.role === 'waiter';
                            return (
                              <span key={a.id} className="group/chip flex items-center justify-between gap-1 rounded-[8px] px-2 py-1 text-[11.5px] font-semibold text-white" style={{ background: s.color, opacity: past ? 0.6 : 1 }} title={`${s.name} ${s.startTime}–${s.endTime}${area ? ' · ' + area : ''}`}>
                                {waiter && !past ? (
                                  <button type="button" className="min-w-0 truncate text-left hover:underline" title="Đổi khu vực phụ trách" onClick={() => setAreaEdit({ id: a.id, label: `${emp.fullName} – ${s.name} ${formatDayMonth(d)}`, areaId: a.areaId })}>
                                    {s.name} <span className="font-medium opacity-90">{shortHours(s)}</span>{area ? <span className="block truncate text-[10.5px] font-medium opacity-90">{area}</span> : <span className="block text-[10.5px] font-medium opacity-75">+ gán khu</span>}
                                  </button>
                                ) : (
                                  <span className="truncate">{s.name} <span className="font-medium opacity-90">{shortHours(s)}</span>{area ? <span className="block truncate text-[10.5px] font-medium opacity-90">{area}</span> : null}</span>
                                )}
                                {!past ? (
                                  <button type="button" aria-label={`Hủy ${s.name} của ${emp.fullName}`} onClick={() => unassignMutation.mutate(a.id)} className="hidden rounded-full hover:bg-white/25 group-hover/chip:block">
                                    <X size={12} />
                                  </button>
                                ) : null}
                              </span>
                            );
                          })}
                          {!past && emp.status === 'active' ? (
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
        </div>
      )}

      <AssignModal
        state={assign}
        days={days}
        employees={(employeesQuery.data ?? []).filter((e) => e.status === 'active')}
        shifts={shifts}
        areas={areas}
        onClose={() => setAssign(null)}
      />
      <AreaModal state={areaEdit} areas={areas} onClose={() => setAreaEdit(null)} />
    </Card>
  );
}

function AssignModal({
  state,
  days,
  employees,
  shifts,
  areas,
  onClose,
}: {
  state: { employeeId: string; date: string; shiftId?: string } | null;
  days: Date[];
  employees: Employee[];
  shifts: Shift[];
  areas: { id: string; name: string }[];
  onClose: () => void;
}) {
  const [employeeId, setEmployeeId] = useState('');
  const [shiftId, setShiftId] = useState('');
  const [areaId, setAreaId] = useState('');
  const isWaiter = employees.find((e) => e.id === employeeId)?.role === 'waiter';
  const [dates, setDates] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const todayKey = toDateKey(new Date());

  useEffect(() => {
    if (!state) return;
    setEmployeeId(state.employeeId);
    setShiftId(state.shiftId ?? '');
    setAreaId('');
    setDates(state.date ? [state.date] : []);
    setErrors({});
  }, [state]);

  const mutation = useApiMutation(() => assignShift(employeeId, shiftId, [...dates].sort(), isWaiter && areaId ? areaId : null), {
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
      description="Hệ thống chặn nếu nhân viên bị trùng giờ với ca khác (kể cả ca qua đêm của hôm trước)."
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
        {isWaiter ? (
          <Field label="Khu vực phụ trách" htmlFor="as-area" error={errors.areaId} hint="Yêu cầu hỗ trợ của khách ở khu này chỉ gửi cho phục vụ được gán; khu không ai gán thì mọi phục vụ trong ca đều thấy.">
            <SelectInput id="as-area" value={areaId} onChange={(e) => setAreaId(e.target.value)} placeholder="Không gán khu (thấy mọi khu)" options={areas.map((a) => ({ value: a.id, label: a.name }))} />
          </Field>
        ) : null}
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

/** Đổi khu vực phụ trách của nhân viên phục vụ trong một ca (hôm nay hoặc sau này). */
function AreaModal({ state, areas, onClose }: { state: { id: string; label: string; areaId: string | null } | null; areas: { id: string; name: string }[]; onClose: () => void }) {
  const [areaId, setAreaId] = useState('');
  useEffect(() => {
    if (state) setAreaId(state.areaId ?? '');
  }, [state]);
  const mutation = useApiMutation(() => setAssignmentArea(state!.id, areaId || null), {
    invalidate: [qk.assignments],
    success: 'Đã cập nhật khu vực phụ trách',
    onSuccess: onClose,
  });
  return (
    <Modal
      open={Boolean(state)}
      onOpenChange={(o) => !o && onClose()}
      size="sm"
      title="Khu vực phụ trách"
      description={state?.label}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Hủy</Button>
          <Button loading={mutation.isPending} onClick={() => mutation.mutate(undefined)}>Lưu</Button>
        </>
      }
    >
      <Field label="Khu vực" htmlFor="area-edit" hint="Nhân viên đang mở trang Phục vụ sẽ thấy khu mới ngay.">
        <SelectInput id="area-edit" value={areaId} onChange={(e) => setAreaId(e.target.value)} placeholder="Không gán khu (thấy mọi khu)" options={areas.map((a) => ({ value: a.id, label: a.name }))} />
      </Field>
    </Modal>
  );
}

/* =========================================================== Lịch theo ca (mặc định) */

const ROLE_ORDER: RoleKey[] = ['waiter', 'kitchen', 'cashier', 'warehouse', 'manager'];
const ROLE_SHORT: Record<RoleKey, string> = { waiter: 'Phục vụ', kitchen: 'Bếp', cashier: 'Thu ngân', warehouse: 'Kho', manager: 'Quản lý' };
/** Chữ viết tắt trên chip tóm tắt đầu ô. */
const ROLE_ABBR: Record<RoleKey, string> = { waiter: 'PV', kitchen: 'Bếp', cashier: 'TN', warehouse: 'Kho', manager: 'QL' };
const ROLE_DOT: Record<RoleKey, string> = { waiter: '#0f7b5a', kitchen: '#dc2626', cashier: '#2563eb', warehouse: '#a16207', manager: '#7c3aed' };
/** Bộ phận ca nào cũng phải có người; 0 người thì chip tóm tắt tô đỏ (chốt 26/11/2026). */
const MAIN_ROLES: RoleKey[] = ['waiter', 'kitchen', 'cashier'];
/** Ô có quá số người này thì hiện "+n", bấm mở danh sách đủ. */
const CELL_LIMIT = 4;

/** Vị trí dính khi cuộn: dòng tiêu đề ngày dính trên, cột đầu dính trái. Khung cuộn có chiều cao giới hạn để dính được. */
const SCROLL_BOX = 'max-h-[calc(100vh-340px)] min-h-[360px] overflow-auto';

type Person = { a: ShiftAssignment; e: Employee };

function DayHead({ d, todayKey, corner }: { d: Date; todayKey: string; corner?: boolean }) {
  const key = toDateKey(d);
  const today = key === todayKey;
  return (
    <th
      className={cn(
        'sticky top-0 z-10 border-b border-l border-[var(--border)] px-2 py-2 text-center',
        today ? 'bg-[var(--accent-soft)] text-[var(--accent)]' : 'bg-[var(--bg-subtle)] text-[var(--text-muted)]',
        corner && 'z-20',
      )}
    >
      <span className="block text-[11.5px] font-semibold uppercase">{today ? 'Hôm nay' : WEEKDAYS_SHORT[d.getDay()]}</span>
      <span className="block font-mono text-[12px]">{formatDayMonth(d)}</span>
    </th>
  );
}

/** Chip tóm tắt đầu ô: "PV 3 · Bếp 2 · TN 1"; bộ phận chính 0 người thì đỏ (chỉ với hôm nay / sau này). */
function SummaryChips({ people, past }: { people: Person[]; past: boolean }) {
  const count = (r: RoleKey) => people.filter((p) => p.e.role === r).length;
  const roles = ROLE_ORDER.filter((r) => MAIN_ROLES.includes(r) || count(r) > 0);
  return (
    <div className="flex flex-wrap gap-1">
      {roles.map((r) => {
        const n = count(r);
        const missing = n === 0 && !past;
        return (
          <span
            key={r}
            title={missing ? `Chưa có ai ở bộ phận ${ROLE_SHORT[r]}` : `${ROLE_SHORT[r]}: ${n} người`}
            className={cn(
              'inline-flex items-center rounded-[6px] px-1.5 py-px text-[10.5px] font-semibold tabular-nums',
              missing ? 'bg-[var(--danger-soft)] text-[var(--danger)]' : 'bg-[var(--bg-subtle)] text-[var(--text-secondary)]',
            )}
          >
            {ROLE_ABBR[r]} {n}
          </span>
        );
      })}
    </div>
  );
}

/** Người trong ô, chia theo bộ phận; mỗi bộ phận là một khung nhỏ có vạch màu bên trái. */
function PeopleGroups({ people, shift, d, past, areaName, onUnassign, onArea }: {
  people: Person[];
  shift: Shift;
  d: Date;
  past: boolean;
  areaName: (id: string | null) => string | null;
  onUnassign: (id: string) => void;
  onArea: (a: ShiftAssignment, label: string) => void;
}) {
  const groups = ROLE_ORDER.map((r) => ({ r, list: people.filter((x) => x.e.role === r) })).filter((g) => g.list.length);
  return (
    <div className="space-y-1">
      {groups.map(({ r, list }) => (
        <div key={r} className="rounded-[7px] border-l-[3px] bg-[var(--bg-subtle)] px-1.5 py-1" style={{ borderLeftColor: ROLE_DOT[r] }}>
          <ul className="space-y-0.5">
            {list.map(({ a, e }) => {
              const area = areaName(a.areaId);
              const short = e.fullName.split(' ').slice(-2).join(' ');
              return (
                <li key={a.id} className="group/name flex items-center gap-1 leading-tight">
                  {e.role === 'waiter' && !past ? (
                    <button type="button" title="Đổi khu vực phụ trách" onClick={() => onArea(a, `${e.fullName} – ${shift.name} ${formatDayMonth(d)}`)} className="min-w-0 truncate text-left hover:text-[var(--accent)] hover:underline">
                      {short}{area ? <span className="text-[11px] text-[var(--accent)]"> · {area}</span> : <span className="text-[11px] text-[var(--text-muted)]"> · chưa gán khu</span>}
                    </button>
                  ) : (
                    <span className="min-w-0 truncate" title={e.fullName}>{short}{area ? <span className="text-[11px] text-[var(--accent)]"> · {area}</span> : null}</span>
                  )}
                  {!past ? (
                    <button type="button" aria-label={`Hủy ${shift.name} của ${e.fullName}`} onClick={() => onUnassign(a.id)} className="ml-auto hidden shrink-0 rounded text-[var(--text-muted)] hover:text-[var(--danger)] group-hover/name:block">
                      <X size={12} />
                    </button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}

/**
 * Hàng = ca, cột = ngày (docs/thiet-ke/QUY_TAC_GIAO_DIEN.md, mục B9). Đường kẻ dọc giữa các ngày, cột hôm nay tô nền nhạt,
 * dòng ngày và cột tên ca dính khi cuộn. Mỗi ô: chip tóm tắt "PV 3 · Bếp 2 · TN 1" (thiếu bộ phận chính tô đỏ), người chia
 * theo bộ phận trong khung có vạch màu; quá 4 người thì "+n", bấm mở danh sách đủ.
 */
function ShiftGrid({
  days,
  shifts,
  assignments,
  employees,
  roleFilter,
  areaName,
  todayKey,
  onAdd,
  onUnassign,
  onArea,
}: {
  days: Date[];
  shifts: Shift[];
  assignments: ShiftAssignment[];
  employees: Employee[];
  roleFilter: RoleKey | '';
  areaName: (id: string | null) => string | null;
  todayKey: string;
  onAdd: (date: string, shiftId: string) => void;
  onUnassign: (id: string) => void;
  onArea: (a: ShiftAssignment, label: string) => void;
}) {
  const empById = new Map(employees.map((e) => [e.id, e]));
  const ordered = [...shifts].sort((a, b) => a.startTime.localeCompare(b.startTime));
  if (!ordered.length) return <p className="p-6 text-center text-[13.5px] text-[var(--text-muted)]">Chưa có ca làm việc nào — thêm ở tab Danh sách ca.</p>;
  return (
    <div className={SCROLL_BOX}>
      <table className="w-full min-w-[1040px] table-fixed border-separate border-spacing-0 text-[13px]">
        <thead>
          <tr>
            <th className="sticky left-0 top-0 z-30 w-[140px] border-b border-r border-[var(--border)] bg-[var(--bg-subtle)] px-3 py-2.5 text-left text-[11.5px] font-semibold uppercase tracking-[0.05em] text-[var(--text-muted)]">Ca</th>
            {days.map((d) => <DayHead key={toDateKey(d)} d={d} todayKey={todayKey} />)}
          </tr>
        </thead>
        <tbody>
          {ordered.map((s) => (
            <tr key={s.id}>
              <td className="sticky left-0 z-10 border-b border-r border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2 align-top">
                <span className="flex items-center gap-1.5 font-semibold"><span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: s.color }} />{s.name}</span>
                <span className="font-mono text-[12px] text-[var(--text-muted)]">{s.startTime}–{s.endTime}</span>
              </td>
              {days.map((d) => {
                const key = toDateKey(d);
                const past = key < todayKey;
                const all = assignments
                  .filter((a) => a.shiftId === s.id && a.date === key)
                  .map((a) => ({ a, e: empById.get(a.employeeId) }))
                  .filter((x): x is Person => Boolean(x.e));
                const people = all.filter((x) => !roleFilter || x.e.role === roleFilter);
                // Giữ thứ tự bộ phận khi cắt bớt để "+n" luôn là những người cuối danh sách.
                const sorted = ROLE_ORDER.flatMap((r) => people.filter((x) => x.e.role === r));
                const shown = sorted.length > CELL_LIMIT ? sorted.slice(0, CELL_LIMIT - 1) : sorted;
                const hidden = sorted.length - shown.length;
                const groupProps = { shift: s, d, past, areaName, onUnassign, onArea };
                return (
                  <td
                    key={key}
                    className={cn(
                      'group border-b border-l border-[var(--border)] px-1.5 py-1.5 align-top',
                      past && 'bg-[var(--bg-subtle)]/50',
                      key === todayKey && 'bg-[var(--accent-soft)]/40',
                    )}
                  >
                    <div className={cn('min-h-[64px] space-y-1.5', past && 'opacity-60')}>
                      <SummaryChips people={all} past={past} />
                      <PeopleGroups people={shown} {...groupProps} />
                      {hidden > 0 ? (
                        <Popover.Root>
                          <Popover.Trigger asChild>
                            <button type="button" className="w-full rounded-[7px] py-0.5 text-left text-[12px] font-semibold text-[var(--accent)] hover:bg-[var(--bg-subtle)]">
                              +{hidden} người
                            </button>
                          </Popover.Trigger>
                          <Popover.Portal>
                            <Popover.Content side="right" align="start" sideOffset={6} collisionPadding={12} className="z-[60] w-[240px] rounded-[12px] border border-[var(--border)] bg-[var(--bg-surface)] p-2.5 text-[13px] shadow-overlay">
                              <p className="mb-1.5 text-[12px] font-semibold text-[var(--text-secondary)]">{s.name} · {WEEKDAYS_SHORT[d.getDay()]} {formatDayMonth(d)} · {sorted.length} người</p>
                              <PeopleGroups people={sorted} {...groupProps} />
                            </Popover.Content>
                          </Popover.Portal>
                        </Popover.Root>
                      ) : null}
                      {!past ? (
                        <button
                          type="button"
                          aria-label={`Phân công ${s.name} ngày ${formatDayMonth(d)}`}
                          onClick={() => onAdd(key, s.id)}
                          className="grid h-6 w-full place-items-center rounded-[8px] border border-dashed border-[var(--border-strong)] text-[var(--text-muted)] opacity-0 transition-opacity hover:border-[var(--accent)] hover:text-[var(--accent)] focus:opacity-100 group-hover:opacity-100"
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
    </div>
  );
}

export default ShiftsPage;
