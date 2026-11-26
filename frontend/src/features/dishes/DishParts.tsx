import { useEffect, useState } from 'react';
import { Flame, Pencil, UtensilsCrossed } from 'lucide-react';
import { Badge } from '@/components/common/Badge';
import { Button } from '@/components/common/Button';
import { Modal } from '@/components/common/Modal';
import { DetailRow } from '@/components/common/PageParts';
import { formatCurrency } from '@/lib/format';
import { DISH_STATUS, SPICY_LEVELS, formatDateTime } from '@/lib/labels';
import type { Dish } from '@/types';

export function DishThumb({ dish, size = 44 }: { dish: Pick<Dish, 'image' | 'name'>; size?: number }) {
  // Ảnh lỗi (file đã mất…) thì hiện biểu tượng đĩa thay vì chữ thay thế bị cắt.
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [dish.image]);
  return dish.image && !broken ? (
    <img src={dish.image} alt={dish.name} onError={() => setBroken(true)} className="shrink-0 rounded-[10px] object-cover" style={{ width: size, height: size }} />
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
