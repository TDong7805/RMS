package com.rms.warehouse;

import com.rms.common.Paged;
import com.rms.warehouse.StocktakeService.AddLineInput;
import com.rms.warehouse.StocktakeService.CreateInput;
import com.rms.warehouse.StocktakeService.Line;
import com.rms.warehouse.StocktakeService.LineInput;
import com.rms.warehouse.StocktakeService.ReasonInput;
import com.rms.warehouse.StocktakeService.StocktakeDetail;
import com.rms.warehouse.StocktakeService.StocktakeRow;
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
 * Kiểm kê — khu Kho:
 * GET    /api/kho/stocktakes?keyword=&status=&from=&to=&page=
 * GET    /api/kho/stocktakes/{id}
 * POST   /api/kho/stocktakes                       {scope: all|group|pick, groups[], ingredientIds[], note}
 * PUT    /api/kho/stocktakes/{id}/lines/{lineId}   tự lưu khi đếm {actualQty, reason, note, estUnitCost}
 * POST   /api/kho/stocktakes/{id}/lines            thêm dòng (phạm vi Chọn từng nguyên liệu)
 * DELETE /api/kho/stocktakes/{id}/lines/{lineId}
 * POST   /api/kho/stocktakes/{id}/match-all        "Khớp sổ sách" cho mọi dòng chưa đếm
 * POST   /api/kho/stocktakes/{id}/submit           gửi duyệt (không chênh lệch → Hoàn tất)
 * DELETE /api/kho/stocktakes/{id}                  xóa phiếu nháp
 * PATCH  /api/kho/stocktakes/{id}/cancel           {reason} — hủy phiếu bị từ chối
 *
 * Duyệt kiểm kê — khu Quản lý nhà hàng (UC-KHO-24):
 * GET    /api/stocktake-approvals?status=pending|all|...&page=
 * GET    /api/stocktake-approvals/{id}
 * PATCH  /api/stocktake-approvals/{id}/approve
 * PATCH  /api/stocktake-approvals/{id}/reject      {reason}
 */
@RestController
public class StocktakeController {
    private final StocktakeService service;

    public StocktakeController(StocktakeService service) {
        this.service = service;
    }

    @GetMapping("/api/kho/stocktakes")
    public Paged<StocktakeRow> list(@RequestParam(defaultValue = "") String keyword, @RequestParam(defaultValue = "all") String status,
                                    @RequestParam(defaultValue = "") String from, @RequestParam(defaultValue = "") String to,
                                    @RequestParam(defaultValue = "1") int page) {
        return service.list(keyword, status, from, to, page);
    }

    @GetMapping("/api/kho/stocktakes/{id}")
    public StocktakeDetail detail(@PathVariable String id) {
        return service.detail(id);
    }

    @PostMapping("/api/kho/stocktakes")
    public StocktakeDetail create(@RequestBody CreateInput in) {
        return service.create(in);
    }

    @PutMapping("/api/kho/stocktakes/{id}/lines/{lineId}")
    public Line saveLine(@PathVariable String id, @PathVariable String lineId, @RequestBody LineInput in) {
        return service.saveLine(id, lineId, in);
    }

    @PostMapping("/api/kho/stocktakes/{id}/lines")
    public StocktakeDetail addLine(@PathVariable String id, @RequestBody AddLineInput in) {
        return service.addLine(id, in);
    }

    @DeleteMapping("/api/kho/stocktakes/{id}/lines/{lineId}")
    public StocktakeDetail removeLine(@PathVariable String id, @PathVariable String lineId) {
        return service.removeLine(id, lineId);
    }

    @PostMapping("/api/kho/stocktakes/{id}/match-all")
    public StocktakeDetail matchAll(@PathVariable String id) {
        return service.matchAll(id);
    }

    @PostMapping("/api/kho/stocktakes/{id}/submit")
    public StocktakeDetail submit(@PathVariable String id) {
        return service.submit(id);
    }

    @DeleteMapping("/api/kho/stocktakes/{id}")
    public ResponseEntity<Void> delete(@PathVariable String id) {
        service.deleteDraft(id);
        return ResponseEntity.noContent().build();
    }

    @PatchMapping("/api/kho/stocktakes/{id}/cancel")
    public StocktakeDetail cancel(@PathVariable String id, @RequestBody ReasonInput in) {
        return service.cancel(id, in);
    }

    /* ---------------- Quản lý nhà hàng */

    @GetMapping("/api/stocktake-approvals")
    public Paged<StocktakeRow> approvals(@RequestParam(defaultValue = "pending") String status, @RequestParam(defaultValue = "1") int page) {
        return service.list("", status, "", "", page);
    }

    @GetMapping("/api/stocktake-approvals/{id}")
    public StocktakeDetail approval(@PathVariable String id) {
        return service.detail(id);
    }

    @PatchMapping("/api/stocktake-approvals/{id}/approve")
    public StocktakeDetail approve(@PathVariable String id) {
        return service.approve(id);
    }

    @PatchMapping("/api/stocktake-approvals/{id}/reject")
    public StocktakeDetail reject(@PathVariable String id, @RequestBody ReasonInput in) {
        return service.reject(id, in);
    }
}
