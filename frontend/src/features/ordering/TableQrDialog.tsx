import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { toast } from 'sonner';
import { Copy, ExternalLink, Printer } from 'lucide-react';
import { Button } from '@/components/common/Button';
import { Modal } from '@/components/common/Modal';
import type { DiningTable } from '@/types';

/** Đường dẫn trang đặt món của một bàn (khách quét mã QR dán trên bàn). */
export const qrOrderUrl = (token: string) => `${window.location.origin}/goi-mon/${token}`;

/**
 * Mã QR gọi món của một bàn (trang Khu vực bàn của Quản lý nhà hàng): xem, sao chép đường dẫn, mở thử, in để dán lên bàn.
 */
export function TableQrDialog({ table, onClose }: { table: DiningTable | null; onClose: () => void }) {
  const [src, setSrc] = useState('');
  const url = table?.qrToken ? qrOrderUrl(table.qrToken) : '';

  useEffect(() => {
    setSrc('');
    if (!url) return;
    void QRCode.toDataURL(url, { width: 640, margin: 1, errorCorrectionLevel: 'M', color: { dark: '#0b3d2e', light: '#ffffff' } }).then(setSrc);
  }, [url]);

  const print = () => {
    if (!table || !src) return;
    const w = window.open('', '_blank', 'width=480,height=640');
    if (!w) return;
    w.document.write(`<html><head><title>QR bàn ${table.code}</title><style>
      body{font-family:sans-serif;text-align:center;padding:24px} img{width:300px;height:300px}
      h1{margin:8px 0 0;font-size:34px} p{margin:6px 0;color:#444}</style></head><body>
      <p style="font-size:18px;font-weight:600">Quét mã để xem thực đơn và gọi món</p>
      <img src="${src}" alt="QR"/><h1>Bàn ${table.code}</h1><p>Không cần cài ứng dụng · không cần đăng nhập</p>
      <script>window.onload=()=>window.print()</script></body></html>`);
    w.document.close();
  };

  return (
    <Modal
      open={Boolean(table)}
      onOpenChange={(o) => !o && onClose()}
      title={table ? `Mã QR gọi món – Bàn ${table.code}` : 'Mã QR gọi món'}
      description="In và dán lên bàn. Khách quét bằng camera điện thoại để mở trang đặt món của đúng bàn này."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Đóng</Button>
          <Button leadingIcon={<Printer size={15} />} disabled={!src} onClick={print}>In mã QR</Button>
        </>
      }
    >
      {table ? (
        <div className="space-y-3 text-center">
          {src ? <img src={src} alt={`Mã QR bàn ${table.code}`} className="mx-auto h-[240px] w-[240px] rounded-item border border-[var(--border)]" /> : <div className="mx-auto h-[240px] w-[240px] animate-pulse rounded-item bg-[var(--bg-subtle)]" />}
          <div className="flex items-center gap-2 rounded-item bg-[var(--bg-subtle)] px-3 py-2 text-left">
            <code className="min-w-0 flex-1 truncate text-[12.5px]">{url}</code>
            <Button size="sm" variant="ghost" aria-label="Sao chép đường dẫn" onClick={() => void navigator.clipboard.writeText(url).then(() => toast.success('Đã sao chép đường dẫn'))}><Copy size={14} /></Button>
            <Button size="sm" variant="ghost" aria-label="Mở trang đặt món" onClick={() => window.open(url, '_blank')}><ExternalLink size={14} /></Button>
          </div>
        </div>
      ) : null}
    </Modal>
  );
}
