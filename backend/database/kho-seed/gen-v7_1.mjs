// Sinh backend/src/main/resources/db/dev/V7_1__kho_mau.sql
// Chạy (từ thư mục backend): node database/kho-seed/gen-v7_1.mjs src/main/resources/db/dev/V7_1__kho_mau.sql
// LƯU Ý: V7_1 đã chạy trên CSDL dev thì KHÔNG sửa file SQL nữa (Flyway báo sai checksum) — thêm file seed mới.
import { writeFileSync } from 'node:fs';

const SPECS = [
  ['Tôm sú tươi', 'seafood', 'kg', 6, 280000, 1.2, 4.5, 'Bảo quản ngăn đá, dùng trong 2 ngày.'],
  ['Thịt ba chỉ', 'meat', 'kg', 5, 140000, 1.0, null, ''],
  ['Cá basa phi lê', 'seafood', 'kg', 5, 90000, 1.1, null, ''],
  ['Đùi gà', 'meat', 'kg', 8, 75000, 1.6, null, ''],
  ['Đậu hũ non', 'other', 'hộp', 20, 8000, 4, 16, ''],
  ['Nấm đông cô', 'dry', 'kg', 2, 220000, 0.25, null, ''],
  ['Mực ống', 'seafood', 'kg', 4, 210000, 0.7, null, ''],
  ['Nghêu', 'seafood', 'kg', 5, 60000, 1.0, null, ''],
  ['Sườn non heo', 'meat', 'kg', 5, 160000, 0.8, null, ''],
  ['Thịt bò thăn Úc', 'meat', 'kg', 4, 450000, 0.6, 0, ''],
  ['Rau xà lách', 'produce', 'kg', 3, 35000, 0.9, null, ''],
  ['Cà chua', 'produce', 'kg', 4, 28000, 0.8, null, ''],
  ['Hành lá', 'produce', 'kg', 1, 40000, 0.3, 0.8, ''],
  ['Rau muống', 'produce', 'bó', 10, 8000, 3, null, ''],
  ['Gạo ST25', 'dry', 'kg', 20, 32000, 4, null, ''],
  ['Bún tươi', 'other', 'kg', 5, 15000, 2, null, ''],
  ['Trứng gà', 'dairy', 'quả', 60, 3500, 18, 45, ''],
  ['Sữa tươi không đường', 'dairy', 'lít', 5, 36000, 1, null, ''],
  ['Nước mắm Phú Quốc', 'spice', 'chai', 6, 45000, 0.5, null, ''],
  ['Dầu ăn', 'spice', 'lít', 10, 42000, 1.5, null, ''],
  ['Đường cát trắng', 'spice', 'kg', 5, 22500, 0.6, null, ''],
  ['Coca-Cola lon', 'drink', 'lon', 48, 10000, 20, null, ''],
  ['Nước suối Aquafina', 'drink', 'chai', 48, 5500, 15, null, ''],
  ['Bia Saigon lon', 'drink', 'lon', 48, 15000, 24, null, ''],
  ['Nước cam ép hộp', 'drink', 'hộp', 12, 12000, 1, null, 'Ngừng phục vụ từ tháng này, dùng hết phần còn lại.'],
  ['Lá chanh', 'spice', 'kg', 0.3, 0, 0, null, 'Mới thêm, chưa nhập hàng.'],
];
// Tồn của 6 nguyên liệu đã có trong V1_1 (đã nhập "Tồn đầu kỳ" ở đó).
const EXISTING_QTY = { 1: 12, 2: 10, 3: 4, 4: 15, 5: 40, 6: 3 };

const SUPPLIERS = [
  ['Hải sản Phú Quốc', '0912000111', 'cash', 'Anh Trần Văn Lộc', 'hssanphuquoc@gmail.com', '', '1701234567', 'Chợ Bình Điền, Quận 8, TP.HCM', 'Giao trước 7 giờ sáng.'],
  ['Công ty Thực phẩm Đại Phát', '0912000222', 'transfer', 'Chị Lê Ngọc Mai', 'kinhdoanh@daiphatfood.vn', 'https://daiphatfood.vn', '0312345678', 'KCN Tân Bình, TP.HCM', 'Công nợ 15 ngày.'],
  ['Rau sạch Đà Lạt Xanh', '0903456789', 'cash', 'Anh Nguyễn Hữu Phúc', 'dalatxanh@gmail.com', '', '', 'Chợ đầu mối Thủ Đức, TP.HCM', ''],
  ['Đại lý nước giải khát Minh Phát', '02876543210', 'transfer', 'Anh Võ Minh Phát', 'minhphat.beverage@gmail.com', '', '0309876543', '45 Lũy Bán Bích, Tân Phú, TP.HCM', 'Giao thùng nguyên đai.'],
  ['Gia vị Hương Việt', '0938111222', 'transfer', 'Chị Phạm Thu Hương', 'huongviet.spice@gmail.com', 'https://giavihuongviet.vn', '0315556677', '12 Nguyễn Trãi, Quận 5, TP.HCM', ''],
  ['Thịt bò nhập khẩu Phương Nam', '0909888777', 'transfer', 'Anh Đỗ Quang Huy', 'phuongnambeef@gmail.com', '', '0318889990', '88 Tô Hiến Thành, Quận 10, TP.HCM', ''],
];

const LINKS = [
  [1, 1, 'kg', 1, 280000, 2], [1, 3, 'kg', 1, 90000, 3], [1, 7, 'kg', 1, 210000, 2], [1, 8, 'kg', 1, 60000, 5],
  [2, 1, 'kg', 1, 295000, null], [2, 2, 'kg', 1, 140000, 3], [2, 4, 'kg', 1, 75000, 5], [2, 9, 'kg', 1, 160000, 2],
  [2, 15, 'bao', 25, 800000, 1], [2, 17, 'khay', 30, 105000, 2], [2, 18, 'lít', 1, 36000, null], [2, 22, 'lốc', 6, 63000, null],
  [3, 5, 'khay', 10, 80000, 1], [3, 11, 'kg', 1, 35000, null], [3, 12, 'kg', 1, 28000, null], [3, 13, 'kg', 1, 40000, null],
  [3, 14, 'bó', 1, 8000, 10], [3, 16, 'kg', 1, 15000, 5],
  [4, 22, 'thùng', 24, 240000, 2], [4, 23, 'thùng', 24, 132000, 2], [4, 24, 'thùng', 24, 360000, 2],
  [5, 6, 'kg', 1, 220000, null], [5, 19, 'thùng', 12, 540000, null], [5, 20, 'can', 5, 210000, 2], [5, 21, 'kg', 1, 22500, 5],
  [6, 10, 'kg', 1, 450000, 3],
];
// [số thứ tự liên kết, giá cũ, ngày đổi (lệch so với hôm nay)]
const PRICE_CHANGES = [[1, 270000, -20], [9, 780000, -9], [19, 228000, -6]];

const RECIPES = [
  ['MA001', [[1, 0.08], [2, 0.06], [16, 0.05], [11, 0.03]]],
  ['MA002', [[5, 1], [6, 0.03]]],
  ['MA003', [[3, 0.35], [19, 0.02], [21, 0.02]]],
  ['MA004', [[4, 0.4]]],
  ['MA006', [[10, 0.2], [12, 0.05]]],
  ['MA008', [[15, 0.2], [1, 0.05], [7, 0.05], [17, 1]]],
  ['MA011', [[8, 0.4], [13, 0.02]]],
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
   Sinh tự động — trùng bộ dữ liệu giả của frontend (src/mocks/warehouse.ts):
   26 nguyên liệu (NL001–NL006 đã có từ V1_1), 6 nhà cung cấp, 26 liên kết giá theo đơn vị mua,
   lịch sử đổi giá, công thức định lượng (giả — sau này đầu bếp nhập), tồn đầu kỳ và vài lần xuất bếp
   để có đủ trạng thái Đủ hàng / Sắp hết / Hết hàng. Ngày tháng tính lùi từ ngày chạy migration.
   ===================================================================== */
`);
w(`SET @thao = (SELECT id FROM users WHERE username = 'thao.bui');`);
w(`SET @tuan = (SELECT id FROM users WHERE username = 'tuan.nguyen');`);
w();
w('/* ---------------------------------------------------------------- Nguyên liệu */');
SPECS.forEach(([name, group, unit, min, , , , note], idx) => {
  const i = idx + 1;
  const created = name === 'Lá chanh' ? day(-2, '15:00:00') : day(-35);
  if (EXISTING_QTY[i] !== undefined) {
    w(`UPDATE ingredients SET group_key = ${q(group)}, note = ${q(note)}, created_by = @thao, created_at = ${created} WHERE code = '${code('NL', i)}';`);
  } else {
    w(`INSERT INTO ingredients (code, name, group_key, unit, min_level, avg_cost, is_active, note, created_by, created_at) VALUES ('${code('NL', i)}', ${q(name)}, ${q(group)}, ${q(unit)}, ${min}, NULL, ${name === 'Nước cam ép hộp' ? 0 : 1}, ${q(note)}, @thao, ${created});`);
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
w(`UPDATE suppliers SET is_active = 0, stop_reason = 'price', stop_note = 'Giá thịt bò tăng 20% so với nhà cung cấp khác.' WHERE code = 'NCC006';`);
w(`INSERT INTO supplier_status_events (supplier_id, is_active, reason, note, created_by, created_at) SELECT id, 0, 'price', 'Giá thịt bò tăng 20% so với nhà cung cấp khác.', @thao, ${day(-4, '10:30:00')} FROM suppliers WHERE code = 'NCC006';`);
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
  items.forEach(([i, qty]) => {
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
ntf('inventory', 'Thịt bò thăn Úc đã hết hàng', 'Tồn kho về 0 kg (tối thiểu 4 kg). Nhà cung cấp Phương Nam đã ngừng hoạt động, cần chọn nhà cung cấp khác.', 'ingredients', ingRef(10), 26, ['warehouse', 'manager']);
ntf('inventory', 'Tôm sú tươi sắp hết', 'Tồn 4,5 kg, không quá mức tối thiểu 6 kg.', 'ingredients', ingRef(1), 96, ['warehouse', 'manager']);
ntf('inventory', 'Đậu hũ non sắp hết', 'Tồn 16 hộp, không quá mức tối thiểu 20 hộp.', 'ingredients', ingRef(5), 180, ['warehouse', 'manager'], ['manager']);
ntf('inventory', 'Hành lá sắp hết', 'Tồn 0,8 kg, không quá mức tối thiểu 1 kg.', 'ingredients', ingRef(13), 300, ['warehouse', 'manager'], ['warehouse']);
ntf('inventory', 'Trứng gà sắp hết', 'Tồn 45 quả, không quá mức tối thiểu 60 quả.', 'ingredients', ingRef(17), 420, ['warehouse', 'manager'], ['warehouse', 'manager']);
const resRef = (offset) => `(SELECT id FROM (SELECT id FROM reservations ORDER BY id DESC LIMIT 1 OFFSET ${offset}) x)`;
ntf('reservation', 'Yêu cầu đặt bàn mới', 'Có yêu cầu đặt bàn mới đang chờ xác nhận.', 'reservations', resRef(0), 4, ['manager']);
ntf('reservation', 'Lịch đặt sắp đến giờ', 'Một lịch đặt bàn sẽ đến giờ trong 30 phút tới.', 'reservations', resRef(1), 52, ['manager']);
ntf('reservation', 'Khách hủy đặt bàn', 'Một lịch đặt bàn đã được khách hủy.', 'reservations', resRef(2), 240, ['manager'], ['manager']);

writeFileSync(process.argv[2], out.join('\n') + '\n', 'utf8');
console.log('ok', out.length, 'lines');
