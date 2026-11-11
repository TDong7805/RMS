package com.rms.common;

import java.util.Arrays;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * CORS chỉ cần khi frontend chạy ở địa chỉ khác backend (khi phát triển: Vite cổng 3000/5173 gọi thẳng 8080).
 * Khi chạy thật frontend được phục vụ cùng địa chỉ với API nên danh sách để rỗng → không mở CORS cho ai.
 */
@Configuration
public class CorsConfig {

    @Bean
    WebMvcConfigurer corsConfigurer(@Value("${rms.cors.allowed-origins:}") String[] configured) {
        String[] origins = Arrays.stream(configured).map(String::trim).filter(s -> !s.isEmpty()).toArray(String[]::new);
        return new WebMvcConfigurer() {
            @Override
            public void addCorsMappings(CorsRegistry registry) {
                if (origins.length == 0) return;
                registry.addMapping("/api/**")
                    .allowedOrigins(origins)
                    .allowedMethods("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS")
                    .allowedHeaders("*")
                    // Cho phép gửi cookie phiên khi frontend chạy khác cổng mà không qua proxy của Vite.
                    .allowCredentials(true);
            }
        };
    }
}
