package com.rms.backup;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.rms.audit.AuditService;
import com.rms.common.BusinessException;
import com.rms.common.CurrentUserService;
import com.rms.common.Db;
import com.rms.common.Ids;
import com.rms.common.Times;
import com.rms.storage.StorageService;
import java.io.BufferedReader;
import java.io.BufferedWriter;
import java.io.FilterOutputStream;
import java.io.IOException;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.io.OutputStreamWriter;
import java.io.UncheckedIOException;
import java.io.Writer;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.time.Duration;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.locks.ReentrantLock;
import java.util.zip.ZipEntry;
import java.util.zip.ZipFile;
import java.util.zip.ZipOutputStream;
import javax.sql.DataSource;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

/**
 * Sao lưu & phục hồi dữ liệu (UC Cấu hình hệ thống — luồng B).
 *
 * Bản sao lưu là một file .zip trong thư mục RMS_BACKUP_DIR (mặc định "backups", không đưa lên git):
 *   manifest.json  — định dạng, thời điểm, phiên bản CSDL (Flyway), số dòng từng bảng, số file ảnh
 *   data.sql       — dữ liệu mọi bảng dạng INSERT, mỗi câu một dòng (mở bằng trình soạn thảo đọc được)
 *   uploads/...    — ảnh món ăn, ảnh bìa bài viết (CSDL chỉ lưu khóa ảnh)
 * Chỉ sao lưu DỮ LIỆU; cấu trúc bảng / trigger / view do Flyway quản lý theo phiên bản.
 * Không sao lưu: flyway_schema_history, phiên đăng nhập (SPRING_SESSION*), danh sách file sao lưu (backup_files).
 *
 * Phục hồi an toàn:
 *  1. Kiểm tra file trước khi đụng vào dữ liệu: đúng định dạng, không phải từ phiên bản CSDL MỚI HƠN hiện tại,
 *     các bảng trong bản sao lưu đều còn tồn tại.
 *  2. Tự tạo một bản sao lưu "truoc-phuc-hoi" của dữ liệu hiện tại → phục hồi nhầm vẫn quay lại được.
 *  3. Xóa và chép lại dữ liệu trong MỘT giao dịch (FOREIGN_KEY_CHECKS = 0, @rms_restore = 1 để trigger sổ kho
 *     bỏ qua — xem Flyway V5). Lỗi ở bất kỳ câu nào → rollback, dữ liệu giữ nguyên.
 *  4. Chép lại các file ảnh còn thiếu.
 *  5. KHÔNG phục hồi nhật ký hoạt động (audit_logs): giữ nguyên dấu vết mọi thao tác, kể cả chính lần phục hồi.
 *
 * Tự động sao lưu theo lịch (bảng backup_schedule): kiểm tra mỗi phút; chỉ giữ {@code keep} bản tự động mới nhất,
 * bản tạo tay không bị tự xóa. Bản sao lưu nằm cùng máy chủ — khi chạy thật vẫn phải chép ra nơi khác (TRIEN_KHAI.md).
 */
@Service
public class BackupService {
    private static final Logger log = LoggerFactory.getLogger(BackupService.class);
    static final String FORMAT = "rms-backup";
    static final int FORMAT_VERSION = 1;
    /** Không sao lưu (so sánh không phân biệt hoa thường — tên bảng trên Linux có thể viết HOA). */
    private static final Set<String> NOT_DUMPED = Set.of("flyway_schema_history", "spring_session", "spring_session_attributes",
        "backup_files");
    /** Có trong bản sao lưu nhưng không ghi đè khi phục hồi. */
    private static final Set<String> NOT_RESTORED = Set.of("audit_logs");
    private static final int ROWS_PER_INSERT = 200;
    private static final DateTimeFormatter STAMP = DateTimeFormatter.ofPattern("yyyyMMdd-HHmmss");
    private static final DateTimeFormatter DMY_HM = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm");

    public record BackupFile(String id, String name, String createdAt, long sizeKb, String kind) {}

    public record RestoreResult(String restoredFrom, BackupFile safetyBackup, int tables, long rows, int uploads) {}

    private record Column(String name, String type) {}

    private final JdbcClient jdbc;
    private final DataSource dataSource;
    private final StorageService storage;
    private final AuditService audit;
    private final CurrentUserService currentUser;
    private final ObjectMapper json;
    private final Path dir;
    private final ReentrantLock lock = new ReentrantLock();

    public BackupService(JdbcClient jdbc, DataSource dataSource, StorageService storage, AuditService audit,
                         CurrentUserService currentUser, ObjectMapper json,
                         @Value("${rms.backup.dir:backups}") String backupDir) {
        this.jdbc = jdbc;
        this.dataSource = dataSource;
        this.storage = storage;
        this.audit = audit;
        this.currentUser = currentUser;
        this.json = json;
        this.dir = Path.of(backupDir).toAbsolutePath().normalize();
        try {
            Files.createDirectories(dir);
        } catch (IOException e) {
            throw new UncheckedIOException("Không tạo được thư mục sao lưu " + dir, e);
        }
        log.info("Lưu bản sao lưu tại {}", dir);
    }

    /* ------------------------------------------------------------------ Danh sách / tải / xóa */

    public List<BackupFile> list() {
        return jdbc.sql("SELECT id, file_name, size_kb, kind, created_at FROM backup_files ORDER BY created_at DESC, id DESC")
            .query((rs, n) -> new BackupFile(Ids.str(rs.getLong("id")), rs.getString("file_name"),
                Times.iso(Db.dateTime(rs, "created_at")), rs.getLong("size_kb"), rs.getString("kind")))
            .list();
    }

    private BackupFile find(long id) {
        return list().stream().filter(b -> b.id().equals(Ids.str(id))).findFirst()
            .orElseThrow(() -> BusinessException.notFound("Bản sao lưu không tồn tại"));
    }

    /** File trên ổ đĩa của bản sao lưu; không còn file → 409. */
    public Path file(String idText) {
        BackupFile b = find(Ids.parse(idText, "Bản sao lưu không tồn tại"));
        Path p = dir.resolve(b.name()).normalize();
        if (!p.startsWith(dir) || !Files.isRegularFile(p))
            throw new BusinessException("File " + b.name() + " không còn trên máy chủ (có thể đã bị xóa tay)");
        return p;
    }

    public void delete(String idText) {
        long id = Ids.parse(idText, "Bản sao lưu không tồn tại");
        withLock(() -> {
            BackupFile b = find(id);
            removeFile(b);
            audit.log("settings", "Xóa bản sao lưu", b.name(), "backup_files", id);
            return null;
        });
    }

    private void removeFile(BackupFile b) {
        try {
            Files.deleteIfExists(dir.resolve(b.name()).normalize());
        } catch (IOException e) {
            throw new UncheckedIOException("Không xóa được file " + b.name(), e);
        }
        jdbc.sql("DELETE FROM backup_files WHERE id = ?").param(Long.parseLong(b.id())).update();
    }

    /* ------------------------------------------------------------------ Tạo bản sao lưu */

    /** Sao lưu thủ công (nút "Sao lưu ngay"). */
    public BackupFile createManual() {
        return withLock(() -> {
            BackupFile f = create("manual", "manual", currentUser.get().id());
            audit.log("settings", "Tạo bản sao lưu", f.name() + " (" + f.sizeKb() + " KB)", "backup_files", Long.parseLong(f.id()));
            return f;
        });
    }

    /** Tạo file + ghi backup_files. Gọi khi đã giữ khóa. */
    private BackupFile create(String kind, String suffix, Long userId) {
        // Tên duy nhất: hai bản tạo trong cùng một giây được đánh số -2, -3… (không bao giờ ghi đè file có sẵn).
        String base = "rms-backup-" + Times.now().format(STAMP) + "-" + suffix;
        String name = base + ".zip";
        for (int i = 2; Files.exists(dir.resolve(name))
            || jdbc.sql("SELECT COUNT(*) FROM backup_files WHERE file_name = ?").param(name).query(Long.class).single() > 0; i++) {
            name = base + "-" + i + ".zip";
        }
        Path target = dir.resolve(name);
        Path part = dir.resolve(name + ".part");
        try {
            Map<String, Long> counts;
            int uploads = 0;
            try (ZipOutputStream zip = new ZipOutputStream(Files.newOutputStream(part))) {
                zip.putNextEntry(new ZipEntry("data.sql"));
                Writer w = new BufferedWriter(new OutputStreamWriter(new NonClosing(zip), StandardCharsets.UTF_8));
                counts = dump(w, name);
                w.flush();
                zip.closeEntry();
                for (String key : storage.keys()) {
                    byte[] content = storage.read(key);
                    if (content == null) continue;
                    zip.putNextEntry(new ZipEntry("uploads/" + key));
                    zip.write(content);
                    zip.closeEntry();
                    uploads++;
                }
                ObjectNode manifest = json.createObjectNode();
                manifest.put("format", FORMAT);
                manifest.put("formatVersion", FORMAT_VERSION);
                manifest.put("createdAt", Times.iso(Times.now()));
                manifest.put("schemaVersion", schemaVersion());
                manifest.put("uploads", uploads);
                ObjectNode tables = manifest.putObject("tables");
                counts.forEach(tables::put);
                zip.putNextEntry(new ZipEntry("manifest.json"));
                zip.write(json.writerWithDefaultPrettyPrinter().writeValueAsBytes(manifest));
                zip.closeEntry();
            }
            Files.move(part, target, StandardCopyOption.ATOMIC_MOVE);
            long sizeKb = Math.max(1, (Files.size(target) + 1023) / 1024);
            jdbc.sql("INSERT INTO backup_files (file_name, file_path, size_kb, kind, created_by) VALUES (?, ?, ?, ?, ?)")
                .params(name, name, sizeKb, kind, userId).update();
            long id = jdbc.sql("SELECT LAST_INSERT_ID()").query(Long.class).single();
            return find(id);
        } catch (IOException | SQLException e) {
            try {
                Files.deleteIfExists(part);
            } catch (IOException ignored) {
                // file tạm: bỏ qua
            }
            log.error("Sao lưu thất bại", e);
            throw new BusinessException("Không tạo được bản sao lưu: " + e.getMessage());
        }
    }

    /** Ghi dữ liệu mọi bảng (một ảnh chụp nhất quán) thành các câu INSERT; trả về số dòng từng bảng. */
    private Map<String, Long> dump(Writer w, String name) throws SQLException, IOException {
        Map<String, Long> counts = new LinkedHashMap<>();
        w.write("-- RMS — bản sao lưu dữ liệu " + name + "\n");
        w.write("-- Tạo lúc " + Times.now().format(DMY_HM) + ", phiên bản CSDL " + schemaVersion() + "\n");
        w.write("-- Chỉ có dữ liệu (cấu trúc bảng do Flyway tạo). Phục hồi bằng chức năng Sao lưu & Phục hồi của hệ thống.\n");
        w.write("SET NAMES utf8mb4;\n");
        try (Connection c = dataSource.getConnection()) {
            boolean autoCommit = c.getAutoCommit();
            int isolation = c.getTransactionIsolation();
            c.setTransactionIsolation(Connection.TRANSACTION_REPEATABLE_READ);
            c.setAutoCommit(false);
            try (Statement st = c.createStatement()) {
                st.execute("START TRANSACTION WITH CONSISTENT SNAPSHOT, READ ONLY");
                for (String table : tables(c)) {
                    if (NOT_DUMPED.contains(table.toLowerCase(Locale.ROOT))) continue;
                    List<Column> cols = columns(c, table);
                    String head = "INSERT INTO `" + table + "` (" + String.join(", ", cols.stream().map(x -> "`" + x.name() + "`").toList())
                        + ") VALUES ";
                    long rows = 0;
                    StringBuilder batch = new StringBuilder();
                    int inBatch = 0;
                    try (ResultSet rs = st.executeQuery("SELECT * FROM `" + table + "`")) {
                        while (rs.next()) {
                            batch.append(inBatch == 0 ? head : ", ").append('(');
                            for (int i = 0; i < cols.size(); i++) {
                                if (i > 0) batch.append(", ");
                                batch.append(literal(rs, cols.get(i)));
                            }
                            batch.append(')');
                            rows++;
                            if (++inBatch == ROWS_PER_INSERT) {
                                w.write(batch.append(";\n").toString());
                                batch.setLength(0);
                                inBatch = 0;
                            }
                        }
                    }
                    if (inBatch > 0) w.write(batch.append(";\n").toString());
                    counts.put(table, rows);
                }
                c.commit();
            } finally {
                c.setAutoCommit(autoCommit);
                c.setTransactionIsolation(isolation);
            }
        }
        return counts;
    }

    private static List<String> tables(Connection c) throws SQLException {
        List<String> out = new ArrayList<>();
        try (var ps = c.prepareStatement("SELECT table_name FROM information_schema.tables "
            + "WHERE table_schema = DATABASE() AND table_type = 'BASE TABLE' ORDER BY table_name");
             ResultSet rs = ps.executeQuery()) {
            while (rs.next()) out.add(rs.getString(1));
        }
        return out;
    }

    private static List<Column> columns(Connection c, String table) throws SQLException {
        List<Column> out = new ArrayList<>();
        try (var ps = c.prepareStatement("SELECT column_name, data_type, extra FROM information_schema.columns "
            + "WHERE table_schema = DATABASE() AND table_name = ? ORDER BY ordinal_position")) {
            ps.setString(1, table);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    String extra = rs.getString(3) == null ? "" : rs.getString(3).toLowerCase(Locale.ROOT);
                    if (extra.contains("generated")) continue; // cột tính toán: CSDL tự sinh
                    out.add(new Column(rs.getString(1), rs.getString(2).toLowerCase(Locale.ROOT)));
                }
            }
        }
        return out;
    }

    /** Giá trị → hằng SQL. Ngày giờ lấy dạng chữ do MySQL trả (không qua quy đổi múi giờ). */
    static String literal(ResultSet rs, Column col) throws SQLException {
        String t = col.type();
        if (t.contains("blob") || t.contains("binary")) {
            byte[] b = rs.getBytes(col.name());
            return b == null ? "NULL" : b.length == 0 ? "''" : "0x" + HexFormat.of().formatHex(b);
        }
        String v = rs.getString(col.name());
        if (v == null) return "NULL";
        return switch (t) {
            case "tinyint", "smallint", "mediumint", "int", "integer", "bigint", "decimal", "numeric", "float", "double", "bit" ->
                "true".equals(v) ? "1" : "false".equals(v) ? "0" : v;
            default -> quote(v);
        };
    }

    /** Chuỗi trong nháy đơn, mọi ký tự đặc biệt được thoát → mỗi câu INSERT nằm trọn trên một dòng. */
    static String quote(String s) {
        StringBuilder sb = new StringBuilder(s.length() + 8).append('\'');
        for (int i = 0; i < s.length(); i++) {
            char ch = s.charAt(i);
            switch (ch) {
                case '\\' -> sb.append("\\\\");
                case '\'' -> sb.append("\\'");
                case '\n' -> sb.append("\\n");
                case '\r' -> sb.append("\\r");
                case '\0' -> sb.append("\\0");
                case '\u001a' -> sb.append("\\Z");
                default -> sb.append(ch);
            }
        }
        return sb.append('\'').toString();
    }

    private String schemaVersion() {
        return jdbc.sql("SELECT version FROM flyway_schema_history WHERE success = 1 AND version IS NOT NULL "
                + "ORDER BY installed_rank DESC LIMIT 1")
            .query(String.class).optional().orElse("0");
    }

    /** So sánh "3.10" với "3.2" theo từng số. */
    static int compareVersions(String a, String b) {
        String[] x = a.split("\\."), y = b.split("\\.");
        for (int i = 0; i < Math.max(x.length, y.length); i++) {
            long p = i < x.length ? Long.parseLong(x[i]) : 0, q = i < y.length ? Long.parseLong(y[i]) : 0;
            if (p != q) return Long.compare(p, q);
        }
        return 0;
    }

    /* ------------------------------------------------------------------ Phục hồi */

    public RestoreResult restore(String idText) {
        long id = Ids.parse(idText, "Bản sao lưu không tồn tại");
        return withLock(() -> {
            BackupFile source = find(id);
            Path path = file(idText);
            try (ZipFile zip = new ZipFile(path.toFile(), StandardCharsets.UTF_8)) {
                // 1. Kiểm tra trước khi đụng vào dữ liệu.
                ZipEntry manifestEntry = zip.getEntry("manifest.json"), dataEntry = zip.getEntry("data.sql");
                if (manifestEntry == null || dataEntry == null) throw new BusinessException("File không phải bản sao lưu của hệ thống");
                JsonNode manifest = json.readTree(zip.getInputStream(manifestEntry));
                if (!FORMAT.equals(manifest.path("format").asText()) || manifest.path("formatVersion").asInt() != FORMAT_VERSION)
                    throw new BusinessException("File không phải bản sao lưu của hệ thống hoặc định dạng không hỗ trợ");
                String backupVersion = manifest.path("schemaVersion").asText("0"), current = schemaVersion();
                if (compareVersions(backupVersion, current) > 0)
                    throw new BusinessException("Bản sao lưu tạo từ phiên bản CSDL mới hơn (" + backupVersion + " > " + current
                        + "). Hãy cập nhật hệ thống trước khi phục hồi.");
                Map<String, String> existing = new LinkedHashMap<>();
                try (Connection c = dataSource.getConnection()) {
                    for (String t : tables(c)) existing.put(t.toLowerCase(Locale.ROOT), t);
                }
                List<String> restoreTables = new ArrayList<>();
                List<String> missing = new ArrayList<>();
                manifest.path("tables").fieldNames().forEachRemaining(t -> {
                    String key = t.toLowerCase(Locale.ROOT);
                    if (!existing.containsKey(key)) missing.add(t);
                    else if (!NOT_DUMPED.contains(key) && !NOT_RESTORED.contains(key)) restoreTables.add(existing.get(key));
                });
                if (!missing.isEmpty())
                    throw new BusinessException("Bản sao lưu có bảng không còn trong CSDL hiện tại: " + String.join(", ", missing));

                // 2. Bản an toàn của dữ liệu hiện tại.
                BackupFile safety = create("manual", "truoc-phuc-hoi", currentUser.get().id());

                // 3. Xóa & chép lại trong một giao dịch.
                long rows = restoreData(zip, dataEntry, restoreTables);

                // 4. Chép lại ảnh còn thiếu.
                int uploads = 0;
                var entries = zip.entries();
                while (entries.hasMoreElements()) {
                    ZipEntry e = entries.nextElement();
                    if (e.isDirectory() || !e.getName().startsWith("uploads/")) continue;
                    String key = e.getName().substring("uploads/".length());
                    if (storage.read(key) == null && storage.write(key, zip.getInputStream(e).readAllBytes())) uploads++;
                }

                // 5. Nhật ký (không bị phục hồi ghi đè). Người thao tác có thể không còn trong bảng users vừa phục hồi.
                logRestore(source, safety, restoreTables.size(), rows, uploads);
                return new RestoreResult(source.name(), safety, restoreTables.size(), rows, uploads);
            } catch (IOException | SQLException e) {
                throw new BusinessException("Không đọc được file sao lưu: " + e.getMessage());
            }
        });
    }

    private long restoreData(ZipFile zip, ZipEntry dataEntry, List<String> restoreTables) throws IOException {
        Set<String> targets = new java.util.HashSet<>();
        restoreTables.forEach(t -> targets.add(t.toLowerCase(Locale.ROOT)));
        long rows = 0;
        try (Connection c = dataSource.getConnection()) {
            boolean autoCommit = c.getAutoCommit();
            c.setAutoCommit(false);
            try (Statement st = c.createStatement()) {
                try {
                    st.execute("SET FOREIGN_KEY_CHECKS = 0");
                    st.execute("SET @rms_restore = 1");
                    for (String t : restoreTables) st.executeUpdate("DELETE FROM `" + t + "`");
                    try (BufferedReader r = new BufferedReader(new InputStreamReader(zip.getInputStream(dataEntry), StandardCharsets.UTF_8))) {
                        String line;
                        while ((line = r.readLine()) != null) {
                            if (!line.startsWith("INSERT INTO `")) continue;
                            String table = line.substring(13, line.indexOf('`', 13)).toLowerCase(Locale.ROOT);
                            if (!targets.contains(table)) continue;
                            rows += st.executeUpdate(line);
                        }
                    }
                    c.commit();
                } catch (SQLException | IOException | RuntimeException e) {
                    c.rollback();
                    log.error("Phục hồi thất bại, đã hoàn tác", e);
                    throw new BusinessException("Phục hồi thất bại, dữ liệu hiện tại được giữ nguyên. Chi tiết: " + e.getMessage());
                } finally {
                    st.execute("SET FOREIGN_KEY_CHECKS = 1");
                    st.execute("SET @rms_restore = NULL");
                    c.setAutoCommit(autoCommit);
                }
            }
        } catch (SQLException e) {
            throw new BusinessException("Không kết nối được CSDL để phục hồi: " + e.getMessage());
        }
        return rows;
    }

    private void logRestore(BackupFile source, BackupFile safety, int tables, long rows, int uploads) {
        var user = currentUser.get();
        boolean stillExists = jdbc.sql("SELECT COUNT(*) FROM users WHERE id = ?").param(user.id()).query(Long.class).single() > 0;
        String detail = "Phục hồi từ " + source.name() + " (" + tables + " bảng, " + rows + " dòng, " + uploads
            + " ảnh chép lại). Bản an toàn trước khi phục hồi: " + safety.name();
        if (stillExists) {
            audit.log("settings", "Phục hồi dữ liệu", detail, "backup_files", Long.parseLong(source.id()));
        } else {
            jdbc.sql("""
                    INSERT INTO audit_logs (user_id, actor_name, actor_username, module, action, detail, ref_table, ref_id)
                    VALUES (NULL, ?, ?, 'settings', 'Phục hồi dữ liệu', ?, 'backup_files', ?)
                    """)
                .params(user.fullName(), user.username(), detail, Long.parseLong(source.id()))
                .update();
        }
    }

    /* ------------------------------------------------------------------ Tự động sao lưu theo lịch */

    /** Mỗi phút: tới giờ trong lịch mà chưa có bản tự động cho lượt đó thì sao lưu (bù trong vòng 12 giờ nếu máy chủ tắt). */
    @Scheduled(cron = "0 * * * * *", zone = "Asia/Ho_Chi_Minh")
    public void autoBackupTick() {
        try {
            runScheduledIfDue(Times.now());
        } catch (RuntimeException e) {
            log.error("Tự động sao lưu thất bại", e);
        }
    }

    void runScheduledIfDue(LocalDateTime now) {
        record Schedule(boolean enabled, String frequency, int weekday, java.time.LocalTime time, int keep) {}
        Schedule s = jdbc.sql("SELECT enabled, frequency, weekday, run_time, keep_count FROM backup_schedule WHERE id = 1")
            .query((rs, n) -> new Schedule(rs.getBoolean(1), rs.getString(2), rs.getInt(3), Db.time(rs, "run_time"), rs.getInt(5)))
            .optional().orElse(null);
        if (s == null || !s.enabled()) return;
        LocalDateTime slot = now.toLocalDate().atTime(s.time());
        if ("weekly".equals(s.frequency())) {
            int today = now.getDayOfWeek().getValue() % 7; // 0 = Chủ nhật, như giao diện
            slot = slot.minusDays((today - s.weekday() + 7) % 7);
            if (slot.isAfter(now)) slot = slot.minusDays(7);
        } else if (slot.isAfter(now)) {
            slot = slot.minusDays(1);
        }
        if (Duration.between(slot, now).toHours() >= 12) return;
        boolean done = jdbc.sql("SELECT COUNT(*) FROM backup_files WHERE kind = 'auto' AND created_at >= ?").param(slot)
            .query(Long.class).single() > 0;
        if (done || !lock.tryLock()) return;
        try {
            BackupFile f = create("auto", "auto", null);
            systemAudit("Sao lưu tự động", f.name() + " (" + f.sizeKb() + " KB)");
            List<BackupFile> autos = list().stream().filter(b -> "auto".equals(b.kind())).toList();
            for (BackupFile old : autos.subList(Math.min(s.keep(), autos.size()), autos.size())) {
                removeFile(old);
                systemAudit("Xóa bản sao lưu cũ", old.name() + " (chỉ giữ " + s.keep() + " bản tự động mới nhất)");
            }
        } finally {
            lock.unlock();
        }
    }

    private void systemAudit(String action, String detail) {
        jdbc.sql("""
                INSERT INTO audit_logs (user_id, actor_name, actor_username, module, action, detail, ref_table)
                VALUES (NULL, 'Hệ thống', 'system', 'settings', ?, ?, 'backup_files')
                """).params(action, detail).update();
    }

    /* ------------------------------------------------------------------ Tiện ích */

    private <T> T withLock(java.util.function.Supplier<T> action) {
        if (!lock.tryLock()) throw new BusinessException("Đang có thao tác sao lưu / phục hồi khác, vui lòng thử lại sau ít phút");
        try {
            return action.get();
        } finally {
            lock.unlock();
        }
    }

    /** Ghi vào ZipOutputStream mà không đóng nó khi Writer đóng. */
    private static final class NonClosing extends FilterOutputStream {
        NonClosing(OutputStream out) {
            super(out);
        }

        @Override
        public void write(byte[] b, int off, int len) throws IOException {
            out.write(b, off, len);
        }

        @Override
        public void close() throws IOException {
            flush();
        }
    }
}
