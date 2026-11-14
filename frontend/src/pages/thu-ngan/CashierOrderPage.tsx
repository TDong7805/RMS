import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, Check, Printer } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { Card, CardHeader } from '@/components/common/Card';
import { Badge, type BadgeVariant } from '@/components/common/Badge';
import { Button } from '@/components/common/Button';
import { BlockError } from '@/components/common/EmptyState';
import { DataTable, PageHeader, StatTile, Td, Th } from '@/components/common/PageParts';
import { Skeleton } from '@/components/common/Skeleton';
import { CASHIER_STREAM, getCashierOrder, serveItems } from '@/api/ordering';
import { useLiveEvents } from '@/features/ordering/live';
import { formatCurrency } from '@/lib/format';
import { formatDateTime } from '@/lib/labels';
import type { OrderItemStatus, OrderView } from '@/types';
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

/** UC-TN-03: chi tiết đơn, đánh dấu món đã mang ra, in tạm tính. Hủy món / chuyển bàn / hóa đơn ở đợt 2. */
export default function CashierOrderPage() {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: CASHIER_KEYS.order(id), queryFn: () => getCashierOrder(id), refetchInterval: 10_000, retry: false });
  useLiveEvents(CASHIER_STREAM, [CASHIER_KEYS.order(id), CASHIER_KEYS.floor]);
  const serve = useMutation({
    mutationFn: serveItems,
    onSuccess: (o) => {
      toast.success('Đã đánh dấu đã mang ra');
      qc.setQueryData(CASHIER_KEYS.order(id), o);
      void qc.invalidateQueries({ queryKey: CASHIER_KEYS.floor });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Không lưu được'),
  });
  const o = q.data;

  return (
    <AppShell meta={{ label: o ? `Bàn ${o.tableCode}` : 'Chi tiết đơn', parent: 'Sơ đồ bàn' }}>
      <div className="min-w-0 space-y-4">
        {q.isError ? (
          <BlockError message="Không tìm thấy đơn hàng" onRetry={() => navigate('/thu-ngan')} />
        ) : !o ? (
          <Skeleton className="h-64" />
        ) : (
          <>
            <PageHeader
              title={`Bàn ${o.tableCode} · ${o.code}`}
              description={`${o.areaName} · mở lúc ${formatDateTime(o.createdAt)} · nguồn: QR tại bàn`}
              actions={
                <div className="flex flex-wrap gap-2">
                  <Button variant="ghost" size="sm" leadingIcon={<ArrowLeft size={15} />} onClick={() => navigate('/thu-ngan')}>Về sơ đồ bàn</Button>
                  <Button variant="outline" size="sm" leadingIcon={<Printer size={15} />} onClick={() => printProvisional(o)}>In tạm tính</Button>
                  {o.readyCount ? (
                    <Button size="sm" leadingIcon={<Check size={15} />} loading={serve.isPending} onClick={() => serve.mutate(o.items.filter((i) => i.status === 'done').map((i) => i.id))}>
                      Đã mang ra tất cả ({o.readyCount})
                    </Button>
                  ) : null}
                </div>
              }
            />
            <div className="grid gap-3 sm:grid-cols-4">
              <StatTile label="Trạng thái" value={<span className="font-sans text-[18px]">{ORDER_STATUS[o.status]}</span>} hint={o.locked ? 'Đang chờ thanh toán' : undefined} />
              <StatTile label="Tạm tính" value={formatCurrency(o.subtotal)} tone="accent" hint="Không tính món đã hủy" />
              <StatTile label="Món chưa xong" value={o.pendingCount} />
              <StatTile label="Món chờ mang ra" value={o.readyCount} tone={o.readyCount ? 'warning' : 'default'} />
            </div>
            <Card className="overflow-hidden">
              <div className="p-5 pb-3"><CardHeader title="Món trong đơn" description="Theo đợt gọi, mới nhất ở trên." /></div>
              <DataTable minWidth={880}>
                <thead><tr><Th>Đợt</Th><Th>Món</Th><Th className="text-right">SL</Th><Th className="text-right">Đơn giá</Th><Th className="text-right">Thành tiền</Th><Th>Trạng thái</Th><Th>Thời điểm</Th><Th /></tr></thead>
                <tbody>
                  {o.items.map((i) => (
                    <tr key={i.id} className={i.status === 'cancelled' ? 'text-[var(--text-muted)]' : undefined}>
                      <Td className="font-mono text-[13px]">{i.batchNo}</Td>
                      <Td>
                        <p className={i.status === 'cancelled' ? 'line-through' : 'font-semibold'}>{i.name}</p>
                        {i.note ? <p className="text-[12.5px] text-[var(--text-muted)]">“{i.note}”</p> : null}
                        {i.status === 'cancelled' ? <p className="text-[12.5px] text-[var(--danger)]">{i.cancelSource ? CANCEL_BY[i.cancelSource] : ''} hủy{i.cancelReason ? `: ${i.cancelReason}` : ''}</p> : null}
                      </Td>
                      <Td className="text-right font-mono">{i.qty}</Td>
                      <Td className="text-right font-mono">{formatCurrency(i.price)}</Td>
                      <Td className="text-right font-mono font-semibold">{i.status === 'cancelled' ? '—' : formatCurrency(i.price * i.qty)}</Td>
                      <Td><Badge variant={STATUS[i.status].variant}>{STATUS[i.status].label}</Badge></Td>
                      <Td className="whitespace-nowrap text-[12.5px] text-[var(--text-muted)]">Gọi {formatDateTime(i.createdAt)}{i.completedAt ? <><br />Xong {formatDateTime(i.completedAt)}</> : null}</Td>
                      <Td className="text-right">
                        {i.status === 'done' ? <Button size="sm" variant="outline" onClick={() => serve.mutate([i.id])}>Đã mang ra</Button> : null}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </DataTable>
              <div className="flex justify-end border-t border-[var(--border)] p-5 text-[15px]">Tạm tính: <b className="ml-2 font-mono text-[18px] text-[var(--accent)]">{formatCurrency(o.subtotal)}</b></div>
            </Card>
            <p className="text-[12.5px] text-[var(--text-muted)]">Hủy món, chuyển bàn, lập hóa đơn và thanh toán có ở đợt 2.</p>
          </>
        )}
      </div>
    </AppShell>
  );
}

/** In tạm tính (không phải hóa đơn) bằng trình duyệt. */
function printProvisional(o: OrderView) {
  const rows = o.items
    .filter((i) => i.status !== 'cancelled')
    .map((i) => `<tr><td>${escapeHtml(i.name)}</td><td style="text-align:right">${i.qty}</td><td style="text-align:right">${(i.price * i.qty).toLocaleString('vi-VN')}</td></tr>`)
    .join('');
  const w = window.open('', '_blank', 'width=380,height=600');
  if (!w) return;
  w.document.write(`<html><head><title>Tạm tính ${o.code}</title><style>body{font-family:sans-serif;font-size:13px;padding:12px}table{width:100%;border-collapse:collapse}td{padding:3px 0}h3{margin:0 0 4px}</style></head>
<body><h3>TẠM TÍNH</h3><div>Bàn ${escapeHtml(o.tableCode)} · ${escapeHtml(o.code)}</div><div>${new Date().toLocaleString('vi-VN')}</div><hr/>
<table>${rows}</table><hr/><b>Tạm tính: ${o.subtotal.toLocaleString('vi-VN')}đ</b><p style="font-size:11px">Đây không phải hóa đơn thanh toán.</p>
<script>window.print()</script></body></html>`);
  w.document.close();
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}
