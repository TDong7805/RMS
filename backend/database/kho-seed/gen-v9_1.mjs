// Sinh backend/src/main/resources/db/dev/V9_1__kho_xuat_kiem_ke_mau.sql
// Chạy (từ thư mục backend): node database/kho-seed/gen-v9_1.mjs src/main/resources/db/dev/V9_1__kho_xuat_kiem_ke_mau.sql
// LƯU Ý: V9_1 đã chạy trên CSDL dev thì KHÔNG sửa file SQL nữa (Flyway báo sai checksum) — thêm file seed mới.
//
// Phiếu xuất 10 ngày gần đây (cho bếp, hủy hư hỏng / hết hạn), 3 phiếu kiểm kê (đã duyệt, bị từ chối, chờ duyệt)
// và các lần thanh toán để công nợ có số liệu. Chỉ dùng nguyên liệu còn dư tồn để không làm đổi trạng thái demo
// Sắp hết / Hết hàng của V7_1.
import { writeFileSync } from 'node:fs';

// [ngày, lý do, ghi chú, [[mã NL, SL]]] — chỉ nguyên liệu còn dư tồn (không đụng NL001, NL005, NL010, NL017, NL022)
const ISSUES = [
  [-10, 'kitchen', '', [['NL026', 24], ['NL020', 8], ['NL025', 3]]],
  [-8, 'kitchen', '', [['NL014', 12], ['NL004', 3], ['NL013', 2]]],
  [-7, 'damaged', 'Thùng bia vỡ 3 chai khi vận chuyển', [['NL026', 3]]],
  [-6, 'kitchen', '', [['NL009', 2], ['NL020', 6], ['NL024', 1]]],
  [-4, 'kitchen', '', [['NL026', 24], ['NL019', 6], ['NL023', 0.5]]],
  [-3, 'expired', 'Bún bò quá hạn sử dụng', [['NL021', 2]]],
  [-2, 'kitchen', '', [['NL008', 1], ['NL015', 1], ['NL016', 2]]],
  [-1, 'other', 'Biếu đối tác dùng thử', [['NL027', 1]]],
  [0, 'kitchen', '', [['NL020', 5], ['NL025', 2], ['NL024', 1]]],
];

// Phiếu kiểm kê: [ngày lập, trạng thái, lý do từ chối, ghi chú, [[mã NL, chênh lệch, lý do, ghi chú]]]
const STOCKTAKES = [
  [-12, 'approved', null, 'Kiểm kê rau củ giữa tháng', [['NL018', -4, 'natural', ''], ['NL016', -0.5, 'damaged', 'Dập nát'], ['NL015', 0, null, '']]],
  [-3, 'rejected', 'Đếm lại dầu ăn, chênh lệch quá lớn', 'Kiểm kê gia vị', [['NL025', -3, 'lost', ''], ['NL024', 0, null, '']]],
  [-1, 'pending', null, 'Kiểm kê đồ khô cuối tuần', [['NL020', -2, 'natural', ''], ['NL006', 0.1, 'wrong_entry', 'Nhập thiếu lần trước'], ['NL014', 0, null, '']]],
];

// Thanh toán: [tên phiếu mua trong V8_1 (duy nhất), ngày, số tiền, phương thức, mã tham chiếu]
// Phiếu 1: (2×1.248.000 + 2.520.000) × 1,1 = 5.517.600. Phiếu 4: (1.390.000 − 50.000) × 1,08 = 1.447.200.
const PAYMENTS = [
  ['Mua bia & vang tuần 1', -25, 5517600, 'transfer', 'VCB 0123456'],
  ['Nhập bò Úc cuối tuần', -19, 5000000, 'transfer', 'VCB 0123789'],
  ['Mua gia vị tháng', -12, 1447200, 'transfer', 'ACB 7788991'],
  ['Mua rau củ đầu tuần', -11, 200000, 'cash', ''],
];

const REASON_MOVE = { kitchen: 'issue_kitchen', damaged: 'issue_waste', expired: 'issue_waste', other: 'issue_other' };
const REASON_LABEL = { kitchen: 'Xuất cho bếp', damaged: 'Hủy – hư hỏng', expired: 'Hủy – hết hạn', other: 'Khác' };

const out = [];
const w = (s = '') => out.push(s);
const q = (s) => (s === null || s === undefined || s === '' ? 'NULL' : `'${String(s).replace(/'/g, "''")}'`);
const date = (off) => `CURDATE() - INTERVAL ${-off} DAY`;
const day = (off, time) => (off === 0 ? `LEAST(NOW(), TIMESTAMP(CURDATE(), '${time}'))` : `TIMESTAMP(CURDATE() - INTERVAL ${-off} DAY, '${time}')`);

function nextCode(prefix, off) {
  w(`SET @k = CONCAT('${prefix}', DATE_FORMAT(${date(off)}, '%y%m'));`);
  w(`INSERT INTO doc_sequences (seq_key, last_no) VALUES (@k, 1) ON DUPLICATE KEY UPDATE last_no = last_no + 1;`);
  w(`SET @no = (SELECT last_no FROM doc_sequences WHERE seq_key = @k COLLATE utf8mb4_unicode_ci);`);
  w(`SET @code = CONCAT(@k, '-', LPAD(@no, 3, '0'));`);
}

w(`/* =====================================================================
   V9_1 — DỮ LIỆU MẪU xuất kho, kiểm kê, thanh toán NCC (chỉ môi trường dev, [FAKE-DATA])
   Sinh tự động bằng backend/database/kho-seed/gen-v9_1.mjs. Ngày tháng tính lùi từ ngày chạy migration.
   ===================================================================== */
`);
w(`SET @thao = (SELECT id FROM users WHERE username = 'thao.bui');`);
w(`SET @tuan = (SELECT id FROM users WHERE username = 'tuan.nguyen');`);
w(`SET @hung = (SELECT id FROM users WHERE username = 'hung.pham');`);
w();

w('/* ---------------------------------------------------------------- Phiếu xuất */');
ISSUES.forEach(([off, reason, note, lines], idx) => {
  const time = `${String(10 + (idx % 6)).padStart(2, '0')}:15:00`;
  nextCode('PX', off);
  w(`INSERT INTO stock_issues (code, reason, receiver_id, note, created_by, created_at) VALUES (@code, '${reason}', ${reason === 'kitchen' ? '@hung' : 'NULL'}, ${q(note)}, @thao, ${day(off, time)});`);
  w(`SET @iss = LAST_INSERT_ID();`);
  lines.forEach(([code, qty]) => {
    w(`SET @ing = (SELECT id FROM ingredients WHERE code = '${code}');`);
    w(`SET @c = (SELECT avg_cost FROM ingredients WHERE id = @ing);`);
    w(`INSERT INTO stock_issue_items (issue_id, ingredient_id, qty, unit_cost, value) VALUES (@iss, @ing, ${qty}, @c, ROUND(${qty} * COALESCE(@c, 0)));`);
    w(`INSERT INTO stock_transactions (ingredient_id, txn_type, move_type, doc_code, quantity_change, unit_cost, issue_id, reason, created_by, created_at) VALUES (@ing, 'export', '${REASON_MOVE[reason]}', @code, ${-qty}, @c, @iss, ${q(REASON_LABEL[reason] + (note ? ': ' + note : ''))}, @thao, ${day(off, time)});`);
  });
  w(`UPDATE stock_issues SET total_value = (SELECT COALESCE(SUM(value), 0) FROM stock_issue_items WHERE issue_id = @iss) WHERE id = @iss;`);
});
w();

w('/* ---------------------------------------------------------------- Phiếu kiểm kê */');
STOCKTAKES.forEach(([off, status, rejectReason, note, lines], idx) => {
  nextCode('KK', off);
  w(`INSERT INTO stocktakes (code, scope, note, status, reject_reason, submitted_at, approved_by, approved_at, created_by, created_at) VALUES (@code, 'pick', ${q(note)}, '${status}', ${q(rejectReason)}, ${day(off, '17:00:00')}, ${status === 'approved' ? '@tuan' : 'NULL'}, ${status === 'approved' ? day(off + 1, '09:00:00') : 'NULL'}, @thao, ${day(off, '15:00:00')});`);
  w(`SET @stk = LAST_INSERT_ID();`);
  w(`INSERT INTO stocktake_events (stocktake_id, event, created_by, created_at) VALUES (@stk, 'create', @thao, ${day(off, '15:00:00')}), (@stk, 'submit', @thao, ${day(off, '17:00:00')});`);
  if (status === 'approved') w(`INSERT INTO stocktake_events (stocktake_id, event, created_by, created_at) VALUES (@stk, 'approve', @tuan, ${day(off + 1, '09:00:00')});`);
  if (status === 'rejected') w(`INSERT INTO stocktake_events (stocktake_id, event, note, created_by, created_at) VALUES (@stk, 'reject', ${q(rejectReason)}, @tuan, ${day(off + 1, '08:30:00')});`);
  lines.forEach(([code, diff, reason, lineNote]) => {
    w(`SET @ing = (SELECT id FROM ingredients WHERE code = '${code}');`);
    w(`SET @book = (SELECT stock_qty FROM ingredients WHERE id = @ing);`);
    w(`SET @c = (SELECT avg_cost FROM ingredients WHERE id = @ing);`);
    const adjust = status === 'approved' && diff !== 0;
    w(`INSERT INTO stocktake_items (stocktake_id, ingredient_id, book_qty, actual_qty, counted_at, reason, note, adjust_unit_cost, adjust_value) VALUES (@stk, @ing, @book, @book + (${diff}), ${day(off, '16:00:00')}, ${q(reason)}, ${q(lineNote)}, ${adjust ? '@c' : 'NULL'}, ${adjust ? `ROUND(${diff} * COALESCE(@c, 0))` : 'NULL'});`);
    if (adjust) {
      w(`INSERT INTO stock_transactions (ingredient_id, txn_type, move_type, doc_code, quantity_change, unit_cost, stocktake_id, reason, created_by, created_at) VALUES (@ing, 'adjust', 'stocktake', @code, ${diff}, @c, @stk, CONCAT('Điều chỉnh kiểm kê ', @code), @tuan, ${day(off + 1, '09:00:00')});`);
    }
  });
  if (status === 'pending') {
    w(`INSERT INTO notifications (type_code, title, content, ref_table, ref_id, created_at) VALUES ('stocktake', CONCAT('Phiếu kiểm kê ', @code, ' chờ duyệt'), '2 dòng chênh lệch, xem chi tiết để duyệt hoặc từ chối.', 'stocktakes', @stk, ${day(off, '17:00:00')});`);
    w(`INSERT INTO notification_recipients (notification_id, user_id) SELECT LAST_INSERT_ID(), u.id FROM users u JOIN roles r ON r.id = u.role_id WHERE r.code = 'manager' AND u.deleted_at IS NULL AND u.status = 'active';`);
  }
  if (status === 'rejected') {
    w(`INSERT INTO notifications (type_code, title, content, ref_table, ref_id, created_at) VALUES ('stocktake', CONCAT('Phiếu kiểm kê ', @code, ' bị từ chối: ', ${q(rejectReason)}), 'Kiểm tra lại, sửa và gửi duyệt lại.', 'stocktakes', @stk, ${day(off + 1, '08:30:00')});`);
    w(`INSERT INTO notification_recipients (notification_id, user_id) VALUES (LAST_INSERT_ID(), @thao);`);
  }
});
w();

w('/* ---------------------------------------------------------------- Thanh toán nhà cung cấp */');
PAYMENTS.forEach(([poName, off, amount, method, ref]) => {
  nextCode('TT', off);
  w(`INSERT INTO supplier_payments (code, supplier_id, purchase_order_id, amount, method, reference, paid_at, created_by) SELECT @code, supplier_id, id, ${amount}, '${method}', ${q(ref)}, ${day(off, '14:00:00')}, @thao FROM purchase_orders WHERE name = ${q(poName)} LIMIT 1;`);
});
w();
w(`UPDATE ingredients SET alert_level = CASE WHEN stock_qty <= 0 THEN 'out' WHEN stock_qty <= min_level THEN 'low' ELSE 'ok' END;`);

writeFileSync(process.argv[2], out.join('\n') + '\n', 'utf8');
console.log('ok', out.length, 'lines');
