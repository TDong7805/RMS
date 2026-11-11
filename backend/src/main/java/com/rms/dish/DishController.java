package com.rms.dish;

import com.rms.common.Paged;
import com.rms.dish.DishService.Category;
import com.rms.dish.DishService.CategoryInput;
import com.rms.dish.DishService.Dish;
import com.rms.dish.DishService.DishInput;
import java.util.List;
import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * GET    /api/dishes?keyword=&categoryId=&status=&page=   danh sách (10 món/trang, mới cập nhật trước)
 * GET    /api/dishes/{id}
 * POST   /api/dishes                 thêm (JSON; trường image là data URL "data:image/...;base64,..." hoặc null)
 * PUT    /api/dishes/{id}            sửa (image: giữ nguyên địa chỉ ảnh cũ = không đổi ảnh; null = bỏ ảnh)
 * PATCH  /api/dishes/{id}/status     {"status": "selling" | "stopped"}
 * DELETE /api/dishes/{id}            409 nếu món đã có trong đơn hàng
 * GET    /api/dish-categories        danh mục kèm số món
 * POST   /api/dish-categories        {"name", "active"}
 * PUT    /api/dish-categories/{id}   {"name", "active"}
 * GET    /api/allergens              danh sách dị nguyên được khai báo
 */
@RestController
public class DishController {
    private final DishService service;

    public DishController(DishService service) {
        this.service = service;
    }

    @GetMapping("/api/dishes")
    public Paged<Dish> list(
        @RequestParam(defaultValue = "") String keyword,
        @RequestParam(defaultValue = "") String categoryId,
        @RequestParam(defaultValue = "all") String status,
        @RequestParam(defaultValue = "1") int page) {
        return service.list(keyword, categoryId, status, page);
    }

    @GetMapping("/api/dishes/{id}")
    public Dish get(@PathVariable String id) {
        return service.get(id);
    }

    @PostMapping("/api/dishes")
    public Dish create(@RequestBody DishInput in) {
        return service.create(in);
    }

    @PutMapping("/api/dishes/{id}")
    public Dish update(@PathVariable String id, @RequestBody DishInput in) {
        return service.update(id, in);
    }

    @PatchMapping("/api/dishes/{id}/status")
    public Dish status(@PathVariable String id, @RequestBody Map<String, String> body) {
        return service.setStatus(id, body.get("status"));
    }

    @DeleteMapping("/api/dishes/{id}")
    public ResponseEntity<Void> delete(@PathVariable String id) {
        service.delete(id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/api/dish-categories")
    public List<Category> categories() {
        return service.categories();
    }

    @PostMapping("/api/dish-categories")
    public Category createCategory(@RequestBody CategoryInput in) {
        return service.saveCategory(null, in);
    }

    @PutMapping("/api/dish-categories/{id}")
    public Category updateCategory(@PathVariable String id, @RequestBody CategoryInput in) {
        return service.saveCategory(id, in);
    }

    @GetMapping("/api/allergens")
    public List<String> allergens() {
        return service.allergens();
    }
}
