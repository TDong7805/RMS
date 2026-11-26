import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Ban, ClipboardList, CreditCard, Eye, Plus, StopCircle, Tag, Trash2, Truck, Wallet } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { Card } from '@/components/common/Card';
import { Badge } from '@/components/common/Badge';
import { Button } from '@/components/common/Button';
import { BlockError, EmptyState, FilteredEmpty } from '@/components/common/EmptyState';
import { FilterChips } from '@/components/common/FilterChips';
import { SearchInput, TextInput } from '@/components/common/Form';
import { RowActions, type RowAction } from '@/components/common/RowActions';
import { DataTable, PageHeader, Pagination, TableSkeleton, Td, Th, Toolbar } from '@/components/common/PageParts';
import { WAREHOUSE_PAGE_SIZE } from '@/api/warehouse-ingredients';
import { PurchaseCancelDialog, PurchaseCloseDialog, PurchaseDeleteDialog, type PurchaseTarget } from '@/features/warehouse/PurchaseDialogs';
import { PaymentDialog, toPayable, type PayableOrder } from '@/features/warehouse/PaymentDialogs';
import { usePurchaseOrders, useSupplierOptions } from '@/features/warehouse/queries';
import { PAYMENT_STATUS, PURCHASE_LIST_STATUS, purchaseStatusLabel } from '@/features/warehouse/labels';
import { useDebounced } from '@/hooks/use-debounced';
import { formatCurrency } from '@/lib/format';
import { formatDateOnly } from '@/lib/labels';
import type { PaymentStatus, PurchaseListStatus, PurchaseOrderRow } from '@/types';

const STATUS_KEYS = Object.keys(PURCHASE_LIST_STATUS).filter((k) => k !== 'all') as PurchaseListStatus[];
const PAYMENT_KEYS = Object.keys(PAYMENT_STATUS) as PaymentStatus[];
const toTarget = (r: PurchaseOrderRow): PurchaseTarget => ({ id: r.id, code: r.code, supplierName: r.supplierName, payable: r.payable });

/** UC-KHO-12: Xem danh sách phiếu mua. */
export function PurchaseOrdersPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const initialStatus = params.get('status') as PurchaseListStatus | null;
  const [keyword, setKeyword] = useState('');
  const [filters, setFilters] = useState<Record<string, string | undefined>>(() => ({
    status: initialStatus && initialStatus !== 'all' && initialStatus in PURCHASE_LIST_STATUS ? initialStatus : undefined,
  }));
  const supplierId = filters.supplier ?? '';
  const status = (filters.status ?? 'all') as PurchaseListStatus;
  const payment = (filters.payment ?? 'all') as PaymentStatus | 'all';
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const debounced = useDebounced(keyword);
  const rangeError = from && to && from > to ? 'Khoảng thời gian không hợp lệ' : '';

  const [cancelTarget, setCancelTarget] = useState<PurchaseTarget | null>(null);
  const [closeTarget, setCloseTarget] = useState<PurchaseTarget | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PurchaseTarget | null>(null);
  const [payOrders, setPayOrders] = useState<PayableOrder[] | null>(null);

  const { data: suppliers = [] } = useSupplierOptions();
  const list = usePurchaseOrders({ keyword: debounced, supplierId, status, payment, from: rangeError ? '' : from, to: rangeError ? '' : to, page });
  useEffect(() => setPage(1), [debounced, supplierId, status, payment, from, to]);
  const hasFilter = Boolean(keyword || supplierId || status !== 'all' || payment !== 'all' || from || to);
  const clearFilters = () => {
    setKeyword('');
    setFilters({});
    setFrom('');
    setTo('');
  };
  const addButton = (
    <Button leadingIcon={<Plus size={15} />} onClick={() => navigate('/kho/phieu-mua/them')}>
      Tạo phiếu mua
    </Button>
  );

  const rowItems = (r: PurchaseOrderRow, waiting: boolean): RowAction[] => {
    const items: RowAction[] = [];
    if (r.status === 'draft' || waiting) items.push({ label: 'Xem chi tiết', icon: <Eye size={15} />, onSelect: () => navigate(`/kho/phieu-mua/${r.id}`) });
    if (r.status === 'ordered' && r.debt > 0) items.push({ label: 'Thanh toán', icon: <Wallet size={15} />, onSelect: () => setPayOrders([toPayable(r)]) });
    if (r.status === 'ordered' && r.receiveStatus === 'partial') items.push({ label: 'Kết thúc nhận hàng', icon: <StopCircle size={15} />, onSelect: () => setCloseTarget(toTarget(r)) });
    if (r.status === 'ordered' && r.receiveStatus === 'not_received') items.push({ label: 'Hủy phiếu', icon: <Ban size={15} />, danger: true, onSelect: () => setCancelTarget(toTarget(r)) });
    if (r.status === 'draft') items.push({ label: 'Xóa phiếu nháp', icon: <Trash2 size={15} />, danger: true, onSelect: () => setDeleteTarget(toTarget(r)) });
    return items;
  };

  return (
    <AppShell meta={{ label: 'Phiếu mua' }}>
      <div className="min-w-0 space-y-4">
        <PageHeader
          title="Phiếu mua"
          description="Phiếu đặt hàng nhà cung cấp: trạng thái nhận hàng, thanh toán và công nợ của từng phiếu."
          actions={addButton}
        />

        <Card className="overflow-hidden">
          <Toolbar>
            <SearchInput value={keyword} onChange={setKeyword} placeholder="Mã phiếu, tên phiếu, nhà cung cấp…" className="w-full sm:w-[260px]" />
            <div className="flex items-center gap-2">
              <TextInput type="date" aria-label="Ngày đặt từ" title="Ngày đặt từ" value={from} onChange={(e) => setFrom(e.target.value)} invalid={Boolean(rangeError)} className="w-[150px]" />
              <span className="text-[var(--text-muted)]">–</span>
              <TextInput type="date" aria-label="Ngày đặt đến" title="Ngày đặt đến" value={to} onChange={(e) => setTo(e.target.value)} invalid={Boolean(rangeError)} className="w-[150px]" />
            </div>
            <FilterChips
              value={filters}
              onChange={setFilters}
              fields={[
                { key: 'status', label: 'Trạng thái', icon: <Tag size={14} />, options: STATUS_KEYS.map((k) => ({ value: k, label: PURCHASE_LIST_STATUS[k] })) },
                { key: 'payment', label: 'Thanh toán', icon: <CreditCard size={14} />, options: PAYMENT_KEYS.map((k) => ({ value: k, label: PAYMENT_STATUS[k].label })) },
                { key: 'supplier', label: 'Nhà cung cấp', icon: <Truck size={14} />, options: suppliers.map((x) => ({ value: x.id, label: `${x.name}${x.active ? '' : ' (ngừng)'}` })) },
              ]}
            />
          </Toolbar>
          {rangeError ? <p className="px-5 pb-2 text-[12.5px] text-[var(--danger)]">{rangeError}</p> : null}

          {list.isError ? (
            <div className="p-5"><BlockError onRetry={() => void list.refetch()} retrying={list.isFetching} /></div>
          ) : list.isLoading || !list.data ? (
            <TableSkeleton cols={9} />
          ) : list.data.items.length === 0 ? (
            hasFilter ? (
              <FilteredEmpty title="Không có phiếu mua phù hợp" unit="phiếu mua" onClear={clearFilters} />
            ) : (
              <div className="p-5">
                <EmptyState icon={ClipboardList} title="Chưa có phiếu mua nào" action={addButton} />
              </div>
            )
          ) : (
            <div className={list.isFetching ? 'opacity-60 transition-opacity' : ''}>
              <DataTable minWidth={1000}>
                <thead>
                  <tr>
                    <Th>Phiếu mua</Th>
                    <Th>Nhà cung cấp</Th>
                    <Th>Ngày đặt</Th>
                    <Th>Dự kiến nhận</Th>
                    <Th className="text-right">Tổng cộng</Th>
                    <Th>Trạng thái</Th>
                    <Th>Thanh toán</Th>
                    <Th className="text-right"><span className="sr-only">Thao tác</span></Th>
                  </tr>
                </thead>
                <tbody>
                  {list.data.items.map((r) => {
                    const st = purchaseStatusLabel(r.status, r.receiveStatus);
                    const waiting = r.status === 'ordered' && (r.receiveStatus === 'not_received' || r.receiveStatus === 'partial');
                    return (
                      <tr key={r.id} className="hover:bg-[var(--bg-subtle)]">
                        <Td className="max-w-[150px]">
                          <Link to={`/kho/phieu-mua/${r.id}`} className="font-mono text-[12.5px] font-semibold hover:text-[var(--accent)]">{r.code}</Link>
                          <p className="truncate text-[12.5px] text-[var(--text-muted)]" title={r.name}>{r.name}</p>
                        </Td>
                        <Td className="min-w-[140px]">{r.supplierName}</Td>
                        <Td className="whitespace-nowrap text-[13px]">{r.orderDate ? formatDateOnly(r.orderDate) : '—'}</Td>
                        <Td className="whitespace-nowrap text-[13px]">
                          {r.expectedDate ? formatDateOnly(r.expectedDate) : '—'}
                          {r.late ? <div className="mt-1"><Badge variant="danger">Trễ hạn</Badge></div> : null}
                        </Td>
                        <Td className="text-right font-mono font-semibold">{formatCurrency(r.total)}</Td>
                        <Td><Badge variant={st.variant}>{st.label}</Badge></Td>
                        <Td>{r.paymentStatus ? <Badge variant={PAYMENT_STATUS[r.paymentStatus].variant}>{PAYMENT_STATUS[r.paymentStatus].label}</Badge> : <span className="text-[var(--text-muted)]">—</span>}</Td>
                        <Td className="text-right">
                          <RowActions
                            name={r.code}
                            primaryLabel={r.status === 'draft' ? 'Sửa' : waiting ? 'Nhận hàng' : 'Xem'}
                            onPrimary={() => navigate(r.status === 'draft' ? `/kho/phieu-mua/${r.id}/sua` : waiting ? `/kho/phieu-mua/${r.id}/nhan-hang` : `/kho/phieu-mua/${r.id}`)}
                            items={rowItems(r, waiting)}
                          />
                        </Td>
                      </tr>
                    );
                  })}
                </tbody>
              </DataTable>
              <Pagination page={list.data.page} pageCount={list.data.pageCount} total={list.data.total} pageSize={WAREHOUSE_PAGE_SIZE} onChange={setPage} unit="phiếu mua" />
            </div>
          )}
        </Card>
      </div>

      <PurchaseCancelDialog target={cancelTarget} onClose={() => setCancelTarget(null)} />
      <PurchaseCloseDialog target={closeTarget} onClose={() => setCloseTarget(null)} />
      <PurchaseDeleteDialog target={deleteTarget} onClose={() => setDeleteTarget(null)} />
      <PaymentDialog open={Boolean(payOrders)} onClose={() => setPayOrders(null)} orders={payOrders ?? []} />
    </AppShell>
  );
}

export default PurchaseOrdersPage;
