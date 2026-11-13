import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, PackagePlus, Plus, Trash2 } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { Card, CardHeader } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { Field, SelectInput, TextArea, TextInput } from '@/components/common/Form';
import { ConfirmDialog } from '@/components/common/Modal';
import { DataTable, PageHeader, Td, Th } from '@/components/common/PageParts';
import { createDirectReceipt } from '@/api/warehouse-receipts';
import { useIngredientOptions, useSupplier, useSupplierOptions, wk } from '@/features/warehouse/queries';
import { formatQty } from '@/features/warehouse/labels';
import { parseMoney, parseQty, useLeaveGuard } from '@/features/warehouse/parts';
import { useApiMutation } from '@/hooks/use-api-mutation';
import { formatCurrency } from '@/lib/format';
import type { DirectReceiptInput } from '@/types';

const RETAIL = '__retail__';

interface Row {
  key: number;
  ingredientId: string;
  unit: string;
  qty: string;
  price: string;
}

let seq = 0;

/** UC-KHO-18: Nhập kho không có phiếu mua (mua lẻ, đã trả tiền ngay — không phát sinh công nợ). */
export function DirectReceiptPage() {
  const navigate = useNavigate();
  const { data: suppliers = [] } = useSupplierOptions();
  const { data: options = [] } = useIngredientOptions();
  const [source, setSource] = useState('');
  const [sourceName, setSourceName] = useState('');
  const [note, setNote] = useState('');
  const [rows, setRows] = useState<Row[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirming, setConfirming] = useState(false);
  const [priceWarnings, setPriceWarnings] = useState<string[] | null>(null);

  const supplierId = source && source !== RETAIL ? source : undefined;
  const supplier = useSupplier(supplierId);
  const activeLink = (ingredientId: string) =>
    supplier.data?.links.find((l) => l.ingredientId === ingredientId && l.status === 'active') ?? null;
  const option = (ingredientId: string) => options.find((o) => o.id === ingredientId);

  const dirty = Boolean(source || sourceName || note || rows.length);
  const { guard, dialog } = useLeaveGuard(dirty);
  const back = () => navigate('/kho/nhap-kho');

  const chosen = new Set(rows.map((r) => r.ingredientId));
  const activeOptions = useMemo(() => options.filter((o) => o.active), [options]);

  const factorOf = (r: Row) => {
    const link = activeLink(r.ingredientId);
    return link && r.unit === link.purchaseUnit ? link.factor : 1;
  };

  const setRow = (index: number, patch: Partial<Row>) => {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));
    setErrors((prev) => Object.fromEntries(Object.entries(prev).filter(([k]) => !k.startsWith(`lines.${index}.`) && k !== 'lines')));
  };
  const chooseIngredient = (index: number, ingredientId: string) => {
    const o = option(ingredientId);
    const link = activeLink(ingredientId);
    // Có liên kết với NCC: mặc định đơn vị mua + giá hiện hành; không thì đơn vị kho + giá vốn hiện tại.
    setRow(index, {
      ingredientId,
      unit: link ? link.purchaseUnit : o?.unit ?? '',
      price: link ? String(link.price) : o?.avgCost ? String(Math.round(o.avgCost)) : '',
    });
  };

  const parsed = rows.map((r) => ({ row: r, qty: parseQty(r.qty), price: parseMoney(r.price), factor: factorOf(r) }));
  const total = parsed.reduce((s, p) => (p.qty > 0 && p.price > 0 ? s + Math.round(p.qty * p.price) : s), 0);

  const mutation = useApiMutation((input: DirectReceiptInput) => createDirectReceipt(input), {
    invalidate: [wk.all],
    success: (r) => `Đã nhập kho phiếu ${r.code}`,
    onFieldErrors: (f) => {
      setErrors(f);
      setConfirming(false);
    },
    onSuccess: back,
  });

  const validate = (): boolean => {
    const local: Record<string, string> = {};
    if (!source) local.source = 'Vui lòng chọn nơi mua';
    else if (source === RETAIL && !sourceName.trim()) local.sourceName = 'Vui lòng nhập tên nơi mua';
    if (rows.length === 0) local.lines = 'Phiếu nhập cần ít nhất một nguyên liệu';
    parsed.forEach(({ row, qty, price }, i) => {
      if (!row.ingredientId) local[`lines.${i}.ingredientId`] = 'Vui lòng chọn nguyên liệu';
      if (!(qty > 0)) local[`lines.${i}.qty`] = 'Số lượng phải lớn hơn 0';
      if (!(price > 0)) local[`lines.${i}.unitPrice`] = 'Đơn giá phải lớn hơn 0';
    });
    setErrors(local);
    return Object.keys(local).length === 0;
  };

  const submit = () => {
    if (!validate()) return;
    // 6e: đơn giá quy ra đơn vị kho chênh từ 50% so với giá vốn hiện tại → hỏi lại.
    const warn: string[] = [];
    parsed.forEach(({ row, price, factor }) => {
      const o = option(row.ingredientId);
      if (!o || !o.avgCost) return;
      const perStock = price / factor;
      const pct = Math.round((Math.abs(perStock - o.avgCost) / o.avgCost) * 100);
      if (pct >= 50) warn.push(`${o.name}: đơn giá ${formatCurrency(perStock)}/${o.unit} chênh ${pct}% so với giá vốn hiện tại ${formatCurrency(o.avgCost)}/${o.unit}.`);
    });
    if (warn.length) setPriceWarnings(warn);
    else setConfirming(true);
  };

  const save = () =>
    mutation.mutate({
      supplierId: supplierId ?? null,
      sourceName: source === RETAIL ? sourceName : '',
      note,
      lines: parsed.map(({ row, qty, price }) => ({ ingredientId: row.ingredientId, unit: row.unit, qty, unitPrice: price })),
    });

  return (
    <AppShell meta={{ label: 'Nhập kho không phiếu', parent: 'Nhập kho' }}>
      <div className="min-w-0 space-y-4">
        <PageHeader
          title="Nhập kho không phiếu"
          description="Mua lẻ (chợ, cửa hàng) đã trả tiền ngay — không phát sinh công nợ. Muốn theo dõi công nợ thì lập phiếu mua."
          actions={<Button variant="ghost" size="sm" leadingIcon={<ArrowLeft size={15} />} onClick={() => guard(back)}>Về nhập kho</Button>}
        />

        <Card padded>
          <CardHeader title="Nơi mua" />
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="Nơi mua" htmlFor="dr-source" required error={errors.source || errors.supplierId}>
              <SelectInput
                id="dr-source"
                value={source}
                invalid={Boolean(errors.source || errors.supplierId)}
                onChange={(e) => {
                  setSource(e.target.value);
                  setRows([]);
                  setErrors({});
                }}
                placeholder="— Chọn nơi mua —"
                options={[
                  { value: RETAIL, label: 'Mua lẻ (nhập tên nơi mua)' },
                  ...suppliers.filter((s) => s.active).map((s) => ({ value: s.id, label: `${s.name} (${s.code})` })),
                ]}
              />
            </Field>
            {source === RETAIL ? (
              <Field label="Tên nơi mua" htmlFor="dr-name" required error={errors.sourceName}>
                <TextInput id="dr-name" maxLength={150} value={sourceName} invalid={Boolean(errors.sourceName)} onChange={(e) => { setSourceName(e.target.value); setErrors((p) => ({ ...p, sourceName: '' })); }} placeholder="VD: Chợ Bến Thành" />
              </Field>
            ) : null}
            <Field label="Ghi chú" htmlFor="dr-note" hint={`${note.length}/500 ký tự · lý do mua lẻ, số hóa đơn…`} className="sm:col-span-2">
              <TextArea id="dr-note" rows={2} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
            </Field>
          </div>
        </Card>

        <Card className="overflow-hidden">
          <div className="flex flex-wrap items-start justify-between gap-3 p-5 pb-3">
            <CardHeader title="Nguyên liệu" description="Mặc định đơn vị kho; nơi mua là nhà cung cấp có liên kết thì chọn được đơn vị mua." />
            <Button size="sm" variant="outline" leadingIcon={<Plus size={15} />} disabled={!source} onClick={() => setRows((p) => [...p, { key: ++seq, ingredientId: '', unit: '', qty: '', price: '' }])}>
              Thêm nguyên liệu
            </Button>
          </div>
          {errors.lines ? <p className="px-5 pb-2 text-[12.5px] text-[var(--danger)]">{errors.lines}</p> : null}
          {!source ? (
            <p className="px-5 pb-5 text-[13px] text-[var(--text-muted)]">Chọn nơi mua trước khi thêm nguyên liệu.</p>
          ) : rows.length === 0 ? (
            <p className="px-5 pb-5 text-[13px] text-[var(--text-muted)]">Chưa có dòng nào.</p>
          ) : (
            <DataTable minWidth={960}>
              <thead>
                <tr><Th>Nguyên liệu</Th><Th>Đơn vị</Th><Th>SL nhập</Th><Th>Đơn giá (đ)</Th><Th className="text-right">Thành tiền</Th><Th><span className="sr-only">Xóa</span></Th></tr>
              </thead>
              <tbody>
                {parsed.map(({ row: r, qty, price, factor }, i) => {
                  const o = option(r.ingredientId);
                  const link = activeLink(r.ingredientId);
                  const units = o ? [o.unit, ...(link && link.purchaseUnit !== o.unit ? [link.purchaseUnit] : [])] : [];
                  return (
                    <tr key={r.key} className="align-top">
                      <Td className="min-w-[240px]">
                        <SelectInput
                          aria-label={`Nguyên liệu dòng ${i + 1}`}
                          value={r.ingredientId}
                          invalid={Boolean(errors[`lines.${i}.ingredientId`])}
                          onChange={(e) => chooseIngredient(i, e.target.value)}
                          placeholder="— Chọn nguyên liệu —"
                          options={activeOptions.filter((x) => x.id === r.ingredientId || !chosen.has(x.id)).map((x) => ({ value: x.id, label: `${x.name} (${x.code})` }))}
                        />
                        <RowError text={errors[`lines.${i}.ingredientId`]} />
                      </Td>
                      <Td className="w-[130px]">
                        <SelectInput aria-label={`Đơn vị dòng ${i + 1}`} value={r.unit} disabled={units.length <= 1} onChange={(e) => setRow(i, { unit: e.target.value, price: link && e.target.value === link.purchaseUnit ? String(link.price) : o?.avgCost ? String(Math.round(o.avgCost)) : r.price })} options={units.map((u) => ({ value: u, label: u }))} />
                        {factor !== 1 && o ? <p className="mt-1 text-[12px] text-[var(--text-muted)]">1 {r.unit} = {formatQty(factor)} {o.unit}</p> : null}
                        <RowError text={errors[`lines.${i}.unit`]} />
                      </Td>
                      <Td className="w-[130px]">
                        <TextInput aria-label={`SL nhập dòng ${i + 1}`} inputMode="decimal" value={r.qty} invalid={Boolean(errors[`lines.${i}.qty`])} onChange={(e) => setRow(i, { qty: e.target.value })} />
                        {qty > 0 && factor !== 1 && o ? <p className="mt-1 text-[12px] text-[var(--text-muted)]">= {formatQty(Math.round(qty * factor * 1000) / 1000, o.unit)}</p> : null}
                        <RowError text={errors[`lines.${i}.qty`]} />
                      </Td>
                      <Td className="w-[150px]">
                        <TextInput aria-label={`Đơn giá dòng ${i + 1}`} inputMode="numeric" value={r.price} invalid={Boolean(errors[`lines.${i}.unitPrice`])} onChange={(e) => setRow(i, { price: e.target.value })} />
                        <RowError text={errors[`lines.${i}.unitPrice`]} />
                      </Td>
                      <Td className="text-right font-mono font-semibold">{qty > 0 && price > 0 ? formatCurrency(Math.round(qty * price)) : '—'}</Td>
                      <Td className="text-right"><Button size="sm" variant="ghost" aria-label={`Xóa dòng ${i + 1}`} onClick={() => setRows((p) => p.filter((_, j) => j !== i))}><Trash2 size={14} /></Button></Td>
                    </tr>
                  );
                })}
              </tbody>
            </DataTable>
          )}
          <div className="flex justify-end border-t border-[var(--border)] p-5 text-[14px]">
            Tổng tiền: <span className="ml-2 font-mono text-[18px] font-bold text-[var(--accent)]">{formatCurrency(total)}</span>
          </div>
        </Card>

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => guard(back)}>Hủy</Button>
          <Button leadingIcon={<PackagePlus size={15} />} onClick={submit}>Nhập kho</Button>
        </div>
      </div>
      {dialog}
      <ConfirmDialog
        open={Boolean(priceWarnings)}
        onOpenChange={(o) => !o && setPriceWarnings(null)}
        tone="primary"
        title="Kiểm tra lại đơn giá?"
        description={<ul className="list-disc space-y-1 pl-5">{(priceWarnings ?? []).map((w) => <li key={w}>{w}</li>)}</ul>}
        confirmLabel="Vẫn nhập kho"
        onConfirm={() => {
          setPriceWarnings(null);
          setConfirming(true);
        }}
      />
      <ConfirmDialog
        open={confirming}
        onOpenChange={(o) => !o && setConfirming(false)}
        tone="primary"
        title="Xác nhận nhập kho?"
        description={`${rows.length} nguyên liệu · tổng giá trị ${formatCurrency(total)}. Sau khi nhập kho, phiếu nhập không sửa hay xóa được.`}
        confirmLabel="Nhập kho"
        loading={mutation.isPending}
        onConfirm={save}
      />
    </AppShell>
  );
}

function RowError({ text }: { text?: string }) {
  return text ? <p className="mt-1 text-[12px] text-[var(--danger)]">{text}</p> : null;
}

export default DirectReceiptPage;
