package com.rms.table;

import com.rms.audit.AuditService;
import com.rms.common.BusinessException;
import com.rms.common.Ids;
import com.rms.common.ValidationException;
import com.rms.common.Vi;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Pattern;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * UC Quản lý khu vực bàn: tầng, khu vực, bàn và sơ đồ bàn (docs/thiet-ke/QUY_TAC_GIAO_DIEN.md, mục B7).
 * Mỗi tầng là một lưới cols × rows ô, một ô chỉ một bàn. Khu vực thuộc một tầng, có vùng khu (hình chữ nhật, ô) tô nền
 * trên sơ đồ tầng. Tường là đoạn thẳng ngang / dọc trên đường kẻ lưới. Dữ liệu này dùng chung cho Quản lý, Thu ngân,
 * Phục vụ và website khách (khối "Không gian").
 */
@Service
public class TableService {
    private static final Pattern CODE = Pattern.compile("^[A-Z0-9-]{2,10}$");
    private static final Set<String> SHAPES = Set.of("square", "round", "rect");
    private static final Set<String> STATUSES = Set.of("available", "reserved", "occupied", "inactive");
    private static final Set<String> WALL_KINDS = Set.of("outer", "inner", "fence");
    public static final int MIN_COLS = 6, MAX_COLS = 40, MIN_ROWS = 4, MAX_ROWS = 30, MAX_WALLS = 300;

    public record Wall(String kind, int x1, int y1, int x2, int y2) {}

    public record Floor(String id, String name, int cols, int rows, List<Wall> walls) {}

    public record FloorInput(String name, Integer cols, Integer rows) {}

    /** Vùng khu trên sơ đồ tầng (ô): cột, hàng góc trên trái + rộng, cao. */
    public record Zone(int x, int y, int w, int h) {}

    public record Area(String id, String name, String description, boolean active, String floorId, Zone zone) {}

    public record AreaInput(String name, String description, Boolean active, String floorId) {}

    /** qrToken: mã trong QR dán trên bàn — trang đặt món của khách là /goi-mon/{qrToken}. */
    public record DiningTable(String id, String code, String areaId, int seats, String shape, int x, int y, String status,
                              String qrToken) {}

    public record TableInput(String code, String areaId, Integer seats, String shape, String status) {}

    public record Position(Integer x, Integer y) {}

    /** Lưu cả sơ đồ một tầng một lần (trình sửa sơ đồ): tường, vùng khu của từng khu, vị trí (và khu) của bàn. */
    public record Layout(List<Wall> walls, List<ZoneInput> zones, List<TablePosition> tables) {}

    public record ZoneInput(String areaId, Integer x, Integer y, Integer w, Integer h) {}

    public record TablePosition(String id, Integer x, Integer y, String areaId) {}

    private final JdbcClient jdbc;
    private final AuditService audit;
    private final com.rms.ordering.LiveEvents live;

    public TableService(JdbcClient jdbc, AuditService audit, com.rms.ordering.LiveEvents live) {
        this.jdbc = jdbc;
        this.audit = audit;
        this.live = live;
    }

    /** Báo thu ngân / phục vụ đang mở sơ đồ: khu vực vừa đổi (sau khi lưu thành công). */
    private void layoutChanged(long areaId) {
        live.publishLayout(areaId, findArea(areaId).map(Area::name).orElse(null));
    }

    /* ------------------------------------------------------------ Tầng */

    public List<Floor> floors() {
        Map<Long, List<Wall>> walls = new HashMap<>();
        jdbc.sql("SELECT floor_id, kind, x1, y1, x2, y2 FROM floor_walls ORDER BY id")
            .query((rs, n) -> Map.entry(rs.getLong("floor_id"),
                new Wall(rs.getString("kind"), rs.getInt("x1"), rs.getInt("y1"), rs.getInt("x2"), rs.getInt("y2"))))
            .list().forEach(e -> walls.computeIfAbsent(e.getKey(), k -> new ArrayList<>()).add(e.getValue()));
        return jdbc.sql("SELECT id, name, cols, rows_count FROM floors ORDER BY sort_order, id")
            .query((rs, n) -> new Floor(Ids.str(rs.getLong("id")), rs.getString("name"), rs.getInt("cols"), rs.getInt("rows_count"),
                walls.getOrDefault(rs.getLong("id"), List.of())))
            .list();
    }

    public Optional<Floor> findFloor(long id) {
        return floors().stream().filter(f -> f.id().equals(Long.toString(id))).findFirst();
    }

    private Floor floorOrThrow(String idStr) {
        long id = Ids.parse(idStr, "Tầng không tồn tại");
        return findFloor(id).orElseThrow(() -> BusinessException.notFound("Tầng không tồn tại"));
    }

    private record ValidFloor(String name, int cols, int rows) {}

    private ValidFloor validateFloor(FloorInput in, Long editingId) {
        var errors = new ValidationException.Collector();
        String name = Vi.collapse(in.name());
        if (name.isEmpty()) errors.add("name", "Vui lòng nhập tên tầng");
        else if (name.length() > 50) errors.add("name", "Tên tầng tối đa 50 ký tự");
        else if (jdbc.sql("SELECT COUNT(*) FROM floors WHERE name = ? AND id <> ?")
            .params(name, editingId == null ? 0 : editingId).query(Long.class).single() > 0)
            errors.add("name", "Tên tầng đã tồn tại");
        int cols = in.cols() == null ? 14 : in.cols();
        int rows = in.rows() == null ? 9 : in.rows();
        if (cols < MIN_COLS || cols > MAX_COLS) errors.add("cols", "Chiều ngang từ " + MIN_COLS + " đến " + MAX_COLS + " ô");
        if (rows < MIN_ROWS || rows > MAX_ROWS) errors.add("rows", "Chiều dọc từ " + MIN_ROWS + " đến " + MAX_ROWS + " ô");
        if (editingId != null && !errors.has("cols") && !errors.has("rows")) {
            // Thu nhỏ tầng thì không được cắt mất bàn, vùng khu, tường đang có.
            int needCols = jdbc.sql("""
                    SELECT GREATEST(
                      COALESCE((SELECT MAX(t.pos_x) + 1 FROM dining_tables t JOIN areas a ON a.id = t.area_id WHERE a.floor_id = :f), 0),
                      COALESCE((SELECT MAX(zone_x + zone_w) FROM areas WHERE floor_id = :f AND zone_x IS NOT NULL), 0),
                      COALESCE((SELECT MAX(GREATEST(x1, x2)) FROM floor_walls WHERE floor_id = :f AND kind <> 'outer'), 0))
                    """).param("f", editingId).query(Integer.class).single();
            int needRows = jdbc.sql("""
                    SELECT GREATEST(
                      COALESCE((SELECT MAX(t.pos_y) + 1 FROM dining_tables t JOIN areas a ON a.id = t.area_id WHERE a.floor_id = :f), 0),
                      COALESCE((SELECT MAX(zone_y + zone_h) FROM areas WHERE floor_id = :f AND zone_y IS NOT NULL), 0),
                      COALESCE((SELECT MAX(GREATEST(y1, y2)) FROM floor_walls WHERE floor_id = :f AND kind <> 'outer'), 0))
                    """).param("f", editingId).query(Integer.class).single();
            if (cols < needCols) errors.add("cols", "Sơ đồ đang dùng tới cột " + needCols + ", không thu nhỏ hơn được");
            if (rows < needRows) errors.add("rows", "Sơ đồ đang dùng tới hàng " + needRows + ", không thu nhỏ hơn được");
        }
        errors.throwIfAny();
        return new ValidFloor(name, cols, rows);
    }

    @Transactional
    public Floor createFloor(FloorInput in) {
        ValidFloor f = validateFloor(in, null);
        int sort = jdbc.sql("SELECT COALESCE(MAX(sort_order), 0) + 1 FROM floors").query(Integer.class).single();
        var key = new org.springframework.jdbc.support.GeneratedKeyHolder();
        jdbc.sql("INSERT INTO floors (name, sort_order, cols, rows_count) VALUES (?, ?, ?, ?)")
            .params(f.name(), sort, f.cols(), f.rows()).update(key);
        long id = key.getKey().longValue();
        outerWalls(id, f.cols(), f.rows());
        audit.log("table", "Thêm tầng", "Thêm tầng " + f.name(), "floors", id);
        return findFloor(id).orElseThrow();
    }

    /** Tường ngoài quanh cả tầng (tầng mới, hoặc đổi kích thước khi tường ngoài vẫn là khung mặc định). */
    private void outerWalls(long floorId, int cols, int rows) {
        jdbc.sql("""
                INSERT INTO floor_walls (floor_id, kind, x1, y1, x2, y2) VALUES
                (:f, 'outer', 0, 0, :c, 0), (:f, 'outer', :c, 0, :c, :r), (:f, 'outer', 0, :r, :c, :r), (:f, 'outer', 0, 0, 0, :r)
                """).param("f", floorId).param("c", cols).param("r", rows).update();
    }

    @Transactional
    public Floor updateFloor(String idStr, FloorInput in) {
        Floor current = floorOrThrow(idStr);
        long id = Long.parseLong(current.id());
        ValidFloor f = validateFloor(in, id);
        jdbc.sql("UPDATE floors SET name = ?, cols = ?, rows_count = ? WHERE id = ?").params(f.name(), f.cols(), f.rows(), id).update();
        // Tường ngoài đúng bằng khung cũ → co giãn theo khung mới; tường ngoài vượt khung mới thì bỏ.
        if (f.cols() != current.cols() || f.rows() != current.rows()) {
            List<Wall> outer = current.walls().stream().filter(w -> "outer".equals(w.kind())).toList();
            if (outer.equals(frame(current.cols(), current.rows()))) {
                jdbc.sql("DELETE FROM floor_walls WHERE floor_id = ? AND kind = 'outer'").param(id).update();
                outerWalls(id, f.cols(), f.rows());
            } else {
                jdbc.sql("DELETE FROM floor_walls WHERE floor_id = ? AND (GREATEST(x1, x2) > ? OR GREATEST(y1, y2) > ?)")
                    .params(id, f.cols(), f.rows()).update();
            }
        }
        audit.log("table", "Cập nhật tầng", "Cập nhật tầng " + f.name(), "floors", id);
        areaIdsOnFloor(id).forEach(this::layoutChanged);
        return findFloor(id).orElseThrow();
    }

    private static List<Wall> frame(int c, int r) {
        return List.of(new Wall("outer", 0, 0, c, 0), new Wall("outer", c, 0, c, r), new Wall("outer", 0, r, c, r), new Wall("outer", 0, 0, 0, r));
    }

    @Transactional
    public void deleteFloor(String idStr) {
        Floor current = floorOrThrow(idStr);
        long id = Long.parseLong(current.id());
        if (count("SELECT COUNT(*) FROM areas WHERE floor_id = ?", id) > 0)
            throw new BusinessException("Tầng vẫn còn khu vực. Hãy chuyển hoặc xóa các khu vực trước khi xóa tầng.");
        if (count("SELECT COUNT(*) FROM floors", 0) <= 1) throw new BusinessException("Nhà hàng cần ít nhất một tầng");
        jdbc.sql("DELETE FROM floors WHERE id = ?").param(id).update();
        audit.log("table", "Xóa tầng", "Xóa tầng " + current.name(), "floors", id);
    }

    private List<Long> areaIdsOnFloor(long floorId) {
        return jdbc.sql("SELECT id FROM areas WHERE floor_id = ?").param(floorId).query(Long.class).list();
    }

    /** Lưu sơ đồ một tầng: thay toàn bộ tường, vùng khu của các khu trên tầng, vị trí bàn. Kiểm tra hết rồi mới ghi. */
    @Transactional
    public Floor saveLayout(String idStr, Layout in) {
        Floor floor = floorOrThrow(idStr);
        long floorId = Long.parseLong(floor.id());
        int cols = floor.cols(), rows = floor.rows();
        Map<String, Area> floorAreas = new HashMap<>();
        areas().stream().filter(a -> a.floorId().equals(floor.id())).forEach(a -> floorAreas.put(a.id(), a));

        // Tường
        List<Wall> walls = in.walls() == null ? List.of() : in.walls();
        if (walls.size() > MAX_WALLS) throw new BusinessException("Tối đa " + MAX_WALLS + " đoạn tường mỗi tầng", org.springframework.http.HttpStatus.BAD_REQUEST);
        for (Wall w : walls) {
            boolean straight = w.x1() == w.x2() ^ w.y1() == w.y2();
            boolean inside = Math.min(w.x1(), w.x2()) >= 0 && Math.min(w.y1(), w.y2()) >= 0 && Math.max(w.x1(), w.x2()) <= cols && Math.max(w.y1(), w.y2()) <= rows;
            if (!WALL_KINDS.contains(w.kind()) || !straight || !inside)
                throw new BusinessException("Có đoạn tường không hợp lệ (phải thẳng ngang / dọc, nằm trong sơ đồ)", org.springframework.http.HttpStatus.BAD_REQUEST);
        }

        // Vùng khu: chỉ khu thuộc tầng này; không chồng lên nhau
        Map<String, Zone> zones = new HashMap<>();
        for (ZoneInput z : in.zones() == null ? List.<ZoneInput>of() : in.zones()) {
            if (!floorAreas.containsKey(z.areaId())) throw new BusinessException("Khu vực không thuộc tầng này", org.springframework.http.HttpStatus.BAD_REQUEST);
            if (z.x() == null) continue; // bỏ vùng
            if (z.y() == null || z.w() == null || z.h() == null || z.x() < 0 || z.y() < 0 || z.w() < 1 || z.h() < 1 || z.x() + z.w() > cols || z.y() + z.h() > rows)
                throw new BusinessException("Vùng của khu " + floorAreas.get(z.areaId()).name() + " nằm ngoài sơ đồ", org.springframework.http.HttpStatus.BAD_REQUEST);
            zones.put(z.areaId(), new Zone(z.x(), z.y(), z.w(), z.h()));
        }
        List<Map.Entry<String, Zone>> zl = new ArrayList<>(zones.entrySet());
        for (int i = 0; i < zl.size(); i++)
            for (int j = i + 1; j < zl.size(); j++)
                if (overlap(zl.get(i).getValue(), zl.get(j).getValue()))
                    throw new BusinessException("Vùng khu " + floorAreas.get(zl.get(i).getKey()).name() + " và " + floorAreas.get(zl.get(j).getKey()).name() + " chồng lên nhau");

        // Bàn: vị trí cuối cùng của mọi bàn trên tầng không trùng ô
        Map<String, DiningTable> onFloor = new HashMap<>();
        tables().stream().filter(t -> floorAreas.containsKey(t.areaId())).forEach(t -> onFloor.put(t.id(), t));
        Map<String, int[]> pos = new HashMap<>();
        Map<String, String> newArea = new HashMap<>();
        onFloor.values().forEach(t -> { pos.put(t.id(), new int[] {t.x(), t.y()}); newArea.put(t.id(), t.areaId()); });
        for (TablePosition p : in.tables() == null ? List.<TablePosition>of() : in.tables()) {
            DiningTable t = onFloor.get(p.id());
            if (t == null) throw new BusinessException("Bàn không thuộc tầng này", org.springframework.http.HttpStatus.BAD_REQUEST);
            if (p.x() == null || p.y() == null || p.x() < 0 || p.y() < 0 || p.x() >= cols || p.y() >= rows)
                throw new BusinessException("Bàn " + t.code() + " nằm ngoài sơ đồ", org.springframework.http.HttpStatus.BAD_REQUEST);
            String area = p.areaId() == null ? t.areaId() : p.areaId();
            if (!floorAreas.containsKey(area)) throw new BusinessException("Khu vực của bàn " + t.code() + " không thuộc tầng này", org.springframework.http.HttpStatus.BAD_REQUEST);
            if (!area.equals(t.areaId()) && hasUpcomingReservation(Long.parseLong(t.id())))
                throw new BusinessException("Bàn " + t.code() + " đang có lịch đặt sắp tới, không chuyển sang khu khác được");
            pos.put(t.id(), new int[] {p.x(), p.y()});
            newArea.put(t.id(), area);
        }
        Map<Integer, String> cells = new HashMap<>();
        for (var e : pos.entrySet()) {
            String other = cells.put(e.getValue()[1] * 1000 + e.getValue()[0], e.getKey());
            if (other != null) throw new BusinessException("Bàn " + onFloor.get(other).code() + " và " + onFloor.get(e.getKey()).code() + " đang chung một ô");
        }

        // Ghi
        jdbc.sql("DELETE FROM floor_walls WHERE floor_id = ?").param(floorId).update();
        for (Wall w : walls)
            jdbc.sql("INSERT INTO floor_walls (floor_id, kind, x1, y1, x2, y2) VALUES (?, ?, ?, ?, ?, ?)")
                .params(floorId, w.kind(), w.x1(), w.y1(), w.x2(), w.y2()).update();
        for (String areaId : floorAreas.keySet()) {
            Zone z = zones.get(areaId);
            jdbc.sql("UPDATE areas SET zone_x = ?, zone_y = ?, zone_w = ?, zone_h = ? WHERE id = ?")
                .params(z == null ? null : z.x(), z == null ? null : z.y(), z == null ? null : z.w(), z == null ? null : z.h(), Long.parseLong(areaId))
                .update();
        }
        for (var e : pos.entrySet()) {
            DiningTable t = onFloor.get(e.getKey());
            int[] p = e.getValue();
            String area = newArea.get(e.getKey());
            if (t.x() != p[0] || t.y() != p[1] || !t.areaId().equals(area))
                jdbc.sql("UPDATE dining_tables SET pos_x = ?, pos_y = ?, area_id = ? WHERE id = ?")
                    .params(p[0], p[1], Long.parseLong(area), Long.parseLong(t.id())).update();
        }
        audit.log("table", "Cập nhật sơ đồ bàn", "Lưu sơ đồ " + floor.name(), "floors", floorId);
        floorAreas.keySet().forEach(a -> layoutChanged(Long.parseLong(a)));
        return findFloor(floorId).orElseThrow();
    }

    private static boolean overlap(Zone a, Zone b) {
        return a.x() < b.x() + b.w() && b.x() < a.x() + a.w() && a.y() < b.y() + b.h() && b.y() < a.y() + a.h();
    }

    /* ------------------------------------------------------------ Khu vực */

    public List<Area> areas() {
        return jdbc.sql("SELECT id, name, description, is_active, floor_id, zone_x, zone_y, zone_w, zone_h FROM areas ORDER BY sort_order, id")
            .query((rs, n) -> {
                Integer zx = (Integer) rs.getObject("zone_x", Integer.class);
                Zone zone = zx == null ? null : new Zone(zx, rs.getInt("zone_y"), rs.getInt("zone_w"), rs.getInt("zone_h"));
                return new Area(Ids.str(rs.getLong("id")), rs.getString("name"),
                    rs.getString("description") == null ? "" : rs.getString("description"), rs.getBoolean("is_active"),
                    Ids.str(rs.getLong("floor_id")), zone);
            })
            .list();
    }

    public Optional<Area> findArea(long id) {
        return areas().stream().filter(a -> a.id().equals(Long.toString(id))).findFirst();
    }

    private record ValidArea(String name, long floorId) {}

    private ValidArea validateArea(AreaInput in, Long editingId) {
        var errors = new ValidationException.Collector();
        String name = Vi.collapse(in.name());
        String desc = Vi.trim(in.description());
        if (name.isEmpty()) errors.add("name", "Vui lòng nhập tên khu vực");
        else if (name.length() > 50) errors.add("name", "Tên khu vực tối đa 50 ký tự");
        else if (jdbc.sql("SELECT COUNT(*) FROM areas WHERE name = ? AND id <> ?")
            .params(name, editingId == null ? 0 : editingId).query(Long.class).single() > 0)
            errors.add("name", "Tên khu vực đã tồn tại");
        if (desc.length() > 200) errors.add("description", "Mô tả tối đa 200 ký tự");
        Long floorId = Ids.parseOrNull(in.floorId());
        if (floorId == null) floorId = jdbc.sql("SELECT id FROM floors ORDER BY sort_order, id LIMIT 1").query(Long.class).optional().orElse(null);
        if (floorId == null || findFloor(floorId).isEmpty()) errors.add("floorId", "Vui lòng chọn tầng");
        errors.throwIfAny();
        return new ValidArea(name, floorId);
    }

    @Transactional
    public Area createArea(AreaInput in) {
        ValidArea v = validateArea(in, null);
        int sort = jdbc.sql("SELECT COALESCE(MAX(sort_order), 0) + 1 FROM areas").query(Integer.class).single();
        var key = new org.springframework.jdbc.support.GeneratedKeyHolder();
        jdbc.sql("INSERT INTO areas (floor_id, name, description, is_active, sort_order) VALUES (?, ?, ?, ?, ?)")
            .params(v.floorId(), v.name(), Vi.trim(in.description()), in.active() == null || in.active(), sort)
            .update(key);
        long id = key.getKey().longValue();
        audit.log("table", "Thêm khu vực", "Thêm khu vực " + v.name(), "areas", id);
        layoutChanged(id);
        return findArea(id).orElseThrow();
    }

    @Transactional
    public Area updateArea(String idStr, AreaInput in) {
        long id = Ids.parse(idStr, "Khu vực không tồn tại");
        Area current = findArea(id).orElseThrow(() -> BusinessException.notFound("Khu vực không tồn tại"));
        ValidArea v = validateArea(in, id);
        boolean floorChanged = !current.floorId().equals(Long.toString(v.floorId()));
        if (floorChanged && count("SELECT COUNT(*) FROM dining_tables WHERE area_id = ?", id) > 0)
            throw new BusinessException("Khu vực vẫn còn bàn nên không chuyển tầng được. Hãy chuyển các bàn sang khu khác trước.");
        jdbc.sql("UPDATE areas SET floor_id = ?, name = ?, description = ?, is_active = ? WHERE id = ?")
            .params(v.floorId(), v.name(), Vi.trim(in.description()), in.active() == null || in.active(), id).update();
        if (floorChanged) jdbc.sql("UPDATE areas SET zone_x = NULL, zone_y = NULL, zone_w = NULL, zone_h = NULL WHERE id = ?").param(id).update();
        audit.log("table", "Cập nhật khu vực", "Cập nhật khu vực " + v.name(), "areas", id);
        layoutChanged(id);
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
        live.publishLayout(id, area.name());
    }

    /* ------------------------------------------------------------ Bàn */

    public List<DiningTable> tables() {
        return jdbc.sql("SELECT id, code, area_id, seats, shape, pos_x, pos_y, status, qr_token FROM dining_tables ORDER BY code")
            .query((rs, n) -> new DiningTable(Ids.str(rs.getLong("id")), rs.getString("code"), Ids.str(rs.getLong("area_id")),
                rs.getInt("seats"), rs.getString("shape"), rs.getInt("pos_x"), rs.getInt("pos_y"), rs.getString("status"),
                rs.getString("qr_token")))
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

    /** Ô trống trên tầng của khu: ưu tiên trong vùng khu (nếu đã vẽ), không có thì cả tầng. */
    private int[] freeCell(long areaId, Long ignoreId) {
        Area area = findArea(areaId).orElseThrow();
        Floor floor = findFloor(Long.parseLong(area.floorId())).orElseThrow();
        Set<Integer> used = new HashSet<>(jdbc.sql("""
                SELECT t.pos_x, t.pos_y FROM dining_tables t JOIN areas a ON a.id = t.area_id WHERE a.floor_id = ? AND t.id <> ?
                """)
            .params(Long.parseLong(floor.id()), ignoreId == null ? 0 : ignoreId)
            .query((rs, n) -> rs.getInt("pos_y") * 1000 + rs.getInt("pos_x"))
            .list());
        Zone z = area.zone();
        if (z != null)
            for (int y = z.y(); y < z.y() + z.h(); y++)
                for (int x = z.x(); x < z.x() + z.w(); x++)
                    if (!used.contains(y * 1000 + x)) return new int[] {x, y};
        for (int y = 0; y < floor.rows(); y++)
            for (int x = 0; x < floor.cols(); x++)
                if (!used.contains(y * 1000 + x)) return new int[] {x, y};
        return null;
    }

    private boolean inZone(Zone z, int x, int y) {
        return z != null && x >= z.x() && x < z.x() + z.w() && y >= z.y() && y < z.y() + z.h();
    }

    @Transactional
    public DiningTable createTable(TableInput in) {
        ValidTable t = validateTable(in, null);
        int[] cell = freeCell(t.areaId(), null);
        if (cell == null) throw new BusinessException("Sơ đồ tầng này đã kín chỗ, không thể thêm bàn");
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
        layoutChanged(t.areaId());
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
            Area from = findArea(Long.parseLong(current.areaId())).orElseThrow();
            Area to = findArea(t.areaId()).orElseThrow();
            // Cùng tầng và vị trí đang nằm trong vùng khu mới thì giữ chỗ; còn lại tìm ô trống của khu mới.
            if (!from.floorId().equals(to.floorId()) || !inZone(to.zone(), x, y)) {
                int[] cell = freeCell(t.areaId(), id);
                if (cell == null) throw new BusinessException("Sơ đồ tầng của khu vực đích đã kín chỗ");
                x = cell[0];
                y = cell[1];
            }
        }
        if ("inactive".equals(t.status()) && !"inactive".equals(current.status()) && hasUpcomingReservation(id))
            throw new BusinessException("Bàn đang có lịch đặt sắp tới. Hãy chuyển lịch đặt sang bàn khác trước khi ngưng sử dụng.");
        jdbc.sql("UPDATE dining_tables SET code = ?, area_id = ?, seats = ?, shape = ?, status = ?, pos_x = ?, pos_y = ? WHERE id = ?")
            .params(t.code(), t.areaId(), t.seats(), t.shape(), t.status(), x, y, id).update();
        audit.log("table", "Cập nhật bàn", "Cập nhật bàn " + t.code(), "dining_tables", id);
        layoutChanged(t.areaId());
        if (areaChanged) layoutChanged(Long.parseLong(current.areaId()));
        return findTable(id).orElseThrow();
    }

    @Transactional
    public DiningTable moveTable(String idStr, Position pos) {
        long id = Ids.parse(idStr, "Bàn không tồn tại");
        DiningTable current = findTable(id).orElseThrow(() -> BusinessException.notFound("Bàn không tồn tại"));
        Area area = findArea(Long.parseLong(current.areaId())).orElseThrow();
        Floor floor = findFloor(Long.parseLong(area.floorId())).orElseThrow();
        if (pos.x() == null || pos.y() == null || pos.x() < 0 || pos.y() < 0 || pos.x() >= floor.cols() || pos.y() >= floor.rows())
            throw new BusinessException("Vị trí nằm ngoài sơ đồ", org.springframework.http.HttpStatus.BAD_REQUEST);
        if (jdbc.sql("""
                SELECT COUNT(*) FROM dining_tables t JOIN areas a ON a.id = t.area_id
                WHERE a.floor_id = ? AND t.pos_x = ? AND t.pos_y = ? AND t.id <> ?
                """).params(Long.parseLong(floor.id()), pos.x(), pos.y(), id).query(Long.class).single() > 0)
            throw new BusinessException("Ô này đã có bàn khác");
        jdbc.sql("UPDATE dining_tables SET pos_x = ?, pos_y = ? WHERE id = ?").params(pos.x(), pos.y(), id).update();
        audit.log("table", "Cập nhật sơ đồ bàn", "Di chuyển bàn " + current.code(), "dining_tables", id);
        layoutChanged(Long.parseLong(current.areaId()));
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
        layoutChanged(Long.parseLong(current.areaId()));
    }

    private long count(String sql, long id) {
        if (!sql.contains("?")) return jdbc.sql(sql).query(Long.class).single();
        return jdbc.sql(sql).param(id).query(Long.class).single();
    }
}
