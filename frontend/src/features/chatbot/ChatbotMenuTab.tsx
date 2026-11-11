import { useEffect, useMemo, useState } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { AlertTriangle, Pencil, Plus, RefreshCw, Tags, Trash2 } from 'lucide-react';
import { Card, CardHeader } from '@/components/common/Card';
import { Badge } from '@/components/common/Badge';
import { Button } from '@/components/common/Button';
import { BlockError, EmptyState } from '@/components/common/EmptyState';
import { ChipSelect, Field, SearchInput, TextArea, TextInput, Toggle, ToggleRow } from '@/components/common/Form';
import { ConfirmDialog, Modal } from '@/components/common/Modal';
import { DataTable, TableSkeleton, Td, Th } from '@/components/common/PageParts';
import { deleteCombo, saveCombo, syncChatbotMenu, updateDishAi } from '@/api/chatbot';
import { AI_TAG_OPTIONS } from '@/mocks/dishes';
import { qk, useCategories, useChatbotMenu, useCombos } from '@/features/management/queries';
import { useApiMutation } from '@/hooks/use-api-mutation';
import { formatCurrency } from '@/lib/format';
import { formatDateTime } from '@/lib/labels';
import { matchesKeyword } from '@/lib/normalize';
import type { Combo, ComboInput, Dish } from '@/types';

/** Luồng B — Quản lý thực đơn cho AI: đồng bộ món, combo gợi ý, gắn thẻ phân loại. */
export function ChatbotMenuTab() {
  const menu = useChatbotMenu();
  const combosQuery = useCombos();
  const { data: categories = [] } = useCategories();
  const [keyword, setKeyword] = useState('');
  const [comboModal, setComboModal] = useState<{ open: boolean; combo: Combo | null }>({ open: false, combo: null });
  const [comboDelete, setComboDelete] = useState<Combo | null>(null);

  const dishes = useMemo(() => menu.data?.dishes ?? [], [menu.data]);
  const catName = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories]);
  const filtered = dishes.filter((d) => matchesKeyword(d.name, keyword));
  const sync = menu.data?.lastSync;

  const syncMutation = useApiMutation(() => syncChatbotMenu(), {
    invalidate: [qk.chatbot, qk.dishes],
    success: (r) => `Đồng bộ xong: ${r.enabled}/${r.total} món được AI sử dụng`,
  });
  const aiMutation = useApiMutation((v: { id: string; aiEnabled?: boolean; aiTags?: string[] }) => updateDishAi(v.id, v), {
    invalidate: [[...qk.chatbot, 'menu']],
  });
  const deleteComboMutation = useApiMutation((c: Combo) => deleteCombo(c.id), {
    invalidate: [[...qk.chatbot, 'combos']],
    success: 'Đã xóa combo',
    onSuccess: () => setComboDelete(null),
  });

  return (
    <div className="space-y-4">
      <Card padded>
        <CardHeader
          title="Đồng bộ thực đơn"
          description="Lấy dữ liệu món, giá, thành phần, dị nguyên từ Quản lý món ăn. Món “Ngừng bán” tự động bị loại khỏi gợi ý."
          actions={<Button leadingIcon={<RefreshCw size={15} />} loading={syncMutation.isPending} onClick={() => syncMutation.mutate(undefined)}>Đồng bộ ngay</Button>}
        />
        {sync ? (
          <div className="mt-3 space-y-2">
            <p className="text-[13px] text-[var(--text-secondary)]">
              Lần đồng bộ gần nhất <span className="font-mono">{formatDateTime(sync.syncedAt)}</span> · <b>{sync.enabled}</b>/{sync.total} món được AI sử dụng
            </p>
            {sync.missingData.length ? (
              <div className="rounded-item bg-[var(--warning-soft)] px-3 py-2.5 text-[12.5px] text-[var(--warning)]">
                <p className="flex items-center gap-1.5 font-semibold"><AlertTriangle size={14} /> {sync.missingData.length} món thiếu dữ liệu — AI sẽ trả lời “chưa có thông tin xác nhận”:</p>
                <p className="mt-1">{sync.missingData.map((m) => `${m.name} (thiếu ${m.missing.join(', ')})`).join('; ')}</p>
              </div>
            ) : null}
          </div>
        ) : (
          <p className="mt-3 text-[13px] text-[var(--text-muted)]">Chưa đồng bộ trong phiên này.</p>
        )}
      </Card>

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] px-4 py-3 sm:px-5">
          <div>
            <p className="text-[15px] font-semibold">Món & thẻ phân loại cho AI</p>
            <p className="text-[12.5px] text-[var(--text-muted)]">Thẻ giúp AI lọc món theo nhu cầu (ít cay, chay, cho nhóm…).</p>
          </div>
          <SearchInput value={keyword} onChange={setKeyword} placeholder="Tìm món…" className="w-full sm:w-[240px]" />
        </div>
        {menu.isError ? (
          <div className="p-5"><BlockError onRetry={() => void menu.refetch()} /></div>
        ) : menu.isLoading ? (
          <TableSkeleton cols={5} />
        ) : (
          <DataTable minWidth={820}>
            <thead>
              <tr>
                <Th>Món</Th>
                <Th>Danh mục</Th>
                <Th className="text-right">Giá</Th>
                <Th>Thẻ AI</Th>
                <Th className="text-right">AI gợi ý</Th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((d) => (
                <tr key={d.id} className="hover:bg-[var(--bg-subtle)]">
                  <Td>
                    <p className="font-semibold">{d.name}</p>
                    <p className="text-[12px] text-[var(--text-muted)]">
                      {d.status === 'stopped' ? 'Ngừng bán' : d.ingredients ? `${d.allergens.length} dị nguyên khai báo` : <span className="text-[var(--warning)]">Thiếu thành phần</span>}
                    </p>
                  </Td>
                  <Td>{catName.get(d.categoryId) ?? '—'}</Td>
                  <Td className="text-right font-mono">{formatCurrency(d.price)}</Td>
                  <Td><TagEditor dish={d} onSave={(tags) => aiMutation.mutate({ id: d.id, aiTags: tags })} /></Td>
                  <Td className="text-right">
                    <Toggle checked={d.aiEnabled} disabled={d.status === 'stopped'} label={`AI gợi ý ${d.name}`} onChange={(v) => aiMutation.mutate({ id: d.id, aiEnabled: v })} />
                  </Td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        )}
      </Card>

      <Card padded>
        <CardHeader
          title="Combo gợi ý kết hợp"
          description="AI đề xuất combo phù hợp số người hoặc nhu cầu; khách vẫn tự xác nhận từng món."
          actions={<Button size="sm" variant="outline" leadingIcon={<Plus size={14} />} onClick={() => setComboModal({ open: true, combo: null })}>Thêm combo</Button>}
        />
        {combosQuery.isLoading ? (
          <TableSkeleton rows={2} />
        ) : !combosQuery.data?.length ? (
          <EmptyState className="mt-3" title="Chưa có combo gợi ý" />
        ) : (
          <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {combosQuery.data.map((c) => {
              const items = c.dishIds.map((id) => dishes.find((d) => d.id === id)).filter((d): d is Dish => Boolean(d));
              return (
                <div key={c.id} className="rounded-item border border-[var(--border)] p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold">{c.name}</p>
                      <p className="text-[12px] text-[var(--text-muted)]">{c.note || '—'}</p>
                    </div>
                    {!c.active ? <Badge variant="neutral">Tắt</Badge> : null}
                  </div>
                  <ul className="mt-2 space-y-0.5 text-[13px]">
                    {items.map((d) => (
                      <li key={d.id} className="flex justify-between gap-2"><span className="truncate">{d.name}</span><span className="font-mono text-[var(--text-muted)]">{formatCurrency(d.price)}</span></li>
                    ))}
                  </ul>
                  <div className="mt-2 flex items-center justify-between border-t border-[var(--border)] pt-2">
                    <span className="font-mono text-[13px] font-semibold">{formatCurrency(items.reduce((s, d) => s + d.price, 0))}</span>
                    <div className="flex gap-0.5">
                      <Button size="sm" variant="ghost" aria-label={`Sửa ${c.name}`} onClick={() => setComboModal({ open: true, combo: c })}><Pencil size={14} /></Button>
                      <Button size="sm" variant="ghost" aria-label={`Xóa ${c.name}`} onClick={() => setComboDelete(c)}><Trash2 size={14} /></Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <ComboModal state={comboModal} dishes={dishes} onClose={() => setComboModal({ open: false, combo: null })} />
      <ConfirmDialog
        open={Boolean(comboDelete)}
        onOpenChange={(o) => !o && setComboDelete(null)}
        title="Xóa combo?"
        description={`Combo “${comboDelete?.name}” sẽ không còn được AI gợi ý.`}
        confirmLabel="Xóa"
        loading={deleteComboMutation.isPending}
        onConfirm={() => comboDelete && deleteComboMutation.mutate(comboDelete)}
      />
    </div>
  );
}

function TagEditor({ dish, onSave }: { dish: Dish; onSave: (tags: string[]) => void }) {
  const [open, setOpen] = useState(false);
  const [tags, setTags] = useState(dish.aiTags);
  useEffect(() => {
    if (open) setTags(dish.aiTags);
  }, [open, dish.aiTags]);

  return (
    <div className="flex flex-wrap items-center gap-1">
      {dish.aiTags.map((t) => <Badge key={t} variant="info">{t}</Badge>)}
      <Popover.Root open={open} onOpenChange={setOpen}>
        <Popover.Trigger asChild>
          <button type="button" aria-label={`Gắn thẻ cho ${dish.name}`} className="grid h-6 w-6 place-items-center rounded-full text-[var(--text-muted)] hover:bg-[var(--bg-subtle)] hover:text-[var(--accent)]">
            <Tags size={13} />
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content align="start" sideOffset={6} className="z-[80] w-[320px] rounded-item border border-[var(--border)] bg-[var(--bg-surface)] p-3 shadow-overlay">
            <p className="mb-2 text-[13px] font-semibold">Thẻ phân loại – {dish.name}</p>
            <ChipSelect ariaLabel="Chọn thẻ" options={AI_TAG_OPTIONS} value={tags} onChange={setTags} />
            <div className="mt-3 flex justify-end gap-1.5">
              <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Hủy</Button>
              <Button size="sm" onClick={() => { onSave(tags); setOpen(false); }}>Lưu thẻ</Button>
            </div>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </div>
  );
}

function ComboModal({ state, dishes, onClose }: { state: { open: boolean; combo: Combo | null }; dishes: Dish[]; onClose: () => void }) {
  const [form, setForm] = useState<ComboInput>({ name: '', dishIds: [], note: '', active: true });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [kw, setKw] = useState('');

  useEffect(() => {
    if (!state.open) return;
    const c = state.combo;
    setForm(c ? { name: c.name, dishIds: [...c.dishIds], note: c.note, active: c.active } : { name: '', dishIds: [], note: '', active: true });
    setErrors({});
    setKw('');
  }, [state]);

  const mutation = useApiMutation((input: ComboInput) => saveCombo(state.combo?.id ?? null, input), {
    invalidate: [[...qk.chatbot, 'combos']],
    success: state.combo ? 'Đã cập nhật combo' : 'Đã thêm combo gợi ý',
    onFieldErrors: setErrors,
    onSuccess: onClose,
  });

  const selling = dishes.filter((d) => d.status === 'selling' && matchesKeyword(d.name, kw));
  const total = dishes.filter((d) => form.dishIds.includes(d.id)).reduce((s, d) => s + d.price, 0);

  return (
    <Modal
      open={state.open}
      onOpenChange={(o) => !o && onClose()}
      size="md"
      title={state.combo ? 'Sửa combo gợi ý' : 'Thêm combo gợi ý'}
      footer={
        <>
          <span className="mr-auto text-[13px] text-[var(--text-muted)]">{form.dishIds.length} món · <span className="font-mono font-semibold text-[var(--text-primary)]">{formatCurrency(total)}</span></span>
          <Button variant="ghost" onClick={onClose}>Hủy</Button>
          <Button loading={mutation.isPending} onClick={() => mutation.mutate(form)}>Lưu</Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Tên combo" htmlFor="cb-name" required error={errors.name}>
          <TextInput id="cb-name" value={form.name} invalid={Boolean(errors.name)} onChange={(e) => { setForm({ ...form, name: e.target.value }); setErrors({}); }} />
        </Field>
        <Field label="Khi nào AI nên gợi ý" htmlFor="cb-note">
          <TextArea id="cb-note" rows={2} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="VD: khách đi nhóm 4 người, có trẻ nhỏ" />
        </Field>
        <Field label="Món trong combo" required error={errors.dishIds}>
          <SearchInput value={kw} onChange={setKw} placeholder="Lọc món đang bán…" />
          <div className="mt-2 max-h-[220px] space-y-0.5 overflow-y-auto rounded-item border border-[var(--border)] p-1.5">
            {selling.map((d) => {
              const checked = form.dishIds.includes(d.id);
              return (
                <label key={d.id} className="flex cursor-pointer items-center gap-2.5 rounded-[9px] px-2 py-1.5 hover:bg-[var(--bg-subtle)]">
                  <input type="checkbox" checked={checked} onChange={() => { setErrors({}); setForm({ ...form, dishIds: checked ? form.dishIds.filter((x) => x !== d.id) : [...form.dishIds, d.id] }); }} className="h-4 w-4 accent-[var(--accent)]" />
                  <span className="flex-1 text-[13.5px]">{d.name}</span>
                  <span className="font-mono text-[12px] text-[var(--text-muted)]">{formatCurrency(d.price)}</span>
                </label>
              );
            })}
          </div>
        </Field>
        <ToggleRow title="Đang áp dụng" checked={form.active} onChange={(v) => setForm({ ...form, active: v })} />
      </div>
    </Modal>
  );
}
