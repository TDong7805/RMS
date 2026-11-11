import { useEffect, useState } from 'react';
import { Flame, Pencil, Plus, UtensilsCrossed } from 'lucide-react';
import { Badge } from '@/components/common/Badge';
import { Button } from '@/components/common/Button';
import { Field, TextInput, Toggle } from '@/components/common/Form';
import { Modal } from '@/components/common/Modal';
import { DetailRow } from '@/components/common/PageParts';
import { saveCategory } from '@/api/dishes';
import { qk, useCategories } from '@/features/management/queries';
import { useApiMutation } from '@/hooks/use-api-mutation';
import { cn } from '@/lib/cn';
import { formatCurrency } from '@/lib/format';
import { DISH_STATUS, SPICY_LEVELS, formatDateTime } from '@/lib/labels';
import type { Dish } from '@/types';

export function DishThumb({ dish, size = 44 }: { dish: Pick<Dish, 'image' | 'name'>; size?: number }) {
  return dish.image ? (
    <img src={dish.image} alt={dish.name} className="shrink-0 rounded-[10px] object-cover" style={{ width: size, height: size }} />
  ) : (
    <span
      className="grid shrink-0 place-items-center rounded-[10px] bg-[var(--accent-soft)] text-[var(--accent)]"
      style={{ width: size, height: size }}
      aria-hidden
    >
      <UtensilsCrossed size={size * 0.42} strokeWidth={1.6} />
    </span>
  );
}

export function SpicyMeter({ level }: { level: number }) {
  return (
    <span className="inline-flex items-center gap-1" title={SPICY_LEVELS[level]}>
      {[1, 2, 3].map((i) => (
        <Flame key={i} size={13} className={i <= level ? 'text-[var(--danger)]' : 'text-[var(--border-strong)]'} fill={i <= level ? 'currentColor' : 'none'} />
      ))}
      <span className="ml-1 text-[12.5px] text-[var(--text-secondary)]">{SPICY_LEVELS[level]}</span>
    </span>
  );
}

export function DishDetailModal({
  dish,
  categoryName,
  open,
  onOpenChange,
  onEdit,
}: {
  dish: Dish | null;
  categoryName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (dish: Dish) => void;
}) {
  if (!dish) return null;
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      size="md"
      title={dish.name}
      description={`Mã món ${dish.code} · ${categoryName}`}
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Đóng</Button>
          <Button leadingIcon={<Pencil size={15} />} onClick={() => onEdit(dish)}>Chỉnh sửa</Button>
        </>
      }
    >
      <div className="mb-3 flex items-center gap-4">
        <DishThumb dish={dish} size={96} />
        <div>
          <p className="font-mono text-[22px] font-bold text-[var(--accent)]">{formatCurrency(dish.price)}</p>
          <Badge variant={DISH_STATUS[dish.status].variant}>{DISH_STATUS[dish.status].label}</Badge>
          <p className="mt-1 text-[12px] text-[var(--text-muted)]">Đổi trạng thái lúc {formatDateTime(dish.statusUpdatedAt)}</p>
        </div>
      </div>
      <dl>
        <DetailRow label="Mô tả">{dish.description || <Muted>Chưa có mô tả</Muted>}</DetailRow>
        <DetailRow label="Thành phần">{dish.ingredients || <Muted>Chưa khai báo — AI sẽ không khẳng định thành phần</Muted>}</DetailRow>
        <DetailRow label="Dị nguyên">
          {dish.allergens.length ? (
            <span className="flex flex-wrap gap-1">{dish.allergens.map((a) => <Badge key={a} variant="warning">{a}</Badge>)}</span>
          ) : (
            <Muted>Không khai báo</Muted>
          )}
        </DetailRow>
        <DetailRow label="Mức cay"><SpicyMeter level={dish.spicyLevel} /></DetailRow>
        <DetailRow label="Giao dịch">{dish.usedInOrders ? 'Đã phát sinh trong đơn hàng (không thể xóa)' : 'Chưa phát sinh giao dịch'}</DetailRow>
        <DetailRow label="Cập nhật">{formatDateTime(dish.updatedAt)}</DetailRow>
      </dl>
    </Modal>
  );
}

function Muted({ children }: { children: React.ReactNode }) {
  return <span className="text-[var(--text-muted)]">{children}</span>;
}

/** Màn hình quản lý danh mục món (luồng 3c). */
export function CategoryModal({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { data: categories = [] } = useCategories();
  const [editing, setEditing] = useState<{ id?: string; name: string; active: boolean } | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) setEditing(null);
  }, [open]);

  const mutation = useApiMutation(saveCategory, {
    invalidate: [qk.categories, qk.dishes],
    success: (c, v) => (v.id ? `Đã cập nhật danh mục ${c.name}` : `Đã thêm danh mục ${c.name}`),
    onFieldErrors: (f) => setError(f.name ?? ''),
    onSuccess: () => setEditing(null),
  });

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      size="md"
      title="Danh mục món"
      description="Danh mục ngừng hoạt động sẽ không được chọn khi thêm món mới."
      footer={<Button variant="ghost" onClick={() => onOpenChange(false)}>Đóng</Button>}
    >
      <ul className="divide-y divide-[var(--border)] rounded-item border border-[var(--border)]">
        {categories.map((c) => (
          <li key={c.id} className="flex items-center gap-3 px-3 py-2.5">
            {editing?.id === c.id ? (
              <CategoryEditor editing={editing} setEditing={setEditing} error={error} setError={setError} saving={mutation.isPending} onSave={() => mutation.mutate(editing)} />
            ) : (
              <>
                <div className="min-w-0 flex-1">
                  <p className={cn('text-[14px] font-semibold', !c.active && 'text-[var(--text-muted)]')}>{c.name}</p>
                  <p className="text-[12px] text-[var(--text-muted)]">{c.dishCount} món · {c.active ? 'Đang hoạt động' : 'Ngừng hoạt động'}</p>
                </div>
                <Toggle
                  checked={c.active}
                  label={`Bật/tắt danh mục ${c.name}`}
                  disabled={mutation.isPending}
                  onChange={(active) => mutation.mutate({ id: c.id, name: c.name, active })}
                />
                <Button size="sm" variant="ghost" aria-label={`Sửa ${c.name}`} onClick={() => { setError(''); setEditing({ id: c.id, name: c.name, active: c.active }); }}>
                  <Pencil size={14} />
                </Button>
              </>
            )}
          </li>
        ))}
        {editing && !editing.id ? (
          <li className="flex items-center gap-3 px-3 py-2.5">
            <CategoryEditor editing={editing} setEditing={setEditing} error={error} setError={setError} saving={mutation.isPending} onSave={() => mutation.mutate(editing)} />
          </li>
        ) : null}
      </ul>
      {!editing ? (
        <Button className="mt-3" variant="outline" size="sm" leadingIcon={<Plus size={14} />} onClick={() => { setError(''); setEditing({ name: '', active: true }); }}>
          Thêm danh mục
        </Button>
      ) : null}
    </Modal>
  );
}

function CategoryEditor({
  editing,
  setEditing,
  error,
  setError,
  saving,
  onSave,
}: {
  editing: { id?: string; name: string; active: boolean };
  setEditing: (v: { id?: string; name: string; active: boolean } | null) => void;
  error: string;
  setError: (v: string) => void;
  saving: boolean;
  onSave: () => void;
}) {
  return (
    <form
      className="flex w-full flex-wrap items-start gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        onSave();
      }}
    >
      <Field label="Tên danh mục" htmlFor="cat-name" error={error} className="min-w-[200px] flex-1">
        <TextInput id="cat-name" autoFocus value={editing.name} maxLength={50} invalid={Boolean(error)} onChange={(e) => { setError(''); setEditing({ ...editing, name: e.target.value }); }} />
      </Field>
      <div className="flex gap-1.5 pt-[26px]">
        <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>Hủy</Button>
        <Button size="sm" type="submit" loading={saving}>Lưu</Button>
      </div>
    </form>
  );
}
