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
                            boolean openNow, OrderView order) {}

    public record MenuCategory(String id, String name) {}

    public record MenuDish(String id, String name, String categoryId, long price, String description, String image,
                           String ingredients, List<String> allergens, int spicyLevel, List<String> tags, boolean soldOut) {}

    public record Menu(List<MenuCategory> categories, List<MenuDish> dishes) {}

    public record CartLine(String dishId, Integer qty, String note) {}

    public record SendInput(List<CartLine> items) {}

    private final JdbcClient jdbc;
    private final OrderCore core;
    private final LiveEvents live;
    private final WarehouseCodes codes;
    private final ImageStore images;

    public QrOrderingService(JdbcClient jdbc, OrderCore core, LiveEvents live, WarehouseCodes codes, ImageStore images) {
        this.jdbc = jdbc;
        this.core = core;
        this.live = live;
        this.codes = codes;
        this.images = images;
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
        var r = jdbc.sql("SELECT name, phone FROM restaurant_info WHERE id = 1")
            .query((rs, n) -> new String[] {rs.getString("name"), rs.getString("phone")}).optional()
            .orElse(new String[] {"Nhà hàng", ""});
        OrderView order = core.openOrderId(t.id()).map(core::order).orElse(null);
        return new TableInfo(Ids.str(t.id()), t.code(), t.areaName(), r[0], r[1], core.isOpenNow(), order);
    }

    public OrderView currentOrder(String token) {
        TableRow t = table(token);
        return core.openOrderId(t.id()).map(core::order).orElse(null);
    }

    /** UC-KH-02: món đang bán của danh mục đang bật; món tạm hết hôm nay vẫn hiện (soldOut = true). */
    public Menu menu(String token) {
        table(token);
        List<MenuCategory> cats = jdbc.sql("SELECT id, name FROM dish_categories WHERE is_active = 1 ORDER BY sort_order, id")
            .query((rs, n) -> new MenuCategory(Ids.str(rs.getLong("id")), rs.getString("name"))).list();
        Map<Long, List<String>> allergens = new HashMap<>();
        jdbc.sql("SELECT da.dish_id, a.name FROM dish_allergens da JOIN allergens a ON a.id = da.allergen_id ORDER BY a.id")
            .query((rs, n) -> allergens.computeIfAbsent(rs.getLong(1), k -> new ArrayList<>()).add(rs.getString(2))).list();
        Map<Long, List<String>> tags = new HashMap<>();
        jdbc.sql("SELECT dt.dish_id, t.name FROM dish_ai_tags dt JOIN ai_tags t ON t.id = dt.tag_id ORDER BY t.id")
            .query((rs, n) -> tags.computeIfAbsent(rs.getLong(1), k -> new ArrayList<>()).add(rs.getString(2))).list();
        List<MenuDish> dishes = jdbc.sql("""
                SELECT d.id, d.name, d.category_id, d.price, d.description, d.image_url, d.ingredients_text, d.spicy_level,
                       (d.sold_out_date = ?) AS sold_out
                FROM dishes d JOIN dish_categories c ON c.id = d.category_id
                WHERE d.status = 'selling' AND c.is_active = 1
                ORDER BY c.sort_order, c.id, d.name
                """).param(Times.today())
            .query((rs, n) -> new MenuDish(Ids.str(rs.getLong("id")), rs.getString("name"), Ids.str(rs.getLong("category_id")),
                rs.getBigDecimal("price").longValue(), Vi.trim(rs.getString("description")), images.url(rs.getString("image_url")),
                Vi.trim(rs.getString("ingredients_text")), allergens.getOrDefault(rs.getLong("id"), List.of()),
                rs.getInt("spicy_level"), tags.getOrDefault(rs.getLong("id"), List.of()), rs.getBoolean("sold_out")))
            .list();
        return new Menu(cats, dishes);
    }

    private record DishRow(long id, String name, long price, boolean selling, boolean soldOut) {}

    /** UC-KH-03: gửi giỏ món → cộng vào đơn đang mở của bàn (tạo đơn nếu chưa có). Tất cả hoặc không gì. */
    @Transactional
    public OrderView send(String token, SendInput in) {
        TableRow t = table(token);
        if (!core.isOpenNow()) throw new BusinessException("Nhà hàng hiện ngoài giờ phục vụ.");
        List<CartLine> lines = in.items() == null ? List.of() : in.items();
        if (lines.isEmpty()) throw new ValidationException("items", "Giỏ món đang trống");
        if (lines.size() > MAX_LINES) throw new ValidationException("items", "Mỗi lần gửi tối đa " + MAX_LINES + " dòng món");

        Map<String, String> fields = new java.util.LinkedHashMap<>();
        List<String> soldOut = new ArrayList<>();
        List<Object[]> clean = new ArrayList<>();
        for (int i = 0; i < lines.size(); i++) {
            CartLine l = lines.get(i);
            Long dishId = Ids.parseOrNull(l.dishId());
            DishRow d = dishId == null ? null : jdbc.sql("""
                    SELECT d.id, d.name, d.price, (d.status = 'selling' AND c.is_active = 1) AS selling, (d.sold_out_date = ?) AS sold_out
                    FROM dishes d JOIN dish_categories c ON c.id = d.category_id WHERE d.id = ?
                    """).params(Times.today(), dishId)
                .query((rs, n) -> new DishRow(rs.getLong("id"), rs.getString("name"), rs.getBigDecimal("price").longValue(),
                    rs.getBoolean("selling"), rs.getBoolean("sold_out")))
                .optional().orElse(null);
            if (d == null) {
                fields.put("items." + i + ".dishId", "Món không còn trong thực đơn");
                continue;
            }
            if (!d.selling() || d.soldOut()) {
                soldOut.add(d.name());
                fields.put("items." + i + ".dishId", d.name() + " hiện đã hết");
                continue;
            }
            int qty = l.qty() == null ? 0 : l.qty();
            if (qty < 1 || qty > MAX_QTY) fields.put("items." + i + ".qty", "Số lượng từ 1 đến " + MAX_QTY);
            String note = Vi.collapse(l.note());
            if (note.length() > NOTE_MAX) fields.put("items." + i + ".note", "Ghi chú tối đa " + NOTE_MAX + " ký tự");
            clean.add(new Object[] {d, qty, note});
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
        if (orderId < 0) {
            String code = codes.document("DH", Times.today());
            jdbc.sql("INSERT INTO orders (code, table_id, status, source) VALUES (?, ?, 'open', 'qr')").params(code, t.id()).update();
            orderId = jdbc.sql("SELECT LAST_INSERT_ID()").query(Long.class).single();
        }
        int batch = jdbc.sql("SELECT COALESCE(MAX(batch_no), 0) + 1 FROM order_items WHERE order_id = ?").param(orderId)
            .query(Integer.class).single();
        for (Object[] c : clean) {
            DishRow d = (DishRow) c[0];
            String note = (String) c[2];
            jdbc.sql("""
                    INSERT INTO order_items (order_id, batch_no, dish_id, dish_name, unit_price, quantity, note, status, added_via)
                    VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', 'customer')
                    """)
                .params(orderId, batch, d.id(), d.name(), d.price(), c[1], note.isEmpty() ? null : note).update();
        }
        jdbc.sql("UPDATE dining_tables SET status = 'occupied' WHERE id = ? AND status IN ('available','reserved')").param(t.id()).update();
        live.publish(LiveEvents.KITCHEN, LiveEvents.CASHIER, LiveEvents.table(t.id()));
        return core.order(orderId);
    }

    /** UC-KH-04: khách hủy món còn Chờ chế biến. */
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
        if (!"pending".equals(it.status())) {
            throw new BusinessException("Bếp đã bắt đầu chế biến món này, không thể hủy. Vui lòng gọi nhân viên nếu cần hỗ trợ.");
        }
        jdbc.sql("UPDATE order_items SET status = 'cancelled', cancel_source = 'customer', cancel_reason = 'Khách hủy', cancelled_at = ? WHERE id = ?")
            .params(Times.now(), itemId).update();
        live.publish(LiveEvents.KITCHEN, LiveEvents.CASHIER, LiveEvents.table(t.id()));
        return core.order(it.orderId());
    }
}
