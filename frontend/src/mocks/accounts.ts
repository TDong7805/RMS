import type { Account, AuditLog, AuditModule, RoleKey } from '@/types';

const now = Date.now();
const daysAgo = (d: number, h = 9) => {
  const date = new Date(now - d * 86_400_000);
  date.setHours(h, (d * 7) % 60, 0, 0);
  return date.toISOString();
};

type Row = [string, string, string, RoleKey, 'active' | 'locked', number, number | null];

/** [FAKE-DATA] Tài khoản nhân sự của nhà hàng mẫu. usr-01 là quản lý đang đăng nhập. */
const rows: Row[] = [
  ['usr-01', 'tuan.nguyen', 'Nguyễn Anh Tuấn', 'manager', 'active', 420, 0],
  ['usr-02', 'admin', 'Quản trị hệ thống', 'admin', 'active', 500, 1],
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
}));

const minutesAgo = (m: number) => new Date(now - m * 60_000).toISOString();

type LogRow = [number, string, AuditModule, string, string];

/** [FAKE-DATA] Nhật ký hoạt động mẫu (mới nhất trước). */
const logRows: LogRow[] = [
  [3, 'usr-01', 'auth', 'Đăng nhập', 'Đăng nhập thành công từ trình duyệt Chrome'],
  [35, 'usr-03', 'auth', 'Đăng nhập', 'Đăng nhập ca sáng tại quầy thu ngân'],
  [70, 'usr-01', 'reservation', 'Cập nhật đặt bàn', 'DB-1108: đổi số khách từ 4 thành 6'],
  [140, 'usr-01', 'dish', 'Đổi trạng thái món', 'Bò lúc lắc khoai tây: Đang bán → Ngừng bán'],
  [190, 'usr-08', 'auth', 'Đăng nhập', 'Đăng nhập trang quản lý kho'],
  [260, 'usr-01', 'shift', 'Phân công ca', 'Phân công Hoàng Gia Nam vào Ca tối ngày hôm nay'],
  [420, 'usr-02', 'chatbot', 'Cập nhật cấu hình', 'Đổi câu chào mừng của trợ lý ảo'],
  [600, 'usr-01', 'post', 'Xuất bản bài viết', 'Ưu đãi cuối tuần – giảm 15% set lẩu'],
  [900, 'usr-01', 'account', 'Khóa tài khoản', 'Khóa tài khoản an.truong (nghỉ việc)'],
  [1300, 'usr-01', 'table', 'Cập nhật sơ đồ bàn', 'Di chuyển bàn T05 trong khu Tầng 1'],
  [1700, 'usr-01', 'settings', 'Sao lưu dữ liệu', 'Tạo bản sao lưu thủ công'],
  [2300, 'usr-01', 'dish', 'Thêm món ăn', 'Thêm món Gỏi cuốn tôm thịt (35.000 ₫)'],
  [3100, 'usr-02', 'account', 'Tạo tài khoản', 'Tạo tài khoản binh.vu – Nhân viên phục vụ'],
  [4200, 'usr-01', 'reservation', 'Cập nhật đặt bàn', 'DB-1097: chuyển sang bàn VIP 02'],
  [5200, 'usr-01', 'settings', 'Cập nhật giờ hoạt động', 'Chủ nhật mở cửa từ 09:00 đến 22:30'],
  [6800, 'usr-01', 'chatbot', 'Thêm FAQ', 'Nhà hàng có chỗ đậu xe ô tô không?'],
  [8000, 'usr-01', 'shift', 'Thêm ca làm việc', 'Thêm Ca gãy (10:00 – 14:00)'],
  [9100, 'usr-15', 'auth', 'Đăng nhập thất bại', 'Sai mật khẩu 5 lần liên tiếp'],
];

export const auditSeed: AuditLog[] = logRows.map(([m, userId, module, action, detail], i) => {
  const user = accountSeed.find((a) => a.id === userId)!;
  return {
    id: `log-${i + 1}`,
    at: minutesAgo(m),
    actor: user.fullName,
    actorUsername: user.username,
    module,
    action,
    detail,
    ip: `192.168.1.${20 + (i % 30)}`,
  };
});
