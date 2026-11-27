package com.rms.ordering;

import com.rms.common.BusinessException;
import com.rms.common.Ids;
import com.rms.common.Times;
import com.rms.common.ValidationException;
import com.rms.common.Vi;
import com.rms.ordering.OrderCore.OrderView;
import com.rms.ordering.OrderCore.TableRow;
import com.rms.storage.ImageStore;
import com.rms.warehouse.WarehouseCodes;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Trang đặt món của khách tại bàn (UC-KH-01..04): không đăng nhập, nhận diện bàn bằng mã QR dán trên bàn.
 * Nhân viên đặt hộ khách dùng đúng trang này (quét QR của bàn bằng máy mình).
 */
@Service
public class QrOrderingService {
    static final int MAX_QTY = 20;
    static final int MAX_LINES = 50;
    static final int NOTE_MAX = 200;

    public record TableInfo(String tableId, String tableCode, String areaName, String restaurantName, String restaurantPhone,
                            String coverImage, boolean openNow, String reopenAt, OrderView order, CustomerRequest support, CustomerRequest payment,
                            CustomerInvoice invoice, PaidInfo paid) {}

    /** Yêu cầu đang chờ của bàn (không lộ thông tin nội bộ ngoài tên nhân viên đang đến). */
    public record CustomerRequest(String id, String type, String content, String status, String assignedName, String createdAt,
                                  String paymentMethod) {}

    /** Hóa đơn chưa thanh toán của bàn, kèm mã QR chuyển khoản (nếu nhà hàng đã cấu hình tài khoản). */
    public record CustomerInvoice(String id, String code, List<InvoiceService.Line> lines, long total,
                                  PaymentSettingsService.TransferQr transfer) {}

    /** Hóa đơn vừa thanh toán (trong 15 phút, bàn chưa có đơn mới) → trang hiện "Cảm ơn quý khách". */
    public record PaidInfo(String code, long total, String paidAt) {}

    static final int THANKS_MINUTES = 15;

    /** image: ảnh minh họa danh mục (null = chưa có). */
    public record MenuCategory(String id, String name, String image) {}

    /** groupId / variantLabel: món thuộc nhóm (vd. Nước ngọt có ga → "Coca-Cola"); null = món đứng riêng. */
    public record MenuDish(String id, String name, String categoryId, long price, String description, String image,
                           String ingredients, List<String> allergens, int spicyLevel, List<String> tags, boolean soldOut,
                           String groupId, String variantLabel) {}

    /** Nhóm món hiện thành một thẻ; dishIds theo thứ tự hiển thị trong khung chọn (chỉ món đang có trên thực đơn). */
    public record MenuGroup(String id, String name, String categoryId, String description, String image, List<String> dishIds) {}

    /** Một món trong set. dishId = món mặc định; allowVariant = khách đổi được sang loại khác cùng nhóm (groupId). */
    public record MenuSetItem(String dishId, String name, int qty, boolean allowVariant, String groupId) {}

    /** Set đang bán được lúc này (đang bật, trong giờ bán, mọi món con còn phục vụ). originalPrice = tổng giá gọi lẻ. */
    public record MenuSet(String id, String name, String description, String image, long price, long originalPrice,
                          String sellFrom, String sellTo, List<MenuSetItem> items) {}

    /**
     * bestSellers: bán chạy nhất 7 ngày qua (theo hóa đơn đã thanh toán), nhiều nhất trước, tối đa 10. Phần tử là id món,
     * hoặc "g" + id nhóm khi món thuộc nhóm (các loại trong nhóm được cộng chung thành một thẻ). Không xếp set, Đồ uống,
     * Gọi thêm (băng chuyền chỉ khoe món ăn).
     */
    public record Menu(List<MenuCategory> categories, List<MenuDish> dishes, List<MenuGroup> groups, List<MenuSet> sets,
                       List<String> bestSellers) {}

    static final int BEST_SELLER_LIMIT = 10;

    /** Một món con của set khách gửi: dishId (có thể là loại khác cùng nhóm nếu được đổi), qty, ghi chú (độ chín…). */
    public record SetPart(String dishId, Integer qty, String note) {}

    /** Dòng giỏ: món lẻ (dishId) hoặc set (setId + parts; parts trống = các món mặc định của set). qty = số phần / số set. */
    public record CartLine(String dishId, Integer qty, String note, String setId, List<SetPart> parts) {}

    public record SendInput(List<CartLine> items) {}

    private final JdbcClient jdbc;
    private final OrderCore core;
    private final LiveEvents live;
    private final WarehouseCodes codes;
    private final ImageStore images;
    private final ServiceRequestService requests;
    private final InvoiceService invoices;
    private final com.rms.common.SystemSettings settings;
    private final com.rms.shift.DutyService duty;
    private final com.rms.notification.NotificationService notifications;
    private final com.rms.common.CurrentUserService currentUser;

    /** Cấu hình (V22): món khách gửi qua QR phải được phục vụ xác nhận rồi mới xuống bếp. */
    public static final String REQUIRE_CONFIRM_KEY = "order.require_confirm";

    public QrOrderingService(JdbcClient jdbc, OrderCore core, LiveEvents live, WarehouseCodes codes, ImageStore images,
                             ServiceRequestService requests, InvoiceService invoices, com.rms.common.SystemSettings settings,
                             com.rms.shift.DutyService duty, com.rms.notification.NotificationService notifications,
                             com.rms.common.CurrentUserService currentUser) {
        this.settings = settings;
        this.duty = duty;
        this.notifications = notifications;
        this.currentUser = currentUser;
        this.jdbc = jdbc;
        this.core = core;
        this.live = live;
        this.codes = codes;
        this.images = images;
        this.requests = requests;
        this.invoices = invoices;
    }

    /** UC-KH-01: mã QR sai / bàn đã xóa → 404; bàn ngừng phục vụ → 409 kèm thông báo. */
    public TableRow table(String token) {
        TableRow t = core.tableByToken(token)
            .orElseThrow(() -> BusinessException.notFound("Mã QR không hợp lệ. Vui lòng liên hệ nhân viên."));
        if ("inactive".equals(t.status())) {
            throw new BusinessException("Bàn đang tạm ngừng phục vụ. Vui lòng liên hệ nhân viên.", HttpStatus.CONFLICT);
        }
        return t;
    }

    public TableInfo info(String token) {
        TableRow t = table(token);
        var r = jdbc.sql("SELECT name, phone, cover_image_url FROM restaurant_info WHERE id = 1")
            .query((rs, n) -> new String[] {rs.getString("name"), rs.getString("phone"), images.url(rs.getString("cover_image_url"))}).optional()
            .orElse(new String[] {"Nhà hàng", "", null});
        OrderView order = core.openOrderId(t.id()).map(core::order).orElse(null);
        CustomerRequest support = requests.waitingSupport(t.id()).map(QrOrderingService::slim).orElse(null);
        CustomerRequest payment = requests.waitingPayment(t.id()).map(QrOrderingService::slim).orElse(null);
        CustomerInvoice invoice = null;
        PaidInfo paid = null;
        if (order != null && order.locked()) {
            var inv = jdbc.sql("SELECT id FROM invoices WHERE order_id = ? AND status = 'unpaid' ORDER BY id DESC LIMIT 1")
                .param(Long.parseLong(order.id())).query(Long.class).optional().map(invoices::get).orElse(null);
            if (inv != null) invoice = new CustomerInvoice(inv.id(), inv.code(), inv.lines(), inv.total(), inv.transfer());
        }
        if (order == null) {
            paid = jdbc.sql("""
                    SELECT i.code, i.total_amount, i.paid_at FROM invoices i JOIN orders o ON o.id = i.order_id
                    WHERE o.table_id = ? AND i.status = 'paid' AND i.paid_at >= ? ORDER BY i.paid_at DESC LIMIT 1
                    """).params(t.id(), Times.now().minusMinutes(THANKS_MINUTES))
                .query((rs, n) -> new PaidInfo(rs.getString(1), rs.getBigDecimal(2).longValue(),
                    Times.iso(com.rms.common.Db.dateTime(rs, "paid_at"))))
                .optional().orElse(null);
        }
        boolean open = core.isOpenNow();
        LocalDateTime reopen = open ? null : core.nextOpenAt();
        return new TableInfo(Ids.str(t.id()), t.code(), t.areaName(), r[0], r[1], r[2], open, reopen == null ? null : Times.iso(reopen),
            order, support, payment, invoice, paid);
    }

    private static CustomerRequest slim(ServiceRequestService.Request r) {
        return new CustomerRequest(r.id(), r.type(), r.content(), r.status(), r.assignedName(), r.createdAt(), r.paymentMethod());
    }

    /** UC-KH-05: gọi nhân viên. */
    public TableInfo callStaff(String token, ServiceRequestService.SupportInput in) {
        requests.createSupport(table(token), in);
        return info(token);
    }

    /** UC-KH-06: yêu cầu thanh toán. */
    public TableInfo requestPayment(String token, ServiceRequestService.PaymentInput in) {
        requests.createPayment(table(token), in);
        return info(token);
    }

    public TableInfo cancelRequest(String token, String requestId) {
        requests.cancelByCustomer(table(token), requestId);
        return info(token);
    }

    public OrderView currentOrder(String token) {
        TableRow t = table(token);
        return core.openOrderId(t.id()).map(core::order).orElse(null);
    }

    /** UC-KH-02: món đang bán của danh mục đang bật; món tạm hết hôm nay vẫn hiện (soldOut = true). */
    public Menu menu(String token) {
        table(token);
        return menu();
    }

    /** Thực đơn như khách thấy — Nhân viên phục vụ tra cứu / gọi món hộ (không cần mã QR). */
    public Menu menu() {
        List<MenuCategory> cats = jdbc.sql("SELECT id, name, image_url FROM dish_categories WHERE is_active = 1 ORDER BY sort_order, id")
            .query((rs, n) -> new MenuCategory(Ids.str(rs.getLong("id")), rs.getString("name"), images.url(rs.getString("image_url")))).list();
        Map<Long, List<String>> allergens = new HashMap<>();
        jdbc.sql("SELECT da.dish_id, a.name FROM dish_allergens da JOIN allergens a ON a.id = da.allergen_id ORDER BY a.id")
            .query((rs, n) -> allergens.computeIfAbsent(rs.getLong(1), k -> new ArrayList<>()).add(rs.getString(2))).list();
        Map<Long, List<String>> tags = new HashMap<>();
        jdbc.sql("SELECT dt.dish_id, t.name FROM dish_ai_tags dt JOIN ai_tags t ON t.id = dt.tag_id ORDER BY t.id")
            .query((rs, n) -> tags.computeIfAbsent(rs.getLong(1), k -> new ArrayList<>()).add(rs.getString(2))).list();
        List<MenuDish> dishes = jdbc.sql("""
                SELECT d.id, d.name, d.category_id, d.price, d.description, d.image_url, d.ingredients_text, d.spicy_level,
                       (d.sold_out_date = ?) AS sold_out, d.group_id, d.variant_label
                FROM dishes d JOIN dish_categories c ON c.id = d.category_id
                WHERE d.status = 'selling' AND c.is_active = 1
                ORDER BY c.sort_order, c.id, d.name
                """).param(Times.today())
            .query((rs, n) -> new MenuDish(Ids.str(rs.getLong("id")), rs.getString("name"), Ids.str(rs.getLong("category_id")),
                rs.getBigDecimal("price").longValue(), Vi.trim(rs.getString("description")), images.url(rs.getString("image_url")),
                Vi.trim(rs.getString("ingredients_text")), allergens.getOrDefault(rs.getLong("id"), List.of()),
                rs.getInt("spicy_level"), tags.getOrDefault(rs.getLong("id"), List.of()), rs.getBoolean("sold_out"),
                rs.getObject("group_id") == null ? null : Ids.str(rs.getLong("group_id")), Vi.trim(rs.getString("variant_label"))))
            .list();
        return new Menu(cats, dishes, groups(dishes), sets(dishes), bestSellers(dishes));
    }

    /** Nhóm có ít nhất một món đang trên thực đơn; món trong nhóm xếp theo mã món (thứ tự nhập). */
    private List<MenuGroup> groups(List<MenuDish> dishes) {
        Map<String, List<String>> members = new java.util.LinkedHashMap<>();
        jdbc.sql("SELECT id, group_id FROM dishes WHERE group_id IS NOT NULL ORDER BY code")
            .query((rs, n) -> members.computeIfAbsent(Ids.str(rs.getLong("group_id")), k -> new ArrayList<>()).add(Ids.str(rs.getLong("id"))))
            .list();
        java.util.Set<String> onMenu = new java.util.HashSet<>(dishes.stream().map(MenuDish::id).toList());
        return jdbc.sql("SELECT id, name, category_id, description, image_url FROM dish_groups ORDER BY sort_order, id")
            .query((rs, n) -> {
                String id = Ids.str(rs.getLong("id"));
                List<String> ids = members.getOrDefault(id, List.of()).stream().filter(onMenu::contains).toList();
                return new MenuGroup(id, rs.getString("name"), Ids.str(rs.getLong("category_id")), Vi.trim(rs.getString("description")),
                    images.url(rs.getString("image_url")), ids);
            })
            .list().stream().filter(g -> !g.dishIds().isEmpty()).toList();
    }

    /**
     * Set bán được lúc này: đang bật + hiện trên thực đơn + trong giờ bán + mọi món con còn phục vụ (món cho đổi loại thì
     * chỉ cần còn một loại trong nhóm — lúc đó món mặc định đổi sang loại còn hàng). Không đủ điều kiện thì ẩn cả set.
     */
    private List<MenuSet> sets(List<MenuDish> dishes) {
        Map<String, MenuDish> available = new HashMap<>();
        dishes.stream().filter(d -> !d.soldOut()).forEach(d -> available.put(d.id(), d));
        java.time.LocalTime now = Times.now().toLocalTime();
        List<SetHead> heads = setHeads("""
                WHERE is_active = 1 AND on_menu = 1 AND price IS NOT NULL ORDER BY sort_order, id
                """);
        List<MenuSet> out = new ArrayList<>();
        for (SetHead h : heads) {
            if (!h.inHours(now)) continue;
            List<MenuSetItem> items = new ArrayList<>();
            long original = 0;
            boolean ok = true;
            List<SetItemRow> rows = setItems(h.id());
            if (rows.isEmpty()) continue;
            for (SetItemRow r : rows) {
                MenuDish d = available.get(Ids.str(r.dishId()));
                if (d == null && r.allowVariant() && r.groupId() != null) {
                    d = dishes.stream().filter(x -> !x.soldOut() && Ids.str(r.groupId()).equals(x.groupId())).findFirst().orElse(null);
                }
                if (d == null) {
                    ok = false;
                    break;
                }
                items.add(new MenuSetItem(d.id(), d.name(), r.qty(), r.allowVariant(), d.groupId()));
                original += d.price() * r.qty();
            }
            if (!ok) continue;
            out.add(new MenuSet(Ids.str(h.id()), h.name(), h.description(), images.url(h.image()), h.price(), original,
                h.from() == null ? null : h.from().toString(), h.to() == null ? null : h.to().toString(), items));
        }
        return out;
    }

    private record SetHead(long id, String name, String description, String image, long price, boolean active, boolean onMenu,
                           java.time.LocalTime from, java.time.LocalTime to) {
        boolean inHours(java.time.LocalTime t) {
            return from == null || (!t.isBefore(from) && t.isBefore(to));
        }
    }

    private List<SetHead> setHeads(String where, Object... params) {
        return jdbc.sql("SELECT id, name, description, image_url, price, is_active, on_menu, sell_from, sell_to FROM combos " + where)
            .params(params)
            .query((rs, n) -> new SetHead(rs.getLong("id"), rs.getString("name"), Vi.trim(rs.getString("description")),
                rs.getString("image_url"), rs.getBigDecimal("price") == null ? 0 : rs.getBigDecimal("price").longValue(),
                rs.getBoolean("is_active"), rs.getBoolean("on_menu"),
                com.rms.common.Db.time(rs, "sell_from"), com.rms.common.Db.time(rs, "sell_to")))
            .list();
    }

    private record SetItemRow(long dishId, int qty, boolean allowVariant, Long groupId) {}

    private List<SetItemRow> setItems(long comboId) {
        return jdbc.sql("""
                SELECT ci.dish_id, ci.quantity, ci.allow_variant, d.group_id FROM combo_items ci JOIN dishes d ON d.id = ci.dish_id
                WHERE ci.combo_id = ? ORDER BY ci.sort_order, ci.dish_id
                """).param(comboId)
            .query((rs, n) -> new SetItemRow(rs.getLong("dish_id"), rs.getInt("quantity"), rs.getBoolean("allow_variant"),
                rs.getObject("group_id") == null ? null : rs.getLong("group_id")))
            .list();
    }

    /** Món bán chạy 7 ngày qua; ít hơn 3 món có số liệu thì lấy 30 ngày. Chỉ món đang có trong thực đơn. */
    private List<String> bestSellers(List<MenuDish> dishes) {
        // Băng chuyền chỉ khoe món ăn: bỏ Đồ uống (khách nào cũng gọi) và Gọi thêm (món phụ).
        java.util.Set<String> skipCats = new java.util.HashSet<>(jdbc.sql("SELECT id, name FROM dish_categories")
            .query((rs, n) -> {
                String name = java.text.Normalizer.normalize(rs.getString("name"), java.text.Normalizer.Form.NFD)
                    .replaceAll("\\p{M}", "").replace('đ', 'd').replace('Đ', 'D').toLowerCase();
                return name.contains("do uong") || name.contains("goi them") ? Ids.str(rs.getLong("id")) : null;
            }).list().stream().filter(java.util.Objects::nonNull).toList());
        Map<String, String> keyOf = new HashMap<>();   // id món đang trên thực đơn → khóa xếp hạng (id món hoặc "g" + id nhóm)
        dishes.stream().filter(d -> !skipCats.contains(d.categoryId()))
            .forEach(d -> keyOf.put(d.id(), d.groupId() == null ? d.id() : "g" + d.groupId()));
        for (int days : new int[] {7, 30}) {
            Map<String, Long> total = new java.util.LinkedHashMap<>();
            jdbc.sql("""
                    SELECT oi.dish_id, SUM(oi.quantity) AS qty FROM order_items oi JOIN invoices i ON i.order_id = oi.order_id
                    WHERE i.status = 'paid' AND i.paid_at >= ? AND oi.status <> 'cancelled'
                    GROUP BY oi.dish_id ORDER BY oi.dish_id
                    """).param(Times.today().minusDays(days - 1).atStartOfDay())
                .query((rs, n) -> {
                    String key = keyOf.get(Ids.str(rs.getLong(1)));
                    if (key != null) total.merge(key, rs.getLong(2), Long::sum);
                    return key;
                }).list();
            List<String> ids = total.entrySet().stream()
                .sorted(Map.Entry.<String, Long>comparingByValue().reversed())
                .map(Map.Entry::getKey).limit(BEST_SELLER_LIMIT).toList();
            if (ids.size() >= 3 || days == 30) return ids;
        }
        return List.of();
    }

    private record DishRow(long id, String name, long price, boolean selling, boolean soldOut, Long groupId) {}

    private DishRow dishRow(Long dishId) {
        return dishId == null ? null : jdbc.sql("""
                SELECT d.id, d.name, d.price, (d.status = 'selling' AND c.is_active = 1) AS selling, (d.sold_out_date = ?) AS sold_out,
                       d.group_id
                FROM dishes d JOIN dish_categories c ON c.id = d.category_id WHERE d.id = ?
                """).params(Times.today(), dishId)
            .query((rs, n) -> new DishRow(rs.getLong("id"), rs.getString("name"), rs.getBigDecimal("price").longValue(),
                rs.getBoolean("selling"), rs.getBoolean("sold_out"), rs.getObject("group_id") == null ? null : rs.getLong("group_id")))
            .optional().orElse(null);
    }

    /** Một dòng sẽ ghi vào order_items. */
    private record Piece(DishRow dish, int qty, String note) {}

    /** Một dòng giỏ đã kiểm tra: món lẻ (set == null) hoặc set (pieces = món con của MỘT set, qty = số set). */
    private record Planned(SetHead set, List<Piece> pieces, int qty) {}

    /** UC-KH-03: gửi giỏ món → cộng vào đơn đang mở của bàn. Tất cả hoặc không gì. */
    @Transactional
    public OrderView send(String token, SendInput in) {
        return send(table(token), in, false);
    }

    public boolean requireConfirm() {
        return !"false".equalsIgnoreCase(settings.string(REQUIRE_CONFIRM_KEY, "true"));
    }

    /**
     * Nhân viên phục vụ gọi món hộ khách: như khách gửi giỏ, món ghi added_via = 'staff'. Bàn phải đã mở.
     * Người gọi chịu trách nhiệm → món coi như đã xác nhận (confirmed_by = người gọi), xuống bếp ngay.
     */
    @Transactional
    public OrderView sendByStaff(long tableId, SendInput in) {
        TableRow t = core.table(tableId);
        if ("inactive".equals(t.status())) throw new BusinessException("Bàn " + t.code() + " đang ngừng phục vụ");
        return send(t, in, true);
    }

    private OrderView send(TableRow t, SendInput in, boolean staff) {
        if (!core.isOpenNow()) throw new BusinessException("Nhà hàng hiện ngoài giờ phục vụ.");
        List<CartLine> lines = in.items() == null ? List.of() : in.items();
        if (lines.isEmpty()) throw new ValidationException("items", "Giỏ món đang trống");
        if (lines.size() > MAX_LINES) throw new ValidationException("items", "Mỗi lần gửi tối đa " + MAX_LINES + " dòng món");

        Map<String, String> fields = new java.util.LinkedHashMap<>();
        List<String> soldOut = new ArrayList<>();
        List<Planned> plan = new ArrayList<>();
        for (int i = 0; i < lines.size(); i++) {
            CartLine l = lines.get(i);
            int qty = l.qty() == null ? 0 : l.qty();
            if (qty < 1 || qty > MAX_QTY) fields.put("items." + i + ".qty", "Số lượng từ 1 đến " + MAX_QTY);
            if (!Vi.blank(l.setId())) {
                Planned p = planSet(l, i, qty, fields, soldOut);
                if (p != null) plan.add(p);
                continue;
            }
            DishRow d = dishRow(Ids.parseOrNull(l.dishId()));
            if (d == null) {
                fields.put("items." + i + ".dishId", "Món không còn trong thực đơn");
                continue;
            }
            if (!d.selling() || d.soldOut()) {
                soldOut.add(d.name());
                fields.put("items." + i + ".dishId", d.name() + " hiện đã hết");
                continue;
            }
            String note = Vi.collapse(l.note());
            if (note.length() > NOTE_MAX) fields.put("items." + i + ".note", "Ghi chú tối đa " + NOTE_MAX + " ký tự");
            plan.add(new Planned(null, List.of(new Piece(d, qty, note)), 1));
        }
        if (!soldOut.isEmpty()) {
            throw new ValidationException(fields,
                "Một số món đã hết: " + String.join(", ", soldOut) + ". Vui lòng xóa khỏi giỏ để gửi các món còn lại.");
        }
        if (!fields.isEmpty()) throw new ValidationException(fields);

        core.lockTable(t.id());
        long orderId = core.openOrderId(t.id()).orElse(-1L);
        if (orderId > 0 && core.isLocked(orderId)) {
            throw new BusinessException("Bàn đang chờ thanh toán, không gọi thêm món được. Vui lòng gọi nhân viên nếu cần gọi thêm.");
        }
        // Mã QR chỉ gửi được món khi thu ngân / phục vụ đã mở bàn (chặn người không ngồi tại bàn quét mã rồi đặt).
        if (orderId < 0) {
            throw new BusinessException(staff ? "Bàn " + t.code() + " chưa được mở. Hãy mở bàn trước khi gọi món."
                : "Bàn chưa được mở. Vui lòng gọi nhân viên để mở bàn trước khi gọi món.");
        }
        String via = staff ? "staff" : "customer";
        // V22: món khách gửi chờ phục vụ xác nhận (trừ khi quản lý tắt); món nhân viên gọi hộ xuống bếp ngay.
        String status = !staff && requireConfirm() ? "unconfirmed" : "pending";
        Long confirmer = staff ? currentUser.get().id() : null;
        int batch = jdbc.sql("SELECT COALESCE(MAX(batch_no), 0) + 1 FROM order_items WHERE order_id = ?").param(orderId)
            .query(Integer.class).single();
        for (Planned p : plan) {
            if (p.set() == null) {
                Piece c = p.pieces().get(0);
                insertItem(orderId, batch, null, c.dish(), c.dish().price(), c.qty(), c.note(), via, status, confirmer);
                continue;
            }
            for (int k = 0; k < p.qty(); k++) {
                jdbc.sql("INSERT INTO order_sets (order_id, combo_id, set_name, set_price) VALUES (?, ?, ?, ?)")
                    .params(orderId, p.set().id(), p.set().name(), p.set().price()).update();
                long setId = jdbc.sql("SELECT LAST_INSERT_ID()").query(Long.class).single();
                for (Object[] row : allocate(p.pieces(), p.set().price())) {
                    Piece c = (Piece) row[0];
                    insertItem(orderId, batch, setId, c.dish(), (long) row[1], (int) row[2], c.note(), via, status, confirmer);
                }
            }
        }
        jdbc.sql("UPDATE dining_tables SET status = 'occupied' WHERE id = ? AND status IN ('available','reserved')").param(t.id()).update();
        if ("unconfirmed".equals(status)) {
            int n = plan.stream().mapToInt(p -> p.set() == null ? p.pieces().get(0).qty() : p.qty()).sum();
            String title = "Bàn " + t.code() + " (" + t.areaName() + ") gọi " + n + " món – chờ xác nhận";
            List<Long> waiters = duty.waitersFor(t.areaId(), Times.now());
            for (long w : waiters) {
                notifications.sendToUser("service_request", title, "Kiểm tra với khách rồi xác nhận để chuyển bếp", "orders", orderId, w);
            }
            // Chưa phục vụ nào vào ca → báo quầy thu ngân gọi người (đơn vẫn chờ phục vụ xác nhận).
            if (waiters.isEmpty()) {
                notifications.sendToRoles("service_request", title, "Chưa có phục vụ nào vào ca để xác nhận đơn", "orders", orderId,
                    List.of("cashier"));
            }
        }
        live.publish(LiveEvents.KITCHEN, LiveEvents.CASHIER, LiveEvents.WAITER, LiveEvents.table(t.id()));
        return core.order(orderId);
    }

    private void insertItem(long orderId, int batch, Long setId, DishRow d, long unitPrice, int qty, String note, String via,
                            String status, Long confirmer) {
        jdbc.sql("""
                INSERT INTO order_items (order_id, order_set_id, batch_no, dish_id, dish_name, unit_price, quantity, note, status,
                                         added_via, confirmed_by, confirmed_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """)
            .params(orderId, setId, batch, d.id(), d.name(), unitPrice, qty, note == null || note.isEmpty() ? null : note, status, via,
                confirmer, confirmer == null ? null : Times.now()).update();
    }

    /**
     * Kiểm tra một dòng set trong giỏ. parts trống = món mặc định. Mỗi món con phải khớp đúng món của set (hoặc loại khác
     * cùng nhóm nếu set cho đổi), đủ số lượng, còn phục vụ. Set phải đang bán và trong giờ bán.
     */
    private Planned planSet(CartLine l, int i, int qty, Map<String, String> fields, List<String> soldOut) {
        Long comboId = Ids.parseOrNull(l.setId());
        SetHead h = comboId == null ? null : setHeads("WHERE id = ?", comboId).stream().findFirst().orElse(null);
        if (h == null || !h.active() || !h.onMenu()) {
            fields.put("items." + i + ".setId", "Set không còn trong thực đơn");
            return null;
        }
        if (!h.inHours(Times.now().toLocalTime())) {
            fields.put("items." + i + ".setId", h.name() + " chỉ bán từ " + h.from() + " đến " + h.to());
            return null;
        }
        List<SetItemRow> rows = setItems(h.id());
        List<SetPart> parts = l.parts() == null || l.parts().isEmpty()
            ? rows.stream().map(r -> new SetPart(Ids.str(r.dishId()), r.qty(), null)).toList()
            : l.parts();
        int[] need = rows.stream().mapToInt(SetItemRow::qty).toArray();
        List<Piece> pieces = new ArrayList<>();
        for (int j = 0; j < parts.size(); j++) {
            SetPart part = parts.get(j);
            DishRow d = dishRow(Ids.parseOrNull(part.dishId()));
            int pq = part.qty() == null ? 0 : part.qty();
            int match = -1;
            if (d != null) {
                for (int k = 0; k < rows.size() && match < 0; k++) {
                    SetItemRow r = rows.get(k);
                    boolean same = r.dishId() == d.id() || (r.allowVariant() && r.groupId() != null && r.groupId().equals(d.groupId()));
                    if (same && need[k] >= pq) match = k;
                }
            }
            if (d == null || pq < 1 || match < 0) {
                fields.put("items." + i + ".parts", "Món trong " + h.name() + " không đúng, vui lòng chọn lại");
                return null;
            }
            need[match] -= pq;
            if (!d.selling() || d.soldOut()) {
                soldOut.add(d.name() + " (trong " + h.name() + ")");
                fields.put("items." + i + ".setId", h.name() + ": " + d.name() + " hiện đã hết");
                return null;
            }
            String note = Vi.collapse(part.note());
            if (note.length() > NOTE_MAX) fields.put("items." + i + ".parts." + j + ".note", "Ghi chú tối đa " + NOTE_MAX + " ký tự");
            pieces.add(new Piece(d, pq, note));
        }
        if (java.util.Arrays.stream(need).anyMatch(x -> x != 0)) {
            fields.put("items." + i + ".parts", "Món trong " + h.name() + " chưa đủ, vui lòng chọn lại");
            return null;
        }
        return new Planned(h, pieces, qty);
    }

    /**
     * Chia giá set cho các món con theo tỉ lệ giá gọi lẻ, làm tròn đến đồng; phần lẻ còn lại cộng vào một dòng có số lượng 1
     * (không có thì tách một phần ra thành dòng riêng) để tổng đúng bằng giá set. Trả về [Piece, đơn giá, số lượng].
     */
    static List<Object[]> allocate(List<Piece> pieces, long setPrice) {
        long base = pieces.stream().mapToLong(p -> p.dish().price() * p.qty()).sum();
        List<Object[]> rows = new ArrayList<>();
        long sum = 0;
        for (Piece p : pieces) {
            long unit = base == 0 ? 0 : Math.round((double) p.dish().price() * setPrice / base);
            rows.add(new Object[] {p, unit, p.qty()});
            sum += unit * p.qty();
        }
        long diff = setPrice - sum;
        if (diff != 0 && !rows.isEmpty()) {
            Object[] single = rows.stream().filter(r -> (int) r[2] == 1).findFirst().orElse(null);
            if (single != null) {
                single[1] = (long) single[1] + diff;
            } else {
                Object[] r = rows.get(0);
                r[2] = (int) r[2] - 1;
                rows.add(new Object[] {r[0], (long) r[1] + diff, 1});
            }
        }
        return rows;
    }

    /** UC-KH-04: khách hủy món còn Chờ xác nhận / Chờ chế biến. */
    @Transactional
    public OrderView cancelItem(String token, String itemIdText) {
        TableRow t = table(token);
        long itemId = Ids.parse(itemIdText, "Không tìm thấy món");
        core.lockTable(t.id());
        record It(long orderId, long tableId, String status, String orderStatus) {}
        It it = jdbc.sql("""
                SELECT oi.order_id, o.table_id, oi.status, o.status AS order_status
                FROM order_items oi JOIN orders o ON o.id = oi.order_id WHERE oi.id = ? FOR UPDATE
                """).param(itemId)
            .query((rs, n) -> new It(rs.getLong("order_id"), rs.getLong("table_id"), rs.getString("status"), rs.getString("order_status")))
            .optional().orElseThrow(() -> BusinessException.notFound("Không tìm thấy món"));
        if (it.tableId() != t.id() || !"open".equals(it.orderStatus())) throw BusinessException.notFound("Không tìm thấy món");
        if (core.isLocked(it.orderId())) throw new BusinessException("Bàn đang chờ thanh toán, không hủy món được.");
        if ("cancelled".equals(it.status())) return core.order(it.orderId());
        if (!"pending".equals(it.status()) && !"unconfirmed".equals(it.status())) {
            throw new BusinessException("Bếp đã bắt đầu chế biến món này, không thể hủy. Vui lòng gọi nhân viên nếu cần hỗ trợ.");
        }
        Long setId = jdbc.sql("SELECT order_set_id FROM order_items WHERE id = ?").param(itemId).query(Long.class).optional().orElse(null);
        if (setId != null) {
            // Món trong set: khách chỉ hủy được cả set, khi bếp chưa bắt đầu món nào của set.
            int started = jdbc.sql("SELECT COUNT(*) FROM order_items WHERE order_set_id = ? AND status NOT IN ('unconfirmed','pending','cancelled')")
                .param(setId).query(Integer.class).single();
            if (started > 0) {
                throw new BusinessException("Bếp đã bắt đầu làm món trong set này, không thể hủy set. Vui lòng gọi nhân viên nếu cần hỗ trợ.");
            }
            jdbc.sql("UPDATE order_items SET status = 'cancelled', cancel_source = 'customer', cancel_reason = 'Khách hủy set', cancelled_at = ? WHERE order_set_id = ? AND status IN ('unconfirmed','pending')")
                .params(Times.now(), setId).update();
        } else {
            jdbc.sql("UPDATE order_items SET status = 'cancelled', cancel_source = 'customer', cancel_reason = 'Khách hủy', cancelled_at = ? WHERE id = ?")
                .params(Times.now(), itemId).update();
        }
        live.publish(LiveEvents.KITCHEN, LiveEvents.CASHIER, LiveEvents.table(t.id()));
        return core.order(it.orderId());
    }
}
