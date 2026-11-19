package com.rms.storage;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.Set;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;

/**
 * CHỈ MÔI TRƯỜNG DEV — gắn ảnh mẫu cho món ăn và ảnh bìa trang đặt món từ thư mục trong repo
 * ({@code backend/database/seed-images}, xem README ở đó). Ảnh tải lên thật nằm ở thư mục uploads (không đưa lên git),
 * nên ảnh mẫu được để trong repo và chép vào kho ảnh khi backend khởi động — cả nhóm kéo code về là có ảnh.
 *
 * Quy tắc:
 *  - Món được gắn ảnh khi chưa có ảnh; đã gắn rồi thì ghi nhớ trong system_settings ("dev.seed_images") để không gắn lại
 *    sau khi Quản lý xóa / đổi ảnh. Xóa CSDL tạo lại thì gắn lại từ đầu.
 *  - Ảnh danh mục: {@code danh-muc/danh-sach.csv} (tên file,tên danh mục) — cùng quy tắc như ảnh món.
 *  - Ảnh nhóm món: {@code nhom/danh-sach.csv} (tên file,tên nhóm); ảnh set: {@code set/danh-sach.csv} (tên file,tên set).
 *  - Ảnh đã gắn mà file trong uploads bị mất (vd. xóa thư mục uploads) thì gắn lại từ ảnh mẫu.
 *  - Ảnh được thu nhỏ / làm sạch như ảnh tải lên (không giới hạn 2 MB vì là ảnh do nhóm chọn sẵn).
 */
@Component
@Profile("dev")
public class SeedImageLoader implements ApplicationRunner {
    private static final Logger log = LoggerFactory.getLogger(SeedImageLoader.class);
    private static final String SETTING = "dev.seed_images";
    private static final List<String> EXTS = List.of("jpg", "jpeg", "png", "webp");

    private final JdbcClient jdbc;
    private final StorageService storage;
    private final String configuredDir;

    public SeedImageLoader(JdbcClient jdbc, StorageService storage, @Value("${rms.seed-images.dir:}") String configuredDir) {
        this.jdbc = jdbc;
        this.storage = storage;
        this.configuredDir = configuredDir;
    }

    @Override
    public void run(ApplicationArguments args) {
        Optional<Path> dir = locate();
        if (dir.isEmpty()) {
            log.info("Không thấy thư mục ảnh mẫu (database/seed-images) — bỏ qua gắn ảnh mẫu.");
            return;
        }
        try {
            Set<String> applied = readApplied();
            int dishes = applyDishes(dir.get(), applied);
            int cats = applyCategories(dir.get(), applied);
            int groups = applyNamed(dir.get(), applied, "nhom", "dish_groups", "groups", "grp");
            int sets = applyNamed(dir.get(), applied, "set", "combos", "sets", "set");
            int cover = applyCover(dir.get(), applied);
            saveApplied(applied);
            if (dishes + cats + groups + sets + cover > 0)
                log.info("Đã gắn {} ảnh món, {} ảnh danh mục, {} ảnh nhóm món, {} ảnh set và {} ảnh bìa từ {}",
                    dishes, cats, groups, sets, cover, dir.get());
        } catch (RuntimeException | IOException e) {
            // Ảnh mẫu chỉ để demo: lỗi không được làm backend dừng.
            log.warn("Không gắn được ảnh mẫu: {}", e.toString(), e);
        }
    }

    private Optional<Path> locate() {
        List<Path> candidates = new ArrayList<>();
        if (!configuredDir.isBlank()) candidates.add(Path.of(configuredDir));
        candidates.add(Path.of("database", "seed-images"));
        candidates.add(Path.of("backend", "database", "seed-images"));
        return candidates.stream().filter(Files::isDirectory).findFirst();
    }

    /** danh-sach.csv: mã món,tên file ảnh (không đuôi),tên món. */
    private int applyDishes(Path dir, Set<String> applied) throws IOException {
        Path list = dir.resolve("mon").resolve("danh-sach.csv");
        if (!Files.exists(list)) return 0;
        int count = 0;
        for (String line : Files.readAllLines(list, StandardCharsets.UTF_8)) {
            String[] cols = line.split(",", 3);
            if (cols.length < 2 || !cols[0].trim().matches("MA\\d{3,}")) continue;
            String code = cols[0].trim();
            Optional<Path> file = imageFile(dir.resolve("mon"), cols[1].trim());
            if (file.isEmpty()) continue;
            List<String> current = jdbc.sql("SELECT image_url FROM dishes WHERE code = ?").param(code)
                .query((rs, n) -> rs.getString(1)).list();
            if (current.isEmpty()) continue; // món không có trong CSDL
            String key = current.get(0);
            boolean missingFile = key != null && storage.read(key) == null;
            boolean fresh = key == null && !applied.contains(code);
            if (!fresh && !missingFile) continue;
            String newKey = save("dishes", file.get());
            jdbc.sql("UPDATE dishes SET image_url = ? WHERE code = ?").params(newKey, code).update();
            applied.add(code);
            count++;
        }
        return count;
    }

    /**
     * danh-muc/danh-sach.csv: tên file ảnh (không đuôi),tên danh mục — tên danh mục để cuối vì có thể chứa dấu phẩy
     * ("Cơm, mì & burger"). Ghi nhớ dạng "cat<id>".
     */
    private int applyCategories(Path dir, Set<String> applied) throws IOException {
        Path list = dir.resolve("danh-muc").resolve("danh-sach.csv");
        if (!Files.exists(list)) return 0;
        int count = 0;
        for (String line : Files.readAllLines(list, StandardCharsets.UTF_8)) {
            String[] cols = line.replace("﻿", "").split(",", 2);
            if (cols.length < 2 || cols[0].isBlank() || cols[0].trim().equalsIgnoreCase("ten_file_anh")) continue;
            Optional<Path> file = imageFile(dir.resolve("danh-muc"), cols[0].trim());
            if (file.isEmpty()) continue;
            var row = jdbc.sql("SELECT id, image_url FROM dish_categories WHERE name = ?").param(cols[1].trim())
                .query((rs, n) -> new String[] {rs.getString(1), rs.getString(2)}).list();
            if (row.isEmpty()) continue;
            String key = row.get(0)[1];
            String mark = "cat" + row.get(0)[0];
            boolean missingFile = key != null && storage.read(key) == null;
            boolean fresh = key == null && !applied.contains(mark);
            if (!fresh && !missingFile) continue;
            jdbc.sql("UPDATE dish_categories SET image_url = ? WHERE id = ?").params(save("categories", file.get()), row.get(0)[0]).update();
            applied.add(mark);
            count++;
        }
        return count;
    }

    /**
     * Ảnh theo tên (nhóm món, set): {@code <thư mục>/danh-sach.csv} gồm "tên file ảnh,tên". Bảng phải có cột id, name,
     * image_url. Ghi nhớ dạng "<tiền tố><id>" như ảnh danh mục.
     */
    private int applyNamed(Path dir, Set<String> applied, String folder, String table, String storeFolder, String prefix)
            throws IOException {
        Path list = dir.resolve(folder).resolve("danh-sach.csv");
        if (!Files.exists(list)) return 0;
        int count = 0;
        for (String line : Files.readAllLines(list, StandardCharsets.UTF_8)) {
            String[] cols = line.replace("﻿", "").split(",", 2);
            if (cols.length < 2 || cols[0].isBlank() || cols[0].trim().startsWith("ten_file")) continue;
            Optional<Path> file = imageFile(dir.resolve(folder), cols[0].trim());
            if (file.isEmpty()) continue;
            var row = jdbc.sql("SELECT id, image_url FROM " + table + " WHERE name = ?").param(cols[1].trim())
                .query((rs, n) -> new String[] {rs.getString(1), rs.getString(2)}).list();
            if (row.isEmpty()) continue;
            String key = row.get(0)[1];
            String mark = prefix + row.get(0)[0];
            boolean missingFile = key != null && storage.read(key) == null;
            boolean fresh = key == null && !applied.contains(mark);
            if (!fresh && !missingFile) continue;
            jdbc.sql("UPDATE " + table + " SET image_url = ? WHERE id = ?").params(save(storeFolder, file.get()), row.get(0)[0]).update();
            applied.add(mark);
            count++;
        }
        return count;
    }

    private int applyCover(Path dir, Set<String> applied) throws IOException {
        Optional<Path> file = imageFile(dir, "anh-bia");
        if (file.isEmpty()) return 0;
        // list() có thể chứa null (chưa có ảnh bìa) — không dùng stream().findFirst() vì nó báo lỗi với phần tử null.
        List<String> keys = jdbc.sql("SELECT cover_image_url FROM restaurant_info WHERE id = 1").query((rs, n) -> rs.getString(1)).list();
        String key = keys.isEmpty() ? null : keys.get(0);
        boolean missingFile = key != null && storage.read(key) == null;
        boolean fresh = key == null && !applied.contains("cover");
        if (!fresh && !missingFile) return 0;
        jdbc.sql("UPDATE restaurant_info SET cover_image_url = ? WHERE id = 1").param(save("restaurant", file.get())).update();
        applied.add("cover");
        return 1;
    }

    private Optional<Path> imageFile(Path folder, String baseName) {
        for (String ext : EXTS) {
            Path p = folder.resolve(baseName + "." + ext);
            if (Files.isRegularFile(p)) return Optional.of(p);
            Path upper = folder.resolve(baseName + "." + ext.toUpperCase(Locale.ROOT));
            if (Files.isRegularFile(upper)) return Optional.of(upper);
        }
        return Optional.empty();
    }

    private String save(String folder, Path file) throws IOException {
        ImageProcessor.Image image = ImageProcessor.processSeed(Files.readAllBytes(file), file.getFileName().toString());
        return storage.save(folder, image.content(), image.extension());
    }

    private Set<String> readApplied() {
        String v = jdbc.sql("SELECT setting_value FROM system_settings WHERE setting_key = ?").param(SETTING)
            .query((rs, n) -> rs.getString(1)).list().stream().findFirst().orElse(null);
        Set<String> out = new LinkedHashSet<>();
        if (v != null) for (String s : v.split(",")) if (!s.isBlank()) out.add(s.trim());
        return out;
    }

    private void saveApplied(Set<String> applied) {
        String v = String.join(",", applied);
        int updated = jdbc.sql("UPDATE system_settings SET setting_value = ? WHERE setting_key = ?").params(v, SETTING).update();
        if (updated == 0) {
            jdbc.sql("INSERT INTO system_settings (setting_key, setting_value, value_type, description) VALUES (?, ?, 'string', ?)")
                .params(SETTING, v, "Chỉ môi trường dev: mã món / ảnh bìa đã gắn ảnh mẫu (không gắn lại)").update();
        }
    }
}
