import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { TextInput, Toggle } from '@/components/common/Form';
import { SettingRow, SettingsSaveBar, SettingsSection, UnitInput } from '@/components/common/SettingsParts';
import { Skeleton } from '@/components/common/Skeleton';
import { getOrderingSettings, saveOrderingSettings } from '@/api/ordering';
import { useDraft } from '@/hooks/use-draft';
import { ValidationError } from '@/lib/mock';

const KEY = ['settings', 'ordering'] as const;

/**
 * Cấu hình hệ thống → Gọi món tại bàn: tự đóng bàn đã mở mà khách chưa gọi món sau N phút (0 = tắt); bắt buộc nhân viên
 * phục vụ xác nhận món khách gửi qua QR trước khi chuyển bếp (V22) + số phút chờ trước khi nhắc lại.
 */
export function OrderingSettingsCard() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: KEY, queryFn: getOrderingSettings });
  const d = useDraft(q.data, (x) => ({ minutes: String(x.openTableTimeoutMinutes), requireConfirm: x.requireConfirm, remind: String(x.confirmRemindMinutes) }));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const save = useMutation({
    mutationFn: () => saveOrderingSettings({ openTableTimeoutMinutes: Number(d.draft!.minutes), requireConfirm: d.draft!.requireConfirm, confirmRemindMinutes: Number(d.draft!.remind) }),
    onSuccess: (data) => {
      qc.setQueryData(KEY, data);
      d.commit(data);
      setErrors({});
      toast.success('Đã lưu cấu hình gọi món tại bàn');
    },
    onError: (e) => {
      if (e instanceof ValidationError) setErrors(e.fields);
      else toast.error(e instanceof Error ? e.message : 'Không lưu được');
    },
  });

  if (!d.draft) return <Skeleton className="h-60" />;
  const f = d.draft;
  const change = (patch: Partial<typeof f>) => {
    setErrors({});
    d.set(patch);
  };
  return (
    <div className="space-y-6">
      <SettingsSection title="Gọi món tại bàn" description="Mã QR trên bàn chỉ gửi được món khi thu ngân đã mở bàn.">
        <SettingRow
          label="Tự đóng bàn chưa gọi món"
          description="Bàn đã mở mà khách chưa gọi món sau số phút này thì tự đóng (khách bỏ về, mở nhầm bàn). 0 = không tự đóng."
          htmlFor="open-timeout"
          error={errors.openTableTimeoutMinutes}
        >
          <UnitInput unit="phút">
            <TextInput id="open-timeout" type="number" min={0} max={240} value={f.minutes} invalid={Boolean(errors.openTableTimeoutMinutes)} onChange={(e) => change({ minutes: e.target.value })} className="w-[96px]" />
          </UnitInput>
        </SettingRow>
        <SettingRow label="Phục vụ xác nhận món trước khi chuyển bếp" description="Món khách gửi qua QR chờ phục vụ của khu xác nhận. Tắt khi quán vắng người phục vụ.">
          <Toggle checked={f.requireConfirm} label="Phục vụ xác nhận món trước khi chuyển bếp" onChange={(v) => change({ requireConfirm: v })} />
        </SettingRow>
        {f.requireConfirm ? (
          <SettingRow
            label="Nhắc lại khi chờ quá lâu"
            description="Chờ xác nhận quá số phút này thì báo lại và hiện cho mọi phục vụ đang trong ca (1–60)."
            htmlFor="confirm-remind"
            error={errors.confirmRemindMinutes}
          >
            <UnitInput unit="phút">
              <TextInput id="confirm-remind" type="number" min={1} max={60} value={f.remind} invalid={Boolean(errors.confirmRemindMinutes)} onChange={(e) => change({ remind: e.target.value })} className="w-[96px]" />
            </UnitInput>
          </SettingRow>
        ) : null}
      </SettingsSection>
      <SettingsSaveBar dirty={d.dirty} saving={save.isPending} errorCount={Object.values(errors).filter(Boolean).length} onSave={() => save.mutate()} onDiscard={() => { d.reset(); setErrors({}); }} />
    </div>
  );
}
