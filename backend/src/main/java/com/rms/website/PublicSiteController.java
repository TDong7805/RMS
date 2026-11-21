package com.rms.website;

import com.rms.website.PublicReservationService.ReservationInput;
import com.rms.website.PublicReservationService.ReservationResult;
import com.rms.website.PublicSiteService.GalleryPhoto;
import com.rms.website.PublicSiteService.PublicMenu;
import com.rms.website.PublicSiteService.Site;
import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * Website khách hàng — công khai, không đăng nhập (/api/public/** được permitAll trong SecurityConfig):
 * GET  /api/public/site                               thương hiệu, giới thiệu, liên hệ, giờ mở cửa, cấu hình form đặt bàn, khu vực
 * GET  /api/public/site/menu?keyword=&categoryId=      thực đơn hiện trên website (categoryId = "set": chỉ set menu)
 * GET  /api/public/site/gallery                        album ảnh đang hiện
 * POST /api/public/reservations                        {customerName, phone, email, guests, date, time, areaId, note} → 201
 *      422 lỗi theo trường · 409 trùng lịch / quá số lịch của một SĐT · 429 gửi quá nhiều lần
 */
@RestController
public class PublicSiteController {
    private final PublicSiteService site;
    private final PublicReservationService reservations;

    public PublicSiteController(PublicSiteService site, PublicReservationService reservations) {
        this.site = site;
        this.reservations = reservations;
    }

    @GetMapping("/api/public/site")
    public Site site() {
        return site.site();
    }

    @GetMapping("/api/public/site/menu")
    public PublicMenu menu(@RequestParam(defaultValue = "") String keyword, @RequestParam(defaultValue = "") String categoryId) {
        return site.menu(keyword, categoryId);
    }

    @GetMapping("/api/public/site/gallery")
    public List<GalleryPhoto> gallery() {
        return site.gallery();
    }

    @PostMapping("/api/public/reservations")
    @ResponseStatus(HttpStatus.CREATED)
    public ReservationResult reserve(@RequestBody ReservationInput in, HttpServletRequest request) {
        return reservations.create(in, request.getRemoteAddr());
    }
}
