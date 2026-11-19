import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Card, CardHeader } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { Field, TextInput } from '@/components/common/Form';
import { Skeleton } from '@/components/common/Skeleton';
import { getOrderingSettings, saveOrderingSettings } from '@/api/ordering';
import { ValidationError } from '@/lib/mock';

const KEY = ['settings', 'ordering'] as const;

/** Cấu hình hệ thống → Gọi món tại bàn: tự đóng bàn thu ngân đã mở mà khách chưa gọi món sau N phút (0 = tắt). */
export function OrderingSettingsCard() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: KEY, queryFn: getOrderingSettings });
  const [minutes, setMinutes] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    if (q.data) setMinutes(String(q.data.openTableTimeoutMinutes));
  }, [q.data]);
  const save = useMutation({
    mutationFn: () => saveOrderingSettings(Number(minutes)),
    onSuccess: (d) => {
      qc.setQueryData(KEY, d);
      setError('');
      toast.success(d.openTableTimeoutMinutes ? `Bàn mở quá ${d.openTableTimeoutMinutes} phút chưa gọi món sẽ tự đóng` : 'Đã tắt tự đóng bàn');
    },
    onError: (e) => {
      if (e instanceof ValidationError) setError(e.fields.openTableTimeoutMinutes ?? e.message);
      else toast.error(e instanceof Error ? e.message : 'Không lưu được');
    },
  });
  return (
    <Card padded>
      <CardHeader title="Gọi món tại bàn" description="Mã QR trên bàn chỉ gửi được món khi thu ngân đã mở bàn. Bàn mở mà khách chưa gọi món sau số phút dưới đây sẽ tự đóng (khách bỏ về, mở nhầm bàn)." />
      {q.isLoading ? (
        <Skeleton className="mt-3 h-10" />
      ) : (
        <form
          className="mt-3 flex flex-wrap items-start gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          <Field label="Tự đóng bàn chưa gọi món sau (phút)" htmlFor="open-timeout" error={error} hint="0 = không tự đóng; tối đa 240 phút" className="w-[260px]">
            <TextInput id="open-timeout" type="number" min={0} max={240} value={minutes} invalid={Boolean(error)} onChange={(e) => { setError(''); setMinutes(e.target.value); }} />
          </Field>
          <Button type="submit" className="mt-[26px]" loading={save.isPending}>Lưu</Button>
        </form>
      )}
    </Card>
  );
}
