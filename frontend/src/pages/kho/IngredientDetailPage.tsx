import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ClipboardList, History, Pencil, Power, PowerOff, Trash2 } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { Card, CardHeader } from '@/components/common/Card';
import { Badge } from '@/components/common/Badge';
import { Button } from '@/components/common/Button';
import { BlockError, EmptyState } from '@/components/common/EmptyState';
import { Field, TextInput } from '@/components/common/Form';
import { DataTable, PageHeader, Pagination, StatTile, TableSkeleton, Td, Th } from '@/components/common/PageParts';
import { Segmented } from '@/components/common/Segmented';
import { Skeleton } from '@/components/common/Skeleton';
import { WAREHOUSE_PAGE_SIZE } from '@/api/warehouse-ingredients';
import { IngredientDeleteDialog, IngredientStatusDialog } from '@/features/warehouse/IngredientDialogs';
import { useIngredient, useStockCard } from '@/features/warehouse/queries';
import { formatQty, formatSpec, INGREDIENT_GROUPS, STOCK_MOVE } from '@/features/warehouse/labels';
import { ActiveBadge, dateKeyOffset, InfoItem, StockLevelBadge } from '@/features/warehouse/parts';
import { formatCurrency } from '@/lib/format';
import { formatDateTime } from '@/lib/labels';
import { fromDateKey } from '@/lib/mock';
import type { Ingredient, StockCardFilter } from '@/types';

type MoveFilter = StockCardFilter['type'];

export function IngredientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const detail = useIngredient(id);
  const it = detail.data;

  const [from, setFrom] = useState(dateKeyOffset(-29));
  const [to, setTo] = useState(dateKeyOffset(0));
  const [type, setType] = useState<MoveFilter>('all');
  const [page, setPage] = useState(1);
  const [statusTarget, setStatusTarget] = useState<Ingredient | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Ingredient | null>(null);

  const rangeError = useMemo(() => {
    if (!from || !to) return '';
    if (from > to) return 'Khoảng thời gian không hợp lệ';
    const days = (fromDateKey(to).getTime() - fromDateKey(from).getTime()) / 86_400_000;
    return days > 366 ? 'Chỉ xem tối đa 366 ngày' : '';
  }, [from, to]);
  const [applied, setApplied] = useState({ from, to });
  useEffect(() => {
    if (!rangeError) setApplied({ from, to });
  }, [from, to, rangeError]);
  useEffect(() => setPage(1), [applied, type]);

  const card = useStockCard(id, { from: applied.from, to: applied.to, type, page });

  return (
    <AppShell meta={{ label: it ? it.name : 'Chi tiết nguyên liệu', parent: 'Quản lý nguyên liệu' }}>
      <div className="min-w-0 space-y-4">
        <PageHeader
          title={it ? it.name : 'Chi tiết nguyên liệu'}
          description={it ? `${it.code} · ${INGREDIENT_GROUPS[it.group]} · Đơn vị kho: ${it.unit}` : undefined}
          actions={
            <>
              <Button variant="ghost" size="sm" leadingIcon={<ArrowLeft size={15} />} onClick={() => navigate('/kho/nguyen-lieu')}>Về danh sách</Button>
              {it ? (
                <>
                  {it.status === 'active' ? (
                    <Button variant="outline" size="sm" leadingIcon={<ClipboardList size={15} />} onClick={() => navigate(`/kho/phieu-mua/them?nl=${it.id}`)}>Tạo phiếu mua</Button>
                  ) : null}
                  <Button variant="outline" size="sm" leadingIcon={<Pencil size={15} />} onClick={() => navigate(`/kho/nguyen-lieu/${it.id}/sua`)}>Sửa</Button>
                  <Button variant="outline" size="sm" leadingIcon={it.status === 'active' ? <PowerOff size={15} /> : <Power size={15} />} onClick={() => setStatusTarget(it)}>
                    {it.status === 'active' ? 'Ngừng sử dụng' : 'Sử dụng lại'}
                  </Button>
                  {it.deletable ? (
                    <Button variant="outline" size="sm" leadingIcon={<Trash2 size={15} />} onClick={() => setDeleteTarget(it)}>Xóa</Button>
                  ) : null}
                </>
              ) : null}
            </>
          }
        />

        {detail.isError ? (
          <BlockError message="Không tìm thấy nguyên liệu" onRetry={() => navigate('/kho/nguyen-lieu')} />
        ) : !it ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20" />)}</div>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <StatTile
                label="Tồn hiện tại"
                value={formatQty(it.onHand, it.unit)}
                hint={<span className="inline-flex items-center gap-1.5">Tối thiểu {formatQty(it.minLevel, it.unit)} <StockLevelBadge level={it.stockLevel} /></span>}
                tone={it.stockLevel === 'out' ? 'danger' : it.stockLevel === 'low' ? 'warning' : 'default'}
              />
              <StatTile label="Giá vốn bình quân" value={it.avgCost === null ? '—' : formatCurrency(it.avgCost)} hint={it.avgCost === null ? 'Chưa có giá vốn (chưa từng nhập)' : `cho 1 ${it.unit}`} />
              <StatTile label="Giá trị tồn" value={formatCurrency(it.onHand * (it.avgCost ?? 0))} hint="Tồn × giá vốn" />
              <StatTile label="Đang chờ nhận" value={formatQty(it.pendingQty, it.unit)} hint={`${it.openPurchaseCount} phiếu mua chưa nhận xong`} tone={it.pendingQty > 0 ? 'accent' : 'default'} />
            </div>

            <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
              <Card padded>
                <CardHeader title="Thông tin chung" />
                <div className="mt-4 grid gap-4 sm:grid-cols-3">
                  <InfoItem label="Mã"><span className="font-mono font-semibold">{it.code}</span></InfoItem>
                  <InfoItem label="Nhóm">{INGREDIENT_GROUPS[it.group]}</InfoItem>
                  <InfoItem label="Đơn vị kho">{it.unit}</InfoItem>
                  <InfoItem label="Tồn tối thiểu">{formatQty(it.minLevel, it.unit)}</InfoItem>
                  <InfoItem label="Trạng thái"><ActiveBadge active={it.status === 'active'} activeLabel="Đang sử dụng" inactiveLabel="Ngừng sử dụng" /></InfoItem>
                  <InfoItem label="Tạo bởi">{it.createdBy} · {formatDateTime(it.createdAt)}</InfoItem>
                  <div className="sm:col-span-3"><InfoItem label="Ghi chú">{it.note || '—'}</InfoItem></div>
                </div>
              </Card>
              <Card padded>
                <CardHeader title="Món sử dụng" description="Theo công thức định lượng do bếp khai báo" />
                {it.dishes.length === 0 ? (
                  <p className="mt-3 text-[13px] text-[var(--text-muted)]">Chưa có món nào dùng nguyên liệu này.</p>
                ) : (
                  <ul className="mt-3 divide-y divide-[var(--border)]">
                    {it.dishes.map((d) => (
                      <li key={d.code} className="flex items-center justify-between gap-3 py-2 text-[14px]">
                        <span className="min-w-0 truncate"><span className="font-mono text-[12px] text-[var(--text-muted)]">{d.code}</span> {d.name}</span>
                        <span className="shrink-0 font-mono text-[13px]">{formatQty(d.qty, it.unit)} / phần</span>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </div>

            <Card className="overflow-hidden">
              <div className="px-5 pt-5 sm:px-6">
                <CardHeader title="Nhà cung cấp" description="Giá nhập tính cho 1 đơn vị mua; cột cuối quy ra 1 đơn vị kho để so sánh" />
              </div>
              {it.suppliers.length === 0 ? (
                <div className="p-5"><EmptyState title="Chưa có nhà cung cấp nào cung cấp nguyên liệu này." description="Thêm liên kết trong trang chi tiết nhà cung cấp." /></div>
              ) : (
                <div className="mt-3">
                  <DataTable minWidth={760}>
                    <thead>
                      <tr>
                        <Th>Nhà cung cấp</Th>
                        <Th>Quy cách mua</Th>
                        <Th className="text-right">Giá nhập</Th>
                        <Th className="text-right">Quy ra {it.unit}</Th>
                        <Th className="text-right">SL đặt tối thiểu</Th>
                        <Th>Liên kết</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {it.suppliers.map((s) => (
                        <tr key={s.supplierId} className="hover:bg-[var(--bg-subtle)]">
                          <Td>
                            <Link to={`/kho/nha-cung-cap/${s.supplierId}`} className="font-semibold hover:text-[var(--accent)]">{s.supplierName}</Link>
                            <p className="font-mono text-[12px] text-[var(--text-muted)]">{s.supplierCode}{s.supplierActive ? '' : ' · ngừng hoạt động'}</p>
                          </Td>
                          <Td>{formatSpec(s.purchaseUnit, s.factor, it.unit)}</Td>
                          <Td className="text-right font-mono">{formatCurrency(s.price)} / {s.purchaseUnit}</Td>
                          <Td className="text-right font-mono">{formatCurrency(s.price / s.factor)}</Td>
                          <Td className="text-right font-mono">{s.minOrder === null ? '—' : formatQty(s.minOrder, s.purchaseUnit)}</Td>
                          <Td><ActiveBadge active={s.linkActive} activeLabel="Đang hoạt động" inactiveLabel="Ngừng" /></Td>
                        </tr>
                      ))}
                    </tbody>
                  </DataTable>
                </div>
              )}
            </Card>

            <Card className="overflow-hidden">
              <div className="flex flex-wrap items-end justify-between gap-3 px-5 pt-5 sm:px-6">
                <CardHeader title="Thẻ kho" icon={<History size={17} />} description="Lịch sử nhập, xuất, điều chỉnh — mới nhất trước" />
                <div className="flex flex-wrap items-end gap-2">
                  <Field label="Từ ngày" htmlFor="sc-from">
                    <TextInput id="sc-from" type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className="w-[160px]" />
                  </Field>
                  <Field label="Đến ngày" htmlFor="sc-to">
                    <TextInput id="sc-to" type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} className="w-[160px]" />
                  </Field>
                  <Segmented<MoveFilter>
                    ariaLabel="Loại biến động"
                    value={type}
                    onChange={setType}
                    options={[
                      { value: 'all', label: 'Tất cả' },
                      { value: 'in', label: 'Nhập' },
                      { value: 'out', label: 'Xuất' },
                      { value: 'adjust', label: 'Điều chỉnh' },
                    ]}
                  />
                </div>
              </div>
              {rangeError ? <p role="alert" className="px-5 pt-2 text-[12.5px] font-medium text-[var(--danger)] sm:px-6">{rangeError}</p> : null}
              <div className="mt-3">
                {card.isLoading || !card.data ? (
                  <TableSkeleton cols={7} rows={5} />
                ) : card.data.items.length === 0 ? (
                  <div className="p-5"><EmptyState title="Không có biến động trong khoảng thời gian này" /></div>
                ) : (
                  <div className={card.isFetching ? 'opacity-60 transition-opacity' : ''}>
                    <DataTable minWidth={880}>
                      <thead>
                        <tr>
                          <Th>Thời điểm</Th>
                          <Th>Loại</Th>
                          <Th>Chứng từ</Th>
                          <Th className="text-right">SL thay đổi</Th>
                          <Th className="text-right">Tồn sau</Th>
                          <Th className="text-right">Đơn giá</Th>
                          <Th>Người thực hiện</Th>
                        </tr>
                      </thead>
                      <tbody>
                        {card.data.items.map((m) => (
                          <tr key={m.id} className="hover:bg-[var(--bg-subtle)]">
                            <Td className="whitespace-nowrap text-[13px]">{formatDateTime(m.at)}</Td>
                            <Td><Badge variant={STOCK_MOVE[m.type].variant}>{STOCK_MOVE[m.type].label}</Badge></Td>
                            <Td className="font-mono text-[12.5px] font-semibold">{m.docCode}</Td>
                            <Td className={`text-right font-mono font-semibold ${m.qtyChange > 0 ? 'text-[var(--accent)]' : 'text-[var(--danger)]'}`}>
                              {m.qtyChange > 0 ? '+' : '−'}{formatQty(Math.abs(m.qtyChange))}
                            </Td>
                            <Td className="text-right font-mono">{formatQty(m.balanceAfter, it.unit)}</Td>
                            <Td className="text-right font-mono">{formatCurrency(m.unitCost)}</Td>
                            <Td className="text-[13px]">{m.by}</Td>
                          </tr>
                        ))}
                      </tbody>
                    </DataTable>
                    <Pagination page={card.data.page} pageCount={card.data.pageCount} total={card.data.total} pageSize={WAREHOUSE_PAGE_SIZE} onChange={setPage} unit="dòng" />
                  </div>
                )}
              </div>
            </Card>
          </>
        )}
      </div>

      <IngredientStatusDialog target={statusTarget} onClose={() => setStatusTarget(null)} />
      <IngredientDeleteDialog target={deleteTarget} onClose={() => setDeleteTarget(null)} onDone={() => navigate('/kho/nguyen-lieu')} />
    </AppShell>
  );
}

export default IngredientDetailPage;
