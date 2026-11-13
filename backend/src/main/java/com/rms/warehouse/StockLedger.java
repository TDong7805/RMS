package com.rms.warehouse;

import com.rms.common.CurrentUserService;
import com.rms.notification.NotificationService;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;
import java.util.Set;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;

/**
 * Ghi sổ kho (stock_transactions) — nơi duy nhất làm thay đổi tồn kho.
 *
 * Trigger CSDL tự cộng tồn và chặn tồn âm; lớp này thêm phần nghiệp vụ của đặc tả (mục 5 – Quy tắc chung):
 *  - Nhập (tồn đầu kỳ, nhập theo phiếu mua, nhập không phiếu): tính lại giá vốn bình quân gia quyền
 *      giá mới = (tồn × giá vốn + SL nhập × đơn giá nhập) / (tồn + SL nhập), làm tròn 2 chữ số;
 *    tồn ≤ 0 hoặc chưa có giá vốn thì giá vốn = đơn giá nhập.
 *  - Xuất, điều chỉnh kiểm kê, hủy phiếu nhập: không đổi giá vốn, ghi theo giá vốn hiện tại.
 *  - Sau mỗi lần ghi: kiểm tra mức tồn, gửi thông báo sắp hết / hết hàng nếu vừa chuyển mức (không gửi trùng).
 *
 * Lưu ý MySQL 1442: câu INSERT vào stock_transactions không được đọc bảng ingredients (trigger đang ghi bảng đó),
 * nên mọi giá trị đọc từ ingredients được lấy bằng câu riêng trước khi INSERT.
 */
@Component
public class StockLedger {
    public static final Set<String> RECEIPT_TYPES = Set.of("opening", "po_receipt", "direct_receipt");
    public static final List<String> ALL_TYPES = List.of("opening", "po_receipt", "direct_receipt", "receipt_cancel",
        "issue_kitchen", "issue_waste", "issue_other", "stocktake");

    private final JdbcClient jdbc;
    private final CurrentUserService currentUser;
    private final NotificationService notifications;

    public StockLedger(JdbcClient jdbc, CurrentUserService currentUser, NotificationService notifications) {
        this.jdbc = jdbc;
        this.currentUser = currentUser;
        this.notifications = notifications;
    }

    private record Snapshot(String name, String unit, BigDecimal qty, BigDecimal min, BigDecimal avgCost, boolean active,
                            String alert) {}

    private Snapshot snapshot(long ingredientId) {
        return jdbc.sql("SELECT name, unit, stock_qty, min_level, avg_cost, is_active, alert_level FROM ingredients WHERE id = ? FOR UPDATE")
            .param(ingredientId)
            .query((rs, i) -> new Snapshot(rs.getString("name"), rs.getString("unit"), rs.getBigDecimal("stock_qty"),
                rs.getBigDecimal("min_level"), rs.getBigDecimal("avg_cost"), rs.getBoolean("is_active"),
                rs.getString("alert_level")))
            .single();
    }

    /**
     * Ghi một dòng sổ kho. qtyChange dương = tăng tồn, âm = giảm (đơn vị kho, tối đa 3 chữ số lẻ).
     * unitCost chỉ dùng cho loại nhập (đơn giá đã quy về 1 đơn vị kho); loại khác ghi theo giá vốn hiện tại.
     */
    public void record(long ingredientId, String moveType, BigDecimal qtyChange, BigDecimal unitCost, String docCode,
                       String reason, Long purchaseOrderItemId, Long receiptId) {
        record(ingredientId, moveType, qtyChange, unitCost, docCode, reason, purchaseOrderItemId, receiptId, null, null);
    }

    /** Như trên, kèm phiếu xuất / phiếu kiểm kê của dòng sổ. */
    public void record(long ingredientId, String moveType, BigDecimal qtyChange, BigDecimal unitCost, String docCode,
                       String reason, Long purchaseOrderItemId, Long receiptId, Long issueId, Long stocktakeId) {
        Snapshot before = snapshot(ingredientId);
        boolean receipt = RECEIPT_TYPES.contains(moveType);
        BigDecimal cost = receipt ? unitCost.setScale(2, RoundingMode.HALF_UP) : before.avgCost();
        String txnType = receipt ? "import" : moveType.startsWith("issue_") ? "export" : "adjust";
        if ("receipt_cancel".equals(moveType)) txnType = "adjust";

        jdbc.sql("""
                INSERT INTO stock_transactions (ingredient_id, txn_type, move_type, doc_code, quantity_change, unit_cost,
                                                purchase_order_item_id, receipt_id, issue_id, stocktake_id, reason, created_by)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """)
            .params(ingredientId, txnType, moveType, docCode, qtyChange, cost, purchaseOrderItemId, receiptId, issueId,
                stocktakeId, reason, currentUser.get().id())
            .update();

        if (receipt && qtyChange.signum() > 0) {
            BigDecimal newCost;
            if (before.qty().signum() <= 0 || before.avgCost() == null) newCost = cost;
            else {
                newCost = before.qty().multiply(before.avgCost()).add(qtyChange.multiply(cost))
                    .divide(before.qty().add(qtyChange), 2, RoundingMode.HALF_UP);
            }
            jdbc.sql("UPDATE ingredients SET avg_cost = ? WHERE id = ?").params(newCost, ingredientId).update();
        }
        checkAlert(ingredientId);
    }

    /** Tồn và giá vốn hiện tại (khóa dòng) — để phiếu nhập lưu lại trạng thái trước khi nhập. */
    public BigDecimal[] qtyAndCost(long ingredientId) {
        Snapshot s = snapshot(ingredientId);
        return new BigDecimal[] {s.qty(), s.avgCost()};
    }

    /** Hủy phiếu nhập: trả giá vốn về đúng giá trị trước khi nhập (điều kiện hủy bảo đảm không có giao dịch xen giữa). */
    public void restoreAvgCost(long ingredientId, BigDecimal avgCost) {
        jdbc.sql("UPDATE ingredients SET avg_cost = ? WHERE id = ?").params(avgCost, ingredientId).update();
    }

    /**
     * So mức tồn hiện tại với mức đã cảnh báo (alert_level) và gửi thông báo khi vừa xuống "Sắp hết" / "Hết hàng"
     * (UC-KHO-27). Cảnh báo sắp hết chỉ gửi lại sau khi tồn đã lên trên mức tối thiểu rồi giảm xuống lại.
     * Gọi cả khi đổi tồn tối thiểu (UC-KHO-04) và khi sử dụng lại nguyên liệu.
     */
    public void checkAlert(long ingredientId) {
        Snapshot s = snapshot(ingredientId);
        String level = s.qty().signum() <= 0 ? "out" : s.qty().compareTo(s.min()) <= 0 ? "low" : "ok";
        if (level.equals(s.alert())) return;
        jdbc.sql("UPDATE ingredients SET alert_level = ? WHERE id = ?").params(level, ingredientId).update();
        if (!s.active()) return;
        String qty = WarehouseFormat.qty(s.qty()) + " " + s.unit();
        String min = WarehouseFormat.qty(s.min()) + " " + s.unit();
        if ("out".equals(level)) {
            notifications.sendToRoles("inventory", s.name() + " đã hết hàng",
                "Tồn kho về 0 " + s.unit() + " (tối thiểu " + min + "). Cần lập phiếu mua.", "ingredients", ingredientId,
                List.of("warehouse", "manager"));
        } else if ("low".equals(level) && "ok".equals(s.alert())) {
            notifications.sendToRoles("inventory", s.name() + " sắp hết",
                "Tồn " + qty + ", không quá mức tối thiểu " + min + ".", "ingredients", ingredientId,
                List.of("warehouse", "manager"));
        }
    }
}
