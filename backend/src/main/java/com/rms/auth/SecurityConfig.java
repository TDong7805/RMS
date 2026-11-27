package com.rms.auth;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.access.intercept.AuthorizationFilter;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.security.web.context.SecurityContextRepository;

/**
 * Xác thực bằng session cookie (RMS_SESSION, HttpOnly, SameSite=Lax — cấu hình trong application.properties).
 *
 * Phân quyền theo đường dẫn API:
 *  - POST /api/auth/login        : ai cũng gọi được
 *  - /api/auth/**                : đã đăng nhập (kể cả khi đang bị buộc đổi mật khẩu)
 *  - /api/notifications/**       : mọi vai trò nội bộ (thông báo của chính tài khoản)
 *  - /api/public/**              : khách không đăng nhập — trang đặt món QR (/api/public/qr/**) và website khách hàng
 *                                  (/api/public/site/** chỉ đọc, POST /api/public/reservations có chống gửi dồn dập)
 *  - /api/website/**             : cấu hình website khách hàng → thuộc khối /api/** của Quản lý nhà hàng
 *  - /api/kho/**                 : Quản lý kho → ROLE_WAREHOUSE
 *  - /api/bep/**                 : Nhân viên bếp → ROLE_KITCHEN
 *  - /api/thu-ngan/**            : Thu ngân → ROLE_CASHIER
 *  - /api/phuc-vu/**             : Nhân viên phục vụ → ROLE_WAITER
 *  - /api/toi/**                 : thông tin, chấm công khuôn mặt của chính mình → phục vụ, thu ngân, bếp
 *  - /uploads/cham-cong, /uploads/khuon-mat : ảnh khuôn mặt KHÔNG phục vụ công khai (xem qua API có kiểm quyền)
 *  - /api/** còn lại             : chức năng của Quản lý nhà hàng → ROLE_MANAGER.
 *
 * CSRF tắt có chủ đích: API chỉ nhận JSON (form của trang khác không gửi được application/json khi
 * chưa qua CORS) và cookie phiên là SameSite=Lax nên trình duyệt không gửi kèm khi trang lạ POST tới.
 */
@Configuration
@EnableWebSecurity
public class SecurityConfig {

    @Bean
    PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    SecurityContextRepository securityContextRepository() {
        return new HttpSessionSecurityContextRepository();
    }

    @Bean
    SecurityFilterChain securityFilterChain(HttpSecurity http, JdbcClient jdbc, SecurityContextRepository contextRepository)
        throws Exception {
        http
            .csrf(c -> c.disable())
            .cors(Customizer.withDefaults())
            .formLogin(f -> f.disable())
            .httpBasic(b -> b.disable())
            .logout(l -> l.disable())
            .requestCache(c -> c.disable())
            .securityContext(c -> c.securityContextRepository(contextRepository))
            .authorizeHttpRequests(a -> a
                // Kết nối SSE (luồng sự kiện) chạy tiếp ở luồng bất đồng bộ — đã kiểm quyền ở yêu cầu đầu.
                .dispatcherTypeMatchers(jakarta.servlet.DispatcherType.ASYNC, jakarta.servlet.DispatcherType.ERROR).permitAll()
                .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
                .requestMatchers("/api/public/**").permitAll()
                .requestMatchers(HttpMethod.POST, "/api/auth/login").permitAll()
                .requestMatchers("/api/auth/**").authenticated()
                .requestMatchers("/uploads/cham-cong/**", "/uploads/khuon-mat/**").denyAll()
                .requestMatchers("/api/notifications/**").hasAnyRole("MANAGER", "CASHIER", "KITCHEN", "WAREHOUSE", "WAITER")
                // Thu ngân / bếp (V30): tài khoản riêng chỉ Cổng nhân viên (+ việc văn phòng của thu ngân);
                // màn hình chung (khu.thu.ngan, khu.bep) chỉ màn làm việc. Xem StaffAreas.authorities.
                .requestMatchers("/api/toi/**").hasAnyAuthority("ROLE_WAITER", "CASHIER_SELF", "KITCHEN_SELF")
                .requestMatchers("/api/phuc-vu/**").hasRole("WAITER")
                .requestMatchers("/api/kho/**").hasRole("WAREHOUSE")
                .requestMatchers("/api/bep/**").hasAuthority("KITCHEN_SCREEN")
                .requestMatchers("/api/thu-ngan/attendance/**", "/api/thu-ngan/payroll/**", "/api/thu-ngan/employees")
                    .hasAuthority("CASHIER_SELF")
                .requestMatchers("/api/thu-ngan/**").hasAuthority("CASHIER_SCREEN")
                .requestMatchers("/api/**").hasRole("MANAGER")
                .anyRequest().permitAll())
            .exceptionHandling(e -> e
                .authenticationEntryPoint((req, res, ex) ->
                    JsonErrors.write(res, 401, "Bạn chưa đăng nhập hoặc phiên đăng nhập đã hết hạn."))
                .accessDeniedHandler((req, res, ex) -> {
                    var auth = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
                    boolean mustChange = auth != null && auth.getAuthorities().stream()
                        .anyMatch(g -> StaffAreas.PASSWORD_CHANGE_REQUIRED.equals(g.getAuthority()));
                    JsonErrors.write(res, 403, mustChange
                        ? "Bạn cần đổi mật khẩu trước khi tiếp tục."
                        : "Bạn không có quyền thực hiện chức năng này.");
                }))
            .addFilterBefore(new ActiveUserFilter(jdbc), AuthorizationFilter.class);
        return http.build();
    }
}
