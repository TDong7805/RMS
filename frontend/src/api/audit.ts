import { auditSeed } from '@/mocks/accounts';
import { currentUserSeed } from '@/mocks/notifications';
import { matchesKeyword } from '@/lib/normalize';
import { delay, paginate, uid } from '@/lib/mock';
import type { AuditFilter, AuditLog, AuditModule, Paged } from '@/types';

let store: AuditLog[] = auditSeed.map((l) => ({ ...l }));

export const AUDIT_PAGE_SIZE = 20;

/**
 * Ghi nhận một thao tác vào nhật ký hoạt động. Các API khác gọi hàm này sau khi lưu thành công.
 * [BACKEND-TODO] Khi có backend, việc ghi log do máy chủ tự thực hiện; xóa các lời gọi logActivity.
 */
export function logActivity(module: AuditModule, action: string, detail: string): void {
  store = [
    {
      id: uid('log'),
      at: new Date().toISOString(),
      actor: currentUserSeed.name,
      actorUsername: 'tuan.nguyen',
      module,
      action,
      detail,
      ip: '192.168.1.24',
    },
    ...store,
  ];
}

function filterLogs(filter: Omit<AuditFilter, 'page'>): AuditLog[] {
  const fromTs = filter.from ? new Date(`${filter.from}T00:00:00`).getTime() : -Infinity;
  const toTs = filter.to ? new Date(`${filter.to}T23:59:59`).getTime() : Infinity;
  return store
    .filter((l) => (filter.module === 'all' ? true : l.module === filter.module))
    .filter((l) => (filter.actor ? l.actorUsername === filter.actor : true))
    .filter((l) => {
      const t = new Date(l.at).getTime();
      return t >= fromTs && t <= toTs;
    })
    .filter(
      (l) =>
        !filter.keyword.trim() ||
        matchesKeyword(l.action, filter.keyword) ||
        matchesKeyword(l.detail, filter.keyword) ||
        matchesKeyword(l.actor, filter.keyword),
    )
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
}

/**
 * [BACKEND-TODO] Tra cứu nhật ký: thay bằng GET /api/audit-logs?keyword=&actor=&module=&from=&to=&page=,
 * giữ nguyên kiểu trả về Paged<AuditLog>.
 */
export async function getAuditLogs(filter: AuditFilter): Promise<Paged<AuditLog>> {
  await delay(320);
  if (filter.from && filter.to && filter.from > filter.to) {
    throw new Error('Ngày bắt đầu phải trước hoặc bằng ngày kết thúc');
  }
  return paginate(filterLogs(filter), filter.page, AUDIT_PAGE_SIZE);
}

/** [BACKEND-TODO] Xuất toàn bộ kết quả lọc: GET /api/audit-logs/export (CSV). */
export async function exportAuditLogs(filter: AuditFilter): Promise<AuditLog[]> {
  await delay(300);
  return filterLogs(filter);
}

/** Danh sách tài khoản đã từng phát sinh log, dùng cho bộ lọc "Tài khoản". */
export async function getAuditActors(): Promise<{ username: string; name: string }[]> {
  await delay(120);
  const map = new Map<string, string>();
  store.forEach((l) => map.set(l.actorUsername, l.actor));
  return [...map.entries()].map(([username, name]) => ({ username, name }));
}
