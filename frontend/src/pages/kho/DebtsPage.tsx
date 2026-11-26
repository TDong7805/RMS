import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Ban, Tag, Wallet } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { Card, CardHeader } from '@/components/common/Card';
import { Badge } from '@/components/common/Badge';
import { Button } from '@/components/common/Button';
import { BlockError, EmptyState, FilteredEmpty } from '@/components/common/EmptyState';
import { FilterChips } from '@/components/common/FilterChips';
import { RowActions } from '@/components/common/RowActions';
import { SubPageHeader } from '@/components/common/SubPageHeader';
import { SearchInput } from '@/components/common/Form';
import { DataTable, PageHeader, Pagination, StatTile, TableSkeleton, Td, Th, Toolbar } from '@/components/common/PageParts';
import { Skeleton } from '@/components/common/Skeleton';
import { WAREHOUSE_PAGE_SIZE } from '@/api/warehouse-ingredients';
import { CancelPaymentDialog, PaymentDialog, toPayable, type PayableOrder } from '@/features/warehouse/PaymentDialogs';
import { useDebt, useDebts } from '@/features/warehouse/queries';
import { PAYMENT_METHOD, PAYMENT_STATUS, purchaseStatusLabel } from '@/features/warehouse/labels';
import { useDebounced } from '@/hooks/use-debounced';
import { formatCurrency } from '@/lib/format';
import { formatDateOnly, formatDateTime } from '@/lib/labels';
import type { DebtFilter, SupplierPayment } from '@/types';

/**
 * UC-KHO-25: Công nợ nhà cung cấp. manager = true: khu Quản lý nhà hàng, chỉ xem
 * (không có nút Thanh toán / Hủy thanh toán, liên kết phiếu mua không mở trang của kho).
 */
export function DebtsPage({ manager = false }: { manager?: boolean }) {
  const navigate = useNavigate();
  const [keyword, setKeyword] = useState('');
  const [filters, setFilters] = useState<Record<string, string | undefined>>({});
  const status = (filters.status ?? 'all') as DebtFilter['status'];
  const hasFilter = Boolean(keyword || status !== 'all');
  const clearFilters = () => {
    setKeyword('');
    setFilters({});
  };
  const [page, setPage] = useState(1);
  const debounced = useDebounced(keyword);
  const list = useDebts({ keyword: debounced, status, page }, manager);
  useEffect(() => setPage(1), [debounced, status]);
  const root = manager ? '/quan-ly/cong-no' : '/kho/cong-no';

  return (
    <AppShell meta={manager ? { label: 'Công nợ nhà cung cấp', parent: 'Kho' } : { label: 'Công nợ nhà cung cấp' }}>
      <div className="min-w-0 space-y-4">
        <PageHeader
          title="Công nợ nhà cung cấp"
          description={manager ? 'Số tiền nhà hàng còn nợ từng nhà cung cấp (chỉ xem). Thanh toán do Quản lý kho ghi nhận.' : 'Phải trả theo hàng đã nhận, trừ các lần thanh toán còn hiệu lực. Nhập kho không phiếu không phát sinh công nợ.'}
        />
        {list.data ? (
          <div className="grid gap-3 sm:grid-cols-3">
            <StatTile label="Tổng phải trả" value={formatCurrency(list.data.totalPayable)} />
            <StatTile label="Đã trả" value={formatCurrency(list.data.totalPaid)} />
            <StatTile label="Còn nợ" value={formatCurrency(list.data.totalDebt)} tone={list.data.totalDebt > 0 ? 'warning' : 'default'} />
          </div>
        ) : null}
        <Card className="overflow-hidden">
          <Toolbar>
            <SearchInput value={keyword} onChange={setKeyword} placeholder="Mã, tên nhà cung cấp…" className="w-full sm:w-[240px]" />
            <FilterChips
              value={filters}
              onChange={setFilters}
              fields={[{ key: 'status', label: 'Tình trạng', icon: <Tag size={14} />, options: [{ value: 'owing', label: 'Còn nợ' }, { value: 'clear', label: 'Đã trả hết' }] }]}
            />
          </Toolbar>
          {list.isError ? (
            <div className="p-5"><BlockError onRetry={() => void list.refetch()} /></div>
          ) : list.isLoading || !list.data ? (
            <TableSkeleton cols={7} />
          ) : list.data.items.length === 0 ? (
            hasFilter ? (
              <FilteredEmpty title="Không có nhà cung cấp phù hợp" unit="nhà cung cấp" onClear={clearFilters} />
            ) : (
              <div className="p-5"><EmptyState icon={Wallet} title="Chưa có công nợ nhà cung cấp" /></div>
            )
          ) : (
            <>
              <DataTable minWidth={920}>
                <thead><tr><Th>Mã NCC</Th><Th>Nhà cung cấp</Th><Th className="text-right">Phải trả</Th><Th className="text-right">Đã trả</Th><Th className="text-right">Còn nợ</Th><Th className="text-right">Phiếu còn nợ</Th><Th>Nợ cũ nhất từ</Th></tr></thead>
                <tbody>
                  {list.data.items.map((r) => (
                    <tr key={r.supplierId} className="cursor-pointer hover:bg-[var(--bg-subtle)]" onClick={() => navigate(`${root}/${r.supplierId}`)}>
                      <Td className="font-mono text-[12.5px] font-semibold">{r.supplierCode}</Td>
                      <Td><Link to={`${root}/${r.supplierId}`} className="font-semibold hover:text-[var(--accent)]">{r.supplierName}</Link></Td>
                      <Td className="text-right font-mono">{formatCurrency(r.payable)}</Td>
                      <Td className="text-right font-mono">{formatCurrency(r.paid)}</Td>
                      <Td className={`text-right font-mono font-semibold ${r.debt > 0 ? 'text-[var(--warning)]' : ''}`}>{formatCurrency(r.debt)}</Td>
                      <Td className="text-right font-mono">{r.openCount}</Td>
                      <Td className="whitespace-nowrap text-[13px]">{r.oldestDate ? formatDateOnly(r.oldestDate) : '—'}</Td>
                    </tr>
                  ))}
                </tbody>
              </DataTable>
              <Pagination page={list.data.page} pageCount={list.data.pageCount} total={list.data.total} pageSize={WAREHOUSE_PAGE_SIZE} onChange={setPage} unit="nhà cung cấp" />
            </>
          )}
        </Card>
      </div>
    </AppShell>
  );
}

/** UC-KHO-25: chi tiết công nợ một nhà cung cấp; khu Kho có Thanh toán / Hủy thanh toán (UC-KHO-26). */
export function DebtDetailPage({ manager = false }: { manager?: boolean }) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const detail = useDebt(id, manager);
  const d = detail.data;
  const [payOrders, setPayOrders] = useState<PayableOrder[] | null>(null);
  const [cancelTarget, setCancelTarget] = useState<SupplierPayment | null>(null);
  const root = manager ? '/quan-ly/cong-no' : '/kho/cong-no';
  const owing = useMemo(() => (d?.orders ?? []).filter((o) => o.debt > 0).map(toPayable), [d]);

  return (
    <AppShell meta={{ label: d ? d.supplierName : 'Công nợ', parent: 'Công nợ nhà cung cấp', parentTo: root }}>
      <div className="min-w-0 space-y-4">
        {detail.isError ? (
          <BlockError message="Không tìm thấy nhà cung cấp" onRetry={() => navigate(root)} />
        ) : !d ? (
          <Skeleton className="h-64" />
        ) : (
          <>
            <SubPageHeader
              title={`Công nợ · ${d.supplierName}`}
              badge={d.debt > 0 ? <Badge variant="warning">Còn nợ</Badge> : <Badge variant="accent">Đã trả hết</Badge>}
              description={`Mã ${d.supplierCode} · thanh toán ${PAYMENT_METHOD[d.paymentMethod].toLowerCase()}`}
              backTo={root}
              actions={!manager && owing.length ? <Button leadingIcon={<Wallet size={15} />} onClick={() => setPayOrders(owing)}>Thanh toán</Button> : null}
            />
            <div className="grid gap-3 sm:grid-cols-3">
              <StatTile label="Phải trả" value={formatCurrency(d.payable)} />
              <StatTile label="Đã trả" value={formatCurrency(d.paid)} />
              <StatTile label="Còn nợ" value={formatCurrency(d.debt)} tone={d.debt > 0 ? 'warning' : 'default'} />
            </div>
            <Card className="overflow-hidden">
              <div className="p-5 pb-3"><CardHeader title="Phiếu mua có phát sinh phải trả" /></div>
              {d.orders.length === 0 ? (
                <p className="px-5 pb-5 text-[13px] text-[var(--text-muted)]">Chưa có phiếu nào.</p>
              ) : (
                <DataTable minWidth={960}>
                  <thead><tr><Th>Mã phiếu</Th><Th>Ngày đặt</Th><Th>Trạng thái nhận</Th><Th className="text-right">Phải trả</Th><Th className="text-right">Đã trả</Th><Th className="text-right">Còn nợ</Th><Th>Thanh toán</Th>{!manager ? <Th className="text-right"><span className="sr-only">Thao tác</span></Th> : null}</tr></thead>
                  <tbody>
                    {d.orders.map((o) => {
                      const st = purchaseStatusLabel(o.status, o.receiveStatus);
                      return (
                        <tr key={o.id}>
                          <Td className="font-mono text-[12.5px] font-semibold">{manager ? o.code : <Link to={`/kho/phieu-mua/${o.id}`} className="hover:text-[var(--accent)]">{o.code}</Link>}</Td>
                          <Td className="whitespace-nowrap text-[13px]">{o.orderDate ? formatDateOnly(o.orderDate) : '—'}</Td>
                          <Td><Badge variant={st.variant}>{st.label}</Badge></Td>
                          <Td className="text-right font-mono">{formatCurrency(o.payable)}</Td>
                          <Td className="text-right font-mono">{formatCurrency(o.paid)}</Td>
                          <Td className={`text-right font-mono font-semibold ${o.debt > 0 ? 'text-[var(--warning)]' : ''}`}>{formatCurrency(o.debt)}</Td>
                          <Td>{o.paymentStatus ? <Badge variant={PAYMENT_STATUS[o.paymentStatus].variant}>{PAYMENT_STATUS[o.paymentStatus].label}</Badge> : '—'}</Td>
                          {!manager ? (
                            <Td className="text-right">
                              {o.debt > 0 ? <Button size="sm" variant="outline" onClick={() => setPayOrders([toPayable(o)])}>Thanh toán</Button> : null}
                            </Td>
                          ) : null}
                        </tr>
                      );
                    })}
                  </tbody>
                </DataTable>
              )}
            </Card>
            <Card className="overflow-hidden">
              <div className="p-5 pb-3"><CardHeader title="Lịch sử thanh toán" /></div>
              {d.payments.length === 0 ? (
                <p className="px-5 pb-5 text-[13px] text-[var(--text-muted)]">Chưa có thanh toán.</p>
              ) : (
                <DataTable minWidth={1040}>
                  <thead><tr><Th>Mã TT</Th><Th>Ngày thanh toán</Th><Th>Phiếu mua</Th><Th className="text-right">Số tiền</Th><Th>Phương thức</Th><Th>Mã tham chiếu</Th><Th>Người ghi</Th><Th>Trạng thái</Th>{!manager ? <Th className="text-right"><span className="sr-only">Thao tác</span></Th> : null}</tr></thead>
                  <tbody>
                    {d.payments.map((p) => (
                      <tr key={p.id}>
                        <Td className="font-mono text-[12.5px] font-semibold">{p.code}</Td>
                        <Td className="whitespace-nowrap text-[13px]">{formatDateTime(p.paidAt)}</Td>
                        <Td className="font-mono text-[12.5px]">{p.purchaseOrderCode ?? '—'}</Td>
                        <Td className={`text-right font-mono font-semibold ${p.status === 'cancelled' ? 'text-[var(--text-muted)] line-through' : ''}`}>{formatCurrency(p.amount)}</Td>
                        <Td>{PAYMENT_METHOD[p.method]}</Td>
                        <Td className="text-[13px]">{p.reference || '—'}</Td>
                        <Td className="whitespace-nowrap text-[13px]">{p.by}</Td>
                        <Td>
                          <Badge variant={p.status === 'valid' ? 'accent' : 'neutral'}>{p.status === 'valid' ? 'Hiệu lực' : 'Đã hủy'}</Badge>
                          {p.cancelReason ? <p className="mt-0.5 text-[12px] text-[var(--text-muted)]">{p.cancelReason}</p> : null}
                        </Td>
                        {!manager ? (
                          <Td className="text-right">
                            {p.status === 'valid' ? (
                              <RowActions name={p.code} items={[{ label: 'Hủy thanh toán', icon: <Ban size={15} />, danger: true, onSelect: () => setCancelTarget(p) }]} />
                            ) : null}
                          </Td>
                        ) : null}
                      </tr>
                    ))}
                  </tbody>
                </DataTable>
              )}
            </Card>
          </>
        )}
      </div>
      {!manager ? (
        <>
          <PaymentDialog open={Boolean(payOrders)} onClose={() => setPayOrders(null)} orders={payOrders ?? []} defaultMethod={d?.paymentMethod} />
          <CancelPaymentDialog payment={cancelTarget} onClose={() => setCancelTarget(null)} />
        </>
      ) : null}
    </AppShell>
  );
}

export default DebtsPage;
