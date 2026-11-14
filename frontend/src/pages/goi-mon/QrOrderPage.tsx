import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { BellRing, ChevronRight, ClipboardList, Receipt, Search, ShoppingBag, UtensilsCrossed, X } from 'lucide-react';
import { cancelQrItem, getQrMenu, getQrTable, qrStreamUrl, sendQrOrder } from '@/api/ordering';
import { CartSheet, DishRow, DishSheet, OrdersTab, Sheet, vnd } from '@/features/ordering/QrParts';
import { useLiveEvents } from '@/features/ordering/live';
import { BusinessError, ValidationError } from '@/lib/mock';
import { matchesKeyword } from '@/lib/normalize';
import { cn } from '@/lib/cn';
import type { CartLine, MenuDish, OrderItem } from '@/types';

type Tab = 'menu' | 'orders';

const cartKey = (token: string) => `rms-cart-${token}`;
const lineKey = (dishId: string, note: string) => `${dishId}|${note.trim().toLowerCase()}`;

function loadCart(token: string): CartLine[] {
  try {
    const raw = localStorage.getItem(cartKey(token));
    return raw ? (JSON.parse(raw) as CartLine[]) : [];
  } catch {
    return [];
  }
}

/**
 * Trang đặt món của khách tại bàn (UC-KH-01..04) — mở bằng mã QR dán trên bàn, không đăng nhập.
 * Giao diện kiểu app đặt đồ ăn trên điện thoại; giỏ món lưu riêng trên máy cho tới khi gửi.
 */
export default function QrOrderPage() {
  const { token = '' } = useParams<{ token: string }>();
  const qc = useQueryClient();
  const keys = useMemo(() => ({ info: ['qr', token, 'info'], menu: ['qr', token, 'menu'] }), [token]);
  const info = useQuery({ queryKey: keys.info, queryFn: () => getQrTable(token), refetchInterval: 10_000, retry: false });
  const menu = useQuery({ queryKey: keys.menu, queryFn: () => getQrMenu(token), refetchInterval: 60_000, enabled: info.isSuccess });
  useLiveEvents(info.isSuccess ? qrStreamUrl(token) : null, [keys.info, keys.menu]);

  const [tab, setTab] = useState<Tab>('menu');
  const [cart, setCart] = useState<CartLine[]>(() => loadCart(token));
  const [keyword, setKeyword] = useState('');
  const [activeCat, setActiveCat] = useState<string>('');
  const [openDish, setOpenDish] = useState<MenuDish | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [confirmSend, setConfirmSend] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<OrderItem | null>(null);
  const [invalid, setInvalid] = useState<Set<string>>(new Set());
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});
  const chipBar = useRef<HTMLDivElement>(null);

  useEffect(() => {
    localStorage.setItem(cartKey(token), JSON.stringify(cart));
  }, [cart, token]);

  const order = info.data?.order ?? null;
  const dishes = useMemo(() => menu.data?.dishes ?? [], [menu.data]);
  const categories = useMemo(
    () => (menu.data?.categories ?? []).filter((c) => dishes.some((d) => d.categoryId === c.id)),
    [menu.data, dishes],
  );
  const filtered = useMemo(() => dishes.filter((d) => !keyword.trim() || matchesKeyword(d.name, keyword)), [dishes, keyword]);
  const qtyOf = (dishId: string) => cart.filter((l) => l.dishId === dishId).reduce((s, l) => s + l.qty, 0);
  const cartCount = cart.reduce((s, l) => s + l.qty, 0);
  const cartTotal = cart.reduce((s, l) => s + l.price * l.qty, 0);
  const activeOrderCount = order ? order.items.filter((i) => i.status !== 'cancelled' && i.status !== 'served').length : 0;

  // Món trong giỏ vừa tạm hết → đánh dấu để khách xóa.
  useEffect(() => {
    if (!dishes.length) return;
    const gone = new Set(cart.filter((l) => !dishes.some((d) => d.id === l.dishId && !d.soldOut)).map((l) => l.dishId));
    setInvalid(gone);
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

  /** Bộ tăng giảm trên dòng món: chỉnh dòng không ghi chú của món (thêm mới nếu chưa có). */
  const setPlainQty = (dish: MenuDish, qty: number) => {
    setCart((prev) => {
      const key = lineKey(dish.id, '');
      const others = prev.filter((l) => l.dishId === dish.id && l.key !== key).reduce((s, l) => s + l.qty, 0);
      const plain = Math.max(0, qty - others);
      if (plain === 0) return prev.filter((l) => l.key !== key);
      if (prev.some((l) => l.key === key)) return prev.map((l) => (l.key === key ? { ...l, qty: plain } : l));
      return [...prev, { key, dishId: dish.id, name: dish.name, price: dish.price, image: dish.image, qty: plain, note: '' }];
    });
  };

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
      setCart([]);
      setConfirmSend(false);
      setCartOpen(false);
      setTab('orders');
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

  /* ---------------- Danh mục: bấm cuộn tới mục, cuộn trang thì đổi mục đang chọn */
  useEffect(() => {
    if (tab !== 'menu' || keyword) return;
    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible) setActiveCat(visible.target.getAttribute('data-cat') ?? '');
      },
      { rootMargin: '-140px 0px -60% 0px' },
    );
    Object.values(sectionRefs.current).forEach((el) => el && obs.observe(el));
    return () => obs.disconnect();
  }, [categories, tab, keyword]);

  useEffect(() => {
    const chip = chipBar.current?.querySelector<HTMLElement>(`[data-chip="${activeCat}"]`);
    chip?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
  }, [activeCat]);

  const jumpTo = (catId: string) => {
    setKeyword('');
    const el = sectionRefs.current[catId];
    if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 118, behavior: 'smooth' });
  };

  const comingSoon = (what: string) => toast.info(`${what} sẽ có trong bản cập nhật tới. Vui lòng gọi trực tiếp nhân viên.`);

  /* ---------------- Trạng thái lỗi / đang tải */
  if (info.isError) {
    const msg = info.error instanceof Error ? info.error.message : 'Không tải được dữ liệu';
    return (
      <Shell>
        <div className="flex min-h-[80dvh] flex-col items-center justify-center px-8 text-center">
          <UtensilsCrossed size={48} className="text-[#c4ccc8]" strokeWidth={1.3} />
          <p className="mt-4 text-[17px] font-bold">{msg}</p>
          <button type="button" onClick={() => void info.refetch()} className="mt-5 rounded-full border border-[#0f7b5a] px-5 py-2 text-[14px] font-semibold text-[#0f7b5a]">Thử lại</button>
        </div>
      </Shell>
    );
  }
  if (!info.data) {
    return (
      <Shell>
        <div className="h-[150px] animate-pulse bg-[#e8f5ee]" />
        <div className="space-y-4 p-4">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-[88px] animate-pulse rounded-xl bg-[#f2f4f3]" />)}</div>
      </Shell>
    );
  }

  const t = info.data;
  const sendBlocked = !t.openNow ? 'Nhà hàng hiện ngoài giờ phục vụ, chưa gửi món được.' : order?.locked ? 'Bàn đang chờ thanh toán, không gọi thêm món được. Vui lòng gọi nhân viên nếu cần gọi thêm.' : invalid.size ? 'Một số món trong giỏ đã hết. Vui lòng xóa các món được đánh dấu.' : null;

  return (
    <Shell>
      {/* Đầu trang */}
      <header className="relative overflow-hidden bg-gradient-to-br from-[#0f7b5a] to-[#14a072] px-4 pb-5 pt-6 text-white">
        <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10" aria-hidden />
        <p className="text-[13px] font-medium opacity-90">Chào mừng đến với</p>
        <h1 className="text-[24px] font-extrabold leading-tight text-white">{t.restaurantName}</h1>
        <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-[13px] font-semibold">
          Bàn {t.tableCode} · {t.areaName}
        </div>
        <div className="mt-3 flex gap-2">
          <button type="button" onClick={() => comingSoon('Gọi nhân viên')} className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-[13px] font-semibold text-[#0f7b5a]"><BellRing size={14} />Gọi nhân viên</button>
          <button type="button" onClick={() => comingSoon('Yêu cầu thanh toán')} className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1.5 text-[13px] font-semibold"><Receipt size={14} />Thanh toán</button>
        </div>
      </header>
      {!t.openNow ? <div className="bg-[#fff7ed] px-4 py-2 text-[13px] text-[#8a4b12]">Nhà hàng hiện ngoài giờ phục vụ — bạn vẫn xem được thực đơn.</div> : null}
      {order?.locked ? <div className="bg-[#fff7ed] px-4 py-2 text-[13px] text-[#8a4b12]">Bàn đang chờ thanh toán.</div> : null}

      {tab === 'menu' ? (
        <>
          {/* Tìm món + danh mục dính đầu */}
          <div className="sticky top-0 z-20 bg-white shadow-[0_1px_0_#eef1ef]">
            <div className="px-4 pt-3">
              <label className="flex items-center gap-2 rounded-full bg-[#f2f4f3] px-3.5 py-2">
                <Search size={16} className="text-[#8a938e]" />
                <input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="Tìm món ăn, đồ uống…" className="min-w-0 flex-1 bg-transparent text-[14px] outline-none" />
                {keyword ? <button type="button" aria-label="Xóa tìm kiếm" onClick={() => setKeyword('')}><X size={15} className="text-[#8a938e]" /></button> : null}
              </label>
            </div>
            {!keyword ? (
              <div ref={chipBar} className="no-scrollbar flex gap-1 overflow-x-auto px-3 pb-2 pt-2.5">
                {categories.map((c) => (
                  <button
                    key={c.id}
                    data-chip={c.id}
                    type="button"
                    onClick={() => jumpTo(c.id)}
                    className={cn('shrink-0 rounded-full px-3.5 py-1.5 text-[13.5px] font-semibold transition-colors', (activeCat || categories[0]?.id) === c.id ? 'bg-[#0f7b5a] text-white' : 'text-[#4a524e]')}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            ) : <div className="h-2" />}
          </div>

          <main className="px-4 pb-40">
            {menu.isLoading ? (
              <div className="space-y-4 pt-4">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-[88px] animate-pulse rounded-xl bg-[#f2f4f3]" />)}</div>
            ) : dishes.length === 0 ? (
              <p className="py-16 text-center text-[14px] text-[#6b7570]">Thực đơn đang được cập nhật. Vui lòng liên hệ nhân viên.</p>
            ) : keyword ? (
              filtered.length === 0 ? (
                <p className="py-16 text-center text-[14px] text-[#6b7570]">Không tìm thấy món phù hợp</p>
              ) : (
                <div className="divide-y divide-[#f0f2f1]">
                  {filtered.map((d) => <DishRow key={d.id} dish={d} inCart={qtyOf(d.id)} onOpen={() => setOpenDish(d)} onAdd={() => addToCart(d, 1, '')} onChangeQty={(q) => setPlainQty(d, q)} />)}
                </div>
              )
            ) : (
              categories.map((c) => (
                <section key={c.id} data-cat={c.id} ref={(el) => { sectionRefs.current[c.id] = el; }} className="pt-4">
                  <h2 className="text-[17px] font-bold">{c.name}</h2>
                  <div className="divide-y divide-[#f0f2f1]">
                    {dishes.filter((d) => d.categoryId === c.id).map((d) => (
                      <DishRow key={d.id} dish={d} inCart={qtyOf(d.id)} onOpen={() => setOpenDish(d)} onAdd={() => addToCart(d, 1, '')} onChangeQty={(q) => setPlainQty(d, q)} />
                    ))}
                  </div>
                </section>
              ))
            )}
          </main>
        </>
      ) : (
        <main className="min-h-[60dvh] bg-[#f7f8f7] pb-28">
          <OrdersTab order={order} onCancel={setCancelTarget} onBrowse={() => setTab('menu')} />
        </main>
      )}

      {/* Thanh giỏ hàng nổi */}
      {cartCount > 0 && tab === 'menu' ? (
        <div className="fixed inset-x-0 bottom-[64px] z-30 mx-auto max-w-[480px] px-3">
          <button type="button" onClick={() => setCartOpen(true)} className="flex w-full items-center gap-3 rounded-2xl bg-[#0f7b5a] px-4 py-3 text-white shadow-lg active:scale-[0.99]">
            <span className="relative">
              <ShoppingBag size={22} />
              <span className="absolute -right-2 -top-2 grid h-5 min-w-5 place-items-center rounded-full bg-[#ff6b35] px-1 text-[11px] font-bold">{cartCount}</span>
            </span>
            <span className="flex-1 text-left text-[15px] font-bold">{vnd(cartTotal)}</span>
            <span className="inline-flex items-center text-[14px] font-semibold">Xem giỏ <ChevronRight size={18} /></span>
          </button>
        </div>
      ) : null}

      {/* Thanh tab dưới cùng */}
      <nav className="fixed inset-x-0 bottom-0 z-30 mx-auto flex max-w-[480px] border-t border-[#eef1ef] bg-white pb-[env(safe-area-inset-bottom)]">
        <TabButton active={tab === 'menu'} onClick={() => setTab('menu')} icon={<UtensilsCrossed size={20} />} label="Thực đơn" />
        <TabButton active={tab === 'orders'} onClick={() => setTab('orders')} icon={<ClipboardList size={20} />} label="Món đã gọi" badge={activeOrderCount} />
      </nav>

      <DishSheet dish={openDish} onClose={() => setOpenDish(null)} onAdd={(d, q, n) => { addToCart(d, q, n); setOpenDish(null); }} />
      <CartSheet
        open={cartOpen}
        lines={cart}
        invalid={invalid}
        sending={send.isPending}
        onClose={() => setCartOpen(false)}
        onChange={changeLine}
        onRemove={(key) => setCart((prev) => prev.filter((l) => l.key !== key))}
        onSend={() => setConfirmSend(true)}
        disabledReason={sendBlocked}
      />
      <Sheet open={confirmSend} onClose={() => setConfirmSend(false)} title="Gửi đặt món?">
        <div className="space-y-4 p-4 pb-[max(16px,env(safe-area-inset-bottom))]">
          <p className="text-[14.5px] text-[#4a524e]">{cartCount} món · tạm tính <b>{vnd(cartTotal)}</b>. Món đã gửi chỉ hủy được khi bếp chưa bắt đầu chế biến.</p>
          <div className="flex gap-2">
            <button type="button" onClick={() => setConfirmSend(false)} className="flex-1 rounded-xl border border-[#dfe4e1] py-3 text-[15px] font-semibold">Xem lại</button>
            <button type="button" disabled={send.isPending} onClick={() => send.mutate()} className="flex-1 rounded-xl bg-[#0f7b5a] py-3 text-[15px] font-bold text-white disabled:opacity-50">{send.isPending ? 'Đang gửi…' : 'Gửi'}</button>
          </div>
        </div>
      </Sheet>
      <Sheet open={Boolean(cancelTarget)} onClose={() => setCancelTarget(null)} title="Hủy món?">
        <div className="space-y-4 p-4 pb-[max(16px,env(safe-area-inset-bottom))]">
          <p className="text-[14.5px] text-[#4a524e]">{cancelTarget ? `${cancelTarget.name} × ${cancelTarget.qty} sẽ bị hủy.` : ''}</p>
          <div className="flex gap-2">
            <button type="button" onClick={() => setCancelTarget(null)} className="flex-1 rounded-xl border border-[#dfe4e1] py-3 text-[15px] font-semibold">Đóng</button>
            <button type="button" disabled={cancel.isPending} onClick={() => cancelTarget && cancel.mutate(cancelTarget)} className="flex-1 rounded-xl bg-[#c62828] py-3 text-[15px] font-bold text-white disabled:opacity-50">Hủy món</button>
          </div>
        </div>
      </Sheet>
    </Shell>
  );
}

/** Khung trang: cột giữa rộng tối đa như màn hình điện thoại, nền trắng cố định (không theo chế độ tối của trang quản lý). */
function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-[#eef1ef] text-[#1b1f1d] [color-scheme:light]">
      <div className="relative mx-auto min-h-dvh max-w-[480px] bg-white shadow-[0_0_40px_rgba(0,0,0,0.06)]">{children}</div>
    </div>
  );
}

function TabButton({ active, onClick, icon, label, badge }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string; badge?: number }) {
  return (
    <button type="button" onClick={onClick} className={cn('relative flex flex-1 flex-col items-center gap-0.5 py-2 text-[11.5px] font-semibold', active ? 'text-[#0f7b5a]' : 'text-[#8a938e]')}>
      {icon}
      {label}
      {badge ? <span className="absolute left-1/2 top-1 ml-2 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-[#ff6b35] px-1 text-[10.5px] font-bold text-white">{badge}</span> : null}
    </button>
  );
}
