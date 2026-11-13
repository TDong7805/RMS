package com.rms.warehouse;

import com.rms.common.Ids;
import com.rms.common.Paged;
import com.rms.common.Times;
import com.rms.common.ValidationException;
import com.rms.common.Vi;
import com.rms.warehouse.PurchaseOrderService.PurchaseOrderRow;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;

/**
 * UC-KHO-01: Dashboard kho (khối "hiện tại" + khối "theo kỳ") và tab Nhập – xuất – tồn.
 * Thẻ Kho trên Dashboard của Quản lý nhà hàng dùng cùng cách tính (inventoryCard).
 *
 * - Tổng tiền nhập = giá trị phiếu nhập theo phiếu mua + nhập không phiếu (không tính Tồn đầu kỳ, phiếu đã hủy).
 * - Giá trị xuất, hao hụt theo giá vốn ghi lúc xuất / duyệt kiểm kê. Hao hụt = xuất hủy + chênh lệch giảm của kiểm kê đã duyệt.
 * - Tồn cuối kỳ = Tồn đầu kỳ + Nhập − Xuất ± Điều chỉnh (kiểm kê, hủy phiếu nhập).
 */
@Service
public class WarehouseDashboardService {
    static final int MAX_DAYS = 366;
    private static final DateTimeFormatter DM = DateTimeFormatter.ofPattern("dd/MM");

    public record Point(String label, double inValue, double outValue) {}

    public record Restock(String id, String code, String name, String unit, double onHand, double minLevel, String level) {}

    public record PendingPo(String id, String code, String supplierName, String expectedDate, String receiveStatus, String due) {}

    public record StocktakeBrief(String id, String code, String status, String createdAt, String createdBy, String rejectReason,
                                 double increaseValue, double decreaseValue) {}

    public record Loss(String ingredientId, String name, String unit, double qty, double value, String source) {}

    public record Dashboard(double stockValue, int lowCount, int outCount, int pendingPurchaseCount, int latePurchaseCount,
                            double debt, double purchaseTotal, double issueValue, double lossValue, List<Point> series,
                            List<Restock> needRestock, List<PendingPo> pendingPurchases, List<StocktakeBrief> stocktakes,
                            List<Loss> losses) {}

    public record SummaryRow(String id, String code, String name, String unit, String group, double opening, double inQty,
                             double outQty, double adjustQty, double closing, double closingValue) {}

    public record SummaryPage(List<SummaryRow> items, int total, int page, int pageCount, double totalValue) {}

    /** Khớp kiểu InventoryResponse của Dashboard quản lý. */
    public record LowStock(String id, String name, String unit, double onHand, double minLevel, String status) {}

    public record InventoryCard(String period, double purchaseCost, int pendingReceipts, double pendingReceiptsValue,
                                double supplierDebt, int totalIngredients, int lowStockCount, int outOfStockCount,
                                List<LowStock> lowStock, boolean hasData) {}

    private final JdbcClient jdbc;
    private final PurchaseOrderService purchases;
    private final DebtService debts;
    private final StocktakeService stocktakes;

    public WarehouseDashboardService(JdbcClient jdbc, PurchaseOrderService purchases, DebtService debts, StocktakeService stocktakes) {
        this.jdbc = jdbc;
        this.purchases = purchases;
        this.debts = debts;
        this.stocktakes = stocktakes;
    }

    private record Range(LocalDate from, LocalDate to) {
        LocalDateTime start() {
            return from.atStartOfDay();
        }

        LocalDateTime end() {
            return to.plusDays(1).atStartOfDay();
        }
    }

    private static Range range(String from, String to) {
        LocalDate today = Times.today();
        LocalDate f = Vi.blank(from) ? today.minusDays(6) : Times.parseDate(from);
        LocalDate t = Vi.blank(to) ? today : Times.parseDate(to);
        if (f.isAfter(t)) throw new ValidationException("to", "Khoảng thời gian không hợp lệ");
        if (ChronoUnit.DAYS.between(f, t) >= MAX_DAYS) throw new ValidationException("to", "Chỉ xem tối đa 366 ngày");
        return new Range(f, t);
    }

    private record Ing(long id, String code, String name, String unit, String group, BigDecimal qty, BigDecimal min, BigDecimal cost,
                       boolean active) {
        String level() {
            if (!active) return null;
            if (qty.signum() <= 0) return "out";
            return qty.compareTo(min) <= 0 ? "low" : "ok";
        }
    }

    private List<Ing> ingredients() {
        return jdbc.sql("SELECT id, code, name, unit, group_key, stock_qty, min_level, avg_cost, is_active FROM ingredients ORDER BY code")
            .query((rs, n) -> new Ing(rs.getLong("id"), rs.getString("code"), rs.getString("name"), rs.getString("unit"),
                rs.getString("group_key"), rs.getBigDecimal("stock_qty"), rs.getBigDecimal("min_level"), rs.getBigDecimal("avg_cost"),
                rs.getBoolean("is_active")))
            .list();
    }

    private BigDecimal sum(String sql, Object... params) {
        BigDecimal v = jdbc.sql(sql).params(params).query(BigDecimal.class).single();
        return v == null ? BigDecimal.ZERO : v;
    }

    private BigDecimal purchaseTotal(Range r) {
        return sum("SELECT COALESCE(SUM(total_value), 0) FROM goods_receipts WHERE status = 'posted' AND kind IN ('po','direct') AND created_at >= ? AND created_at < ?",
            r.start(), r.end());
    }

    public Dashboard dashboard(String from, String to) {
        Range r = range(from, to);
        List<Ing> ings = ingredients();
        double stockValue = ings.stream().filter(i -> i.cost() != null)
            .mapToDouble(i -> PurchaseMath.money(i.qty().multiply(i.cost())).doubleValue()).sum();
        List<Ing> restock = ings.stream().filter(i -> "out".equals(i.level()) || "low".equals(i.level()))
            .sorted(Comparator.comparing((Ing i) -> "out".equals(i.level()) ? 0 : 1).thenComparing(Ing::code)).toList();
        int out = (int) restock.stream().filter(i -> "out".equals(i.level())).count();

        List<PurchaseOrderRow> waiting = purchases.waiting();
        LocalDate today = Times.today();
        List<PendingPo> pending = waiting.stream()
            .sorted(Comparator.comparing((PurchaseOrderRow p) -> p.expectedDate() == null ? "9999" : p.expectedDate()))
            .limit(10)
            .map(p -> {
                String due = null;
                if (p.late()) due = "late";
                else if (p.expectedDate() != null && !LocalDate.parse(p.expectedDate()).isAfter(today.plusDays(2))) due = "soon";
                return new PendingPo(p.id(), p.code(), p.supplierName(), p.expectedDate(), p.receiveStatus(), due);
            }).toList();

        BigDecimal issueValue = sum("SELECT COALESCE(SUM(total_value), 0) FROM stock_issues WHERE created_at >= ? AND created_at < ?", r.start(), r.end());

        // Hao hụt theo nguyên liệu: xuất hủy + chênh lệch giảm kiểm kê đã duyệt trong kỳ.
        Map<String, double[]> lossMap = new LinkedHashMap<>();
        Map<String, String[]> lossInfo = new HashMap<>();
        jdbc.sql("""
                SELECT x.ingredient_id, g.name, g.unit, SUM(x.qty) AS qty, SUM(x.value) AS value
                FROM stock_issue_items x JOIN stock_issues i ON i.id = x.issue_id JOIN ingredients g ON g.id = x.ingredient_id
                WHERE i.reason IN ('damaged','expired') AND i.created_at >= ? AND i.created_at < ?
                GROUP BY x.ingredient_id, g.name, g.unit
                """).params(r.start(), r.end())
            .query((rs, n) -> new Object[] {rs.getLong(1), rs.getString(2), rs.getString(3), rs.getBigDecimal(4), rs.getBigDecimal(5)})
            .list().forEach(o -> {
                String key = o[0] + "|waste";
                lossMap.put(key, new double[] {((BigDecimal) o[3]).doubleValue(), ((BigDecimal) o[4]).doubleValue()});
                lossInfo.put(key, new String[] {Ids.str((Long) o[0]), (String) o[1], (String) o[2], "waste"});
            });
        jdbc.sql("""
                SELECT si.ingredient_id, g.name, g.unit, SUM(si.book_qty - si.actual_qty) AS qty, SUM(-si.adjust_value) AS value
                FROM stocktake_items si JOIN stocktakes s ON s.id = si.stocktake_id JOIN ingredients g ON g.id = si.ingredient_id
                WHERE s.status = 'approved' AND s.approved_at >= ? AND s.approved_at < ? AND si.actual_qty < si.book_qty
                GROUP BY si.ingredient_id, g.name, g.unit
                """).params(r.start(), r.end())
            .query((rs, n) -> new Object[] {rs.getLong(1), rs.getString(2), rs.getString(3), rs.getBigDecimal(4), rs.getBigDecimal(5)})
            .list().forEach(o -> {
                String key = o[0] + "|stocktake";
                lossMap.put(key, new double[] {((BigDecimal) o[3]).doubleValue(), o[4] == null ? 0 : ((BigDecimal) o[4]).doubleValue()});
                lossInfo.put(key, new String[] {Ids.str((Long) o[0]), (String) o[1], (String) o[2], "stocktake"});
            });
        double lossValue = lossMap.values().stream().mapToDouble(v -> v[1]).sum();
        List<Loss> losses = lossMap.entrySet().stream()
            .sorted(Comparator.comparingDouble((Map.Entry<String, double[]> e) -> e.getValue()[1]).reversed())
            .limit(10)
            .map(e -> {
                String[] info = lossInfo.get(e.getKey());
                return new Loss(info[0], info[1], info[2], e.getValue()[0], e.getValue()[1], info[3]);
            }).toList();

        // Biểu đồ nhập / xuất theo ngày.
        Map<LocalDate, double[]> byDay = new LinkedHashMap<>();
        for (LocalDate d = r.from(); !d.isAfter(r.to()); d = d.plusDays(1)) byDay.put(d, new double[2]);
        jdbc.sql("SELECT DATE(created_at) d, SUM(total_value) v FROM goods_receipts WHERE status = 'posted' AND kind IN ('po','direct') AND created_at >= ? AND created_at < ? GROUP BY DATE(created_at)")
            .params(r.start(), r.end())
            .query((rs, n) -> Map.entry(rs.getObject("d", LocalDate.class), rs.getBigDecimal("v").doubleValue()))
            .list().forEach(e -> byDay.computeIfPresent(e.getKey(), (k, v) -> { v[0] = e.getValue(); return v; }));
        jdbc.sql("SELECT DATE(created_at) d, SUM(total_value) v FROM stock_issues WHERE created_at >= ? AND created_at < ? GROUP BY DATE(created_at)")
            .params(r.start(), r.end())
            .query((rs, n) -> Map.entry(rs.getObject("d", LocalDate.class), rs.getBigDecimal("v").doubleValue()))
            .list().forEach(e -> byDay.computeIfPresent(e.getKey(), (k, v) -> { v[1] = e.getValue(); return v; }));
        List<Point> series = byDay.entrySet().stream().map(e -> new Point(e.getKey().format(DM), e.getValue()[0], e.getValue()[1])).toList();

        List<StocktakeBrief> stk = new ArrayList<>();
        for (String st : List.of("pending", "rejected")) {
            stocktakes.list("", st, "", "", 1).items().forEach(s -> stk.add(new StocktakeBrief(s.id(), s.code(), s.status(), s.createdAt(),
                s.createdBy(), s.rejectReason(), s.increaseValue(), s.decreaseValue())));
        }

        return new Dashboard(stockValue, restock.size() - out, out, waiting.size(), (int) waiting.stream().filter(PurchaseOrderRow::late).count(),
            debts.totalDebt(), purchaseTotal(r).doubleValue(), issueValue.doubleValue(), lossValue, series,
            restock.stream().limit(10).map(i -> new Restock(Ids.str(i.id()), i.code(), i.name(), i.unit(), i.qty().doubleValue(),
                i.min().doubleValue(), i.level())).toList(),
            pending, stk, losses);
    }

    /** Tab Nhập – xuất – tồn: mỗi nguyên liệu trong kỳ. */
    public SummaryPage summary(String from, String to, String keyword, String group, int page) {
        Range r = range(from, to);
        record Agg(double opening, double in, double out, double adjust) {}
        Map<Long, Agg> agg = new HashMap<>();
        jdbc.sql("""
                SELECT ingredient_id,
                       SUM(CASE WHEN created_at < ? THEN quantity_change ELSE 0 END) AS opening,
                       SUM(CASE WHEN created_at >= ? AND created_at < ? AND move_type IN ('opening','po_receipt','direct_receipt') THEN quantity_change ELSE 0 END) AS in_qty,
                       SUM(CASE WHEN created_at >= ? AND created_at < ? AND move_type LIKE 'issue\\_%' THEN -quantity_change ELSE 0 END) AS out_qty,
                       SUM(CASE WHEN created_at >= ? AND created_at < ? AND move_type IN ('stocktake','receipt_cancel') THEN quantity_change ELSE 0 END) AS adj_qty
                FROM stock_transactions WHERE created_at < ? GROUP BY ingredient_id
                """)
            .params(r.start(), r.start(), r.end(), r.start(), r.end(), r.start(), r.end(), r.end())
            .query((rs, n) -> Map.entry(rs.getLong(1), new Agg(rs.getBigDecimal(2).doubleValue(), rs.getBigDecimal(3).doubleValue(),
                rs.getBigDecimal(4).doubleValue(), rs.getBigDecimal(5).doubleValue())))
            .list().forEach(e -> agg.put(e.getKey(), e.getValue()));
        String k = Vi.trim(keyword);
        List<SummaryRow> rows = ingredients().stream()
            .filter(i -> k.isEmpty() || Vi.matches(i.name(), k) || Vi.matches(i.code(), k))
            .filter(i -> Vi.blank(group) || i.group().equals(group))
            .map(i -> {
                Agg a = agg.getOrDefault(i.id(), new Agg(0, 0, 0, 0));
                double closing = Math.round((a.opening() + a.in() - a.out() + a.adjust()) * 1000) / 1000.0;
                double value = i.cost() == null ? 0 : Math.round(closing * i.cost().doubleValue());
                return new SummaryRow(Ids.str(i.id()), i.code(), i.name(), i.unit(), i.group(), a.opening(), a.in(), a.out(), a.adjust(),
                    closing, value);
            })
            .filter(s -> s.opening() != 0 || s.inQty() != 0 || s.outQty() != 0 || s.adjustQty() != 0 || s.closing() != 0)
            .toList();
        double total = rows.stream().mapToDouble(SummaryRow::closingValue).sum();
        Paged<SummaryRow> p = Paged.of(rows, page, IngredientService.PAGE_SIZE);
        return new SummaryPage(p.items(), p.total(), p.page(), p.pageCount(), total);
    }

    /** Thẻ Kho trên Dashboard Quản lý nhà hàng — period: today | yesterday | last7 | last30 | thisMonth | lastMonth. */
    public InventoryCard inventoryCard(String period) {
        LocalDate today = Times.today();
        Range r = switch (period == null ? "today" : period) {
            case "yesterday" -> new Range(today.minusDays(1), today.minusDays(1));
            case "last7" -> new Range(today.minusDays(6), today);
            case "last30" -> new Range(today.minusDays(29), today);
            case "thisMonth" -> new Range(today.withDayOfMonth(1), today);
            case "lastMonth" -> new Range(today.minusMonths(1).withDayOfMonth(1), today.withDayOfMonth(1).minusDays(1));
            default -> new Range(today, today);
        };
        List<Ing> ings = ingredients().stream().filter(Ing::active).toList();
        List<Ing> low = ings.stream().filter(i -> "out".equals(i.level()) || "low".equals(i.level()))
            .sorted(Comparator.comparing((Ing i) -> "out".equals(i.level()) ? 0 : 1).thenComparing(Ing::code)).toList();
        List<PurchaseOrderRow> waiting = purchases.waiting();
        double pendingValue = waiting.stream().mapToDouble(p -> Math.max(0, p.total() - p.payable())).sum();
        BigDecimal cost = purchaseTotal(r);
        int out = (int) low.stream().filter(i -> "out".equals(i.level())).count();
        return new InventoryCard(period, cost.doubleValue(), waiting.size(), pendingValue, debts.totalDebt(), ings.size(),
            low.size() - out, out,
            low.stream().map(i -> new LowStock(Ids.str(i.id()), i.name(), i.unit(), i.qty().doubleValue(), i.min().doubleValue(), i.level())).toList(),
            !ings.isEmpty());
    }
}
