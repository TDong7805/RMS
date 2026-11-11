import { useEffect, useState } from 'react';
import { Plus, Save, ShieldAlert, X } from 'lucide-react';
import { Card, CardHeader } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { BlockError } from '@/components/common/EmptyState';
import { Field, SelectInput, TextArea, TextInput, ToggleRow } from '@/components/common/Form';
import { Skeleton } from '@/components/common/Skeleton';
import { updateChatbotConfig } from '@/api/chatbot';
import { qk, useChatbotConfig } from '@/features/management/queries';
import { useApiMutation } from '@/hooks/use-api-mutation';
import { cn } from '@/lib/cn';
import { BOT_TONE, FALLBACK_ACTION, formatDateTime } from '@/lib/labels';
import type { BotTone, ChatbotConfig, FallbackAction } from '@/types';

type FormState = Omit<ChatbotConfig, 'updatedAt'>;
const AVATARS = ['🪷', '🤖', '👩‍🍳', '🍜', '🌿', '😊'];

/** Luồng A — Cấu hình Chatbot: tên & avatar, gợi ý nhanh, câu chào, xử lý ngoài phạm vi, tính cách. */
export function ChatbotConfigTab() {
  const query = useChatbotConfig();
  const [form, setForm] = useState<FormState | null>(null);
  const [newReply, setNewReply] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const load = (c: ChatbotConfig) => {
    const { updatedAt, ...rest } = c;
    void updatedAt;
    setForm({ ...rest, quickReplies: [...rest.quickReplies] });
    setErrors({});
  };

  useEffect(() => {
    if (query.data && !form) load(query.data);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query.data]);

  const mutation = useApiMutation(updateChatbotConfig, {
    invalidate: [[...qk.chatbot, 'config']],
    success: 'Đã lưu cấu hình. Chatbot áp dụng từ phiên chat tiếp theo.',
    onFieldErrors: setErrors,
    onSuccess: load,
  });

  if (query.isError) return <BlockError onRetry={() => void query.refetch()} />;
  if (!form) return <Skeleton className="h-[420px] w-full" />;

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => {
    setForm((p) => (p ? { ...p, [k]: v } : p));
    setErrors((p) => ({ ...p, [k]: '' }));
  };

  const addReply = () => {
    const text = newReply.trim();
    if (!text) return;
    if (form.quickReplies.length >= 6) return setErrors((p) => ({ ...p, quickReplies: 'Tối đa 6 gợi ý nhanh' }));
    set('quickReplies', [...form.quickReplies, text]);
    setNewReply('');
  };

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        mutation.mutate(form);
      }}
      className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_360px]"
    >
      <div className="min-w-0 space-y-4">
        <Card padded>
          <CardHeader title="Tên & avatar" description={query.data ? `Cập nhật lần cuối ${formatDateTime(query.data.updatedAt)}` : undefined} />
          <div className="mt-4 grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto]">
            <Field label="Tên trợ lý" htmlFor="bot-name" required error={errors.botName}>
              <TextInput id="bot-name" value={form.botName} maxLength={30} invalid={Boolean(errors.botName)} onChange={(e) => set('botName', e.target.value)} />
            </Field>
            <Field label="Avatar">
              <div className="flex gap-1.5">
                {AVATARS.map((a) => (
                  <button key={a} type="button" aria-pressed={form.avatar === a} onClick={() => set('avatar', a)} className={cn('grid h-10 w-10 place-items-center rounded-control border text-[20px]', form.avatar === a ? 'border-[var(--accent)] bg-[var(--accent-soft)]' : 'border-[var(--border-strong)]')}>
                    {a}
                  </button>
                ))}
              </div>
            </Field>
          </div>
          <div className="mt-4">
            <ToggleRow title="Bật Chatbot AI trên QR Menu" description="Tắt để ẩn khung chat với khách; khách vẫn xem thực đơn và gọi nhân viên bình thường." checked={form.active} onChange={(v) => set('active', v)} />
          </div>
        </Card>

        <Card padded>
          <CardHeader title="Hội thoại" />
          <div className="mt-4 space-y-4">
            <Field label="Câu chào mừng" htmlFor="bot-greet" required error={errors.greeting} hint={`${form.greeting.length}/300 ký tự`}>
              <TextArea id="bot-greet" rows={2} maxLength={300} value={form.greeting} invalid={Boolean(errors.greeting)} onChange={(e) => set('greeting', e.target.value)} />
            </Field>
            <Field label="Gợi ý nhanh" error={errors.quickReplies} hint="Nút bấm gợi ý câu hỏi hiển thị dưới câu chào (tối đa 6)">
              <div className="flex flex-wrap gap-1.5">
                {form.quickReplies.map((r, i) => (
                  <span key={`${r}-${i}`} className="inline-flex items-center gap-1 rounded-pill border border-[var(--accent)] bg-[var(--accent-soft)] py-1 pl-3 pr-1.5 text-[12.5px] font-medium text-[var(--accent)]">
                    {r}
                    <button type="button" aria-label={`Xóa gợi ý ${r}`} onClick={() => set('quickReplies', form.quickReplies.filter((_, j) => j !== i))} className="grid h-5 w-5 place-items-center rounded-full hover:bg-[var(--accent)]/15">
                      <X size={12} />
                    </button>
                  </span>
                ))}
              </div>
              <div className="mt-2 flex gap-2">
                <TextInput
                  value={newReply}
                  maxLength={30}
                  aria-label="Gợi ý nhanh mới"
                  placeholder="VD: Món cho trẻ em"
                  onChange={(e) => setNewReply(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addReply();
                    }
                  }}
                />
                <Button variant="outline" leadingIcon={<Plus size={14} />} onClick={addReply}>Thêm</Button>
              </div>
            </Field>
          </div>
        </Card>

        <Card padded>
          <CardHeader title="Xử lý ngoài phạm vi & tính cách" />
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="Câu trả lời khi không hiểu / thiếu dữ liệu" htmlFor="bot-fb" required error={errors.fallbackMessage} className="sm:col-span-2">
              <TextArea id="bot-fb" rows={2} value={form.fallbackMessage} invalid={Boolean(errors.fallbackMessage)} onChange={(e) => set('fallbackMessage', e.target.value)} />
            </Field>
            <Field label="Hành động kèm theo" htmlFor="bot-fba">
              <SelectInput id="bot-fba" value={form.fallbackAction} onChange={(e) => set('fallbackAction', e.target.value as FallbackAction)} options={(Object.keys(FALLBACK_ACTION) as FallbackAction[]).map((k) => ({ value: k, label: FALLBACK_ACTION[k] }))} />
            </Field>
            <Field label="Tone giọng" htmlFor="bot-tone" hint={BOT_TONE[form.tone].description}>
              <SelectInput id="bot-tone" value={form.tone} onChange={(e) => set('tone', e.target.value as BotTone)} options={(Object.keys(BOT_TONE) as BotTone[]).map((k) => ({ value: k, label: BOT_TONE[k].label }))} />
            </Field>
            <Field label="Mô tả tính cách / phong cách giao tiếp" htmlFor="bot-per" error={errors.personality} className="sm:col-span-2">
              <TextArea id="bot-per" rows={3} maxLength={500} value={form.personality} invalid={Boolean(errors.personality)} onChange={(e) => set('personality', e.target.value)} />
            </Field>
            <Field label="Cảnh báo dị ứng (bắt buộc)" htmlFor="bot-allergy" required error={errors.allergyDisclaimer} className="sm:col-span-2" hint="Tự động gắn vào mọi câu trả lời có nhắc đến dị ứng">
              <TextArea id="bot-allergy" rows={2} value={form.allergyDisclaimer} invalid={Boolean(errors.allergyDisclaimer)} onChange={(e) => set('allergyDisclaimer', e.target.value)} />
            </Field>
          </div>
        </Card>

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => query.data && load(query.data)} disabled={mutation.isPending}>Hoàn tác</Button>
          <Button type="submit" loading={mutation.isPending} leadingIcon={<Save size={15} />}>Lưu cấu hình</Button>
        </div>
      </div>

      <div className="h-fit space-y-3 xl:sticky xl:top-[132px]">
        <Card padded>
          <p className="overline">Xem trước khung chat</p>
          <div className="mt-3 rounded-item border border-[var(--border)] bg-[var(--bg-subtle)]">
            <div className="flex items-center gap-2 border-b border-[var(--border)] px-3 py-2.5">
              <span className="grid h-8 w-8 place-items-center rounded-full bg-[var(--bg-surface)] text-[17px]">{form.avatar}</span>
              <div>
                <p className="text-[13.5px] font-bold">{form.botName || 'Trợ lý'}</p>
                <p className="text-[11px] text-[var(--text-muted)]">{form.active ? 'Đang hoạt động' : 'Đã tắt'}</p>
              </div>
            </div>
            <div className="space-y-2 p-3">
              <p className="max-w-[90%] rounded-[14px] rounded-tl-[4px] bg-[var(--bg-surface)] px-3 py-2 text-[12.5px] leading-5">{form.greeting}</p>
              <div className="flex flex-wrap gap-1">
                {form.quickReplies.map((r, i) => (
                  <span key={i} className="rounded-pill border border-[var(--accent)] px-2.5 py-0.5 text-[11.5px] text-[var(--accent)]">{r}</span>
                ))}
              </div>
              <p className="ml-auto max-w-[80%] rounded-[14px] rounded-tr-[4px] bg-[var(--accent)] px-3 py-2 text-[12.5px] text-[var(--accent-contrast)]">Có wifi miễn phí không?</p>
              <p className="max-w-[90%] rounded-[14px] rounded-tl-[4px] bg-[var(--bg-surface)] px-3 py-2 text-[12.5px] leading-5">{form.fallbackMessage}</p>
            </div>
          </div>
        </Card>
        <div className="flex gap-2 rounded-item bg-[var(--warning-soft)] px-3 py-2.5 text-[12px] leading-5 text-[var(--warning)]">
          <ShieldAlert size={16} className="mt-0.5 shrink-0" />
          <span>Nguyên tắc cố định: AI chỉ tư vấn; không tự thêm món khi khách chưa xác nhận, không tự gửi đơn và không thực hiện thanh toán.</span>
        </div>
      </div>
    </form>
  );
}
