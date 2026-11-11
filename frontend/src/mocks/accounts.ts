import type { Account, RoleKey } from '@/types';

const now = Date.now();
const daysAgo = (d: number, h = 9) => {
  const date = new Date(now - d * 86_400_000);
  date.setHours(h, (d * 7) % 60, 0, 0);
  return date.toISOString();
};

type Row = [string, string, string, RoleKey, 'active' | 'locked', number, number | null];

/**
 * [FAKE-DATA] Nhân viên giả — CHỈ còn dùng cho trang Ca làm việc (api/shifts.ts) cho tới khi Ca làm có backend.
 * Trang Tài khoản đã dùng dữ liệu thật (GET /api/accounts).
 */
const rows: Row[] = [
  ['usr-01', 'tuan.nguyen', 'Nguyễn Anh Tuấn', 'manager', 'active', 420, 0],
  ['usr-03', 'linh.tran', 'Trần Thùy Linh', 'cashier', 'active', 300, 0],
  ['usr-04', 'khoa.le', 'Lê Đăng Khoa', 'cashier', 'active', 210, 1],
  ['usr-05', 'hung.pham', 'Phạm Quốc Hùng', 'kitchen', 'active', 390, 0],
  ['usr-06', 'mai.vo', 'Võ Ngọc Mai', 'kitchen', 'active', 260, 0],
  ['usr-07', 'son.dang', 'Đặng Thanh Sơn', 'kitchen', 'active', 120, 2],
  ['usr-08', 'thao.bui', 'Bùi Phương Thảo', 'warehouse', 'active', 330, 0],
  ['usr-09', 'nam.hoang', 'Hoàng Gia Nam', 'waiter', 'active', 180, 0],
  ['usr-10', 'vy.ngo', 'Ngô Tường Vy', 'waiter', 'active', 150, 0],
  ['usr-11', 'phuc.do', 'Đỗ Hồng Phúc', 'waiter', 'active', 95, 1],
  ['usr-12', 'an.truong', 'Trương Bảo An', 'waiter', 'locked', 240, 40],
  ['usr-13', 'quynh.ly', 'Lý Như Quỳnh', 'waiter', 'active', 60, 3],
  ['usr-14', 'duc.huynh', 'Huỳnh Minh Đức', 'kitchen', 'active', 45, 0],
  ['usr-15', 'trang.phan', 'Phan Thu Trang', 'cashier', 'locked', 400, 90],
  ['usr-16', 'binh.vu', 'Vũ Thanh Bình', 'waiter', 'active', 12, null],
];

export const accountSeed: Account[] = rows.map(([id, username, fullName, role, status, created, login]) => ({
  id,
  username,
  fullName,
  email: `${username}@greenlotus.vn`,
  phone: `09${String(10000000 + Number(id.slice(4)) * 7654321).slice(0, 8)}`,
  role,
  status,
  createdAt: daysAgo(created),
  lastLoginAt: login === null ? null : daysAgo(login, 8 + (Number(id.slice(4)) % 10)),
  mustChangePassword: false,
}));
