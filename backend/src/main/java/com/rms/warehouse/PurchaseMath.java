package com.rms.warehouse;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;

/**
 * Cách tính tiền phiếu mua (UC-KHO-13) và "Phải trả theo hàng đã nhận" (Quy tắc chung của kho).
 *  - Thành tiền dòng = SL × Đơn giá, làm tròn đồng trước khi cộng; Tạm tính = tổng thành tiền.
 *  - Giảm giá = số tiền, hoặc Tạm tính × % (làm tròn đồng). Thuế = (Tạm tính − Giảm giá) × % thuế (làm tròn đồng).
 *  - Tổng cộng = Tạm tính − Giảm giá + Thuế + Chi phí khác.
 *  - Phải trả: Tạm tính nhận = Σ(SL đã nhận × Đơn giá); Giảm giá nhận = Giảm giá × Tạm tính nhận ÷ Tạm tính;
 *    Thuế nhận = (Tạm tính nhận − Giảm giá nhận) × % thuế; Chi phí khác tính đủ từ lần nhận đầu tiên.
 * Làm tròn kiểu HALF_UP (từ 0,5 trở lên làm tròn lên).
 */
public final class PurchaseMath {
    private PurchaseMath() {}

    public record Line(BigDecimal qty, BigDecimal price) {}

    public record Totals(BigDecimal subtotal, BigDecimal discount, BigDecimal tax, BigDecimal otherCost, BigDecimal total) {}

    static final BigDecimal HUNDRED = BigDecimal.valueOf(100);

    public static BigDecimal money(BigDecimal v) {
        return v.setScale(0, RoundingMode.HALF_UP);
    }

    public static BigDecimal lineAmount(BigDecimal qty, BigDecimal price) {
        if (qty == null || price == null) return BigDecimal.ZERO;
        return money(qty.multiply(price));
    }

    public static BigDecimal subtotal(List<Line> lines) {
        return lines.stream().map(l -> lineAmount(l.qty(), l.price())).reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    /** Giảm giá thành tiền: theo % nếu discountPercent khác null, ngược lại là số tiền đã nhập. */
    public static BigDecimal discountAmount(BigDecimal subtotal, BigDecimal discountPercent, BigDecimal discount) {
        if (discountPercent != null) return money(subtotal.multiply(discountPercent).divide(HUNDRED, 6, RoundingMode.HALF_UP));
        return discount == null ? BigDecimal.ZERO : money(discount);
    }

    public static Totals totals(List<Line> lines, BigDecimal discountPercent, BigDecimal discount, BigDecimal taxPercent,
                                BigDecimal otherCost) {
        BigDecimal sub = subtotal(lines);
        BigDecimal disc = discountAmount(sub, discountPercent, discount);
        BigDecimal tax = money(sub.subtract(disc).multiply(taxPercent).divide(HUNDRED, 6, RoundingMode.HALF_UP));
        BigDecimal other = otherCost == null ? BigDecimal.ZERO : money(otherCost);
        return new Totals(sub, disc, tax, other, sub.subtract(disc).add(tax).add(other));
    }

    /** Phải trả theo hàng đã nhận; received[i] là SL đã nhận của dòng i (cùng đơn vị mua với lines[i]). */
    public static BigDecimal payable(List<Line> lines, List<BigDecimal> received, BigDecimal discount, BigDecimal taxPercent,
                                     BigDecimal otherCost) {
        BigDecimal sub = subtotal(lines);
        BigDecimal subRecv = BigDecimal.ZERO;
        boolean any = false;
        for (int i = 0; i < lines.size(); i++) {
            BigDecimal r = received.get(i);
            if (r != null && r.signum() > 0) any = true;
            subRecv = subRecv.add(lineAmount(r, lines.get(i).price()));
        }
        if (!any) return BigDecimal.ZERO;
        BigDecimal discRecv = sub.signum() == 0 ? BigDecimal.ZERO
            : money(discount.multiply(subRecv).divide(sub, 6, RoundingMode.HALF_UP));
        BigDecimal taxRecv = money(subRecv.subtract(discRecv).multiply(taxPercent).divide(HUNDRED, 6, RoundingMode.HALF_UP));
        return subRecv.subtract(discRecv).add(taxRecv).add(money(otherCost));
    }

    /** Đơn giá nhập kho cho 1 đơn vị kho của một dòng phiếu mua (giảm giá phân bổ theo tỷ lệ, không gồm thuế, chi phí). */
    public static BigDecimal stockUnitCost(BigDecimal unitPrice, BigDecimal factor, BigDecimal discount, BigDecimal subtotal) {
        BigDecimal ratio = subtotal.signum() == 0 ? BigDecimal.ONE
            : BigDecimal.ONE.subtract(discount.divide(subtotal, 10, RoundingMode.HALF_UP));
        return unitPrice.divide(factor, 10, RoundingMode.HALF_UP).multiply(ratio).setScale(2, RoundingMode.HALF_UP);
    }
}
