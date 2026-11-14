package com.rms.ordering;

import com.rms.audit.AuditService;
import com.rms.common.BusinessException;
import com.rms.common.Ids;
import com.rms.common.Times;
import com.rms.common.ValidationException;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Bếp: khai báo công thức định lượng (UC-BEP-07) và kiểm tra nguyên liệu (UC-BEP-06).
 *
 * Định lượng tính cho MỘT phần món, theo đơn vị kho của nguyên liệu. Tồn kho đọc từ phân hệ Kho (chỉ đọc),
 * bán món không tự trừ kho. Số phần còn làm được = min(tồn ÷ định lượng), làm tròn xuống.
 */
@Service
public class RecipeService {
    static final BigDecimal MAX_QTY = new BigDecimal("99999");

    public record DishRow(String id, String name, String categoryId, String categoryName, String status, long price,
                          int ingredientCount, long cost) {}

    public record Category(String id, String name) {}

    public record RecipeList(List<Category> categories, List<DishRow> dishes) {}

    public record RecipeLine(String ingredientId, String code, String name, String unit, double qty, Long avgCost, long lineCost,
                             boolean active) {}

    public record Recipe(String dishId, String name, String categoryName, String status, long price, List<RecipeLine> lines,
                         long cost) {}

    public record IngredientOption(String id, String code, String name, String unit, Long avgCost, double stock) {}

    public record LineInput(String ingredientId, BigDecimal qty) {}

    public record SaveInput(List<LineInput> lines) {}

    public record DishStock(String id, String name, String categoryId, String categoryName, boolean selling, boolean soldOut,
                            boolean hasRecipe, Integer portions, List<String> limiting) {}

    public record IngredientStock(String id, String code, String name, String unit, double stock, double minLevel, String level,
                                  List<String> dishes) {}

    public record StockCheck(List<Category> categories, List<DishStock> dishes, List<IngredientStock> ingredients) {}

    private final JdbcClient jdbc;
    private final AuditService audit;
    private final LiveEvents live;

    public RecipeService(JdbcClient jdbc, AuditService audit, LiveEvents live) {
        this.jdbc = jdbc;
        this.audit = audit;
        this.live = live;
    }

    private static Long cost(BigDecimal b) {
        return b == null ? null : b.longValue();
    }

    private static long lineCost(BigDecimal qty, BigDecimal avgCost) {
        return avgCost == null ? 0 : qty.multiply(avgCost).setScale(0, RoundingMode.HALF_UP).longValue();
    }

    private List<Category> categories() {
        return jdbc.sql("SELECT id, name FROM dish_categories ORDER BY sort_order, id")
            .query((rs, n) -> new Category(Ids.str(rs.getLong("id")), rs.getString("name"))).list();
    }

    /* ------------------------------------------------------------------ UC-BEP-07 */

    public RecipeList list() {
        List<DishRow> dishes = jdbc.sql("""
                SELECT d.id, d.name, d.category_id, c.name AS category_name, d.status, d.price,
                       (SELECT COUNT(*) FROM dish_ingredients di WHERE di.dish_id = d.id) AS cnt,
                       (SELECT COALESCE(SUM(ROUND(di.quantity * COALESCE(i.avg_cost, 0))), 0)
                          FROM dish_ingredients di JOIN ingredients i ON i.id = di.ingredient_id WHERE di.dish_id = d.id) AS cost
                FROM dishes d JOIN dish_categories c ON c.id = d.category_id
                ORDER BY c.sort_order, c.id, d.name
                """)
            .query((rs, n) -> new DishRow(Ids.str(rs.getLong("id")), rs.getString("name"), Ids.str(rs.getLong("category_id")),
                rs.getString("category_name"), rs.getString("status"), rs.getBigDecimal("price").longValue(), rs.getInt("cnt"),
                rs.getBigDecimal("cost").longValue()))
            .list();
        return new RecipeList(categories(), dishes);
    }

    public Recipe get(String dishIdText) {
        long dishId = Ids.parse(dishIdText, "Không tìm thấy món");
        record Head(String name, String category, String status, long price) {}
        Head h = jdbc.sql("""
                SELECT d.name, c.name AS category_name, d.status, d.price FROM dishes d JOIN dish_categories c ON c.id = d.category_id
                WHERE d.id = ?
                """).param(dishId)
            .query((rs, n) -> new Head(rs.getString(1), rs.getString(2), rs.getString(3), rs.getBigDecimal(4).longValue())).optional()
            .orElseThrow(() -> BusinessException.notFound("Không tìm thấy món"));
        List<RecipeLine> lines = jdbc.sql("""
                SELECT i.id, i.code, i.name, i.unit, i.avg_cost, i.is_active, di.quantity
                FROM dish_ingredients di JOIN ingredients i ON i.id = di.ingredient_id WHERE di.dish_id = ? ORDER BY i.name
                """).param(dishId)
            .query((rs, n) -> new RecipeLine(Ids.str(rs.getLong("id")), rs.getString("code"), rs.getString("name"), rs.getString("unit"),
                rs.getBigDecimal("quantity").doubleValue(), cost(rs.getBigDecimal("avg_cost")),
                lineCost(rs.getBigDecimal("quantity"), rs.getBigDecimal("avg_cost")), rs.getBoolean("is_active")))
            .list();
        return new Recipe(Ids.str(dishId), h.name(), h.category(), h.status(), h.price(), lines,
            lines.stream().mapToLong(RecipeLine::lineCost).sum());
    }

    public List<IngredientOption> options() {
        return jdbc.sql("SELECT id, code, name, unit, avg_cost, stock_qty FROM ingredients WHERE is_active = 1 ORDER BY name")
            .query((rs, n) -> new IngredientOption(Ids.str(rs.getLong("id")), rs.getString("code"), rs.getString("name"),
                rs.getString("unit"), cost(rs.getBigDecimal("avg_cost")), rs.getBigDecimal("stock_qty").doubleValue()))
            .list();
    }

    @Transactional
    public Recipe save(String dishIdText, SaveInput in) {
        long dishId = Ids.parse(dishIdText, "Không tìm thấy món");
        Recipe old = get(dishIdText);
        List<LineInput> lines = in.lines() == null ? List.of() : in.lines();
        if (lines.size() > 50) throw new ValidationException("lines", "Tối đa 50 nguyên liệu mỗi món");
        record Ing(long id, String name, boolean active) {}
        Map<Long, Ing> ings = new HashMap<>();
        jdbc.sql("SELECT id, name, is_active FROM ingredients")
            .query((rs, n) -> ings.put(rs.getLong(1), new Ing(rs.getLong(1), rs.getString(2), rs.getBoolean(3)))).list();
        var v = new ValidationException.Collector();
        Set<Long> seen = new HashSet<>();
        Map<Long, BigDecimal> clean = new LinkedHashMap<>();
        for (int i = 0; i < lines.size(); i++) {
            LineInput l = lines.get(i);
            String f = "lines." + i + ".";
            Long ingId = Ids.parseOrNull(l.ingredientId());
            Ing ing = ingId == null ? null : ings.get(ingId);
            if (ing == null) {
                v.add(f + "ingredientId", "Vui lòng chọn nguyên liệu");
            } else if (!seen.add(ingId)) {
                v.add(f + "ingredientId", "Nguyên liệu bị chọn trùng");
            } else if (!ing.active()) {
                v.add(f + "ingredientId", ing.name() + " đã ngừng sử dụng, vui lòng bỏ dòng này");
            }
            BigDecimal q = l.qty();
            if (q == null || q.signum() <= 0) v.add(f + "qty", "Định lượng phải lớn hơn 0");
            else if (q.stripTrailingZeros().scale() > 3) v.add(f + "qty", "Tối đa 3 chữ số thập phân");
            else if (q.compareTo(MAX_QTY) > 0) v.add(f + "qty", "Định lượng quá lớn");
            if (ing != null && q != null && q.signum() > 0) clean.put(ingId, q);
        }
        v.throwIfAny();
        jdbc.sql("DELETE FROM dish_ingredients WHERE dish_id = ?").param(dishId).update();
        clean.forEach((ingId, q) -> jdbc.sql("INSERT INTO dish_ingredients (dish_id, ingredient_id, quantity) VALUES (?, ?, ?)")
            .params(dishId, ingId, q).update());
        audit.log("kitchen", "Lưu công thức", old.name() + ": " + old.lines().size() + " → " + clean.size() + " nguyên liệu", "dishes", dishId);
        live.publish(LiveEvents.KITCHEN);
        return get(dishIdText);
    }

    /* ------------------------------------------------------------------ UC-BEP-06 */

    public StockCheck stock() {
        record Ing(long id, String code, String name, String unit, BigDecimal stock, BigDecimal min, boolean active) {}
        Map<Long, Ing> ings = new LinkedHashMap<>();
        jdbc.sql("SELECT id, code, name, unit, stock_qty, min_level, is_active FROM ingredients ORDER BY name")
            .query((rs, n) -> ings.put(rs.getLong("id"), new Ing(rs.getLong("id"), rs.getString("code"), rs.getString("name"),
                rs.getString("unit"), rs.getBigDecimal("stock_qty"), rs.getBigDecimal("min_level"), rs.getBoolean("is_active"))))
            .list();
        record Use(long dishId, long ingId, BigDecimal qty) {}
        List<Use> uses = jdbc.sql("SELECT dish_id, ingredient_id, quantity FROM dish_ingredients")
            .query((rs, n) -> new Use(rs.getLong(1), rs.getLong(2), rs.getBigDecimal(3))).list();
        Map<Long, List<Use>> byDish = new HashMap<>();
        uses.forEach(u -> byDish.computeIfAbsent(u.dishId(), k -> new ArrayList<>()).add(u));

        Map<Long, String> dishNames = new HashMap<>();
        List<DishStock> dishes = jdbc.sql("""
                SELECT d.id, d.name, d.category_id, c.name AS category_name, d.status, (d.sold_out_date = ?) AS sold_out
                FROM dishes d JOIN dish_categories c ON c.id = d.category_id ORDER BY d.name
                """).param(Times.today())
            .query((rs, n) -> {
                long id = rs.getLong("id");
                dishNames.put(id, rs.getString("name"));
                List<Use> recipe = byDish.getOrDefault(id, List.of());
                Integer portions = null;
                List<String> limiting = new ArrayList<>();
                if (!recipe.isEmpty()) {
                    long min = Long.MAX_VALUE;
                    for (Use u : recipe) {
                        Ing ing = ings.get(u.ingId());
                        BigDecimal stock = ing.stock().max(BigDecimal.ZERO);
                        long p = stock.divide(u.qty(), 0, RoundingMode.FLOOR).longValue();
                        if (p < min) {
                            min = p;
                            limiting.clear();
                        }
                        if (p == min) limiting.add(ing.name());
                    }
                    portions = (int) Math.min(min, 99_999);
                }
                return new DishStock(Ids.str(id), rs.getString("name"), Ids.str(rs.getLong("category_id")), rs.getString("category_name"),
                    "selling".equals(rs.getString("status")), rs.getBoolean("sold_out"), !recipe.isEmpty(), portions, limiting);
            })
            .list();
        // Món còn ít phần nhất ở trên; món chưa có công thức cuối danh sách.
        List<DishStock> sorted = new ArrayList<>(dishes);
        sorted.sort((a, b) -> {
            if (a.hasRecipe() != b.hasRecipe()) return a.hasRecipe() ? -1 : 1;
            if (a.portions() != null && b.portions() != null && !a.portions().equals(b.portions())) return a.portions() - b.portions();
            return a.name().compareTo(b.name());
        });

        Map<Long, List<String>> dishesOfIng = new HashMap<>();
        uses.forEach(u -> dishesOfIng.computeIfAbsent(u.ingId(), k -> new ArrayList<>()).add(dishNames.getOrDefault(u.dishId(), "")));
        List<IngredientStock> ingredients = ings.values().stream().filter(Ing::active).map(i -> {
            String level = i.stock().signum() <= 0 ? "out" : i.stock().compareTo(i.min()) <= 0 ? "low" : "ok";
            List<String> ds = new ArrayList<>(dishesOfIng.getOrDefault(i.id(), List.of()));
            ds.sort(String::compareTo);
            return new IngredientStock(Ids.str(i.id()), i.code(), i.name(), i.unit(), i.stock().doubleValue(), i.min().doubleValue(), level, ds);
        }).toList();
        return new StockCheck(categories(), sorted, ingredients);
    }
}
