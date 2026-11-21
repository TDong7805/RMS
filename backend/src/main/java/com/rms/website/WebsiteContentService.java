package com.rms.website;

import com.rms.audit.AuditService;
import com.rms.common.BusinessException;
import com.rms.common.CurrentUserService;
import com.rms.common.Db;
import com.rms.common.Ids;
import com.rms.common.Rules;
import com.rms.common.Times;
import com.rms.common.ValidationException;
import com.rms.common.Vi;
import com.rms.storage.ImageStore;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Pattern;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Cấu hình website khách hàng (Quản lý nhà hàng — Cấu hình hệ thống → tab "Website khách hàng"):
 *  - Nội dung (website_content, 1 dòng): slogan, danh hiệu, ảnh banner, "Về chúng tôi", mạng xã hội, bản đồ.
 *  - Album ảnh (gallery_photos): thêm, sửa chú thích / ẩn hiện, đổi thứ tự, xóa (xóa luôn file ảnh sau khi lưu).
 *  - Thực đơn trên website: bật / tắt show_on_website của danh mục và món (không ảnh hưởng trang gọi món QR).
 * Tên, logo, liên hệ, giờ mở cửa vẫn sửa ở tab "Thông tin nhà hàng" (SettingsService) — website đọc chung dữ liệu đó.
 */
@Service
public class WebsiteContentService {
    static final int MAX_PHOTOS = 60;
    static final int MAX_ABOUT = 5000;
    static final int MAX_HIGHLIGHTS = 6;
    private static final Pattern URL = Pattern.compile("^https?://\\S+\\.\\S+$");
    private static final String PHOTO_NOT_FOUND = "Ảnh không còn trong album";

    /** aboutHighlights: mỗi dòng một điểm nhấn. Ảnh trả về địa chỉ /uploads/... (null = chưa có). */
    public record Content(String slogan, String award, String heroImage, String aboutTitle, String aboutContent,
                          String aboutHighlights, String aboutImage, String facebookUrl, String instagramUrl,
                          String tiktokUrl, String youtubeUrl, String zaloPhone, String mapUrl, String updatedAt) {}

    /** Ảnh: data URL khi chọn ảnh mới, địa chỉ ảnh hiện tại để giữ nguyên, rỗng / null để bỏ ảnh. */
    public record ContentInput(String slogan, String award, String heroImage, String aboutTitle, String aboutContent,
                               String aboutHighlights, String aboutImage, String facebookUrl, String instagramUrl,
                               String tiktokUrl, String youtubeUrl, String zaloPhone, String mapUrl) {}

    public record Photo(String id, String image, String caption, boolean visible, int sortOrder, String createdAt) {}

    /** image bắt buộc khi thêm; khi sửa gửi lại địa chỉ ảnh cũ để giữ nguyên. */
    public record PhotoInput(String image, String caption, Boolean visible) {}

    public record MoveInput(String direction) {}

    public record MenuDish(String id, String code, String name, long price, String status, boolean showOnWebsite,
                           String image) {}

    public record MenuCategory(String id, String name, boolean active, boolean showOnWebsite, List<MenuDish> dishes) {}

    public record VisibilityInput(Boolean visible) {}

    private final JdbcClient jdbc;
    private final AuditService audit;
    private final CurrentUserService currentUser;
    private final ImageStore images;

    public WebsiteContentService(JdbcClient jdbc, AuditService audit, CurrentUserService currentUser, ImageStore images) {
        this.jdbc = jdbc;
        this.audit = audit;
        this.currentUser = currentUser;
        this.images = images;
    }

    /* ------------------------------------------------------------ Nội dung */

    /** Dòng website_content (ảnh là khóa lưu trữ) — PublicSiteService dùng chung. */
    record Row(String slogan, String award, String heroKey, String aboutTitle, String aboutContent,
                       String highlights, String aboutKey, String facebook, String instagram, String tiktok,
                       String youtube, String zalo, String map, java.time.LocalDateTime updatedAt) {}

    Row row() {
        return jdbc.sql("SELECT * FROM website_content WHERE id = 1")
            .query((rs, n) -> new Row(Vi.trim(rs.getString("slogan")), Vi.trim(rs.getString("award")),
                rs.getString("hero_image_url"), Vi.trim(rs.getString("about_title")), Vi.trim(rs.getString("about_content")),
                Vi.trim(rs.getString("about_highlights")), rs.getString("about_image_url"), Vi.trim(rs.getString("facebook_url")),
                Vi.trim(rs.getString("instagram_url")), Vi.trim(rs.getString("tiktok_url")), Vi.trim(rs.getString("youtube_url")),
                Vi.trim(rs.getString("zalo_phone")), Vi.trim(rs.getString("map_url")), Db.dateTime(rs, "updated_at")))
            .optional()
            .orElseThrow(() -> BusinessException.notFound("Chưa có cấu hình website (thiếu dữ liệu V24)"));
    }

    public Content content() {
        Row r = row();
        return new Content(r.slogan(), r.award(), images.url(r.heroKey()), r.aboutTitle(), r.aboutContent(), r.highlights(),
            images.url(r.aboutKey()), r.facebook(), r.instagram(), r.tiktok(), r.youtube(), r.zalo(), r.map(),
            Times.iso(r.updatedAt()));
    }

    @Transactional
    public Content updateContent(ContentInput in) {
        var e = new ValidationException.Collector();
        String slogan = Vi.collapse(in.slogan());
        String award = Vi.collapse(in.award());
        String aboutTitle = Vi.collapse(in.aboutTitle());
        String aboutContent = normalizeParagraphs(in.aboutContent());
        List<String> highlights = lines(in.aboutHighlights());
        if (slogan.length() > 200) e.add("slogan", "Slogan tối đa 200 ký tự");
        if (award.length() > 100) e.add("award", "Danh hiệu tối đa 100 ký tự");
        if (aboutTitle.length() > 150) e.add("aboutTitle", "Tiêu đề tối đa 150 ký tự");
        if (aboutContent.length() > MAX_ABOUT) e.add("aboutContent", "Nội dung giới thiệu tối đa " + MAX_ABOUT + " ký tự");
        if (highlights.size() > MAX_HIGHLIGHTS) e.add("aboutHighlights", "Tối đa " + MAX_HIGHLIGHTS + " điểm nhấn (mỗi dòng một điểm)");
        else if (highlights.stream().anyMatch(h -> h.length() > 120)) e.add("aboutHighlights", "Mỗi điểm nhấn tối đa 120 ký tự");
        Map<String, String> links = new LinkedHashMap<>();
        links.put("facebookUrl", Vi.trim(in.facebookUrl()));
        links.put("instagramUrl", Vi.trim(in.instagramUrl()));
        links.put("tiktokUrl", Vi.trim(in.tiktokUrl()));
        links.put("youtubeUrl", Vi.trim(in.youtubeUrl()));
        links.forEach((field, value) -> {
            if (value.isEmpty()) return;
            if (!URL.matcher(value).matches()) e.add(field, "Đường dẫn phải bắt đầu bằng http:// hoặc https://");
            else if (value.length() > 200) e.add(field, "Đường dẫn tối đa 200 ký tự");
        });
        String map = Vi.trim(in.mapUrl());
        if (!map.isEmpty() && !URL.matcher(map).matches()) e.add("mapUrl", "Đường dẫn bản đồ phải bắt đầu bằng http:// hoặc https://");
        else if (map.length() > 500) e.add("mapUrl", "Đường dẫn bản đồ tối đa 500 ký tự");
        String zalo = Vi.trim(in.zaloPhone()).replaceAll("[\\s.]", "");
        if (!zalo.isEmpty() && !Rules.PHONE.matcher(zalo).matches()) e.add("zaloPhone", "Số Zalo không đúng định dạng (VD: 0912345678)");
        e.throwIfAny();

        Row current = row();
        String hero = images.apply("website", in.heroImage(), current.heroKey(), "heroImage");
        String aboutImage = images.apply("website", in.aboutImage(), current.aboutKey(), "aboutImage");
        jdbc.sql("""
                UPDATE website_content
                SET slogan = ?, award = ?, hero_image_url = ?, about_title = ?, about_content = ?, about_highlights = ?,
                    about_image_url = ?, facebook_url = ?, instagram_url = ?, tiktok_url = ?, youtube_url = ?, zalo_phone = ?,
                    map_url = ?, updated_by = ?
                WHERE id = 1
                """)
            .params(nullIfEmpty(slogan), nullIfEmpty(award), hero, nullIfEmpty(aboutTitle), nullIfEmpty(aboutContent),
                highlights.isEmpty() ? null : String.join("\n", highlights), aboutImage, nullIfEmpty(links.get("facebookUrl")),
                nullIfEmpty(links.get("instagramUrl")), nullIfEmpty(links.get("tiktokUrl")), nullIfEmpty(links.get("youtubeUrl")),
                nullIfEmpty(zalo), nullIfEmpty(map), currentUser.get().id())
            .update();
        audit.log("settings", "Cập nhật website khách hàng", "Cập nhật nội dung website: banner, giới thiệu, mạng xã hội");
        return content();
    }

    /* ------------------------------------------------------------ Album ảnh */

    public List<Photo> photos() {
        return jdbc.sql("SELECT * FROM gallery_photos ORDER BY sort_order, id")
            .query((rs, n) -> new Photo(Ids.str(rs.getLong("id")), images.url(rs.getString("image_url")),
                Vi.trim(rs.getString("caption")), rs.getBoolean("is_visible"), rs.getInt("sort_order"),
                Times.iso(Db.dateTime(rs, "created_at"))))
            .list();
    }

    private Photo photo(long id) {
        return photos().stream().filter(p -> p.id().equals(Ids.str(id))).findFirst()
            .orElseThrow(() -> BusinessException.notFound(PHOTO_NOT_FOUND));
    }

    private String photoKey(long id) {
        return jdbc.sql("SELECT image_url FROM gallery_photos WHERE id = ? FOR UPDATE").param(id).query(String.class).optional()
            .orElseThrow(() -> BusinessException.notFound(PHOTO_NOT_FOUND));
    }

    private static String caption(PhotoInput in) {
        String caption = Vi.collapse(in.caption());
        if (caption.length() > 150) throw new ValidationException("caption", "Chú thích tối đa 150 ký tự");
        return caption;
    }

    @Transactional
    public Photo addPhoto(PhotoInput in) {
        String caption = caption(in);
        if (Vi.blank(in.image())) throw new ValidationException("image", "Vui lòng chọn ảnh");
        int count = jdbc.sql("SELECT COUNT(*) FROM gallery_photos").query(Integer.class).single();
        if (count >= MAX_PHOTOS) throw new BusinessException("Album tối đa " + MAX_PHOTOS + " ảnh. Hãy xóa bớt ảnh cũ trước khi thêm.");
        String key = images.apply("gallery", in.image(), null, "image");
        int next = jdbc.sql("SELECT COALESCE(MAX(sort_order), 0) + 1 FROM gallery_photos").query(Integer.class).single();
        jdbc.sql("INSERT INTO gallery_photos (image_url, caption, sort_order, is_visible, created_by) VALUES (?, ?, ?, ?, ?)")
            .params(key, nullIfEmpty(caption), next, in.visible() == null || in.visible(), currentUser.get().id())
            .update();
        long id = jdbc.sql("SELECT LAST_INSERT_ID()").query(Long.class).single();
        audit.log("settings", "Thêm ảnh album", caption.isEmpty() ? "Thêm ảnh vào album website" : "Thêm ảnh \"" + caption + "\"",
            "gallery_photos", id);
        return photo(id);
    }

    @Transactional
    public Photo updatePhoto(String idText, PhotoInput in) {
        long id = Ids.parse(idText, PHOTO_NOT_FOUND);
        String current = photoKey(id);
        String caption = caption(in);
        if (Vi.blank(in.image())) throw new ValidationException("image", "Vui lòng chọn ảnh");
        String key = images.apply("gallery", in.image(), current, "image");
        jdbc.sql("UPDATE gallery_photos SET image_url = ?, caption = ?, is_visible = ? WHERE id = ?")
            .params(key, nullIfEmpty(caption), in.visible() == null || in.visible(), id).update();
        audit.log("settings", "Sửa ảnh album", (in.visible() == null || in.visible() ? "Hiện" : "Ẩn") + " ảnh"
            + (caption.isEmpty() ? "" : " \"" + caption + "\""), "gallery_photos", id);
        return photo(id);
    }

    /** Đổi chỗ với ảnh liền trước / liền sau; đánh số lại 1..n để thứ tự luôn liền mạch. */
    @Transactional
    public List<Photo> movePhoto(String idText, MoveInput in) {
        long id = Ids.parse(idText, PHOTO_NOT_FOUND);
        photoKey(id);
        String direction = Vi.trim(in.direction());
        if (!"up".equals(direction) && !"down".equals(direction)) throw new ValidationException("direction", "Hướng di chuyển không hợp lệ");
        List<Long> ids = new ArrayList<>(jdbc.sql("SELECT id FROM gallery_photos ORDER BY sort_order, id FOR UPDATE").query(Long.class).list());
        int i = ids.indexOf(id);
        int j = "up".equals(direction) ? i - 1 : i + 1;
        if (j >= 0 && j < ids.size()) {
            ids.set(i, ids.get(j));
            ids.set(j, id);
        }
        for (int k = 0; k < ids.size(); k++) {
            jdbc.sql("UPDATE gallery_photos SET sort_order = ? WHERE id = ?").params(k + 1, ids.get(k)).update();
        }
        return photos();
    }

    @Transactional
    public void deletePhoto(String idText) {
        long id = Ids.parse(idText, PHOTO_NOT_FOUND);
        String key = photoKey(id);
        Photo p = photo(id);
        jdbc.sql("DELETE FROM gallery_photos WHERE id = ?").param(id).update();
        images.deleteAfterCommit(key);
        audit.log("settings", "Xóa ảnh album", p.caption().isEmpty() ? "Xóa một ảnh khỏi album website" : "Xóa ảnh \"" + p.caption() + "\"",
            "gallery_photos", id);
    }

    /* ------------------------------------------------------------ Thực đơn trên website */

    /** Mọi danh mục (kể cả đang tắt) và món kèm cờ hiện trên website — website chỉ hiện món đang bán của danh mục đang bật. */
    public List<MenuCategory> menu() {
        Map<Long, List<MenuDish>> dishes = new LinkedHashMap<>();
        jdbc.sql("SELECT id, code, name, category_id, price, status, show_on_website, image_url FROM dishes ORDER BY name")
            .query((rs, n) -> dishes.computeIfAbsent(rs.getLong("category_id"), k -> new ArrayList<>())
                .add(new MenuDish(Ids.str(rs.getLong("id")), rs.getString("code"), rs.getString("name"),
                    rs.getBigDecimal("price").longValue(), rs.getString("status"), rs.getBoolean("show_on_website"),
                    images.url(rs.getString("image_url")))))
            .list();
        return jdbc.sql("SELECT id, name, is_active, show_on_website FROM dish_categories ORDER BY sort_order, id")
            .query((rs, n) -> new MenuCategory(Ids.str(rs.getLong("id")), rs.getString("name"), rs.getBoolean("is_active"),
                rs.getBoolean("show_on_website"), dishes.getOrDefault(rs.getLong("id"), List.of())))
            .list();
    }

    @Transactional
    public List<MenuCategory> setCategoryVisible(String idText, VisibilityInput in) {
        long id = Ids.parse(idText, "Danh mục không còn tồn tại");
        boolean visible = requireVisible(in);
        String name = jdbc.sql("SELECT name FROM dish_categories WHERE id = ?").param(id).query(String.class).optional()
            .orElseThrow(() -> BusinessException.notFound("Danh mục không còn tồn tại"));
        jdbc.sql("UPDATE dish_categories SET show_on_website = ? WHERE id = ?").params(visible, id).update();
        audit.log("settings", "Thực đơn trên website", (visible ? "Hiện" : "Ẩn") + " danh mục \"" + name + "\" trên website",
            "dish_categories", id);
        return menu();
    }

    @Transactional
    public List<MenuCategory> setDishVisible(String idText, VisibilityInput in) {
        long id = Ids.parse(idText, "Món không còn tồn tại");
        boolean visible = requireVisible(in);
        String name = jdbc.sql("SELECT name FROM dishes WHERE id = ?").param(id).query(String.class).optional()
            .orElseThrow(() -> BusinessException.notFound("Món không còn tồn tại"));
        jdbc.sql("UPDATE dishes SET show_on_website = ? WHERE id = ?").params(visible, id).update();
        audit.log("settings", "Thực đơn trên website", (visible ? "Hiện" : "Ẩn") + " món \"" + name + "\" trên website", "dishes", id);
        return menu();
    }

    /* ------------------------------------------------------------ Tiện ích */

    private static boolean requireVisible(VisibilityInput in) {
        if (in == null || in.visible() == null) throw new ValidationException("visible", "Thiếu trạng thái hiển thị");
        return in.visible();
    }

    /** Tách dòng, bỏ dòng trống, gộp khoảng trắng trong từng dòng. */
    static List<String> lines(String text) {
        if (text == null) return List.of();
        return Arrays.stream(text.split("\\r?\\n")).map(Vi::collapse).filter(s -> !s.isEmpty()).toList();
    }

    /** Giữ xuống dòng giữa các đoạn, bỏ dòng trống thừa. */
    private static String normalizeParagraphs(String text) {
        return String.join("\n", lines(text));
    }

    private static String nullIfEmpty(String s) {
        return s == null || s.isEmpty() ? null : s;
    }
}
