import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Building2, Clock, DatabaseBackup, Download, HardDriveDownload, RotateCcw, Save, ScrollText, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { AppShell } from '@/components/layout/AppShell';
import { Card, CardHeader } from '@/components/common/Card';
import { Badge } from '@/components/common/Badge';
import { Button } from '@/components/common/Button';
import { BlockError, EmptyState } from '@/components/common/EmptyState';
import { Field, ImageUpload, SelectInput, TextInput, Toggle, ToggleRow } from '@/components/common/Form';
import { ConfirmDialog } from '@/components/common/Modal';
import { DataTable, PageHeader, PageTabs, TableSkeleton, Td, Th } from '@/components/common/PageParts';
import { Skeleton } from '@/components/common/Skeleton';
import {
  createBackup,
  deleteBackup,
  downloadBackup,
  restoreBackup,
  updateBackupSchedule,
  updateOpeningHours,
  updateRestaurantInfo,
} from '@/api/settings';
import { qk, useBackups, useOpeningHours, useRestaurantInfo } from '@/features/management/queries';
import { useApiMutation } from '@/hooks/use-api-mutation';
import { cn } from '@/lib/cn';
import { formatNumber } from '@/lib/format';
import { WEEKDAYS, formatDateTime } from '@/lib/labels';
import { downloadBlob } from '@/lib/mock';
import type { BackupFile, BackupFrequency, BackupSchedule, OpeningDay, RestaurantInfo } from '@/types';

type Tab = 'info' | 'backup' | 'logs';
const TABS: Tab[] = ['info', 'backup', 'logs'];

export function SettingsPage() {
  const [params, setParams] = useSearchParams();
  const raw = params.get('tab') as Tab | null;
  const tab: Tab = raw && TABS.includes(raw) ? raw : 'info';

  return (
    <AppShell meta={{ label: 'Cấu hình hệ thống', parent: 'Hệ thống' }}>
      <div className="min-w-0 space-y-4">
        <PageHeader title="Cấu hình hệ thống" description="Thông tin nhà hàng, giờ hoạt động, sao lưu & phục hồi dữ liệu và nhật ký hoạt động." />
        <PageTabs<Tab>
          ariaLabel="Phân khu cấu hình"
          value={tab}
          onChange={(t) => setParams({ tab: t }, { replace: true })}
          items={[
            { value: 'info', label: 'Thông tin nhà hàng', icon: <Building2 size={16} /> },
            { value: 'backup', label: 'Sao lưu & phục hồi', icon: <DatabaseBackup size={16} /> },
            { value: 'logs', label: 'Nhật ký hoạt động', icon: <ScrollText size={16} /> },
          ]}
        />
        {tab === 'info' ? (
          <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
            <RestaurantInfoCard />
            <OpeningHoursCard />
          </div>
        ) : null}
        {tab === 'backup' ? <BackupSection /> : null}
        {tab === 'logs' ? (
          <Card padded>
            <CardHeader title="Nhật ký hoạt động" icon={<ScrollText size={17} />} description="Tra cứu lịch sử thao tác theo thời gian, tài khoản và hành động." />
            <Link to="/nhat-ky" className="mt-4 inline-flex h-10 items-center rounded-control bg-[var(--accent)] px-4 text-[14px] font-semibold text-[var(--accent-contrast)] hover:bg-[var(--accent-hover)]">
              Mở trang Nhật ký
            </Link>
          </Card>
        ) : null}
      </div>
    </AppShell>
  );
}

/* =========================================================== Thông tin nhà hàng */

function RestaurantInfoCard() {
  const query = useRestaurantInfo();
  const [form, setForm] = useState<Omit<RestaurantInfo, 'updatedAt'> | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const load = (i: RestaurantInfo) => {
    const { updatedAt, ...rest } = i;
    void updatedAt;
    setForm(rest);
    setErrors({});
  };
  useEffect(() => {
    if (query.data && !form) load(query.data);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query.data]);

  const mutation = useApiMutation(updateRestaurantInfo, {
    invalidate: [[...qk.settings, 'info']],
    success: 'Đã lưu thông tin nhà hàng',
    onFieldErrors: setErrors,
    onSuccess: load,
  });

  if (query.isError) return <BlockError onRetry={() => void query.refetch()} />;
  if (!form) return <Skeleton className="h-[480px]" />;

  const field = (key: keyof typeof form, label: string, opts: { required?: boolean; placeholder?: string; span?: boolean; type?: string } = {}) => (
    <Field label={label} htmlFor={`ri-${key}`} required={opts.required} error={errors[key]} className={opts.span ? 'sm:col-span-2' : undefined}>
      <TextInput
        id={`ri-${key}`}
        type={opts.type}
        value={(form[key] as string) ?? ''}
        placeholder={opts.placeholder}
        invalid={Boolean(errors[key])}
        onChange={(e) => {
          setForm({ ...form, [key]: e.target.value });
          setErrors((p) => ({ ...p, [key]: '' }));
        }}
      />
    </Field>
  );

  return (
    <Card padded>
      <CardHeader title="Thông tin định danh & liên hệ" icon={<Building2 size={17} />} description={query.data ? `Cập nhật lần cuối ${formatDateTime(query.data.updatedAt)}` : undefined} />
      <form
        noValidate
        className="mt-4 grid gap-4 sm:grid-cols-[160px_minmax(0,1fr)]"
        onSubmit={(e) => {
          e.preventDefault();
          mutation.mutate(form);
        }}
      >
        <div>
          <p className="mb-1.5 text-[13px] font-semibold">Logo</p>
          <ImageUpload value={form.logo} onChange={(v) => setForm({ ...form, logo: v })} label="Tải logo" />
        </div>
        <div className="grid content-start gap-4 sm:grid-cols-2">
          {field('name', 'Tên nhà hàng', { required: true })}
          {field('taxCode', 'Mã số thuế', { placeholder: '0123456789' })}
          {field('legalName', 'Tên pháp nhân', { span: true })}
        </div>
        <div className="grid gap-4 sm:col-span-2 sm:grid-cols-2">
          {field('phone', 'Số điện thoại', { required: true })}
          {field('email', 'Email', { required: true, type: 'email' })}
          {field('address', 'Địa chỉ trụ sở', { required: true, span: true })}
          {field('website', 'Website', { placeholder: 'https://', span: true })}
        </div>
        <div className="flex justify-end gap-2 sm:col-span-2">
          <Button variant="ghost" onClick={() => query.data && load(query.data)} disabled={mutation.isPending}>Hoàn tác</Button>
          <Button type="submit" loading={mutation.isPending} leadingIcon={<Save size={15} />}>Lưu thông tin</Button>
        </div>
      </form>
    </Card>
  );
}

/* =========================================================== Giờ hoạt động */

function OpeningHoursCard() {
  const query = useOpeningHours();
  const [days, setDays] = useState<OpeningDay[] | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (query.data && !days) setDays(query.data);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query.data]);

  const mutation = useApiMutation(updateOpeningHours, {
    invalidate: [[...qk.settings, 'hours']],
    success: 'Đã cập nhật giờ hoạt động. Form đặt bàn áp dụng ngay.',
    onFieldErrors: setErrors,
    onSuccess: (d) => {
      setDays(d);
      setErrors({});
    },
  });

  if (query.isError) return <BlockError onRetry={() => void query.refetch()} />;
  if (!days) return <Skeleton className="h-[480px]" />;

  const update = (day: number, patch: Partial<OpeningDay>) => {
    setDays(days.map((d) => (d.day === day ? { ...d, ...patch } : d)));
    setErrors((p) => ({ ...p, [`day-${day}`]: '', general: '' }));
  };
  // Hiển thị Thứ hai → Chủ nhật.
  const ordered = [...days].sort((a, b) => ((a.day + 6) % 7) - ((b.day + 6) % 7));

  return (
    <Card padded className="h-fit">
      <CardHeader title="Giờ hoạt động" icon={<Clock size={17} />} description="Dùng để kiểm tra giờ đặt bàn hợp lệ." />
      {errors.general ? <p className="mt-2 text-[12px] font-medium text-[var(--danger)]">{errors.general}</p> : null}
      <ul className="mt-3 divide-y divide-[var(--border)]">
        {ordered.map((d) => (
          <li key={d.day} className="py-2.5">
            <div className="flex items-center gap-3">
              <Toggle checked={d.open} label={`Mở cửa ${WEEKDAYS[d.day]}`} onChange={(v) => update(d.day, { open: v })} />
              <span className={cn('w-[72px] text-[13.5px] font-semibold', !d.open && 'text-[var(--text-muted)]')}>{WEEKDAYS[d.day]}</span>
              {d.open ? (
                <div className="flex flex-1 items-center gap-1.5">
                  <TextInput type="time" aria-label={`Giờ mở cửa ${WEEKDAYS[d.day]}`} value={d.openTime} invalid={Boolean(errors[`day-${d.day}`])} onChange={(e) => update(d.day, { openTime: e.target.value })} className="h-9" />
                  <span className="text-[var(--text-muted)]">–</span>
                  <TextInput type="time" aria-label={`Giờ đóng cửa ${WEEKDAYS[d.day]}`} value={d.closeTime} invalid={Boolean(errors[`day-${d.day}`])} onChange={(e) => update(d.day, { closeTime: e.target.value })} className="h-9" />
                </div>
              ) : (
                <span className="text-[13px] text-[var(--text-muted)]">Nghỉ</span>
              )}
            </div>
            {errors[`day-${d.day}`] ? <p className="mt-1 pl-[56px] text-[12px] text-[var(--danger)]">{errors[`day-${d.day}`]}</p> : null}
          </li>
        ))}
      </ul>
      <div className="mt-3 flex justify-end gap-2">
        <Button variant="ghost" onClick={() => query.data && setDays(query.data)} disabled={mutation.isPending}>Hoàn tác</Button>
        <Button loading={mutation.isPending} leadingIcon={<Save size={15} />} onClick={() => mutation.mutate(days)}>Lưu giờ hoạt động</Button>
      </div>
    </Card>
  );
}

/* =========================================================== Sao lưu & phục hồi */

function BackupSection() {
  const query = useBackups();
  const [schedule, setSchedule] = useState<BackupSchedule | null>(null);
  const [keepText, setKeepText] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirm, setConfirm] = useState<{ kind: 'restore' | 'delete'; file: BackupFile } | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);

  useEffect(() => {
    if (query.data && !schedule) {
      setSchedule(query.data.schedule);
      setKeepText(String(query.data.schedule.keep));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query.data]);

  const scheduleMutation = useApiMutation(updateBackupSchedule, {
    invalidate: [[...qk.settings, 'backups']],
    success: 'Đã lưu lịch sao lưu tự động',
    onFieldErrors: setErrors,
  });
  const createMutation = useApiMutation(() => createBackup(), {
    invalidate: [[...qk.settings, 'backups']],
    success: (f) => `Đã tạo bản sao lưu ${f.name}`,
  });
  const confirmMutation = useApiMutation(
    async (c: { kind: 'restore' | 'delete'; file: BackupFile }) => (c.kind === 'restore' ? restoreBackup(c.file.id) : deleteBackup(c.file.id)),
    {
      // Phục hồi thay toàn bộ dữ liệu → làm mới mọi dữ liệu đang hiển thị (khóa rỗng = mọi truy vấn).
      invalidate: [[]],
      success: (r, c) =>
        c.kind === 'restore' && r
          ? `Đã phục hồi từ ${c.file.name}. Dữ liệu ngay trước đó được lưu ở ${r.safetyBackup.name}.`
          : `Đã xóa ${c.file.name}`,
      onSuccess: () => setConfirm(null),
    },
  );

  const download = async (file: BackupFile) => {
    setDownloading(file.id);
    try {
      const blob = await downloadBackup(file.id);
      downloadBlob(file.name, blob);
    } catch {
      toast.error('Không tải được bản sao lưu');
    } finally {
      setDownloading(null);
    }
  };

  if (query.isError) return <BlockError onRetry={() => void query.refetch()} />;

  return (
    <div className="grid min-w-0 gap-4 xl:grid-cols-[380px_minmax(0,1fr)]">
      <Card padded className="h-fit">
        <CardHeader title="Lịch sao lưu tự động" icon={<Clock size={17} />} />
        {!schedule ? (
          <Skeleton className="mt-4 h-48" />
        ) : (
          <div className="mt-4 space-y-4">
            <ToggleRow title="Tự động sao lưu" description="Hệ thống tạo bản sao lưu định kỳ theo lịch" checked={schedule.enabled} onChange={(v) => setSchedule({ ...schedule, enabled: v })} />
            <div className={cn('grid grid-cols-2 gap-3', !schedule.enabled && 'pointer-events-none opacity-50')}>
              <Field label="Tần suất" htmlFor="bk-freq">
                <SelectInput id="bk-freq" value={schedule.frequency} onChange={(e) => setSchedule({ ...schedule, frequency: e.target.value as BackupFrequency })} options={[{ value: 'daily', label: 'Hằng ngày' }, { value: 'weekly', label: 'Hằng tuần' }]} />
              </Field>
              {schedule.frequency === 'weekly' ? (
                <Field label="Vào ngày" htmlFor="bk-day">
                  <SelectInput id="bk-day" value={String(schedule.weekday)} onChange={(e) => setSchedule({ ...schedule, weekday: Number(e.target.value) })} options={WEEKDAYS.map((w, i) => ({ value: String(i), label: w }))} />
                </Field>
              ) : <div />}
              <Field label="Thời điểm" htmlFor="bk-time" error={errors.time}>
                <TextInput id="bk-time" type="time" value={schedule.time} invalid={Boolean(errors.time)} onChange={(e) => setSchedule({ ...schedule, time: e.target.value })} />
              </Field>
              <Field label="Giữ lại" htmlFor="bk-keep" error={errors.keep} hint="bản gần nhất">
                <TextInput id="bk-keep" type="number" min={1} max={60} value={keepText} invalid={Boolean(errors.keep)} onChange={(e) => { setKeepText(e.target.value); setErrors((p) => ({ ...p, keep: '' })); }} />
              </Field>
            </div>
            <Button className="w-full" loading={scheduleMutation.isPending} leadingIcon={<Save size={15} />} onClick={() => scheduleMutation.mutate({ ...schedule, keep: Number(keepText) })}>
              Lưu lịch sao lưu
            </Button>
          </div>
        )}
      </Card>

      <Card className="min-w-0 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] px-4 py-3 sm:px-5">
          <div>
            <p className="text-[15px] font-semibold">Bản sao lưu</p>
            <p className="text-[12.5px] text-[var(--text-muted)]">Phục hồi sẽ đưa toàn bộ dữ liệu về thời điểm của bản sao lưu.</p>
          </div>
          <Button size="sm" leadingIcon={<HardDriveDownload size={15} />} loading={createMutation.isPending} onClick={() => createMutation.mutate(undefined)}>
            Sao lưu ngay
          </Button>
        </div>
        {query.isLoading || !query.data ? (
          <TableSkeleton rows={4} cols={4} />
        ) : query.data.files.length === 0 ? (
          <div className="p-5"><EmptyState icon={DatabaseBackup} title="Chưa có bản sao lưu" /></div>
        ) : (
          <DataTable minWidth={680}>
            <thead>
              <tr>
                <Th>Tên file</Th>
                <Th>Thời điểm</Th>
                <Th>Loại</Th>
                <Th className="text-right">Dung lượng</Th>
                <Th className="text-right">Thao tác</Th>
              </tr>
            </thead>
            <tbody>
              {query.data.files.map((f) => (
                <tr key={f.id} className="hover:bg-[var(--bg-subtle)]">
                  <Td className="font-mono text-[12.5px]">{f.name}</Td>
                  <Td className="whitespace-nowrap font-mono text-[12.5px]">{formatDateTime(f.createdAt)}</Td>
                  <Td><Badge variant={f.kind === 'auto' ? 'neutral' : 'info'}>{f.kind === 'auto' ? 'Tự động' : 'Thủ công'}</Badge></Td>
                  <Td className="text-right font-mono">{formatNumber(f.sizeKb)} KB</Td>
                  <Td className="text-right">
                    <div className="inline-flex gap-0.5">
                      <Button size="sm" variant="ghost" aria-label={`Phục hồi từ ${f.name}`} onClick={() => setConfirm({ kind: 'restore', file: f })}><RotateCcw size={14} /></Button>
                      <Button size="sm" variant="ghost" aria-label={`Tải xuống ${f.name}`} loading={downloading === f.id} onClick={() => void download(f)}>{downloading === f.id ? null : <Download size={14} />}</Button>
                      <Button size="sm" variant="ghost" aria-label={`Xóa ${f.name}`} onClick={() => setConfirm({ kind: 'delete', file: f })}><Trash2 size={14} /></Button>
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        )}
      </Card>

      <ConfirmDialog
        open={Boolean(confirm)}
        onOpenChange={(o) => !o && !confirmMutation.isPending && setConfirm(null)}
        title={confirm?.kind === 'restore' ? 'Phục hồi dữ liệu?' : 'Xóa bản sao lưu?'}
        description={
          confirm?.kind === 'restore'
            ? `Toàn bộ dữ liệu hiện tại sẽ được thay bằng bản sao lưu ${confirm.file.name} (${formatDateTime(confirm.file.createdAt)}); các thay đổi sau thời điểm đó sẽ mất. Hệ thống tự tạo một bản sao lưu dữ liệu hiện tại trước khi phục hồi để có thể quay lại. Nhật ký hoạt động được giữ nguyên.`
            : `File ${confirm?.file.name} sẽ bị xóa vĩnh viễn để giải phóng bộ nhớ.`
        }
        confirmLabel={confirm?.kind === 'restore' ? 'Phục hồi' : 'Xóa'}
        loading={confirmMutation.isPending}
        onConfirm={() => confirm && confirmMutation.mutate(confirm)}
      />
    </div>
  );
}

export default SettingsPage;
