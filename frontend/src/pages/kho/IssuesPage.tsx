import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, PackageMinus, Plus, Trash2 } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { Card, CardHeader } from '@/components/common/Card';
import { Badge } from '@/components/common/Badge';
import { Button } from '@/components/common/Button';
import { BlockError, EmptyState } from '@/components/common/EmptyState';
import { Field, SearchInput, SelectInput, TextArea, TextInput } from '@/components/common/Form';
import { ConfirmDialog } from '@/components/common/Modal';
import { DataTable, PageHeader, Pagination, StatTile, TableSkeleton, Td, Th, Toolbar } from '@/components/common/PageParts';
import { Skeleton } from '@/components/common/Skeleton';
import { WAREHOUSE_PAGE_SIZE } from '@/api/warehouse-ingredients';
import { createIssue } from '@/api/warehouse-issues';
import { useIngredientOptions, useIssue, useIssues, useWarehouseEmployees, wk } from '@/features/warehouse/queries';
import { formatQty, ISSUE_REASON } from '@/features/warehouse/labels';
import { dateKeyOffset, InfoItem, parseQty, useLeaveGuard } from '@/features/warehouse/parts';
import { useApiMutation } from '@/hooks/use-api-mutation';
import { useDebounced } from '@/hooks/use-debounced';
import { formatCurrency } from '@/lib/format';
import { formatDateTime } from '@/lib/labels';
import type { IssueInput, IssueReason } from '@/types';

const REASONS = Object.keys(ISSUE_REASON) as IssueReason[];
const dayDiff = (a: string, b: string) => Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86_400_000);

/** UC-KHO-21: lịch sử xuất kho — trang chính của menu Xuất kho. */
export function IssuesPage() {
  const navigate = useNavigate();
  const [keyword, setKeyword] = useState('');
  const [reason, setReason] = useState<IssueReason | 'all'>('all');
  const [from, setFrom] = useState(dateKeyOffset(-29));
  const [to, setTo] = useState(dateKeyOffset(0));
  const [page, setPage] = useState(1);
  const debounced = useDebounced(keyword);
  const rangeError = !from || !to ? 'Vui lòng chọn khoảng thời gian' : from > to ? 'Khoảng thời gian không hợp lệ' : dayDiff(from, to) >= 366 ? 'Khoảng thời gian tối đa 366 ngày' : '';
  const list = useIssues({ keyword: debounced, reason, from, to, page }, !rangeError);
  useEffect(() => setPage(1), [debounced, reason, from, to]);
  const hasFilter = Boolean(keyword || reason !== 'all');

  return (
    <AppShell meta={{ label: 'Xuất kho', parent: 'Nhập – xuất kho' }}>
      <div className="min-w-0 space-y-4">
        <PageHeader
          title="Xuất kho"
          description="Lịch sử phiếu xuất: cho bếp, xuất hủy, lý do khác. Phiếu xuất không sửa, không xóa, không hủy — xuất nhầm thì điều chỉnh qua kiểm kê."
          actions={<Button size="sm" leadingIcon={<PackageMinus size={15} />} onClick={() => navigate('/kho/xuat-kho/them')}>Tạo phiếu xuất</Button>}
        />
        <Card className="overflow-hidden">
          <Toolbar>
            <SearchInput value={keyword} onChange={setKeyword} placeholder="Mã phiếu xuất, tên nguyên liệu…" className="w-full sm:w-[260px]" />
            <SelectInput
              aria-label="Lọc theo lý do"
              value={reason === 'all' ? '' : reason}
              onChange={(e) => setReason((e.target.value || 'all') as IssueReason | 'all')}
              placeholder="Tất cả lý do"
              options={REASONS.map((r) => ({ value: r, label: ISSUE_REASON[r].label }))}
              className="w-full sm:w-[180px]"
            />
            <div className="flex items-center gap-2">
              <TextInput type="date" aria-label="Từ ngày" value={from} onChange={(e) => setFrom(e.target.value)} invalid={Boolean(rangeError)} className="w-[150px]" />
              <span className="text-[var(--text-muted)]">–</span>
              <TextInput type="date" aria-label="Đến ngày" value={to} onChange={(e) => setTo(e.target.value)} invalid={Boolean(rangeError)} className="w-[150px]" />
            </div>
          </Toolbar>
          {rangeError ? <p className="px-5 pb-2 text-[12.5px] text-[var(--danger)]">{rangeError}</p> : null}
          {list.isError ? (
            <div className="p-5"><BlockError onRetry={() => void list.refetch()} retrying={list.isFetching} /></div>
          ) : rangeError ? null : list.isLoading || !list.data ? (
            <TableSkeleton cols={7} />
          ) : list.data.items.length === 0 ? (
            <div className="p-5"><EmptyState icon={PackageMinus} title={hasFilter ? 'Không tìm thấy phiếu xuất' : 'Chưa có phiếu xuất nào trong khoảng thời gian này.'} description={hasFilter ? 'Thử từ khóa hoặc bộ lọc khác.' : undefined} /></div>
          ) : (
            <div className={list.isFetching ? 'opacity-60 transition-opacity' : ''}>
              <DataTable minWidth={980}>
                <thead><tr><Th>Mã PX</Th><Th>Thời điểm</Th><Th>Lý do</Th><Th>Nguyên liệu</Th><Th>Người nhận</Th><Th className="text-right">Giá trị</Th><Th>Người xuất</Th></tr></thead>
                <tbody>
                  {list.data.items.map((r) => (
                    <tr key={r.id} className="hover:bg-[var(--bg-subtle)]">
                      <Td><Link to={`/kho/xuat-kho/${r.id}`} className="font-mono text-[12.5px] font-semibold hover:text-[var(--accent)]">{r.code}</Link></Td>
                      <Td className="whitespace-nowrap text-[13px]">{formatDateTime(r.at)}</Td>
                      <Td><Badge variant={ISSUE_REASON[r.reason].variant}>{ISSUE_REASON[r.reason].label}</Badge></Td>
                      <Td className="max-w-[260px] text-[13px]"><span className="line-clamp-2">{r.itemNames}</span></Td>
                      <Td className="text-[13px]">{r.receiver || '—'}</Td>
                      <Td className="text-right font-mono font-semibold">{formatCurrency(r.value)}</Td>
                      <Td className="text-[13px]">{r.by}</Td>
                    </tr>
                  ))}
                </tbody>
              </DataTable>
              <div className="border-t border-[var(--border)] px-5 py-2 text-[13px]">Tổng giá trị xuất: <b className="font-mono">{formatCurrency(list.data.totalValue)}</b></div>
              <Pagination page={list.data.page} pageCount={list.data.pageCount} total={list.data.total} pageSize={WAREHOUSE_PAGE_SIZE} onChange={setPage} unit="phiếu xuất" />
            </div>
          )}
        </Card>
      </div>
    </AppShell>
  );
}

/** UC-KHO-21: chi tiết phiếu xuất (chỉ đọc). */
export function IssueDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const detail = useIssue(id);
  const r = detail.data;
  return (
    <AppShell meta={{ label: r ? r.code : 'Chi tiết phiếu xuất', parent: 'Xuất kho' }}>
      <div className="min-w-0 space-y-4">
        {detail.isError ? (
          <BlockError message="Không tìm thấy phiếu xuất" onRetry={() => navigate('/kho/xuat-kho')} />
        ) : !r ? (
          <Skeleton className="h-64" />
        ) : (
          <>
            <PageHeader
              title={`Phiếu xuất ${r.code}`}
              description={`${formatDateTime(r.at)} · ${r.by}`}
              actions={<Button variant="ghost" size="sm" leadingIcon={<ArrowLeft size={15} />} onClick={() => navigate('/kho/xuat-kho')}>Về xuất kho</Button>}
            />
            <div className="grid gap-3 sm:grid-cols-3">
              <StatTile label="Lý do" value={<span className="font-sans text-[18px]"><Badge variant={ISSUE_REASON[r.reason].variant}>{ISSUE_REASON[r.reason].label}</Badge></span>} />
              <StatTile label="Giá trị (theo giá vốn lúc xuất)" value={formatCurrency(r.value)} hint={`${r.lines.length} nguyên liệu`} />
              <StatTile label="Người nhận" value={<span className="font-sans text-[16px]">{r.receiver || '—'}</span>} />
            </div>
            {r.note ? <Card padded><InfoItem label="Ghi chú">{r.note}</InfoItem></Card> : null}
            <Card className="overflow-hidden">
              <div className="p-5 pb-3"><CardHeader title="Nguyên liệu" /></div>
              <DataTable minWidth={720}>
                <thead><tr><Th>Nguyên liệu</Th><Th className="text-right">SL</Th><Th className="text-right">Giá vốn</Th><Th className="text-right">Giá trị</Th></tr></thead>
                <tbody>
                  {r.lines.map((l) => (
                    <tr key={l.id}>
                      <Td><Link to={`/kho/nguyen-lieu/${l.ingredientId}`} className="font-semibold hover:text-[var(--accent)]">{l.ingredientName}</Link><p className="font-mono text-[12px] text-[var(--text-muted)]">{l.ingredientCode}</p></Td>
                      <Td className="text-right font-mono">{formatQty(l.qty, l.unit)}</Td>
                      <Td className="text-right font-mono">{l.unitCost === null ? '—' : `${formatCurrency(l.unitCost)} / ${l.unit}`}</Td>
                      <Td className="text-right font-mono font-semibold">{formatCurrency(l.value)}</Td>
                    </tr>
                  ))}
                </tbody>
              </DataTable>
            </Card>
          </>
        )}
      </div>
    </AppShell>
  );
}

interface Row {
  key: number;
  ingredientId: string;
  qty: string;
}
let seq = 0;

/** UC-KHO-20: Tạo phiếu xuất kho. */
export function IssueFormPage() {
  const navigate = useNavigate();
  const { data: options = [] } = useIngredientOptions();
  const { data: employees = [] } = useWarehouseEmployees();
  const [reason, setReason] = useState<IssueReason>('kitchen');
  const [receiverId, setReceiverId] = useState('');
  const [note, setNote] = useState('');
  const [rows, setRows] = useState<Row[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirming, setConfirming] = useState(false);

  const dirty = Boolean(rows.length || note || receiverId || reason !== 'kitchen');
  const { guard, dialog } = useLeaveGuard(dirty);
  const back = () => navigate('/kho/xuat-kho');

  // Nguyên liệu còn tồn > 0, kể cả đã ngừng sử dụng.
  const available = useMemo(() => options.filter((o) => o.onHand > 0), [options]);
  const option = (id: string) => options.find((o) => o.id === id);
  const chosen = new Set(rows.map((r) => r.ingredientId));
  const parsed = rows.map((r) => {
    const o = option(r.ingredientId);
    const qty = parseQty(r.qty);
    return { row: r, o, qty, value: o && qty > 0 && o.avgCost ? Math.round(qty * o.avgCost) : 0 };
  });
  const total = parsed.reduce((s, p) => s + p.value, 0);

  const setRow = (i: number, patch: Partial<Row>) => {
    setRows((p) => p.map((r, j) => (j === i ? { ...r, ...patch } : r)));
    setErrors((p) => Object.fromEntries(Object.entries(p).filter(([k]) => !k.startsWith(`lines.${i}.`) && k !== 'lines')));
  };

  const mutation = useApiMutation((input: IssueInput) => createIssue(input), {
    invalidate: [wk.all],
    success: (r) => `Đã xuất kho phiếu ${r.code}`,
    onFieldErrors: (f) => {
      setErrors(f);
      setConfirming(false);
    },
    onSuccess: back,
  });

  const validate = () => {
    const local: Record<string, string> = {};
    if (reason !== 'kitchen' && !note.trim()) local.note = reason === 'other' ? 'Vui lòng nhập ghi chú' : 'Vui lòng nhập ghi chú cho phiếu xuất hủy';
    if (rows.length === 0) local.lines = 'Phiếu xuất cần ít nhất một nguyên liệu';
    parsed.forEach(({ row, o, qty }, i) => {
      if (!row.ingredientId || !o) local[`lines.${i}.ingredientId`] = 'Vui lòng chọn nguyên liệu';
      else if (!(qty > 0)) local[`lines.${i}.qty`] = 'Số lượng phải lớn hơn 0';
      else if (qty > o.onHand) local[`lines.${i}.qty`] = `Tồn hiện tại chỉ còn ${formatQty(o.onHand, o.unit)}`;
    });
    setErrors(local);
    return Object.keys(local).length === 0;
  };

  return (
    <AppShell meta={{ label: 'Tạo phiếu xuất', parent: 'Xuất kho' }}>
      <div className="min-w-0 space-y-4">
        <PageHeader
          title="Tạo phiếu xuất"
          description="Tồn giảm ngay khi lưu; giá trị xuất theo giá vốn bình quân tại thời điểm xuất."
          actions={<Button variant="ghost" size="sm" leadingIcon={<ArrowLeft size={15} />} onClick={() => guard(back)}>Về xuất kho</Button>}
        />
        <Card padded>
          <CardHeader title="Thông tin phiếu" />
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="Lý do xuất" htmlFor="is-reason" required error={errors.reason}>
              <SelectInput id="is-reason" value={reason} onChange={(e) => { setReason(e.target.value as IssueReason); setErrors((p) => ({ ...p, note: '' })); }} options={REASONS.map((r) => ({ value: r, label: ISSUE_REASON[r].label }))} />
            </Field>
            {reason === 'kitchen' ? (
              <Field label="Người nhận" htmlFor="is-receiver" error={errors.receiverId}>
                <SelectInput id="is-receiver" value={receiverId} onChange={(e) => setReceiverId(e.target.value)} placeholder="— Không chọn —" options={employees.map((e) => ({ value: e.id, label: e.fullName }))} />
              </Field>
            ) : null}
            <Field label="Ghi chú" htmlFor="is-note" required={reason !== 'kitchen'} error={errors.note} hint={`${note.length}/500 ký tự${reason === 'damaged' || reason === 'expired' ? ' · tình trạng hư hỏng, hết hạn…' : ''}`} className="sm:col-span-2">
              <TextArea id="is-note" rows={2} maxLength={500} value={note} invalid={Boolean(errors.note)} onChange={(e) => { setNote(e.target.value); setErrors((p) => ({ ...p, note: '' })); }} />
            </Field>
          </div>
        </Card>
        <Card className="overflow-hidden">
          <div className="flex flex-wrap items-start justify-between gap-3 p-5 pb-3">
            <CardHeader title="Nguyên liệu" description="SL theo đơn vị kho, không vượt tồn hiện tại. Xuất được cả nguyên liệu đã ngừng sử dụng còn tồn." />
            <Button size="sm" variant="outline" leadingIcon={<Plus size={15} />} onClick={() => setRows((p) => [...p, { key: ++seq, ingredientId: '', qty: '' }])}>Thêm nguyên liệu</Button>
          </div>
          {errors.lines ? <p className="px-5 pb-2 text-[12.5px] text-[var(--danger)]">{errors.lines}</p> : null}
          {rows.length === 0 ? (
            <p className="px-5 pb-5 text-[13px] text-[var(--text-muted)]">Chưa có dòng nào.</p>
          ) : (
            <DataTable minWidth={880}>
              <thead><tr><Th>Nguyên liệu</Th><Th className="text-right">Tồn hiện tại</Th><Th>SL xuất</Th><Th className="text-right">Giá vốn</Th><Th className="text-right">Giá trị</Th><Th><span className="sr-only">Xóa</span></Th></tr></thead>
              <tbody>
                {parsed.map(({ row, o, value }, i) => (
                  <tr key={row.key} className="align-top">
                    <Td className="min-w-[260px]">
                      <SelectInput
                        aria-label={`Nguyên liệu dòng ${i + 1}`}
                        value={row.ingredientId}
                        invalid={Boolean(errors[`lines.${i}.ingredientId`])}
                        onChange={(e) => setRow(i, { ingredientId: e.target.value })}
                        placeholder="— Chọn nguyên liệu —"
                        options={available.filter((x) => x.id === row.ingredientId || !chosen.has(x.id)).map((x) => ({ value: x.id, label: `${x.name} (${x.code})${x.active ? '' : ' – ngừng sử dụng'}` }))}
                      />
                      <RowError text={errors[`lines.${i}.ingredientId`]} />
                    </Td>
                    <Td className="text-right font-mono">{o ? formatQty(o.onHand, o.unit) : '—'}</Td>
                    <Td className="w-[150px]">
                      <TextInput aria-label={`SL xuất dòng ${i + 1}`} inputMode="decimal" value={row.qty} invalid={Boolean(errors[`lines.${i}.qty`])} onChange={(e) => setRow(i, { qty: e.target.value })} />
                      {o ? <p className="mt-1 text-[12px] text-[var(--text-muted)]">{o.unit}</p> : null}
                      <RowError text={errors[`lines.${i}.qty`]} />
                    </Td>
                    <Td className="text-right font-mono">{o?.avgCost ? formatCurrency(o.avgCost) : '—'}</Td>
                    <Td className="text-right font-mono font-semibold">{value ? formatCurrency(value) : '—'}</Td>
                    <Td className="text-right"><Button size="sm" variant="ghost" aria-label={`Xóa dòng ${i + 1}`} onClick={() => setRows((p) => p.filter((_, j) => j !== i))}><Trash2 size={14} /></Button></Td>
                  </tr>
                ))}
              </tbody>
            </DataTable>
          )}
          <div className="flex justify-end border-t border-[var(--border)] p-5 text-[14px]">Tổng giá trị xuất: <span className="ml-2 font-mono text-[18px] font-bold text-[var(--accent)]">{formatCurrency(total)}</span></div>
        </Card>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => guard(back)}>Hủy</Button>
          <Button leadingIcon={<PackageMinus size={15} />} onClick={() => validate() && setConfirming(true)}>Xuất kho</Button>
        </div>
      </div>
      {dialog}
      <ConfirmDialog
        open={confirming}
        onOpenChange={(o) => !o && setConfirming(false)}
        tone="primary"
        title="Xác nhận xuất kho?"
        description={`${ISSUE_REASON[reason].label} · ${rows.length} nguyên liệu · tổng giá trị ${formatCurrency(total)}. Sau khi xuất kho, phiếu xuất không sửa hay xóa được.`}
        confirmLabel="Xuất kho"
        loading={mutation.isPending}
        onConfirm={() => mutation.mutate({ reason, receiverId, note, lines: parsed.map(({ row, qty }) => ({ ingredientId: row.ingredientId, qty })) })}
      />
    </AppShell>
  );
}

function RowError({ text }: { text?: string }) {
  return text ? <p className="mt-1 text-[12px] text-[var(--danger)]">{text}</p> : null;
}

export default IssuesPage;
