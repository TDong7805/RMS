import '@fontsource/be-vietnam-pro/400.css';
import '@fontsource/be-vietnam-pro/500.css';
import '@fontsource/be-vietnam-pro/600.css';
import '@fontsource/be-vietnam-pro/700.css';
import '@fontsource-variable/playfair-display';
import '@/features/ordering/qr-theme.css';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { flushSync } from 'react-dom';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AnimatePresence, MotionConfig, motion, useScroll, useTransform } from 'motion/react';
import { ArrowRight, BellRinging, BowlFood, CaretRight, MagnifyingGlass, ShoppingBagOpen, SlidersHorizontal, X } from '@phosphor-icons/react';
import { callStaff, cancelQrItem, cancelQrRequest, getQrMenu, getQrTable, qrStreamUrl, requestPayment, sendQrOrder } from '@/api/ordering';
import {
  CategoryArc,
  DishRow,
  EMPTY_FILTER,
  FilterSheet,
  PopularCard,
  Q,
  RollingNumber,
  SPRING,
  Sheet,
  StageArt,
  applyMenuFilter,
  vnd,
  type MenuFilter,
} from '@/features/ordering/QrParts';
import { AnimatedNumber, FlyProvider, dishEmoji, useFly, useFlyBump } from '@/features/ordering/qrMotion';
import { BestCarousel } from '@/features/ordering/BestCarousel';
import { LampSwitch } from '@/features/ordering/LampSwitch';
import { CartScreen, DishDetailScreen, MyOrderScreen, SentScreen } from '@/features/ordering/QrScreens';
import { AddonStrip, GroupPickSheet, SetDetailScreen, SetSection } from '@/features/ordering/QrMenuExtras';
import { addonKeywords, defaultNote, pickAddons } from '@/features/ordering/dishOptions';
import { CallStaffSheet, InvoiceScreen, PaymentScreen, ThanksScreen } from '@/features/ordering/QrService';
import { useLiveEvents } from '@/features/ordering/live';
import { BusinessError, ValidationError } from '@/lib/mock';
import { matchesKeyword } from '@/lib/normalize';
import { cn } from '@/lib/cn';
import type { CartLine, CartSetPart, MenuDish, QrMenuGroup, MenuSet, OrderItem, QrTableInfo } from '@/types';

const cartKey = (token: string) => `rms-cart-${token}`;
const lineKey = (dishId: string, note: string) => `${dishId}|${note.trim().toLowerCase()}`;
const MODE_KEY = 'rms-qr-mode';

function loadCart(token: string): CartLine[] {
  try {
    const raw = localStorage.getItem(cartKey(token));
    return raw ? (JSON.parse(raw) as CartLine[]) : [];
  } catch {
    return [];
  }
}

type ScreenKey = 'mon' | 'set' | 'gio' | 'don' | 'tt' | 'hd';

/** Sáng / tối: theo điện thoại cho tới khi khách tự chọn (lưu trên máy). */
function useQrMode() {
  const media = typeof window !== 'undefined' ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  const [stored, setStored] = useState<'light' | 'dark' | null>(() => {
    const v = localStorage.getItem(MODE_KEY);
    return v === 'light' || v === 'dark' ? v : null;
  });
  const [system, setSystem] = useState<'light' | 'dark'>(media?.matches ? 'dark' : 'light');
  useEffect(() => {
    if (!media) return;
    const on = (e: MediaQueryListEvent) => setSystem(e.matches ? 'dark' : 'light');
    media.addEventListener('change', on);
    return () => media.removeEventListener('change', on);
  }, [media]);
  const mode = stored ?? system;
  /** Đổi sáng / tối; có origin (vị trí núm đèn) thì màu mới lan ra theo vòng tròn từ đó (trình duyệt hỗ trợ View Transitions). */
  const toggle = (origin?: { x: number; y: number }) => {
    const next = mode === 'dark' ? 'light' : 'dark';
    localStorage.setItem(MODE_KEY, next);
    const doc = document as Document & { startViewTransition?: (cb: () => void) => { ready: Promise<void> } };
    if (!origin || !doc.startViewTransition || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setStored(next);
      return;
    }
    const t = doc.startViewTransition(() => flushSync(() => setStored(next)));
    t.ready
      .then(() => {
        const r = Math.hypot(Math.max(origin.x, window.innerWidth - origin.x), Math.max(origin.y, window.innerHeight - origin.y));
        document.documentElement.animate(
          { clipPath: [`circle(0px at ${origin.x}px ${origin.y}px)`, `circle(${r}px at ${origin.x}px ${origin.y}px)`] },
          { duration: 700, easing: 'cubic-bezier(.4,0,.2,1)', pseudoElement: '::view-transition-new(root)' },
        );
      })
      .catch(() => undefined);
  };
  return { mode, toggle };
}

/**
 * Trang đặt món của khách tại bàn (UC-KH-01..06) — mở bằng mã QR dán trên bàn, không đăng nhập.
 * Giao diện theo thiết kế Figma của nhóm: phông Be Vietnam Pro, màu đỏ đậm, có bản tối; luồng giữ đúng đặc tả
 * (gửi món thẳng tới bếp, gọi thêm nhiều đợt, cuối bữa yêu cầu thanh toán và trả tại quầy).
 * Các màn hình con mở bằng tham số trên đường dẫn (?mon=, ?gio=1, ?don=1, ?tt=1, ?hd=1) để nút Quay lại của điện thoại đóng được.
 */
export default function QrOrderPage() {
  return (
    <MotionConfig reducedMotion="user">
      <FlyProvider>
        <QrOrderView />
      </FlyProvider>
    </MotionConfig>
  );
}

function QrOrderView() {
  const { token = '' } = useParams<{ token: string }>();
  const qc = useQueryClient();
  const keys = useMemo(() => ({ info: ['qr', token, 'info'], menu: ['qr', token, 'menu'] }), [token]);
  const info = useQuery({ queryKey: keys.info, queryFn: () => getQrTable(token), refetchInterval: 10_000, retry: false });
  const menu = useQuery({ queryKey: keys.menu, queryFn: () => getQrMenu(token), refetchInterval: 60_000, enabled: info.isSuccess });
  useLiveEvents(info.isSuccess ? qrStreamUrl(token) : null, [keys.info, keys.menu]);
  const { mode, toggle: toggleMode } = useQrMode();

  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const openDishId = params.get('mon');
  const openSetId = params.get('set');
  const screen = (['gio', 'don', 'tt', 'hd'] as const).find((k) => params.get(k) === '1') ?? null;
  const [cart, setCart] = useState<CartLine[]>(() => loadCart(token));
  const [keyword, setKeyword] = useState('');
  const [activeCat, setActiveCat] = useState('all');
  const [pendingJump, setPendingJump] = useState<string | null>(null);
  const [filter, setFilter] = useState<MenuFilter>(EMPTY_FILTER);
  const [filterOpen, setFilterOpen] = useState(false);
  const [confirmSend, setConfirmSend] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [sent, setSent] = useState<{ count: number; total: number; lines: Pick<CartLine, 'name' | 'qty' | 'note'>[] } | null>(null);
  const [unsentPay, setUnsentPay] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<OrderItem | null>(null);
  /** Nhóm món đang mở bảng chọn loại. */
  const [groupPick, setGroupPick] = useState<string | null>(null);
  const [invalid, setInvalid] = useState<Set<string>>(new Set());
  const [staffOpen, setStaffOpen] = useState(false);
  const [staffError, setStaffError] = useState('');
  const [payErrors, setPayErrors] = useState<Record<string, string>>({});
  const [thanksSeen, setThanksSeen] = useState(() => sessionStorage.getItem(`rms-thanks-${token}`) ?? '');
  const listTop = useRef<HTMLDivElement>(null);
  const chipBar = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});
  /** Khung ảnh của thẻ vừa bấm — chi tiết món phóng to từ đó. */
  const dishOrigin = useRef<HTMLElement | null>(null);
  const pendingFly = useRef<MenuDish | null>(null);
  const { setTarget: setCartTarget, fly } = useFly();
  const bump = useFlyBump();
  // Ảnh bìa trôi chậm khi cuộn (parallax), kéo quá đầu trang thì phóng nhẹ.
  const { scrollY } = useScroll();
  const coverY = useTransform(scrollY, [0, 260], [0, 95]);
  const coverScale = useTransform(scrollY, [-140, 0], [1.25, 1]);

  const openScreen = useCallback(
    (key: ScreenKey, value = '1') =>
      setParams((p) => {
        const n = new URLSearchParams(p);
        (['mon', 'set', 'gio', 'don', 'tt', 'hd'] as const).forEach((k) => n.delete(k));
        n.set(key, value);
        return n;
      }),
    [setParams],
  );
  const closeScreen = useCallback(() => {
    if ((window.history.state as { idx?: number } | null)?.idx) navigate(-1);
    else
      setParams(
        (p) => {
          const n = new URLSearchParams(p);
          (['mon', 'set', 'gio', 'don', 'tt', 'hd'] as const).forEach((k) => n.delete(k));
          return n;
        },
        { replace: true },
      );
  }, [navigate, setParams]);

  useEffect(() => {
    localStorage.setItem(cartKey(token), JSON.stringify(cart));
  }, [cart, token]);
  // Bàn đã đóng (thanh toán xong / thu ngân đóng / tự đóng) hoặc đã sang lượt khách mới → xóa giỏ chưa gửi của lượt trước.
  useEffect(() => {
    if (!info.data) return;
    const key = `rms-qr-order-${token}`;
    const last = localStorage.getItem(key);
    const current = info.data.order?.id ?? null;
    if (last && last !== current) setCart([]);
    if (current) localStorage.setItem(key, current);
    else localStorage.removeItem(key);
  }, [info.data, token]);

  const order = info.data?.order ?? null;
  const dishes = useMemo(() => menu.data?.dishes ?? [], [menu.data]);
  const categories = useMemo(() => (menu.data?.categories ?? []).filter((c) => dishes.some((d) => d.categoryId === c.id)), [menu.data, dishes]);
  /** Số phần của món gọi lẻ trong giỏ (không tính món nằm trong set). */
  const qtyOf = (dishId: string) => cart.filter((l) => !l.setId && l.dishId === dishId).reduce((s, l) => s + l.qty, 0);
  const cartCount = cart.reduce((s, l) => s + l.qty, 0);
  const cartTotal = cart.reduce((s, l) => s + l.price * l.qty, 0);
  const activeOrderCount = order ? order.items.filter((i) => i.status !== 'cancelled' && i.status !== 'served').length : 0;

  // Món trong giỏ vừa tạm hết / set không còn bán được → đánh dấu (theo khóa dòng) để khách xóa.
  useEffect(() => {
    if (!menu.data) return;
    const avail = new Set(dishes.filter((d) => !d.soldOut).map((d) => d.id));
    const sets = new Set(menu.data.sets.map((x) => x.id));
    setInvalid(new Set(cart.filter((l) => (l.setId ? !sets.has(l.setId) || (l.parts ?? []).some((p) => !avail.has(p.dishId)) : !avail.has(l.dishId))).map((l) => l.key)));
  }, [menu.data, dishes, cart]);

  /* ---------------- Giỏ món */
  const addToCart = useCallback((dish: MenuDish, qty: number, note: string) => {
    setCart((prev) => {
      const key = lineKey(dish.id, note);
      const found = prev.find((l) => l.key === key);
      if (found) return prev.map((l) => (l.key === key ? { ...l, qty: Math.min(20, l.qty + qty) } : l));
      return [...prev, { key, dishId: dish.id, name: dish.name, price: dish.price, image: dish.image, qty, note }];
    });
  }, []);

  /** Nút tăng giảm trên thẻ món: chỉnh dòng có ghi chú mặc định của món (bít tết: độ chín / sốt mặc định), thêm mới nếu chưa có. */
  const setPlainQty = (dish: MenuDish, qty: number, note = '') =>
    setCart((prev) => {
      const key = lineKey(dish.id, note);
      const others = prev.filter((l) => !l.setId && l.dishId === dish.id && l.key !== key).reduce((s, l) => s + l.qty, 0);
      const plain = Math.max(0, qty - others);
      if (plain === 0) return prev.filter((l) => l.key !== key);
      if (prev.some((l) => l.key === key)) return prev.map((l) => (l.key === key ? { ...l, qty: plain } : l));
      return [...prev, { key, dishId: dish.id, name: dish.name, price: dish.price, image: dish.image, qty: plain, note }];
    });

  /**
   * Bảng chọn nhóm: đặt tổng số phần gọi lẻ của một loại. Tăng → thêm dòng (kèm ghi chú nhanh);
   * giảm → bớt từ dòng thêm sau cùng trước (giữ các dòng có ghi chú khách đã ghi trước đó nếu còn đủ).
   */
  const setTotalQty = (dish: MenuDish, qty: number, note: string) =>
    setCart((prev) => {
      const current = prev.filter((l) => !l.setId && l.dishId === dish.id).reduce((s, l) => s + l.qty, 0);
      if (qty > current) {
        const key = lineKey(dish.id, note);
        const add = qty - current;
        if (prev.some((l) => l.key === key)) return prev.map((l) => (l.key === key ? { ...l, qty: Math.min(20, l.qty + add) } : l));
        return [...prev, { key, dishId: dish.id, name: dish.name, price: dish.price, image: dish.image, qty: add, note }];
      }
      let remove = current - qty;
      const next = [...prev];
      for (let i = next.length - 1; i >= 0 && remove > 0; i--) {
        const l = next[i];
        if (l.setId || l.dishId !== dish.id) continue;
        const take = Math.min(l.qty, remove);
        remove -= take;
        if (take === l.qty) next.splice(i, 1);
        else next[i] = { ...l, qty: l.qty - take };
      }
      return next;
    });

  /** Thêm set vào giỏ: cùng set + cùng lựa chọn (độ chín, loại nước) thì cộng dồn số set. */
  const addSetToCart = useCallback((set: MenuSet, parts: CartSetPart[], qty: number) => {
    setCart((prev) => {
      const key = `set:${set.id}|${parts.map((p) => `${p.dishId}x${p.qty}:${p.note}`).join(';')}`;
      const found = prev.find((l) => l.key === key);
      if (found) return prev.map((l) => (l.key === key ? { ...l, qty: Math.min(20, l.qty + qty) } : l));
      return [...prev, { key, dishId: parts[0]?.dishId ?? '', name: set.name, price: set.price, image: set.image, qty, note: '', setId: set.id, parts }];
    });
  }, []);

  const changeLine = (key: string, patch: Partial<CartLine>) =>
    setCart((prev) => {
      const next = prev.map((l) => (l.key === key ? { ...l, ...patch } : l));
      // Đổi ghi chú → gộp với dòng cùng món cùng ghi chú.
      if (patch.note === undefined) return next;
      const line = next.find((l) => l.key === key);
      if (!line) return next;
      const newKey = lineKey(line.dishId, line.note);
      const dup = next.find((l) => l.key === newKey && l !== line);
      if (dup) return next.filter((l) => l !== line).map((l) => (l === dup ? { ...l, qty: Math.min(20, l.qty + line.qty) } : l));
      return next.map((l) => (l === line ? { ...l, key: newKey } : l));
    });

  /* ---------------- Gửi đặt món */
  const send = useMutation({
    mutationFn: () =>
      sendQrOrder(
        token,
        cart.map((l) =>
          l.setId
            ? { setId: l.setId, qty: l.qty, parts: (l.parts ?? []).map((p) => ({ dishId: p.dishId, qty: p.qty, note: p.note })) }
            : { dishId: l.dishId, qty: l.qty, note: l.note },
        ),
      ),
    onSuccess: (o) => {
      setSent({ count: cartCount, total: cartTotal, lines: cart.map((l) => ({ name: l.name, qty: l.qty, note: l.note })) });
      setCart([]);
      setConfirmSend(false);
      closeScreen();
      qc.setQueryData(keys.info, (prev: typeof info.data) => (prev ? { ...prev, order: o } : prev));
      void qc.invalidateQueries({ queryKey: keys.menu });
    },
    onError: (e) => {
      setConfirmSend(false);
      if (e instanceof ValidationError) {
        void qc.invalidateQueries({ queryKey: keys.menu });
        toast.error(e.message);
      } else toast.error(e instanceof BusinessError ? e.message : 'Chưa gửi được món. Vui lòng thử lại.');
      void qc.invalidateQueries({ queryKey: keys.info });
    },
  });

  const cancel = useMutation({
    mutationFn: (item: OrderItem) => cancelQrItem(token, item.id),
    onSuccess: (o, item) => {
      toast.success(`Đã hủy ${item.setName ?? item.name}`);
      setCancelTarget(null);
      qc.setQueryData(keys.info, (prev: typeof info.data) => (prev ? { ...prev, order: o } : prev));
    },
    onError: (e) => {
      setCancelTarget(null);
      toast.error(e instanceof Error ? e.message : 'Không hủy được món');
      void qc.invalidateQueries({ queryKey: keys.info });
    },
  });

  /* ---------------- Gọi nhân viên, yêu cầu thanh toán (UC-KH-05, UC-KH-06) */
  const putInfo = (next: QrTableInfo) => qc.setQueryData(keys.info, next);
  const staffCall = useMutation({
    mutationFn: (v: { type: 'support' | 'consult' | 'other'; content: string }) => callStaff(token, v.type, v.content),
    onSuccess: (next) => {
      putInfo(next);
      setStaffError('');
      toast.success('Đã gửi yêu cầu, nhân viên sẽ đến ngay');
    },
    onError: (e) => {
      if (e instanceof ValidationError) setStaffError(Object.values(e.fields)[0] ?? e.message);
      else toast.error(e instanceof Error ? e.message : 'Chưa gửi được yêu cầu');
      void qc.invalidateQueries({ queryKey: keys.info });
    },
  });
  const payRequest = useMutation({
    mutationFn: (body: { method: 'cash' | 'card' | 'transfer'; vatCompany: string; vatTaxCode: string }) => requestPayment(token, body),
    onSuccess: (next) => {
      putInfo(next);
      setPayErrors({});
      toast.success('Đã gửi yêu cầu thanh toán. Nhân viên sẽ mang hóa đơn đến.');
    },
    onError: (e) => {
      if (e instanceof ValidationError) setPayErrors(e.fields);
      else toast.error(e instanceof Error ? e.message : 'Chưa gửi được yêu cầu');
      void qc.invalidateQueries({ queryKey: keys.info });
    },
  });
  const cancelReq = useMutation({
    mutationFn: (id: string) => cancelQrRequest(token, id),
    onSuccess: (next) => {
      putInfo(next);
      toast.success('Đã hủy yêu cầu');
    },
    onError: (e) => {
      toast.error(e instanceof Error ? e.message : 'Không hủy được yêu cầu');
      void qc.invalidateQueries({ queryKey: keys.info });
    },
  });

  // Thu ngân vừa lập hóa đơn → tự mở hóa đơn cho khách.
  const invoiceCode = info.data?.invoice?.code ?? '';
  const lastInvoice = useRef('');
  useEffect(() => {
    if (invoiceCode && invoiceCode !== lastInvoice.current) openScreen('hd');
    lastInvoice.current = invoiceCode;
  }, [invoiceCode, openScreen]);
  // Hóa đơn không còn (đã hủy / đã thanh toán) mà màn hóa đơn đang mở → đóng.
  useEffect(() => {
    if (screen === 'hd' && info.data && !info.data.invoice) closeScreen();
  }, [screen, info.data, closeScreen]);

  const openPayment = (skipCartCheck = false) => {
    if (info.data?.invoice) openScreen('hd');
    else if (!order || order.items.every((i) => i.status === 'cancelled')) toast.info('Bàn chưa có món nào để thanh toán');
    // Giỏ còn món chưa gửi bếp → hỏi trước (khách hay quên bấm Gửi).
    else if (!skipCartCheck && cart.length > 0) setUnsentPay(true);
    else openScreen('tt');
  };

  /* ---------------- Danh mục: bấm cuộn nhanh tới mục, cuộn trang thì viên danh mục tự sáng theo */
  const browsing = !keyword.trim() && filter.sort === 'default' && filter.tags.length === 0;
  /**
   * Trang đang tự cuộn tới mục khách vừa chọn → tạm tắt "cuộn tới đâu sáng mục đó", nếu không trên đường cuộn
   * các mục đi ngang (1, 2, 3…) lần lượt được chọn và dải danh mục giật qua lại trước khi về đúng mục.
   * Mở lại khi trang dừng cuộn (không còn sự kiện cuộn trong 150 ms), tối đa sau 2 giây.
   */
  const spyPausedUntil = useRef(0);
  const pauseSpy = useCallback(() => {
    spyPausedUntil.current = Date.now() + 2000;
    let idle = window.setTimeout(release, 400);
    function release() {
      spyPausedUntil.current = 0;
      window.removeEventListener('scroll', onScroll);
    }
    function onScroll() {
      window.clearTimeout(idle);
      idle = window.setTimeout(release, 150);
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    window.setTimeout(release, 2000);
  }, []);
  const scrollToCategory = useCallback((id: string) => {
    const el = id === 'all' ? listTop.current : sectionRefs.current[id];
    if (!el) return;
    // Trừ chiều cao thanh danh mục dính đầu trang để tiêu đề mục không bị che.
    const offset = id === 'all' ? 0 : (chipBar.current?.offsetHeight ?? 0) + 8;
    pauseSpy();
    window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - offset, behavior: 'smooth' });
  }, [pauseSpy]);

  useEffect(() => {
    if (!pendingJump || !browsing) return;
    const id = pendingJump;
    setPendingJump(null);
    requestAnimationFrame(() => scrollToCategory(id));
  }, [pendingJump, browsing, scrollToCategory]);

  useEffect(() => {
    if (!browsing) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (Date.now() < spyPausedUntil.current) return;
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible) setActiveCat(visible.target.getAttribute('data-cat') ?? 'all');
      },
      { rootMargin: `-${(chipBar.current?.offsetHeight ?? 120) + 10}px 0px -60% 0px` },
    );
    Object.values(sectionRefs.current).forEach((el) => el && obs.observe(el));
    return () => obs.disconnect();
  }, [browsing, menu.data]);

  /* ---------------- Trạng thái lỗi / đang tải */
  if (info.isError) {
    const msg = info.error instanceof Error ? info.error.message : 'Không tải được dữ liệu';
    return (
      <Shell mode={mode}>
        <div className="flex min-h-[80dvh] flex-col items-center justify-center px-8 text-center">
          <StageArt art="served" size={170} className="h-[220px] w-full" />
          <p className="mt-5 text-[17px] font-semibold">{msg}</p>
          <button type="button" onClick={() => void info.refetch()} className={cn(Q.btn, 'mt-5 px-6 py-2.5 text-[14px]')}>Thử lại</button>
        </div>
      </Shell>
    );
  }
  if (!info.data) {
    return (
      <Shell mode={mode}>
        <div className="space-y-4 p-5 pt-6">
          <div className="qr-skeleton h-10 w-48 rounded-2xl" />
          <div className="qr-skeleton h-[200px] rounded-3xl" />
          <div className="flex justify-center gap-4">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="qr-skeleton h-[58px] w-[58px] rounded-full" />)}</div>
          {Array.from({ length: 3 }).map((_, i) => <div key={i} className="qr-skeleton h-[116px] rounded-[20px]" />)}
        </div>
      </Shell>
    );
  }

  const t = info.data;
  const sendBlocked = !t.openNow
    ? 'Nhà hàng hiện ngoài giờ phục vụ, chưa gửi món được.'
    : !order
      ? 'Bàn chưa được mở. Vui lòng gọi nhân viên để mở bàn trước khi gọi món.'
    : order.locked
      ? 'Bàn đang chờ thanh toán, không gọi thêm món được. Vui lòng gọi nhân viên nếu cần gọi thêm.'
      : invalid.size
        ? 'Một số món trong giỏ đã hết. Vui lòng xóa các món được đánh dấu.'
        : null;
  const allCategories = menu.data?.categories ?? [];
  const catName = (d: { categoryId: string }) => allCategories.find((c) => c.id === d.categoryId)?.name;
  const byId = new Map(dishes.map((d) => [d.id, d]));
  const groups = menu.data?.groups ?? [];
  const groupById = new Map(groups.map((g) => [g.id, g]));
  const membersOf = (g: QrMenuGroup) => g.dishIds.map((id) => byId.get(id)).filter((d): d is MenuDish => Boolean(d));
  /** Thẻ đại diện cho cả nhóm (dùng lại thẻ món): giá thấp nhất, ảnh nhóm, tạm hết khi mọi loại đều hết. */
  const groupCard = (g: QrMenuGroup): MenuDish => {
    const ms = membersOf(g);
    const avail = ms.filter((m) => !m.soldOut);
    return {
      id: 'g' + g.id, name: g.name, categoryId: g.categoryId, price: Math.min(...(avail.length ? avail : ms).map((m) => m.price)),
      description: g.description, image: g.image ?? ms[0]?.image ?? null, ingredients: '', allergens: [], spicyLevel: 0, tags: [],
      soldOut: avail.length === 0, groupId: null, variantLabel: null,
    };
  };
  const groupPriceLabel = (g: QrMenuGroup) => (new Set(membersOf(g).map((m) => m.price)).size > 1 ? `từ ${vnd(groupCard(g).price)}` : undefined);
  const groupQty = (g: QrMenuGroup) => membersOf(g).reduce((s, m) => s + qtyOf(m.id), 0);
  /** Bán chạy: id món, hoặc "g<id>" cho nhóm (thẻ nhóm). */
  const best = (menu.data?.bestSellers ?? [])
    .map((id) => (id.startsWith('g') ? (groupById.has(id.slice(1)) ? groupCard(groupById.get(id.slice(1))!) : undefined) : byId.get(id)))
    .filter((d): d is MenuDish => Boolean(d));
  const rankOf = new Map(best.map((d, i) => [d.id, i + 1]));
  const openDish = openDishId ? byId.get(openDishId) ?? null : null;
  const sets = menu.data?.sets ?? [];
  const openSet = openSetId ? sets.find((x) => x.id === openSetId) ?? null : null;
  const addonCategoryId = allCategories.find((c) => c.name === 'Gọi thêm')?.id;
  /** Ghi chú khi thêm nhanh bằng nút +: bít tết ghi rõ độ chín và sốt mặc định. */
  const quickNote = (d: MenuDish) => defaultNote(catName(d), d.name);
  const openDishFrom = (d: MenuDish, from: HTMLElement | null) => {
    dishOrigin.current = from;
    openScreen('mon', d.id);
  };
  /** Sau khi màn chi tiết đóng hẳn: ảnh món bay từ thẻ vừa bấm (nếu còn trong màn hình) vào giỏ. */
  const flyPending = () => {
    const d = pendingFly.current;
    pendingFly.current = null;
    if (!d) return;
    const el = dishOrigin.current;
    const r = el && document.body.contains(el) ? el.getBoundingClientRect() : null;
    const visible = r && r.width > 0 && r.top > 60 && r.bottom < window.innerHeight - 80;
    const from = visible ? r : new DOMRect(window.innerWidth / 2 - 36, window.innerHeight * 0.42 - 36, 72, 72);
    fly(from, d.image, dishEmoji(d.name, catName(d)));
  };
  const filtering = filter.sort !== 'default' || filter.tags.length > 0;
  const searching = keyword.trim().length > 0;
  const scoped = dishes.filter((d) => !searching || matchesKeyword(d.name, keyword));
  const results = applyMenuFilter(scoped, filter, rankOf);
  const row = (d: MenuDish) => (
    <DishRow
      key={d.id}
      dish={d}
      categoryName={catName(d)}
      groupName={d.groupId ? groupById.get(d.groupId)?.name : undefined}
      best={rankOf.has(d.id)}
      inCart={qtyOf(d.id)}
      onOpen={(el) => openDishFrom(d, el)}
      onAdd={() => addToCart(d, 1, quickNote(d))}
      onChangeQty={(q) => setPlainQty(d, q, quickNote(d))}
    />
  );
  /** Thẻ nhóm: bấm thẻ / nút + / tăng → mở bảng chọn loại; giảm khi chỉ có một loại trong giỏ thì bớt thẳng loại đó. */
  const groupRow = (g: QrMenuGroup) => {
    const card = groupCard(g);
    const inCart = groupQty(g);
    return (
      <DishRow
        key={card.id}
        dish={card}
        categoryName={catName(card)}
        best={rankOf.has(card.id)}
        inCart={inCart}
        priceLabel={groupPriceLabel(g)}
        noFly
        onOpen={() => setGroupPick(g.id)}
        onAdd={() => setGroupPick(g.id)}
        onChangeQty={(q) => {
          const inside = membersOf(g).filter((m) => qtyOf(m.id) > 0);
          if (q < inCart && inside.length === 1) setPlainQty(inside[0], qtyOf(inside[0].id) - 1);
          else setGroupPick(g.id);
        }}
      />
    );
  };
  /** Món của một danh mục: món đứng riêng + thẻ nhóm (đặt ở vị trí món đầu tiên của nhóm). */
  const categoryCards = (catId: string) => {
    const seen = new Set<string>();
    return dishes.filter((d) => d.categoryId === catId).map((d) => {
      if (!d.groupId) return row(d);
      const g = groupById.get(d.groupId);
      if (!g) return row(d);
      if (seen.has(g.id)) return null;
      seen.add(g.id);
      return groupRow(g);
    });
  };
  const pickedGroup = groupPick ? groupById.get(groupPick) ?? null : null;
  const pills: { key: string; text: string; onClick?: () => void }[] = [];
  if (!t.openNow) pills.push({ key: 'closed', text: `Ngoài giờ phục vụ${t.reopenAt ? ` · mở lại ${reopenText(t.reopenAt)}` : ''}` });
  if (t.invoice) pills.push({ key: 'invoice', text: `Hóa đơn ${t.invoice.code} · ${vnd(t.invoice.total)} — chờ thanh toán`, onClick: () => openScreen('hd') });
  else if (order?.locked) pills.push({ key: 'locked', text: 'Bàn đang chờ thanh toán' });
  // Mã QR chỉ gửi được món khi thu ngân đã mở bàn.
  if (t.openNow && !order) pills.push({ key: 'not-open', text: 'Bàn chưa mở · bấm để gọi nhân viên mở bàn', onClick: () => setStaffOpen(true) });
  /** Bấm viên danh mục: đang tìm / lọc thì bỏ tìm / lọc trước, rồi cuộn nhanh tới mục (không ẩn món khác). */
  const pickCategory = (id: string) => {
    setActiveCat(id);
    if (!browsing) {
      setKeyword('');
      setFilter(EMPTY_FILTER);
      setPendingJump(id);
    } else scrollToCategory(id);
  };

  return (
    <Shell mode={mode}>
      {/* Đầu trang: bàn đang ngồi, gọi nhân viên, món của tôi */}
      <header className="flex items-center gap-2.5 px-5 pb-4 pt-5">
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate text-[12.5px] text-[var(--qr-muted)]">Bạn đang ngồi tại · {t.areaName}</p>
          <p className="truncate text-[19px] font-semibold">Bàn {t.tableCode}</p>
        </div>
        <motion.button whileTap={{ scale: 0.88 }} type="button" aria-label={t.support ? 'Đang chờ nhân viên' : 'Gọi nhân viên'} onClick={() => setStaffOpen(true)} className={cn(Q.iconBtn, 'relative', t.support && 'text-[var(--qr-primary)]')}>
          <span className={cn('inline-flex', t.support && 'qr-wiggle')}><BellRinging size={22} weight="duotone" /></span>
          {t.support ? <span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-[var(--qr-primary)]" /> : null}
        </motion.button>
        <motion.button whileTap={{ scale: 0.94 }} type="button" onClick={() => openScreen('don')} className="inline-flex h-11 items-center gap-2 rounded-full bg-[var(--qr-primary)] pl-3.5 pr-4 text-[14px] font-semibold text-white shadow-[0_6px_16px_var(--qr-primary-glow)]">
          <BowlFood size={20} weight="duotone" />Món của tôi
          <AnimatePresence>
            {activeOrderCount ? (
              <motion.span key="n" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} transition={SPRING} className="grid h-5 min-w-5 place-items-center rounded-full bg-white px-1 text-[11px] font-bold text-[var(--qr-primary)]">
                <RollingNumber value={activeOrderCount} />
              </motion.span>
            ) : null}
          </AnimatePresence>
        </motion.button>
      </header>

      {/* Ảnh bìa + tìm kiếm + lọc */}
      <div className="relative overflow-hidden">
<LampSwitch on={mode === 'light'} onToggle={toggleMode} />
        <motion.div style={{ y: coverY, scale: coverScale }} className="origin-top">
          {t.coverImage ? (
            // Có ảnh bìa (thường là biển hiệu có tên quán) → không hiện dòng chào để khỏi lặp tên.
            <div className="relative h-[220px]">
              <img src={t.coverImage} alt={t.restaurantName} className="h-full w-full object-cover" />
            </div>
          ) : (
            <div className={cn('qr-pattern flex h-[220px] flex-col px-6 text-white', pills.length ? 'justify-start pt-[64px]' : 'justify-center')}>
              <p className="text-[14px] opacity-90">Chào mừng đến với</p>
              <p className="qr-display text-[30px] font-bold leading-tight">{t.restaurantName}</p>
              {pills.length ? null : <p className="mt-1 text-[13px] opacity-85">Gọi món ngay tại bàn — bếp nhận tức thì</p>}
            </div>
          )}
        </motion.div>
        {/* Thông báo trạng thái dạng viên nhỏ trên ảnh bìa (ngoài giờ, hóa đơn chờ thanh toán) */}
        <div className="absolute left-4 right-[64px] top-4 z-10 flex flex-col items-start gap-1.5">
          <AnimatePresence initial={false}>
            {pills.map((pl, i) => {
              const body = (
                <>
                  <span className="truncate">{pl.text}</span>
                  {pl.onClick ? <CaretRight size={13} weight="bold" className="shrink-0 opacity-80" /> : null}
                </>
              );
              const cls = 'inline-flex max-w-full items-center gap-1.5 rounded-full bg-black/45 px-3 py-1.5 text-[12.5px] font-semibold text-white backdrop-blur-md';
              return (
                <motion.div key={pl.key} initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ ...SPRING, delay: 0.1 + i * 0.06 }} className="max-w-full">
                  {pl.onClick ? <button type="button" onClick={pl.onClick} className={cls}>{body}</button> : <div role="status" className={cls}>{body}</div>}
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
        <div className="absolute inset-x-5 bottom-4 flex gap-2.5">
          <label className="flex min-w-0 flex-1 items-center gap-2.5 rounded-full bg-[var(--qr-surface)] px-4 py-3 shadow-lg">
            <MagnifyingGlass size={19} weight="bold" className="shrink-0 text-[var(--qr-muted)]" />
            <input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="Tìm món ăn, đồ uống…" className="min-w-0 flex-1 bg-transparent text-[14.5px] outline-none placeholder:text-[var(--qr-muted)]" />
            <AnimatePresence>
              {searching ? (
                <motion.button initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} type="button" aria-label="Xóa tìm kiếm" onClick={() => setKeyword('')}><X size={16} weight="bold" className="text-[var(--qr-muted)]" /></motion.button>
              ) : null}
            </AnimatePresence>
          </label>
          <motion.button whileTap={{ scale: 0.88 }} type="button" aria-label="Sắp xếp và lọc" onClick={() => setFilterOpen(true)} className="relative grid w-[50px] shrink-0 place-items-center rounded-full bg-[var(--qr-primary)] text-white shadow-lg">
            <SlidersHorizontal size={21} weight="bold" />
            <AnimatePresence>
              {filtering ? <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} transition={SPRING} className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-white px-1 text-[10.5px] font-bold text-[var(--qr-primary)] shadow">{filter.tags.length + (filter.sort !== 'default' ? 1 : 0)}</motion.span> : null}
            </AnimatePresence>
          </motion.button>
        </div>
      </div>


      {/* Danh mục (dính đầu trang khi cuộn) */}
      <div ref={listTop} />
      <div ref={chipBar} className="sticky top-0 z-20 bg-[var(--qr-bg)]">
        <CategoryArc categories={categories} active={activeCat} onPick={pickCategory} />
      </div>

      <main className="px-5 pb-40">
        {menu.isLoading ? (
          <div className="space-y-3 pt-2">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="qr-skeleton h-[116px] rounded-[20px]" />)}</div>
        ) : dishes.length === 0 ? (
          <p className="py-16 text-center text-[14px] text-[var(--qr-muted)]">Thực đơn đang được cập nhật. Vui lòng liên hệ nhân viên.</p>
        ) : searching || filtering ? (
          <section className="pt-2">
            <div className="mb-3 flex items-baseline justify-between">
              <h2 className="text-[18px] font-semibold">
                {searching ? <>Kết quả cho “<span className="text-[var(--qr-primary)]">{keyword}</span>”</> : 'Kết quả lọc'}
              </h2>
              <span className="text-[12.5px] text-[var(--qr-muted)]">{results.length} món</span>
            </div>
            {results.length === 0 ? (
              <div className="py-14 text-center">
                <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-[var(--qr-surface-2)] text-[var(--qr-muted)]"><MagnifyingGlass size={28} weight="duotone" /></span>
                <p className="mt-3 text-[15px] font-semibold">Không có món phù hợp</p>
                <button type="button" onClick={() => { setKeyword(''); setFilter(EMPTY_FILTER); }} className="mt-3 text-[14px] font-semibold text-[var(--qr-primary)]">Xem tất cả món</button>
              </div>
            ) : (
              <div className="space-y-3">{results.map(row)}</div>
            )}
          </section>
        ) : (
          <>
            {best.length ? (
              <section data-cat="all" ref={(el) => { sectionRefs.current.all = el; }} className="pt-2">
                <BestCarousel title="Bán chạy">
                  {best.map((d, i) => {
                    const g = d.id.startsWith('g') ? groupById.get(d.id.slice(1)) : undefined;
                    return g ? (
                      <PopularCard key={d.id} big index={i} dish={d} categoryName={catName(d)} rank={i + 1} inCart={groupQty(g)} priceLabel={groupPriceLabel(g)} noFly onOpen={() => setGroupPick(g.id)} onAdd={() => setGroupPick(g.id)} onChangeQty={() => setGroupPick(g.id)} />
                    ) : (
                      <PopularCard key={d.id} big index={i} dish={d} categoryName={catName(d)} rank={i + 1} inCart={qtyOf(d.id)} onOpen={(el) => openDishFrom(d, el)} onAdd={() => addToCart(d, 1, quickNote(d))} onChangeQty={(q) => setPlainQty(d, q, quickNote(d))} />
                    );
                  })}
                </BestCarousel>
              </section>
            ) : null}
            <SetSection sets={sets} onOpen={(x) => openScreen('set', x.id)} paused={Boolean(screen || openDishId || openSetId || groupPick || filterOpen)} />
            <h2 className="mb-1 mt-4 text-[21px] font-bold">Tất cả món</h2>
            {categories.map((c) => (
              <section key={c.id} data-cat={c.id} ref={(el) => { sectionRefs.current[c.id] = el; }} className="pt-3">
                <p className="qr-display mb-2 text-[16.5px] font-semibold">{c.name}</p>
                <div className="space-y-3">{categoryCards(c.id)}</div>
              </section>
            ))}
          </>
        )}
      </main>

      {/* Thanh nổi: số món trong giỏ + Xác nhận gọi món */}
      <AnimatePresence>
        {cartCount > 0 ? (
          <motion.div key="cart-bar" initial={{ y: 120 }} animate={{ y: 0 }} exit={{ y: 120 }} transition={SPRING} className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-[480px] px-5 pb-[max(16px,env(safe-area-inset-bottom))]">
            <motion.button whileTap={{ scale: 0.97 }} type="button" onClick={() => openScreen('gio')} className="flex w-full overflow-hidden rounded-full bg-[var(--qr-primary)] text-[14.5px] font-semibold text-white shadow-[0_10px_30px_var(--qr-primary-glow)]">
              <span ref={setCartTarget} className="flex shrink-0 items-center bg-white/20 py-3 pl-5 pr-4" aria-label={`${cartCount} món`}>
                <motion.span key={bump} animate={{ scale: [1, 1.4, 0.9, 1], rotate: [0, -14, 8, 0] }} transition={{ duration: 0.5 }} className="relative inline-flex">
                  <ShoppingBagOpen size={26} weight="fill" />
                  <span className="absolute -right-2.5 -top-2 grid h-[19px] min-w-[19px] place-items-center rounded-full bg-white px-1 text-[11px] font-bold text-[var(--qr-primary)]"><RollingNumber value={cartCount} /></span>
                </motion.span>
              </span>
              <span className="flex min-w-0 flex-1 items-center justify-between gap-2 whitespace-nowrap py-4 pl-4 pr-5">
                <span className="truncate">Xác nhận gọi món</span>
                <span className="inline-flex items-center gap-1.5 font-bold"><AnimatedNumber value={cartTotal} format={vnd} /><ArrowRight size={17} weight="bold" /></span>
              </span>
            </motion.button>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <FilterSheet open={filterOpen} value={filter} onClose={() => setFilterOpen(false)} onApply={(f) => { setFilter(f); setFilterOpen(false); }} />

      <AnimatePresence onExitComplete={flyPending}>
      {openDish ? (
        <DishDetailScreen
          key={openDish.id}
          dish={openDish}
          categoryName={catName(openDish)}
          best={rankOf.get(openDish.id)}
          onBack={closeScreen}
          onAdd={(d, q, n) => {
            addToCart(d, q, n);
            pendingFly.current = d;
            closeScreen();
          }}
          addonSlot={
            <AddonStrip
              addons={pickAddons(addonKeywords(catName(openDish), openDish.name), dishes, addonCategoryId)}
              categoryOf={(id) => { const d = byId.get(id); return d ? catName(d) : undefined; }}
              qtyOf={qtyOf}
              onAdd={(a) => { addToCart(a, 1, ''); toast.success(`Đã thêm ${a.name}`); }}
            />
          }
        />
      ) : null}
      </AnimatePresence>
      <AnimatePresence>
        {openSet ? (
          <SetDetailScreen
            key={openSet.id}
            set={openSet}
            dishById={byId}
            categoryOf={(id) => { const d = byId.get(id); return d ? catName(d) : undefined; }}
            onBack={closeScreen}
            onAdd={(x, parts, q) => { addSetToCart(x, parts, q); closeScreen(); toast.success(`Đã thêm ${x.name}`); }}
          />
        ) : null}
      </AnimatePresence>
      <GroupPickSheet
        group={pickedGroup}
        members={pickedGroup ? membersOf(pickedGroup) : []}
        categoryName={pickedGroup ? allCategories.find((c) => c.id === pickedGroup.categoryId)?.name : undefined}
        qtyOf={qtyOf}
        onApply={(changes, note) => {
          const added = changes.filter((c) => c.qty > qtyOf(c.dish.id));
          changes.forEach((c) => setTotalQty(c.dish, c.qty, note));
          setGroupPick(null);
          // Chỉ khi thật sự thêm món: ảnh loại vừa thêm bay vào giỏ (từ giữa màn hình, nơi bảng vừa đóng).
          const first = added[0]?.dish;
          if (first) fly(new DOMRect(window.innerWidth / 2 - 36, window.innerHeight * 0.55 - 36, 72, 72), first.image, dishEmoji(first.name, catName(first)));
        }}
        onOpenDish={(d) => { setGroupPick(null); openDishFrom(d, null); }}
        onClose={() => setGroupPick(null)}
      />
      <AnimatePresence>
      {screen === 'gio' ? (
        <CartScreen
          key="gio"
          table={t.tableCode}
          lines={cart}
          invalid={invalid}
          sending={send.isPending}
          suggestions={best.slice(0, 6)}
          categoryOf={(id) => { const d = byId.get(id); return d ? catName(d) : undefined; }}
          qtyOf={qtyOf}
          onBack={closeScreen}
          onChange={changeLine}
          onRemove={(key) => setCart((prev) => prev.filter((l) => l.key !== key))}
          onClear={() => setConfirmClear(true)}
          onSend={() => setConfirmSend(true)}
          onOpenDish={(d, el) => openDishFrom(d, el)}
          onAddDish={(d) => addToCart(d, 1, '')}
          disabledReason={sendBlocked}
        />
      ) : null}
      {screen === 'don' ? (
        <MyOrderScreen
          key="don"
          table={t.tableCode}
          order={order}
          support={t.support}
          payment={t.payment}
          hasInvoice={Boolean(t.invoice)}
          onBack={closeScreen}
          onCancel={setCancelTarget}
          onStaff={() => setStaffOpen(true)}
          onPayment={() => openPayment()}
        />
      ) : null}
      {screen === 'tt' ? (
        <PaymentScreen
          key="tt"
          restaurant={t.restaurantName}
          table={t.tableCode}
          area={t.areaName}
          order={order}
          waiting={t.payment}
          sending={payRequest.isPending || cancelReq.isPending}
          errors={payErrors}
          onBack={closeScreen}
          onSend={(body) => payRequest.mutate(body)}
          onCancel={(id) => cancelReq.mutate(id)}
        />
      ) : null}
      {screen === 'hd' && t.invoice ? <InvoiceScreen key="hd" invoice={t.invoice} table={t.tableCode} preferTransfer={t.payment?.paymentMethod === 'transfer'} onBack={closeScreen} /> : null}
      </AnimatePresence>
      <AnimatePresence>
        {sent ? <SentScreen key="sent" count={sent.count} total={sent.total} lines={sent.lines} onMenu={() => setSent(null)} onTrack={() => { setSent(null); openScreen('don'); }} /> : null}
      </AnimatePresence>

      <Sheet open={unsentPay} onClose={() => setUnsentPay(false)} title="Giỏ còn món chưa gửi bếp">
        <div className="space-y-4 px-5 pb-[max(20px,env(safe-area-inset-bottom))] pt-1">
          <p className="text-[14.5px] text-[var(--qr-muted)]">Giỏ của bạn còn <b className="text-[var(--qr-text)]">{cartCount} món</b> chưa gửi tới bếp. Các món này chưa được tính vào hóa đơn.</p>
          <div className="flex flex-col gap-2.5">
            <button type="button" onClick={() => { setUnsentPay(false); setConfirmSend(true); }} className={cn(Q.btn, 'w-full')}>Gửi bếp các món này</button>
            <button type="button" onClick={() => { setUnsentPay(false); setCart([]); openPayment(true); }} className={cn(Q.btnGhost, 'w-full')}>Bỏ các món này, thanh toán luôn</button>
            <button type="button" onClick={() => setUnsentPay(false)} className="py-2 text-[14px] font-semibold text-[var(--qr-muted)]">Quay lại</button>
          </div>
        </div>
      </Sheet>
      <Sheet open={confirmClear} onClose={() => setConfirmClear(false)} title="Xóa hết giỏ món?">
        <div className="space-y-4 px-5 pb-[max(20px,env(safe-area-inset-bottom))] pt-1">
          <p className="text-[14.5px] text-[var(--qr-muted)]">Tất cả {cartCount} món trong giỏ sẽ bị xóa (chưa gửi tới bếp).</p>
          <div className="flex gap-3">
            <button type="button" onClick={() => setConfirmClear(false)} className={cn(Q.btnGhost, 'flex-1')}>Giữ lại</button>
            <button type="button" onClick={() => { setCart([]); setConfirmClear(false); }} className={cn(Q.btnDanger, 'flex-1')}>Xóa hết</button>
          </div>
        </div>
      </Sheet>
      <Sheet open={confirmSend} onClose={() => setConfirmSend(false)} title="Gửi gọi món?">
        <div className="space-y-4 px-5 pb-[max(20px,env(safe-area-inset-bottom))] pt-1">
          <p className="text-[14.5px] text-[var(--qr-muted)]">{cartCount} món · tạm tính <b className="text-[var(--qr-primary)]">{vnd(cartTotal)}</b>. Món đã gửi chỉ hủy được khi bếp chưa bắt đầu chế biến.</p>
          <div className="flex gap-3">
            <button type="button" onClick={() => setConfirmSend(false)} className={cn(Q.btnGhost, 'flex-1')}>Xem lại</button>
            <button type="button" disabled={send.isPending} onClick={() => send.mutate()} className={cn(Q.btn, 'flex-1')}>{send.isPending ? 'Đang gửi…' : 'Gửi'}</button>
          </div>
        </div>
      </Sheet>
      <Sheet open={Boolean(cancelTarget)} onClose={() => setCancelTarget(null)} title="Hủy món?">
        <div className="space-y-4 px-5 pb-[max(20px,env(safe-area-inset-bottom))] pt-1">
          <p className="text-[14.5px] text-[var(--qr-muted)]">{cancelTarget ? (cancelTarget.setName ? `Món trong set chỉ hủy được cả set: toàn bộ ${cancelTarget.setName} sẽ bị hủy.` : `${cancelTarget.name} × ${cancelTarget.qty} sẽ bị hủy.`) : ''}</p>
          <div className="flex gap-3">
            <button type="button" onClick={() => setCancelTarget(null)} className={cn(Q.btnGhost, 'flex-1')}>Đóng</button>
            <button type="button" disabled={cancel.isPending} onClick={() => cancelTarget && cancel.mutate(cancelTarget)} className={cn(Q.btnDanger, 'flex-1')}>Hủy món</button>
          </div>
        </div>
      </Sheet>
      <CallStaffSheet
        open={staffOpen}
        onClose={() => setStaffOpen(false)}
        waiting={t.support}
        sending={staffCall.isPending || cancelReq.isPending}
        error={staffError}
        onSend={(type, content) => staffCall.mutate({ type, content })}
        onCancel={(id) => cancelReq.mutate(id)}
      />
      <AnimatePresence>
      {t.paid && !order && thanksSeen !== t.paid.code ? (
        <ThanksScreen
          key="thanks"
          code={t.paid.code}
          total={t.paid.total}
          onClose={() => {
            sessionStorage.setItem(`rms-thanks-${token}`, t.paid?.code ?? '');
            setThanksSeen(t.paid?.code ?? '');
            // Về thẳng thực đơn: đóng mọi màn còn mở phía dưới (đã gửi, món của tôi, hóa đơn…).
            setSent(null);
            setParams((p) => {
              const n = new URLSearchParams(p);
              (['mon', 'set', 'gio', 'don', 'tt', 'hd'] as const).forEach((k) => n.delete(k));
              return n;
            }, { replace: true });
            window.scrollTo({ top: 0 });
          }}
        />
      ) : null}
      </AnimatePresence>
    </Shell>
  );
}

/** "10:00 hôm nay" · "10:00 sáng mai" · "09:00 Chủ nhật" — giờ mở cửa lại. */
function reopenText(iso: string): string {
  const at = new Date(iso);
  const time = at.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  const day = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diff = Math.round((day(at) - day(new Date())) / 86_400_000);
  if (diff <= 0) return `lúc ${time}`;
  if (diff === 1) return `${time} ${at.getHours() < 12 ? 'sáng' : at.getHours() < 18 ? 'chiều' : 'tối'} mai`;
  return `${time} ${at.toLocaleDateString('vi-VN', { weekday: 'long' })}`;
}

/** Khung trang: cột giữa rộng tối đa như màn hình điện thoại; bộ màu / phông riêng (.qr-theme), sáng hoặc tối. */
function Shell({ children, mode }: { children: ReactNode; mode: 'light' | 'dark' }) {
  return (
    <div className="qr-theme min-h-dvh bg-[var(--qr-page)]" data-qr-mode={mode}>
      <div className="relative mx-auto min-h-dvh max-w-[480px] bg-[var(--qr-bg)]">{children}</div>
    </div>
  );
}
