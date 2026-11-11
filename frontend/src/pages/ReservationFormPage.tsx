import { useEffect, useState } from 'react';
import { CalendarDays, Clock3, Save, Users } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { Card, CardHeader } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { BlockError } from '@/components/common/EmptyState';
import { Field, SelectInput, TextArea, TextInput, ToggleRow } from '@/components/common/Form';
import { PageHeader } from '@/components/common/PageParts';
import { Skeleton } from '@/components/common/Skeleton';
import { updateReservationFormConfig } from '@/api/reservations';
import { qk, useAreas, useReservationForm } from '@/features/management/queries';
import { useApiMutation } from '@/hooks/use-api-mutation';
import { formatDateTime } from '@/lib/labels';
import type { ReservationFormConfig } from '@/types';

type FormState = Omit<ReservationFormConfig, 'updatedAt'>;
const NUMBER_FIELDS = ['durationMinutes', 'minGuests', 'maxGuests', 'leadTimeMinutes', 'maxDaysAhead'] as const;
type NumberField = (typeof NUMBER_FIELDS)[number];

export function ReservationFormPage() {
  const query = useReservationForm();
  const { data: areas = [] } = useAreas();
  const [form, setForm] = useState<FormState | null>(null);
  const [numbers, setNumbers] = useState<Record<NumberField, string>>({} as Record<NumberField, string>);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const load = (cfg: ReservationFormConfig) => {
    const { updatedAt, ...rest } = cfg;
    void updatedAt;
    setForm(rest);
    setNumbers(Object.fromEntries(NUMBER_FIELDS.map((k) => [k, String(cfg[k])])) as Record<NumberField, string>);
    setErrors({});
  };

  useEffect(() => {
    if (query.data && !form) load(query.data);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query.data]);

  const mutation = useApiMutation(updateReservationFormConfig, {
    invalidate: [qk.reservationForm],
    success: 'Đã cập nhật form đặt bàn. Khách hàng sẽ thấy thay đổi ở lần đặt tiếp theo.',
    onFieldErrors: setErrors,
    onSuccess: load,
  });

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
    setErrors((prev) => ({ ...prev, [key]: '' }));
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;
    const parsed = { ...form };
    const local: Record<string, string> = {};
    NUMBER_FIELDS.forEach((k) => {
      const n = Number(numbers[k]);
      if (numbers[k].trim() === '' || !Number.isInteger(n)) local[k] = 'Vui lòng nhập số nguyên';
      else parsed[k] = n;
    });
    if (Object.keys(local).length) {
      setErrors(local);
      return;
    }
    mutation.mutate(parsed);
  };

  const numberInput = (key: NumberField, label: string, hint: string, suffix: string) => (
    <Field label={label} htmlFor={`f-${key}`} required error={errors[key]} hint={hint}>
      <div className="relative">
        <TextInput
          id={`f-${key}`}
          type="number"
          value={numbers[key] ?? ''}
          invalid={Boolean(errors[key])}
          onChange={(e) => {
            setNumbers((prev) => ({ ...prev, [key]: e.target.value }));
            setErrors((prev) => ({ ...prev, [key]: '' }));
          }}
          className="pr-16"
        />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[12.5px] text-[var(--text-muted)]">
          {suffix}
        </span>
      </div>
    </Field>
  );

  return (
    <AppShell meta={{ label: 'Cập nhật form đặt bàn', parent: 'Quản lý đặt bàn' }}>
      <div className="min-w-0 space-y-4">
        <PageHeader
          title="Cập nhật form đặt bàn"
          description={
            query.data
              ? `Thiết lập quy định cho form đặt bàn khách hàng sử dụng. Cập nhật lần cuối ${formatDateTime(query.data.updatedAt)}.`
              : 'Thiết lập quy định cho form đặt bàn khách hàng sử dụng.'
          }
        />

        {query.isError ? (
          <BlockError onRetry={() => void query.refetch()} retrying={query.isFetching} />
        ) : !form ? (
          <Card padded>
            <div className="grid gap-4 sm:grid-cols-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-16" />
              ))}
            </div>
          </Card>
        ) : (
          <form onSubmit={submit} noValidate className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
            <div className="min-w-0 space-y-4">
              <Card padded>
                <CardHeader title="Khung giờ & thời lượng" icon={<Clock3 size={17} />} description="Giờ mở/đóng cửa lấy từ Cấu hình hệ thống › Giờ hoạt động." />
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <Field label="Bước chọn giờ" htmlFor="f-slot" required error={errors.slotMinutes} hint="Khoảng cách giữa các mốc giờ khách chọn">
                    <SelectInput
                      id="f-slot"
                      value={String(form.slotMinutes)}
                      onChange={(e) => set('slotMinutes', Number(e.target.value))}
                      options={[15, 30, 60].map((m) => ({ value: String(m), label: `${m} phút` }))}
                    />
                  </Field>
                  {numberInput('durationMinutes', 'Thời lượng mỗi lượt', 'Dùng để kiểm tra trùng lịch giữa các lượt đặt', 'phút')}
                  {numberInput('leadTimeMinutes', 'Đặt trước tối thiểu', 'Khách phải đặt trước giờ đến ít nhất', 'phút')}
                  {numberInput('maxDaysAhead', 'Đặt trước tối đa', 'Số ngày tối đa khách có thể đặt trước', 'ngày')}
                </div>
              </Card>

              <Card padded>
                <CardHeader title="Số khách" icon={<Users size={17} />} />
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  {numberInput('minGuests', 'Số khách tối thiểu', 'Mỗi lịch đặt', 'khách')}
                  {numberInput('maxGuests', 'Số khách tối đa', 'Nhóm lớn hơn cần gọi hotline', 'khách')}
                </div>
              </Card>

              <Card padded>
                <CardHeader title="Trường thông tin & xử lý" icon={<CalendarDays size={17} />} />
                <div className="mt-4 space-y-2.5">
                  <ToggleRow title="Bắt buộc nhập email" description="Dùng để gửi xác nhận đặt bàn qua email" checked={form.requireEmail} onChange={(v) => set('requireEmail', v)} />
                  <ToggleRow title="Cho phép khách chọn khu vực" description={`Hiện danh sách: ${areas.filter((a) => a.active).map((a) => a.name).join(', ')}`} checked={form.allowAreaChoice} onChange={(v) => set('allowAreaChoice', v)} />
                  <ToggleRow title="Cho phép ghi chú" description="Khách nhập yêu cầu đặc biệt (sinh nhật, ghế em bé, dị ứng…)" checked={form.allowNote} onChange={(v) => set('allowNote', v)} />
                  <ToggleRow title="Tự động xác nhận" description="Tắt: lịch mới ở trạng thái Chờ xác nhận để quản lý gọi lại cho khách" checked={form.autoConfirm} onChange={(v) => set('autoConfirm', v)} />
                </div>
                <Field label="Lưu ý hiển thị cho khách" htmlFor="f-notice" error={errors.notice} hint={`${form.notice.length}/500 ký tự`} className="mt-4">
                  <TextArea id="f-notice" rows={3} value={form.notice} maxLength={500} invalid={Boolean(errors.notice)} onChange={(e) => set('notice', e.target.value)} />
                </Field>
              </Card>

              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => query.data && load(query.data)} disabled={mutation.isPending}>
                  Hoàn tác
                </Button>
                <Button type="submit" loading={mutation.isPending} leadingIcon={<Save size={15} />}>
                  Lưu cấu hình
                </Button>
              </div>
            </div>

            <Card padded className="h-fit xl:sticky xl:top-[132px]">
              <p className="overline">Xem trước form của khách</p>
              <div className="mt-3 space-y-3 rounded-item border border-[var(--border)] bg-[var(--bg-subtle)] p-4">
                <p className="text-[15px] font-bold">Đặt bàn tại Green Lotus</p>
                <PreviewInput label="Họ tên *" />
                <PreviewInput label="Số điện thoại *" />
                {form.requireEmail ? <PreviewInput label="Email *" /> : null}
                <div className="grid grid-cols-2 gap-2">
                  <PreviewInput label="Ngày *" value={`trong ${numbers.maxDaysAhead || '?'} ngày`} />
                  <PreviewInput label="Giờ *" value={`mỗi ${form.slotMinutes} phút`} />
                </div>
                <PreviewInput label="Số khách *" value={`${numbers.minGuests || '?'} – ${numbers.maxGuests || '?'}`} />
                {form.allowAreaChoice ? <PreviewInput label="Khu vực" value="Tầng 1, Sân vườn…" /> : null}
                {form.allowNote ? <PreviewInput label="Ghi chú" tall /> : null}
                {form.notice ? (
                  <p className="rounded-[10px] bg-[var(--warning-soft)] px-3 py-2 text-[12px] leading-5 text-[var(--warning)]">{form.notice}</p>
                ) : null}
                <div className="rounded-control bg-[var(--accent)] py-2 text-center text-[13px] font-semibold text-[var(--accent-contrast)]">
                  {form.autoConfirm ? 'Đặt bàn ngay' : 'Gửi yêu cầu đặt bàn'}
                </div>
              </div>
            </Card>
          </form>
        )}
      </div>
    </AppShell>
  );
}

function PreviewInput({ label, value, tall }: { label: string; value?: string; tall?: boolean }) {
  return (
    <div>
      <p className="mb-1 text-[11.5px] font-semibold text-[var(--text-secondary)]">{label}</p>
      <div className={`rounded-[10px] border border-[var(--border-strong)] bg-[var(--bg-surface)] px-2.5 text-[12px] text-[var(--text-muted)] ${tall ? 'h-14 py-1.5' : 'flex h-8 items-center'}`}>
        {value ?? ''}
      </div>
    </div>
  );
}

export default ReservationFormPage;
