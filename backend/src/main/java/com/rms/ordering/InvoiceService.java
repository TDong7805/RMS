package com.rms.ordering;

import com.rms.audit.AuditService;
import com.rms.common.BusinessException;
import com.rms.common.CurrentUserService;
import com.rms.common.Db;
import com.rms.common.Ids;
import com.rms.common.Times;
import com.rms.common.ValidationException;
import com.rms.common.Vi;
import com.rms.ordering.PaymentSettingsService.TransferQr;
import com.rms.ordering.ServiceRequestService.Request;
import com.rms.warehouse.WarehouseCodes;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Hóa đơn và thanh toán: lập hóa đơn (UC-TN-07), thu tiền (UC-TN-08), danh sách / in / hủy (UC-TN-09).
 *
 * Hóa đơn: unpaid (Chưa thanh toán) → paid (Đã thanh toán, cuối) | cancelled (Đã hủy, cuối, có lý do).
 * Một đơn chỉ có một hóa đơn còn hiệu lực (unpaid / paid). Đơn có hóa đơn chưa thanh toán thì bị khóa.
 * Nội dung hóa đơn lấy từ các món không bị hủy của đơn, gộp cùng món cùng đơn giá.
 */
@Service
public class InvoiceService {
    static final Set<String> METHODS = Set.of("cash", "card", "transfer", "ewallet");
    static final int MAX_RANGE_DAYS = 31;

    /** detail: các món trong set (null = món gọi lẻ). Set có món con bị hủy thì price = tổng phần còn lại. */
    public record Line(String name, long price, int qty, long amount, String detail) {}

    public record Payment(String method, long amount, Long cashGiven, Long change, String transactionRef, String paidAt,
                          String receivedBy) {}

    public record Restaurant(String name, String address, String phone, String taxCode) {}

    public record Invoice(String id, String code, String orderId, String orderCode, String tableId, String tableCode,
                          String areaName, String status, List<Line> lines, long subtotal, long discount, long tax, long total,
                          String vatCompany, String vatTaxCode, String cashierName, String createdAt, String paidAt,
                          String cancelReason, String cancelledBy, String cancelledAt, List<Payment> payments,
                          String requestedMethod, TransferQr transfer, Restaurant restaurant) {}

    /** Xem trước khi lập hóa đơn: các dòng, tổng, thông tin VAT khách đã nhập (nếu có), các món còn chặn. */
    public record Preview(String orderId, String orderCode, String tableCode, List<Line> lines, long total, String vatCompany,
                          String vatTaxCode, String requestedMethod, List<String> blockers) {}

    public record CreateInput(String vatCompany, String vatTaxCode) {}

    public record PaymentLine(String method, Long amount, Long cashGiven, String transactionRef) {}

    public record PayInput(List<PaymentLine> payments) {}

    public record CancelInput(String reason) {}

    public record ListRow(String id, String code, String orderId, String orderCode, String tableCode, String createdAt,
                          String paidAt, long total, List<String> methods, String cashierName, String status) {}

    public record ListResponse(List<ListRow> items, int count, long paidTotal, Map<String, Long> byMethod) {}

    private final JdbcClient jdbc;
    private final OrderCore core;
    private final LiveEvents live;
    private final AuditService audit;
    private final CurrentUserService currentUser;
    private final WarehouseCodes codes;
    private final PaymentSettingsService paymentSettings;
    private final ServiceRequestService requests;

    public InvoiceService(JdbcClient jdbc, OrderCore core, LiveEvents live, AuditService audit, CurrentUserService currentUser,
                          WarehouseCodes codes, PaymentSettingsService paymentSettings, ServiceRequestService requests) {
        this.jdbc = jdbc;
        this.core = core;
        this.live = live;
        this.audit = audit;
        this.currentUser = currentUser;
        this.codes = codes;
        this.paymentSettings = paymentSettings;
        this.requests = requests;
    }

    private static String iso(LocalDateTime t) {
        return t == null ? null : Times.iso(t);
    }

    private static long money(BigDecimal b) {
        return b == null ? 0 : b.longValue();
    }

    /* ------------------------------------------------------------------ Đọc */

    private List<Line> lines(long orderId) {
        record Row(long firstId, Line line) {}
        List<Row> rows = new java.util.ArrayList<>(jdbc.sql("""
                SELECT MIN(id) AS first_id, dish_name, unit_price, SUM(quantity) AS qty FROM order_items
                WHERE order_id = ? AND status <> 'cancelled' AND order_set_id IS NULL
                GROUP BY dish_id, dish_name, unit_price
                """).param(orderId)
            .query((rs, n) -> {
                long price = money(rs.getBigDecimal("unit_price"));
                int qty = rs.getInt("qty");
                return new Row(rs.getLong("first_id"), new Line(rs.getString("dish_name"), price, qty, price * qty, null));
            }).list());
        // Set: một dòng mỗi loại set (cùng tên, cùng số tiền còn lại, cùng món), số lượng = số set; món con bị hủy hết thì bỏ.
        record SetRow(long firstId, String name, long amount, String detail) {}
        List<SetRow> sets = jdbc.sql("""
                SELECT MIN(oi.id) AS first_id, os.set_name, SUM(oi.unit_price * oi.quantity) AS amount,
                       GROUP_CONCAT(CONCAT(oi.dish_name, IF(oi.quantity > 1, CONCAT(' x', oi.quantity), '')) ORDER BY oi.id SEPARATOR ', ') AS detail
                FROM order_sets os JOIN order_items oi ON oi.order_set_id = os.id
                WHERE os.order_id = ? AND oi.status <> 'cancelled'
                GROUP BY os.id, os.set_name
                """).param(orderId)
            .query((rs, n) -> new SetRow(rs.getLong("first_id"), rs.getString("set_name"), money(rs.getBigDecimal("amount")),
                rs.getString("detail")))
            .list();
        java.util.Map<String, Row> merged = new java.util.LinkedHashMap<>();
        for (SetRow r : sets) {
            String key = r.name() + "|" + r.amount() + "|" + r.detail();
            Row old = merged.get(key);
            int qty = old == null ? 1 : old.line().qty() + 1;
            long first = old == null ? r.firstId() : Math.min(old.firstId(), r.firstId());
            merged.put(key, new Row(first, new Line(r.name(), r.amount(), qty, r.amount() * qty, r.detail())));
        }
        rows.addAll(merged.values());
        rows.sort(java.util.Comparator.comparingLong(Row::firstId));
        return rows.stream().map(Row::line).toList();
    }

    public Restaurant restaurant() {
        return jdbc.sql("SELECT name, address, phone, tax_code FROM restaurant_info WHERE id = 1")
            .query((rs, n) -> new Restaurant(rs.getString("name"), Vi.trim(rs.getString("address")), Vi.trim(rs.getString("phone")),
                Vi.trim(rs.getString("tax_code"))))
            .optional().orElse(new Restaurant("Nhà hàng", "", "", ""));
    }

    public Invoice get(long id) {
        record Head(long id, String code, long orderId, String orderCode, long tableId, String status, long subtotal, long discount,
                    long tax, long total, String vatCompany, String vatTax, String cashier, LocalDateTime createdAt,
                    LocalDateTime paidAt, String cancelReason, String cancelledBy, LocalDateTime cancelledAt) {}
        Head h = jdbc.sql("""
                SELECT i.*, o.code AS order_code, o.table_id, cu.full_name AS cashier_name, xu.full_name AS cancelled_name
                FROM invoices i JOIN orders o ON o.id = i.order_id
                LEFT JOIN users cu ON cu.id = i.cashier_id LEFT JOIN users xu ON xu.id = i.cancelled_by
                WHERE i.id = ?
                """).param(id)
            .query((rs, n) -> new Head(rs.getLong("id"), rs.getString("code"), rs.getLong("order_id"), rs.getString("order_code"),
                rs.getLong("table_id"), rs.getString("status"), money(rs.getBigDecimal("subtotal")),
                money(rs.getBigDecimal("discount_amount")), money(rs.getBigDecimal("tax_amount")),
                money(rs.getBigDecimal("total_amount")), Vi.trim(rs.getString("vat_company_name")),
                Vi.trim(rs.getString("vat_tax_code")), rs.getString("cashier_name"), Db.dateTime(rs, "created_at"),
                Db.dateTime(rs, "paid_at"), rs.getString("cancel_reason"), rs.getString("cancelled_name"),
                Db.dateTime(rs, "cancelled_at")))
            .optional().orElseThrow(() -> BusinessException.notFound("Không tìm thấy hóa đơn"));
        var t = core.table(h.tableId());
        List<Payment> payments = jdbc.sql("""
                SELECT p.method, p.amount, p.cash_given, p.transaction_ref, p.paid_at, u.full_name
                FROM payments p LEFT JOIN users u ON u.id = p.received_by WHERE p.invoice_id = ? ORDER BY p.id
                """).param(id)
            .query((rs, n) -> {
                long amount = money(rs.getBigDecimal("amount"));
                Long given = rs.getBigDecimal("cash_given") == null ? null : rs.getBigDecimal("cash_given").longValue();
                return new Payment(rs.getString("method"), amount, given, given == null ? null : given - amount,
                    rs.getString("transaction_ref"), iso(Db.dateTime(rs, "paid_at")), rs.getString("full_name"));
            }).list();
        String requested = jdbc.sql("""
                SELECT payment_method FROM service_requests WHERE order_id = ? AND request_type = 'payment' AND status <> 'cancelled'
                ORDER BY id DESC LIMIT 1
                """).param(h.orderId()).query(String.class).optional().orElse(null);
        TransferQr transfer = "unpaid".equals(h.status()) ? paymentSettings.qr(h.total(), h.code()) : null;
        return new Invoice(Ids.str(h.id()), h.code(), Ids.str(h.orderId()), h.orderCode(), Ids.str(t.id()), t.code(), t.areaName(),
            h.status(), lines(h.orderId()), h.subtotal(), h.discount(), h.tax(), h.total(), h.vatCompany(), h.vatTax(),
            h.cashier(), iso(h.createdAt()), iso(h.paidAt()), h.cancelReason(), h.cancelledBy(), iso(h.cancelledAt()), payments,
            requested, transfer, restaurant());
    }

    public Invoice get(String idText) {
        return get(Ids.parse(idText, "Không tìm thấy hóa đơn"));
    }

    /** Hóa đơn còn hiệu lực (chưa thanh toán / đã thanh toán) của đơn. */
    public Optional<Long> activeOf(long orderId) {
        return jdbc.sql("SELECT id FROM invoices WHERE order_id = ? AND status IN ('unpaid','paid') ORDER BY id DESC LIMIT 1")
            .param(orderId).query(Long.class).optional();
    }

    /* ------------------------------------------------------------------ UC-TN-07: lập hóa đơn */

    private List<String> blockers(long orderId) {
        return jdbc.sql("""
                SELECT CONCAT(dish_name, ' x', quantity) FROM order_items
                WHERE order_id = ? AND status IN ('unconfirmed','pending','cooking') ORDER BY id
                """).param(orderId).query(String.class).list();
    }

    private void checkOpen(long orderId) {
        String status = jdbc.sql("SELECT status FROM orders WHERE id = ?").param(orderId).query(String.class).optional()
            .orElseThrow(() -> BusinessException.notFound("Không tìm thấy đơn hàng"));
        if (!"open".equals(status)) throw new BusinessException("Đơn đã đóng, không lập hóa đơn được");
        if (core.isLocked(orderId)) throw new BusinessException("Đơn đã có hóa đơn chưa thanh toán");
    }

    public Preview preview(String orderIdText) {
        long orderId = Ids.parse(orderIdText, "Không tìm thấy đơn hàng");
        checkOpen(orderId);
        var o = core.order(orderId);
        List<Line> lines = lines(orderId);
        Optional<Request> req = requests.waitingPayment(Long.parseLong(o.tableId()));
        return new Preview(o.id(), o.code(), o.tableCode(), lines, lines.stream().mapToLong(Line::amount).sum(),
            req.map(Request::vatCompany).orElse(""), req.map(Request::vatTaxCode).orElse(""),
            req.map(Request::paymentMethod).orElse(null), blockers(orderId));
    }

    @Transactional
    public Invoice create(String orderIdText, CreateInput in) {
        long orderId = Ids.parse(orderIdText, "Không tìm thấy đơn hàng");
        String company = Vi.collapse(in.vatCompany());
        String tax = Vi.trim(in.vatTaxCode());
        var v = new ValidationException.Collector();
        ServiceRequestService.validateTaxCode(company, tax, v, "vatCompany", "vatTaxCode");
        v.throwIfAny();

        long tableId = jdbc.sql("SELECT table_id FROM orders WHERE id = ?").param(orderId).query(Long.class).optional()
            .orElseThrow(() -> BusinessException.notFound("Không tìm thấy đơn hàng"));
        core.lockTable(tableId);
        checkOpen(orderId);
        List<String> wait = blockers(orderId);
        if (!wait.isEmpty()) {
            throw new BusinessException("Còn " + wait.size() + " món chưa xong: " + String.join(", ", wait)
                + ". Hãy chờ bếp hoàn thành hoặc hủy món chưa làm.");
        }
        List<Line> lines = lines(orderId);
        if (lines.isEmpty()) throw new BusinessException("Đơn không có món để lập hóa đơn. Bạn có thể hủy đơn.");
        long total = lines.stream().mapToLong(Line::amount).sum();
        String code = codes.document("HD", Times.today());
        long user = currentUser.get().id();
        jdbc.sql("""
                INSERT INTO invoices (code, order_id, subtotal, discount_amount, tax_amount, total_amount, status,
                                      vat_company_name, vat_tax_code, cashier_id, created_at)
                VALUES (?, ?, ?, 0, 0, ?, 'unpaid', ?, ?, ?, ?)
                """).params(code, orderId, total, total, company.isEmpty() ? null : company, tax.isEmpty() ? null : tax, user,
                Times.now()).update();
        long id = jdbc.sql("SELECT LAST_INSERT_ID()").query(Long.class).single();
        audit.log("cashier", "Lập hóa đơn", code + " – bàn " + core.table(tableId).code() + " – " + total + " đ", "invoices", id);
        live.publish(LiveEvents.CASHIER, LiveEvents.table(tableId));
        return get(id);
    }

    /* ------------------------------------------------------------------ UC-TN-08: thu tiền */

    private record Locked(long id, String code, long orderId, long tableId, String status, long total) {}

    private Locked lock(String idText) {
        long id = Ids.parse(idText, "Không tìm thấy hóa đơn");
        return jdbc.sql("""
                SELECT i.id, i.code, i.order_id, o.table_id, i.status, i.total_amount
                FROM invoices i JOIN orders o ON o.id = i.order_id WHERE i.id = ? FOR UPDATE
                """).param(id)
            .query((rs, n) -> new Locked(rs.getLong("id"), rs.getString("code"), rs.getLong("order_id"), rs.getLong("table_id"),
                rs.getString("status"), money(rs.getBigDecimal("total_amount"))))
            .optional().orElseThrow(() -> BusinessException.notFound("Không tìm thấy hóa đơn"));
    }

    @Transactional
    public Invoice pay(String idText, PayInput in) {
        List<PaymentLine> lines = in.payments() == null ? List.of() : in.payments();
        var v = new ValidationException.Collector();
        if (lines.isEmpty()) v.add("payments", "Chưa có khoản thu");
        if (lines.size() > 5) v.add("payments", "Tối đa 5 khoản thu");
        long sum = 0;
        for (int i = 0; i < lines.size(); i++) {
            PaymentLine p = lines.get(i);
            String f = "payments." + i + ".";
            if (p.method() == null || !METHODS.contains(p.method())) v.add(f + "method", "Chọn hình thức");
            long amount = p.amount() == null ? 0 : p.amount();
            if (amount <= 0) v.add(f + "amount", "Số tiền phải lớn hơn 0");
            sum += Math.max(0, amount);
            if (p.cashGiven() != null) {
                if (!"cash".equals(p.method())) v.add(f + "cashGiven", "Chỉ nhập tiền khách đưa với tiền mặt");
                else if (p.cashGiven() < amount) v.add(f + "cashGiven", "Tiền khách đưa chưa đủ");
            }
            if (Vi.trim(p.transactionRef()).length() > 100) v.add(f + "transactionRef", "Mã giao dịch tối đa 100 ký tự");
        }
        v.throwIfAny();

        Locked inv = lock(idText);
        core.lockTable(inv.tableId());
        if (!"unpaid".equals(inv.status())) throw new BusinessException("Hóa đơn đã được xử lý");
        if (sum != inv.total()) {
            throw new ValidationException(Map.of("payments", "Tổng tiền thu chưa khớp"),
                "Tổng tiền thu (" + vnd(sum) + ") chưa khớp tổng cộng (" + vnd(inv.total()) + ")");
        }
        LocalDateTime now = Times.now();
        long user = currentUser.get().id();
        for (PaymentLine p : lines) {
            String ref = Vi.trim(p.transactionRef());
            jdbc.sql("""
                    INSERT INTO payments (invoice_id, method, amount, cash_given, transaction_ref, paid_at, received_by)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                    """).params(inv.id(), p.method(), p.amount(), "cash".equals(p.method()) ? p.cashGiven() : null,
                    ref.isEmpty() || "cash".equals(p.method()) ? null : ref, now, user).update();
        }
        jdbc.sql("UPDATE invoices SET status = 'paid', paid_at = ?, cashier_id = ? WHERE id = ?").params(now, user, inv.id()).update();
        jdbc.sql("UPDATE order_items SET status = 'served', served_at = ?, served_by = ? WHERE order_id = ? AND status = 'done'")
            .params(now, user, inv.orderId()).update();
        jdbc.sql("UPDATE orders SET status = 'completed', closed_at = ? WHERE id = ?").params(now, inv.orderId()).update();
        jdbc.sql("UPDATE dining_tables SET status = 'available' WHERE id = ? AND status = 'occupied'").param(inv.tableId()).update();
        requests.completePayment(inv.orderId(), inv.tableId());
        audit.log("cashier", "Thanh toán hóa đơn", inv.code() + " – " + vnd(inv.total()), "invoices", inv.id());
        live.publish(LiveEvents.CASHIER, LiveEvents.KITCHEN, LiveEvents.table(inv.tableId()));
        return get(inv.id());
    }

    static String vnd(long v) {
        return String.format("%,d", v).replace(',', '.') + " đ";
    }

    /* ------------------------------------------------------------------ UC-TN-09: hủy hóa đơn chưa thanh toán */

    @Transactional
    public Invoice cancel(String idText, CancelInput in) {
        String reason = Vi.collapse(in.reason());
        if (reason.length() < 5) throw new ValidationException("reason", "Vui lòng nhập lý do hủy (ít nhất 5 ký tự)");
        if (reason.length() > 300) throw new ValidationException("reason", "Lý do tối đa 300 ký tự");
        Locked inv = lock(idText);
        if ("paid".equals(inv.status())) throw new BusinessException("Hóa đơn đã thanh toán, không thể hủy");
        if ("cancelled".equals(inv.status())) throw new BusinessException("Hóa đơn đã bị hủy");
        jdbc.sql("UPDATE invoices SET status = 'cancelled', cancel_reason = ?, cancelled_by = ?, cancelled_at = ? WHERE id = ?")
            .params(reason, currentUser.get().id(), Times.now(), inv.id()).update();
        audit.log("cashier", "Hủy hóa đơn", inv.code() + ": " + reason, "invoices", inv.id());
        live.publish(LiveEvents.CASHIER, LiveEvents.table(inv.tableId()));
        return get(inv.id());
    }

    /* ------------------------------------------------------------------ UC-TN-09: danh sách */

    public ListResponse list(String keyword, String status, String method, String from, String to) {
        LocalDate[] range = range(from, to);
        StringBuilder sql = new StringBuilder("""
            SELECT i.id, i.code, i.order_id, o.code AS order_code, t.code AS table_code, i.created_at, i.paid_at, i.total_amount,
                   i.status, i.vat_tax_code, u.full_name AS cashier_name,
                   (SELECT GROUP_CONCAT(DISTINCT p.method ORDER BY p.method) FROM payments p WHERE p.invoice_id = i.id) AS methods
            FROM invoices i JOIN orders o ON o.id = i.order_id JOIN dining_tables t ON t.id = o.table_id
            LEFT JOIN users u ON u.id = i.cashier_id
            WHERE i.created_at >= ? AND i.created_at < ?
            """);
        List<Object> params = new ArrayList<>(List.of(range[0].atStartOfDay(), range[1].plusDays(1).atStartOfDay()));
        if (status != null && Set.of("unpaid", "paid", "cancelled").contains(status)) {
            sql.append(" AND i.status = ?");
            params.add(status);
        }
        if (method != null && METHODS.contains(method)) {
            sql.append(" AND EXISTS (SELECT 1 FROM payments p WHERE p.invoice_id = i.id AND p.method = ?)");
            params.add(method);
        }
        sql.append(" ORDER BY i.created_at DESC, i.id DESC");
        String kw = Vi.trim(keyword);
        List<ListRow> rows = new ArrayList<>();
        jdbc.sql(sql.toString()).params(params).query((rs, n) -> {
            String hay = String.join(" ", rs.getString("code"), rs.getString("order_code"), rs.getString("table_code"),
                Vi.trim(rs.getString("vat_tax_code")));
            if (!kw.isEmpty() && !Vi.matches(hay, kw)) return null;
            String m = rs.getString("methods");
            rows.add(new ListRow(Ids.str(rs.getLong("id")), rs.getString("code"), Ids.str(rs.getLong("order_id")),
                rs.getString("order_code"), rs.getString("table_code"), iso(Db.dateTime(rs, "created_at")),
                iso(Db.dateTime(rs, "paid_at")), money(rs.getBigDecimal("total_amount")),
                m == null ? List.of() : List.of(m.split(",")), rs.getString("cashier_name"), rs.getString("status")));
            return null;
        }).list();
        // Tổng đã thu theo hình thức (hóa đơn đã thanh toán trong kết quả lọc).
        Map<String, Long> byMethod = new LinkedHashMap<>();
        for (String k : List.of("cash", "card", "transfer", "ewallet")) byMethod.put(k, 0L);
        List<Long> paidIds = rows.stream().filter(r -> "paid".equals(r.status())).map(r -> Long.parseLong(r.id())).toList();
        if (!paidIds.isEmpty()) {
            String in = String.join(",", paidIds.stream().map(x -> "?").toList());
            jdbc.sql("SELECT method, SUM(amount) FROM payments WHERE invoice_id IN (" + in + ") GROUP BY method")
                .params(new ArrayList<Object>(paidIds))
                .query((rs, n) -> byMethod.put(rs.getString(1), money(rs.getBigDecimal(2)))).list();
        }
        long paidTotal = rows.stream().filter(r -> "paid".equals(r.status())).mapToLong(ListRow::total).sum();
        return new ListResponse(rows, rows.size(), paidTotal, byMethod);
    }

    /** Khoảng ngày lọc: mặc định hôm nay; tối đa 31 ngày. */
    static LocalDate[] range(String from, String to) {
        LocalDate f = Times.parseDate(from);
        LocalDate t = Times.parseDate(to);
        var v = new ValidationException.Collector();
        if (from != null && !from.isBlank() && f == null) v.add("from", "Ngày không hợp lệ");
        if (to != null && !to.isBlank() && t == null) v.add("to", "Ngày không hợp lệ");
        v.throwIfAny();
        if (f == null && t == null) f = t = Times.today();
        else if (f == null) f = t;
        else if (t == null) t = f;
        if (t.isBefore(f)) throw new ValidationException("to", "Đến ngày phải sau Từ ngày");
        if (ChronoUnit.DAYS.between(f, t) >= MAX_RANGE_DAYS) throw new ValidationException("to", "Khoảng ngày tối đa 31 ngày");
        return new LocalDate[] {f, t};
    }
}
