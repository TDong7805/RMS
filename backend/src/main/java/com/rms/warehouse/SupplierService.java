package com.rms.warehouse;

import com.rms.audit.AuditService;
import com.rms.common.BusinessException;
import com.rms.common.CurrentUserService;
import com.rms.common.Db;
import com.rms.common.Ids;
import com.rms.common.Paged;
import com.rms.common.Rules;
import com.rms.common.Times;
import com.rms.common.ValidationException;
import com.rms.common.Vi;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.HashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.regex.Pattern;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * UC-KHO-07..11: nhà cung cấp và danh sách nguyên liệu họ cung cấp (giá theo đơn vị mua).
 *
 * Quy tắc chính (đặc tả):
 *  - Bắt buộc tên, SĐT (di động hoặc máy bàn 02x), phương thức thanh toán. Trùng tên chỉ cảnh báo (frontend hỏi lại);
 *    mã số thuế nếu có thì duy nhất.
 *  - Ngừng hoạt động bắt buộc lý do ("Khác" bắt buộc ghi chú); phiếu mua đang chờ vẫn nhận hàng, thanh toán bình thường.
 *    Chỉ xóa được khi chưa có phiếu mua nào (kể cả nháp).
 *  - Liên kết: đơn vị mua + hệ số quy đổi (trùng đơn vị kho thì hệ số = 1), giá nhập cho 1 đơn vị mua, SL tối thiểu.
 *    Mỗi lần đổi: đóng bản ghi giá cũ (đến hôm qua) và mở bản ghi mới từ hôm nay; đổi lần nữa trong ngày thì cập nhật
 *    bản ghi của hôm nay. Ngừng liên kết: giá hiện hành kết thúc hôm nay. Kích hoạt lại: bắt buộc nhập giá mới.
 */
@Service
public class SupplierService {
    static final int PAGE_SIZE = IngredientService.PAGE_SIZE;
    public static final List<String> PURCHASE_UNITS;
    static {
        var units = new java.util.ArrayList<>(IngredientService.STOCK_UNITS);
        units.addAll(List.of("thùng", "bao", "khay", "can", "lốc", "két", "bình"));
        PURCHASE_UNITS = List.copyOf(units);
    }
    static final Set<String> STOP_REASONS = Set.of("ended", "quality", "price", "late", "other");
    private static final Pattern LANDLINE = Pattern.compile("^02\\d{9}$");
    private static final Pattern WEBSITE = Pattern.compile("^https?://\\S+$", Pattern.CASE_INSENSITIVE);
    private static final Pattern TAX = Pattern.compile("^\\d{10}(-\\d{3})?$");
    private static final String LINK_NOT_FOUND = "Không tìm thấy liên kết nguyên liệu";
    private static final String NOT_FOUND = "Không tìm thấy nhà cung cấp";

    public record Supplier(String id, String code, String name, String phone, String paymentMethod, String contact,
                           String email, String website, String taxCode, String address, String note, String status,
                           String stopReason, String stopNote, int activeLinkCount, boolean hasPurchases,
                           int openPurchaseCount, String createdAt, String updatedAt) {}

    public record Link(String id, String supplierId, String ingredientId, String ingredientCode, String ingredientName,
                       String stockUnit, boolean ingredientActive, String purchaseUnit, double factor, double price,
                       Double minOrder, String effectiveFrom, String status) {}

    public record StatusEvent(String id, String status, String reason, String note, String by, String at) {}

    public record SupplierDetail(String id, String code, String name, String phone, String paymentMethod, String contact,
                                 String email, String website, String taxCode, String address, String note, String status,
                                 String stopReason, String stopNote, int activeLinkCount, boolean hasPurchases,
                                 int openPurchaseCount, String createdAt, String updatedAt, List<Link> links,
                                 List<StatusEvent> history) {}

    public record PriceRecord(String id, String linkId, double price, String purchaseUnit, double factor, Double minOrder,
                              String from, String to, String change, String by, String at) {}

    public record NameMatch(String id, String code, String name) {}

    public record SupplierOption(String id, String code, String name, boolean active) {}

    public record LinkInput(String ingredientId, String purchaseUnit, BigDecimal factor, BigDecimal price, BigDecimal minOrder) {}

    public record SupplierInput(String name, String phone, String paymentMethod, String contact, String email, String website,
                                String taxCode, String address, String note, List<LinkInput> links) {}

    public record StopInput(String reason, String note) {}

    private final JdbcClient jdbc;
    private final AuditService audit;
    private final CurrentUserService currentUser;
    private final WarehouseCodes codes;

    public SupplierService(JdbcClient jdbc, AuditService audit, CurrentUserService currentUser, WarehouseCodes codes) {
        this.jdbc = jdbc;
        this.audit = audit;
        this.currentUser = currentUser;
        this.codes = codes;
    }

    /* ------------------------------------------------------------------ Đọc */

    private List<Supplier> suppliers(String where, Object... params) {
        return jdbc.sql("""
                SELECT s.*,
                       (SELECT COUNT(*) FROM supplier_ingredients si WHERE si.supplier_id = s.id AND si.is_active = 1) AS link_count,
                       EXISTS (SELECT 1 FROM purchase_orders po WHERE po.supplier_id = s.id) AS has_po,
                       (SELECT COUNT(*) FROM purchase_orders po WHERE po.supplier_id = s.id AND po.status = 'ordered'
                          AND po.receive_status IN ('not_received','partial')) AS open_po
                FROM suppliers s %s ORDER BY s.code
                """.formatted(where))
            .params(params)
            .query((rs, n) -> new Supplier(Ids.str(rs.getLong("id")), rs.getString("code"), rs.getString("name"),
                Vi.trim(rs.getString("phone")), rs.getString("payment_method"), Vi.trim(rs.getString("contact_name")),
                Vi.trim(rs.getString("email")), Vi.trim(rs.getString("website")), Vi.trim(rs.getString("tax_code")),
                Vi.trim(rs.getString("address")), Vi.trim(rs.getString("note")),
                rs.getBoolean("is_active") ? "active" : "inactive", rs.getString("stop_reason"),
                Vi.trim(rs.getString("stop_note")), rs.getInt("link_count"), rs.getBoolean("has_po"), rs.getInt("open_po"),
                Times.iso(Db.dateTime(rs, "created_at")), Times.iso(Db.dateTime(rs, "updated_at"))))
            .list();
    }

    private Supplier supplier(long id) {
        return suppliers("WHERE s.id = ?", id).stream().findFirst().orElseThrow(() -> BusinessException.notFound(NOT_FOUND));
    }

    public Paged<Supplier> list(String keyword, String status, int page) {
        String k = Vi.trim(keyword);
        List<Supplier> all = suppliers("").stream()
            .filter(s -> k.isEmpty() || Vi.matches(s.name(), k) || Vi.matches(s.code(), k) || s.phone().contains(k))
            .filter(s -> Vi.blank(status) || "all".equals(status) || s.status().equals(status))
            .toList();
        return Paged.of(all, page, PAGE_SIZE);
    }

    private List<Link> links(String where, Object... params) {
        return jdbc.sql("""
                SELECT si.*, i.code AS ing_code, i.name AS ing_name, i.unit AS stock_unit, i.is_active AS ing_active
                FROM supplier_ingredients si JOIN ingredients i ON i.id = si.ingredient_id
                %s ORDER BY i.code
                """.formatted(where))
            .params(params)
            .query((rs, n) -> new Link(Ids.str(rs.getLong("id")), Ids.str(rs.getLong("supplier_id")),
                Ids.str(rs.getLong("ingredient_id")), rs.getString("ing_code"), rs.getString("ing_name"),
                rs.getString("stock_unit"), rs.getBoolean("ing_active"), rs.getString("purchase_unit"),
                rs.getBigDecimal("factor").doubleValue(), rs.getBigDecimal("price").doubleValue(),
                rs.getBigDecimal("min_order") == null ? null : rs.getBigDecimal("min_order").doubleValue(),
                rs.getObject("effective_from", LocalDate.class).toString(), rs.getBoolean("is_active") ? "active" : "inactive"))
            .list();
    }

    private Link link(long id) {
        return links("WHERE si.id = ?", id).stream().findFirst().orElseThrow(() -> BusinessException.notFound(LINK_NOT_FOUND));
    }

    public SupplierDetail detail(String idText) {
        long id = Ids.parse(idText, NOT_FOUND);
        Supplier s = supplier(id);
        List<StatusEvent> history = jdbc.sql("""
                SELECT e.id, e.is_active, e.reason, e.note, e.created_at, u.full_name
                FROM supplier_status_events e LEFT JOIN users u ON u.id = e.created_by
                WHERE e.supplier_id = ? ORDER BY e.created_at DESC, e.id DESC
                """).param(id)
            .query((rs, n) -> new StatusEvent(Ids.str(rs.getLong("id")), rs.getBoolean("is_active") ? "active" : "inactive",
                rs.getString("reason"), Vi.trim(rs.getString("note")), Vi.trim(rs.getString("full_name")),
                Times.iso(Db.dateTime(rs, "created_at"))))
            .list();
        return new SupplierDetail(s.id(), s.code(), s.name(), s.phone(), s.paymentMethod(), s.contact(), s.email(),
            s.website(), s.taxCode(), s.address(), s.note(), s.status(), s.stopReason(), s.stopNote(), s.activeLinkCount(),
            s.hasPurchases(), s.openPurchaseCount(), s.createdAt(), s.updatedAt(), links("WHERE si.supplier_id = ?", id), history);
    }

    /** Ô chọn nhà cung cấp (bộ lọc, phiếu mua, nhập không phiếu): sắp theo mã. */
    public List<SupplierOption> options() {
        return jdbc.sql("SELECT id, code, name, is_active FROM suppliers ORDER BY code")
            .query((rs, n) -> new SupplierOption(Ids.str(rs.getLong("id")), rs.getString("code"), rs.getString("name"),
                rs.getBoolean("is_active")))
            .list();
    }

    /** Trùng tên (không phân biệt hoa thường, dấu) — chỉ để cảnh báo, người dùng vẫn được lưu. */
    public NameMatch findByName(String name, String exceptIdText) {
        String key = Vi.normalize(Vi.collapse(name));
        Long except = Ids.parseOrNull(exceptIdText);
        if (key.isEmpty()) return null;
        return jdbc.sql("SELECT id, code, name FROM suppliers").query((rs, n) -> new NameMatch(Ids.str(rs.getLong("id")),
                rs.getString("code"), rs.getString("name")))
            .list().stream()
            .filter(m -> except == null || !m.id().equals(Ids.str(except)))
            .filter(m -> Vi.normalize(m.name()).equals(key))
            .findFirst().orElse(null);
    }

    public List<PriceRecord> priceHistory(String linkIdText) {
        long linkId = Ids.parse(linkIdText, LINK_NOT_FOUND);
        link(linkId);
        return jdbc.sql("""
                SELECT p.*, u.full_name FROM supplier_price_history p LEFT JOIN users u ON u.id = p.created_by
                WHERE p.link_id = ? ORDER BY p.valid_from DESC, p.created_at DESC, p.id DESC
                """).param(linkId)
            .query((rs, n) -> new PriceRecord(Ids.str(rs.getLong("id")), Ids.str(linkId), rs.getBigDecimal("price").doubleValue(),
                rs.getString("purchase_unit"), rs.getBigDecimal("factor").doubleValue(),
                rs.getBigDecimal("min_order") == null ? null : rs.getBigDecimal("min_order").doubleValue(),
                rs.getObject("valid_from", LocalDate.class).toString(),
                rs.getObject("valid_to", LocalDate.class) == null ? null : rs.getObject("valid_to", LocalDate.class).toString(),
                rs.getString("change_type"), Vi.trim(rs.getString("full_name")), Times.iso(Db.dateTime(rs, "created_at"))))
            .list();
    }

    /* ------------------------------------------------------------------ Kiểm tra dữ liệu */

    private record CleanInfo(String name, String phone, String method, String contact, String email, String website,
                             String tax, String address, String note) {}

    private CleanInfo validateInfo(SupplierInput in, Long currentId, ValidationException.Collector v) {
        String name = Vi.collapse(in.name());
        if (name.isEmpty()) v.add("name", "Vui lòng nhập tên nhà cung cấp");
        else if (name.length() < 2 || name.length() > 150) v.add("name", "Tên nhà cung cấp dài từ 2 đến 150 ký tự");
        String phone = Vi.trim(in.phone());
        if (phone.isEmpty()) v.add("phone", "Vui lòng nhập số điện thoại");
        else if (!Rules.PHONE.matcher(phone).matches() && !LANDLINE.matcher(phone).matches()) {
            v.add("phone", "Số điện thoại không đúng định dạng (VD: 0912345678)");
        }
        String method = Vi.trim(in.paymentMethod());
        if (!Set.of("cash", "transfer").contains(method)) v.add("paymentMethod", "Vui lòng chọn phương thức thanh toán");
        String contact = Vi.trim(in.contact());
        if (contact.length() > 100) v.add("contact", "Người liên hệ tối đa 100 ký tự");
        String email = Vi.trim(in.email());
        if (!email.isEmpty() && (!Rules.EMAIL.matcher(email).matches() || email.length() > 150)) v.add("email", "Email không đúng định dạng");
        String website = Vi.trim(in.website());
        if (!website.isEmpty() && (!WEBSITE.matcher(website).matches() || website.length() > 200)) {
            v.add("website", "Website phải bắt đầu bằng http:// hoặc https://");
        }
        String tax = Vi.trim(in.taxCode());
        if (!tax.isEmpty() && !TAX.matcher(tax).matches()) v.add("taxCode", "Mã số thuế gồm 10 chữ số hoặc có dạng 0123456789-001");
        else if (!tax.isEmpty()) {
            jdbc.sql("SELECT id, code, name FROM suppliers WHERE tax_code = ?").param(tax)
                .query((rs, n) -> new NameMatch(Ids.str(rs.getLong("id")), rs.getString("code"), rs.getString("name")))
                .list().stream()
                .filter(m -> currentId == null || !m.id().equals(Ids.str(currentId)))
                .findFirst()
                .ifPresent(m -> v.add("taxCode", "Mã số thuế đã được dùng cho nhà cung cấp " + m.name() + " (" + m.code() + ")"));
        }
        String address = Vi.trim(in.address());
        if (address.length() > 300) v.add("address", "Địa chỉ tối đa 300 ký tự");
        String note = Vi.trim(in.note());
        if (note.length() > 500) v.add("note", "Ghi chú tối đa 500 ký tự");
        return new CleanInfo(name, phone, method, contact, email, website, tax, address, note);
    }

    private record IngredientInfo(long id, String name, String unit, boolean active) {}

    private IngredientInfo ingredient(Long id) {
        if (id == null) return null;
        return jdbc.sql("SELECT id, name, unit, is_active FROM ingredients WHERE id = ?").param(id)
            .query((rs, n) -> new IngredientInfo(rs.getLong("id"), rs.getString("name"), rs.getString("unit"), rs.getBoolean("is_active")))
            .optional().orElse(null);
    }

    private record CleanLink(long ingredientId, String ingredientName, String unit, BigDecimal factor, BigDecimal price,
                             BigDecimal minOrder) {}

    /** Kiểm tra một dòng liên kết; prefix là tiền tố tên trường để báo lỗi đúng dòng (vd. "links.2."). */
    private CleanLink validateLink(LinkInput in, Long fixedIngredientId, String prefix, ValidationException.Collector v) {
        Long ingId = fixedIngredientId != null ? fixedIngredientId : Ids.parseOrNull(in.ingredientId());
        IngredientInfo it = ingredient(ingId);
        if (ingId == null) v.add(prefix + "ingredientId", "Vui lòng chọn nguyên liệu");
        else if (it == null) v.add(prefix + "ingredientId", "Không tìm thấy nguyên liệu");
        else if (!it.active()) v.add(prefix + "ingredientId", "Nguyên liệu " + it.name() + " đã ngừng sử dụng, vui lòng bỏ dòng này");
        String unit = Vi.trim(in.purchaseUnit());
        if (!PURCHASE_UNITS.contains(unit)) v.add(prefix + "purchaseUnit", "Vui lòng chọn đơn vị mua");
        BigDecimal factor = in.factor();
        if (factor == null || factor.signum() <= 0 || !WarehouseFormat.validQty(factor)) {
            v.add(prefix + "factor", "Hệ số quy đổi phải lớn hơn 0");
        } else if (it != null && it.unit().equals(unit) && factor.compareTo(BigDecimal.ONE) != 0) {
            v.add(prefix + "factor", "Đơn vị mua trùng đơn vị kho thì hệ số bằng 1");
        }
        if (!WarehouseFormat.validMoney(in.price())) v.add(prefix + "price", "Giá nhập phải lớn hơn 0");
        BigDecimal min = in.minOrder();
        if (min != null && (min.signum() <= 0 || !WarehouseFormat.validQty(min))) v.add(prefix + "minOrder", "Số lượng tối thiểu phải là số dương");
        return new CleanLink(ingId == null ? 0 : ingId, it == null ? "" : it.name(), unit, factor, in.price(), min);
    }

    /* ------------------------------------------------------------------ Ghi: nhà cung cấp */

    private long userId() {
        return currentUser.get().id();
    }

    private static String nul(String s) {
        return s == null || s.isEmpty() ? null : s;
    }

    @Transactional
    public Supplier create(SupplierInput in) {
        var v = new ValidationException.Collector();
        CleanInfo c = validateInfo(in, null, v);
        List<LinkInput> inputs = in.links() == null ? List.of() : in.links();
        Set<Long> seen = new HashSet<>();
        List<CleanLink> links = new java.util.ArrayList<>();
        for (int i = 0; i < inputs.size(); i++) {
            CleanLink l = validateLink(inputs.get(i), null, "links." + i + ".", v);
            if (l.ingredientId() != 0 && !seen.add(l.ingredientId())) v.add("links." + i + ".ingredientId", "Nguyên liệu bị chọn trùng");
            links.add(l);
        }
        v.throwIfAny();

        String code = codes.catalog("NCC");
        jdbc.sql("""
                INSERT INTO suppliers (code, name, phone, payment_method, contact_name, email, website, tax_code, address, note)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """)
            .params(code, c.name(), c.phone(), c.method(), nul(c.contact()), nul(c.email()), nul(c.website()), nul(c.tax()),
                nul(c.address()), nul(c.note()))
            .update();
        long id = jdbc.sql("SELECT LAST_INSERT_ID()").query(Long.class).single();
        jdbc.sql("INSERT INTO supplier_status_events (supplier_id, is_active, note, created_by) VALUES (?, 1, 'Tạo nhà cung cấp', ?)")
            .params(id, userId()).update();
        for (CleanLink l : links) insertLink(id, l);
        audit.log("warehouse", "Thêm nhà cung cấp", "Thêm " + c.name() + " (" + code + ")"
            + (links.isEmpty() ? "" : " kèm " + links.size() + " nguyên liệu cung cấp"), "suppliers", id);
        return supplier(id);
    }

    @Transactional
    public Supplier update(String idText, SupplierInput in) {
        long id = Ids.parse(idText, NOT_FOUND);
        Supplier current = supplier(id);
        var v = new ValidationException.Collector();
        CleanInfo c = validateInfo(in, id, v);
        v.throwIfAny();
        jdbc.sql("""
                UPDATE suppliers SET name = ?, phone = ?, payment_method = ?, contact_name = ?, email = ?, website = ?,
                                     tax_code = ?, address = ?, note = ?
                WHERE id = ?
                """)
            .params(c.name(), c.phone(), c.method(), nul(c.contact()), nul(c.email()), nul(c.website()), nul(c.tax()),
                nul(c.address()), nul(c.note()), id)
            .update();
        audit.log("warehouse", "Sửa nhà cung cấp", "Cập nhật " + c.name() + " (" + current.code() + ")", "suppliers", id);
        return supplier(id);
    }

    @Transactional
    public Supplier stop(String idText, StopInput in) {
        long id = Ids.parse(idText, NOT_FOUND);
        Supplier s = supplier(id);
        String reason = Vi.trim(in.reason());
        String note = Vi.trim(in.note());
        var v = new ValidationException.Collector();
        if (!STOP_REASONS.contains(reason)) v.add("reason", "Vui lòng chọn lý do ngừng hoạt động");
        if ("other".equals(reason) && note.isEmpty()) v.add("note", "Vui lòng nhập ghi chú cho lý do Khác");
        if (note.length() > 255) v.add("note", "Ghi chú tối đa 255 ký tự");
        v.throwIfAny();
        if ("inactive".equals(s.status())) throw new BusinessException("Nhà cung cấp đã ở trạng thái Ngừng hoạt động");
        jdbc.sql("UPDATE suppliers SET is_active = 0, stop_reason = ?, stop_note = ? WHERE id = ?").params(reason, nul(note), id).update();
        jdbc.sql("INSERT INTO supplier_status_events (supplier_id, is_active, reason, note, created_by) VALUES (?, 0, ?, ?, ?)")
            .params(id, reason, nul(note), userId()).update();
        audit.log("warehouse", "Ngừng hoạt động nhà cung cấp", "Ngừng " + s.name() + " (" + s.code() + ")", "suppliers", id);
        return supplier(id);
    }

    @Transactional
    public Supplier activate(String idText) {
        long id = Ids.parse(idText, NOT_FOUND);
        Supplier s = supplier(id);
        if ("active".equals(s.status())) throw new BusinessException("Nhà cung cấp đã ở trạng thái Đang hoạt động");
        jdbc.sql("UPDATE suppliers SET is_active = 1, stop_reason = NULL, stop_note = NULL WHERE id = ?").param(id).update();
        jdbc.sql("INSERT INTO supplier_status_events (supplier_id, is_active, created_by) VALUES (?, 1, ?)").params(id, userId()).update();
        audit.log("warehouse", "Kích hoạt lại nhà cung cấp", "Kích hoạt lại " + s.name() + " (" + s.code() + ")", "suppliers", id);
        return supplier(id);
    }

    @Transactional
    public void delete(String idText) {
        long id = Ids.parse(idText, NOT_FOUND);
        Supplier s = supplier(id);
        if (s.hasPurchases()) {
            throw new BusinessException("Nhà cung cấp đã có phiếu mua nên không thể xóa. Bạn có thể ngừng hoạt động nhà cung cấp này.");
        }
        // Liên kết, lịch sử giá và lịch sử trạng thái xóa theo (ON DELETE CASCADE).
        jdbc.sql("DELETE FROM suppliers WHERE id = ?").param(id).update();
        audit.log("warehouse", "Xóa nhà cung cấp", "Xóa " + s.name() + " (" + s.code() + ")", "suppliers", id);
    }

    /* ------------------------------------------------------------------ Ghi: liên kết (UC-KHO-11) */

    private long insertLink(long supplierId, CleanLink l) {
        LocalDate today = Times.today();
        jdbc.sql("""
                INSERT INTO supplier_ingredients (supplier_id, ingredient_id, purchase_unit, factor, price, min_order, effective_from)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """)
            .params(supplierId, l.ingredientId(), l.unit(), l.factor(), l.price(), l.minOrder(), today)
            .update();
        long linkId = jdbc.sql("SELECT LAST_INSERT_ID()").query(Long.class).single();
        jdbc.sql("""
                INSERT INTO supplier_price_history (link_id, price, purchase_unit, factor, min_order, valid_from, change_type, created_by)
                VALUES (?, ?, ?, ?, ?, ?, 'create', ?)
                """)
            .params(linkId, l.price(), l.unit(), l.factor(), l.minOrder(), today, userId())
            .update();
        return linkId;
    }

    /** Mở bản ghi giá mới từ hôm nay; hôm nay đã có bản ghi đang áp dụng thì cập nhật bản ghi đó. */
    private void pushPrice(long linkId, CleanLink l, String change) {
        LocalDate today = Times.today();
        Long todayRow = jdbc.sql("SELECT id FROM supplier_price_history WHERE link_id = ? AND valid_from = ? ORDER BY id DESC LIMIT 1")
            .params(linkId, today).query(Long.class).optional().orElse(null);
        if (todayRow != null) {
            jdbc.sql("""
                    UPDATE supplier_price_history SET price = ?, purchase_unit = ?, factor = ?, min_order = ?, valid_to = NULL,
                           change_type = ?, created_by = ?, created_at = NOW()
                    WHERE id = ?
                    """)
                .params(l.price(), l.unit(), l.factor(), l.minOrder(), change, userId(), todayRow).update();
            return;
        }
        jdbc.sql("UPDATE supplier_price_history SET valid_to = ? WHERE link_id = ? AND (valid_to IS NULL OR valid_to >= ?)")
            .params(today.minusDays(1), linkId, today).update();
        jdbc.sql("""
                INSERT INTO supplier_price_history (link_id, price, purchase_unit, factor, min_order, valid_from, change_type, created_by)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """)
            .params(linkId, l.price(), l.unit(), l.factor(), l.minOrder(), today, change, userId()).update();
    }

    @Transactional
    public Link addLink(String supplierIdText, LinkInput in) {
        long supplierId = Ids.parse(supplierIdText, NOT_FOUND);
        Supplier s = supplier(supplierId);
        var v = new ValidationException.Collector();
        CleanLink l = validateLink(in, null, "", v);
        if (!v.has("ingredientId") && l.ingredientId() != 0) {
            boolean exists = jdbc.sql("SELECT COUNT(*) FROM supplier_ingredients WHERE supplier_id = ? AND ingredient_id = ?")
                .params(supplierId, l.ingredientId()).query(Integer.class).single() > 0;
            if (exists) v.add("ingredientId", l.ingredientName() + " đã có trong danh sách cung cấp của nhà cung cấp này");
        }
        v.throwIfAny();
        long linkId = insertLink(supplierId, l);
        audit.log("warehouse", "Thêm nguyên liệu cung cấp", s.name() + ": thêm " + l.ingredientName() + " giá "
            + WarehouseFormat.money(l.price()) + " / " + l.unit(), "supplier_ingredients", linkId);
        return link(linkId);
    }

    private CleanLink validateExisting(Link current, LinkInput in) {
        var v = new ValidationException.Collector();
        CleanLink l = validateLink(in, Long.parseLong(current.ingredientId()), "", v);
        if (v.has("ingredientId")) {
            throw new BusinessException("Nguyên liệu đang ngừng sử dụng, không thể đổi giá hoặc kích hoạt lại liên kết");
        }
        v.throwIfAny();
        return l;
    }

    @Transactional
    public Link updateLink(String linkIdText, LinkInput in) {
        long linkId = Ids.parse(linkIdText, LINK_NOT_FOUND);
        Link current = link(linkId);
        if ("inactive".equals(current.status())) throw new BusinessException("Liên kết đã ngừng, hãy kích hoạt lại trước khi đổi giá");
        CleanLink l = validateExisting(current, in);
        boolean priceChanged = l.price().compareTo(BigDecimal.valueOf(current.price())) != 0;
        boolean specChanged = !l.unit().equals(current.purchaseUnit()) || l.factor().compareTo(BigDecimal.valueOf(current.factor())) != 0;
        boolean minChanged = !Objects.equals(l.minOrder() == null ? null : l.minOrder().stripTrailingZeros(),
            current.minOrder() == null ? null : BigDecimal.valueOf(current.minOrder()).stripTrailingZeros());
        if (!priceChanged && !specChanged && !minChanged) return current;
        jdbc.sql("UPDATE supplier_ingredients SET purchase_unit = ?, factor = ?, price = ?, min_order = ?, effective_from = ? WHERE id = ?")
            .params(l.unit(), l.factor(), l.price(), l.minOrder(), Times.today(), linkId).update();
        pushPrice(linkId, l, priceChanged ? "price" : specChanged ? "spec" : "min");
        audit.log("warehouse", "Sửa giá nhập", current.ingredientName() + ": " + WarehouseFormat.money(BigDecimal.valueOf(current.price()))
            + " / " + current.purchaseUnit() + " → " + WarehouseFormat.money(l.price()) + " / " + l.unit(), "supplier_ingredients", linkId);
        return link(linkId);
    }

    @Transactional
    public Link stopLink(String linkIdText) {
        long linkId = Ids.parse(linkIdText, LINK_NOT_FOUND);
        Link current = link(linkId);
        if ("inactive".equals(current.status())) throw new BusinessException("Liên kết đã ngừng");
        jdbc.sql("UPDATE supplier_ingredients SET is_active = 0 WHERE id = ?").param(linkId).update();
        jdbc.sql("UPDATE supplier_price_history SET valid_to = ? WHERE link_id = ? AND valid_to IS NULL")
            .params(Times.today(), linkId).update();
        audit.log("warehouse", "Ngừng liên kết nguyên liệu", "Ngừng cung cấp " + current.ingredientName(), "supplier_ingredients", linkId);
        return link(linkId);
    }

    @Transactional
    public Link reactivateLink(String linkIdText, LinkInput in) {
        long linkId = Ids.parse(linkIdText, LINK_NOT_FOUND);
        Link current = link(linkId);
        if ("active".equals(current.status())) throw new BusinessException("Liên kết đang hoạt động");
        CleanLink l = validateExisting(current, in);
        jdbc.sql("UPDATE supplier_ingredients SET is_active = 1, purchase_unit = ?, factor = ?, price = ?, min_order = ?, effective_from = ? WHERE id = ?")
            .params(l.unit(), l.factor(), l.price(), l.minOrder(), Times.today(), linkId).update();
        pushPrice(linkId, l, "reactivate");
        audit.log("warehouse", "Kích hoạt lại liên kết nguyên liệu", current.ingredientName() + " giá "
            + WarehouseFormat.money(l.price()) + " / " + l.unit(), "supplier_ingredients", linkId);
        return link(linkId);
    }
}
