package com.rms.table;

import com.rms.audit.AuditService;
import com.rms.common.BusinessException;
import com.rms.common.Ids;
import com.rms.common.ValidationException;
import com.rms.common.Vi;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Pattern;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** UC Quản lý khu vực bàn: khu vực, bàn và sơ đồ bàn (lưới FLOOR_COLS × FLOOR_ROWS). */
@Service
public class TableService {
    public static final int FLOOR_COLS = 8;
    public static final int FLOOR_ROWS = 5;
    private static final Pattern CODE = Pattern.compile("^[A-Z0-9-]{2,10}$");
    private static final Set<String> SHAPES = Set.of("square", "round", "rect");
    private static final Set<String> STATUSES = Set.of("available", "reserved", "occupied", "inactive");

    public record Area(String id, String name, String description, boolean active) {}

    public record AreaInput(String name, String description, Boolean active) {}

    public record DiningTable(String id, String code, String areaId, int seats, String shape, int x, int y, String status) {}

    public record TableInput(String code, String areaId, Integer seats, String shape, String status) {}

    public record Position(Integer x, Integer y) {}

    private final JdbcClient jdbc;
    private final AuditService audit;

    public TableService(JdbcClient jdbc, AuditService audit) {
        this.jdbc = jdbc;
        this.audit = audit;
    }

    /* ------------------------------------------------------------ Khu vực */

    public List<Area> areas() {
        return jdbc.sql("SELECT id, name, description, is_active FROM areas ORDER BY sort_order, id")
            .query((rs, n) -> new Area(Ids.str(rs.getLong("id")), rs.getString("name"),
                rs.getString("description") == null ? "" : rs.getString("description"), rs.getBoolean("is_active")))
            .list();
    }

    public Optional<Area> findArea(long id) {
        return areas().stream().filter(a -> a.id().equals(Long.toString(id))).findFirst();
    }

    private String validateArea(AreaInput in, Long editingId) {
        var errors = new ValidationException.Collector();
        String name = Vi.collapse(in.name());
        String desc = Vi.trim(in.description());
        if (name.isEmpty()) errors.add("name", "Vui lòng nhập tên khu vực");
        else if (name.length() > 50) errors.add("name", "Tên khu vực tối đa 50 ký tự");
        else if (jdbc.sql("SELECT COUNT(*) FROM areas WHERE name = ? AND id <> ?")
            .params(name, editingId == null ? 0 : editingId).query(Long.class).single() > 0)
            errors.add("name", "Tên khu vực đã tồn tại");
        if (desc.length() > 200) errors.add("description", "Mô tả tối đa 200 ký tự");
        errors.throwIfAny();
        return name;
    }

    @Transactional
    public Area createArea(AreaInput in) {
        String name = validateArea(in, null);
        int sort = jdbc.sql("SELECT COALESCE(MAX(sort_order), 0) + 1 FROM areas").query(Integer.class).single();
        var key = new org.springframework.jdbc.support.GeneratedKeyHolder();
        jdbc.sql("INSERT INTO areas (name, description, is_active, sort_order) VALUES (?, ?, ?, ?)")
            .params(name, Vi.trim(in.description()), in.active() == null || in.active(), sort)
            .update(key);
        long id = key.getKey().longValue();
        audit.log("table", "Thêm khu vực", "Thêm khu vực " + name, "areas", id);
        return findArea(id).orElseThrow();
    }

    @Transactional
    public Area updateArea(String idStr, AreaInput in) {
        long id = Ids.parse(idStr, "Khu vực không tồn tại");
        if (findArea(id).isEmpty()) throw BusinessException.notFound("Khu vực không tồn tại");
        String name = validateArea(in, id);
        jdbc.sql("UPDATE areas SET name = ?, description = ?, is_active = ? WHERE id = ?")
            .params(name, Vi.trim(in.description()), in.active() == null || in.active(), id).update();
        audit.log("table", "Cập nhật khu vực", "Cập nhật khu vực " + name, "areas", id);
        return findArea(id).orElseThrow();
    }

    @Transactional
    public void deleteArea(String idStr) {
        long id = Ids.parse(idStr, "Khu vực không tồn tại");
        Area area = findArea(id).orElseThrow(() -> BusinessException.notFound("Khu vực không tồn tại"));
        if (count("SELECT COUNT(*) FROM dining_tables WHERE area_id = ?", id) > 0)
            throw new BusinessException("Khu vực vẫn còn bàn. Hãy chuyển hoặc xóa các bàn trước khi xóa khu vực.");
        if (count("SELECT COUNT(*) FROM reservations WHERE area_id = ?", id) > 0)
            throw new BusinessException("Khu vực đã có lịch sử đặt bàn nên không thể xóa. Hãy tắt \"Đang phục vụ\" để tạm ngưng khu vực.");
        jdbc.sql("DELETE FROM areas WHERE id = ?").param(id).update();
        audit.log("table", "Xóa khu vực", "Xóa khu vực " + area.name(), "areas", id);
    }

    /* ------------------------------------------------------------ Bàn */

    public List<DiningTable> tables() {
        return jdbc.sql("SELECT id, code, area_id, seats, shape, pos_x, pos_y, status FROM dining_tables ORDER BY code")
            .query((rs, n) -> new DiningTable(Ids.str(rs.getLong("id")), rs.getString("code"), Ids.str(rs.getLong("area_id")),
                rs.getInt("seats"), rs.getString("shape"), rs.getInt("pos_x"), rs.getInt("pos_y"), rs.getString("status")))
            .list();
    }

    public Optional<DiningTable> findTable(long id) {
        return tables().stream().filter(t -> t.id().equals(Long.toString(id))).findFirst();
    }

    /** Bàn có lịch đặt còn hiệu lực trong tương lai → không được xóa / chuyển khu vực / ngưng sử dụng. */
    public boolean hasUpcomingReservation(long tableId) {
        return count("""
            SELECT COUNT(*) FROM reservations
            WHERE table_id = ? AND status IN ('pending','confirmed','seated') AND reserved_at >= NOW()
            """, tableId) > 0;
    }

    private record ValidTable(String code, long areaId, int seats, String shape, String status) {}

    private ValidTable validateTable(TableInput in, Long editingId) {
        var errors = new ValidationException.Collector();
        String code = Vi.trim(in.code()).toUpperCase();
        Long areaId = Ids.parseOrNull(in.areaId());
        if (code.isEmpty()) errors.add("code", "Vui lòng nhập mã bàn");
        else if (!CODE.matcher(code).matches()) errors.add("code", "2–10 ký tự: chữ, số hoặc dấu gạch");
        else if (jdbc.sql("SELECT COUNT(*) FROM dining_tables WHERE code = ? AND id <> ?")
            .params(code, editingId == null ? 0 : editingId).query(Long.class).single() > 0)
            errors.add("code", "Mã bàn đã tồn tại");
        if (areaId == null || findArea(areaId).isEmpty()) errors.add("areaId", "Vui lòng chọn khu vực");
        if (in.seats() == null || in.seats() < 1 || in.seats() > 20) errors.add("seats", "Số ghế là số nguyên từ 1 đến 20");
        String shape = in.shape() == null ? "square" : in.shape();
        String status = in.status() == null ? "available" : in.status();
        if (!SHAPES.contains(shape)) errors.add("shape", "Hình dạng không hợp lệ");
        if (!STATUSES.contains(status)) errors.add("status", "Trạng thái không hợp lệ");
        errors.throwIfAny();
        return new ValidTable(code, areaId, in.seats(), shape, status);
    }

    private int[] firstFreeCell(long areaId, Long ignoreId) {
        var used = jdbc.sql("SELECT pos_x, pos_y FROM dining_tables WHERE area_id = ? AND id <> ?")
            .params(areaId, ignoreId == null ? 0 : ignoreId)
            .query((rs, n) -> rs.getInt("pos_y") * FLOOR_COLS + rs.getInt("pos_x"))
            .set();
        for (int i = 0; i < FLOOR_COLS * FLOOR_ROWS; i++) {
            if (!used.contains(i)) return new int[] {i % FLOOR_COLS, i / FLOOR_COLS};
        }
        return null;
    }

    @Transactional
    public DiningTable createTable(TableInput in) {
        ValidTable t = validateTable(in, null);
        int[] cell = firstFreeCell(t.areaId(), null);
        if (cell == null) throw new BusinessException("Sơ đồ khu vực này đã kín chỗ, không thể thêm bàn");
        var key = new org.springframework.jdbc.support.GeneratedKeyHolder();
        jdbc.sql("""
                INSERT INTO dining_tables (code, area_id, seats, shape, pos_x, pos_y, status, qr_token)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """)
            .params(t.code(), t.areaId(), t.seats(), t.shape(), cell[0], cell[1], t.status(),
                UUID.randomUUID().toString().replace("-", ""))
            .update(key);
        long id = key.getKey().longValue();
        audit.log("table", "Thêm bàn", "Thêm bàn " + t.code() + " (" + t.seats() + " ghế)", "dining_tables", id);
        return findTable(id).orElseThrow();
    }

    @Transactional
    public DiningTable updateTable(String idStr, TableInput in) {
        long id = Ids.parse(idStr, "Bàn không tồn tại");
        DiningTable current = findTable(id).orElseThrow(() -> BusinessException.notFound("Bàn không tồn tại"));
        ValidTable t = validateTable(in, id);
        int x = current.x(), y = current.y();
        boolean areaChanged = !current.areaId().equals(Long.toString(t.areaId()));
        if (areaChanged) {
            if (hasUpcomingReservation(id))
                throw new BusinessException("Bàn đang có lịch đặt sắp tới, không thể chuyển sang khu vực khác");
            int[] cell = firstFreeCell(t.areaId(), id);
            if (cell == null) throw new BusinessException("Khu vực đích đã kín chỗ trên sơ đồ");
            x = cell[0];
            y = cell[1];
        }
        if ("inactive".equals(t.status()) && !"inactive".equals(current.status()) && hasUpcomingReservation(id))
            throw new BusinessException("Bàn đang có lịch đặt sắp tới. Hãy chuyển lịch đặt sang bàn khác trước khi ngưng sử dụng.");
        jdbc.sql("UPDATE dining_tables SET code = ?, area_id = ?, seats = ?, shape = ?, status = ?, pos_x = ?, pos_y = ? WHERE id = ?")
            .params(t.code(), t.areaId(), t.seats(), t.shape(), t.status(), x, y, id).update();
        audit.log("table", "Cập nhật bàn", "Cập nhật bàn " + t.code(), "dining_tables", id);
        return findTable(id).orElseThrow();
    }

    @Transactional
    public DiningTable moveTable(String idStr, Position pos) {
        long id = Ids.parse(idStr, "Bàn không tồn tại");
        DiningTable current = findTable(id).orElseThrow(() -> BusinessException.notFound("Bàn không tồn tại"));
        if (pos.x() == null || pos.y() == null || pos.x() < 0 || pos.y() < 0 || pos.x() >= FLOOR_COLS || pos.y() >= FLOOR_ROWS)
            throw new BusinessException("Vị trí nằm ngoài sơ đồ", org.springframework.http.HttpStatus.BAD_REQUEST);
        if (count3("SELECT COUNT(*) FROM dining_tables WHERE area_id = ? AND pos_x = ? AND pos_y = ? AND id <> " + id,
            Long.parseLong(current.areaId()), pos.x(), pos.y()) > 0)
            throw new BusinessException("Ô này đã có bàn khác");
        jdbc.sql("UPDATE dining_tables SET pos_x = ?, pos_y = ? WHERE id = ?").params(pos.x(), pos.y(), id).update();
        audit.log("table", "Cập nhật sơ đồ bàn", "Di chuyển bàn " + current.code(), "dining_tables", id);
        return findTable(id).orElseThrow();
    }

    @Transactional
    public void deleteTable(String idStr) {
        long id = Ids.parse(idStr, "Bàn không tồn tại");
        DiningTable current = findTable(id).orElseThrow(() -> BusinessException.notFound("Bàn không tồn tại"));
        if (hasUpcomingReservation(id))
            throw new BusinessException("Bàn đang có lịch đặt sắp tới. Hãy chuyển lịch đặt sang bàn khác trước khi xóa.");
        try {
            jdbc.sql("DELETE FROM dining_tables WHERE id = ?").param(id).update();
        } catch (DataIntegrityViolationException e) {
            throw new BusinessException("Bàn đã có lịch sử đặt bàn hoặc đơn hàng nên không thể xóa. Hãy chuyển sang \"Ngưng sử dụng\".");
        }
        audit.log("table", "Xóa bàn", "Xóa bàn " + current.code(), "dining_tables", id);
    }

    private long count(String sql, long id) {
        return jdbc.sql(sql).param(id).query(Long.class).single();
    }

    private long count3(String sql, Object a, Object b, Object c) {
        return jdbc.sql(sql).params(a, b, c).query(Long.class).single();
    }
}
