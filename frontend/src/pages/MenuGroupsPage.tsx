import { useMemo, useState } from 'react';
import { Layers, Plus, Trash2 } from 'lucide-react';
import { Card } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { BlockError, EmptyState } from '@/components/common/EmptyState';
import { Field, ImageUpload, SelectInput, TextArea, TextInput } from '@/components/common/Form';
import { ConfirmDialog, Modal } from '@/components/common/Modal';
import { DataTable, TableSkeleton, Td, Th } from '@/components/common/PageParts';
import { RowActions } from '@/components/common/RowActions';
import { MenuLayout } from '@/features/dishes/MenuLayout';
import { deleteDishGroup, saveDishGroup } from '@/api/dishes';
import { qk, useCategories, useDishGroups } from '@/features/management/queries';
import { useApiMutation } from '@/hooks/use-api-mutation';
import type { DishGroup, DishGroupInput } from '@/types';

const EMPTY: DishGroupInput = { name: '', categoryId: '', description: '', image: null };

/**
 * Thực đơn › tab Nhóm món (mục B8): gộp nhiều món cùng loại (vd. Coca-Cola, Sprite… → "Nước ngọt có ga") thành một thẻ
 * trên trang gọi món; khách bấm thẻ rồi chọn loại. Mỗi loại vẫn là món riêng. Gắn món vào nhóm ở trang sửa món.
 */
export function MenuGroupsPage() {
  const groups = useDishGroups();
  const { data: categories = [] } = useCategories();
  const catName = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories]);
  const [editing, setEditing] = useState<DishGroup | 'new' | null>(null);
  const [form, setForm] = useState<DishGroupInput>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [toDelete, setToDelete] = useState<DishGroup | null>(null);

  const start = (g: DishGroup | 'new') => {
    setEditing(g);
    setErrors({});
    setForm(g === 'new' ? EMPTY : { name: g.name, categoryId: g.categoryId, description: g.description, image: g.image });
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
    // Bỏ ảnh của nhóm đang có → "" (xóa ảnh); chưa đổi → giữ địa chỉ cũ.
    const old = editing && editing !== 'new' ? editing.image : null;
    save.mutate({ ...form, image: form.image === null && old ? '' : form.image });
  };

  return (
    <MenuLayout tab="groups" action={<Button leadingIcon={<Plus size={15} />} onClick={() => start('new')}>Thêm nhóm</Button>}>
      <Card className="overflow-hidden">
        {groups.isError ? (
          <div className="p-5"><BlockError onRetry={() => void groups.refetch()} retrying={groups.isFetching} /></div>
        ) : groups.isLoading || !groups.data ? (
          <TableSkeleton cols={4} />
        ) : !groups.data.length ? (
          <div className="p-5">
            <EmptyState icon={Layers} title="Chưa có nhóm món" description="Nhóm gộp các món cùng loại (vd. các loại nước ngọt) thành một thẻ trên trang gọi món." />
          </div>
        ) : (
          <DataTable minWidth={620}>
            <thead>
              <tr>
                <Th>Nhóm</Th>
                <Th>Danh mục</Th>
                <Th className="text-right">Số món</Th>
                <Th className="text-right"><span className="sr-only">Thao tác</span></Th>
              </tr>
            </thead>
            <tbody>
              {groups.data.map((g) => (
                <tr key={g.id} className="hover:bg-[var(--bg-subtle)]">
                  <Td>
                    <div className="flex min-w-0 items-center gap-3">
                      {g.image ? <img src={g.image} alt="" className="h-11 w-11 shrink-0 rounded-[10px] object-cover" /> : <span className="h-11 w-11 shrink-0 rounded-[10px] bg-[var(--bg-subtle)]" />}
                      <span className="min-w-0">
                        <span className="block truncate font-semibold">{g.name}</span>
                        {g.description ? <span className="block max-w-[340px] truncate text-[12px] text-[var(--text-muted)]">{g.description}</span> : null}
                      </span>
                    </div>
                  </Td>
                  <Td>{catName.get(g.categoryId) ?? '—'}</Td>
                  <Td className="text-right font-mono">{g.dishCount}</Td>
                  <Td className="text-right">
                    <RowActions
                      name={g.name}
                      onPrimary={() => start(g)}
                      items={[{ label: 'Xóa nhóm', icon: <Trash2 size={15} />, danger: true, onSelect: () => setToDelete(g) }]}
                    />
                  </Td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        )}
      </Card>

      <Modal
        open={Boolean(editing)}
        onOpenChange={(o) => !o && setEditing(null)}
        size="md"
        title={editing === 'new' ? 'Thêm nhóm món' : 'Sửa nhóm món'}
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditing(null)}>Hủy</Button>
            <Button loading={save.isPending} onClick={submit}>Lưu</Button>
          </>
        }
      >
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
          <div>
            <Field label="Ảnh thẻ nhóm">
              <ImageUpload value={form.image} onChange={(v) => setForm({ ...form, image: v })} error={errors.image} onError={(m) => setErrors((p) => ({ ...p, image: m }))} />
            </Field>
            <p className="mt-1.5 text-[12px] leading-4 text-[var(--text-muted)]">Gắn món vào nhóm ở trang sửa món.</p>
          </div>
        </div>
      </Modal>
      <ConfirmDialog
        open={Boolean(toDelete)}
        onOpenChange={(o) => !o && setToDelete(null)}
        title={`Xóa nhóm “${toDelete?.name ?? ''}”?`}
        description="Các món trong nhóm trở lại thành món đứng riêng, không bị xóa."
        confirmLabel="Xóa nhóm"
        loading={del.isPending}
        onConfirm={() => toDelete && del.mutate(toDelete)}
      />
    </MenuLayout>
  );
}

export default MenuGroupsPage;
