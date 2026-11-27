import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { POST_CATEGORY_LABEL, type PublicPost } from '@/api/public-site';
import { SiteImage } from '@/features/public-site/parts';

/** "27/11/2026" */
export const postDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '');

/**
 * Thẻ một bài viết (Tin tức & Ưu đãi) — dùng ở trang chủ và trang /tin-tuc. Bấm cả thẻ mở /tin-tuc/:slug.
 * Bài do Quản lý nhà hàng viết ở Quản lý bài viết; chỉ bài đã xuất bản mới tới được đây.
 */
export function PostCard({ post, dark = false }: { post: PublicPost; dark?: boolean }) {
  return (
    <Link to={`/tin-tuc/${post.slug}`} className="group flex h-full flex-col overflow-hidden">
      <div className="relative aspect-[4/3] overflow-hidden">
        <SiteImage src={post.coverImage} alt={post.title} className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.04]" />
        <span className="absolute left-3 top-3 bg-[var(--site-gold,#b8925a)] px-2.5 py-1 text-[11.5px] font-bold uppercase tracking-wider text-[var(--site-ink,#1b1410)]">
          {POST_CATEGORY_LABEL[post.category]}
        </span>
      </div>
      <div className="flex flex-1 flex-col pt-5">
        <p className={dark ? 'text-[12.5px] text-[#b9a993]' : 'text-[12.5px] text-[#8c7b6c]'}>{postDate(post.publishedAt)}</p>
        <h3 className="site-display mt-2 text-[26px] leading-tight transition-colors group-hover:text-[var(--site-gold,#b8925a)]">{post.title}</h3>
        {post.summary ? <p className={`mt-3 line-clamp-3 text-[14.5px] leading-relaxed ${dark ? 'text-[#d8cbb8]' : 'text-[#6d5e52]'}`}>{post.summary}</p> : null}
        <span className="mt-auto inline-flex items-center gap-1.5 pt-4 text-[13.5px] font-semibold text-[var(--site-gold,#b8925a)]">
          Đọc tiếp <ArrowRight size={14} aria-hidden className="transition-transform group-hover:translate-x-1" />
        </span>
      </div>
    </Link>
  );
}
