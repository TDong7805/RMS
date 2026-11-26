import { useEffect, useMemo, useRef, useState } from 'react';
import { useBlocker, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { BookOpen, ChevronDown, Plus, Save, Search, Trash2 } from 'lucide-react';
import { getIngredientOptions, getRecipe, getRecipes, saveRecipe } from '@/api/payroll';
import { KitchenDialog, KitchenShell, kBtnGhost, kBtnPrimary, kInput } from '@/features/ordering/KitchenShell';
import { matchesKeyword } from '@/lib/normalize';
import { ValidationError } from '@/lib/mock';
import { cn } from '@/lib/cn';
import type { Recipe, RecipeDishRow, RecipeIngredientOption } from '@/types';

interface Line {
  key: string;
  ingredientId: string;
  qty: string;
}
type Has = 'all' | 'missing' | 'done';
type Option = RecipeIngredientOption & { inactive?: boolean };

const money = (v: number) => `${Math.round(v).toLocaleString('vi-VN')} đ`;
const pct = (v: number) => `${v.toLocaleString('vi-VN', { maximumFractionDigits: 1 })}%`;
const parseQty = (s: string) => Number(s.replace(',', '.'));
let seq = 0;
const newKey = () => `l${++seq}`;

/** Màu nhãn % giá vốn / giá bán: ≤ 35% tốt, ≤ 45% cần để ý, cao hơn là lãi mỏng. */
const costTone = (p: number) =>
  p <= 35 ? 'bg-[var(--k-brand-soft)] text-[var(--k-brand)]' : p <= 45 ? 'bg-[var(--k-cook-soft)] text-[var(--k-cook)]' : 'bg-[var(--k-danger-soft)] text-[var(--k-danger)]';

/**
 * UC-BEP-07: khai báo công thức định lượng cho một phần món (theo đơn vị kho của nguyên liệu) — D14:
 * trái danh sách món (tìm, lọc Chưa có / Đã có, nhãn % giá vốn), phải bảng định lượng; thanh dính đáy giá vốn / phần · % giá bán · Lưu.
 */
export default function RecipesPage() {
  const { dishId = '' } = useParams<{ dishId: string }>();
  const navigate = useNavigate();
  const list = useQuery({ queryKey: ['bep', 'recipes'], queryFn: getRecipes });
  const [keyword, setKeyword] = useState('');
  const [category, setCategory] = useState('');
  const [has, setHas] = useState<Has>('all');
  const [dirty, setDirty] = useState(false);

  // Rời trang / đổi món khi công thức chưa lưu → hỏi (cả nút ☰, Về màn bếp, nút Back của trình duyệt).
  const blocker = useBlocker(({ currentLocation, nextLocation }) => dirty && currentLocation.pathname !== nextLocation.pathname);
  useEffect(() => {
    if (!dirty) return;
    const onUnload = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', onUnload);
    return () => window.removeEventListener('beforeunload', onUnload);
  }, [dirty]);

  const all = list.data?.dishes ?? [];
  const base = all.filter((d) => (!keyword.trim() || matchesKeyword(d.name, keyword)) && (!category || d.categoryId === category));
  const dishes = base.filter((d) => has === 'all' || (has === 'missing' ? d.ingredientCount === 0 : d.ingredientCount > 0));
  const count = (h: Has) => base.filter((d) => h === 'all' || (h === 'missing' ? d.ingredientCount === 0 : d.ingredientCount > 0)).length;

  return (
    <KitchenShell title="Công thức định lượng">
      <div className="mx-auto grid max-w-[1400px] gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
        <section className="flex min-h-0 flex-col rounded-xl border border-[var(--k-line)] bg-[var(--k-surface)] lg:h-[calc(100dvh-96px)]">
          <div className="space-y-2 border-b border-[var(--k-line)] p-3">
            <label className={cn(kInput, 'flex items-center gap-2')}>
              <Search size={15} className="text-[var(--k-muted)]" />
              <input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="Tìm món…" className="min-w-0 flex-1 bg-transparent outline-none" aria-label="Tìm món" />
            </label>
            <select aria-label="Lọc danh mục" value={category} onChange={(e) => setCategory(e.target.value)} className={cn(kInput, 'w-full')}>
              <option value="">Tất cả danh mục</option>
              {(list.data?.categories ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <div className="grid grid-cols-3 gap-0.5 rounded-lg bg-[var(--k-fill)] p-0.5 text-[13.5px] font-semibold" role="tablist" aria-label="Lọc công thức">
              {([['all', 'Tất cả'], ['missing', 'Chưa có'], ['done', 'Đã có']] as [Has, string][]).map(([h, label]) => (
                <button key={h} type="button" role="tab" aria-selected={has === h} onClick={() => setHas(h)} className={cn('rounded-md px-2 py-1.5', has === h ? 'bg-[var(--k-surface)] shadow-sm' : 'text-[var(--k-muted)]')}>
                  {label} <b className="font-mono">{count(h)}</b>
                </button>
              ))}
            </div>
          </div>
          <ul className="min-h-0 flex-1 overflow-y-auto p-1.5">
            {!list.data ? (
              Array.from({ length: 8 }).map((_, i) => <li key={i} className="m-1 h-12 animate-pulse rounded-lg bg-[var(--k-fill)]" />)
            ) : dishes.length === 0 ? (
              <li className="p-6 text-center text-[13.5px] text-[var(--k-muted)]">Không có món phù hợp.</li>
            ) : (
              dishes.map((d) => <DishRow key={d.id} dish={d} active={d.id === dishId} onClick={() => navigate(`/bep/cong-thuc/${d.id}`)} />)
            )}
          </ul>
        </section>

        <section className="flex min-h-[420px] flex-col rounded-xl border border-[var(--k-line)] bg-[var(--k-surface)] lg:h-[calc(100dvh-96px)]">
          {dishId ? (
            <RecipeEditor key={dishId} dishId={dishId} onDirty={setDirty} />
          ) : (
            <div className="grid flex-1 place-items-center p-6 text-center text-[var(--k-muted)]">
              <div>
                <BookOpen size={40} className="mx-auto mb-3 opacity-60" />
                Chọn một món ở danh sách bên trái để xem / khai báo công thức.
              </div>
            </div>
          )}
        </section>
      </div>
      {blocker.state === 'blocked' ? (
        <KitchenDialog
          title="Bỏ các thay đổi chưa lưu?"
          onClose={() => blocker.reset()}
          footer={<>
            <button type="button" className={kBtnGhost} onClick={() => blocker.reset()}>Ở lại</button>
            <button type="button" className={cn(kBtnPrimary, 'bg-[var(--k-danger)] text-white hover:bg-[var(--k-danger)]')} onClick={() => { setDirty(false); blocker.proceed(); }}>Bỏ thay đổi</button>
          </>}
        >
          Công thức đang sửa chưa được lưu. Rời đi thì các thay đổi sẽ mất.
        </KitchenDialog>
      ) : null}
    </KitchenShell>
  );
}

function DishRow({ dish: d, active, onClick }: { dish: RecipeDishRow; active: boolean; onClick: () => void }) {
  const p = d.price > 0 ? (d.cost / d.price) * 100 : null;
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        aria-current={active ? 'true' : undefined}
        className={cn('flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left hover:bg-[var(--k-fill)]', active && 'bg-[var(--k-fill-2)]')}
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14.5px] font-semibold text-[var(--k-text)]">{d.name}</span>
          <span className="text-[12px] text-[var(--k-muted)]">{d.categoryName}{d.ingredientCount ? ` · ${d.ingredientCount} nguyên liệu` : ''}{d.status === 'stopped' ? ' · Ngừng bán' : ''}</span>
        </span>
        {!d.ingredientCount ? (
          <span className="shrink-0 rounded bg-[var(--k-fill-2)] px-2 py-0.5 text-[12px] font-semibold text-[var(--k-muted)]">Chưa có</span>
        ) : p === null || d.cost <= 0 ? (
          <span className="shrink-0 rounded bg-[var(--k-fill-2)] px-2 py-0.5 text-[12px] text-[var(--k-muted)]" title="Nguyên liệu chưa có giá vốn">—</span>
        ) : (
          <span className={cn('shrink-0 rounded px-2 py-0.5 font-mono text-[12.5px] font-bold', costTone(p))} title={`Giá vốn ${money(d.cost)} / giá bán ${money(d.price)}`}>{pct(p)}</span>
        )}
      </button>
    </li>
  );
}

function toLines(r: Recipe): Line[] {
  return r.lines.map((l) => ({ key: newKey(), ingredientId: l.ingredientId, qty: String(l.qty).replace('.', ',') }));
}
const snap = (lines: Line[]) => JSON.stringify(lines.map(({ ingredientId, qty }) => [ingredientId, qty.replace(',', '.')]));

function RecipeEditor({ dishId, onDirty }: { dishId: string; onDirty: (v: boolean) => void }) {
  const qc = useQueryClient();
  const recipe = useQuery({ queryKey: ['bep', 'recipe', dishId], queryFn: () => getRecipe(dishId), retry: false });
  const options = useQuery({ queryKey: ['bep', 'ingredient-options'], queryFn: getIngredientOptions, staleTime: 60_000 });
  const [lines, setLines] = useState<Line[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirmClear, setConfirmClear] = useState(false);
  const [original, setOriginal] = useState('');
  const tableRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (recipe.data) {
      const l = toLines(recipe.data);
      setLines(l);
      setOriginal(snap(l));
      setErrors({});
    }
  }, [recipe.data]);
  const dirty = Boolean(recipe.data) && snap(lines) !== original;
  useEffect(() => onDirty(dirty), [dirty, onDirty]);

  const byId = useMemo(() => {
    const m = new Map<string, Option>();
    (options.data ?? []).forEach((o) => m.set(o.id, o));
    // Nguyên liệu đã ngừng sử dụng nhưng còn trong công thức cũ.
    (recipe.data?.lines ?? []).filter((l) => !l.active).forEach((l) => m.set(l.ingredientId, { id: l.ingredientId, code: l.code, name: l.name, unit: l.unit, avgCost: l.avgCost, stock: 0, inactive: true }));
    return m;
  }, [options.data, recipe.data]);

  const lineCost = (l: Line) => {
    const o = byId.get(l.ingredientId);
    const q = parseQty(l.qty);
    return o?.avgCost && q > 0 ? q * o.avgCost : 0;
  };
  const total = lines.reduce((s, l) => s + lineCost(l), 0);

  /** Cuộn tới dòng lỗi đầu tiên và đặt con trỏ vào ô lỗi. */
  const showErrors = (errs: Record<string, string>) => {
    setErrors(errs);
    const first = Object.keys(errs).map((k) => /^lines\.(\d+)\.(\w+)$/.exec(k)).filter(Boolean).sort((a, b) => Number(a![1]) - Number(b![1]))[0];
    if (!first) return;
    requestAnimationFrame(() => {
      const row = tableRef.current?.querySelector<HTMLElement>(`[data-line="${first[1]}"]`);
      row?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      row?.querySelector<HTMLElement>(`[data-field="${first[2]}"]`)?.focus({ preventScroll: true });
    });
  };

  const save = useMutation({
    mutationFn: () => saveRecipe(dishId, lines.map((l) => ({ ingredientId: l.ingredientId, qty: parseQty(l.qty) }))),
    onSuccess: (r) => {
      toast.success(`Đã lưu công thức ${r.name}`);
      qc.setQueryData(['bep', 'recipe', dishId], r);
      void qc.invalidateQueries({ queryKey: ['bep', 'recipes'] });
      void qc.invalidateQueries({ queryKey: ['bep', 'stock-check'] });
      setConfirmClear(false);
    },
    onError: (e) => {
      setConfirmClear(false);
      if (e instanceof ValidationError) showErrors(e.fields);
      else toast.error(e instanceof Error ? e.message : 'Không lưu được công thức');
    },
  });
  const submit = () => {
    // Kiểm tra nhanh ở giao diện (máy chủ kiểm tra lại).
    const errs: Record<string, string> = {};
    const seen = new Set<string>();
    lines.forEach((l, i) => {
      if (!l.ingredientId) errs[`lines.${i}.ingredientId`] = 'Vui lòng chọn nguyên liệu';
      else if (seen.has(l.ingredientId)) errs[`lines.${i}.ingredientId`] = 'Nguyên liệu bị chọn trùng';
      seen.add(l.ingredientId);
      const q = parseQty(l.qty);
      if (!l.qty.trim() || !Number.isFinite(q) || q <= 0) errs[`lines.${i}.qty`] = 'Định lượng phải lớn hơn 0';
      else if (!/^\d+([.,]\d{1,3})?$/.test(l.qty.trim())) errs[`lines.${i}.qty`] = 'Tối đa 3 chữ số thập phân';
    });
    if (Object.keys(errs).length) return showErrors(errs);
    setErrors({});
    if (lines.length === 0 && (recipe.data?.lines.length ?? 0) > 0) setConfirmClear(true);
    else save.mutate();
  };

  if (recipe.isError) return <p className="py-16 text-center text-[var(--k-muted)]">Không tìm thấy món.</p>;
  if (!recipe.data) return <div className="m-4 h-64 animate-pulse rounded-lg bg-[var(--k-fill)]" />;
  const r = recipe.data;
  const set = (key: string, patch: Partial<Line>) => setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const errCount = Object.keys(errors).length;
  const ratio = r.price > 0 ? (total / r.price) * 100 : null;
  const addLine = () => {
    setLines((prev) => [...prev, { key: newKey(), ingredientId: '', qty: '' }]);
    requestAnimationFrame(() => tableRef.current?.querySelector<HTMLElement>('[data-line]:last-child [data-field="ingredientId"]')?.focus());
  };

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--k-line)] px-4 py-3">
        <div className="min-w-0">
          <h2 className="truncate text-[20px] font-extrabold text-[var(--k-text)]">{r.name}</h2>
          <p className="text-[13px] text-[var(--k-muted)]">{r.categoryName} · giá bán {money(r.price)}{r.status === 'stopped' ? ' · Ngừng bán' : ''}</p>
        </div>
        <button type="button" className={kBtnGhost} onClick={addLine}><Plus size={15} />Thêm nguyên liệu</button>
      </div>

      <div ref={tableRef} data-scroll className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        <p className="mb-2 text-[12.5px] text-[var(--k-muted)]">Định lượng cho <b className="text-[var(--k-text)]">một phần</b> món, theo đơn vị kho của nguyên liệu (ví dụ 0,08 kg).</p>
        <div className="rounded-lg border border-[var(--k-line)]">
          <table className="w-full text-[14px]">
            <thead className="bg-[var(--k-fill)] text-left text-[12.5px] text-[var(--k-muted)]">
              <tr>
                <th className="px-3 py-2 font-semibold">Nguyên liệu</th>
                <th className="w-[190px] px-3 py-2 font-semibold">Định lượng / phần</th>
                <th className="w-[120px] px-3 py-2 text-right font-semibold">Giá vốn</th>
                <th className="w-[48px]" />
              </tr>
            </thead>
            <tbody>
              {lines.length === 0 ? (
                <tr><td colSpan={4} className="px-3 py-8 text-center text-[var(--k-muted)]">Chưa có nguyên liệu. Bấm “Thêm nguyên liệu”.</td></tr>
              ) : (
                lines.map((l, i) => {
                  const o = byId.get(l.ingredientId);
                  const eIng = errors[`lines.${i}.ingredientId`];
                  const eQty = errors[`lines.${i}.qty`];
                  return (
                    <tr key={l.key} data-line={i} className={cn('border-t border-[var(--k-line)] align-top', (eIng || eQty) && 'bg-[var(--k-danger-soft)]')}>
                      <td className="px-3 py-2">
                        <IngredientPicker
                          label={`Nguyên liệu dòng ${i + 1}`}
                          value={l.ingredientId}
                          selected={o}
                          options={options.data ?? []}
                          used={new Set(lines.filter((y) => y.key !== l.key).map((y) => y.ingredientId))}
                          invalid={Boolean(eIng)}
                          onChange={(id) => set(l.key, { ingredientId: id })}
                        />
                        {eIng ? <p className="mt-1 text-[12px] font-semibold text-[var(--k-danger)]">{eIng}</p> : null}
                      </td>
                      <td className="px-3 py-2">
                        <div className={cn(kInput, 'flex items-center gap-2 py-0 pr-2', eQty && 'border-[var(--k-danger)]')}>
                          <input
                            data-field="qty"
                            aria-label={`Định lượng dòng ${i + 1}`}
                            value={l.qty}
                            inputMode="decimal"
                            placeholder="0"
                            onChange={(e) => set(l.key, { qty: e.target.value.replace(/[^\d.,]/g, '') })}
                            className="min-w-0 flex-1 bg-transparent py-1.5 font-mono outline-none"
                          />
                          <span className="shrink-0 rounded bg-[var(--k-fill-2)] px-1.5 text-[12.5px] font-semibold text-[var(--k-muted)]">{o?.unit ?? 'đơn vị'}</span>
                        </div>
                        {eQty ? <p className="mt-1 text-[12px] font-semibold text-[var(--k-danger)]">{eQty}</p> : null}
                      </td>
                      <td className="px-3 py-2 pt-3.5 text-right font-mono text-[var(--k-text)]">{o?.avgCost == null ? '—' : money(lineCost(l))}</td>
                      <td className="px-1 py-2">
                        <button type="button" aria-label={`Bỏ dòng ${i + 1}`} onClick={() => setLines((prev) => prev.filter((x) => x.key !== l.key))} className="grid h-9 w-9 place-items-center rounded-lg text-[var(--k-muted)] hover:bg-[var(--k-fill-2)] hover:text-[var(--k-danger)]">
                          <Trash2 size={15} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {lines.length ? (
          <button type="button" className={cn(kBtnGhost, 'mt-2')} onClick={addLine}><Plus size={15} />Thêm nguyên liệu</button>
        ) : null}
      </div>

      {/* Thanh dính đáy: giá vốn / phần · % giá bán · Hủy thay đổi · Lưu */}
      <div className="sticky bottom-0 flex flex-wrap items-center gap-3 rounded-b-xl border-t border-[var(--k-line)] bg-[var(--k-surface-2)] px-4 py-2.5">
        <div className="min-w-0 flex-1 text-[14px]">
          <p>
            Giá vốn / phần <b className="font-mono text-[18px] text-[var(--k-text)]">{money(total)}</b>
            {ratio !== null && total > 0 ? <span className={cn('ml-2 rounded px-1.5 py-0.5 font-mono text-[13px] font-bold', costTone(ratio))}>{pct(ratio)} giá bán</span> : null}
          </p>
          <p className={cn('text-[12.5px]', errCount ? 'font-semibold text-[var(--k-danger)]' : 'text-[var(--k-muted)]')}>
            {errCount ? `Còn ${errCount} chỗ chưa đúng` : dirty ? 'Có thay đổi chưa lưu' : 'Chưa có thay đổi'} · tham khảo theo giá vốn bình quân hiện tại
          </p>
        </div>
        <button type="button" className={kBtnGhost} disabled={!dirty || save.isPending} onClick={() => { setLines(toLines(r)); setErrors({}); }}>Hủy thay đổi</button>
        <button type="button" className={cn(kBtnPrimary, 'px-5 py-2.5 text-[15px]')} disabled={save.isPending || !dirty} onClick={submit}><Save size={16} />Lưu công thức</button>
      </div>

      {confirmClear ? (
        <KitchenDialog
          title="Xóa công thức?"
          onClose={() => setConfirmClear(false)}
          footer={<>
            <button type="button" className={kBtnGhost} onClick={() => setConfirmClear(false)}>Hủy</button>
            <button type="button" className={cn(kBtnPrimary, 'bg-[var(--k-danger)] text-white hover:bg-[var(--k-danger)]')} disabled={save.isPending} onClick={() => save.mutate()}>Xóa công thức</button>
          </>}
        >
          Món <b className="text-[var(--k-text)]">{r.name}</b> sẽ trở về “Chưa có công thức” và không còn ước tính được số phần.
        </KitchenDialog>
      ) : null}
    </>
  );
}

/** Ô chọn nguyên liệu có tìm kiếm (theo tên / mã): hiện đơn vị, tồn kho; nguyên liệu đã có ở dòng khác bị mờ. */
function IngredientPicker({ label, value, selected, options, used, invalid, onChange }: {
  label: string; value: string; selected: Option | undefined; options: Option[]; used: Set<string>; invalid: boolean; onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [hi, setHi] = useState(0);
  const [up, setUp] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const shown = useMemo(
    () => options.filter((o) => !text.trim() || matchesKeyword(o.name, text) || o.code.toLowerCase().includes(text.trim().toLowerCase())).slice(0, 60),
    [options, text],
  );
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (!boxRef.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);
  useEffect(() => { listRef.current?.querySelector(`[data-i="${hi}"]`)?.scrollIntoView({ block: 'nearest' }); }, [hi]);
  /** Mở danh sách: thiếu chỗ phía dưới (trong khung cuộn) thì mở lên trên. */
  const openList = () => {
    if (!open) {
      const box = boxRef.current?.getBoundingClientRect();
      const frame = boxRef.current?.closest('[data-scroll]')?.getBoundingClientRect();
      if (box && frame) setUp(frame.bottom - box.bottom < 270 && box.top - frame.top > frame.bottom - box.bottom);
      setText('');
      setHi(0);
    }
    setOpen(true);
  };
  const pick = (o: Option) => {
    if (used.has(o.id)) return;
    onChange(o.id);
    setOpen(false);
    setText('');
  };
  const qtyStr = (v: number) => v.toLocaleString('vi-VN', { maximumFractionDigits: 3 });
  return (
    <div ref={boxRef} className="relative">
      <div className={cn(kInput, 'flex items-center gap-2 py-0 pr-2', invalid && 'border-[var(--k-danger)]', open && 'border-[var(--k-brand)]')}>
        <input
          data-field="ingredientId"
          role="combobox"
          aria-label={label}
          aria-expanded={open}
          value={open ? text : selected ? `${selected.name}${selected.inactive ? ' (ngừng sử dụng)' : ''}` : ''}
          placeholder={open && selected ? selected.name : 'Gõ tên hoặc mã nguyên liệu…'}
          onMouseDown={openList}
          onChange={(e) => { openList(); setText(e.target.value); setHi(0); }}
          onBlur={() => setOpen(false)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') { e.preventDefault(); if (!open) openList(); else setHi((h) => Math.min(h + 1, shown.length - 1)); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); setHi((h) => Math.max(h - 1, 0)); }
            else if (e.key === 'Enter' && open && shown[hi]) { e.preventDefault(); pick(shown[hi]); }
            else if (e.key === 'Escape') setOpen(false);
          }}
          className="min-w-0 flex-1 bg-transparent py-1.5 outline-none placeholder:text-[var(--k-muted)]"
        />
        <ChevronDown size={15} className="shrink-0 text-[var(--k-muted)]" />
      </div>
      {open ? (
        <ul ref={listRef} role="listbox" aria-label={label} className={cn('absolute left-0 right-0 z-30 max-h-[260px]', up ? 'bottom-full mb-1' : 'top-full mt-1', ' overflow-y-auto rounded-lg border border-[var(--k-line)] bg-[var(--k-surface)] p-1 shadow-xl')}>
          {shown.length === 0 ? <li className="px-3 py-3 text-center text-[13px] text-[var(--k-muted)]">Không có nguyên liệu khớp “{text}”</li> : null}
          {shown.map((o, i) => {
            const taken = used.has(o.id);
            return (
              <li
                key={o.id}
                data-i={i}
                role="option"
                aria-selected={o.id === value}
                aria-disabled={taken}
                onMouseDown={(e) => { e.preventDefault(); pick(o); }}
                onMouseEnter={() => setHi(i)}
                className={cn('flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-1.5', i === hi && !taken && 'bg-[var(--k-fill)]', o.id === value && 'font-bold', taken && 'cursor-not-allowed opacity-45')}
              >
                <span className="min-w-0 flex-1 truncate">{o.name} <span className="font-mono text-[11.5px] text-[var(--k-muted)]">{o.code}</span></span>
                <span className="shrink-0 text-[12px] text-[var(--k-muted)]">{taken ? 'đã có ở dòng khác' : `tồn ${qtyStr(o.stock)} ${o.unit}`}</span>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
