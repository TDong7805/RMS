package com.rms.shift;

import com.rms.common.BusinessException;
import com.rms.common.CurrentUserService;
import com.rms.common.Times;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.util.Set;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * Thu ngân và nhân viên bếp phải đã chấm công vào ca (chưa tan ca) mới làm VIỆC TRONG CA (V22, 21/11/2026):
 *  - Thu ngân: mở / đóng / chuyển bàn, số khách, hủy món / đơn, lập hóa đơn, thu tiền, hủy hóa đơn, yêu cầu của khách.
 *  - Bếp: bắt đầu / xong / đã lấy / hoàn tác / hủy món, đánh dấu món tạm hết.
 * Chỉ chặn thao tác ghi (POST / PUT / PATCH / DELETE); xem vẫn được. Việc văn phòng (chấm công, bảng lương, công thức định
 * lượng) không bị chặn — thu ngân còn sửa giúp người quên tan ca, tính lương ngoài giờ.
 * Nhân viên phục vụ: WaiterGuard (com.rms.waiter). Tự chấm công: /api/toi/** (không bị chặn).
 */
@Component
public class OnDutyInterceptor implements HandlerInterceptor, WebMvcConfigurer {
    static final String[] PATHS = {
        "/api/thu-ngan/tables/**", "/api/thu-ngan/orders/**", "/api/thu-ngan/items/**", "/api/thu-ngan/invoices/**",
        "/api/thu-ngan/requests/**", "/api/bep/items/**", "/api/bep/dishes/**",
    };
    private static final Set<String> READ = Set.of("GET", "HEAD", "OPTIONS");

    private final JdbcClient jdbc;
    private final CurrentUserService currentUser;

    public OnDutyInterceptor(JdbcClient jdbc, CurrentUserService currentUser) {
        this.jdbc = jdbc;
        this.currentUser = currentUser;
    }

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(this).addPathPatterns(PATHS);
    }

    @Override
    public boolean preHandle(HttpServletRequest req, HttpServletResponse res, Object handler) {
        if (READ.contains(req.getMethod())) return true;
        var me = currentUser.get();
        if (!"cashier".equals(me.role()) && !"kitchen".equals(me.role())) return true;
        var now = Times.now();
        int open = jdbc.sql("""
                SELECT COUNT(*) FROM attendances WHERE user_id = ? AND check_out IS NULL AND check_in <= ? AND check_in > ?
                """).params(me.id(), now, now.minusHours(DutyService.OPEN_MAX_HOURS)).query(Integer.class).single();
        if (open == 0) {
            throw new BusinessException("Bạn cần vào ca (chấm công khuôn mặt) trước khi thao tác. Vào mục Chấm công để vào ca.",
                HttpStatus.CONFLICT);
        }
        return true;
    }
}
