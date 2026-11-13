/* =====================================================================
   V5 — Cho phép phục hồi bản sao lưu đi qua các trigger sổ kho

   Sổ kho (stock_transactions) là sổ cái: trigger chặn sửa / xóa phiếu và tự cộng tồn kho khi thêm phiếu.
   Khi PHỤC HỒI bản sao lưu (com.rms.backup.BackupService), dữ liệu được ghi lại nguyên trạng:
     - phải xóa phiếu hiện có rồi chép phiếu từ bản sao lưu → trigger chặn xóa sẽ làm hỏng phục hồi;
     - ingredients.stock_qty đã được chép đúng giá trị trong bản sao lưu → trigger cộng tồn lần nữa sẽ sai.
   Vì vậy các trigger bỏ qua khi biến phiên @rms_restore = 1. Biến này chỉ đặt trên kết nối riêng của thao tác
   phục hồi (cùng FOREIGN_KEY_CHECKS = 0) và được xóa ngay sau đó; mọi kết nối khác vẫn bị trigger kiểm soát như cũ.
   ===================================================================== */

DROP TRIGGER IF EXISTS trg_stock_before_insert;
DROP TRIGGER IF EXISTS trg_stock_after_insert;
DROP TRIGGER IF EXISTS trg_stock_no_update;
DROP TRIGGER IF EXISTS trg_stock_no_delete;

DELIMITER $$

CREATE TRIGGER trg_stock_before_insert
BEFORE INSERT ON stock_transactions
FOR EACH ROW
BEGIN
  DECLARE current_qty DECIMAL(12,3);
  IF @rms_restore IS NULL OR @rms_restore <> 1 THEN
    SELECT stock_qty INTO current_qty FROM ingredients WHERE id = NEW.ingredient_id FOR UPDATE;
    IF current_qty + NEW.quantity_change < 0 THEN
      SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Tồn kho không đủ: số lượng xuất/điều chỉnh vượt quá tồn hiện tại';
    END IF;
  END IF;
END$$

CREATE TRIGGER trg_stock_after_insert
AFTER INSERT ON stock_transactions
FOR EACH ROW
BEGIN
  IF @rms_restore IS NULL OR @rms_restore <> 1 THEN
    UPDATE ingredients
       SET stock_qty = stock_qty + NEW.quantity_change
     WHERE id = NEW.ingredient_id;
  END IF;
END$$

CREATE TRIGGER trg_stock_no_update
BEFORE UPDATE ON stock_transactions
FOR EACH ROW
BEGIN
  IF @rms_restore IS NULL OR @rms_restore <> 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Không sửa phiếu kho đã ghi. Hãy tạo phiếu điều chỉnh (adjust).';
  END IF;
END$$

CREATE TRIGGER trg_stock_no_delete
BEFORE DELETE ON stock_transactions
FOR EACH ROW
BEGIN
  IF @rms_restore IS NULL OR @rms_restore <> 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Không xóa phiếu kho đã ghi. Hãy tạo phiếu điều chỉnh (adjust).';
  END IF;
END$$

DELIMITER ;
