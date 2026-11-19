import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ClipboardList } from 'lucide-react';
import { CashierShell } from '@/features/ordering/CashierShell';
import { Card } from '@/components/common/Card';
import { Badge } from '@/components/common/Badge';
import { BlockError, EmptyState } from '@/components/common/EmptyState';
import { SearchInput, SelectInput, TextInput } from '@/components/common/Form';
import { DataTable, PageHeader, TableSkeleton, Td, Th, Toolbar } from '@/components/common/PageParts';
import { CASHIER_STREAM, getCashierOrders } from '@/api/ordering';
import { useLiveEvents } from '@/features/ordering/live';
import { ORDER_ROW_STATUS, rangeError, todayKey } from '@/features/ordering/cashierParts';
import { useDebounced } from '@/hooks/use-debounced';
import { formatCurrency } from '@/lib/format';
import { formatDateTime } from '@/lib/labels';
import type { OrderListStatus } from '@/types';

const STATUS_OPTIONS: { value: Exclude<OrderListStatus, ''>; label: string }[] = [
  { value: 'open', label: 'Đang mở' },
  { value: 'awaiting_payment', label: 'Chờ thanh toán' },
  { value: 'completed', label: 'Hoàn tất' },
  { value: 'cancelled', label: 'Đã hủy' },
];

/** UC-TN-02: tra cứu đơn hàng theo mã đơn / bàn / hóa đơn, trạng thái và khoảng ngày (tối đa 31 ngày). */
export default function OrdersPage() {
  const [keyword, setKeyword] = useState('');
  const [status, setStatus] = useState<OrderListStatus>('');
  const [from, setFrom] = useState(todayKey());
  const [to, setTo] = useState(todayKey());
  const debounced = useDebounced(keyword);
  const err = rangeError(from, to);
  const list = useQuery({
    queryKey: ['thu-ngan', 'orders', debounced, status, from, to],
    queryFn: () => getCashierOrders({ keyword: debounced, status, from, to }),
    enabled: !err,
    placeholderData: (prev) => prev,
  });
  useLiveEvents(CASHIER_STREAM, [['thu-ngan', 'orders']]);

  return (
    <CashierShell>
      <div className="min-w-0 space-y-4">
        <PageHeader title="Đơn hàng" description="Đơn gọi qua QR tại bàn: đang mở, chờ thanh toán, hoàn tất, đã hủy. Bấm một đơn để xem chi tiết." />
        <Card className="overflow-hidden">
          <Toolbar>
            <SearchInput value={keyword} onChange={setKeyword} placeholder="Mã đơn, mã bàn, mã hóa đơn…" className="w-full sm:w-[260px]" ariaLabel="Tìm đơn" />
            <SelectInput
              aria-label="Lọc theo trạng thái"
              value={status}
              onChange={(e) => setStatus(e.target.value as OrderListStatus)}
              placeholder="Tất cả trạng thái"
              options={STATUS_OPTIONS}
              className="w-full sm:w-[190px]"
            />
            <div className="flex items-center gap-2">
              <TextInput type="date" aria-label="Từ ngày" value={from} max={to} onChange={(e) => setFrom(e.target.value)} invalid={Boolean(err)} className="w-[150px]" />
              <span className="text-[var(--text-muted)]">–</span>
              <TextInput type="date" aria-label="Đến ngày" value={to} min={from} onChange={(e) => setTo(e.target.value)} invalid={Boolean(err)} className="w-[150px]" />
            </div>
          </Toolbar>
          {err ? <p className="px-5 pb-2 text-[12.5px] text-[var(--danger)]">{err}</p> : null}
          {list.isError ? (
            <div className="p-5"><BlockError message={list.error instanceof Error ? list.error.message : undefined} onRetry={() => void list.refetch()} retrying={list.isFetching} /></div>
          ) : err ? null : !list.data ? (
            <TableSkeleton cols={8} />
          ) : list.data.items.length === 0 ? (
            <div className="p-5"><EmptyState icon={ClipboardList} title={keyword || status ? 'Không tìm thấy đơn phù hợp' : 'Chưa có đơn nào trong khoảng ngày này'} /></div>
          ) : (
            <div className={list.isFetching ? 'opacity-60 transition-opacity' : ''}>
              <DataTable minWidth={960}>
                <thead>
                  <tr><Th>Mã đơn</Th><Th>Bàn</Th><Th>Giờ mở</Th><Th>Giờ đóng</Th><Th className="text-right">Số món</Th><Th className="text-right">Tổng tiền</Th><Th>Trạng thái</Th><Th>Hóa đơn</Th></tr>
                </thead>
                <tbody>
                  {list.data.items.map((o) => (
                    <tr key={o.id} className="hover:bg-[var(--bg-subtle)]">
                      <Td><Link to={`/thu-ngan/don/${o.id}`} className="font-mono text-[12.5px] font-semibold hover:text-[var(--accent)]">{o.code}</Link></Td>
                      <Td className="text-[13.5px]"><b>{o.tableCode}</b> <span className="text-[var(--text-muted)]">· {o.areaName}</span></Td>
                      <Td className="whitespace-nowrap text-[13px]">{formatDateTime(o.openedAt)}</Td>
                      <Td className="whitespace-nowrap text-[13px]">{o.closedAt ? formatDateTime(o.closedAt) : '—'}</Td>
                      <Td className="text-right font-mono">{o.itemCount}</Td>
                      <Td className="text-right font-mono font-semibold">{formatCurrency(o.total)}</Td>
                      <Td><Badge variant={ORDER_ROW_STATUS[o.status].variant}>{ORDER_ROW_STATUS[o.status].label}</Badge></Td>
                      <Td>{o.invoiceId ? <Link to={`/thu-ngan/hoa-don?id=${o.invoiceId}`} className="font-mono text-[12.5px] hover:text-[var(--accent)]">{o.invoiceCode}</Link> : '—'}</Td>
                    </tr>
                  ))}
                </tbody>
              </DataTable>
              <div className="flex flex-wrap justify-between gap-2 border-t border-[var(--border)] px-5 py-2.5 text-[13px]">
                <span>{list.data.count} đơn</span>
                <span>Tổng tiền đơn hoàn tất: <b className="font-mono">{formatCurrency(list.data.completedTotal)}</b></span>
              </div>
            </div>
          )}
        </Card>
      </div>
    </CashierShell>
  );
}
