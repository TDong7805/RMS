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
 *  - /api/** còn lại             : hiện tại đều là chức năng của Quản lý nhà hàng → ROLE_MANAGER.
 *    Khi làm phân hệ Thu ngân/Bếp/Kho: thêm requestMatchers("/api/cashier/**").hasRole("CASHIER")... TRƯỚC dòng này.
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
                .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
                .requestMatchers(HttpMethod.POST, "/api/auth/login").permitAll()
                .requestMatchers("/api/auth/**").authenticated()
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
