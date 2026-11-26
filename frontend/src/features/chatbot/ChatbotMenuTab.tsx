import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as Popover from '@radix-ui/react-popover';
import { AlertTriangle, RefreshCw, Tags } from 'lucide-react';
import { Card, CardHeader } from '@/components/common/Card';
import { Badge } from '@/components/common/Badge';
import { Button } from '@/components/common/Button';
import { BlockError, EmptyState } from '@/components/common/EmptyState';
import { ChipSelect, SearchInput, Toggle } from '@/components/common/Form';
import { DataTable, TableSkeleton, Td, Th } from '@/components/common/PageParts';
import { syncChatbotMenu, updateDishAi } from '@/api/chatbot';
import { qk, useAiTags, useCategories, useChatbotMenu, useCombos } from '@/features/management/queries';
import { useApiMutation } from '@/hooks/use-api-mutation';
import { formatCurrency } from '@/lib/format';
import { formatDateTime } from '@/lib/labels';
import { matchesKeyword } from '@/lib/normalize';
import type { Dish } from '@/types';

/** Luồng B — Quản lý thực đơn cho AI: đồng bộ món, combo gợi ý, gắn thẻ phân loại. */
export function ChatbotMenuTab() {
  const menu = useChatbotMenu();
  const combosQuery = useCombos();
  const { data: categories = [] } = useCategories();
  const [keyword, setKeyword] = useState('');
  const navigate = useNavigate();

  const dishes = useMemo(() => menu.data?.dishes ?? [], [menu.data]);
  const catName = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories]);
  const filtered = dishes.filter((d) => matchesKeyword(d.name, keyword));
  const sync = menu.data?.lastSync;

  const syncMutation = useApiMutation(() => syncChatbotMenu(), {
    invalidate: [qk.chatbot, qk.dishes],
    success: (r) => `Đã cập nhật: ${r.enabled}/${r.total} món được AI gợi ý`,
  });
  const aiMutation = useApiMutation((v: { id: string; aiEnabled?: boolean; aiTags?: string[] }) => updateDishAi(v.id, v), {
    invalidate: [[...qk.chatbot, 'menu'], qk.dishes],
  });

  return (
    <div className="space-y-4">
      <Card padded>
        <CardHeader
          title="Thực đơn cho trợ lý AI"
          description="Lấy dữ liệu món, giá, thành phần, dị nguyên từ Thực đơn. Món “Ngừng bán” tự động bị loại khỏi gợi ý."
          actions={<Button leadingIcon={<RefreshCw size={15} />} loading={syncMutation.isPending} onClick={() => syncMutation.mutate(undefined)}>Cập nhật ngay</Button>}
        />
        {sync ? (
          <div className="mt-3 space-y-2">
            <p className="text-[13px] text-[var(--text-secondary)]">
              Cập nhật lần cuối <span className="font-mono">{formatDateTime(sync.syncedAt)}</span> · <b>{sync.enabled}</b>/{sync.total} món được AI gợi ý
            </p>
            {sync.missingData.length ? (
              <div className="rounded-item bg-[var(--warning-soft)] px-3 py-2.5 text-[12.5px] text-[var(--warning)]">
                <p className="flex items-center gap-1.5 font-semibold"><AlertTriangle size={14} /> {sync.missingData.length} món thiếu dữ liệu — AI sẽ trả lời “chưa có thông tin xác nhận”:</p>
                <p className="mt-1">{sync.missingData.map((m) => `${m.name} (thiếu ${m.missing.join(', ')})`).join('; ')}</p>
              </div>
            ) : null}
          </div>
        ) : (
          <p className="mt-3 text-[13px] text-[var(--text-muted)]">Chưa cập nhật trong lần mở trang này.</p>
        )}
      </Card>

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] px-4 py-3 sm:px-5">
          <div>
            <p className="text-[15px] font-semibold">Món & thẻ phân loại cho AI</p>
            <p className="text-[12.5px] text-[var(--text-muted)]">Thẻ giúp AI lọc món theo nhu cầu (ít cay, chay, cho nhóm…).</p>
          </div>
          <SearchInput value={keyword} onChange={setKeyword} placeholder="Tìm món…" className="w-full sm:w-[240px]" />
        </div>
        {menu.isError ? (
          <div className="p-5"><BlockError onRetry={() => void menu.refetch()} /></div>
        ) : menu.isLoading ? (
          <TableSkeleton cols={5} />
        ) : (
          <DataTable minWidth={820}>
            <thead>
              <tr>
                <Th>Món</Th>
                <Th>Danh mục</Th>
                <Th className="text-right">Giá</Th>
                <Th>Thẻ AI</Th>
                <Th className="text-right">AI gợi ý</Th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((d) => (
                <tr key={d.id} className="hover:bg-[var(--bg-subtle)]">
                  <Td>
                    <p className="font-semibold">{d.name}</p>
                    <p className="text-[12px] text-[var(--text-muted)]">
                      {d.status === 'stopped' ? 'Ngừng bán' : d.ingredients ? `${d.allergens.length} dị nguyên khai báo` : <span className="text-[var(--warning)]">Thiếu thành phần</span>}
                    </p>
                  </Td>
                  <Td>{catName.get(d.categoryId) ?? '—'}</Td>
                  <Td className="text-right font-mono">{formatCurrency(d.price)}</Td>
                  <Td><TagEditor dish={d} onSave={(tags) => aiMutation.mutate({ id: d.id, aiTags: tags })} /></Td>
                  <Td className="text-right">
                    <Toggle checked={d.aiEnabled} disabled={d.status === 'stopped'} label={`AI gợi ý ${d.name}`} onChange={(v) => aiMutation.mutate({ id: d.id, aiEnabled: v })} />
                  </Td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        )}
      </Card>

      <Card padded>
        <CardHeader
          title="Set menu (AI gợi ý)"
          description="Chatbot gợi ý các set đang bật theo số người / nhu cầu. Thêm, sửa set ở Thực đơn → Set menu."
          actions={<Button size="sm" variant="outline" onClick={() => navigate('/quan-ly/mon-an/set-menu')}>Quản lý set</Button>}
        />
        {combosQuery.isLoading ? (
          <TableSkeleton rows={2} />
        ) : !combosQuery.data?.length ? (
          <EmptyState className="mt-3" title="Chưa có set nào" />
        ) : (
          <ul className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {combosQuery.data.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-2 rounded-item border border-[var(--border)] px-3 py-2 text-[13px]">
                <span className="min-w-0">
                  <span className="block truncate font-semibold">{c.name}</span>
                  <span className="block truncate text-[12px] text-[var(--text-muted)]">{c.note || '—'}</span>
                </span>
                {!c.active ? <Badge variant="neutral">Tắt</Badge> : c.price != null ? <span className="shrink-0 font-mono">{formatCurrency(c.price)}</span> : null}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function TagEditor({ dish, onSave }: { dish: Dish; onSave: (tags: string[]) => void }) {
  const { data: tagOptions = [] } = useAiTags();
  const [open, setOpen] = useState(false);
  const [tags, setTags] = useState(dish.aiTags);
  useEffect(() => {
    if (open) setTags(dish.aiTags);
  }, [open, dish.aiTags]);

  return (
    <div className="flex flex-wrap items-center gap-1">
      {dish.aiTags.map((t) => <Badge key={t} variant="info">{t}</Badge>)}
      <Popover.Root open={open} onOpenChange={setOpen}>
        <Popover.Trigger asChild>
          <button type="button" aria-label={`Gắn thẻ cho ${dish.name}`} className="grid h-6 w-6 place-items-center rounded-full text-[var(--text-muted)] hover:bg-[var(--bg-subtle)] hover:text-[var(--accent)]">
            <Tags size={13} />
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content align="start" sideOffset={6} className="z-[80] w-[320px] rounded-item border border-[var(--border)] bg-[var(--bg-surface)] p-3 shadow-overlay">
            <p className="mb-2 text-[13px] font-semibold">Thẻ phân loại – {dish.name}</p>
            <ChipSelect ariaLabel="Chọn thẻ" options={tagOptions} value={tags} onChange={setTags} />
            <div className="mt-3 flex justify-end gap-1.5">
              <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Hủy</Button>
              <Button size="sm" onClick={() => { onSave(tags); setOpen(false); }}>Lưu thẻ</Button>
            </div>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </div>
  );
}
