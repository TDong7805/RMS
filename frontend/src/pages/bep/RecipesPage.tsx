import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { BookOpen, Plus, Save, Search, Trash2 } from 'lucide-react';
import { getIngredientOptions, getRecipe, getRecipes, saveRecipe } from '@/api/payroll';
import { KitchenDialog, KitchenShell, kBtnGhost, kBtnPrimary, kInput } from '@/features/ordering/KitchenShell';
import { matchesKeyword } from '@/lib/normalize';
import { ValidationError } from '@/lib/mock';
import { cn } from '@/lib/cn';
import type { RecipeIngredientOption, Recipe } from '@/types';

interface Line {
  key: string;
  ingredientId: string;
  qty: string;
}

const money = (v: number) => `${Math.round(v).toLocaleString('vi-VN')} đ`;
const parseQty = (s: string) => Number(s.replace(',', '.'));
let seq = 0;
const newKey = () => `l${++seq}`;

/** UC-BEP-07: khai báo công thức định lượng cho một phần món (theo đơn vị kho của nguyên liệu). */
export default function RecipesPage() {
  const { dishId = '' } = useParams<{ dishId: string }>();
  const navigate = useNavigate();
  const list = useQuery({ queryKey: ['bep', 'recipes'], queryFn: getRecipes });
  const [keyword, setKeyword] = useState('');
  const [category, setCategory] = useState('');
  const [onlyMissing, setOnlyMissing] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [pendingNav, setPendingNav] = useState<string | null>(null);

  const dishes = useMemo(
    () =>
      (list.data?.dishes ?? [])
        .filter((d) => !keyword.trim() || matchesKeyword(d.name, keyword))
        .filter((d) => !category || d.categoryId === category)
        .filter((d) => !onlyMissing || d.ingredientCount === 0),
    [list.data, keyword, category, onlyMissing],
  );
  const missingCount = (list.data?.dishes ?? []).filter((d) => d.ingredientCount === 0).length;
  const go = (id: string) => (dirty && id !== dishId ? setPendingNav(id) : navigate(`/bep/cong-thuc/${id}`));

  return (
    <KitchenShell>
      <div className="mx-auto grid max-w-[1300px] gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
        <section className="flex min-h-0 flex-col rounded-xl border border-white/10 bg-[#151d1a] lg:h-[calc(100dvh-100px)]">
          <div className="space-y-2 border-b border-white/10 p-3">
            <h1 className="text-[18px] font-extrabold text-white">Công thức định lượng</h1>
            <label className={cn(kInput, 'flex items-center gap-2')}>
              <Search size={15} className="text-white/40" />
              <input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="Tìm món…" className="min-w-0 flex-1 bg-transparent outline-none" aria-label="Tìm món" />
            </label>
            <div className="flex gap-2">
              <select aria-label="Lọc danh mục" value={category} onChange={(e) => setCategory(e.target.value)} className={cn(kInput, 'min-w-0 flex-1')}>
                <option value="">Tất cả danh mục</option>
                {(list.data?.categories ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <button type="button" aria-pressed={onlyMissing} onClick={() => setOnlyMissing((v) => !v)} className={cn(kBtnGhost, onlyMissing && 'bg-[#f59e0b]/25 text-[#fbbf24]')}>
                Chưa có ({missingCount})
              </button>
            </div>
          </div>
          <ul className="min-h-0 flex-1 overflow-y-auto p-1.5">
            {!list.data ? (
              Array.from({ length: 8 }).map((_, i) => <li key={i} className="m-1 h-12 animate-pulse rounded-lg bg-white/5" />)
            ) : dishes.length === 0 ? (
              <li className="p-6 text-center text-[13.5px] text-white/50">Không có món phù hợp.</li>
            ) : (
              dishes.map((d) => (
                <li key={d.id}>
                  <button
                    type="button"
                    onClick={() => go(d.id)}
                    className={cn('flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left hover:bg-white/5', d.id === dishId && 'bg-white/10')}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14.5px] font-semibold text-white">{d.name}</span>
                      <span className="text-[12px] text-white/50">{d.categoryName}{d.status === 'stopped' ? ' · Ngừng bán' : ''}</span>
                    </span>
                    {d.ingredientCount ? (
                      <span className="shrink-0 rounded bg-[#10b981]/15 px-2 py-0.5 text-[12px] font-semibold text-[#34d399]">{d.ingredientCount} NL</span>
                    ) : (
                      <span className="shrink-0 rounded bg-[#f59e0b]/20 px-2 py-0.5 text-[11.5px] font-semibold text-[#fbbf24]">Chưa có công thức</span>
                    )}
                  </button>
                </li>
              ))
            )}
          </ul>
        </section>

        <section className="rounded-xl border border-white/10 bg-[#151d1a] p-4">
          {dishId ? (
            <RecipeEditor key={dishId} dishId={dishId} onDirty={setDirty} />
          ) : (
            <div className="grid h-full min-h-[300px] place-items-center text-center text-white/50">
              <div>
                <BookOpen size={40} className="mx-auto mb-3 text-white/25" />
                Chọn một món ở danh sách bên trái để xem / khai báo công thức.
              </div>
            </div>
          )}
        </section>
      </div>
      {pendingNav ? (
        <KitchenDialog
          title="Bỏ thay đổi?"
          onClose={() => setPendingNav(null)}
          footer={
            <>
              <button type="button" className={kBtnGhost} onClick={() => setPendingNav(null)}>Ở lại</button>
              <button
                type="button"
                className={kBtnPrimary}
                onClick={() => {
                  setDirty(false);
                  navigate(`/bep/cong-thuc/${pendingNav}`);
                  setPendingNav(null);
                }}
              >
                Bỏ thay đổi
              </button>
            </>
          }
        >
          Công thức đang sửa chưa được lưu. Các thay đổi sẽ mất.
        </KitchenDialog>
      ) : null}
    </KitchenShell>
  );
}

function toLines(r: Recipe): Line[] {
  return r.lines.map((l) => ({ key: newKey(), ingredientId: l.ingredientId, qty: String(l.qty) }));
}

function RecipeEditor({ dishId, onDirty }: { dishId: string; onDirty: (v: boolean) => void }) {
  const qc = useQueryClient();
  const recipe = useQuery({ queryKey: ['bep', 'recipe', dishId], queryFn: () => getRecipe(dishId), retry: false });
  const options = useQuery({ queryKey: ['bep', 'ingredient-options'], queryFn: getIngredientOptions, staleTime: 60_000 });
  const [lines, setLines] = useState<Line[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirmClear, setConfirmClear] = useState(false);
  const [original, setOriginal] = useState('');

  useEffect(() => {
    if (recipe.data) {
      const l = toLines(recipe.data);
      setLines(l);
      setOriginal(JSON.stringify(l.map(({ ingredientId, qty }) => [ingredientId, qty])));
      setErrors({});
    }
  }, [recipe.data]);
  const snapshot = JSON.stringify(lines.map(({ ingredientId, qty }) => [ingredientId, qty]));
  const dirty = Boolean(recipe.data) && snapshot !== original;
  useEffect(() => onDirty(dirty), [dirty, onDirty]);

  const byId = useMemo(() => {
    const m = new Map<string, RecipeIngredientOption & { inactive?: boolean }>();
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
      if (e instanceof ValidationError) setErrors(e.fields);
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
    setErrors(errs);
    if (Object.keys(errs).length) return;
    if (lines.length === 0 && (recipe.data?.lines.length ?? 0) > 0) setConfirmClear(true);
    else save.mutate();
  };

  if (recipe.isError) return <p className="py-16 text-center text-white/60">Không tìm thấy món.</p>;
  if (!recipe.data) return <div className="h-64 animate-pulse rounded-lg bg-white/5" />;
  const r = recipe.data;
  const set = (key: string, patch: Partial<Line>) => setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-[20px] font-extrabold text-white">{r.name}</h2>
          <p className="text-[13px] text-white/55">{r.categoryName} · giá bán {money(r.price)}{r.status === 'stopped' ? ' · Ngừng bán' : ''}</p>
        </div>
        <div className="flex gap-2">
          <button type="button" className={kBtnGhost} disabled={!dirty || save.isPending} onClick={() => { setLines(toLines(r)); setErrors({}); }}>Hủy thay đổi</button>
          <button type="button" className={kBtnPrimary} disabled={save.isPending || !dirty} onClick={submit}><Save size={15} />Lưu công thức</button>
        </div>
      </div>
      <p className="text-[12.5px] text-white/50">Định lượng cho <b className="text-white/80">một phần</b> món, theo đơn vị kho của nguyên liệu (ví dụ 0,08 kg).</p>

      <div className="overflow-x-auto rounded-lg border border-white/10">
        <table className="w-full min-w-[640px] text-[14px]">
          <thead className="bg-white/5 text-left text-[12.5px] text-white/60">
            <tr>
              <th className="px-3 py-2 font-semibold">Nguyên liệu</th>
              <th className="w-[150px] px-3 py-2 font-semibold">Định lượng / phần</th>
              <th className="w-[70px] px-3 py-2 font-semibold">Đơn vị</th>
              <th className="w-[130px] px-3 py-2 text-right font-semibold">Giá vốn ước tính</th>
              <th className="w-[44px]" />
            </tr>
          </thead>
          <tbody>
            {lines.length === 0 ? (
              <tr><td colSpan={5} className="px-3 py-6 text-center text-white/50">Chưa có nguyên liệu. Bấm “Thêm nguyên liệu”.</td></tr>
            ) : (
              lines.map((l, i) => {
                const o = byId.get(l.ingredientId);
                const eIng = errors[`lines.${i}.ingredientId`];
                const eQty = errors[`lines.${i}.qty`];
                return (
                  <tr key={l.key} className="border-t border-white/10 align-top">
                    <td className="px-3 py-2">
                      <select
                        aria-label={`Nguyên liệu dòng ${i + 1}`}
                        value={l.ingredientId}
                        onChange={(e) => set(l.key, { ingredientId: e.target.value })}
                        className={cn(kInput, 'w-full', eIng && 'border-[#f87171]')}
                      >
                        <option value="">Chọn nguyên liệu…</option>
                        {o?.inactive ? <option value={o.id}>{o.name} (ngừng sử dụng)</option> : null}
                        {(options.data ?? []).map((x) => (
                          <option key={x.id} value={x.id} disabled={x.id !== l.ingredientId && lines.some((y) => y.ingredientId === x.id)}>
                            {x.name} ({x.unit})
                          </option>
                        ))}
                      </select>
                      {eIng ? <p className="mt-1 text-[12px] text-[#f87171]">{eIng}</p> : null}
                    </td>
                    <td className="px-3 py-2">
                      <input
                        aria-label={`Định lượng dòng ${i + 1}`}
                        value={l.qty}
                        inputMode="decimal"
                        onChange={(e) => set(l.key, { qty: e.target.value.replace(/[^\d.,]/g, '') })}
                        className={cn(kInput, 'w-full font-mono', eQty && 'border-[#f87171]')}
                      />
                      {eQty ? <p className="mt-1 text-[12px] text-[#f87171]">{eQty}</p> : null}
                    </td>
                    <td className="px-3 py-2 pt-3.5 text-white/70">{o?.unit ?? '—'}</td>
                    <td className="px-3 py-2 pt-3.5 text-right font-mono text-white/80">{o?.avgCost == null ? '—' : money(lineCost(l))}</td>
                    <td className="px-1 py-2">
                      <button type="button" aria-label={`Bỏ dòng ${i + 1}`} onClick={() => setLines((prev) => prev.filter((x) => x.key !== l.key))} className="grid h-9 w-9 place-items-center rounded-lg text-white/60 hover:bg-white/10 hover:text-[#f87171]">
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button type="button" className={kBtnGhost} onClick={() => setLines((prev) => [...prev, { key: newKey(), ingredientId: '', qty: '' }])}>
          <Plus size={15} />Thêm nguyên liệu
        </button>
        <div className="text-right text-[14px]">
          <p>Giá vốn ước tính / phần: <b className="font-mono text-[18px] text-[#34d399]">{money(total)}</b></p>
          <p className="text-[12.5px] text-white/55">
            {r.price > 0 ? `${((total / r.price) * 100).toLocaleString('vi-VN', { maximumFractionDigits: 1 })}% giá bán` : ''} · tham khảo theo giá vốn bình quân hiện tại
          </p>
        </div>
      </div>
      {confirmClear ? (
        <KitchenDialog
          title="Xóa công thức?"
          onClose={() => setConfirmClear(false)}
          footer={
            <>
              <button type="button" className={kBtnGhost} onClick={() => setConfirmClear(false)}>Hủy</button>
              <button type="button" className={cn(kBtnPrimary, 'bg-[#ef4444] text-white hover:bg-[#f87171]')} disabled={save.isPending} onClick={() => save.mutate()}>Xóa công thức</button>
            </>
          }
        >
          Món <b className="text-white">{r.name}</b> sẽ trở về “Chưa có công thức” và không còn ước tính được số phần.
        </KitchenDialog>
      ) : null}
    </div>
  );
}
