import { ConfirmDialog } from '@/components/common/Modal';
import { deleteIngredient, setIngredientStatus } from '@/api/warehouse-ingredients';
import { useApiMutation } from '@/hooks/use-api-mutation';
import { wk } from './queries';
import type { Ingredient } from '@/types';

interface DialogProps {
  target: Ingredient | null;
  onClose: () => void;
  onDone?: () => void;
}

/** UC-KHO-05: Ngừng sử dụng / Sử dụng lại (kèm cảnh báo phiếu mua chưa nhận đủ, công thức món). */
export function IngredientStatusDialog({ target, onClose, onDone }: DialogProps) {
  const mutation = useApiMutation((it: Ingredient) => setIngredientStatus(it.id, it.status === 'active' ? 'inactive' : 'active'), {
    invalidate: [wk.all],
    success: (it) => (it.status === 'inactive' ? `Đã ngừng sử dụng nguyên liệu ${it.name}` : `Đã sử dụng lại nguyên liệu ${it.name}`),
    onSuccess: () => {
      onClose();
      onDone?.();
    },
  });
  const stopping = target?.status === 'active';

  return (
    <ConfirmDialog
      open={Boolean(target)}
      onOpenChange={(o) => !o && onClose()}
      tone="primary"
      title={stopping ? 'Ngừng sử dụng nguyên liệu?' : 'Sử dụng lại nguyên liệu?'}
      description={
        target ? (
          stopping ? (
            <>
              <p>
                “{target.name}” ({target.code}) sẽ không được chọn khi lập phiếu mua, nhập kho hay thêm vào danh sách cung cấp của nhà cung cấp.
                Phần tồn còn lại vẫn xuất kho và kiểm kê được.
              </p>
              {target.openPurchaseCount > 0 ? (
                <p className="mt-2 rounded-item bg-[var(--warning-soft)] px-3 py-2 text-[13px] text-[var(--text-primary)]">
                  Nguyên liệu đang có trong {target.openPurchaseCount} phiếu mua chưa nhận đủ hàng. Các phiếu này vẫn được nhận hàng bình thường.
                </p>
              ) : null}
              {target.dishNames.length > 0 ? (
                <p className="mt-2 rounded-item bg-[var(--warning-soft)] px-3 py-2 text-[13px] text-[var(--text-primary)]">
                  Nguyên liệu đang được dùng trong công thức của {target.dishNames.length} món: {target.dishNames.join(', ')}. Hãy báo Quản lý nhà hàng cập nhật công thức nếu cần.
                </p>
              ) : null}
            </>
          ) : (
            `“${target.name}” sẽ được chọn lại khi lập phiếu mua và nhập kho. Các liên kết nhà cung cấp đang ngừng vẫn giữ nguyên.`
          )
        ) : null
      }
      confirmLabel={stopping ? 'Ngừng sử dụng' : 'Sử dụng lại'}
      loading={mutation.isPending}
      onConfirm={() => target && mutation.mutate(target)}
    />
  );
}

/** UC-KHO-05 (B): Xóa nguyên liệu chưa phát sinh dữ liệu. */
export function IngredientDeleteDialog({ target, onClose, onDone }: DialogProps) {
  const mutation = useApiMutation((it: Ingredient) => deleteIngredient(it.id), {
    invalidate: [wk.all],
    success: (_r, it) => `Đã xóa nguyên liệu ${it.name}`,
    onSuccess: () => {
      onClose();
      onDone?.();
    },
  });

  return (
    <ConfirmDialog
      open={Boolean(target)}
      onOpenChange={(o) => !o && onClose()}
      title="Xóa nguyên liệu?"
      description={`“${target?.name}” (${target?.code}) sẽ bị xóa khỏi hệ thống. Thao tác này không thể hoàn tác.`}
      confirmLabel="Xóa nguyên liệu"
      loading={mutation.isPending}
      onConfirm={() => target && mutation.mutate(target)}
    />
  );
}
