package com.rms.warehouse;

import com.rms.common.Paged;
import com.rms.warehouse.SupplierService.Link;
import com.rms.warehouse.SupplierService.LinkInput;
import com.rms.warehouse.SupplierService.NameMatch;
import com.rms.warehouse.SupplierService.PriceRecord;
import com.rms.warehouse.SupplierService.StopInput;
import com.rms.warehouse.SupplierService.Supplier;
import com.rms.warehouse.SupplierService.SupplierDetail;
import com.rms.warehouse.SupplierService.SupplierInput;
import java.util.Collections;
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
 * Nhà cung cấp (Quản lý kho):
 * GET    /api/kho/suppliers?keyword=&status=all|active|inactive&page=
 * GET    /api/kho/suppliers/options                         danh sách gọn {id, code, name, active}
 * GET    /api/kho/suppliers/name-check?name=&exceptId=      {match: {id, code, name} | null} — chỉ để cảnh báo trùng tên
 * GET    /api/kho/suppliers/{id}                            kèm liên kết nguyên liệu và lịch sử trạng thái
 * POST   /api/kho/suppliers                                 {name, phone, paymentMethod, contact, email, website, taxCode,
 *                                                            address, note, links?: [{ingredientId, purchaseUnit, factor, price, minOrder}]}
 * PUT    /api/kho/suppliers/{id}                            chỉ thông tin (không gồm liên kết)
 * PATCH  /api/kho/suppliers/{id}/stop                       {reason, note}
 * PATCH  /api/kho/suppliers/{id}/activate
 * DELETE /api/kho/suppliers/{id}                            409 nếu đã có phiếu mua
 * POST   /api/kho/suppliers/{id}/links                      thêm nguyên liệu cung cấp
 * PUT    /api/kho/supplier-links/{id}                       đổi giá / quy cách / SL tối thiểu
 * PATCH  /api/kho/supplier-links/{id}/stop
 * PATCH  /api/kho/supplier-links/{id}/activate              bắt buộc giá mới
 * GET    /api/kho/supplier-links/{id}/prices                lịch sử giá, mới nhất trước
 */
@RestController
public class SupplierController {
    private final SupplierService service;

    public SupplierController(SupplierService service) {
        this.service = service;
    }

    @GetMapping("/api/kho/suppliers")
    public Paged<Supplier> list(@RequestParam(defaultValue = "") String keyword, @RequestParam(defaultValue = "all") String status,
                                @RequestParam(defaultValue = "1") int page) {
        return service.list(keyword, status, page);
    }

    @GetMapping("/api/kho/suppliers/options")
    public List<SupplierService.SupplierOption> options() {
        return service.options();
    }

    @GetMapping("/api/kho/suppliers/name-check")
    public Map<String, NameMatch> nameCheck(@RequestParam(defaultValue = "") String name,
                                            @RequestParam(defaultValue = "") String exceptId) {
        return Collections.singletonMap("match", service.findByName(name, exceptId));
    }

    @GetMapping("/api/kho/suppliers/{id}")
    public SupplierDetail detail(@PathVariable String id) {
        return service.detail(id);
    }

    @PostMapping("/api/kho/suppliers")
    public Supplier create(@RequestBody SupplierInput in) {
        return service.create(in);
    }

    @PutMapping("/api/kho/suppliers/{id}")
    public Supplier update(@PathVariable String id, @RequestBody SupplierInput in) {
        return service.update(id, in);
    }

    @PatchMapping("/api/kho/suppliers/{id}/stop")
    public Supplier stop(@PathVariable String id, @RequestBody StopInput in) {
        return service.stop(id, in);
    }

    @PatchMapping("/api/kho/suppliers/{id}/activate")
    public Supplier activate(@PathVariable String id) {
        return service.activate(id);
    }

    @DeleteMapping("/api/kho/suppliers/{id}")
    public ResponseEntity<Void> delete(@PathVariable String id) {
        service.delete(id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/api/kho/suppliers/{id}/links")
    public Link addLink(@PathVariable String id, @RequestBody LinkInput in) {
        return service.addLink(id, in);
    }

    @PutMapping("/api/kho/supplier-links/{id}")
    public Link updateLink(@PathVariable String id, @RequestBody LinkInput in) {
        return service.updateLink(id, in);
    }

    @PatchMapping("/api/kho/supplier-links/{id}/stop")
    public Link stopLink(@PathVariable String id) {
        return service.stopLink(id);
    }

    @PatchMapping("/api/kho/supplier-links/{id}/activate")
    public Link reactivateLink(@PathVariable String id, @RequestBody LinkInput in) {
        return service.reactivateLink(id, in);
    }

    @GetMapping("/api/kho/supplier-links/{id}/prices")
    public List<PriceRecord> prices(@PathVariable String id) {
        return service.priceHistory(id);
    }
}
