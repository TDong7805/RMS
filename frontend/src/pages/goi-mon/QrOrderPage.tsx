import '@fontsource/be-vietnam-pro/400.css';
import '@fontsource/be-vietnam-pro/500.css';
import '@fontsource/be-vietnam-pro/600.css';
import '@fontsource/be-vietnam-pro/700.css';
import '@/features/ordering/qr-theme.css';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowRight, BellRing, ChevronRight, Clock3, Flame, Moon, Search, ShoppingBag, SlidersHorizontal, Sun, UtensilsCrossed, X } from 'lucide-react';
import { callStaff, cancelQrItem, cancelQrRequest, getQrMenu, getQrTable, qrStreamUrl, requestPayment, sendQrOrder } from '@/api/ordering';
import {
  CategoryPills,
  DishRow,
  EMPTY_FILTER,
  FilterSheet,
  PopularCard,
  Q,
  Sheet,
  applyMenuFilter,
  vnd,
  type MenuFilter,
} from '@/features/ordering/QrParts';
import { CartScreen, DishDetailScreen, MyOrderScreen, SentScreen } from '@/features/ordering/QrScreens';
import { CallStaffSheet, InvoiceScreen, PaymentScreen, ThanksScreen } from '@/features/ordering/QrService';
import { useLiveEvents } from '@/features/ordering/live';
import { BusinessError, ValidationError } from '@/lib/mock';
import { matchesKeyword } from '@/lib/normalize';
import { cn } from '@/lib/cn';
import type { CartLine, MenuDish, OrderItem, QrTableInfo } from '@/types';

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

type ScreenKey = 'mon' | 'gio' | 'don' | 'tt' | 'hd';

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
  const toggle = () => {
    const next = mode === 'dark' ? 'light' : 'dark';
    localStorage.setItem(MODE_KEY, next);
    setStored(next);
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
  const screen = (['gio', 'don', 'tt', 'hd'] as const).find((k) => params.get(k) === '1') ?? null;
  const [cart, setCart] = useState<CartLine[]>(() => loadCart(token));
  const [keyword, setKeyword] = useState('');
  const [activeCat, setActiveCat] = useState('all');
  const [pendingJump, setPendingJump] = useState<string | null>(null);
  const [filter, setFilter] = useState<MenuFilter>(EMPTY_FILTER);
  const [filterOpen, setFilterOpen] = useState(false);
  const [confirmSend, setConfirmSend] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [sent, setSent] = useState<{ count: number; total: number } | null>(null);
  const [cancelTarget, setCancelTarget] = useState<OrderItem | null>(null);
  const [invalid, setInvalid] = useState<Set<string>>(new Set());
  const [staffOpen, setStaffOpen] = useState(false);
  const [staffError, setStaffError] = useState('');
  const [payErrors, setPayErrors] = useState<Record<string, string>>({});
  const [thanksSeen, setThanksSeen] = useState(() => sessionStorage.getItem(`rms-thanks-${token}`) ?? '');
  const listTop = useRef<HTMLDivElement>(null);
  const chipBar = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

  const openScreen = useCallback(
    (key: ScreenKey, value = '1') =>
      setParams((p) => {
        const n = new URLSearchParams(p);
        (['mon', 'gio', 'don', 'tt', 'hd'] as const).forEach((k) => n.delete(k));
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
          (['mon', 'gio', 'don', 'tt', 'hd'] as const).forEach((k) => n.delete(k));
          return n;
        },
        { replace: true },
      );
  }, [navigate, setParams]);

  useEffect(() => {
    localStorage.setItem(cartKey(token), JSON.stringify(cart));
  }, [cart, token]);

  const order = info.data?.order ?? null;
  const dishes = useMemo(() => menu.data?.dishes ?? [], [menu.data]);
  const categories = useMemo(() => (menu.data?.categories ?? []).filter((c) => dishes.some((d) => d.categoryId === c.id)), [menu.data, dishes]);
  const qtyOf = (dishId: string) => cart.filter((l) => l.dishId === dishId).reduce((s, l) => s + l.qty, 0);
  const cartCount = cart.reduce((s, l) => s + l.qty, 0);
  const cartTotal = cart.reduce((s, l) => s + l.price * l.qty, 0);
  const activeOrderCount = order ? order.items.filter((i) => i.status !== 'cancelled' && i.status !== 'served').length : 0;

  // Món trong giỏ vừa tạm hết → đánh dấu để khách xóa.
  useEffect(() => {
    if (!dishes.length) return;
    setInvalid(new Set(cart.filter((l) => !dishes.some((d) => d.id === l.dishId && !d.soldOut)).map((l) => l.dishId)));
  }, [dishes, cart]);

  /* ---------------- Giỏ món */
  const addToCart = useCallback((dish: MenuDish, qty: number, note: string) => {
    setCart((prev) => {
      const key = lineKey(dish.id, note);
      const found = prev.find((l) => l.key === key);
      if (found) return prev.map((l) => (l.key === key ? { ...l, qty: Math.min(20, l.qty + qty) } : l));
      return [...prev, { key, dishId: dish.id, name: dish.name, price: dish.price, image: dish.image, qty, note }];
    });
    toast.success(`Đã thêm ${dish.name} vào giỏ`, { duration: 1500 });
  }, []);

  /** Nút tăng giảm trên thẻ món: chỉnh dòng không ghi chú của món (thêm mới nếu chưa có). */
  const setPlainQty = (dish: MenuDish, qty: number) =>
    setCart((prev) => {
      const key = lineKey(dish.id, '');
      const others = prev.filter((l) => l.dishId === dish.id && l.key !== key).reduce((s, l) => s + l.qty, 0);
      const plain = Math.max(0, qty - others);
      if (plain === 0) return prev.filter((l) => l.key !== key);
      if (prev.some((l) => l.key === key)) return prev.map((l) => (l.key === key ? { ...l, qty: plain } : l));
      return [...prev, { key, dishId: dish.id, name: dish.name, price: dish.price, image: dish.image, qty: plain, note: '' }];
    });

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
    mutationFn: () => sendQrOrder(token, cart.map((l) => ({ dishId: l.dishId, qty: l.qty, note: l.note }))),
    onSuccess: (o) => {
      toast.success(`Đã gửi ${cartCount} món tới bếp`);
      setSent({ count: cartCount, total: cartTotal });
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
      toast.success(`Đã hủy ${item.name}`);
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

  const openPayment = () => {
    if (info.data?.invoice) openScreen('hd');
    else if (!order || order.items.every((i) => i.status === 'cancelled')) toast.info('Bàn chưa có món nào để thanh toán');
    else openScreen('tt');
  };

  /* ---------------- Danh mục: bấm cuộn nhanh tới mục, cuộn trang thì viên danh mục tự sáng theo */
  const browsing = !keyword.trim() && filter.sort === 'default' && filter.tags.length === 0;
  const scrollToCategory = useCallback((id: string) => {
    const el = id === 'all' ? listTop.current : sectionRefs.current[id];
    if (!el) return;
    // Trừ chiều cao thanh danh mục dính đầu trang để tiêu đề mục không bị che.
    const offset = id === 'all' ? 0 : (chipBar.current?.offsetHeight ?? 0) + 8;
    window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - offset, behavior: 'smooth' });
  }, []);

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
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible) setActiveCat(visible.target.getAttribute('data-cat') ?? 'all');
      },
      { rootMargin: '-90px 0px -65% 0px' },
    );
    Object.values(sectionRefs.current).forEach((el) => el && obs.observe(el));
    return () => obs.disconnect();
  }, [browsing, menu.data]);

  useEffect(() => {
    const chip = chipBar.current?.querySelector<HTMLElement>(`[data-chip="${activeCat}"]`);
    chip?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
  }, [activeCat]);

  /* ---------------- Trạng thái lỗi / đang tải */
  if (info.isError) {
    const msg = info.error instanceof Error ? info.error.message : 'Không tải được dữ liệu';
    return (
      <Shell mode={mode}>
        <div className="flex min-h-[80dvh] flex-col items-center justify-center px-8 text-center">
          <span className="grid h-20 w-20 place-items-center rounded-3xl bg-[var(--qr-primary-soft)] text-[var(--qr-primary)]"><UtensilsCrossed size={38} strokeWidth={1.5} /></span>
          <p className="mt-4 text-[17px] font-semibold">{msg}</p>
          <button type="button" onClick={() => void info.refetch()} className={cn(Q.btn, 'mt-5 px-6 py-2.5 text-[14px]')}>Thử lại</button>
        </div>
      </Shell>
    );
  }
  if (!info.data) {
    return (
      <Shell mode={mode}>
        <div className="space-y-4 p-5 pt-6">
          <div className="h-10 w-48 animate-pulse rounded-2xl bg-[var(--qr-surface-2)]" />
          <div className="h-[200px] animate-pulse rounded-3xl bg-[var(--qr-surface-2)]" />
          <div className="flex gap-2">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-11 w-24 animate-pulse rounded-2xl bg-[var(--qr-surface-2)]" />)}</div>
          {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-[116px] animate-pulse rounded-[20px] bg-[var(--qr-surface-2)]" />)}
        </div>
      </Shell>
    );
  }

  const t = info.data;
  const sendBlocked = !t.openNow
    ? 'Nhà hàng hiện ngoài giờ phục vụ, chưa gửi món được.'
    : order?.locked
      ? 'Bàn đang chờ thanh toán, không gọi thêm món được. Vui lòng gọi nhân viên nếu cần gọi thêm.'
      : invalid.size
        ? 'Một số món trong giỏ đã hết. Vui lòng xóa các món được đánh dấu.'
        : null;
  const allCategories = menu.data?.categories ?? [];
  const catName = (d: { categoryId: string }) => allCategories.find((c) => c.id === d.categoryId)?.name;
  const byId = new Map(dishes.map((d) => [d.id, d]));
  const best = (menu.data?.bestSellers ?? []).map((id) => byId.get(id)).filter((d): d is MenuDish => Boolean(d));
  const rankOf = new Map(best.map((d, i) => [d.id, i + 1]));
  const openDish = openDishId ? byId.get(openDishId) ?? null : null;
  const imageOfCategory = (id: string) => dishes.find((d) => d.categoryId === id && d.image)?.image ?? null;
  const filtering = filter.sort !== 'default' || filter.tags.length > 0;
  const searching = keyword.trim().length > 0;
  const scoped = dishes.filter((d) => !searching || matchesKeyword(d.name, keyword));
  const results = applyMenuFilter(scoped, filter, rankOf);
  const row = (d: MenuDish) => (
    <DishRow
      key={d.id}
      dish={d}
      categoryName={catName(d)}
      best={rankOf.has(d.id)}
      inCart={qtyOf(d.id)}
      onOpen={() => openScreen('mon', d.id)}
      onAdd={() => addToCart(d, 1, '')}
      onChangeQty={(q) => setPlainQty(d, q)}
    />
  );
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
        <button type="button" aria-label={t.support ? 'Đang chờ nhân viên' : 'Gọi nhân viên'} onClick={() => setStaffOpen(true)} className={cn(Q.iconBtn, 'relative h-11 w-11 rounded-2xl', t.support && 'text-[var(--qr-primary)]')}>
          <BellRing size={19} className={t.support ? 'animate-pulse' : ''} />
          {t.support ? <span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-[var(--qr-primary)]" /> : null}
        </button>
        <button type="button" onClick={() => openScreen('don')} className="inline-flex h-11 items-center gap-2 rounded-2xl bg-[var(--qr-primary)] px-4 text-[14px] font-semibold text-white">
          <ShoppingBag size={17} />Món của tôi
          {activeOrderCount ? <span className="grid h-5 min-w-5 place-items-center rounded-full bg-white px-1 text-[11px] font-bold text-[var(--qr-primary)]">{activeOrderCount}</span> : null}
        </button>
      </header>

      {/* Ảnh bìa + tìm kiếm + lọc */}
      <div className="relative">
        <button type="button" aria-label={mode === 'dark' ? 'Chuyển sang nền sáng' : 'Chuyển sang nền tối'} onClick={toggleMode} className="absolute right-4 top-4 z-10 grid h-10 w-10 place-items-center rounded-full bg-black/35 text-white backdrop-blur">
          {mode === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>
        {t.coverImage ? (
          <div className="relative h-[210px]">
            <img src={t.coverImage} alt={t.restaurantName} className="h-full w-full object-cover" />
            <div className="absolute inset-x-0 top-0 bg-gradient-to-b from-black/55 to-transparent px-5 pb-10 pt-4 text-white">
              <p className="text-[12px] opacity-90">Chào mừng đến với</p>
              <p className="text-[20px] font-bold leading-tight">{t.restaurantName}</p>
            </div>
          </div>
        ) : (
          <div className="qr-pattern flex h-[210px] flex-col justify-center px-6 text-white">
            <p className="text-[14px] opacity-90">Chào mừng đến với</p>
            <p className="text-[26px] font-bold leading-tight">{t.restaurantName}</p>
            <p className="mt-1 text-[13px] opacity-85">Gọi món ngay tại bàn — bếp nhận tức thì</p>
          </div>
        )}
        <div className="absolute inset-x-5 bottom-4 flex gap-2.5">
          <label className="flex min-w-0 flex-1 items-center gap-2.5 rounded-2xl bg-[var(--qr-surface)] px-4 py-3 shadow-lg">
            <Search size={18} className="shrink-0 text-[var(--qr-muted)]" />
            <input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="Tìm món ăn, đồ uống…" className="min-w-0 flex-1 bg-transparent text-[14.5px] outline-none placeholder:text-[var(--qr-muted)]" />
            {searching ? <button type="button" aria-label="Xóa tìm kiếm" onClick={() => setKeyword('')}><X size={16} className="text-[var(--qr-muted)]" /></button> : null}
          </label>
          <button type="button" aria-label="Sắp xếp và lọc" onClick={() => setFilterOpen(true)} className="relative grid w-[50px] shrink-0 place-items-center rounded-2xl bg-[var(--qr-primary)] text-white shadow-lg">
            <SlidersHorizontal size={20} />
            {filtering ? <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-white px-1 text-[10.5px] font-bold text-[var(--qr-primary)] shadow">{filter.tags.length + (filter.sort !== 'default' ? 1 : 0)}</span> : null}
          </button>
        </div>
      </div>

      {!t.openNow ? <Notice icon={<Clock3 size={15} />}>Nhà hàng hiện ngoài giờ phục vụ — bạn vẫn xem được thực đơn.</Notice> : null}
      {t.invoice ? (
        <button type="button" onClick={() => openScreen('hd')} className="mx-5 mt-3 flex w-[calc(100%-2.5rem)] items-center justify-between rounded-2xl bg-[var(--qr-warn-soft)] px-4 py-3 text-left text-[13.5px] text-[var(--qr-warn-text)]">
          <span>Hóa đơn <b>{t.invoice.code}</b> · {vnd(t.invoice.total)} — chờ thanh toán</span>
          <ChevronRight size={16} />
        </button>
      ) : order?.locked ? <Notice>Bàn đang chờ thanh toán.</Notice> : null}

      {/* Danh mục (dính đầu trang khi cuộn) */}
      <div ref={listTop} />
      <div ref={chipBar} className="sticky top-0 z-20 bg-[var(--qr-bg)]">
        <CategoryPills categories={categories} active={activeCat} onPick={pickCategory} imageOf={imageOfCategory} />
      </div>

      <main className="px-5 pb-40">
        {menu.isLoading ? (
          <div className="space-y-3 pt-2">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-[116px] animate-pulse rounded-[20px] bg-[var(--qr-surface-2)]" />)}</div>
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
                <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-[var(--qr-surface-2)] text-[var(--qr-muted)]"><Search size={28} /></span>
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
                <h2 className="mb-3 flex items-center gap-1.5 text-[18px] font-semibold"><Flame size={19} className="text-[var(--qr-accent)]" fill="currentColor" />Bán chạy</h2>
                <div className="no-scrollbar -mx-5 flex gap-3 overflow-x-auto px-5 pb-3">
                  {best.map((d, i) => (
                    <PopularCard key={d.id} dish={d} categoryName={catName(d)} rank={i + 1} inCart={qtyOf(d.id)} onOpen={() => openScreen('mon', d.id)} onAdd={() => addToCart(d, 1, '')} onChangeQty={(q) => setPlainQty(d, q)} />
                  ))}
                </div>
              </section>
            ) : null}
            <h2 className="mb-1 mt-4 text-[18px] font-semibold">Tất cả món</h2>
            {categories.map((c) => (
              <section key={c.id} data-cat={c.id} ref={(el) => { sectionRefs.current[c.id] = el; }} className="pt-3">
                <p className="mb-2 text-[13px] font-semibold uppercase tracking-wide text-[var(--qr-muted)]">{c.name}</p>
                <div className="space-y-3">{dishes.filter((d) => d.categoryId === c.id).map(row)}</div>
              </section>
            ))}
          </>
        )}
      </main>

      {/* Thanh nổi: số món trong giỏ + Xác nhận gọi món */}
      {cartCount > 0 ? (
        <div className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-[480px] px-5 pb-[max(16px,env(safe-area-inset-bottom))]">
          <button type="button" onClick={() => openScreen('gio')} className="flex w-full overflow-hidden rounded-2xl bg-[var(--qr-primary)] text-[14.5px] font-semibold text-white shadow-[0_10px_30px_rgba(167,30,37,0.35)]">
            <span className="flex items-center gap-2 bg-white/20 px-4 py-4"><ShoppingBag size={18} />{cartCount} món</span>
            <span className="flex flex-1 items-center justify-center gap-2 px-4 py-4">Xác nhận gọi món · {vnd(cartTotal)}<ArrowRight size={18} /></span>
          </button>
        </div>
      ) : null}

      <FilterSheet open={filterOpen} value={filter} onClose={() => setFilterOpen(false)} onApply={(f) => { setFilter(f); setFilterOpen(false); }} />

      {openDish ? (
        <DishDetailScreen
          key={openDish.id}
          dish={openDish}
          categoryName={catName(openDish)}
          best={rankOf.get(openDish.id)}
          onBack={closeScreen}
          onAdd={(d, q, n) => {
            addToCart(d, q, n);
            closeScreen();
          }}
        />
      ) : null}
      {screen === 'gio' ? (
        <CartScreen
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
          onOpenDish={(d) => openScreen('mon', d.id)}
          onAddDish={(d) => addToCart(d, 1, '')}
          disabledReason={sendBlocked}
        />
      ) : null}
      {screen === 'don' ? (
        <MyOrderScreen
          table={t.tableCode}
          order={order}
          support={t.support}
          payment={t.payment}
          hasInvoice={Boolean(t.invoice)}
          onBack={closeScreen}
          onCancel={setCancelTarget}
          onStaff={() => setStaffOpen(true)}
          onPayment={openPayment}
        />
      ) : null}
      {screen === 'tt' ? (
        <PaymentScreen
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
      {screen === 'hd' && t.invoice ? <InvoiceScreen invoice={t.invoice} table={t.tableCode} preferTransfer={t.payment?.paymentMethod === 'transfer'} onBack={closeScreen} /> : null}
      {sent ? <SentScreen count={sent.count} total={sent.total} onMenu={() => setSent(null)} onTrack={() => { setSent(null); openScreen('don'); }} /> : null}

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
          <p className="text-[14.5px] text-[var(--qr-muted)]">{cancelTarget ? `${cancelTarget.name} × ${cancelTarget.qty} sẽ bị hủy.` : ''}</p>
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
      {t.paid && !order && thanksSeen !== t.paid.code ? (
        <ThanksScreen
          code={t.paid.code}
          total={t.paid.total}
          onClose={() => {
            sessionStorage.setItem(`rms-thanks-${token}`, t.paid?.code ?? '');
            setThanksSeen(t.paid?.code ?? '');
          }}
        />
      ) : null}
    </Shell>
  );
}

function Notice({ children, icon }: { children: ReactNode; icon?: ReactNode }) {
  return <div className="mx-5 mt-3 flex items-center gap-2 rounded-2xl bg-[var(--qr-warn-soft)] px-4 py-3 text-[13px] text-[var(--qr-warn-text)]">{icon}{children}</div>;
}

/** Khung trang: cột giữa rộng tối đa như màn hình điện thoại; bộ màu / phông riêng (.qr-theme), sáng hoặc tối. */
function Shell({ children, mode }: { children: ReactNode; mode: 'light' | 'dark' }) {
  return (
    <div className="qr-theme min-h-dvh bg-[var(--qr-page)]" data-qr-mode={mode}>
      <div className="relative mx-auto min-h-dvh max-w-[480px] bg-[var(--qr-bg)]">{children}</div>
    </div>
  );
}
