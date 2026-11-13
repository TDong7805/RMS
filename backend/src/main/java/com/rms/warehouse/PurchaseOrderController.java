package com.rms.warehouse;

import com.rms.common.Paged;
import com.rms.warehouse.PurchaseOrderService.PurchaseOrderDetail;
import com.rms.warehouse.PurchaseOrderService.PurchaseOrderInput;
import com.rms.warehouse.PurchaseOrderService.PurchaseOrderRow;
import com.rms.warehouse.PurchaseOrderService.ReasonInput;
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
 * Phiếu mua (Quản lý kho):
 * GET    /api/kho/purchase-orders?keyword=&supplierId=&status=all|draft|waiting|received|closed|cancelled
 *                                 &payment=all|unpaid|partial|paid&from=&to=&page=
 * GET    /api/kho/purchase-orders/waiting          phiếu đang chờ nhận (chọn phiếu để nhận hàng)
 * GET    /api/kho/purchase-orders/{id}
 * POST   /api/kho/purchase-orders?action=draft|order
 * PUT    /api/kho/purchase-orders/{id}?action=draft|order   chỉ phiếu Nháp
 * DELETE /api/kho/purchase-orders/{id}              xóa phiếu Nháp
 * PATCH  /api/kho/purchase-orders/{id}/cancel       {reason, note} — chỉ khi Chưa nhận
 * PATCH  /api/kho/purchase-orders/{id}/close        {reason, note} — kết thúc nhận hàng khi Nhận một phần
 */
@RestController
public class PurchaseOrderController {
    private final PurchaseOrderService service;

    public PurchaseOrderController(PurchaseOrderService service) {
        this.service = service;
    }

    @GetMapping("/api/kho/purchase-orders")
    public Paged<PurchaseOrderRow> list(@RequestParam(defaultValue = "") String keyword,
                                        @RequestParam(defaultValue = "") String supplierId,
                                        @RequestParam(defaultValue = "all") String status,
                                        @RequestParam(defaultValue = "all") String payment,
                                        @RequestParam(defaultValue = "") String from, @RequestParam(defaultValue = "") String to,
                                        @RequestParam(defaultValue = "1") int page) {
        return service.list(keyword, supplierId, status, payment, from, to, page);
    }

    @GetMapping("/api/kho/purchase-orders/waiting")
    public List<PurchaseOrderRow> waiting() {
        return service.waiting();
    }

    @GetMapping("/api/kho/purchase-orders/{id}")
    public PurchaseOrderDetail detail(@PathVariable String id) {
        return service.detail(id);
    }

    @PostMapping("/api/kho/purchase-orders")
    public PurchaseOrderRow create(@RequestBody PurchaseOrderInput in, @RequestParam(defaultValue = "draft") String action) {
        return service.create(in, action);
    }

    @PutMapping("/api/kho/purchase-orders/{id}")
    public PurchaseOrderRow update(@PathVariable String id, @RequestBody PurchaseOrderInput in,
                                   @RequestParam(defaultValue = "draft") String action) {
        return service.update(id, in, action);
    }

    @DeleteMapping("/api/kho/purchase-orders/{id}")
    public ResponseEntity<Void> delete(@PathVariable String id) {
        service.deleteDraft(id);
        return ResponseEntity.noContent().build();
    }

    @PatchMapping("/api/kho/purchase-orders/{id}/cancel")
    public PurchaseOrderRow cancel(@PathVariable String id, @RequestBody ReasonInput in) {
        return service.cancel(id, in);
    }

    @PatchMapping("/api/kho/purchase-orders/{id}/close")
    public PurchaseOrderRow close(@PathVariable String id, @RequestBody ReasonInput in) {
        return service.close(id, in);
    }
}
