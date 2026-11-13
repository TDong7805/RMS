package com.rms.storage;

import com.rms.common.ValidationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

/**
 * Xử lý trường ảnh của form (món ăn, bài viết...) — gọi bên trong @Transactional của service nghiệp vụ.
 *
 * Giá trị trường ảnh frontend gửi lên:
 *  - null / ""                 → bỏ ảnh
 *  - địa chỉ ảnh hiện tại      → giữ nguyên (người dùng không đổi ảnh)
 *  - "data:image/...;base64,…" → ảnh mới: kiểm tra, chuẩn hóa ({@link ImageProcessor}), lưu
 *
 * File và CSDL luôn khớp nhau: lưu CSDL thất bại thì xóa file vừa ghi; lưu thành công mới xóa ảnh cũ.
 */
@Service
public class ImageStore {
    private final StorageService storage;

    public ImageStore(StorageService storage) {
        this.storage = storage;
    }

    /** Trả về khóa ảnh sẽ lưu vào CSDL (có thể null). */
    public String apply(String folder, String input, String currentKey, String field) {
        String newKey;
        if (input == null || input.isBlank()) {
            newKey = null;
        } else if (currentKey != null && input.equals(storage.url(currentKey))) {
            return currentKey;
        } else if (input.startsWith("data:")) {
            ImageProcessor.Image image = ImageProcessor.fromDataUrl(input, field);
            newKey = storage.save(folder, image.content(), image.extension());
            String saved = newKey;
            afterCompletion(false, () -> storage.delete(saved));
        } else {
            throw new ValidationException(field, "Ảnh không hợp lệ, vui lòng chọn lại");
        }
        if (currentKey != null && !currentKey.equals(newKey)) deleteAfterCommit(currentKey);
        return newKey;
    }

    /** Xóa file khi transaction hiện tại lưu thành công (vd. xóa món thì xóa luôn ảnh). */
    public void deleteAfterCommit(String key) {
        if (key == null) return;
        afterCompletion(true, () -> storage.delete(key));
    }

    public String url(String key) {
        return storage.url(key);
    }

    private static void afterCompletion(boolean onCommit, Runnable action) {
        if (!TransactionSynchronizationManager.isSynchronizationActive()) {
            if (onCommit) action.run();
            return;
        }
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCompletion(int status) {
                if ((status == STATUS_COMMITTED) == onCommit) action.run();
            }
        });
    }
}
