import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Lock, Save } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { Card, CardHeader } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { BlockError } from '@/components/common/EmptyState';
import { Field, SelectInput, TextArea, TextInput } from '@/components/common/Form';
import { PageHeader } from '@/components/common/PageParts';
import { Skeleton } from '@/components/common/Skeleton';
import { createIngredient, updateIngredient } from '@/api/warehouse-ingredients';
import { useIngredient, wk } from '@/features/warehouse/queries';
import { formatQty, INGREDIENT_GROUP_KEYS, INGREDIENT_GROUPS, STOCK_UNITS } from '@/features/warehouse/labels';
import { InfoItem, isQty, parseMoney, parseQty, useLeaveGuard } from '@/features/warehouse/parts';
import { useApiMutation } from '@/hooks/use-api-mutation';
import { formatCurrency } from '@/lib/format';
import { formatDateTime } from '@/lib/labels';
import type { IngredientGroup, IngredientInput } from '@/types';

interface FormState {
  name: string;
  group: IngredientGroup | '';
  unit: string;
  minLevel: string;
  openingQty: string;
  openingCost: string;
  note: string;
}

const EMPTY: FormState = { name: '', group: '', unit: '', minLevel: '', openingQty: '', openingCost: '', note: '' };

export function IngredientFormPage() {
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const detail = useIngredient(id);

  const [form, setForm] = useState<FormState>(EMPTY);
  const [initial, setInitial] = useState<FormState>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loaded, setLoaded] = useState(!isEdit);

  useEffect(() => {
    setErrors({});
    if (!id) {
      setForm(EMPTY);
      setInitial(EMPTY);
      setLoaded(true);
    } else setLoaded(false);
  }, [id]);

  useEffect(() => {
    const d = detail.data;
    if (isEdit && d && d.id === id && !loaded) {
      const state: FormState = { name: d.name, group: d.group, unit: d.unit, minLevel: String(d.minLevel), openingQty: '', openingCost: '', note: d.note };
      setForm(state);
      setInitial(state);
      setLoaded(true);
    }
  }, [detail.data, isEdit, loaded, id]);

  const dirty = useMemo(() => JSON.stringify(form) !== JSON.stringify(initial), [form, initial]);
  const { guard, dialog } = useLeaveGuard(dirty);
  const backToList = () => navigate('/kho/nguyen-lieu');

  const mutation = useApiMutation((input: IngredientInput) => (id ? updateIngredient(id, input) : createIngredient(input)), {
    invalidate: [wk.all],
    success: (it) => (isEdit ? `Đã cập nhật nguyên liệu ${it.name}` : `Đã thêm nguyên liệu ${it.name} (${it.code})`),
    onFieldErrors: setErrors,
    onSuccess: backToList,
  });

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: '' }));
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isEdit && !dirty) {
      backToList();
      return;
    }
    const local: Record<string, string> = {};
    if (!form.name.trim()) local.name = 'Vui lòng nhập tên nguyên liệu';
    if (!form.group) local.group = 'Vui lòng chọn nhóm nguyên liệu';
    if (!form.unit) local.unit = 'Vui lòng chọn đơn vị kho';
    const minLevel = form.minLevel.trim() === '' ? 0 : parseQty(form.minLevel);
    if (!isQty(minLevel)) local.minLevel = 'Số lượng phải là số không âm, tối đa 3 chữ số thập phân';
    const openingQty = form.openingQty.trim() === '' ? 0 : parseQty(form.openingQty);
    let openingCost: number | null = null;
    if (!isEdit) {
      if (!isQty(openingQty)) local.openingQty = 'Số lượng phải là số không âm, tối đa 3 chữ số thập phân';
      else if (openingQty > 0) {
        openingCost = parseMoney(form.openingCost);
        if (!(openingCost > 0)) local.openingCost = 'Vui lòng nhập giá vốn ban đầu lớn hơn 0';
      }
    }
    if (Object.keys(local).length) {
      setErrors(local);
      return;
    }
    mutation.mutate({
      name: form.name,
      group: form.group,
      unit: form.unit,
      minLevel,
      note: form.note,
      ...(isEdit ? {} : { openingQty, openingCost }),
    });
  };

  const title = isEdit ? 'Cập nhật nguyên liệu' : 'Thêm nguyên liệu';
  const d = detail.data;
  const unitLocked = Boolean(isEdit && d?.unitLocked);

  return (
    <AppShell meta={{ label: title, parent: 'Quản lý nguyên liệu' }}>
      <div className="min-w-0 space-y-4">
        <PageHeader
          title={title}
          description={
            isEdit && d
              ? `Mã ${d.code} · cập nhật lần cuối ${formatDateTime(d.updatedAt)}. Tồn kho và giá vốn chỉ thay đổi qua nhập, xuất, kiểm kê.`
              : 'Mã nguyên liệu do hệ thống tự tạo sau khi lưu (NL…).'
          }
          actions={
            <Button variant="ghost" size="sm" leadingIcon={<ArrowLeft size={15} />} onClick={() => guard(backToList)}>
              Về danh sách
            </Button>
          }
        />

        {isEdit && detail.isError ? (
          <BlockError message="Không tìm thấy nguyên liệu" onRetry={() => void detail.refetch()} />
        ) : !loaded ? (
          <Card padded><div className="grid gap-4 sm:grid-cols-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-16" />)}</div></Card>
        ) : (
          <form onSubmit={submit} noValidate className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
            <div className="min-w-0 space-y-4">
              <Card padded>
                <CardHeader title="Thông tin nguyên liệu" />
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <Field label="Tên nguyên liệu" htmlFor="i-name" required error={errors.name} className="sm:col-span-2">
                    <TextInput id="i-name" value={form.name} maxLength={100} invalid={Boolean(errors.name)} onChange={(e) => set('name', e.target.value)} placeholder="VD: Tôm sú tươi" />
                  </Field>
                  <Field label="Nhóm nguyên liệu" htmlFor="i-group" required error={errors.group}>
                    <SelectInput
                      id="i-group"
                      value={form.group}
                      invalid={Boolean(errors.group)}
                      onChange={(e) => set('group', e.target.value as IngredientGroup | '')}
                      placeholder="— Chọn nhóm —"
                      options={INGREDIENT_GROUP_KEYS.map((g) => ({ value: g, label: INGREDIENT_GROUPS[g] }))}
                    />
                  </Field>
                  <Field
                    label="Đơn vị kho"
                    htmlFor="i-unit"
                    required
                    error={errors.unit}
                    hint={
                      unitLocked ? (
                        <span className="inline-flex items-center gap-1"><Lock size={12} /> Không đổi được vì nguyên liệu đã có giao dịch kho, phiếu mua hoặc liên kết nhà cung cấp</span>
                      ) : (
                        'Đơn vị dùng khi xuất và đếm (lon, kg, quả…). Đơn vị mua khai báo theo từng nhà cung cấp.'
                      )
                    }
                  >
                    <SelectInput
                      id="i-unit"
                      value={form.unit}
                      disabled={unitLocked}
                      invalid={Boolean(errors.unit)}
                      onChange={(e) => set('unit', e.target.value)}
                      placeholder="— Chọn đơn vị —"
                      options={STOCK_UNITS.map((u) => ({ value: u, label: u }))}
                    />
                  </Field>
                  <Field label="Tồn tối thiểu" htmlFor="i-min" error={errors.minLevel} hint="Để trống hoặc 0: không cảnh báo sắp hết">
                    <TextInput id="i-min" inputMode="decimal" value={form.minLevel} invalid={Boolean(errors.minLevel)} onChange={(e) => set('minLevel', e.target.value)} placeholder="0" />
                  </Field>
                  <Field label="Ghi chú" htmlFor="i-note" error={errors.note} hint={`${form.note.length}/300 ký tự`} className="sm:col-span-2">
                    <TextArea id="i-note" rows={2} maxLength={300} value={form.note} invalid={Boolean(errors.note)} onChange={(e) => set('note', e.target.value)} placeholder="Quy cách, cách bảo quản…" />
                  </Field>
                </div>
              </Card>

              {!isEdit ? (
                <Card padded>
                  <CardHeader title="Tồn ban đầu" description="Chỉ nhập khi kho đang có sẵn nguyên liệu này. Hệ thống tạo phiếu nhập “Tồn đầu kỳ”." />
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <Field label={`Tồn ban đầu${form.unit ? ` (${form.unit})` : ''}`} htmlFor="i-oqty" error={errors.openingQty} hint="Mặc định 0">
                      <TextInput id="i-oqty" inputMode="decimal" value={form.openingQty} invalid={Boolean(errors.openingQty)} onChange={(e) => set('openingQty', e.target.value)} placeholder="0" />
                    </Field>
                    <Field
                      label={`Giá vốn ban đầu (đ / ${form.unit || 'đơn vị kho'})`}
                      htmlFor="i-ocost"
                      required={parseQty(form.openingQty) > 0}
                      error={errors.openingCost}
                      hint={parseMoney(form.openingCost) > 0 ? formatCurrency(parseMoney(form.openingCost)) : 'Bắt buộc khi tồn ban đầu > 0'}
                    >
                      <TextInput id="i-ocost" inputMode="numeric" value={form.openingCost} invalid={Boolean(errors.openingCost)} onChange={(e) => set('openingCost', e.target.value)} placeholder="VD: 280000" />
                    </Field>
                  </div>
                </Card>
              ) : null}
            </div>

            <div className="min-w-0 space-y-4">
              {isEdit && d ? (
                <Card padded>
                  <CardHeader title="Tồn kho hiện tại" />
                  <div className="mt-3 grid gap-3">
                    <InfoItem label="Mã nguyên liệu"><span className="font-mono font-semibold">{d.code}</span></InfoItem>
                    <InfoItem label="Tồn hiện tại"><span className="font-mono">{formatQty(d.onHand, d.unit)}</span></InfoItem>
                    <InfoItem label="Giá vốn bình quân"><span className="font-mono">{d.avgCost === null ? 'Chưa có' : `${formatCurrency(d.avgCost)} / ${d.unit}`}</span></InfoItem>
                  </div>
                </Card>
              ) : null}
              <div className="flex gap-2 lg:flex-col">
                <Button type="submit" loading={mutation.isPending} leadingIcon={<Save size={15} />} className="flex-1 lg:flex-none">
                  {isEdit ? 'Lưu thay đổi' : 'Thêm nguyên liệu'}
                </Button>
                <Button variant="ghost" onClick={() => guard(backToList)} disabled={mutation.isPending} className="flex-1 lg:flex-none">
                  Hủy
                </Button>
              </div>
            </div>
          </form>
        )}
      </div>
      {dialog}
    </AppShell>
  );
}

export default IngredientFormPage;
