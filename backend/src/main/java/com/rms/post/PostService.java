package com.rms.post;

import com.rms.audit.AuditService;
import com.rms.common.BusinessException;
import com.rms.common.CurrentUserService;
import com.rms.common.Db;
import com.rms.common.Ids;
import com.rms.common.Paged;
import com.rms.common.Times;
import com.rms.common.ValidationException;
import com.rms.common.Vi;
import com.rms.storage.ImageStore;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * UC QLNH-01 Quản lý bài viết: xem danh sách, tìm kiếm, thêm, sửa, xóa, xuất bản / ẩn bài viết (tin tức, ưu đãi, sự kiện).
 *
 * Quy tắc:
 *  - Tiêu đề bắt buộc (≤ 150 ký tự), tóm tắt ≤ 300, nội dung 20–20.000 ký tự. Nội dung là văn bản thuần (giữ xuống dòng),
 *    giao diện không hiển thị HTML.
 *  - Đường dẫn (slug) tạo từ tiêu đề không dấu, duy nhất. Bài đã xuất bản ít nhất một lần thì KHÓA đường dẫn:
 *    sửa tiêu đề không đổi link đã chia sẻ.
 *  - Trạng thái draft / published / hidden; published_at giữ thời điểm xuất bản lần đầu.
 *  - Tác giả là người tạo bài (đang đăng nhập). Ảnh bìa qua ImageStore (thư mục "posts").
 *  - Xóa là xóa hẳn (bài viết không liên kết dữ liệu khác), xóa luôn ảnh bìa. Mọi thao tác ghi nhật ký (module "post").
 */
@Service
public class PostService {
    public static final int PAGE_SIZE = 8;
    static final int TITLE_MAX = 150;
    static final int SUMMARY_MAX = 300;
    static final int CONTENT_MIN = 20;
    static final int CONTENT_MAX = 20_000;
    static final String IMAGE_FOLDER = "posts";
    private static final Set<String> CATEGORIES = Set.of("news", "promotion", "event");
    private static final Set<String> STATUSES = Set.of("draft", "published", "hidden");

    public record Post(String id, String title, String slug, String summary, String content, String coverImage,
                       String category, String status, String author, String createdAt, String updatedAt,
                       String publishedAt) {}

    public record PostInput(String title, String summary, String content, String coverImage, String category, String status) {}

    /** Paged + số bài theo trạng thái (cho các tab), tính sau khi lọc từ khóa / chuyên mục. */
    public record PostPage(List<Post> items, int total, int page, int pageCount, Map<String, Integer> counts) {}

    private record Row(long id, String title, String slug, String summary, String content, String coverKey,
                       String category, String status, String author, LocalDateTime createdAt, LocalDateTime updatedAt,
                       LocalDateTime publishedAt) {}

    private static final String SELECT = """
        SELECT p.id, p.title, p.slug, p.summary, p.content, p.cover_image_url, p.category, p.status,
               COALESCE(u.full_name, 'Tài khoản đã xóa') AS author, p.created_at, p.updated_at, p.published_at
        FROM posts p LEFT JOIN users u ON u.id = p.author_id
        """;

    private final JdbcClient jdbc;
    private final AuditService audit;
    private final CurrentUserService currentUser;
    private final ImageStore images;

    public PostService(JdbcClient jdbc, AuditService audit, CurrentUserService currentUser, ImageStore images) {
        this.jdbc = jdbc;
        this.audit = audit;
        this.currentUser = currentUser;
        this.images = images;
    }

    private static Row map(ResultSet rs, int n) throws SQLException {
        return new Row(rs.getLong("id"), rs.getString("title"), rs.getString("slug"), Vi.trim(rs.getString("summary")),
            rs.getString("content"), rs.getString("cover_image_url"), rs.getString("category"), rs.getString("status"),
            rs.getString("author"), Db.dateTime(rs, "created_at"), Db.dateTime(rs, "updated_at"), Db.dateTime(rs, "published_at"));
    }

    private Post toPost(Row r) {
        return new Post(Ids.str(r.id()), r.title(), r.slug(), r.summary(), r.content(), images.url(r.coverKey()), r.category(),
            r.status(), r.author(), Times.iso(r.createdAt()), Times.iso(r.updatedAt()), Times.iso(r.publishedAt()));
    }

    /* ------------------------------------------------------------------ Đọc */

    public PostPage list(String keyword, String category, String status, int page) {
        String kw = Vi.trim(keyword);
        List<Row> base = jdbc.sql(SELECT).query(PostService::map).list().stream()
            .filter(r -> Vi.blank(category) || "all".equals(category) || r.category().equals(category))
            .filter(r -> kw.isEmpty() || Vi.matches(r.title(), kw) || Vi.matches(r.summary(), kw))
            .toList();
        Map<String, Integer> counts = new LinkedHashMap<>();
        counts.put("all", base.size());
        for (String s : List.of("draft", "published", "hidden"))
            counts.put(s, (int) base.stream().filter(r -> r.status().equals(s)).count());
        List<Row> items = base.stream()
            .filter(r -> Vi.blank(status) || "all".equals(status) || r.status().equals(status))
            .sorted(Comparator.comparing(Row::updatedAt).reversed().thenComparing(Row::id, Comparator.reverseOrder()))
            .toList();
        Paged<Post> paged = Paged.of(items, page, PAGE_SIZE).map(this::toPost);
        return new PostPage(paged.items(), paged.total(), paged.page(), paged.pageCount(), counts);
    }

    public Post get(String id) {
        return toPost(row(Ids.parse(id, notFound())));
    }

    private Row row(long id) {
        return jdbc.sql(SELECT + " WHERE p.id = ?").param(id).query(PostService::map).optional()
            .orElseThrow(() -> BusinessException.notFound(notFound()));
    }

    private static String notFound() {
        return "Bài viết không tồn tại hoặc đã bị xóa";
    }

    /* ------------------------------------------------------------------ Thêm / sửa */

    private record Clean(String title, String slug, String summary, String content, String category, String status) {}

    private Clean validate(PostInput in, Row current) {
        var v = new ValidationException.Collector();
        String title = Vi.collapse(in.title());
        if (title.isEmpty()) v.add("title", "Vui lòng nhập tiêu đề");
        else if (title.length() > TITLE_MAX) v.add("title", "Tiêu đề tối đa " + TITLE_MAX + " ký tự");
        String summary = Vi.trim(in.summary());
        if (summary.length() > SUMMARY_MAX) v.add("summary", "Tóm tắt tối đa " + SUMMARY_MAX + " ký tự");
        String content = Vi.trim(in.content());
        if (content.isEmpty()) v.add("content", "Vui lòng nhập nội dung bài viết");
        else if (content.length() < CONTENT_MIN) v.add("content", "Nội dung quá ngắn (tối thiểu " + CONTENT_MIN + " ký tự)");
        else if (content.length() > CONTENT_MAX) v.add("content", "Nội dung tối đa " + String.format("%,d", CONTENT_MAX).replace(',', '.') + " ký tự");
        String category = Vi.blank(in.category()) ? "news" : in.category();
        if (!CATEGORIES.contains(category)) v.add("category", "Chuyên mục không hợp lệ");
        String status = Vi.blank(in.status()) ? "draft" : in.status();
        if (!STATUSES.contains(status)) v.add("status", "Trạng thái không hợp lệ");

        // Đã xuất bản ít nhất một lần → giữ nguyên đường dẫn cũ.
        boolean slugLocked = current != null && current.publishedAt() != null;
        String slug = slugLocked ? current.slug() : Vi.slugify(title);
        if (!v.has("title") && !slugLocked) {
            if (slug.isEmpty()) v.add("title", "Tiêu đề cần có chữ hoặc số");
            else if (jdbc.sql("SELECT COUNT(*) FROM posts WHERE slug = ? AND id <> ?").params(slug, current == null ? 0 : current.id())
                .query(Long.class).single() > 0)
                v.add("title", "Đã có bài viết trùng tiêu đề, vui lòng đặt tiêu đề khác");
        }
        v.throwIfAny();
        return new Clean(title, slug, summary, content, category, status);
    }

    @Transactional
    public Post create(PostInput in) {
        Clean c = validate(in, null);
        String cover = images.apply(IMAGE_FOLDER, in.coverImage(), null, "coverImage");
        jdbc.sql("""
                INSERT INTO posts (title, slug, summary, content, cover_image_url, category, status, author_id, published_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """)
            .params(c.title(), c.slug(), c.summary().isEmpty() ? null : c.summary(), c.content(), cover, c.category(),
                c.status(), currentUser.get().id(), "published".equals(c.status()) ? Times.now() : null)
            .update();
        long id = jdbc.sql("SELECT LAST_INSERT_ID()").query(Long.class).single();
        audit.log("post", "published".equals(c.status()) ? "Xuất bản bài viết" : "Thêm bài viết", c.title(), "posts", id);
        return toPost(row(id));
    }

    @Transactional
    public Post update(String idText, PostInput in) {
        long id = Ids.parse(idText, notFound());
        Row current = row(id);
        Clean c = validate(in, current);
        String cover = images.apply(IMAGE_FOLDER, in.coverImage(), current.coverKey(), "coverImage");
        LocalDateTime publishedAt = current.publishedAt() == null && "published".equals(c.status()) ? Times.now() : current.publishedAt();
        jdbc.sql("""
                UPDATE posts SET title = ?, slug = ?, summary = ?, content = ?, cover_image_url = ?, category = ?, status = ?,
                                 published_at = ?
                WHERE id = ?
                """)
            .params(c.title(), c.slug(), c.summary().isEmpty() ? null : c.summary(), c.content(), cover, c.category(),
                c.status(), publishedAt, id)
            .update();
        String note = current.status().equals(c.status()) ? "" : " (" + statusLabel(current.status()) + " → " + statusLabel(c.status()) + ")";
        audit.log("post", "Cập nhật bài viết", c.title() + note, "posts", id);
        return toPost(row(id));
    }

    /* ------------------------------------------------------------------ Trạng thái / xóa */

    @Transactional
    public Post setStatus(String idText, String status) {
        long id = Ids.parse(idText, notFound());
        if (!STATUSES.contains(status == null ? "" : status)) throw new ValidationException("status", "Trạng thái không hợp lệ");
        Row current = row(id);
        if (current.status().equals(status)) return toPost(current);
        jdbc.sql("UPDATE posts SET status = ?, published_at = COALESCE(published_at, ?) WHERE id = ?")
            .params(status, "published".equals(status) ? Times.now() : null, id)
            .update();
        String action = switch (status) {
            case "published" -> "Xuất bản bài viết";
            case "hidden" -> "Ẩn bài viết";
            default -> "Chuyển về nháp";
        };
        audit.log("post", action, current.title() + " (" + statusLabel(status) + ")", "posts", id);
        return toPost(row(id));
    }

    @Transactional
    public void delete(String idText) {
        long id = Ids.parse(idText, notFound());
        Row current = row(id);
        jdbc.sql("DELETE FROM posts WHERE id = ?").param(id).update();
        images.deleteAfterCommit(current.coverKey());
        audit.log("post", "Xóa bài viết", current.title(), "posts", id);
    }

    static String statusLabel(String status) {
        return switch (status) {
            case "published" -> "Đã xuất bản";
            case "hidden" -> "Đã ẩn";
            default -> "Nháp";
        };
    }
}
