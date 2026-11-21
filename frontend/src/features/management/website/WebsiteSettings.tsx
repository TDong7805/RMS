import { useEffect, useState, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, ExternalLink, Eye, EyeOff, Images, Megaphone, NotebookPen, Plus, Save, Share2, Trash2, UtensilsCrossed } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardHeader } from '@/components/common/Card';
import { Badge } from '@/components/common/Badge';
import { Button } from '@/components/common/Button';
import { BlockError, EmptyState } from '@/components/common/EmptyState';
import { Field, ImageUpload, SearchInput, TextArea, TextInput, Toggle } from '@/components/common/Form';
import { ConfirmDialog, Modal } from '@/components/common/Modal';
import { Skeleton } from '@/components/common/Skeleton';
import {
  addWebsitePhoto,
  deleteWebsitePhoto,
  getWebsiteContent,
  getWebsiteGallery,
  getWebsiteMenu,
  moveWebsitePhoto,
  setWebsiteCategoryVisible,
  setWebsiteDishVisible,
  updateWebsiteContent,
  updateWebsitePhoto,
} from '@/api/website';
import { ps } from '@/features/public-site/queries';
import { useApiMutation } from '@/hooks/use-api-mutation';
import { cn } from '@/lib/cn';
import { formatCurrency } from '@/lib/format';
import { formatDateTime } from '@/lib/labels';
import type { WebsiteContentInput, WebsitePhoto } from '@/types';

/** Khóa query cấu hình website; lưu xong tải lại cả dữ liệu website công khai (nếu đang mở ở tab khác cùng trình duyệt). */
const wq = {
  content: ['website', 'content'] as const,
  gallery: ['website', 'gallery'] as const,
  menu: ['website', 'menu'] as const,
};

/**
 * Cấu hình hệ thống → tab "Website khách hàng": nội dung banner / giới thiệu / mạng xã hội, album ảnh, thực đơn hiện
 * trên website. Tên, logo, liên hệ, giờ mở cửa sửa ở tab "Thông tin nhà hàng" — website dùng chung dữ liệu đó.
 */
export function WebsiteSettings() {
  return (
    <div className="min-w-0 space-y-4">
      <Card padded className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[13.5px] text-[var(--text-secondary)]">
          Website công khai lấy <b>tên, logo, địa chỉ, điện thoại, email</b> và <b>giờ mở cửa</b> từ tab Thông tin nhà hàng; form đặt bàn theo
          {' '}<b>Đặt bàn → Cập nhật form</b>. Nội dung dưới đây hiện ngay sau khi lưu.
        </p>
        <a href="/" target="_blank" rel="noopener noreferrer" className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-control border border-[var(--border)] px-3 text-[13.5px] font-semibold hover:bg-[var(--bg-hover)]">
          <ExternalLink size={15} /> Xem website
        </a>
      </Card>
      <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <WebsiteContentForm />
        <GalleryCard />
      </div>
      <MenuVisibilityCard />
    </div>
  );
}

/* =========================================================== Nội dung */

function WebsiteContentForm() {
  const query = useQuery({ queryKey: wq.content, queryFn: getWebsiteContent });
  const [form, setForm] = useState<WebsiteContentInput | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const load = (c: WebsiteContentInput & { updatedAt?: string }) => {
    const { updatedAt, ...rest } = c;
    void updatedAt;
    setForm(rest);
    setErrors({});
  };
  useEffect(() => {
    if (query.data && !form) load(query.data);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query.data]);

  const mutation = useApiMutation(updateWebsiteContent, {
    invalidate: [wq.content, ps.all],
    success: 'Đã lưu nội dung website',
    onFieldErrors: setErrors,
    onSuccess: load,
  });

  if (query.isError) return <BlockError onRetry={() => void query.refetch()} retrying={query.isFetching} />;
  if (!form) return <Skeleton className="h-[720px]" />;

  const set = (key: keyof WebsiteContentInput, value: string | null) => {
    setForm({ ...form, [key]: value });
    setErrors((p) => ({ ...p, [key]: '' }));
  };
  const text = (key: keyof WebsiteContentInput, label: string, opts: { placeholder?: string; hint?: string; max?: number } = {}) => (
    <Field label={label} htmlFor={`wc-${key}`} error={errors[key]} hint={opts.hint}>
      <TextInput id={`wc-${key}`} value={(form[key] as string) ?? ''} placeholder={opts.placeholder} maxLength={opts.max}
        invalid={Boolean(errors[key])} onChange={(e) => set(key, e.target.value)} />
    </Field>
  );

  return (
    <form
      noValidate
      className="min-w-0 space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        mutation.mutate(form);
      }}
    >
      <Card padded>
        <CardHeader title="Banner trang chủ" icon={<Megaphone size={17} />} description={query.data ? `Cập nhật lần cuối ${formatDateTime(query.data.updatedAt)}` : undefined} />
        <div className="mt-4 grid gap-4">
          {text('slogan', 'Slogan', { placeholder: 'Bò Úc thượng hạng – nướng đúng độ chín bạn yêu thích', max: 200 })}
          {text('award', 'Danh hiệu / giải thưởng', { placeholder: 'Michelin Selected 2026', hint: 'Hiện thành huy hiệu trên banner. Để trống nếu không có.', max: 100 })}
          <div>
            <p className="mb-1 text-[13px] font-semibold">Ảnh banner</p>
            <p className="mb-2 text-[12.5px] text-[var(--text-muted)]">Ảnh ngang 16:9 (món đặc sản, không gian). Để trống thì dùng ảnh bìa ở tab Thông tin nhà hàng.</p>
            <div className="max-w-[420px]">
              <ImageUpload value={form.heroImage} onChange={(v) => set('heroImage', v)} error={errors.heroImage} aspect="wide" label="Tải ảnh banner" />
            </div>
          </div>
        </div>
      </Card>

      <Card padded>
        <CardHeader title="Về chúng tôi" icon={<NotebookPen size={17} />} description="Trang Giới thiệu và khối giới thiệu ở trang chủ." />
        <div className="mt-4 grid gap-4">
          {text('aboutTitle', 'Tiêu đề', { placeholder: 'Câu chuyện Royal Beef', max: 150 })}
          <Field label="Nội dung" htmlFor="wc-aboutContent" error={errors.aboutContent} hint={`${form.aboutContent.length}/5000 — xuống dòng để sang đoạn mới. Đoạn đầu hiện ở trang chủ.`}>
            <TextArea id="wc-aboutContent" rows={7} maxLength={5000} value={form.aboutContent} invalid={Boolean(errors.aboutContent)}
              onChange={(e) => set('aboutContent', e.target.value)} />
          </Field>
          <Field label="Điểm nhấn" htmlFor="wc-aboutHighlights" error={errors.aboutHighlights} hint="Mỗi dòng một điểm nhấn, tối đa 6 dòng.">
            <TextArea id="wc-aboutHighlights" rows={4} value={form.aboutHighlights} invalid={Boolean(errors.aboutHighlights)}
              placeholder={'Bò Úc nhập khẩu, ủ khô 21 ngày\nBếp mở – nướng than đá'} onChange={(e) => set('aboutHighlights', e.target.value)} />
          </Field>
          <div>
            <p className="mb-1 text-[13px] font-semibold">Ảnh giới thiệu</p>
            <div className="max-w-[320px]">
              <ImageUpload value={form.aboutImage} onChange={(v) => set('aboutImage', v)} error={errors.aboutImage} label="Tải ảnh" />
            </div>
          </div>
        </div>
      </Card>

      <Card padded>
        <CardHeader title="Mạng xã hội & bản đồ" icon={<Share2 size={17} />} description="Để trống mục nào thì website không hiện mục đó." />
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {text('facebookUrl', 'Facebook', { placeholder: 'https://facebook.com/…' })}
          {text('instagramUrl', 'Instagram', { placeholder: 'https://instagram.com/…' })}
          {text('tiktokUrl', 'TikTok', { placeholder: 'https://tiktok.com/@…' })}
          {text('youtubeUrl', 'YouTube', { placeholder: 'https://youtube.com/@…' })}
          {text('zaloPhone', 'Số Zalo', { placeholder: '0912345678', max: 15 })}
          {text('mapUrl', 'Link Google Maps', { placeholder: 'https://maps.google.com/…', hint: 'Dán link "Nhúng bản đồ" (…/maps/embed…) để hiện bản đồ ngay trên trang Liên hệ.' })}
        </div>
      </Card>

      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={() => query.data && load(query.data)} disabled={mutation.isPending}>Hoàn tác</Button>
        <Button type="submit" loading={mutation.isPending} leadingIcon={<Save size={15} />}>Lưu nội dung website</Button>
      </div>
    </form>
  );
}

/* =========================================================== Album ảnh */

function GalleryCard() {
  const query = useQuery({ queryKey: wq.gallery, queryFn: getWebsiteGallery });
  const [editing, setEditing] = useState<WebsitePhoto | 'new' | null>(null);
  const [removing, setRemoving] = useState<WebsitePhoto | null>(null);
  const invalidate = [wq.gallery, ps.gallery];

  const move = useApiMutation(moveWebsitePhoto, { invalidate });
  const toggle = useApiMutation(updateWebsitePhoto, { invalidate, success: (p) => (p.visible ? 'Đã hiện ảnh trên website' : 'Đã ẩn ảnh khỏi website') });
  const remove = useApiMutation(deleteWebsitePhoto, { invalidate, success: 'Đã xóa ảnh khỏi album', onSuccess: () => setRemoving(null) });

  const photos = query.data ?? [];
  const visible = photos.filter((p) => p.visible).length;

  return (
    <Card padded className="min-w-0 self-start">
      <CardHeader
        title="Album ảnh"
        icon={<Images size={17} />}
        description={query.data ? `${photos.length} ảnh · ${visible} đang hiện trên website` : 'Ảnh không gian, món ăn, sự kiện.'}
        actions={<Button size="sm" leadingIcon={<Plus size={15} />} onClick={() => setEditing('new')} disabled={!query.data}>Thêm ảnh</Button>}
      />
      <div className="mt-4">
        {query.isError ? (
          <BlockError onRetry={() => void query.refetch()} retrying={query.isFetching} />
        ) : !query.data ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="aspect-square" />)}</div>
        ) : !photos.length ? (
          <EmptyState icon={Images} title="Album chưa có ảnh" description="Trang Album ảnh của website đang hiện thông báo 'đang cập nhật'." action={<Button size="sm" onClick={() => setEditing('new')}>Thêm ảnh đầu tiên</Button>} />
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {photos.map((p, i) => (
              <li key={p.id} className={cn('overflow-hidden rounded-[var(--radius-item)] border border-[var(--border)]', !p.visible && 'opacity-60')}>
                <button type="button" className="block w-full" onClick={() => setEditing(p)} aria-label={`Sửa ảnh ${p.caption || i + 1}`}>
                  <img src={p.image} alt={p.caption || `Ảnh ${i + 1}`} className="aspect-square w-full bg-[var(--bg-subtle)] object-cover" loading="lazy" />
                </button>
                <div className="space-y-1.5 p-2">
                  <p className="line-clamp-1 text-[12.5px]" title={p.caption}>{p.caption || <span className="text-[var(--text-muted)]">Chưa có chú thích</span>}</p>
                  <div className="flex items-center gap-1">
                    <IconBtn label="Lên trước" disabled={i === 0 || move.isPending} onClick={() => move.mutate({ id: p.id, direction: 'up' })}><ArrowUp size={14} /></IconBtn>
                    <IconBtn label="Xuống sau" disabled={i === photos.length - 1 || move.isPending} onClick={() => move.mutate({ id: p.id, direction: 'down' })}><ArrowDown size={14} /></IconBtn>
                    <IconBtn label={p.visible ? 'Ẩn khỏi website' : 'Hiện trên website'} disabled={toggle.isPending}
                      onClick={() => toggle.mutate({ id: p.id, image: p.image, caption: p.caption, visible: !p.visible })}>
                      {p.visible ? <Eye size={14} /> : <EyeOff size={14} />}
                    </IconBtn>
                    <IconBtn label="Xóa ảnh" danger onClick={() => setRemoving(p)}><Trash2 size={14} /></IconBtn>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
      {editing ? <PhotoDialog photo={editing === 'new' ? null : editing} onClose={() => setEditing(null)} /> : null}
      <ConfirmDialog
        open={Boolean(removing)}
        onOpenChange={(o) => !o && setRemoving(null)}
        title="Xóa ảnh khỏi album?"
        description="Ảnh bị xóa hẳn khỏi máy chủ và không khôi phục được (trừ khi phục hồi bản sao lưu)."
        confirmLabel="Xóa ảnh"
        tone="danger"
        loading={remove.isPending}
        onConfirm={() => removing && remove.mutate(removing.id)}
      />
    </Card>
  );
}

function IconBtn({ label, onClick, disabled, danger, children }: { label: string; onClick: () => void; disabled?: boolean; danger?: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex h-7 w-7 items-center justify-center rounded-md border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] disabled:opacity-40',
        danger && 'ml-auto text-[var(--danger)] hover:bg-[var(--danger-soft)]',
      )}
    >
      {children}
    </button>
  );
}

function PhotoDialog({ photo, onClose }: { photo: WebsitePhoto | null; onClose: () => void }) {
  const [image, setImage] = useState<string | null>(photo?.image ?? null);
  const [caption, setCaption] = useState(photo?.caption ?? '');
  const [visible, setVisible] = useState(photo?.visible ?? true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const options = { invalidate: [wq.gallery, ps.gallery], onFieldErrors: setErrors, onSuccess: onClose };
  const add = useApiMutation(addWebsitePhoto, { ...options, success: 'Đã thêm ảnh vào album' });
  const update = useApiMutation(updateWebsitePhoto, { ...options, success: 'Đã cập nhật ảnh' });
  const pending = add.isPending || update.isPending;

  const save = () => {
    if (!image) {
      setErrors({ image: 'Vui lòng chọn ảnh' });
      return;
    }
    if (caption.trim().length > 150) {
      setErrors({ caption: 'Chú thích tối đa 150 ký tự' });
      return;
    }
    const input = { image, caption: caption.trim(), visible };
    if (photo) update.mutate({ id: photo.id, ...input });
    else add.mutate(input);
  };

  return (
    <Modal
      open
      onOpenChange={(o) => !o && onClose()}
      title={photo ? 'Sửa ảnh album' : 'Thêm ảnh vào album'}
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={pending}>Hủy</Button>
          <Button onClick={save} loading={pending} leadingIcon={<Save size={15} />}>{photo ? 'Lưu' : 'Thêm ảnh'}</Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="max-w-[420px]">
          <ImageUpload value={image} onChange={(v) => { setImage(v); setErrors((p) => ({ ...p, image: '' })); }} error={errors.image}
            onError={(m) => setErrors((p) => ({ ...p, image: m }))} aspect="wide" label="Chọn ảnh" />
        </div>
        <Field label="Chú thích" htmlFor="ph-caption" error={errors.caption} hint={`${caption.length}/150`}>
          <TextInput id="ph-caption" value={caption} maxLength={150} invalid={Boolean(errors.caption)} placeholder="VD: Phòng VIP tầng 2"
            onChange={(e) => { setCaption(e.target.value); setErrors((p) => ({ ...p, caption: '' })); }} />
        </Field>
        <label className="flex items-center justify-between gap-3 text-[14px]">
          <span>Hiện trên website</span>
          <Toggle checked={visible} onChange={setVisible} label="Hiện trên website" />
        </label>
      </div>
    </Modal>
  );
}

/* =========================================================== Thực đơn trên website */

function MenuVisibilityCard() {
  const query = useQuery({ queryKey: wq.menu, queryFn: getWebsiteMenu });
  const [keyword, setKeyword] = useState('');
  const invalidate = [wq.menu, ps.menu];
  const cat = useApiMutation(setWebsiteCategoryVisible, { invalidate, success: (_, v) => (v.visible ? 'Đã hiện danh mục trên website' : 'Đã ẩn danh mục khỏi website') });
  const dish = useApiMutation(setWebsiteDishVisible, { invalidate, success: (_, v) => (v.visible ? 'Đã hiện món trên website' : 'Đã ẩn món khỏi website') });

  const k = keyword.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd');
  const match = (s: string) => !k || s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').includes(k);
  const categories = (query.data ?? [])
    .map((c) => ({ ...c, dishes: c.dishes.filter((d) => match(d.name) || match(d.code) || match(c.name)) }))
    .filter((c) => !k || c.dishes.length);

  return (
    <Card padded className="min-w-0">
      <CardHeader
        title="Thực đơn trên website"
        icon={<UtensilsCrossed size={17} />}
        description="Website chỉ hiện món Đang bán của danh mục đang bật. Tắt công tắc để ẩn khỏi website mà không ngừng bán (trang gọi món QR không đổi)."
        actions={<SearchInput value={keyword} onChange={setKeyword} placeholder="Tìm món…" className="w-full sm:w-[220px]" />}
      />
      <div className="mt-4">
        {query.isError ? (
          <BlockError onRetry={() => void query.refetch()} retrying={query.isFetching} />
        ) : !query.data ? (
          <Skeleton className="h-[320px]" />
        ) : !categories.length ? (
          <EmptyState icon={UtensilsCrossed} title={k ? 'Không tìm thấy món' : 'Chưa có danh mục món'} />
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {categories.map((c) => (
              <section key={c.id} className="rounded-[var(--radius-item)] border border-[var(--border)]">
                <header className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{c.name}</p>
                    <p className="text-[12.5px] text-[var(--text-muted)]">
                      {c.dishes.length} món{!c.active ? ' · danh mục đang tắt (website không hiện)' : ''}
                    </p>
                  </div>
                  <Toggle checked={c.showOnWebsite} disabled={cat.isPending} label={`Hiện danh mục ${c.name} trên website`}
                    onChange={(v) => cat.mutate({ id: c.id, visible: v })} />
                </header>
                <ul className="divide-y divide-[var(--border)]">
                  {c.dishes.map((d) => {
                    const shown = c.active && c.showOnWebsite && d.status === 'selling' && d.showOnWebsite;
                    return (
                      <li key={d.id} className="flex items-center gap-3 px-4 py-2.5">
                        {d.image ? <img src={d.image} alt="" className="h-9 w-9 shrink-0 rounded-md object-cover" loading="lazy" /> : <span className="h-9 w-9 shrink-0 rounded-md bg-[var(--bg-subtle)]" />}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[14px]">{d.name}</p>
                          <p className="text-[12px] text-[var(--text-muted)]">{d.code} · {formatCurrency(d.price)}</p>
                        </div>
                        {d.status !== 'selling' ? <Badge variant="neutral">Ngừng bán</Badge> : shown ? <Badge variant="accent">Đang hiện</Badge> : null}
                        <Toggle checked={d.showOnWebsite} disabled={dish.isPending} label={`Hiện ${d.name} trên website`}
                          onChange={(v) => dish.mutate({ id: d.id, visible: v })} />
                      </li>
                    );
                  })}
                  {!c.dishes.length ? <li className="px-4 py-3 text-[13px] text-[var(--text-muted)]">Chưa có món.</li> : null}
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}
