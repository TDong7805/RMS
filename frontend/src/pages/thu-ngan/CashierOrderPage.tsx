import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, ArrowRightLeft, BellRing, Printer, Receipt, Wallet, XCircle } from 'lucide-react';
import { CashierShell } from '@/features/ordering/CashierShell';
import { Card, CardHeader } from '@/components/common/Card';
import { Badge, type BadgeVariant } from '@/components/common/Badge';
import { Button } from '@/components/common/Button';
import { BlockError } from '@/components/common/EmptyState';
import { DataTable, PageHeader, StatTile, Td, Th } from '@/components/common/PageParts';
import { Skeleton } from '@/components/common/Skeleton';
import { CASHIER_STREAM, getCashierOrder, getInvoice } from '@/api/ordering';
import { useLiveEvents } from '@/features/ordering/live';
import { CancelDialog, CreateInvoiceDialog, MoveTableDialog, PAY_METHOD_LABEL, PaymentDialog, printInvoice, printProvisional } from '@/features/ordering/CashierDialogs';
import { REQUEST_TYPE_LABEL } from '@/features/ordering/requestLabels';
import { formatCurrency } from '@/lib/format';
import { formatDateTime } from '@/lib/labels';
import type { CashierOrderDetail, Invoice, OrderItemStatus } from '@/types';
import { CASHIER_KEYS } from './FloorPage';

const STATUS: Record<OrderItemStatus, { label: string; variant: BadgeVariant }> = {
  pending: { label: 'Chờ chế biến', variant: 'neutral' },
  cooking: { label: 'Đang chế biến', variant: 'warning' },
  done: { label: 'Đã xong', variant: 'accent' },
  served: { label: 'Đã mang ra', variant: 'info' },
  cancelled: { label: 'Đã hủy', variant: 'danger' },
};
const CANCEL_BY = { customer: 'Khách', cashier: 'Thu ngân', kitchen: 'Bếp' } as const;
const ORDER_STATUS = { open: 'Đang mở', completed: 'Hoàn tất', cancelled: 'Đã hủy' } as const;

/**
 * UC-TN-03..05, UC-TN-07, UC-TN-08: chi tiết đơn — đánh dấu đã mang ra, hủy món / hủy đơn, chuyển bàn,
 * in tạm tính, lập hóa đơn và thu tiền.
 */
export default function CashierOrderPage() {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: CASHIER_KEYS.order(id), queryFn: () => getCashierOrder(id), refetchInterval: 10_000, retry: false });
  useLiveEvents(CASHIER_STREAM, [CASHIER_KEYS.order(id), CASHIER_KEYS.floor]);
  const [cancelTarget, setCancelTarget] = useState<Parameters<typeof CancelDialog>[0]['target']>(null);
  const [moveOpen, setMoveOpen] = useState(false);
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [paying, setPaying] = useState<Invoice | null>(null);

  const apply = (d: CashierOrderDetail) => {
    qc.setQueryData(CASHIER_KEYS.order(id), d);
    void qc.invalidateQueries({ queryKey: CASHIER_KEYS.floor });
  };
  const openPay = useMutation({
    mutationFn: getInvoice,
    onSuccess: setPaying,
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Không mở được hóa đơn'),
  });
  const printBill = useMutation({ mutationFn: getInvoice, onSuccess: printInvoice });

  const d = q.data;
  const o = d?.order;
  const editable = o?.status === 'open' && !o.locked;
  const canCancelOrder = editable && o.items.every((i) => i.status === 'pending' || i.status === 'cancelled');

  return (
    <CashierShell>
      <div className="min-w-0 space-y-4">
        {q.isError ? (
          <BlockError message="Không tìm thấy đơn hàng" onRetry={() => navigate('/thu-ngan')} />
        ) : !d || !o ? (
          <Skeleton className="h-64" />
        ) : (
          <>
            <PageHeader
              title={`Bàn ${o.tableCode} · ${o.code}`}
              description={`${o.areaName} · mở lúc ${formatDateTime(o.createdAt)}${d.closedAt ? ` · đóng lúc ${formatDateTime(d.closedAt)}` : ''} · nguồn: QR tại bàn`}
              actions={
                <div className="flex flex-wrap gap-2">
                  <Button variant="ghost" size="sm" leadingIcon={<ArrowLeft size={15} />} onClick={() => navigate(-1)}>Quay lại</Button>
                  {o.status === 'open' ? (
                    <Button variant="outline" size="sm" leadingIcon={<Printer size={15} />} onClick={() => printProvisional(o)}>In tạm tính</Button>
                  ) : null}
                  {o.status === 'open' ? (
                    <Button variant="outline" size="sm" leadingIcon={<ArrowRightLeft size={15} />} onClick={() => setMoveOpen(true)}>Chuyển bàn</Button>
                  ) : null}
                  {canCancelOrder ? (
                    <Button variant="outline" size="sm" leadingIcon={<XCircle size={15} />} onClick={() => setCancelTarget({ kind: 'order', id: o.id, code: o.code, tableCode: o.tableCode })}>
                      Hủy đơn
                    </Button>
                  ) : null}
                  {editable ? (
                    <Button size="sm" leadingIcon={<Receipt size={15} />} onClick={() => setInvoiceOpen(true)}>Lập hóa đơn</Button>
                  ) : null}
                  {o.status === 'open' && d.invoice?.status === 'unpaid' ? (
                    <Button size="sm" leadingIcon={<Wallet size={15} />} loading={openPay.isPending} onClick={() => openPay.mutate(d.invoice!.id)}>
                      Thu tiền {d.invoice.code}
                    </Button>
                  ) : null}
                </div>
              }
            />
            <div className="grid gap-3 sm:grid-cols-4">
              <StatTile
                label="Trạng thái"
                value={<span className="font-sans text-[18px]">{o.locked ? 'Chờ thanh toán' : ORDER_STATUS[o.status]}</span>}
                hint={o.locked ? 'Đã lập hóa đơn — khóa gọi thêm / hủy món' : undefined}
                tone={o.locked ? 'warning' : 'default'}
              />
              <StatTile label="Tạm tính" value={formatCurrency(o.subtotal)} tone="accent" hint="Không tính món đã hủy" />
              <StatTile label="Món chưa xong" value={o.pendingCount} />
              <StatTile label="Món chờ mang ra" value={o.readyCount} tone={o.readyCount ? 'warning' : 'default'} />
            </div>

            {d.requests.length || d.invoice ? (
              <div className="grid gap-3 md:grid-cols-2">
                {d.requests.map((r) => (
                  <Card key={r.id} padded className="flex items-start gap-3 border-[var(--warning)]">
                    <BellRing size={18} className="mt-0.5 shrink-0 text-[var(--warning)]" />
                    <div className="min-w-0 flex-1 text-[13.5px]">
                      <p className="font-semibold">
                        {r.type === 'payment' ? 'Khách yêu cầu thanh toán' : `Gọi nhân viên – ${REQUEST_TYPE_LABEL[r.type]}`}
                        <span className="ml-2 font-normal text-[var(--text-muted)]">{formatDateTime(r.createdAt)}</span>
                      </p>
                      {r.type === 'payment' ? (
                        <p className="text-[var(--text-secondary)]">
                          Hình thức: {PAY_METHOD_LABEL[r.paymentMethod ?? 'cash']}
                          {r.vatCompany ? ` · VAT: ${r.vatCompany} – ${r.vatTaxCode}` : ''}
                        </p>
                      ) : (
                        <p className="text-[var(--text-secondary)]">{r.content || '—'}{r.status === 'forwarded' ? ' · đã báo nhân viên' : ''}</p>
                      )}
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => navigate('/thu-ngan/yeu-cau')}>Xem</Button>
                  </Card>
                ))}
                {d.invoice ? (
                  <Card padded className="flex items-center gap-3">
                    <Receipt size={18} className="shrink-0 text-[var(--accent)]" />
                    <div className="min-w-0 flex-1 text-[13.5px]">
                      <p className="font-semibold">Hóa đơn {d.invoice.code}</p>
                      <p className="text-[var(--text-secondary)]">{formatCurrency(d.invoice.total)} · {d.invoice.status === 'paid' ? 'Đã thanh toán' : 'Chưa thanh toán'}</p>
                    </div>
                    <Button size="sm" variant="ghost" leadingIcon={<Printer size={15} />} loading={printBill.isPending} onClick={() => printBill.mutate(d.invoice!.id)}>In</Button>
                    <Button size="sm" variant="ghost" onClick={() => navigate(`/thu-ngan/hoa-don?id=${d.invoice!.id}`)}>Chi tiết</Button>
                  </Card>
                ) : null}
              </div>
            ) : null}

            <Card className="overflow-hidden">
              <div className="p-5 pb-3"><CardHeader title="Món trong đơn" description="Theo đợt gọi, mới nhất ở trên." /></div>
              <DataTable minWidth={900}>
                <thead><tr><Th>Đợt</Th><Th>Món</Th><Th className="text-right">SL</Th><Th className="text-right">Đơn giá</Th><Th className="text-right">Thành tiền</Th><Th>Trạng thái</Th><Th>Thời điểm</Th><Th /></tr></thead>
                <tbody>
                  {o.items.map((i) => (
                    <tr key={i.id} className={i.status === 'cancelled' ? 'text-[var(--text-muted)]' : undefined}>
                      <Td className="font-mono text-[13px]">{i.batchNo}</Td>
                      <Td>
                        <p className={i.status === 'cancelled' ? 'line-through' : 'font-semibold'}>{i.name}</p>
                        {i.setName ? <p className="text-[12px] font-medium text-[var(--accent)]">Thuộc {i.setName} · giá đã chia từ giá set</p> : null}
                        {i.note ? <p className="text-[12.5px] text-[var(--text-muted)]">“{i.note}”</p> : null}
                        {i.status === 'cancelled' ? (
                          <p className="text-[12.5px] text-[var(--danger)]">
                            {i.cancelSource ? CANCEL_BY[i.cancelSource] : ''} hủy{i.cancelledBy ? ` (${i.cancelledBy})` : ''}{i.cancelReason ? `: ${i.cancelReason}` : ''}
                          </p>
                        ) : null}
                      </Td>
                      <Td className="text-right font-mono">{i.qty}</Td>
                      <Td className="text-right font-mono">{formatCurrency(i.price)}</Td>
                      <Td className="text-right font-mono font-semibold">{i.status === 'cancelled' ? '—' : formatCurrency(i.price * i.qty)}</Td>
                      <Td><Badge variant={STATUS[i.status].variant}>{STATUS[i.status].label}</Badge></Td>
                      <Td className="whitespace-nowrap text-[12.5px] text-[var(--text-muted)]">Gọi {formatDateTime(i.createdAt)}{i.completedAt ? <><br />Xong {formatDateTime(i.completedAt)}</> : null}</Td>
                      <Td className="whitespace-nowrap text-right">
                        {i.status === 'pending' && editable ? (
                          <Button size="sm" variant="ghost" className="text-[var(--danger)]" onClick={() => setCancelTarget({ kind: 'item', id: i.id, name: i.name })}>Hủy</Button>
                        ) : null}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </DataTable>
              <div className="flex justify-end border-t border-[var(--border)] p-5 text-[15px]">Tạm tính: <b className="ml-2 font-mono text-[18px] text-[var(--accent)]">{formatCurrency(o.subtotal)}</b></div>
            </Card>

            <CancelDialog target={cancelTarget} onClose={() => setCancelTarget(null)} onDone={apply} />
            <MoveTableDialog open={moveOpen} order={o} onClose={() => setMoveOpen(false)} onDone={apply} />
            <CreateInvoiceDialog
              orderId={o.id}
              open={invoiceOpen}
              onClose={() => setInvoiceOpen(false)}
              onCreated={(inv) => {
                setInvoiceOpen(false);
                setPaying(inv);
                void q.refetch();
                void qc.invalidateQueries({ queryKey: CASHIER_KEYS.floor });
              }}
            />
            <PaymentDialog
              invoice={paying}
              onClose={() => setPaying(null)}
              onPaid={(inv) => {
                setPaying(null);
                void q.refetch();
                void qc.invalidateQueries({ queryKey: ['thu-ngan'] });
                toast.success(`Bàn ${inv.tableCode} đã thanh toán`, { action: { label: 'In hóa đơn', onClick: () => printInvoice(inv) } });
              }}
            />
          </>
        )}
      </div>
    </CashierShell>
  );
}
