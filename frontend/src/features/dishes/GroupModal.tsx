import { useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/common/Button';
import { EmptyState } from '@/components/common/EmptyState';
import { Field, ImageUpload, SelectInput, TextArea, TextInput } from '@/components/common/Form';
import { ConfirmDialog, Modal } from '@/components/common/Modal';
import { deleteDishGroup, saveDishGroup } from '@/api/dishes';
import { qk, useCategories, useDishGroups } from '@/features/management/queries';
import { useApiMutation } from '@/hooks/use-api-mutation';
import type { DishGroup, DishGroupInput } from '@/types';

/**
 * Nhóm món: gộp nhiều món cùng loại (vd. Coca-Cola, Sprite… → "Nước ngọt có ga") thành một thẻ trên trang gọi món;
 * khách bấm thẻ rồi chọn loại. Mỗi loại vẫn là món riêng (giá, công thức, tồn kho riêng). Gắn món vào nhóm ở form món.
 */
export function GroupModal({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { data: groups = [], isLoading } = useDishGroups();
  const { data: categories = [] } = useCategories();
  const [editing, setEditing] = useState<DishGroup | 'new' | null>(null);
  const [form, setForm] = useState<DishGroupInput>({ name: '', categoryId: '', description: '', image: null });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [toDelete, setToDelete] = useState<DishGroup | null>(null);
  const catName = new Map(categories.map((c) => [c.id, c.name]));

  const start = (g: DishGroup | 'new') => {
    setEditing(g);
    setErrors({});
    setForm(g === 'new' ? { name: '', categoryId: '', description: '', image: null } : { name: g.name, categoryId: g.categoryId, description: g.description, image: g.image });
  };
  const save = useApiMutation((input: DishGroupInput) => saveDishGroup(editing && editing !== 'new' ? editing.id : null, input), {
    invalidate: [qk.dishGroups, qk.dishes],
    success: (g) => `Đã lưu nhóm ${g.name}`,
    onFieldErrors: setErrors,
    onSuccess: () => setEditing(null),
  });
  const del = useApiMutation((g: DishGroup) => deleteDishGroup(g.id), {
    invalidate: [qk.dishGroups, qk.dishes],
    success: (_r, g) => `Đã xóa nhóm ${g.name}`,
    onSuccess: () => setToDelete(null),
  });
  const submit = () => {
    const old = editing && editing !== 'new' ? editing.image : null;
    save.mutate({ ...form, image: form.image === null && old ? '' : form.image });
  };

  return (
    <>
      <Modal
        open={open}
        onOpenChange={(o) => { if (!o) setEditing(null); onOpenChange(o); }}
        size="md"
        title="Nhóm món"
        description="Gộp nhiều món cùng loại thành một thẻ trên trang gọi món; khách bấm thẻ rồi chọn loại. Gắn món vào nhóm trong form sửa món."
        footer={editing ? (
          <>
            <Button variant="ghost" onClick={() => setEditing(null)}>Quay lại</Button>
            <Button loading={save.isPending} onClick={submit}>Lưu nhóm</Button>
          </>
        ) : (
          <Button leadingIcon={<Plus size={15} />} onClick={() => start('new')}>Thêm nhóm</Button>
        )}
      >
        {editing ? (
          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_160px]">
            <div className="space-y-4">
              <Field label="Tên nhóm" htmlFor="g-name" required error={errors.name}>
                <TextInput id="g-name" value={form.name} maxLength={80} invalid={Boolean(errors.name)} onChange={(e) => { setForm({ ...form, name: e.target.value }); setErrors({}); }} placeholder="VD: Nước ngọt có ga" />
              </Field>
              <Field label="Danh mục" htmlFor="g-cat" required error={errors.categoryId}>
                <SelectInput id="g-cat" value={form.categoryId} invalid={Boolean(errors.categoryId)} onChange={(e) => { setForm({ ...form, categoryId: e.target.value }); setErrors({}); }} placeholder="— Chọn danh mục —" options={categories.map((c) => ({ value: c.id, label: c.name }))} />
              </Field>
              <Field label="Mô tả ngắn" htmlFor="g-desc" error={errors.description}>
                <TextArea id="g-desc" rows={2} maxLength={500} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="VD: Lon 330ml, chọn loại khi gọi." />
              </Field>
            </div>
            <Field label="Ảnh thẻ nhóm">
              <ImageUpload value={form.image} onChange={(v) => setForm({ ...form, image: v })} error={errors.image} onError={(m) => setErrors((p) => ({ ...p, image: m }))} />
            </Field>
          </div>
        ) : isLoading ? (
          <p className="text-[13px] text-[var(--text-muted)]">Đang tải…</p>
        ) : !groups.length ? (
          <EmptyState title="Chưa có nhóm món" />
        ) : (
          <ul className="divide-y divide-[var(--border)]">
            {groups.map((g) => (
              <li key={g.id} className="flex items-center gap-3 py-2.5">
                {g.image ? <img src={g.image} alt="" className="h-10 w-10 rounded-[8px] object-cover" /> : <span className="h-10 w-10 rounded-[8px] bg-[var(--bg-subtle)]" />}
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{g.name}</span>
                  <span className="block text-[12px] text-[var(--text-muted)]">{catName.get(g.categoryId) ?? '—'} · {g.dishCount} món</span>
                </span>
                <Button size="sm" variant="ghost" aria-label={`Sửa ${g.name}`} onClick={() => start(g)}><Pencil size={14} /></Button>
                <Button size="sm" variant="ghost" aria-label={`Xóa ${g.name}`} onClick={() => setToDelete(g)}><Trash2 size={14} /></Button>
              </li>
            ))}
          </ul>
        )}
      </Modal>
      <ConfirmDialog
        open={Boolean(toDelete)}
        onOpenChange={(o) => !o && setToDelete(null)}
        title="Xóa nhóm món?"
        description={`Các món trong “${toDelete?.name}” trở lại thành món đứng riêng (không bị xóa).`}
        confirmLabel="Xóa nhóm"
        loading={del.isPending}
        onConfirm={() => toDelete && del.mutate(toDelete)}
      />
    </>
  );
}
