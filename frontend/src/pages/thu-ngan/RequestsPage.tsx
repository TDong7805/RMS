import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { BellRing, Check, Clock3, Forward, Receipt, X } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { Card } from '@/components/common/Card';
import { Badge } from '@/components/common/Badge';
import { Button } from '@/components/common/Button';
import { BlockError, EmptyState } from '@/components/common/EmptyState';
import { Field, SelectInput } from '@/components/common/Form';
import { Modal } from '@/components/common/Modal';
import { PageHeader, PageTabs, TableSkeleton } from '@/components/common/PageParts';
import { cancelRequest, CASHIER_STREAM, completeRequest, forwardRequest, getRequests, getStaffOptions } from '@/api/ordering';
import { beep, useLiveEvents } from '@/features/ordering/live';
import { PAY_METHOD_LABEL } from '@/features/ordering/CashierDialogs';
import { REQUEST_TYPE_LABEL } from '@/features/ordering/QrService';
import { minutesSince, REQUEST_STATUS } from '@/features/ordering/cashierParts';
import { formatDateTime } from '@/lib/labels';
import { cn } from '@/lib/cn';
import type { ServiceRequest } from '@/types';

type Tab = 'waiting' | 'done' | 'cancelled';
const KEY = (tab: Tab) => ['thu-ngan', 'requests', tab] as const;

/** UC-TN-06: yêu cầu của khách (Gọi nhân viên, Yêu cầu thanh toán) — chuyển cho nhân viên, hoàn thành, hủy. */
export default function RequestsPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>('waiting');
  const list = useQuery({ queryKey: KEY(tab), queryFn: () => getRequests(tab), refetchInterval: 10_000 });
  useLiveEvents(CASHIER_STREAM, [['thu-ngan', 'requests'], ['thu-ngan', 'floor']]);
  const [forwarding, setForwarding] = useState<ServiceRequest | null>(null);
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((x) => x + 1), 30_000);
    return () => clearInterval(t);
  }, []);

  // Âm báo khi có yêu cầu Mới xuất hiện.
  const seen = useRef<Set<string> | null>(null);
  useEffect(() => {
    if (tab !== 'waiting' || !list.data) return;
    const ids = new Set(list.data.items.filter((r) => r.status === 'new').map((r) => r.id));
    if (seen.current && [...ids].some((id) => !seen.current!.has(id))) beep();
    seen.current = ids;
  }, [list.data, tab]);

  const after = (msg: string) => () => {
    toast.success(msg);
    void qc.invalidateQueries({ queryKey: ['thu-ngan', 'requests'] });
    void qc.invalidateQueries({ queryKey: ['thu-ngan', 'floor'] });
  };
  const onError = (e: unknown) => {
    toast.error(e instanceof Error ? e.message : 'Không lưu được');
    void qc.invalidateQueries({ queryKey: ['thu-ngan', 'requests'] });
  };
  const done = useMutation({ mutationFn: completeRequest, onSuccess: after('Đã hoàn thành yêu cầu'), onError });
  const cancel = useMutation({ mutationFn: cancelRequest, onSuccess: after('Đã hủy yêu cầu'), onError });

  return (
    <AppShell meta={{ label: 'Yêu cầu của khách' }}>
      <div className="min-w-0 space-y-4">
        <PageHeader title="Yêu cầu của khách" description="Khách bấm Gọi nhân viên / Yêu cầu thanh toán trên trang đặt món. Yêu cầu chờ quá 5 phút được tô đỏ." />
        <PageTabs<Tab>
          ariaLabel="Trạng thái yêu cầu"
          value={tab}
          onChange={setTab}
          items={[
            { value: 'waiting', label: list.data ? `Đang chờ (${list.data.waitingCount})` : 'Đang chờ' },
            { value: 'done', label: 'Hoàn thành' },
            { value: 'cancelled', label: 'Đã hủy' },
          ]}
        />
        <Card className="overflow-hidden">
          {list.isError ? (
            <div className="p-5"><BlockError onRetry={() => void list.refetch()} retrying={list.isFetching} /></div>
          ) : !list.data ? (
            <TableSkeleton cols={5} />
          ) : list.data.items.length === 0 ? (
            <div className="p-5"><EmptyState icon={BellRing} title={tab === 'waiting' ? 'Không có yêu cầu nào đang chờ' : 'Chưa có yêu cầu'} /></div>
          ) : (
            <ul className="divide-y divide-[var(--border)]">
              {list.data.items.map((r) => {
                const wait = minutesSince(r.createdAt);
                const late = tab === 'waiting' && wait >= 5;
                return (
                  <li key={r.id} className={cn('flex flex-wrap items-center gap-3 px-5 py-3.5', late && 'bg-[var(--danger-soft)]')}>
                    <div className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-full', r.type === 'payment' ? 'bg-[var(--accent-soft)] text-[var(--accent)]' : 'bg-[var(--warning-soft)] text-[var(--warning)]')}>
                      {r.type === 'payment' ? <Receipt size={18} /> : <BellRing size={18} />}
                    </div>
                    <div className="min-w-[220px] flex-1">
                      <p className="text-[15px] font-bold">
                        Bàn {r.tableCode} <span className="text-[13px] font-medium text-[var(--text-muted)]">· {r.areaName}</span>
                        <span className="ml-2 align-middle"><Badge variant={REQUEST_STATUS[r.status].variant}>{REQUEST_STATUS[r.status].label}</Badge></span>
                      </p>
                      <p className="text-[13.5px]">
                        <b>{REQUEST_TYPE_LABEL[r.type]}</b>
                        {r.type === 'payment'
                          ? ` · ${PAY_METHOD_LABEL[r.paymentMethod ?? 'cash']}${r.vatCompany ? ` · VAT: ${r.vatCompany} (${r.vatTaxCode})` : ''}`
                          : r.content ? ` · ${r.content}` : ''}
                      </p>
                      <p className="text-[12.5px] text-[var(--text-muted)]">
                        <Clock3 size={12} className="mr-1 inline" />
                        {formatDateTime(r.createdAt)}
                        {tab === 'waiting' ? <span className={cn('ml-1', late && 'font-semibold text-[var(--danger)]')}>· chờ {wait} phút</span> : null}
                        {r.assignedName ? ` · Phụ trách: ${r.assignedName}` : ''}
                        {r.doneAt ? ` · Xong ${formatDateTime(r.doneAt)}` : ''}
                      </p>
                    </div>
                    {tab === 'waiting' ? (
                      <div className="flex flex-wrap gap-2">
                        {r.type === 'payment' ? (
                          r.orderId ? (
                            <Button size="sm" leadingIcon={<Receipt size={15} />} onClick={() => navigate(`/thu-ngan/don/${r.orderId}`)}>
                              {r.invoiceId ? 'Thu tiền' : 'Lập hóa đơn'}
                            </Button>
                          ) : null
                        ) : (
                          <>
                            <Button size="sm" variant="outline" leadingIcon={<Forward size={15} />} onClick={() => setForwarding(r)}>
                              {r.status === 'forwarded' ? 'Chuyển lại' : 'Chuyển'}
                            </Button>
                            <Button size="sm" leadingIcon={<Check size={15} />} loading={done.isPending && done.variables === r.id} onClick={() => done.mutate(r.id)}>Hoàn thành</Button>
                          </>
                        )}
                        <Button size="sm" variant="ghost" aria-label={`Hủy yêu cầu bàn ${r.tableCode}`} loading={cancel.isPending && cancel.variables === r.id} onClick={() => cancel.mutate(r.id)}>
                          <X size={15} />
                        </Button>
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>
      <ForwardDialog request={forwarding} onClose={() => setForwarding(null)} onDone={after('Đã chuyển yêu cầu')} onError={onError} />
    </AppShell>
  );
}

function ForwardDialog({ request, onClose, onDone, onError }: { request: ServiceRequest | null; onClose: () => void; onDone: () => void; onError: (e: unknown) => void }) {
  const staff = useQuery({ queryKey: ['thu-ngan', 'staff'], queryFn: getStaffOptions, enabled: Boolean(request), staleTime: 60_000 });
  const [staffId, setStaffId] = useState('');
  useEffect(() => setStaffId(''), [request]);
  const m = useMutation({
    mutationFn: () => forwardRequest(request!.id, staffId),
    onSuccess: () => {
      onDone();
      onClose();
    },
    onError: (e) => {
      onError(e);
      onClose();
    },
  });
  return (
    <Modal
      open={Boolean(request)}
      onOpenChange={(o) => !o && onClose()}
      size="sm"
      title={request ? `Chuyển yêu cầu – bàn ${request.tableCode}` : ''}
      description={request ? `${REQUEST_TYPE_LABEL[request.type]}${request.content ? ` · ${request.content}` : ''}` : undefined}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Đóng</Button>
          <Button disabled={!staffId} loading={m.isPending} onClick={() => m.mutate()}>Chuyển</Button>
        </>
      }
    >
      <Field label="Nhân viên phụ trách" required hint="Nhân viên không đăng nhập — thu ngân báo trực tiếp (gọi, bộ đàm).">
        <SelectInput
          value={staffId}
          onChange={(e) => setStaffId(e.target.value)}
          placeholder="Chọn nhân viên"
          options={(staff.data ?? []).map((s) => ({ value: s.id, label: `${s.name} – ${s.roleName}` }))}
          aria-label="Nhân viên phụ trách"
        />
      </Field>
    </Modal>
  );
}
