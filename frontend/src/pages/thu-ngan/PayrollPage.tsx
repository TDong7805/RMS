import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Wallet } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { Card } from '@/components/common/Card';
import { Badge } from '@/components/common/Badge';
import { Button } from '@/components/common/Button';
import { BlockError, EmptyState } from '@/components/common/EmptyState';
import { Field, TextInput } from '@/components/common/Form';
import { Modal } from '@/components/common/Modal';
import { DataTable, PageHeader, TableSkeleton, Td, Th } from '@/components/common/PageParts';
import { createPayrollPeriod, getPayrollPeriods } from '@/api/payroll';
import { todayKey } from '@/features/ordering/cashierParts';
import { formatCurrency } from '@/lib/format';
import { formatDateTime } from '@/lib/labels';
import { ValidationError } from '@/lib/mock';

const dmy = (iso: string) => iso.split('-').reverse().join('/');

/** Kỳ mặc định: tháng trước (thường tính lương sau khi tháng kết thúc). */
function defaultRange() {
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const last = new Date(now.getFullYear(), now.getMonth(), 0);
  const k = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return { start: k(first), end: k(last), name: `Tháng ${String(first.getMonth() + 1).padStart(2, '0')}/${first.getFullYear()}` };
}

/** UC-TN-12: danh sách kỳ lương, tạo kỳ mới. */
export default function PayrollPage() {
  const navigate = useNavigate();
  const list = useQuery({ queryKey: ['thu-ngan', 'payroll'], queryFn: getPayrollPeriods });
  const [creating, setCreating] = useState(false);

  return (
    <AppShell meta={{ label: 'Bảng lương', parent: 'Nhân sự' }}>
      <div className="min-w-0 space-y-4">
        <PageHeader
          title="Bảng lương"
          description="Tạo kỳ lương, hệ thống tính lương từ chấm công. Thực lĩnh = Giờ công × Lương theo giờ + Lương cơ bản + Phụ cấp − Khấu trừ."
          actions={<Button size="sm" leadingIcon={<Plus size={15} />} onClick={() => setCreating(true)}>Tạo kỳ lương</Button>}
        />
        <Card className="overflow-hidden">
          {list.isError ? (
            <div className="p-5"><BlockError onRetry={() => void list.refetch()} retrying={list.isFetching} /></div>
          ) : !list.data ? (
            <TableSkeleton cols={6} />
          ) : list.data.length === 0 ? (
            <div className="p-5"><EmptyState icon={Wallet} title="Chưa có kỳ lương nào" description="Bấm “Tạo kỳ lương” để tính lương từ chấm công." /></div>
          ) : (
            <DataTable minWidth={860}>
              <thead>
                <tr><Th>Kỳ lương</Th><Th>Khoảng ngày</Th><Th className="text-right">Nhân viên</Th><Th className="text-right">Tổng lương</Th><Th>Trạng thái</Th><Th>Chốt</Th></tr>
              </thead>
              <tbody>
                {list.data.map((p) => (
                  <tr key={p.id} className="cursor-pointer hover:bg-[var(--bg-subtle)]" onClick={() => navigate(`/thu-ngan/bang-luong/${p.id}`)}>
                    <Td><button type="button" className="font-semibold hover:text-[var(--accent)]">{p.name}</button></Td>
                    <Td className="whitespace-nowrap font-mono text-[13px]">{dmy(p.startDate)} – {dmy(p.endDate)}</Td>
                    <Td className="text-right font-mono">{p.employeeCount}</Td>
                    <Td className="text-right font-mono font-semibold">{formatCurrency(p.total)}</Td>
                    <Td><Badge variant={p.status === 'closed' ? 'accent' : 'warning'}>{p.status === 'closed' ? 'Đã chốt' : 'Nháp'}</Badge></Td>
                    <Td className="text-[13px] text-[var(--text-secondary)]">{p.closedAt ? `${p.closedBy ?? ''} · ${formatDateTime(p.closedAt)}` : '—'}</Td>
                  </tr>
                ))}
              </tbody>
            </DataTable>
          )}
        </Card>
      </div>
      <CreatePeriodDialog open={creating} onClose={() => setCreating(false)} onCreated={(id) => navigate(`/thu-ngan/bang-luong/${id}`)} />
    </AppShell>
  );
}

function CreatePeriodDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (id: string) => void }) {
  const qc = useQueryClient();
  const def = defaultRange();
  const [name, setName] = useState(def.name);
  const [start, setStart] = useState(def.start);
  const [end, setEnd] = useState(def.end);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const m = useMutation({
    mutationFn: () => createPayrollPeriod({ name, startDate: start, endDate: end }),
    onSuccess: (d) => {
      toast.success(`Đã tạo kỳ lương ${d.period.name}`);
      void qc.invalidateQueries({ queryKey: ['thu-ngan', 'payroll'] });
      onClose();
      onCreated(d.period.id);
    },
    onError: (e) => {
      if (e instanceof ValidationError) setErrors(e.fields);
      else toast.error(e instanceof Error ? e.message : 'Không tạo được kỳ lương');
    },
  });
  return (
    <Modal
      open={open}
      onOpenChange={(o) => !o && onClose()}
      size="sm"
      title="Tạo kỳ lương"
      description="Hệ thống tính lương cho mọi nhân viên có chấm công hoặc có lương cơ bản trong kỳ."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Hủy</Button>
          <Button loading={m.isPending} onClick={() => m.mutate()}>Tạo và tính lương</Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="Tên kỳ" error={errors.name} htmlFor="pp-name">
          <TextInput id="pp-name" value={name} maxLength={50} onChange={(e) => setName(e.target.value)} invalid={Boolean(errors.name)} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Từ ngày" required error={errors.startDate} htmlFor="pp-start">
            <TextInput id="pp-start" type="date" value={start} max={todayKey()} onChange={(e) => setStart(e.target.value)} invalid={Boolean(errors.startDate)} />
          </Field>
          <Field label="Đến ngày" required error={errors.endDate} htmlFor="pp-end">
            <TextInput id="pp-end" type="date" value={end} min={start} onChange={(e) => setEnd(e.target.value)} invalid={Boolean(errors.endDate)} />
          </Field>
        </div>
      </div>
    </Modal>
  );
}
