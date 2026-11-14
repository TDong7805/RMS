import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Printer, Receipt, Wallet, XCircle } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { Card } from '@/components/common/Card';
import { Badge } from '@/components/common/Badge';
import { Button } from '@/components/common/Button';
import { BlockError, EmptyState } from '@/components/common/EmptyState';
import { SearchInput, SelectInput, TextInput } from '@/components/common/Form';
import { Modal } from '@/components/common/Modal';
import { DataTable, DetailRow, PageHeader, TableSkeleton, Td, Th, Toolbar } from '@/components/common/PageParts';
import { Skeleton } from '@/components/common/Skeleton';
import { CASHIER_STREAM, getInvoice, getInvoices } from '@/api/ordering';
import { useLiveEvents } from '@/features/ordering/live';
import { CancelInvoiceDialog, InvoiceLines, PAY_METHOD_LABEL, PaymentDialog, printInvoice } from '@/features/ordering/CashierDialogs';
import { INVOICE_STATUS, rangeError, todayKey } from '@/features/ordering/cashierParts';
import { useDebounced } from '@/hooks/use-debounced';
import { formatCurrency } from '@/lib/format';
import { formatDateTime } from '@/lib/labels';
import type { Invoice, InvoiceStatus, PayMethod } from '@/types';

/** UC-TN-09: danh sách hóa đơn, xem chi tiết, in lại, hủy hóa đơn chưa thanh toán; thu tiền hóa đơn còn treo (UC-TN-08). */
export default function InvoicesPage() {
  const qc = useQueryClient();
  const [params, setParams] = useSearchParams();
  const [keyword, setKeyword] = useState('');
  const [status, setStatus] = useState<InvoiceStatus | ''>('');
  const [method, setMethod] = useState<PayMethod | ''>('');
  const [from, setFrom] = useState(todayKey());
  const [to, setTo] = useState(todayKey());
  const debounced = useDebounced(keyword);
  const err = rangeError(from, to);
  const list = useQuery({
    queryKey: ['thu-ngan', 'invoices', debounced, status, method, from, to],
    queryFn: () => getInvoices({ keyword: debounced, status, method, from, to }),
    enabled: !err,
    placeholderData: (prev) => prev,
  });
  useLiveEvents(CASHIER_STREAM, [['thu-ngan', 'invoices'], ['thu-ngan', 'invoice']]);

  const openId = params.get('id') ?? '';
  const setOpenId = (id: string) => setParams(id ? { id } : {}, { replace: true });
  const detail = useQuery({ queryKey: ['thu-ngan', 'invoice', openId], queryFn: () => getInvoice(openId), enabled: Boolean(openId), retry: false });
  const [cancelling, setCancelling] = useState<Invoice | null>(null);
  const [paying, setPaying] = useState<Invoice | null>(null);
  const refresh = () => void qc.invalidateQueries({ queryKey: ['thu-ngan'] });
  const reprint = useMutation({ mutationFn: getInvoice, onSuccess: printInvoice, onError: (e) => toast.error(e instanceof Error ? e.message : 'Không in được') });

  return (
    <AppShell meta={{ label: 'Hóa đơn' }}>
      <div className="min-w-0 space-y-4">
        <PageHeader title="Hóa đơn" description="Hóa đơn đã lập: thu tiền hóa đơn chưa thanh toán, in lại, hủy hóa đơn chưa thanh toán để mở lại đơn." />
        <Card className="overflow-hidden">
          <Toolbar>
            <SearchInput value={keyword} onChange={setKeyword} placeholder="Mã HĐ, mã đơn, bàn, mã số thuế…" className="w-full sm:w-[250px]" ariaLabel="Tìm hóa đơn" />
            <SelectInput
              aria-label="Lọc theo trạng thái"
              value={status}
              onChange={(e) => setStatus(e.target.value as InvoiceStatus | '')}
              placeholder="Tất cả trạng thái"
              options={(Object.keys(INVOICE_STATUS) as InvoiceStatus[]).map((k) => ({ value: k, label: INVOICE_STATUS[k].label }))}
              className="w-full sm:w-[170px]"
            />
            <SelectInput
              aria-label="Lọc theo hình thức"
              value={method}
              onChange={(e) => setMethod(e.target.value as PayMethod | '')}
              placeholder="Mọi hình thức"
              options={(Object.keys(PAY_METHOD_LABEL) as PayMethod[]).map((k) => ({ value: k, label: PAY_METHOD_LABEL[k] }))}
              className="w-full sm:w-[160px]"
            />
            <div className="flex items-center gap-2">
              <TextInput type="date" aria-label="Từ ngày" value={from} max={to} onChange={(e) => setFrom(e.target.value)} invalid={Boolean(err)} className="w-[150px]" />
              <span className="text-[var(--text-muted)]">–</span>
              <TextInput type="date" aria-label="Đến ngày" value={to} min={from} onChange={(e) => setTo(e.target.value)} invalid={Boolean(err)} className="w-[150px]" />
            </div>
          </Toolbar>
          {err ? <p className="px-5 pb-2 text-[12.5px] text-[var(--danger)]">{err}</p> : null}
          {list.isError ? (
            <div className="p-5"><BlockError onRetry={() => void list.refetch()} retrying={list.isFetching} /></div>
          ) : err ? null : !list.data ? (
            <TableSkeleton cols={9} />
          ) : list.data.items.length === 0 ? (
            <div className="p-5"><EmptyState icon={Receipt} title={keyword || status || method ? 'Không tìm thấy hóa đơn phù hợp' : 'Chưa có hóa đơn nào trong khoảng ngày này'} /></div>
          ) : (
            <div className={list.isFetching ? 'opacity-60 transition-opacity' : ''}>
              <DataTable minWidth={1040}>
                <thead>
                  <tr><Th>Mã HĐ</Th><Th>Bàn</Th><Th>Mã đơn</Th><Th>Lập lúc</Th><Th>Thanh toán</Th><Th className="text-right">Tổng cộng</Th><Th>Hình thức</Th><Th>Thu ngân</Th><Th>Trạng thái</Th><Th /></tr>
                </thead>
                <tbody>
                  {list.data.items.map((r) => (
                    <tr key={r.id} className="hover:bg-[var(--bg-subtle)]">
                      <Td>
                        <button type="button" onClick={() => setOpenId(r.id)} className="font-mono text-[12.5px] font-semibold hover:text-[var(--accent)]">{r.code}</button>
                      </Td>
                      <Td className="font-semibold">{r.tableCode}</Td>
                      <Td><Link to={`/thu-ngan/don/${r.orderId}`} className="font-mono text-[12.5px] hover:text-[var(--accent)]">{r.orderCode}</Link></Td>
                      <Td className="whitespace-nowrap text-[13px]">{formatDateTime(r.createdAt)}</Td>
                      <Td className="whitespace-nowrap text-[13px]">{r.paidAt ? formatDateTime(r.paidAt) : '—'}</Td>
                      <Td className="text-right font-mono font-semibold">{formatCurrency(r.total)}</Td>
                      <Td className="text-[13px]">{r.methods.length ? r.methods.map((m) => PAY_METHOD_LABEL[m]).join(' + ') : '—'}</Td>
                      <Td className="text-[13px]">{r.cashierName ?? '—'}</Td>
                      <Td><Badge variant={INVOICE_STATUS[r.status].variant}>{INVOICE_STATUS[r.status].label}</Badge></Td>
                      <Td className="text-right">
                        <Button size="sm" variant="ghost" aria-label={`In hóa đơn ${r.code}`} onClick={() => reprint.mutate(r.id)}><Printer size={15} /></Button>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </DataTable>
              <div className="flex flex-wrap items-center gap-x-5 gap-y-1 border-t border-[var(--border)] px-5 py-2.5 text-[13px]">
                <span>{list.data.count} hóa đơn</span>
                <span>Đã thu: <b className="font-mono">{formatCurrency(list.data.paidTotal)}</b></span>
                {(Object.keys(PAY_METHOD_LABEL) as PayMethod[]).filter((k) => list.data.byMethod[k]).map((k) => (
                  <span key={k} className="text-[var(--text-secondary)]">{PAY_METHOD_LABEL[k]}: <b className="font-mono">{formatCurrency(list.data.byMethod[k])}</b></span>
                ))}
              </div>
            </div>
          )}
        </Card>
      </div>

      <Modal
        open={Boolean(openId)}
        onOpenChange={(o) => !o && setOpenId('')}
        size="lg"
        title={detail.data ? `Hóa đơn ${detail.data.code}` : 'Hóa đơn'}
        description={detail.data ? `Bàn ${detail.data.tableCode} · đơn ${detail.data.orderCode}` : undefined}
        footer={
          detail.data ? (
            <>
              <Button variant="ghost" leadingIcon={<Printer size={15} />} onClick={() => printInvoice(detail.data!)}>In hóa đơn</Button>
              <span className="flex-1" />
              {detail.data.status === 'unpaid' ? (
                <>
                  <Button variant="outline" leadingIcon={<XCircle size={15} />} onClick={() => setCancelling(detail.data!)}>Hủy hóa đơn</Button>
                  <Button leadingIcon={<Wallet size={15} />} onClick={() => setPaying(detail.data!)}>Thu tiền</Button>
                </>
              ) : null}
            </>
          ) : null
        }
      >
        {detail.isError ? (
          <p className="text-[14px] text-[var(--danger)]">Không tìm thấy hóa đơn</p>
        ) : !detail.data ? (
          <Skeleton className="h-60" />
        ) : (
          <InvoiceDetail inv={detail.data} />
        )}
      </Modal>
      <CancelInvoiceDialog invoice={cancelling} onClose={() => setCancelling(null)} onDone={refresh} />
      <PaymentDialog
        invoice={paying}
        onClose={() => setPaying(null)}
        onPaid={() => {
          setPaying(null);
          refresh();
        }}
      />
    </AppShell>
  );
}

function InvoiceDetail({ inv }: { inv: Invoice }) {
  return (
    <div className="space-y-4">
      <div className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
        <DetailRow label="Trạng thái"><Badge variant={INVOICE_STATUS[inv.status].variant}>{INVOICE_STATUS[inv.status].label}</Badge></DetailRow>
        <DetailRow label="Thu ngân">{inv.cashierName ?? '—'}</DetailRow>
        <DetailRow label="Lập lúc">{formatDateTime(inv.createdAt)}</DetailRow>
        <DetailRow label="Thanh toán lúc">{inv.paidAt ? formatDateTime(inv.paidAt) : '—'}</DetailRow>
        {inv.vatCompany ? <DetailRow label="Xuất VAT">{inv.vatCompany} · MST {inv.vatTaxCode}</DetailRow> : null}
        {inv.requestedMethod ? <DetailRow label="Khách chọn">{PAY_METHOD_LABEL[inv.requestedMethod]}</DetailRow> : null}
      </div>
      {inv.status === 'cancelled' ? (
        <p className="rounded-item bg-[var(--danger-soft)] px-3 py-2 text-[13.5px] text-[var(--danger)]">
          Đã hủy {inv.cancelledAt ? formatDateTime(inv.cancelledAt) : ''}{inv.cancelledBy ? ` bởi ${inv.cancelledBy}` : ''}: {inv.cancelReason}
        </p>
      ) : null}
      <InvoiceLines lines={inv.lines} total={inv.total} />
      {inv.payments.length ? (
        <div>
          <p className="mb-1.5 text-[13px] font-semibold">Các khoản thu</p>
          <ul className="divide-y divide-[var(--border)] rounded-item border border-[var(--border)] text-[13.5px]">
            {inv.payments.map((p, i) => (
              <li key={i} className="flex flex-wrap justify-between gap-2 px-3 py-2">
                <span>
                  <b>{PAY_METHOD_LABEL[p.method]}</b>
                  {p.transactionRef ? <span className="ml-1 font-mono text-[12px] text-[var(--text-muted)]">{p.transactionRef}</span> : null}
                  {p.cashGiven != null ? <span className="ml-2 text-[var(--text-muted)]">khách đưa {formatCurrency(p.cashGiven)} · thối {formatCurrency(p.change ?? 0)}</span> : null}
                </span>
                <b className="font-mono">{formatCurrency(p.amount)}</b>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
