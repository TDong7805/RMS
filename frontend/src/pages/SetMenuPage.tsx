import { Fragment, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, Pause, Play, Plus, Soup, Trash2 } from 'lucide-react';
import { Card } from '@/components/common/Card';
import { Badge } from '@/components/common/Badge';
import { Button } from '@/components/common/Button';
import { BlockError, EmptyState } from '@/components/common/EmptyState';
import { SearchInput } from '@/components/common/Form';
import { ConfirmDialog } from '@/components/common/Modal';
import { DataTable, TableSkeleton, Td, Th, Toolbar } from '@/components/common/PageParts';
import { RowActions } from '@/components/common/RowActions';
import { DishThumb } from '@/features/dishes/DishParts';
import { MenuLayout } from '@/features/dishes/MenuLayout';
import { deleteCombo, saveCombo } from '@/api/chatbot';
import { qk, useChatbotMenu, useCombos } from '@/features/management/queries';
import { useApiMutation } from '@/hooks/use-api-mutation';
import { cn } from '@/lib/cn';
import { formatCurrency } from '@/lib/format';
import { matchesKeyword } from '@/lib/normalize';
import type { Combo, ComboInput } from '@/types';

const comboInput = (c: Combo, patch: Partial<ComboInput> = {}): ComboInput => ({
  name: c.name, description: c.description, note: c.note, active: c.active, price: c.price, image: c.image, onMenu: c.onMenu,
  sellFrom: c.sellFrom?.slice(0, 5) ?? null, sellTo: c.sellTo?.slice(0, 5) ?? null, items: c.items.map((i) => ({ ...i })), ...patch,
});

function SetStatus({ c }: { c: Combo }) {
  if (!c.active) return <Badge variant="neutral">Đang tắt</Badge>;
  return c.onMenu ? <Badge variant="accent">Trên thực đơn</Badge> : <Badge variant="info">Chỉ AI gợi ý</Badge>;
}

/**
 * Thực đơn › tab Set menu (mục B8): danh sách đồng bộ với tab Món ăn — ảnh nhỏ · tên · "n món" (bấm mở xem món) ·
 * giá set / giá gốc / -x% · giờ bán · trạng thái · Sửa / ⋯. Thêm / sửa set ở trang riêng.
 */
export function SetMenuPage() {
  const navigate = useNavigate();
  const combos = useCombos();
  const menu = useChatbotMenu();
  const dishById = useMemo(() => new Map((menu.data?.dishes ?? []).map((d) => [d.id, d])), [menu.data]);
  const [keyword, setKeyword] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [toDelete, setToDelete] = useState<Combo | null>(null);

  const rows = (combos.data ?? []).filter((c) => matchesKeyword(c.name, keyword));
  const toggleOpen = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const setActive = useApiMutation((c: Combo) => saveCombo(c.id, comboInput(c, { active: !c.active })), {
    invalidate: [[...qk.chatbot, 'combos']],
    success: (c) => `${c.name}: ${c.active ? 'đã bật' : 'đã tắt'}`,
  });
  const del = useApiMutation((c: Combo) => deleteCombo(c.id), {
    invalidate: [[...qk.chatbot, 'combos']],
    success: (_r, c) => `Đã xóa ${c.name}`,
    onSuccess: () => setToDelete(null),
  });

  return (
    <MenuLayout
      tab="sets"
      action={<Button leadingIcon={<Plus size={15} />} onClick={() => navigate('/quan-ly/mon-an/set-menu/them')}>Thêm set</Button>}
    >
      <Card className="overflow-hidden">
        <Toolbar>
          <SearchInput value={keyword} onChange={setKeyword} placeholder="Tìm set…" className="w-full sm:w-[280px]" />
        </Toolbar>
        {combos.isError ? (
          <div className="p-5"><BlockError message="Không tải được danh sách set" onRetry={() => void combos.refetch()} /></div>
        ) : combos.isLoading || !combos.data ? (
          <TableSkeleton cols={5} />
        ) : !rows.length ? (
          <div className="p-5">
            <EmptyState icon={Soup} title={keyword ? 'Không có set phù hợp' : 'Chưa có set nào'} description={keyword ? 'Thử từ khóa khác.' : 'Set bán nhiều món với giá trọn gói. Bắt đầu bằng nút “Thêm set”.'} />
          </div>
        ) : (
          <DataTable minWidth={900}>
            <thead>
              <tr>
                <Th>Set</Th>
                <Th className="text-right">Giá</Th>
                <Th>Giờ bán</Th>
                <Th>Trạng thái</Th>
                <Th className="text-right"><span className="sr-only">Thao tác</span></Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => {
                const open = expanded.has(c.id);
                const count = c.items.reduce((s, i) => s + i.qty, 0);
                const off = c.price != null && c.originalPrice > c.price ? Math.round(((c.originalPrice - c.price) * 100) / c.originalPrice) : 0;
                return (
                  <Fragment key={c.id}>
                    <tr className="hover:bg-[var(--bg-subtle)]">
                      <Td>
                        <div className="flex min-w-0 items-center gap-3">
                          <DishThumb dish={{ image: c.image ?? '', name: c.name }} />
                          <span className="min-w-0">
                            <span className="block truncate font-semibold">{c.name}</span>
                            <button
                              type="button"
                              onClick={() => toggleOpen(c.id)}
                              aria-expanded={open}
                              className="mt-0.5 inline-flex items-center gap-1 text-[12px] font-medium text-[var(--accent)] hover:underline"
                            >
                              {count} món
                              <ChevronDown size={13} className={cn('transition-transform', open && 'rotate-180')} />
                            </button>
                          </span>
                        </div>
                      </Td>
                      <Td className="text-right">
                        {c.price != null ? (
                          <span className="inline-flex flex-col items-end">
                            <span className="font-mono font-semibold">{formatCurrency(c.price)}</span>
                            {off > 0 ? (
                              <span className="flex items-center gap-1.5 text-[12px]">
                                <span className="font-mono text-[var(--text-muted)] line-through">{formatCurrency(c.originalPrice)}</span>
                                <span className="font-semibold text-[var(--success)]">-{off}%</span>
                              </span>
                            ) : null}
                          </span>
                        ) : (
                          <span className="text-[13px] text-[var(--text-muted)]">Chưa có giá</span>
                        )}
                      </Td>
                      <Td className="text-[13px]">{c.sellFrom ? `${c.sellFrom.slice(0, 5)}–${c.sellTo?.slice(0, 5)}` : <span className="text-[var(--text-muted)]">Cả ngày</span>}</Td>
                      <Td><SetStatus c={c} /></Td>
                      <Td className="text-right">
                        <RowActions
                          name={c.name}
                          onPrimary={() => navigate(`/quan-ly/mon-an/set-menu/${c.id}/sua`)}
                          items={[
                            c.active
                              ? { label: 'Tắt set', icon: <Pause size={15} />, onSelect: () => setActive.mutate(c), disabled: setActive.isPending }
                              : { label: 'Bật lại set', icon: <Play size={15} />, onSelect: () => setActive.mutate(c), disabled: setActive.isPending },
                            { label: 'Xóa set', icon: <Trash2 size={15} />, danger: true, onSelect: () => setToDelete(c) },
                          ]}
                        />
                      </Td>
                    </tr>
                    {open ? (
                      <tr className="bg-[var(--bg-subtle)]/60">
                        <td colSpan={5} className="px-4 pb-3 pt-1 sm:pl-[76px]">
                          <ul className="grid gap-x-6 gap-y-1 text-[13px] sm:grid-cols-2 lg:grid-cols-3">
                            {c.items.map((it) => {
                              const d = dishById.get(it.dishId);
                              return (
                                <li key={it.dishId} className="flex min-w-0 items-baseline justify-between gap-2">
                                  <span className={cn('truncate', d?.status !== 'selling' && 'text-[var(--danger)]')}>
                                    {d?.name ?? 'Món đã xóa'}
                                    {it.allowVariant ? <span className="text-[var(--text-muted)]"> (đổi loại được)</span> : null}
                                    {d && d.status !== 'selling' ? ' · ngừng bán' : null}
                                  </span>
                                  <span className="shrink-0 font-mono text-[var(--text-muted)]">×{it.qty}</span>
                                </li>
                              );
                            })}
                          </ul>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })}
            </tbody>
          </DataTable>
        )}
      </Card>
      <p className="text-[12.5px] text-[var(--text-muted)]">Set có món ngừng bán, tạm hết hoặc ngoài giờ bán sẽ tự ẩn khỏi thực đơn của khách.</p>

      <ConfirmDialog
        open={Boolean(toDelete)}
        onOpenChange={(o) => !o && setToDelete(null)}
        title={`Xóa “${toDelete?.name ?? ''}”?`}
        description="Set sẽ không còn trên thực đơn và trợ lý AI không gợi ý nữa. Hóa đơn cũ có set này vẫn giữ nguyên."
        confirmLabel="Xóa set"
        loading={del.isPending}
        onConfirm={() => toDelete && del.mutate(toDelete)}
      />
    </MenuLayout>
  );
}

export default SetMenuPage;
