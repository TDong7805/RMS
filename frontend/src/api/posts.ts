import { api } from '@/lib/http';
import type { Paged, Post, PostFilter, PostInput, PostStatus } from '@/types';

/** Phải trùng PostService.PAGE_SIZE ở backend. */
export const POST_PAGE_SIZE = 8;

/**
 * GET /api/posts?keyword=&category=&status=&page= — tìm không dấu theo tiêu đề / tóm tắt, mới cập nhật trước.
 * counts: số bài theo trạng thái (sau khi lọc từ khóa, chuyên mục) cho các tab.
 */
export function getPosts(filter: PostFilter): Promise<Paged<Post> & { counts: Record<PostStatus | 'all', number> }> {
  return api.get<Paged<Post> & { counts: Record<PostStatus | 'all', number> }>('/api/posts', {
    keyword: filter.keyword,
    category: filter.category,
    status: filter.status,
    page: filter.page,
  });
}

/** GET /api/posts/{id} — 404 nếu không tồn tại hoặc đã xóa. */
export function getPost(id: string): Promise<Post> {
  return api.get<Post>(`/api/posts/${encodeURIComponent(id)}`);
}

/**
 * POST /api/posts. coverImage: null hoặc data URL ảnh vừa chọn (backend kiểm tra, thu nhỏ, lưu).
 * Tác giả là người đang đăng nhập; đường dẫn tạo từ tiêu đề.
 */
export function createPost(input: PostInput): Promise<Post> {
  return api.post<Post>('/api/posts', input);
}

/**
 * PUT /api/posts/{id}. coverImage giữ nguyên địa chỉ cũ = không đổi ảnh; null = bỏ ảnh.
 * Bài đã xuất bản ít nhất một lần thì đường dẫn không đổi theo tiêu đề nữa.
 */
export function updatePost(id: string, input: PostInput): Promise<Post> {
  return api.put<Post>(`/api/posts/${encodeURIComponent(id)}`, input);
}

/** PATCH /api/posts/{id}/status — xuất bản, ẩn hoặc chuyển về nháp. */
export function setPostStatus(id: string, status: PostStatus): Promise<Post> {
  return api.patch<Post>(`/api/posts/${encodeURIComponent(id)}/status`, { status });
}

/** DELETE /api/posts/{id} — xóa hẳn, kèm ảnh bìa. */
export function deletePost(id: string): Promise<void> {
  return api.delete(`/api/posts/${encodeURIComponent(id)}`);
}
