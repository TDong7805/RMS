package com.rms.storage;

/**
 * Nơi lưu file tải lên (ảnh món ăn, ảnh bìa bài viết...).
 *
 * CSDL chỉ lưu KHÓA do {@link #save} trả về (vd. "dishes/3f2a9c....jpg"), không lưu đường dẫn đầy đủ.
 * Địa chỉ để trình duyệt tải ảnh lấy qua {@link #url}. Nhờ vậy đổi nơi lưu không phải sửa dữ liệu:
 *  - hiện tại: {@link LocalStorageService} — thư mục trên máy chủ, phục vụ tại /uploads/...
 *  - khi cần (nhiều máy chủ, CDN): viết thêm S3StorageService (Amazon S3, Cloudflare R2, MinIO...)
 *    cài interface này rồi chọn bằng cấu hình; chép thư mục uploads lên bucket với cùng khóa.
 */
public interface StorageService {

    /** Lưu nội dung, trả về khóa duy nhất trong thư mục {@code folder}. */
    String save(String folder, byte[] content, String extension);

    /** Xóa theo khóa; khóa không tồn tại thì bỏ qua. */
    void delete(String key);

    /** Khóa → địa chỉ xem file (đường dẫn tương đối hoặc URL CDN). null → null. */
    String url(String key);
}
