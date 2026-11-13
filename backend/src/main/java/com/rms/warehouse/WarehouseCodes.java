package com.rms.warehouse;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;

/**
 * Mã tự sinh của phân hệ kho (bảng doc_sequences, khóa dòng khi tăng nên không trùng khi thao tác đồng thời):
 *  - danh mục: NL027, NCC007 (tăng dần, không dùng lại số đã xóa);
 *  - chứng từ theo tháng: PM2611-001 (phiếu mua), PN… (nhập), PX… (xuất), KK… (kiểm kê), TT… (thanh toán).
 * Phải gọi trong giao dịch của thao tác tạo chứng từ để số không bị "nhảy" khi thao tác thất bại.
 */
@Component
public class WarehouseCodes {
    private static final DateTimeFormatter YYMM = DateTimeFormatter.ofPattern("yyMM");

    private final JdbcClient jdbc;

    public WarehouseCodes(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    private int next(String key) {
        jdbc.sql("INSERT INTO doc_sequences (seq_key, last_no) VALUES (?, 1) ON DUPLICATE KEY UPDATE last_no = last_no + 1")
            .param(key).update();
        return jdbc.sql("SELECT last_no FROM doc_sequences WHERE seq_key = ?").param(key).query(Integer.class).single();
    }

    /** "NL" → NL027; "NCC" → NCC007. */
    public String catalog(String prefix) {
        return prefix + "%03d".formatted(next(prefix));
    }

    /** ("PN", 2026-11-13) → PN2611-007. */
    public String document(String prefix, LocalDate date) {
        String key = prefix + date.format(YYMM);
        return key + "-%03d".formatted(next(key));
    }
}
