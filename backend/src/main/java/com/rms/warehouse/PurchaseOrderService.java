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
import com.rms.notification.NotificationService;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * UC-KHO-12..16: danh sách, tạo / sửa nháp / đặt hàng, xem chi tiết, hủy phiếu, kết thúc nhận hàng.
 *
 * Trạng thái (đặc tả mục 6): Đặt hàng draft → ordered → cancelled; Nhận hàng (khi ordered) not_received → partial
 * → received | closed; Thanh toán (khi ordered) tính từ Phải trả (theo hàng đã nhận) và các lần thanh toán còn hiệu lực.
 * Phiếu nháp lưu được dòng chưa đủ số lượng / đơn giá; khi đặt hàng mới kiểm tra đầy đủ và chốt đơn vị mua, hệ số, đơn giá.
 */
@Service
public class PurchaseOrderService {
    static final int PAGE_SIZE = IngredientService.PAGE_SIZE;
    static final int ORDER_DATE_BACK_DAYS = 7;
    static final Set<String> CANCEL_REASONS = Set.of("supplier_cannot", "wrong", "switch", "no_need", "other");
    static final Set<String> CLOSE_REASONS = Set.of("out_of_stock", "short", "no_need", "other");
    private static final DateTimeFormatter DMY = DateTimeFormatter.ofPattern("dd/MM/yyyy");
    private static final String NOT_FOUND = "Không tìm thấy phiếu mua";

    /* ------------------------------------------------------------------ Kiểu dữ liệu API */

    public record PurchaseOrderRow(String id, String code, String name, String supplierId, String supplierName,
                                   String orderDate, String expectedDate, String status, String receiveStatus,
                                   String paymentStatus, double total, double payable, double paid, double debt,
                                   boolean late, int lineCount, String createdAt) {}

    public record LineDto(String id, String ingredientId, String ingredientCode, String ingredientName, String stockUnit,
                          boolean ingredientActive, String purchaseUnit, double factor, Double qtyOrdered, double qtyReceived,
                          Double unitPrice, double amount, double onHand, CurrentLink currentLink) {}

    /** Liên kết hiện hành của nguyên liệu với NCC của phiếu (null = không còn liên kết). */
    public record CurrentLink(boolean active, String purchaseUnit, double factor, double price, Double minOrder) {}

    public record SupplierInfo(String id, String code, String name, String phone, String address, String paymentMethod,
                               boolean active) {}

    public record ReceiptRef(String id, String code, String at, String by, double value, String status) {}

    public record PaymentRef(String id, String code, String paidAt, double amount, String method, String by, String status) {}

    public record EventDto(String id, String event, String reason, String note, String by, String at) {}

    public record PurchaseOrderDetail(String id, String code, String name, SupplierInfo supplier, String orderDate,
                                      String expectedDate, String note, String status, String receiveStatus,
                                      String paymentStatus, boolean late, Double discountPercent, double discount,
                                      double taxPercent, double otherCost, double subtotal, double tax, double total,
                                      double payable, double paid, double debt, List<LineDto> lines,
                                      List<ReceiptRef> receipts, List<PaymentRef> payments, List<EventDto> events,
                                      String createdBy, String createdAt, String orderedBy, String orderedAt) {}

    public record LineInput(String ingredientId, BigDecimal qty, BigDecimal unitPrice) {}

    public record PurchaseOrderInput(String supplierId, String name, String orderDate, String expectedDate, String note,
                                     BigDecimal discountPercent, BigDecimal discount, BigDecimal taxPercent,
                                     BigDecimal otherCost, List<LineInput> lines) {}

    public record ReasonInput(String reason, String note) {}

    /* ------------------------------------------------------------------ Bản ghi nội bộ */

    record Po(long id, String code, String name, long supplierId, String supplierName, LocalDate orderDate,
              LocalDate expectedDate, String note, String status, String receiveStatus, BigDecimal discountPercent,
              BigDecimal discount, BigDecimal taxPercent, BigDecimal otherCost, LocalDateTime createdAt, String createdBy,
              LocalDateTime orderedAt, String orderedBy) {}

    record Item(long id, long poId, long ingredientId, String ingredientCode, String ingredientName, String stockUnit,
                boolean ingredientActive, BigDecimal onHand, String purchaseUnit, BigDecimal factor, BigDecimal qtyOrdered,
                BigDecimal qtyReceived, BigDecimal unitPrice) {}

    /** Số tiền của một phiếu: tổng theo phiếu, phải trả theo hàng đã nhận, đã trả (thanh toán còn hiệu lực). */
    record Money(PurchaseMath.Totals totals, BigDecimal payable, BigDecimal paid) {
        BigDecimal debt() {
            return payable.subtract(paid);
        }
    }

    private final JdbcClient jdbc;
    private final AuditService audit;
    private final CurrentUserService currentUser;
    private final WarehouseCodes codes;
    private final NotificationService notifications;

    public PurchaseOrderService(JdbcClient jdbc, AuditService audit, CurrentUserService currentUser, WarehouseCodes codes,
                                NotificationService notifications) {
        this.jdbc = jdbc;
        this.audit = audit;
        this.currentUser = currentUser;
        this.codes = codes;
        this.notifications = notifications;
    }

    /* ------------------------------------------------------------------ Đọc dữ liệu */

    List<Po> pos(String where, Object... params) {
        return jdbc.sql("""
                SELECT po.*, s.name AS supplier_name, cu.full_name AS created_name, ou.full_name AS ordered_name
                FROM purchase_orders po JOIN suppliers s ON s.id = po.supplier_id
                LEFT JOIN users cu ON cu.id = po.created_by LEFT JOIN users ou ON ou.id = po.ordered_by
                %s ORDER BY po.created_at DESC, po.id DESC
                """.formatted(where))
            .params(params)
            .query((rs, n) -> new Po(rs.getLong("id"), rs.getString("code"), rs.getString("name"), rs.getLong("supplier_id"),
                rs.getString("supplier_name"), rs.getObject("order_date", LocalDate.class),
                rs.getObject("expected_at", LocalDate.class), Vi.trim(rs.getString("note")), rs.getString("status"),
                rs.getString("receive_status"), rs.getBigDecimal("discount_percent"), rs.getBigDecimal("discount"),
                rs.getBigDecimal("tax_percent"), rs.getBigDecimal("other_cost"), Db.dateTime(rs, "created_at"),
                Vi.trim(rs.getString("created_name")), Db.dateTime(rs, "ordered_at"), Vi.trim(rs.getString("ordered_name"))))
            .list();
    }

    /** Khóa dòng phiếu mua trong giao dịch hiện tại rồi đọc lại (chống hai người cùng thao tác). */
    List<Po> lockedPo(long id) {
        jdbc.sql("SELECT id FROM purchase_orders WHERE id = ? FOR UPDATE").param(id).query(Long.class).optional();
        return pos("WHERE po.id = ?", id);
    }

    Po po(long id) {
        return pos("WHERE po.id = ?", id).stream().findFirst().orElseThrow(() -> BusinessException.notFound(NOT_FOUND));
    }

    List<Item> items(String where, Object... params) {
        return jdbc.sql("""
                SELECT poi.*, i.code AS ing_code, i.name AS ing_name, i.unit AS stock_unit, i.is_active AS ing_active, i.stock_qty
                FROM purchase_order_items poi JOIN ingredients i ON i.id = poi.ingredient_id
                %s ORDER BY poi.purchase_order_id, poi.sort_order, poi.id
                """.formatted(where))
            .params(params)
            .query((rs, n) -> new Item(rs.getLong("id"), rs.getLong("purchase_order_id"), rs.getLong("ingredient_id"),
                rs.getString("ing_code"), rs.getString("ing_name"), rs.getString("stock_unit"), rs.getBoolean("ing_active"),
                rs.getBigDecimal("stock_qty"), Vi.trim(rs.getString("purchase_unit")), rs.getBigDecimal("factor"),
                rs.getBigDecimal("qty_ordered"), rs.getBigDecimal("qty_received"), rs.getBigDecimal("unit_price")))
            .list();
    }

    private Map<Long, BigDecimal> paidByPo() {
        Map<Long, BigDecimal> out = new HashMap<>();
        jdbc.sql("SELECT purchase_order_id, SUM(amount) AS paid FROM supplier_payments WHERE status = 'valid' AND purchase_order_id IS NOT NULL GROUP BY purchase_order_id")
            .query((rs, n) -> Map.entry(rs.getLong("purchase_order_id"), rs.getBigDecimal("paid")))
            .list().forEach(e -> out.put(e.getKey(), e.getValue()));
        return out;
    }

    static Money money(Po po, List<Item> items, BigDecimal paid) {
        List<PurchaseMath.Line> lines = items.stream().map(i -> new PurchaseMath.Line(i.qtyOrdered(), i.unitPrice())).toList();
        PurchaseMath.Totals t = PurchaseMath.totals(lines, po.discountPercent(), po.discount(), po.taxPercent(), po.otherCost());
        BigDecimal payable = "ordered".equals(po.status())
            ? PurchaseMath.payable(lines, items.stream().map(Item::qtyReceived).toList(), t.discount(), po.taxPercent(), po.otherCost())
            : BigDecimal.ZERO;
        return new Money(t, payable, paid == null ? BigDecimal.ZERO : paid);
    }

    /** Trạng thái thanh toán (chỉ khi Đã đặt): unpaid | partial | paid. */
    static String paymentStatus(Po po, Money m) {
        if (!"ordered".equals(po.status())) return null;
        if (m.paid().signum() <= 0) return "unpaid";
        boolean finished = "received".equals(po.receiveStatus()) || "closed".equals(po.receiveStatus());
        return m.debt().signum() > 0 || !finished ? "partial" : "paid";
    }

    static boolean isLate(Po po) {
        return "ordered".equals(po.status()) && Set.of("not_received", "partial").contains(po.receiveStatus())
            && po.expectedDate() != null && po.expectedDate().isBefore(Times.today());
    }

    private static double d(BigDecimal v) {
        return v == null ? 0 : v.doubleValue();
    }

    private static Double dn(BigDecimal v) {
        return v == null ? null : v.doubleValue();
    }

    private static String date(LocalDate v) {
        return v == null ? null : v.toString();
    }

    /* ------------------------------------------------------------------ UC-KHO-12: danh sách */

    /** status: all | draft | waiting (Chưa nhận + Nhận một phần) | received | closed | cancelled. */
    public Paged<PurchaseOrderRow> list(String keyword, String supplierId, String status, String payment, String from,
                                        String to, int page) {
        return Paged.of(filtered(keyword, supplierId, status, payment, from, to), page, PAGE_SIZE);
    }

    List<PurchaseOrderRow> filtered(String keyword, String supplierId, String status, String payment, String from, String to) {
        LocalDate fromDate = Vi.blank(from) ? null : Times.parseDate(from);
        LocalDate toDate = Vi.blank(to) ? null : Times.parseDate(to);
        if (fromDate != null && toDate != null && fromDate.isAfter(toDate)) {
            throw new ValidationException("to", "Khoảng thời gian không hợp lệ");
        }
        Long sup = Ids.parseOrNull(supplierId);
        Map<Long, List<Item>> itemsByPo = new HashMap<>();
        items("").forEach(i -> itemsByPo.computeIfAbsent(i.poId(), k -> new ArrayList<>()).add(i));
        Map<Long, BigDecimal> paid = paidByPo();
        String k = Vi.trim(keyword);
        List<PurchaseOrderRow> rows = pos("").stream()
            .filter(p -> k.isEmpty() || Vi.matches(p.code(), k) || Vi.matches(p.name(), k) || Vi.matches(p.supplierName(), k))
            .filter(p -> sup == null || p.supplierId() == sup)
            .filter(p -> statusMatches(p, status))
            .filter(p -> fromDate == null || (p.orderDate() != null && !p.orderDate().isBefore(fromDate)))
            .filter(p -> toDate == null || (p.orderDate() != null && !p.orderDate().isAfter(toDate)))
            .map(p -> {
                List<Item> its = itemsByPo.getOrDefault(p.id(), List.of());
                Money m = money(p, its, paid.get(p.id()));
                return new PurchaseOrderRow(Ids.str(p.id()), p.code(), p.name(), Ids.str(p.supplierId()), p.supplierName(),
                    date(p.orderDate()), date(p.expectedDate()), p.status(), p.receiveStatus(), paymentStatus(p, m),
                    d(m.totals().total()), d(m.payable()), d(m.paid()), d(m.debt()), isLate(p), its.size(),
                    Times.iso(p.createdAt()));
            })
            .filter(r -> Vi.blank(payment) || "all".equals(payment) || payment.equals(r.paymentStatus()))
            .toList();
        return rows;
    }

    private static boolean statusMatches(Po p, String status) {
        if (Vi.blank(status) || "all".equals(status)) return true;
        return switch (status) {
            case "draft" -> "draft".equals(p.status());
            case "cancelled" -> "cancelled".equals(p.status());
            case "waiting" -> "ordered".equals(p.status()) && Set.of("not_received", "partial").contains(p.receiveStatus());
            case "received", "closed", "not_received", "partial" -> "ordered".equals(p.status()) && status.equals(p.receiveStatus());
            default -> true;
        };
    }

    /* ------------------------------------------------------------------ UC-KHO-14: chi tiết */

    public PurchaseOrderDetail detail(String idText) {
        long id = Ids.parse(idText, NOT_FOUND);
        Po p = po(id);
        List<Item> its = items("WHERE poi.purchase_order_id = ?", id);
        Money m = money(p, its, paidByPo().get(id));
        SupplierInfo sup = jdbc.sql("SELECT id, code, name, phone, address, payment_method, is_active FROM suppliers WHERE id = ?")
            .param(p.supplierId())
            .query((rs, n) -> new SupplierInfo(Ids.str(rs.getLong("id")), rs.getString("code"), rs.getString("name"),
                Vi.trim(rs.getString("phone")), Vi.trim(rs.getString("address")), rs.getString("payment_method"),
                rs.getBoolean("is_active")))
            .single();
        Map<Long, CurrentLink> links = new HashMap<>();
        jdbc.sql("SELECT ingredient_id, is_active, purchase_unit, factor, price, min_order FROM supplier_ingredients WHERE supplier_id = ?")
            .param(p.supplierId())
            .query((rs, n) -> Map.entry(rs.getLong("ingredient_id"), new CurrentLink(rs.getBoolean("is_active"),
                rs.getString("purchase_unit"), rs.getBigDecimal("factor").doubleValue(), rs.getBigDecimal("price").doubleValue(),
                rs.getBigDecimal("min_order") == null ? null : rs.getBigDecimal("min_order").doubleValue())))
            .list().forEach(e -> links.put(e.getKey(), e.getValue()));
        List<LineDto> lines = its.stream().map(i -> new LineDto(Ids.str(i.id()), Ids.str(i.ingredientId()), i.ingredientCode(),
            i.ingredientName(), i.stockUnit(), i.ingredientActive(), i.purchaseUnit(), d(i.factor()), dn(i.qtyOrdered()),
            d(i.qtyReceived()), dn(i.unitPrice()), d(PurchaseMath.lineAmount(i.qtyOrdered(), i.unitPrice())), d(i.onHand()),
            links.get(i.ingredientId()))).toList();
        List<ReceiptRef> receipts = jdbc.sql("""
                SELECT r.id, r.code, r.created_at, r.total_value, r.status, u.full_name
                FROM goods_receipts r LEFT JOIN users u ON u.id = r.created_by
                WHERE r.purchase_order_id = ? ORDER BY r.created_at DESC, r.id DESC
                """).param(id)
            .query((rs, n) -> new ReceiptRef(Ids.str(rs.getLong("id")), rs.getString("code"), Times.iso(Db.dateTime(rs, "created_at")),
                Vi.trim(rs.getString("full_name")), rs.getBigDecimal("total_value").doubleValue(), rs.getString("status")))
            .list();
        List<PaymentRef> payments = jdbc.sql("""
                SELECT p.id, p.code, p.paid_at, p.amount, p.method, p.status, u.full_name
                FROM supplier_payments p LEFT JOIN users u ON u.id = p.created_by
                WHERE p.purchase_order_id = ? ORDER BY p.paid_at DESC, p.id DESC
                """).param(id)
            .query((rs, n) -> new PaymentRef(Ids.str(rs.getLong("id")), Vi.trim(rs.getString("code")),
                Times.iso(Db.dateTime(rs, "paid_at")), rs.getBigDecimal("amount").doubleValue(), rs.getString("method"),
                Vi.trim(rs.getString("full_name")), rs.getString("status")))
            .list();
        List<EventDto> events = jdbc.sql("""
                SELECT e.id, e.event, e.reason, e.note, e.created_at, u.full_name
                FROM purchase_order_events e LEFT JOIN users u ON u.id = e.created_by
                WHERE e.purchase_order_id = ? ORDER BY e.created_at DESC, e.id DESC
                """).param(id)
            .query((rs, n) -> new EventDto(Ids.str(rs.getLong("id")), rs.getString("event"), rs.getString("reason"),
                Vi.trim(rs.getString("note")), Vi.trim(rs.getString("full_name")), Times.iso(Db.dateTime(rs, "created_at"))))
            .list();
        return new PurchaseOrderDetail(Ids.str(p.id()), p.code(), p.name(), sup, date(p.orderDate()), date(p.expectedDate()),
            p.note(), p.status(), p.receiveStatus(), paymentStatus(p, m), isLate(p), dn(p.discountPercent()),
            d(m.totals().discount()), d(p.taxPercent()), d(p.otherCost()), d(m.totals().subtotal()), d(m.totals().tax()),
            d(m.totals().total()), d(m.payable()), d(m.paid()), d(m.debt()), lines, receipts, payments, events, p.createdBy(),
            Times.iso(p.createdAt()), p.orderedBy().isEmpty() ? null : p.orderedBy(), p.orderedAt() == null ? null : Times.iso(p.orderedAt()));
    }

    /* ------------------------------------------------------------------ UC-KHO-13 / 15: tạo, sửa nháp, đặt hàng */

    private record LinkRow(long ingredientId, String ingredientName, boolean ingredientActive, boolean active,
                           String purchaseUnit, BigDecimal factor) {}

    private record CleanLine(long ingredientId, String purchaseUnit, BigDecimal factor, BigDecimal qty, BigDecimal price) {}

    private record Clean(long supplierId, String supplierName, String name, LocalDate orderDate, LocalDate expectedDate,
                         String note, BigDecimal discountPercent, BigDecimal discount, BigDecimal taxPercent,
                         BigDecimal otherCost, List<CleanLine> lines) {}

    private static boolean validPercent(BigDecimal v) {
        return v != null && v.signum() >= 0 && v.compareTo(PurchaseMath.HUNDRED) <= 0 && v.stripTrailingZeros().scale() <= 2;
    }

    /**
     * Kiểm tra dữ liệu phiếu. order = true: đủ điều kiện đặt hàng (9a–9g); false: lưu nháp (chỉ bắt buộc NCC + tên,
     * các ô đã nhập phải đúng kiểu). existing: dòng của phiếu nháp đang sửa — giữ đơn vị mua / hệ số đã lưu.
     */
    private Clean validate(PurchaseOrderInput in, boolean order, List<Item> existing) {
        var v = new ValidationException.Collector();
        Long supplierId = Ids.parseOrNull(in.supplierId());
        String supplierName = "";
        Map<Long, LinkRow> links = new HashMap<>();
        if (supplierId == null) v.add("supplierId", "Vui lòng chọn nhà cung cấp");
        else {
            var sup = jdbc.sql("SELECT name, is_active FROM suppliers WHERE id = ?").param(supplierId)
                .query((rs, n) -> new Object[] {rs.getString("name"), rs.getBoolean("is_active")}).optional().orElse(null);
            if (sup == null) v.add("supplierId", "Không tìm thấy nhà cung cấp");
            else {
                supplierName = (String) sup[0];
                if (order && !(Boolean) sup[1]) {
                    v.add("supplierId", "Nhà cung cấp " + supplierName + " đã ngừng hoạt động. Kích hoạt lại nhà cung cấp hoặc lưu nháp.");
                }
                jdbc.sql("""
                        SELECT si.ingredient_id, i.name, i.is_active AS ing_active, si.is_active, si.purchase_unit, si.factor
                        FROM supplier_ingredients si JOIN ingredients i ON i.id = si.ingredient_id WHERE si.supplier_id = ?
                        """).param(supplierId)
                    .query((rs, n) -> new LinkRow(rs.getLong("ingredient_id"), rs.getString("name"), rs.getBoolean("ing_active"),
                        rs.getBoolean("is_active"), rs.getString("purchase_unit"), rs.getBigDecimal("factor")))
                    .list().forEach(l -> links.put(l.ingredientId(), l));
            }
        }
        String name = Vi.collapse(in.name());
        if (name.isEmpty()) v.add("name", "Vui lòng nhập tên phiếu");
        else if (name.length() > 150) v.add("name", "Tên phiếu tối đa 150 ký tự");

        LocalDate today = Times.today();
        LocalDate orderDate = null;
        if (!Vi.blank(in.orderDate())) {
            try {
                orderDate = Times.parseDate(in.orderDate());
            } catch (RuntimeException e) {
                v.add("orderDate", "Ngày đặt hàng không hợp lệ");
            }
        }
        LocalDate minDate = today.minusDays(ORDER_DATE_BACK_DAYS);
        if (orderDate == null && order && !v.has("orderDate")) v.add("orderDate", "Vui lòng chọn ngày đặt hàng");
        else if (orderDate != null && order && (orderDate.isAfter(today) || orderDate.isBefore(minDate))) {
            v.add("orderDate", "Ngày đặt hàng phải từ " + minDate.format(DMY) + " đến hôm nay");
        } else if (orderDate != null && orderDate.isAfter(today)) {
            v.add("orderDate", "Ngày đặt hàng không được ở tương lai");
        }
        LocalDate expected = null;
        if (!Vi.blank(in.expectedDate())) {
            try {
                expected = Times.parseDate(in.expectedDate());
                if (orderDate != null && expected.isBefore(orderDate)) v.add("expectedDate", "Ngày dự kiến nhận không được trước ngày đặt hàng");
            } catch (RuntimeException e) {
                v.add("expectedDate", "Ngày dự kiến nhận không hợp lệ");
            }
        }
        String note = Vi.trim(in.note());
        if (note.length() > 500) v.add("note", "Ghi chú tối đa 500 ký tự");

        Map<Long, Item> saved = new HashMap<>();
        existing.forEach(i -> saved.put(i.ingredientId(), i));
        List<LineInput> inputs = in.lines() == null ? List.of() : in.lines();
        if (order && inputs.isEmpty()) v.add("lines", "Phiếu cần ít nhất một nguyên liệu");
        List<CleanLine> lines = new ArrayList<>();
        Set<Long> seen = new HashSet<>();
        for (int i = 0; i < inputs.size(); i++) {
            LineInput l = inputs.get(i);
            String key = "lines." + i + ".";
            Long ingId = Ids.parseOrNull(l.ingredientId());
            LinkRow link = ingId == null ? null : links.get(ingId);
            if (ingId == null) {
                v.add(key + "ingredientId", "Vui lòng chọn nguyên liệu");
                continue;
            }
            if (!seen.add(ingId)) v.add(key + "ingredientId", "Nguyên liệu bị chọn trùng");
            Item old = saved.get(ingId);
            if (link == null && old == null) {
                v.add(key + "ingredientId", "Nguyên liệu chưa có trong danh sách cung cấp của nhà cung cấp này");
                continue;
            }
            if (order && (link == null || !link.active() || !link.ingredientActive())) {
                String ingName = link != null ? link.ingredientName() : old.ingredientName();
                v.add(key + "ingredientId", ingName + " không còn được cung cấp, vui lòng bỏ dòng này");
            }
            // Dòng đã lưu trong phiếu nháp giữ quy cách cũ (UC-KHO-15 2b); dòng mới lấy theo liên kết hiện hành.
            String unit = old != null && !old.purchaseUnit().isEmpty() ? old.purchaseUnit() : link.purchaseUnit();
            BigDecimal factor = old != null ? old.factor() : link.factor();
            BigDecimal qty = l.qty();
            if (qty != null && (qty.signum() <= 0 || !WarehouseFormat.validQty(qty))) v.add(key + "qty", "Số lượng phải lớn hơn 0");
            else if (qty == null && order) v.add(key + "qty", "Số lượng phải lớn hơn 0");
            BigDecimal price = l.unitPrice();
            if (price != null && !WarehouseFormat.validMoney(price)) v.add(key + "unitPrice", "Đơn giá phải lớn hơn 0");
            else if (price == null && order) v.add(key + "unitPrice", "Đơn giá phải lớn hơn 0");
            lines.add(new CleanLine(ingId, unit, factor, qty, price));
        }

        BigDecimal discountPercent = in.discountPercent();
        BigDecimal discount = in.discount() == null ? BigDecimal.ZERO : in.discount();
        if (discountPercent != null && !validPercent(discountPercent)) v.add("discount", "Phần trăm giảm giá phải từ 0 đến 100");
        else if (discountPercent == null && (discount.signum() < 0 || discount.stripTrailingZeros().scale() > 0)) {
            v.add("discount", "Giảm giá phải là số tiền không âm");
        }
        BigDecimal taxPercent = in.taxPercent() == null ? BigDecimal.ZERO : in.taxPercent();
        if (!validPercent(taxPercent)) v.add("taxPercent", "Thuế phải từ 0 đến 100%, tối đa 2 chữ số thập phân");
        BigDecimal other = in.otherCost() == null ? BigDecimal.ZERO : in.otherCost();
        if (other.signum() < 0 || other.stripTrailingZeros().scale() > 0) v.add("otherCost", "Chi phí khác phải là số tiền không âm");
        if (!v.has("discount")) {
            BigDecimal sub = PurchaseMath.subtotal(lines.stream().map(l -> new PurchaseMath.Line(l.qty(), l.price())).toList());
            BigDecimal disc = PurchaseMath.discountAmount(sub, discountPercent, discount);
            if (disc.compareTo(sub) > 0 && disc.signum() > 0) v.add("discount", "Giảm giá không được lớn hơn tạm tính");
        }
        v.throwIfAny();
        return new Clean(supplierId, supplierName, name, orderDate, expected, note, discountPercent,
            discountPercent == null ? discount : null, taxPercent, other, lines);
    }

    private long userId() {
        return currentUser.get().id();
    }

    private void writeLines(long poId, List<CleanLine> lines) {
        jdbc.sql("DELETE FROM purchase_order_items WHERE purchase_order_id = ?").param(poId).update();
        int order = 0;
        for (CleanLine l : lines) {
            jdbc.sql("""
                    INSERT INTO purchase_order_items (purchase_order_id, ingredient_id, purchase_unit, factor, qty_ordered, unit_price, sort_order)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                    """)
                .params(poId, l.ingredientId(), l.purchaseUnit(), l.factor(), l.qty(), l.price(), order++)
                .update();
        }
    }

    /** Lưu số tiền giảm giá: theo % thì tính lại từ tạm tính; theo số tiền thì giữ nguyên. */
    private BigDecimal discountToStore(Clean c) {
        if (c.discountPercent() == null) return c.discount();
        BigDecimal sub = PurchaseMath.subtotal(c.lines().stream().map(l -> new PurchaseMath.Line(l.qty(), l.price())).toList());
        return PurchaseMath.discountAmount(sub, c.discountPercent(), null);
    }

    private void event(long poId, String event, String reason, String note) {
        jdbc.sql("INSERT INTO purchase_order_events (purchase_order_id, event, reason, note, created_by) VALUES (?, ?, ?, ?, ?)")
            .params(poId, event, reason, note == null || note.isEmpty() ? null : note, userId()).update();
    }

    /** action: "draft" (Lưu nháp) hoặc "order" (Đặt hàng). */
    @Transactional
    public PurchaseOrderRow create(PurchaseOrderInput in, String action) {
        boolean order = "order".equals(action);
        Clean c = validate(in, order, List.of());
        String code = codes.document("PM", Times.today());
        jdbc.sql("""
                INSERT INTO purchase_orders (code, name, supplier_id, status, receive_status, order_date, ordered_at, ordered_by,
                                             expected_at, note, discount_percent, discount, tax_percent, other_cost, created_by)
                VALUES (?, ?, ?, ?, 'not_received', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """)
            .params(code, c.name(), c.supplierId(), order ? "ordered" : "draft", c.orderDate(), order ? Times.now() : null,
                order ? userId() : null, c.expectedDate(), c.note().isEmpty() ? null : c.note(), c.discountPercent(),
                discountToStore(c), c.taxPercent(), c.otherCost(), userId())
            .update();
        long id = jdbc.sql("SELECT LAST_INSERT_ID()").query(Long.class).single();
        writeLines(id, c.lines());
        event(id, "create", null, null);
        if (order) event(id, "order", null, null);
        audit.log("warehouse", order ? "Đặt hàng phiếu mua" : "Lưu nháp phiếu mua",
            (order ? "Đặt hàng " : "Lưu nháp ") + code + " – " + c.supplierName(), "purchase_orders", id);
        return row(id);
    }

    @Transactional
    public PurchaseOrderRow update(String idText, PurchaseOrderInput in, String action) {
        long id = Ids.parse(idText, NOT_FOUND);
        Po p = lockedPo(id).stream().findFirst()
            .orElseThrow(() -> new BusinessException("Phiếu đã được đặt hàng hoặc đã bị xóa"));
        if (!"draft".equals(p.status())) throw new BusinessException("Phiếu đã được đặt hàng hoặc đã bị xóa");
        boolean order = "order".equals(action);
        List<Item> existing = items("WHERE poi.purchase_order_id = ?", id);
        // Đổi NCC thì các dòng cũ không còn giá trị giữ quy cách.
        Long newSupplier = Ids.parseOrNull(in.supplierId());
        if (newSupplier != null && newSupplier != p.supplierId()) existing = List.of();
        Clean c = validate(in, order, existing);
        jdbc.sql("""
                UPDATE purchase_orders SET name = ?, supplier_id = ?, status = ?, order_date = ?, ordered_at = ?, ordered_by = ?,
                       expected_at = ?, note = ?, discount_percent = ?, discount = ?, tax_percent = ?, other_cost = ?
                WHERE id = ?
                """)
            .params(c.name(), c.supplierId(), order ? "ordered" : "draft", c.orderDate(), order ? Times.now() : null,
                order ? userId() : null, c.expectedDate(), c.note().isEmpty() ? null : c.note(), c.discountPercent(),
                discountToStore(c), c.taxPercent(), c.otherCost(), id)
            .update();
        writeLines(id, c.lines());
        if (order) event(id, "order", null, null);
        audit.log("warehouse", order ? "Đặt hàng phiếu mua" : "Sửa phiếu mua nháp",
            (order ? "Đặt hàng " : "Lưu nháp ") + p.code() + " – " + c.supplierName(), "purchase_orders", id);
        return row(id);
    }

    @Transactional
    public void deleteDraft(String idText) {
        long id = Ids.parse(idText, NOT_FOUND);
        Po p = po(id);
        if (!"draft".equals(p.status())) throw new BusinessException("Chỉ xóa được phiếu nháp");
        jdbc.sql("DELETE FROM purchase_orders WHERE id = ?").param(id).update();
        audit.log("warehouse", "Xóa phiếu mua nháp", "Xóa " + p.code() + " – " + p.supplierName(), "purchase_orders", id);
    }

    PurchaseOrderRow row(long id) {
        Po p = po(id);
        List<Item> its = items("WHERE poi.purchase_order_id = ?", id);
        Money m = money(p, its, paidByPo().get(id));
        return new PurchaseOrderRow(Ids.str(p.id()), p.code(), p.name(), Ids.str(p.supplierId()), p.supplierName(),
            date(p.orderDate()), date(p.expectedDate()), p.status(), p.receiveStatus(), paymentStatus(p, m),
            d(m.totals().total()), d(m.payable()), d(m.paid()), d(m.debt()), isLate(p), its.size(), Times.iso(p.createdAt()));
    }

    /* ------------------------------------------------------------------ UC-KHO-16: hủy phiếu, kết thúc nhận hàng */

    private static final Map<String, String> RECEIVE_LABEL = Map.of("not_received", "Chưa nhận", "partial", "Nhận một phần",
        "received", "Đã nhận đủ", "closed", "Đã kết thúc");

    private void validateReason(ReasonInput in, Set<String> allowed) {
        var v = new ValidationException.Collector();
        String reason = Vi.trim(in.reason());
        String note = Vi.trim(in.note());
        if (!allowed.contains(reason)) v.add("reason", "Vui lòng chọn lý do");
        if ("other".equals(reason) && note.isEmpty()) v.add("note", "Vui lòng nhập ghi chú cho lý do Khác");
        if (note.length() > 255) v.add("note", "Ghi chú tối đa 255 ký tự");
        v.throwIfAny();
    }

    @Transactional
    public PurchaseOrderRow cancel(String idText, ReasonInput in) {
        long id = Ids.parse(idText, NOT_FOUND);
        validateReason(in, CANCEL_REASONS);
        Po p = lockedPo(id).stream().findFirst().orElseThrow(() -> BusinessException.notFound(NOT_FOUND));
        if ("cancelled".equals(p.status())) throw new BusinessException("Phiếu mua đã hủy");
        if (!"ordered".equals(p.status())) throw new BusinessException("Chỉ hủy được phiếu đã đặt hàng");
        if (!"not_received".equals(p.receiveStatus())) {
            if ("partial".equals(p.receiveStatus())) {
                throw new BusinessException("Phiếu đã được nhận hàng nên không thể hủy. Bạn có thể kết thúc nhận hàng.");
            }
            throw new BusinessException("Phiếu mua đã " + RECEIVE_LABEL.get(p.receiveStatus()).toLowerCase());
        }
        jdbc.sql("UPDATE purchase_orders SET status = 'cancelled' WHERE id = ?").param(id).update();
        event(id, "cancel", Vi.trim(in.reason()), Vi.trim(in.note()));
        audit.log("warehouse", "Hủy phiếu mua", "Hủy " + p.code() + " – " + p.supplierName(), "purchase_orders", id);
        return row(id);
    }

    @Transactional
    public PurchaseOrderRow close(String idText, ReasonInput in) {
        long id = Ids.parse(idText, NOT_FOUND);
        validateReason(in, CLOSE_REASONS);
        Po p = lockedPo(id).stream().findFirst().orElseThrow(() -> BusinessException.notFound(NOT_FOUND));
        if (!"ordered".equals(p.status())) throw new BusinessException("Phiếu mua không ở trạng thái đã đặt");
        if (!"partial".equals(p.receiveStatus())) {
            if ("not_received".equals(p.receiveStatus())) throw new BusinessException("Phiếu chưa nhận hàng — hãy dùng Hủy phiếu");
            throw new BusinessException("Phiếu mua đã " + RECEIVE_LABEL.get(p.receiveStatus()).toLowerCase());
        }
        jdbc.sql("UPDATE purchase_orders SET receive_status = 'closed' WHERE id = ?").param(id).update();
        event(id, "close", Vi.trim(in.reason()), Vi.trim(in.note()));
        audit.log("warehouse", "Kết thúc nhận hàng", "Kết thúc nhận hàng " + p.code() + " – " + p.supplierName(), "purchase_orders", id);
        return row(id);
    }

    /* ------------------------------------------------------------------ Thông báo trễ hạn (UC-KHO-27) */

    /** 8:00 hằng ngày: phiếu đang chờ nhận vừa quá ngày dự kiến nhận → thông báo một lần cho Quản lý kho. */
    @Scheduled(cron = "0 0 8 * * *", zone = "Asia/Ho_Chi_Minh")
    @Transactional
    public void notifyLate() {
        record Late(long id, String code, String supplier, LocalDate expected) {}
        List<Late> late = jdbc.sql("""
                SELECT po.id, po.code, s.name, po.expected_at FROM purchase_orders po JOIN suppliers s ON s.id = po.supplier_id
                WHERE po.status = 'ordered' AND po.receive_status IN ('not_received','partial')
                  AND po.expected_at IS NOT NULL AND po.expected_at < ? AND po.late_notified = 0
                """).param(Times.today())
            .query((rs, n) -> new Late(rs.getLong("id"), rs.getString("code"), rs.getString("name"),
                rs.getObject("expected_at", LocalDate.class)))
            .list();
        for (Late l : late) {
            notifications.sendToRoles("purchase", "Phiếu mua " + l.code() + " trễ hạn",
                l.supplier() + " chưa giao đủ hàng, dự kiến nhận ngày " + l.expected().format(DMY) + ".", "purchase_orders",
                l.id(), List.of("warehouse"));
            jdbc.sql("UPDATE purchase_orders SET late_notified = 1 WHERE id = ?").param(l.id()).update();
        }
    }

    /* ------------------------------------------------------------------ Dùng chung với nhập kho */

    /** Phiếu đang chờ nhận (cho trang "Nhận hàng theo phiếu mua"), mới nhất trước. */
    public List<PurchaseOrderRow> waiting() {
        return filtered("", "", "waiting", "all", "", "");
    }

    /** Tính lại trạng thái nhận sau khi nhận hàng / hủy phiếu nhập (không đụng phiếu đã kết thúc). */
    void refreshReceiveStatus(long poId) {
        List<Item> its = items("WHERE poi.purchase_order_id = ?", poId);
        boolean all = its.stream().allMatch(i -> i.qtyReceived().compareTo(i.qtyOrdered()) >= 0);
        boolean any = its.stream().anyMatch(i -> i.qtyReceived().signum() > 0);
        String status = all ? "received" : any ? "partial" : "not_received";
        jdbc.sql("UPDATE purchase_orders SET receive_status = ? WHERE id = ? AND receive_status <> 'closed'").params(status, poId).update();
    }

    /** Phải trả và đã trả hiện tại của phiếu. */
    Money moneyOf(long poId) {
        Po p = po(poId);
        return money(p, items("WHERE poi.purchase_order_id = ?", poId), paidByPo().get(poId));
    }
}
