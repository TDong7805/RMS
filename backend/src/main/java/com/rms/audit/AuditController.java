package com.rms.audit;
import com.rms.common.Db;

import com.rms.common.BusinessException;
import com.rms.common.Ids;
import com.rms.common.Paged;
import com.rms.common.Times;
import com.rms.common.Vi;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Nhật ký hoạt động (UC Cấu hình hệ thống › Nhật ký). Chỉ đọc: bản ghi do AuditService tạo. */
@RestController
@RequestMapping("/api/audit-logs")
public class AuditController {
    static final int PAGE_SIZE = 20;

    public record AuditLogDto(String id, String at, String actor, String actorUsername, String module,
                              String action, String detail, String ip) {}

    public record ActorDto(String username, String name) {}

    private final JdbcClient jdbc;

    public AuditController(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    @GetMapping
    public Paged<AuditLogDto> list(
        @RequestParam(defaultValue = "") String keyword,
        @RequestParam(defaultValue = "") String actor,
        @RequestParam(defaultValue = "all") String module,
        @RequestParam(defaultValue = "") String from,
        @RequestParam(defaultValue = "") String to,
        @RequestParam(defaultValue = "1") int page) {
        return Paged.of(filter(keyword, actor, module, from, to), page, PAGE_SIZE);
    }

    /** Toàn bộ kết quả lọc (không phân trang) để xuất CSV. */
    @GetMapping("/export")
    public List<AuditLogDto> export(
        @RequestParam(defaultValue = "") String keyword,
        @RequestParam(defaultValue = "") String actor,
        @RequestParam(defaultValue = "all") String module,
        @RequestParam(defaultValue = "") String from,
        @RequestParam(defaultValue = "") String to) {
        return filter(keyword, actor, module, from, to);
    }

    /** Tài khoản đã từng phát sinh nhật ký — cho bộ lọc "Tài khoản". */
    @GetMapping("/actors")
    public List<ActorDto> actors() {
        return jdbc.sql("""
                SELECT actor_username, actor_name FROM audit_logs
                WHERE id IN (SELECT MAX(id) FROM audit_logs GROUP BY actor_username)
                ORDER BY actor_name
                """)
            .query((rs, n) -> new ActorDto(rs.getString("actor_username"), rs.getString("actor_name")))
            .list();
    }

    private List<AuditLogDto> filter(String keyword, String actor, String module, String from, String to) {
        LocalDate fromDate = Times.parseDate(from);
        LocalDate toDate = Times.parseDate(to);
        if (fromDate != null && toDate != null && fromDate.isAfter(toDate)) {
            throw new BusinessException("Ngày bắt đầu phải trước hoặc bằng ngày kết thúc", HttpStatus.BAD_REQUEST);
        }
        StringBuilder sql = new StringBuilder("""
            SELECT id, created_at, actor_name, actor_username, module, action, detail, ip_address
            FROM audit_logs WHERE 1=1
            """);
        List<Object> params = new ArrayList<>();
        if (!"all".equals(module) && !module.isBlank()) {
            sql.append(" AND module = ?");
            params.add(module);
        }
        if (!actor.isBlank()) {
            sql.append(" AND actor_username = ?");
            params.add(actor);
        }
        if (fromDate != null) {
            sql.append(" AND created_at >= ?");
            params.add(fromDate.atStartOfDay());
        }
        if (toDate != null) {
            sql.append(" AND created_at < ?");
            params.add(toDate.plusDays(1).atStartOfDay());
        }
        sql.append(" ORDER BY created_at DESC, id DESC");

        return jdbc.sql(sql.toString()).params(params)
            .query((rs, n) -> new AuditLogDto(
                Ids.str(rs.getLong("id")),
                Times.iso(Db.dateTime(rs, "created_at")),
                rs.getString("actor_name"),
                rs.getString("actor_username"),
                rs.getString("module"),
                rs.getString("action"),
                rs.getString("detail") == null ? "" : rs.getString("detail"),
                rs.getString("ip_address") == null ? "" : rs.getString("ip_address")))
            .list().stream()
            .filter(l -> Vi.matches(l.action(), keyword) || Vi.matches(l.detail(), keyword) || Vi.matches(l.actor(), keyword))
            .toList();
    }
}
