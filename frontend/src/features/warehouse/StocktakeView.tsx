import { useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Ban, Check, CheckCheck, Plus, Send, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardHeader } from '@/components/common/Card';
import { Badge } from '@/components/common/Badge';
import { Button } from '@/components/common/Button';
import { Field, SearchInput, SelectInput, TextArea, TextInput } from '@/components/common/Form';
import { ConfirmDialog } from '@/components/common/Modal';
import { DataTable, StatTile, Td, Th, Toolbar } from '@/components/common/PageParts';
import { Segmented } from '@/components/common/Segmented';
import {
  addStocktakeLine,
  approveStocktake,
  cancelStocktake,
  deleteStocktakeDraft,
  matchAllStocktake,
  rejectStocktake,
  removeStocktakeLine,
  saveStocktakeLine,
  submitStocktake,
} from '@/api/warehouse-stocktakes';
import { useApiMutation } from '@/hooks/use-api-mutation';
import { formatCurrency } from '@/lib/format';
import { formatDateTime } from '@/lib/labels';
import { matchesKeyword } from '@/lib/normalize';
import { BusinessError, ValidationError } from '@/lib/mock';
import { formatQty, INGREDIENT_GROUP_KEYS, INGREDIENT_GROUPS, STOCKTAKE_EVENT, STOCKTAKE_REASON, STOCKTAKE_SCOPE, STOCKTAKE_STATUS } from './labels';
import { InfoItem, parseMoney, parseQty } from './parts';
import { useIngredientOptions, wk } from './queries';
import type { StocktakeDetail, StocktakeLine, StocktakeReason } from '@/types';

const REASONS = Object.keys(STOCKTAKE_REASON) as StocktakeReason[];
type LineFilter = 'all' | 'uncounted' | 'diff';

interface Props {
  stocktake: StocktakeDetail;
  /** warehouse: Quản lý kho đếm / gửi duyệt; manager: Quản lý nhà hàng duyệt / từ chối. */
  mode: 'warehouse' | 'manager';
  onDeleted?: () => void;
  onDecided?: () => void;
}

const diffClass = (d: number | null) => (d === null || d === 0 ? '' : d > 0 ? 'text-[var(--accent)]' : 'text-[var(--danger)]');
const signed = (v: number, f: (n: number) => string) => (v > 0 ? `+${f(v)}` : v < 0 ? `−${f(-v)}` : f(0));

/** Nội dung phiếu kiểm kê: bảng đếm (UC-KHO-23) hoặc bảng duyệt (UC-KHO-24). */
export function StocktakeView({ stocktake: st, mode, onDeleted, onDecided }: Props) {
  const qc = useQueryClient();
  const editable = mode === 'warehouse' && (st.status === 'draft' || st.status === 'rejected');
  const [keyword, setKeyword] = useState('');
  const [group, setGroup] = useState('');
  const [filter, setFilter] = useState<LineFilter>(mode === 'manager' ? 'diff' : 'all');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [drafts, setDrafts] = useState<Record<string, { qty?: string; note?: string; est?: string }>>({});
  const [submitOpen, setSubmitOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [approveOpen, setApproveOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState('');
  const [addId, setAddId] = useState('');
  const { data: options = [] } = useIngredientOptions();

  useEffect(() => {
    setDrafts({});
    setErrors({});
  }, [st.id]);

  const refresh = () => void qc.invalidateQueries({ queryKey: wk.all });
  const putDetail = (d: StocktakeDetail) => qc.setQueriesData<StocktakeDetail>({ queryKey: wk.stocktakes }, (prev) => (prev && 'lines' in prev && prev.id === d.id ? d : prev));

  /* ---------------- Tự lưu từng dòng */
  const saveLine = async (line: StocktakeLine, patch: Partial<{ actualQty: number | null; reason: StocktakeReason | null; note: string; estUnitCost: number | null }>) => {
    const input = {
      actualQty: line.actualQty,
      reason: line.reason,
      note: line.note,
      estUnitCost: line.estUnitCost,
      ...patch,
    };
    try {
      const saved = await saveStocktakeLine(st.id, line.id, input);
      qc.setQueriesData<StocktakeDetail>({ queryKey: wk.stocktakes }, (prev) => {
        if (!prev || !('lines' in prev) || prev.id !== st.id) return prev;
        const lines = prev.lines.map((l) => (l.id === saved.id ? saved : l));
        return recount({ ...prev, lines });
      });
      setDrafts((p) => {
        const next = { ...p };
        delete next[line.id];
        return next;
      });
      setErrors((p) => Object.fromEntries(Object.entries(p).filter(([k]) => !k.startsWith(`lines.${line.id}.`))));
    } catch (e) {
      if (e instanceof ValidationError) {
        const f = (e as ValidationError).fields as Record<string, string>;
        setErrors((p) => ({ ...p, ...Object.fromEntries(Object.entries(f).map(([k, v]) => [`lines.${line.id}.${k}`, v])) }));
      } else toast.error(e instanceof Error ? e.message : 'Không lưu được phiếu kiểm kê. Vui lòng thử lại.');
    }
  };

  const commitQty = (line: StocktakeLine) => {
    const text = drafts[line.id]?.qty;
    if (text === undefined) return;
    const value = text.trim() === '' ? null : parseQty(text);
    if (value !== null && !(value >= 0)) {
      setErrors((p) => ({ ...p, [`lines.${line.id}.actualQty`]: 'Số lượng không hợp lệ' }));
      return;
    }
    if (value === line.actualQty) {
      setDrafts((p) => ({ ...p, [line.id]: { ...p[line.id], qty: undefined } }));
      return;
    }
    void saveLine(line, { actualQty: value });
  };

  /* ---------------- Lọc dòng */
  const lines = useMemo(
    () =>
      st.lines
        .filter((l) => !keyword.trim() || matchesKeyword(l.name, keyword) || matchesKeyword(l.code, keyword))
        .filter((l) => !group || l.group === group)
        .filter((l) => filter === 'all' || (filter === 'uncounted' ? l.actualQty === null : l.diff !== null && l.diff !== 0)),
    [st.lines, keyword, group, filter],
  );

  /* ---------------- Thao tác phiếu */
  const matchAll = useApiMutation(() => matchAllStocktake(st.id), { invalidate: [wk.all], success: () => 'Đã điền SL thực tế bằng tồn sổ sách cho các dòng chưa đếm', onSuccess: putDetail });
  const submit = useApiMutation(() => submitStocktake(st.id), {
    invalidate: [wk.all],
    success: (d) => d.message ?? `Đã gửi duyệt phiếu kiểm kê ${d.code}`,
    onFieldErrors: (f) => {
      setErrors(f);
      setSubmitOpen(false);
      setFilter('diff');
    },
    onSuccess: () => {
      setSubmitOpen(false);
      onDecided?.();
    },
  });
  const remove = useApiMutation(() => deleteStocktakeDraft(st.id), { invalidate: [wk.all], success: () => `Đã xóa phiếu kiểm kê nháp ${st.code}`, onSuccess: () => onDeleted?.() });
  const cancel = useApiMutation(() => cancelStocktake(st.id, reason), {
    invalidate: [wk.all],
    success: () => `Đã hủy phiếu kiểm kê ${st.code}`,
    onFieldErrors: (f) => setReasonError(f.reason ?? ''),
    onSuccess: () => setCancelOpen(false),
  });
  const approve = useApiMutation(() => approveStocktake(st.id), {
    invalidate: [wk.all],
    success: () => `Đã duyệt phiếu kiểm kê ${st.code}`,
    onSuccess: () => {
      setApproveOpen(false);
      onDecided?.();
    },
  });
  const reject = useApiMutation(() => rejectStocktake(st.id, reason), {
    invalidate: [wk.all],
    success: () => `Đã từ chối phiếu kiểm kê ${st.code}`,
    onFieldErrors: (f) => setReasonError(f.reason ?? ''),
    onSuccess: () => {
      setRejectOpen(false);
      onDecided?.();
    },
  });
  const add = useApiMutation((ingredientId: string) => addStocktakeLine(st.id, ingredientId), {
    invalidate: [wk.all],
    success: () => 'Đã thêm nguyên liệu vào phiếu',
    onSuccess: () => setAddId(''),
  });

  const tryRemoveLine = async (line: StocktakeLine) => {
    try {
      await removeStocktakeLine(st.id, line.id);
      refresh();
    } catch (e) {
      toast.error(e instanceof BusinessError || e instanceof Error ? e.message : 'Không bỏ được dòng');
    }
  };

  const openSubmit = () => {
    // 8a: còn dòng chưa đếm → báo và lọc sẵn; 8b/8c kiểm tra trước ở giao diện.
    const missing = st.lines.filter((l) => l.actualQty === null).length;
    if (missing > 0) {
      toast.error(`Còn ${missing} nguyên liệu chưa nhập số lượng thực tế`);
      setFilter('uncounted');
      return;
    }
    const local: Record<string, string> = {};
    st.lines.forEach((l) => {
      if (!l.diff) return;
      if (!l.reason) local[`lines.${l.id}.reason`] = 'Vui lòng chọn lý do chênh lệch';
      else if (l.reason === 'other' && !l.note.trim()) local[`lines.${l.id}.note`] = 'Vui lòng nhập ghi chú cho lý do Khác';
      if (l.diff > 0 && l.avgCost === null && !l.estUnitCost) local[`lines.${l.id}.estUnitCost`] = 'Vui lòng nhập đơn giá ước tính lớn hơn 0';
    });
    if (Object.keys(local).length) {
      setErrors(local);
      setFilter('diff');
      return;
    }
    setSubmitOpen(true);
  };

  const status = STOCKTAKE_STATUS[st.status];
  const pickable = options.filter((o) => (o.active || o.onHand > 0) && !st.lines.some((l) => l.ingredientId === o.id));
  const valueLabel = st.provisional ? ' (tạm tính)' : '';

  return (
    <div className="space-y-4">
      {st.status === 'rejected' && st.rejectReason ? (
        <div className="rounded-item border border-[var(--danger)] bg-[var(--danger-soft,transparent)] px-4 py-3 text-[13.5px]">
          <b>Bị từ chối:</b> {st.rejectReason}
        </div>
      ) : null}
      {st.status === 'cancelled' && st.cancelReason ? <div className="rounded-item bg-[var(--bg-subtle)] px-4 py-3 text-[13.5px]"><b>Đã hủy:</b> {st.cancelReason}</div> : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Trạng thái" value={<span className="font-sans text-[18px]"><Badge variant={status.variant}>{status.label}</Badge></span>} hint={STOCKTAKE_SCOPE[st.scope]} />
        <StatTile label="Đã đếm" value={`${st.countedCount}/${st.itemCount}`} hint={`${st.diffCount} dòng chênh lệch`} />
        <StatTile label={`Giá trị tăng${valueLabel}`} value={formatCurrency(st.increaseValue)} tone="accent" />
        <StatTile label={`Giá trị giảm${valueLabel}`} value={formatCurrency(st.decreaseValue)} tone={st.decreaseValue > 0 ? 'danger' : 'default'} />
      </div>

      <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Card padded>
          <CardHeader title="Thông tin phiếu" />
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <InfoItem label="Người lập">{st.createdBy} · {formatDateTime(st.createdAt)}</InfoItem>
            <InfoItem label="Gửi duyệt">{st.submittedAt ? formatDateTime(st.submittedAt) : '—'}</InfoItem>
            <InfoItem label="Người duyệt">{st.approvedBy ? `${st.approvedBy} · ${st.approvedAt ? formatDateTime(st.approvedAt) : ''}` : '—'}</InfoItem>
            {st.groups.length ? <InfoItem label="Nhóm">{st.groups.map((g) => INGREDIENT_GROUPS[g]).join(', ')}</InfoItem> : null}
            <div className="sm:col-span-3"><InfoItem label="Ghi chú">{st.note || '—'}</InfoItem></div>
          </div>
        </Card>
        <Card padded>
          <CardHeader title="Lịch sử" />
          <ol className="mt-3 space-y-2.5">
            {st.events.map((e) => (
              <li key={e.id} className="border-l-2 border-[var(--border)] pl-3 text-[13px]">
                <b>{STOCKTAKE_EVENT[e.event]}</b>{e.note ? ` — ${e.note}` : ''}
                <p className="text-[12px] text-[var(--text-muted)]">{e.by} · {formatDateTime(e.at)}</p>
              </li>
            ))}
          </ol>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-start justify-between gap-3 p-5 pb-3">
          <CardHeader
            title={editable ? 'Đếm hàng' : 'Các dòng kiểm kê'}
            description={editable ? 'Nhập SL thực tế ngay khi đếm — mỗi dòng tự lưu và chốt tồn sổ sách tại lúc nhập.' : 'Chênh lệch = Thực tế − Sổ sách lúc đếm.'}
          />
          {editable ? (
            <Button size="sm" variant="outline" leadingIcon={<CheckCheck size={15} />} loading={matchAll.isPending} onClick={() => matchAll.mutate(undefined)}>
              Khớp sổ sách các dòng chưa đếm
            </Button>
          ) : null}
        </div>
        <Toolbar>
          <SearchInput value={keyword} onChange={setKeyword} placeholder="Tìm nguyên liệu…" className="w-full sm:w-[220px]" />
          <SelectInput aria-label="Lọc theo nhóm" value={group} onChange={(e) => setGroup(e.target.value)} placeholder="Tất cả nhóm" options={INGREDIENT_GROUP_KEYS.map((g) => ({ value: g, label: INGREDIENT_GROUPS[g] }))} className="w-full sm:w-[170px]" />
          <Segmented<LineFilter>
            ariaLabel="Lọc dòng"
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'all', label: mode === 'manager' ? 'Hiện tất cả' : 'Tất cả', count: st.itemCount },
              { value: 'uncounted', label: 'Chưa đếm', count: st.itemCount - st.countedCount },
              { value: 'diff', label: 'Có chênh lệch', count: st.diffCount },
            ]}
          />
        </Toolbar>
        <DataTable minWidth={editable ? 1260 : 1120}>
          <thead>
            <tr>
              <Th>Nguyên liệu</Th>
              <Th className="text-right">Sổ sách</Th>
              <Th>SL thực tế</Th>
              <Th className="text-right">Chênh lệch</Th>
              <Th className="text-right">Giá trị{valueLabel}</Th>
              <Th>Lý do</Th>
              <Th>Ghi chú</Th>
              {mode === 'manager' ? <Th className="text-right">Tồn hiện tại</Th> : null}
              {editable ? <Th className="text-right"><span className="sr-only">Thao tác</span></Th> : null}
            </tr>
          </thead>
          <tbody>
            {lines.length === 0 ? (
              <tr><Td colSpan={9} className="py-6 text-center text-[13px] text-[var(--text-muted)]">Không có dòng nào khớp bộ lọc.</Td></tr>
            ) : (
              lines.map((l) => {
                const draft = drafts[l.id] ?? {};
                const needEst = l.diff !== null && l.diff > 0 && l.avgCost === null;
                const err = (k: string) => errors[`lines.${l.id}.${k}`];
                return (
                  <tr key={l.id} className="align-top">
                    <Td className="min-w-[200px]">
                      <p className="font-semibold">{l.name}</p>
                      <p className="text-[12px] text-[var(--text-muted)]"><span className="font-mono">{l.code}</span> · {INGREDIENT_GROUPS[l.group]}{!l.active ? ' · ngừng sử dụng' : ''}</p>
                      {l.countedAt ? <p className="text-[11.5px] text-[var(--text-muted)]">Đếm lúc {formatDateTime(l.countedAt)}</p> : null}
                    </Td>
                    <Td className="text-right font-mono">{formatQty(l.bookQty ?? l.onHand, l.unit)}</Td>
                    <Td className="w-[150px]">
                      {editable ? (
                        <>
                          <div className="flex gap-1">
                            <TextInput
                              aria-label={`SL thực tế ${l.name}`}
                              inputMode="decimal"
                              value={draft.qty ?? (l.actualQty === null ? '' : String(l.actualQty))}
                              invalid={Boolean(err('actualQty'))}
                              onChange={(e) => setDrafts((p) => ({ ...p, [l.id]: { ...p[l.id], qty: e.target.value } }))}
                              onBlur={() => commitQty(l)}
                              onKeyDown={(e) => e.key === 'Enter' && commitQty(l)}
                            />
                            <Button size="sm" variant="ghost" aria-label={`Khớp sổ sách ${l.name}`} title="Khớp sổ sách" onClick={() => void saveLine(l, { actualQty: l.onHand })}><Check size={14} /></Button>
                          </div>
                          <RowError text={err('actualQty')} />
                        </>
                      ) : (
                        <span className="font-mono">{l.actualQty === null ? '—' : formatQty(l.actualQty, l.unit)}</span>
                      )}
                    </Td>
                    <Td className={`text-right font-mono font-semibold ${diffClass(l.diff)}`}>{l.diff === null ? '—' : signed(l.diff, (n) => formatQty(n))}</Td>
                    <Td className={`text-right font-mono ${diffClass(l.value)}`}>
                      {l.value === null ? '—' : signed(l.value, formatCurrency)}
                      {needEst || l.estUnitCost ? (
                        editable ? (
                          <div className="mt-1">
                            <TextInput
                              aria-label={`Đơn giá ước tính ${l.name}`}
                              inputMode="numeric"
                              placeholder={l.suggestedCost ? String(l.suggestedCost) : 'Đơn giá / ' + l.unit}
                              value={draft.est ?? (l.estUnitCost === null ? '' : String(l.estUnitCost))}
                              invalid={Boolean(err('estUnitCost'))}
                              onChange={(e) => setDrafts((p) => ({ ...p, [l.id]: { ...p[l.id], est: e.target.value } }))}
                              onBlur={() => {
                                const t = drafts[l.id]?.est;
                                if (t !== undefined) void saveLine(l, { estUnitCost: t.trim() ? parseMoney(t) : null });
                              }}
                            />
                            <p className="mt-0.5 text-left text-[11.5px] text-[var(--text-muted)]">Chưa có giá vốn — đơn giá ước tính / {l.unit}</p>
                            <RowError text={err('estUnitCost')} />
                          </div>
                        ) : l.estUnitCost ? (
                          <p className="text-[11.5px] text-[var(--text-muted)]">Ước tính {formatCurrency(l.estUnitCost)} / {l.unit}</p>
                        ) : null
                      ) : null}
                    </Td>
                    <Td className="w-[200px]">
                      {editable && l.diff ? (
                        <>
                          <SelectInput
                            aria-label={`Lý do ${l.name}`}
                            value={l.reason ?? ''}
                            invalid={Boolean(err('reason'))}
                            onChange={(e) => void saveLine(l, { reason: (e.target.value || null) as StocktakeReason | null })}
                            placeholder="— Chọn lý do —"
                            options={REASONS.map((r) => ({ value: r, label: STOCKTAKE_REASON[r] }))}
                          />
                          <RowError text={err('reason')} />
                        </>
                      ) : (
                        <span className="text-[13px]">{l.reason ? STOCKTAKE_REASON[l.reason] : '—'}</span>
                      )}
                    </Td>
                    <Td className="w-[200px]">
                      {editable && l.diff ? (
                        <>
                          <TextInput
                            aria-label={`Ghi chú ${l.name}`}
                            maxLength={200}
                            value={draft.note ?? l.note}
                            invalid={Boolean(err('note'))}
                            onChange={(e) => setDrafts((p) => ({ ...p, [l.id]: { ...p[l.id], note: e.target.value } }))}
                            onBlur={() => {
                              const t = drafts[l.id]?.note;
                              if (t !== undefined && t !== l.note) void saveLine(l, { note: t });
                            }}
                          />
                          <RowError text={err('note')} />
                        </>
                      ) : (
                        <span className="text-[13px]">{l.note || '—'}</span>
                      )}
                    </Td>
                    {mode === 'manager' ? <Td className="text-right font-mono">{formatQty(l.onHand, l.unit)}</Td> : null}
                    {editable ? (
                      <Td className="text-right">
                        {st.scope === 'pick' ? <Button size="sm" variant="ghost" aria-label={`Bỏ dòng ${l.name}`} onClick={() => void tryRemoveLine(l)}><X size={14} /></Button> : null}
                      </Td>
                    ) : null}
                  </tr>
                );
              })
            )}
          </tbody>
        </DataTable>
        {editable && st.scope === 'pick' ? (
          <div className="flex flex-wrap items-end gap-2 border-t border-[var(--border)] p-4">
            <div className="w-full sm:w-[320px]">
              <SelectInput aria-label="Thêm nguyên liệu" value={addId} onChange={(e) => setAddId(e.target.value)} placeholder="— Thêm nguyên liệu vào phiếu —" options={pickable.map((o) => ({ value: o.id, label: `${o.name} (${o.code})` }))} />
            </div>
            <Button size="sm" variant="outline" leadingIcon={<Plus size={15} />} disabled={!addId} loading={add.isPending} onClick={() => add.mutate(addId)}>Thêm</Button>
          </div>
        ) : null}
      </Card>

      {/* Thao tác theo trạng thái */}
      <div className="flex flex-wrap justify-end gap-2">
        {mode === 'warehouse' && st.status === 'draft' ? <Button variant="danger" className="mr-auto" leadingIcon={<Trash2 size={15} />} onClick={() => setDeleteOpen(true)}>Xóa phiếu</Button> : null}
        {mode === 'warehouse' && st.status === 'rejected' ? <Button variant="danger" className="mr-auto" leadingIcon={<Ban size={15} />} onClick={() => { setReason(''); setReasonError(''); setCancelOpen(true); }}>Hủy phiếu</Button> : null}
        {editable ? <Button leadingIcon={<Send size={15} />} onClick={openSubmit}>{st.status === 'rejected' ? 'Sửa và gửi lại' : 'Gửi duyệt'}</Button> : null}
        {mode === 'manager' && st.status === 'pending' ? (
          <>
            <Button variant="outline" leadingIcon={<X size={15} />} onClick={() => { setReason(''); setReasonError(''); setRejectOpen(true); }}>Từ chối</Button>
            <Button leadingIcon={<Check size={15} />} onClick={() => setApproveOpen(true)}>Duyệt</Button>
          </>
        ) : null}
      </div>

      <ConfirmDialog
        open={submitOpen}
        onOpenChange={(o) => !o && setSubmitOpen(false)}
        tone="primary"
        title="Gửi duyệt phiếu kiểm kê?"
        description={
          st.diffCount === 0
            ? `${st.itemCount} nguyên liệu, không có dòng chênh lệch: phiếu sẽ hoàn tất ngay (khớp sổ sách), không đổi tồn.`
            : `${st.itemCount} nguyên liệu, ${st.diffCount} dòng chênh lệch: tăng ${formatCurrency(st.increaseValue)}, giảm ${formatCurrency(st.decreaseValue)} (tạm tính). Sau khi gửi, phiếu không sửa được cho tới khi Quản lý nhà hàng duyệt hoặc từ chối.`
        }
        confirmLabel="Gửi duyệt"
        loading={submit.isPending}
        onConfirm={() => submit.mutate(undefined)}
      />
      <ConfirmDialog open={deleteOpen} onOpenChange={setDeleteOpen} title="Xóa phiếu kiểm kê nháp?" description={`Phiếu ${st.code} và các số đã đếm sẽ bị xóa. Thao tác này không thể hoàn tác.`} confirmLabel="Xóa phiếu" loading={remove.isPending} onConfirm={() => remove.mutate(undefined)} />
      <ConfirmDialog
        open={approveOpen}
        onOpenChange={setApproveOpen}
        tone="primary"
        title="Duyệt phiếu kiểm kê?"
        description={`Tồn kho sẽ được điều chỉnh theo ${st.diffCount} dòng chênh lệch: tăng ${formatCurrency(st.increaseValue)}, giảm ${formatCurrency(st.decreaseValue)}. Thao tác này không thể hoàn tác.`}
        confirmLabel="Duyệt"
        loading={approve.isPending}
        onConfirm={() => approve.mutate(undefined)}
      />
      <ReasonConfirm
        open={rejectOpen}
        onClose={() => setRejectOpen(false)}
        title="Từ chối phiếu kiểm kê?"
        description="Kho sẽ nhận thông báo kèm lý do để kiểm tra lại."
        label="Lý do từ chối"
        confirmLabel="Từ chối"
        reason={reason}
        setReason={(v) => { setReason(v); setReasonError(''); }}
        error={reasonError}
        loading={reject.isPending}
        onConfirm={() => (reason.trim().length < 5 ? setReasonError('Vui lòng nhập lý do từ chối (ít nhất 5 ký tự)') : reject.mutate(undefined))}
      />
      <ReasonConfirm
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        title="Hủy phiếu kiểm kê?"
        description={`Phiếu ${st.code} sẽ không được dùng để điều chỉnh tồn kho. Phiếu vẫn được giữ lại để tra cứu.`}
        label="Lý do hủy"
        confirmLabel="Hủy phiếu kiểm kê"
        reason={reason}
        setReason={(v) => { setReason(v); setReasonError(''); }}
        error={reasonError}
        loading={cancel.isPending}
        onConfirm={() => (reason.trim().length < 5 ? setReasonError('Vui lòng nhập lý do hủy (ít nhất 5 ký tự)') : cancel.mutate(undefined))}
      />
    </div>
  );
}

/** Cập nhật lại các số tổng sau khi một dòng được lưu (khớp cách tính của máy chủ). */
function recount(d: StocktakeDetail): StocktakeDetail {
  let counted = 0;
  let diffs = 0;
  let inc = 0;
  let dec = 0;
  d.lines.forEach((l) => {
    if (l.actualQty !== null) counted++;
    if (l.diff) {
      diffs++;
      if ((l.value ?? 0) > 0) inc += l.value ?? 0;
      else dec -= l.value ?? 0;
    }
  });
  return { ...d, countedCount: counted, diffCount: diffs, increaseValue: inc, decreaseValue: dec };
}

function ReasonConfirm(props: {
  open: boolean;
  onClose: () => void;
  title: string;
  description: string;
  label: string;
  confirmLabel: string;
  reason: string;
  setReason: (v: string) => void;
  error: string;
  loading: boolean;
  onConfirm: () => void;
}) {
  return (
    <ConfirmDialog
      open={props.open}
      onOpenChange={(o) => !o && props.onClose()}
      title={props.title}
      description={props.description}
      cancelLabel="Đóng"
      confirmLabel={props.confirmLabel}
      loading={props.loading}
      onConfirm={props.onConfirm}
    >
      <Field label={props.label} htmlFor="stk-reason" required error={props.error} hint={`${props.reason.length}/300 ký tự`}>
        <TextArea id="stk-reason" rows={2} maxLength={300} value={props.reason} invalid={Boolean(props.error)} onChange={(e) => props.setReason(e.target.value)} />
      </Field>
    </ConfirmDialog>
  );
}

function RowError({ text }: { text?: string }) {
  return text ? <p className="mt-1 text-[12px] text-[var(--danger)]">{text}</p> : null;
}
