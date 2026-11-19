// Sinh backend/src/main/resources/db/dev/V8_1__kho_phieu_mua_mau.sql
// Chạy (từ thư mục backend): node database/kho-seed/gen-v8_1.mjs src/main/resources/db/dev/V8_1__kho_phieu_mua_mau.sql
// LƯU Ý: V8_1 đã chạy trên CSDL dev thì KHÔNG sửa file SQL nữa (Flyway báo sai checksum) — thêm file seed mới.
//
// Phiếu mua đủ các trạng thái: đã nhận đủ (có thuế, giảm giá, chi phí khác), nhận một phần rồi kết thúc,
// nhận một phần và trễ hạn, chưa nhận, đã hủy, nháp; kèm một phiếu nhập không phiếu (mua lẻ ở chợ).
// Giá lấy theo liên kết nhà cung cấp trong V7_1 (đúng giá đang áp dụng ở ngày đặt).
import { writeFileSync } from 'node:fs';

// [mã NL, đơn vị mua, hệ số] — khớp liên kết nhà cung cấp trong gen-v7_1.mjs
const LINK = {
  NL002: ['kg', 1], NL003: ['kg', 1], NL009: ['kg', 1], NL001: ['kg', 1], NL004: ['kg', 1], NL005: ['kg', 1],
  NL006: ['kg', 1], NL015: ['kg', 1], NL016: ['kg', 1], NL017: ['kg', 1], NL018: ['bó', 1], NL020: ['bao', 25],
  NL021: ['kg', 1], NL022: ['khay', 30], NL024: ['thùng', 12], NL025: ['can', 5], NL026: ['thùng', 24], NL027: ['thùng', 6],
};

// Mỗi phiếu: lines [mã NL, SL đặt, đơn giá (giá đang áp dụng ở ngày đặt)]; receipts [{day, qty: {mã: SL}}]
// Không nhận hàng cho nguyên liệu đang demo Sắp hết / Hết hàng (NL001, NL005, NL010, NL017, NL022) để giữ trạng thái đó.
const POS = [
  { sup: 'NCC004', day: -28, expected: -27, name: 'Mua bia & vang tuần 1', tax: 10, lines: [['NL026', 2, 1248000], ['NL027', 1, 2520000]],
    receipts: [{ day: -27, qty: { NL026: 2, NL027: 1 }, note: 'Anh Phát giao, hóa đơn 0012345' }] },
  { sup: 'NCC001', day: -21, expected: -20, name: 'Nhập bò Úc cuối tuần', other: 50000, lines: [['NL002', 3, 780000], ['NL003', 5, 650000], ['NL009', 4, 420000]],
    receipts: [{ day: -20, qty: { NL002: 3, NL003: 5, NL009: 4 }, note: 'Hàng lạnh, nhiệt độ khi nhận 2°C' }] },
  { sup: 'NCC003', day: -16, expected: -15, name: 'Mua rau củ đầu tuần', lines: [['NL018', 20, 8000], ['NL021', 10, 16000], ['NL016', 6, 28000]],
    receipts: [{ day: -15, qty: { NL018: 20, NL021: 6, NL016: 6 }, note: 'Bún bò giao thiếu 4 kg' }],
    close: { day: -12, reason: 'short', note: 'Nhà cung cấp báo hết bún bò, không giao phần còn lại' } },
  { sup: 'NCC005', day: -14, expected: -13, name: 'Mua gia vị tháng', discount: 50000, tax: 8, lines: [['NL024', 1, 540000], ['NL025', 3, 210000], ['NL006', 1, 220000]],
    receipts: [{ day: -13, qty: { NL024: 1, NL025: 3, NL006: 1 } }] },
  { sup: 'NCC004', day: -10, expected: -9, name: 'Mua bia bổ sung', lines: [['NL026', 1, 1248000]],
    cancel: { day: -9, reason: 'wrong', note: 'Trùng với phiếu đã đặt qua điện thoại' } },
  { sup: 'NCC002', day: -7, expected: -5, name: 'Mua bắp bò, gạo, trứng', lines: [['NL004', 8, 260000], ['NL020', 1, 800000], ['NL022', 2, 105000]],
    receipts: [{ day: -5, qty: { NL004: 8, NL020: 1 }, note: 'Trứng hẹn giao sau' }], late: true },
  { sup: 'NCC003', day: -2, expected: 1, name: 'Mua rau, bánh phở', lines: [['NL005', 10, 18000], ['NL017', 2, 40000], ['NL015', 4, 35000]] },
  { sup: 'NCC001', day: 0, expected: null, name: 'Nhập thăn bò Úc', draft: true, lines: [['NL001', 5, 520000]], note: 'Chờ báo giá bò tuần này' },
];
const DIRECT = { day: -9, source: 'Chợ Bến Thành', note: 'Mua gấp cho tiệc tối', lines: [['NL016', 'kg', 3, 30000], ['NL015', 'kg', 2, 38000]] };

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
