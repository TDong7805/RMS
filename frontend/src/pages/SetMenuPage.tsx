import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Clock, Pencil, Plus, Trash2 } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { Card } from '@/components/common/Card';
import { Badge } from '@/components/common/Badge';
import { Button } from '@/components/common/Button';
import { BlockError, EmptyState } from '@/components/common/EmptyState';
import { Field, ImageUpload, SearchInput, TextArea, TextInput, ToggleRow } from '@/components/common/Form';
import { ConfirmDialog, Modal } from '@/components/common/Modal';
import { PageHeader, TableSkeleton } from '@/components/common/PageParts';
import { deleteCombo, saveCombo } from '@/api/chatbot';
import { qk, useChatbotMenu, useCombos } from '@/features/management/queries';
import { useApiMutation } from '@/hooks/use-api-mutation';
import { formatCurrency } from '@/lib/format';
import { matchesKeyword } from '@/lib/normalize';
import type { Combo, ComboInput, ComboItem, Dish } from '@/types';

/**
 * Quản lý Set menu: set bán trên thực đơn với giá trọn gói (khách gọi qua mã QR, bếp nhận từng món, hóa đơn ghi 1 dòng set,
 * giá set chia cho món con theo tỉ lệ giá gốc). Chatbot AI dùng chính các set này để gợi ý (trước đây là "combo gợi ý").
 */
export function SetMenuPage() {
  const navigate = useNavigate();
  const combos = useCombos();
  const menu = useChatbotMenu();
  const dishes = useMemo(() => menu.data?.dishes ?? [], [menu.data]);
  const [modal, setModal] = useState<{ open: boolean; combo: Combo | null }>({ open: false, combo: null });
  const [toDelete, setToDelete] = useState<Combo | null>(null);
  const del = useApiMutation((c: Combo) => deleteCombo(c.id), {
    invalidate: [[...qk.chatbot, 'combos']],
    success: (_r, c) => `Đã xóa ${c.name}`,
    onSuccess: () => setToDelete(null),
  });

  return (
    <AppShell meta={{ label: 'Set menu', parent: 'Quản lý món ăn' }}>
      <div className="min-w-0 space-y-4">
        <PageHeader
          title="Set menu"
          description="Set bán trên thực đơn với giá trọn gói. Khách gọi qua mã QR; bếp nhận từng món; hóa đơn ghi một dòng set. Set có món tạm hết / ngừng bán hoặc ngoài giờ bán tự ẩn khỏi thực đơn. Chatbot AI cũng gợi ý các set đang bật."
          actions={
            <>
              <Button variant="ghost" size="sm" leadingIcon={<ArrowLeft size={15} />} onClick={() => navigate('/quan-ly/mon-an')}>Về danh sách món</Button>
              <Button size="sm" leadingIcon={<Plus size={15} />} onClick={() => setModal({ open: true, combo: null })}>Thêm set</Button>
            </>
          }
        />
        {combos.isError ? (
          <BlockError message="Không tải được danh sách set" onRetry={() => void combos.refetch()} />
        ) : combos.isLoading ? (
          <Card padded><TableSkeleton rows={3} /></Card>
        ) : !combos.data?.length ? (
          <Card padded><EmptyState title="Chưa có set nào" /></Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {combos.data.map((c) => <SetCard key={c.id} combo={c} dishes={dishes} onEdit={() => setModal({ open: true, combo: c })} onDelete={() => setToDelete(c)} />)}
          </div>
        )}
      </div>
      <SetModal state={modal} dishes={dishes} onClose={() => setModal({ open: false, combo: null })} />
      <ConfirmDialog
        open={Boolean(toDelete)}
        onOpenChange={(o) => !o && setToDelete(null)}
        title="Xóa set?"
        description={`“${toDelete?.name}” sẽ không còn trên thực đơn và Chatbot không gợi ý nữa. Đơn hàng cũ có set này vẫn giữ nguyên.`}
        confirmLabel="Xóa"
        loading={del.isPending}
        onConfirm={() => toDelete && del.mutate(toDelete)}
      />
    </AppShell>
  );
}

function SetCard({ combo: c, dishes, onEdit, onDelete }: { combo: Combo; dishes: Dish[]; onEdit: () => void; onDelete: () => void }) {
  const byId = new Map(dishes.map((d) => [d.id, d]));
  const save = c.price != null ? c.originalPrice - c.price : 0;
  return (
    <Card className="overflow-hidden">
      {c.image ? <img src={c.image} alt="" className="aspect-[4/3] w-full object-cover" /> : <div className="grid aspect-[4/3] place-items-center bg-[var(--bg-subtle)] text-[13px] text-[var(--text-muted)]">Chưa có ảnh</div>}
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <p className="font-semibold">{c.name}</p>
          <div className="flex shrink-0 gap-1">
            {!c.active ? <Badge variant="neutral">Tắt</Badge> : c.onMenu ? <Badge variant="accent">Trên thực đơn</Badge> : <Badge variant="info">Chỉ AI gợi ý</Badge>}
          </div>
        </div>
        {c.sellFrom ? <p className="mt-0.5 inline-flex items-center gap-1 text-[12px] text-[var(--text-muted)]"><Clock size={12} />Bán {c.sellFrom.slice(0, 5)}–{c.sellTo?.slice(0, 5)}</p> : null}
        <ul className="mt-2 space-y-0.5 text-[13px]">
          {c.items.map((it) => {
            const d = byId.get(it.dishId);
            return (
              <li key={it.dishId} className="flex justify-between gap-2">
                <span className="truncate">{d?.name ?? '—'}{it.allowVariant ? ' (đổi loại)' : ''}</span>
                <span className="font-mono text-[var(--text-muted)]">×{it.qty}</span>
              </li>
            );
          })}
        </ul>
        <div className="mt-3 flex items-center justify-between border-t border-[var(--border)] pt-2">
          <span className="text-[13px]">
            {c.price != null ? <span className="font-mono font-semibold">{formatCurrency(c.price)}</span> : <span className="text-[var(--text-muted)]">Chưa có giá</span>}
            {save > 0 ? <span className="ml-2 font-mono text-[12px] text-[var(--text-muted)] line-through">{formatCurrency(c.originalPrice)}</span> : null}
          </span>
          <div className="flex gap-0.5">
            <Button size="sm" variant="ghost" aria-label={`Sửa ${c.name}`} onClick={onEdit}><Pencil size={14} /></Button>
            <Button size="sm" variant="ghost" aria-label={`Xóa ${c.name}`} onClick={onDelete}><Trash2 size={14} /></Button>
          </div>
        </div>
      </div>
    </Card>
  );
}

const EMPTY: ComboInput = { name: '', description: '', note: '', active: true, price: null, image: null, onMenu: true, sellFrom: null, sellTo: null, items: [] };

function SetModal({ state, dishes, onClose }: { state: { open: boolean; combo: Combo | null }; dishes: Dish[]; onClose: () => void }) {
  const [form, setForm] = useState<ComboInput>(EMPTY);
  const [priceText, setPriceText] = useState('');
  const [timed, setTimed] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [kw, setKw] = useState('');

  useEffect(() => {
    if (!state.open) return;
    const c = state.combo;
    setForm(c ? { name: c.name, description: c.description, note: c.note, active: c.active, price: c.price, image: c.image, onMenu: c.onMenu,
      sellFrom: c.sellFrom?.slice(0, 5) ?? null, sellTo: c.sellTo?.slice(0, 5) ?? null, items: c.items.map((i) => ({ ...i })) } : EMPTY);
    setPriceText(c?.price != null ? String(c.price) : '');
    setTimed(Boolean(c?.sellFrom));
    setErrors({});
    setKw('');
  }, [state]);

  const mutation = useApiMutation((input: ComboInput) => saveCombo(state.combo?.id ?? null, input), {
    invalidate: [[...qk.chatbot, 'combos']],
    success: (c) => (state.combo ? `Đã cập nhật ${c.name}` : `Đã thêm ${c.name}`),
    onFieldErrors: setErrors,
    onSuccess: onClose,
  });

  const byId = new Map(dishes.map((d) => [d.id, d]));
  const original = form.items.reduce((s, i) => s + (byId.get(i.dishId)?.price ?? 0) * i.qty, 0);
  const price = priceText.trim() === '' ? null : Number(priceText.replace(/[.\s]/g, ''));
  const selling = dishes.filter((d) => d.status === 'selling' && matchesKeyword(d.name, kw));
  const setItem = (dishId: string, patch: Partial<ComboItem> | null) => {
    setErrors({});
    setForm((f) => {
      const has = f.items.some((i) => i.dishId === dishId);
      if (patch === null) return { ...f, items: f.items.filter((i) => i.dishId !== dishId) };
      if (!has) return { ...f, items: [...f.items, { dishId, qty: 1, allowVariant: false, ...patch }] };
      return { ...f, items: f.items.map((i) => (i.dishId === dishId ? { ...i, ...patch } : i)) };
    });
  };
  const submit = () => {
    if (price !== null && !Number.isFinite(price)) {
      setErrors({ price: 'Giá không hợp lệ' });
      return;
    }
    // Ảnh: bỏ ảnh của set đang có → "" (xóa); chưa đổi → giữ địa chỉ cũ.
    const image = form.image === null && state.combo?.image ? '' : form.image;
    mutation.mutate({ ...form, price, image, sellFrom: timed ? form.sellFrom : null, sellTo: timed ? form.sellTo : null });
  };

  return (
    <Modal
      open={state.open}
      onOpenChange={(o) => !o && onClose()}
      size="lg"
      title={state.combo ? 'Sửa set' : 'Thêm set'}
      footer={
        <>
          <span className="mr-auto text-[13px] text-[var(--text-muted)]">
            {form.items.reduce((s, i) => s + i.qty, 0)} món · giá gốc <span className="font-mono font-semibold text-[var(--text-primary)]">{formatCurrency(original)}</span>
            {price && original > price ? <> · khách tiết kiệm <span className="font-mono font-semibold text-[var(--success)]">{formatCurrency(original - price)}</span></> : null}
          </span>
          <Button variant="ghost" onClick={onClose}>Hủy</Button>
          <Button loading={mutation.isPending} onClick={submit}>Lưu</Button>
        </>
      }
    >
      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_220px]">
        <div className="min-w-0 space-y-4">
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
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-1.5 text-[13px]"><input type="checkbox" checked={timed} onChange={(e) => setTimed(e.target.checked)} className="h-4 w-4 accent-[var(--accent)]" />Giới hạn</label>
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
          <Field label="Món trong set" required error={errors.dishIds} hint="Tích chọn món, nhập số lượng. Món thuộc nhóm (vd. nước ngọt) có thể cho khách đổi loại.">
            <SearchInput value={kw} onChange={setKw} placeholder="Lọc món đang bán…" />
            <div className="mt-2 max-h-[260px] space-y-0.5 overflow-y-auto rounded-item border border-[var(--border)] p-1.5">
              {selling.map((d) => {
                const it = form.items.find((i) => i.dishId === d.id);
                return (
                  <div key={d.id} className="flex items-center gap-2.5 rounded-[9px] px-2 py-1.5 hover:bg-[var(--bg-subtle)]">
                    <input type="checkbox" aria-label={`Chọn ${d.name}`} checked={Boolean(it)} onChange={() => setItem(d.id, it ? null : {})} className="h-4 w-4 accent-[var(--accent)]" />
                    <span className="flex-1 text-[13.5px]">{d.name}</span>
                    {it ? (
                      <>
                        {d.groupId ? (
                          <label className="flex items-center gap-1 text-[12px] text-[var(--text-muted)]"><input type="checkbox" checked={it.allowVariant} onChange={(e) => setItem(d.id, { allowVariant: e.target.checked })} className="h-3.5 w-3.5 accent-[var(--accent)]" />Đổi loại</label>
                        ) : null}
                        <TextInput aria-label={`Số lượng ${d.name}`} type="number" min={1} max={20} value={it.qty} onChange={(e) => setItem(d.id, { qty: Math.max(1, Math.min(20, Number(e.target.value) || 1)) })} className="h-8 w-[64px]" />
                      </>
                    ) : <span className="font-mono text-[12px] text-[var(--text-muted)]">{formatCurrency(d.price)}</span>}
                  </div>
                );
              })}
            </div>
          </Field>
          <Field label="Khi nào Chatbot nên gợi ý" htmlFor="set-note" error={errors.note}>
            <TextArea id="set-note" rows={2} maxLength={300} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="VD: khách đi nhóm 4 người" />
          </Field>
        </div>
        <div className="min-w-0 space-y-4">
          <Field label="Ảnh set">
            <ImageUpload aspect="square" value={form.image} onChange={(v) => setForm({ ...form, image: v })} error={errors.image} onError={(m) => setErrors((p) => ({ ...p, image: m }))} />
          </Field>
          <ToggleRow title="Bán trên thực đơn" description="Khách thấy và gọi được qua mã QR" checked={form.onMenu} onChange={(v) => setForm({ ...form, onMenu: v })} />
          <ToggleRow title="Đang áp dụng" description="Tắt: ẩn khỏi thực đơn và Chatbot" checked={form.active} onChange={(v) => setForm({ ...form, active: v })} />
        </div>
      </div>
    </Modal>
  );
}

export default SetMenuPage;
