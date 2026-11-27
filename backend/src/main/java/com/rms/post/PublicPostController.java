package com.rms.post;

import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Tin tức & Ưu đãi trên website khách — công khai (/api/public/** permitAll). Chỉ bài ĐÃ XUẤT BẢN ở Quản lý bài viết:
 * GET /api/public/posts?category=&limit=   danh sách (mới nhất trước, không kèm nội dung); category: news | promotion | event
 * GET /api/public/posts/{slug}            một bài (kèm nội dung); nháp / đã ẩn / không có → 404
 */
@RestController
public class PublicPostController {
    private final PostService posts;

    public PublicPostController(PostService posts) {
        this.posts = posts;
    }

    @GetMapping("/api/public/posts")
    public List<PostService.PublicPost> list(@RequestParam(defaultValue = "") String category, @RequestParam(defaultValue = "12") int limit) {
        return posts.published(category, limit);
    }

    @GetMapping("/api/public/posts/{slug}")
    public PostService.PublicPost get(@PathVariable String slug) {
        return posts.publishedBySlug(slug);
    }
}
