package com.rms.ordering;

import com.rms.common.Db;
import com.rms.common.Ids;
import com.rms.common.Times;
import com.rms.common.Vi;
import com.rms.storage.ImageStore;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;

/**
 * Số liệu bán hàng trên Dashboard của Quản lý nhà hàng, tính từ hóa đơn ĐÃ THANH TOÁN (theo thời điểm thanh toán).
 *
 * Kỳ: today | yesterday (theo giờ) · last7 | last30 (theo ngày) · thisMonth | lastMonth (theo tuần trong tháng).
 * Kỳ trước dùng để so sánh có cùng độ dài: hôm nay ↔ hôm qua, 7 ngày ↔ 7 ngày trước đó, tháng này (tới hôm nay)
 * ↔ cùng số ngày đầu tháng trước, tháng trước ↔ tháng trước nữa.
 */
@Service
public class SalesDashboardService {
    private static final DateTimeFormatter DM = DateTimeFormatter.ofPattern("dd/MM");
    /** Khung giờ mặc định trên biểu đồ theo giờ; giờ có doanh thu ngoài khung vẫn được thêm vào. */
    private static final int HOUR_FROM = 9;
    private static final int HOUR_TO = 22;

    public record Point(String label, long current, long previous) {}

    public record Revenue(String period, long total, int orders, long avgOrder, Double change, List<Point> series,
                          boolean comparing, boolean hasData) {}

    public record DishRank(String id, String name, String category, int quantity, long revenue, double share) {}

    public record TopDishes(String period, List<DishRank> best, List<DishRank> slow, boolean hasData) {}

    /** Một chỉ số trên thẻ đầu trang: giá trị kỳ này, kỳ trước và % thay đổi (null khi kỳ trước bằng 0). */
    public record Kpi(long value, long previous, Double change) {}

    public record Slice(String key, String label, long value) {}

    public record HourLoad(int hour, String label, int orders, int guests) {}

    /** kind: food (món ăn) · drink (đồ uống) · extra (gọi thêm). */
    public record DishStat(String id, String name, String category, String kind, String imageUrl, boolean selling,
                           int quantity, long revenue, int prevQuantity) {}

    public record Overview(String period, Kpi revenue, Kpi orders, Kpi avgOrder, Kpi guests, List<Point> series,
                           List<Slice> byCategory, List<Slice> byPayment, List<HourLoad> peakHours, List<DishStat> dishes,
                           boolean hasData) {}

    private enum Grain { HOUR, DAY, WEEK }

    /** [from, to) theo ngày; kỳ trước cùng độ dài. */
    private record Range(String key, LocalDate from, LocalDate to, LocalDate prevFrom, LocalDate prevTo, Grain grain) {}

    private final JdbcClient jdbc;
    private final ImageStore images;

    public SalesDashboardService(JdbcClient jdbc, ImageStore images) {
        this.jdbc = jdbc;
        this.images = images;
    }

    private static Range range(String period) {
        LocalDate today = Times.today();
        String p = period == null ? "today" : period;
        return switch (p) {
            case "yesterday" -> new Range(p, today.minusDays(1), today, today.minusDays(2), today.minusDays(1), Grain.HOUR);
            case "last7" -> new Range(p, today.minusDays(6), today.plusDays(1), today.minusDays(13), today.minusDays(6), Grain.DAY);
            case "last30" -> new Range(p, today.minusDays(29), today.plusDays(1), today.minusDays(59), today.minusDays(29), Grain.DAY);
            case "thisMonth" -> {
                LocalDate first = today.withDayOfMonth(1);
                LocalDate prevFirst = first.minusMonths(1);
                int days = today.getDayOfMonth();
                LocalDate prevEnd = prevFirst.plusDays(Math.min(days, prevFirst.lengthOfMonth()));
                yield new Range(p, first, today.plusDays(1), prevFirst, prevEnd, Grain.WEEK);
            }
            case "lastMonth" -> {
                LocalDate first = today.withDayOfMonth(1).minusMonths(1);
                yield new Range(p, first, first.plusMonths(1), first.minusMonths(1), first, Grain.WEEK);
            }
            default -> new Range("today", today, today.plusDays(1), today.minusDays(1), today, Grain.HOUR);
        };
    }

    private record Paid(LocalDateTime at, long total) {}

    private List<Paid> paid(LocalDate from, LocalDate to) {
        return jdbc.sql("SELECT paid_at, total_amount FROM invoices WHERE status = 'paid' AND paid_at >= ? AND paid_at < ?")
            .params(from.atStartOfDay(), to.atStartOfDay())
            .query((rs, n) -> new Paid(Db.dateTime(rs, "paid_at"), rs.getBigDecimal("total_amount").longValue())).list();
    }

    private static String dayLabel(LocalDate d) {
        String dow = d.getDayOfWeek() == DayOfWeek.SUNDAY ? "CN" : "T" + (d.getDayOfWeek().getValue() + 1);
        return dow + " " + d.format(DM);
    }

    private static List<Point> series(Range r, List<Paid> cur, List<Paid> prev) {
        List<Point> series = new ArrayList<>();
        switch (r.grain()) {
            case HOUR -> {
                long[] c = new long[24];
                long[] pv = new long[24];
                cur.forEach(x -> c[x.at().getHour()] += x.total());
                prev.forEach(x -> pv[x.at().getHour()] += x.total());
                for (int h = 0; h < 24; h++) {
                    boolean inFrame = h >= HOUR_FROM && h <= HOUR_TO;
                    if (inFrame || c[h] > 0 || pv[h] > 0) series.add(new Point(String.format("%02d:00", h), c[h], pv[h]));
                }
            }
            case DAY -> {
                int days = (int) (r.to().toEpochDay() - r.from().toEpochDay());
                long[] c = new long[days];
                long[] pv = new long[days];
                cur.forEach(x -> c[(int) (x.at().toLocalDate().toEpochDay() - r.from().toEpochDay())] += x.total());
                prev.forEach(x -> {
                    int i = (int) (x.at().toLocalDate().toEpochDay() - r.prevFrom().toEpochDay());
                    if (i >= 0 && i < days) pv[i] += x.total();
                });
                for (int i = 0; i < days; i++) {
                    LocalDate d = r.from().plusDays(i);
                    series.add(new Point(days <= 7 ? dayLabel(d) : d.format(DM), c[i], pv[i]));
                }
            }
            case WEEK -> {
                // Tuần trong tháng: ngày 1–7 = Tuần 1, 8–14 = Tuần 2 … 29–31 = Tuần 5.
                int weeks = r.from().lengthOfMonth() > 28 ? 5 : 4;
                long[] c = new long[5];
                long[] pv = new long[5];
                cur.forEach(x -> c[(x.at().getDayOfMonth() - 1) / 7] += x.total());
                prev.forEach(x -> pv[(x.at().getDayOfMonth() - 1) / 7] += x.total());
                for (int i = 0; i < weeks; i++) series.add(new Point("Tuần " + (i + 1), c[i], pv[i]));
            }
        }
        return series;
    }

    public Revenue revenue(String period) {
        Range r = range(period);
        List<Paid> cur = paid(r.from(), r.to());
        List<Paid> prev = paid(r.prevFrom(), r.prevTo());
        List<Point> series = series(r, cur, prev);
        long total = cur.stream().mapToLong(Paid::total).sum();
        long prevTotal = prev.stream().mapToLong(Paid::total).sum();
        int orders = cur.size();
        Double change = prevTotal > 0 ? (total - prevTotal) * 100.0 / prevTotal : null;
        return new Revenue(r.key(), total, orders, orders == 0 ? 0 : Math.round((double) total / orders), change, series, true,
            total > 0);
    }

    public TopDishes topDishes(String period) {
        Range r = range(period);
        record Row(long id, String name, String category, int qty, long revenue, boolean selling) {}
        List<Row> rows = jdbc.sql("""
                SELECT d.id, d.name, c.name AS category, d.status,
                       COALESCE(s.qty, 0) AS qty, COALESCE(s.revenue, 0) AS revenue
                FROM dishes d JOIN dish_categories c ON c.id = d.category_id
                LEFT JOIN (
                    SELECT oi.dish_id, SUM(oi.quantity) AS qty, SUM(oi.quantity * oi.unit_price) AS revenue
                    FROM order_items oi JOIN invoices i ON i.order_id = oi.order_id
                    WHERE i.status = 'paid' AND i.paid_at >= ? AND i.paid_at < ? AND oi.status <> 'cancelled'
                    GROUP BY oi.dish_id
                ) s ON s.dish_id = d.id
                """).params(r.from().atStartOfDay(), r.to().atStartOfDay())
            .query((rs, n) -> new Row(rs.getLong("id"), rs.getString("name"), rs.getString("category"), rs.getInt("qty"),
                rs.getBigDecimal("revenue").longValue(), "selling".equals(rs.getString("status"))))
            .list();
        int max = rows.stream().mapToInt(Row::qty).max().orElse(0);
        java.util.function.Function<Row, DishRank> toRank = x -> new DishRank(Ids.str(x.id()), x.name(), x.category(), x.qty(),
            x.revenue(), max > 0 ? x.qty() * 100.0 / max : 0);
        List<DishRank> best = rows.stream().filter(x -> x.qty() > 0)
            .sorted((a, b) -> a.qty() != b.qty() ? Integer.compare(b.qty(), a.qty()) : Long.compare(b.revenue(), a.revenue()))
            .limit(5).map(toRank).toList();
        // Bán chậm: món đang bán có số lượng thấp nhất (kể cả chưa bán được phần nào), không trùng nhóm bán chạy.
        var bestIds = best.stream().map(DishRank::id).toList();
        List<DishRank> slow = rows.stream().filter(Row::selling).filter(x -> !bestIds.contains(Ids.str(x.id())))
            .sorted((a, b) -> a.qty() != b.qty() ? Integer.compare(a.qty(), b.qty()) : a.name().compareTo(b.name()))
            .limit(5).map(toRank).toList();
        return new TopDishes(r.key(), best, slow, !best.isEmpty());
    }

    private static Kpi kpi(long value, long previous) {
        return new Kpi(value, previous, previous > 0 ? (value - previous) * 100.0 / previous : null);
    }

    private static String kindOf(String category) {
        String n = Vi.normalize(category);
        if (n.contains("do uong")) return "drink";
        if (n.contains("goi them")) return "extra";
        return "food";
    }

    private static final Map<String, String> METHOD_LABEL = Map.of(
        "cash", "Tiền mặt", "card", "Thẻ", "transfer", "Chuyển khoản", "ewallet", "Ví điện tử");

    /**
     * Mọi số liệu của Dashboard trong một lần gọi: 4 chỉ số, biểu đồ doanh thu, cơ cấu doanh thu (theo danh mục / theo
     * hình thức trả), giờ đông khách và số bán từng món (kỳ này + kỳ trước) để trang tự xếp bán chạy / bán chậm / đang lên.
     */
    public Overview overview(String period) {
        Range r = range(period);
        LocalDateTime from = r.from().atStartOfDay();
        LocalDateTime to = r.to().atStartOfDay();
        LocalDateTime pFrom = r.prevFrom().atStartOfDay();
        LocalDateTime pTo = r.prevTo().atStartOfDay();
        List<Paid> cur = paid(r.from(), r.to());
        List<Paid> prev = paid(r.prevFrom(), r.prevTo());
        long total = cur.stream().mapToLong(Paid::total).sum();
        long prevTotal = prev.stream().mapToLong(Paid::total).sum();
        int orders = cur.size();
        int prevOrders = prev.size();

        String guestSql = """
            SELECT COALESCE(SUM(COALESCE(o.guests, 0)), 0) FROM invoices i JOIN orders o ON o.id = i.order_id
            WHERE i.status = 'paid' AND i.paid_at >= ? AND i.paid_at < ?
            """;
        long guests = jdbc.sql(guestSql).params(from, to).query(Long.class).single();
        long prevGuests = jdbc.sql(guestSql).params(pFrom, pTo).query(Long.class).single();

        // Cơ cấu theo danh mục: tiền món (số lượng × đơn giá), quy về đúng tổng hóa đơn để khớp số Doanh thu.
        List<Slice> rawCat = jdbc.sql("""
                SELECT c.id, c.name, SUM(oi.quantity * oi.unit_price) AS amount
                FROM order_items oi JOIN invoices i ON i.order_id = oi.order_id
                JOIN dishes d ON d.id = oi.dish_id JOIN dish_categories c ON c.id = d.category_id
                WHERE i.status = 'paid' AND i.paid_at >= ? AND i.paid_at < ? AND oi.status <> 'cancelled'
                GROUP BY c.id, c.name ORDER BY amount DESC, c.id
                """).params(from, to)
            .query((rs, n) -> new Slice(Ids.str(rs.getLong("id")), rs.getString("name"), rs.getBigDecimal("amount").longValue()))
            .list();
        long rawSum = rawCat.stream().mapToLong(Slice::value).sum();
        List<Slice> byCategory = rawCat.stream()
            .map(x -> new Slice(x.key(), x.label(), rawSum > 0 ? Math.round((double) x.value() * total / rawSum) : 0))
            .toList();

        List<Slice> byPayment = jdbc.sql("""
                SELECT p.method, SUM(p.amount) AS amount FROM payments p JOIN invoices i ON i.id = p.invoice_id
                WHERE i.status = 'paid' AND i.paid_at >= ? AND i.paid_at < ?
                GROUP BY p.method ORDER BY amount DESC, p.method
                """).params(from, to)
            .query((rs, n) -> new Slice(rs.getString("method"),
                METHOD_LABEL.getOrDefault(rs.getString("method"), rs.getString("method")), rs.getBigDecimal("amount").longValue()))
            .list();

        // Giờ đông khách: theo giờ khách vào bàn (giờ tạo đơn) của các đơn đã thanh toán trong kỳ.
        int[] hOrders = new int[24];
        int[] hGuests = new int[24];
        jdbc.sql("""
                SELECT HOUR(o.created_at) AS h, COUNT(*) AS n, COALESCE(SUM(COALESCE(o.guests, 0)), 0) AS g
                FROM invoices i JOIN orders o ON o.id = i.order_id
                WHERE i.status = 'paid' AND i.paid_at >= ? AND i.paid_at < ?
                GROUP BY HOUR(o.created_at)
                """).params(from, to)
            .query((rs, n) -> {
                hOrders[rs.getInt("h")] = rs.getInt("n");
                hGuests[rs.getInt("h")] = rs.getInt("g");
                return 0;
            }).list();
        List<HourLoad> peakHours = new ArrayList<>();
        for (int h = 0; h < 24; h++) {
            if ((h >= HOUR_FROM && h <= HOUR_TO) || hOrders[h] > 0)
                peakHours.add(new HourLoad(h, String.format("%02dh", h), hOrders[h], hGuests[h]));
        }

        String qtySql = """
            SELECT oi.dish_id, SUM(oi.quantity) AS qty, SUM(oi.quantity * oi.unit_price) AS revenue
            FROM order_items oi JOIN invoices i ON i.order_id = oi.order_id
            WHERE i.status = 'paid' AND i.paid_at >= ? AND i.paid_at < ? AND oi.status <> 'cancelled'
            GROUP BY oi.dish_id
            """;
        Map<Long, long[]> curQty = new HashMap<>();
        Map<Long, long[]> prevQty = new HashMap<>();
        jdbc.sql(qtySql).params(from, to)
            .query((rs, n) -> curQty.put(rs.getLong(1), new long[] {rs.getLong(2), rs.getBigDecimal(3).longValue()})).list();
        jdbc.sql(qtySql).params(pFrom, pTo)
            .query((rs, n) -> prevQty.put(rs.getLong(1), new long[] {rs.getLong(2), rs.getBigDecimal(3).longValue()})).list();
        List<DishStat> dishes = jdbc.sql("""
                SELECT d.id, d.name, d.image_url, d.status, c.name AS category
                FROM dishes d JOIN dish_categories c ON c.id = d.category_id ORDER BY d.id
                """)
            .query((rs, n) -> {
                long id = rs.getLong("id");
                long[] c = curQty.getOrDefault(id, new long[2]);
                long[] pv = prevQty.getOrDefault(id, new long[2]);
                String category = rs.getString("category");
                return new DishStat(Ids.str(id), rs.getString("name"), category, kindOf(category), images.url(rs.getString("image_url")),
                    "selling".equals(rs.getString("status")), (int) c[0], c[1], (int) pv[0]);
            }).list()
            // Món đã ngừng bán mà cả hai kỳ đều không bán được phần nào thì không đưa lên trang.
            .stream().filter(d -> d.selling() || d.quantity() > 0 || d.prevQuantity() > 0).toList();

        long avg = orders == 0 ? 0 : Math.round((double) total / orders);
        long prevAvg = prevOrders == 0 ? 0 : Math.round((double) prevTotal / prevOrders);
        return new Overview(r.key(), kpi(total, prevTotal), kpi(orders, prevOrders), kpi(avg, prevAvg), kpi(guests, prevGuests),
            series(r, cur, prev), byCategory, byPayment, peakHours, dishes, total > 0);
    }
}
