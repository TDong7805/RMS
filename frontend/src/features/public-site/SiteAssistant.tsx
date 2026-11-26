import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { BookOpen, CalendarCheck, MapPin, MessageCircle, RotateCcw, SendHorizontal, Sparkles, X } from 'lucide-react';
import { askSiteAssistant, getSiteAssistant } from '@/api/public-site';
import { cn } from '@/lib/cn';
import { formatCurrency } from '@/lib/format';
import type { SiteAssistantAction, SiteAssistantCard, SiteAssistantIntro, SiteAssistantReply } from '@/types';

/*
 * Chatbot tư vấn trên website khách hàng (nút nổi góc phải mọi trang của PublicLayout).
 * Cùng bộ não với trợ lý gọi món tại bàn (Gemini, dự phòng trả lời theo luật — máy chủ), nhưng khách chưa tới quán:
 * không có giỏ; bấm thẻ món → mở sách thực đơn tới đúng món (/thuc-don?mon=… | ?set=…); nút "Đặt bàn" / "Liên hệ".
 * Hội thoại lưu trong sessionStorage (đóng tab là mất); mỗi tab là một hội thoại trong "Lịch sử hội thoại" của Quản lý Chatbot.
 */

type Msg = { from: 'me'; text: string } | ({ from: 'bot' } & SiteAssistantReply);

const STORE_KEY = 'rms-site-assistant';
const SESSION_KEY = 'rms-site-assistant-session';
const MAX_KEEP = 30;

const welcome = (intro: SiteAssistantIntro): Msg => ({
  from: 'bot',
  text: `${intro.greeting}
Bạn cho mình biết **số người, ngân sách, khẩu vị** để mình gợi ý món, hoặc hỏi về giờ mở cửa, đặt bàn nhé.`,
  cards: [],
  chips: intro.chips,
  actions: [],
});

/** **đậm**, *nghiêng* / _nghiêng_, xuống dòng. */
function rich(text: string): ReactNode[] {
  return text.split('\n').map((line, i) => (
    <span key={i} className="block">
      {line.split(/(\*\*[^*]+\*\*|\*[^*]+\*|_[^_]+_)/g).map((part, j) =>
        part.startsWith('**') ? <b key={j}>{part.slice(2, -2)}</b>
        : (part.startsWith('*') || part.startsWith('_')) && part.length > 2 ? <i key={j} className="text-[var(--site-muted)]">{part.slice(1, -1)}</i>
        : part,
      )}
    </span>
  ));
}

function readStore<T>(key: string, fallback: T): T {
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeStore(key: string, value: unknown) {
  try {
    sessionStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
  } catch {
    /* trình duyệt chặn lưu trữ — vẫn chat được, chỉ không giữ lại khi tải lại trang */
  }
}

function newSessionId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.floor(Math.random() * 16);
    return (c === 'x' ? r : (r % 4) + 8).toString(16);
  });
}

export function SiteAssistant() {
  const navigate = useNavigate();
  const location = useLocation();
  const reduce = useReducedMotion();
  const intro = useQuery({ queryKey: ['public-site', 'assistant'], queryFn: getSiteAssistant, staleTime: 5 * 60_000, retry: false });

  const [open, setOpen] = useState(false);
  const [sessionId, setSessionId] = useState(() => {
    const old = readStore<string | null>(SESSION_KEY, null);
    if (old) return old;
    const id = newSessionId();
    writeStore(SESSION_KEY, id);
    return id;
  });
  const [msgs, setMsgs] = useState<Msg[]>(() => readStore<Msg[]>(STORE_KEY, []));
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fabRef = useRef<HTMLButtonElement>(null);

  useEffect(() => writeStore(STORE_KEY, msgs.slice(-MAX_KEEP)), [msgs]);
  useEffect(() => {
    if (open) requestAnimationFrame(() => listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: reduce ? 'auto' : 'smooth' }));
  }, [msgs, busy, open, reduce]);
  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    window.addEventListener('keydown', onKey);
    // Điện thoại: khung chat chiếm cả màn hình → khóa cuộn trang phía sau.
    const small = window.matchMedia('(max-width: 639px)').matches;
    const prev = document.body.style.overflow;
    if (small) document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  function close() {
    setOpen(false);
    requestAnimationFrame(() => fabRef.current?.focus({ preventScroll: true }));
  }

  const send = async (raw: string) => {
    const message = raw.trim().slice(0, 300);
    if (!message || busy) return;
    const history = msgs.filter((m): m is Extract<Msg, { from: 'me' }> => m.from === 'me').slice(-4).map((m) => m.text);
    const shown = msgs.flatMap((m) => (m.from === 'bot' ? m.cards.filter((c) => c.kind === 'dish').map((c) => c.id) : [])).slice(-30);
    setMsgs((p) => [...p, { from: 'me', text: message }]);
    setInput('');
    setBusy(true);
    try {
      const r = await askSiteAssistant({ message, history, shown, sessionId });
      setMsgs((p) => [...p, { from: 'bot', ...r }]);
    } catch (e) {
      const text = e instanceof Error && /tạm tắt/.test(e.message)
        ? e.message
        : 'Xin lỗi, mình đang bận một chút 😥 Bạn thử lại sau, hoặc xem trang **Liên hệ** để gọi nhà hàng nhé.';
      setMsgs((p) => [...p, { from: 'bot', text, cards: [], chips: [], actions: ['contact'] }]);
    } finally {
      setBusy(false);
    }
  };

  const restart = () => {
    setMsgs([]);
    const id = newSessionId();
    writeStore(SESSION_KEY, id);
    setSessionId(id);
    inputRef.current?.focus();
  };

  const openCard = (c: SiteAssistantCard) => {
    navigate(`/thuc-don?${c.kind === 'set' ? 'set' : 'mon'}=${encodeURIComponent(c.id)}`);
    close();
  };

  const runAction = (a: SiteAssistantAction) => {
    navigate(a === 'reservation' ? '/dat-ban' : '/lien-he');
    close();
  };

  // Quản lý tắt chatbot trên website (hoặc chưa tải được cấu hình) → không hiện.
  if (!intro.data?.active) return null;
  const bot = intro.data;
  const all: Msg[] = [welcome(bot), ...msgs];
  const last = all[all.length - 1];
  const chips = last.from === 'bot' ? last.chips : [];
  const onMenu = location.pathname.startsWith('/thuc-don');
  const avatar = (size: number) => (
    <span
      className="grid shrink-0 place-items-center rounded-full bg-[var(--site-primary)] text-white"
      style={{ width: size, height: size, fontSize: size * 0.52 }}
      aria-hidden
    >
      {bot.avatar || <Sparkles size={size * 0.5} />}
    </span>
  );
  const fade = reduce ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } } : undefined;

  return (
    <>
      <AnimatePresence>
        {!open ? (
          <motion.button
            ref={fabRef}
            key="fab"
            type="button"
            aria-label={`Mở trợ lý tư vấn ${bot.botName}`}
            {...(fade ?? { initial: { scale: 0.6, opacity: 0 }, animate: { scale: 1, opacity: 1 }, exit: { scale: 0.6, opacity: 0 } })}
            transition={{ type: 'spring', stiffness: 420, damping: 30 }}
            onClick={() => setOpen(true)}
            className={cn(
              'site-assistant-fab fixed right-4 z-50 flex h-14 items-center gap-2.5 rounded-full bg-[var(--site-dark)] pl-2 pr-5 text-[14.5px] font-semibold text-[var(--site-on-dark)] shadow-[0_12px_32px_rgba(29,21,18,0.35)] ring-1 ring-[var(--site-gold-line)] sm:right-6',
              onMenu ? 'bottom-4' : 'bottom-5 sm:bottom-6',
            )}
          >
            {avatar(40)}
            <span className="hidden sm:inline">Tư vấn món</span>
            <MessageCircle size={18} className="text-[var(--site-gold)] sm:hidden" aria-hidden />
          </motion.button>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {open ? (
          <motion.section
            key="panel"
            role="dialog"
            aria-modal="false"
            aria-label={`Trợ lý tư vấn ${bot.botName}`}
            {...(fade ?? { initial: { opacity: 0, y: 24, scale: 0.98 }, animate: { opacity: 1, y: 0, scale: 1 }, exit: { opacity: 0, y: 24, scale: 0.98 } })}
            transition={{ type: 'spring', stiffness: 380, damping: 34 }}
            style={{ transformOrigin: 'bottom right' }}
            className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-[var(--site-bg)] sm:inset-auto sm:bottom-6 sm:right-6 sm:h-[min(640px,calc(100dvh-48px))] sm:w-[400px] sm:rounded-[24px] sm:shadow-[0_24px_60px_rgba(29,21,18,0.28)] sm:ring-1 sm:ring-[var(--site-border)]"
          >
            <header className="flex items-center gap-3 bg-[var(--site-dark)] px-4 py-3 pt-[max(12px,env(safe-area-inset-top))] text-[var(--site-on-dark)]">
              {avatar(40)}
              <div className="min-w-0 flex-1 leading-tight">
                <p className="truncate text-[15.5px] font-semibold">{bot.botName}</p>
                <p className="truncate text-[12px] text-[var(--site-on-dark-muted)]">Tư vấn món · giờ mở cửa · đặt bàn</p>
              </div>
              {msgs.length ? (
                <button type="button" onClick={restart} className="grid h-9 w-9 place-items-center rounded-full hover:bg-white/10" aria-label="Bắt đầu cuộc trò chuyện mới" title="Trò chuyện mới">
                  <RotateCcw size={17} aria-hidden />
                </button>
              ) : null}
              <button type="button" onClick={close} className="grid h-10 w-10 place-items-center rounded-full hover:bg-white/10" aria-label="Đóng trợ lý">
                <X size={20} aria-hidden />
              </button>
            </header>

            <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto overscroll-contain px-4 py-4" aria-live="polite" aria-busy={busy}>
              {all.map((m, i) =>
                m.from === 'me' ? (
                  <div key={i} className="flex justify-end">
                    <p className="max-w-[82%] whitespace-pre-wrap break-words rounded-[18px] rounded-br-md bg-[var(--site-primary)] px-3.5 py-2 text-[14.5px] text-white">{m.text}</p>
                  </div>
                ) : (
                  <div key={i} className="flex gap-2">
                    <div className="pt-0.5">{avatar(28)}</div>
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="max-w-[94%] rounded-[18px] rounded-tl-md bg-[var(--site-surface)] px-3.5 py-2.5 text-[14.5px] leading-relaxed shadow-[var(--site-shadow)] ring-1 ring-[var(--site-border)]">
                        {rich(m.text)}
                        {m.source === 'ai' ? (
                          <span className="mt-1.5 block text-[11px] text-[var(--site-muted)]">✨ Gemini AI · thông tin có thể chưa chính xác, giá có thể thay đổi tại quán</span>
                        ) : null}
                      </div>
                      {m.cards.length ? (
                        <ul className="space-y-2" aria-label="Món gợi ý">
                          {m.cards.map((c) => (
                            <li key={`${c.kind}${c.id}`}>
                              <button
                                type="button"
                                onClick={() => openCard(c)}
                                className="group flex w-full items-center gap-3 rounded-[16px] bg-[var(--site-surface)] p-2 text-left ring-1 ring-[var(--site-border)] transition-colors hover:ring-[var(--site-gold)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--site-primary)]"
                              >
                                <span className="h-14 w-14 shrink-0 overflow-hidden rounded-[12px] bg-[var(--site-surface-2)]">
                                  {c.image ? (
                                    <img src={c.image} alt="" loading="lazy" className={cn('h-full w-full object-cover', c.soldOut && 'grayscale')} />
                                  ) : (
                                    <span className="grid h-full w-full place-items-center text-[22px]" aria-hidden>{c.kind === 'set' ? '🍱' : '🍽️'}</span>
                                  )}
                                </span>
                                <span className="min-w-0 flex-1 leading-tight">
                                  <span className="line-clamp-2 text-[14px] font-semibold">{c.name}</span>
                                  <span className="mt-0.5 block text-[12.5px] text-[var(--site-muted)]">
                                    <b className="text-[var(--site-primary)]">{c.priceFrom ? 'từ ' : ''}{formatCurrency(c.price)}</b>
                                    {c.qty > 1 ? ` × ${c.qty}` : ''}
                                    {c.soldOut ? ' · tạm hết hôm nay' : c.note ? ` · ${c.note}` : ''}
                                  </span>
                                </span>
                                <span className="flex shrink-0 items-center gap-1 rounded-full bg-[var(--site-surface-2)] px-2.5 py-1.5 text-[12px] font-semibold text-[var(--site-text)] group-hover:bg-[var(--site-gold-soft)]">
                                  <BookOpen size={13} aria-hidden /> Xem
                                </span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                      {m.actions.length ? (
                        <div className="flex flex-wrap gap-2">
                          {m.actions.map((a) => (
                            <button
                              key={a}
                              type="button"
                              onClick={() => runAction(a)}
                              className={cn('site-btn h-10 px-4 text-[13.5px]', a === 'reservation' ? 'site-btn-primary' : 'site-btn-outline')}
                            >
                              {a === 'reservation' ? <><CalendarCheck size={15} aria-hidden /> Đặt bàn</> : <><MapPin size={15} aria-hidden /> Liên hệ</>}
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </div>
                ),
              )}
              {busy ? (
                <div className="flex gap-2" aria-label="Trợ lý đang trả lời">
                  {avatar(28)}
                  <div className="flex items-center gap-1 rounded-[18px] bg-[var(--site-surface)] px-3.5 py-3 ring-1 ring-[var(--site-border)]">
                    {[0, 1, 2].map((k) => (
                      <motion.span
                        key={k}
                        className="h-1.5 w-1.5 rounded-full bg-[var(--site-muted)]"
                        animate={reduce ? { opacity: [0.4, 1, 0.4] } : { y: [0, -4, 0] }}
                        transition={{ repeat: Infinity, duration: 0.8, delay: k * 0.15 }}
                      />
                    ))}
                  </div>
                </div>
              ) : null}
            </div>

            {chips.length && !busy ? (
              <div className="flex gap-2 overflow-x-auto px-4 pb-2 [scrollbar-width:none]">
                {chips.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => void send(c)}
                    className="shrink-0 rounded-full border border-[var(--site-gold-line)] bg-[var(--site-surface)] px-3.5 py-1.5 text-[13px] font-medium hover:bg-[var(--site-gold-soft)]"
                  >
                    {c}
                  </button>
                ))}
              </div>
            ) : null}
            <form
              className="flex items-center gap-2 border-t border-[var(--site-border)] bg-[var(--site-surface)] px-3 pb-[max(12px,env(safe-area-inset-bottom))] pt-3"
              onSubmit={(e) => {
                e.preventDefault();
                void send(input);
              }}
            >
              <label htmlFor="tro-ly-cau-hoi" className="sr-only">Câu hỏi cho trợ lý</label>
              <input
                id="tro-ly-cau-hoi"
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                maxLength={300}
                autoComplete="off"
                placeholder="VD: 4 người, dưới 1 triệu, không cay"
                className="site-assistant-input h-11 min-w-0 flex-1 rounded-full border border-[var(--site-border)] bg-[var(--site-bg)] px-4 text-[14.5px] outline-none placeholder:text-[var(--site-muted)] focus:border-[var(--site-primary)]"
              />
              <button
                type="submit"
                disabled={!input.trim() || busy}
                aria-label="Gửi"
                className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[var(--site-primary)] text-white transition-opacity disabled:opacity-40"
              >
                <SendHorizontal size={19} aria-hidden />
              </button>
            </form>
          </motion.section>
        ) : null}
      </AnimatePresence>
    </>
  );
}
