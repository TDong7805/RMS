import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { Card, CardHeader } from '@/components/common/Card';
import { BlockError } from '@/components/common/EmptyState';
import { Field, ImageUpload, SearchInput, TextArea, TextInput, ToggleRow } from '@/components/common/Form';
import { Skeleton } from '@/components/common/Skeleton';
import { StickySaveBar } from '@/components/common/StickySaveBar';
import { MENU_HOME, MenuFormHeader } from '@/features/dishes/MenuLayout';
import { DishThumb } from '@/features/dishes/DishParts';
import { saveCombo } from '@/api/chatbot';
import { qk, useChatbotMenu, useCombos } from '@/features/management/queries';
import { useApiMutation } from '@/hooks/use-api-mutation';
import { useUnsavedGuard } from '@/hooks/use-unsaved-guard';
import { cn } from '@/lib/cn';
import { formatCurrency } from '@/lib/format';
import { matchesKeyword } from '@/lib/normalize';
import type { ComboInput, ComboItem } from '@/types';

const EMPTY: ComboInput = { name: '', description: '', note: '', active: true, price: null, image: null, onMenu: true, sellFrom: null, sellTo: null, items: [] };
const SETS = `${MENU_HOME}/set-menu`;
const FORM_ID = 'set-form';

interface Snapshot {
  form: ComboInput;
  priceText: string;
  timed: boolean;
}

/**
 * Thêm / sửa set (mục B8): cùng kiểu trang với Thêm / sửa món — đường dẫn Thực đơn › Set menu › Sửa, Quay lại + Lưu bên phải,
 * thanh lưu dính đáy khi có thay đổi (kèm số món, giá gốc, khách tiết kiệm bao nhiêu).
 */
export function SetFormPage() {
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const combos = useCombos();
  const menu = useChatbotMenu();
  const dishes = useMemo(() => menu.data?.dishes ?? [], [menu.data]);
  const combo = isEdit ? combos.data?.find((c) => c.id === id) : undefined;

  const [form, setForm] = useState<ComboInput>(EMPTY);
  const [priceText, setPriceText] = useState('');
  const [timed, setTimed] = useState(false);
  const [initial, setInitial] = useState<Snapshot | null>(isEdit ? null : { form: EMPTY, priceText: '', timed: false });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [kw, setKw] = useState('');

  useEffect(() => {
    if (!isEdit || !combo || initial) return;
    const f: ComboInput = {
      name: combo.name, description: combo.description, note: combo.note, active: combo.active, price: combo.price, image: combo.image,
      onMenu: combo.onMenu, sellFrom: combo.sellFrom?.slice(0, 5) ?? null, sellTo: combo.sellTo?.slice(0, 5) ?? null,
      items: combo.items.map((i) => ({ ...i })),
    };
    const snap = { form: f, priceText: combo.price != null ? String(combo.price) : '', timed: Boolean(combo.sellFrom) };
    setForm(f);
    setPriceText(snap.priceText);
    setTimed(snap.timed);
    setInitial(snap);
  }, [isEdit, combo, initial]);

  const dirty = initial !== null && JSON.stringify({ form, priceText, timed }) !== JSON.stringify(initial);

  const mutation = useApiMutation((input: ComboInput) => saveCombo(id ?? null, input), {
    invalidate: [[...qk.chatbot, 'combos']],
    success: (c) => (isEdit ? `Đã cập nhật ${c.name}` : `Đã thêm ${c.name}`),
    onFieldErrors: setErrors,
    onSuccess: () => {
      guard.allowLeave();
      navigate(SETS);
    },
  });

  const byId = new Map(dishes.map((d) => [d.id, d]));
  const original = form.items.reduce((s, i) => s + (byId.get(i.dishId)?.price ?? 0) * i.qty, 0);
  const price = priceText.trim() === '' ? null : Number(priceText.replace(/[.\s]/g, ''));
  const count = form.items.reduce((s, i) => s + i.qty, 0);
  // Món đã có trong set (lúc mở trang) lên đầu danh sách; tích thêm món khác thì món đó không nhảy chỗ.
  const startIds = new Set((initial?.form.items ?? []).map((i) => i.dishId));
  const selling = dishes
    .filter((d) => d.status === 'selling' && matchesKeyword(d.name, kw))
    .sort((a, b) => Number(startIds.has(b.id)) - Number(startIds.has(a.id)));

  const setItem = (dishId: string, patch: Partial<ComboItem> | null) => {
    setErrors({});
    setForm((f) => {
      const has = f.items.some((i) => i.dishId === dishId);
      if (patch === null) return { ...f, items: f.items.filter((i) => i.dishId !== dishId) };
      if (!has) return { ...f, items: [...f.items, { dishId, qty: 1, allowVariant: false, ...patch }] };
      return { ...f, items: f.items.map((i) => (i.dishId === dishId ? { ...i, ...patch } : i)) };
    });
  };

  const submit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (price !== null && !Number.isFinite(price)) {
      setErrors({ price: 'Giá không hợp lệ' });
      return;
    }
    // Ảnh: bỏ ảnh của set đang có → "" (xóa); chưa đổi → giữ địa chỉ cũ.
    const image = form.image === null && combo?.image ? '' : form.image;
    mutation.mutate({ ...form, price, image, sellFrom: timed ? form.sellFrom : null, sellTo: timed ? form.sellTo : null });
  };

  const discard = () => {
    if (!initial) return;
    setForm(initial.form);
    setPriceText(initial.priceText);
    setTimed(initial.timed);
    setErrors({});
  };

  const errorCount = Object.values(errors).filter(Boolean).length;
  const guard = useUnsavedGuard(dirty && !mutation.isPending);
  const summary = (
    <>
      {count} món · giá gốc <span className="font-mono font-semibold text-[var(--text-primary)]">{formatCurrency(original)}</span>
      {price && original > price ? (
        <> · khách tiết kiệm <span className="font-mono font-semibold text-[var(--success)]">{formatCurrency(original - price)}</span> ({Math.round(((original - price) * 100) / original)}%)</>
      ) : null}
    </>
  );
  const title = isEdit ? 'Sửa set' : 'Thêm set';

  return (
    <AppShell meta={{ label: isEdit ? 'Sửa' : 'Thêm mới', parent: 'Thực đơn', parentTo: MENU_HOME, trail: [{ label: 'Set menu', to: SETS }] }}>
      <div className="min-w-0 space-y-4">
        <MenuFormHeader
          title={isEdit && combo ? combo.name : title}
          description={isEdit ? 'Đổi giá set không ảnh hưởng hóa đơn đã tạo.' : 'Set bán nhiều món với giá trọn gói; bếp vẫn nhận từng món.'}
          backTo={SETS}
        />

        {isEdit && combos.isSuccess && !combo ? (
          <BlockError message="Set không tồn tại hoặc đã bị xóa" onRetry={() => void combos.refetch()} />
        ) : !initial ? (
          <Card padded><div className="grid gap-4 sm:grid-cols-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-16" />)}</div></Card>
        ) : (
          <form id={FORM_ID} onSubmit={submit} noValidate className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
            <div className="min-w-0 space-y-4">
              <Card padded>
                <CardHeader title="Thông tin set" />
                <div className="mt-4 space-y-4">
                  <Field label="Tên set" htmlFor="set-name" required error={errors.name}>
                    <TextInput id="set-name" value={form.name} maxLength={100} invalid={Boolean(errors.name)} onChange={(e) => { setForm({ ...form, name: e.target.value }); setErrors({}); }} placeholder="VD: Set Steak cho 2 người" />
                  </Field>
                  <Field label="Mô tả cho khách" htmlFor="set-desc" error={errors.description}>
                    <TextArea id="set-desc" rows={2} maxLength={500} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Gồm những gì, phù hợp mấy người…" />
                  </Field>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Giá set (VND)" htmlFor="set-price" error={errors.price} hint={price ? formatCurrency(price) : 'Bắt buộc khi bán trên thực đơn'}>
                      <TextInput id="set-price" inputMode="numeric" value={priceText} invalid={Boolean(errors.price)} onChange={(e) => { setPriceText(e.target.value); setErrors({}); }} placeholder="1390000" />
                    </Field>
                    <Field label="Giờ bán" error={errors.sellFrom || errors.sellTo}>
                      <div className="flex h-10 items-center gap-2">
                        <label className="flex items-center gap-1.5 text-[13px]">
                          <input type="checkbox" checked={timed} onChange={(e) => setTimed(e.target.checked)} className="h-4 w-4 accent-[var(--accent)]" />
                          Giới hạn giờ
                        </label>
                        {timed ? (
                          <>
                            <TextInput aria-label="Bán từ" type="time" value={form.sellFrom ?? ''} onChange={(e) => setForm({ ...form, sellFrom: e.target.value })} className="w-[110px]" />
                            <span>–</span>
                            <TextInput aria-label="Bán đến" type="time" value={form.sellTo ?? ''} onChange={(e) => setForm({ ...form, sellTo: e.target.value })} className="w-[110px]" />
                          </>
                        ) : <span className="text-[13px] text-[var(--text-muted)]">Cả ngày</span>}
                      </div>
                    </Field>
                  </div>
                </div>
              </Card>

              <Card padded>
                <CardHeader title="Món trong set" description="Tích chọn món, nhập số lượng. Món thuộc nhóm (vd. nước ngọt) có thể cho khách đổi loại." />
                <div className="mt-4">
                  <SearchInput value={kw} onChange={setKw} placeholder="Lọc món đang bán…" />
                  {errors.dishIds ? <p className="mt-2 text-[12.5px] font-medium text-[var(--danger)]">{errors.dishIds}</p> : null}
                  <div className={cn('mt-2 max-h-[420px] space-y-0.5 overflow-y-auto rounded-item border p-1.5', errors.dishIds ? 'border-[var(--danger)]' : 'border-[var(--border)]')}>
                    {selling.map((d) => {
                      const it = form.items.find((i) => i.dishId === d.id);
                      return (
                        <div key={d.id} className={cn('flex items-center gap-2.5 rounded-[9px] px-2 py-1.5 hover:bg-[var(--bg-subtle)]', it && 'bg-[var(--accent-soft)]/50')}>
                          <input type="checkbox" aria-label={`Chọn ${d.name}`} checked={Boolean(it)} onChange={() => setItem(d.id, it ? null : {})} className="h-4 w-4 accent-[var(--accent)]" />
                          <DishThumb dish={d} size={30} />
                          <span className="min-w-0 flex-1 truncate text-[13.5px]">{d.name}</span>
                          {it ? (
                            <>
                              {d.groupId ? (
                                <label className="flex items-center gap-1 text-[12px] text-[var(--text-muted)]">
                                  <input type="checkbox" checked={it.allowVariant} onChange={(e) => setItem(d.id, { allowVariant: e.target.checked })} className="h-3.5 w-3.5 accent-[var(--accent)]" />
                                  Đổi loại
                                </label>
                              ) : null}
                              <TextInput aria-label={`Số lượng ${d.name}`} type="number" min={1} max={20} value={it.qty} onChange={(e) => setItem(d.id, { qty: Math.max(1, Math.min(20, Number(e.target.value) || 1)) })} className="h-8 w-[64px]" />
                            </>
                          ) : <span className="font-mono text-[12px] text-[var(--text-muted)]">{formatCurrency(d.price)}</span>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </Card>

              <Card padded>
                <CardHeader title="Gợi ý của trợ lý AI" />
                <div className="mt-4">
                  <Field label="Khi nào nên gợi ý set này" htmlFor="set-note" error={errors.note}>
                    <TextArea id="set-note" rows={2} maxLength={300} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="VD: khách đi nhóm 4 người" />
                  </Field>
                </div>
              </Card>
            </div>

            <div className="min-w-0 space-y-4">
              <Card padded>
                <CardHeader title="Ảnh set" />
                <div className="mt-3">
                  <ImageUpload aspect="square" value={form.image} onChange={(v) => setForm({ ...form, image: v })} error={errors.image} onError={(m) => setErrors((p) => ({ ...p, image: m }))} />
                </div>
              </Card>
              <Card padded className="space-y-3">
                <ToggleRow title="Bán trên thực đơn" description="Khách thấy và gọi được qua mã QR" checked={form.onMenu} onChange={(v) => setForm({ ...form, onMenu: v })} />
                <ToggleRow title="Đang áp dụng" description="Tắt: ẩn khỏi thực đơn và trợ lý AI" checked={form.active} onChange={(v) => setForm({ ...form, active: v })} />
              </Card>
            </div>
          </form>
        )}

        {guard.dialog}
        {initial ? (
          <StickySaveBar dirty={dirty} saving={mutation.isPending} errorCount={errorCount} summary={summary} saveLabel={isEdit ? 'Lưu' : 'Thêm set'} onSave={() => submit()} onDiscard={discard} />
        ) : null}
      </div>
    </AppShell>
  );
}

export default SetFormPage;
