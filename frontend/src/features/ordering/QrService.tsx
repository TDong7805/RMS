import { useState } from 'react';
import { Banknote, BellRing, CheckCircle2, CreditCard, Landmark, MapPin, PartyPopper, ReceiptText } from 'lucide-react';
import { Q, Sheet, StageArt, vnd } from '@/features/ordering/QrParts';
import { Screen, ScreenHeader } from '@/features/ordering/QrScreens';
import { TransferQrBox } from '@/features/ordering/TransferQrBox';
import { cn } from '@/lib/cn';
import type { CustomerRequest, OrderView, QrInvoice } from '@/types';

/* Trang đặt món: Gọi nhân viên (UC-KH-05), Yêu cầu thanh toán + hóa đơn + cảm ơn (UC-KH-06). */

export const REQUEST_TYPE_LABEL: Record<string, string> = { support: 'Hỗ trợ tại bàn', consult: 'Tư vấn món', other: 'Khác', payment: 'Thanh toán' };
export const METHOD_LABEL: Record<string, string> = { cash: 'Tiền mặt', card: 'Thẻ', transfer: 'Chuyển khoản', ewallet: 'Ví điện tử' };
const QUICK = ['Thêm chén đũa', 'Thêm nước', 'Dọn bàn', 'Xin thêm khăn giấy'];
const SAFE = 'pb-[max(20px,env(safe-area-inset-bottom))]';

/* ---------------------------------------------------------------- Gọi nhân viên */

export function CallStaffSheet({ open, onClose, waiting, sending, onSend, onCancel, error }: {
  open: boolean;
  onClose: () => void;
  waiting: CustomerRequest | null;
  sending: boolean;
  onSend: (type: 'support' | 'consult' | 'other', content: string) => void;
  onCancel: (id: string) => void;
  error: string;
}) {
  const [type, setType] = useState<'support' | 'consult' | 'other'>('support');
  const [content, setContent] = useState('');
  return (
    <Sheet open={open} onClose={onClose} title="Gọi nhân viên">
      {waiting ? (
        <div className={cn('space-y-4 px-5 pt-1', SAFE)}>
          <div className="flex items-start gap-3 rounded-2xl bg-[var(--qr-primary-soft)] p-4">
            <BellRing size={20} className="mt-0.5 shrink-0 animate-pulse text-[var(--qr-primary)]" />
            <div>
              <p className="text-[15px] font-semibold">
                {waiting.status === 'forwarded' && waiting.assignedName ? `Nhân viên ${waiting.assignedName} đang đến` : 'Đã gửi yêu cầu, nhân viên sẽ đến ngay'}
              </p>
              <p className="mt-0.5 text-[13px] text-[var(--qr-muted)]">{REQUEST_TYPE_LABEL[waiting.type]}{waiting.content ? ` · ${waiting.content}` : ''}</p>
            </div>
          </div>
          <div className="flex gap-3">
            {waiting.status === 'new' ? <button type="button" disabled={sending} onClick={() => onCancel(waiting.id)} className={cn(Q.btnGhost, 'flex-1')}>Hủy yêu cầu</button> : null}
            <button type="button" onClick={onClose} className={cn(Q.btn, 'flex-1')}>Đóng</button>
          </div>
        </div>
      ) : (
        <div className={cn('space-y-4 px-5 pt-1', SAFE)}>
          <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Loại yêu cầu">
            {(['support', 'consult', 'other'] as const).map((k) => (
              <button key={k} type="button" role="radio" aria-checked={type === k} onClick={() => setType(k)} className={cn('rounded-2xl px-2 py-3 text-[13.5px] font-medium', type === k ? 'bg-[var(--qr-primary)] text-white' : 'bg-[var(--qr-surface-2)]')}>
                {REQUEST_TYPE_LABEL[k]}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {QUICK.map((q) => (
              <button key={q} type="button" onClick={() => setContent(q)} className={cn('rounded-xl px-3 py-1.5 text-[13px]', content === q ? 'bg-[var(--qr-primary-soft)] font-semibold text-[var(--qr-primary)]' : 'bg-[var(--qr-surface-2)]')}>{q}</button>
            ))}
          </div>
          <div>
            <textarea value={content} onChange={(e) => setContent(e.target.value.slice(0, 300))} rows={2} placeholder={type === 'other' ? 'Nội dung yêu cầu (bắt buộc)' : 'Nội dung (không bắt buộc)'} aria-label="Nội dung yêu cầu" className={cn(Q.input, 'resize-none')} />
            {error ? <p className="mt-1 text-[12.5px] text-[var(--qr-danger)]">{error}</p> : null}
          </div>
          <button type="button" disabled={sending} onClick={() => onSend(type, content)} className={cn(Q.btn, 'w-full')}>{sending ? 'Đang gửi…' : 'Gửi yêu cầu'}</button>
        </div>
      )}
    </Sheet>
  );
}

/* ---------------------------------------------------------------- Yêu cầu thanh toán (màn "Checkout") */

const METHODS = [
  { key: 'cash', label: 'Tiền mặt', icon: Banknote },
  { key: 'card', label: 'Thẻ', icon: CreditCard },
  { key: 'transfer', label: 'Chuyển khoản', icon: Landmark },
] as const;

export function PaymentScreen({ restaurant, table, area, order, waiting, sending, errors, onBack, onSend, onCancel }: {
  restaurant: string;
  table: string;
  area: string;
  order: OrderView | null;
  waiting: CustomerRequest | null;
  sending: boolean;
  errors: Record<string, string>;
  onBack: () => void;
  onSend: (body: { method: 'cash' | 'card' | 'transfer'; vatCompany: string; vatTaxCode: string }) => void;
  onCancel: (id: string) => void;
}) {
  const [method, setMethod] = useState<'cash' | 'card' | 'transfer'>('cash');
  const [vat, setVat] = useState(false);
  const [company, setCompany] = useState('');
  const [tax, setTax] = useState('');
  const items = (order?.items ?? []).filter((i) => i.status !== 'cancelled');
  const unfinished = items.filter((i) => i.status === 'pending' || i.status === 'cooking').length;
  const count = items.reduce((s, i) => s + i.qty, 0);

  return (
    <Screen label="Thanh toán">
      <ScreenHeader title="Thanh toán" onBack={onBack} table={table} />
      <div className="flex-1 space-y-3 overflow-y-auto px-5 pb-6">
        <div className="flex items-center gap-3 rounded-2xl bg-[var(--qr-primary)] p-4 text-white">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white/20"><MapPin size={20} /></span>
          <div className="min-w-0">
            <p className="text-[11.5px] opacity-85">Đang dùng bữa tại</p>
            <p className="truncate text-[15px] font-semibold">{restaurant} · Bàn {table}</p>
            <p className="text-[12px] opacity-85">{area}</p>
          </div>
        </div>

        {waiting ? (
          <div className="rounded-2xl bg-[var(--qr-success-soft)] p-4">
            <p className="flex items-center gap-2 text-[15px] font-semibold text-[var(--qr-success)]"><CheckCircle2 size={18} />Đã gửi yêu cầu thanh toán</p>
            <p className="mt-1 text-[13.5px] text-[var(--qr-muted)]">Nhân viên sẽ mang hóa đơn đến. Hình thức: {METHOD_LABEL[waiting.paymentMethod ?? 'cash']}.</p>
          </div>
        ) : null}

        <div className={cn(Q.card, 'p-4')}>
          <p className="mb-2 text-[15px] font-semibold">Món đã gọi</p>
          <ul className="space-y-2">
            {items.map((i) => (
              <li key={i.id} className="flex justify-between gap-3 text-[14px]">
                <span className="min-w-0">{i.name} <span className="text-[var(--qr-muted)]">×{i.qty}</span></span>
                <span className="shrink-0 font-medium">{vnd(i.price * i.qty)}</span>
              </li>
            ))}
          </ul>
          {unfinished > 0 ? <p className="mt-3 rounded-xl bg-[var(--qr-warn-soft)] px-3 py-2 text-[12.5px] text-[var(--qr-warn-text)]">Còn {unfinished} món chưa xong. Bạn vẫn muốn thanh toán?</p> : null}
        </div>

        <div className={cn(Q.card, 'p-4')}>
          <p className="mb-2 text-[15px] font-semibold">Chi tiết thanh toán</p>
          <div className="flex justify-between text-[13.5px] text-[var(--qr-muted)]"><span>Tạm tính ({count} món)</span><span>{vnd(order?.subtotal ?? 0)}</span></div>
          <div className="mt-2 flex items-baseline justify-between border-t border-[var(--qr-border)] pt-2.5"><span>Tổng cộng</span><span className="text-[19px] font-bold text-[var(--qr-primary)]">{vnd(order?.subtotal ?? 0)}</span></div>
          <p className="mt-1.5 text-[11.5px] text-[var(--qr-muted)]">Giá đã gồm thuế. Thu ngân lập hóa đơn chính thức.</p>
        </div>

        {waiting ? null : (
          <>
            <div className={cn(Q.card, 'p-4')}>
              <p className="mb-2.5 text-[15px] font-semibold">Hình thức thanh toán</p>
              <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Hình thức thanh toán">
                {METHODS.map(({ key, label, icon: Icon }) => (
                  <button key={key} type="button" role="radio" aria-checked={method === key} onClick={() => setMethod(key)} className={cn('flex flex-col items-center gap-1.5 rounded-2xl border px-2 py-3 text-[13px] font-medium', method === key ? 'border-[var(--qr-primary)] bg-[var(--qr-primary-soft)] text-[var(--qr-primary)]' : 'border-[var(--qr-border)]')}>
                    <Icon size={22} />{label}
                  </button>
                ))}
              </div>
              {errors.method ? <p className="mt-1 text-[12.5px] text-[var(--qr-danger)]">{errors.method}</p> : null}
              <p className="mt-2 text-[12px] text-[var(--qr-muted)]">Thanh toán với nhân viên tại bàn / quầy. Chọn chuyển khoản sẽ có mã QR khi thu ngân lập hóa đơn.</p>
            </div>
            <div className={cn(Q.card, 'p-4')}>
              <label className="flex items-center justify-between text-[15px] font-semibold">
                Xuất hóa đơn VAT
                <input type="checkbox" checked={vat} onChange={(e) => setVat(e.target.checked)} className="h-5 w-5 accent-[var(--qr-primary)]" />
              </label>
              {vat ? (
                <div className="mt-3 space-y-2.5">
                  <div>
                    <p className="mb-1 text-[12.5px] text-[var(--qr-muted)]">Tên công ty</p>
                    <input value={company} onChange={(e) => setCompany(e.target.value.slice(0, 200))} aria-label="Tên công ty" className={Q.input} />
                    {errors.vatCompany ? <p className="mt-1 text-[12.5px] text-[var(--qr-danger)]">{errors.vatCompany}</p> : null}
                  </div>
                  <div>
                    <p className="mb-1 text-[12.5px] text-[var(--qr-muted)]">Mã số thuế</p>
                    <input value={tax} onChange={(e) => setTax(e.target.value.slice(0, 14))} inputMode="numeric" aria-label="Mã số thuế" className={Q.input} />
                    {errors.vatTaxCode ? <p className="mt-1 text-[12.5px] text-[var(--qr-danger)]">{errors.vatTaxCode}</p> : null}
                  </div>
                </div>
              ) : null}
            </div>
          </>
        )}
      </div>
      <div className="border-t border-[var(--qr-border)] px-5 pb-[max(16px,env(safe-area-inset-bottom))] pt-3">
        {waiting ? (
          <div className="flex gap-3">
            {waiting.status === 'new' ? <button type="button" disabled={sending} onClick={() => onCancel(waiting.id)} className={cn(Q.btnGhost, 'flex-1')}>Hủy yêu cầu</button> : null}
            <button type="button" onClick={onBack} className={cn(Q.btn, 'flex-1')}>Đóng</button>
          </div>
        ) : (
          <button type="button" disabled={sending || items.length === 0} onClick={() => onSend({ method, vatCompany: vat ? company : '', vatTaxCode: vat ? tax : '' })} className={cn(Q.btn, 'w-full justify-between')}>
            <span>{sending ? 'Đang gửi…' : 'Gửi yêu cầu thanh toán'}</span>
            <span>{vnd(order?.subtotal ?? 0)}</span>
          </button>
        )}
      </div>
    </Screen>
  );
}

/* ---------------------------------------------------------------- Hóa đơn chờ thanh toán (màn "Order Summary") */

export function InvoiceScreen({ invoice, table, preferTransfer, onBack }: { invoice: QrInvoice; table: string; preferTransfer: boolean; onBack: () => void }) {
  const [showQr, setShowQr] = useState(preferTransfer);
  const count = invoice.lines.reduce((s, l) => s + l.qty, 0);
  return (
    <Screen label={`Hóa đơn ${invoice.code}`}>
      <ScreenHeader title="Hóa đơn" onBack={onBack} table={table} />
      <div className="flex-1 space-y-3 overflow-y-auto px-5 pb-6">
        <div className="text-center">
          <p className="text-[13px] text-[var(--qr-muted)]">Mã hóa đơn</p>
          <p className="text-[26px] font-bold tracking-wide text-[var(--qr-primary)]">{invoice.code}</p>
        </div>
        {invoice.transfer && showQr ? (
          <TransferQrBox transfer={invoice.transfer} />
        ) : (
          <div className="rounded-2xl bg-[var(--qr-surface-2)] p-4 text-center">
            <ReceiptText size={28} className="mx-auto text-[var(--qr-primary)]" />
            <p className="mt-2 text-[14px] font-medium">Đưa mã hóa đơn cho nhân viên để thanh toán</p>
            {invoice.transfer ? <button type="button" onClick={() => setShowQr(true)} className="mt-2 text-[13.5px] font-semibold text-[var(--qr-primary)]">Hiện mã QR chuyển khoản</button> : null}
          </div>
        )}
        <div className={cn(Q.card, 'p-4')}>
          <p className="mb-2 text-[15px] font-semibold">Món</p>
          <ul className="space-y-2">
            {invoice.lines.map((l, i) => (
              <li key={i} className="flex justify-between gap-3 text-[14px]"><span>{l.name} <span className="text-[var(--qr-muted)]">×{l.qty}</span></span><span className="font-medium">{vnd(l.amount)}</span></li>
            ))}
          </ul>
        </div>
        <div className={cn(Q.card, 'p-4')}>
          <div className="flex justify-between text-[13.5px] text-[var(--qr-muted)]"><span>Tạm tính ({count} món)</span><span>{vnd(invoice.total)}</span></div>
          <div className="mt-2 flex items-baseline justify-between border-t border-[var(--qr-border)] pt-2.5"><span>Tổng cộng</span><span className="text-[21px] font-bold text-[var(--qr-primary)]">{vnd(invoice.total)}</span></div>
        </div>
        <p className="text-center text-[12.5px] text-[var(--qr-muted)]">{invoice.transfer ? 'Chuyển khoản xong, nhân viên sẽ kiểm tra và xác nhận.' : 'Thanh toán với nhân viên tại bàn hoặc quầy.'}</p>
      </div>
      <div className="border-t border-[var(--qr-border)] px-5 pb-[max(16px,env(safe-area-inset-bottom))] pt-3">
        <button type="button" onClick={onBack} className={cn(Q.btn, 'w-full')}>Đóng</button>
      </div>
    </Screen>
  );
}

/* ---------------------------------------------------------------- Đã thanh toán */

export function ThanksScreen({ code, total, onClose }: { code: string; total: number; onClose: () => void }) {
  return (
    <Screen label="Cảm ơn quý khách">
      <StageArt stage="served" className="h-[48%] w-full rounded-b-[32px]" />
      <div className="flex flex-1 flex-col px-5 pt-6 text-center">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[var(--qr-primary-soft)] text-[var(--qr-primary)]"><PartyPopper size={28} /></span>
        <h1 className="mt-3 text-[23px] font-semibold">Cảm ơn quý khách!</h1>
        <p className="mt-1 text-[14px] text-[var(--qr-muted)]">Hóa đơn <b className="text-[var(--qr-text)]">{code}</b> ({vnd(total)}) đã được thanh toán.</p>
        <p className="mt-1 text-[13.5px] text-[var(--qr-muted)]">Hẹn gặp lại quý khách!</p>
        <div className="mt-auto pb-[max(20px,env(safe-area-inset-bottom))] pt-5">
          <button type="button" onClick={onClose} className={cn(Q.btn, 'w-full')}>Xem thực đơn</button>
        </div>
      </div>
    </Screen>
  );
}
