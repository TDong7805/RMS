// Sinh backend/src/main/resources/db/dev/V7_1__kho_mau.sql
// Chạy (từ thư mục backend): node database/kho-seed/gen-v7_1.mjs src/main/resources/db/dev/V7_1__kho_mau.sql
// LƯU Ý: V7_1 đã chạy trên CSDL dev thì KHÔNG sửa file SQL nữa (Flyway báo sai checksum) — thêm file seed mới.
import { writeFileSync } from 'node:fs';

const SPECS = [
  // [tên, nhóm, đơn vị, tồn tối thiểu, giá vốn, dùng / ngày (để tính tồn đầu kỳ), tồn mục tiêu (null = đủ hàng), ghi chú]
  ['Thăn ngoại bò Úc (striploin)', 'meat', 'kg', 5, 520000, 1.2, 3.5, 'Bảo quản ngăn mát 0–4°C, dùng trong 5 ngày.'],
  ['Thăn nội bò Úc (tenderloin)', 'meat', 'kg', 3, 780000, 0.8, null, ''],
  ['Ribeye bò Úc', 'meat', 'kg', 5, 690000, 1.0, null, ''],
  ['Bắp bò', 'meat', 'kg', 6, 260000, 1.6, null, ''],
  ['Bánh phở tươi', 'other', 'kg', 8, 18000, 4, 6, 'Giao mỗi sáng, dùng trong ngày.'],
  ['Nấm đông cô', 'dry', 'kg', 1, 220000, 0.2, null, ''],
  ['Ribeye Wagyu Úc MB4+', 'meat', 'kg', 2, 1850000, 0.3, null, 'Hàng cao cấp, kiểm đếm theo miếng khi nhận.'],
  ['Đuôi bò', 'meat', 'kg', 3, 240000, 0.6, null, ''],
  ['Sườn bò Úc (short rib)', 'meat', 'kg', 4, 420000, 0.8, null, ''],
  ['T-bone bò Úc', 'meat', 'kg', 3, 560000, 0.6, 0, ''],
  ['Ba chỉ bò Úc', 'meat', 'kg', 4, 330000, 1.0, null, ''],
  ['Lưỡi bò', 'meat', 'kg', 2, 290000, 0.4, null, ''],
  ['Gân & nạm bò', 'meat', 'kg', 4, 210000, 0.8, null, ''],
  ['Xương bò (nấu nước dùng)', 'meat', 'kg', 15, 45000, 6, null, ''],
  ['Rau xà lách', 'produce', 'kg', 3, 35000, 0.9, null, ''],
  ['Cà chua', 'produce', 'kg', 4, 28000, 0.8, null, ''],
  ['Hành lá', 'produce', 'kg', 1, 40000, 0.3, 0.8, ''],
  ['Rau thơm các loại', 'produce', 'bó', 10, 8000, 3, null, 'Húng quế, ngò gai, rau răm, giá.'],
  ['Khoai tây', 'produce', 'kg', 10, 30000, 3, null, ''],
  ['Gạo ST25', 'dry', 'kg', 20, 32000, 4, null, ''],
  ['Bún bò Huế (sợi to)', 'other', 'kg', 5, 16000, 2, null, ''],
  ['Trứng gà', 'dairy', 'quả', 60, 3500, 18, 45, ''],
  ['Bơ lạt', 'dairy', 'kg', 2, 260000, 0.3, null, ''],
  ['Nước mắm Phú Quốc', 'spice', 'chai', 6, 45000, 0.5, null, ''],
  ['Dầu ăn', 'spice', 'lít', 10, 42000, 1.5, null, ''],
  ['Bia thủ công Úc (chai 330ml)', 'drink', 'chai', 48, 52000, 20, null, ''],
  ['Vang đỏ Úc (chai 750ml)', 'drink', 'chai', 6, 420000, 1, null, '1 chai rót được 5 ly 150ml.'],
  ['Lá lốt', 'produce', 'kg', 0.5, 0, 0, null, 'Mới thêm, chưa nhập hàng.'],
  ['Ba chỉ bò Mỹ', 'meat', 'kg', 3, 280000, 0.5, null, 'Ngừng dùng từ tháng này (chuyển sang ba chỉ bò Úc), dùng hết phần còn lại.'],
  // ---- NL030–NL106: bổ sung cho thực đơn 55 món (docs/du-lieu/CONG_THUC_DINH_LUONG.md)
  ['Tomahawk bò Úc', 'meat', 'kg', 3, 650000, 0.8, null, 'Nhận nguyên miếng ~1,1–1,2 kg.'],
  ['Thịt bò xay', 'meat', 'kg', 3, 240000, 1.2, null, 'Xay trong ngày, dùng trong 2 ngày.'],
  ['Bò Wagyu A5 Nhật (theo mùa)', 'meat', 'kg', 0, 4500000, 0, null, 'Chỉ nhập dịp Giáng sinh – Tết.'],
  ['Hành tây', 'produce', 'kg', 5, 25000, 2.5, null, ''],
  ['Ớt chuông (đỏ, vàng)', 'produce', 'kg', 2, 60000, 1.2, null, ''],
  ['Tỏi', 'produce', 'kg', 1, 50000, 0.4, null, ''],
  ['Ớt tươi', 'produce', 'kg', 0.5, 60000, 0.15, null, ''],
  ['Chanh', 'produce', 'kg', 2, 30000, 1.0, null, ''],
  ['Sả', 'produce', 'kg', 1, 25000, 0.5, null, ''],
  ['Gừng', 'produce', 'kg', 0.5, 40000, 0.1, null, ''],
  ['Dưa leo', 'produce', 'kg', 2, 20000, 1.0, null, ''],
  ['Cà rốt', 'produce', 'kg', 3, 22000, 1.0, null, ''],
  ['Củ cải trắng', 'produce', 'kg', 2, 18000, 0.4, null, ''],
  ['Măng tây', 'produce', 'kg', 1, 120000, 0.4, null, ''],
  ['Bắp Mỹ', 'produce', 'quả', 10, 8000, 4, null, ''],
  ['Bắp cải (trắng, tím)', 'produce', 'kg', 2, 20000, 0.6, null, ''],
  ['Rau muống', 'produce', 'kg', 2, 20000, 1.0, null, ''],
  ['Cải thảo', 'produce', 'kg', 2, 22000, 0.8, null, ''],
  ['Cải ngọt / cải bẹ xanh', 'produce', 'kg', 2, 25000, 1.0, null, ''],
  ['Nấm kim châm', 'produce', 'kg', 1, 60000, 0.8, null, ''],
  ['Nấm đùi gà', 'produce', 'kg', 1, 90000, 0.6, null, ''],
  ['Khoai môn', 'produce', 'kg', 1, 35000, 0.4, null, ''],
  ['Thơm (dứa)', 'produce', 'quả', 4, 15000, 2, null, ''],
  ['Cam tươi', 'produce', 'kg', 5, 35000, 3, null, ''],
  ['Hành baro', 'produce', 'kg', 0.5, 70000, 0.05, null, ''],
  ['Ớt xanh (shishito)', 'produce', 'kg', 0.3, 120000, 0.1, null, ''],
  ['Bánh mì baguette', 'other', 'cái', 20, 5000, 15, null, 'Giao mỗi sáng.'],
  ['Bánh burger (brioche)', 'other', 'cái', 12, 9000, 6, null, ''],
  ['Mì Ý spaghetti', 'dry', 'kg', 2, 70000, 0.6, null, 'Gói 500 g.'],
  ['Mì trứng sợi nhỏ', 'dry', 'kg', 2, 60000, 0.6, null, ''],
  ['Hủ tiếu sợi', 'dry', 'kg', 3, 25000, 1.0, null, ''],
  ['Bún tươi (sợi nhỏ)', 'other', 'kg', 5, 15000, 4, null, 'Giao mỗi sáng, dùng trong ngày.'],
  ['Bánh tráng', 'dry', 'gói', 5, 15000, 3, null, 'Gói 20 lá.'],
  ['Đậu phộng rang', 'dry', 'kg', 0.5, 80000, 0.15, null, ''],
  ['Hành phi', 'dry', 'kg', 0.5, 120000, 0.1, null, ''],
  ['Đậu hũ non', 'other', 'kg', 1, 30000, 0.5, null, ''],
  ['Gói thuốc bắc hầm lẩu', 'dry', 'gói', 5, 45000, 1.5, null, 'Táo đỏ, kỷ tử, đẳng sâm.'],
  ['Gia vị nấu nước dùng', 'spice', 'kg', 0.3, 300000, 0.15, null, 'Quế, hồi, thảo quả.'],
  ['Phô mai cheddar', 'dairy', 'kg', 1, 280000, 0.4, null, ''],
  ['Phô mai parmesan', 'dairy', 'kg', 0.3, 600000, 0.05, null, ''],
  ['Sữa tươi không đường', 'dairy', 'lít', 5, 35000, 3, null, 'Thùng 12 hộp 1 lít.'],
  ['Kem tươi (whipping cream)', 'dairy', 'lít', 2, 140000, 0.5, null, ''],
  ['Kem vani', 'dairy', 'lít', 4, 150000, 1.2, null, 'Hộp 4 lít, bảo quản ngăn đá.'],
  ['Tiêu đen hạt', 'spice', 'kg', 0.5, 250000, 0.05, null, ''],
  ['Muối', 'spice', 'kg', 2, 10000, 0.3, null, ''],
  ['Đường', 'spice', 'kg', 5, 22000, 1.0, null, ''],
  ['Sa tế', 'spice', 'kg', 0.5, 150000, 0.2, null, ''],
  ['Mắm nêm', 'spice', 'lít', 1, 60000, 0.3, null, ''],
  ['Chao', 'spice', 'kg', 0.5, 80000, 0.1, null, ''],
  ['Tương đen', 'spice', 'lít', 1, 70000, 0.3, null, ''],
  ['Tương ớt', 'spice', 'lít', 1, 50000, 0.4, null, ''],
  ['Nước tương', 'spice', 'lít', 1, 45000, 0.2, null, ''],
  ['Sốt ponzu', 'spice', 'lít', 0.5, 180000, 0.15, null, ''],
  ['Wasabi', 'spice', 'kg', 0.1, 400000, 0.01, null, ''],
  ['Sốt BBQ', 'spice', 'lít', 1, 120000, 0.3, null, ''],
  ['Cà chua nghiền (sốt cà chua)', 'other', 'kg', 2, 60000, 0.6, null, ''],
  ['Dầu ô liu', 'spice', 'lít', 1, 220000, 0.2, null, ''],
  ['Giấm', 'spice', 'lít', 1, 25000, 0.3, null, ''],
  ['Sốt tiêu đen pha sẵn', 'spice', 'lít', 2, 180000, 1.0, null, 'Bếp trung tâm pha sẵn.'],
  ['Sốt nấm pha sẵn', 'spice', 'lít', 1, 200000, 0.3, null, 'Bếp trung tâm pha sẵn.'],
  ['Sốt vang đỏ pha sẵn', 'spice', 'lít', 1, 260000, 0.3, null, 'Bếp trung tâm pha sẵn.'],
  ['Sốt sô-cô-la', 'other', 'lít', 0.5, 180000, 0.2, null, ''],
  ['Hạnh nhân lát', 'dry', 'kg', 0.2, 400000, 0.05, null, ''],
  ['Vải ngâm', 'other', 'lon', 6, 45000, 2, null, 'Lon 565 g.'],
  ['Bột gelatin', 'dry', 'kg', 0.1, 500000, 0.02, null, ''],
  ['Đào ngâm', 'other', 'lon', 6, 55000, 2, null, 'Lon 820 g.'],
  ['Trà đen túi lọc', 'dry', 'túi', 50, 1500, 15, null, 'Hộp 100 túi.'],
  ['Bánh quế cuộn', 'dry', 'cái', 30, 2000, 10, null, 'Hộp 50 cái.'],
  ['Coca-Cola (lon 330ml)', 'drink', 'lon', 48, 9000, 30, null, ''],
  ['Coca-Cola Zero (lon 330ml)', 'drink', 'lon', 24, 9500, 10, null, ''],
  ['Sprite (lon 330ml)', 'drink', 'lon', 24, 9000, 12, null, ''],
  ['Fanta Cam (lon 330ml)', 'drink', 'lon', 24, 9000, 10, null, ''],
  ['Fanta Nho (lon 330ml)', 'drink', 'lon', 24, 9000, 6, null, ''],
  ['Sá xị Chương Dương (lon 330ml)', 'drink', 'lon', 24, 8500, 8, null, ''],
  ['Nước suối (chai 500ml)', 'drink', 'chai', 48, 5000, 25, null, ''],
  ['Bia tươi', 'drink', 'lít', 20, 45000, 15, null, 'Bom 20 lít.'],
  ['Gói nước dùng dashi', 'dry', 'gói', 5, 20000, 1.5, null, ''],
];
// Tồn của 6 nguyên liệu đã có trong V1_1 (đã nhập "Tồn đầu kỳ" ở đó).
const EXISTING_QTY = { 1: 12, 2: 8, 3: 10, 4: 15, 5: 30, 6: 3 };

const SUPPLIERS = [
  ['Công ty Thịt bò nhập khẩu Úc Châu', '0912000111', 'transfer', 'Anh Trần Văn Lộc', 'sales@ucchaubeef.vn', 'https://ucchaubeef.vn', '1701234567', 'KCN Tân Tạo, Bình Tân, TP.HCM', 'Giao hàng lạnh trước 8 giờ sáng. Công nợ 15 ngày.'],
  ['Công ty Thực phẩm Đại Phát', '0912000222', 'transfer', 'Chị Lê Ngọc Mai', 'kinhdoanh@daiphatfood.vn', 'https://daiphatfood.vn', '0312345678', 'KCN Tân Bình, TP.HCM', 'Công nợ 15 ngày.'],
  ['Rau sạch Đà Lạt Xanh', '0903456789', 'cash', 'Anh Nguyễn Hữu Phúc', 'dalatxanh@gmail.com', '', '', 'Chợ đầu mối Thủ Đức, TP.HCM', ''],
  ['Đại lý đồ uống Minh Phát', '02876543210', 'transfer', 'Anh Võ Minh Phát', 'minhphat.beverage@gmail.com', '', '0309876543', '45 Lũy Bán Bích, Tân Phú, TP.HCM', 'Giao thùng nguyên đai, có hóa đơn rượu nhập khẩu.'],
  ['Gia vị Hương Việt', '0938111222', 'transfer', 'Chị Phạm Thu Hương', 'huongviet.spice@gmail.com', 'https://giavihuongviet.vn', '0315556677', '12 Nguyễn Trãi, Quận 5, TP.HCM', ''],
  ['Bò nhập khẩu Phương Nam', '0909888777', 'transfer', 'Anh Đỗ Quang Huy', 'phuongnambeef@gmail.com', '', '0318889990', '88 Tô Hiến Thành, Quận 10, TP.HCM', ''],
];

const LINKS = [
  // [NCC, NL, đơn vị mua, hệ số quy đổi, giá, đặt tối thiểu]
  [1, 1, 'kg', 1, 520000, 3], [1, 2, 'kg', 1, 780000, 2], [1, 3, 'kg', 1, 690000, 3], [1, 7, 'kg', 1, 1850000, 1],
  [1, 9, 'kg', 1, 420000, 2], [1, 11, 'kg', 1, 330000, 3],
  [2, 4, 'kg', 1, 260000, 3], [2, 8, 'kg', 1, 240000, 2], [2, 12, 'kg', 1, 290000, 1], [2, 13, 'kg', 1, 210000, 2],
  [2, 14, 'kg', 1, 45000, 10], [2, 20, 'bao', 25, 800000, 1], [2, 22, 'khay', 30, 105000, 2], [2, 23, 'kg', 1, 260000, null],
  [2, 29, 'kg', 1, 280000, null],
  [3, 5, 'kg', 1, 18000, 5], [3, 15, 'kg', 1, 35000, null], [3, 16, 'kg', 1, 28000, null], [3, 17, 'kg', 1, 40000, null],
  [3, 18, 'bó', 1, 8000, 10], [3, 19, 'kg', 1, 30000, 5], [3, 21, 'kg', 1, 16000, 5],
  [4, 26, 'thùng', 24, 1248000, 1], [4, 27, 'thùng', 6, 2520000, 1],
  [5, 6, 'kg', 1, 220000, null], [5, 24, 'thùng', 12, 540000, null], [5, 25, 'can', 5, 210000, 2],
  [6, 10, 'kg', 1, 560000, 3], [6, 3, 'kg', 1, 720000, null],
  // NL030–NL106
  [1, 30, 'kg', 1, 650000, 2],
  [2, 31, 'kg', 1, 240000, 2],
  [1, 32, 'kg', 1, 4500000, null],
  [3, 33, 'kg', 1, 25000, 5],
  [3, 34, 'kg', 1, 60000, null],
  [3, 35, 'kg', 1, 50000, null],
  [3, 36, 'kg', 1, 60000, null],
  [3, 37, 'kg', 1, 30000, null],
  [3, 38, 'kg', 1, 25000, null],
  [3, 39, 'kg', 1, 40000, null],
  [3, 40, 'kg', 1, 20000, null],
  [3, 41, 'kg', 1, 22000, null],
  [3, 42, 'kg', 1, 18000, null],
  [3, 43, 'kg', 1, 120000, null],
  [3, 44, 'quả', 1, 8000, null],
  [3, 45, 'kg', 1, 20000, null],
  [3, 46, 'kg', 1, 20000, null],
  [3, 47, 'kg', 1, 22000, null],
  [3, 48, 'kg', 1, 25000, null],
  [3, 49, 'kg', 1, 60000, null],
  [3, 50, 'kg', 1, 90000, null],
  [3, 51, 'kg', 1, 35000, null],
  [3, 52, 'quả', 1, 15000, null],
  [3, 53, 'kg', 1, 35000, 5],
  [3, 54, 'kg', 1, 70000, null],
  [3, 55, 'kg', 1, 120000, null],
  [2, 56, 'cái', 1, 5000, 20],
  [2, 57, 'túi', 6, 54000, 2],
  [2, 58, 'gói', 0.5, 35000, 4],
  [2, 59, 'kg', 1, 60000, null],
  [2, 60, 'kg', 1, 25000, null],
  [3, 61, 'kg', 1, 15000, 5],
  [2, 62, 'gói', 1, 15000, null],
  [5, 63, 'kg', 1, 80000, null],
  [5, 64, 'kg', 1, 120000, null],
  [2, 65, 'kg', 1, 30000, null],
  [5, 66, 'gói', 1, 45000, null],
  [5, 67, 'kg', 1, 300000, null],
  [2, 68, 'kg', 1, 280000, null],
  [2, 69, 'kg', 1, 600000, null],
  [2, 70, 'thùng', 12, 420000, 1],
  [2, 71, 'lít', 1, 140000, null],
  [2, 72, 'hộp', 4, 600000, 1],
  [5, 73, 'kg', 1, 250000, null],
  [5, 74, 'kg', 1, 10000, null],
  [5, 75, 'kg', 1, 22000, null],
  [5, 76, 'kg', 1, 150000, null],
  [5, 77, 'lít', 1, 60000, null],
  [5, 78, 'kg', 1, 80000, null],
  [5, 79, 'lít', 1, 70000, null],
  [5, 80, 'lít', 1, 50000, null],
  [5, 81, 'lít', 1, 45000, null],
  [5, 82, 'lít', 1, 180000, null],
  [5, 83, 'kg', 1, 400000, null],
  [5, 84, 'lít', 1, 120000, null],
  [2, 85, 'kg', 1, 60000, null],
  [2, 86, 'lít', 1, 220000, null],
  [5, 87, 'lít', 1, 25000, null],
  [5, 88, 'lít', 1, 180000, 2],
  [5, 89, 'lít', 1, 200000, null],
  [5, 90, 'lít', 1, 260000, null],
  [2, 91, 'lít', 1, 180000, null],
  [2, 92, 'kg', 1, 400000, null],
  [2, 93, 'thùng', 12, 540000, 1],
  [2, 94, 'kg', 1, 500000, null],
  [2, 95, 'thùng', 12, 660000, 1],
  [2, 96, 'hộp', 100, 150000, 1],
  [2, 97, 'hộp', 50, 100000, 1],
  [4, 98, 'thùng', 24, 216000, 1],
  [4, 99, 'thùng', 24, 228000, 1],
  [4, 100, 'thùng', 24, 216000, 1],
  [4, 101, 'thùng', 24, 216000, 1],
  [4, 102, 'thùng', 24, 216000, 1],
  [4, 103, 'thùng', 24, 204000, 1],
  [4, 104, 'thùng', 24, 120000, 1],
  [4, 105, 'bom', 20, 900000, 1],
  [5, 106, 'gói', 1, 20000, null],
];
// [số thứ tự liên kết, giá cũ, ngày đổi (lệch so với hôm nay)]
const PRICE_CHANGES = [[1, 495000, -20], [3, 650000, -6], [7, 245000, -9]];

/** Mã nguyên liệu theo tên (vị trí trong SPECS) — báo lỗi ngay nếu gõ sai tên. */
const NL = (name) => {
  const i = SPECS.findIndex((s) => s[0] === name);
  if (i < 0) throw new Error(`Không có nguyên liệu: ${name}`);
  return i + 1;
};
const BO_NGOAI = 'Thăn ngoại bò Úc (striploin)';
const BO_NOI = 'Thăn nội bò Úc (tenderloin)';
const WAGYU = 'Ribeye Wagyu Úc MB4+';
const XUONG = 'Xương bò (nấu nước dùng)';
const RAU_THOM = 'Rau thơm các loại';
const NUOC_MAM = 'Nước mắm Phú Quốc';
const SOT_TIEU = 'Sốt tiêu đen pha sẵn';

// Định lượng cho 1 phần — xem docs/du-lieu/CONG_THUC_DINH_LUONG.md (khối lượng sống lấy từ kho, đã gồm nước chấm đi kèm).
const RECIPES = [
  // [mã món, [[tên nguyên liệu, định lượng / phần]]]
  // Khai vị
  ['MA001', [['Thịt bò xay', 0.15], ['Lá lốt', 0.03], ['Hành lá', 0.01], ['Đậu phộng rang', 0.01], ['Dầu ăn', 0.01], ['Rau xà lách', 0.04], [RAU_THOM, 0.2], ['Bún tươi (sợi nhỏ)', 0.08], ['Mắm nêm', 0.03], ['Thơm (dứa)', 0.05], ['Ớt tươi', 0.003]]],
  ['MA002', [['Bắp bò', 0.12], ['Hành tây', 0.05], ['Chanh', 0.04], [RAU_THOM, 0.3], ['Ớt tươi', 0.005], ['Đậu phộng rang', 0.015], ['Hành phi', 0.01], [NUOC_MAM, 0.03], ['Đường', 0.01]]],
  ['MA003', [[BO_NGOAI, 0.13], ['Củ cải trắng', 0.04], ['Hành lá', 0.01], ['Sốt ponzu', 0.04], ['Dầu ăn', 0.005]]],
  ['MA004', [['Khoai tây', 0.2], ['Dầu ăn', 0.05], ['Thịt bò xay', 0.08], ['Phô mai cheddar', 0.04], ['Hành phi', 0.01], ['Ớt tươi', 0.003]]],
  ['MA005', [['Gân & nạm bò', 0.08], [XUONG, 0.08], ['Cà chua', 0.05], ['Khoai tây', 0.05], ['Cà rốt', 0.04], ['Hành tây', 0.03], ['Bánh mì baguette', 0.25]]],
  // Bít tết Úc (đã gồm sốt kèm mặc định Tiêu đen)
  ['MA006', [[BO_NGOAI, 0.27], ['Khoai tây', 0.15], ['Bơ lạt', 0.02], ['Tỏi', 0.005], ['Dầu ăn', 0.01], [SOT_TIEU, 0.05]]],
  ['MA007', [[BO_NOI, 0.22], ['Khoai tây', 0.15], ['Sữa tươi không đường', 0.03], ['Bơ lạt', 0.02], ['Măng tây', 0.06], [SOT_TIEU, 0.05]]],
  ['MA008', [['Ribeye bò Úc', 0.32], ['Bơ lạt', 0.02], ['Hành tây', 0.05], ['Cà chua', 0.05], ['Khoai tây', 0.15], [SOT_TIEU, 0.05]]],
  ['MA009', [[WAGYU, 0.21], ['Ớt xanh (shishito)', 0.03], ['Wasabi', 0.003], ['Sốt ponzu', 0.02], [SOT_TIEU, 0.05]]],
  ['MA010', [['T-bone bò Úc', 0.47], ['Bắp Mỹ', 1], ['Bắp cải (trắng, tím)', 0.06], ['Giấm', 0.005], ['Đường', 0.005], [RAU_THOM, 0.1], ['Dầu ô liu', 0.02], ['Tỏi', 0.005], [SOT_TIEU, 0.05]]],
  ['MA011', [['Tomahawk bò Úc', 1.15], ['Tỏi', 0.08], ['Cà rốt', 0.15], ['Bơ lạt', 0.03], [RAU_THOM, 0.1], ['Dầu ô liu', 0.02], [SOT_TIEU, 0.1]]],
  ['MA012', [[BO_NGOAI, 0.12], ['Trứng gà', 1], ['Bánh mì baguette', 1], ['Hành tây', 0.05], ['Bơ lạt', 0.01], ['Cà rốt', 0.03], ['Củ cải trắng', 0.03], ['Giấm', 0.01], ['Đường', 0.01], [SOT_TIEU, 0.05]]],
  // Bò nướng & áp chảo
  ['MA013', [[BO_NGOAI, 0.15], ['Khoai tây', 0.15], ['Bơ lạt', 0.02], ['Ớt chuông (đỏ, vàng)', 0.06], ['Hành tây', 0.05], ['Tỏi', 0.005], ['Dầu ăn', 0.05], ['Chanh', 0.02], ['Tiêu đen hạt', 0.002], ['Muối', 0.002]]],
  ['MA014', [['Sườn bò Úc (short rib)', 0.45], ['Sốt BBQ', 0.06], ['Bắp cải (trắng, tím)', 0.06], ['Dưa leo', 0.03], ['Giấm', 0.005], ['Đường', 0.005]]],
  ['MA015', [['Ba chỉ bò Úc', 0.2], ['Sa tế', 0.03], ['Sả', 0.02], ['Tỏi', 0.005], [RAU_THOM, 0.3], ['Rau xà lách', 0.05], ['Bánh tráng', 0.3], ['Ớt tươi', 0.005], ['Chanh', 0.02], ['Muối', 0.003]]],
  ['MA016', [[BO_NGOAI, 0.22], ['Nấm đùi gà', 0.05], ['Hành tây', 0.05], ['Bơ lạt', 0.01], ['Chanh', 0.02], ['Tiêu đen hạt', 0.002], ['Muối', 0.003]]],
  ['MA017', [['Lưỡi bò', 0.25], ['Sả', 0.02], ['Dưa leo', 0.04], ['Dầu ăn', 0.01], ['Ớt tươi', 0.005], ['Chanh', 0.02], ['Muối', 0.003]]],
  // Lẩu bò (2–3 người)
  ['MA018', [['Bắp bò', 0.5], ['Giấm', 0.05], ['Thơm (dứa)', 0.25], ['Sả', 0.05], ['Hành tây', 0.1], ['Cà chua', 0.15], [RAU_THOM, 1], ['Rau xà lách', 0.1], ['Bánh tráng', 0.5], ['Bún tươi (sợi nhỏ)', 0.3], ['Dầu ăn', 0.01], ['Mắm nêm', 0.05]]],
  ['MA019', [['Ba chỉ bò Úc', 0.3], ['Bắp bò', 0.2], [XUONG, 0.4], ['Sa tế', 0.05], ['Sả', 0.03], ['Cà chua', 0.1], ['Nấm đông cô', 0.05], ['Nấm kim châm', 0.15], ['Rau muống', 0.2], ['Bún tươi (sợi nhỏ)', 0.3], ['Chao', 0.04]]],
  ['MA020', [['Đuôi bò', 0.6], ['Gói thuốc bắc hầm lẩu', 1], ['Gừng', 0.02], ['Nấm đông cô', 0.05], ['Cải ngọt / cải bẹ xanh', 0.3], ['Khoai môn', 0.2], ['Bún tươi (sợi nhỏ)', 0.3], [NUOC_MAM, 0.03], ['Ớt tươi', 0.005]]],
  ['MA021', [[WAGYU, 0.15], ['Gói nước dùng dashi', 1], ['Nấm đông cô', 0.05], ['Nấm kim châm', 0.1], ['Đậu hũ non', 0.15], ['Cải thảo', 0.2], ['Sốt ponzu', 0.04], ['Nước tương', 0.02]]],
  // Món nước
  ['MA022', [['Bánh phở tươi', 0.2], ['Bắp bò', 0.07], ['Gân & nạm bò', 0.04], [XUONG, 0.1], ['Gia vị nấu nước dùng', 0.005], ['Gừng', 0.005], ['Hành tây', 0.03], ['Hành lá', 0.01], [RAU_THOM, 0.2], ['Chanh', 0.02], ['Ớt tươi', 0.003], [NUOC_MAM, 0.01], ['Tương đen', 0.01], ['Tương ớt', 0.01]]],
  ['MA023', [['Bún bò Huế (sợi to)', 0.2], ['Bắp bò', 0.08], [XUONG, 0.1], ['Sả', 0.03], ['Sa tế', 0.01], ['Hành lá', 0.01], [RAU_THOM, 0.2], ['Chanh', 0.02], [NUOC_MAM, 0.01]]],
  ['MA024', [['Hủ tiếu sợi', 0.15], ['Gân & nạm bò', 0.15], ['Cà chua', 0.05], ['Cà rốt', 0.05], ['Sả', 0.02], ['Gia vị nấu nước dùng', 0.005], ['Hành tây', 0.02], [RAU_THOM, 0.1], ['Chanh', 0.02]]],
  ['MA025', [['Bánh phở tươi', 0.2], [WAGYU, 0.04], [XUONG, 0.1], ['Gia vị nấu nước dùng', 0.005], ['Gừng', 0.005], ['Hành tây', 0.03], ['Hành lá', 0.01], [RAU_THOM, 0.15], ['Chanh', 0.02], ['Tương đen', 0.01], ['Tương ớt', 0.01]]],
  // Cơm, mì & burger
  ['MA026', [[BO_NGOAI, 0.1], ['Gạo ST25', 0.15], ['Cà chua nghiền (sốt cà chua)', 0.02], ['Bơ lạt', 0.01], ['Ớt chuông (đỏ, vàng)', 0.04], ['Hành tây', 0.03], ['Dưa leo', 0.03], ['Cà chua', 0.04], ['Hành lá', 0.005]]],
  ['MA027', [['Gạo ST25', 0.2], [BO_NGOAI, 0.07], ['Trứng gà', 1], ['Tỏi', 0.02], ['Hành lá', 0.01], ['Dầu ăn', 0.02], ['Nước tương', 0.01], ['Tương ớt', 0.01]]],
  ['MA028', [['Mì Ý spaghetti', 0.12], ['Thịt bò xay', 0.1], ['Cà chua nghiền (sốt cà chua)', 0.08], ['Cà chua', 0.08], ['Hành tây', 0.03], ['Tỏi', 0.005], ['Dầu ô liu', 0.01], ['Phô mai parmesan', 0.01], [RAU_THOM, 0.05]]],
  ['MA029', [['Thịt bò xay', 0.18], ['Bánh burger (brioche)', 1], ['Phô mai cheddar', 0.03], ['Rau xà lách', 0.03], ['Cà chua', 0.03], ['Hành tây', 0.08], ['Dầu ăn', 0.05], ['Tương ớt', 0.01]]],
  ['MA030', [['Mì trứng sợi nhỏ', 0.12], [BO_NGOAI, 0.08], ['Cải ngọt / cải bẹ xanh', 0.08], ['Cà rốt', 0.03], ['Hành tây', 0.03], ['Tỏi', 0.005], ['Dầu ăn', 0.08], ['Nước tương', 0.015], ['Giấm', 0.01], ['Ớt tươi', 0.003]]],
  // Tráng miệng
  ['MA031', [['Trứng gà', 1], ['Sữa tươi không đường', 0.08], ['Đường', 0.02]]],
  ['MA032', [['Kem vani', 0.12], ['Sốt sô-cô-la', 0.02], ['Bánh quế cuộn', 1]]],
  ['MA033', [['Sữa tươi không đường', 0.08], ['Kem tươi (whipping cream)', 0.04], ['Bột gelatin', 0.003], ['Đường', 0.02], ['Vải ngâm', 0.25], ['Hạnh nhân lát', 0.005]]],
  // Đồ uống
  ['MA034', [['Vang đỏ Úc (chai 750ml)', 0.2]]],
  ['MA035', [['Bia thủ công Úc (chai 330ml)', 1]]],
  ['MA036', [['Bia tươi', 0.5]]],
  ['MA037', [['Trà đen túi lọc', 1], ['Đào ngâm', 0.15], ['Cam tươi', 0.05], ['Sả', 0.01], ['Đường', 0.02]]],
  ['MA038', [['Cam tươi', 0.4], ['Đường', 0.01]]],
  ['MA040', [['Vang đỏ Úc (chai 750ml)', 1]]],
  ['MA041', [['Nước suối (chai 500ml)', 1]]],
  ['MA042', [['Coca-Cola (lon 330ml)', 1]]],
  ['MA043', [['Coca-Cola Zero (lon 330ml)', 1]]],
  ['MA044', [['Sprite (lon 330ml)', 1]]],
  ['MA045', [['Fanta Cam (lon 330ml)', 1]]],
  ['MA046', [['Fanta Nho (lon 330ml)', 1]]],
  ['MA047', [['Sá xị Chương Dương (lon 330ml)', 1]]],
  // Gọi thêm
  ['MA048', [['Khoai tây', 0.15], ['Bơ lạt', 0.015], ['Sữa tươi không đường', 0.03], ['Kem tươi (whipping cream)', 0.02], ['Muối', 0.002]]],
  ['MA049', [['Rau xà lách', 0.06], ['Cà chua', 0.05], ['Dưa leo', 0.04], ['Hành tây', 0.02], ['Dầu ô liu', 0.01], ['Giấm', 0.01]]],
  ['MA050', [['Bánh mì baguette', 0.5], ['Bơ lạt', 0.015], ['Tỏi', 0.005], [RAU_THOM, 0.05]]],
  ['MA051', [[SOT_TIEU, 0.05]]],
  ['MA052', [['Sốt nấm pha sẵn', 0.05]]],
  ['MA053', [['Sốt vang đỏ pha sẵn', 0.05]]],
  ['MA054', [['Ba chỉ bò Úc', 0.16]]],
  ['MA055', [['Nấm kim châm', 0.1], ['Nấm đùi gà', 0.06], ['Cải thảo', 0.1], ['Rau muống', 0.1], ['Cải ngọt / cải bẹ xanh', 0.05]]],
  ['MA056', [['Bún tươi (sợi nhỏ)', 0.15]]],
  // Món theo mùa
  ['MA039', [['Bò Wagyu A5 Nhật (theo mùa)', 0.15], ['Hành baro', 0.05], ['Wasabi', 0.005], ['Nước tương', 0.02]]],
];

const COUNT = new Set(['cái', 'quả', 'bó', 'hộp', 'chai', 'lon', 'gói', 'túi']);
const q = (s) => (s === null || s === '' ? 'NULL' : `'${String(s).replace(/'/g, "''")}'`);
const n = (v) => (v === null ? 'NULL' : String(v));
const code = (p, i) => `${p}${String(i).padStart(3, '0')}`;
const day = (off, time = '08:00:00') => `TIMESTAMP(CURDATE() - INTERVAL ${-off} DAY, '${time}')`;
const date = (off) => `CURDATE() - INTERVAL ${-off} DAY`;
const round = (v, unit) => (COUNT.has(unit) ? Math.round(v) : Math.round(v * 10) / 10);

const out = [];
const w = (s = '') => out.push(s);

w(`/* =====================================================================
   V7_1 — DỮ LIỆU MẪU phân hệ Quản lý kho (chỉ môi trường dev, [FAKE-DATA])
   Sinh tự động bằng backend/database/kho-seed/gen-v7_1.mjs (nhà hàng Royal Beef):
   106 nguyên liệu (NL001–NL006 đã có từ V1_1), 6 nhà cung cấp, 106 liên kết giá theo đơn vị mua,
   lịch sử đổi giá, công thức định lượng đủ 56 món (giả — Bếp sửa ở trang Công thức), tồn đầu kỳ và vài lần xuất bếp
   để có đủ trạng thái Đủ hàng / Sắp hết / Hết hàng. Ngày tháng tính lùi từ ngày chạy migration.
   ===================================================================== */
`);
w(`SET @thao = (SELECT id FROM users WHERE username = 'thao.bui');`);
w(`SET @tuan = (SELECT id FROM users WHERE username = 'tuan.nguyen');`);
w();
w('/* ---------------------------------------------------------------- Nguyên liệu */');
SPECS.forEach(([name, group, unit, min, , , , note], idx) => {
  const i = idx + 1;
  const created = name === 'Lá lốt' ? day(-2, '15:00:00') : day(-35);
  if (EXISTING_QTY[i] !== undefined) {
    w(`UPDATE ingredients SET group_key = ${q(group)}, note = ${q(note)}, created_by = @thao, created_at = ${created} WHERE code = '${code('NL', i)}';`);
  } else {
    w(`INSERT INTO ingredients (code, name, group_key, unit, min_level, avg_cost, is_active, note, created_by, created_at) VALUES ('${code('NL', i)}', ${q(name)}, ${q(group)}, ${q(unit)}, ${min}, NULL, ${name === 'Ba chỉ bò Mỹ' ? 0 : 1}, ${q(note)}, @thao, ${created});`);
  }
});
w(`UPDATE doc_sequences SET last_no = GREATEST(last_no, ${SPECS.length}) WHERE seq_key = 'NL';`);
w();
w('/* ---------------------------------------------------------------- Nhà cung cấp */');
SUPPLIERS.forEach(([name, phone, method, contact, email, website, tax, address, note], idx) => {
  const c = code('NCC', idx + 1);
  if (idx < 2) {
    w(`UPDATE suppliers SET phone = ${q(phone)}, payment_method = ${q(method)}, contact_name = ${q(contact)}, email = ${q(email)}, website = ${q(website)}, tax_code = ${q(tax)}, address = ${q(address)}, note = ${q(note)}, created_at = ${day(-35)} WHERE code = '${c}';`);
    w(`UPDATE supplier_status_events e JOIN suppliers s ON s.id = e.supplier_id SET e.created_at = ${day(-35)}, e.created_by = @thao WHERE s.code = '${c}';`);
  } else {
    w(`INSERT INTO suppliers (code, name, phone, payment_method, contact_name, email, website, tax_code, address, note, created_at) VALUES ('${c}', ${q(name)}, ${q(phone)}, ${q(method)}, ${q(contact)}, ${q(email)}, ${q(website)}, ${q(tax)}, ${q(address)}, ${q(note)}, ${day(-35)});`);
    w(`INSERT INTO supplier_status_events (supplier_id, is_active, note, created_by, created_at) SELECT id, 1, 'Tạo nhà cung cấp', @thao, ${day(-35)} FROM suppliers WHERE code = '${c}';`);
  }
});
w(`UPDATE suppliers SET is_active = 0, stop_reason = 'price', stop_note = 'Giá T-bone tăng 20% so với nhà cung cấp khác.' WHERE code = 'NCC006';`);
w(`INSERT INTO supplier_status_events (supplier_id, is_active, reason, note, created_by, created_at) SELECT id, 0, 'price', 'Giá T-bone tăng 20% so với nhà cung cấp khác.', @thao, ${day(-4, '10:30:00')} FROM suppliers WHERE code = 'NCC006';`);
w(`UPDATE doc_sequences SET last_no = GREATEST(last_no, ${SUPPLIERS.length}) WHERE seq_key = 'NCC';`);
w();
w('/* ---------------------------------------------------------------- Liên kết + lịch sử giá */');
LINKS.forEach(([s, i, unit, factor, price, min], idx) => {
  const change = PRICE_CHANGES.find((c) => c[0] === idx + 1);
  const from = change ? date(change[2]) : date(-35);
  w(`INSERT INTO supplier_ingredients (supplier_id, ingredient_id, purchase_unit, factor, price, min_order, effective_from, created_at) SELECT s.id, i.id, ${q(unit)}, ${factor}, ${price}, ${n(min)}, ${from}, ${day(-35)} FROM suppliers s JOIN ingredients i ON i.code = '${code('NL', i)}' WHERE s.code = '${code('NCC', s)}';`);
  w(`SET @lk = LAST_INSERT_ID();`);
  if (change) {
    const [, old, off] = change;
    w(`INSERT INTO supplier_price_history (link_id, price, purchase_unit, factor, min_order, valid_from, valid_to, change_type, created_by, created_at) VALUES (@lk, ${old}, ${q(unit)}, ${factor}, ${n(min)}, ${date(-35)}, ${date(off - 1)}, 'create', @thao, ${day(-35)});`);
    w(`INSERT INTO supplier_price_history (link_id, price, purchase_unit, factor, min_order, valid_from, valid_to, change_type, created_by, created_at) VALUES (@lk, ${price}, ${q(unit)}, ${factor}, ${n(min)}, ${date(off)}, NULL, 'price', @thao, ${day(off, '09:15:00')});`);
  } else {
    w(`INSERT INTO supplier_price_history (link_id, price, purchase_unit, factor, min_order, valid_from, valid_to, change_type, created_by, created_at) VALUES (@lk, ${price}, ${q(unit)}, ${factor}, ${n(min)}, ${date(-35)}, NULL, 'create', @thao, ${day(-35)});`);
  }
});
w(`UPDATE supplier_ingredients si JOIN suppliers s ON s.id = si.supplier_id SET si.is_active = 0 WHERE s.code = 'NCC006';`);
w();
w('/* ---------------------------------------------------------------- Công thức định lượng (giả) */');
RECIPES.forEach(([dish, items]) => {
  items.forEach(([name, qty]) => {
    const i = NL(name);
    w(`INSERT IGNORE INTO dish_ingredients (dish_id, ingredient_id, quantity) SELECT d.id, i.id, ${qty} FROM dishes d JOIN ingredients i ON i.code = '${code('NL', i)}' WHERE d.code = '${dish}';`);
  });
});
w();
w(`/* ---------------------------------------------------------------- Sổ kho
   Không được đọc bảng ingredients trong câu INSERT vào stock_transactions (MySQL 1442, trigger đang ghi
   ingredients) nên lấy id nguyên liệu ra biến trước. Mã phiếu lấy từ bộ đếm doc_sequences. */`);
const moves = [];
SPECS.forEach(([name, , unit, min, cost, use, target], idx) => {
  const i = idx + 1;
  if (use <= 0) return;
  const existing = EXISTING_QTY[i];
  if (existing === undefined) {
    const normal = round(min * 2.2 + use * 4, unit);
    moves.push({ i, type: 'opening', qty: normal, cost, at: day(-35, '08:30:00'), prefix: 'PN', off: -35 });
    if (target !== null && target < normal) moves.push({ i, type: 'issue_kitchen', qty: -(Math.round((normal - target) * 1000) / 1000), cost, at: day(-1, '17:30:00'), prefix: 'PX', off: -1 });
  } else if (target !== null && target < existing) {
    moves.push({ i, type: 'issue_kitchen', qty: -(Math.round((existing - target) * 1000) / 1000), cost: null, at: 'NOW()', prefix: 'PX', off: 0 });
  }
});
moves.forEach((m) => {
  const txn = m.qty > 0 ? 'import' : 'export';
  const monthExpr = m.off === 0 ? 'CURDATE()' : date(m.off);
  w(`SET @ing = (SELECT id FROM ingredients WHERE code = '${code('NL', m.i)}');`);
  w(`SET @cost = ${m.cost === null ? '(SELECT avg_cost FROM ingredients WHERE id = @ing)' : m.cost};`);
  w(`SET @k = CONCAT('${m.prefix}', DATE_FORMAT(${monthExpr}, '%y%m'));`);
  w(`INSERT INTO doc_sequences (seq_key, last_no) VALUES (@k, 1) ON DUPLICATE KEY UPDATE last_no = last_no + 1;`);
  w(`SET @no = (SELECT last_no FROM doc_sequences WHERE seq_key = @k COLLATE utf8mb4_unicode_ci);`);
  w(`INSERT INTO stock_transactions (ingredient_id, txn_type, move_type, doc_code, quantity_change, unit_cost, reason, created_by, created_at) VALUES (@ing, '${txn}', '${m.type}', CONCAT(@k, '-', LPAD(@no, 3, '0')), ${m.qty}, @cost, ${m.type === 'opening' ? "'Tồn đầu kỳ'" : "'Xuất cho bếp'"}, @thao, ${m.at});`);
  if (m.type === 'opening') w(`UPDATE ingredients SET avg_cost = ${m.cost} WHERE id = @ing;`);
});
w();
w(`UPDATE ingredients SET alert_level = CASE WHEN stock_qty <= 0 THEN 'out' WHEN stock_qty <= min_level THEN 'low' ELSE 'ok' END;`);
w();
w(`/* ---------------------------------------------------------------- Thông báo mẫu
   Kho: cảnh báo sắp hết / hết hàng gửi Quản lý kho và Quản lý nhà hàng. Đặt bàn: gửi Quản lý nhà hàng. */`);
const ntf = (type, title, content, refTable, refExpr, minutesAgo, roles, readFor = []) => {
  w(`INSERT INTO notifications (type_code, title, content, ref_table, ref_id, created_at) VALUES ('${type}', ${q(title)}, ${q(content)}, ${q(refTable)}, ${refExpr}, NOW() - INTERVAL ${minutesAgo} MINUTE);`);
  w(`SET @ntf = LAST_INSERT_ID();`);
  w(`INSERT INTO notification_recipients (notification_id, user_id, is_read, read_at) SELECT @ntf, u.id, IF(r.code IN (${readFor.map(q).join(',') || "''"}), 1, 0), IF(r.code IN (${readFor.map(q).join(',') || "''"}), NOW(), NULL) FROM users u JOIN roles r ON r.id = u.role_id WHERE r.code IN (${roles.map(q).join(',')}) AND u.deleted_at IS NULL AND u.status = 'active';`);
};
const ingRef = (i) => `(SELECT id FROM ingredients WHERE code = '${code('NL', i)}')`;
ntf('inventory', 'T-bone bò Úc đã hết hàng', 'Tồn kho về 0 kg (tối thiểu 3 kg). Nhà cung cấp Phương Nam đã ngừng hoạt động, cần chọn nhà cung cấp khác.', 'ingredients', ingRef(10), 26, ['warehouse', 'manager']);
ntf('inventory', 'Thăn ngoại bò Úc (striploin) sắp hết', 'Tồn 3,5 kg, không quá mức tối thiểu 5 kg.', 'ingredients', ingRef(1), 96, ['warehouse', 'manager']);
ntf('inventory', 'Bánh phở tươi sắp hết', 'Tồn 6 kg, không quá mức tối thiểu 8 kg.', 'ingredients', ingRef(5), 180, ['warehouse', 'manager'], ['manager']);
ntf('inventory', 'Hành lá sắp hết', 'Tồn 0,8 kg, không quá mức tối thiểu 1 kg.', 'ingredients', ingRef(17), 300, ['warehouse', 'manager'], ['warehouse']);
ntf('inventory', 'Trứng gà sắp hết', 'Tồn 45 quả, không quá mức tối thiểu 60 quả.', 'ingredients', ingRef(22), 420, ['warehouse', 'manager'], ['warehouse', 'manager']);
const resRef = (offset) => `(SELECT id FROM (SELECT id FROM reservations ORDER BY id DESC LIMIT 1 OFFSET ${offset}) x)`;
ntf('reservation', 'Yêu cầu đặt bàn mới', 'Có yêu cầu đặt bàn mới đang chờ xác nhận.', 'reservations', resRef(0), 4, ['manager']);
ntf('reservation', 'Lịch đặt sắp đến giờ', 'Một lịch đặt bàn sẽ đến giờ trong 30 phút tới.', 'reservations', resRef(1), 52, ['manager']);
ntf('reservation', 'Khách hủy đặt bàn', 'Một lịch đặt bàn đã được khách hủy.', 'reservations', resRef(2), 240, ['manager'], ['manager']);

writeFileSync(process.argv[2], out.join('\n') + '\n', 'utf8');
console.log('ok', out.length, 'lines');
