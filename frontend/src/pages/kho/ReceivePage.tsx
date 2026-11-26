import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ClipboardList, PackageCheck } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { Card, CardHeader } from '@/components/common/Card';
import { Badge } from '@/components/common/Badge';
import { Button } from '@/components/common/Button';
import { BlockError, EmptyState } from '@/components/common/EmptyState';
import { StickySaveBar } from '@/components/common/StickySaveBar';
import { SubPageHeader } from '@/components/common/SubPageHeader';
import { Field, TextArea, TextInput } from '@/components/common/Form';
import { ConfirmDialog } from '@/components/common/Modal';
import { DataTable, TableSkeleton, Td, Th } from '@/components/common/PageParts';
import { Skeleton } from '@/components/common/Skeleton';
import { receivePurchaseOrder } from '@/api/warehouse-receipts';
import { usePurchaseOrder, useWaitingPurchaseOrders, wk } from '@/features/warehouse/queries';
import { formatQty, formatSpec, purchaseStatusLabel } from '@/features/warehouse/labels';
import { isQty, parseQty } from '@/features/warehouse/parts';
import { useUnsavedGuard } from '@/hooks/use-unsaved-guard';
import { useApiMutation } from '@/hooks/use-api-mutation';
import { formatCurrency } from '@/lib/format';
import { formatDateOnly } from '@/lib/labels';
import type { ReceiveInput } from '@/types';

const r3 = (n: number) => Math.round(n * 1000) / 1000;

/** UC-KHO-17 (1a): chọn phiếu đang chờ nhận từ menu Nhập kho. */
export function ChooseWaitingPurchasePage() {
  const navigate = useNavigate();
  const list = useWaitingPurchaseOrders();
  return (
    <AppShell meta={{ label: 'Nhận hàng theo phiếu mua', parent: 'Nhập kho', parentTo: '/kho/nhap-kho' }}>
      <div className="min-w-0 space-y-4">
        <SubPageHeader
          title="Nhận hàng theo phiếu mua"
          description="Chọn phiếu mua đang chờ nhận (Chưa nhận hoặc Nhận một phần)."
          backTo="/kho/nhap-kho"
        />
        <Card className="overflow-hidden">
          {list.isError ? (
            <div className="p-5"><BlockError onRetry={() => void list.refetch()} /></div>
          ) : list.isLoading || !list.data ? (
            <TableSkeleton cols={6} />
          ) : list.data.length === 0 ? (
            <div className="p-5"><EmptyState icon={ClipboardList} title="Không có phiếu mua nào đang chờ nhận." /></div>
          ) : (
            <DataTable minWidth={860}>
              <thead><tr><Th>Mã</Th><Th>Tên phiếu</Th><Th>Nhà cung cấp</Th><Th>Dự kiến nhận</Th><Th>Trạng thái</Th><Th className="text-right"><span className="sr-only">Thao tác</span></Th></tr></thead>
              <tbody>
                {list.data.map((r) => {
                  const st = purchaseStatusLabel(r.status, r.receiveStatus);
                  return (
                    <tr key={r.id} className="hover:bg-[var(--bg-subtle)]">
                      <Td className="font-mono text-[12.5px] font-semibold">{r.code}</Td>
                      <Td>{r.name}</Td>
                      <Td>{r.supplierName}</Td>
                      <Td className="whitespace-nowrap text-[13px]">{r.expectedDate ? formatDateOnly(r.expectedDate) : '—'}{r.late ? <> <Badge variant="danger">Trễ hạn</Badge></> : null}</Td>
                      <Td><Badge variant={st.variant}>{st.label}</Badge></Td>
                      <Td className="text-right">
                        <Button size="sm" leadingIcon={<PackageCheck size={14} />} onClick={() => navigate(`/kho/phieu-mua/${r.id}/nhan-hang`)}>Nhận hàng</Button>
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </DataTable>
          )}
        </Card>
      </div>
    </AppShell>
  );
}

/** UC-KHO-17: Nhận hàng theo phiếu mua. */
export function ReceivePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const detail = usePurchaseOrder(id);
  const po = detail.data;
  const [qty, setQty] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirming, setConfirming] = useState(false);
  const [initialQty, setInitialQty] = useState('');

  const lines = useMemo(() => po?.lines ?? [], [po]);
  const remainingOf = (lineId: string) => {
    const l = lines.find((x) => x.id === lineId);
    return l && l.qtyOrdered !== null ? r3(l.qtyOrdered - l.qtyReceived) : 0;
  };

  // SL nhận lần này điền sẵn bằng SL còn lại.
  useEffect(() => {
    if (!po || initialQty) return;
    const filled = Object.fromEntries(po.lines.map((l) => [l.id, String(l.qtyOrdered === null ? 0 : r3(l.qtyOrdered - l.qtyReceived))]));
    setQty(filled);
    setInitialQty(JSON.stringify(filled));
  }, [po, initialQty]);

  const dirty = Boolean(initialQty) && (JSON.stringify(qty) !== initialQty || note !== '' || Object.values(notes).some(Boolean));
  const leave = useUnsavedGuard(dirty);
  const discard = () => {
    if (initialQty) setQty(JSON.parse(initialQty) as Record<string, string>);
    setNotes({});
    setNote('');
    setErrors({});
  };

  const parsed = lines.map((l) => {
    const text = (qty[l.id] ?? '').trim();
    const value = text === '' ? 0 : parseQty(text);
    return { line: l, value };
  });
  const totalValue = parsed.reduce((s, p) => (p.value > 0 && p.line.unitPrice ? s + Math.round(p.value * p.line.unitPrice) : s), 0);
  const count = parsed.filter((p) => p.value > 0).length;

  const mutation = useApiMutation((input: ReceiveInput) => receivePurchaseOrder(id!, input), {
    invalidate: [wk.all],
    success: (r) => `Đã nhập kho phiếu ${r.code} (theo phiếu mua ${r.purchaseOrderCode ?? po?.code ?? ''})`,
    onFieldErrors: (f) => {
      // Lỗi máy chủ theo vị trí dòng gửi lên → đổi về id dòng phiếu mua.
      const mapped: Record<string, string> = {};
      Object.entries(f).forEach(([k, v]) => {
        const m = /^lines\.(\d+)\.(\w+)$/.exec(k);
        if (m) mapped[`${lines[Number(m[1])]?.id}.${m[2]}`] = v;
        else mapped[k] = v;
      });
      setErrors(mapped);
      setConfirming(false);
    },
    onSuccess: () => {
      leave.allowLeave();
      navigate('/kho/phieu-mua');
    },
  });

  const validate = (): boolean => {
    const local: Record<string, string> = {};
    parsed.forEach(({ line, value }) => {
      if (!isQty(value)) local[`${line.id}.qty`] = 'Số lượng không hợp lệ';
      else if (value > remainingOf(line.id) + 1e-9) {
        local[`${line.id}.qty`] = `Không được nhận quá số còn lại (${formatQty(remainingOf(line.id), line.purchaseUnit)}). Hàng giao dư vui lòng trả lại nhà cung cấp hoặc nhập bằng Nhập kho không phiếu.`;
      }
    });
    if (!Object.keys(local).length && count === 0) local.lines = 'Vui lòng nhập số lượng nhận cho ít nhất một nguyên liệu';
    setErrors(local);
    return Object.keys(local).length === 0;
  };

  const submit = () => {
    mutation.mutate({
      note,
      lines: lines.map((l) => ({ purchaseOrderItemId: l.id, qty: parsed.find((p) => p.line.id === l.id)?.value ?? 0, note: notes[l.id] ?? '' })),
    });
  };

  const waiting = po && po.status === 'ordered' && (po.receiveStatus === 'not_received' || po.receiveStatus === 'partial');

  return (
    <AppShell meta={{ label: 'Nhận hàng', parent: 'Nhập kho', parentTo: '/kho/nhap-kho' }}>
      <div className="min-w-0 space-y-4">
        <SubPageHeader
          title={po ? `Nhận hàng · ${po.code}` : 'Nhận hàng theo phiếu mua'}
          backTo={id ? `/kho/phieu-mua/${id}` : '/kho/phieu-mua'}
          description={po ? `${po.supplier.name} · đặt ngày ${po.orderDate ? formatDateOnly(po.orderDate) : '—'}. Đối chiếu đơn giá với hóa đơn của nhà cung cấp trước khi nhập kho.` : undefined}
        />
        {detail.isError ? (
          <BlockError message="Không tìm thấy phiếu mua" onRetry={() => navigate('/kho/phieu-mua')} />
        ) : !po ? (
          <Skeleton className="h-64" />
        ) : !waiting ? (
          <BlockError message="Phiếu mua không còn ở trạng thái chờ nhận hàng" onRetry={() => navigate(`/kho/phieu-mua/${po.id}`)} />
        ) : (
          <>
            <Card className="overflow-hidden">
              <div className="flex flex-wrap items-start justify-between gap-3 p-5 pb-3">
                <CardHeader title="Hàng nhận lần này" description="SL theo đơn vị mua của phiếu; giao không tròn quy cách thì nhập số lẻ (VD 0,875 thùng)." />
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setQty(Object.fromEntries(lines.map((l) => [l.id, String(remainingOf(l.id))])))}>Nhận đủ tất cả</Button>
                  <Button size="sm" variant="ghost" onClick={() => setQty(Object.fromEntries(lines.map((l) => [l.id, '0'])))}>Đặt tất cả về 0</Button>
                </div>
              </div>
              {errors.lines ? <p className="px-5 pb-2 text-[12.5px] text-[var(--danger)]">{errors.lines}</p> : null}
              <DataTable minWidth={1120}>
                <thead>
                  <tr>
                    <Th>Nguyên liệu</Th>
                    <Th>Quy cách</Th>
                    <Th className="text-right">SL đặt</Th>
                    <Th className="text-right">Đã nhận</Th>
                    <Th className="text-right">Còn lại</Th>
                    <Th>SL nhận lần này</Th>
                    <Th className="text-right">Đơn giá</Th>
                    <Th className="text-right">Thành tiền</Th>
                    <Th>Ghi chú dòng</Th>
                  </tr>
                </thead>
                <tbody>
                  {parsed.map(({ line: l, value }) => {
                    const remaining = remainingOf(l.id);
                    const err = errors[`${l.id}.qty`];
                    return (
                      <tr key={l.id} className="align-top">
                        <Td>
                          <p className="font-semibold">{l.ingredientName}</p>
                          <p className="font-mono text-[12px] text-[var(--text-muted)]">{l.ingredientCode}</p>
                        </Td>
                        <Td className="whitespace-nowrap text-[13px]">{formatSpec(l.purchaseUnit, l.factor, l.stockUnit)}</Td>
                        <Td className="text-right font-mono">{l.qtyOrdered === null ? '—' : formatQty(l.qtyOrdered)}</Td>
                        <Td className="text-right font-mono">{formatQty(l.qtyReceived)}</Td>
                        <Td className="text-right font-mono font-semibold">{formatQty(remaining, l.purchaseUnit)}</Td>
                        <Td className="w-[150px]">
                          <TextInput
                            aria-label={`SL nhận ${l.ingredientName}`}
                            inputMode="decimal"
                            value={qty[l.id] ?? ''}
                            disabled={remaining <= 0}
                            invalid={Boolean(err)}
                            onChange={(e) => {
                              setQty((p) => ({ ...p, [l.id]: e.target.value }));
                              setErrors((p) => ({ ...p, [`${l.id}.qty`]: '', lines: '' }));
                            }}
                          />
                          {value > 0 ? <p className="mt-1 text-[12px] text-[var(--text-muted)]">= {formatQty(r3(value * l.factor), l.stockUnit)}</p> : null}
                          {err ? <p className="mt-1 text-[12px] text-[var(--danger)]">{err}</p> : null}
                        </Td>
                        <Td className="text-right font-mono">{l.unitPrice === null ? '—' : formatCurrency(l.unitPrice)}</Td>
                        <Td className="text-right font-mono font-semibold">{value > 0 && l.unitPrice ? formatCurrency(Math.round(value * l.unitPrice)) : '—'}</Td>
                        <Td className="w-[200px]">
                          <TextInput aria-label={`Ghi chú ${l.ingredientName}`} maxLength={200} value={notes[l.id] ?? ''} onChange={(e) => setNotes((p) => ({ ...p, [l.id]: e.target.value }))} placeholder="Hàng dập, giao thiếu…" />
                        </Td>
                      </tr>
                    );
                  })}
                </tbody>
              </DataTable>
            </Card>

            <Card padded>
              <Field label="Ghi chú phiếu nhập" htmlFor="rc-note" hint={`${note.length}/500 ký tự · người giao, số hóa đơn của nhà cung cấp…`}>
                <TextArea id="rc-note" rows={2} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
              </Field>
            </Card>

            <p className="text-[12.5px] text-[var(--text-muted)]">
              Đơn giá sai so với hóa đơn? Đừng nhập kho — <Link to={`/kho/phieu-mua/${po.id}`} className="text-[var(--accent)] hover:underline">hủy phiếu / kết thúc nhận hàng</Link> rồi lập phiếu mới đúng giá.
            </p>
            <StickySaveBar
              dirty={dirty}
              idleText="Đã điền sẵn số lượng còn lại"
              errorCount={Object.values(errors).filter(Boolean).length}
              summary={<>{count} nguyên liệu · giá trị lần này <b className="font-mono text-[var(--text-primary)]">{formatCurrency(totalValue)}</b></>}
              saveLabel="Nhập kho"
              saveIcon={<PackageCheck size={15} />}
              canSave={count > 0}
              onDiscard={discard}
              onSave={() => validate() && setConfirming(true)}
            />
          </>
        )}
      </div>
      {leave.dialog}
      <ConfirmDialog
        open={confirming}
        onOpenChange={(o) => !o && setConfirming(false)}
        tone="primary"
        title="Xác nhận nhập kho?"
        description={`${count} nguyên liệu · tổng giá trị ${formatCurrency(totalValue)}. Sau khi nhập kho, phiếu nhập không sửa hay xóa được.`}
        confirmLabel="Nhập kho"
        loading={mutation.isPending}
        onConfirm={submit}
      />
    </AppShell>
  );
}

export default ReceivePage;
