import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Landmark, Save } from 'lucide-react';
import { Card, CardHeader } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { BlockError } from '@/components/common/EmptyState';
import { Field, SelectInput, TextInput } from '@/components/common/Form';
import { Skeleton } from '@/components/common/Skeleton';
import { getBankAccount, saveBankAccount } from '@/api/ordering';
import { ValidationError } from '@/lib/mock';

/** Mã ngân hàng (BIN Napas) phổ biến để tạo mã QR chuyển khoản VietQR. */
export const BANKS: { bin: string; name: string }[] = [
  { bin: '970436', name: 'Vietcombank' },
  { bin: '970415', name: 'VietinBank' },
  { bin: '970418', name: 'BIDV' },
  { bin: '970405', name: 'Agribank' },
  { bin: '970407', name: 'Techcombank' },
  { bin: '970422', name: 'MB Bank' },
  { bin: '970416', name: 'ACB' },
  { bin: '970432', name: 'VPBank' },
  { bin: '970423', name: 'TPBank' },
  { bin: '970403', name: 'Sacombank' },
  { bin: '970437', name: 'HDBank' },
  { bin: '970441', name: 'VIB' },
  { bin: '970443', name: 'SHB' },
  { bin: '970431', name: 'Eximbank' },
  { bin: '970426', name: 'MSB' },
  { bin: '970448', name: 'OCB' },
  { bin: '970454', name: 'Bản Việt' },
  { bin: '970449', name: 'LPBank' },
];

const KEY = ['settings', 'payment'] as const;

/** Cấu hình hệ thống → Thanh toán: tài khoản nhận tiền dùng tạo mã QR trên hóa đơn và trang đặt món của khách. */
export function PaymentSettingsCard() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: KEY, queryFn: getBankAccount });
  const [bin, setBin] = useState('');
  const [accountNo, setAccountNo] = useState('');
  const [accountName, setAccountName] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  useEffect(() => {
    if (q.data) {
      setBin(q.data.bankBin);
      setAccountNo(q.data.accountNo);
      setAccountName(q.data.accountName);
    }
  }, [q.data]);
  const save = useMutation({
    mutationFn: (clear: boolean) =>
      saveBankAccount(
        clear
          ? { bankBin: '', bankName: '', accountNo: '', accountName: '' }
          : { bankBin: bin, bankName: BANKS.find((b) => b.bin === bin)?.name ?? '', accountNo, accountName },
      ),
    onSuccess: (data) => {
      qc.setQueryData(KEY, data);
      setErrors({});
      toast.success(data.configured ? 'Đã lưu tài khoản nhận tiền' : 'Đã xóa tài khoản nhận tiền');
    },
    onError: (e) => {
      if (e instanceof ValidationError) setErrors(e.fields);
      else toast.error(e instanceof Error ? e.message : 'Không lưu được');
    },
  });
  const sample = useMemo(() => {
    const d = q.data;
    if (!d?.configured) return null;
    return { bankName: d.bankName, accountNo: d.accountNo, accountName: d.accountName };
  }, [q.data]);

  if (q.isError) return <BlockError onRetry={() => void q.refetch()} retrying={q.isFetching} />;
  if (!q.data) return <Skeleton className="h-72" />;
  return (
    <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
      <Card padded>
        <CardHeader
          title="Tài khoản nhận tiền"
          icon={<Landmark size={17} />}
          description="Dùng tạo mã QR chuyển khoản (VietQR) có sẵn số tiền và nội dung = mã hóa đơn. Khách quét bằng ứng dụng ngân hàng; Thu ngân kiểm tra tiền về rồi xác nhận."
        />
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Ngân hàng" required error={errors.bankBin} htmlFor="pay-bank">
            <SelectInput
              id="pay-bank"
              value={bin}
              onChange={(e) => setBin(e.target.value)}
              placeholder="Chọn ngân hàng"
              options={BANKS.map((b) => ({ value: b.bin, label: `${b.name} (${b.bin})` }))}
              invalid={Boolean(errors.bankBin)}
            />
          </Field>
          <Field label="Số tài khoản" required error={errors.accountNo} htmlFor="pay-acc">
            <TextInput id="pay-acc" value={accountNo} maxLength={19} onChange={(e) => setAccountNo(e.target.value.replace(/\s/g, ''))} invalid={Boolean(errors.accountNo)} inputMode="numeric" />
          </Field>
          <Field label="Tên chủ tài khoản" required error={errors.accountName} hint="Tự chuyển thành chữ in hoa không dấu như trên ứng dụng ngân hàng." htmlFor="pay-name" className="sm:col-span-2">
            <TextInput id="pay-name" value={accountName} maxLength={50} onChange={(e) => setAccountName(e.target.value)} invalid={Boolean(errors.accountName)} />
          </Field>
        </div>
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          {q.data.configured ? (
            <Button variant="ghost" disabled={save.isPending} onClick={() => save.mutate(true)}>Xóa tài khoản</Button>
          ) : null}
          <Button leadingIcon={<Save size={15} />} loading={save.isPending} onClick={() => save.mutate(false)}>Lưu</Button>
        </div>
      </Card>
      <Card padded className="h-fit">
        <CardHeader title="Xem trước" description={sample ? 'Thông tin hiện trên hóa đơn chờ thanh toán.' : 'Chưa cấu hình: hóa đơn không có mã QR chuyển khoản.'} />
        {sample ? (
          <div className="mt-3">
            <PreviewQr sample={sample} />
          </div>
        ) : null}
      </Card>
    </div>
  );
}

function PreviewQr({ sample }: { sample: { bankName: string; accountNo: string; accountName: string } }) {
  return (
    <dl className="space-y-1.5 rounded-item border border-[var(--border)] p-3 text-[13.5px]">
      <div className="flex justify-between gap-3"><dt className="text-[var(--text-muted)]">Ngân hàng</dt><dd className="font-semibold">{sample.bankName}</dd></div>
      <div className="flex justify-between gap-3"><dt className="text-[var(--text-muted)]">Số tài khoản</dt><dd className="font-mono font-semibold">{sample.accountNo}</dd></div>
      <div className="flex justify-between gap-3"><dt className="text-[var(--text-muted)]">Chủ tài khoản</dt><dd className="font-semibold">{sample.accountName}</dd></div>
      <p className="pt-1 text-[12px] text-[var(--text-muted)]">Mã QR trên mỗi hóa đơn có sẵn số tiền và nội dung = mã hóa đơn.</p>
    </dl>
  );
}
