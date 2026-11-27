import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import { ArrowRight, Wifi } from 'lucide-react';
import { Button } from '@/components/common/Button';
import { TextInput } from '@/components/common/Form';
import { SettingRow, SettingsSaveBar, SettingsSection, UnitInput } from '@/components/common/SettingsParts';
import { Skeleton } from '@/components/common/Skeleton';
import { ATTENDANCE_SETTINGS_KEY, getAttendanceSettings, saveAttendanceSettings } from '@/api/attendance-admin';
import { useDraft } from '@/hooks/use-draft';
import { ValidationError } from '@/lib/mock';

/**
 * Cấu hình hệ thống → Chấm công: mạng của quán (IP / dải mạng được chấm công), vào ca sớm tối đa, độ chặt so khớp khuôn mặt,
 * số ngày giữ ảnh chấm công.
 */
export function AttendanceSettingsCard() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ATTENDANCE_SETTINGS_KEY, queryFn: getAttendanceSettings });
  const d = useDraft(q.data, (x) => ({
    allowedNetworks: x.allowedNetworks,
    earlyMinutes: String(x.earlyMinutes),
    faceThreshold: String(x.faceThreshold).replace('.', ','),
    faceThresholdCounter: String(x.faceThresholdCounter).replace('.', ','),
    photoRetentionDays: String(x.photoRetentionDays),
  }));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const save = useMutation({
    mutationFn: () => {
      const f = d.draft!;
      return saveAttendanceSettings({
        allowedNetworks: f.allowedNetworks,
        earlyMinutes: Number(f.earlyMinutes),
        faceThreshold: Number(f.faceThreshold.replace(',', '.')),
        faceThresholdCounter: Number(f.faceThresholdCounter.replace(',', '.')),
        photoRetentionDays: Number(f.photoRetentionDays),
      });
    },
    onSuccess: (data) => { qc.setQueryData(ATTENDANCE_SETTINGS_KEY, data); d.commit(data); setErrors({}); toast.success('Đã lưu cấu hình chấm công'); },
    onError: (e) => (e instanceof ValidationError ? setErrors(e.fields) : toast.error(e instanceof Error ? e.message : 'Không lưu được')),
  });

  if (!d.draft) return <Skeleton className="h-72" />;
  const f = d.draft;
  const set = (k: keyof typeof f, v: string) => { d.set({ [k]: v }); setErrors((e) => ({ ...e, [k]: '' })); };
  const addCurrentIp = () => {
    const ip = q.data?.currentIp;
    if (!ip) return;
    const list = f.allowedNetworks.split(/[,;\s]+/).filter(Boolean);
    if (list.includes(ip)) return toast.info(`IP ${ip} đã có trong danh sách`);
    set('allowedNetworks', [...list, ip].join(', '));
  };

  return (
    <div className="space-y-6">
      <SettingsSection
        title="Chấm công bằng khuôn mặt"
        description="Phục vụ, thu ngân, bếp tự chấm công trên điện thoại: phải dùng mạng của quán, có ca được phân và khuôn mặt khớp ảnh đã duyệt."
        action={
          <Link to="/quan-ly/nhan-vien/khuon-mat" className="inline-flex items-center gap-1 text-[13px] font-semibold text-[var(--accent)] hover:underline">
            Duyệt khuôn mặt nhân viên <ArrowRight size={13} />
          </Link>
        }
      >
        <SettingRow
          stacked
          label="Mạng của quán"
          description="Chỉ cho chấm công khi điện thoại dùng mạng này. Nhập địa chỉ IP, cách nhau dấu phẩy; để trống = không kiểm tra. Đang ở quán thì bấm “Thêm IP hiện tại”."
          htmlFor="att-nets"
          error={errors.allowedNetworks}
        >
          <TextInput id="att-nets" value={f.allowedNetworks} invalid={Boolean(errors.allowedNetworks)} placeholder="Không kiểm tra mạng" onChange={(e) => set('allowedNetworks', e.target.value)} />
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[12.5px]">
            <Button type="button" size="sm" variant="outline" leadingIcon={<Wifi size={14} />} onClick={addCurrentIp}>Thêm IP hiện tại</Button>
            <span className="text-[var(--text-muted)]">Máy bạn đang dùng IP <b className="font-mono">{q.data?.currentIp}</b>. IP nhà mạng có thể đổi khi khởi động lại modem.</span>
          </div>
        </SettingRow>
        <SettingRow label="Vào ca sớm tối đa" description="Chấm công vào ca sớm hơn giờ bắt đầu ca tối đa bao nhiêu phút (0–180)." htmlFor="att-early" error={errors.earlyMinutes}>
          <UnitInput unit="phút">
            <TextInput id="att-early" type="number" min={0} max={180} value={f.earlyMinutes} invalid={Boolean(errors.earlyMinutes)} onChange={(e) => set('earlyMinutes', e.target.value)} className="w-[96px]" />
          </UnitInput>
        </SettingRow>
        <SettingRow
          label="Độ chặt khi so khuôn mặt – phục vụ"
          description="Số càng nhỏ càng chặt: 0,3 rất chặt – 0,7 dễ. Nên để 0,4."
          htmlFor="att-th"
          error={errors.faceThreshold}
        >
          <TextInput id="att-th" inputMode="decimal" value={f.faceThreshold} invalid={Boolean(errors.faceThreshold)} onChange={(e) => set('faceThreshold', e.target.value)} className="w-[96px]" />
        </SettingRow>
        <SettingRow
          label="Độ chặt khi so khuôn mặt – thu ngân, bếp"
          description="Chặt hơn phục vụ: 0,2 rất chặt (người thật cũng hay bị từ chối) – 0,6 dễ. Nên để 0,3. Ảnh / video trên điện thoại bị chặn ở bước nhắm mắt + quay đầu theo lệnh ngẫu nhiên, không phải ở ngưỡng này."
          htmlFor="att-thc"
          error={errors.faceThresholdCounter}
        >
          <TextInput id="att-thc" inputMode="decimal" value={f.faceThresholdCounter} invalid={Boolean(errors.faceThresholdCounter)} onChange={(e) => set('faceThresholdCounter', e.target.value)} className="w-[96px]" />
        </SettingRow>
        <SettingRow label="Giữ ảnh chấm công" description="Ảnh cũ hơn số ngày này tự xóa; giờ chấm công vẫn giữ (7–365)." htmlFor="att-days" error={errors.photoRetentionDays}>
          <UnitInput unit="ngày">
            <TextInput id="att-days" type="number" min={7} max={365} value={f.photoRetentionDays} invalid={Boolean(errors.photoRetentionDays)} onChange={(e) => set('photoRetentionDays', e.target.value)} className="w-[96px]" />
          </UnitInput>
        </SettingRow>
      </SettingsSection>
      <SettingsSaveBar dirty={d.dirty} saving={save.isPending} errorCount={Object.values(errors).filter(Boolean).length} onSave={() => save.mutate()} onDiscard={() => { d.reset(); setErrors({}); }} />
    </div>
  );
}
