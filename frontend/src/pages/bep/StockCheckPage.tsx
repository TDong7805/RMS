import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { RefreshCw, Search } from 'lucide-react';
import { getStockCheck } from '@/api/payroll';
import { KITCHEN_STREAM, setDishSoldOut } from '@/api/ordering';
import { KitchenShell, kBtnGhost, kInput } from '@/features/ordering/KitchenShell';
import { useLiveEvents } from '@/features/ordering/live';
import { matchesKeyword } from '@/lib/normalize';
import { cn } from '@/lib/cn';
import type { DishStock } from '@/types';

type View = 'dish' | 'ingredient';
type Level = '' | 'ok' | 'low' | 'out';

const LEVEL = {
  ok: { label: 'Đủ hàng', cls: 'bg-[var(--k-brand-soft)] text-[var(--k-brand)]' },
  low: { label: 'Sắp hết', cls: 'bg-[var(--k-cook-soft)] text-[var(--k-cook)]' },
  out: { label: 'Hết hàng', cls: 'bg-[var(--k-danger-soft)] text-[var(--k-danger)]' },
} as const;

/** Mức của một món theo số phần còn làm được: 0 = hết, ≤ 5 = sắp hết. */
const dishLevel = (d: DishStock): Exclude<Level, ''> | null => (d.portions === null ? null : d.portions === 0 ? 'out' : d.portions <= 5 ? 'low' : 'ok');
const qty = (v: number) => v.toLocaleString('vi-VN', { maximumFractionDigits: 3 });

/** UC-BEP-06: kiểm tra nguyên liệu — số phần còn làm được theo công thức, tồn kho từng nguyên liệu (chỉ đọc). */
export default function StockCheckPage() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['bep', 'stock-check'], queryFn: getStockCheck, refetchInterval: 60_000 });
  useLiveEvents(KITCHEN_STREAM, [['bep', 'stock-check']]);
  const [view, setView] = useState<View>('dish');
  const [keyword, setKeyword] = useState('');
  const [level, setLevel] = useState<Level>('');
  const [category, setCategory] = useState('');

  const soldOut = useMutation({
    mutationFn: (d: DishStock) => setDishSoldOut(d.id, true),
    onSuccess: (_, d) => {
      toast.success(`Đã đánh dấu tạm hết ${d.name}`);
      void qc.invalidateQueries({ queryKey: ['bep'] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Không lưu được'),
  });

  const dishes = useMemo(
    () =>
      (q.data?.dishes ?? [])
        .filter((d) => !keyword.trim() || matchesKeyword(d.name, keyword))
        .filter((d) => !category || d.categoryId === category)
        .filter((d) => !level || dishLevel(d) === level),
    [q.data, keyword, category, level],
  );
  const ingredients = useMemo(
    () => (q.data?.ingredients ?? []).filter((i) => !keyword.trim() || matchesKeyword(i.name, keyword)).filter((i) => !level || i.level === level),
    [q.data, keyword, level],
  );

  return (
    <KitchenShell
      actions={
        <button type="button" className={kBtnGhost} onClick={() => void q.refetch()} disabled={q.isFetching}>
          <RefreshCw size={15} className={q.isFetching ? 'animate-spin' : ''} />Làm mới
        </button>
      }
    >
      <div className="mx-auto max-w-[1200px] space-y-4">
        <div>
          <h1 className="text-[22px] font-extrabold text-[var(--k-text)]">Kiểm tra nguyên liệu</h1>
          <p className="text-[13.5px] text-[var(--k-muted)]">Tồn kho lấy từ phân hệ Kho. Số phần ước tính = tồn ÷ định lượng một phần (theo nguyên liệu thiếu nhất). Bán món không tự trừ kho.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg bg-[var(--k-fill-2)] p-0.5 text-[14px] font-semibold" role="tablist" aria-label="Cách xem">
            <button type="button" role="tab" aria-selected={view === 'dish'} onClick={() => setView('dish')} className={cn('rounded-md px-3 py-1.5', view === 'dish' && 'bg-[var(--k-invert-bg)] text-[var(--k-invert-text)]')}>Theo món</button>
            <button type="button" role="tab" aria-selected={view === 'ingredient'} onClick={() => setView('ingredient')} className={cn('rounded-md px-3 py-1.5', view === 'ingredient' && 'bg-[var(--k-invert-bg)] text-[var(--k-invert-text)]')}>Theo nguyên liệu</button>
          </div>
          <label className={cn(kInput, 'flex items-center gap-2')}>
            <Search size={15} className="text-[var(--k-muted)]" />
            <input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder={view === 'dish' ? 'Tìm món…' : 'Tìm nguyên liệu…'} className="w-[180px] bg-transparent outline-none" aria-label="Tìm" />
          </label>
          {view === 'dish' ? (
            <select aria-label="Lọc danh mục" value={category} onChange={(e) => setCategory(e.target.value)} className={kInput}>
              <option value="">Tất cả danh mục</option>
              {(q.data?.categories ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          ) : null}
          <select aria-label="Lọc tình trạng" value={level} onChange={(e) => setLevel(e.target.value as Level)} className={kInput}>
            <option value="">Mọi tình trạng</option>
            <option value="ok">Đủ hàng</option>
            <option value="low">Sắp hết</option>
            <option value="out">Hết hàng</option>
          </select>
        </div>

        {q.isError ? (
          <p className="py-16 text-center text-[var(--k-muted)]">Không tải được dữ liệu. <button type="button" className="underline" onClick={() => void q.refetch()}>Thử lại</button></p>
        ) : !q.data ? (
          <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-16 animate-pulse rounded-xl bg-[var(--k-fill)]" />)}</div>
        ) : view === 'dish' ? (
          dishes.length === 0 ? (
            <p className="py-16 text-center text-[var(--k-muted)]">Không có món phù hợp.</p>
          ) : (
            <ul className="grid gap-2 md:grid-cols-2">
              {dishes.map((d) => {
                const lv = dishLevel(d);
                return (
                  <li key={d.id} className="flex items-center gap-3 rounded-xl border border-[var(--k-line)] bg-[var(--k-surface)] p-3">
                    <div className={cn('grid h-14 w-16 shrink-0 place-items-center rounded-lg text-center', lv ? LEVEL[lv].cls : 'bg-[var(--k-fill)] text-[var(--k-muted)]')}>
                      {d.portions === null ? <span className="text-[11px] font-semibold leading-tight">Chưa có<br />công thức</span> : (
                        <span><b className="block font-mono text-[22px] leading-none">{d.portions >= 99999 ? '∞' : d.portions}</b><span className="text-[11px]">phần</span></span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[15.5px] font-bold text-[var(--k-text)]">
                        {d.name}
                        {d.soldOut ? <span className="ml-2 rounded bg-[var(--k-danger-soft)] px-1.5 text-[11.5px] font-semibold text-[var(--k-danger)]">Tạm hết hôm nay</span> : null}
                        {!d.selling ? <span className="ml-2 rounded bg-[var(--k-fill-2)] px-1.5 text-[11.5px] text-[var(--k-muted)]">Ngừng bán</span> : null}
                      </p>
                      <p className="text-[12.5px] text-[var(--k-muted)]">{d.categoryName}</p>
                      {d.hasRecipe ? (
                        <p className="truncate text-[12.5px] text-[var(--k-muted)]">Giới hạn bởi: {d.limiting.join(', ')}</p>
                      ) : (
                        <Link to={`/bep/cong-thuc/${d.id}`} className="text-[12.5px] text-[var(--k-brand)] hover:underline">Khai báo công thức →</Link>
                      )}
                    </div>
                    {d.portions === 0 && !d.soldOut && d.selling ? (
                      <button type="button" className="shrink-0 rounded-lg bg-[var(--k-danger-soft)] px-3 py-1.5 text-[13px] font-semibold text-[var(--k-danger)] hover:bg-[var(--k-danger-soft)]" disabled={soldOut.isPending} onClick={() => soldOut.mutate(d)}>
                        Đánh dấu tạm hết
                      </button>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )
        ) : ingredients.length === 0 ? (
          <p className="py-16 text-center text-[var(--k-muted)]">Không có nguyên liệu phù hợp.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-[var(--k-line)]">
            <table className="w-full min-w-[760px] text-[14px]">
              <thead className="bg-[var(--k-fill)] text-left text-[12.5px] text-[var(--k-muted)]">
                <tr>
                  <th className="px-3 py-2 font-semibold">Nguyên liệu</th>
                  <th className="px-3 py-2 text-right font-semibold">Tồn hiện tại</th>
                  <th className="px-3 py-2 text-right font-semibold">Tồn tối thiểu</th>
                  <th className="px-3 py-2 font-semibold">Tình trạng</th>
                  <th className="px-3 py-2 font-semibold">Món dùng nguyên liệu</th>
                </tr>
              </thead>
              <tbody>
                {ingredients.map((i) => (
                  <tr key={i.id} className="border-t border-[var(--k-line)]">
                    <td className="px-3 py-2"><b className="text-[var(--k-text)]">{i.name}</b> <span className="font-mono text-[12px] text-[var(--k-muted)]">{i.code}</span></td>
                    <td className="px-3 py-2 text-right font-mono">{qty(i.stock)} {i.unit}</td>
                    <td className="px-3 py-2 text-right font-mono text-[var(--k-muted)]">{qty(i.minLevel)} {i.unit}</td>
                    <td className="px-3 py-2"><span className={cn('rounded px-2 py-0.5 text-[12.5px] font-semibold', LEVEL[i.level].cls)}>{LEVEL[i.level].label}</span></td>
                    <td className="px-3 py-2 text-[13px] text-[var(--k-muted)]">{i.dishes.length ? i.dishes.join(', ') : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </KitchenShell>
  );
}
