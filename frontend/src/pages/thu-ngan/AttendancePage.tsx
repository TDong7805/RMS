import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Camera, ClipboardCheck, FileSpreadsheet, Lock, Pencil, Plus, Trash2 } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { Card, CardHeader } from '@/components/common/Card';
import { Badge } from '@/components/common/Badge';
import { Button } from '@/components/common/Button';
import { BlockError, EmptyState } from '@/components/common/EmptyState';
import { Field, SelectInput, TextInput } from '@/components/common/Form';
import { ConfirmDialog, Modal } from '@/components/common/Modal';
import { DataTable, PageHeader, StatTile, TableSkeleton, Td, Th, Toolbar } from '@/components/common/PageParts';
import { createAttendance, deleteAttendance, getAttendance, getEmployees, updateAttendance } from '@/api/payroll';
import { attendancePhotoUrl } from '@/api/attendance-admin';
import { AttendanceImportDialog } from '@/features/payroll/AttendanceImportDialog';
import { todayKey } from '@/features/ordering/cashierParts';
import { ValidationError } from '@/lib/mock';
import type { AttendanceInput, AttendanceRow } from '@/types';

const monthStart = () => `${todayKey().slice(0, 8)}01`;
const dmy = (iso: string) => iso.split('-').reverse().join('/');
const hours = (v: number) => v.toLocaleString('vi-VN', { maximumFractionDigits: 2 });

function rangeError(from: string, to: string) {
  if (!from || !to) return 'Vui lòng chọn khoảng ngày';
  if (from > to) return 'Đến ngày phải sau Từ ngày';
  return (new Date(to).getTime() - new Date(from).getTime()) / 86_400_000 >= 62 ? 'Khoảng ngày tối đa 62 ngày' : '';
}

/** UC-TN-11 (+ UC-TN-10): xem chấm công, tổng giờ theo nhân viên; thêm / sửa / xóa tay; nhập từ Excel. */
export default function AttendancePage() {
  const qc = useQueryClient();
  const [userId, setUserId] = useState('');
  const [from, setFrom] = useState(monthStart());
  const [to, setTo] = useState(todayKey());
  const err = rangeError(from, to);
  const employees = useQuery({ queryKey: ['thu-ngan', 'employees'], queryFn: getEmployees, staleTime: 60_000 });
  const list = useQuery({
    queryKey: ['thu-ngan', 'attendance', userId, from, to],
    queryFn: () => getAttendance({ userId, from, to }),
    enabled: !err,
    placeholderData: (prev) => prev,
  });
  const [importOpen, setImportOpen] = useState(false);
  const [editing, setEditing] = useState<AttendanceRow | 'new' | null>(null);
  const [deleting, setDeleting] = useState<AttendanceRow | null>(null);
  const [photos, setPhotos] = useState<AttendanceRow | null>(null);
  const refresh = () => void qc.invalidateQueries({ queryKey: ['thu-ngan', 'attendance'] });

  const del = useMutation({
    mutationFn: (r: AttendanceRow) => deleteAttendance(r.id),
    onSuccess: () => {
      toast.success('Đã xóa dòng chấm công');
      setDeleting(null);
      refresh();
    },
    onError: (e) => {
      setDeleting(null);
      toast.error(e instanceof Error ? e.message : 'Không xóa được');
    },
  });

  const d = list.data;
  return (
    <AppShell meta={{ label: 'Chấm công', parent: 'Nhân sự' }}>
      <div className="min-w-0 space-y-4">
        <PageHeader
          title="Chấm công"
          description="Dữ liệu chấm công dùng tính lương: nhân viên tự chấm bằng khuôn mặt, nhập từ file Excel hoặc thêm tay (vd. sửa lượt quên tan ca). Ngày thuộc kỳ lương đã chốt không sửa được."
          actions={
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" leadingIcon={<Plus size={15} />} onClick={() => setEditing('new')}>Thêm chấm công</Button>
              <Button size="sm" leadingIcon={<FileSpreadsheet size={15} />} onClick={() => setImportOpen(true)}>Nhập từ Excel</Button>
            </div>
          }
        />
        <Card className="overflow-hidden">
          <Toolbar>
            <SelectInput
              aria-label="Lọc nhân viên"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              placeholder="Tất cả nhân viên"
              options={(employees.data ?? []).map((e) => ({ value: e.id, label: `${e.name} – ${e.roleName}${e.locked ? ' (đã khóa)' : ''}` }))}
              className="w-full sm:w-[280px]"
            />
            <div className="flex items-center gap-2">
              <TextInput type="date" aria-label="Từ ngày" value={from} max={to} onChange={(e) => setFrom(e.target.value)} invalid={Boolean(err)} className="w-[150px]" />
              <span className="text-[var(--text-muted)]">–</span>
              <TextInput type="date" aria-label="Đến ngày" value={to} min={from} onChange={(e) => setTo(e.target.value)} invalid={Boolean(err)} className="w-[150px]" />
            </div>
          </Toolbar>
          {err ? <p className="px-5 pb-2 text-[12.5px] text-[var(--danger)]">{err}</p> : null}
        </Card>

        {list.isError ? (
          <BlockError message={list.error instanceof Error ? list.error.message : undefined} onRetry={() => void list.refetch()} retrying={list.isFetching} />
        ) : err ? null : !d ? (
          <TableSkeleton cols={8} />
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              <StatTile label="Tổng giờ công" value={hours(d.totalHours)} tone="accent" hint={`${d.items.length} lượt chấm công`} />
              <StatTile label="Nhân viên có chấm công" value={d.totals.length} />
              <StatTile label="Thiếu giờ ra" value={d.missingOutCount} tone={d.missingOutCount ? 'warning' : 'default'} hint={d.missingOutCount ? 'Cần sửa trước khi chốt lương' : 'Không có'} />
            </div>
            <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
              <Card className="overflow-hidden">
                {d.items.length === 0 ? (
                  <div className="p-5"><EmptyState icon={ClipboardCheck} title="Chưa có chấm công trong khoảng ngày này" description="Nhập từ file Excel hoặc thêm tay." /></div>
                ) : (
                  <div className={list.isFetching ? 'opacity-60 transition-opacity' : ''}>
                    <DataTable minWidth={900}>
                      <thead>
                        <tr><Th>Nhân viên</Th><Th>Ngày</Th><Th>Giờ vào</Th><Th>Giờ ra</Th><Th className="text-right">Số giờ</Th><Th>Nguồn</Th><Th>Ghi chú</Th><Th /></tr>
                      </thead>
                      <tbody>
                        {d.items.map((r) => (
                          <tr key={r.id} className="hover:bg-[var(--bg-subtle)]">
                            <Td><p className="font-semibold">{r.userName}</p><p className="text-[12px] text-[var(--text-muted)]">{r.roleName}</p></Td>
                            <Td className="whitespace-nowrap font-mono text-[13px]">{dmy(r.date)}</Td>
                            <Td className="font-mono">
                              {r.checkIn}
                              {r.lateMinutes ? <span className="block font-sans text-[11.5px] font-semibold text-[var(--danger)]">Trễ {r.lateMinutes}′</span> : null}
                            </Td>
                            <Td className="font-mono">
                              {r.checkOut ? <>{r.checkOut}{r.overnight ? <span className="ml-1 text-[11px] text-[var(--text-muted)]">(+1 ngày)</span> : null}</> : <Badge variant="warning">Thiếu giờ ra</Badge>}
                              {r.earlyMinutes ? <span className="block font-sans text-[11.5px] font-semibold text-[var(--warning)]">Về sớm {r.earlyMinutes}′</span> : null}
                            </Td>
                            <Td className="text-right font-mono font-semibold">{hours(r.hours)}</Td>
                            <Td className="whitespace-nowrap">
                              <Badge variant={r.source === 'camera' ? 'accent' : r.source === 'excel' ? 'info' : 'neutral'}>{r.source === 'camera' ? 'Khuôn mặt' : r.source === 'excel' ? 'Excel' : 'Nhập tay'}</Badge>
                              {r.hasInPhoto || r.hasOutPhoto ? (
                                <button type="button" aria-label={`Xem ảnh chấm công ${r.userName} ${dmy(r.date)}`} title="Xem ảnh chấm công" onClick={() => setPhotos(r)} className="ml-1 inline-grid h-7 w-7 place-items-center rounded-lg align-middle text-[var(--accent)] hover:bg-[var(--accent-soft)]"><Camera size={15} /></button>
                              ) : null}
                            </Td>
                            <Td className="max-w-[200px] truncate text-[13px] text-[var(--text-secondary)]" title={r.note}>{r.note || '—'}</Td>
                            <Td className="whitespace-nowrap text-right">
                              {r.locked ? (
                                <span className="inline-flex items-center gap-1 text-[12px] text-[var(--text-muted)]" title="Thuộc kỳ lương đã chốt"><Lock size={13} />Đã chốt</span>
                              ) : (
                                <>
                                  <Button size="sm" variant="ghost" aria-label={`Sửa chấm công ${r.userName} ${dmy(r.date)}`} onClick={() => setEditing(r)}><Pencil size={15} /></Button>
                                  <Button size="sm" variant="ghost" aria-label={`Xóa chấm công ${r.userName} ${dmy(r.date)}`} onClick={() => setDeleting(r)}><Trash2 size={15} /></Button>
                                </>
                              )}
                            </Td>
                          </tr>
                        ))}
                      </tbody>
                    </DataTable>
                  </div>
                )}
              </Card>
              <Card padded className="h-fit">
                <CardHeader title="Tổng giờ theo nhân viên" description={`${dmy(from)} – ${dmy(to)}`} />
                {d.totals.length === 0 ? (
                  <p className="mt-3 text-[13.5px] text-[var(--text-muted)]">Không có dữ liệu.</p>
                ) : (
                  <ul className="mt-3 divide-y divide-[var(--border)] text-[13.5px]">
                    {d.totals.map((t) => (
                      <li key={t.userId} className="flex items-center justify-between gap-2 py-2">
                        <button type="button" className="min-w-0 text-left hover:text-[var(--accent)]" onClick={() => setUserId(t.userId)}>
                          <p className="truncate font-semibold">{t.userName}</p>
                          <p className="text-[12px] text-[var(--text-muted)]">{t.days} ngày{t.missingOut ? ` · ${t.missingOut} thiếu giờ ra` : ''}</p>
                        </button>
                        <b className="shrink-0 font-mono">{hours(t.hours)} giờ</b>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </div>
          </>
        )}
      </div>
      <AttendanceImportDialog open={importOpen} onClose={() => setImportOpen(false)} onImported={refresh} />
      <Modal open={photos !== null} onOpenChange={(o) => !o && setPhotos(null)} title={photos ? `Ảnh chấm công – ${photos.userName} · ${dmy(photos.date)}` : ''} description="Đối chiếu đúng người, đúng nơi làm việc. Độ lệch càng nhỏ càng giống khuôn mặt đã đăng ký.">
        {photos ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {(['in', 'out'] as const).map((k) => {
              const has = k === 'in' ? photos.hasInPhoto : photos.hasOutPhoto;
              const dist = k === 'in' ? photos.inDistance : photos.outDistance;
              return (
                <figure key={k} className="space-y-1">
                  <figcaption className="text-[13px] font-semibold">{k === 'in' ? `Vào ca ${photos.checkIn}` : `Tan ca ${photos.checkOut ?? '—'}`}{dist != null ? <span className="ml-1 font-normal text-[var(--text-muted)]">· độ lệch {dist.toFixed(2)}</span> : null}</figcaption>
                  {has ? <img src={attendancePhotoUrl(photos.id, k, 'cashier')} alt={k === 'in' ? 'Ảnh vào ca' : 'Ảnh tan ca'} className="w-full rounded-[12px] object-cover" /> : <p className="grid h-40 place-items-center rounded-[12px] bg-[var(--bg-subtle)] text-[13px] text-[var(--text-muted)]">Không có ảnh</p>}
                </figure>
              );
            })}
          </div>
        ) : null}
      </Modal>
      <AttendanceForm target={editing} employees={employees.data ?? []} onClose={() => setEditing(null)} onSaved={refresh} />
      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Xóa dòng chấm công?"
        description={deleting ? <>{deleting.userName} · {dmy(deleting.date)} · {deleting.checkIn}–{deleting.checkOut ?? '?'}</> : null}
        confirmLabel="Xóa"
        loading={del.isPending}
        onConfirm={() => deleting && del.mutate(deleting)}
      />
    </AppShell>
  );
}

function AttendanceForm({
  target,
  employees,
  onClose,
  onSaved,
}: {
  target: AttendanceRow | 'new' | null;
  employees: { id: string; name: string; roleName: string; locked: boolean }[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const empty: AttendanceInput = { userId: '', date: todayKey(), checkIn: '', checkOut: '', note: '' };
  const [form, setForm] = useState<AttendanceInput>(empty);
  const [errors, setErrors] = useState<Record<string, string>>({});
  useEffect(() => {
    setErrors({});
    if (target === 'new') setForm(empty);
    else if (target) setForm({ userId: target.userId, date: target.date, checkIn: target.checkIn, checkOut: target.checkOut ?? '', note: target.note });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);
  const m = useMutation({
    mutationFn: () => (target === 'new' ? createAttendance(form) : updateAttendance((target as AttendanceRow).id, form)),
    onSuccess: () => {
      toast.success(target === 'new' ? 'Đã thêm chấm công' : 'Đã lưu chấm công');
      onSaved();
      onClose();
    },
    onError: (e) => {
      if (e instanceof ValidationError) setErrors(e.fields);
      else {
        toast.error(e instanceof Error ? e.message : 'Không lưu được');
        onClose();
      }
    },
  });
  const set = (k: keyof AttendanceInput, v: string) => setForm((p) => ({ ...p, [k]: v }));
  return (
    <Modal
      open={Boolean(target)}
      onOpenChange={(o) => !o && onClose()}
      title={target === 'new' ? 'Thêm chấm công' : 'Sửa chấm công'}
      description="Giờ ra nhỏ hơn giờ vào được hiểu là ra sáng hôm sau (ca qua đêm). Để trống giờ ra nếu nhân viên quên chấm ra."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Hủy</Button>
          <Button loading={m.isPending} onClick={() => m.mutate()}>Lưu</Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nhân viên" required error={errors.userId} className="sm:col-span-2" htmlFor="att-user">
          <SelectInput
            id="att-user"
            value={form.userId}
            onChange={(e) => set('userId', e.target.value)}
            placeholder="Chọn nhân viên"
            options={employees.map((e) => ({ value: e.id, label: `${e.name} – ${e.roleName}${e.locked ? ' (đã khóa)' : ''}` }))}
            invalid={Boolean(errors.userId)}
          />
        </Field>
        <Field label="Ngày" required error={errors.date} className="sm:col-span-2" htmlFor="att-date">
          <TextInput id="att-date" type="date" max={todayKey()} value={form.date} onChange={(e) => set('date', e.target.value)} invalid={Boolean(errors.date)} />
        </Field>
        <Field label="Giờ vào" required error={errors.checkIn} htmlFor="att-in">
          <TextInput id="att-in" type="time" value={form.checkIn} onChange={(e) => set('checkIn', e.target.value)} invalid={Boolean(errors.checkIn)} />
        </Field>
        <Field label="Giờ ra" error={errors.checkOut} htmlFor="att-out">
          <TextInput id="att-out" type="time" value={form.checkOut} onChange={(e) => set('checkOut', e.target.value)} invalid={Boolean(errors.checkOut)} />
        </Field>
        <Field label="Ghi chú" required error={errors.note} hint="Lý do thêm / sửa tay (quên chấm, sai giờ…)" className="sm:col-span-2" htmlFor="att-note">
          <TextInput id="att-note" value={form.note} maxLength={200} onChange={(e) => set('note', e.target.value)} invalid={Boolean(errors.note)} />
        </Field>
      </div>
    </Modal>
  );
}
