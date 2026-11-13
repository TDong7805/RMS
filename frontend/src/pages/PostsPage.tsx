import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { EyeOff, Globe, Newspaper, Pencil, Plus, Trash2 } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { Card } from '@/components/common/Card';
import { Badge } from '@/components/common/Badge';
import { Button } from '@/components/common/Button';
import { BlockError, EmptyState } from '@/components/common/EmptyState';
import { SearchInput, SelectInput } from '@/components/common/Form';
import { ConfirmDialog } from '@/components/common/Modal';
import { PageHeader, Pagination, TableSkeleton, Toolbar } from '@/components/common/PageParts';
import { Segmented } from '@/components/common/Segmented';
import { POST_PAGE_SIZE, deletePost, setPostStatus } from '@/api/posts';
import { qk, usePosts } from '@/features/management/queries';
import { useApiMutation } from '@/hooks/use-api-mutation';
import { useDebounced } from '@/hooks/use-debounced';
import { POST_CATEGORY, POST_STATUS, formatDateTime } from '@/lib/labels';
import type { Post, PostCategory, PostStatus } from '@/types';

export function PostsPage() {
  const navigate = useNavigate();
  const [keyword, setKeyword] = useState('');
  const [category, setCategory] = useState<PostCategory | 'all'>('all');
  const [status, setStatus] = useState<PostStatus | 'all'>('all');
  const [page, setPage] = useState(1);
  const debounced = useDebounced(keyword);
  const [toDelete, setToDelete] = useState<Post | null>(null);

  const list = usePosts({ keyword: debounced, category, status, page });
  useEffect(() => setPage(1), [debounced, category, status]);

  const statusMutation = useApiMutation((v: { id: string; status: PostStatus }) => setPostStatus(v.id, v.status), {
    invalidate: [qk.posts],
    success: (p) => (p.status === 'published' ? `Đã xuất bản “${p.title}”` : `Đã ẩn “${p.title}” khỏi website`),
  });
  const deleteMutation = useApiMutation((p: Post) => deletePost(p.id), {
    invalidate: [qk.posts],
    success: (_r, p) => `Đã xóa bài viết “${p.title}”`,
    onSuccess: () => setToDelete(null),
  });

  const counts = list.data?.counts;

  return (
    <AppShell meta={{ label: 'Danh sách tin đăng', parent: 'Quản lý bài viết' }}>
      <div className="min-w-0 space-y-4">
        <PageHeader
          title="Danh sách tin đăng"
          description="Quản lý tin tức, ưu đãi và sự kiện hiển thị trên website nhà hàng."
          actions={<Button size="sm" leadingIcon={<Plus size={15} />} onClick={() => navigate('/quan-ly/bai-viet/them')}>Thêm bài viết</Button>}
        />

        <Card className="overflow-hidden">
          <Toolbar className="justify-between">
            <Segmented<PostStatus | 'all'>
              ariaLabel="Lọc theo trạng thái"
              value={status}
              onChange={setStatus}
              options={[
                { value: 'all', label: 'Tất cả', count: counts?.all },
                { value: 'published', label: 'Đã xuất bản', count: counts?.published },
                { value: 'draft', label: 'Nháp', count: counts?.draft },
                { value: 'hidden', label: 'Đã ẩn', count: counts?.hidden },
              ]}
            />
            <div className="flex w-full flex-wrap gap-2 sm:w-auto">
              <SearchInput value={keyword} onChange={setKeyword} placeholder="Tìm tiêu đề, tóm tắt…" className="w-full sm:w-[240px]" />
              <SelectInput
                aria-label="Lọc theo chuyên mục"
                value={category === 'all' ? '' : category}
                onChange={(e) => setCategory((e.target.value || 'all') as PostCategory | 'all')}
                placeholder="Mọi chuyên mục"
                options={(Object.keys(POST_CATEGORY) as PostCategory[]).map((c) => ({ value: c, label: POST_CATEGORY[c] }))}
                className="w-full sm:w-[160px]"
              />
            </div>
          </Toolbar>

          {list.isError ? (
            <div className="p-5"><BlockError onRetry={() => void list.refetch()} retrying={list.isFetching} /></div>
          ) : list.isLoading || !list.data ? (
            <TableSkeleton rows={4} cols={3} />
          ) : list.data.items.length === 0 ? (
            <div className="p-5">
              <EmptyState icon={Newspaper} title="Không tìm thấy bài viết" description="Bài viết không tồn tại hoặc không khớp điều kiện tìm kiếm." />
            </div>
          ) : (
            <div className={list.isFetching ? 'opacity-60 transition-opacity' : ''}>
              <ul className="divide-y divide-[var(--border)]">
                {list.data.items.map((p) => (
                  <li key={p.id} className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:px-5">
                    <div className="grid h-[72px] w-full shrink-0 place-items-center overflow-hidden rounded-item bg-[var(--accent-soft)] text-[var(--accent)] sm:w-[120px]">
                      {p.coverImage ? <img src={p.coverImage} alt="" className="h-full w-full object-cover" /> : <Newspaper size={22} strokeWidth={1.6} />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge variant={POST_STATUS[p.status].variant}>{POST_STATUS[p.status].label}</Badge>
                        <Badge variant="neutral">{POST_CATEGORY[p.category]}</Badge>
                      </div>
                      <button type="button" onClick={() => navigate(`/quan-ly/bai-viet/${p.id}/sua`)} className="mt-1 block max-w-full truncate text-left text-[15px] font-semibold hover:text-[var(--accent)]">
                        {p.title}
                      </button>
                      <p className="line-clamp-1 text-[13px] text-[var(--text-secondary)]">{p.summary || 'Chưa có tóm tắt'}</p>
                      <p className="mt-0.5 text-[12px] text-[var(--text-muted)]">
                        {p.author} · cập nhật {formatDateTime(p.updatedAt)}
                        {p.publishedAt ? ` · xuất bản ${formatDateTime(p.publishedAt)}` : ''}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      {p.status === 'published' ? (
                        <Button size="sm" variant="outline" leadingIcon={<EyeOff size={14} />} loading={statusMutation.isPending && statusMutation.variables?.id === p.id} onClick={() => statusMutation.mutate({ id: p.id, status: 'hidden' })}>
                          Ẩn
                        </Button>
                      ) : (
                        <Button size="sm" variant="secondary" leadingIcon={<Globe size={14} />} loading={statusMutation.isPending && statusMutation.variables?.id === p.id} onClick={() => statusMutation.mutate({ id: p.id, status: 'published' })}>
                          Xuất bản
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" aria-label={`Sửa ${p.title}`} onClick={() => navigate(`/quan-ly/bai-viet/${p.id}/sua`)}><Pencil size={14} /></Button>
                      <Button size="sm" variant="ghost" aria-label={`Xóa ${p.title}`} onClick={() => setToDelete(p)}><Trash2 size={14} /></Button>
                    </div>
                  </li>
                ))}
              </ul>
              <Pagination page={list.data.page} pageCount={list.data.pageCount} total={list.data.total} pageSize={POST_PAGE_SIZE} onChange={setPage} unit="bài viết" />
            </div>
          )}
        </Card>
      </div>

      <ConfirmDialog
        open={Boolean(toDelete)}
        onOpenChange={(o) => !o && setToDelete(null)}
        title="Xóa bài viết?"
        description={`“${toDelete?.title}” sẽ bị xóa vĩnh viễn. Nếu chỉ muốn tạm gỡ khỏi website, hãy chọn “Ẩn”.`}
        confirmLabel="Xóa bài viết"
        loading={deleteMutation.isPending}
        onConfirm={() => toDelete && deleteMutation.mutate(toDelete)}
      />
    </AppShell>
  );
}

export default PostsPage;
