package com.rms.common;

import java.util.List;

/** Khớp kiểu Paged&lt;T&gt; của frontend: {items, total, page, pageCount}. */
public record Paged<T>(List<T> items, int total, int page, int pageCount) {

    public static <T> Paged<T> of(List<T> all, int page, int pageSize) {
        int total = all.size();
        int pageCount = Math.max(1, (int) Math.ceil(total / (double) pageSize));
        int safePage = Math.min(Math.max(1, page), pageCount);
        int from = (safePage - 1) * pageSize;
        int to = Math.min(total, safePage * pageSize);
        return new Paged<>(from >= total ? List.of() : all.subList(from, to), total, safePage, pageCount);
    }

    /** Dùng khi lớp trả về cần thêm trường (ví dụ counts) — ánh xạ danh sách mà giữ nguyên phân trang. */
    public <R> Paged<R> map(java.util.function.Function<T, R> fn) {
        return new Paged<>(items.stream().map(fn).toList(), total, page, pageCount);
    }
}
