import { api } from '@/lib/http';
import type { IssueDetail, IssueFilter, IssueInput, IssuePage, WarehouseEmployee } from '@/types';

/** UC-KHO-21: lịch sử xuất kho, mặc định 30 ngày; totalValue theo bộ lọc. */
export function getIssues(f: IssueFilter): Promise<IssuePage> {
  return api.get<IssuePage>('/api/kho/issues', { ...f });
}

export function getIssue(id: string): Promise<IssueDetail> {
  return api.get<IssueDetail>(`/api/kho/issues/${encodeURIComponent(id)}`);
}

/** UC-KHO-20: phiếu xuất không sửa, không xóa, không hủy. Lỗi dòng: lines.{i}.{trường}. */
export function createIssue(input: IssueInput): Promise<IssueDetail> {
  return api.post<IssueDetail>('/api/kho/issues', input);
}

/** Nhân viên đang hoạt động — chọn người nhận khi xuất cho bếp. */
export function getWarehouseEmployees(): Promise<WarehouseEmployee[]> {
  return api.get<WarehouseEmployee[]>('/api/kho/employees');
}
