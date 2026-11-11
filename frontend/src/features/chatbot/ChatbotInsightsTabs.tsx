import { useEffect, useState } from 'react';
import { Bot, MessagesSquare, ShoppingCart, User } from 'lucide-react';
import { Card, CardHeader } from '@/components/common/Card';
import { Badge } from '@/components/common/Badge';
import { Button } from '@/components/common/Button';
import { BlockError, EmptyState } from '@/components/common/EmptyState';
import { SearchInput, SelectInput, TextInput } from '@/components/common/Form';
import { Modal } from '@/components/common/Modal';
import { DataTable, Pagination, StatTile, TableSkeleton, Td, Th, Toolbar } from '@/components/common/PageParts';
import { Skeleton } from '@/components/common/Skeleton';
import { CONVERSATION_PAGE_SIZE } from '@/api/chatbot';
import { useChatbotStats, useConversations } from '@/features/management/queries';
import { useDebounced } from '@/hooks/use-debounced';
import { cn } from '@/lib/cn';
import { formatTime } from '@/lib/format';
import { CONVERSATION_STATUS, formatDateTime } from '@/lib/labels';
import type { Conversation, ConversationStatus } from '@/types';

/* =========================================================== Luồng D — Lịch sử hội thoại */

export function ChatbotHistoryTab() {
  const [keyword, setKeyword] = useState('');
  const [date, setDate] = useState('');
  const [status, setStatus] = useState<ConversationStatus | 'all'>('all');
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<Conversation | null>(null);
  const debounced = useDebounced(keyword);
  const list = useConversations({ keyword: debounced, date, status, page });
  useEffect(() => setPage(1), [debounced, date, status]);

  return (
    <Card className="overflow-hidden">
      <Toolbar>
        <SearchInput value={keyword} onChange={setKeyword} placeholder="Tìm theo nội dung, mã bàn…" className="w-full sm:w-[280px]" />
        <TextInput type="date" aria-label="Lọc theo ngày" value={date} onChange={(e) => setDate(e.target.value)} className="w-full sm:w-[160px]" />
        <SelectInput
          aria-label="Lọc theo trạng thái"
          value={status === 'all' ? '' : status}
          onChange={(e) => setStatus((e.target.value || 'all') as ConversationStatus | 'all')}
          placeholder="Mọi trạng thái"
          options={(Object.keys(CONVERSATION_STATUS) as ConversationStatus[]).map((s) => ({ value: s, label: CONVERSATION_STATUS[s].label }))}
          className="w-full sm:w-[180px]"
        />
      </Toolbar>
      {list.isError ? (
        <div className="p-5"><BlockError onRetry={() => void list.refetch()} /></div>
      ) : list.isLoading || !list.data ? (
        <TableSkeleton cols={5} />
      ) : list.data.items.length === 0 ? (
        <div className="p-5"><EmptyState icon={MessagesSquare} title="Không tìm thấy cuộc hội thoại" /></div>
      ) : (
        <>
          <DataTable minWidth={760}>
            <thead>
              <tr>
                <Th>Thời gian</Th>
                <Th>Bàn</Th>
                <Th>Câu hỏi đầu tiên</Th>
                <Th className="text-right">Tin nhắn</Th>
                <Th>Kết quả</Th>
                <Th className="text-right" />
              </tr>
            </thead>
            <tbody>
              {list.data.items.map((c) => (
                <tr key={c.id} className="hover:bg-[var(--bg-subtle)]">
                  <Td className="whitespace-nowrap font-mono text-[12.5px]">{formatDateTime(c.startedAt)}</Td>
                  <Td className="font-mono font-semibold">{c.tableCode}</Td>
                  <Td className="max-w-[320px] truncate">{c.messages[0]?.text}</Td>
                  <Td className="text-right font-mono">{c.messages.length}</Td>
                  <Td>
                    <div className="flex flex-wrap items-center gap-1">
                      <Badge variant={CONVERSATION_STATUS[c.status].variant}>{CONVERSATION_STATUS[c.status].label}</Badge>
                      {c.addedToCart.length ? <Badge variant="accent" icon={<ShoppingCart size={11} />}>{c.addedToCart.length}</Badge> : null}
                    </div>
                  </Td>
                  <Td className="text-right"><Button size="sm" variant="ghost" onClick={() => setOpen(c)}>Xem</Button></Td>
                </tr>
              ))}
            </tbody>
          </DataTable>
          <Pagination page={list.data.page} pageCount={list.data.pageCount} total={list.data.total} pageSize={CONVERSATION_PAGE_SIZE} onChange={setPage} unit="hội thoại" />
        </>
      )}

      <Modal open={Boolean(open)} onOpenChange={(o) => !o && setOpen(null)} size="md" title={open ? `Hội thoại tại bàn ${open.tableCode}` : ''} description={open ? formatDateTime(open.startedAt) : undefined}>
        {open ? (
          <div className="space-y-2.5">
            {open.messages.map((m, i) => (
              <div key={i} className={cn('flex gap-2', m.from === 'customer' && 'flex-row-reverse')}>
                <span className={cn('grid h-7 w-7 shrink-0 place-items-center rounded-full', m.from === 'bot' ? 'bg-[var(--accent-soft)] text-[var(--accent)]' : 'bg-[var(--bg-subtle)] text-[var(--text-muted)]')}>
                  {m.from === 'bot' ? <Bot size={14} /> : <User size={14} />}
                </span>
                <div className={cn('max-w-[80%] rounded-[14px] px-3 py-2 text-[13px] leading-5', m.from === 'bot' ? 'rounded-tl-[4px] bg-[var(--bg-subtle)]' : 'rounded-tr-[4px] bg-[var(--accent)] text-[var(--accent-contrast)]')}>
                  {m.text}
                  <span className="mt-0.5 block font-mono text-[10.5px] opacity-70">{formatTime(m.at)}</span>
                </div>
              </div>
            ))}
            {open.addedToCart.length ? (
              <p className="rounded-[10px] bg-[var(--accent-soft)] px-3 py-2 text-[12.5px] text-[var(--accent)]">
                Khách đã xác nhận thêm vào giỏ: {open.addedToCart.join(', ')}
              </p>
            ) : null}
          </div>
        ) : null}
      </Modal>
    </Card>
  );
}

/* =========================================================== Luồng E — Thống kê & báo cáo */

const pct = (v: number) => `${v.toFixed(1).replace('.', ',')}%`;

export function ChatbotStatsTab() {
  const query = useChatbotStats();
  const [showTable, setShowTable] = useState(false);

  if (query.isError) return <BlockError onRetry={() => void query.refetch()} retrying={query.isFetching} />;
  if (query.isLoading || !query.data) {
    return (
      <div className="grid gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
      </div>
    );
  }
  const s = query.data;
  const maxDaily = Math.max(1, ...s.daily.map((d) => d.conversations));
  const maxDish = Math.max(1, ...s.topAskedDishes.map((d) => d.count));

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Tỷ lệ trả lời được" value={pct(s.answerRate)} tone="accent" hint={`${s.totalConversations} hội thoại gần đây`} />
        <StatTile label="Tỷ lệ ngoài phạm vi (fallback)" value={pct(s.fallbackRate)} tone={s.fallbackRate > 20 ? 'warning' : 'default'} hint="Bổ sung FAQ để giảm tỷ lệ này" />
        <StatTile label="Chuyển nhân viên" value={pct(s.handoffRate)} hint="Khách được gợi ý bấm Gọi nhân viên" />
        <StatTile label="Khách thêm món sau tư vấn" value={pct(s.cartConversion)} hint={`TB ${s.avgMessages.toFixed(1).replace('.', ',')} tin nhắn / hội thoại`} />
      </div>

      <div className="grid min-w-0 gap-4 xl:grid-cols-2">
        <Card padded className="min-w-0">
          <CardHeader
            title="Số hội thoại 7 ngày qua"
            description="Di chuột vào cột để xem số hội thoại và số lần ngoài phạm vi."
            actions={<Button size="sm" variant="ghost" onClick={() => setShowTable((v) => !v)}>{showTable ? 'Xem biểu đồ' : 'Xem bảng'}</Button>}
          />
          {showTable ? (
            <DataTable minWidth={320}>
              <thead><tr><Th>Ngày</Th><Th className="text-right">Hội thoại</Th><Th className="text-right">Ngoài phạm vi</Th></tr></thead>
              <tbody>
                {s.daily.map((d) => (
                  <tr key={d.label}><Td className="font-mono">{d.label}</Td><Td className="text-right font-mono">{d.conversations}</Td><Td className="text-right font-mono">{d.fallback}</Td></tr>
                ))}
              </tbody>
            </DataTable>
          ) : (
            <div className="mt-4 flex h-[220px] items-end gap-2 border-b border-[var(--chart-grid)] pb-px" role="img" aria-label="Biểu đồ cột số hội thoại theo ngày">
              {s.daily.map((d, i) => (
                <div key={d.label} className="group relative flex h-full flex-1 flex-col items-center justify-end">
                  <span className="pointer-events-none absolute bottom-full z-10 mb-1 hidden whitespace-nowrap rounded-[8px] bg-[var(--text-primary)] px-2 py-1 text-[11.5px] text-[var(--bg-surface)] shadow-overlay group-hover:block" style={{ bottom: `${(d.conversations / maxDaily) * 100}%` }}>
                    {d.label}: {d.conversations} hội thoại · {d.fallback} ngoài phạm vi
                  </span>
                  {i === s.daily.length - 1 ? <span className="mb-1 font-mono text-[11px] font-semibold text-[var(--text-secondary)]">{d.conversations}</span> : null}
                  <div
                    className={cn('w-full max-w-[36px] rounded-t-[4px] transition-colors', i === s.daily.length - 1 ? 'bg-[var(--chart-line)]' : 'bg-[var(--chart-bar)] group-hover:bg-[var(--chart-line)]')}
                    style={{ height: `${(d.conversations / maxDaily) * 100}%` }}
                  />
                  <span className="absolute -bottom-6 font-mono text-[10.5px] text-[var(--text-muted)]">{d.label.split(' ')[0]}</span>
                </div>
              ))}
            </div>
          )}
          {!showTable ? <div className="h-6" /> : null}
        </Card>

        <Card padded className="min-w-0">
          <CardHeader title="Món được hỏi nhiều" description="Số lần món được nhắc đến trong hội thoại với khách." />
          <ul className="mt-3 space-y-2.5">
            {s.topAskedDishes.map((d, i) => (
              <li key={d.dishId} className="group" title={`${d.name}: ${d.count} lượt hỏi`}>
                <div className="flex items-center justify-between gap-2 text-[13px]">
                  <span className="truncate font-medium">{i + 1}. {d.name}</span>
                  <span className="font-mono font-semibold tabular-nums">{d.count}</span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[var(--bg-subtle)]">
                  <div className={cn('h-full rounded-full', i === 0 ? 'bg-[var(--chart-line)]' : 'bg-[var(--chart-bar)] group-hover:bg-[var(--chart-line)]')} style={{ width: `${Math.max(4, (d.count / maxDish) * 100)}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
