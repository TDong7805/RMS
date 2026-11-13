package com.rms.common;

import java.io.IOException;
import java.util.concurrent.TimeUnit;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.io.Resource;
import org.springframework.http.CacheControl;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;
import org.springframework.web.servlet.resource.PathResourceResolver;

/**
 * Phục vụ frontend React đã build (frontend/dist được chép vào classpath:/static bởi profile Maven "bundle").
 * Nhờ vậy khi chạy thật chỉ cần một file rms.jar: cùng một địa chỉ cho cả giao diện lẫn API, không cần CORS.
 *
 *  - /assets/**: file JS/CSS có mã băm trong tên → cho trình duyệt lưu đệm 1 năm.
 *  - Đường dẫn của trang (vd. /tai-khoan/12/sua) không phải file → trả index.html để React Router xử lý,
 *    nên tải lại trang hay mở link trực tiếp đều đúng.
 *  - /api/... không tồn tại hoặc file thiếu (có dấu chấm trong tên) → 404, không trả nhầm index.html.
 *
 * Khi phát triển (không build kèm frontend) classpath:/static trống → các đường dẫn không phải API trả 404 như cũ.
 */
@Configuration
public class FrontendConfig implements WebMvcConfigurer {
    private static final String STATIC = "classpath:/static/";

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        registry.addResourceHandler("/assets/**")
            .addResourceLocations(STATIC + "assets/")
            .setCacheControl(CacheControl.maxAge(365, TimeUnit.DAYS).cachePublic().immutable());

        registry.addResourceHandler("/**")
            .addResourceLocations(STATIC)
            // index.html luôn hỏi lại máy chủ → cập nhật phiên bản mới là người dùng nhận ngay.
            .setCacheControl(CacheControl.noCache())
            .resourceChain(false)
            .addResolver(new SpaFallbackResolver());
    }

    private static final class SpaFallbackResolver extends PathResourceResolver {
        @Override
        protected Resource getResource(String path, Resource location) throws IOException {
            // super.getResource kiểm tra file có thật và nằm trong thư mục static (chặn ../).
            Resource file = super.getResource(path, location);
            if (file != null) return file;
            if (path.startsWith("api/") || path.startsWith("actuator/") || path.contains(".")) return null;
            return super.getResource("index.html", location);
        }
    }
}
