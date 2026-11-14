package com.rms.ordering;

import com.rms.audit.AuditService;
import com.rms.common.CurrentUserService;
import com.rms.common.ValidationException;
import com.rms.common.Vi;
import java.util.HashMap;
import java.util.Map;
import java.util.regex.Pattern;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Tài khoản nhận tiền của nhà hàng (Quản lý nhà hàng cấu hình ở Cấu hình hệ thống → Thanh toán).
 * Dùng để tạo mã QR chuyển khoản trên hóa đơn và trang đặt món của khách.
 */
@Service
public class PaymentSettingsService {
    private static final Pattern BIN = Pattern.compile("^\\d{6}$");
    private static final Pattern ACCOUNT = Pattern.compile("^[0-9A-Za-z]{4,19}$");

    public record BankAccount(String bankBin, String bankName, String accountNo, String accountName, boolean configured) {}

    /** Thông tin chuyển khoản kèm nội dung mã QR cho một khoản tiền cụ thể. */
    public record TransferQr(String bankName, String accountNo, String accountName, long amount, String content, String payload) {}

    private final JdbcClient jdbc;
    private final AuditService audit;
    private final CurrentUserService currentUser;

    public PaymentSettingsService(JdbcClient jdbc, AuditService audit, CurrentUserService currentUser) {
        this.jdbc = jdbc;
        this.audit = audit;
        this.currentUser = currentUser;
    }

    public BankAccount get() {
        Map<String, String> v = new HashMap<>();
        jdbc.sql("SELECT setting_key, setting_value FROM system_settings WHERE setting_key LIKE 'payment.%'")
            .query((rs, n) -> v.put(rs.getString(1), rs.getString(2))).list();
        String bin = Vi.trim(v.get("payment.bank_bin"));
        String acc = Vi.trim(v.get("payment.account_no"));
        return new BankAccount(bin, Vi.trim(v.get("payment.bank_name")), acc, Vi.trim(v.get("payment.account_name")),
            !bin.isEmpty() && !acc.isEmpty());
    }

    @Transactional
    public BankAccount update(BankAccount in) {
        String bin = Vi.trim(in.bankBin());
        String name = Vi.collapse(in.bankName());
        String acc = Vi.trim(in.accountNo()).replace(" ", "");
        String holder = VietQr.plain(in.accountName(), 50).toUpperCase();
        var v = new ValidationException.Collector();
        boolean clearing = bin.isEmpty() && acc.isEmpty();
        if (!clearing) {
            if (!BIN.matcher(bin).matches()) v.add("bankBin", "Vui lòng chọn ngân hàng");
            if (!ACCOUNT.matcher(acc).matches()) v.add("accountNo", "Số tài khoản gồm 4–19 chữ số / chữ cái");
            if (holder.isEmpty()) v.add("accountName", "Vui lòng nhập tên chủ tài khoản");
        }
        v.throwIfAny();
        long user = currentUser.get().id();
        save("payment.bank_bin", bin, user);
        save("payment.bank_name", name, user);
        save("payment.account_no", acc, user);
        save("payment.account_name", holder, user);
        audit.log("settings", "Cập nhật tài khoản nhận tiền", clearing ? "Xóa tài khoản nhận tiền" : name + " · " + mask(acc));
        return get();
    }

    private void save(String key, String value, long user) {
        jdbc.sql("""
                INSERT INTO system_settings (setting_key, setting_value, value_type, updated_by) VALUES (?, ?, 'string', ?)
                ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_by = VALUES(updated_by)
                """).params(key, value.isEmpty() ? null : value, user).update();
    }

    private static String mask(String acc) {
        return acc.length() <= 4 ? acc : "•••" + acc.substring(acc.length() - 4);
    }

    /** null nếu chưa cấu hình tài khoản nhận tiền. */
    public TransferQr qr(long amount, String content) {
        BankAccount b = get();
        if (!b.configured() || amount <= 0) return null;
        String note = VietQr.plain(content, 25);
        return new TransferQr(b.bankName(), b.accountNo(), b.accountName(), amount, note,
            VietQr.payload(b.bankBin(), b.accountNo(), amount, note));
    }
}
