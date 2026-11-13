import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ClipboardCheck, ClipboardList, PackageMinus, PackagePlus } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AppShell } from '@/components/layout/AppShell';
import { Card, CardHeader } from '@/components/common/Card';
import { Badge } from '@/components/common/Badge';
import { Button } from '@/components/common/Button';
import { BlockError } from '@/components/common/EmptyState';
import { SearchInput, SelectInput, TextInput } from '@/components/common/Form';
import { DataTable, PageHeader, PageTabs, Pagination, StatTile, TableSkeleton, Td, Th, Toolbar } from '@/components/common/PageParts';
import { Segmented } from '@/components/common/Segmented';
import { Skeleton } from '@/components/common/Skeleton';
import { WAREHOUSE_PAGE_SIZE } from '@/api/warehouse-ingredients';
import { useStockSummary, useWarehouseDashboard } from '@/features/warehouse/queries';
import { formatQty, INGREDIENT_GROUP_KEYS, INGREDIENT_GROUPS, RECEIVE_STATUS, STOCKTAKE_STATUS } from '@/features/warehouse/labels';
import { dateKeyOffset, StockLevelBadge } from '@/features/warehouse/parts';
import { useDebounced } from '@/hooks/use-debounced';
import { formatCompactCurrency, formatCurrency } from '@/lib/format';
import { formatDateOnly, formatDateTime } from '@/lib/labels';
import type { IngredientGroup, WarehouseDashboard, WarehousePeriod, WarehouseRange } from '@/types';

type Tab = 'overview' | 'summary';
const dayDiff = (a: string, b: string) => Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86_400_000);

/** UC-KHO-01: Dashboard kho — trang đầu tiên của khu Kho. */
export function WarehouseDashboardPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('overview');
  const [range, setRange] = useState<WarehouseRange>({ period: 'last7', from: '', to: '' });
  const [customFrom, setCustomFrom] = useState(dateKeyOffset(-29));
  const [customTo, setCustomTo] = useState(dateKeyOffset(0));
  const [rangeError, setRangeError] = useState('');

  const choosePeriod = (period: WarehousePeriod) => {
    setRangeError('');
    if (period !== 'custom') setRange({ period, from: '', to: '' });
    else setRange((r) => ({ ...r, period: 'custom', from: customFrom, to: customTo }));
  };
  const applyCustom = () => {
    if (customFrom > customTo) return setRangeError('Khoảng thời gian không hợp lệ');
    if (dayDiff(customFrom, customTo) >= 366) return setRangeError('Chỉ xem tối đa 366 ngày');
    setRangeError('');
    setRange({ period: 'custom', from: customFrom, to: customTo });
  };

  return (
    <AppShell meta={{ label: 'Dashboard' }}>
      <div className="min-w-0 space-y-4">
        <PageHeader
          title="Dashboard kho"
          description="Tình hình kho hiện tại và nhập – xuất – hao hụt trong kỳ."
          actions={
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" leadingIcon={<ClipboardList size={15} />} onClick={() => navigate('/kho/phieu-mua/them')}>Tạo phiếu mua</Button>
              <Button size="sm" variant="outline" leadingIcon={<PackagePlus size={15} />} onClick={() => navigate('/kho/nhap-kho')}>Nhập kho</Button>
              <Button size="sm" variant="outline" leadingIcon={<PackageMinus size={15} />} onClick={() => navigate('/kho/xuat-kho/them')}>Xuất kho</Button>
              <Button size="sm" variant="outline" leadingIcon={<ClipboardCheck size={15} />} onClick={() => navigate('/kho/kiem-ke')}>Kiểm kê</Button>
            </div>
          }
        />
        <div className="flex flex-wrap items-center gap-2">
          <Segmented<WarehousePeriod>
            ariaLabel="Kỳ thống kê"
            value={range.period}
            onChange={choosePeriod}
            options={[
              { value: 'today', label: 'Hôm nay' },
              { value: 'last7', label: '7 ngày qua' },
              { value: 'thisMonth', label: 'Tháng này' },
              { value: 'custom', label: 'Tùy chọn' },
            ]}
          />
          {range.period === 'custom' ? (
            <div className="flex flex-wrap items-center gap-2">
              <TextInput type="date" aria-label="Từ ngày" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="w-[150px]" />
              <span className="text-[var(--text-muted)]">–</span>
              <TextInput type="date" aria-label="Đến ngày" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="w-[150px]" />
              <Button size="sm" onClick={applyCustom}>Áp dụng</Button>
            </div>
          ) : null}
          {rangeError ? <span className="text-[12.5px] text-[var(--danger)]">{rangeError}</span> : null}
        </div>
        <PageTabs<Tab> ariaLabel="Dashboard kho" value={tab} onChange={setTab} items={[{ value: 'overview', label: 'Tổng quan' }, { value: 'summary', label: 'Nhập – xuất – tồn' }]} />
        {tab === 'overview' ? <Overview range={range} /> : <Summary range={range} />}
      </div>
    </AppShell>
  );
}

function Overview({ range }: { range: WarehouseRange }) {
  const q = useWarehouseDashboard(range);
  if (q.isError) return <BlockError onRetry={() => void q.refetch()} retrying={q.isFetching} />;
  if (!q.data) return <div className="grid gap-3 sm:grid-cols-4">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-24" />)}</div>;
  return <OverviewBody d={q.data} fetching={q.isFetching} />;
}

function OverviewBody({ d, fetching }: { d: WarehouseDashboard; fetching: boolean }) {
  const navigate = useNavigate();
  return (
    <div className={`space-y-4 ${fetching ? 'opacity-70 transition-opacity' : ''}`}>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Giá trị tồn kho" value={formatCurrency(d.stockValue)} hint="Hiện tại · tồn × giá vốn" />
        <div className="rounded-item border border-[var(--border)] bg-[var(--bg-surface)] px-4 py-3.5">
          <p className="text-[12.5px] font-medium text-[var(--text-muted)]">Nguyên liệu cần nhập</p>
          <div className="mt-1 flex items-baseline gap-4 font-mono text-[24px] font-bold leading-tight">
            <Link to="/kho/nguyen-lieu?stock=low" className="text-[var(--warning)] hover:underline">{d.lowCount}<span className="ml-1 font-sans text-[12px] font-medium">sắp hết</span></Link>
            <Link to="/kho/nguyen-lieu?stock=out" className="text-[var(--danger)] hover:underline">{d.outCount}<span className="ml-1 font-sans text-[12px] font-medium">hết hàng</span></Link>
          </div>
        </div>
        <button type="button" className="text-left" onClick={() => navigate('/kho/phieu-mua?status=waiting')}>
          <StatTile label="Phiếu mua đang chờ nhận" value={d.pendingPurchaseCount} hint={d.latePurchaseCount ? `${d.latePurchaseCount} phiếu trễ hạn` : 'Không có phiếu trễ hạn'} tone={d.latePurchaseCount ? 'danger' : 'default'} />
        </button>
        <button type="button" className="text-left" onClick={() => navigate('/kho/cong-no')}>
          <StatTile label="Công nợ phải trả" value={formatCurrency(d.debt)} tone={d.debt > 0 ? 'warning' : 'default'} hint="Hiện tại" />
        </button>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <StatTile label="Tổng tiền nhập (trong kỳ)" value={formatCurrency(d.purchaseTotal)} tone="accent" hint="Theo phiếu mua + nhập không phiếu" />
        <StatTile label="Tổng giá trị xuất (trong kỳ)" value={formatCurrency(d.issueValue)} hint="Theo giá vốn lúc xuất" />
        <StatTile label="Giá trị hao hụt (trong kỳ)" value={formatCurrency(d.lossValue)} tone={d.lossValue > 0 ? 'danger' : 'default'} hint="Xuất hủy + kiểm kê giảm" />
      </div>

      <Card padded>
        <CardHeader title="Giá trị nhập và xuất theo ngày" />
        <div className="mt-3 h-[260px] w-full min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={d.series} margin={{ top: 8, right: 8, bottom: 0, left: -8 }} barGap={2}>
              <CartesianGrid strokeDasharray="3 4" stroke="var(--chart-grid)" vertical={false} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={12} tick={{ fill: 'var(--text-muted)', fontSize: 11, fontFamily: 'JetBrains Mono' }} />
              <YAxis tickLine={false} axisLine={false} width={58} tickFormatter={(v: number) => formatCompactCurrency(v)} tick={{ fill: 'var(--text-muted)', fontSize: 10.5, fontFamily: 'JetBrains Mono' }} />
              <Tooltip
                cursor={{ fill: 'var(--bg-subtle)' }}
                formatter={(value: number, name: string) => [formatCurrency(value), name]}
                contentStyle={{ borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg-surface)', fontSize: 12.5 }}
              />
              <Legend iconType="circle" wrapperStyle={{ fontSize: 12.5 }} />
              <Bar dataKey="inValue" name="Nhập" fill="var(--chart-line)" radius={[4, 4, 0, 0]} isAnimationActive={false} />
              <Bar dataKey="outValue" name="Xuất" fill="var(--info)" radius={[4, 4, 0, 0]} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <div className="grid min-w-0 gap-4 lg:grid-cols-2">
        <Card className="overflow-hidden">
          <div className="flex items-start justify-between gap-2 p-5 pb-3">
            <CardHeader title="Nguyên liệu cần nhập" />
            <Link to="/kho/nguyen-lieu?stock=low" className="text-[13px] text-[var(--accent)] hover:underline">Xem tất cả</Link>
          </div>
          {d.needRestock.length === 0 ? (
            <p className="px-5 pb-5 text-[13px] text-[var(--text-muted)]">Chưa có dữ liệu.</p>
          ) : (
            <DataTable minWidth={520}>
              <thead><tr><Th>Nguyên liệu</Th><Th className="text-right">Tồn</Th><Th className="text-right">Tối thiểu</Th><Th>Tình trạng</Th><Th /></tr></thead>
              <tbody>
                {d.needRestock.map((r) => (
                  <tr key={r.id}>
                    <Td><Link to={`/kho/nguyen-lieu/${r.id}`} className="font-semibold hover:text-[var(--accent)]">{r.name}</Link><p className="font-mono text-[12px] text-[var(--text-muted)]">{r.code}</p></Td>
                    <Td className="whitespace-nowrap text-right font-mono">{formatQty(r.onHand, r.unit)}</Td>
                    <Td className="whitespace-nowrap text-right font-mono text-[var(--text-secondary)]">{formatQty(r.minLevel, r.unit)}</Td>
                    <Td><StockLevelBadge level={r.level} /></Td>
                    <Td className="text-right"><Button size="sm" variant="outline" onClick={() => navigate(`/kho/phieu-mua/them?nl=${r.id}`)}>Tạo phiếu mua</Button></Td>
                  </tr>
                ))}
              </tbody>
            </DataTable>
          )}
        </Card>
        <Card className="overflow-hidden">
          <div className="flex items-start justify-between gap-2 p-5 pb-3">
            <CardHeader title="Phiếu mua chờ nhận" />
            <Link to="/kho/phieu-mua?status=waiting" className="text-[13px] text-[var(--accent)] hover:underline">Xem tất cả</Link>
          </div>
          {d.pendingPurchases.length === 0 ? (
            <p className="px-5 pb-5 text-[13px] text-[var(--text-muted)]">Chưa có dữ liệu.</p>
          ) : (
            <DataTable minWidth={520}>
              <thead><tr><Th>Mã</Th><Th>Nhà cung cấp</Th><Th>Dự kiến nhận</Th><Th>Trạng thái</Th></tr></thead>
              <tbody>
                {d.pendingPurchases.map((p) => (
                  <tr key={p.id}>
                    <Td className="whitespace-nowrap"><Link to={`/kho/phieu-mua/${p.id}`} className="font-mono text-[12.5px] font-semibold hover:text-[var(--accent)]">{p.code}</Link></Td>
                    <Td className="text-[13px]">{p.supplierName}</Td>
                    <Td className="whitespace-nowrap text-[13px]">
                      {p.expectedDate ? formatDateOnly(p.expectedDate) : '—'}
                      {p.due === 'late' ? <> <Badge variant="danger">Trễ hạn</Badge></> : p.due === 'soon' ? <> <Badge variant="warning">Sắp đến hạn</Badge></> : null}
                    </Td>
                    <Td className="whitespace-nowrap"><Badge variant={RECEIVE_STATUS[p.receiveStatus].variant}>{RECEIVE_STATUS[p.receiveStatus].label}</Badge></Td>
                  </tr>
                ))}
              </tbody>
            </DataTable>
          )}
        </Card>
        <Card padded>
          <CardHeader title="Phiếu kiểm kê cần chú ý" />
          {d.stocktakes.length === 0 ? (
            <p className="mt-3 text-[13px] text-[var(--text-muted)]">Không có phiếu chờ duyệt hay bị từ chối.</p>
          ) : (
            <ul className="mt-3 space-y-2.5">
              {d.stocktakes.map((s) => (
                <li key={s.id} className="flex flex-wrap items-start justify-between gap-2 border-b border-[var(--border)] pb-2.5 last:border-0">
                  <div>
                    <Link to={`/kho/kiem-ke/${s.id}`} className="font-mono text-[12.5px] font-semibold hover:text-[var(--accent)]">{s.code}</Link>
                    <span className="ml-2 text-[12px] text-[var(--text-muted)]">{formatDateTime(s.createdAt)} · {s.createdBy}</span>
                    {s.rejectReason ? <p className="text-[12.5px] text-[var(--danger)]">{s.rejectReason}</p> : null}
                  </div>
                  <Badge variant={STOCKTAKE_STATUS[s.status].variant}>{STOCKTAKE_STATUS[s.status].label}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card className="overflow-hidden">
          <div className="p-5 pb-3"><CardHeader title="Hao hụt nhiều nhất (trong kỳ)" /></div>
          {d.losses.length === 0 ? (
            <p className="px-5 pb-5 text-[13px] text-[var(--text-muted)]">Chưa có dữ liệu.</p>
          ) : (
            <DataTable minWidth={460}>
              <thead><tr><Th>Nguyên liệu</Th><Th className="text-right">Số lượng</Th><Th className="text-right">Giá trị</Th><Th>Nguồn</Th></tr></thead>
              <tbody>
                {d.losses.map((l) => (
                  <tr key={`${l.ingredientId}-${l.source}`}>
                    <Td><Link to={`/kho/nguyen-lieu/${l.ingredientId}`} className="font-semibold hover:text-[var(--accent)]">{l.name}</Link></Td>
                    <Td className="text-right font-mono">{formatQty(l.qty, l.unit)}</Td>
                    <Td className="text-right font-mono font-semibold text-[var(--danger)]">{formatCurrency(l.value)}</Td>
                    <Td className="text-[13px]">{l.source === 'waste' ? 'Xuất hủy' : 'Kiểm kê'}</Td>
                  </tr>
                ))}
              </tbody>
            </DataTable>
          )}
        </Card>
      </div>
    </div>
  );
}

function Summary({ range }: { range: WarehouseRange }) {
  const [keyword, setKeyword] = useState('');
  const [group, setGroup] = useState<IngredientGroup | ''>('');
  const [page, setPage] = useState(1);
  const debounced = useDebounced(keyword);
  const q = useStockSummary(range, { keyword: debounced, group, page }, true);
  useEffect(() => setPage(1), [debounced, group, range]);
  return (
    <Card className="overflow-hidden">
      <Toolbar>
        <SearchInput value={keyword} onChange={setKeyword} placeholder="Tìm nguyên liệu…" className="w-full sm:w-[240px]" />
        <SelectInput aria-label="Lọc theo nhóm" value={group} onChange={(e) => setGroup(e.target.value as IngredientGroup | '')} placeholder="Tất cả nhóm" options={INGREDIENT_GROUP_KEYS.map((g) => ({ value: g, label: INGREDIENT_GROUPS[g] }))} className="w-full sm:w-[180px]" />
      </Toolbar>
      {q.isError ? (
        <div className="p-5"><BlockError onRetry={() => void q.refetch()} /></div>
      ) : !q.data ? (
        <TableSkeleton cols={9} />
      ) : q.data.items.length === 0 ? (
        <p className="p-5 text-[13px] text-[var(--text-muted)]">Chưa có dữ liệu.</p>
      ) : (
        <div className={q.isFetching ? 'opacity-60 transition-opacity' : ''}>
          <DataTable minWidth={1080}>
            <thead><tr><Th>Mã</Th><Th>Nguyên liệu</Th><Th className="text-right">Tồn đầu kỳ</Th><Th className="text-right">Nhập</Th><Th className="text-right">Xuất</Th><Th className="text-right">Điều chỉnh</Th><Th className="text-right">Tồn cuối kỳ</Th><Th className="text-right">Giá trị tồn cuối</Th></tr></thead>
            <tbody>
              {q.data.items.map((r) => (
                <tr key={r.id}>
                  <Td className="font-mono text-[12.5px] font-semibold">{r.code}</Td>
                  <Td><Link to={`/kho/nguyen-lieu/${r.id}`} className="font-semibold hover:text-[var(--accent)]">{r.name}</Link><p className="text-[12px] text-[var(--text-muted)]">{r.unit}</p></Td>
                  <Td className="text-right font-mono">{formatQty(r.opening)}</Td>
                  <Td className="text-right font-mono text-[var(--accent)]">{r.inQty ? `+${formatQty(r.inQty)}` : '0'}</Td>
                  <Td className="text-right font-mono text-[var(--info)]">{r.outQty ? `−${formatQty(r.outQty)}` : '0'}</Td>
                  <Td className="text-right font-mono">{r.adjustQty > 0 ? `+${formatQty(r.adjustQty)}` : r.adjustQty < 0 ? `−${formatQty(-r.adjustQty)}` : '0'}</Td>
                  <Td className="text-right font-mono font-semibold">{formatQty(r.closing)}</Td>
                  <Td className="text-right font-mono">{formatCurrency(r.closingValue)}</Td>
                </tr>
              ))}
            </tbody>
          </DataTable>
          <div className="border-t border-[var(--border)] px-5 py-2 text-[13px]">Tổng giá trị tồn cuối kỳ: <b className="font-mono">{formatCurrency(q.data.totalValue)}</b></div>
          <Pagination page={q.data.page} pageCount={q.data.pageCount} total={q.data.total} pageSize={WAREHOUSE_PAGE_SIZE} onChange={setPage} unit="nguyên liệu" />
        </div>
      )}
    </Card>
  );
}

export default WarehouseDashboardPage;
