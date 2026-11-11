package com.rms.storage;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.UUID;
import java.util.regex.Pattern;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.CacheControl;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * Lưu file vào một thư mục trên máy chủ (mặc định "uploads" trong thư mục chạy backend; đổi bằng RMS_UPLOAD_DIR)
 * và phục vụ tại /uploads/{khóa}. Thư mục này không đưa lên git; khi chạy thật phải sao lưu cùng CSDL.
 *
 * Mỗi file có tên ngẫu nhiên (UUID) và không bao giờ bị ghi đè → trình duyệt được lưu đệm lâu dài.
 */
@Service
public class LocalStorageService implements StorageService, WebMvcConfigurer {
    private static final Logger log = LoggerFactory.getLogger(LocalStorageService.class);
    static final String URL_PREFIX = "/uploads/";
    private static final Pattern SAFE_KEY = Pattern.compile("^[a-z0-9-]+/[a-z0-9-]+\\.[a-z0-9]{2,5}$");

    private final Path root;

    public LocalStorageService(@Value("${rms.storage.local-dir:uploads}") String dir) {
        this.root = Path.of(dir).toAbsolutePath().normalize();
        try {
            Files.createDirectories(root);
        } catch (IOException e) {
            throw new UncheckedIOException("Không tạo được thư mục lưu file " + root, e);
        }
        log.info("Lưu file tải lên tại {}", root);
    }

    @Override
    public String save(String folder, byte[] content, String extension) {
        String key = folder + "/" + UUID.randomUUID() + "." + extension;
        if (!SAFE_KEY.matcher(key).matches()) throw new IllegalArgumentException("Khóa file không hợp lệ: " + key);
        Path target = resolve(key);
        try {
            Files.createDirectories(target.getParent());
            Files.write(target, content);
        } catch (IOException e) {
            throw new UncheckedIOException("Không lưu được file " + key, e);
        }
        return key;
    }

    @Override
    public void delete(String key) {
        if (key == null || !SAFE_KEY.matcher(key).matches()) return;
        try {
            Files.deleteIfExists(resolve(key));
        } catch (IOException e) {
            // Không làm hỏng thao tác của người dùng chỉ vì dọn file thất bại; file thừa vô hại.
            log.warn("Không xóa được file {}: {}", key, e.getMessage());
        }
    }

    @Override
    public String url(String key) {
        return key == null ? null : URL_PREFIX + key;
    }

    private Path resolve(String key) {
        Path p = root.resolve(key).normalize();
        if (!p.startsWith(root)) throw new IllegalArgumentException("Khóa file không hợp lệ: " + key);
        return p;
    }

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        String location = root.toUri().toString();
        registry.addResourceHandler(URL_PREFIX + "**")
            .addResourceLocations(location.endsWith("/") ? location : location + "/")
            .setCacheControl(CacheControl.maxAge(java.time.Duration.ofDays(365)).cachePublic().immutable());
    }
}
