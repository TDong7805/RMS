import { useState, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, ExternalLink, Eye, EyeOff, Images, Pencil, Plus, Save, Trash2, UtensilsCrossed } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardHeader } from '@/components/common/Card';
import { Badge } from '@/components/common/Badge';
import { Button } from '@/components/common/Button';
import { BlockError, EmptyState } from '@/components/common/EmptyState';
import { Field, ImageUpload, SearchInput, TextArea, TextInput, Toggle } from '@/components/common/Form';
import { ConfirmDialog, Modal } from '@/components/common/Modal';
import { Skeleton } from '@/components/common/Skeleton';
import { SettingRow, SettingsSaveBar, SettingsSection } from '@/components/common/SettingsParts';
import {
  addWebsiteFeature,
  addWebsitePhoto,
  deleteWebsiteFeature,
  deleteWebsitePhoto,
  getWebsiteContent,
  getWebsiteFeatures,
  getWebsiteGallery,
  getWebsiteMenu,
  moveWebsiteFeature,
  moveWebsitePhoto,
  setWebsiteCategoryVisible,
  setWebsiteDishVisible,
  updateWebsiteContent,
  updateWebsiteFeature,
  updateWebsitePhoto,
} from '@/api/website';
import { ps } from '@/features/public-site/queries';
import { useApiMutation } from '@/hooks/use-api-mutation';
import { useDraft } from '@/hooks/use-draft';
import { cn } from '@/lib/cn';
import { formatCurrency } from '@/lib/format';
import { formatDateTime } from '@/lib/labels';
import type { WebsiteContent, WebsiteContentInput, WebsiteFeature, WebsiteFeatureKind, WebsitePhoto } from '@/types';

/** Khóa query cấu hình website; lưu xong tải lại cả dữ liệu website công khai (nếu đang mở ở tab khác cùng trình duyệt). */
const wq = {
  content: ['website', 'content'] as const,
  gallery: ['website', 'gallery'] as const,
  menu: ['website', 'menu'] as const,
  features: (kind: WebsiteFeatureKind) => ['website', 'features', kind] as const,
};

/**
 * Cấu hình hệ thống → mục "Website" (trang chủ dài một trang, E1): mỗi cài đặt một dòng như các mục cấu hình khác.
 * Theo thứ tự các mục trên trang chủ: Đầu trang · Món đặc trưng · Trải nghiệm · Không gian (album) · Câu chuyện ·
 * Lời bếp trưởng · Đặt bàn · Mạng xã hội; cuối cùng là món hiện trên website. Mục nào để trống thì website ẩn mục đó.
 * Tên, logo, liên hệ, giờ mở cửa sửa ở mục Thông tin / Giờ hoạt động — website dùng chung dữ liệu đó.
 */
export function WebsiteSettings() {
  return (
    <div className="min-w-0 space-y-6">
      <div className="flex flex-col gap-3 rounded-[14px] border border-[var(--border)] bg-[var(--bg-surface)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <p className="text-[13px] text-[var(--text-secondary)]">
          Website lấy <b>tên, logo, địa chỉ, điện thoại, email</b> từ mục <b>Thông tin</b>, <b>giờ mở cửa</b> từ mục <b>Giờ hoạt động</b>,
          số tầng / bàn / chỗ ngồi từ <b>Sơ đồ bàn</b>. Mục nào để trống thì website ẩn mục đó.
        </p>
        <a href="/" target="_blank" rel="noopener noreferrer" className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-control border border-[var(--border)] px-3 text-[13.5px] font-semibold hover:bg-[var(--bg-hover)]">
          <ExternalLink size={15} /> Xem website
        </a>
      </div>
      <WebsiteContentForm />
    </div>
  );
}

/* =========================================================== Nội dung */

type ContentDraft = WebsiteContentInput;

function WebsiteContentForm() {
  const query = useQuery({ queryKey: wq.content, queryFn: getWebsiteContent });
  const d = useDraft(query.data, (c: WebsiteContent): ContentDraft => {
    const { updatedAt, ...rest } = c;
    void updatedAt;
    return rest;
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const mutation = useApiMutation(updateWebsiteContent, {
    invalidate: [wq.content, ps.all],
    success: 'Đã lưu nội dung website',
    onFieldErrors: setErrors,
    onSuccess: (c) => { d.commit(c); setErrors({}); },
  });

  if (query.isError) return <BlockError onRetry={() => void query.refetch()} retrying={query.isFetching} />;
  if (!d.draft) return <Skeleton className="h-[720px]" />;
  const form = d.draft;

  const set = (key: keyof ContentDraft, value: string | null) => {
    d.set({ [key]: value } as Partial<ContentDraft>);
    setErrors((p) => ({ ...p, [key]: '' }));
  };
  const text = (key: keyof ContentDraft, label: string, opts: { description?: string; placeholder?: string; max?: number; wide?: boolean } = {}) => (
    <SettingRow label={label} description={opts.description} htmlFor={`wc-${key}`} error={errors[key]}>
      <TextInput id={`wc-${key}`} value={(form[key] as string) ?? ''} placeholder={opts.placeholder} maxLength={opts.max}
        invalid={Boolean(errors[key])} onChange={(e) => set(key, e.target.value)} className={opts.wide ? 'w-full sm:w-[380px]' : 'w-full sm:w-[280px]'} />
    </SettingRow>
  );
  const image = (key: keyof ContentDraft, label: string, description: string, opts: { wide?: boolean; large?: boolean } = {}) => (
    <SettingRow stacked label={label} description={description} error={errors[key]}>
      <div className={opts.wide ? 'max-w-[420px]' : 'max-w-[200px]'}>
        <ImageUpload value={form[key] as string | null} onChange={(v) => set(key, v)} onError={(m) => setErrors((p) => ({ ...p, [key]: m }))}
          aspect={opts.wide ? 'wide' : 'square'} large={opts.large} label="Tải ảnh" />
      </div>
    </SettingRow>
  );

  return (
    <div className="space-y-6">
      <SettingsSection title="Đầu trang" description={query.data ? `Sửa lần cuối ${formatDateTime(query.data.updatedAt)}` : undefined}>
        {text('slogan', 'Khẩu hiệu', { description: 'Câu ngắn dưới tên quán, góc phải phía dưới ảnh đầu trang.', placeholder: 'Bò Úc thượng hạng – nướng đúng độ chín', max: 200, wide: true })}
        {text('award', 'Danh hiệu / giải thưởng', { description: 'Hiện nhỏ ở góc trái ảnh đầu trang. Để trống nếu không có.', placeholder: 'Michelin Selected 2026', max: 100 })}
        {image('heroImage', 'Ảnh đầu trang', 'Ảnh ngang toàn màn hình, tên quán chữ lớn nằm đè nửa trên — nên chọn ảnh có nửa trên tối. Để trống thì dùng ảnh bìa ở mục Thông tin.', { wide: true, large: true })}
      </SettingsSection>

      <FeatureSection kind="signature" />
      <FeatureSection kind="experience" />
      <GalleryCard />

      <SettingsSection title="Câu chuyện" description="Mục Câu chuyện của chúng tôi: nửa chữ, nửa ảnh. Đoạn đầu cũng hiện ở ảnh đầu trang.">
        {text('aboutTitle', 'Tiêu đề', { placeholder: 'Câu chuyện Royal Beef', max: 150, wide: true })}
        <SettingRow stacked label="Nội dung" description={`${form.aboutContent.length}/5000 · xuống dòng để sang đoạn mới.`} htmlFor="wc-aboutContent" error={errors.aboutContent}>
          <TextArea id="wc-aboutContent" rows={6} maxLength={5000} value={form.aboutContent} invalid={Boolean(errors.aboutContent)}
            onChange={(e) => set('aboutContent', e.target.value)} />
        </SettingRow>
        <SettingRow stacked label="Điểm nhấn" description="Mỗi dòng một điểm, tối đa 6 dòng. Hiện thành chữ in hoa nhỏ dưới đoạn văn." htmlFor="wc-aboutHighlights" error={errors.aboutHighlights}>
          <TextArea id="wc-aboutHighlights" rows={4} value={form.aboutHighlights} invalid={Boolean(errors.aboutHighlights)}
            placeholder={'Bò Úc nhập khẩu, ủ khô 21 ngày\nBếp mở – nướng than đá'} onChange={(e) => set('aboutHighlights', e.target.value)} />
        </SettingRow>
        {image('aboutImage', 'Ảnh', 'Ảnh dọc (4:5), ví dụ đầu bếp đang nướng ở bếp mở.')}
      </SettingsSection>

      <SettingsSection title="Lời từ bếp trưởng" description="Lá thư chữ viết tay kèm ảnh chân dung. Để trống lá thư thì website ẩn mục này.">
        {text('chefName', 'Tên người viết', { placeholder: 'Trần Minh Khôi', max: 80 })}
        {text('chefTitle', 'Chức danh', { placeholder: 'Bếp trưởng', max: 80 })}
        <SettingRow stacked label="Lá thư" description={`${form.chefLetter.length}/2000 · xuống dòng để sang đoạn mới. Dòng đầu nên là lời chào, vd. "Thực khách thân mến,".`} htmlFor="wc-chefLetter" error={errors.chefLetter}>
          <TextArea id="wc-chefLetter" rows={6} maxLength={2000} value={form.chefLetter} invalid={Boolean(errors.chefLetter)}
            onChange={(e) => set('chefLetter', e.target.value)} />
        </SettingRow>
        {image('chefImage', 'Ảnh chân dung', 'Ảnh dọc (3:4), nửa người.')}
      </SettingsSection>

      <SettingsSection title="Đặt bàn" description="Mục Đặt bàn cuối trang chủ: nửa ảnh, nửa form. Cách nhận đặt bàn chỉnh ở Đặt bàn → Cập nhật form.">
        {image('reserveImage', 'Ảnh cạnh form', 'Ảnh dọc (4:5), ví dụ phục vụ đang mang món ra bàn.')}
      </SettingsSection>

      <SettingsSection title="Mạng xã hội & bản đồ" description="Hiện ở chân trang. Để trống mục nào thì website không hiện mục đó.">
        {text('facebookUrl', 'Facebook', { placeholder: 'https://facebook.com/…', wide: true })}
        {text('instagramUrl', 'Instagram', { placeholder: 'https://instagram.com/…', wide: true })}
        {text('tiktokUrl', 'TikTok', { placeholder: 'https://tiktok.com/@…', wide: true })}
        {text('youtubeUrl', 'YouTube', { placeholder: 'https://youtube.com/@…', wide: true })}
        {text('zaloPhone', 'Số Zalo', { placeholder: '0912345678', max: 15 })}
        {text('mapUrl', 'Link Google Maps', { description: 'Dán link "Nhúng bản đồ" (…/maps/embed…) để hiện bản đồ nhỏ ở chân trang.', placeholder: 'https://maps.google.com/…', wide: true })}
      </SettingsSection>

      <MenuVisibilityCard />

      <SettingsSaveBar dirty={d.dirty} saving={mutation.isPending} errorCount={Object.values(errors).filter(Boolean).length}
        onSave={() => mutation.mutate(form)} onDiscard={() => { d.reset(); setErrors({}); }} />
    </div>
  );
}

/* =========================================================== Món đặc trưng / trải nghiệm */

const FEATURE_TEXT: Record<WebsiteFeatureKind, { title: string; description: string; empty: string; add: string; noun: string }> = {
  signature: {
    title: 'Món đặc trưng',
    description: 'Ảnh lớn toàn màn hình tự trượt, tên món chữ to ở giữa. Chưa có mục nào thì website dùng món bán chạy. Tối đa 8 mục.',
    empty: 'Chưa có món đặc trưng — website đang dùng món bán chạy',
    add: 'Thêm món đặc trưng',
    noun: 'món đặc trưng',
  },
  experience: {
    title: 'Trải nghiệm',
    description: 'Danh sách bên trái, ảnh bên phải đổi theo dòng đang chọn. Set menu tự lấy từ thực đơn, không cần nhập. Tối đa 8 mục.',
    empty: 'Chưa có trải nghiệm — website chỉ hiện Set menu',
    add: 'Thêm trải nghiệm',
    noun: 'trải nghiệm',
  },
};

function FeatureSection({ kind }: { kind: WebsiteFeatureKind }) {
  const t = FEATURE_TEXT[kind];
  const query = useQuery({ queryKey: wq.features(kind), queryFn: () => getWebsiteFeatures(kind) });
  const [editing, setEditing] = useState<WebsiteFeature | 'new' | null>(null);
  const [removing, setRemoving] = useState<WebsiteFeature | null>(null);
  const invalidate = [wq.features(kind), ps.site];
  const move = useApiMutation(moveWebsiteFeature, { invalidate });
  const toggle = useApiMutation(updateWebsiteFeature, { invalidate, success: (f) => (f.visible ? 'Đã hiện trên website' : 'Đã ẩn khỏi website') });
  const remove = useApiMutation(deleteWebsiteFeature, { invalidate, success: `Đã xóa ${t.noun}`, onSuccess: () => setRemoving(null) });
  const list = query.data ?? [];

  return (
    <SettingsSection
      title={t.title}
      description={t.description}
      action={<Button size="sm" variant="secondary" leadingIcon={<Plus size={15} />} onClick={() => setEditing('new')} disabled={!query.data || list.length >= 8}>{t.add}</Button>}
    >
      {query.isError ? (
        <div className="p-4"><BlockError onRetry={() => void query.refetch()} retrying={query.isFetching} /></div>
      ) : !query.data ? (
        <div className="p-4"><Skeleton className="h-[120px]" /></div>
      ) : !list.length ? (
        <p className="px-5 py-4 text-[13.5px] text-[var(--text-muted)]">{t.empty}</p>
      ) : (
        list.map((f, i) => (
          <div key={f.id} className={cn('flex items-center gap-3 px-4 py-3 sm:px-5', !f.visible && 'opacity-60')}>
            {f.image ? (
              <img src={f.image} alt="" className="h-12 w-[72px] shrink-0 rounded-md object-cover" loading="lazy" />
            ) : (
              <span className="flex h-12 w-[72px] shrink-0 items-center justify-center rounded-md bg-[var(--bg-subtle)] text-[11px] text-[var(--text-muted)]">Chưa có ảnh</span>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-[14px] font-medium">{f.title}{!f.visible ? <span className="ml-2 text-[12px] font-normal text-[var(--text-muted)]">(đang ẩn)</span> : null}</p>
              <p className="truncate text-[12.5px] text-[var(--text-muted)]">{[f.subtitle, f.description].filter(Boolean).join(' · ') || 'Chưa có mô tả'}</p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <IconBtn label="Lên trước" disabled={i === 0 || move.isPending} onClick={() => move.mutate({ id: f.id, direction: 'up' })}><ArrowUp size={14} /></IconBtn>
              <IconBtn label="Xuống sau" disabled={i === list.length - 1 || move.isPending} onClick={() => move.mutate({ id: f.id, direction: 'down' })}><ArrowDown size={14} /></IconBtn>
              <IconBtn label={f.visible ? 'Ẩn khỏi website' : 'Hiện trên website'} disabled={toggle.isPending}
                onClick={() => toggle.mutate({ id: f.id, kind: f.kind, title: f.title, subtitle: f.subtitle, description: f.description, image: f.image, visible: !f.visible })}>
                {f.visible ? <Eye size={14} /> : <EyeOff size={14} />}
              </IconBtn>
              <IconBtn label="Sửa" onClick={() => setEditing(f)}><Pencil size={14} /></IconBtn>
              <IconBtn label="Xóa" danger onClick={() => setRemoving(f)}><Trash2 size={14} /></IconBtn>
            </div>
          </div>
        ))
      )}
      {editing ? <FeatureDialog kind={kind} feature={editing === 'new' ? null : editing} onClose={() => setEditing(null)} /> : null}
      <ConfirmDialog
        open={Boolean(removing)}
        onOpenChange={(o) => !o && setRemoving(null)}
        title={`Xóa ${t.noun} "${removing?.title ?? ''}"?`}
        description="Mục và ảnh của mục bị xóa hẳn, không khôi phục được (trừ khi phục hồi bản sao lưu). Muốn tạm ẩn thì bấm biểu tượng con mắt."
        confirmLabel="Xóa"
        tone="danger"
        loading={remove.isPending}
        onConfirm={() => removing && remove.mutate(removing.id)}
      />
    </SettingsSection>
  );
}

function FeatureDialog({ kind, feature, onClose }: { kind: WebsiteFeatureKind; feature: WebsiteFeature | null; onClose: () => void }) {
  const t = FEATURE_TEXT[kind];
  const [form, setForm] = useState({
    title: feature?.title ?? '',
    subtitle: feature?.subtitle ?? '',
    description: feature?.description ?? '',
    image: feature?.image ?? null as string | null,
    visible: feature?.visible ?? true,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const options = { invalidate: [wq.features(kind), ps.site], onFieldErrors: setErrors, onSuccess: onClose };
  const add = useApiMutation(addWebsiteFeature, { ...options, success: `Đã thêm ${t.noun}` });
  const update = useApiMutation(updateWebsiteFeature, { ...options, success: 'Đã lưu' });
  const pending = add.isPending || update.isPending;
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((p) => ({ ...p, [k]: '' }));
  };

  const save = () => {
    if (!form.title.trim()) {
      setErrors({ title: 'Vui lòng nhập tên' });
      document.getElementById('wf-title')?.focus();
      return;
    }
    const input = { kind, ...form, title: form.title.trim(), subtitle: form.subtitle.trim(), description: form.description.trim() };
    if (feature) update.mutate({ id: feature.id, ...input });
    else add.mutate(input);
  };

  return (
    <Modal
      open
      onOpenChange={(o) => !o && onClose()}
      title={feature ? `Sửa ${t.noun}` : t.add}
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={pending}>Hủy</Button>
          <Button onClick={save} loading={pending} leadingIcon={<Save size={15} />}>{feature ? 'Lưu' : 'Thêm'}</Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label={kind === 'signature' ? 'Tên món' : 'Tên trải nghiệm'} htmlFor="wf-title" required error={errors.title} hint={`${form.title.length}/80`}>
          <TextInput id="wf-title" value={form.title} maxLength={80} invalid={Boolean(errors.title)}
            placeholder={kind === 'signature' ? 'Wagyu A5 sốt vang' : 'Tiệc sinh nhật'} onChange={(e) => set('title', e.target.value)} />
        </Field>
        {kind === 'signature' ? (
          <Field label="Dòng nhỏ phía trên tên" htmlFor="wf-subtitle" error={errors.subtitle} hint="Không bắt buộc, vd. nguồn gốc thịt hoặc số người ăn.">
            <TextInput id="wf-subtitle" value={form.subtitle} maxLength={120} invalid={Boolean(errors.subtitle)}
              placeholder="Bò Nhật Kagoshima" onChange={(e) => set('subtitle', e.target.value)} />
          </Field>
        ) : null}
        <Field label="Mô tả" htmlFor="wf-description" error={errors.description} hint={`${form.description.length}/500`}>
          <TextArea id="wf-description" rows={3} value={form.description} maxLength={500} invalid={Boolean(errors.description)}
            onChange={(e) => set('description', e.target.value)} />
        </Field>
        <div>
          <p className="mb-1 text-[13px] font-semibold">Ảnh</p>
          <p className="mb-2 text-[12.5px] text-[var(--text-muted)]">
            {kind === 'signature' ? 'Ảnh ngang toàn màn hình (16:9), giữa ảnh nên tối để tên món nổi rõ.' : 'Ảnh dọc (4:5).'} Ảnh lớn tự được thu nhỏ.
          </p>
          <div className="max-w-[420px]">
            <ImageUpload value={form.image} onChange={(v) => set('image', v)} error={errors.image} onError={(m) => setErrors((p) => ({ ...p, image: m }))}
              aspect="wide" large label="Chọn ảnh" />
          </div>
        </div>
        <label className="flex items-center justify-between gap-3 text-[14px]">
          <span>Hiện trên website</span>
          <Toggle checked={form.visible} onChange={(v) => set('visible', v)} label="Hiện trên website" />
        </label>
      </div>
    </Modal>
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
    <Card padded className="min-w-0">
      <CardHeader
        title="Không gian – album ảnh"
        icon={<Images size={17} />}
        description={`Ảnh toàn màn hình tự trượt ở mục Không gian, kèm số tầng / bàn / chỗ ngồi từ Sơ đồ bàn; chú thích hiện dưới số liệu.${query.data ? ` ${photos.length} ảnh · ${visible} đang hiện.` : ''}`}
        actions={<Button size="sm" leadingIcon={<Plus size={15} />} onClick={() => setEditing('new')} disabled={!query.data}>Thêm ảnh</Button>}
      />
      <div className="mt-4">
        {query.isError ? (
          <BlockError onRetry={() => void query.refetch()} retrying={query.isFetching} />
        ) : !query.data ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="aspect-square" />)}</div>
        ) : !photos.length ? (
          <EmptyState icon={Images} title="Album chưa có ảnh" description="Mục Không gian đang hiện nền tối kèm số liệu." action={<Button size="sm" onClick={() => setEditing('new')}>Thêm ảnh đầu tiên</Button>} />
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
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
            onError={(m) => setErrors((p) => ({ ...p, image: m }))} aspect="wide" large label="Chọn ảnh" />
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
