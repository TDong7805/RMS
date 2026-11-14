package com.rms.ordering;

import com.rms.ordering.RecipeService.IngredientOption;
import com.rms.ordering.RecipeService.Recipe;
import com.rms.ordering.RecipeService.RecipeList;
import com.rms.ordering.RecipeService.SaveInput;
import com.rms.ordering.RecipeService.StockCheck;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

/**
 * Bếp — công thức định lượng và kiểm tra nguyên liệu (vai trò kitchen):
 * GET /api/bep/recipes                 danh sách món + số nguyên liệu trong công thức, giá vốn ước tính
 * GET /api/bep/recipes/{dishId}        công thức của món
 * PUT /api/bep/recipes/{dishId}        lưu công thức {lines: [{ingredientId, qty}]} (thay toàn bộ; rỗng = xóa công thức)
 * GET /api/bep/ingredient-options      nguyên liệu đang sử dụng (chọn khi khai báo)
 * GET /api/bep/stock-check             số phần còn làm được theo món + tồn kho theo nguyên liệu
 */
@RestController
public class RecipeController {
    private final RecipeService service;

    public RecipeController(RecipeService service) {
        this.service = service;
    }

    @GetMapping("/api/bep/recipes")
    public RecipeList list() {
        return service.list();
    }

    @GetMapping("/api/bep/recipes/{dishId}")
    public Recipe get(@PathVariable String dishId) {
        return service.get(dishId);
    }

    @PutMapping("/api/bep/recipes/{dishId}")
    public Recipe save(@PathVariable String dishId, @RequestBody SaveInput in) {
        return service.save(dishId, in);
    }

    @GetMapping("/api/bep/ingredient-options")
    public List<IngredientOption> options() {
        return service.options();
    }

    @GetMapping("/api/bep/stock-check")
    public StockCheck stock() {
        return service.stock();
    }
}
