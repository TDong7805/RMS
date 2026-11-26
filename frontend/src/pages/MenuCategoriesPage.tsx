import { useState } from 'react';
import { FolderTree, Plus } from 'lucide-react';
import { Card } from '@/components/common/Card';
import { Badge } from '@/components/common/Badge';
import { Button } from '@/components/common/Button';
import { BlockError, EmptyState } from '@/components/common/EmptyState';
import { Field, ImageUpload, TextInput, Toggle } from '@/components/common/Form';
import { Modal } from '@/components/common/Modal';
import { DataTable, TableSkeleton, Td, Th } from '@/components/common/PageParts';
import { RowActions } from '@/components/common/RowActions';
import { MenuLayout } from '@/features/dishes/MenuLayout';
import { saveCategory } from '@/api/dishes';
import { qk, useCategories } from '@/features/management/queries';
import { useApiMutation } from '@/hooks/use-api-mutation';
import { cn } from '@/lib/cn';

type Draft = { id?: string; name: string; active: boolean; image: string | null };

/**
 * Thực đơn › tab Danh mục (mục B8): danh sách trên trang, thêm / sửa mở hộp nhỏ.
 * Danh mục ngừng hoạt động thì không chọn được khi thêm món mới; ảnh danh mục hiện ở dải danh mục của trang khách gọi món.
 */
export function MenuCategoriesPage() {
  const categories = useCategories();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState('');

  const save = useApiMutation(saveCategory, {
    invalidate: [qk.categories, qk.dishes],
    success: (c, v) => (v.id ? `Đã cập nhật danh mục ${c.name}` : `Đã thêm danh mục ${c.name}`),
    onFieldErrors: (f) => setError(f.name ?? ''),
    onSuccess: () => setDraft(null),
  });
  const toggle = useApiMutation(saveCategory, {
    invalidate: [qk.categories, qk.dishes],
    success: (c) => `${c.name}: ${c.active ? 'đang hoạt động' : 'ngừng hoạt động'}`,
  });

  const open = (d: Draft) => {
    setError('');
    setDraft(d);
  };

  return (
    <MenuLayout
      tab="categories"
      action={<Button leadingIcon={<Plus size={15} />} onClick={() => open({ name: '', active: true, image: null })}>Thêm danh mục</Button>}
    >
      <Card className="overflow-hidden">
        {categories.isError ? (
          <div className="p-5"><BlockError onRetry={() => void categories.refetch()} retrying={categories.isFetching} /></div>
        ) : categories.isLoading || !categories.data ? (
          <TableSkeleton cols={4} />
        ) : !categories.data.length ? (
          <div className="p-5"><EmptyState icon={FolderTree} title="Chưa có danh mục" description="Bắt đầu bằng nút “Thêm danh mục”." /></div>
        ) : (
          <DataTable minWidth={620}>
            <thead>
              <tr>
                <Th>Danh mục</Th>
                <Th className="text-right">Số món</Th>
                <Th>Trạng thái</Th>
                <Th className="text-right"><span className="sr-only">Thao tác</span></Th>
              </tr>
            </thead>
            <tbody>
              {categories.data.map((c) => (
                <tr key={c.id} className="hover:bg-[var(--bg-subtle)]">
                  <Td>
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-full border border-[var(--border)] bg-white text-[15px] font-bold text-[var(--text-muted)]">
                        {c.image ? <img src={c.image} alt="" className="h-full w-full object-contain p-0.5" /> : c.name.charAt(0)}
                      </span>
                      <span className={cn('truncate font-semibold', !c.active && 'text-[var(--text-muted)]')}>{c.name}</span>
                    </div>
                  </Td>
                  <Td className="text-right font-mono">{c.dishCount}</Td>
                  <Td>
                    <div className="flex items-center gap-2">
                      <Toggle
                        checked={c.active}
                        label={`Bật / tắt danh mục ${c.name}`}
                        disabled={toggle.isPending}
                        onChange={(active) => toggle.mutate({ id: c.id, name: c.name, active })}
                      />
                      <Badge variant={c.active ? 'accent' : 'neutral'}>{c.active ? 'Đang hoạt động' : 'Ngừng hoạt động'}</Badge>
                    </div>
                  </Td>
                  <Td className="text-right">
                    <RowActions name={c.name} onPrimary={() => open({ id: c.id, name: c.name, active: c.active, image: c.image })} items={[]} />
                  </Td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        )}
      </Card>

      <Modal
        open={Boolean(draft)}
        onOpenChange={(o) => !o && setDraft(null)}
        size="sm"
        title={draft?.id ? 'Sửa danh mục' : 'Thêm danh mục'}
        footer={
          <>
            <Button variant="ghost" onClick={() => setDraft(null)}>Hủy</Button>
            <Button loading={save.isPending} onClick={() => draft && save.mutate(draft)}>Lưu</Button>
          </>
        }
      >
        {draft ? (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              save.mutate(draft);
            }}
          >
            <Field label="Tên danh mục" htmlFor="cat-name" required error={error}>
              <TextInput
                id="cat-name"
                autoFocus
                value={draft.name}
                maxLength={50}
                invalid={Boolean(error)}
                onChange={(e) => {
                  setError('');
                  setDraft({ ...draft, name: e.target.value });
                }}
                placeholder="VD: Bít tết Úc"
              />
            </Field>
            <div>
              <p className="mb-1.5 text-[13px] font-medium text-[var(--text-primary)]">Ảnh danh mục</p>
              <div className="w-[150px]">
                <ImageUpload value={draft.image} onChange={(image) => setDraft({ ...draft, image })} label="Chọn ảnh" />
              </div>
              <p className="mt-1.5 text-[12px] leading-4 text-[var(--text-muted)]">Hiện ở dải danh mục trang gọi món. Nên dùng ảnh món tách nền.</p>
            </div>
          </form>
        ) : null}
      </Modal>
    </MenuLayout>
  );
}

export default MenuCategoriesPage;
