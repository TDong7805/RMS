import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, Pencil, Plus, Power, PowerOff, Trash2, Truck } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { Card } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { BlockError, EmptyState } from '@/components/common/EmptyState';
import { SearchInput } from '@/components/common/Form';
import { DataTable, PageHeader, Pagination, TableSkeleton, Td, Th, Toolbar } from '@/components/common/PageParts';
import { Segmented } from '@/components/common/Segmented';
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
  const [status, setStatus] = useState<SupplierStatus | 'all'>('all');
  const [page, setPage] = useState(1);
  const debounced = useDebounced(keyword);

  const [stopTarget, setStopTarget] = useState<Supplier | null>(null);
  const [activateTarget, setActivateTarget] = useState<Supplier | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Supplier | null>(null);

  const list = useSuppliers({ keyword: debounced, status, page });
  useEffect(() => setPage(1), [debounced, status]);
  const hasFilter = Boolean(keyword || status !== 'all');
  const addButton = (
    <Button size="sm" leadingIcon={<Plus size={15} />} onClick={() => navigate('/kho/nha-cung-cap/them')}>
      Thêm nhà cung cấp
    </Button>
  );

  return (
    <AppShell meta={{ label: 'Danh sách nhà cung cấp', parent: 'Quản lý nhà cung cấp' }}>
      <div className="min-w-0 space-y-4">
        <PageHeader
          title="Danh sách nhà cung cấp"
          description="Thông tin liên hệ và danh sách nguyên liệu mỗi nhà cung cấp đang bán cho nhà hàng."
          actions={addButton}
        />

        <Card className="overflow-hidden">
          <Toolbar>
            <SearchInput value={keyword} onChange={setKeyword} placeholder="Tìm theo mã, tên hoặc SĐT…" className="w-full sm:w-[280px]" />
            <Segmented<SupplierStatus | 'all'>
              ariaLabel="Lọc theo trạng thái"
              value={status}
              onChange={setStatus}
              options={[
                { value: 'all', label: 'Tất cả' },
                { value: 'active', label: 'Đang hoạt động' },
                { value: 'inactive', label: 'Ngừng hoạt động' },
              ]}
            />
          </Toolbar>

          {list.isError ? (
            <div className="p-5"><BlockError onRetry={() => void list.refetch()} retrying={list.isFetching} /></div>
          ) : list.isLoading || !list.data ? (
            <TableSkeleton cols={7} />
          ) : list.data.items.length === 0 ? (
            <div className="p-5">
              <EmptyState
                icon={Truck}
                title={hasFilter ? 'Không tìm thấy nhà cung cấp' : 'Chưa có nhà cung cấp nào.'}
                description={hasFilter ? 'Thử từ khóa hoặc bộ lọc khác.' : 'Bắt đầu bằng nút “Thêm nhà cung cấp”.'}
                action={hasFilter ? undefined : addButton}
              />
            </div>
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
                    <Th className="text-right">Thao tác</Th>
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
                        <div className="inline-flex gap-0.5">
                          <Button size="sm" variant="ghost" aria-label={`Xem chi tiết ${s.name}`} onClick={() => navigate(`/kho/nha-cung-cap/${s.id}`)}><Eye size={14} /></Button>
                          <Button size="sm" variant="ghost" aria-label={`Sửa ${s.name}`} onClick={() => navigate(`/kho/nha-cung-cap/${s.id}/sua`)}><Pencil size={14} /></Button>
                          {s.status === 'active' ? (
                            <Button size="sm" variant="ghost" aria-label={`Ngừng hoạt động ${s.name}`} onClick={() => setStopTarget(s)}><PowerOff size={14} /></Button>
                          ) : (
                            <Button size="sm" variant="ghost" aria-label={`Kích hoạt lại ${s.name}`} onClick={() => setActivateTarget(s)}><Power size={14} /></Button>
                          )}
                          {!s.hasPurchases ? (
                            <Button size="sm" variant="ghost" aria-label={`Xóa ${s.name}`} onClick={() => setDeleteTarget(s)}><Trash2 size={14} /></Button>
                          ) : null}
                        </div>
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
