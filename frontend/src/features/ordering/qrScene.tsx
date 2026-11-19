import { motion, useReducedMotion } from 'motion/react';
import { Lottie, type LottieName } from './qrMotion';
import { cn } from '@/lib/cn';

/*
 * Tranh động trạng thái của trang khách: Lottie (LottieFiles, đã tô lại màu Royal Beef — đỏ rượu / vàng đồng / kem / nâu)
 * đặt trên một "đĩa" kem viền vàng đồng, kèm hiệu ứng nền hợp từng màn:
 *  - sent (Đã gửi tới bếp): máy bay giấy, quầng sáng + lấp lánh
 *  - cooking (Đang nấu): nồi nấu bỏ món vào, quầng lửa ấm + tàn lửa bay lên
 *  - ready (Sẵn sàng): chuông phục vụ, vòng sóng lan ra
 *  - served (Đã mang ra / Cảm ơn / thông báo): tách trà bốc khói, lấp lánh
 * Giảm chuyển động: tranh đứng yên ở một khung đẹp, không hiệu ứng nền.
 */

export type StageAnim = Extract<LottieName, 'sent' | 'cooking' | 'ready' | 'served'>;

/** Phóng tranh cho cân trong đĩa (máy bay giấy / tách trà vẽ nhỏ trong khung gốc). */
const ZOOM: Record<StageAnim, number> = { sent: 1.55, cooking: 1.35, ready: 1, served: 1.9 };

/** size: đường kính đĩa (px). */
export function StageLottie({ name, className, compact, size = 180 }: { name: StageAnim; className?: string; compact?: boolean; size?: number }) {
  const reduce = useReducedMotion();
  const fx = !compact && !reduce;
  const box = (k: number) => ({ width: size * k, height: size * k });
  return (
    <div className={cn('relative grid place-items-center', className)}>
      {fx ? <span aria-hidden style={box(1.3)} className={cn('qr-stage-glow absolute rounded-full', name === 'cooking' && 'qr-stage-glow--fire')} /> : null}
      {fx && name === 'ready' ? (
        <>
          <span aria-hidden style={box(1)} className="qr-ring absolute rounded-full" />
          <span aria-hidden style={{ ...box(1), animationDelay: '1.2s' }} className="qr-ring absolute rounded-full" />
        </>
      ) : null}
      <motion.div
        key={name}
        initial={reduce ? false : { opacity: 0, scale: 0.85 }}
        animate={fx ? { opacity: 1, scale: 1, y: [0, -6, 0] } : { opacity: 1, scale: 1 }}
        transition={fx ? { opacity: { duration: 0.35 }, scale: { type: 'spring', stiffness: 260, damping: 20 }, y: { duration: 5, repeat: Infinity, ease: 'easeInOut' } } : { duration: 0.3 }}
        className={cn(
          'relative overflow-hidden rounded-full bg-[radial-gradient(circle_at_50%_40%,#fffaf3,#f1e4d2)]',
          compact ? 'ring-2 ring-[#c9a26b]/50' : 'shadow-[0_14px_34px_-12px_rgba(60,25,15,0.55)] ring-[5px] ring-[#c9a26b]/45',
        )}
        style={box(1)}
      >
        <Lottie name={name} className={cn('absolute inset-0', compact ? 'p-[10%]' : 'p-[12%]')} style={{ transform: `scale(${ZOOM[name]})` }} />
      </motion.div>
      {fx && name === 'cooking' ? (
        <div aria-hidden className="pointer-events-none absolute inset-0">
          {Array.from({ length: 7 }).map((_, i) => (
            <span key={i} className="qr-ember" style={{ left: `${38 + ((i * 13) % 26)}%`, animationDelay: `${(i * 0.45) % 3}s`, animationDuration: `${2.4 + (i % 3) * 0.5}s` }} />
          ))}
        </div>
      ) : null}
      {fx && (name === 'sent' || name === 'served') ? (
        <div aria-hidden className="pointer-events-none absolute inset-0">
          {[[24, 22], [76, 28], [18, 70], [82, 66], [50, 8]].map(([x, y], i) => (
            <span key={i} className="qr-twinkle" style={{ left: `${x}%`, top: `${y}%`, animationDelay: `${i * 0.6}s` }} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
