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
import com.rms.warehouse.PurchaseOrderService.PurchaseOrderRow;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * UC-KHO-25 (công nợ nhà cung cấp — Quản lý nhà hàng chỉ xem) và UC-KHO-26 (ghi nhận / hủy thanh toán).
 * Phải trả mỗi phiếu tính theo hàng đã nhận (PurchaseMath); công nợ NCC = Σ phải trả − Σ thanh toán còn hiệu lực.
 * Mỗi lần thanh toán gắn với một phiếu mua, không vượt số còn nợ; ghi nhầm thì hủy kèm lý do (bản ghi vẫn giữ).
 */
@Service
public class DebtService {
    static final int PAGE_SIZE = IngredientService.PAGE_SIZE;
    static final int PAY_DATE_BACK_DAYS = 7;
    private static final DateTimeFormatter DMY = DateTimeFormatter.ofPattern("dd/MM/yyyy");

    public record DebtRow(String supplierId, String supplierCode, String supplierName, double payable, double paid, double debt,
                          int openCount, String oldestDate) {}

    public record DebtPage(List<DebtRow> items, int total, int page, int pageCount, double totalPayable, double totalPaid,
                           double totalDebt) {}

    public record PaymentRow(String id, String code, String paidAt, String purchaseOrderId, String purchaseOrderCode, double amount,
                             String method, String reference, String note, String by, String status, String cancelReason) {}

    public record DebtDetail(String supplierId, String supplierCode, String supplierName, String paymentMethod, double payable,
                             double paid, double debt, List<PurchaseOrderRow> orders, List<PaymentRow> payments) {}

    public record PaymentInput(String purchaseOrderId, java.math.BigDecimal amount, String method, String paidDate,
                               String reference, String note) {}

    public record CancelInput(String reason) {}

    private final JdbcClient jdbc;
    private final AuditService audit;
    private final CurrentUserService currentUser;
    private final WarehouseCodes codes;
    private final PurchaseOrderService purchases;

    public DebtService(JdbcClient jdbc, AuditService audit, CurrentUserService currentUser, WarehouseCodes codes,
                       PurchaseOrderService purchases) {
        this.jdbc = jdbc;
        this.audit = audit;
        this.currentUser = currentUser;
        this.codes = codes;
        this.purchases = purchases;
    }

    /** Phiếu Đã đặt có phát sinh phải trả (đã nhận hàng ít nhất một phần) hoặc đã có thanh toán. */
    private List<PurchaseOrderRow> orders() {
        return purchases.filtered("", "", "all", "all", "", "").stream()
            .filter(r -> "ordered".equals(r.status()) && (r.payable() > 0 || r.paid() > 0))
            .toList();
    }

    private record Sup(String id, String code, String name, String method) {}

    private Map<String, Sup> suppliers() {
        return jdbc.sql("SELECT id, code, name, payment_method FROM suppliers")
            .query((rs, n) -> new Sup(Ids.str(rs.getLong("id")), rs.getString("code"), rs.getString("name"), rs.getString("payment_method")))
            .list().stream().collect(Collectors.toMap(Sup::id, s -> s));
    }

    /** status: all | owing (còn nợ) | clear (đã trả hết). Sắp theo còn nợ giảm dần. */
    public DebtPage list(String keyword, String status, int page) {
        Map<String, Sup> sups = suppliers();
        Map<String, List<PurchaseOrderRow>> bySup = orders().stream().collect(Collectors.groupingBy(PurchaseOrderRow::supplierId));
        String k = Vi.trim(keyword);
        List<DebtRow> all = new ArrayList<>();
        bySup.forEach((supId, rows) -> {
            Sup s = sups.get(supId);
            double payable = rows.stream().mapToDouble(PurchaseOrderRow::payable).sum();
            double paid = rows.stream().mapToDouble(PurchaseOrderRow::paid).sum();
            List<PurchaseOrderRow> open = rows.stream().filter(r -> r.debt() > 0).toList();
            String oldest = open.stream().map(PurchaseOrderRow::orderDate).filter(java.util.Objects::nonNull).min(String::compareTo).orElse(null);
            all.add(new DebtRow(supId, s.code(), s.name(), payable, paid, payable - paid, open.size(), oldest));
        });
        List<DebtRow> filtered = all.stream()
            .filter(r -> k.isEmpty() || Vi.matches(r.supplierName(), k) || Vi.matches(r.supplierCode(), k))
            .filter(r -> Vi.blank(status) || "all".equals(status) || ("owing".equals(status) ? r.debt() > 0 : r.debt() <= 0))
            .sorted(Comparator.comparingDouble(DebtRow::debt).reversed().thenComparing(DebtRow::supplierCode))
            .toList();
        Paged<DebtRow> p = Paged.of(filtered, page, PAGE_SIZE);
        double tp = all.stream().mapToDouble(DebtRow::payable).sum();
        double tpaid = all.stream().mapToDouble(DebtRow::paid).sum();
        return new DebtPage(p.items(), p.total(), p.page(), p.pageCount(), tp, tpaid, tp - tpaid);
    }

    /** Tổng công nợ phải trả (Dashboard). */
    public double totalDebt() {
        return orders().stream().mapToDouble(PurchaseOrderRow::debt).sum();
    }

    public DebtDetail detail(String supplierIdText) {
        long supId = Ids.parse(supplierIdText, "Không tìm thấy nhà cung cấp");
        Sup s = suppliers().get(Ids.str(supId));
        if (s == null) throw BusinessException.notFound("Không tìm thấy nhà cung cấp");
        List<PurchaseOrderRow> rows = orders().stream().filter(r -> r.supplierId().equals(s.id()))
            .sorted(Comparator.comparing((PurchaseOrderRow r) -> r.orderDate() == null ? "" : r.orderDate())).toList();
        List<PaymentRow> payments = jdbc.sql("""
                SELECT p.*, po.code AS po_code, u.full_name FROM supplier_payments p
                LEFT JOIN purchase_orders po ON po.id = p.purchase_order_id LEFT JOIN users u ON u.id = p.created_by
                WHERE p.supplier_id = ? ORDER BY p.paid_at DESC, p.id DESC
                """).param(supId)
            .query((rs, n) -> new PaymentRow(Ids.str(rs.getLong("id")), Vi.trim(rs.getString("code")), Times.iso(Db.dateTime(rs, "paid_at")),
                rs.getObject("purchase_order_id") == null ? null : Ids.str(rs.getLong("purchase_order_id")), rs.getString("po_code"),
                rs.getBigDecimal("amount").doubleValue(), rs.getString("method"), Vi.trim(rs.getString("reference")),
                Vi.trim(rs.getString("note")), Vi.trim(rs.getString("full_name")), rs.getString("status"), rs.getString("cancel_reason")))
            .list();
        double payable = rows.stream().mapToDouble(PurchaseOrderRow::payable).sum();
        double paid = rows.stream().mapToDouble(PurchaseOrderRow::paid).sum();
        return new DebtDetail(s.id(), s.code(), s.name(), s.method(), payable, paid, payable - paid, rows, payments);
    }

    @Transactional
    public PaymentRow pay(PaymentInput in) {
        Long poId = Ids.parseOrNull(in.purchaseOrderId());
        if (poId == null) throw new ValidationException("purchaseOrderId", "Vui lòng chọn phiếu mua");
        purchases.lockedPo(poId);
        PurchaseOrderService.Po po = purchases.po(poId);
        if (!"ordered".equals(po.status())) throw new BusinessException("Phiếu mua chưa đặt hàng hoặc đã hủy, không thanh toán được");
        PurchaseOrderService.Money m = purchases.moneyOf(poId);
        var v = new ValidationException.Collector();
        BigDecimal amount = in.amount();
        if (amount == null || amount.signum() <= 0 || amount.stripTrailingZeros().scale() > 0) v.add("amount", "Số tiền phải lớn hơn 0");
        else if (amount.compareTo(m.debt()) > 0) v.add("amount", "Số tiền không được vượt quá số còn nợ (" + WarehouseFormat.money(m.debt()) + ")");
        String method = Vi.trim(in.method());
        if (!Set.of("cash", "transfer").contains(method)) v.add("method", "Vui lòng chọn phương thức");
        LocalDate today = Times.today();
        LocalDate min = today.minusDays(PAY_DATE_BACK_DAYS);
        LocalDate date = null;
        try {
            date = Vi.blank(in.paidDate()) ? today : Times.parseDate(in.paidDate());
        } catch (RuntimeException e) {
            v.add("paidDate", "Ngày thanh toán không hợp lệ");
        }
        if (date != null && (date.isAfter(today) || date.isBefore(min))) {
            v.add("paidDate", "Ngày thanh toán phải từ " + min.format(DMY) + " đến hôm nay");
        }
        String reference = Vi.trim(in.reference());
        if (reference.length() > 50) v.add("reference", "Mã tham chiếu tối đa 50 ký tự");
        String note = Vi.trim(in.note());
        if (note.length() > 300) v.add("note", "Ghi chú tối đa 300 ký tự");
        v.throwIfAny();
        String code = codes.document("TT", today);
        jdbc.sql("""
                INSERT INTO supplier_payments (code, supplier_id, purchase_order_id, amount, method, reference, paid_at, note, created_by)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """)
            .params(code, po.supplierId(), poId, amount, method, reference.isEmpty() ? null : reference,
                date.equals(today) ? Times.now() : date.atTime(Times.now().toLocalTime()), note.isEmpty() ? null : note,
                currentUser.get().id())
            .update();
        long id = jdbc.sql("SELECT LAST_INSERT_ID()").query(Long.class).single();
        audit.log("warehouse", "Ghi nhận thanh toán", "Thanh toán " + WarehouseFormat.money(amount) + " cho " + po.code() + " – "
            + po.supplierName() + " (" + code + ")", "supplier_payments", id);
        return payment(id);
    }

    private PaymentRow payment(long id) {
        return jdbc.sql("""
                SELECT p.*, po.code AS po_code, u.full_name FROM supplier_payments p
                LEFT JOIN purchase_orders po ON po.id = p.purchase_order_id LEFT JOIN users u ON u.id = p.created_by WHERE p.id = ?
                """).param(id)
            .query((rs, n) -> new PaymentRow(Ids.str(rs.getLong("id")), Vi.trim(rs.getString("code")), Times.iso(Db.dateTime(rs, "paid_at")),
                rs.getObject("purchase_order_id") == null ? null : Ids.str(rs.getLong("purchase_order_id")), rs.getString("po_code"),
                rs.getBigDecimal("amount").doubleValue(), rs.getString("method"), Vi.trim(rs.getString("reference")),
                Vi.trim(rs.getString("note")), Vi.trim(rs.getString("full_name")), rs.getString("status"), rs.getString("cancel_reason")))
            .optional().orElseThrow(() -> BusinessException.notFound("Không tìm thấy thanh toán"));
    }

    @Transactional
    public PaymentRow cancel(String idText, CancelInput in) {
        long id = Ids.parse(idText, "Không tìm thấy thanh toán");
        String reason = Vi.trim(in.reason());
        if (reason.length() < 5) throw new ValidationException("reason", "Vui lòng nhập lý do hủy (ít nhất 5 ký tự)");
        if (reason.length() > 300) throw new ValidationException("reason", "Lý do tối đa 300 ký tự");
        PaymentRow p = payment(id);
        if (!"valid".equals(p.status())) throw new BusinessException("Thanh toán đã được hủy");
        jdbc.sql("UPDATE supplier_payments SET status = 'cancelled', cancel_reason = ?, cancelled_by = ?, cancelled_at = ? WHERE id = ?")
            .params(reason, currentUser.get().id(), Times.now(), id).update();
        audit.log("warehouse", "Hủy thanh toán", "Hủy " + p.code() + " (" + WarehouseFormat.money(BigDecimal.valueOf(p.amount()))
            + ", phiếu " + p.purchaseOrderCode() + "): " + reason, "supplier_payments", id);
        return payment(id);
    }
}
