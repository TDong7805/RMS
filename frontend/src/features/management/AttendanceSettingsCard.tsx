import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import { ScanFace, Wifi } from 'lucide-react';
import { Card, CardHeader } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { Field, TextInput } from '@/components/common/Form';
import { Skeleton } from '@/components/common/Skeleton';
import { ATTENDANCE_SETTINGS_KEY, getAttendanceSettings, saveAttendanceSettings } from '@/api/attendance-admin';
import { ValidationError } from '@/lib/mock';

type Form = { allowedNetworks: string; earlyMinutes: string; faceThreshold: string; photoRetentionDays: string };

/**
 * Cấu hình hệ thống → Chấm công: WiFi quán (IP / dải mạng được chấm công), vào ca sớm tối đa, độ chặt so khớp khuôn mặt,
 * số ngày giữ ảnh chấm công.
 */
export function AttendanceSettingsCard() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ATTENDANCE_SETTINGS_KEY, queryFn: getAttendanceSettings });
  const [form, setForm] = useState<Form | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  useEffect(() => {
    if (q.data) {
      setForm({
        allowedNetworks: q.data.allowedNetworks,
        earlyMinutes: String(q.data.earlyMinutes),
        faceThreshold: String(q.data.faceThreshold),
        photoRetentionDays: String(q.data.photoRetentionDays),
      });
    }
  }, [q.data]);
  const save = useMutation({
    mutationFn: (f: Form) => saveAttendanceSettings({
      allowedNetworks: f.allowedNetworks,
      earlyMinutes: Number(f.earlyMinutes),
      faceThreshold: Number(f.faceThreshold.replace(',', '.')),
      photoRetentionDays: Number(f.photoRetentionDays),
    }),
    onSuccess: (d) => { qc.setQueryData(ATTENDANCE_SETTINGS_KEY, d); setErrors({}); toast.success('Đã lưu cấu hình chấm công'); },
    onError: (e) => (e instanceof ValidationError ? setErrors(e.fields) : toast.error(e instanceof Error ? e.message : 'Không lưu được')),
  });
  const set = (k: keyof Form, v: string) => { setForm((f) => (f ? { ...f, [k]: v } : f)); setErrors((e) => ({ ...e, [k]: '' })); };
  const addCurrentIp = () => {
    const ip = q.data?.currentIp;
    if (!ip || !form) return;
    const list = form.allowedNetworks.split(/[,;\s]+/).filter(Boolean);
    if (list.includes(ip)) return toast.info(`IP ${ip} đã có trong danh sách`);
    set('allowedNetworks', [...list, ip].join(', '));
  };

  return (
    <Card padded>
      <CardHeader
        title="Chấm công bằng khuôn mặt"
        icon={<ScanFace size={17} />}
        description="Áp dụng cho phục vụ, thu ngân, bếp. Nhân viên tự chấm công trên điện thoại: phải dùng WiFi của quán, có ca được phân và khuôn mặt khớp với ảnh đã duyệt."
      />
      {!form ? (
        <Skeleton className="mt-4 h-60" />
      ) : (
        <form className="mt-4 grid gap-4" onSubmit={(e) => { e.preventDefault(); save.mutate(form); }}>
          <Field
            label="WiFi của quán (IP / dải mạng)"
            htmlFor="att-nets"
            error={errors.allowedNetworks}
            hint="Cách nhau dấu phẩy, vd. 113.161.20.5, 192.168.1.0/24. Để trống = không kiểm tra. Khi web chạy trên máy chủ internet, dùng IP công cộng của mạng quán (bấm nút bên dưới khi đang ở quán). IP nhà mạng có thể đổi khi khởi động lại modem."
          >
            <TextInput id="att-nets" value={form.allowedNetworks} invalid={Boolean(errors.allowedNetworks)} placeholder="Không kiểm tra WiFi" onChange={(e) => set('allowedNetworks', e.target.value)} />
          </Field>
          <div className="-mt-2 flex flex-wrap items-center gap-2 text-[13px]">
            <Button type="button" size="sm" variant="outline" leadingIcon={<Wifi size={14} />} onClick={addCurrentIp}>Thêm IP hiện tại</Button>
            <span className="text-[var(--text-muted)]">Máy bạn đang dùng IP <b className="font-mono">{q.data?.currentIp}</b></span>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Vào ca sớm tối đa (phút)" htmlFor="att-early" error={errors.earlyMinutes} hint="0 – 180">
              <TextInput id="att-early" type="number" min={0} max={180} value={form.earlyMinutes} invalid={Boolean(errors.earlyMinutes)} onChange={(e) => set('earlyMinutes', e.target.value)} />
            </Field>
            <Field label="Ngưỡng so khớp khuôn mặt" htmlFor="att-th" error={errors.faceThreshold} hint="0,3 chặt – 0,7 dễ; khuyên dùng 0,4 (đúng người thường dưới 0,3; người khác có thể chỉ 0,45–0,55)">
              <TextInput id="att-th" inputMode="decimal" value={form.faceThreshold} invalid={Boolean(errors.faceThreshold)} onChange={(e) => set('faceThreshold', e.target.value)} />
            </Field>
            <Field label="Giữ ảnh chấm công (ngày)" htmlFor="att-days" error={errors.photoRetentionDays} hint="7 – 365; giờ chấm công vẫn giữ">
              <TextInput id="att-days" type="number" min={7} max={365} value={form.photoRetentionDays} invalid={Boolean(errors.photoRetentionDays)} onChange={(e) => set('photoRetentionDays', e.target.value)} />
            </Field>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" loading={save.isPending}>Lưu</Button>
            <Link to="/quan-ly/nhan-vien/khuon-mat" className="text-[13.5px] font-semibold text-[var(--accent)] hover:underline">Duyệt khuôn mặt nhân viên →</Link>
          </div>
        </form>
      )}
    </Card>
  );
}
