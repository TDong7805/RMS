package com.rms.post;

import com.rms.post.PostService.Post;
import com.rms.post.PostService.PostInput;
import com.rms.post.PostService.PostPage;
import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * GET    /api/posts?keyword=&category=&status=&page=   danh sách (8 bài/trang) + counts theo trạng thái
 * GET    /api/posts/{id}
 * POST   /api/posts                 {"title", "summary", "content", "coverImage", "category", "status"}
 *                                   coverImage: null | data URL ảnh mới | địa chỉ ảnh hiện tại (giữ nguyên)
 * PUT    /api/posts/{id}
 * PATCH  /api/posts/{id}/status      {"status": "draft" | "published" | "hidden"}
 * DELETE /api/posts/{id}
 *
 * Trang tin tức cho khách (chỉ bài đã xuất bản, tra theo slug) thuộc phân hệ Khách hàng — thêm API công khai sau.
 */
@RestController
@RequestMapping("/api/posts")
public class PostController {
    private final PostService service;

    public PostController(PostService service) {
        this.service = service;
    }

    @GetMapping
    public PostPage list(
        @RequestParam(defaultValue = "") String keyword,
        @RequestParam(defaultValue = "all") String category,
        @RequestParam(defaultValue = "all") String status,
        @RequestParam(defaultValue = "1") int page) {
        return service.list(keyword, category, status, page);
    }

    @GetMapping("/{id}")
    public Post get(@PathVariable String id) {
        return service.get(id);
    }

    @PostMapping
    public Post create(@RequestBody PostInput in) {
        return service.create(in);
    }

    @PutMapping("/{id}")
    public Post update(@PathVariable String id, @RequestBody PostInput in) {
        return service.update(id, in);
    }

    @PatchMapping("/{id}/status")
    public Post status(@PathVariable String id, @RequestBody Map<String, String> body) {
        return service.setStatus(id, body.get("status"));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable String id) {
        service.delete(id);
        return ResponseEntity.noContent().build();
    }
}
