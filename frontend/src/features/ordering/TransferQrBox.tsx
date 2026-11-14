import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import type { TransferQr } from '@/types';

const vnd = (v: number) => `${v.toLocaleString('vi-VN')} đ`;

/**
 * Mã QR chuyển khoản VietQR (dựng ảnh ngay trên trình duyệt từ payload máy chủ trả về) kèm thông tin tài khoản.
 * Luôn nền trắng để ứng dụng ngân hàng quét được, kể cả khi trang đang ở chế độ tối.
 */
export function TransferQrBox({ transfer, size = 220 }: { transfer: TransferQr; size?: number }) {
  const [src, setSrc] = useState('');
  useEffect(() => {
    let alive = true;
    void QRCode.toDataURL(transfer.payload, { width: size * 2, margin: 1, errorCorrectionLevel: 'M' }).then((s) => alive && setSrc(s));
    return () => {
      alive = false;
    };
  }, [transfer.payload, size]);
  return (
    <div className="rounded-2xl border border-[#e3e8e5] bg-white p-4 text-center text-[#1b1f1d] [color-scheme:light]">
      <p className="text-[12px] font-semibold uppercase tracking-wide text-[#0f7b5a]">Quét mã bằng ứng dụng ngân hàng</p>
      {src ? (
        <img src={src} alt={`Mã QR chuyển khoản ${vnd(transfer.amount)}`} width={size} height={size} className="mx-auto mt-2" />
      ) : (
        <div className="mx-auto mt-2 animate-pulse rounded-lg bg-[#f2f4f3]" style={{ width: size, height: size }} />
      )}
      <dl className="mt-3 space-y-1 text-left text-[13.5px]">
        <Row label="Ngân hàng" value={transfer.bankName || '—'} />
        <Row label="Số tài khoản" value={transfer.accountNo} mono />
        <Row label="Chủ tài khoản" value={transfer.accountName} />
        <Row label="Số tiền" value={vnd(transfer.amount)} strong />
        <Row label="Nội dung" value={transfer.content} mono />
      </dl>
    </div>
  );
}

function Row({ label, value, mono, strong }: { label: string; value: string; mono?: boolean; strong?: boolean }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-[#6b7570]">{label}</dt>
      <dd className={`text-right ${mono ? 'font-mono' : ''} ${strong ? 'text-[15px] font-bold text-[#0f7b5a]' : 'font-semibold'}`}>{value}</dd>
    </div>
  );
}
