import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, FolderCog, Pencil, Plus, Trash2, UtensilsCrossed } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { Card } from '@/components/common/Card';
import { Badge } from '@/components/common/Badge';
import { Button } from '@/components/common/Button';
import { BlockError, EmptyState } from '@/components/common/EmptyState';
import { SearchInput, SelectInput, Toggle } from '@/components/common/Form';
import { ConfirmDialog } from '@/components/common/Modal';
import { DataTable, PageHeader, Pagination, TableSkeleton, Td, Th, Toolbar } from '@/components/common/PageParts';
import { Segmented } from '@/components/common/Segmented';
import { CategoryModal, DishDetailModal, DishThumb } from '@/features/dishes/DishParts';
import { DISH_PAGE_SIZE, deleteDish, setDishStatus } from '@/api/dishes';
import { qk, useCategories, useDishes } from '@/features/management/queries';
import { useApiMutation } from '@/hooks/use-api-mutation';
import { useDebounced } from '@/hooks/use-debounced';
import { formatCurrency } from '@/lib/format';
import { DISH_STATUS } from '@/lib/labels';
import type { Dish, DishStatus } from '@/types';

export function DishesPage() {
  const navigate = useNavigate();
  const [keyword, setKeyword] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [status, setStatus] = useState<DishStatus | 'all'>('all');
  const [page, setPage] = useState(1);
  const debounced = useDebounced(keyword);

  const [detail, setDetail] = useState<Dish | null>(null);
  const [toggleTarget, setToggleTarget] = useState<Dish | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Dish | null>(null);
  const [categoryOpen, setCategoryOpen] = useState(false);

  const list = useDishes({ keyword: debounced, categoryId, status, page });
  const { data: categories = [] } = useCategories();
  const categoryName = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories]);

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

  return (
    <AppShell meta={{ label: 'Danh sách món ăn', parent: 'Quản lý món ăn' }}>
      <div className="min-w-0 space-y-4">
        <PageHeader
          title="Danh sách món ăn"
          description="Thực đơn, giá bán và trạng thái kinh doanh. Món ngừng bán không được chọn cho đơn hàng mới."
          actions={
            <>
              <Button variant="outline" size="sm" leadingIcon={<FolderCog size={15} />} onClick={() => setCategoryOpen(true)}>
                Danh mục
              </Button>
              <Button size="sm" leadingIcon={<Plus size={15} />} onClick={() => navigate('/quan-ly/mon-an/them')}>
                Thêm món
              </Button>
            </>
          }
        />

        <Card className="overflow-hidden">
          <Toolbar>
            <SearchInput value={keyword} onChange={setKeyword} placeholder="Tìm theo tên hoặc mã món…" className="w-full sm:w-[280px]" />
            <SelectInput
              aria-label="Lọc theo danh mục"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              placeholder="Tất cả danh mục"
              options={categories.map((c) => ({ value: c.id, label: c.active ? c.name : `${c.name} (ngừng)` }))}
              className="w-full sm:w-[190px]"
            />
            <Segmented<DishStatus | 'all'>
              ariaLabel="Lọc theo trạng thái"
              value={status}
              onChange={setStatus}
              options={[
                { value: 'all', label: 'Tất cả' },
                { value: 'selling', label: 'Đang bán' },
                { value: 'stopped', label: 'Ngừng bán' },
              ]}
            />
          </Toolbar>

          {list.isError ? (
            <div className="p-5"><BlockError onRetry={() => void list.refetch()} retrying={list.isFetching} /></div>
          ) : list.isLoading || !list.data ? (
            <TableSkeleton cols={6} />
          ) : list.data.items.length === 0 ? (
            <div className="p-5">
              <EmptyState
                icon={UtensilsCrossed}
                title={hasFilter ? 'Không tìm thấy món phù hợp' : 'Chưa có món ăn'}
                description={hasFilter ? 'Thử từ khóa khác hoặc bỏ bớt bộ lọc.' : 'Bắt đầu xây dựng thực đơn bằng nút “Thêm món”.'}
              />
            </div>
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
                    <Th className="text-right">Thao tác</Th>
                  </tr>
                </thead>
                <tbody>
                  {list.data.items.map((d) => (
                    <tr key={d.id} className="hover:bg-[var(--bg-subtle)]">
                      <Td className="font-mono text-[12.5px] font-semibold">{d.code}</Td>
                      <Td>
                        <div className="flex min-w-0 items-center gap-3">
                          <DishThumb dish={d} />
                          <div className="min-w-0">
                            <p className="truncate font-semibold">{d.name}</p>
                            <p className="max-w-[320px] truncate text-[12px] text-[var(--text-muted)]">{d.description || d.ingredients || '—'}</p>
                          </div>
                        </div>
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
                        <div className="inline-flex gap-0.5">
                          <Button size="sm" variant="ghost" aria-label={`Xem ${d.name}`} onClick={() => setDetail(d)}><Eye size={14} /></Button>
                          <Button size="sm" variant="ghost" aria-label={`Sửa ${d.name}`} onClick={() => navigate(`/quan-ly/mon-an/${d.id}/sua`)}><Pencil size={14} /></Button>
                          <Button size="sm" variant="ghost" aria-label={`Xóa ${d.name}`} onClick={() => setDeleteTarget(d)}><Trash2 size={14} /></Button>
                        </div>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </DataTable>
              <Pagination page={list.data.page} pageCount={list.data.pageCount} total={list.data.total} pageSize={DISH_PAGE_SIZE} onChange={setPage} unit="món" />
            </div>
          )}
        </Card>
      </div>

      <DishDetailModal
        dish={detail}
        categoryName={detail ? categoryName.get(detail.categoryId) ?? '' : ''}
        open={Boolean(detail)}
        onOpenChange={(o) => !o && setDetail(null)}
        onEdit={(d) => navigate(`/quan-ly/mon-an/${d.id}/sua`)}
      />
      <CategoryModal open={categoryOpen} onOpenChange={setCategoryOpen} />
      <ConfirmDialog
        open={Boolean(toggleTarget)}
        onOpenChange={(o) => !o && setToggleTarget(null)}
        tone="primary"
        title={toggleTarget?.status === 'selling' ? 'Ngừng bán món này?' : 'Mở bán lại món này?'}
        description={
          toggleTarget?.status === 'selling'
            ? `“${toggleTarget?.name}” sẽ không được chọn cho đơn hàng mới và Chatbot AI sẽ ngừng gợi ý món. Lịch sử giao dịch vẫn được giữ nguyên.`
            : `“${toggleTarget?.name}” sẽ hiển thị lại trên thực đơn cho khách gọi món.`
        }
        confirmLabel={toggleTarget?.status === 'selling' ? 'Ngừng bán' : 'Mở bán'}
        loading={statusMutation.isPending}
        onConfirm={() => toggleTarget && statusMutation.mutate(toggleTarget)}
      />
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title="Xóa món ăn?"
        description={
          deleteTarget?.usedInOrders ? (
            <>
              <p>“{deleteTarget.name}” đã xuất hiện trong đơn hàng nên hệ thống sẽ <b>không cho xóa cứng</b>.</p>
              <p className="mt-2">Hãy chuyển món sang trạng thái “Ngừng bán” để bảo toàn lịch sử giao dịch.</p>
            </>
          ) : (
            `Món “${deleteTarget?.name}” (${deleteTarget?.code}) chưa phát sinh giao dịch và sẽ bị xóa vĩnh viễn.`
          )
        }
        confirmLabel="Xóa món"
        loading={deleteMutation.isPending}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget)}
      />
    </AppShell>
  );
}

export default DishesPage;
