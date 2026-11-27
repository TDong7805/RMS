import { useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, CalendarCheck, FileX2 } from 'lucide-react';
import { POST_CATEGORY_LABEL } from '@/api/public-site';
import { SiteEmpty, SiteError, SiteImage, SiteSkeleton, useSiteData } from '@/features/public-site/parts';
import { PostCard, postDate } from '@/features/public-site/posts';
import { usePublicPost, usePublicPosts } from '@/features/public-site/queries';
import { BusinessError } from '@/lib/mock';

/**
 * /tin-tuc/:slug — một bài viết đã xuất bản. Nội dung là văn bản thuần (giữ xuống dòng, không chạy HTML).
 * Bài nháp / đã ẩn / đã xóa → "Bài viết đã được gỡ". Cuối bài: nút Đặt bàn + 3 bài khác.
 */
export default function NewsDetailPage() {
  const { slug = '' } = useParams();
  const site = useSiteData();
  const q = usePublicPost(slug);
  const others = usePublicPosts('', 4);
  const post = q.data;

  useEffect(() => {
    if (post) document.title = `${post.title} — ${site.brand.name}`;
    window.scrollTo({ top: 0 });
  }, [post, site.brand.name]);

  if (q.isLoading) {
    return <div className="site-container max-w-[820px] py-16"><SiteSkeleton className="aspect-[16/9]" /><SiteSkeleton className="mt-6 h-40" /></div>;
  }
  if (q.isError || !post) {
    const gone = q.error instanceof BusinessError && q.error.status === 404;
    return (
      <div className="site-container py-20">
        {gone || !q.isError ? (
          <SiteEmpty
            icon={FileX2}
            title="Bài viết đã được gỡ"
            description="Bài viết không còn hoặc chưa được nhà hàng đăng."
            action={<Link to="/tin-tuc" className="site-btn site-btn-primary">Xem tin tức khác</Link>}
          />
        ) : (
          <SiteError onRetry={() => void q.refetch()} retrying={q.isFetching} />
        )}
      </div>
    );
  }

  const more = (others.data ?? []).filter((p) => p.slug !== post.slug).slice(0, 3);
  return (
    <article>
      <header className="bg-[var(--site-dark,#1b1410)] text-[var(--site-on-dark,#f5ecdf)]">
        <div className="site-container max-w-[820px] py-14 md:py-20">
          <Link to="/tin-tuc" className="inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-[var(--site-gold,#b8925a)] hover:underline">
            <ArrowLeft size={15} aria-hidden /> Tin tức & Ưu đãi
          </Link>
          <p className="mt-6 text-[12.5px] font-bold uppercase tracking-[0.2em] text-[var(--site-gold,#b8925a)]">
            {POST_CATEGORY_LABEL[post.category]} · {postDate(post.publishedAt)}
          </p>
          <h1 className="site-display mt-3 text-[38px] leading-[1.1] md:text-[54px]">{post.title}</h1>
          {post.summary ? <p className="mt-5 text-[17px] leading-relaxed text-[#d8cbb8]">{post.summary}</p> : null}
        </div>
      </header>
      <div className="site-container max-w-[820px] py-12">
        {post.coverImage ? <SiteImage src={post.coverImage} alt={post.title} eager className="mb-10 aspect-[16/9] w-full object-cover" /> : null}
        <div className="whitespace-pre-line text-[16.5px] leading-[1.85] text-[var(--site-text,#3b2f27)]">{post.content}</div>
        <div className="mt-12 flex flex-wrap items-center justify-between gap-4 border-t border-[var(--site-border)] pt-8">
          <p className="text-[15px] text-[var(--site-muted)]">Muốn thử ngay? Giữ bàn trước để nhà hàng chuẩn bị chu đáo.</p>
          <Link to="/#dat-ban" className="site-btn site-btn-primary"><CalendarCheck size={16} aria-hidden /> Đặt bàn</Link>
        </div>
      </div>
      {more.length ? (
        <section className="bg-[var(--site-surface-2,#f3ece2)] py-14">
          <div className="site-container">
            <h2 className="site-display text-center text-[32px]">Bài viết khác</h2>
            <div className="mt-10 grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
              {more.map((p) => <PostCard key={p.slug} post={p} />)}
            </div>
          </div>
        </section>
      ) : null}
    </article>
  );
}
