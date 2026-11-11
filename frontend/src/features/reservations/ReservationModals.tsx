import { useEffect, useMemo, useState } from 'react';
import { CalendarClock, Pencil, Phone, Users } from 'lucide-react';
import { Badge } from '@/components/common/Badge';
import { Button } from '@/components/common/Button';
import { Field, SelectInput, TextArea, TextInput } from '@/components/common/Form';
import { Modal } from '@/components/common/Modal';
import { DetailRow } from '@/components/common/PageParts';
import { Skeleton } from '@/components/common/Skeleton';
import { allowedNextStatuses, setReservationStatus, updateReservation } from '@/api/reservations';
import { qk, useAreas, useOpeningHours, useReservationForm, useTables } from '@/features/management/queries';
import { useApiMutation } from '@/hooks/use-api-mutation';
import { RESERVATION_SOURCE, RESERVATION_STATUS, WEEKDAYS, formatDateTime } from '@/lib/labels';
import { fromDateKey, minutesToTime, timeToMinutes, toDateKey } from '@/lib/mock';
import type { Reservation, ReservationInput, ReservationStatus } from '@/types';

const STATUS_ACTION: Partial<Record<ReservationStatus, { label: string; variant: 'primary' | 'outline' | 'danger' }>> = {
  confirmed: { label: 'Xác nhận lịch', variant: 'primary' },
  seated: { label: 'Khách đã đến', variant: 'primary' },
  completed: { label: 'Hoàn tất', variant: 'outline' },
  no_show: { label: 'Khách không đến', variant: 'outline' },
  cancelled: { label: 'Hủy lịch', variant: 'danger' },
};

const EDITABLE: ReservationStatus[] = ['pending', 'confirmed', 'seated'];

/* =========================================================== Chi tiết */

export interface ReservationDetailModalProps {
  reservation: Reservation | null;
  loading?: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (reservation: Reservation) => void;
}

export function ReservationDetailModal({ reservation, loading, open, onOpenChange, onEdit }: ReservationDetailModalProps) {
  const { data: areas = [] } = useAreas();
  const { data: tables = [] } = useTables();
  const statusMutation = useApiMutation(
    (v: { id: string; status: ReservationStatus }) => setReservationStatus(v.id, v.status),
    {
      invalidate: [qk.reservations],
      success: (r) => `Đã chuyển ${r.code} sang "${RESERVATION_STATUS[r.status].label}"`,
    },
  );

  const r = reservation;
  const area = r ? areas.find((a) => a.id === r.areaId) : undefined;
  const table = r?.tableId ? tables.find((t) => t.id === r.tableId) : undefined;
  const next = r ? allowedNextStatuses(r.status) : [];

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      size="md"
      title={r ? `Chi tiết đặt bàn ${r.code}` : 'Chi tiết đặt bàn'}
      description={r ? `Tạo lúc ${formatDateTime(r.createdAt)} · nguồn ${RESERVATION_SOURCE[r.source]}` : undefined}
      footer={
        r ? (
          <>
            <div className="mr-auto flex flex-wrap gap-2">
              {next.map((s) => {
                const action = STATUS_ACTION[s];
                if (!action) return null;
                return (
                  <Button
                    key={s}
                    size="sm"
                    variant={action.variant}
                    loading={statusMutation.isPending && statusMutation.variables?.status === s}
                    onClick={() => statusMutation.mutate({ id: r.id, status: s })}
                  >
                    {action.label}
                  </Button>
                );
              })}
            </div>
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Thoát
            </Button>
            {EDITABLE.includes(r.status) ? (
              <Button leadingIcon={<Pencil size={15} />} onClick={() => onEdit(r)}>
                Chỉnh sửa
              </Button>
            ) : null}
          </>
        ) : undefined
      }
    >
      {loading || !r ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-4 w-full rounded-full" />
          ))}
        </div>
      ) : (
        <>
          <div className="mb-3 grid grid-cols-3 gap-2">
            <InfoChip icon={<CalendarClock size={15} />} label="Thời gian" value={formatDateTime(r.dateTime)} />
            <InfoChip icon={<Users size={15} />} label="Số khách" value={`${r.guests} người`} />
            <InfoChip icon={<Phone size={15} />} label="Điện thoại" value={r.phone} />
          </div>
          <dl>
            <DetailRow label="Trạng thái">
              <Badge variant={RESERVATION_STATUS[r.status].variant}>{RESERVATION_STATUS[r.status].label}</Badge>
            </DetailRow>
            <DetailRow label="Khách hàng">{r.customerName}</DetailRow>
            <DetailRow label="Khu vực">{area?.name ?? '—'}</DetailRow>
            <DetailRow label="Bàn">
              {table ? `${table.code} (${table.seats} ghế)` : <span className="text-[var(--text-muted)]">Chưa xếp bàn</span>}
            </DetailRow>
            <DetailRow label="Ghi chú">{r.note || <span className="text-[var(--text-muted)]">Không có</span>}</DetailRow>
            <DetailRow label="Cập nhật lần cuối">{formatDateTime(r.updatedAt)}</DetailRow>
          </dl>
          {!EDITABLE.includes(r.status) ? (
            <p className="mt-3 rounded-[10px] bg-[var(--bg-subtle)] px-3 py-2 text-[12.5px] text-[var(--text-muted)]">
              Lịch đặt đã kết thúc hoặc đã hủy nên không thể chỉnh sửa.
            </p>
          ) : null}
        </>
      )}
    </Modal>
  );
}

function InfoChip({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-item bg-[var(--bg-subtle)] px-3 py-2.5">
      <p className="flex items-center gap-1.5 text-[11.5px] font-medium text-[var(--text-muted)]">
        {icon}
        {label}
      </p>
      <p className="mt-0.5 truncate font-mono text-[13px] font-semibold text-[var(--text-primary)]">{value}</p>
    </div>
  );
}

/* =========================================================== Chỉnh sửa */

export interface ReservationEditModalProps {
  reservation: Reservation | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (reservation: Reservation) => void;
}

function toInput(r: Reservation): ReservationInput {
  const d = new Date(r.dateTime);
  return {
    customerName: r.customerName,
    phone: r.phone,
    guests: r.guests,
    date: toDateKey(d),
    time: minutesToTime(d.getHours() * 60 + d.getMinutes()),
    areaId: r.areaId,
    tableId: r.tableId,
    note: r.note,
  };
}

export function ReservationEditModal({ reservation, open, onOpenChange, onSaved }: ReservationEditModalProps) {
  const [form, setForm] = useState<ReservationInput | null>(null);
  const [guestsText, setGuestsText] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { data: areas = [] } = useAreas();
  const { data: tables = [] } = useTables();
  const { data: hours = [] } = useOpeningHours();
  const { data: config } = useReservationForm();

  useEffect(() => {
    if (open && reservation) {
      const input = toInput(reservation);
      setForm(input);
      setGuestsText(String(input.guests));
      setErrors({});
    }
  }, [open, reservation]);

  const mutation = useApiMutation(
    (v: { id: string; input: ReservationInput }) => updateReservation(v.id, v.input),
    {
      invalidate: [qk.reservations],
      success: (r) => `Đã lưu thay đổi cho lịch đặt ${r.code}`,
      onFieldErrors: setErrors,
      onSuccess: (r) => onSaved(r),
    },
  );

  const timeOptions = useMemo(() => {
    if (!form?.date) return [];
    const day = hours.find((h) => h.day === fromDateKey(form.date).getDay());
    const step = config?.slotMinutes ?? 30;
    const duration = config?.durationMinutes ?? 120;
    const list: string[] = [];
    if (day?.open) {
      for (let m = timeToMinutes(day.openTime); m <= timeToMinutes(day.closeTime) - duration; m += step) {
        list.push(minutesToTime(m));
      }
    }
    if (form.time && !list.includes(form.time)) list.push(form.time);
    return list.sort();
  }, [form?.date, form?.time, hours, config]);

  const dayInfo = form?.date ? hours.find((h) => h.day === fromDateKey(form.date).getDay()) : undefined;
  const areaTables = tables.filter((t) => t.areaId === form?.areaId);

  if (!form || !reservation) return null;

  const set = <K extends keyof ReservationInput>(key: K, value: ReservationInput[K]) => {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
    setErrors((prev) => {
      if (!prev[key as string]) return prev;
      const next = { ...prev };
      delete next[key as string];
      return next;
    });
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const guests = Number(guestsText);
    const local: Record<string, string> = {};
    if (!form.customerName.trim()) local.customerName = 'Vui lòng nhập tên khách hàng';
    if (!form.phone.trim()) local.phone = 'Vui lòng nhập số điện thoại';
    if (!guestsText.trim() || !Number.isInteger(guests) || guests <= 0) local.guests = 'Số khách phải là số nguyên dương';
    if (Object.keys(local).length) {
      setErrors(local);
      return;
    }
    mutation.mutate({ id: reservation.id, input: { ...form, guests } });
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      title={`Chỉnh sửa đặt bàn ${reservation.code}`}
      description="Thay đổi thời gian, số khách hoặc bàn sẽ được kiểm tra sức chứa và trùng lịch."
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
            Thoát
          </Button>
          <Button type="submit" form="reservation-edit-form" loading={mutation.isPending}>
            Lưu thay đổi
          </Button>
        </>
      }
    >
      <form id="reservation-edit-form" onSubmit={submit} noValidate className="grid gap-4 sm:grid-cols-2">
        <Field label="Tên khách hàng" htmlFor="r-name" required error={errors.customerName}>
          <TextInput
            id="r-name"
            value={form.customerName}
            invalid={Boolean(errors.customerName)}
            onChange={(e) => set('customerName', e.target.value)}
            maxLength={80}
          />
        </Field>
        <Field label="Số điện thoại" htmlFor="r-phone" required error={errors.phone}>
          <TextInput
            id="r-phone"
            inputMode="tel"
            value={form.phone}
            invalid={Boolean(errors.phone)}
            onChange={(e) => set('phone', e.target.value)}
            placeholder="0912345678"
          />
        </Field>
        <Field label="Ngày đặt" htmlFor="r-date" required error={errors.date} hint={dayInfo ? (dayInfo.open ? `${WEEKDAYS[dayInfo.day]}: mở cửa ${dayInfo.openTime}–${dayInfo.closeTime}` : `${WEEKDAYS[dayInfo.day]}: nhà hàng nghỉ`) : undefined}>
          <TextInput
            id="r-date"
            type="date"
            value={form.date}
            min={toDateKey(new Date())}
            invalid={Boolean(errors.date)}
            onChange={(e) => set('date', e.target.value)}
          />
        </Field>
        <Field label="Giờ đặt" htmlFor="r-time" required error={errors.time} hint={config ? `Mỗi lượt ${config.durationMinutes} phút` : undefined}>
          <SelectInput
            id="r-time"
            value={form.time}
            invalid={Boolean(errors.time)}
            onChange={(e) => set('time', e.target.value)}
            options={timeOptions.map((t) => ({ value: t, label: t }))}
            placeholder={timeOptions.length ? undefined : 'Không có khung giờ'}
          />
        </Field>
        <Field label="Số khách" htmlFor="r-guests" required error={errors.guests} hint={config ? `Tối đa ${config.maxGuests} khách / lịch` : undefined}>
          <TextInput
            id="r-guests"
            type="number"
            min={1}
            step={1}
            value={guestsText}
            invalid={Boolean(errors.guests)}
            onChange={(e) => {
              setGuestsText(e.target.value);
              set('guests', Number(e.target.value));
            }}
          />
        </Field>
        <Field label="Khu vực" htmlFor="r-area" required error={errors.areaId}>
          <SelectInput
            id="r-area"
            value={form.areaId}
            invalid={Boolean(errors.areaId)}
            onChange={(e) => {
              set('areaId', e.target.value);
              set('tableId', null);
            }}
            options={areas.map((a) => ({ value: a.id, label: a.active ? a.name : `${a.name} (tạm ngưng)`, disabled: !a.active }))}
          />
        </Field>
        <Field label="Bàn" htmlFor="r-table" error={errors.tableId} hint="Để trống nếu chưa xếp bàn cụ thể" className="sm:col-span-2">
          <SelectInput
            id="r-table"
            value={form.tableId ?? ''}
            invalid={Boolean(errors.tableId)}
            onChange={(e) => set('tableId', e.target.value || null)}
            placeholder="— Chưa xếp bàn —"
            options={areaTables.map((t) => ({
              value: t.id,
              label: `${t.code} · ${t.seats} ghế${t.status === 'inactive' ? ' · ngưng sử dụng' : ''}`,
              disabled: t.status === 'inactive',
            }))}
          />
        </Field>
        <Field label="Ghi chú" htmlFor="r-note" error={errors.note} hint={`${form.note.length}/300 ký tự`} className="sm:col-span-2">
          <TextArea
            id="r-note"
            value={form.note}
            invalid={Boolean(errors.note)}
            maxLength={300}
            onChange={(e) => set('note', e.target.value)}
            placeholder="Yêu cầu đặc biệt của khách…"
          />
        </Field>
      </form>
    </Modal>
  );
}
