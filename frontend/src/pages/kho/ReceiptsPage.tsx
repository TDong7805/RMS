import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Ban, Layers, PackageCheck, PackagePlus, PackageSearch } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { Card, CardHeader } from '@/components/common/Card';
import { Badge } from '@/components/common/Badge';
import { Button } from '@/components/common/Button';
import { BlockError, EmptyState, FilteredEmpty } from '@/components/common/EmptyState';
import { FilterChips } from '@/components/common/FilterChips';
import { Field, SearchInput, TextArea, TextInput } from '@/components/common/Form';
import { SubPageHeader } from '@/components/common/SubPageHeader';
import { ConfirmDialog } from '@/components/common/Modal';
import { DataTable, PageHeader, Pagination, StatTile, TableSkeleton, Td, Th, Toolbar } from '@/components/common/PageParts';
import { Skeleton } from '@/components/common/Skeleton';
import { WAREHOUSE_PAGE_SIZE } from '@/api/warehouse-ingredients';
import { cancelReceipt } from '@/api/warehouse-receipts';
import { useReceipt, useReceipts, wk } from '@/features/warehouse/queries';
import { formatQty, RECEIPT_KIND } from '@/features/warehouse/labels';
import { dateKeyOffset, InfoItem } from '@/features/warehouse/parts';
import { useApiMutation } from '@/hooks/use-api-mutation';
import { useDebounced } from '@/hooks/use-debounced';
import { formatCurrency } from '@/lib/format';
import { formatDateTime } from '@/lib/labels';
import type { ReceiptDetail, ReceiptKind } from '@/types';

const KINDS = Object.keys(RECEIPT_KIND) as ReceiptKind[];
const dayDiff = (a: string, b: string) => Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86_400_000);

function StatusBadge({ status }: { status: 'posted' | 'cancelled' }) {
  return <Badge variant={status === 'posted' ? 'accent' : 'danger'}>{status === 'posted' ? 'Đã ghi sổ' : 'Đã hủy'}</Badge>;
}

/** UC-KHO-19: lịch sử nhập kho — trang chính của menu Nhập kho. */
export function ReceiptsPage() {
  const navigate = useNavigate();
  const [keyword, setKeyword] = useState('');
  const [filters, setFilters] = useState<Record<string, string | undefined>>({});
  const kind = (filters.kind ?? 'all') as ReceiptKind | 'all';
  const [from, setFrom] = useState(dateKeyOffset(-29));
  const [to, setTo] = useState(dateKeyOffset(0));
  const [page, setPage] = useState(1);
  const debounced = useDebounced(keyword);
  const rangeError = !from || !to ? 'Vui lòng chọn khoảng thời gian' : from > to ? 'Khoảng thời gian không hợp lệ' : dayDiff(from, to) >= 366 ? 'Khoảng thời gian tối đa 366 ngày' : '';
  const list = useReceipts({ keyword: debounced, kind, from, to, page }, !rangeError);
  useEffect(() => setPage(1), [debounced, kind, from, to]);
  const hasFilter = Boolean(keyword || kind !== 'all');
  const clearFilters = () => {
    setKeyword('');
    setFilters({});
  };

  return (
    <AppShell meta={{ label: 'Nhập kho' }}>
      <div className="min-w-0 space-y-4">
        <PageHeader
          title="Nhập kho"
          description="Lịch sử phiếu nhập: theo phiếu mua, nhập không phiếu, tồn đầu kỳ. Phiếu nhập không sửa, không xóa; chỉ hủy được phiếu vừa lập."
          actions={
            <>
              <Button variant="outline" leadingIcon={<PackagePlus size={15} />} onClick={() => navigate('/kho/nhap-kho/khong-phieu')}>Nhập không phiếu</Button>
              <Button leadingIcon={<PackageCheck size={15} />} onClick={() => navigate('/kho/nhap-kho/theo-phieu-mua')}>Nhận hàng theo phiếu mua</Button>
            </>
          }
        />
        <Card className="overflow-hidden">
          <Toolbar>
            <SearchInput value={keyword} onChange={setKeyword} placeholder="Mã phiếu nhập, mã phiếu mua, nơi mua…" className="w-full sm:w-[280px]" />
            <div className="flex items-center gap-2">
              <TextInput type="date" aria-label="Từ ngày" value={from} onChange={(e) => setFrom(e.target.value)} invalid={Boolean(rangeError)} className="w-[150px]" />
              <span className="text-[var(--text-muted)]">–</span>
              <TextInput type="date" aria-label="Đến ngày" value={to} onChange={(e) => setTo(e.target.value)} invalid={Boolean(rangeError)} className="w-[150px]" />
            </div>
            <FilterChips
              value={filters}
              onChange={setFilters}
              fields={[{ key: 'kind', label: 'Loại', icon: <Layers size={14} />, options: KINDS.map((k) => ({ value: k, label: RECEIPT_KIND[k] })) }]}
            />
          </Toolbar>
          {rangeError ? <p className="px-5 pb-2 text-[12.5px] text-[var(--danger)]">{rangeError}</p> : null}
          {list.isError ? (
            <div className="p-5"><BlockError onRetry={() => void list.refetch()} retrying={list.isFetching} /></div>
          ) : rangeError ? null : list.isLoading || !list.data ? (
            <TableSkeleton cols={9} />
          ) : list.data.items.length === 0 ? (
            hasFilter ? (
              <FilteredEmpty title="Không có phiếu nhập phù hợp" unit="phiếu nhập" onClear={clearFilters} />
            ) : (
              <div className="p-5">
                <EmptyState icon={PackageSearch} title="Chưa có phiếu nhập nào trong khoảng thời gian này" />
              </div>
            )
          ) : (
            <div className={list.isFetching ? 'opacity-60 transition-opacity' : ''}>
              <DataTable minWidth={1100}>
                <thead>
                  <tr><Th>Mã PN</Th><Th>Thời điểm</Th><Th>Loại</Th><Th>Phiếu mua</Th><Th>NCC / Nơi mua</Th><Th className="text-right">Số NL</Th><Th className="text-right">Giá trị</Th><Th>Người nhập</Th><Th>Trạng thái</Th></tr>
                </thead>
                <tbody>
                  {list.data.items.map((r) => (
                    <tr key={r.id} className="hover:bg-[var(--bg-subtle)]">
                      <Td><Link to={`/kho/nhap-kho/${r.id}`} className="font-mono text-[12.5px] font-semibold hover:text-[var(--accent)]">{r.code}</Link></Td>
                      <Td className="whitespace-nowrap text-[13px]">{formatDateTime(r.at)}</Td>
                      <Td className="whitespace-nowrap">{RECEIPT_KIND[r.kind]}</Td>
                      <Td>{r.purchaseOrderId ? <Link to={`/kho/phieu-mua/${r.purchaseOrderId}`} className="font-mono text-[12.5px] hover:text-[var(--accent)]">{r.purchaseOrderCode}</Link> : '—'}</Td>
                      <Td className="min-w-[150px]">{r.source || '—'}</Td>
                      <Td className="text-right font-mono">{r.itemCount}</Td>
                      <Td className={`text-right font-mono font-semibold ${r.status === 'cancelled' ? 'text-[var(--text-muted)] line-through' : ''}`}>{formatCurrency(r.value)}</Td>
                      <Td className="whitespace-nowrap text-[13px]">{r.by}</Td>
                      <Td><StatusBadge status={r.status} /></Td>
                    </tr>
                  ))}
                </tbody>
              </DataTable>
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border)] px-5 py-2 text-[13px]">
                <span>Tổng giá trị (không tính phiếu đã hủy): <b className="font-mono">{formatCurrency(list.data.totalValue)}</b></span>
              </div>
              <Pagination page={list.data.page} pageCount={list.data.pageCount} total={list.data.total} pageSize={WAREHOUSE_PAGE_SIZE} onChange={setPage} unit="phiếu nhập" />
            </div>
          )}
        </Card>
      </div>
    </AppShell>
  );
}

/** UC-KHO-19: chi tiết phiếu nhập + hủy phiếu nhập vừa lập (luồng A). */
export function ReceiptDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const detail = useReceipt(id);
  const r = detail.data;
  const [cancelOpen, setCancelOpen] = useState(false);

  return (
    <AppShell meta={{ label: r ? r.code : 'Chi tiết phiếu nhập', parent: 'Nhập kho', parentTo: '/kho/nhap-kho' }}>
      <div className="min-w-0 space-y-4">
        {detail.isError ? (
          <>
            <SubPageHeader title="Chi tiết phiếu nhập" backTo="/kho/nhap-kho" />
            <BlockError message="Không tìm thấy phiếu nhập" onRetry={() => navigate('/kho/nhap-kho')} />
          </>
        ) : !r ? (
          <Skeleton className="h-64" />
        ) : (
          <>
            <SubPageHeader
              title={`Phiếu nhập ${r.code}`}
              badge={<StatusBadge status={r.status} />}
              description={`${RECEIPT_KIND[r.kind]} · ${formatDateTime(r.at)} · ${r.by}`}
              backTo="/kho/nhap-kho"
              actions={
                r.status === 'posted' && r.canCancel ? (
                  <Button variant="danger" leadingIcon={<Ban size={15} />} onClick={() => setCancelOpen(true)}>Hủy phiếu nhập</Button>
                ) : null
              }
            />
            <div className="grid gap-3 sm:grid-cols-3">
              <StatTile label="Người nhập" value={<span className="font-sans text-[18px]">{r.by}</span>} hint={formatDateTime(r.at)} />
              <StatTile label="Giá trị" value={formatCurrency(r.value)} hint={`${r.lines.length} nguyên liệu`} />
              <StatTile label={r.kind === 'po' ? 'Phiếu mua' : 'NCC / Nơi mua'} value={<span className="font-sans text-[16px]">{r.kind === 'po' && r.purchaseOrderId ? <Link to={`/kho/phieu-mua/${r.purchaseOrderId}`} className="hover:text-[var(--accent)]">{r.purchaseOrderCode}</Link> : r.source || '—'}</span>} hint={r.kind === 'po' ? r.source : undefined} />
            </div>
            {r.status === 'cancelled' ? (
              <Card padded className="border-[var(--danger)]">
                <InfoItem label="Đã hủy">{r.cancelReason} — {r.cancelledBy} · {r.cancelledAt ? formatDateTime(r.cancelledAt) : ''}</InfoItem>
              </Card>
            ) : !r.canCancel && r.cannotCancelReason ? (
              <p className="text-[12.5px] text-[var(--text-muted)]">Không hủy được phiếu nhập này: {r.cannotCancelReason}</p>
            ) : null}
            {r.note ? <Card padded><InfoItem label="Ghi chú">{r.note}</InfoItem></Card> : null}
            <Card className="overflow-hidden">
              <div className="p-5 pb-3"><CardHeader title="Nguyên liệu đã nhập" /></div>
              <DataTable minWidth={900}>
                <thead><tr><Th>Nguyên liệu</Th><Th className="text-right">SL nhập</Th><Th className="text-right">Quy ra đơn vị kho</Th><Th className="text-right">Đơn giá</Th><Th className="text-right">Đơn giá nhập kho</Th><Th className="text-right">Thành tiền</Th></tr></thead>
                <tbody>
                  {r.lines.map((l) => (
                    <tr key={l.id}>
                      <Td>
                        <Link to={`/kho/nguyen-lieu/${l.ingredientId}`} className="font-semibold hover:text-[var(--accent)]">{l.ingredientName}</Link>
                        <p className="font-mono text-[12px] text-[var(--text-muted)]">{l.ingredientCode}{l.note ? ` · ${l.note}` : ''}</p>
                      </Td>
                      <Td className="text-right font-mono">{formatQty(l.qty, l.unit)}</Td>
                      <Td className="text-right font-mono">{formatQty(l.stockQty, l.stockUnit)}</Td>
                      <Td className="text-right font-mono">{formatCurrency(l.unitPrice)} / {l.unit}</Td>
                      <Td className="text-right font-mono text-[var(--text-secondary)]">{formatCurrency(l.stockUnitCost)} / {l.stockUnit}</Td>
                      <Td className="text-right font-mono font-semibold">{formatCurrency(l.amount)}</Td>
                    </tr>
                  ))}
                </tbody>
              </DataTable>
            </Card>
          </>
        )}
      </div>
      {r ? <CancelReceiptDialog receipt={r} open={cancelOpen} onClose={() => setCancelOpen(false)} /> : null}
    </AppShell>
  );
}

function CancelReceiptDialog({ receipt, open, onClose }: { receipt: ReceiptDetail; open: boolean; onClose: () => void }) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    if (open) {
      setReason('');
      setError('');
    }
  }, [open]);
  const mutation = useApiMutation(() => cancelReceipt(receipt.id, reason), {
    invalidate: [wk.all],
    success: () => `Đã hủy phiếu nhập ${receipt.code}`,
    onFieldErrors: (f) => setError(f.reason ?? Object.values(f)[0] ?? ''),
    onSuccess: onClose,
  });
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title="Hủy phiếu nhập?"
      description={`Tồn kho và giá vốn của ${receipt.lines.length} nguyên liệu sẽ trở về như trước khi nhập.${receipt.purchaseOrderCode ? ` Phiếu mua ${receipt.purchaseOrderCode} được tính lại số đã nhận và công nợ.` : ''}`}
      cancelLabel="Đóng"
      confirmLabel="Hủy phiếu nhập"
      loading={mutation.isPending}
      onConfirm={() => {
        if (reason.trim().length < 5) {
          setError('Vui lòng nhập lý do hủy (ít nhất 5 ký tự)');
          return;
        }
        mutation.mutate(undefined);
      }}
    >
      <Field label="Lý do hủy" htmlFor="rc-cancel" required error={error} hint={`${reason.length}/300 ký tự`}>
        <TextArea id="rc-cancel" rows={2} maxLength={300} value={reason} invalid={Boolean(error)} onChange={(e) => { setReason(e.target.value); setError(''); }} placeholder="VD: Nhập sai số lượng nghêu" />
      </Field>
    </ConfirmDialog>
  );
}

export default ReceiptsPage;
