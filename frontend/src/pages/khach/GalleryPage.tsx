import { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Images, X } from 'lucide-react';
import { useGallery } from '@/features/public-site/queries';
import { PageBanner, SiteEmpty, SiteError, SiteImage, SiteSkeleton, useSiteData } from '@/features/public-site/parts';
import type { GalleryPhoto } from '@/types';

/** Album ảnh nhà hàng (ảnh Quản lý tải lên và đang để "Hiện"); bấm ảnh để xem lớn, phím ← → để chuyển ảnh. */
export default function GalleryPage() {
  const { brand } = useSiteData();
  const gallery = useGallery();
  const [index, setIndex] = useState<number | null>(null);
  const photos = gallery.data ?? [];

  return (
    <>
      <PageBanner eyebrow="Album ảnh" title={`Khoảnh khắc tại ${brand.name}`} subtitle="Không gian, món ăn và những buổi tiệc ấm cúng." />
      <section className="site-container py-12">
        {gallery.isError ? (
          <SiteError onRetry={() => void gallery.refetch()} retrying={gallery.isFetching} />
        ) : !gallery.data ? (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 8 }, (_, i) => <SiteSkeleton key={i} className="aspect-square" />)}
          </div>
        ) : !photos.length ? (
          <SiteEmpty icon={Images} title="Album đang được cập nhật" description="Nhà hàng sẽ sớm chia sẻ hình ảnh không gian và món ăn." />
        ) : (
          <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
            {photos.map((p, i) => (
              <li key={p.id}>
                <button type="button" onClick={() => setIndex(i)} className="group block w-full overflow-hidden rounded-2xl text-left" aria-label={`Xem ảnh ${p.caption || i + 1}`}>
                  <SiteImage src={p.image} alt={p.caption || 'Ảnh nhà hàng'} className="aspect-square w-full transition-transform duration-500 group-hover:scale-105" />
                </button>
                {p.caption ? <p className="mt-1.5 line-clamp-1 px-1 text-[13px] text-[var(--site-muted)]">{p.caption}</p> : null}
              </li>
            ))}
          </ul>
        )}
      </section>
      {index !== null && photos[index] ? (
        <Lightbox photos={photos} index={index} onChange={setIndex} onClose={() => setIndex(null)} />
      ) : null}
    </>
  );
}

function Lightbox({ photos, index, onChange, onClose }: {
  photos: GalleryPhoto[];
  index: number;
  onChange: (i: number) => void;
  onClose: () => void;
}) {
  const go = useCallback((delta: number) => onChange((index + delta + photos.length) % photos.length), [index, photos.length, onChange]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') go(-1);
      if (e.key === 'ArrowRight') go(1);
    };
    window.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
    };
  }, [go, onClose]);

  const photo = photos[index];
  return (
    <div role="dialog" aria-modal="true" aria-label="Xem ảnh" className="fixed inset-0 z-50 flex flex-col bg-black/90 text-white" onClick={onClose}>
      <div className="flex items-center justify-between px-4 py-3 text-[14px]">
        <span>{index + 1} / {photos.length}</span>
        <button type="button" onClick={onClose} aria-label="Đóng" className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-white/10">
          <X size={22} aria-hidden />
        </button>
      </div>
      <div className="relative flex min-h-0 flex-1 items-center justify-center px-4 pb-4" onClick={(e) => e.stopPropagation()}>
        <img src={photo.image} alt={photo.caption || 'Ảnh nhà hàng'} className="max-h-full max-w-full rounded-lg object-contain" />
        {photos.length > 1 ? (
          <>
            <button type="button" onClick={() => go(-1)} aria-label="Ảnh trước" className="absolute left-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 hover:bg-black/70 md:left-6">
              <ChevronLeft size={24} aria-hidden />
            </button>
            <button type="button" onClick={() => go(1)} aria-label="Ảnh sau" className="absolute right-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 hover:bg-black/70 md:right-6">
              <ChevronRight size={24} aria-hidden />
            </button>
          </>
        ) : null}
      </div>
      {photo.caption ? <p className="px-4 pb-6 text-center text-[15px]" onClick={(e) => e.stopPropagation()}>{photo.caption}</p> : null}
    </div>
  );
}
