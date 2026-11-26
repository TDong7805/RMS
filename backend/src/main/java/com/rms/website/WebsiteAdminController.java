package com.rms.website;

import com.rms.website.WebsiteContentService.Content;
import com.rms.website.WebsiteContentService.ContentInput;
import com.rms.website.WebsiteContentService.Feature;
import com.rms.website.WebsiteContentService.FeatureInput;
import com.rms.website.WebsiteContentService.MenuCategory;
import com.rms.website.WebsiteContentService.MoveInput;
import com.rms.website.WebsiteContentService.Photo;
import com.rms.website.WebsiteContentService.PhotoInput;
import com.rms.website.WebsiteContentService.VisibilityInput;
import java.util.List;
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
 * Cấu hình website khách hàng — chỉ Quản lý nhà hàng (thuộc khối /api/** của SecurityConfig):
 * GET    /api/website/content                     nội dung banner, giới thiệu, mạng xã hội
 * PUT    /api/website/content                     ảnh heroImage / aboutImage theo quy ước ImageStore
 * GET    /api/website/gallery                     album (kể cả ảnh đang ẩn)
 * POST   /api/website/gallery                     {image (data URL), caption, visible}
 * PUT    /api/website/gallery/{id}                {image, caption, visible}
 * PATCH  /api/website/gallery/{id}/move           {direction: "up" | "down"} → cả album theo thứ tự mới
 * DELETE /api/website/gallery/{id}
 * GET    /api/website/features?kind=              món đặc trưng (signature) / trải nghiệm (experience), kể cả mục ẩn
 * POST   /api/website/features                    {kind, title, subtitle, description, image, visible}
 * PUT    /api/website/features/{id}               {title, subtitle, description, image, visible}
 * PATCH  /api/website/features/{id}/move          {direction} → cả danh sách cùng loại theo thứ tự mới
 * DELETE /api/website/features/{id}
 * GET    /api/website/menu                        danh mục + món kèm cờ showOnWebsite
 * PATCH  /api/website/menu/categories/{id}        {visible}
 * PATCH  /api/website/menu/dishes/{id}            {visible}
 */
@RestController
@RequestMapping("/api/website")
public class WebsiteAdminController {
    private final WebsiteContentService service;

    public WebsiteAdminController(WebsiteContentService service) {
        this.service = service;
    }

    @GetMapping("/content")
    public Content content() {
        return service.content();
    }

    @PutMapping("/content")
    public Content updateContent(@RequestBody ContentInput in) {
        return service.updateContent(in);
    }

    @GetMapping("/gallery")
    public List<Photo> gallery() {
        return service.photos();
    }

    @PostMapping("/gallery")
    public Photo addPhoto(@RequestBody PhotoInput in) {
        return service.addPhoto(in);
    }

    @PutMapping("/gallery/{id}")
    public Photo updatePhoto(@PathVariable String id, @RequestBody PhotoInput in) {
        return service.updatePhoto(id, in);
    }

    @PatchMapping("/gallery/{id}/move")
    public List<Photo> movePhoto(@PathVariable String id, @RequestBody MoveInput in) {
        return service.movePhoto(id, in);
    }

    @DeleteMapping("/gallery/{id}")
    public ResponseEntity<Void> deletePhoto(@PathVariable String id) {
        service.deletePhoto(id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/features")
    public List<Feature> features(@RequestParam(defaultValue = "") String kind) {
        return service.features(kind);
    }

    @PostMapping("/features")
    public Feature addFeature(@RequestBody FeatureInput in) {
        return service.addFeature(in);
    }

    @PutMapping("/features/{id}")
    public Feature updateFeature(@PathVariable String id, @RequestBody FeatureInput in) {
        return service.updateFeature(id, in);
    }

    @PatchMapping("/features/{id}/move")
    public List<Feature> moveFeature(@PathVariable String id, @RequestBody MoveInput in) {
        return service.moveFeature(id, in);
    }

    @DeleteMapping("/features/{id}")
    public ResponseEntity<Void> deleteFeature(@PathVariable String id) {
        service.deleteFeature(id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/menu")
    public List<MenuCategory> menu() {
        return service.menu();
    }

    @PatchMapping("/menu/categories/{id}")
    public List<MenuCategory> setCategoryVisible(@PathVariable String id, @RequestBody VisibilityInput in) {
        return service.setCategoryVisible(id, in);
    }

    @PatchMapping("/menu/dishes/{id}")
    public List<MenuCategory> setDishVisible(@PathVariable String id, @RequestBody VisibilityInput in) {
        return service.setDishVisible(id, in);
    }
}
