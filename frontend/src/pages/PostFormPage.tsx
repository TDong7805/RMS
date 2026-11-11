import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { Card, CardHeader } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { BlockError } from '@/components/common/EmptyState';
import { Field, ImageUpload, SelectInput, TextArea, TextInput } from '@/components/common/Form';
import { PageHeader } from '@/components/common/PageParts';
import { Segmented } from '@/components/common/Segmented';
import { Skeleton } from '@/components/common/Skeleton';
import { createPost, updatePost } from '@/api/posts';
import { qk, usePost } from '@/features/management/queries';
import { useApiMutation } from '@/hooks/use-api-mutation';
import { POST_CATEGORY, POST_STATUS, formatDateTime } from '@/lib/labels';
import { slugify } from '@/lib/mock';
import type { PostCategory, PostInput, PostStatus } from '@/types';

const EMPTY: PostInput = { title: '', summary: '', content: '', coverImage: null, category: 'news', status: 'draft' };

export function PostFormPage() {
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const postQuery = usePost(id);
  const [form, setForm] = useState<PostInput>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [mode, setMode] = useState<'write' | 'preview'>('write');

  useEffect(() => {
    setErrors({});
    if (!id) setForm(EMPTY);
  }, [id]);

  useEffect(() => {
    const p = postQuery.data;
    if (p && p.id === id) setForm({ title: p.title, summary: p.summary, content: p.content, coverImage: p.coverImage, category: p.category, status: p.status });
  }, [postQuery.data, id]);

  const mutation = useApiMutation((input: PostInput) => (id ? updatePost(id, input) : createPost(input)), {
    invalidate: [qk.posts],
    success: (p) => (isEdit ? `Đã cập nhật “${p.title}”` : `Đã tạo bài viết “${p.title}” (${POST_STATUS[p.status].label})`),
    onFieldErrors: setErrors,
    onSuccess: () => navigate('/bai-viet'),
  });

  const set = <K extends keyof PostInput>(k: K, v: PostInput[K]) => {
    setForm((p) => ({ ...p, [k]: v }));
    setErrors((p) => ({ ...p, [k]: '' }));
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const local: Record<string, string> = {};
    if (!form.title.trim()) local.title = 'Vui lòng nhập tiêu đề';
    if (!form.content.trim()) local.content = 'Vui lòng nhập nội dung bài viết';
    if (Object.keys(local).length) return setErrors(local);
    mutation.mutate(form);
  };

  const title = isEdit ? 'Chỉnh sửa bài viết' : 'Thêm bài viết';
  // Bài đã xuất bản ít nhất một lần: backend giữ nguyên đường dẫn để link đã chia sẻ không hỏng.
  const lockedSlug = isEdit && postQuery.data?.publishedAt ? postQuery.data.slug : null;

  return (
    <AppShell meta={{ label: title, parent: 'Quản lý bài viết' }}>
      <div className="min-w-0 space-y-4">
        <PageHeader
          title={title}
          description={isEdit && postQuery.data ? `Tác giả ${postQuery.data.author} · cập nhật ${formatDateTime(postQuery.data.updatedAt)}` : 'Soạn tin tức, ưu đãi hoặc sự kiện cho website nhà hàng.'}
          actions={<Button variant="ghost" size="sm" leadingIcon={<ArrowLeft size={15} />} onClick={() => navigate('/bai-viet')}>Về danh sách</Button>}
        />

        {isEdit && postQuery.isError ? (
          <BlockError message="Bài viết không tồn tại hoặc đã bị xóa" onRetry={() => void postQuery.refetch()} />
        ) : isEdit && postQuery.isLoading ? (
          <Card padded><div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div></Card>
        ) : (
          <form onSubmit={submit} noValidate className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
            <Card padded className="min-w-0">
              <div className="space-y-4">
                <Field label="Tiêu đề" htmlFor="p-title" required error={errors.title} hint={lockedSlug ? `Đường dẫn: /tin-tuc/${lockedSlug} (đã xuất bản nên giữ cố định)` : form.title ? `Đường dẫn: /tin-tuc/${slugify(form.title)}` : `${form.title.length}/150 ký tự`}>
                  <TextInput id="p-title" value={form.title} maxLength={150} invalid={Boolean(errors.title)} onChange={(e) => set('title', e.target.value)} className="h-11 text-[16px] font-semibold" placeholder="Tiêu đề bài viết" />
                </Field>
                <Field label="Tóm tắt" htmlFor="p-summary" error={errors.summary} hint={`${form.summary.length}/300 ký tự — hiển thị ở trang danh sách tin`}>
                  <TextArea id="p-summary" rows={2} maxLength={300} value={form.summary} invalid={Boolean(errors.summary)} onChange={(e) => set('summary', e.target.value)} />
                </Field>
                <div>
                  <div className="mb-1.5 flex items-center justify-between">
                    <label htmlFor="p-content" className="text-[13px] font-semibold">
                      Nội dung <span className="text-[var(--danger)]">*</span>
                    </label>
                    <Segmented<'write' | 'preview'> ariaLabel="Chế độ soạn thảo" value={mode} onChange={setMode} options={[{ value: 'write', label: 'Soạn' }, { value: 'preview', label: 'Xem trước' }]} />
                  </div>
                  {mode === 'write' ? (
                    <TextArea id="p-content" rows={14} maxLength={20000} value={form.content} invalid={Boolean(errors.content)} onChange={(e) => set('content', e.target.value)} placeholder={'Nội dung bài viết…\nDòng bắt đầu bằng "- " sẽ hiển thị dạng danh sách.'} />
                  ) : (
                    <article className="min-h-[300px] rounded-control border border-[var(--border)] bg-[var(--bg-subtle)] px-4 py-3">
                      <h2 className="text-[20px] font-bold">{form.title || 'Tiêu đề bài viết'}</h2>
                      {form.summary ? <p className="mt-1 text-[14px] italic text-[var(--text-secondary)]">{form.summary}</p> : null}
                      <div className="mt-3 space-y-2 text-[14px] leading-6">
                        {form.content.split(/\n{2,}/).map((block, i) =>
                          block.split('\n').every((l) => l.trim().startsWith('- ')) ? (
                            <ul key={i} className="list-disc pl-5">{block.split('\n').map((l, j) => <li key={j}>{l.trim().slice(2)}</li>)}</ul>
                          ) : (
                            <p key={i} className="whitespace-pre-line">{block}</p>
                          ),
                        )}
                      </div>
                    </article>
                  )}
                  {errors.content ? <p className="mt-1 text-[12px] font-medium text-[var(--danger)]">{errors.content}</p> : null}
                </div>
              </div>
            </Card>

            <div className="min-w-0 space-y-4">
              <Card padded>
                <CardHeader title="Xuất bản" />
                <div className="mt-3 space-y-3">
                  <Segmented<PostStatus>
                    ariaLabel="Trạng thái"
                    value={form.status}
                    onChange={(v) => set('status', v)}
                    options={[{ value: 'draft', label: 'Nháp' }, { value: 'published', label: 'Xuất bản' }, { value: 'hidden', label: 'Ẩn' }]}
                  />
                  <Field label="Chuyên mục" htmlFor="p-cat">
                    <SelectInput id="p-cat" value={form.category} onChange={(e) => set('category', e.target.value as PostCategory)} options={(Object.keys(POST_CATEGORY) as PostCategory[]).map((c) => ({ value: c, label: POST_CATEGORY[c] }))} />
                  </Field>
                  <div className="flex gap-2 pt-1">
                    <Button variant="ghost" className="flex-1" onClick={() => navigate('/bai-viet')} disabled={mutation.isPending}>Hủy</Button>
                    <Button type="submit" className="flex-1" loading={mutation.isPending} leadingIcon={<Save size={15} />}>Lưu</Button>
                  </div>
                </div>
              </Card>
              <Card padded>
                <CardHeader title="Ảnh bìa" />
                <div className="mt-3">
                  <ImageUpload aspect="wide" value={form.coverImage} onChange={(v) => set('coverImage', v)} label="Chọn ảnh bìa" error={errors.coverImage} onError={(m) => setErrors((prev) => ({ ...prev, coverImage: m }))} />
                </div>
              </Card>
            </div>
          </form>
        )}
      </div>
    </AppShell>
  );
}

export default PostFormPage;
