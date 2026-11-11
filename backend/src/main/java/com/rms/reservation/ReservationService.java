package com.rms.reservation;
import com.rms.common.Db;

import com.rms.audit.AuditService;
import com.rms.common.BusinessException;
import com.rms.common.Ids;
import com.rms.common.Paged;
import com.rms.common.Times;
import com.rms.common.Vi;
import com.rms.reservation.ReservationRules.Candidate;
import com.rms.reservation.ReservationRules.Original;
import com.rms.reservation.ReservationRules.Valid;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * UC Quản lý đặt bàn (phía Quản lý nhà hàng): tra cứu, xem chi tiết, chỉnh sửa, đổi trạng thái.
 * Lịch đặt mới do Khách hàng tạo (phân hệ khác) — xem ReservationRules để dùng chung quy tắc.
 */
@Service
public class ReservationService {
    static final int PAGE_SIZE = 10;
    private static final Map<String, String> STATUS_LABEL = Map.of(
        "pending", "Chờ xác nhận", "confirmed", "Đã xác nhận", "seated", "Đã đến",
        "completed", "Hoàn tất", "cancelled", "Đã hủy", "no_show", "Không đến");

    public record Reservation(String id, String code, String customerName, String phone, int guests, String dateTime,
                              String areaId, String tableId, String note, String status, String source,
                              String createdAt, String updatedAt) {}

    public record Summary(int today, int pending, int guestsToday) {}

    private final JdbcClient jdbc;
    private final ReservationRules rules;
    private final AuditService audit;

    public ReservationService(JdbcClient jdbc, ReservationRules rules, AuditService audit) {
        this.jdbc = jdbc;
        this.rules = rules;
        this.audit = audit;
    }

    private static final String SELECT = """
        SELECT id, code, customer_name, phone, guests, reserved_at, area_id, table_id, note, status, source,
               created_at, updated_at
        FROM reservations
        """;

    private static Reservation map(ResultSet rs, int n) throws SQLException {
        return new Reservation(
            Ids.str(rs.getLong("id")), rs.getString("code"), rs.getString("customer_name"), rs.getString("phone"),
            rs.getInt("guests"), Times.iso(Db.dateTime(rs, "reserved_at")),
            Ids.str(rs.getLong("area_id")), Ids.str(rs.getObject("table_id", Long.class)),
            rs.getString("note") == null ? "" : rs.getString("note"), rs.getString("status"), rs.getString("source"),
            Times.iso(Db.dateTime(rs, "created_at")),
            Times.iso(Db.dateTime(rs, "updated_at")));
    }

    public Paged<Reservation> list(String keyword, String date, String areaId, String status, int page) {
        StringBuilder sql = new StringBuilder(SELECT).append(" WHERE 1=1");
        List<Object> params = new ArrayList<>();
        if (!"all".equals(status) && !status.isBlank()) {
            sql.append(" AND status = ?");
            params.add(status);
        }
        Long area = Ids.parseOrNull(areaId);
        if (area != null) {
            sql.append(" AND area_id = ?");
            params.add(area);
        }
        LocalDate day = Times.parseDate(date);
        if (day != null) {
            sql.append(" AND reserved_at >= ? AND reserved_at < ?");
            params.add(day.atStartOfDay());
            params.add(day.plusDays(1).atStartOfDay());
        }
        sql.append(" ORDER BY reserved_at DESC, id DESC");

        String k = Vi.trim(keyword);
        String digits = k.replaceAll("\\D", "");
        List<Reservation> rows = jdbc.sql(sql.toString()).params(params).query(ReservationService::map).list().stream()
            .filter(r -> k.isEmpty() || Vi.matches(r.customerName(), k) || Vi.matches(r.code(), k)
                || (digits.length() >= 3 && r.phone().contains(digits)))
            .toList();
        return Paged.of(rows, page, PAGE_SIZE);
    }

    public Reservation get(String idStr) {
        long id = Ids.parse(idStr, "Nội dung này không còn tồn tại");
        return jdbc.sql(SELECT + " WHERE id = ?").param(id).query(ReservationService::map).optional()
            .orElseThrow(() -> BusinessException.notFound("Nội dung này không còn tồn tại"));
    }

    @Transactional
    public Reservation update(String idStr, Candidate input) {
        Reservation original = get(idStr);
        if (!ReservationRules.ACTIVE.contains(original.status()))
            throw new BusinessException("Lịch đặt ở trạng thái \"" + STATUS_LABEL.get(original.status()) + "\" không thể chỉnh sửa");
        long id = Long.parseLong(original.id());
        LocalDateTime origStart = Times.fromIso(original.dateTime());
        Valid v = rules.validate(input, new Original(id, origStart, original.guests(),
            Long.parseLong(original.areaId()), Ids.parseOrNull(original.tableId())));

        boolean timeChanged = !v.start().equals(origStart);
        jdbc.sql("""
                UPDATE reservations SET customer_name = ?, phone = ?, guests = ?, reserved_at = ?, area_id = ?,
                  table_id = ?, note = ?, duration_minutes = IF(?, ?, duration_minutes)
                WHERE id = ?
                """)
            .params(v.customerName(), v.phone(), v.guests(), v.start(), v.areaId(), v.tableId(),
                v.note().isEmpty() ? null : v.note(), timeChanged, v.durationMinutes(), id)
            .update();

        Reservation updated = get(idStr);
        List<String> changes = new ArrayList<>();
        if (original.guests() != updated.guests()) changes.add("số khách " + original.guests() + " → " + updated.guests());
        if (!original.dateTime().equals(updated.dateTime())) changes.add("đổi thời gian");
        if (!java.util.Objects.equals(original.tableId(), updated.tableId()) || !original.areaId().equals(updated.areaId()))
            changes.add("đổi bàn/khu vực");
        if (!original.customerName().equals(updated.customerName()) || !original.phone().equals(updated.phone()))
            changes.add("thông tin khách");
        if (!original.note().equals(updated.note())) changes.add("ghi chú");
        audit.log("reservation", "Cập nhật đặt bàn",
            updated.code() + ": " + (changes.isEmpty() ? "không đổi nội dung" : String.join(", ", changes)), "reservations", id);
        return updated;
    }

    @Transactional
    public Reservation setStatus(String idStr, String status) {
        Reservation original = get(idStr);
        if (status == null || !ReservationRules.NEXT_STATUS.get(original.status()).contains(status))
            throw new BusinessException("Không thể chuyển sang trạng thái này", HttpStatus.CONFLICT);
        long id = Long.parseLong(original.id());
        jdbc.sql("UPDATE reservations SET status = ? WHERE id = ?").params(status, id).update();
        audit.log("reservation", "Đổi trạng thái đặt bàn",
            original.code() + ": " + STATUS_LABEL.get(original.status()) + " → " + STATUS_LABEL.get(status), "reservations", id);
        return get(idStr);
    }

    public Summary summary() {
        LocalDate today = Times.today();
        return jdbc.sql("""
                SELECT
                  COALESCE(SUM(reserved_at >= ? AND reserved_at < ? AND status IN ('pending','confirmed','seated')), 0) AS today,
                  COALESCE(SUM(status = 'pending'), 0) AS pending,
                  COALESCE(SUM(CASE WHEN reserved_at >= ? AND reserved_at < ? AND status IN ('pending','confirmed','seated')
                                    THEN guests ELSE 0 END), 0) AS guests_today
                FROM reservations
                """)
            .params(today.atStartOfDay(), today.plusDays(1).atStartOfDay(), today.atStartOfDay(), today.plusDays(1).atStartOfDay())
            .query((rs, n) -> new Summary(rs.getInt("today"), rs.getInt("pending"), rs.getInt("guests_today")))
            .single();
    }
}
