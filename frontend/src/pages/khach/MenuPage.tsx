import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CalendarCheck, SearchX, UtensilsCrossed } from 'lucide-react';
import { usePublicMenu } from '@/features/public-site/queries';
import { MenuItemCard, PageBanner, SiteEmpty, SiteError, SiteImage, SiteSkeleton, useSiteData } from '@/features/public-site/parts';
import { useDebounced } from '@/hooks/use-debounced';
import { cn } from '@/lib/cn';
import { SearchField } from '@/features/public-site/SearchField';
import { formatCurrency } from '@/lib/format';
import type { PublicMenuItem, PublicSetMenu } from '@/types';

const ALL = { keyword: '', categoryId: '' };

/**
 * Thực đơn công khai: lọc theo danh mục, tìm kiếm không dấu (máy chủ lọc — GET /api/public/site/menu).
 * Từ khóa và danh mục nằm trên địa chỉ (?q=…&danh-muc=…) để ô tìm kiếm ở thanh đầu trang và nút Quay lại hoạt động đúng.
 */
export default function MenuPage() {
  const { brand } = useSiteData();
  const [params, setParams] = useSearchParams();
  const urlKeyword = params.get('q') ?? '';
  const category = params.get('danh-muc') ?? '';
  const [keyword, setKeyword] = useState(urlKeyword);
  const debounced = useDebounced(keyword.trim(), 350);

  // Tìm từ thanh đầu trang khi đang ở trang này → cập nhật ô nhập (giữ nguyên khi chỉ khác khoảng trắng đang gõ dở).
  useEffect(() => {
    if (urlKeyword !== keyword.trim()) setKeyword(urlKeyword);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlKeyword]);
  useEffect(() => {
    if (debounced === urlKeyword) return;
    const next = new URLSearchParams(params);
    if (debounced) next.set('q', debounced);
    else next.delete('q');
    setParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);

  const base = usePublicMenu(ALL);
  const result = usePublicMenu({ keyword: urlKeyword, categoryId: category });
  const setCategory = (id: string) => {
    const next = new URLSearchParams(params);
    if (id) next.set('danh-muc', id);
    else next.delete('danh-muc');
    setParams(next, { replace: true });
  };

  const categories = base.data?.categories ?? [];
  const hasSets = (base.data?.sets.length ?? 0) > 0;
  const data = result.data;
  const noResult = data && !data.items.length && !data.sets.length;

  return (
    <>
      <PageBanner eyebrow="Thực đơn" title={`Thực đơn ${brand.name}`} subtitle="Món có thể thay đổi theo mùa và lượng hàng trong ngày. Tìm món không cần gõ dấu." />
      <section className="site-container py-10">
        <div className="sticky top-[var(--site-header-h)] z-30 -mx-4 space-y-3 bg-[var(--site-bg-glass)] px-4 py-3 backdrop-blur md:-mx-8 md:px-8">
          <SearchField
            id="menu-search"
            label="Tìm món"
            value={keyword}
            onChange={setKeyword}
            onClear={() => setKeyword('')}
            placeholder="Tìm món: bít tết, phở, lẩu…"
            maxLength={60}
            className="max-w-[520px]"
          />
          {categories.length ? (
            <div className="flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Lọc theo danh mục">
              <Chip active={!category} onClick={() => setCategory('')}>Tất cả</Chip>
              {categories.map((c) => (
                <Chip key={c.id} active={category === c.id} onClick={() => setCategory(c.id)}>{c.name}</Chip>
              ))}
              {hasSets ? <Chip active={category === 'set'} onClick={() => setCategory('set')}>Set menu</Chip> : null}
            </div>
          ) : null}
        </div>

        <div className={cn('mt-6 transition-opacity', result.isFetching && result.isPlaceholderData && 'opacity-60')} aria-live="polite">
          {result.isError ? (
            <SiteError onRetry={() => void result.refetch()} retrying={result.isFetching} />
          ) : !data ? (
            <div className="grid gap-4 md:grid-cols-2">
              {Array.from({ length: 6 }, (_, i) => <SiteSkeleton key={i} className="h-[136px]" />)}
            </div>
          ) : noResult ? (
            urlKeyword ? (
              <SiteEmpty
                icon={SearchX}
                title={`Không tìm thấy món phù hợp với "${urlKeyword}"`}
                description="Thử từ khóa khác (không cần gõ dấu) hoặc xem tất cả danh mục."
                action={<button type="button" className="site-btn site-btn-ghost" onClick={() => { setKeyword(''); setParams({}, { replace: true }); }}>Xem toàn bộ thực đơn</button>}
              />
            ) : (
              <SiteEmpty icon={UtensilsCrossed} title="Thực đơn đang được cập nhật" description="Vui lòng quay lại sau hoặc gọi nhà hàng để được tư vấn món." />
            )
          ) : (
            <div className="space-y-12">
              {urlKeyword ? (
                <p className="text-[14px] text-[var(--site-muted)]">
                  Tìm thấy {data.items.length + data.sets.length} mục cho "<span className="font-semibold text-[var(--site-text)]">{urlKeyword}</span>"
                </p>
              ) : null}
              {data.sets.length && category === 'set' ? <SetSection sets={data.sets} /> : null}
              {categories
                .map((c) => ({ c, items: data.items.filter((i) => i.categoryId === c.id) }))
                .filter((g) => g.items.length)
                .map(({ c, items }) => <CategorySection key={c.id} name={c.name} items={items} />)}
              {data.sets.length && category !== 'set' ? <SetSection sets={data.sets} /> : null}
            </div>
          )}
        </div>

        <div className="mt-16 flex flex-col items-center gap-4 rounded-3xl bg-[var(--site-primary-soft)] px-6 py-10 text-center">
          <p className="site-display text-[26px] font-semibold">Đã chọn được món yêu thích?</p>
          <p className="text-[15px] text-[var(--site-muted)]">Đặt bàn trước để nhà hàng chuẩn bị chỗ ngồi tốt nhất cho bạn.</p>
          <Link to="/dat-ban" className="site-btn site-btn-primary"><CalendarCheck size={17} aria-hidden /> Đặt bàn</Link>
        </div>
      </section>
    </>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        'shrink-0 rounded-full border px-4 py-2 text-[14px] font-medium transition-colors',
        active
          ? 'border-[var(--site-primary)] bg-[var(--site-primary)] text-white'
          : 'border-[var(--site-border)] bg-[var(--site-surface)] hover:border-[var(--site-primary)] hover:text-[var(--site-primary)]',
      )}
    >
      {children}
    </button>
  );
}

function CategorySection({ name, items }: { name: string; items: PublicMenuItem[] }) {
  return (
    <section aria-label={name}>
      <h2 className="site-display mb-4 text-[26px] font-semibold">{name}</h2>
      <div className="grid gap-4 md:grid-cols-2">
        {items.map((item) => <MenuItemCard key={item.id} item={item} />)}
      </div>
    </section>
  );
}

function SetSection({ sets }: { sets: PublicSetMenu[] }) {
  return (
    <section aria-label="Set menu">
      <h2 className="site-display mb-4 text-[26px] font-semibold">Set menu</h2>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {sets.map((s) => (
          <article key={s.id} className="overflow-hidden rounded-2xl border border-[var(--site-border)] bg-[var(--site-surface)]">
            <SiteImage src={s.image} alt={s.name} className="aspect-[16/10] w-full" />
            <div className="p-4">
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-[17px] font-semibold">{s.name}</h3>
                <div className="shrink-0 text-right">
                  <p className="text-[16px] font-bold text-[var(--site-primary)]">{formatCurrency(s.price)}</p>
                  {s.originalPrice > s.price ? <p className="text-[12.5px] text-[var(--site-muted)] line-through">{formatCurrency(s.originalPrice)}</p> : null}
                </div>
              </div>
              {s.description ? <p className="mt-1 text-[13.5px] text-[var(--site-muted)]">{s.description}</p> : null}
              <ul className="mt-3 space-y-1 text-[13.5px]">
                {s.items.map((i) => <li key={i}>• {i}</li>)}
              </ul>
              {s.sellFrom && s.sellTo ? <p className="mt-3 text-[12.5px] text-[var(--site-muted)]">Phục vụ {s.sellFrom.slice(0, 5)} – {s.sellTo.slice(0, 5)}</p> : null}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
