import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, Plus, Power, PowerOff, Tag, Trash2, Truck } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { Card } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { BlockError, EmptyState, FilteredEmpty } from '@/components/common/EmptyState';
import { FilterChips } from '@/components/common/FilterChips';
import { SearchInput } from '@/components/common/Form';
import { DataTable, PageHeader, Pagination, TableSkeleton, Td, Th, Toolbar } from '@/components/common/PageParts';
import { RowActions } from '@/components/common/RowActions';
import { WAREHOUSE_PAGE_SIZE } from '@/api/warehouse-ingredients';
import { SupplierActivateDialog, SupplierDeleteDialog, SupplierStopDialog } from '@/features/warehouse/SupplierDialogs';
import { useSuppliers } from '@/features/warehouse/queries';
import { SUPPLIER_STOP_REASON } from '@/features/warehouse/labels';
import { ActiveBadge } from '@/features/warehouse/parts';
import { useDebounced } from '@/hooks/use-debounced';
import type { Supplier, SupplierStatus } from '@/types';

/** UC-KHO-07: Xem danh sách nhà cung cấp. */
export function SuppliersPage() {
  const navigate = useNavigate();
  const [keyword, setKeyword] = useState('');
  const [filters, setFilters] = useState<Record<string, string | undefined>>({});
  const status = (filters.status ?? 'all') as SupplierStatus | 'all';
  const [page, setPage] = useState(1);
  const debounced = useDebounced(keyword);

  const [stopTarget, setStopTarget] = useState<Supplier | null>(null);
  const [activateTarget, setActivateTarget] = useState<Supplier | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Supplier | null>(null);

  const list = useSuppliers({ keyword: debounced, status, page });
  useEffect(() => setPage(1), [debounced, status]);
  const hasFilter = Boolean(keyword || status !== 'all');
  const clearFilters = () => {
    setKeyword('');
    setFilters({});
  };
  const addButton = (
    <Button leadingIcon={<Plus size={15} />} onClick={() => navigate('/kho/nha-cung-cap/them')}>
      Thêm nhà cung cấp
    </Button>
  );

  return (
    <AppShell meta={{ label: 'Nhà cung cấp' }}>
      <div className="min-w-0 space-y-4">
        <PageHeader
          title="Nhà cung cấp"
          description="Thông tin liên hệ và danh sách nguyên liệu mỗi nhà cung cấp đang bán cho nhà hàng."
          actions={addButton}
        />

        <Card className="overflow-hidden">
          <Toolbar>
            <SearchInput value={keyword} onChange={setKeyword} placeholder="Tìm theo mã, tên hoặc SĐT…" className="w-full sm:w-[280px]" />
            <FilterChips
              value={filters}
              onChange={setFilters}
              fields={[
                {
                  key: 'status',
                  label: 'Trạng thái',
                  icon: <Tag size={14} />,
                  options: [
                    { value: 'active', label: 'Đang hoạt động' },
                    { value: 'inactive', label: 'Ngừng hoạt động' },
                  ],
                },
              ]}
            />
          </Toolbar>

          {list.isError ? (
            <div className="p-5"><BlockError onRetry={() => void list.refetch()} retrying={list.isFetching} /></div>
          ) : list.isLoading || !list.data ? (
            <TableSkeleton cols={7} />
          ) : list.data.items.length === 0 ? (
            hasFilter ? (
              <FilteredEmpty title="Không có nhà cung cấp phù hợp" unit="nhà cung cấp" onClear={clearFilters} />
            ) : (
              <div className="p-5">
                <EmptyState icon={Truck} title="Chưa có nhà cung cấp nào" description="Bắt đầu bằng nút “Thêm nhà cung cấp”." action={addButton} />
              </div>
            )
          ) : (
            <div className={list.isFetching ? 'opacity-60 transition-opacity' : ''}>
              <DataTable minWidth={960}>
                <thead>
                  <tr>
                    <Th>Mã</Th>
                    <Th>Nhà cung cấp</Th>
                    <Th>Số điện thoại</Th>
                    <Th>Người liên hệ</Th>
                    <Th className="text-right">NL đang cung cấp</Th>
                    <Th>Trạng thái</Th>
                    <Th className="text-right"><span className="sr-only">Thao tác</span></Th>
                  </tr>
                </thead>
                <tbody>
                  {list.data.items.map((s) => (
                    <tr key={s.id} className="hover:bg-[var(--bg-subtle)]">
                      <Td className="font-mono text-[12.5px] font-semibold">{s.code}</Td>
                      <Td>
                        <button type="button" className="text-left font-semibold hover:text-[var(--accent)]" onClick={() => navigate(`/kho/nha-cung-cap/${s.id}`)}>
                          {s.name}
                        </button>
                        {s.status === 'inactive' && s.stopReason ? (
                          <p className="text-[12px] text-[var(--text-muted)]">Lý do ngừng: {SUPPLIER_STOP_REASON[s.stopReason]}</p>
                        ) : null}
                      </Td>
                      <Td className="font-mono text-[13px]">{s.phone}</Td>
                      <Td>{s.contact || <span className="text-[var(--text-muted)]">—</span>}</Td>
                      <Td className="text-right font-mono font-semibold">{s.activeLinkCount}</Td>
                      <Td><ActiveBadge active={s.status === 'active'} activeLabel="Đang hoạt động" inactiveLabel="Ngừng hoạt động" /></Td>
                      <Td className="text-right">
                        <RowActions
                          name={s.name}
                          onPrimary={() => navigate(`/kho/nha-cung-cap/${s.id}/sua`)}
                          items={[
                            { label: 'Xem chi tiết', icon: <Eye size={15} />, onSelect: () => navigate(`/kho/nha-cung-cap/${s.id}`) },
                            s.status === 'active'
                              ? { label: 'Ngừng hoạt động', icon: <PowerOff size={15} />, onSelect: () => setStopTarget(s) }
                              : { label: 'Kích hoạt lại', icon: <Power size={15} />, onSelect: () => setActivateTarget(s) },
                            ...(!s.hasPurchases ? [{ label: 'Xóa nhà cung cấp', icon: <Trash2 size={15} />, danger: true, onSelect: () => setDeleteTarget(s) }] : []),
                          ]}
                        />
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </DataTable>
              <Pagination page={list.data.page} pageCount={list.data.pageCount} total={list.data.total} pageSize={WAREHOUSE_PAGE_SIZE} onChange={setPage} unit="nhà cung cấp" />
            </div>
          )}
        </Card>
      </div>

      <SupplierStopDialog target={stopTarget} onClose={() => setStopTarget(null)} />
      <SupplierActivateDialog target={activateTarget} onClose={() => setActivateTarget(null)} />
      <SupplierDeleteDialog target={deleteTarget} onClose={() => setDeleteTarget(null)} />
    </AppShell>
  );
}

export default SuppliersPage;
