import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AnimatePresence, motion } from 'motion/react';
import { Check, PaperPlaneRight, Plus, Sparkle, X } from '@phosphor-icons/react';
import { askAssistant, getAssistantIntro, type AssistantIntro, type AssistantReply } from '@/api/ordering';
import { DishImage, Q, SPRING, vnd } from '@/features/ordering/QrParts';
import { cn } from '@/lib/cn';
import type { MenuDish, MenuSet } from '@/types';

/*
 * Trợ lý gọi món trên trang QR (dựa trên luật, chạy ở máy chủ — không dùng AI trả phí).
 * Khách hỏi bằng lời ("2 người dưới 500k", "món không cay cho bé"…) → trợ lý trả lời kèm thẻ món để bấm "Thêm".
 * Trợ lý KHÔNG tự thêm vào giỏ; giỏ vẫn phải bấm "Xác nhận gọi món" và được phục vụ xác nhận như thường.
 * Hội thoại lưu trong sessionStorage theo bàn (đóng tab là mất).
 */

type Msg = { from: 'me'; text: string } | ({ from: 'bot' } & AssistantReply);

/** Lời chào đầu khung chat — từ Quản lý Chatbot (lời chào, câu gợi ý nhanh). */
const welcome = (intro: AssistantIntro): Msg => ({
  from: 'bot',
  text: `${intro.greeting}
Bạn cho mình biết **số người, ngân sách, khẩu vị** hoặc hỏi về một món bất kỳ nhé.`,
  items: [],
  chips: intro.chips,
  addAll: false,
});

/** **đậm**, *nghiêng* / _nghiêng_, xuống dòng. */
function rich(text: string): ReactNode[] {
  return text.split('\n').map((line, i) => (
    <span key={i} className="block">
      {line.split(/(\*\*[^*]+\*\*|\*[^*]+\*|_[^_]+_)/g).map((part, j) =>
        part.startsWith('**') ? <b key={j}>{part.slice(2, -2)}</b>
        : (part.startsWith('*') || part.startsWith('_')) && part.length > 2 ? <i key={j} className="text-[var(--qr-muted)]">{part.slice(1, -1)}</i>
        : part,
      )}
    </span>
  ));
}

export function QrAssistant({
  token, open, onOpen, onClose, dishById, sets, cartDishIds, categoryOf, raised, onAddDish, onOpenDish, onOpenSet,
}: {
  token: string;
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  dishById: Map<string, MenuDish>;
  sets: MenuSet[];
  cartDishIds: string[];
  categoryOf: (d: MenuDish) => string | undefined;
  /** Thanh giỏ đang hiện → nút nổi đẩy lên trên. */
  raised: boolean;
  /** quiet = không báo từng món ("Thêm tất cả" báo một lần). */
  onAddDish: (d: MenuDish, qty: number, quiet?: boolean) => void;
  onOpenDish: (d: MenuDish) => void;
  onOpenSet: (s: MenuSet) => void;
}) {
  const storeKey = `rms-assistant-${token}`;
  const intro = useQuery({ queryKey: ['qr', token, 'assistant'], queryFn: () => getAssistantIntro(token), staleTime: 5 * 60_000, retry: false });
  const [msgs, setMsgs] = useState<Msg[]>(() => {
    try {
      return (JSON.parse(sessionStorage.getItem(storeKey) ?? 'null') as Msg[] | null) ?? [];
    } catch {
      return [];
    }
  });
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [added, setAdded] = useState<Set<string>>(new Set());
  const listRef = useRef<HTMLDivElement>(null);
  const setById = new Map(sets.map((s) => [s.id, s]));

  useEffect(() => { sessionStorage.setItem(storeKey, JSON.stringify(msgs.slice(-30))); }, [msgs, storeKey]);
  useEffect(() => {
    if (open) requestAnimationFrame(() => listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' }));
  }, [msgs, busy, open]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [open, onClose]);

  const send = async (raw: string) => {
    const message = raw.trim().slice(0, 300);
    if (!message || busy) return;
    const history = msgs.filter((m): m is Extract<Msg, { from: 'me' }> => m.from === 'me').slice(-4).map((m) => m.text);
    const shown = msgs.flatMap((m) => (m.from === 'bot' ? m.items.map((x) => x.id) : [])).slice(-30);
    setMsgs((p) => [...p, { from: 'me', text: message }]);
    setInput('');
    setBusy(true);
    try {
      const r = await askAssistant(token, { message, history, shown, cart: cartDishIds });
      setMsgs((p) => [...p, { from: 'bot', ...r }]);
    } catch (e) {
      const text = e instanceof Error && /tạm tắt/.test(e.message) ? e.message : 'Xin lỗi, mình đang bận một chút 😥 Bạn thử lại sau, hoặc bấm chuông gọi nhân viên nhé.';
      setMsgs((p) => [...p, { from: 'bot', text, items: [], chips: [], addAll: false }]);
    } finally {
      setBusy(false);
    }
  };

  const addOne = (msgIndex: number, d: MenuDish, qty: number, quiet = false) => {
    onAddDish(d, qty, quiet);
    setAdded((s) => new Set(s).add(`${msgIndex}:${d.id}`));
  };

  // Quản lý tắt Chatbot (hoặc chưa tải được cấu hình) → không hiện trợ lý.
  if (!intro.data?.active) return null;
  const bot = intro.data;
  const all: Msg[] = [welcome(bot), ...msgs];
  const last = all[all.length - 1];
  const chips = last.from === 'bot' ? last.chips : [];

  return (
    <>
      {/* Nút nổi */}
      <AnimatePresence>
        {!open ? (
          <motion.button
            key="fab"
            type="button"
            aria-label="Trợ lý gọi món"
            initial={{ scale: 0 }}
            animate={{ scale: 1, bottom: raised ? 92 : 20 }}
            exit={{ scale: 0 }}
            transition={SPRING}
            whileTap={{ scale: 0.9 }}
            onClick={onOpen}
            className="fixed right-[max(16px,calc(50vw-224px))] z-30 flex h-14 items-center gap-2 rounded-full bg-[var(--qr-surface)] pl-3.5 pr-4 text-[14px] font-semibold text-[var(--qr-text)] shadow-[0_8px_28px_rgba(0,0,0,0.22)] ring-1 ring-[var(--qr-border)]"
          >
            <span className="grid h-9 w-9 place-items-center rounded-full bg-[var(--qr-primary)] text-[20px] text-white">{bot.avatar || <Sparkle size={20} weight="fill" />}</span>
            Tư vấn món
          </motion.button>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {open ? (
          <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true" aria-label="Trợ lý gọi món">
            <motion.button type="button" aria-label="Đóng" className="absolute inset-0 bg-[var(--qr-overlay)]" onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
            <motion.div
              className="relative flex h-[88dvh] w-full max-w-[480px] flex-col overflow-hidden rounded-t-[28px] bg-[var(--qr-bg)]"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={SPRING}
            >
              <header className="flex items-center gap-3 border-b border-[var(--qr-border)] px-5 py-3.5">
                <span className="grid h-10 w-10 place-items-center rounded-full bg-[var(--qr-primary)] text-[22px] text-white">{bot.avatar || <Sparkle size={22} weight="fill" />}</span>
                <div className="min-w-0 flex-1 leading-tight">
                  <p className="text-[16px] font-semibold">{bot.botName} · trợ lý gọi món</p>
                  <p className="text-[12px] text-[var(--qr-muted)]">Gợi ý theo thực đơn hôm nay · bạn tự bấm thêm vào giỏ</p>
                </div>
                <button type="button" className={cn(Q.iconBtn, 'h-10 w-10')} aria-label="Đóng" onClick={onClose}><X size={20} /></button>
              </header>

              <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
                {all.map((m, i) =>
                  m.from === 'me' ? (
                    <div key={i} className="flex justify-end">
                      <p className="max-w-[80%] rounded-[18px] rounded-br-md bg-[var(--qr-primary)] px-3.5 py-2 text-[14.5px] text-white">{m.text}</p>
                    </div>
                  ) : (
                    <div key={i} className="space-y-2">
                      <div className="max-w-[88%] rounded-[18px] rounded-bl-md bg-[var(--qr-surface)] px-3.5 py-2.5 text-[14.5px] leading-relaxed shadow-[var(--qr-shadow)]">
                        {rich(m.text)}
                        {m.source === 'ai' ? <span className="mt-1 block text-[11px] text-[var(--qr-muted)]">✨ Gemini AI · có thể chưa chính xác, hỏi nhân viên khi cần</span> : null}
                      </div>
                      {m.items.length ? (
                        <div className="space-y-2">
                          {m.items.map((it) => {
                            if (it.kind === 'set') {
                              const s = setById.get(it.id);
                              if (!s) return null;
                              return (
                                <div key={`s${it.id}`} className={cn(Q.card, 'flex items-center gap-3 p-2.5')}>
                                  <button type="button" onClick={() => onOpenSet(s)} className="min-w-0 flex-1 text-left">
                                    <p className="truncate text-[14.5px] font-semibold">🍱 {s.name}</p>
                                    <p className="text-[13px] text-[var(--qr-muted)]">{vnd(s.price)}{it.note ? ` · ${it.note}` : ''}</p>
                                  </button>
                                  <button type="button" onClick={() => onOpenSet(s)} className="rounded-full bg-[var(--qr-surface-2)] px-3.5 py-2 text-[13px] font-semibold">Xem set</button>
                                </div>
                              );
                            }
                            const d = dishById.get(it.id);
                            if (!d) return null;
                            const done = added.has(`${i}:${d.id}`);
                            return (
                              <div key={`d${it.id}`} className={cn(Q.card, 'flex items-center gap-3 p-2')}>
                                <button type="button" onClick={() => onOpenDish(d)} className="h-14 w-14 shrink-0 overflow-hidden rounded-[14px]" aria-label={`Xem ${d.name}`}>
                                  <DishImage dish={d} categoryName={categoryOf(d)} className="h-full w-full" emojiSize={26} soldOut={d.soldOut} />
                                </button>
                                <button type="button" onClick={() => onOpenDish(d)} className="min-w-0 flex-1 text-left leading-tight">
                                  <p className="line-clamp-2 text-[14px] font-semibold">{d.name}</p>
                                  <p className="mt-0.5 text-[12.5px] text-[var(--qr-muted)]">
                                    <b className="text-[var(--qr-text)]">{vnd(d.price)}</b>{it.qty > 1 ? ` × ${it.qty}` : ''}{it.note ? ` · ${it.note}` : ''}
                                  </p>
                                </button>
                                <motion.button
                                  whileTap={{ scale: 0.9 }}
                                  type="button"
                                  disabled={d.soldOut}
                                  onClick={() => addOne(i, d, it.qty)}
                                  className={cn('inline-flex shrink-0 items-center gap-1 rounded-full px-3 py-2 text-[13px] font-semibold disabled:opacity-40', done ? 'bg-[var(--qr-surface-2)] text-[var(--qr-text)]' : 'bg-[var(--qr-primary)] text-white')}
                                >
                                  {done ? <Check size={14} weight="bold" /> : <Plus size={14} weight="bold" />}{done ? 'Đã thêm' : it.qty > 1 ? `Thêm ${it.qty}` : 'Thêm'}
                                </motion.button>
                              </div>
                            );
                          })}
                          {m.addAll ? (() => {
                            const rest = m.items.flatMap((it) => {
                              const d = it.kind === 'dish' ? dishById.get(it.id) : undefined;
                              return d && !d.soldOut && !added.has(`${i}:${d.id}`) ? [{ d, qty: it.qty }] : [];
                            });
                            return (
                              <button
                                type="button"
                                disabled={!rest.length}
                                className={cn(Q.btn, 'w-full py-3 text-[14px]')}
                                onClick={() => {
                                  rest.forEach(({ d, qty }) => addOne(i, d, qty, true));
                                  toast.success(`Đã thêm ${rest.reduce((s2, x) => s2 + x.qty, 0)} phần vào giỏ`);
                                }}
                              >
                                {rest.length ? <><Plus size={16} weight="bold" />Thêm tất cả vào giỏ</> : <><Check size={16} weight="bold" />Đã thêm vào giỏ</>}
                              </button>
                            );
                          })() : null}
                        </div>
                      ) : null}
                    </div>
                  ),
                )}
                {busy ? (
                  <div className="flex w-16 items-center justify-center gap-1 rounded-[18px] bg-[var(--qr-surface)] px-3 py-3">
                    {[0, 1, 2].map((k) => <motion.span key={k} className="h-1.5 w-1.5 rounded-full bg-[var(--qr-muted)]" animate={{ y: [0, -4, 0] }} transition={{ repeat: Infinity, duration: 0.8, delay: k * 0.15 }} />)}
                  </div>
                ) : null}
              </div>

              {chips.length && !busy ? (
                <div className="flex gap-2 overflow-x-auto px-4 pb-2 [scrollbar-width:none]">
                  {chips.map((c) => (
                    <button key={c} type="button" onClick={() => void send(c)} className="shrink-0 rounded-full border border-[var(--qr-border)] bg-[var(--qr-surface)] px-3.5 py-1.5 text-[13px] font-medium">{c}</button>
                  ))}
                </div>
              ) : null}
              <form className="flex items-center gap-2 border-t border-[var(--qr-border)] px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-3" onSubmit={(e) => { e.preventDefault(); void send(input); }}>
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  maxLength={300}
                  placeholder="VD: 2 người, dưới 500k, không cay"
                  className={cn(Q.input, 'flex-1 rounded-full py-2.5')}
                  aria-label="Câu hỏi cho trợ lý"
                />
                <motion.button whileTap={{ scale: 0.9 }} type="submit" disabled={!input.trim() || busy} aria-label="Gửi" className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[var(--qr-primary)] text-white disabled:opacity-40">
                  <PaperPlaneRight size={20} weight="fill" />
                </motion.button>
              </form>
            </motion.div>
          </div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
