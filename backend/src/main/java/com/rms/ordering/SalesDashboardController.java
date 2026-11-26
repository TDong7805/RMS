package com.rms.ordering;

import com.rms.ordering.SalesDashboardService.Overview;
import com.rms.ordering.SalesDashboardService.Revenue;
import com.rms.ordering.SalesDashboardService.TopDishes;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Dashboard Quản lý nhà hàng — số liệu bán hàng từ hóa đơn đã thanh toán:
 * GET /api/dashboard/revenue?period=      doanh thu, số hóa đơn, trung bình, biểu đồ kèm kỳ trước
 * GET /api/dashboard/top-dishes?period=   5 món bán chạy / 5 món bán chậm
 */
@RestController
public class SalesDashboardController {
    private final SalesDashboardService service;

    public SalesDashboardController(SalesDashboardService service) {
        this.service = service;
    }

    @GetMapping("/api/dashboard/revenue")
    public Revenue revenue(@RequestParam(required = false) String period) {
        return service.revenue(period);
    }

    /** Mọi số liệu của trang Dashboard trong một lần gọi (bản 26/11/2026). */
    @GetMapping("/api/dashboard/overview")
    public Overview overview(@RequestParam(required = false) String period) {
        return service.overview(period);
    }

    @GetMapping("/api/dashboard/top-dishes")
    public TopDishes topDishes(@RequestParam(required = false) String period) {
        return service.topDishes(period);
    }
}
