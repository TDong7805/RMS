import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Bot } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { Card, CardHeader } from '@/components/common/Card';
import { BlockError } from '@/components/common/EmptyState';
import { ChipSelect, Field, ImageUpload, SelectInput, TextArea, TextInput } from '@/components/common/Form';
import { StickySaveBar } from '@/components/common/StickySaveBar';
import { MENU_HOME, MenuFormHeader } from '@/features/dishes/MenuLayout';
import { Segmented } from '@/components/common/Segmented';
import { Skeleton } from '@/components/common/Skeleton';
import { DESCRIPTION_MAX, createDish, updateDish } from '@/api/dishes';
import { qk, useAllergens, useCategories, useDish, useDishGroups } from '@/features/management/queries';
import { useApiMutation } from '@/hooks/use-api-mutation';
import { useUnsavedGuard } from '@/hooks/use-unsaved-guard';
import { formatCurrency } from '@/lib/format';
import { SPICY_LEVELS, formatDateTime } from '@/lib/labels';
import type { DishInput, DishStatus } from '@/types';

const EMPTY: DishInput = {
  name: '',
  categoryId: '',
  price: 0,
  description: '',
  image: null,
  status: 'selling',
  ingredients: '',
  allergens: [],
  spicyLevel: 0,
  groupId: null,
  variantLabel: '',
};

export function DishFormPage() {
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const dishQuery = useDish(id);
  const { data: categories = [] } = useCategories();
  const { data: allergenOptions = [] } = useAllergens();
  const { data: groups = [] } = useDishGroups();

  const [form, setForm] = useState<DishInput>(EMPTY);
  const [priceText, setPriceText] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loaded, setLoaded] = useState(!isEdit);
  const [initial, setInitial] = useState<string>(JSON.stringify({ form: EMPTY, priceText: '' }));

  // Đổi giữa "Thêm" và "Sửa" (hoặc sang món khác) thì nạp lại biểu mẫu.
  useEffect(() => {
    setErrors({});
    if (!id) {
      setForm(EMPTY);
      setPriceText('');
      setInitial(JSON.stringify({ form: EMPTY, priceText: '' }));
      setLoaded(true);
    } else {
      setLoaded(false);
    }
  }, [id]);

  useEffect(() => {
    const d = dishQuery.data;
    if (isEdit && d && d.id === id && !loaded) {
      const next: DishInput = {
        name: d.name,
        categoryId: d.categoryId,
        price: d.price,
        description: d.description,
        image: d.image,
        status: d.status,
        ingredients: d.ingredients,
        allergens: [...d.allergens],
        spicyLevel: d.spicyLevel,
        groupId: d.groupId,
        variantLabel: d.variantLabel ?? '',
      };
      setForm(next);
      setPriceText(String(d.price));
      setInitial(JSON.stringify({ form: next, priceText: String(d.price) }));
      setLoaded(true);
    }
  }, [dishQuery.data, isEdit, loaded, id]);

  const mutation = useApiMutation((input: DishInput) => (id ? updateDish(id, input) : createDish(input)), {
    invalidate: [qk.dishes, qk.categories, qk.chatbot, qk.dishGroups],
    success: (d) => (isEdit ? `Đã cập nhật món ${d.name}` : `Đã thêm món ${d.name} (${d.code})`),
    onFieldErrors: setErrors,
    onSuccess: () => {
      guard.allowLeave();
      navigate(MENU_HOME);
    },
  });

  const set = <K extends keyof DishInput>(key: K, value: DishInput[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: '' }));
  };

  const submit = (e?: React.FormEvent) => {
    e?.preventDefault();
    const local: Record<string, string> = {};
    const rawPrice = priceText.replace(/[.\s]/g, '');
    const price = Number(rawPrice);
    if (!form.name.trim()) local.name = 'Vui lòng nhập tên món';
    if (!form.categoryId) local.categoryId = 'Vui lòng chọn danh mục món';
    if (rawPrice === '' || !Number.isFinite(price)) local.price = 'Vui lòng nhập đơn giá hợp lệ';
    else if (price < 0) local.price = 'Đơn giá phải là số không âm';
    if (Object.keys(local).length) {
      setErrors(local);
      return;
    }
    mutation.mutate({ ...form, price });
  };

  const title = isEdit ? 'Sửa món' : 'Thêm món';
  const dirty = loaded && JSON.stringify({ form, priceText }) !== initial;
  const discard = () => {
    const snap = JSON.parse(initial) as { form: DishInput; priceText: string };
    setForm(snap.form);
    setPriceText(snap.priceText);
    setErrors({});
  };
  const errorCount = Object.values(errors).filter(Boolean).length;
  const guard = useUnsavedGuard(dirty && !mutation.isPending);
  const priceNumber = Number(priceText.replace(/[.\s]/g, ''));

  return (
    <AppShell meta={{ label: isEdit ? 'Sửa' : 'Thêm mới', parent: 'Thực đơn', parentTo: MENU_HOME, trail: [{ label: 'Món ăn', to: MENU_HOME }] }}>
      <div className="min-w-0 space-y-4">
        <MenuFormHeader
          title={isEdit && dishQuery.data ? dishQuery.data.name : title}
          description={
            isEdit && dishQuery.data
              ? `Mã món ${dishQuery.data.code} · sửa lần cuối ${formatDateTime(dishQuery.data.updatedAt)}. Đổi giá không ảnh hưởng hóa đơn đã tạo.`
              : 'Mã món tự có sau khi lưu.'
          }
          backTo={MENU_HOME}
        />

        {isEdit && dishQuery.isError ? (
          <BlockError message="Món ăn không tồn tại hoặc đã bị xóa" onRetry={() => void dishQuery.refetch()} />
        ) : !loaded ? (
          <Card padded><div className="grid gap-4 sm:grid-cols-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-16" />)}</div></Card>
        ) : (
          <form id="dish-form" onSubmit={submit} noValidate className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
            <div className="min-w-0 space-y-4">
              <Card padded>
                <CardHeader title="Thông tin cơ bản" />
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <Field label="Tên món" htmlFor="d-name" required error={errors.name} className="sm:col-span-2">
                    <TextInput id="d-name" value={form.name} maxLength={120} invalid={Boolean(errors.name)} onChange={(e) => set('name', e.target.value)} placeholder="VD: Gỏi cuốn tôm thịt" />
                  </Field>
                  <Field label="Danh mục món" htmlFor="d-cat" required error={errors.categoryId}>
                    <SelectInput
                      id="d-cat"
                      value={form.categoryId}
                      invalid={Boolean(errors.categoryId)}
                      onChange={(e) => { set('categoryId', e.target.value); set('groupId', null); }}
                      placeholder="— Chọn danh mục —"
                      options={categories.map((c) => ({ value: c.id, label: c.active ? c.name : `${c.name} (ngừng hoạt động)`, disabled: !c.active }))}
                    />
                  </Field>
                  <Field label="Đơn giá (VND)" htmlFor="d-price" required error={errors.price} hint={Number.isFinite(priceNumber) && priceText ? formatCurrency(priceNumber) : 'Số không âm'}>
                    <TextInput
                      id="d-price"
                      inputMode="numeric"
                      value={priceText}
                      invalid={Boolean(errors.price)}
                      onChange={(e) => { setPriceText(e.target.value); setErrors((p) => ({ ...p, price: '' })); }}
                      placeholder="35000"
                    />
                  </Field>
                  <Field label="Nhóm hiển thị" htmlFor="d-group" error={errors.groupId} hint="Gộp nhiều món cùng loại thành một thẻ trên trang gọi món (vd. Nước ngọt có ga)">
                    <SelectInput
                      id="d-group"
                      value={form.groupId ?? ''}
                      invalid={Boolean(errors.groupId)}
                      onChange={(e) => set('groupId', e.target.value || null)}
                      placeholder="— Món đứng riêng —"
                      options={groups.filter((g) => g.categoryId === form.categoryId).map((g) => ({ value: g.id, label: g.name }))}
                    />
                  </Field>
                  <Field label="Tên loại trong nhóm" htmlFor="d-variant" error={errors.variantLabel} hint={form.groupId ? 'Hiện ở khung chọn loại, vd. "Coca-Cola", "Ly 150ml"' : 'Chỉ dùng khi món thuộc một nhóm'}>
                    <TextInput id="d-variant" value={form.variantLabel ?? ''} maxLength={40} disabled={!form.groupId} invalid={Boolean(errors.variantLabel)} onChange={(e) => set('variantLabel', e.target.value)} placeholder="Bỏ trống = dùng tên món" />
                  </Field>
                  <Field label="Mô tả" htmlFor="d-desc" error={errors.description} hint={`${form.description.length}/${DESCRIPTION_MAX} ký tự`} className="sm:col-span-2">
                    <TextArea id="d-desc" rows={3} maxLength={DESCRIPTION_MAX} value={form.description} invalid={Boolean(errors.description)} onChange={(e) => set('description', e.target.value)} placeholder="Hương vị, cách chế biến, khẩu phần…" />
                  </Field>
                </div>
              </Card>

              <Card padded>
                <CardHeader
                  title="Dữ liệu cho AI tư vấn"
                  icon={<Bot size={17} />}
                  description="AI chỉ trả lời dựa trên dữ liệu được khai báo tại đây; thiếu dữ liệu thì AI không khẳng định."
                />
                <div className="mt-4 space-y-4">
                  <Field label="Thành phần chính" htmlFor="d-ing" error={errors.ingredients} hint="Liệt kê nguyên liệu, cách nhau bởi dấu phẩy">
                    <TextArea id="d-ing" rows={2} maxLength={500} value={form.ingredients} invalid={Boolean(errors.ingredients)} onChange={(e) => set('ingredients', e.target.value)} placeholder="Tôm, thịt ba chỉ, bún, rau sống…" />
                  </Field>
                  <Field label="Dị nguyên đã khai báo" hint="AI luôn kèm cảnh báo nguy cơ nhiễm chéo khi khách hỏi về dị ứng">
                    <ChipSelect ariaLabel="Chọn dị nguyên" options={allergenOptions} value={form.allergens} onChange={(v) => set('allergens', v)} />
                  </Field>
                  <Field label="Mức cay">
                    <Segmented<string>
                      ariaLabel="Chọn mức cay"
                      value={String(form.spicyLevel)}
                      onChange={(v) => set('spicyLevel', Number(v))}
                      options={SPICY_LEVELS.map((label, i) => ({ value: String(i), label }))}
                    />
                  </Field>
                </div>
              </Card>
            </div>

            <div className="min-w-0 space-y-4">
              <Card padded>
                <CardHeader title="Ảnh món ăn" />
                <div className="mt-3">
                  <ImageUpload value={form.image} onChange={(v) => set('image', v)} error={errors.image} onError={(m) => setErrors((p) => ({ ...p, image: m }))} />
                </div>
              </Card>
              <Card padded>
                <CardHeader title="Trạng thái bán" />
                <div className="mt-3">
                  <Segmented<DishStatus>
                    ariaLabel="Trạng thái bán"
                    value={form.status}
                    onChange={(v) => set('status', v)}
                    options={[{ value: 'selling', label: 'Đang bán' }, { value: 'stopped', label: 'Ngừng bán' }]}
                  />
                  <p className="mt-2 text-[12px] leading-5 text-[var(--text-muted)]">Món ngừng bán vẫn được giữ trong lịch sử, chỉ không được chọn cho đơn hàng mới.</p>
                </div>
              </Card>
            </div>
          </form>
        )}
        {guard.dialog}
        {loaded ? (
          <StickySaveBar dirty={dirty} saving={mutation.isPending} errorCount={errorCount} idleText={isEdit ? 'Chưa có thay đổi' : 'Điền thông tin món rồi bấm Thêm món'} saveLabel={isEdit ? 'Lưu' : 'Thêm món'} onSave={() => submit()} onDiscard={discard} />
        ) : null}
      </div>
    </AppShell>
  );
}

export default DishFormPage;
