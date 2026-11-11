import { api } from '@/lib/http';
import type { AuditFilter, AuditLog, AuditModule, Paged } from '@/types';

export const AUDIT_PAGE_SIZE = 20;

/**
 * Nhật ký giờ do máy chủ tự ghi sau mỗi thao tác thành công.
 * TẠM THỜI giữ hàm rỗng này vì các API giả chưa chuyển sang backend (món ăn, ca làm, tài khoản,
 * bài viết, chatbot) vẫn gọi nó. Xóa hàm khi các phân hệ đó đã nối backend.
 */
export function logActivity(_module: AuditModule, _action: string, _detail: string): void {
  void _module;
  void _action;
  void _detail;
}

export const getAuditLogs = (filter: AuditFilter) => api.get<Paged<AuditLog>>('/api/audit-logs', { ...filter });

/** Toàn bộ kết quả lọc (không phân trang) để xuất CSV. */
export const exportAuditLogs = (filter: AuditFilter) => {
  const { page, ...rest } = filter;
  void page;
  return api.get<AuditLog[]>('/api/audit-logs/export', rest);
};

export const getAuditActors = () => api.get<{ username: string; name: string }[]>('/api/audit-logs/actors');
