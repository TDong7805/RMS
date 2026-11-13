package com.rms.warehouse;

import com.rms.common.Paged;
import com.rms.warehouse.IngredientService.Ingredient;
import com.rms.warehouse.IngredientService.IngredientDetail;
import com.rms.warehouse.IngredientService.IngredientInput;
import com.rms.warehouse.IngredientService.Move;
import com.rms.warehouse.IngredientService.Option;
import com.rms.warehouse.IngredientService.StatusInput;
import java.util.List;
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
 * Nguyên liệu (Quản lý kho):
 * GET    /api/kho/ingredients?keyword=&group=&status=all|active|inactive&stock=all|ok|low|out&page=
 * GET    /api/kho/ingredients/options                 danh sách gọn cho ô chọn
 * GET    /api/kho/ingredients/{id}                    chi tiết (nhà cung cấp, món dùng, phần chờ nhận)
 * GET    /api/kho/ingredients/{id}/moves?from=&to=&type=all|in|out|adjust&page=   thẻ kho
 * POST   /api/kho/ingredients                         {name, group, unit, minLevel, note, openingQty?, openingCost?}
 * PUT    /api/kho/ingredients/{id}                    {name, group, unit, minLevel, note}
 * PATCH  /api/kho/ingredients/{id}/status             {status: active | inactive}
 * DELETE /api/kho/ingredients/{id}                    409 nếu đã phát sinh dữ liệu
 */
@RestController
public class IngredientController {
    private final IngredientService service;

    public IngredientController(IngredientService service) {
        this.service = service;
    }

    @GetMapping("/api/kho/ingredients")
    public Paged<Ingredient> list(@RequestParam(defaultValue = "") String keyword, @RequestParam(defaultValue = "") String group,
                                  @RequestParam(defaultValue = "all") String status, @RequestParam(defaultValue = "all") String stock,
                                  @RequestParam(defaultValue = "1") int page) {
        return service.list(keyword, group, status, stock, page);
    }

    @GetMapping("/api/kho/ingredients/options")
    public List<Option> options() {
        return service.options();
    }

    @GetMapping("/api/kho/ingredients/{id}")
    public IngredientDetail detail(@PathVariable String id) {
        return service.detail(id);
    }

    @GetMapping("/api/kho/ingredients/{id}/moves")
    public Paged<Move> moves(@PathVariable String id, @RequestParam(defaultValue = "") String from,
                             @RequestParam(defaultValue = "") String to, @RequestParam(defaultValue = "all") String type,
                             @RequestParam(defaultValue = "1") int page) {
        return service.stockCard(id, from, to, type, page);
    }

    @PostMapping("/api/kho/ingredients")
    public Ingredient create(@RequestBody IngredientInput in) {
        return service.create(in);
    }

    @PutMapping("/api/kho/ingredients/{id}")
    public Ingredient update(@PathVariable String id, @RequestBody IngredientInput in) {
        return service.update(id, in);
    }

    @PatchMapping("/api/kho/ingredients/{id}/status")
    public Ingredient status(@PathVariable String id, @RequestBody StatusInput in) {
        return service.setStatus(id, in.status());
    }

    @DeleteMapping("/api/kho/ingredients/{id}")
    public ResponseEntity<Void> delete(@PathVariable String id) {
        service.delete(id);
        return ResponseEntity.noContent().build();
    }
}
