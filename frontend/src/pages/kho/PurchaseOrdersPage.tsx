import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Ban, ClipboardList, Eye, PackageCheck, Pencil, Plus, StopCircle, Trash2, Wallet } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { Card } from '@/components/common/Card';
import { Badge } from '@/components/common/Badge';
import { Button } from '@/components/common/Button';
import { BlockError, EmptyState } from '@/components/common/EmptyState';
import { SearchInput, SelectInput, TextInput } from '@/components/common/Form';
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
  const [supplierId, setSupplierId] = useState('');
  const [status, setStatus] = useState<PurchaseListStatus>(initialStatus && initialStatus in PURCHASE_LIST_STATUS ? initialStatus : 'all');
  const [payment, setPayment] = useState<PaymentStatus | 'all'>('all');
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
  const addButton = (
    <Button size="sm" leadingIcon={<Plus size={15} />} onClick={() => navigate('/kho/phieu-mua/them')}>
      Tạo phiếu mua
    </Button>
  );

  return (
    <AppShell meta={{ label: 'Danh sách phiếu mua', parent: 'Quản lý phiếu mua' }}>
      <div className="min-w-0 space-y-4">
        <PageHeader
          title="Danh sách phiếu mua"
          description="Phiếu đặt hàng nhà cung cấp: trạng thái nhận hàng, thanh toán và công nợ của từng phiếu."
          actions={addButton}
        />

        <Card className="overflow-hidden">
          <Toolbar>
            <SearchInput value={keyword} onChange={setKeyword} placeholder="Mã phiếu, tên phiếu, nhà cung cấp…" className="w-full sm:w-[260px]" />
            <SelectInput
              aria-label="Lọc theo nhà cung cấp"
              value={supplierId}
              onChange={(e) => setSupplierId(e.target.value)}
              placeholder="Tất cả nhà cung cấp"
              options={suppliers.map((s) => ({ value: s.id, label: `${s.name}${s.active ? '' : ' (ngừng)'}` }))}
              className="w-full sm:w-[220px]"
            />
            <SelectInput
              aria-label="Lọc theo trạng thái"
              value={status === 'all' ? '' : status}
              onChange={(e) => setStatus((e.target.value || 'all') as PurchaseListStatus)}
              placeholder="Tất cả trạng thái"
              options={STATUS_KEYS.map((k) => ({ value: k, label: PURCHASE_LIST_STATUS[k] }))}
              className="w-full sm:w-[170px]"
            />
            <SelectInput
              aria-label="Lọc theo thanh toán"
              value={payment === 'all' ? '' : payment}
              onChange={(e) => setPayment((e.target.value || 'all') as PaymentStatus | 'all')}
              placeholder="Mọi thanh toán"
              options={PAYMENT_KEYS.map((k) => ({ value: k, label: PAYMENT_STATUS[k].label }))}
              className="w-full sm:w-[180px]"
            />
            <div className="flex items-center gap-2">
              <TextInput type="date" aria-label="Ngày đặt từ" value={from} onChange={(e) => setFrom(e.target.value)} invalid={Boolean(rangeError)} className="w-[150px]" />
              <span className="text-[var(--text-muted)]">–</span>
              <TextInput type="date" aria-label="Ngày đặt đến" value={to} onChange={(e) => setTo(e.target.value)} invalid={Boolean(rangeError)} className="w-[150px]" />
            </div>
          </Toolbar>
          {rangeError ? <p className="px-5 pb-2 text-[12.5px] text-[var(--danger)]">{rangeError}</p> : null}

          {list.isError ? (
            <div className="p-5"><BlockError onRetry={() => void list.refetch()} retrying={list.isFetching} /></div>
          ) : list.isLoading || !list.data ? (
            <TableSkeleton cols={9} />
          ) : list.data.items.length === 0 ? (
            <div className="p-5">
              <EmptyState
                icon={ClipboardList}
                title={hasFilter ? 'Không tìm thấy phiếu mua' : 'Chưa có phiếu mua nào.'}
                description={hasFilter ? 'Thử từ khóa hoặc bộ lọc khác.' : undefined}
                action={hasFilter ? undefined : addButton}
              />
            </div>
          ) : (
            <div className={list.isFetching ? 'opacity-60 transition-opacity' : ''}>
              <DataTable minWidth={1180}>
                <thead>
                  <tr>
                    <Th>Mã</Th>
                    <Th>Tên phiếu</Th>
                    <Th>Nhà cung cấp</Th>
                    <Th>Ngày đặt</Th>
                    <Th>Dự kiến nhận</Th>
                    <Th className="text-right">Tổng cộng</Th>
                    <Th>Trạng thái</Th>
                    <Th>Thanh toán</Th>
                    <Th className="text-right">Thao tác</Th>
                  </tr>
                </thead>
                <tbody>
                  {list.data.items.map((r) => {
                    const st = purchaseStatusLabel(r.status, r.receiveStatus);
                    const waiting = r.status === 'ordered' && (r.receiveStatus === 'not_received' || r.receiveStatus === 'partial');
                    return (
                      <tr key={r.id} className="hover:bg-[var(--bg-subtle)]">
                        <Td className="whitespace-nowrap">
                          <Link to={`/kho/phieu-mua/${r.id}`} className="font-mono text-[12.5px] font-semibold hover:text-[var(--accent)]">{r.code}</Link>
                        </Td>
                        <Td className="max-w-[220px]"><span className="line-clamp-2">{r.name}</span></Td>
                        <Td>{r.supplierName}</Td>
                        <Td className="whitespace-nowrap text-[13px]">{r.orderDate ? formatDateOnly(r.orderDate) : '—'}</Td>
                        <Td className="whitespace-nowrap text-[13px]">
                          {r.expectedDate ? formatDateOnly(r.expectedDate) : '—'}
                          {r.late ? <> <Badge variant="danger">Trễ hạn</Badge></> : null}
                        </Td>
                        <Td className="text-right font-mono font-semibold">{formatCurrency(r.total)}</Td>
                        <Td><Badge variant={st.variant}>{st.label}</Badge></Td>
                        <Td>{r.paymentStatus ? <Badge variant={PAYMENT_STATUS[r.paymentStatus].variant}>{PAYMENT_STATUS[r.paymentStatus].label}</Badge> : <span className="text-[var(--text-muted)]">—</span>}</Td>
                        <Td className="text-right">
                          <div className="inline-flex gap-0.5">
                            <Button size="sm" variant="ghost" aria-label={`Xem chi tiết ${r.code}`} onClick={() => navigate(`/kho/phieu-mua/${r.id}`)}><Eye size={14} /></Button>
                            {r.status === 'draft' ? (
                              <>
                                <Button size="sm" variant="ghost" aria-label={`Sửa ${r.code}`} onClick={() => navigate(`/kho/phieu-mua/${r.id}/sua`)}><Pencil size={14} /></Button>
                                <Button size="sm" variant="ghost" aria-label={`Xóa ${r.code}`} onClick={() => setDeleteTarget(toTarget(r))}><Trash2 size={14} /></Button>
                              </>
                            ) : null}
                            {waiting ? (
                              <Button size="sm" variant="ghost" aria-label={`Nhận hàng ${r.code}`} onClick={() => navigate(`/kho/phieu-mua/${r.id}/nhan-hang`)}><PackageCheck size={14} /></Button>
                            ) : null}
                            {r.status === 'ordered' && r.receiveStatus === 'not_received' ? (
                              <Button size="sm" variant="ghost" aria-label={`Hủy phiếu ${r.code}`} onClick={() => setCancelTarget(toTarget(r))}><Ban size={14} /></Button>
                            ) : null}
                            {r.status === 'ordered' && r.receiveStatus === 'partial' ? (
                              <Button size="sm" variant="ghost" aria-label={`Kết thúc nhận hàng ${r.code}`} onClick={() => setCloseTarget(toTarget(r))}><StopCircle size={14} /></Button>
                            ) : null}
                            {r.status === 'ordered' && r.debt > 0 ? (
                              <Button size="sm" variant="ghost" aria-label={`Thanh toán ${r.code}`} onClick={() => setPayOrders([toPayable(r)])}><Wallet size={14} /></Button>
                            ) : null}
                          </div>
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
