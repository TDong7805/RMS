import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ClipboardCheck, Plus } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { Card } from '@/components/common/Card';
import { Badge } from '@/components/common/Badge';
import { Button } from '@/components/common/Button';
import { BlockError, EmptyState } from '@/components/common/EmptyState';
import { Field, SearchInput, SelectInput, TextArea, TextInput } from '@/components/common/Form';
import { Modal } from '@/components/common/Modal';
import { DataTable, PageHeader, Pagination, TableSkeleton, Td, Th, Toolbar } from '@/components/common/PageParts';
import { Segmented } from '@/components/common/Segmented';
import { Skeleton } from '@/components/common/Skeleton';
import { WAREHOUSE_PAGE_SIZE } from '@/api/warehouse-ingredients';
import { createStocktake } from '@/api/warehouse-stocktakes';
import { StocktakeView } from '@/features/warehouse/StocktakeView';
import { useIngredientOptions, useStocktake, useStocktakeApprovals, useStocktakeForApproval, useStocktakes, wk } from '@/features/warehouse/queries';
import { INGREDIENT_GROUP_KEYS, INGREDIENT_GROUPS, STOCKTAKE_SCOPE, STOCKTAKE_STATUS } from '@/features/warehouse/labels';
import { useApiMutation } from '@/hooks/use-api-mutation';
import { useDebounced } from '@/hooks/use-debounced';
import { formatCurrency } from '@/lib/format';
import { formatDateTime } from '@/lib/labels';
import { toast } from 'sonner';
import type { IngredientGroup, StocktakeRow, StocktakeScope, StocktakeStatus } from '@/types';

const STATUSES = Object.keys(STOCKTAKE_STATUS) as StocktakeStatus[];

function StatusBadge({ status }: { status: StocktakeStatus }) {
  return <Badge variant={STOCKTAKE_STATUS[status].variant}>{STOCKTAKE_STATUS[status].label}</Badge>;
}

function Value({ row }: { row: StocktakeRow }) {
  if (!row.diffCount) return <span className="text-[var(--text-muted)]">—</span>;
  return (
    <span className="font-mono text-[13px]">
      <span className="text-[var(--accent)]">+{formatCurrency(row.increaseValue)}</span> / <span className="text-[var(--danger)]">−{formatCurrency(row.decreaseValue)}</span>
      {row.provisional ? <span className="block text-[11px] text-[var(--text-muted)]">tạm tính</span> : null}
    </span>
  );
}

/** UC-KHO-22: danh sách phiếu kiểm kê — trang chính của menu Kiểm kê. */
export function StocktakesPage() {
  const navigate = useNavigate();
  const [keyword, setKeyword] = useState('');
  const [status, setStatus] = useState<StocktakeStatus | 'all'>('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const debounced = useDebounced(keyword);
  const rangeError = from && to && from > to ? 'Khoảng thời gian không hợp lệ' : '';
  const list = useStocktakes({ keyword: debounced, status, from: rangeError ? '' : from, to: rangeError ? '' : to, page });
  useEffect(() => setPage(1), [debounced, status, from, to]);
  const hasFilter = Boolean(keyword || status !== 'all' || from || to);
  const createButton = <Button size="sm" leadingIcon={<Plus size={15} />} onClick={() => setCreateOpen(true)}>Lập phiếu kiểm kê</Button>;

  return (
    <AppShell meta={{ label: 'Kiểm kê', parent: 'Nhập – xuất kho' }}>
      <div className="min-w-0 space-y-4">
        <PageHeader title="Kiểm kê" description="Đếm thực tế và gửi Quản lý nhà hàng duyệt. Tồn chỉ được điều chỉnh khi phiếu được duyệt." actions={createButton} />
        <Card className="overflow-hidden">
          <Toolbar>
            <SearchInput value={keyword} onChange={setKeyword} placeholder="Mã phiếu kiểm kê…" className="w-full sm:w-[220px]" />
            <SelectInput aria-label="Lọc theo trạng thái" value={status === 'all' ? '' : status} onChange={(e) => setStatus((e.target.value || 'all') as StocktakeStatus | 'all')} placeholder="Tất cả trạng thái" options={STATUSES.map((s) => ({ value: s, label: STOCKTAKE_STATUS[s].label }))} className="w-full sm:w-[220px]" />
            <div className="flex items-center gap-2">
              <TextInput type="date" aria-label="Ngày lập từ" value={from} onChange={(e) => setFrom(e.target.value)} invalid={Boolean(rangeError)} className="w-[150px]" />
              <span className="text-[var(--text-muted)]">–</span>
              <TextInput type="date" aria-label="Ngày lập đến" value={to} onChange={(e) => setTo(e.target.value)} invalid={Boolean(rangeError)} className="w-[150px]" />
            </div>
          </Toolbar>
          {rangeError ? <p className="px-5 pb-2 text-[12.5px] text-[var(--danger)]">{rangeError}</p> : null}
          {list.isError ? (
            <div className="p-5"><BlockError onRetry={() => void list.refetch()} /></div>
          ) : list.isLoading || !list.data ? (
            <TableSkeleton cols={8} />
          ) : list.data.items.length === 0 ? (
            <div className="p-5"><EmptyState icon={ClipboardCheck} title={hasFilter ? 'Không tìm thấy phiếu kiểm kê' : 'Chưa có phiếu kiểm kê nào.'} description={hasFilter ? 'Thử từ khóa hoặc bộ lọc khác.' : undefined} action={hasFilter ? undefined : createButton} /></div>
          ) : (
            <div className={list.isFetching ? 'opacity-60 transition-opacity' : ''}>
              <DataTable minWidth={1100}>
                <thead><tr><Th>Mã KK</Th><Th>Ngày lập</Th><Th>Phạm vi</Th><Th className="text-right">Số NL</Th><Th className="text-right">Dòng chênh lệch</Th><Th>Giá trị (tăng / giảm)</Th><Th>Trạng thái</Th><Th>Người lập</Th><Th>Người duyệt</Th></tr></thead>
                <tbody>
                  {list.data.items.map((r) => (
                    <tr key={r.id} className="hover:bg-[var(--bg-subtle)]">
                      <Td><Link to={`/kho/kiem-ke/${r.id}`} className="font-mono text-[12.5px] font-semibold hover:text-[var(--accent)]">{r.code}</Link></Td>
                      <Td className="whitespace-nowrap text-[13px]">{formatDateTime(r.createdAt)}</Td>
                      <Td className="text-[13px]">{STOCKTAKE_SCOPE[r.scope]}</Td>
                      <Td className="text-right font-mono">{r.status === 'draft' ? `${r.countedCount}/${r.itemCount}` : r.itemCount}</Td>
                      <Td className="text-right font-mono">{r.diffCount}</Td>
                      <Td><Value row={r} /></Td>
                      <Td><StatusBadge status={r.status} />{r.status === 'rejected' && r.rejectReason ? <p className="mt-0.5 max-w-[220px] text-[12px] text-[var(--danger)]">{r.rejectReason}</p> : null}</Td>
                      <Td className="text-[13px]">{r.createdBy}</Td>
                      <Td className="text-[13px]">{r.approvedBy ?? '—'}</Td>
                    </tr>
                  ))}
                </tbody>
              </DataTable>
              <Pagination page={list.data.page} pageCount={list.data.pageCount} total={list.data.total} pageSize={WAREHOUSE_PAGE_SIZE} onChange={setPage} unit="phiếu kiểm kê" />
            </div>
          )}
        </Card>
      </div>
      <CreateStocktakeDialog open={createOpen} onClose={() => setCreateOpen(false)} onCreated={(id) => navigate(`/kho/kiem-ke/${id}`)} />
    </AppShell>
  );
}

function CreateStocktakeDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (id: string) => void }) {
  const { data: options = [] } = useIngredientOptions();
  const [scope, setScope] = useState<StocktakeScope>('all');
  const [groups, setGroups] = useState<IngredientGroup[]>([]);
  const [picked, setPicked] = useState<string[]>([]);
  const [pick, setPick] = useState('');
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  useEffect(() => {
    if (open) {
      setScope('all');
      setGroups([]);
      setPicked([]);
      setNote('');
      setErrors({});
    }
  }, [open]);
  const mutation = useApiMutation(() => createStocktake({ scope, groups, ingredientIds: picked, note }), {
    invalidate: [wk.all],
    success: (d) => `Đã lập phiếu kiểm kê ${d.code}`,
    onFieldErrors: setErrors,
    onSuccess: (d) => {
      if (d.message) toast.warning(d.message);
      onClose();
      onCreated(d.id);
    },
  });
  const countable = options.filter((o) => o.active || o.onHand > 0);
  return (
    <Modal
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title="Lập phiếu kiểm kê"
      description="Gồm nguyên liệu đang sử dụng và nguyên liệu ngừng sử dụng còn tồn. Mỗi nguyên liệu chỉ nằm trong một phiếu đang mở."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Hủy</Button>
          <Button loading={mutation.isPending} onClick={() => mutation.mutate(undefined)}>Tạo phiếu</Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Phạm vi" htmlFor="stk-scope" required error={errors.scope}>
          <Segmented<StocktakeScope> ariaLabel="Phạm vi kiểm kê" value={scope} onChange={(v) => { setScope(v); setErrors({}); }} options={(Object.keys(STOCKTAKE_SCOPE) as StocktakeScope[]).map((s) => ({ value: s, label: STOCKTAKE_SCOPE[s] }))} />
        </Field>
        {scope === 'group' ? (
          <Field label="Nhóm nguyên liệu" htmlFor="stk-groups" required error={errors.groups}>
            <div className="flex flex-wrap gap-2">
              {INGREDIENT_GROUP_KEYS.map((g) => (
                <label key={g} className="inline-flex items-center gap-1.5 rounded-control border border-[var(--border)] px-2.5 py-1.5 text-[13px]">
                  <input type="checkbox" checked={groups.includes(g)} onChange={(e) => setGroups((p) => (e.target.checked ? [...p, g] : p.filter((x) => x !== g)))} />
                  {INGREDIENT_GROUPS[g]}
                </label>
              ))}
            </div>
          </Field>
        ) : null}
        {scope === 'pick' ? (
          <Field label="Nguyên liệu" htmlFor="stk-pick" required error={errors.ingredientIds}>
            <div className="space-y-2">
              <SelectInput
                id="stk-pick"
                value={pick}
                onChange={(e) => {
                  if (e.target.value) setPicked((p) => [...p, e.target.value]);
                  setPick('');
                }}
                placeholder="— Chọn để thêm —"
                options={countable.filter((o) => !picked.includes(o.id)).map((o) => ({ value: o.id, label: `${o.name} (${o.code})` }))}
              />
              <div className="flex flex-wrap gap-1.5">
                {picked.map((id) => {
                  const o = options.find((x) => x.id === id);
                  return (
                    <button key={id} type="button" className="rounded-full bg-[var(--bg-subtle)] px-2.5 py-1 text-[12.5px] hover:bg-[var(--bg-hover)]" onClick={() => setPicked((p) => p.filter((x) => x !== id))}>
                      {o?.name ?? id} ✕
                    </button>
                  );
                })}
              </div>
            </div>
          </Field>
        ) : null}
        <Field label="Ghi chú phiếu" htmlFor="stk-note" error={errors.note} hint={`${note.length}/500 ký tự`}>
          <TextArea id="stk-note" rows={2} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}

/** UC-KHO-22 / 23: chi tiết phiếu — đếm, gửi duyệt, xóa nháp, sửa và gửi lại, hủy phiếu bị từ chối. */
export function StocktakeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const detail = useStocktake(id);
  const st = detail.data;
  return (
    <AppShell meta={{ label: st ? st.code : 'Phiếu kiểm kê', parent: 'Kiểm kê' }}>
      <div className="min-w-0 space-y-4">
        <PageHeader
          title={st ? `Phiếu kiểm kê ${st.code}` : 'Phiếu kiểm kê'}
          actions={<Button variant="ghost" size="sm" leadingIcon={<ArrowLeft size={15} />} onClick={() => navigate('/kho/kiem-ke')}>Về danh sách</Button>}
        />
        {detail.isError ? (
          <BlockError message="Không tìm thấy phiếu kiểm kê" onRetry={() => navigate('/kho/kiem-ke')} />
        ) : !st ? (
          <Skeleton className="h-64" />
        ) : (
          <StocktakeView stocktake={st} mode="warehouse" onDeleted={() => navigate('/kho/kiem-ke')} onDecided={() => navigate('/kho/kiem-ke')} />
        )}
      </div>
    </AppShell>
  );
}

/* ---------------------------------------------------------------- Khu Quản lý nhà hàng (UC-KHO-24) */

/** Menu "Duyệt kiểm kê" của Quản lý nhà hàng. */
export function StocktakeApprovalsPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<StocktakeStatus | 'all'>('pending');
  const [page, setPage] = useState(1);
  const list = useStocktakeApprovals(status, page);
  useEffect(() => setPage(1), [status]);
  return (
    <AppShell meta={{ label: 'Duyệt kiểm kê', parent: 'Kho' }}>
      <div className="min-w-0 space-y-4">
        <PageHeader title="Duyệt kiểm kê" description="Phiếu kiểm kê kho gửi lên. Duyệt để điều chỉnh tồn kho theo chênh lệch, hoặc từ chối kèm lý do để kho kiểm lại." />
        <Card className="overflow-hidden">
          <Toolbar>
            <Segmented<StocktakeStatus | 'all'>
              ariaLabel="Lọc theo trạng thái"
              value={status}
              onChange={setStatus}
              options={[
                { value: 'pending', label: 'Chờ duyệt' },
                { value: 'approved', label: 'Đã duyệt' },
                { value: 'rejected', label: 'Bị từ chối' },
                { value: 'all', label: 'Tất cả' },
              ]}
            />
          </Toolbar>
          {list.isError ? (
            <div className="p-5"><BlockError onRetry={() => void list.refetch()} /></div>
          ) : list.isLoading || !list.data ? (
            <TableSkeleton cols={7} />
          ) : list.data.items.length === 0 ? (
            <div className="p-5"><EmptyState icon={ClipboardCheck} title={status === 'pending' ? 'Không có phiếu kiểm kê nào chờ duyệt.' : 'Không có phiếu kiểm kê nào.'} /></div>
          ) : (
            <>
              <DataTable minWidth={960}>
                <thead><tr><Th>Mã</Th><Th>Ngày gửi</Th><Th>Người lập</Th><Th className="text-right">Số NL</Th><Th className="text-right">Dòng chênh lệch</Th><Th>Giá trị (tăng / giảm)</Th><Th>Trạng thái</Th></tr></thead>
                <tbody>
                  {list.data.items.map((r) => (
                    <tr key={r.id} className="cursor-pointer hover:bg-[var(--bg-subtle)]" onClick={() => navigate(`/quan-ly/kiem-ke/${r.id}`)}>
                      <Td><Link to={`/quan-ly/kiem-ke/${r.id}`} className="font-mono text-[12.5px] font-semibold hover:text-[var(--accent)]">{r.code}</Link></Td>
                      <Td className="whitespace-nowrap text-[13px]">{r.submittedAt ? formatDateTime(r.submittedAt) : '—'}</Td>
                      <Td className="text-[13px]">{r.createdBy}</Td>
                      <Td className="text-right font-mono">{r.itemCount}</Td>
                      <Td className="text-right font-mono">{r.diffCount}</Td>
                      <Td><Value row={r} /></Td>
                      <Td><StatusBadge status={r.status} /></Td>
                    </tr>
                  ))}
                </tbody>
              </DataTable>
              <Pagination page={list.data.page} pageCount={list.data.pageCount} total={list.data.total} pageSize={WAREHOUSE_PAGE_SIZE} onChange={setPage} unit="phiếu kiểm kê" />
            </>
          )}
        </Card>
      </div>
    </AppShell>
  );
}

export function StocktakeApprovalDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const detail = useStocktakeForApproval(id);
  const st = detail.data;
  return (
    <AppShell meta={{ label: st ? st.code : 'Phiếu kiểm kê', parent: 'Duyệt kiểm kê' }}>
      <div className="min-w-0 space-y-4">
        <PageHeader
          title={st ? `Phiếu kiểm kê ${st.code}` : 'Phiếu kiểm kê'}
          description="Quản lý nhà hàng chỉ duyệt hoặc từ chối toàn bộ phiếu, không sửa số đếm."
          actions={<Button variant="ghost" size="sm" leadingIcon={<ArrowLeft size={15} />} onClick={() => navigate('/quan-ly/kiem-ke')}>Về danh sách</Button>}
        />
        {detail.isError ? (
          <BlockError message="Không tìm thấy phiếu kiểm kê" onRetry={() => navigate('/quan-ly/kiem-ke')} />
        ) : !st ? (
          <Skeleton className="h-64" />
        ) : (
          <StocktakeView stocktake={st} mode="manager" onDecided={() => navigate('/quan-ly/kiem-ke')} />
        )}
      </div>
    </AppShell>
  );
}

export default StocktakesPage;
