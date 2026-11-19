package com.rms.ordering;

import com.rms.audit.AuditService;
import com.rms.common.BusinessException;
import com.rms.common.CurrentUserService;
import com.rms.common.Db;
import com.rms.common.Ids;
import com.rms.common.Times;
import com.rms.common.ValidationException;
import com.rms.common.Vi;
import com.rms.notification.NotificationService;
import com.rms.ordering.OrderCore.TableRow;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.regex.Pattern;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Yêu cầu của khách: Gọi nhân viên (UC-KH-05), Yêu cầu thanh toán (UC-KH-06) và phía Thu ngân xử lý (UC-TN-06).
 *
 * Trạng thái: new (Mới) → forwarded (Đã báo nhân viên — thu ngân đã báo qua bộ đàm, chỉ yêu cầu hỗ trợ) → done (Hoàn thành);
 * new / forwarded → cancelled. Nhân viên phục vụ không có tài khoản nên không chọn tên người phụ trách.
 * Mỗi bàn tối đa một yêu cầu hỗ trợ (support / consult / other) và một yêu cầu thanh toán đang chờ.
 * Yêu cầu thanh toán tự Hoàn thành khi hóa đơn của bàn được thanh toán.
 */
@Service
public class ServiceRequestService {
    static final Pattern TAX_CODE = Pattern.compile("^\\d{10}(-\\d{3})?$");
    static final int CONTENT_MAX = 300;
    static final Set<String> SUPPORT_TYPES = Set.of("support", "consult", "other");
    static final Set<String> CUSTOMER_METHODS = Set.of("cash", "card", "transfer");
    static final Map<String, String> TYPE_LABEL = Map.of("support", "Hỗ trợ tại bàn", "consult", "Tư vấn món",
        "payment", "Thanh toán", "other", "Khác");
    static final Map<String, String> METHOD_LABEL = Map.of("cash", "Tiền mặt", "card", "Thẻ", "transfer", "Chuyển khoản",
        "ewallet", "Ví điện tử");

    public record Request(String id, String tableId, String tableCode, String areaName, String orderId, String orderCode,
                          String type, String content, String paymentMethod, String vatCompany, String vatTaxCode,
                          String status, String assignedName, String receivedName, String createdAt, String forwardedAt,
                          String doneAt, String cancelledAt, String invoiceId) {}

    public record RequestList(List<Request> items, int waitingCount) {}

    public record SupportInput(String type, String content) {}

    public record PaymentInput(String method, String vatCompany, String vatTaxCode) {}


    private final JdbcClient jdbc;
    private final OrderCore core;
    private final LiveEvents live;
    private final AuditService audit;
    private final CurrentUserService currentUser;
    private final NotificationService notifications;

    public ServiceRequestService(JdbcClient jdbc, OrderCore core, LiveEvents live, AuditService audit,
                                 CurrentUserService currentUser, NotificationService notifications) {
        this.jdbc = jdbc;
        this.core = core;
        this.live = live;
        this.audit = audit;
        this.currentUser = currentUser;
        this.notifications = notifications;
    }

    private static String iso(LocalDateTime t) {
        return t == null ? null : Times.iso(t);
    }

    private static final String SELECT = """
        SELECT sr.*, t.code AS table_code, a.name AS area_name, o.code AS order_code,
               au.full_name AS assigned_name, ru.full_name AS received_name,
               (SELECT i.id FROM invoices i WHERE i.order_id = sr.order_id AND i.status = 'unpaid' LIMIT 1) AS invoice_id
        FROM service_requests sr
        JOIN dining_tables t ON t.id = sr.table_id JOIN areas a ON a.id = t.area_id
        LEFT JOIN orders o ON o.id = sr.order_id
        LEFT JOIN users au ON au.id = sr.assigned_to
        LEFT JOIN users ru ON ru.id = sr.received_by
        """;

    private static Request map(java.sql.ResultSet rs) throws java.sql.SQLException {
        Long orderId = rs.getObject("order_id") == null ? null : rs.getLong("order_id");
        Long invoiceId = rs.getObject("invoice_id") == null ? null : rs.getLong("invoice_id");
        return new Request(Ids.str(rs.getLong("id")), Ids.str(rs.getLong("table_id")), rs.getString("table_code"),
            rs.getString("area_name"), Ids.str(orderId), rs.getString("order_code"), rs.getString("request_type"),
            Vi.trim(rs.getString("content")), rs.getString("payment_method"), Vi.trim(rs.getString("vat_company")),
            Vi.trim(rs.getString("vat_tax_code")), rs.getString("status"), rs.getString("assigned_name"),
            rs.getString("received_name"), iso(Db.dateTime(rs, "created_at")), iso(Db.dateTime(rs, "forwarded_at")),
            iso(Db.dateTime(rs, "done_at")), iso(Db.dateTime(rs, "cancelled_at")), Ids.str(invoiceId));
    }

    /* ------------------------------------------------------------------ Dùng chung */

    /** Yêu cầu hỗ trợ đang chờ của bàn (Mới / Đã chuyển). */
    public Optional<Request> waitingSupport(long tableId) {
        return jdbc.sql(SELECT + " WHERE sr.table_id = ? AND sr.request_type <> 'payment' AND sr.status IN ('new','forwarded') ORDER BY sr.id DESC LIMIT 1")
            .param(tableId).query((rs, n) -> map(rs)).optional();
    }

    /** Yêu cầu thanh toán đang chờ của bàn. */
    public Optional<Request> waitingPayment(long tableId) {
        return jdbc.sql(SELECT + " WHERE sr.table_id = ? AND sr.request_type = 'payment' AND sr.status IN ('new','forwarded') ORDER BY sr.id DESC LIMIT 1")
            .param(tableId).query((rs, n) -> map(rs)).optional();
    }

    /** Thanh toán xong: yêu cầu thanh toán của đơn / bàn → Hoàn thành. */
    void completePayment(long orderId, long tableId) {
        jdbc.sql("""
                UPDATE service_requests SET status = 'done', done_at = ?, received_by = COALESCE(received_by, ?)
                WHERE request_type = 'payment' AND status IN ('new','forwarded') AND (order_id = ? OR table_id = ?)
                """).params(Times.now(), currentUser.get().id(), orderId, tableId).update();
    }

    /** Hủy đơn: mọi yêu cầu đang chờ của bàn → Đã hủy. */
    void cancelAllOfTable(long tableId) {
        jdbc.sql("UPDATE service_requests SET status = 'cancelled', cancelled_at = ? WHERE table_id = ? AND status IN ('new','forwarded')")
            .params(Times.now(), tableId).update();
    }

    /** Chuyển bàn: yêu cầu đang chờ đi theo đơn. */
    void moveWaiting(long fromTable, long toTable) {
        jdbc.sql("UPDATE service_requests SET table_id = ? WHERE table_id = ? AND status IN ('new','forwarded')")
            .params(toTable, fromTable).update();
    }

    static String validateTaxCode(String company, String taxCode, ValidationException.Collector v, String companyField,
                                  String taxField) {
        if (company.length() > 200) v.add(companyField, "Tên công ty tối đa 200 ký tự");
        if (!company.isEmpty() && taxCode.isEmpty()) v.add(taxField, "Vui lòng nhập mã số thuế");
        if (!taxCode.isEmpty() && !TAX_CODE.matcher(taxCode).matches()) {
            v.add(taxField, "Mã số thuế gồm 10 chữ số hoặc dạng 0123456789-001");
        }
        if (company.isEmpty() && !taxCode.isEmpty()) v.add(companyField, "Vui lòng nhập tên công ty");
        return taxCode;
    }

    /* ------------------------------------------------------------------ Khách (trang đặt món) */

    /** UC-KH-05: gọi nhân viên. */
    @Transactional
    public Request createSupport(TableRow t, SupportInput in) {
        String type = in.type() == null || in.type().isBlank() ? "support" : in.type();
        String content = Vi.collapse(in.content());
        var v = new ValidationException.Collector();
        if (!SUPPORT_TYPES.contains(type)) v.add("type", "Loại yêu cầu không hợp lệ");
        if ("other".equals(type) && content.isEmpty()) v.add("content", "Vui lòng nhập nội dung yêu cầu");
        if (content.length() > CONTENT_MAX) v.add("content", "Nội dung tối đa " + CONTENT_MAX + " ký tự");
        v.throwIfAny();
        core.lockTable(t.id());
        if (waitingSupport(t.id()).isPresent()) throw new BusinessException("Bàn đã gửi yêu cầu, nhân viên sẽ đến ngay");
        Long orderId = core.openOrderId(t.id()).orElse(null);
        jdbc.sql("INSERT INTO service_requests (table_id, order_id, request_type, content, status) VALUES (?, ?, ?, ?, 'new')")
            .params(t.id(), orderId, type, content.isEmpty() ? null : content).update();
        long id = jdbc.sql("SELECT LAST_INSERT_ID()").query(Long.class).single();
        String title = "Bàn " + t.code() + " gọi nhân viên – " + TYPE_LABEL.get(type);
        notifications.sendToRoles("service_request", title, content.isEmpty() ? TYPE_LABEL.get(type) : content,
            "service_requests", id, List.of("cashier"));
        live.publish(LiveEvents.CASHIER, LiveEvents.table(t.id()));
        return get(id);
    }

    /** UC-KH-06: yêu cầu thanh toán. */
    @Transactional
    public Request createPayment(TableRow t, PaymentInput in) {
        String method = Vi.trim(in.method());
        String company = Vi.collapse(in.vatCompany());
        String tax = Vi.trim(in.vatTaxCode());
        var v = new ValidationException.Collector();
        if (!CUSTOMER_METHODS.contains(method)) v.add("method", "Vui lòng chọn hình thức thanh toán");
        validateTaxCode(company, tax, v, "vatCompany", "vatTaxCode");
        v.throwIfAny();
        core.lockTable(t.id());
        long orderId = core.openOrderId(t.id()).orElseThrow(() -> new BusinessException("Bàn chưa có món nào để thanh toán"));
        int billable = jdbc.sql("SELECT COUNT(*) FROM order_items WHERE order_id = ? AND status <> 'cancelled'").param(orderId)
            .query(Integer.class).single();
        if (billable == 0) throw new BusinessException("Bàn chưa có món nào để thanh toán");
        if (waitingPayment(t.id()).isPresent()) throw new BusinessException("Đã gửi yêu cầu thanh toán, vui lòng chờ nhân viên");
        jdbc.sql("""
                INSERT INTO service_requests (table_id, order_id, request_type, payment_method, vat_company, vat_tax_code, status)
                VALUES (?, ?, 'payment', ?, ?, ?, 'new')
                """).params(t.id(), orderId, method, company.isEmpty() ? null : company, tax.isEmpty() ? null : tax).update();
        long id = jdbc.sql("SELECT LAST_INSERT_ID()").query(Long.class).single();
        notifications.sendToRoles("service_request", "Bàn " + t.code() + " yêu cầu thanh toán",
            "Hình thức: " + METHOD_LABEL.get(method) + (company.isEmpty() ? "" : " · Xuất VAT: " + company),
            "service_requests", id, List.of("cashier"));
        live.publish(LiveEvents.CASHIER, LiveEvents.table(t.id()));
        return get(id);
    }

    /** Khách hủy yêu cầu còn Mới (hỗ trợ) / chưa có hóa đơn (thanh toán). */
    @Transactional
    public void cancelByCustomer(TableRow t, String idText) {
        long id = Ids.parse(idText, "Không tìm thấy yêu cầu");
        Request r = get(id);
        if (!r.tableId().equals(Ids.str(t.id()))) throw BusinessException.notFound("Không tìm thấy yêu cầu");
        if ("cancelled".equals(r.status())) return;
        if (!"new".equals(r.status())) {
            throw new BusinessException("forwarded".equals(r.status()) ? "Nhân viên đang đến, không hủy được yêu cầu"
                : "Yêu cầu đã được xử lý");
        }
        if ("payment".equals(r.type()) && r.invoiceId() != null) throw new BusinessException("Hóa đơn đã được lập, vui lòng thanh toán với nhân viên");
        jdbc.sql("UPDATE service_requests SET status = 'cancelled', cancelled_at = ? WHERE id = ? AND status = 'new'")
            .params(Times.now(), id).update();
        live.publish(LiveEvents.CASHIER, LiveEvents.table(t.id()));
    }

    /* ------------------------------------------------------------------ Thu ngân (UC-TN-06) */

    public Request get(long id) {
        return jdbc.sql(SELECT + " WHERE sr.id = ?").param(id).query((rs, n) -> map(rs)).optional()
            .orElseThrow(() -> BusinessException.notFound("Không tìm thấy yêu cầu"));
    }

    /** status: waiting (mặc định) | done | cancelled. Đang chờ: cũ nhất trước; còn lại: 200 yêu cầu gần nhất. */
    public RequestList list(String status) {
        String s = status == null || status.isBlank() ? "waiting" : status;
        List<Request> items = switch (s) {
            case "done", "cancelled" -> jdbc.sql(SELECT + " WHERE sr.status = ? ORDER BY sr.id DESC LIMIT 200").param(s)
                .query((rs, n) -> map(rs)).list();
            default -> jdbc.sql(SELECT + " WHERE sr.status IN ('new','forwarded') ORDER BY sr.status = 'new' DESC, sr.created_at, sr.id")
                .query((rs, n) -> map(rs)).list();
        };
        return new RequestList(items, waitingCount());
    }

    public int waitingCount() {
        return jdbc.sql("SELECT COUNT(*) FROM service_requests WHERE status IN ('new','forwarded')").query(Integer.class).single();
    }

    /** Bàn có yêu cầu đang chờ: tableId → loại ("support" / "payment"). */
    public Map<Long, Set<String>> waitingByTable() {
        Map<Long, Set<String>> out = new java.util.HashMap<>();
        jdbc.sql("SELECT table_id, request_type FROM service_requests WHERE status IN ('new','forwarded')")
            .query((rs, n) -> out.computeIfAbsent(rs.getLong(1), k -> new java.util.TreeSet<>())
                .add("payment".equals(rs.getString(2)) ? "payment" : "support"))
            .list();
        return out;
    }

    private Request lockWaiting(String idText) {
        long id = Ids.parse(idText, "Không tìm thấy yêu cầu");
        jdbc.sql("SELECT id FROM service_requests WHERE id = ? FOR UPDATE").param(id).query(Long.class).optional()
            .orElseThrow(() -> BusinessException.notFound("Không tìm thấy yêu cầu"));
        Request r = get(id);
        if ("cancelled".equals(r.status())) throw new BusinessException("Khách đã hủy yêu cầu");
        if ("done".equals(r.status())) throw new BusinessException("Yêu cầu đã hoàn thành");
        return r;
    }

    /** Thu ngân đã báo nhân viên phục vụ (bộ đàm) → khách thấy "Nhân viên đang đến". */
    @Transactional
    public Request forward(String idText) {
        Request r = lockWaiting(idText);
        if ("payment".equals(r.type())) throw new BusinessException("Yêu cầu thanh toán xử lý bằng Lập hóa đơn");
        if ("forwarded".equals(r.status())) return r;
        long id = Long.parseLong(r.id());
        jdbc.sql("UPDATE service_requests SET status = 'forwarded', assigned_to = NULL, received_by = ?, forwarded_at = ? WHERE id = ?")
            .params(currentUser.get().id(), Times.now(), id).update();
        audit.log("cashier", "Báo nhân viên", "Bàn " + r.tableCode() + " – " + TYPE_LABEL.get(r.type()), "service_requests", id);
        live.publish(LiveEvents.CASHIER, LiveEvents.table(Long.parseLong(r.tableId())));
        return get(id);
    }

    @Transactional
    public Request done(String idText) {
        Request r = lockWaiting(idText);
        if ("payment".equals(r.type())) throw new BusinessException("Yêu cầu thanh toán tự hoàn thành khi hóa đơn được thanh toán");
        long id = Long.parseLong(r.id());
        jdbc.sql("UPDATE service_requests SET status = 'done', done_at = ?, received_by = COALESCE(received_by, ?) WHERE id = ?")
            .params(Times.now(), currentUser.get().id(), id).update();
        live.publish(LiveEvents.CASHIER, LiveEvents.table(Long.parseLong(r.tableId())));
        return get(id);
    }

    @Transactional
    public Request cancel(String idText) {
        Request r = lockWaiting(idText);
        long id = Long.parseLong(r.id());
        jdbc.sql("UPDATE service_requests SET status = 'cancelled', cancelled_at = ?, received_by = COALESCE(received_by, ?) WHERE id = ?")
            .params(Times.now(), currentUser.get().id(), id).update();
        audit.log("cashier", "Hủy yêu cầu", "Bàn " + r.tableCode() + " – " + TYPE_LABEL.get(r.type()), "service_requests", id);
        live.publish(LiveEvents.CASHIER, LiveEvents.table(Long.parseLong(r.tableId())));
        return get(id);
    }
}
