import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Clock3, Receipt, X } from 'lucide-react';
import { CashierShell } from '@/features/ordering/CashierShell';
import { Card } from '@/components/common/Card';
import { Badge } from '@/components/common/Badge';
import { Button } from '@/components/common/Button';
import { BlockError, EmptyState } from '@/components/common/EmptyState';
import { PageHeader, PageTabs, TableSkeleton } from '@/components/common/PageParts';
import { cancelRequest, CASHIER_STREAM, getRequests } from '@/api/ordering';
import { beep, useLiveEvents } from '@/features/ordering/live';
import { PAY_METHOD_LABEL } from '@/features/ordering/CashierDialogs';
import { REQUEST_TYPE_LABEL } from '@/features/ordering/requestLabels';
import { minutesSince, REQUEST_STATUS } from '@/features/ordering/cashierParts';
import { formatDateTime } from '@/lib/labels';
import { cn } from '@/lib/cn';

type Tab = 'waiting' | 'done' | 'cancelled';
const KEY = (tab: Tab) => ['thu-ngan', 'requests', tab] as const;

/**
 * UC-TN-06: yêu cầu THANH TOÁN của khách → lập hóa đơn / thu tiền. Từ V20 yêu cầu Gọi nhân viên do Nhân viên phục vụ
 * nhận theo khu vực (khu Phục vụ), thu ngân không còn xử lý.
 */
export default function RequestsPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>('waiting');
  const list = useQuery({ queryKey: KEY(tab), queryFn: () => getRequests(tab), refetchInterval: 10_000 });
  useLiveEvents(CASHIER_STREAM, [['thu-ngan', 'requests'], ['thu-ngan', 'floor']]);
  const [params, setParams] = useSearchParams();
  const focusId = params.get('id') ?? '';
  const [flashId, setFlashId] = useState('');
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

  // Mở từ thông báo / sơ đồ bàn (?id=…): cuộn tới yêu cầu đó và cho dòng sáng nhấp nháy.
  useEffect(() => {
    if (!focusId || !list.data) return;
    if (!list.data.items.some((r) => r.id === focusId)) {
      if (tab === 'waiting') setTab('done'); // yêu cầu đã xử lý → tìm ở tab Hoàn thành
      return;
    }
    document.querySelector(`[data-request="${focusId}"]`)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    setFlashId(focusId);
    setParams({}, { replace: true });
    const t = window.setTimeout(() => setFlashId(''), 3500);
    return () => window.clearTimeout(t);
  }, [focusId, list.data, tab, setParams]);

  const after = (msg: string) => () => {
    toast.success(msg);
    void qc.invalidateQueries({ queryKey: ['thu-ngan', 'requests'] });
    void qc.invalidateQueries({ queryKey: ['thu-ngan', 'floor'] });
  };
  const onError = (e: unknown) => {
    toast.error(e instanceof Error ? e.message : 'Không lưu được');
    void qc.invalidateQueries({ queryKey: ['thu-ngan', 'requests'] });
  };
  const cancel = useMutation({ mutationFn: cancelRequest, onSuccess: after('Đã hủy yêu cầu'), onError });

  return (
    <CashierShell>
      <div className="min-w-0 space-y-4">
        <PageHeader title="Yêu cầu thanh toán" description="Khách bấm Yêu cầu thanh toán trên trang đặt món. Yêu cầu chờ quá 5 phút được tô đỏ. Khách gọi nhân viên do Nhân viên phục vụ trong khu xử lý." />
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
            <div className="p-5"><EmptyState icon={Receipt} title={tab === 'waiting' ? 'Không có yêu cầu thanh toán nào đang chờ' : 'Chưa có yêu cầu'} /></div>
          ) : (
            <ul className="divide-y divide-[var(--border)]">
              {list.data.items.map((r) => {
                const wait = minutesSince(r.createdAt);
                const late = tab === 'waiting' && wait >= 5;
                return (
                  <li key={r.id} data-request={r.id} className={cn('flex flex-wrap items-center gap-3 px-5 py-3.5', late && 'bg-[var(--danger-soft)]', flashId === r.id && 'rms-flash')}>
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[var(--accent-soft)] text-[var(--accent)]">
                      <Receipt size={18} />
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
                        {r.forwardedAt ? ` · Đã báo NV ${formatDateTime(r.forwardedAt)}` : ''}
                        {r.doneAt ? ` · Xong ${formatDateTime(r.doneAt)}` : ''}
                      </p>
                    </div>
                    {tab === 'waiting' ? (
                      <div className="flex flex-wrap gap-2">
                        {r.orderId ? (
                          <Button size="sm" leadingIcon={<Receipt size={15} />} onClick={() => navigate(`/thu-ngan/don/${r.orderId}`)}>
                            {r.invoiceId ? 'Thu tiền' : 'Lập hóa đơn'}
                          </Button>
                        ) : null}
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
    </CashierShell>
  );
}
