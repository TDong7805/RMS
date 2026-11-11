import { useEffect, useState } from 'react';
import { Download, FilterX, ScrollText } from 'lucide-react';
import { toast } from 'sonner';
import { AppShell } from '@/components/layout/AppShell';
import { Card } from '@/components/common/Card';
import { Badge } from '@/components/common/Badge';
import { Button } from '@/components/common/Button';
import { BlockError, EmptyState } from '@/components/common/EmptyState';
import { SearchInput, SelectInput, TextInput } from '@/components/common/Form';
import { DataTable, PageHeader, Pagination, TableSkeleton, Td, Th, Toolbar } from '@/components/common/PageParts';
import { AUDIT_PAGE_SIZE, exportAuditLogs } from '@/api/audit';
import { useAuditActors, useAuditLogs } from '@/features/management/queries';
import { useDebounced } from '@/hooks/use-debounced';
import { AUDIT_MODULE, formatDateTime } from '@/lib/labels';
import { downloadText, errorMessage, toDateKey } from '@/lib/mock';
import type { AuditFilter, AuditModule } from '@/types';

/** Phân khu “Nhật ký hoạt động” của UC Cấu hình hệ thống: xem và tìm kiếm/lọc lịch sử thao tác. */
export function AuditLogPage() {
  const [keyword, setKeyword] = useState('');
  const [actor, setActor] = useState('');
  const [module, setModule] = useState<AuditModule | 'all'>('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const [exporting, setExporting] = useState(false);
  const debounced = useDebounced(keyword);

  const filter: AuditFilter = { keyword: debounced, actor, module, from, to, page };
  const list = useAuditLogs(filter);
  const { data: actors = [] } = useAuditActors();
  useEffect(() => setPage(1), [debounced, actor, module, from, to]);

  const hasFilter = Boolean(keyword || actor || module !== 'all' || from || to);
  const reset = () => {
    setKeyword('');
    setActor('');
    setModule('all');
    setFrom('');
    setTo('');
  };

  const exportCsv = async () => {
    setExporting(true);
    try {
      const rows = await exportAuditLogs(filter);
      const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
      const csv = [
        ['Thời gian', 'Tài khoản', 'Tên đăng nhập', 'Phân hệ', 'Hành động', 'Chi tiết', 'IP'].join(','),
        ...rows.map((r) => [formatDateTime(r.at), r.actor, r.actorUsername, AUDIT_MODULE[r.module], r.action, r.detail, r.ip].map(esc).join(',')),
      ].join('\n');
      downloadText(`nhat-ky-${toDateKey(new Date())}.csv`, String.fromCharCode(0xfeff) + csv, 'text/csv');
      toast.success(`Đã xuất ${rows.length} dòng nhật ký`);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setExporting(false);
    }
  };

  return (
    <AppShell meta={{ label: 'Nhật ký', parent: 'Hệ thống' }}>
      <div className="min-w-0 space-y-4">
        <PageHeader
          title="Nhật ký hoạt động"
          description="Lịch sử thao tác của người dùng trên hệ thống quản lý, phục vụ kiểm tra an toàn vận hành."
          actions={<Button variant="outline" size="sm" leadingIcon={<Download size={15} />} loading={exporting} onClick={() => void exportCsv()}>Xuất CSV</Button>}
        />
        <Card className="overflow-hidden">
          <Toolbar>
            <SearchInput value={keyword} onChange={setKeyword} placeholder="Tìm hành động, chi tiết…" className="w-full sm:w-[240px]" />
            <SelectInput aria-label="Lọc theo tài khoản" value={actor} onChange={(e) => setActor(e.target.value)} placeholder="Mọi tài khoản" options={actors.map((a) => ({ value: a.username, label: `${a.name} (@${a.username})` }))} className="w-full sm:w-[220px]" />
            <SelectInput aria-label="Lọc theo phân hệ" value={module === 'all' ? '' : module} onChange={(e) => setModule((e.target.value || 'all') as AuditModule | 'all')} placeholder="Mọi phân hệ" options={(Object.keys(AUDIT_MODULE) as AuditModule[]).map((m) => ({ value: m, label: AUDIT_MODULE[m] }))} className="w-full sm:w-[170px]" />
            <div className="flex items-center gap-1.5">
              <TextInput type="date" aria-label="Từ ngày" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} className="w-[150px]" />
              <span className="text-[var(--text-muted)]">–</span>
              <TextInput type="date" aria-label="Đến ngày" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} className="w-[150px]" />
            </div>
            {hasFilter ? <Button variant="ghost" size="sm" leadingIcon={<FilterX size={14} />} onClick={reset}>Xóa lọc</Button> : null}
          </Toolbar>
          {list.isError ? (
            <div className="p-5"><BlockError message={errorMessage(list.error, 'Không tải được nhật ký')} onRetry={() => void list.refetch()} retrying={list.isFetching} /></div>
          ) : list.isLoading || !list.data ? (
            <TableSkeleton rows={8} cols={5} />
          ) : list.data.items.length === 0 ? (
            <div className="p-5"><EmptyState icon={ScrollText} title="Không có nhật ký phù hợp" description="Thử mở rộng khoảng thời gian hoặc bỏ bớt bộ lọc." /></div>
          ) : (
            <div className={list.isFetching ? 'opacity-60 transition-opacity' : ''}>
              <DataTable minWidth={900}>
                <thead>
                  <tr>
                    <Th>Thời gian</Th>
                    <Th>Tài khoản</Th>
                    <Th>Phân hệ</Th>
                    <Th>Hành động</Th>
                    <Th>Chi tiết</Th>
                    <Th>IP</Th>
                  </tr>
                </thead>
                <tbody>
                  {list.data.items.map((l) => (
                    <tr key={l.id} className="hover:bg-[var(--bg-subtle)]">
                      <Td className="whitespace-nowrap font-mono text-[12.5px]">{formatDateTime(l.at)}</Td>
                      <Td>
                        <p className="font-semibold">{l.actor}</p>
                        <p className="font-mono text-[11.5px] text-[var(--text-muted)]">@{l.actorUsername}</p>
                      </Td>
                      <Td><Badge variant="neutral">{AUDIT_MODULE[l.module]}</Badge></Td>
                      <Td className="whitespace-nowrap font-medium">{l.action}</Td>
                      <Td className="max-w-[360px] text-[var(--text-secondary)]">{l.detail}</Td>
                      <Td className="font-mono text-[12px] text-[var(--text-muted)]">{l.ip}</Td>
                    </tr>
                  ))}
                </tbody>
              </DataTable>
              <Pagination page={list.data.page} pageCount={list.data.pageCount} total={list.data.total} pageSize={AUDIT_PAGE_SIZE} onChange={setPage} unit="dòng" />
            </div>
          )}
        </Card>
      </div>
    </AppShell>
  );
}

export default AuditLogPage;
