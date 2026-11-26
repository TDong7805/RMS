import { useMemo, useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  ArrowUpRight, Building2, Clock, DatabaseBackup, Globe, HardDriveDownload, Landmark, QrCode, RotateCcw, ScanFace,
  ScrollText, Search, Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { AppShell } from '@/components/layout/AppShell';
import { Badge } from '@/components/common/Badge';
import { Button } from '@/components/common/Button';
import { BlockError, EmptyState } from '@/components/common/EmptyState';
import { ImageUpload, SelectInput, TextInput, Toggle } from '@/components/common/Form';
import { ConfirmDialog } from '@/components/common/Modal';
import { DataTable, TableSkeleton, Td, Th } from '@/components/common/PageParts';
import { RowActions } from '@/components/common/RowActions';
import { SettingRow, SettingsSaveBar, SettingsSection, UnitInput } from '@/components/common/SettingsParts';
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
import { PaymentSettingsCard } from '@/features/management/PaymentSettingsCard';
import { OrderingSettingsCard } from '@/features/management/OrderingSettingsCard';
import { AttendanceSettingsCard } from '@/features/management/AttendanceSettingsCard';
import { WebsiteSettings } from '@/features/management/website/WebsiteSettings';
import { qk, useBackups, useOpeningHours, useRestaurantInfo } from '@/features/management/queries';
import { ps } from '@/features/public-site/queries';
import { useApiMutation } from '@/hooks/use-api-mutation';
import { useDraft } from '@/hooks/use-draft';
import { cn } from '@/lib/cn';
import { formatNumber } from '@/lib/format';
import { WEEKDAYS, formatDateTime } from '@/lib/labels';
import { downloadBlob } from '@/lib/mock';
import { matchesKeyword } from '@/lib/normalize';
import type { BackupFile, BackupFrequency, OpeningDay, RestaurantInfo } from '@/types';

/* =========================================================== Bố cục: cột trái chia nhóm (kiểu Linear) */

type Tab = 'info' | 'hours' | 'payment' | 'ordering' | 'attendance' | 'website' | 'backup';

interface NavItem {
  tab: Tab | null;
  label: string;
  icon: ReactNode;
  /** Từ khóa để ô tìm khớp cả tên cài đặt bên trong (không chỉ tên mục). */
  keywords: string;
  to?: string;
}

const NAV: { group: string; items: NavItem[] }[] = [
  {
    group: 'Nhà hàng',
    items: [
      { tab: 'info', label: 'Thông tin', icon: <Building2 size={15} />, keywords: 'tên logo mã số thuế pháp nhân điện thoại email địa chỉ website ảnh bìa' },
      { tab: 'hours', label: 'Giờ hoạt động', icon: <Clock size={15} />, keywords: 'giờ mở cửa đóng cửa nghỉ thứ' },
      { tab: 'payment', label: 'Thanh toán', icon: <Landmark size={15} />, keywords: 'ngân hàng tài khoản chuyển khoản mã qr vietqr' },
    ],
  },
  {
    group: 'Vận hành',
    items: [
      { tab: 'ordering', label: 'Gọi món tại bàn', icon: <QrCode size={15} />, keywords: 'mở bàn tự đóng bàn xác nhận món phục vụ nhắc lại qr' },
      { tab: 'attendance', label: 'Chấm công', icon: <ScanFace size={15} />, keywords: 'khuôn mặt mạng wifi ip vào ca sớm ảnh' },
    ],
  },
  {
    group: 'Khách hàng',
    items: [{ tab: 'website', label: 'Website', icon: <Globe size={15} />, keywords: 'banner giới thiệu bếp trưởng món đặc trưng trải nghiệm không gian mạng xã hội bản đồ album ảnh thực đơn' }],
  },
  {
    group: 'Hệ thống',
    items: [
      { tab: 'backup', label: 'Sao lưu & phục hồi', icon: <DatabaseBackup size={15} />, keywords: 'sao lưu tự động phục hồi tải xuống' },
      { tab: null, label: 'Nhật ký hoạt động', icon: <ScrollText size={15} />, keywords: 'nhật ký lịch sử thao tác', to: '/quan-ly/nhat-ky' },
    ],
  },
];
const TABS = NAV.flatMap((g) => g.items.map((i) => i.tab)).filter(Boolean) as Tab[];

export function SettingsPage() {
  const [params, setParams] = useSearchParams();
  const raw = params.get('tab') as Tab | null;
  const tab: Tab = raw && TABS.includes(raw) ? raw : 'info';
  const [query, setQuery] = useState('');
  const current = NAV.flatMap((g) => g.items).find((i) => i.tab === tab)!;

  const groups = useMemo(() => {
    const q = query.trim();
    return NAV.map((g) => ({ ...g, items: g.items.filter((i) => !q || matchesKeyword(`${i.label} ${i.keywords}`, q)) })).filter((g) => g.items.length);
  }, [query]);

  return (
    <AppShell meta={{ label: current.label, parent: 'Cấu hình hệ thống', parentTo: '/quan-ly/cai-dat' }}>
      {/* Cả cụm (cột trái + nội dung) nằm giữa, bề ngang tối đa cố định: menu thu gọn hay ghim đều cân hai bên. */}
      <div className={cn('mx-auto grid w-full min-w-0 gap-6 lg:grid-cols-[220px_minmax(0,1fr)]', tab === 'website' ? 'max-w-[1320px]' : 'max-w-[1064px]')}>
        <aside className="min-w-0 lg:sticky lg:top-4 lg:self-start">
          <h1 className="mb-3 px-1 text-[22px] font-bold tracking-[-0.02em] text-[var(--text-primary)]">Cấu hình</h1>
          <div className="relative mb-3">
            <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Tìm cài đặt…"
              aria-label="Tìm cài đặt"
              className="h-9 w-full rounded-[10px] border border-[var(--border)] bg-[var(--bg-surface)] pl-8 pr-3 text-[13.5px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:outline-none"
            />
          </div>
          <nav aria-label="Mục cấu hình" className="flex gap-4 overflow-x-auto pb-1 lg:block lg:space-y-4 lg:overflow-visible">
            {groups.length === 0 ? <p className="px-1 text-[12.5px] text-[var(--text-muted)]">Không có cài đặt phù hợp.</p> : null}
            {groups.map((g) => (
              <div key={g.group} className="shrink-0">
                <p className="mb-1 px-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">{g.group}</p>
                <ul className="flex gap-1 lg:block lg:space-y-0.5">
                  {g.items.map((i) => {
                    const active = i.tab === tab;
                    const cls = cn(
                      'flex h-9 items-center gap-2.5 whitespace-nowrap rounded-[9px] px-2.5 text-[13.5px] transition-colors',
                      active ? 'bg-[var(--accent-soft)] font-semibold text-[var(--accent)]' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)]',
                    );
                    return (
                      <li key={i.label}>
                        {i.to ? (
                          <Link to={i.to} className={cls}>{i.icon}<span className="flex-1">{i.label}</span><ArrowUpRight size={13} className="opacity-60" /></Link>
                        ) : (
                          <button type="button" aria-current={active ? 'page' : undefined} onClick={() => setParams({ tab: i.tab! })} className={cn(cls, 'w-full text-left')}>
                            {i.icon}{i.label}
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </nav>
        </aside>

        <div className="min-w-0">
          {tab === 'info' ? <RestaurantInfoSection /> : null}
          {tab === 'hours' ? <OpeningHoursSection /> : null}
          {tab === 'payment' ? <PaymentSettingsCard /> : null}
          {tab === 'ordering' ? <OrderingSettingsCard /> : null}
          {tab === 'attendance' ? <AttendanceSettingsCard /> : null}
          {tab === 'website' ? <WebsiteSettings /> : null}
          {tab === 'backup' ? <BackupSection /> : null}
        </div>
      </div>
    </AppShell>
  );
}

/* =========================================================== Thông tin nhà hàng */

type InfoDraft = Omit<RestaurantInfo, 'updatedAt'>;

function RestaurantInfoSection() {
  const query = useRestaurantInfo();
  const d = useDraft(query.data, (i): InfoDraft => {
    const { updatedAt, ...rest } = i;
    void updatedAt;
    return rest;
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const mutation = useApiMutation(updateRestaurantInfo, {
    invalidate: [[...qk.settings, 'info'], ps.site],
    success: 'Đã lưu thông tin nhà hàng',
    onFieldErrors: setErrors,
    onSuccess: (i) => { d.commit(i); setErrors({}); },
  });

  if (query.isError) return <BlockError onRetry={() => void query.refetch()} />;
  if (!d.draft) return <Skeleton className="h-[480px]" />;
  const form = d.draft;

  const text = (key: keyof InfoDraft, label: string, opts: { description?: string; placeholder?: string; type?: string; wide?: boolean } = {}) => (
    <SettingRow label={label} description={opts.description} htmlFor={`ri-${key}`} error={errors[key]}>
      <TextInput
        id={`ri-${key}`}
        type={opts.type}
        value={(form[key] as string) ?? ''}
        placeholder={opts.placeholder}
        invalid={Boolean(errors[key])}
        onChange={(e) => {
          d.set({ [key]: e.target.value } as Partial<InfoDraft>);
          setErrors((p) => ({ ...p, [key]: '' }));
        }}
        className={opts.wide ? 'w-full sm:w-[340px]' : 'w-full sm:w-[260px]'}
      />
    </SettingRow>
  );

  return (
    <div className="space-y-6">
      <SettingsSection title="Nhận diện" description={query.data ? `Sửa lần cuối ${formatDateTime(query.data.updatedAt)}` : undefined}>
        <SettingRow label="Logo" description="Hiện trên hóa đơn, website và trang gọi món.">
          <div className="w-[120px]"><ImageUpload value={form.logo} onChange={(v) => d.set({ logo: v })} label="Tải logo" /></div>
        </SettingRow>
        {text('name', 'Tên nhà hàng')}
        {text('legalName', 'Tên pháp nhân', { description: 'Tên công ty ghi trên hóa đơn.', wide: true })}
        {text('taxCode', 'Mã số thuế', { placeholder: '0123456789' })}
      </SettingsSection>

      <SettingsSection title="Liên hệ">
        {text('phone', 'Số điện thoại')}
        {text('email', 'Email', { type: 'email' })}
        {text('address', 'Địa chỉ', { wide: true })}
        {text('website', 'Website', { placeholder: 'https://', wide: true })}
      </SettingsSection>

      <SettingsSection title="Trang gọi món tại bàn">
        <SettingRow stacked label="Ảnh bìa" description="Ảnh lớn đầu trang khách thấy khi quét mã QR tại bàn (mặt tiền, không gian quán). Nên dùng ảnh ngang 16:9.">
          <div className="max-w-[420px]"><ImageUpload value={form.coverImage} onChange={(v) => d.set({ coverImage: v })} aspect="wide" label="Tải ảnh bìa" /></div>
        </SettingRow>
      </SettingsSection>

      <SettingsSaveBar dirty={d.dirty} saving={mutation.isPending} errorCount={Object.values(errors).filter(Boolean).length} onSave={() => mutation.mutate(form)} onDiscard={() => { d.reset(); setErrors({}); }} />
    </div>
  );
}

/* =========================================================== Giờ hoạt động */

function OpeningHoursSection() {
  const query = useOpeningHours();
  const d = useDraft(query.data, (days) => ({ days }));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const mutation = useApiMutation(updateOpeningHours, {
    invalidate: [[...qk.settings, 'hours']],
    success: 'Đã lưu giờ hoạt động. Đặt bàn áp dụng ngay.',
    onFieldErrors: setErrors,
    onSuccess: (days) => { d.commit(days); setErrors({}); },
  });

  if (query.isError) return <BlockError onRetry={() => void query.refetch()} />;
  if (!d.draft) return <Skeleton className="h-[480px]" />;
  const days = d.draft.days;
  const update = (day: number, patch: Partial<OpeningDay>) => {
    d.set({ days: days.map((x) => (x.day === day ? { ...x, ...patch } : x)) });
    setErrors((p) => ({ ...p, [`day-${day}`]: '', general: '' }));
  };
  // Hiển thị Thứ hai → Chủ nhật.
  const ordered = [...days].sort((a, b) => ((a.day + 6) % 7) - ((b.day + 6) % 7));

  return (
    <div className="space-y-6">
      <SettingsSection title="Giờ hoạt động" description="Dùng để kiểm tra giờ khách đặt bàn có hợp lệ không.">
        {errors.general ? <p className="px-5 py-2 text-[12.5px] font-medium text-[var(--danger)]">{errors.general}</p> : null}
        {ordered.map((x) => (
          <SettingRow key={x.day} label={WEEKDAYS[x.day]} error={errors[`day-${x.day}`]}>
            <div className="flex items-center gap-3">
              {x.open ? (
                <div className="flex items-center gap-1.5">
                  <TextInput type="time" aria-label={`Giờ mở cửa ${WEEKDAYS[x.day]}`} value={x.openTime} invalid={Boolean(errors[`day-${x.day}`])} onChange={(e) => update(x.day, { openTime: e.target.value })} className="h-9 w-[120px]" />
                  <span className="text-[var(--text-muted)]">–</span>
                  <TextInput type="time" aria-label={`Giờ đóng cửa ${WEEKDAYS[x.day]}`} value={x.closeTime} invalid={Boolean(errors[`day-${x.day}`])} onChange={(e) => update(x.day, { closeTime: e.target.value })} className="h-9 w-[120px]" />
                </div>
              ) : (
                <span className="w-[262px] text-right text-[13px] text-[var(--text-muted)]">Nghỉ cả ngày</span>
              )}
              <Toggle checked={x.open} label={`Mở cửa ${WEEKDAYS[x.day]}`} onChange={(v) => update(x.day, { open: v })} />
            </div>
          </SettingRow>
        ))}
      </SettingsSection>
      <SettingsSaveBar dirty={d.dirty} saving={mutation.isPending} errorCount={Object.values(errors).filter(Boolean).length} onSave={() => mutation.mutate(days)} onDiscard={() => { d.reset(); setErrors({}); }} />
    </div>
  );
}

/* =========================================================== Sao lưu & phục hồi */

function BackupSection() {
  const query = useBackups();
  const d = useDraft(query.data?.schedule, (s) => ({ ...s, keep: String(s.keep) }));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirm, setConfirm] = useState<{ kind: 'restore' | 'delete'; file: BackupFile } | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);

  const scheduleMutation = useApiMutation(updateBackupSchedule, {
    invalidate: [[...qk.settings, 'backups']],
    success: 'Đã lưu lịch sao lưu tự động',
    onFieldErrors: setErrors,
    onSuccess: (s) => { d.commit(s); setErrors({}); },
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
  const s = d.draft;
  const off = s ? !s.enabled : false;

  return (
    <div className="space-y-6">
      {!s ? (
        <Skeleton className="h-60" />
      ) : (
        <SettingsSection title="Sao lưu tự động">
          <SettingRow label="Tự động sao lưu" description="Hệ thống tự tạo bản sao lưu dữ liệu theo lịch bên dưới.">
            <Toggle checked={s.enabled} label="Tự động sao lưu" onChange={(v) => d.set({ enabled: v })} />
          </SettingRow>
          <div className={cn('divide-y divide-[var(--border)]', off && 'pointer-events-none opacity-50')}>
            <SettingRow label="Bao lâu một lần" htmlFor="bk-freq">
              <div className="flex gap-2">
                <SelectInput id="bk-freq" value={s.frequency} onChange={(e) => d.set({ frequency: e.target.value as BackupFrequency })} options={[{ value: 'daily', label: 'Hằng ngày' }, { value: 'weekly', label: 'Hằng tuần' }]} className="w-[140px]" />
                {s.frequency === 'weekly' ? (
                  <SelectInput aria-label="Vào ngày" value={String(s.weekday)} onChange={(e) => d.set({ weekday: Number(e.target.value) })} options={WEEKDAYS.map((w, i) => ({ value: String(i), label: w }))} className="w-[140px]" />
                ) : null}
              </div>
            </SettingRow>
            <SettingRow label="Giờ sao lưu" description="Nên chọn giờ quán đã đóng cửa." htmlFor="bk-time" error={errors.time}>
              <TextInput id="bk-time" type="time" value={s.time} invalid={Boolean(errors.time)} onChange={(e) => { d.set({ time: e.target.value }); setErrors((p) => ({ ...p, time: '' })); }} className="w-[140px]" />
            </SettingRow>
            <SettingRow label="Giữ lại" description="Bản cũ hơn tự xóa để đỡ tốn chỗ (1–60)." htmlFor="bk-keep" error={errors.keep}>
              <UnitInput unit="bản gần nhất">
                <TextInput id="bk-keep" type="number" min={1} max={60} value={s.keep} invalid={Boolean(errors.keep)} onChange={(e) => { d.set({ keep: e.target.value }); setErrors((p) => ({ ...p, keep: '' })); }} className="w-[96px]" />
              </UnitInput>
            </SettingRow>
          </div>
        </SettingsSection>
      )}

      <SettingsSection
        title="Bản sao lưu"
        description="Phục hồi sẽ đưa toàn bộ dữ liệu về thời điểm của bản sao lưu."
        action={<Button size="sm" leadingIcon={<HardDriveDownload size={15} />} loading={createMutation.isPending} onClick={() => createMutation.mutate(undefined)}>Sao lưu ngay</Button>}
      >
        {query.isLoading || !query.data ? (
          <TableSkeleton rows={4} cols={4} />
        ) : query.data.files.length === 0 ? (
          <div className="p-5"><EmptyState icon={DatabaseBackup} title="Chưa có bản sao lưu" /></div>
        ) : (
          <div className="overflow-hidden rounded-[14px]">
            <DataTable minWidth={620}>
              <thead>
                <tr>
                  <Th>Thời điểm</Th>
                  <Th>Loại</Th>
                  <Th className="text-right">Dung lượng</Th>
                  <Th className="text-right"><span className="sr-only">Thao tác</span></Th>
                </tr>
              </thead>
              <tbody>
                {query.data.files.map((f) => (
                  <tr key={f.id} className="hover:bg-[var(--bg-subtle)]">
                    <Td>
                      <span className="block whitespace-nowrap font-mono text-[12.5px] font-semibold">{formatDateTime(f.createdAt)}</span>
                      <span className="block truncate font-mono text-[11.5px] text-[var(--text-muted)]">{f.name}</span>
                    </Td>
                    <Td><Badge variant={f.kind === 'auto' ? 'neutral' : 'info'}>{f.kind === 'auto' ? 'Tự động' : 'Thủ công'}</Badge></Td>
                    <Td className="text-right font-mono">{formatNumber(f.sizeKb)} KB</Td>
                    <Td className="text-right">
                      <RowActions
                        name={f.name}
                        primaryLabel={downloading === f.id ? 'Đang tải…' : 'Tải xuống'}
                        onPrimary={() => void download(f)}
                        items={[
                          { label: 'Phục hồi từ bản này', icon: <RotateCcw size={15} />, onSelect: () => setConfirm({ kind: 'restore', file: f }) },
                          { label: 'Xóa bản sao lưu', icon: <Trash2 size={15} />, danger: true, onSelect: () => setConfirm({ kind: 'delete', file: f }) },
                        ]}
                      />
                    </Td>
                  </tr>
                ))}
              </tbody>
            </DataTable>
          </div>
        )}
      </SettingsSection>

      {s ? (
        <SettingsSaveBar
          dirty={d.dirty}
          saving={scheduleMutation.isPending}
          errorCount={Object.values(errors).filter(Boolean).length}
          onSave={() => scheduleMutation.mutate({ ...s, keep: Number(s.keep) })}
          onDiscard={() => { d.reset(); setErrors({}); }}
        />
      ) : null}

      <ConfirmDialog
        open={Boolean(confirm)}
        onOpenChange={(o) => !o && !confirmMutation.isPending && setConfirm(null)}
        title={confirm?.kind === 'restore' ? 'Phục hồi dữ liệu?' : 'Xóa bản sao lưu?'}
        description={
          confirm?.kind === 'restore'
            ? `Toàn bộ dữ liệu hiện tại sẽ được thay bằng bản sao lưu lúc ${formatDateTime(confirm.file.createdAt)}; những gì thay đổi sau thời điểm đó sẽ mất. Trước khi phục hồi, hệ thống tự sao lưu dữ liệu hiện tại để có thể quay lại. Nhật ký hoạt động vẫn giữ nguyên.`
            : `Bản sao lưu ${confirm?.file.name} sẽ bị xóa hẳn để giải phóng bộ nhớ.`
        }
        confirmLabel={confirm?.kind === 'restore' ? 'Phục hồi' : 'Xóa'}
        loading={confirmMutation.isPending}
        onConfirm={() => confirm && confirmMutation.mutate(confirm)}
      />
    </div>
  );
}

export default SettingsPage;

