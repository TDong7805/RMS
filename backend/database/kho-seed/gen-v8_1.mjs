// Sinh backend/src/main/resources/db/dev/V8_1__kho_phieu_mua_mau.sql
// Chạy (từ thư mục backend): node database/kho-seed/gen-v8_1.mjs src/main/resources/db/dev/V8_1__kho_phieu_mua_mau.sql
// LƯU Ý: V8_1 đã chạy trên CSDL dev thì KHÔNG sửa file SQL nữa (Flyway báo sai checksum) — thêm file seed mới.
//
// Phiếu mua đủ các trạng thái: đã nhận đủ (có thuế, giảm giá, chi phí khác), nhận một phần rồi kết thúc,
// nhận một phần và trễ hạn, chưa nhận, đã hủy, nháp; kèm một phiếu nhập không phiếu (mua lẻ ở chợ).
// Giá lấy theo liên kết nhà cung cấp trong V7_1 (đúng giá đang áp dụng ở ngày đặt).
import { writeFileSync } from 'node:fs';

// [mã NL, đơn vị mua, hệ số]
const LINK = {
  NL001: ['kg', 1], NL005: ['khay', 10], NL007: ['kg', 1], NL008: ['kg', 1], NL009: ['kg', 1], NL011: ['kg', 1],
  NL012: ['kg', 1], NL013: ['kg', 1], NL014: ['bó', 1], NL015: ['bao', 25], NL016: ['kg', 1], NL018: ['lít', 1],
  NL019: ['thùng', 12], NL020: ['can', 5], NL021: ['kg', 1], NL022: ['thùng', 24], NL023: ['thùng', 24], NL024: ['thùng', 24],
};

// Mỗi phiếu: lines [mã NL, SL đặt, đơn giá]; receipts [{day, qty: {mã: SL}}]
const POS = [
  { sup: 'NCC004', day: -28, expected: -27, name: 'Mua nước giải khát tuần 1', tax: 10, lines: [['NL022', 4, 228000], ['NL023', 3, 132000], ['NL024', 4, 360000]],
    receipts: [{ day: -27, qty: { NL022: 4, NL023: 3, NL024: 4 }, note: 'Anh Phát giao, hóa đơn 0012345' }] },
  { sup: 'NCC001', day: -21, expected: -20, name: 'Mua hải sản cuối tuần', other: 30000, lines: [['NL007', 5, 210000], ['NL008', 8, 60000]],
    receipts: [{ day: -20, qty: { NL007: 5, NL008: 8 } }] },
  { sup: 'NCC003', day: -16, expected: -15, name: 'Mua rau củ đầu tuần', lines: [['NL014', 20, 8000], ['NL016', 10, 15000], ['NL012', 6, 28000]],
    receipts: [{ day: -15, qty: { NL014: 20, NL016: 6, NL012: 6 }, note: 'Bún giao thiếu 4 kg' }],
    close: { day: -12, reason: 'short', note: 'Nhà cung cấp báo hết bún, không giao phần còn lại' } },
  { sup: 'NCC005', day: -14, expected: -13, name: 'Mua gia vị tháng', discount: 50000, tax: 8, lines: [['NL019', 1, 540000], ['NL020', 3, 210000], ['NL021', 5, 22500]],
    receipts: [{ day: -13, qty: { NL019: 1, NL020: 3, NL021: 5 } }] },
  { sup: 'NCC004', day: -10, expected: -9, name: 'Mua bia bổ sung', lines: [['NL024', 2, 360000]],
    cancel: { day: -9, reason: 'wrong', note: 'Trùng với phiếu đã đặt qua điện thoại' } },
  { sup: 'NCC002', day: -7, expected: -5, name: 'Mua thịt, gạo, sữa', lines: [['NL009', 6, 160000], ['NL015', 1, 800000], ['NL018', 10, 36000]],
    receipts: [{ day: -5, qty: { NL009: 6, NL015: 1 }, note: 'Sữa hẹn giao sau' }], late: true },
  { sup: 'NCC003', day: -2, expected: 1, name: 'Mua rau, đậu hũ', lines: [['NL005', 3, 80000], ['NL013', 2, 40000], ['NL011', 4, 35000]] },
  { sup: 'NCC001', day: 0, expected: null, name: 'Mua tôm sú', draft: true, lines: [['NL001', 5, 280000]], note: 'Chờ báo giá tôm tuần này' },
];
const DIRECT = { day: -9, source: 'Chợ Bến Thành', note: 'Mua gấp cho tiệc tối', lines: [['NL012', 'kg', 3, 30000], ['NL011', 'kg', 2, 38000]] };

const out = [];
const w = (s = '') => out.push(s);
const q = (s) => (s === null || s === undefined || s === '' ? 'NULL' : `'${String(s).replace(/'/g, "''")}'`);
const date = (off) => `CURDATE() - INTERVAL ${-off} DAY`;
const day = (off, time) => `TIMESTAMP(CURDATE() - INTERVAL ${-off} DAY, '${time}')`;
const money = (v) => Math.round(v);

function nextCode(prefix, off) {
  w(`SET @k = CONCAT('${prefix}', DATE_FORMAT(${date(off)}, '%y%m'));`);
  w(`INSERT INTO doc_sequences (seq_key, last_no) VALUES (@k, 1) ON DUPLICATE KEY UPDATE last_no = last_no + 1;`);
  w(`SET @no = (SELECT last_no FROM doc_sequences WHERE seq_key = @k COLLATE utf8mb4_unicode_ci);`);
  w(`SET @code = CONCAT(@k, '-', LPAD(@no, 3, '0'));`);
}

w(`/* =====================================================================
   V8_1 — DỮ LIỆU MẪU phiếu mua + nhập kho (chỉ môi trường dev, [FAKE-DATA])
   Sinh tự động bằng backend/database/kho-seed/gen-v8_1.mjs. Ngày tháng tính lùi từ ngày chạy migration.
   8 phiếu mua (đã nhận đủ, nhận một phần rồi kết thúc, nhận một phần + trễ hạn, chưa nhận, đã hủy, nháp)
   và 1 phiếu nhập không phiếu. Chưa có thanh toán (đợt 3).
   ===================================================================== */
`);
w(`SET @thao = (SELECT id FROM users WHERE username = 'thao.bui');`);
w();

POS.forEach((po, pi) => {
  const n = pi + 1;
  const sub = po.lines.reduce((s, [, qty, price]) => s + money(qty * price), 0);
  const discount = po.discount ?? 0;
  const status = po.draft ? 'draft' : po.cancel ? 'cancelled' : 'ordered';
  w(`/* ---------------------------------------------------------------- Phiếu mua ${n}: ${po.name} */`);
  nextCode('PM', po.day);
  w(`INSERT INTO purchase_orders (code, name, supplier_id, status, receive_status, order_date, ordered_at, ordered_by, expected_at, note, discount, tax_percent, other_cost, late_notified, created_by, created_at)
SELECT @code, ${q(po.name)}, s.id, '${status}', 'not_received', ${date(po.day)}, ${po.draft ? 'NULL' : day(po.day, '09:10:00')}, ${po.draft ? 'NULL' : '@thao'}, ${po.expected === null ? 'NULL' : date(po.expected)}, ${q(po.note)}, ${discount}, ${po.tax ?? 0}, ${po.other ?? 0}, ${po.late ? 1 : 0}, @thao, ${day(po.day, '09:00:00')} FROM suppliers s WHERE s.code = '${po.sup}';`);
  w(`SET @po${n} = LAST_INSERT_ID();`);
  w(`INSERT INTO purchase_order_events (purchase_order_id, event, created_by, created_at) VALUES (@po${n}, 'create', @thao, ${day(po.day, '09:00:00')});`);
  if (!po.draft) w(`INSERT INTO purchase_order_events (purchase_order_id, event, created_by, created_at) VALUES (@po${n}, 'order', @thao, ${day(po.day, '09:10:00')});`);
  po.lines.forEach(([code, qty, price], li) => {
    const [unit, factor] = LINK[code];
    w(`INSERT INTO purchase_order_items (purchase_order_id, ingredient_id, purchase_unit, factor, qty_ordered, unit_price, sort_order) SELECT @po${n}, id, '${unit}', ${factor}, ${qty}, ${price}, ${li} FROM ingredients WHERE code = '${code}';`);
    w(`SET @poi${n}_${code} = LAST_INSERT_ID();`);
  });
  (po.receipts ?? []).forEach((r) => {
    w(`-- Phiếu nhập theo phiếu mua ${n}`);
    nextCode('PN', r.day);
    const total = Object.entries(r.qty).reduce((s, [code, qty]) => s + money(qty * po.lines.find((l) => l[0] === code)[2]), 0);
    w(`INSERT INTO goods_receipts (code, kind, purchase_order_id, supplier_id, note, total_value, created_by, created_at) SELECT @code, 'po', @po${n}, supplier_id, ${q(r.note)}, ${total}, @thao, ${day(r.day, '10:00:00')} FROM purchase_orders WHERE id = @po${n};`);
    w(`SET @gr = LAST_INSERT_ID();`);
    Object.entries(r.qty).forEach(([code, qty]) => {
      const [unit, factor] = LINK[code];
      const price = po.lines.find((l) => l[0] === code)[2];
      const stockQty = Math.round(qty * factor * 1000) / 1000;
      const cost = Math.round((price / factor) * (1 - (sub ? discount / sub : 0)) * 100) / 100;
      lineSql({ code, unit, factor, qty, price, stockQty, cost, poi: `@poi${n}_${code}`, at: day(r.day, '10:00:00'), move: 'po_receipt', reason: 'Nhận hàng theo phiếu mua' });
    });
  });
  if (po.receipts) {
    const allDone = po.lines.every(([code, qty]) => po.receipts.reduce((s, r) => s + (r.qty[code] ?? 0), 0) >= qty);
    w(`UPDATE purchase_orders SET receive_status = '${po.close ? 'closed' : allDone ? 'received' : 'partial'}' WHERE id = @po${n};`);
  }
  if (po.close) w(`INSERT INTO purchase_order_events (purchase_order_id, event, reason, note, created_by, created_at) VALUES (@po${n}, 'close', '${po.close.reason}', ${q(po.close.note)}, @thao, ${day(po.close.day, '16:00:00')});`);
  if (po.cancel) w(`INSERT INTO purchase_order_events (purchase_order_id, event, reason, note, created_by, created_at) VALUES (@po${n}, 'cancel', '${po.cancel.reason}', ${q(po.cancel.note)}, @thao, ${day(po.cancel.day, '08:45:00')});`);
  if (po.late) {
    w(`INSERT INTO notifications (type_code, title, content, ref_table, ref_id, created_at) SELECT 'purchase', CONCAT('Phiếu mua ', code, ' trễ hạn'), CONCAT('Công ty Thực phẩm Đại Phát chưa giao đủ hàng, dự kiến nhận ngày ', DATE_FORMAT(expected_at, '%d/%m/%Y'), '.'), 'purchase_orders', id, ${day(po.expected + 1, '08:00:00')} FROM purchase_orders WHERE id = @po${n};`);
    w(`SET @ntf = LAST_INSERT_ID();`);
    w(`INSERT INTO notification_recipients (notification_id, user_id) SELECT @ntf, u.id FROM users u JOIN roles r ON r.id = u.role_id WHERE r.code = 'warehouse' AND u.deleted_at IS NULL AND u.status = 'active';`);
  }
  w();
});

function lineSql({ code, unit, factor, qty, price, stockQty, cost, poi, at, move, reason }) {
  w(`SET @ing = (SELECT id FROM ingredients WHERE code = '${code}');`);
  w(`SET @q = (SELECT stock_qty FROM ingredients WHERE id = @ing);`);
  w(`SET @c = (SELECT avg_cost FROM ingredients WHERE id = @ing);`);
  w(`INSERT INTO goods_receipt_items (receipt_id, ingredient_id, purchase_order_item_id, unit, factor, qty, unit_price, amount, stock_qty, stock_unit_cost, prev_qty, prev_avg_cost) VALUES (@gr, @ing, ${poi}, '${unit}', ${factor}, ${qty}, ${price}, ${money(qty * price)}, ${stockQty}, ${cost}, @q, @c);`);
  w(`INSERT INTO stock_transactions (ingredient_id, txn_type, move_type, doc_code, quantity_change, unit_cost, purchase_order_item_id, receipt_id, reason, created_by, created_at) VALUES (@ing, 'import', '${move}', @code, ${stockQty}, ${cost}, ${poi}, @gr, ${q(reason)}, @thao, ${at});`);
  w(`UPDATE ingredients SET avg_cost = IF(@q <= 0 OR @c IS NULL, ${cost}, ROUND((@q * @c + ${stockQty} * ${cost}) / (@q + ${stockQty}), 2)) WHERE id = @ing;`);
  if (poi !== 'NULL') w(`UPDATE purchase_order_items SET qty_received = qty_received + ${qty} WHERE id = ${poi};`);
}

w(`/* ---------------------------------------------------------------- Nhập không phiếu (mua lẻ) */`);
nextCode('PN', DIRECT.day);
const dTotal = DIRECT.lines.reduce((s, [, , qty, price]) => s + money(qty * price), 0);
w(`INSERT INTO goods_receipts (code, kind, source_name, note, total_value, created_by, created_at) VALUES (@code, 'direct', ${q(DIRECT.source)}, ${q(DIRECT.note)}, ${dTotal}, @thao, ${day(DIRECT.day, '15:30:00')});`);
w(`SET @gr = LAST_INSERT_ID();`);
DIRECT.lines.forEach(([code, unit, qty, price]) => {
  lineSql({ code, unit, factor: 1, qty, price, stockQty: qty, cost: price, poi: 'NULL', at: day(DIRECT.day, '15:30:00'), move: 'direct_receipt', reason: `Nhập không phiếu – ${DIRECT.source}` });
});
w();
w(`UPDATE ingredients SET alert_level = CASE WHEN stock_qty <= 0 THEN 'out' WHEN stock_qty <= min_level THEN 'low' ELSE 'ok' END;`);

writeFileSync(process.argv[2], out.join('\n') + '\n', 'utf8');
console.log('ok', out.length, 'lines');
