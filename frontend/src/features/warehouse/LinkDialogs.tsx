import { useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/common/Badge';
import { Button } from '@/components/common/Button';
import { EmptyState } from '@/components/common/EmptyState';
import { Field, SelectInput, TextInput } from '@/components/common/Form';
import { ConfirmDialog, Modal } from '@/components/common/Modal';
import { DataTable, TableSkeleton, Td, Th } from '@/components/common/PageParts';
import { addLink, reactivateLink, stopLink, updateLink } from '@/api/warehouse-suppliers';
import { useApiMutation } from '@/hooks/use-api-mutation';
import { formatCurrency } from '@/lib/format';
import { formatDateOnly, formatDateTime } from '@/lib/labels';
import { formatQty, formatSpec, PRICE_CHANGE, PURCHASE_UNITS } from './labels';
import { parseMoney, parseQty } from './parts';
import { useIngredientOptions, usePriceHistory, wk } from './queries';
import type { SupplierLink, SupplierLinkInput } from '@/types';

export type LinkDialogMode = 'add' | 'edit' | 'reactivate';

interface LinkFormDialogProps {
  mode: LinkDialogMode;
  open: boolean;
  supplierId: string;
  /** Liên kết đang sửa / kích hoạt lại (không có khi thêm). */
  link: SupplierLink | null;
  /** Nguyên liệu đã có liên kết với nhà cung cấp này (không hiện khi thêm). */
  linkedIngredientIds: string[];
  onClose: () => void;
}

interface FormState {
  ingredientId: string;
  purchaseUnit: string;
  factor: string;
  price: string;
  minOrder: string;
}

const TITLES: Record<LinkDialogMode, string> = {
  add: 'Thêm nguyên liệu cung cấp',
  edit: 'Sửa giá, quy cách hoặc SL tối thiểu',
  reactivate: 'Kích hoạt lại liên kết',
};

/** Hộp thoại nhỏ: Hủy / ✕ đóng ngay, không hỏi (quy ước chung). Mỗi thao tác lưu ngay khi xác nhận. */
export function LinkFormDialog({ mode, open, supplierId, link, linkedIngredientIds, onClose }: LinkFormDialogProps) {
  const { data: options = [] } = useIngredientOptions();
  const [form, setForm] = useState<FormState>({ ingredientId: '', purchaseUnit: '', factor: '1', price: '', minOrder: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [bigChange, setBigChange] = useState<{ input: SupplierLinkInput; percent: number; oldUnit: number; newUnit: number } | null>(null);

  useEffect(() => {
    if (!open) return;
    setErrors({});
    setBigChange(null);
    if (mode === 'add' || !link) setForm({ ingredientId: '', purchaseUnit: '', factor: '1', price: '', minOrder: '' });
    else
      setForm({
        ingredientId: link.ingredientId,
        purchaseUnit: link.purchaseUnit,
        factor: String(link.factor),
        price: mode === 'reactivate' ? '' : String(link.price),
        minOrder: link.minOrder === null ? '' : String(link.minOrder),
      });
  }, [open, mode, link]);

  const ingredient = options.find((o) => o.id === form.ingredientId);
  const stockUnit = link?.stockUnit ?? ingredient?.unit ?? '';
  const factorLocked = Boolean(stockUnit) && form.purchaseUnit === stockUnit;
  const choices = useMemo(
    () => options.filter((o) => o.active && !linkedIngredientIds.includes(o.id)),
    [options, linkedIngredientIds],
  );

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      // Đơn vị mua trùng đơn vị kho thì hệ số = 1 (khóa ô).
      const unit = key === 'ingredientId' ? options.find((o) => o.id === value)?.unit ?? stockUnit : stockUnit;
      if ((key === 'purchaseUnit' || key === 'ingredientId') && unit && next.purchaseUnit === unit) next.factor = '1';
      if (key === 'ingredientId' && !prev.purchaseUnit && unit) next.purchaseUnit = unit;
      return next;
    });
    setErrors((prev) => ({ ...prev, [key]: '' }));
  };

  const name = link?.ingredientName ?? ingredient?.name ?? '';
  const mutation = useApiMutation(
    (input: SupplierLinkInput) =>
      mode === 'add' ? addLink(supplierId, input) : mode === 'edit' ? updateLink(link!.id, input) : reactivateLink(link!.id, input),
    {
      invalidate: [wk.all],
      success: (l) =>
        mode === 'add'
          ? `Đã thêm ${l.ingredientName} vào danh sách cung cấp`
          : mode === 'edit'
            ? `Đã cập nhật liên kết ${l.ingredientName}`
            : `Đã kích hoạt lại liên kết ${l.ingredientName}`,
      onFieldErrors: setErrors,
      onSuccess: onClose,
    },
  );

  const price = parseMoney(form.price);
  const factor = parseQty(form.factor);
  const unitPrice = price > 0 && factor > 0 ? price / factor : null;

  const submit = () => {
    const local: Record<string, string> = {};
    if (!form.ingredientId) local.ingredientId = 'Vui lòng chọn nguyên liệu';
    if (!form.purchaseUnit) local.purchaseUnit = 'Vui lòng chọn đơn vị mua';
    if (!(factor > 0)) local.factor = 'Hệ số quy đổi phải lớn hơn 0';
    if (!(price > 0)) local.price = 'Giá nhập phải lớn hơn 0';
    const minOrder = form.minOrder.trim() === '' ? null : parseQty(form.minOrder);
    if (minOrder !== null && !(minOrder > 0)) local.minOrder = 'Số lượng tối thiểu phải là số dương';
    if (Object.keys(local).length) {
      setErrors(local);
      return;
    }
    const input: SupplierLinkInput = { ingredientId: form.ingredientId, purchaseUnit: form.purchaseUnit, factor, price, minOrder };
    if (mode === 'edit' && link) {
      // A2a: không đổi gì thì đóng hộp, không tạo bản ghi.
      if (input.price === link.price && input.purchaseUnit === link.purchaseUnit && input.factor === link.factor && input.minOrder === link.minOrder) {
        onClose();
        return;
      }
    }
    if (mode !== 'add' && link) {
      // A2b: giá quy ra 1 đơn vị kho chênh từ 50% → hỏi lại.
      const oldUnit = link.price / link.factor;
      const newUnit = price / factor;
      const percent = Math.round((Math.abs(newUnit - oldUnit) / oldUnit) * 100);
      if (percent >= 50) {
        setBigChange({ input, percent, oldUnit, newUnit });
        return;
      }
    }
    mutation.mutate(input);
  };

  return (
    <>
      <Modal
        open={open}
        onOpenChange={(o) => !o && onClose()}
        title={TITLES[mode]}
        description={mode === 'add' ? 'Mỗi thao tác được lưu ngay. Giá nhập tính cho 1 đơn vị mua.' : name}
        footer={
          <>
            <Button variant="ghost" onClick={onClose} disabled={mutation.isPending}>Hủy</Button>
            <Button onClick={submit} loading={mutation.isPending}>{mode === 'add' ? 'Thêm' : mode === 'edit' ? 'Lưu thay đổi' : 'Kích hoạt lại'}</Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          {mode === 'add' ? (
            <Field label="Nguyên liệu" htmlFor="lk-ing" required error={errors.ingredientId} className="sm:col-span-2" hint={choices.length === 0 ? 'Mọi nguyên liệu đang sử dụng đều đã có trong danh sách cung cấp.' : undefined}>
              <SelectInput
                id="lk-ing"
                value={form.ingredientId}
                invalid={Boolean(errors.ingredientId)}
                onChange={(e) => set('ingredientId', e.target.value)}
                placeholder="— Chọn nguyên liệu —"
                options={choices.map((o) => ({ value: o.id, label: `${o.name} (${o.code}) · ${o.unit}` }))}
              />
            </Field>
          ) : null}
          <Field label="Đơn vị mua" htmlFor="lk-unit" required error={errors.purchaseUnit} hint={stockUnit ? `Đơn vị kho: ${stockUnit}` : undefined}>
            <SelectInput
              id="lk-unit"
              value={form.purchaseUnit}
              invalid={Boolean(errors.purchaseUnit)}
              onChange={(e) => set('purchaseUnit', e.target.value)}
              placeholder="— Chọn đơn vị —"
              options={PURCHASE_UNITS.map((u) => ({ value: u, label: u }))}
            />
          </Field>
          <Field
            label="Hệ số quy đổi"
            htmlFor="lk-factor"
            required
            error={errors.factor}
            hint={factorLocked ? 'Đơn vị mua trùng đơn vị kho nên hệ số = 1' : form.purchaseUnit && stockUnit && factor > 0 ? `1 ${form.purchaseUnit} = ${formatQty(factor)} ${stockUnit}` : '1 đơn vị mua bằng bao nhiêu đơn vị kho'}
          >
            <TextInput id="lk-factor" inputMode="decimal" value={form.factor} disabled={factorLocked} invalid={Boolean(errors.factor)} onChange={(e) => set('factor', e.target.value)} />
          </Field>
          <Field
            label={`Giá nhập (đ / ${form.purchaseUnit || 'đơn vị mua'})`}
            htmlFor="lk-price"
            required
            error={errors.price}
            hint={unitPrice !== null && stockUnit ? `= ${formatCurrency(unitPrice)} / ${stockUnit}` : mode === 'reactivate' ? 'Nhập giá mới, không tự lấy lại giá cũ' : undefined}
          >
            <TextInput id="lk-price" inputMode="numeric" value={form.price} invalid={Boolean(errors.price)} onChange={(e) => set('price', e.target.value)} placeholder="VD: 240000" />
          </Field>
          <Field label={`SL đặt tối thiểu (${form.purchaseUnit || 'đơn vị mua'})`} htmlFor="lk-min" error={errors.minOrder} hint="Để trống: không yêu cầu">
            <TextInput id="lk-min" inputMode="decimal" value={form.minOrder} invalid={Boolean(errors.minOrder)} onChange={(e) => set('minOrder', e.target.value)} />
          </Field>
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(bigChange)}
        onOpenChange={(o) => !o && setBigChange(null)}
        tone="primary"
        title="Giá nhập thay đổi lớn?"
        description={
          bigChange
            ? `Giá mới ${formatCurrency(bigChange.newUnit)}/${stockUnit} chênh ${bigChange.percent}% so với giá hiện hành ${formatCurrency(bigChange.oldUnit)}/${stockUnit}.`
            : null
        }
        confirmLabel="Vẫn lưu"
        loading={mutation.isPending}
        onConfirm={() => {
          if (!bigChange) return;
          const input = bigChange.input;
          setBigChange(null);
          mutation.mutate(input);
        }}
      />
    </>
  );
}

/** UC-KHO-11 (B): Ngừng liên kết — giá hiện hành kết thúc hôm nay. */
export function LinkStopDialog({ link, supplierName, onClose }: { link: SupplierLink | null; supplierName: string; onClose: () => void }) {
  const mutation = useApiMutation((l: SupplierLink) => stopLink(l.id), {
    invalidate: [wk.all],
    success: (l) => `Đã ngừng liên kết ${l.ingredientName}`,
    onSuccess: onClose,
  });
  return (
    <ConfirmDialog
      open={Boolean(link)}
      onOpenChange={(o) => !o && onClose()}
      tone="primary"
      title="Ngừng cung cấp nguyên liệu?"
      description={`${link?.ingredientName} từ ${supplierName} sẽ không được chọn cho phiếu mua mới. Lịch sử giá được giữ lại.`}
      confirmLabel="Ngừng"
      loading={mutation.isPending}
      onConfirm={() => link && mutation.mutate(link)}
    />
  );
}

/** UC-KHO-11 (D): Lịch sử giá nhập — mới nhất trước. */
export function PriceHistoryDialog({ link, onClose }: { link: SupplierLink | null; onClose: () => void }) {
  const history = usePriceHistory(link?.id ?? null);
  return (
    <Modal open={Boolean(link)} onOpenChange={(o) => !o && onClose()} size="lg" title="Lịch sử giá nhập" description={link ? `${link.ingredientName} (${link.ingredientCode})` : undefined}>
      {history.isLoading || !history.data ? (
        <TableSkeleton cols={6} rows={3} />
      ) : history.data.length === 0 ? (
        <EmptyState title="Chưa có bản ghi giá" />
      ) : (
        <div className="-mx-5 sm:-mx-6">
          <DataTable minWidth={720}>
            <thead>
              <tr>
                <Th className="text-right">Giá nhập</Th>
                <Th>Quy cách</Th>
                <Th className="text-right">SL tối thiểu</Th>
                <Th>Áp dụng</Th>
                <Th>Loại thay đổi</Th>
                <Th>Người thực hiện</Th>
              </tr>
            </thead>
            <tbody>
              {history.data.map((p) => (
                <tr key={p.id}>
                  <Td className="text-right font-mono font-semibold">{formatCurrency(p.price)} / {p.purchaseUnit}</Td>
                  <Td>{link ? formatSpec(p.purchaseUnit, p.factor, link.stockUnit) : p.purchaseUnit}</Td>
                  <Td className="text-right font-mono">{p.minOrder === null ? '—' : formatQty(p.minOrder, p.purchaseUnit)}</Td>
                  <Td className="whitespace-nowrap text-[13px]">
                    {formatDateOnly(p.from)} → {p.to ? formatDateOnly(p.to) : <Badge variant="accent">đang áp dụng</Badge>}
                  </Td>
                  <Td>{PRICE_CHANGE[p.change]}</Td>
                  <Td className="text-[13px]">{p.by}<p className="text-[12px] text-[var(--text-muted)]">{formatDateTime(p.at)}</p></Td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        </div>
      )}
    </Modal>
  );
}
