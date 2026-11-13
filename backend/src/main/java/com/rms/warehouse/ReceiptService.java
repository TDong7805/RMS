package com.rms.warehouse;

import com.rms.audit.AuditService;
import com.rms.common.BusinessException;
import com.rms.common.CurrentUserService;
import com.rms.common.Db;
import com.rms.common.Ids;
import com.rms.common.Paged;
import com.rms.common.Times;
import com.rms.common.ValidationException;
import com.rms.common.Vi;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * UC-KHO-17 (nhận hàng theo phiếu mua), UC-KHO-18 (nhập không phiếu), UC-KHO-19 (lịch sử nhập, hủy phiếu nhập),
 * và phiếu "Tồn đầu kỳ" khi thêm nguyên liệu (UC-KHO-03).
 *
 * Mỗi lần nhập tạo MỘT phiếu nhập (PN…), lưu theo nguyên tắc tất cả hoặc không gì. Mỗi dòng ghi sổ kho theo đơn vị kho
 * (SL × hệ số), cập nhật giá vốn bình quân, và lưu lại tồn + giá vốn ngay trước khi nhập để hủy thì trả về đúng như cũ.
 */
@Service
public class ReceiptService {
    static final int PAGE_SIZE = IngredientService.PAGE_SIZE;
    static final int MAX_RANGE_DAYS = 366;
    private static final String NOT_FOUND = "Không tìm thấy phiếu nhập";

    public record ReceiptRow(String id, String code, String at, String kind, String purchaseOrderId, String purchaseOrderCode,
                             String source, int itemCount, double value, String by, String status) {}

    public record ReceiptPage(List<ReceiptRow> items, int total, int page, int pageCount, double totalValue) {}

    public record ReceiptLine(String id, String ingredientId, String ingredientCode, String ingredientName, String stockUnit,
                              String unit, double factor, double qty, double stockQty, double unitPrice, double stockUnitCost,
                              double amount, String note) {}

    public record ReceiptDetail(String id, String code, String at, String kind, String purchaseOrderId,
                                String purchaseOrderCode, String supplierId, String source, String note, double value,
                                String by, String status, String cancelReason, String cancelledBy, String cancelledAt,
                                boolean canCancel, String cannotCancelReason, List<ReceiptLine> lines) {}

    public record ReceiveLine(String purchaseOrderItemId, BigDecimal qty, String note) {}

    public record ReceiveInput(List<ReceiveLine> lines, String note) {}

    public record DirectLine(String ingredientId, String unit, BigDecimal qty, BigDecimal unitPrice) {}

    public record DirectInput(String supplierId, String sourceName, String note, List<DirectLine> lines) {}

    public record CancelInput(String reason) {}

    private final JdbcClient jdbc;
    private final AuditService audit;
    private final CurrentUserService currentUser;
    private final WarehouseCodes codes;
    private final StockLedger ledger;
    private final PurchaseOrderService purchases;

    public ReceiptService(JdbcClient jdbc, AuditService audit, CurrentUserService currentUser, WarehouseCodes codes,
                          StockLedger ledger, PurchaseOrderService purchases) {
        this.jdbc = jdbc;
        this.audit = audit;
        this.currentUser = currentUser;
        this.codes = codes;
        this.ledger = ledger;
        this.purchases = purchases;
    }

    private long userId() {
        return currentUser.get().id();
    }

    /* ------------------------------------------------------------------ Ghi phiếu nhập */

    private record NewLine(long ingredientId, Long poItemId, String unit, BigDecimal factor, BigDecimal qty,
                           BigDecimal unitPrice, BigDecimal stockUnitCost, String note) {
        BigDecimal stockQty() {
            return qty.multiply(factor).setScale(3, RoundingMode.HALF_UP);
        }

        BigDecimal amount() {
            return PurchaseMath.money(qty.multiply(unitPrice));
        }
    }

    /** Tạo phiếu nhập + ghi sổ từng dòng; trả về id phiếu. moveType: po_receipt | direct_receipt | opening. */
    private long post(String kind, String moveType, Long poId, Long supplierId, String source, String note, List<NewLine> lines,
                      String reason) {
        String code = codes.document("PN", Times.today());
        BigDecimal total = lines.stream().map(NewLine::amount).reduce(BigDecimal.ZERO, BigDecimal::add);
        jdbc.sql("""
                INSERT INTO goods_receipts (code, kind, purchase_order_id, supplier_id, source_name, note, total_value, created_by)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """)
            .params(code, kind, poId, supplierId, source, note == null || note.isEmpty() ? null : note, total, userId())
            .update();
        long receiptId = jdbc.sql("SELECT LAST_INSERT_ID()").query(Long.class).single();
        for (NewLine l : lines) {
            BigDecimal[] before = ledger.qtyAndCost(l.ingredientId());
            jdbc.sql("""
                    INSERT INTO goods_receipt_items (receipt_id, ingredient_id, purchase_order_item_id, unit, factor, qty, unit_price,
                                                     amount, stock_qty, stock_unit_cost, prev_qty, prev_avg_cost, note)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """)
                .params(receiptId, l.ingredientId(), l.poItemId(), l.unit(), l.factor(), l.qty(), l.unitPrice(), l.amount(),
                    l.stockQty(), l.stockUnitCost(), before[0], before[1], l.note() == null || l.note().isEmpty() ? null : l.note())
                .update();
            ledger.record(l.ingredientId(), moveType, l.stockQty(), l.stockUnitCost(), code, reason, l.poItemId(), receiptId);
        }
        return receiptId;
    }

    /** UC-KHO-03: tồn ban đầu khi thêm nguyên liệu → phiếu nhập "Tồn đầu kỳ". */
    @Transactional
    public String createOpening(long ingredientId, String unit, BigDecimal qty, BigDecimal cost) {
        long id = post("opening", "opening", null, null, null, "Tồn đầu kỳ",
            List.of(new NewLine(ingredientId, null, unit, BigDecimal.ONE, qty, cost, cost.setScale(2, RoundingMode.HALF_UP), null)),
            "Tồn đầu kỳ");
        return jdbc.sql("SELECT code FROM goods_receipts WHERE id = ?").param(id).query(String.class).single();
    }

    /** UC-KHO-17: nhận hàng theo phiếu mua (nhận được nhiều lần). */
    @Transactional
    public ReceiptDetail receive(String poIdText, ReceiveInput in) {
        long poId = Ids.parse(poIdText, "Không tìm thấy phiếu mua");
        PurchaseOrderService.Po po = purchases.lockedPo(poId).stream().findFirst()
            .orElseThrow(() -> BusinessException.notFound("Không tìm thấy phiếu mua"));
        if (!"ordered".equals(po.status()) || !Set.of("not_received", "partial").contains(po.receiveStatus())) {
            throw new BusinessException("Phiếu mua không còn ở trạng thái chờ nhận hàng");
        }
        List<PurchaseOrderService.Item> items = purchases.items("WHERE poi.purchase_order_id = ?", poId);
        Map<Long, PurchaseOrderService.Item> byId = new HashMap<>();
        items.forEach(i -> byId.put(i.id(), i));
        BigDecimal subtotal = PurchaseMath.subtotal(items.stream().map(i -> new PurchaseMath.Line(i.qtyOrdered(), i.unitPrice())).toList());
        BigDecimal discount = PurchaseOrderService.money(po, items, BigDecimal.ZERO).totals().discount();

        var v = new ValidationException.Collector();
        String note = Vi.trim(in.note());
        if (note.length() > 500) v.add("note", "Ghi chú tối đa 500 ký tự");
        List<ReceiveLine> inputs = in.lines() == null ? List.of() : in.lines();
        List<NewLine> lines = new ArrayList<>();
        for (int i = 0; i < inputs.size(); i++) {
            ReceiveLine l = inputs.get(i);
            String key = "lines." + i + ".";
            Long itemId = Ids.parseOrNull(l.purchaseOrderItemId());
            PurchaseOrderService.Item it = itemId == null ? null : byId.get(itemId);
            if (it == null) {
                v.add(key + "qty", "Dòng không thuộc phiếu mua này");
                continue;
            }
            BigDecimal qty = l.qty() == null ? BigDecimal.ZERO : l.qty();
            String lineNote = Vi.trim(l.note());
            if (lineNote.length() > 200) v.add(key + "note", "Ghi chú dòng tối đa 200 ký tự");
            if (!WarehouseFormat.validQty(qty)) {
                v.add(key + "qty", "Số lượng không hợp lệ");
                continue;
            }
            BigDecimal remaining = it.qtyOrdered().subtract(it.qtyReceived());
            if (qty.compareTo(remaining) > 0) {
                v.add(key + "qty", "Không được nhận quá số còn lại (" + WarehouseFormat.qty(remaining) + " " + it.purchaseUnit()
                    + "). Hàng giao dư vui lòng trả lại nhà cung cấp hoặc nhập bằng Nhập kho không phiếu.");
                continue;
            }
            if (qty.signum() == 0) continue;
            lines.add(new NewLine(it.ingredientId(), it.id(), it.purchaseUnit(), it.factor(), qty, it.unitPrice(),
                PurchaseMath.stockUnitCost(it.unitPrice(), it.factor(), discount, subtotal), lineNote));
        }
        if (v.isEmpty() && lines.isEmpty()) v.add("lines", "Vui lòng nhập số lượng nhận cho ít nhất một nguyên liệu");
        v.throwIfAny();

        long receiptId = post("po", "po_receipt", poId, po.supplierId(), null, note, lines, "Nhận hàng theo " + po.code());
        for (NewLine l : lines) {
            jdbc.sql("UPDATE purchase_order_items SET qty_received = qty_received + ? WHERE id = ?").params(l.qty(), l.poItemId()).update();
        }
        purchases.refreshReceiveStatus(poId);
        ReceiptDetail d = detail(Ids.str(receiptId));
        audit.log("warehouse", "Nhận hàng theo phiếu mua", "Nhập kho " + d.code() + " theo " + po.code() + " – "
            + po.supplierName() + ", " + lines.size() + " nguyên liệu", "goods_receipts", receiptId);
        return d;
    }

    /** UC-KHO-18: nhập kho không có phiếu mua (đã thanh toán ngay, không phát sinh công nợ). */
    @Transactional
    public ReceiptDetail direct(DirectInput in) {
        var v = new ValidationException.Collector();
        Long supplierId = Ids.parseOrNull(in.supplierId());
        String source = Vi.collapse(in.sourceName());
        String supplierName = null;
        Map<Long, Object[]> links = new HashMap<>();
        if (supplierId == null) {
            if (source.isEmpty()) v.add("sourceName", "Vui lòng nhập tên nơi mua");
            else if (source.length() > 150) v.add("sourceName", "Tên nơi mua tối đa 150 ký tự");
        } else {
            var sup = jdbc.sql("SELECT name, is_active FROM suppliers WHERE id = ?").param(supplierId)
                .query((rs, n) -> new Object[] {rs.getString("name"), rs.getBoolean("is_active")}).optional().orElse(null);
            if (sup == null) v.add("supplierId", "Vui lòng chọn nơi mua");
            else if (!(Boolean) sup[1]) v.add("supplierId", "Nhà cung cấp " + sup[0] + " đã ngừng hoạt động");
            else {
                supplierName = (String) sup[0];
                jdbc.sql("SELECT ingredient_id, purchase_unit, factor FROM supplier_ingredients WHERE supplier_id = ? AND is_active = 1")
                    .param(supplierId)
                    .query((rs, n) -> new Object[] {rs.getLong("ingredient_id"), rs.getString("purchase_unit"), rs.getBigDecimal("factor")})
                    .list().forEach(r -> links.put((Long) r[0], r));
            }
            source = null;
        }
        String note = Vi.trim(in.note());
        if (note.length() > 500) v.add("note", "Ghi chú tối đa 500 ký tự");
        List<DirectLine> inputs = in.lines() == null ? List.of() : in.lines();
        if (inputs.isEmpty()) v.add("lines", "Phiếu nhập cần ít nhất một nguyên liệu");
        List<NewLine> lines = new ArrayList<>();
        Set<Long> seen = new HashSet<>();
        for (int i = 0; i < inputs.size(); i++) {
            DirectLine l = inputs.get(i);
            String key = "lines." + i + ".";
            Long ingId = Ids.parseOrNull(l.ingredientId());
            var ing = ingId == null ? null : jdbc.sql("SELECT name, unit, is_active FROM ingredients WHERE id = ?").param(ingId)
                .query((rs, n) -> new Object[] {rs.getString("name"), rs.getString("unit"), rs.getBoolean("is_active")})
                .optional().orElse(null);
            if (ing == null) {
                v.add(key + "ingredientId", "Vui lòng chọn nguyên liệu");
                continue;
            }
            if (!(Boolean) ing[2]) v.add(key + "ingredientId", "Nguyên liệu " + ing[0] + " đã ngừng sử dụng");
            if (!seen.add(ingId)) v.add(key + "ingredientId", "Nguyên liệu bị chọn trùng");
            String stockUnit = (String) ing[1];
            String unit = Vi.blank(l.unit()) ? stockUnit : l.unit();
            BigDecimal factor = BigDecimal.ONE;
            Object[] link = links.get(ingId);
            if (!unit.equals(stockUnit)) {
                if (link != null && unit.equals(link[1])) factor = (BigDecimal) link[2];
                else v.add(key + "unit", "Đơn vị không hợp lệ");
            }
            BigDecimal qty = l.qty();
            if (qty == null || qty.signum() <= 0 || !WarehouseFormat.validQty(qty)) v.add(key + "qty", "Số lượng phải lớn hơn 0");
            BigDecimal price = l.unitPrice();
            if (!WarehouseFormat.validMoney(price)) v.add(key + "unitPrice", "Đơn giá phải lớn hơn 0");
            if (qty != null && qty.signum() > 0 && WarehouseFormat.validMoney(price)) {
                lines.add(new NewLine(ingId, null, unit, factor, qty, price,
                    price.divide(factor, 2, RoundingMode.HALF_UP), null));
            }
        }
        v.throwIfAny();
        long receiptId = post("direct", "direct_receipt", null, supplierId, source, note, lines,
            "Nhập không phiếu – " + (supplierName != null ? supplierName : source));
        ReceiptDetail d = detail(Ids.str(receiptId));
        audit.log("warehouse", "Nhập kho không phiếu", "Nhập kho " + d.code() + " – " + d.source() + ", " + lines.size()
            + " nguyên liệu, " + WarehouseFormat.money(BigDecimal.valueOf(d.value())), "goods_receipts", receiptId);
        return d;
    }

    /* ------------------------------------------------------------------ UC-KHO-19: lịch sử nhập kho */

    private record Head(long id, String code, java.time.LocalDateTime at, String kind, Long poId, String poCode, Long supplierId,
                        String source, String note, BigDecimal value, String by, String status, String cancelReason,
                        String cancelledBy, java.time.LocalDateTime cancelledAt, int itemCount) {}

    private List<Head> heads(String where, Object... params) {
        return jdbc.sql("""
                SELECT r.*, po.code AS po_code, s.name AS supplier_name, u.full_name AS by_name, cu.full_name AS cancel_name,
                       (SELECT COUNT(*) FROM goods_receipt_items gi WHERE gi.receipt_id = r.id) AS item_count
                FROM goods_receipts r
                LEFT JOIN purchase_orders po ON po.id = r.purchase_order_id
                LEFT JOIN suppliers s ON s.id = r.supplier_id
                LEFT JOIN users u ON u.id = r.created_by LEFT JOIN users cu ON cu.id = r.cancelled_by
                %s ORDER BY r.created_at DESC, r.id DESC
                """.formatted(where))
            .params(params)
            .query((rs, n) -> {
                String source = rs.getString("supplier_name") != null ? rs.getString("supplier_name")
                    : rs.getString("source_name") != null ? rs.getString("source_name") : "";
                return new Head(rs.getLong("id"), rs.getString("code"), Db.dateTime(rs, "created_at"), rs.getString("kind"),
                    rs.getObject("purchase_order_id") == null ? null : rs.getLong("purchase_order_id"), rs.getString("po_code"),
                    rs.getObject("supplier_id") == null ? null : rs.getLong("supplier_id"), source,
                    Vi.trim(rs.getString("note")), rs.getBigDecimal("total_value"), Vi.trim(rs.getString("by_name")),
                    rs.getString("status"), rs.getString("cancel_reason"), rs.getString("cancel_name"),
                    Db.dateTime(rs, "cancelled_at"), rs.getInt("item_count"));
            })
            .list();
    }

    public ReceiptPage list(String keyword, String kind, String from, String to, int page) {
        LocalDate today = Times.today();
        LocalDate fromDate = Vi.blank(from) ? today.minusDays(29) : Times.parseDate(from);
        LocalDate toDate = Vi.blank(to) ? today : Times.parseDate(to);
        if (fromDate.isAfter(toDate)) throw new ValidationException("to", "Khoảng thời gian không hợp lệ");
        if (ChronoUnit.DAYS.between(fromDate, toDate) >= MAX_RANGE_DAYS) {
            throw new ValidationException("to", "Khoảng thời gian tối đa 366 ngày");
        }
        String k = Vi.trim(keyword);
        List<ReceiptRow> rows = heads("WHERE r.created_at >= ? AND r.created_at < ?", fromDate.atStartOfDay(),
                toDate.plusDays(1).atStartOfDay()).stream()
            .filter(h -> Vi.blank(kind) || "all".equals(kind) || h.kind().equals(kind))
            .filter(h -> k.isEmpty() || Vi.matches(h.code(), k) || (h.poCode() != null && Vi.matches(h.poCode(), k))
                || Vi.matches(h.source(), k))
            .map(h -> new ReceiptRow(Ids.str(h.id()), h.code(), Times.iso(h.at()), h.kind(), Ids.str(h.poId()), h.poCode(),
                h.source(), h.itemCount(), h.value().doubleValue(), h.by(), h.status()))
            .toList();
        double total = rows.stream().filter(r -> "posted".equals(r.status())).mapToDouble(ReceiptRow::value).sum();
        Paged<ReceiptRow> p = Paged.of(rows, page, PAGE_SIZE);
        return new ReceiptPage(p.items(), p.total(), p.page(), p.pageCount(), total);
    }

    public ReceiptDetail detail(String idText) {
        long id = Ids.parse(idText, NOT_FOUND);
        Head h = heads("WHERE r.id = ?", id).stream().findFirst().orElseThrow(() -> BusinessException.notFound(NOT_FOUND));
        List<ReceiptLine> lines = jdbc.sql("""
                SELECT gi.*, i.code AS ing_code, i.name AS ing_name, i.unit AS stock_unit
                FROM goods_receipt_items gi JOIN ingredients i ON i.id = gi.ingredient_id
                WHERE gi.receipt_id = ? ORDER BY gi.id
                """).param(id)
            .query((rs, n) -> new ReceiptLine(Ids.str(rs.getLong("id")), Ids.str(rs.getLong("ingredient_id")), rs.getString("ing_code"),
                rs.getString("ing_name"), rs.getString("stock_unit"), rs.getString("unit"), rs.getBigDecimal("factor").doubleValue(),
                rs.getBigDecimal("qty").doubleValue(), rs.getBigDecimal("stock_qty").doubleValue(),
                rs.getBigDecimal("unit_price").doubleValue(), rs.getBigDecimal("stock_unit_cost").doubleValue(),
                rs.getBigDecimal("amount").doubleValue(), Vi.trim(rs.getString("note"))))
            .list();
        String blocker = "posted".equals(h.status()) ? cancelBlocker(h) : "Phiếu nhập đã được hủy";
        return new ReceiptDetail(Ids.str(h.id()), h.code(), Times.iso(h.at()), h.kind(), Ids.str(h.poId()), h.poCode(),
            Ids.str(h.supplierId()), h.source(), h.note(), h.value().doubleValue(), h.by(), h.status(), h.cancelReason(),
            h.cancelledBy(), h.cancelledAt() == null ? null : Times.iso(h.cancelledAt()), blocker == null, blocker, lines);
    }

    /* ------------------------------------------------------------------ UC-KHO-19 (A): hủy phiếu nhập */

    private record Line(long itemId, long ingredientId, String ingredientName, Long poItemId, BigDecimal qty, BigDecimal stockQty,
                        BigDecimal prevAvgCost) {}

    private List<Line> lines(long receiptId) {
        return jdbc.sql("""
                SELECT gi.id, gi.ingredient_id, i.name, gi.purchase_order_item_id, gi.qty, gi.stock_qty, gi.prev_avg_cost
                FROM goods_receipt_items gi JOIN ingredients i ON i.id = gi.ingredient_id WHERE gi.receipt_id = ? ORDER BY gi.id
                """).param(receiptId)
            .query((rs, n) -> new Line(rs.getLong("id"), rs.getLong("ingredient_id"), rs.getString("name"),
                rs.getObject("purchase_order_item_id") == null ? null : rs.getLong("purchase_order_item_id"),
                rs.getBigDecimal("qty"), rs.getBigDecimal("stock_qty"), rs.getBigDecimal("prev_avg_cost")))
            .list();
    }

    /** Lý do không hủy được (null = hủy được) — kiểm tra theo quy tắc UC-KHO-19, trừ điều kiện "có lý do". */
    private String cancelBlocker(Head h) {
        for (Line l : lines(h.id())) {
            // Giao dịch kho khác của nguyên liệu ghi sau dòng sổ của phiếu này (theo đúng thứ tự thẻ kho).
            boolean later = jdbc.sql("""
                    SELECT COUNT(*) FROM stock_transactions t2
                    JOIN stock_transactions t ON t.receipt_id = ? AND t.ingredient_id = t2.ingredient_id
                    WHERE t2.ingredient_id = ? AND (t2.receipt_id IS NULL OR t2.receipt_id <> ?)
                      AND (t2.created_at > t.created_at OR (t2.created_at = t.created_at AND t2.id > t.id))
                    """).params(h.id(), l.ingredientId(), h.id()).query(Integer.class).single() > 0;
            if (later) {
                return "Không thể hủy: " + l.ingredientName() + " đã có giao dịch kho sau phiếu này. Hãy điều chỉnh số lượng qua kiểm kê.";
            }
        }
        if (h.poId() != null) {
            PurchaseOrderService.Po po = purchases.po(h.poId());
            if ("closed".equals(po.receiveStatus())) return "Không thể hủy phiếu nhập của phiếu mua đã kết thúc nhận hàng";
            BigDecimal payableAfter = payableAfterCancel(h.id(), h.poId());
            PurchaseOrderService.Money m = purchases.moneyOf(h.poId());
            if (m.paid().compareTo(payableAfter) > 0) {
                return "Phiếu mua " + po.code() + " đã thanh toán " + WarehouseFormat.money(m.paid())
                    + ", lớn hơn số phải trả sau khi hủy (" + WarehouseFormat.money(payableAfter)
                    + "). Hãy hủy bớt thanh toán trước.";
            }
        }
        return null;
    }

    private BigDecimal payableAfterCancel(long receiptId, long poId) {
        Map<Long, BigDecimal> minus = new HashMap<>();
        lines(receiptId).forEach(l -> minus.merge(l.poItemId(), l.qty(), BigDecimal::add));
        PurchaseOrderService.Po po = purchases.po(poId);
        List<PurchaseOrderService.Item> items = purchases.items("WHERE poi.purchase_order_id = ?", poId);
        List<PurchaseMath.Line> pl = items.stream().map(i -> new PurchaseMath.Line(i.qtyOrdered(), i.unitPrice())).toList();
        List<BigDecimal> received = items.stream()
            .map(i -> i.qtyReceived().subtract(minus.getOrDefault(i.id(), BigDecimal.ZERO))).toList();
        BigDecimal discount = PurchaseOrderService.money(po, items, BigDecimal.ZERO).totals().discount();
        return PurchaseMath.payable(pl, received, discount, po.taxPercent(), po.otherCost());
    }

    @Transactional
    public ReceiptDetail cancel(String idText, CancelInput in) {
        long id = Ids.parse(idText, NOT_FOUND);
        String reason = Vi.trim(in.reason());
        if (reason.length() < 5) throw new ValidationException("reason", "Vui lòng nhập lý do hủy (ít nhất 5 ký tự)");
        if (reason.length() > 300) throw new ValidationException("reason", "Lý do tối đa 300 ký tự");
        Head h = heads("WHERE r.id = ?", id).stream().findFirst().orElseThrow(() -> BusinessException.notFound(NOT_FOUND));
        jdbc.sql("SELECT id FROM goods_receipts WHERE id = ? FOR UPDATE").param(id).query(Long.class).single();
        if (!"posted".equals(h.status())) throw new BusinessException("Phiếu nhập đã được hủy");
        if (h.poId() != null) purchases.lockedPo(h.poId());
        String blocker = cancelBlocker(h);
        if (blocker != null) throw new BusinessException(blocker);

        for (Line l : lines(id)) {
            ledger.record(l.ingredientId(), "receipt_cancel", l.stockQty().negate(), null, h.code(), "Hủy phiếu nhập " + h.code()
                + ": " + reason, l.poItemId(), id);
            ledger.restoreAvgCost(l.ingredientId(), l.prevAvgCost());
            if (l.poItemId() != null) {
                jdbc.sql("UPDATE purchase_order_items SET qty_received = qty_received - ? WHERE id = ?").params(l.qty(), l.poItemId()).update();
            }
        }
        jdbc.sql("UPDATE goods_receipts SET status = 'cancelled', cancel_reason = ?, cancelled_by = ?, cancelled_at = ? WHERE id = ?")
            .params(reason, userId(), Times.now(), id).update();
        if (h.poId() != null) purchases.refreshReceiveStatus(h.poId());
        audit.log("warehouse", "Hủy phiếu nhập", "Hủy " + h.code() + (h.poCode() != null ? " (phiếu mua " + h.poCode() + ")" : "")
            + ": " + reason, "goods_receipts", id);
        return detail(Ids.str(id));
    }
}
