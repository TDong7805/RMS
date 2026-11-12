import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Eye, Package, Pencil, Plus, Power, PowerOff, Trash2 } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { Card } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { BlockError, EmptyState } from '@/components/common/EmptyState';
import { SearchInput, SelectInput } from '@/components/common/Form';
import { DataTable, PageHeader, Pagination, TableSkeleton, Td, Th, Toolbar } from '@/components/common/PageParts';
import { Segmented } from '@/components/common/Segmented';
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
  const [group, setGroup] = useState<IngredientGroup | ''>('');
  const [status, setStatus] = useState<IngredientStatus | 'all'>('all');
  const [stock, setStock] = useState<StockLevel | 'all'>(STOCK_FILTERS.includes(initialStock as StockLevel) ? (initialStock as StockLevel) : 'all');
  const [page, setPage] = useState(1);
  const debounced = useDebounced(keyword);

  const [statusTarget, setStatusTarget] = useState<Ingredient | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Ingredient | null>(null);

  const list = useIngredients({ keyword: debounced, group, status, stock, page });
  useEffect(() => setPage(1), [debounced, group, status, stock]);

  const hasFilter = Boolean(keyword || group || status !== 'all' || stock !== 'all');

  return (
    <AppShell meta={{ label: 'Danh sách nguyên liệu', parent: 'Quản lý nguyên liệu' }}>
      <div className="min-w-0 space-y-4">
        <PageHeader
          title="Danh sách nguyên liệu"
          description="Tồn kho, giá vốn và tình trạng của từng nguyên liệu. Tồn chỉ thay đổi qua nhập kho, xuất kho và kiểm kê."
          actions={
            <Button size="sm" leadingIcon={<Plus size={15} />} onClick={() => navigate('/kho/nguyen-lieu/them')}>
              Thêm nguyên liệu
            </Button>
          }
        />

        <Card className="overflow-hidden">
          <Toolbar>
            <SearchInput value={keyword} onChange={setKeyword} placeholder="Tìm theo mã hoặc tên…" className="w-full sm:w-[260px]" />
            <SelectInput
              aria-label="Lọc theo nhóm"
              value={group}
              onChange={(e) => setGroup(e.target.value as IngredientGroup | '')}
              placeholder="Tất cả nhóm"
              options={INGREDIENT_GROUP_KEYS.map((g) => ({ value: g, label: INGREDIENT_GROUPS[g] }))}
              className="w-full sm:w-[180px]"
            />
            <SelectInput
              aria-label="Lọc theo tình trạng tồn"
              value={stock === 'all' ? '' : stock}
              onChange={(e) => setStock((e.target.value || 'all') as StockLevel | 'all')}
              placeholder="Mọi tình trạng tồn"
              options={STOCK_FILTERS.map((s) => ({ value: s, label: STOCK_LEVEL[s].label }))}
              className="w-full sm:w-[180px]"
            />
            <Segmented<IngredientStatus | 'all'>
              ariaLabel="Lọc theo trạng thái"
              value={status}
              onChange={setStatus}
              options={[
                { value: 'all', label: 'Tất cả' },
                { value: 'active', label: 'Đang sử dụng' },
                { value: 'inactive', label: 'Ngừng sử dụng' },
              ]}
            />
          </Toolbar>

          {list.isError ? (
            <div className="p-5"><BlockError onRetry={() => void list.refetch()} retrying={list.isFetching} /></div>
          ) : list.isLoading || !list.data ? (
            <TableSkeleton cols={8} />
          ) : list.data.items.length === 0 ? (
            <div className="p-5">
              <EmptyState
                icon={Package}
                title={hasFilter ? 'Không tìm thấy nguyên liệu' : 'Chưa có nguyên liệu nào.'}
                description={hasFilter ? 'Thử từ khóa hoặc bộ lọc khác.' : 'Bắt đầu bằng nút “Thêm nguyên liệu”.'}
                action={hasFilter ? undefined : <Button size="sm" leadingIcon={<Plus size={15} />} onClick={() => navigate('/kho/nguyen-lieu/them')}>Thêm nguyên liệu</Button>}
              />
            </div>
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
                    <Th className="text-right">Thao tác</Th>
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
                        <div className="inline-flex gap-0.5">
                          <Button size="sm" variant="ghost" aria-label={`Xem chi tiết ${it.name}`} onClick={() => navigate(`/kho/nguyen-lieu/${it.id}`)}><Eye size={14} /></Button>
                          <Button size="sm" variant="ghost" aria-label={`Sửa ${it.name}`} onClick={() => navigate(`/kho/nguyen-lieu/${it.id}/sua`)}><Pencil size={14} /></Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            aria-label={it.status === 'active' ? `Ngừng sử dụng ${it.name}` : `Sử dụng lại ${it.name}`}
                            onClick={() => setStatusTarget(it)}
                          >
                            {it.status === 'active' ? <PowerOff size={14} /> : <Power size={14} />}
                          </Button>
                          {it.deletable ? (
                            <Button size="sm" variant="ghost" aria-label={`Xóa ${it.name}`} onClick={() => setDeleteTarget(it)}><Trash2 size={14} /></Button>
                          ) : null}
                        </div>
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
