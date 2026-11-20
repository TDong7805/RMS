package com.rms.selfservice;

import com.rms.common.BusinessException;
import com.rms.storage.StorageService;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;

/** Ảnh khuôn mặt / chấm công đọc từ kho lưu trữ, trả qua API (không công khai). */
public record Photo(byte[] content, String extension) {

    static Photo of(StorageService storage, String key) {
        byte[] data = key == null ? null : storage.read(key);
        if (data == null) throw BusinessException.notFound("Không có ảnh (ảnh có thể đã tự xóa sau thời gian lưu)");
        int dot = key.lastIndexOf('.');
        return new Photo(data, dot < 0 ? "jpg" : key.substring(dot + 1));
    }

    public ResponseEntity<byte[]> response() {
        MediaType type = switch (extension) {
            case "png" -> MediaType.IMAGE_PNG;
            case "webp" -> MediaType.parseMediaType("image/webp");
            default -> MediaType.IMAGE_JPEG;
        };
        return ResponseEntity.ok().contentType(type).cacheControl(CacheControl.noStore()).body(content);
    }
}
