import { matchesKeyword } from '@/lib/normalize';
import { POST_STATUS } from '@/lib/labels';
import { currentUserSeed } from '@/mocks/notifications';
import { BusinessError, ValidationError, collapseSpaces, delay, paginate, slugify, uid } from '@/lib/mock';
import { logActivity } from './audit';
import type { Paged, Post, PostFilter, PostInput, PostStatus } from '@/types';

const now = Date.now();
const daysAgo = (d: number) => new Date(now - d * 86_400_000).toISOString();

type P = [string, Post['category'], PostStatus, number, string, string];

/** [FAKE-DATA] Bài viết mẫu trên website nhà hàng. */
const rows: P[] = [
  ['Ưu đãi cuối tuần – giảm 15% set lẩu', 'promotion', 'published', 1, 'Áp dụng thứ Sáu đến Chủ nhật cho nhóm từ 4 khách khi gọi lẩu Thái hoặc lẩu nấm chay.', 'Từ thứ Sáu đến Chủ nhật hằng tuần, Green Lotus giảm 15% cho tất cả set lẩu dành cho nhóm từ 4 khách.\n\nĐiều kiện áp dụng:\n- Đặt bàn trước qua website hoặc hotline.\n- Không áp dụng đồng thời với chương trình khác.\n\nHẹn gặp quý khách!'],
  ['Ra mắt thực đơn chay mùa Vu Lan', 'news', 'published', 6, 'Bảy món chay mới từ nấm, đậu hũ và rau củ hữu cơ, phục vụ suốt tháng Bảy âm lịch.', 'Nhân mùa Vu Lan, bếp Green Lotus giới thiệu thực đơn chay gồm 7 món mới...\n\nTất cả nguyên liệu đều được chọn lọc từ nông trại hữu cơ tại Đà Lạt.'],
  ['Đêm nhạc acoustic tại sân vườn', 'event', 'published', 10, 'Mỗi tối thứ Bảy từ 19:30, thưởng thức nhạc mộc cùng bữa tối ngoài trời.', 'Sân vườn Green Lotus mở cửa đêm nhạc acoustic mỗi tối thứ Bảy.\n\nVui lòng đặt bàn khu vực Sân vườn để có chỗ ngồi đẹp nhất.'],
  ['Tặng chè hạt sen cho khách sinh nhật', 'promotion', 'hidden', 25, 'Khách có ngày sinh trong tháng được tặng một phần chè hạt sen long nhãn.', 'Chỉ cần xuất trình CCCD có ngày sinh trong tháng, quý khách sẽ nhận một phần chè hạt sen long nhãn miễn phí.'],
  ['Green Lotus đạt chứng nhận an toàn thực phẩm', 'news', 'published', 40, 'Nhà hàng vinh dự nhận chứng nhận cơ sở đủ điều kiện an toàn thực phẩm năm 2026.', 'Chúng tôi cam kết duy trì quy trình bếp sạch, nguồn nguyên liệu rõ ràng...'],
  ['Thực đơn Tết Nguyên Đán 2027', 'event', 'draft', 2, 'Bản nháp thực đơn mâm cỗ Tết, dự kiến công bố đầu tháng Chạp.', 'Đang hoàn thiện danh sách món và giá.'],
  ['Hướng dẫn gọi món bằng QR tại bàn', 'news', 'published', 15, 'Quét mã QR trên bàn để xem thực đơn, hỏi trợ lý AI và gửi yêu cầu gọi món.', 'Bước 1: Quét mã QR dán trên bàn.\nBước 2: Xem thực đơn hoặc hỏi trợ lý AI về món ăn.\nBước 3: Kiểm tra giỏ hàng và xác nhận gửi đơn.\n\nTrợ lý AI chỉ tư vấn, quý khách luôn là người quyết định món.'],
];

let store: Post[] = rows.map(([title, category, status, d, summary, content], i) => ({
  id: `post-${i + 1}`,
  title,
  slug: slugify(title),
  summary,
  content,
  coverImage: null,
  category,
  status,
  author: i % 3 === 0 ? 'Quản trị hệ thống' : currentUserSeed.name,
  createdAt: daysAgo(d + 2),
  updatedAt: daysAgo(d),
  publishedAt: status === 'published' || status === 'hidden' ? daysAgo(d) : null,
}));

export const POST_PAGE_SIZE = 8;

function validate(input: PostInput, editingId: string | null): { title: string; slug: string } {
  const errors: Record<string, string> = {};
  const title = collapseSpaces(input.title);
  if (!title) errors.title = 'Vui lòng nhập tiêu đề';
  else if (title.length > 150) errors.title = 'Tiêu đề tối đa 150 ký tự';
  if (input.summary.length > 300) errors.summary = 'Tóm tắt tối đa 300 ký tự';
  if (!input.content.trim()) errors.content = 'Vui lòng nhập nội dung bài viết';
  else if (input.content.trim().length < 20) errors.content = 'Nội dung quá ngắn (tối thiểu 20 ký tự)';
  const slug = slugify(title);
  if (!errors.title && store.some((p) => p.id !== editingId && p.slug === slug))
    errors.title = 'Đã có bài viết trùng tiêu đề, vui lòng đặt tiêu đề khác';
  if (Object.keys(errors).length) throw new ValidationError(errors);
  return { title, slug };
}

/** [BACKEND-TODO] GET /api/posts?keyword=&category=&status=&page= */
export async function getPosts(filter: PostFilter): Promise<Paged<Post> & { counts: Record<PostStatus | 'all', number> }> {
  await delay(300);
  const base = store
    .filter((p) => (filter.category === 'all' ? true : p.category === filter.category))
    .filter((p) => !filter.keyword.trim() || matchesKeyword(p.title, filter.keyword) || matchesKeyword(p.summary, filter.keyword));
  const counts = {
    all: base.length,
    draft: base.filter((p) => p.status === 'draft').length,
    published: base.filter((p) => p.status === 'published').length,
    hidden: base.filter((p) => p.status === 'hidden').length,
  };
  const items = base
    .filter((p) => (filter.status === 'all' ? true : p.status === filter.status))
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  return { ...paginate(items, filter.page, POST_PAGE_SIZE), counts };
}

/** [BACKEND-TODO] GET /api/posts/{id} */
export async function getPost(id: string): Promise<Post> {
  await delay(220);
  const found = store.find((p) => p.id === id);
  if (!found) throw new BusinessError('Bài viết không tồn tại hoặc đã bị xóa');
  return { ...found };
}

/** [BACKEND-TODO] POST /api/posts */
export async function createPost(input: PostInput): Promise<Post> {
  await delay(450);
  const { title, slug } = validate(input, null);
  const ts = new Date().toISOString();
  const post: Post = {
    id: uid('post'),
    ...input,
    title,
    slug,
    summary: input.summary.trim(),
    content: input.content.trim(),
    author: currentUserSeed.name,
    createdAt: ts,
    updatedAt: ts,
    publishedAt: input.status === 'published' ? ts : null,
  };
  store = [post, ...store];
  logActivity('post', input.status === 'published' ? 'Xuất bản bài viết' : 'Thêm bài viết', title);
  return { ...post };
}

/** [BACKEND-TODO] PUT /api/posts/{id} */
export async function updatePost(id: string, input: PostInput): Promise<Post> {
  await delay(450);
  const current = store.find((p) => p.id === id);
  if (!current) throw new BusinessError('Bài viết không tồn tại hoặc đã bị xóa');
  const { title, slug } = validate(input, id);
  const ts = new Date().toISOString();
  const updated: Post = {
    ...current,
    ...input,
    title,
    slug,
    summary: input.summary.trim(),
    content: input.content.trim(),
    updatedAt: ts,
    publishedAt: input.status === 'published' && !current.publishedAt ? ts : current.publishedAt,
  };
  store = store.map((p) => (p.id === id ? updated : p));
  logActivity('post', 'Cập nhật bài viết', title);
  return { ...updated };
}

/** [BACKEND-TODO] PATCH /api/posts/{id}/status { status } — xuất bản hoặc ẩn bài viết. */
export async function setPostStatus(id: string, status: PostStatus): Promise<Post> {
  await delay(300);
  const current = store.find((p) => p.id === id);
  if (!current) throw new BusinessError('Bài viết không tồn tại hoặc đã bị xóa');
  const ts = new Date().toISOString();
  const updated: Post = { ...current, status, updatedAt: ts, publishedAt: status === 'published' ? current.publishedAt ?? ts : current.publishedAt };
  store = store.map((p) => (p.id === id ? updated : p));
  logActivity('post', status === 'published' ? 'Xuất bản bài viết' : status === 'hidden' ? 'Ẩn bài viết' : 'Chuyển về nháp', `${current.title} (${POST_STATUS[status].label})`);
  return { ...updated };
}

/** [BACKEND-TODO] DELETE /api/posts/{id} */
export async function deletePost(id: string): Promise<void> {
  await delay(320);
  const current = store.find((p) => p.id === id);
  if (!current) throw new BusinessError('Bài viết không tồn tại hoặc đã bị xóa');
  store = store.filter((p) => p.id !== id);
  logActivity('post', 'Xóa bài viết', current.title);
}
