import { useState } from 'react';
import { Banknote, CheckCircle2, CreditCard, Landmark, PartyPopper } from 'lucide-react';
import { Sheet, vnd } from '@/features/ordering/QrParts';
import { TransferQrBox } from '@/features/ordering/TransferQrBox';
import { cn } from '@/lib/cn';
import type { CustomerRequest, OrderView, QrInvoice } from '@/types';

/* Các tấm trượt của trang đặt món cho UC-KH-05 (Gọi nhân viên) và UC-KH-06 (Yêu cầu thanh toán). */

const SAFE = 'pb-[max(16px,env(safe-area-inset-bottom))]';
const btnPrimary = 'flex-1 rounded-xl bg-[#0f7b5a] py-3 text-[15px] font-bold text-white disabled:opacity-50';
const btnGhost = 'flex-1 rounded-xl border border-[#dfe4e1] py-3 text-[15px] font-semibold';

export const REQUEST_TYPE_LABEL: Record<string, string> = { support: 'Hỗ trợ tại bàn', consult: 'Tư vấn món', other: 'Khác', payment: 'Thanh toán' };
const QUICK = ['Thêm chén đũa', 'Thêm nước', 'Dọn bàn', 'Xin thêm khăn giấy'];

export const METHOD_LABEL: Record<string, string> = { cash: 'Tiền mặt', card: 'Thẻ', transfer: 'Chuyển khoản', ewallet: 'Ví điện tử' };

/* ---------------------------------------------------------------- Gọi nhân viên */

export function CallStaffSheet({
  open,
  onClose,
  waiting,
  sending,
  onSend,
  onCancel,
  error,
}: {
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
        <div className={cn('space-y-4 p-4', SAFE)}>
          <div className="flex items-start gap-3 rounded-xl bg-[#e8f5ee] p-3.5">
            <span className="relative mt-1 flex h-3 w-3 shrink-0">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#14a072] opacity-60" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-[#0f7b5a]" />
            </span>
            <div>
              <p className="text-[15px] font-bold text-[#0b5c43]">
                {waiting.status === 'forwarded' && waiting.assignedName ? `Nhân viên ${waiting.assignedName} đang đến` : 'Đã gửi yêu cầu, nhân viên sẽ đến ngay'}
              </p>
              <p className="mt-0.5 text-[13px] text-[#4a524e]">
                {REQUEST_TYPE_LABEL[waiting.type]}
                {waiting.content ? ` · ${waiting.content}` : ''}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            {waiting.status === 'new' ? (
              <button type="button" disabled={sending} onClick={() => onCancel(waiting.id)} className={btnGhost}>Hủy yêu cầu</button>
            ) : null}
            <button type="button" onClick={onClose} className={btnPrimary}>Đóng</button>
          </div>
        </div>
      ) : (
        <div className={cn('space-y-4 p-4', SAFE)}>
          <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Loại yêu cầu">
            {(['support', 'consult', 'other'] as const).map((k) => (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={type === k}
                onClick={() => setType(k)}
                className={cn('rounded-xl border px-2 py-2.5 text-[13.5px] font-semibold', type === k ? 'border-[#0f7b5a] bg-[#e8f5ee] text-[#0b5c43]' : 'border-[#dfe4e1] text-[#4a524e]')}
              >
                {REQUEST_TYPE_LABEL[k]}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {QUICK.map((q) => (
              <button key={q} type="button" onClick={() => setContent(q)} className={cn('rounded-full border px-3 py-1 text-[13px]', content === q ? 'border-[#0f7b5a] bg-[#e8f5ee] text-[#0b5c43]' : 'border-[#dfe4e1] text-[#4a524e]')}>
                {q}
              </button>
            ))}
          </div>
          <div>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value.slice(0, 300))}
              rows={2}
              placeholder={type === 'other' ? 'Nội dung yêu cầu (bắt buộc)' : 'Nội dung (không bắt buộc)'}
              aria-label="Nội dung yêu cầu"
              className="w-full resize-none rounded-xl border border-[#dfe4e1] px-3 py-2 text-[14px] outline-none focus:border-[#0f7b5a]"
            />
            {error ? <p className="mt-1 text-[12.5px] text-[#c62828]">{error}</p> : null}
          </div>
          <button type="button" disabled={sending} onClick={() => onSend(type, content)} className={cn(btnPrimary, 'w-full')}>
            {sending ? 'Đang gửi…' : 'Gửi yêu cầu'}
          </button>
        </div>
      )}
    </Sheet>
  );
}

/* ---------------------------------------------------------------- Yêu cầu thanh toán */

const METHODS = [
  { key: 'cash', label: 'Tiền mặt', icon: Banknote },
  { key: 'card', label: 'Thẻ', icon: CreditCard },
  { key: 'transfer', label: 'Chuyển khoản', icon: Landmark },
] as const;

export function PaymentRequestSheet({
  open,
  onClose,
  order,
  waiting,
  sending,
  errors,
  onSend,
  onCancel,
}: {
  open: boolean;
  onClose: () => void;
  order: OrderView | null;
  waiting: CustomerRequest | null;
  sending: boolean;
  errors: Record<string, string>;
  onSend: (body: { method: 'cash' | 'card' | 'transfer'; vatCompany: string; vatTaxCode: string }) => void;
  onCancel: (id: string) => void;
}) {
  const [method, setMethod] = useState<'cash' | 'card' | 'transfer'>('cash');
  const [vat, setVat] = useState(false);
  const [company, setCompany] = useState('');
  const [tax, setTax] = useState('');
  const items = (order?.items ?? []).filter((i) => i.status !== 'cancelled');
  const unfinished = items.filter((i) => i.status === 'pending' || i.status === 'cooking').length;

  return (
    <Sheet open={open} onClose={onClose} title="Yêu cầu thanh toán">
      {waiting ? (
        <div className={cn('space-y-4 p-4', SAFE)}>
          <div className="rounded-xl bg-[#e8f5ee] p-3.5">
            <p className="text-[15px] font-bold text-[#0b5c43]">Đã gửi yêu cầu thanh toán</p>
            <p className="mt-0.5 text-[13.5px] text-[#4a524e]">Nhân viên sẽ mang hóa đơn đến. Hình thức: {METHOD_LABEL[waiting.paymentMethod ?? 'cash']}.</p>
          </div>
          <p className="text-[13.5px] text-[#4a524e]">Tạm tính <b className="text-[#1b1f1d]">{vnd(order?.subtotal ?? 0)}</b></p>
          <div className="flex gap-2">
            {waiting.status === 'new' ? <button type="button" disabled={sending} onClick={() => onCancel(waiting.id)} className={btnGhost}>Hủy yêu cầu</button> : null}
            <button type="button" onClick={onClose} className={btnPrimary}>Đóng</button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex-1 space-y-4 overflow-y-auto p-4">
            <div>
              <p className="mb-1.5 text-[13px] font-semibold text-[#6b7570]">Món đã gọi</p>
              <ul className="divide-y divide-[#f0f2f1] rounded-xl border border-[#eef1ef]">
                {items.map((i) => (
                  <li key={i.id} className="flex justify-between gap-3 px-3 py-2 text-[14px]">
                    <span>
                      {i.name} <span className="text-[#6b7570]">× {i.qty}</span>
                    </span>
                    <span className="font-semibold">{vnd(i.price * i.qty)}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-2 flex justify-between text-[15px]">
                <span className="font-semibold">Tạm tính</span>
                <b className="text-[#0f7b5a]">{vnd(order?.subtotal ?? 0)}</b>
              </div>
              {unfinished > 0 ? (
                <p className="mt-2 rounded-lg bg-[#fff7ed] px-3 py-2 text-[13px] text-[#8a4b12]">Còn {unfinished} món chưa xong. Bạn vẫn muốn thanh toán?</p>
              ) : null}
            </div>
            <div>
              <p className="mb-1.5 text-[13px] font-semibold text-[#6b7570]">Hình thức thanh toán dự kiến</p>
              <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Hình thức thanh toán">
                {METHODS.map(({ key, label, icon: Icon }) => (
                  <button
                    key={key}
                    type="button"
                    role="radio"
                    aria-checked={method === key}
                    onClick={() => setMethod(key)}
                    className={cn('flex flex-col items-center gap-1 rounded-xl border px-2 py-2.5 text-[13px] font-semibold', method === key ? 'border-[#0f7b5a] bg-[#e8f5ee] text-[#0b5c43]' : 'border-[#dfe4e1] text-[#4a524e]')}
                  >
                    <Icon size={20} />
                    {label}
                  </button>
                ))}
              </div>
              {errors.method ? <p className="mt-1 text-[12.5px] text-[#c62828]">{errors.method}</p> : null}
            </div>
            <div>
              <label className="flex items-center gap-2 text-[14px] font-semibold">
                <input type="checkbox" checked={vat} onChange={(e) => setVat(e.target.checked)} className="h-4 w-4 accent-[#0f7b5a]" />
                Xuất hóa đơn VAT
              </label>
              {vat ? (
                <div className="mt-2 space-y-2">
                  <div>
                    <input value={company} onChange={(e) => setCompany(e.target.value.slice(0, 200))} placeholder="Tên công ty" aria-label="Tên công ty" className="w-full rounded-xl border border-[#dfe4e1] px-3 py-2 text-[14px] outline-none focus:border-[#0f7b5a]" />
                    {errors.vatCompany ? <p className="mt-1 text-[12.5px] text-[#c62828]">{errors.vatCompany}</p> : null}
                  </div>
                  <div>
                    <input value={tax} onChange={(e) => setTax(e.target.value.slice(0, 14))} inputMode="numeric" placeholder="Mã số thuế" aria-label="Mã số thuế" className="w-full rounded-xl border border-[#dfe4e1] px-3 py-2 text-[14px] outline-none focus:border-[#0f7b5a]" />
                    {errors.vatTaxCode ? <p className="mt-1 text-[12.5px] text-[#c62828]">{errors.vatTaxCode}</p> : null}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
          <div className={cn('border-t border-[#eef1ef] p-4', SAFE)}>
            <button
              type="button"
              disabled={sending || items.length === 0}
              onClick={() => onSend({ method, vatCompany: vat ? company : '', vatTaxCode: vat ? tax : '' })}
              className={cn(btnPrimary, 'w-full')}
            >
              {sending ? 'Đang gửi…' : 'Gửi yêu cầu'}
            </button>
          </div>
        </>
      )}
    </Sheet>
  );
}

/* ---------------------------------------------------------------- Hóa đơn chờ thanh toán */

export function InvoiceSheet({ open, onClose, invoice, preferTransfer }: { open: boolean; onClose: () => void; invoice: QrInvoice | null; preferTransfer: boolean }) {
  const [showQr, setShowQr] = useState(false);
  if (!invoice) return null;
  const qrVisible = invoice.transfer && (preferTransfer || showQr);
  return (
    <Sheet open={open} onClose={onClose} title={`Hóa đơn ${invoice.code}`}>
      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        <ul className="divide-y divide-[#f0f2f1] rounded-xl border border-[#eef1ef]">
          {invoice.lines.map((l, i) => (
            <li key={i} className="flex justify-between gap-3 px-3 py-2 text-[14px]">
              <span>
                {l.name} <span className="text-[#6b7570]">× {l.qty}</span>
              </span>
              <span className="font-semibold">{vnd(l.amount)}</span>
            </li>
          ))}
        </ul>
        <div className="flex items-baseline justify-between">
          <span className="text-[15px] font-semibold">Tổng cộng</span>
          <b className="text-[22px] text-[#0f7b5a]">{vnd(invoice.total)}</b>
        </div>
        {qrVisible && invoice.transfer ? (
          <TransferQrBox transfer={invoice.transfer} />
        ) : invoice.transfer ? (
          <button type="button" onClick={() => setShowQr(true)} className="w-full rounded-xl border border-[#0f7b5a] py-2.5 text-[14px] font-semibold text-[#0f7b5a]">
            Hiện mã QR chuyển khoản
          </button>
        ) : null}
        <p className="text-center text-[13px] text-[#6b7570]">Vui lòng thanh toán với nhân viên. {invoice.transfer ? 'Chuyển khoản xong, nhân viên sẽ kiểm tra và xác nhận.' : ''}</p>
      </div>
      <div className={cn('border-t border-[#eef1ef] p-4', SAFE)}>
        <button type="button" onClick={onClose} className={cn(btnPrimary, 'w-full')}>Đóng</button>
      </div>
    </Sheet>
  );
}

/* ---------------------------------------------------------------- Đã thanh toán */

export function ThanksCard({ code, total, onClose }: { code: string; total: number; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/45 p-6" role="dialog" aria-modal="true" aria-label="Cảm ơn quý khách">
      <div className="w-full max-w-[360px] rounded-3xl bg-white p-6 text-center shadow-xl animate-in zoom-in-95">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-[#e8f5ee] text-[#0f7b5a]">
          <PartyPopper size={32} />
        </div>
        <p className="mt-4 text-[20px] font-extrabold">Cảm ơn quý khách!</p>
        <p className="mt-1.5 text-[14px] text-[#4a524e]">
          Hóa đơn <b>{code}</b> ({vnd(total)}) đã được thanh toán.
        </p>
        <p className="mt-1 inline-flex items-center gap-1 text-[13px] text-[#0f7b5a]"><CheckCircle2 size={14} /> Hẹn gặp lại quý khách</p>
        <button type="button" onClick={onClose} className="mt-5 w-full rounded-xl bg-[#0f7b5a] py-3 text-[15px] font-bold text-white">Xem thực đơn</button>
      </div>
    </div>
  );
}
