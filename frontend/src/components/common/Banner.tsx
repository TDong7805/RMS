import type { ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, Info, OctagonAlert, X } from 'lucide-react';
import { cn } from '@/lib/cn';

/**
 * Dải cảnh báo đầu trang (theo Atlassian Banner — docs/thiet-ke/QUY_TAC_GIAO_DIEN.md) cho trạng thái KÉO DÀI,
 * khác thông báo nổi (toast) chỉ báo một lần: "Đang dùng dữ liệu mẫu", "Ngoài giờ phục vụ", "Bạn chưa chấm công"…
 * Khung nền trắng, viền + biểu tượng theo loại; chữ ngắn; có thể kèm một nút hành động và nút đóng.
 */
export type BannerTone = 'info' | 'warning' | 'danger' | 'success';

const TONE: Record<BannerTone, { icon: ReactNode; ring: string }> = {
  info: { icon: <Info size={17} />, ring: 'border-[var(--border)] [&_.bn-icon]:text-[var(--info)]' },
  warning: { icon: <AlertTriangle size={17} />, ring: 'border-[var(--warning)]/35 bg-[var(--warning-soft)] [&_.bn-icon]:text-[var(--warning)]' },
  danger: { icon: <OctagonAlert size={17} />, ring: 'border-[var(--danger)]/30 bg-[var(--danger-soft)] [&_.bn-icon]:text-[var(--danger)]' },
  success: { icon: <CheckCircle2 size={17} />, ring: 'border-[var(--border)] [&_.bn-icon]:text-[var(--success)]' },
};

export interface BannerProps {
  tone?: BannerTone;
  /** Câu chính (đậm). */
  title: ReactNode;
  /** Một dòng giải thích thêm (tùy chọn). */
  children?: ReactNode;
  /** Nút hành động bên phải (vd. <Button size="sm" variant="outline">Vào ca</Button>). */
  action?: ReactNode;
  onDismiss?: () => void;
  className?: string;
}

export function Banner({ tone = 'info', title, children, action, onDismiss, className }: BannerProps) {
  const t = TONE[tone];
  return (
    <div
      role={tone === 'danger' || tone === 'warning' ? 'alert' : 'status'}
      className={cn('flex items-start gap-3 rounded-[12px] border bg-[var(--bg-surface)] px-4 py-3', t.ring, className)}
    >
      <span className="bn-icon mt-0.5 shrink-0" aria-hidden>{t.icon}</span>
      <div className="min-w-0 flex-1 text-[13.5px] leading-5">
        <span className="font-semibold text-[var(--text-primary)]">{title}</span>
        {children ? <span className="text-[var(--text-secondary)]"> {children}</span> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
      {onDismiss ? (
        <button type="button" onClick={onDismiss} aria-label="Đóng" className="-mr-1 grid h-7 w-7 shrink-0 place-items-center rounded-[8px] text-[var(--text-muted)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)]">
          <X size={15} />
        </button>
      ) : null}
    </div>
  );
}
