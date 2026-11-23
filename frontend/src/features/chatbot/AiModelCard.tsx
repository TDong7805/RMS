import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { CheckCircle2, PlugZap, Sparkles, XCircle } from 'lucide-react';
import { Card, CardHeader } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { Field, TextArea, TextInput, ToggleRow } from '@/components/common/Form';
import { Skeleton } from '@/components/common/Skeleton';
import { api } from '@/lib/http';
import { ValidationError } from '@/lib/mock';

export interface AiConfig {
  enabled: boolean; provider: string; modelName: string; temperature: number; maxTokens: number;
  systemPrompt: string; apiKeyRef: string; keyPresent: boolean;
}
type TestResult = { ok: boolean; message: string; millis: number; reply: string };
const KEY = ['chatbot', 'ai'];

/**
 * Quản lý Chatbot → Cấu hình: trợ lý gọi món trên trang QR dùng Google Gemini (khi bật + máy chủ có key).
 * Key KHÔNG nhập ở đây: đặt biến môi trường trên máy chủ (vd. setx GEMINI_API_KEY "...") rồi khởi động lại backend.
 * Gemini lỗi / hết lượt / chưa có key → trợ lý tự trả lời theo luật.
 */
export function AiModelCard() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: KEY, queryFn: () => api.get<AiConfig>('/api/chatbot/ai') });
  const [f, setF] = useState<{ enabled: boolean; modelName: string; temperature: string; maxTokens: string; systemPrompt: string; apiKeyRef: string } | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [test, setTest] = useState<TestResult | null>(null);
  useEffect(() => {
    if (q.data) setF({ enabled: q.data.enabled, modelName: q.data.modelName, temperature: String(q.data.temperature), maxTokens: String(q.data.maxTokens), systemPrompt: q.data.systemPrompt, apiKeyRef: q.data.apiKeyRef });
  }, [q.data]);
  const save = useMutation({
    mutationFn: () => api.put<AiConfig>('/api/chatbot/ai', { ...f, temperature: Number(f!.temperature.replace(',', '.')), maxTokens: Number(f!.maxTokens) }),
    onSuccess: (d) => { qc.setQueryData(KEY, d); setErrors({}); toast.success('Đã lưu cấu hình AI'); },
    onError: (e) => (e instanceof ValidationError ? setErrors(e.fields) : toast.error(e instanceof Error ? e.message : 'Không lưu được')),
  });
  const run = useMutation({ mutationFn: () => api.post<TestResult>('/api/chatbot/ai/test'), onSuccess: setTest });
  const set = (k: keyof NonNullable<typeof f>, v: string | boolean) => { setF((x) => (x ? { ...x, [k]: v } : x)); setErrors((e) => ({ ...e, [k]: '' })); };
  const d = q.data;

  return (
    <Card padded>
      <CardHeader
        title="Trí tuệ nhân tạo (Google Gemini)"
        icon={<Sparkles size={17} />}
        description="Trợ lý gọi món trên trang QR trả lời bằng Gemini, dựa trên thực đơn hôm nay, FAQ và cấu hình ở trên. Gemini lỗi, hết lượt hoặc chưa có key thì trợ lý tự trả lời theo luật."
      />
      {!f || !d ? <Skeleton className="mt-4 h-48" /> : (
        <div className="mt-4 space-y-4">
          <div className={`flex items-start gap-2 rounded-item px-3 py-2.5 text-[13px] ${d.keyPresent ? 'bg-[var(--success-soft)] text-[var(--success)]' : 'bg-[var(--warning-soft)] text-[var(--warning)]'}`}>
            {d.keyPresent ? <CheckCircle2 size={16} className="mt-0.5 shrink-0" /> : <XCircle size={16} className="mt-0.5 shrink-0" />}
            <span>
              {d.keyPresent
                ? <>Máy chủ đã có key trong biến môi trường <b className="font-mono">{d.apiKeyRef}</b>.</>
                : <>Máy chủ chưa có biến môi trường <b className="font-mono">{d.apiKeyRef}</b>. Lấy key ở Google AI Studio, chạy <code className="font-mono">setx {d.apiKeyRef} "khóa"</code> trên máy chủ rồi khởi động lại backend. Không dán key vào trang này.</>}
            </span>
          </div>
          <ToggleRow title="Dùng Gemini cho trợ lý gọi món" description="Tắt: trợ lý chỉ trả lời theo luật (miễn phí, không cần mạng)." checked={f.enabled} onChange={(v) => set('enabled', v)} />
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Model" htmlFor="ai-model" error={errors.modelName} hint="vd. gemini-3.5-flash-lite (nhanh, có gói miễn phí)">
              <TextInput id="ai-model" value={f.modelName} onChange={(e) => set('modelName', e.target.value)} invalid={Boolean(errors.modelName)} />
            </Field>
            <Field label="Độ sáng tạo (0–1)" htmlFor="ai-temp" error={errors.temperature} hint="Thấp = bám sát dữ liệu">
              <TextInput id="ai-temp" inputMode="decimal" value={f.temperature} onChange={(e) => set('temperature', e.target.value)} invalid={Boolean(errors.temperature)} />
            </Field>
            <Field label="Biến môi trường chứa key" htmlFor="ai-ref" error={errors.apiKeyRef} hint="Chỉ ghi TÊN biến">
              <TextInput id="ai-ref" value={f.apiKeyRef} onChange={(e) => set('apiKeyRef', e.target.value)} invalid={Boolean(errors.apiKeyRef)} className="font-mono" />
            </Field>
          </div>
          <Field label="Hướng dẫn thêm cho AI (không bắt buộc)" htmlFor="ai-prompt" error={errors.systemPrompt} hint="vd. Ưu tiên giới thiệu set menu cho nhóm từ 4 người; không gợi ý rượu cho khách đi cùng trẻ em.">
            <TextArea id="ai-prompt" rows={3} maxLength={2000} value={f.systemPrompt} onChange={(e) => set('systemPrompt', e.target.value)} />
          </Field>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" loading={save.isPending} onClick={() => save.mutate()}>Lưu cấu hình AI</Button>
            <Button type="button" variant="outline" leadingIcon={<PlugZap size={15} />} loading={run.isPending} onClick={() => run.mutate()}>Thử kết nối</Button>
          </div>
          {test ? (
            <div className={`rounded-item px-3 py-2.5 text-[13px] ${test.ok ? 'bg-[var(--success-soft)]' : 'bg-[var(--danger-soft)] text-[var(--danger)]'}`}>
              <b>{test.message}</b>{test.millis ? ` · ${(test.millis / 1000).toFixed(1)} giây` : ''}
              {test.reply ? <p className="mt-1 text-[var(--text-secondary)]">Gemini: “{test.reply}”</p> : null}
            </div>
          ) : null}
        </div>
      )}
    </Card>
  );
}
