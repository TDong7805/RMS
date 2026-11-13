import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, History, Pencil, Plus, Power, PowerOff, RotateCcw, Tag, Trash2 } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { Card, CardHeader } from '@/components/common/Card';
import { Badge } from '@/components/common/Badge';
import { Button } from '@/components/common/Button';
import { BlockError, EmptyState } from '@/components/common/EmptyState';
import { SearchInput } from '@/components/common/Form';
import { DataTable, PageHeader, StatTile, Td, Th, Toolbar } from '@/components/common/PageParts';
import { Segmented } from '@/components/common/Segmented';
import { Skeleton } from '@/components/common/Skeleton';
import { LinkFormDialog, LinkStopDialog, PriceHistoryDialog, type LinkDialogMode } from '@/features/warehouse/LinkDialogs';
import { SupplierActivateDialog, SupplierDeleteDialog, SupplierStopDialog } from '@/features/warehouse/SupplierDialogs';
import { useSupplier } from '@/features/warehouse/queries';
import { formatQty, formatSpec, PAYMENT_METHOD, SUPPLIER_STOP_REASON } from '@/features/warehouse/labels';
import { ActiveBadge, InfoItem } from '@/features/warehouse/parts';
import { formatCurrency } from '@/lib/format';
import { formatDateOnly, formatDateTime } from '@/lib/labels';
import { matchesKeyword } from '@/lib/normalize';
import type { LinkStatus, Supplier, SupplierLink } from '@/types';

/** UC-KHO-11: chi tiết nhà cung cấp, nguyên liệu cung cấp và giá theo đơn vị mua, lịch sử trạng thái. */
export function SupplierDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const detail = useSupplier(id);
  const s = detail.data;

  const [keyword, setKeyword] = useState('');
  const [linkStatus, setLinkStatus] = useState<LinkStatus | 'all'>('all');
  const [linkDialog, setLinkDialog] = useState<{ mode: LinkDialogMode; link: SupplierLink | null } | null>(null);
  const [stopLinkTarget, setStopLinkTarget] = useState<SupplierLink | null>(null);
  const [historyTarget, setHistoryTarget] = useState<SupplierLink | null>(null);
  const [stopTarget, setStopTarget] = useState<Supplier | null>(null);
  const [activateTarget, setActivateTarget] = useState<Supplier | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Supplier | null>(null);

  const links = useMemo(
    () =>
      (s?.links ?? [])
        .filter((l) => linkStatus === 'all' || l.status === linkStatus)
        .filter((l) => !keyword.trim() || matchesKeyword(l.ingredientName, keyword) || matchesKeyword(l.ingredientCode, keyword)),
    [s, keyword, linkStatus],
  );
  const linkedIds = useMemo(() => (s?.links ?? []).map((l) => l.ingredientId), [s]);
  const active = s?.status === 'active';

  return (
    <AppShell meta={{ label: s ? s.name : 'Chi tiết nhà cung cấp', parent: 'Quản lý nhà cung cấp' }}>
      <div className="min-w-0 space-y-4">
        {detail.isError ? (
          <>
            <PageHeader title="Chi tiết nhà cung cấp" />
            <BlockError message="Không tìm thấy nhà cung cấp" onRetry={() => void detail.refetch()} retrying={detail.isFetching} />
            <Button variant="ghost" size="sm" leadingIcon={<ArrowLeft size={15} />} onClick={() => navigate('/kho/nha-cung-cap')}>Về danh sách</Button>
          </>
        ) : !s ? (
          <div className="space-y-4">
            <Skeleton className="h-16" />
            <div className="grid gap-3 sm:grid-cols-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24" />)}</div>
            <Skeleton className="h-64" />
          </div>
        ) : (
          <>
            <PageHeader
              title={s.name}
              description={`Mã ${s.code} · thêm ngày ${formatDateOnly(s.createdAt)} · cập nhật ${formatDateTime(s.updatedAt)}`}
              actions={
                <div className="flex flex-wrap gap-2">
                  <Button variant="ghost" size="sm" leadingIcon={<ArrowLeft size={15} />} onClick={() => navigate('/kho/nha-cung-cap')}>Về danh sách</Button>
                  <Button variant="outline" size="sm" leadingIcon={<Pencil size={15} />} onClick={() => navigate(`/kho/nha-cung-cap/${s.id}/sua`)}>Sửa</Button>
                  {active ? (
                    <Button variant="outline" size="sm" leadingIcon={<PowerOff size={15} />} onClick={() => setStopTarget(s)}>Ngừng hoạt động</Button>
                  ) : (
                    <Button variant="outline" size="sm" leadingIcon={<Power size={15} />} onClick={() => setActivateTarget(s)}>Kích hoạt lại</Button>
                  )}
                  {!s.hasPurchases ? (
                    <Button variant="danger" size="sm" leadingIcon={<Trash2 size={15} />} onClick={() => setDeleteTarget(s)}>Xóa</Button>
                  ) : null}
                </div>
              }
            />

            <div className="grid gap-3 sm:grid-cols-3">
              <StatTile label="Trạng thái" value={<span className="font-sans text-[18px]"><ActiveBadge active={active} activeLabel="Đang hoạt động" inactiveLabel="Ngừng hoạt động" /></span>} hint={!active && s.stopReason ? `Lý do: ${SUPPLIER_STOP_REASON[s.stopReason]}` : undefined} />
              <StatTile label="Nguyên liệu đang cung cấp" value={s.activeLinkCount} hint={`${s.links.length} liên kết (kể cả đã ngừng)`} tone="accent" />
              <StatTile label="Phiếu mua chờ nhận" value={s.openPurchaseCount} hint={s.hasPurchases ? 'Đã có phiếu mua nên không xóa được' : 'Chưa có phiếu mua nào'} />
            </div>

            <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
              <Card padded>
                <CardHeader title="Thông tin liên hệ" />
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <InfoItem label="Số điện thoại"><span className="font-mono">{s.phone}</span></InfoItem>
                  <InfoItem label="Phương thức thanh toán">{PAYMENT_METHOD[s.paymentMethod]}</InfoItem>
                  <InfoItem label="Người liên hệ">{s.contact || '—'}</InfoItem>
                  <InfoItem label="Email">{s.email ? <a className="text-[var(--accent)] hover:underline" href={`mailto:${s.email}`}>{s.email}</a> : '—'}</InfoItem>
                  <InfoItem label="Website">{s.website ? <a className="text-[var(--accent)] hover:underline" href={s.website} target="_blank" rel="noreferrer">{s.website}</a> : '—'}</InfoItem>
                  <InfoItem label="Mã số thuế"><span className="font-mono">{s.taxCode || '—'}</span></InfoItem>
                  <div className="sm:col-span-2"><InfoItem label="Địa chỉ">{s.address || '—'}</InfoItem></div>
                  <div className="sm:col-span-2"><InfoItem label="Ghi chú">{s.note || '—'}</InfoItem></div>
                  {!active ? (
                    <div className="rounded-item bg-[var(--warning-soft)] px-3 py-2 sm:col-span-2">
                      <InfoItem label="Đang ngừng hoạt động">
                        {s.stopReason ? SUPPLIER_STOP_REASON[s.stopReason] : '—'}
                        {s.stopNote ? ` — ${s.stopNote}` : ''}
                      </InfoItem>
                    </div>
                  ) : null}
                </div>
              </Card>

              <Card padded>
                <CardHeader title="Lịch sử trạng thái" />
                <ol className="mt-3 space-y-3">
                  {s.history.map((e) => (
                    <li key={e.id} className="border-l-2 border-[var(--border)] pl-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <ActiveBadge active={e.status === 'active'} activeLabel="Hoạt động" inactiveLabel="Ngừng" />
                        <span className="text-[12px] text-[var(--text-muted)]">{formatDateTime(e.at)}</span>
                      </div>
                      <p className="mt-1 text-[13px]">
                        {e.reason ? SUPPLIER_STOP_REASON[e.reason] : e.note || (e.status === 'active' ? 'Kích hoạt lại' : '')}
                        {e.reason && e.note ? ` — ${e.note}` : ''}
                      </p>
                      {e.by ? <p className="text-[12px] text-[var(--text-muted)]">{e.by}</p> : null}
                    </li>
                  ))}
                </ol>
              </Card>
            </div>

            <Card className="overflow-hidden">
              <div className="flex flex-wrap items-start justify-between gap-3 p-5 pb-3">
                <CardHeader title="Nguyên liệu cung cấp" description="Giá nhập tính cho 1 đơn vị mua; cột “Giá / đơn vị kho” để so sánh giữa các nhà cung cấp" />
                <Button size="sm" leadingIcon={<Plus size={15} />} disabled={!active} title={active ? undefined : 'Nhà cung cấp đang ngừng hoạt động'} onClick={() => setLinkDialog({ mode: 'add', link: null })}>
                  Thêm nguyên liệu
                </Button>
              </div>
              <Toolbar>
                <SearchInput value={keyword} onChange={setKeyword} placeholder="Tìm nguyên liệu…" className="w-full sm:w-[240px]" />
                <Segmented<LinkStatus | 'all'>
                  ariaLabel="Lọc liên kết theo trạng thái"
                  value={linkStatus}
                  onChange={setLinkStatus}
                  options={[
                    { value: 'all', label: 'Tất cả' },
                    { value: 'active', label: 'Đang cung cấp' },
                    { value: 'inactive', label: 'Đã ngừng' },
                  ]}
                />
              </Toolbar>
              {links.length === 0 ? (
                <div className="p-5">
                  <EmptyState
                    icon={Tag}
                    title={s.links.length === 0 ? 'Chưa có nguyên liệu nào.' : 'Không tìm thấy nguyên liệu'}
                    description={s.links.length === 0 ? 'Thêm nguyên liệu nhà cung cấp này bán để dùng khi lập phiếu mua.' : 'Thử từ khóa hoặc bộ lọc khác.'}
                  />
                </div>
              ) : (
                <DataTable minWidth={1080}>
                  <thead>
                    <tr>
                      <Th>Nguyên liệu</Th>
                      <Th>Quy cách</Th>
                      <Th className="text-right">Giá nhập</Th>
                      <Th className="text-right">Giá / đơn vị kho</Th>
                      <Th className="text-right">SL tối thiểu</Th>
                      <Th>Áp dụng từ</Th>
                      <Th>Trạng thái</Th>
                      <Th className="text-right">Thao tác</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {links.map((l) => (
                      <tr key={l.id} className="hover:bg-[var(--bg-subtle)]">
                        <Td>
                          <Link to={`/kho/nguyen-lieu/${l.ingredientId}`} className="font-semibold hover:text-[var(--accent)]">{l.ingredientName}</Link>
                          <p className="text-[12px] text-[var(--text-muted)]">
                            <span className="font-mono">{l.ingredientCode}</span> · đơn vị kho {l.stockUnit}
                            {!l.ingredientActive ? <> · <Badge variant="neutral">NL ngừng sử dụng</Badge></> : null}
                          </p>
                        </Td>
                        <Td className="text-[13px]">{formatSpec(l.purchaseUnit, l.factor, l.stockUnit)}</Td>
                        <Td className="text-right font-mono font-semibold">{formatCurrency(l.price)} / {l.purchaseUnit}</Td>
                        <Td className="text-right font-mono text-[var(--text-secondary)]">{formatCurrency(l.price / l.factor)} / {l.stockUnit}</Td>
                        <Td className="text-right font-mono">{l.minOrder === null ? '—' : formatQty(l.minOrder, l.purchaseUnit)}</Td>
                        <Td className="whitespace-nowrap text-[13px]">{formatDateOnly(l.effectiveFrom)}</Td>
                        <Td><ActiveBadge active={l.status === 'active'} activeLabel="Đang cung cấp" inactiveLabel="Đã ngừng" /></Td>
                        <Td className="text-right">
                          <div className="inline-flex gap-0.5">
                            <Button size="sm" variant="ghost" aria-label={`Lịch sử giá ${l.ingredientName}`} onClick={() => setHistoryTarget(l)}><History size={14} /></Button>
                            {l.status === 'active' ? (
                              <>
                                <Button size="sm" variant="ghost" aria-label={`Sửa giá ${l.ingredientName}`} disabled={!l.ingredientActive} onClick={() => setLinkDialog({ mode: 'edit', link: l })}><Pencil size={14} /></Button>
                                <Button size="sm" variant="ghost" aria-label={`Ngừng cung cấp ${l.ingredientName}`} onClick={() => setStopLinkTarget(l)}><PowerOff size={14} /></Button>
                              </>
                            ) : (
                              <Button
                                size="sm"
                                variant="ghost"
                                aria-label={`Kích hoạt lại ${l.ingredientName}`}
                                disabled={!l.ingredientActive || !active}
                                title={!l.ingredientActive ? 'Nguyên liệu đang ngừng sử dụng' : !active ? 'Nhà cung cấp đang ngừng hoạt động' : undefined}
                                onClick={() => setLinkDialog({ mode: 'reactivate', link: l })}
                              >
                                <RotateCcw size={14} />
                              </Button>
                            )}
                          </div>
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </DataTable>
              )}
            </Card>

            <LinkFormDialog
              mode={linkDialog?.mode ?? 'add'}
              open={Boolean(linkDialog)}
              supplierId={s.id}
              link={linkDialog?.link ?? null}
              linkedIngredientIds={linkedIds}
              onClose={() => setLinkDialog(null)}
            />
            <LinkStopDialog link={stopLinkTarget} supplierName={s.name} onClose={() => setStopLinkTarget(null)} />
            <PriceHistoryDialog link={historyTarget} onClose={() => setHistoryTarget(null)} />
          </>
        )}
      </div>

      <SupplierStopDialog target={stopTarget} onClose={() => setStopTarget(null)} />
      <SupplierActivateDialog target={activateTarget} onClose={() => setActivateTarget(null)} />
      <SupplierDeleteDialog target={deleteTarget} onClose={() => setDeleteTarget(null)} onDone={() => navigate('/kho/nha-cung-cap')} />
    </AppShell>
  );
}

export default SupplierDetailPage;
