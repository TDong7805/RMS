package com.rms.warehouse;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.text.DecimalFormat;
import java.text.DecimalFormatSymbols;
import java.util.Locale;
import java.util.regex.Pattern;

/** Định dạng / kiểm tra số dùng chung của phân hệ kho (khớp features/warehouse ở frontend). */
public final class WarehouseFormat {
    /** Số lượng: không âm, tối đa 3 chữ số thập phân. */
    private static final int QTY_SCALE = 3;
    private static final Pattern DECIMAL3 = Pattern.compile("^\\d{1,9}(\\.\\d{1,3})?$");

    private WarehouseFormat() {}

    /** 4.5 → "4,5"; 1250 → "1.250" (kiểu Việt Nam). */
    public static String qty(BigDecimal v) {
        if (v == null) return "0";
        DecimalFormat f = new DecimalFormat("#,##0.###", DecimalFormatSymbols.getInstance(Locale.forLanguageTag("vi-VN")));
        return f.format(v);
    }

    /** 1250000 → "1.250.000 đ". */
    public static String money(BigDecimal v) {
        DecimalFormat f = new DecimalFormat("#,##0", DecimalFormatSymbols.getInstance(Locale.forLanguageTag("vi-VN")));
        return f.format(v == null ? BigDecimal.ZERO : v.setScale(0, RoundingMode.HALF_UP)) + " đ";
    }

    /** Số lượng hợp lệ (≥ 0, tối đa 3 chữ số lẻ). */
    public static boolean validQty(BigDecimal v) {
        return v != null && v.signum() >= 0 && v.stripTrailingZeros().scale() <= QTY_SCALE
            && DECIMAL3.matcher(v.stripTrailingZeros().toPlainString()).matches();
    }

    /** Tiền VND: số nguyên dương. */
    public static boolean validMoney(BigDecimal v) {
        return v != null && v.signum() > 0 && v.stripTrailingZeros().scale() <= 0;
    }

    public static BigDecimal scaleQty(BigDecimal v) {
        return v.setScale(QTY_SCALE, RoundingMode.HALF_UP);
    }

    /** Bỏ số 0 thừa để JSON gọn: 4.500 → 4.5. */
    public static BigDecimal plain(BigDecimal v) {
        return v == null ? null : v.stripTrailingZeros();
    }
}
