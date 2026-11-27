import { useState } from 'react';
import { Newspaper } from 'lucide-react';
import { POST_CATEGORY_LABEL, type PublicPostCategory } from '@/api/public-site';
import { PageBanner, SiteEmpty, SiteError, SiteSkeleton } from '@/features/public-site/parts';
import { PostCard } from '@/features/public-site/posts';
import { usePublicPosts } from '@/features/public-site/queries';
import { cn } from '@/lib/cn';

const FILTERS: { id: '' | PublicPostCategory; label: string }[] = [
  { id: '', label: 'Tất cả' },
  { id: 'promotion', label: POST_CATEGORY_LABEL.promotion },
  { id: 'event', label: POST_CATEGORY_LABEL.event },
  { id: 'news', label: POST_CATEGORY_LABEL.news },
];

/**
 * /tin-tuc — Tin tức & Ưu đãi: mọi bài ĐÃ XUẤT BẢN ở Quản lý bài viết, mới nhất trước, lọc theo chuyên mục.
 * Bài nháp / đã ẩn không hiện; quản lý ẩn bài thì bài biến mất khỏi website (link cũ báo "đã được gỡ").
 */
export default function NewsPage() {
  const [category, setCategory] = useState<'' | PublicPostCategory>('');
  const q = usePublicPosts(category, 50);
  return (
    <>
      <PageBanner eyebrow="Tin tức & Ưu đãi" title="Có gì mới ở nhà hàng" subtitle="Ưu đãi, sự kiện và câu chuyện mới nhất — cập nhật bởi nhà hàng." />
      <section className="site-container py-12">
        <div className="mb-8 flex flex-wrap justify-center gap-2" role="tablist" aria-label="Chuyên mục">
          {FILTERS.map((f) => (
            <button
              key={f.id || 'all'}
              type="button"
              role="tab"
              aria-selected={category === f.id}
              onClick={() => setCategory(f.id)}
              className={cn('site-btn h-10 px-5 text-[14px]', category === f.id ? 'site-btn-primary' : 'site-btn-ghost')}
            >
              {f.label}
            </button>
          ))}
        </div>
        {q.isError ? (
          <SiteError onRetry={() => void q.refetch()} retrying={q.isFetching} />
        ) : q.isLoading ? (
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">{[0, 1, 2].map((i) => <SiteSkeleton key={i} className="aspect-[4/5]" />)}</div>
        ) : !q.data?.length ? (
          <SiteEmpty icon={Newspaper} title="Chưa có bài viết" description={category ? 'Chuyên mục này chưa có bài nào.' : 'Nhà hàng sẽ cập nhật ưu đãi và sự kiện tại đây.'} />
        ) : (
          <div className="grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
            {q.data.map((p) => <PostCard key={p.slug} post={p} />)}
          </div>
        )}
      </section>
    </>
  );
}
