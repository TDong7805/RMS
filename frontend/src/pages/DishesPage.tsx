import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Ban, Eye, FolderTree, Play, Plus, Tag, Trash2, UtensilsCrossed } from 'lucide-react';
import { Card } from '@/components/common/Card';
import { Badge } from '@/components/common/Badge';
import { Button } from '@/components/common/Button';
import { BlockError, EmptyState, FilteredEmpty } from '@/components/common/EmptyState';
import { FilterChips } from '@/components/common/FilterChips';
import { SearchInput, Toggle } from '@/components/common/Form';
import { ConfirmDialog } from '@/components/common/Modal';
import { DataTable, Pagination, TableSkeleton, Td, Th, Toolbar } from '@/components/common/PageParts';
import { RowActions } from '@/components/common/RowActions';
import { DishDetailModal, DishThumb } from '@/features/dishes/DishParts';
import { MenuLayout } from '@/features/dishes/MenuLayout';
import { DISH_PAGE_SIZE, deleteDish, setDishStatus } from '@/api/dishes';
import { qk, useCategories, useDishes } from '@/features/management/queries';
import { useApiMutation } from '@/hooks/use-api-mutation';
import { useDebounced } from '@/hooks/use-debounced';
import { formatCurrency } from '@/lib/format';
import { DISH_STATUS } from '@/lib/labels';
import type { Dish, DishStatus } from '@/types';

/** Thực đơn › tab Món ăn (docs/thiet-ke/QUY_TAC_GIAO_DIEN.md, mục B8). */
export function DishesPage() {
  const navigate = useNavigate();
  const [keyword, setKeyword] = useState('');
  const [filters, setFilters] = useState<Record<string, string | undefined>>({});
  const categoryId = filters.category ?? '';
  const status = (filters.status as DishStatus | undefined) ?? 'all';
  const [page, setPage] = useState(1);
  const debounced = useDebounced(keyword);

  const [detail, setDetail] = useState<Dish | null>(null);
  const [toggleTarget, setToggleTarget] = useState<Dish | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Dish | null>(null);

  const list = useDishes({ keyword: debounced, categoryId, status, page });
  const { data: categories = [] } = useCategories();
  const categoryName = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories]);
  const totalDishes = categories.reduce((sum, c) => sum + c.dishCount, 0);

  useEffect(() => setPage(1), [debounced, categoryId, status]);

  const statusMutation = useApiMutation((d: Dish) => setDishStatus(d.id, d.status === 'selling' ? 'stopped' : 'selling'), {
    invalidate: [qk.dishes, qk.chatbot],
    success: (d) => `${d.name}: ${DISH_STATUS[d.status].label}`,
    onSuccess: () => setToggleTarget(null),
  });

  const deleteMutation = useApiMutation((d: Dish) => deleteDish(d.id), {
    invalidate: [qk.dishes, qk.categories],
    success: (_r, d) => `Đã xóa món ${d.name}`,
    onSuccess: () => setDeleteTarget(null),
  });

  const hasFilter = Boolean(keyword || categoryId || status !== 'all');
  const clearFilters = () => {
    setKeyword('');
    setFilters({});
  };

  return (
    <MenuLayout
      tab="dishes"
      action={<Button leadingIcon={<Plus size={15} />} onClick={() => navigate('/quan-ly/mon-an/them')}>Thêm món</Button>}
    >
      <Card className="overflow-hidden">
        <Toolbar>
          <SearchInput value={keyword} onChange={setKeyword} placeholder="Tìm theo tên hoặc mã món…" className="w-full sm:w-[280px]" />
          <FilterChips
            value={filters}
            onChange={setFilters}
            fields={[
              {
                key: 'category',
                label: 'Danh mục',
                icon: <FolderTree size={14} />,
                options: categories.map((c) => ({ value: c.id, label: c.active ? c.name : `${c.name} (ngừng)` })),
              },
              {
                key: 'status',
                label: 'Trạng thái',
                icon: <Tag size={14} />,
                options: [
                  { value: 'selling', label: 'Đang bán' },
                  { value: 'stopped', label: 'Ngừng bán' },
                ],
              },
            ]}
          />
        </Toolbar>

        {list.isError ? (
          <div className="p-5"><BlockError onRetry={() => void list.refetch()} retrying={list.isFetching} /></div>
        ) : list.isLoading || !list.data ? (
          <TableSkeleton cols={6} />
        ) : list.data.items.length === 0 ? (
          hasFilter ? (
            <FilteredEmpty title="Không có món phù hợp" hiddenCount={totalDishes} unit="món" onClear={clearFilters} />
          ) : (
            <div className="p-5">
              <EmptyState icon={UtensilsCrossed} title="Chưa có món ăn" description="Bắt đầu bằng nút “Thêm món”." />
            </div>
          )
        ) : (
          <div className={list.isFetching ? 'opacity-60 transition-opacity' : ''}>
            <DataTable minWidth={880}>
              <thead>
                <tr>
                  <Th>Mã món</Th>
                  <Th>Món ăn</Th>
                  <Th>Danh mục</Th>
                  <Th className="text-right">Giá bán</Th>
                  <Th>Trạng thái bán</Th>
                  <Th className="text-right"><span className="sr-only">Thao tác</span></Th>
                </tr>
              </thead>
              <tbody>
                {list.data.items.map((d) => (
                  <tr key={d.id} className="hover:bg-[var(--bg-subtle)]">
                    <Td className="font-mono text-[12.5px] font-semibold">{d.code}</Td>
                    <Td>
                      <button type="button" onClick={() => setDetail(d)} className="group flex min-w-0 items-center gap-3 text-left">
                        <DishThumb dish={d} />
                        <span className="min-w-0">
                          <span className="block truncate font-semibold group-hover:text-[var(--accent)]">{d.name}</span>
                          <span className="block max-w-[320px] truncate text-[12px] text-[var(--text-muted)]">{d.description || d.ingredients || '—'}</span>
                        </span>
                      </button>
                    </Td>
                    <Td>{categoryName.get(d.categoryId) ?? '—'}</Td>
                    <Td className="text-right font-mono font-semibold">{formatCurrency(d.price)}</Td>
                    <Td>
                      <div className="flex items-center gap-2">
                        <Toggle checked={d.status === 'selling'} label={`Đổi trạng thái bán ${d.name}`} onChange={() => setToggleTarget(d)} />
                        <Badge variant={DISH_STATUS[d.status].variant}>{DISH_STATUS[d.status].label}</Badge>
                      </div>
                    </Td>
                    <Td className="text-right">
                      <RowActions
                        name={d.name}
                        onPrimary={() => navigate(`/quan-ly/mon-an/${d.id}/sua`)}
                        items={[
                          { label: 'Xem chi tiết', icon: <Eye size={15} />, onSelect: () => setDetail(d) },
                          d.status === 'selling'
                            ? { label: 'Ngừng bán', icon: <Ban size={15} />, onSelect: () => setToggleTarget(d) }
                            : { label: 'Mở bán lại', icon: <Play size={15} />, onSelect: () => setToggleTarget(d) },
                          { label: 'Xóa món', icon: <Trash2 size={15} />, danger: true, onSelect: () => setDeleteTarget(d) },
                        ]}
                      />
                    </Td>
                  </tr>
                ))}
              </tbody>
            </DataTable>
            <Pagination page={list.data.page} pageCount={list.data.pageCount} total={list.data.total} pageSize={DISH_PAGE_SIZE} onChange={setPage} unit="món" />
          </div>
        )}
      </Card>

      <DishDetailModal
        dish={detail}
        categoryName={detail ? categoryName.get(detail.categoryId) ?? '' : ''}
        open={Boolean(detail)}
        onOpenChange={(o) => !o && setDetail(null)}
        onEdit={(d) => navigate(`/quan-ly/mon-an/${d.id}/sua`)}
      />
      <ConfirmDialog
        open={Boolean(toggleTarget)}
        onOpenChange={(o) => !o && setToggleTarget(null)}
        tone="primary"
        title={toggleTarget?.status === 'selling' ? 'Ngừng bán món này?' : 'Mở bán lại món này?'}
        description={
          toggleTarget?.status === 'selling'
            ? `“${toggleTarget?.name}” sẽ ẩn khỏi thực đơn, khách không gọi được và trợ lý AI ngừng gợi ý. Hóa đơn cũ vẫn giữ nguyên.`
            : `“${toggleTarget?.name}” sẽ hiện lại trên thực đơn cho khách gọi món.`
        }
        confirmLabel={toggleTarget?.status === 'selling' ? 'Ngừng bán' : 'Mở bán'}
        loading={statusMutation.isPending}
        onConfirm={() => toggleTarget && statusMutation.mutate(toggleTarget)}
      />
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title={deleteTarget?.usedInOrders ? `Không xóa được “${deleteTarget.name}”` : `Xóa “${deleteTarget?.name ?? ''}”?`}
        description={
          deleteTarget?.usedInOrders ? (
            <>
              <p>Món này đã có trong hóa đơn cũ. Xóa đi thì lịch sử bán hàng và báo cáo doanh thu sẽ bị sai.</p>
              <p className="mt-2">
                {deleteTarget.status === 'selling'
                  ? 'Bạn có thể chọn "Ngừng bán": món ẩn khỏi thực đơn, hóa đơn cũ vẫn giữ nguyên, muốn bán lại thì bật lên.'
                  : 'Món đang ở trạng thái "Ngừng bán", khách đã không còn thấy món này.'}
              </p>
            </>
          ) : (
            'Món này chưa có trong hóa đơn nào. Xóa rồi sẽ mất hẳn, không lấy lại được.'
          )
        }
        cancelLabel={deleteTarget?.usedInOrders ? 'Đóng' : 'Hủy'}
        tone={deleteTarget?.usedInOrders ? 'primary' : 'danger'}
        confirmLabel={deleteTarget?.usedInOrders ? 'Ngừng bán' : 'Xóa món'}
        confirmDisabled={Boolean(deleteTarget?.usedInOrders && deleteTarget.status !== 'selling')}
        loading={deleteMutation.isPending || statusMutation.isPending}
        onConfirm={() => {
          if (!deleteTarget) return;
          if (deleteTarget.usedInOrders) {
            statusMutation.mutate(deleteTarget, { onSuccess: () => setDeleteTarget(null) });
          } else deleteMutation.mutate(deleteTarget);
        }}
      />
    </MenuLayout>
  );
}

export default DishesPage;
