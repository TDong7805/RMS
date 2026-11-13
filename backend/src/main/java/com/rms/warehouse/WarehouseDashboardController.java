package com.rms.warehouse;

import com.rms.warehouse.WarehouseDashboardService.Dashboard;
import com.rms.warehouse.WarehouseDashboardService.InventoryCard;
import com.rms.warehouse.WarehouseDashboardService.SummaryPage;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * GET /api/kho/dashboard?from=&to=                              Dashboard kho (mặc định 7 ngày qua, tối đa 366 ngày)
 * GET /api/kho/stock-summary?from=&to=&keyword=&group=&page=    tab Nhập – xuất – tồn
 * GET /api/dashboard/inventory?period=                          thẻ Kho trên Dashboard Quản lý nhà hàng
 */
@RestController
public class WarehouseDashboardController {
    private final WarehouseDashboardService service;

    public WarehouseDashboardController(WarehouseDashboardService service) {
        this.service = service;
    }

    @GetMapping("/api/kho/dashboard")
    public Dashboard dashboard(@RequestParam(defaultValue = "") String from, @RequestParam(defaultValue = "") String to) {
        return service.dashboard(from, to);
    }

    @GetMapping("/api/kho/stock-summary")
    public SummaryPage summary(@RequestParam(defaultValue = "") String from, @RequestParam(defaultValue = "") String to,
                               @RequestParam(defaultValue = "") String keyword, @RequestParam(defaultValue = "") String group,
                               @RequestParam(defaultValue = "1") int page) {
        return service.summary(from, to, keyword, group, page);
    }

    @GetMapping("/api/dashboard/inventory")
    public InventoryCard inventory(@RequestParam(defaultValue = "today") String period) {
        return service.inventoryCard(period);
    }
}
