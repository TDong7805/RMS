import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Plus, Save, Send, Trash2 } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { Card, CardHeader } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { BlockError } from '@/components/common/EmptyState';
import { Field, SelectInput, TextArea, TextInput } from '@/components/common/Form';
import { ConfirmDialog } from '@/components/common/Modal';
import { DataTable, PageHeader, Td, Th } from '@/components/common/PageParts';
import { Segmented } from '@/components/common/Segmented';
import { Skeleton } from '@/components/common/Skeleton';
import { createPurchaseOrder, updatePurchaseOrder, type PurchaseAction } from '@/api/warehouse-purchases';
import { PurchaseDeleteDialog, type PurchaseTarget } from '@/features/warehouse/PurchaseDialogs';
import { useIngredient, useIngredientOptions, usePurchaseOrder, useSupplier, useSupplierOptions, wk } from '@/features/warehouse/queries';
import { formatQty, formatSpec, PAYMENT_METHOD } from '@/features/warehouse/labels';
import { dateKeyOffset, InfoItem, parseMoney, parseQty, useLeaveGuard } from '@/features/warehouse/parts';
import { useApiMutation } from '@/hooks/use-api-mutation';
import { formatCurrency } from '@/lib/format';
import { formatDateOnly } from '@/lib/labels';
import type { PurchaseOrderInput, PurchaseOrderRow, SupplierLink } from '@/types';

interface LineRow {
  key: number;
  ingredientId: string;
  /** Quy cách đã lưu (phiếu nháp) — null = lấy theo liên kết hiện hành. */
  savedUnit: string | null;
  savedFactor: number | null;
  qty: string;
  price: string;
}

interface FormState {
  supplierId: string;
  name: string;
  orderDate: string;
  expectedDate: string;
  note: string;
  discountMode: 'amount' | 'percent';
  discount: string;
  taxPercent: string;
  otherCost: string;
}

let seq = 0;
const nextKey = () => ++seq;
const round = (v: number) => Math.round(v);
const parsePercent = (t: string) => {
  const raw = t.trim().replace(',', '.');
  if (!raw) return NaN;
  return /^\d+(\.\d{1,2})?$/.test(raw) ? Number(raw) : NaN;
};
const ddmm = (key: string) => {
  const [, m, d] = key.split('-');
  return `${d}/${m}`;
};

const emptyForm = (): FormState => ({
  supplierId: '',
  name: '',
  orderDate: dateKeyOffset(0),
  expectedDate: '',
  note: '',
  discountMode: 'amount',
  discount: '',
  taxPercent: '',
  otherCost: '',
});

/** UC-KHO-13 (tạo phiếu mua) và UC-KHO-15 (sửa phiếu nháp, đặt hàng, xóa). */
export function PurchaseOrderFormPage() {
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const presetIngredient = isEdit ? null : params.get('nl');

  const detail = usePurchaseOrder(id);
  const { data: supplierOptions = [] } = useSupplierOptions();
  const { data: ingredientOptions = [] } = useIngredientOptions();
  const preset = useIngredient(presetIngredient ?? undefined);

  const [form, setForm] = useState<FormState>(emptyForm);
  const [lines, setLines] = useState<LineRow[]>([]);
  const [initial, setInitial] = useState('');
  const [loaded, setLoaded] = useState(!isEdit);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pendingSupplier, setPendingSupplier] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[] | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PurchaseTarget | null>(null);
  const suggestedName = useRef('');

  const supplier = useSupplier(form.supplierId || undefined);
  const links = useMemo(() => supplier.data?.links ?? [], [supplier.data]);
  const linkOf = (ingredientId: string): SupplierLink | undefined => links.find((l) => l.ingredientId === ingredientId);

  // Nạp phiếu nháp khi sửa.
  useEffect(() => {
    const d = detail.data;
    if (!isEdit || !d || d.id !== id || loaded) return;
    const state: FormState = {
      supplierId: d.supplier.id,
      name: d.name,
      orderDate: d.orderDate ?? dateKeyOffset(0),
      expectedDate: d.expectedDate ?? '',
      note: d.note,
      discountMode: d.discountPercent !== null ? 'percent' : 'amount',
      discount: d.discountPercent !== null ? String(d.discountPercent) : d.discount ? String(d.discount) : '',
      taxPercent: d.taxPercent ? String(d.taxPercent) : '',
      otherCost: d.otherCost ? String(d.otherCost) : '',
    };
    const rows = d.lines.map((l) => ({
      key: nextKey(),
      ingredientId: l.ingredientId,
      savedUnit: l.purchaseUnit,
      savedFactor: l.factor,
      qty: l.qtyOrdered === null ? '' : String(l.qtyOrdered),
      price: l.unitPrice === null ? '' : String(l.unitPrice),
    }));
    setForm(state);
    setLines(rows);
    setInitial(JSON.stringify({ state, rows: rows.map(({ key: _k, ...r }) => r) }));
    suggestedName.current = '';
    setLoaded(true);
  }, [detail.data, isEdit, id, loaded]);

  useEffect(() => {
    if (!isEdit) setInitial(JSON.stringify({ state: emptyForm(), rows: [] }));
  }, [isEdit]);

  // Mở từ "Tạo phiếu mua" của một nguyên liệu: chọn sẵn nhà cung cấp duy nhất (nếu chỉ có một) và thêm dòng.
  const presetSuppliers = useMemo(
    () => (preset.data?.suppliers ?? []).filter((s) => s.supplierActive && s.linkActive).map((s) => s.supplierId),
    [preset.data],
  );
  useEffect(() => {
    if (presetIngredient && presetSuppliers.length === 1 && !form.supplierId) chooseSupplier(presetSuppliers[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presetSuppliers]);
  useEffect(() => {
    if (!presetIngredient || !form.supplierId || lines.length > 0) return;
    const link = linkOf(presetIngredient);
    if (link && link.status === 'active') {
      setLines([{ key: nextKey(), ingredientId: link.ingredientId, savedUnit: null, savedFactor: null, qty: '', price: String(link.price) }]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presetIngredient, form.supplierId, links]);

  const dirty = JSON.stringify({ state: form, rows: lines.map(({ key: _k, ...r }) => r) }) !== initial;
  const { guard, dialog } = useLeaveGuard(dirty);
  const backToList = () => navigate('/kho/phieu-mua');

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key === 'discountMode' ? 'discount' : key]: '' }));
  };

  function applySupplier(supplierId: string) {
    const name = supplierOptions.find((s) => s.id === supplierId)?.name ?? '';
    const suggestion = supplierId ? `Mua ${name} ${ddmm(form.orderDate || dateKeyOffset(0))}` : '';
    setForm((prev) => {
      const keepName = prev.name.trim() && prev.name !== suggestedName.current;
      suggestedName.current = suggestion;
      return { ...prev, supplierId, name: keepName ? prev.name : suggestion };
    });
    setLines([]);
    setErrors({});
  }

  function chooseSupplier(supplierId: string) {
    if (lines.length > 0 && supplierId !== form.supplierId) setPendingSupplier(supplierId);
    else applySupplier(supplierId);
  }

  /* ---------------- Dòng nguyên liệu */
  const chosen = new Set(lines.map((l) => l.ingredientId));
  const unitOf = (l: LineRow) => {
    const link = linkOf(l.ingredientId);
    return { unit: l.savedUnit ?? link?.purchaseUnit ?? '', factor: l.savedFactor ?? link?.factor ?? 1 };
  };
  const stockUnitOf = (ingredientId: string) => ingredientOptions.find((o) => o.id === ingredientId)?.unit ?? linkOf(ingredientId)?.stockUnit ?? '';
  const onHandOf = (ingredientId: string) => ingredientOptions.find((o) => o.id === ingredientId)?.onHand ?? 0;
  const selectable = (current: string) =>
    links.filter((l) => l.status === 'active' && l.ingredientActive && (l.ingredientId === current || !chosen.has(l.ingredientId)));

  const setLine = (index: number, patch: Partial<LineRow>) => {
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)));
    setErrors((prev) => Object.fromEntries(Object.entries(prev).filter(([k]) => !k.startsWith(`lines.${index}.`) && k !== 'lines')));
  };
  const chooseIngredient = (index: number, ingredientId: string) => {
    const link = linkOf(ingredientId);
    setLine(index, { ingredientId, savedUnit: null, savedFactor: null, price: link ? String(link.price) : '' });
  };
  const removeLine = (index: number) => {
    setLines((prev) => prev.filter((_, i) => i !== index));
    setErrors((prev) => Object.fromEntries(Object.entries(prev).filter(([k]) => !k.startsWith('lines.'))));
  };

  /* ---------------- Tổng tiền (cùng cách làm tròn với máy chủ) */
  const subtotal = lines.reduce((s, l) => {
    const qty = parseQty(l.qty);
    const price = parseMoney(l.price);
    return qty > 0 && price > 0 ? s + round(qty * price) : s;
  }, 0);
  const discountValue = form.discountMode === 'percent' ? parsePercent(form.discount) : parseMoney(form.discount);
  const discount = !(discountValue > 0) ? 0 : form.discountMode === 'percent' ? round((subtotal * discountValue) / 100) : discountValue;
  const taxPercent = parsePercent(form.taxPercent) || 0;
  const tax = round(((subtotal - discount) * taxPercent) / 100);
  const otherCost = parseMoney(form.otherCost) || 0;
  const total = subtotal - discount + tax + otherCost;

  /* ---------------- Lưu */
  const mutation = useApiMutation(
    ({ input, action }: { input: PurchaseOrderInput; action: PurchaseAction }) =>
      id ? updatePurchaseOrder(id, input, action) : createPurchaseOrder(input, action),
    {
      invalidate: [wk.all],
      success: (r: PurchaseOrderRow) => (r.status === 'ordered' ? `Đã đặt hàng phiếu ${r.code}` : `Đã lưu nháp phiếu ${r.code}`),
      onFieldErrors: setErrors,
      onSuccess: backToList,
    },
  );

  const buildInput = (action: PurchaseAction): PurchaseOrderInput | null => {
    const local: Record<string, string> = {};
    const order = action === 'order';
    if (!form.supplierId) local.supplierId = 'Vui lòng chọn nhà cung cấp';
    if (!form.name.trim()) local.name = 'Vui lòng nhập tên phiếu';
    if (order && lines.length === 0) local.lines = 'Phiếu cần ít nhất một nguyên liệu';
    const out = lines.map((l, i) => {
      const qtyText = l.qty.trim();
      const priceText = l.price.trim();
      const qty = qtyText ? parseQty(qtyText) : null;
      const price = priceText ? parseMoney(priceText) : null;
      if (!l.ingredientId) local[`lines.${i}.ingredientId`] = 'Vui lòng chọn nguyên liệu';
      if ((qty !== null && !(qty > 0)) || (order && qty === null)) local[`lines.${i}.qty`] = 'Số lượng phải lớn hơn 0';
      if ((price !== null && !(price > 0)) || (order && price === null)) local[`lines.${i}.unitPrice`] = 'Đơn giá phải lớn hơn 0';
      return { ingredientId: l.ingredientId, qty, unitPrice: price };
    });
    if (form.discount.trim() && !(discountValue >= 0)) local.discount = form.discountMode === 'percent' ? 'Phần trăm giảm giá phải từ 0 đến 100' : 'Giảm giá phải là số tiền không âm';
    else if (form.discountMode === 'percent' && discountValue > 100) local.discount = 'Phần trăm giảm giá phải từ 0 đến 100';
    else if (discount > subtotal && discount > 0) local.discount = 'Giảm giá không được lớn hơn tạm tính';
    if (form.taxPercent.trim() && !(parsePercent(form.taxPercent) >= 0 && parsePercent(form.taxPercent) <= 100)) local.taxPercent = 'Thuế phải từ 0 đến 100%, tối đa 2 chữ số thập phân';
    if (form.otherCost.trim() && !(parseMoney(form.otherCost) >= 0)) local.otherCost = 'Chi phí khác phải là số tiền không âm';
    if (Object.keys(local).length) {
      setErrors(local);
      return null;
    }
    return {
      supplierId: form.supplierId,
      name: form.name,
      orderDate: form.orderDate,
      expectedDate: form.expectedDate,
      note: form.note,
      discountPercent: form.discountMode === 'percent' && form.discount.trim() ? discountValue : null,
      discount: form.discountMode === 'amount' && form.discount.trim() ? discountValue : null,
      taxPercent,
      otherCost,
      lines: out,
    };
  };

  const save = (action: PurchaseAction) => {
    const input = buildInput(action);
    if (!input) return;
    if (action === 'order') {
      // 9h: cảnh báo không chặn — SL dưới mức tối thiểu, đơn giá khác giá hiện hành.
      const list: string[] = [];
      lines.forEach((l, i) => {
        const link = linkOf(l.ingredientId);
        const qty = input.lines[i].qty ?? 0;
        const price = input.lines[i].unitPrice ?? 0;
        if (!link) return;
        const { unit } = unitOf(l);
        if (link.minOrder !== null && qty < link.minOrder) list.push(`${link.ingredientName}: SL đặt ${formatQty(qty, unit)} nhỏ hơn mức tối thiểu ${formatQty(link.minOrder, link.purchaseUnit)} của nhà cung cấp`);
        if (price !== link.price && unit === link.purchaseUnit) list.push(`${link.ingredientName}: đơn giá ${formatCurrency(price)} khác giá nhập hiện hành ${formatCurrency(link.price)}`);
      });
      if (list.length) {
        setWarnings(list);
        return;
      }
    }
    mutation.mutate({ input, action });
  };

  const title = isEdit ? 'Sửa phiếu mua nháp' : 'Tạo phiếu mua';
  const d = detail.data;
  const notDraft = isEdit && d && d.status !== 'draft';
  const activeSuppliers = supplierOptions.filter(
    (s) => (s.active && (!presetIngredient || presetSuppliers.length === 0 || presetSuppliers.includes(s.id))) || s.id === form.supplierId,
  );
  const supplierInfo = supplier.data;
  const minOrderDate = dateKeyOffset(-7);

  return (
    <AppShell meta={{ label: title, parent: 'Quản lý phiếu mua' }}>
      <div className="min-w-0 space-y-4">
        <PageHeader
          title={title}
          description={isEdit && d ? `Phiếu ${d.code} · mã phiếu giữ nguyên khi lưu nháp hoặc đặt hàng.` : 'Mã phiếu do hệ thống tạo khi lưu (PM…). Phiếu đã đặt hàng không sửa được.'}
          actions={
            <Button variant="ghost" size="sm" leadingIcon={<ArrowLeft size={15} />} onClick={() => guard(backToList)}>Về danh sách</Button>
          }
        />

        {isEdit && (detail.isError || notDraft) ? (
          <BlockError message="Phiếu đã được đặt hàng hoặc đã bị xóa" onRetry={() => navigate('/kho/phieu-mua')} />
        ) : !loaded ? (
          <Card padded><div className="grid gap-4 sm:grid-cols-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-16" />)}</div></Card>
        ) : (
          <form onSubmit={(e) => { e.preventDefault(); save('order'); }} noValidate className="min-w-0 space-y-4">
            <Card padded>
              <CardHeader title="Thông tin phiếu" />
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <Field
                  label="Nhà cung cấp"
                  htmlFor="po-supplier"
                  required
                  error={errors.supplierId}
                  hint={presetIngredient && preset.data ? `Gợi ý nhà cung cấp đang bán ${preset.data.name}` : undefined}
                >
                  <SelectInput
                    id="po-supplier"
                    value={form.supplierId}
                    invalid={Boolean(errors.supplierId)}
                    onChange={(e) => chooseSupplier(e.target.value)}
                    placeholder="— Chọn nhà cung cấp —"
                    options={activeSuppliers.map((s) => ({ value: s.id, label: `${s.name} (${s.code})${s.active ? '' : ' – đang ngừng'}` }))}
                  />
                </Field>
                <Field label="Tên phiếu" htmlFor="po-name" required error={errors.name}>
                  <TextInput id="po-name" value={form.name} maxLength={150} invalid={Boolean(errors.name)} onChange={(e) => set('name', e.target.value)} placeholder="Mua [Tên NCC] [dd/MM]" />
                </Field>
                {supplierInfo ? (
                  <div className="grid gap-3 rounded-item bg-[var(--bg-subtle)] px-3 py-2.5 sm:col-span-2 sm:grid-cols-3">
                    <InfoItem label="Số điện thoại"><span className="font-mono">{supplierInfo.phone}</span></InfoItem>
                    <InfoItem label="Địa chỉ">{supplierInfo.address || '—'}</InfoItem>
                    <InfoItem label="Thanh toán">{PAYMENT_METHOD[supplierInfo.paymentMethod]}</InfoItem>
                  </div>
                ) : null}
                <Field label="Ngày đặt hàng" htmlFor="po-date" required error={errors.orderDate} hint={`Từ ${formatDateOnly(minOrderDate)} đến hôm nay`}>
                  <TextInput id="po-date" type="date" min={minOrderDate} max={dateKeyOffset(0)} value={form.orderDate} invalid={Boolean(errors.orderDate)} onChange={(e) => set('orderDate', e.target.value)} />
                </Field>
                <Field label="Ngày dự kiến nhận" htmlFor="po-expected" error={errors.expectedDate}>
                  <TextInput id="po-expected" type="date" min={form.orderDate} value={form.expectedDate} invalid={Boolean(errors.expectedDate)} onChange={(e) => set('expectedDate', e.target.value)} />
                </Field>
                <Field label="Ghi chú" htmlFor="po-note" error={errors.note} hint={`${form.note.length}/500 ký tự`} className="sm:col-span-2">
                  <TextArea id="po-note" rows={2} maxLength={500} value={form.note} invalid={Boolean(errors.note)} onChange={(e) => set('note', e.target.value)} />
                </Field>
              </div>
            </Card>

            <Card className="overflow-hidden">
              <div className="flex flex-wrap items-start justify-between gap-3 p-5 pb-3">
                <CardHeader title="Danh sách nguyên liệu" description="SL đặt và đơn giá theo đơn vị mua của nhà cung cấp; đơn giá tự điền giá nhập hiện hành." />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  leadingIcon={<Plus size={15} />}
                  disabled={!form.supplierId}
                  onClick={() => setLines((prev) => [...prev, { key: nextKey(), ingredientId: '', savedUnit: null, savedFactor: null, qty: '', price: '' }])}
                >
                  Thêm nguyên liệu
                </Button>
              </div>
              {errors.lines ? <p className="px-5 pb-2 text-[12.5px] text-[var(--danger)]">{errors.lines}</p> : null}
              {!form.supplierId ? (
                <p className="px-5 pb-5 text-[13px] text-[var(--text-muted)]">Chọn nhà cung cấp trước khi thêm nguyên liệu.</p>
              ) : lines.length === 0 ? (
                <p className="px-5 pb-5 text-[13px] text-[var(--text-muted)]">Chưa có dòng nào.</p>
              ) : (
                <DataTable minWidth={1020}>
                  <thead>
                    <tr>
                      <Th>Nguyên liệu</Th>
                      <Th>Quy cách</Th>
                      <Th className="text-right">Tồn hiện tại</Th>
                      <Th>SL đặt</Th>
                      <Th>Đơn giá (đ)</Th>
                      <Th className="text-right">Thành tiền</Th>
                      <Th className="text-right"><span className="sr-only">Xóa dòng</span></Th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((l, i) => {
                      const link = linkOf(l.ingredientId);
                      const { unit, factor } = unitOf(l);
                      const stockUnit = stockUnitOf(l.ingredientId);
                      const qty = parseQty(l.qty);
                      const price = parseMoney(l.price);
                      const changed = link && l.savedUnit !== null && (link.price !== price || link.purchaseUnit !== l.savedUnit || link.factor !== l.savedFactor);
                      const saved = l.savedUnit !== null && !selectable(l.ingredientId).some((x) => x.ingredientId === l.ingredientId);
                      return (
                        <tr key={l.key} className="align-top">
                          <Td className="min-w-[230px]">
                            <SelectInput
                              aria-label={`Nguyên liệu dòng ${i + 1}`}
                              value={l.ingredientId}
                              invalid={Boolean(errors[`lines.${i}.ingredientId`])}
                              onChange={(e) => chooseIngredient(i, e.target.value)}
                              placeholder="— Chọn nguyên liệu —"
                              options={[
                                ...selectable(l.ingredientId).map((x) => ({ value: x.ingredientId, label: `${x.ingredientName} (${x.ingredientCode})` })),
                                ...(saved && link ? [{ value: l.ingredientId, label: `${link.ingredientName} (không còn cung cấp)` }] : []),
                              ]}
                            />
                            <RowError text={errors[`lines.${i}.ingredientId`]} />
                            {i === lines.length - 1 && supplierInfo ? (
                              <p className="mt-1 text-[12px] text-[var(--text-muted)]">
                                Không thấy nguyên liệu? <Link to={`/kho/nha-cung-cap/${supplierInfo.id}`} target="_blank" className="text-[var(--accent)] hover:underline">Thêm liên kết</Link> trong trang nhà cung cấp.
                              </p>
                            ) : null}
                          </Td>
                          <Td className="whitespace-nowrap text-[13px]">
                            {l.ingredientId ? formatSpec(unit, factor, stockUnit) : '—'}
                            {changed ? <p className="mt-1 text-[12px] text-[var(--warning)]">Hiện hành: {formatCurrency(link.price)} / {formatSpec(link.purchaseUnit, link.factor, link.stockUnit)}</p> : null}
                          </Td>
                          <Td className="text-right font-mono text-[13px]">{l.ingredientId ? formatQty(onHandOf(l.ingredientId), stockUnit) : '—'}</Td>
                          <Td className="w-[130px]">
                            <TextInput aria-label={`SL đặt dòng ${i + 1}`} inputMode="decimal" value={l.qty} invalid={Boolean(errors[`lines.${i}.qty`])} onChange={(e) => setLine(i, { qty: e.target.value })} />
                            {qty > 0 && factor !== 1 ? <p className="mt-1 text-[12px] text-[var(--text-muted)]">{formatQty(qty, unit)} = {formatQty(Math.round(qty * factor * 1000) / 1000, stockUnit)}</p> : null}
                            <RowError text={errors[`lines.${i}.qty`]} />
                          </Td>
                          <Td className="w-[150px]">
                            <TextInput aria-label={`Đơn giá dòng ${i + 1}`} inputMode="numeric" value={l.price} invalid={Boolean(errors[`lines.${i}.unitPrice`])} onChange={(e) => setLine(i, { price: e.target.value })} />
                            {unit ? <p className="mt-1 text-[12px] text-[var(--text-muted)]">/ {unit}</p> : null}
                            <RowError text={errors[`lines.${i}.unitPrice`]} />
                          </Td>
                          <Td className="text-right font-mono font-semibold">{qty > 0 && price > 0 ? formatCurrency(round(qty * price)) : '—'}</Td>
                          <Td className="text-right">
                            <Button type="button" size="sm" variant="ghost" aria-label={`Xóa dòng ${i + 1}`} onClick={() => removeLine(i)}><Trash2 size={14} /></Button>
                          </Td>
                        </tr>
                      );
                    })}
                  </tbody>
                </DataTable>
              )}
            </Card>

            <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
              <Card padded>
                <CardHeader title="Giảm giá, thuế, chi phí" />
                <div className="mt-4 grid gap-4 sm:grid-cols-3">
                  <Field label={form.discountMode === 'percent' ? 'Giảm giá (%)' : 'Giảm giá (đ)'} htmlFor="po-discount" error={errors.discount}>
                    <div className="space-y-2">
                      <Segmented<'amount' | 'percent'>
                        ariaLabel="Cách nhập giảm giá"
                        value={form.discountMode}
                        onChange={(v) => set('discountMode', v)}
                        options={[{ value: 'amount', label: 'Số tiền' }, { value: 'percent', label: '%' }]}
                      />
                      <TextInput id="po-discount" inputMode="decimal" value={form.discount} invalid={Boolean(errors.discount)} onChange={(e) => set('discount', e.target.value)} placeholder="0" />
                    </div>
                  </Field>
                  <Field label="Thuế (%)" htmlFor="po-tax" error={errors.taxPercent}>
                    <TextInput id="po-tax" inputMode="decimal" value={form.taxPercent} invalid={Boolean(errors.taxPercent)} onChange={(e) => set('taxPercent', e.target.value)} placeholder="0" />
                  </Field>
                  <Field label="Chi phí khác (đ)" htmlFor="po-other" error={errors.otherCost} hint="Vận chuyển, bốc xếp…">
                    <TextInput id="po-other" inputMode="numeric" value={form.otherCost} invalid={Boolean(errors.otherCost)} onChange={(e) => set('otherCost', e.target.value)} placeholder="0" />
                  </Field>
                </div>
              </Card>
              <Card padded>
                <CardHeader title="Tổng tiền" />
                <dl className="mt-3 space-y-2 text-[14px]">
                  <TotalRow label="Tạm tính" value={subtotal} />
                  <TotalRow label="Giảm giá" value={-discount} />
                  <TotalRow label={`Thuế${taxPercent ? ` (${taxPercent}%)` : ''}`} value={tax} />
                  <TotalRow label="Chi phí khác" value={otherCost} />
                  <div className="flex items-center justify-between border-t border-[var(--border)] pt-2">
                    <dt className="font-semibold">Tổng cộng</dt>
                    <dd className="font-mono text-[18px] font-bold text-[var(--accent)]">{formatCurrency(total)}</dd>
                  </div>
                </dl>
              </Card>
            </div>

            <div className="flex flex-wrap justify-end gap-2">
              {isEdit && d ? (
                <Button variant="danger" className="mr-auto" leadingIcon={<Trash2 size={15} />} onClick={() => setDeleteTarget({ id: d.id, code: d.code, supplierName: d.supplier.name, payable: 0 })}>
                  Xóa phiếu
                </Button>
              ) : null}
              <Button variant="ghost" onClick={() => guard(backToList)} disabled={mutation.isPending}>Hủy</Button>
              <Button variant="outline" leadingIcon={<Save size={15} />} disabled={mutation.isPending} onClick={() => save('draft')}>Lưu nháp</Button>
              <Button type="submit" leadingIcon={<Send size={15} />} loading={mutation.isPending}>Đặt hàng</Button>
            </div>
          </form>
        )}
      </div>
      {dialog}

      <ConfirmDialog
        open={Boolean(pendingSupplier)}
        onOpenChange={(o) => !o && setPendingSupplier(null)}
        tone="primary"
        title="Đổi nhà cung cấp?"
        description="Các dòng nguyên liệu đã chọn sẽ bị xóa."
        confirmLabel="Đổi nhà cung cấp"
        onConfirm={() => {
          if (pendingSupplier !== null) applySupplier(pendingSupplier);
          setPendingSupplier(null);
        }}
      />
      <ConfirmDialog
        open={Boolean(warnings)}
        onOpenChange={(o) => !o && setWarnings(null)}
        tone="primary"
        title="Kiểm tra lại phiếu mua?"
        description={<ul className="list-disc space-y-1 pl-5">{(warnings ?? []).map((w) => <li key={w}>{w}</li>)}</ul>}
        confirmLabel="Vẫn đặt hàng"
        loading={mutation.isPending}
        onConfirm={() => {
          const input = buildInput('order');
          setWarnings(null);
          if (input) mutation.mutate({ input, action: 'order' });
        }}
      />
      <PurchaseDeleteDialog target={deleteTarget} onClose={() => setDeleteTarget(null)} onDone={backToList} />
    </AppShell>
  );
}

function TotalRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-[var(--text-secondary)]">{label}</dt>
      <dd className="font-mono">{value < 0 ? `− ${formatCurrency(-value)}` : formatCurrency(value)}</dd>
    </div>
  );
}

function RowError({ text }: { text?: string }) {
  return text ? <p className="mt-1 text-[12px] text-[var(--danger)]">{text}</p> : null;
}

export default PurchaseOrderFormPage;
