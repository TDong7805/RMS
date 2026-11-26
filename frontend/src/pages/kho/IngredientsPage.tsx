import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Activity, ClipboardList, Eye, Layers, Package, Plus, Power, PowerOff, Tag, Trash2 } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { Card } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { BlockError, EmptyState, FilteredEmpty } from '@/components/common/EmptyState';
import { FilterChips } from '@/components/common/FilterChips';
import { SearchInput } from '@/components/common/Form';
import { DataTable, PageHeader, Pagination, TableSkeleton, Td, Th, Toolbar } from '@/components/common/PageParts';
import { RowActions } from '@/components/common/RowActions';
import { WAREHOUSE_PAGE_SIZE } from '@/api/warehouse-ingredients';
import { IngredientDeleteDialog, IngredientStatusDialog } from '@/features/warehouse/IngredientDialogs';
import { useIngredients } from '@/features/warehouse/queries';
import { formatQty, INGREDIENT_GROUP_KEYS, INGREDIENT_GROUPS, STOCK_LEVEL } from '@/features/warehouse/labels';
import { ActiveBadge, StockLevelBadge } from '@/features/warehouse/parts';
import { useDebounced } from '@/hooks/use-debounced';
import { formatCurrency } from '@/lib/format';
import type { Ingredient, IngredientGroup, IngredientStatus, StockLevel } from '@/types';

const STOCK_FILTERS: StockLevel[] = ['ok', 'low', 'out'];

export function IngredientsPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const initialStock = params.get('stock');
  const [keyword, setKeyword] = useState('');
  const [filters, setFilters] = useState<Record<string, string | undefined>>(() => ({
    stock: STOCK_FILTERS.includes(initialStock as StockLevel) ? (initialStock as string) : undefined,
  }));
  const group = (filters.group ?? '') as IngredientGroup | '';
  const status = (filters.status ?? 'all') as IngredientStatus | 'all';
  const stock = (filters.stock ?? 'all') as StockLevel | 'all';
  const [page, setPage] = useState(1);
  const debounced = useDebounced(keyword);

  const [statusTarget, setStatusTarget] = useState<Ingredient | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Ingredient | null>(null);

  const list = useIngredients({ keyword: debounced, group, status, stock, page });
  useEffect(() => setPage(1), [debounced, group, status, stock]);

  const hasFilter = Boolean(keyword || group || status !== 'all' || stock !== 'all');
  const clearFilters = () => {
    setKeyword('');
    setFilters({});
  };

  return (
    <AppShell meta={{ label: 'Nguyên liệu' }}>
      <div className="min-w-0 space-y-4">
        <PageHeader
          title="Nguyên liệu"
          description="Tồn kho, giá vốn và tình trạng của từng nguyên liệu. Tồn chỉ thay đổi qua nhập kho, xuất kho và kiểm kê."
          actions={
            <Button leadingIcon={<Plus size={15} />} onClick={() => navigate('/kho/nguyen-lieu/them')}>
              Thêm nguyên liệu
            </Button>
          }
        />

        <Card className="overflow-hidden">
          <Toolbar>
            <SearchInput value={keyword} onChange={setKeyword} placeholder="Tìm theo mã hoặc tên…" className="w-full sm:w-[260px]" />
            <FilterChips
              value={filters}
              onChange={setFilters}
              fields={[
                { key: 'group', label: 'Nhóm', icon: <Layers size={14} />, options: INGREDIENT_GROUP_KEYS.map((g) => ({ value: g, label: INGREDIENT_GROUPS[g] })) },
                { key: 'stock', label: 'Tình trạng tồn', icon: <Activity size={14} />, options: STOCK_FILTERS.map((x) => ({ value: x, label: STOCK_LEVEL[x].label })) },
                {
                  key: 'status',
                  label: 'Trạng thái',
                  icon: <Tag size={14} />,
                  options: [
                    { value: 'active', label: 'Đang sử dụng' },
                    { value: 'inactive', label: 'Ngừng sử dụng' },
                  ],
                },
              ]}
            />
          </Toolbar>

          {list.isError ? (
            <div className="p-5"><BlockError onRetry={() => void list.refetch()} retrying={list.isFetching} /></div>
          ) : list.isLoading || !list.data ? (
            <TableSkeleton cols={8} />
          ) : list.data.items.length === 0 ? (
            hasFilter ? (
              <FilteredEmpty title="Không có nguyên liệu phù hợp" unit="nguyên liệu" onClear={clearFilters} />
            ) : (
              <div className="p-5">
                <EmptyState icon={Package} title="Chưa có nguyên liệu nào" description="Bắt đầu bằng nút “Thêm nguyên liệu”." />
              </div>
            )
          ) : (
            <div className={list.isFetching ? 'opacity-60 transition-opacity' : ''}>
              <DataTable minWidth={1080}>
                <thead>
                  <tr>
                    <Th>Mã</Th>
                    <Th>Nguyên liệu</Th>
                    <Th>Nhóm</Th>
                    <Th className="text-right">Tồn hiện tại</Th>
                    <Th className="text-right">Tồn tối thiểu</Th>
                    <Th>Tình trạng tồn</Th>
                    <Th className="text-right">Giá vốn</Th>
                    <Th>Trạng thái</Th>
                    <Th className="text-right"><span className="sr-only">Thao tác</span></Th>
                  </tr>
                </thead>
                <tbody>
                  {list.data.items.map((it) => (
                    <tr key={it.id} className="hover:bg-[var(--bg-subtle)]">
                      <Td className="font-mono text-[12.5px] font-semibold">{it.code}</Td>
                      <Td>
                        <button type="button" className="text-left font-semibold hover:text-[var(--accent)]" onClick={() => navigate(`/kho/nguyen-lieu/${it.id}`)}>
                          {it.name}
                        </button>
                        <p className="text-[12px] text-[var(--text-muted)]">Đơn vị kho: {it.unit}</p>
                      </Td>
                      <Td>{INGREDIENT_GROUPS[it.group]}</Td>
                      <Td className="text-right font-mono font-semibold">{formatQty(it.onHand, it.unit)}</Td>
                      <Td className="text-right font-mono text-[var(--text-secondary)]">{formatQty(it.minLevel, it.unit)}</Td>
                      <Td><StockLevelBadge level={it.stockLevel} /></Td>
                      <Td className="text-right font-mono">{it.avgCost === null ? '—' : formatCurrency(it.avgCost)}</Td>
                      <Td><ActiveBadge active={it.status === 'active'} activeLabel="Đang sử dụng" inactiveLabel="Ngừng sử dụng" /></Td>
                      <Td className="text-right">
                        <RowActions
                          name={it.name}
                          onPrimary={() => navigate(`/kho/nguyen-lieu/${it.id}/sua`)}
                          items={[
                            { label: 'Xem chi tiết', icon: <Eye size={15} />, onSelect: () => navigate(`/kho/nguyen-lieu/${it.id}`) },
                            ...(it.status === 'active' ? [{ label: 'Tạo phiếu mua', icon: <ClipboardList size={15} />, onSelect: () => navigate(`/kho/phieu-mua/them?nl=${it.id}`) }] : []),
                            it.status === 'active'
                              ? { label: 'Ngừng sử dụng', icon: <PowerOff size={15} />, onSelect: () => setStatusTarget(it) }
                              : { label: 'Sử dụng lại', icon: <Power size={15} />, onSelect: () => setStatusTarget(it) },
                            ...(it.deletable ? [{ label: 'Xóa nguyên liệu', icon: <Trash2 size={15} />, danger: true, onSelect: () => setDeleteTarget(it) }] : []),
                          ]}
                        />
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </DataTable>
              <Pagination page={list.data.page} pageCount={list.data.pageCount} total={list.data.total} pageSize={WAREHOUSE_PAGE_SIZE} onChange={setPage} unit="nguyên liệu" />
            </div>
          )}
        </Card>
      </div>

      <IngredientStatusDialog target={statusTarget} onClose={() => setStatusTarget(null)} />
      <IngredientDeleteDialog target={deleteTarget} onClose={() => setDeleteTarget(null)} />
    </AppShell>
  );
}

export default IngredientsPage;
