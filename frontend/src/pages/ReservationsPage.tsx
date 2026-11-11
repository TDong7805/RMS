import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CalendarSearch, Eye, FilterX } from 'lucide-react';
import { toast } from 'sonner';
import { AppShell } from '@/components/layout/AppShell';
import { Card } from '@/components/common/Card';
import { Badge } from '@/components/common/Badge';
import { Button } from '@/components/common/Button';
import { BlockError, EmptyState } from '@/components/common/EmptyState';
import { SearchInput, SelectInput, TextInput } from '@/components/common/Form';
import { DataTable, PageHeader, Pagination, StatTile, TableSkeleton, Td, Th, Toolbar } from '@/components/common/PageParts';
import { ReservationDetailModal, ReservationEditModal } from '@/features/reservations/ReservationModals';
import { useAreas, useReservation, useReservationSummary, useReservations, useTables } from '@/features/management/queries';
import { useDebounced } from '@/hooks/use-debounced';
import { RESERVATION_PAGE_SIZE } from '@/api/reservations';
import { RESERVATION_STATUS, formatDateTime } from '@/lib/labels';
import { toDateKey } from '@/lib/mock';
import type { Reservation, ReservationFilter, ReservationStatus } from '@/types';

const STATUS_OPTIONS = (Object.keys(RESERVATION_STATUS) as ReservationStatus[]).map((s) => ({
  value: s,
  label: RESERVATION_STATUS[s].label,
}));

export function ReservationsPage() {
  const [params, setParams] = useSearchParams();
  const [keyword, setKeyword] = useState('');
  const [date, setDate] = useState('');
  const [areaId, setAreaId] = useState('');
  const [status, setStatus] = useState<ReservationStatus | 'all'>('all');
  const [page, setPage] = useState(1);
  const debouncedKeyword = useDebounced(keyword);

  const [detailId, setDetailId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Reservation | null>(null);

  const filter: ReservationFilter = { keyword: debouncedKeyword, date, areaId, status, page };
  const list = useReservations(filter);
  const summary = useReservationSummary();
  const detail = useReservation(detailId);
  const { data: areas = [] } = useAreas();
  const { data: tables = [] } = useTables();

  // Mọi thay đổi bộ lọc đều quay về trang 1.
  useEffect(() => setPage(1), [debouncedKeyword, date, areaId, status]);

  // Mở chi tiết từ thông báo: /dat-ban/lich-su?id=res-3
  useEffect(() => {
    const id = params.get('id');
    if (id) setDetailId(id);
  }, [params]);

  useEffect(() => {
    if (detailId && detail.isError) {
      toast.error('Nội dung này không còn tồn tại');
      closeDetail();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detail.isError, detailId]);

  const closeDetail = () => {
    setDetailId(null);
    if (params.has('id')) {
      params.delete('id');
      setParams(params, { replace: true });
    }
  };

  const areaName = useMemo(() => new Map(areas.map((a) => [a.id, a.name])), [areas]);
  const tableCode = useMemo(() => new Map(tables.map((t) => [t.id, t.code])), [tables]);
  const hasFilter = Boolean(keyword || date || areaId || status !== 'all');

  const resetFilter = () => {
    setKeyword('');
    setDate('');
    setAreaId('');
    setStatus('all');
  };

  return (
    <AppShell meta={{ label: 'Danh sách lịch sử đặt', parent: 'Quản lý đặt bàn' }}>
      <div className="min-w-0 space-y-4">
        <PageHeader
          title="Danh sách đặt bàn"
          description="Tra cứu, xem chi tiết và chỉnh sửa thông tin đặt bàn của khách hàng."
          actions={
            <Button variant="outline" size="sm" leadingIcon={<CalendarSearch size={15} />} onClick={() => setDate(toDateKey(new Date()))}>
              Lịch hôm nay
            </Button>
          }
        />

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <StatTile label="Lịch đặt hôm nay" value={summary.data?.today ?? '—'} hint="Đang chờ, đã xác nhận hoặc đã đến" />
          <StatTile label="Khách dự kiến hôm nay" value={summary.data?.guestsToday ?? '—'} tone="accent" />
          <StatTile label="Chờ xác nhận" value={summary.data?.pending ?? '—'} tone={summary.data?.pending ? 'warning' : 'default'} hint="Cần gọi lại cho khách" />
        </div>

        <Card className="overflow-hidden">
          <Toolbar>
            <SearchInput
              value={keyword}
              onChange={setKeyword}
              placeholder="Tìm tên khách, số điện thoại, mã đặt…"
              className="w-full sm:w-[300px]"
            />
            <TextInput
              type="date"
              aria-label="Lọc theo ngày đặt"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full sm:w-[160px]"
            />
            <SelectInput
              aria-label="Lọc theo khu vực"
              value={areaId}
              onChange={(e) => setAreaId(e.target.value)}
              placeholder="Tất cả khu vực"
              options={areas.map((a) => ({ value: a.id, label: a.name }))}
              className="w-full sm:w-[170px]"
            />
            <SelectInput
              aria-label="Lọc theo trạng thái"
              value={status === 'all' ? '' : status}
              onChange={(e) => setStatus((e.target.value || 'all') as ReservationStatus | 'all')}
              placeholder="Mọi trạng thái"
              options={STATUS_OPTIONS}
              className="w-full sm:w-[170px]"
            />
            {hasFilter ? (
              <Button variant="ghost" size="sm" leadingIcon={<FilterX size={14} />} onClick={resetFilter}>
                Xóa lọc
              </Button>
            ) : null}
          </Toolbar>

          {list.isError ? (
            <div className="p-5">
              <BlockError onRetry={() => void list.refetch()} retrying={list.isFetching} />
            </div>
          ) : list.isLoading || !list.data ? (
            <TableSkeleton cols={6} />
          ) : list.data.items.length === 0 ? (
            <div className="p-5">
              <EmptyState
                icon={CalendarSearch}
                title={hasFilter ? 'Không tìm thấy lịch đặt phù hợp' : 'Chưa có lịch đặt bàn'}
                description={hasFilter ? 'Thử đổi từ khóa hoặc điều kiện lọc.' : 'Lịch đặt từ website và hotline sẽ hiển thị tại đây.'}
                action={hasFilter ? <Button variant="outline" size="sm" onClick={resetFilter}>Xóa bộ lọc</Button> : undefined}
              />
            </div>
          ) : (
            <div className={list.isFetching ? 'opacity-60 transition-opacity' : ''}>
              <DataTable minWidth={860}>
                <thead>
                  <tr>
                    <Th>Mã đặt</Th>
                    <Th>Khách hàng</Th>
                    <Th>Thời gian</Th>
                    <Th className="text-right">Số khách</Th>
                    <Th>Khu vực / Bàn</Th>
                    <Th>Trạng thái</Th>
                    <Th className="text-right">Thao tác</Th>
                  </tr>
                </thead>
                <tbody>
                  {list.data.items.map((r) => (
                    <tr key={r.id} className="hover:bg-[var(--bg-subtle)]">
                      <Td className="font-mono text-[12.5px] font-semibold">{r.code}</Td>
                      <Td>
                        <p className="font-semibold">{r.customerName}</p>
                        <p className="font-mono text-[12px] text-[var(--text-muted)]">{r.phone}</p>
                      </Td>
                      <Td className="whitespace-nowrap font-mono text-[12.5px]">{formatDateTime(r.dateTime)}</Td>
                      <Td className="text-right font-mono font-semibold">{r.guests}</Td>
                      <Td>
                        <p>{areaName.get(r.areaId) ?? '—'}</p>
                        <p className="text-[12px] text-[var(--text-muted)]">{r.tableId ? `Bàn ${tableCode.get(r.tableId) ?? '?'}` : 'Chưa xếp bàn'}</p>
                      </Td>
                      <Td>
                        <Badge variant={RESERVATION_STATUS[r.status].variant}>{RESERVATION_STATUS[r.status].label}</Badge>
                      </Td>
                      <Td className="text-right">
                        <Button variant="ghost" size="sm" leadingIcon={<Eye size={14} />} onClick={() => setDetailId(r.id)}>
                          Xem chi tiết
                        </Button>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </DataTable>
              <Pagination
                page={list.data.page}
                pageCount={list.data.pageCount}
                total={list.data.total}
                pageSize={RESERVATION_PAGE_SIZE}
                onChange={setPage}
                unit="lịch đặt"
              />
            </div>
          )}
        </Card>
      </div>

      <ReservationDetailModal
        open={Boolean(detailId) && !editing}
        onOpenChange={(open) => !open && closeDetail()}
        reservation={detail.data ?? null}
        loading={detail.isLoading}
        onEdit={(r) => setEditing(r)}
      />
      <ReservationEditModal
        open={Boolean(editing)}
        reservation={editing}
        onOpenChange={(open) => !open && setEditing(null)}
        onSaved={() => {
          // Lưu thành công → thông báo và kết thúc Use Case (đóng cả màn hình chi tiết).
          setEditing(null);
          closeDetail();
        }}
      />
    </AppShell>
  );
}

export default ReservationsPage;
