import { cn } from '@/lib/cn';

export interface SkeletonProps {
  className?: string;
}

/** Khối xám có hiệu ứng shimmer, dùng để giữ đúng hình dạng nội dung khi đang tải. */
export function Skeleton({ className }: SkeletonProps) {
  return <div aria-hidden className={cn('rm-skeleton rounded-[10px]', className)} />;
}

export function SkeletonText({ lines = 2, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn('space-y-2', className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={cn('h-3', i === lines - 1 ? 'w-2/3' : 'w-full')}
        />
      ))}
    </div>
  );
}