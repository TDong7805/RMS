import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/common/Button';
import { BlockError } from '@/components/common/EmptyState';
import { SelectInput, TextInput } from '@/components/common/Form';
import { ConfirmDialog } from '@/components/common/Modal';
import { SettingRow, SettingsSaveBar, SettingsSection } from '@/components/common/SettingsParts';
import { Skeleton } from '@/components/common/Skeleton';
import { getBankAccount, saveBankAccount } from '@/api/ordering';
import { useDraft } from '@/hooks/use-draft';
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
  const d = useDraft(q.data, (x) => ({ bin: x.bankBin, accountNo: x.accountNo, accountName: x.accountName }));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [askClear, setAskClear] = useState(false);
  const save = useMutation({
    mutationFn: (clear: boolean) => {
      const f = d.draft!;
      return saveBankAccount(
        clear
          ? { bankBin: '', bankName: '', accountNo: '', accountName: '' }
          : { bankBin: f.bin, bankName: BANKS.find((b) => b.bin === f.bin)?.name ?? '', accountNo: f.accountNo, accountName: f.accountName },
      );
    },
    onSuccess: (data) => {
      qc.setQueryData(KEY, data);
      d.commit(data);
      setErrors({});
      setAskClear(false);
      toast.success(data.configured ? 'Đã lưu tài khoản nhận tiền' : 'Đã xóa tài khoản nhận tiền');
    },
    onError: (e) => {
      if (e instanceof ValidationError) setErrors(e.fields);
      else toast.error(e instanceof Error ? e.message : 'Không lưu được');
    },
  });

  if (q.isError) return <BlockError onRetry={() => void q.refetch()} retrying={q.isFetching} />;
  if (!q.data || !d.draft) return <Skeleton className="h-72" />;
  const f = d.draft;
  const set = (k: keyof typeof f, v: string) => { d.set({ [k]: v }); setErrors((e) => ({ ...e, [k === 'bin' ? 'bankBin' : k]: '' })); };
  const saved = q.data.configured ? q.data : null;

  return (
    <div className="space-y-6">
      <SettingsSection
        title="Tài khoản nhận tiền"
        description="Dùng tạo mã QR chuyển khoản trên hóa đơn, có sẵn số tiền và nội dung là mã hóa đơn. Thu ngân kiểm tra tiền về rồi xác nhận."
      >
        <SettingRow label="Ngân hàng" htmlFor="pay-bank" error={errors.bankBin}>
          <SelectInput
            id="pay-bank"
            value={f.bin}
            onChange={(e) => set('bin', e.target.value)}
            placeholder="Chọn ngân hàng"
            options={BANKS.map((b) => ({ value: b.bin, label: b.name }))}
            invalid={Boolean(errors.bankBin)}
            className="w-[240px]"
          />
        </SettingRow>
        <SettingRow label="Số tài khoản" htmlFor="pay-acc" error={errors.accountNo}>
          <TextInput id="pay-acc" value={f.accountNo} maxLength={19} onChange={(e) => set('accountNo', e.target.value.replace(/\s/g, ''))} invalid={Boolean(errors.accountNo)} inputMode="numeric" className="w-[240px] font-mono" />
        </SettingRow>
        <SettingRow label="Tên chủ tài khoản" description="Tự chuyển thành chữ in hoa không dấu như trên ứng dụng ngân hàng." htmlFor="pay-name" error={errors.accountName}>
          <TextInput id="pay-name" value={f.accountName} maxLength={50} onChange={(e) => set('accountName', e.target.value)} invalid={Boolean(errors.accountName)} className="w-[240px]" />
        </SettingRow>
      </SettingsSection>

      <SettingsSection title="Đang dùng trên hóa đơn" description={saved ? 'Thông tin hiện trên hóa đơn chờ thanh toán.' : 'Chưa có tài khoản: hóa đơn không có mã QR chuyển khoản.'}>
        {saved ? (
          <>
            <SettingRow label="Ngân hàng"><span className="font-semibold">{saved.bankName}</span></SettingRow>
            <SettingRow label="Số tài khoản"><span className="font-mono font-semibold">{saved.accountNo}</span></SettingRow>
            <SettingRow label="Chủ tài khoản"><span className="font-semibold">{saved.accountName}</span></SettingRow>
            <SettingRow label="Bỏ tài khoản nhận tiền" description="Hóa đơn sẽ không còn mã QR chuyển khoản; khách trả tiền mặt hoặc thẻ.">
              <Button variant="outline" size="sm" className="border-[var(--danger)]/40 text-[var(--danger)] hover:bg-[var(--danger-soft)]" onClick={() => setAskClear(true)}>Bỏ tài khoản</Button>
            </SettingRow>
          </>
        ) : (
          <p className="px-5 py-4 text-[13px] text-[var(--text-muted)]">Nhập ngân hàng, số tài khoản và tên chủ tài khoản ở trên rồi bấm Lưu.</p>
        )}
      </SettingsSection>

      <SettingsSaveBar dirty={d.dirty} saving={save.isPending} errorCount={Object.values(errors).filter(Boolean).length} onSave={() => save.mutate(false)} onDiscard={() => { d.reset(); setErrors({}); }} />
      <ConfirmDialog
        open={askClear}
        onOpenChange={setAskClear}
        title="Bỏ tài khoản nhận tiền?"
        description="Hóa đơn và trang gọi món của khách sẽ không còn mã QR chuyển khoản cho tới khi bạn nhập lại tài khoản."
        confirmLabel="Bỏ tài khoản"
        loading={save.isPending}
        onConfirm={() => save.mutate(true)}
      />
    </div>
  );
}
