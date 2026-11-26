import { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { CalendarCheck, DoorOpen, Phone, Store, UserX, X } from 'lucide-react';
import { ConfirmDialog, Modal } from '@/components/common/Modal';
import { Button } from '@/components/common/Button';
import { Field, SelectInput, TextArea, TextInput } from '@/components/common/Form';
import {
  createCashierReservation,
  openTable,
  setCashierReservationStatus,
  updateCashierReservation,
  type CashierReservation,
  type CashierReservationInput,
} from '@/api/ordering';
import { ValidationError } from '@/lib/mock';
import { cn } from '@/lib/cn';
import type { CashierFloor } from '@/types';

const pad = (n: number) => String(n).padStart(2, '0');
const dateStr = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const todayStr = () => dateStr(new Date());
/** Thời điểm máy chủ (ISO, giờ UTC) → ngày theo giờ máy. */
export const localDate = (iso: string) => dateStr(new Date(iso));
const nextSlot = () => { const d = new Date(Date.now() + 30 * 60_000); return `${pad(d.getHours())}:${pad(Math.floor(d.getMinutes() / 15) * 15)}`; };

export const RES_STATUS: Record<CashierReservation['status'], { label: string; cls: string }> = {
  pending: { label: 'Chờ xác nhận', cls: 'bg-[var(--warning-soft)] text-[var(--warning)]' },
  confirmed: { label: 'Đã xác nhận', cls: 'bg-[#ede9fe] text-[#6d28d9]' },
  seated: { label: 'Đã đến', cls: 'bg-[var(--success-soft)] text-[var(--success)]' },
  completed: { label: 'Hoàn tất', cls: 'bg-[var(--bg-subtle)] text-[var(--text-muted)]' },
  cancelled: { label: 'Đã hủy', cls: 'bg-[var(--bg-subtle)] text-[var(--text-muted)]' },
  no_show: { label: 'Không đến', cls: 'bg-[var(--danger-soft)] text-[var(--danger)]' },
};

/**
 * Thêm / sửa lịch đặt ngay trên màn POS (B6): khách gọi điện hoặc đến quầy. Sửa: đổi giờ, số khách, khu, bàn, ghi chú;
 * Xác nhận (lịch website chờ xác nhận) · Khách đã đến – Mở bàn · Khách không đến · Hủy lịch.
 */
export function CashierReservationDialog({ floor, reservation, open, onClose }: {
  floor: CashierFloor;
  /** null = thêm mới. */
  reservation: CashierReservation | null;
  open: boolean;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const r = reservation;
  const [form, setForm] = useState<CashierReservationInput>(() => r ? {
    customerName: r.customerName, phone: r.phone, guests: r.guests, date: localDate(r.dateTime), time: new Date(r.dateTime).toTimeString().slice(0, 5),
    areaId: r.areaId, tableId: r.tableId ?? '', note: r.note,
  } : { customerName: '', phone: '', guests: 2, date: todayStr(), time: nextSlot(), areaId: floor.areas[0]?.id ?? '', tableId: '', note: '' });
  const [source, setSource] = useState<'phone' | 'walk_in'>('phone');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirmCancel, setConfirmCancel] = useState(false);
  const set = (patch: Partial<CashierReservationInput>) => { setForm((f) => ({ ...f, ...patch })); setErrors((e) => { const n = { ...e }; Object.keys(patch).forEach((k) => delete n[k]); return n; }); };

  const tableOptions = useMemo(
    () => floor.tables.filter((t) => t.areaId === form.areaId && t.status !== 'inactive')
      .sort((a, b) => a.code.localeCompare(b.code, 'vi', { numeric: true }))
      .map((t) => ({ value: t.id, label: `${t.code} · ${t.seats} ghế${form.guests && t.seats < form.guests ? ' (ít ghế)' : ''}` })),
    [floor.tables, form.areaId, form.guests],
  );
  const refresh = () => void qc.invalidateQueries({ queryKey: ['thu-ngan'] });
  const onErr = (e: unknown) => {
    if (e instanceof ValidationError) setErrors(e.fields);
    else toast.error(e instanceof Error ? e.message : 'Không lưu được');
  };

  const save = useMutation({
    mutationFn: () => (r ? updateCashierReservation(r.id, form) : createCashierReservation({ ...form, source })),
    onSuccess: (x) => { toast.success(r ? `Đã lưu lịch ${x.code}` : `Đã thêm lịch đặt ${x.code}`); refresh(); onClose(); },
    onError: onErr,
  });
  const status = useMutation({
    mutationFn: (s: 'confirmed' | 'cancelled' | 'no_show') => setCashierReservationStatus(r!.id, s),
    onSuccess: (_, s) => { toast.success(s === 'confirmed' ? 'Đã xác nhận lịch' : s === 'cancelled' ? 'Đã hủy lịch' : 'Đã đánh dấu khách không đến'); refresh(); onClose(); },
    onError: onErr,
  });
  const seat = useMutation({
    mutationFn: () => openTable(r!.tableId!, null, r!.id),
    onSuccess: () => { toast.success(`Đã mở bàn ${r!.tableCode} cho khách ${r!.customerName}`); refresh(); onClose(); },
    onError: onErr,
  });

  const active = !r || ['pending', 'confirmed'].includes(r.status);
  const isToday = r ? localDate(r.dateTime) === todayStr() : false;
  const late = r ? new Date(r.dateTime).getTime() < Date.now() : false;

  return (
    <Modal
      open={open}
      onOpenChange={(o) => !o && onClose()}
      size="md"
      title={r ? `Lịch đặt ${r.code}` : 'Thêm lịch đặt bàn'}
      description={r ? <span className="inline-flex items-center gap-2"><span className={cn('rounded-full px-2 py-0.5 text-[12px] font-semibold', RES_STATUS[r.status].cls)}>{RES_STATUS[r.status].label}</span>{r.source === 'website' ? 'Khách đặt qua website' : r.source === 'phone' ? 'Nhận qua điện thoại' : 'Khách đặt tại quầy'}</span> : 'Khách gọi điện hoặc đến quầy đặt trước — lịch được xác nhận luôn.'}
      footer={
        <div className="flex w-full flex-wrap items-center gap-2">
          {r && active ? (
            <>
              <Button variant="ghost" className="text-[var(--danger)]" leadingIcon={<X size={15} />} onClick={() => setConfirmCancel(true)}>Hủy lịch</Button>
              {r.status === 'confirmed' && late ? <Button variant="ghost" leadingIcon={<UserX size={15} />} loading={status.isPending && status.variables === 'no_show'} onClick={() => status.mutate('no_show')}>Khách không đến</Button> : null}
            </>
          ) : null}
          <span className="flex-1" />
          {r?.status === 'pending' ? <Button variant="outline" leadingIcon={<CalendarCheck size={15} />} loading={status.isPending && status.variables === 'confirmed'} onClick={() => status.mutate('confirmed')}>Xác nhận lịch</Button> : null}
          {r?.status === 'confirmed' && isToday && r.tableId ? <Button variant="outline" leadingIcon={<DoorOpen size={15} />} loading={seat.isPending} onClick={() => seat.mutate()}>Khách đã đến – Mở bàn {r.tableCode}</Button> : null}
          {active ? <Button loading={save.isPending} onClick={() => save.mutate()}>{r ? 'Lưu thay đổi' : 'Thêm lịch đặt'}</Button> : <Button variant="outline" onClick={onClose}>Đóng</Button>}
        </div>
      }
    >
      <fieldset disabled={!active} className="m-0 grid min-w-0 grid-cols-2 gap-3 border-0 p-0">
        {!r ? (
          <div className="col-span-2 grid grid-cols-2 gap-1 rounded-[10px] bg-[var(--bg-subtle)] p-1" role="radiogroup" aria-label="Khách đặt bằng cách nào">
            {([['phone', 'Khách gọi điện', Phone], ['walk_in', 'Khách đến quầy', Store]] as const).map(([v, l, Icon]) => (
              <button key={v} type="button" role="radio" aria-checked={source === v} onClick={() => setSource(v)} className={cn('inline-flex h-9 items-center justify-center gap-1.5 rounded-[8px] text-[13.5px] font-semibold', source === v ? 'bg-[var(--bg-surface)] text-[var(--accent)] shadow-sm' : 'text-[var(--text-secondary)]')}><Icon size={15} />{l}</button>
            ))}
          </div>
        ) : null}
        <Field label="Tên khách" required htmlFor="res-name" error={errors.customerName}>
          <TextInput id="res-name" value={form.customerName} invalid={Boolean(errors.customerName)} onChange={(e) => set({ customerName: e.target.value })} autoFocus={!r} />
        </Field>
        <Field label="Số điện thoại" required htmlFor="res-phone" error={errors.phone}>
          <TextInput id="res-phone" inputMode="tel" value={form.phone} invalid={Boolean(errors.phone)} onChange={(e) => set({ phone: e.target.value })} />
        </Field>
        <Field label="Ngày" required htmlFor="res-date" error={errors.date}>
          <TextInput id="res-date" type="date" value={form.date} invalid={Boolean(errors.date)} onChange={(e) => set({ date: e.target.value })} />
        </Field>
        <Field label="Giờ đến" required htmlFor="res-time" error={errors.time}>
          <TextInput id="res-time" type="time" step={900} value={form.time} invalid={Boolean(errors.time)} onChange={(e) => set({ time: e.target.value })} />
        </Field>
        <Field label="Số khách" required htmlFor="res-guests" error={errors.guests}>
          <TextInput id="res-guests" type="number" min={1} value={form.guests ?? ''} invalid={Boolean(errors.guests)} onChange={(e) => set({ guests: e.target.value ? Number(e.target.value) : null })} />
        </Field>
        <Field label="Khu vực" required htmlFor="res-area" error={errors.areaId}>
          <SelectInput id="res-area" value={form.areaId} invalid={Boolean(errors.areaId)} options={floor.areas.map((a) => ({ value: a.id, label: a.name }))} onChange={(e) => set({ areaId: e.target.value, tableId: '' })} />
        </Field>
        <Field label="Bàn" htmlFor="res-table" error={errors.tableId} hint="Không bắt buộc — xếp bàn sau cũng được" className="col-span-2">
          <SelectInput id="res-table" value={form.tableId} invalid={Boolean(errors.tableId)} placeholder="Chưa xếp bàn" options={tableOptions} onChange={(e) => set({ tableId: e.target.value })} />
        </Field>
        <Field label="Ghi chú" htmlFor="res-note" error={errors.note} className="col-span-2">
          <TextArea id="res-note" rows={2} maxLength={300} value={form.note} onChange={(e) => set({ note: e.target.value })} placeholder="Sinh nhật, ghế trẻ em, gần cửa sổ…" />
        </Field>
      </fieldset>
      <ConfirmDialog
        open={confirmCancel}
        onOpenChange={setConfirmCancel}
        title="Hủy lịch đặt này?"
        description={r ? `${r.customerName} · ${r.guests} khách · ${new Date(r.dateTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}` : ''}
        confirmLabel="Hủy lịch"
        cancelLabel="Đóng"
        tone="danger"
        loading={status.isPending}
        onConfirm={() => status.mutate('cancelled')}
      />
    </Modal>
  );
}
