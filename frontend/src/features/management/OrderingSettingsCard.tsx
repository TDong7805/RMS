import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Card, CardHeader } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { Field, TextInput, ToggleRow } from '@/components/common/Form';
import { Skeleton } from '@/components/common/Skeleton';
import { getOrderingSettings, saveOrderingSettings } from '@/api/ordering';
import { ValidationError } from '@/lib/mock';

const KEY = ['settings', 'ordering'] as const;

/**
 * Cấu hình hệ thống → Gọi món tại bàn: tự đóng bàn đã mở mà khách chưa gọi món sau N phút (0 = tắt); bắt buộc nhân viên
 * phục vụ xác nhận món khách gửi qua QR trước khi chuyển bếp (V22) + số phút chờ trước khi nhắc lại.
 */
export function OrderingSettingsCard() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: KEY, queryFn: getOrderingSettings });
  const [minutes, setMinutes] = useState('');
  const [requireConfirm, setRequireConfirm] = useState(true);
  const [remind, setRemind] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  useEffect(() => {
    if (q.data) {
      setMinutes(String(q.data.openTableTimeoutMinutes));
      setRequireConfirm(q.data.requireConfirm);
      setRemind(String(q.data.confirmRemindMinutes));
    }
  }, [q.data]);
  const save = useMutation({
    mutationFn: () => saveOrderingSettings({ openTableTimeoutMinutes: Number(minutes), requireConfirm, confirmRemindMinutes: Number(remind) }),
    onSuccess: (d) => {
      qc.setQueryData(KEY, d);
      setErrors({});
      toast.success('Đã lưu cấu hình gọi món tại bàn');
    },
    onError: (e) => {
      if (e instanceof ValidationError) setErrors(e.fields);
      else toast.error(e instanceof Error ? e.message : 'Không lưu được');
    },
  });
  return (
    <Card padded>
      <CardHeader title="Gọi món tại bàn" description="Mã QR trên bàn chỉ gửi được món khi thu ngân / phục vụ đã mở bàn." />
      {q.isLoading ? (
        <Skeleton className="mt-3 h-10" />
      ) : (
        <form
          className="mt-3 grid gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          <Field label="Tự đóng bàn chưa gọi món sau (phút)" htmlFor="open-timeout" error={errors.openTableTimeoutMinutes} hint="0 = không tự đóng; tối đa 240 phút (khách bỏ về, mở nhầm bàn)">
            <TextInput id="open-timeout" type="number" min={0} max={240} value={minutes} invalid={Boolean(errors.openTableTimeoutMinutes)} onChange={(e) => { setErrors({}); setMinutes(e.target.value); }} className="w-[160px]" />
          </Field>
          <ToggleRow
            title="Nhân viên phục vụ xác nhận đơn trước khi chuyển bếp"
            description="Món khách gửi qua QR chờ phục vụ đã vào ca của khu xác nhận (ghi tên người xác nhận). Tắt khi quán vắng người phục vụ."
            checked={requireConfirm}
            onChange={setRequireConfirm}
          />
          {requireConfirm ? (
            <Field label="Nhắc lại sau (phút)" htmlFor="confirm-remind" error={errors.confirmRemindMinutes} hint="Chờ xác nhận quá số phút này: báo lại và hiện cho mọi phục vụ đã vào ca (1–60)">
              <TextInput id="confirm-remind" type="number" min={1} max={60} value={remind} invalid={Boolean(errors.confirmRemindMinutes)} onChange={(e) => { setErrors({}); setRemind(e.target.value); }} className="w-[160px]" />
            </Field>
          ) : null}
          <div><Button type="submit" loading={save.isPending}>Lưu</Button></div>
        </form>
      )}
    </Card>
  );
}
