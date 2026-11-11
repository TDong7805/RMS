import { useEffect, useState } from 'react';
import { HelpCircle, MessageCircleQuestion, Pencil, Plus, Trash2, X } from 'lucide-react';
import { Card, CardHeader } from '@/components/common/Card';
import { Badge } from '@/components/common/Badge';
import { Button } from '@/components/common/Button';
import { BlockError, EmptyState } from '@/components/common/EmptyState';
import { Field, SearchInput, SelectInput, TextArea, TextInput, ToggleRow } from '@/components/common/Form';
import { ConfirmDialog, Modal } from '@/components/common/Modal';
import { TableSkeleton } from '@/components/common/PageParts';
import { deleteFaq, dismissUnanswered, saveFaq } from '@/api/chatbot';
import { qk, useFaqs, useUnanswered } from '@/features/management/queries';
import { useApiMutation } from '@/hooks/use-api-mutation';
import { cn } from '@/lib/cn';
import { formatRelativeTime } from '@/lib/format';
import { matchesKeyword } from '@/lib/normalize';
import type { Faq, FaqCategory, FaqInput, UnansweredQuestion } from '@/types';

type ModalState = { open: boolean; faq: Faq | null; preset?: UnansweredQuestion };

/** Luồng C — Quản lý FAQ: thêm/sửa/xóa, phân loại danh mục, include “Xem câu hỏi chưa giải đáp”. */
export function ChatbotFaqTab() {
  const query = useFaqs();
  const unanswered = useUnanswered();
  const [categoryId, setCategoryId] = useState('');
  const [keyword, setKeyword] = useState('');
  const [modal, setModal] = useState<ModalState>({ open: false, faq: null });
  const [toDelete, setToDelete] = useState<Faq | null>(null);

  const deleteMutation = useApiMutation((f: Faq) => deleteFaq(f.id), {
    invalidate: [[...qk.chatbot, 'faqs']],
    success: 'Đã xóa FAQ',
    onSuccess: () => setToDelete(null),
  });
  const dismissMutation = useApiMutation((id: string) => dismissUnanswered(id), {
    invalidate: [[...qk.chatbot, 'unanswered']],
    success: 'Đã bỏ qua câu hỏi',
  });

  const categories = query.data?.categories ?? [];
  const catName = new Map(categories.map((c) => [c.id, c.name]));
  const faqs = (query.data?.faqs ?? [])
    .filter((f) => !categoryId || f.categoryId === categoryId)
    .filter((f) => matchesKeyword(f.question, keyword) || matchesKeyword(f.answer, keyword));

  return (
    <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
      <Card className="min-w-0 overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b border-[var(--border)] px-4 py-3 sm:px-5">
          <SearchInput value={keyword} onChange={setKeyword} placeholder="Tìm câu hỏi, câu trả lời…" className="w-full sm:w-[240px]" />
          <SelectInput aria-label="Lọc danh mục FAQ" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} placeholder="Mọi danh mục" options={categories.map((c) => ({ value: c.id, label: c.name }))} className="w-full sm:w-[200px]" />
          <Button size="sm" className="ml-auto" leadingIcon={<Plus size={14} />} onClick={() => setModal({ open: true, faq: null })}>Thêm FAQ</Button>
        </div>
        {query.isError ? (
          <div className="p-5"><BlockError onRetry={() => void query.refetch()} /></div>
        ) : query.isLoading ? (
          <TableSkeleton rows={5} cols={2} />
        ) : faqs.length === 0 ? (
          <div className="p-5"><EmptyState icon={HelpCircle} title="Không có FAQ phù hợp" /></div>
        ) : (
          <ul className="divide-y divide-[var(--border)]">
            {faqs.map((f) => (
              <li key={f.id} className={cn('flex gap-3 px-4 py-3.5 sm:px-5', !f.active && 'opacity-60')}>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge variant="neutral">{catName.get(f.categoryId) ?? '—'}</Badge>
                    {!f.active ? <Badge variant="warning">Đang tắt</Badge> : null}
                  </div>
                  <p className="mt-1 text-[14px] font-semibold">{f.question}</p>
                  <p className="mt-0.5 text-[13px] leading-5 text-[var(--text-secondary)]">{f.answer}</p>
                </div>
                <div className="flex shrink-0 gap-0.5">
                  <Button size="sm" variant="ghost" aria-label="Sửa FAQ" onClick={() => setModal({ open: true, faq: f })}><Pencil size={14} /></Button>
                  <Button size="sm" variant="ghost" aria-label="Xóa FAQ" onClick={() => setToDelete(f)}><Trash2 size={14} /></Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card padded className="h-fit">
        <CardHeader title="Câu hỏi chưa giải đáp" icon={<MessageCircleQuestion size={17} />} description="Khách hay hỏi nhưng bot chưa trả lời được." />
        {unanswered.isLoading ? (
          <TableSkeleton rows={3} cols={1} />
        ) : !unanswered.data?.length ? (
          <EmptyState className="mt-3" title="Không còn câu hỏi tồn đọng" />
        ) : (
          <ul className="mt-3 space-y-2">
            {unanswered.data.map((u) => (
              <li key={u.id} className="rounded-item border border-[var(--border)] px-3 py-2.5">
                <p className="text-[13.5px] font-semibold">{u.question}</p>
                <p className="mt-0.5 text-[12px] text-[var(--text-muted)]"><span className="font-mono font-semibold text-[var(--warning)]">{u.askedCount}</span> lượt hỏi · {formatRelativeTime(u.lastAskedAt)}</p>
                <div className="mt-2 flex gap-1.5">
                  <Button size="sm" variant="secondary" leadingIcon={<Plus size={13} />} onClick={() => setModal({ open: true, faq: null, preset: u })}>Tạo FAQ</Button>
                  <Button size="sm" variant="ghost" leadingIcon={<X size={13} />} onClick={() => dismissMutation.mutate(u.id)}>Bỏ qua</Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <FaqModal state={modal} categories={categories} unanswered={unanswered.data ?? []} onClose={() => setModal({ open: false, faq: null })} />
      <ConfirmDialog
        open={Boolean(toDelete)}
        onOpenChange={(o) => !o && setToDelete(null)}
        title="Xóa FAQ?"
        description={`“${toDelete?.question}” sẽ bị xóa khỏi kho tri thức của chatbot.`}
        confirmLabel="Xóa"
        loading={deleteMutation.isPending}
        onConfirm={() => toDelete && deleteMutation.mutate(toDelete)}
      />
    </div>
  );
}

function FaqModal({ state, categories, unanswered, onClose }: { state: ModalState; categories: FaqCategory[]; unanswered: UnansweredQuestion[]; onClose: () => void }) {
  const [form, setForm] = useState<FaqInput>({ question: '', answer: '', categoryId: '', active: true, fromUnansweredId: null });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!state.open) return;
    const f = state.faq;
    setForm(
      f
        ? { question: f.question, answer: f.answer, categoryId: f.categoryId, active: f.active, fromUnansweredId: null }
        : { question: state.preset?.question ?? '', answer: '', categoryId: '', active: true, fromUnansweredId: state.preset?.id ?? null },
    );
    setErrors({});
  }, [state]);

  const mutation = useApiMutation((input: FaqInput) => saveFaq(state.faq?.id ?? null, input), {
    invalidate: [[...qk.chatbot, 'faqs'], [...qk.chatbot, 'unanswered']],
    success: state.faq ? 'Đã cập nhật FAQ' : 'Đã thêm FAQ, chatbot sẽ dùng ở phiên tiếp theo',
    onFieldErrors: setErrors,
    onSuccess: onClose,
  });

  const set = <K extends keyof FaqInput>(k: K, v: FaqInput[K]) => {
    setForm((p) => ({ ...p, [k]: v }));
    setErrors((p) => ({ ...p, [k]: '' }));
  };

  return (
    <Modal
      open={state.open}
      onOpenChange={(o) => !o && onClose()}
      size="lg"
      title={state.faq ? 'Sửa FAQ' : 'Thêm FAQ'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Hủy</Button>
          <Button loading={mutation.isPending} onClick={() => mutation.mutate(form)}>Lưu</Button>
        </>
      }
    >
      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_240px]">
        <div className="space-y-4">
          <Field label="Câu hỏi" htmlFor="faq-q" required error={errors.question}>
            <TextInput id="faq-q" value={form.question} maxLength={200} invalid={Boolean(errors.question)} onChange={(e) => set('question', e.target.value)} />
          </Field>
          <Field label="Câu trả lời" htmlFor="faq-a" required error={errors.answer} hint={`${form.answer.length}/1000 ký tự`}>
            <TextArea id="faq-a" rows={5} maxLength={1000} value={form.answer} invalid={Boolean(errors.answer)} onChange={(e) => set('answer', e.target.value)} />
          </Field>
          <Field label="Danh mục" htmlFor="faq-c" required error={errors.categoryId}>
            <SelectInput id="faq-c" value={form.categoryId} invalid={Boolean(errors.categoryId)} onChange={(e) => set('categoryId', e.target.value)} placeholder="— Chọn danh mục —" options={categories.map((c) => ({ value: c.id, label: c.name }))} />
          </Field>
          <ToggleRow title="Đang áp dụng" checked={form.active} onChange={(v) => set('active', v)} />
        </div>
        <div>
          <p className="mb-1.5 text-[13px] font-semibold">Câu hỏi chưa giải đáp</p>
          <p className="mb-2 text-[12px] text-[var(--text-muted)]">Bấm để dùng làm câu hỏi FAQ.</p>
          <ul className="max-h-[320px] space-y-1.5 overflow-y-auto">
            {unanswered.length === 0 ? <li className="text-[12.5px] text-[var(--text-muted)]">Không có.</li> : null}
            {unanswered.map((u) => (
              <li key={u.id}>
                <button
                  type="button"
                  onClick={() => setForm((p) => ({ ...p, question: u.question, fromUnansweredId: u.id }))}
                  className={cn('w-full rounded-[10px] border px-2.5 py-2 text-left text-[12.5px] transition-colors', form.fromUnansweredId === u.id ? 'border-[var(--accent)] bg-[var(--accent-soft)]' : 'border-[var(--border)] hover:border-[var(--accent)]')}
                >
                  {u.question}
                  <span className="mt-0.5 block font-mono text-[11px] text-[var(--text-muted)]">{u.askedCount} lượt hỏi</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Modal>
  );
}
