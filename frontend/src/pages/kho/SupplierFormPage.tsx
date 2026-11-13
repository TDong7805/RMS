import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Plus, Save, Trash2 } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { Card, CardHeader } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { BlockError } from '@/components/common/EmptyState';
import { Field, SelectInput, TextArea, TextInput } from '@/components/common/Form';
import { ConfirmDialog } from '@/components/common/Modal';
import { DataTable, PageHeader, Td, Th } from '@/components/common/PageParts';
import { Skeleton } from '@/components/common/Skeleton';
import { createSupplier, findSupplierByName, updateSupplier } from '@/api/warehouse-suppliers';
import { useIngredientOptions, useSupplier, wk } from '@/features/warehouse/queries';
import { formatQty, PAYMENT_METHOD, PURCHASE_UNITS } from '@/features/warehouse/labels';
import { parseMoney, parseQty, useLeaveGuard } from '@/features/warehouse/parts';
import { useApiMutation } from '@/hooks/use-api-mutation';
import { formatCurrency } from '@/lib/format';
import { formatDateTime } from '@/lib/labels';
import type { PaymentMethod, SupplierInput, SupplierLinkInput } from '@/types';

interface InfoState {
  name: string;
  phone: string;
  paymentMethod: PaymentMethod | '';
  contact: string;
  email: string;
  website: string;
  taxCode: string;
  address: string;
  note: string;
}

interface LinkRow {
  key: number;
  ingredientId: string;
  purchaseUnit: string;
  factor: string;
  price: string;
  minOrder: string;
}

const EMPTY: InfoState = { name: '', phone: '', paymentMethod: '', contact: '', email: '', website: '', taxCode: '', address: '', note: '' };
const METHODS = Object.keys(PAYMENT_METHOD) as PaymentMethod[];
let rowSeq = 0;
const newRow = (): LinkRow => ({ key: ++rowSeq, ingredientId: '', purchaseUnit: '', factor: '1', price: '', minOrder: '' });

/** UC-KHO-08 (thêm, kèm danh sách nguyên liệu cung cấp) và UC-KHO-09 (sửa thông tin). */
export function SupplierFormPage() {
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const detail = useSupplier(id);
  const { data: options = [] } = useIngredientOptions();

  const [form, setForm] = useState<InfoState>(EMPTY);
  const [initial, setInitial] = useState<InfoState>(EMPTY);
  const [rows, setRows] = useState<LinkRow[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loaded, setLoaded] = useState(!isEdit);
  const [checking, setChecking] = useState(false);
  const [dupName, setDupName] = useState<{ code: string; name: string; input: SupplierInput } | null>(null);

  useEffect(() => {
    setErrors({});
    setRows([]);
    if (!id) {
      setForm(EMPTY);
      setInitial(EMPTY);
      setLoaded(true);
    } else setLoaded(false);
  }, [id]);

  useEffect(() => {
    const d = detail.data;
    if (isEdit && d && d.id === id && !loaded) {
      const state: InfoState = {
        name: d.name,
        phone: d.phone,
        paymentMethod: d.paymentMethod,
        contact: d.contact,
        email: d.email,
        website: d.website,
        taxCode: d.taxCode,
        address: d.address,
        note: d.note,
      };
      setForm(state);
      setInitial(state);
      setLoaded(true);
    }
  }, [detail.data, isEdit, loaded, id]);

  const dirty = useMemo(() => JSON.stringify(form) !== JSON.stringify(initial) || rows.length > 0, [form, initial, rows]);
  const { guard, dialog } = useLeaveGuard(dirty);
  const backToList = () => navigate(isEdit && id ? `/kho/nha-cung-cap/${id}` : '/kho/nha-cung-cap');

  const mutation = useApiMutation((input: SupplierInput) => (id ? updateSupplier(id, input) : createSupplier(input)), {
    invalidate: [wk.all],
    success: (s) => (isEdit ? `Đã cập nhật nhà cung cấp ${s.name}` : `Đã thêm nhà cung cấp ${s.name} (${s.code})`),
    onFieldErrors: setErrors,
    onSuccess: (s) => navigate(`/kho/nha-cung-cap/${s.id}`),
  });

  const set = <K extends keyof InfoState>(key: K, value: InfoState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: '' }));
  };

  const activeOptions = useMemo(() => options.filter((o) => o.active), [options]);
  const unitOf = (ingredientId: string) => options.find((o) => o.id === ingredientId)?.unit ?? '';

  const setRow = (index: number, key: keyof Omit<LinkRow, 'key'>, value: string) => {
    setRows((prev) =>
      prev.map((r, i) => {
        if (i !== index) return r;
        const next = { ...r, [key]: value };
        const unit = unitOf(next.ingredientId);
        if (key === 'ingredientId' && !r.purchaseUnit && unit) next.purchaseUnit = unit;
        // Đơn vị mua trùng đơn vị kho thì hệ số = 1 (khóa ô).
        if (unit && next.purchaseUnit === unit) next.factor = '1';
        return next;
      }),
    );
    setErrors((prev) => ({ ...prev, [`links.${index}.${key}`]: '' }));
  };

  const removeRow = (index: number) => {
    setRows((prev) => prev.filter((_, i) => i !== index));
    // Lỗi theo dòng đánh số lại theo vị trí mới: xóa hết lỗi dòng, lần lưu sau máy chủ báo lại.
    setErrors((prev) => Object.fromEntries(Object.entries(prev).filter(([k]) => !k.startsWith('links.'))));
  };

  const buildInput = (): SupplierInput | null => {
    const local: Record<string, string> = {};
    if (!form.name.trim()) local.name = 'Vui lòng nhập tên nhà cung cấp';
    if (!form.phone.trim()) local.phone = 'Vui lòng nhập số điện thoại';
    if (!form.paymentMethod) local.paymentMethod = 'Vui lòng chọn phương thức thanh toán';
    const links: SupplierLinkInput[] = rows.map((r, i) => {
      const factor = parseQty(r.factor);
      const price = parseMoney(r.price);
      const minOrder = r.minOrder.trim() === '' ? null : parseQty(r.minOrder);
      if (!r.ingredientId) local[`links.${i}.ingredientId`] = 'Vui lòng chọn nguyên liệu';
      else if (rows.findIndex((x) => x.ingredientId === r.ingredientId) !== i) local[`links.${i}.ingredientId`] = 'Nguyên liệu bị chọn trùng';
      if (!r.purchaseUnit) local[`links.${i}.purchaseUnit`] = 'Chọn đơn vị mua';
      if (!(factor > 0)) local[`links.${i}.factor`] = 'Hệ số phải lớn hơn 0';
      if (!(price > 0)) local[`links.${i}.price`] = 'Giá nhập phải lớn hơn 0';
      if (minOrder !== null && !(minOrder > 0)) local[`links.${i}.minOrder`] = 'Phải là số dương';
      return { ingredientId: r.ingredientId, purchaseUnit: r.purchaseUnit, factor, price, minOrder };
    });
    if (Object.keys(local).length) {
      setErrors(local);
      return null;
    }
    return { ...form, ...(isEdit ? {} : { links }) };
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isEdit && !dirty) {
      backToList();
      return;
    }
    const input = buildInput();
    if (!input) return;
    // Trùng tên chỉ cảnh báo: hỏi lại trước khi lưu (UC-KHO-08 7j, UC-KHO-09 5g).
    const nameChanged = !isEdit || form.name.trim().toLowerCase() !== initial.name.trim().toLowerCase();
    if (nameChanged) {
      setChecking(true);
      try {
        const dup = await findSupplierByName(form.name, id);
        if (dup) {
          setDupName({ code: dup.code, name: dup.name, input });
          return;
        }
      } catch {
        // Không kiểm tra được thì vẫn để máy chủ xử lý khi lưu.
      } finally {
        setChecking(false);
      }
    }
    mutation.mutate(input);
  };

  const title = isEdit ? 'Cập nhật nhà cung cấp' : 'Thêm nhà cung cấp';
  const d = detail.data;
  const fieldError = (i: number, key: string) => errors[`links.${i}.${key}`];

  return (
    <AppShell meta={{ label: title, parent: 'Quản lý nhà cung cấp' }}>
      <div className="min-w-0 space-y-4">
        <PageHeader
          title={title}
          description={
            isEdit && d
              ? `Mã ${d.code} · cập nhật lần cuối ${formatDateTime(d.updatedAt)}. Giá và nguyên liệu cung cấp sửa ở trang chi tiết.`
              : 'Mã nhà cung cấp do hệ thống tự tạo sau khi lưu (NCC…).'
          }
          actions={
            <Button variant="ghost" size="sm" leadingIcon={<ArrowLeft size={15} />} onClick={() => guard(backToList)}>
              {isEdit ? 'Về chi tiết' : 'Về danh sách'}
            </Button>
          }
        />

        {isEdit && detail.isError ? (
          <BlockError message="Không tìm thấy nhà cung cấp" onRetry={() => void detail.refetch()} />
        ) : !loaded ? (
          <Card padded><div className="grid gap-4 sm:grid-cols-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-16" />)}</div></Card>
        ) : (
          <form onSubmit={submit} noValidate className="min-w-0 space-y-4">
            <Card padded>
              <CardHeader title="Thông tin nhà cung cấp" />
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <Field label="Tên nhà cung cấp" htmlFor="s-name" required error={errors.name} className="sm:col-span-2">
                  <TextInput id="s-name" value={form.name} maxLength={150} invalid={Boolean(errors.name)} onChange={(e) => set('name', e.target.value)} placeholder="VD: Hải sản Phú Quốc" />
                </Field>
                <Field label="Số điện thoại" htmlFor="s-phone" required error={errors.phone} hint="Di động hoặc máy bàn (02x…)">
                  <TextInput id="s-phone" inputMode="tel" value={form.phone} maxLength={15} invalid={Boolean(errors.phone)} onChange={(e) => set('phone', e.target.value)} placeholder="0912345678" />
                </Field>
                <Field label="Phương thức thanh toán" htmlFor="s-method" required error={errors.paymentMethod}>
                  <SelectInput
                    id="s-method"
                    value={form.paymentMethod}
                    invalid={Boolean(errors.paymentMethod)}
                    onChange={(e) => set('paymentMethod', e.target.value as PaymentMethod | '')}
                    placeholder="— Chọn phương thức —"
                    options={METHODS.map((m) => ({ value: m, label: PAYMENT_METHOD[m] }))}
                  />
                </Field>
                <Field label="Người liên hệ" htmlFor="s-contact" error={errors.contact}>
                  <TextInput id="s-contact" value={form.contact} maxLength={100} invalid={Boolean(errors.contact)} onChange={(e) => set('contact', e.target.value)} />
                </Field>
                <Field label="Email" htmlFor="s-email" error={errors.email}>
                  <TextInput id="s-email" type="email" value={form.email} maxLength={150} invalid={Boolean(errors.email)} onChange={(e) => set('email', e.target.value)} />
                </Field>
                <Field label="Website" htmlFor="s-web" error={errors.website}>
                  <TextInput id="s-web" value={form.website} maxLength={200} invalid={Boolean(errors.website)} onChange={(e) => set('website', e.target.value)} placeholder="https://" />
                </Field>
                <Field label="Mã số thuế" htmlFor="s-tax" error={errors.taxCode} hint="10 chữ số hoặc dạng 0123456789-001">
                  <TextInput id="s-tax" value={form.taxCode} maxLength={14} invalid={Boolean(errors.taxCode)} onChange={(e) => set('taxCode', e.target.value)} />
                </Field>
                <Field label="Địa chỉ" htmlFor="s-addr" error={errors.address} className="sm:col-span-2">
                  <TextInput id="s-addr" value={form.address} maxLength={300} invalid={Boolean(errors.address)} onChange={(e) => set('address', e.target.value)} />
                </Field>
                <Field label="Ghi chú" htmlFor="s-note" error={errors.note} hint={`${form.note.length}/500 ký tự`} className="sm:col-span-2">
                  <TextArea id="s-note" rows={2} maxLength={500} value={form.note} invalid={Boolean(errors.note)} onChange={(e) => set('note', e.target.value)} placeholder="Giờ giao hàng, điều khoản công nợ…" />
                </Field>
              </div>
            </Card>

            {!isEdit ? (
              <Card className="overflow-hidden">
                <div className="flex flex-wrap items-start justify-between gap-3 p-5 pb-3">
                  <CardHeader
                    title="Nguyên liệu cung cấp"
                    description="Có thể thêm sau ở trang chi tiết. Giá nhập tính cho 1 đơn vị mua; hệ số = số đơn vị kho trong 1 đơn vị mua."
                  />
                  <Button type="button" size="sm" variant="outline" leadingIcon={<Plus size={15} />} onClick={() => setRows((prev) => [...prev, newRow()])}>
                    Thêm dòng
                  </Button>
                </div>
                {rows.length === 0 ? (
                  <p className="px-5 pb-5 text-[13px] text-[var(--text-muted)]">Chưa có dòng nào.</p>
                ) : (
                  <DataTable minWidth={900}>
                    <thead>
                      <tr>
                        <Th>Nguyên liệu</Th>
                        <Th>Đơn vị mua</Th>
                        <Th>Hệ số</Th>
                        <Th>Giá nhập (đ)</Th>
                        <Th>SL tối thiểu</Th>
                        <Th className="text-right"><span className="sr-only">Xóa dòng</span></Th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r, i) => {
                        const unit = unitOf(r.ingredientId);
                        const locked = Boolean(unit) && r.purchaseUnit === unit;
                        const price = parseMoney(r.price);
                        const factor = parseQty(r.factor);
                        return (
                          <tr key={r.key} className="align-top">
                            <Td className="min-w-[240px]">
                              <SelectInput
                                aria-label={`Nguyên liệu dòng ${i + 1}`}
                                value={r.ingredientId}
                                invalid={Boolean(fieldError(i, 'ingredientId'))}
                                onChange={(e) => setRow(i, 'ingredientId', e.target.value)}
                                placeholder="— Chọn nguyên liệu —"
                                options={activeOptions.map((o) => ({ value: o.id, label: `${o.name} (${o.code}) · ${o.unit}` }))}
                              />
                              <RowError text={fieldError(i, 'ingredientId')} />
                            </Td>
                            <Td className="min-w-[120px]">
                              <SelectInput
                                aria-label={`Đơn vị mua dòng ${i + 1}`}
                                value={r.purchaseUnit}
                                invalid={Boolean(fieldError(i, 'purchaseUnit'))}
                                onChange={(e) => setRow(i, 'purchaseUnit', e.target.value)}
                                placeholder="—"
                                options={PURCHASE_UNITS.map((u) => ({ value: u, label: u }))}
                              />
                              <RowError text={fieldError(i, 'purchaseUnit')} />
                            </Td>
                            <Td className="w-[110px]">
                              <TextInput aria-label={`Hệ số dòng ${i + 1}`} inputMode="decimal" value={r.factor} disabled={locked} invalid={Boolean(fieldError(i, 'factor'))} onChange={(e) => setRow(i, 'factor', e.target.value)} />
                              {unit && r.purchaseUnit && factor > 0 && !locked ? (
                                <p className="mt-1 text-[12px] text-[var(--text-muted)]">1 {r.purchaseUnit} = {formatQty(factor)} {unit}</p>
                              ) : null}
                              <RowError text={fieldError(i, 'factor')} />
                            </Td>
                            <Td className="w-[150px]">
                              <TextInput aria-label={`Giá nhập dòng ${i + 1}`} inputMode="numeric" value={r.price} invalid={Boolean(fieldError(i, 'price'))} onChange={(e) => setRow(i, 'price', e.target.value)} />
                              {price > 0 && factor > 0 && unit ? (
                                <p className="mt-1 text-[12px] text-[var(--text-muted)]">= {formatCurrency(price / factor)} / {unit}</p>
                              ) : null}
                              <RowError text={fieldError(i, 'price')} />
                            </Td>
                            <Td className="w-[120px]">
                              <TextInput aria-label={`SL tối thiểu dòng ${i + 1}`} inputMode="decimal" value={r.minOrder} invalid={Boolean(fieldError(i, 'minOrder'))} onChange={(e) => setRow(i, 'minOrder', e.target.value)} placeholder="—" />
                              <RowError text={fieldError(i, 'minOrder')} />
                            </Td>
                            <Td className="text-right">
                              <Button type="button" size="sm" variant="ghost" aria-label={`Xóa dòng ${i + 1}`} onClick={() => removeRow(i)}><Trash2 size={14} /></Button>
                            </Td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </DataTable>
                )}
              </Card>
            ) : null}

            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => guard(backToList)} disabled={mutation.isPending}>Hủy</Button>
              <Button type="submit" loading={mutation.isPending || checking} leadingIcon={<Save size={15} />}>
                {isEdit ? 'Lưu thay đổi' : 'Thêm nhà cung cấp'}
              </Button>
            </div>
          </form>
        )}
      </div>
      {dialog}
      <ConfirmDialog
        open={Boolean(dupName)}
        onOpenChange={(o) => !o && setDupName(null)}
        tone="primary"
        title="Tên nhà cung cấp đã tồn tại?"
        description={dupName ? `Đã có nhà cung cấp “${dupName.name}” (${dupName.code}). Bạn vẫn muốn lưu với tên này?` : null}
        confirmLabel={isEdit ? 'Vẫn lưu' : 'Vẫn thêm'}
        loading={mutation.isPending}
        onConfirm={() => {
          if (!dupName) return;
          const input = dupName.input;
          setDupName(null);
          mutation.mutate(input);
        }}
      />
    </AppShell>
  );
}

function RowError({ text }: { text?: string }) {
  return text ? <p className="mt-1 text-[12px] text-[var(--danger)]">{text}</p> : null;
}

export default SupplierFormPage;
