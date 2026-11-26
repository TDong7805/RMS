package com.rms.ordering;

import com.rms.common.BusinessException;
import com.rms.common.Times;
import com.rms.reservation.ReservationRules.Candidate;
import com.rms.reservation.ReservationService;
import com.rms.reservation.ReservationService.DayReservation;
import com.rms.reservation.ReservationService.Reservation;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * Đặt bàn ở màn POS thu ngân (B6, 26/11/2026 — người nhận đặt bàn là người đứng quầy):
 * GET    /api/thu-ngan/reservations?date=YYYY-MM-DD   lịch trong ngày (mặc định hôm nay)
 * POST   /api/thu-ngan/reservations                   {..., source: phone | walk_in} thêm lịch (xác nhận luôn)
 * PUT    /api/thu-ngan/reservations/{id}              sửa (giờ, số khách, khu, bàn, ghi chú)
 * PATCH  /api/thu-ngan/reservations/{id}/status       {status: confirmed | cancelled | no_show}
 * Khách đã đến → mở bàn kèm reservationId (POST /api/thu-ngan/tables/{id}/open).
 */
@RestController
public class CashierReservationController {
    public record CreateInput(String customerName, String phone, Integer guests, String date, String time, String areaId,
                              String tableId, String note, String source) {}

    private static final Set<String> STATUSES = Set.of("confirmed", "cancelled", "no_show");
    private final ReservationService service;

    public CashierReservationController(ReservationService service) {
        this.service = service;
    }

    @GetMapping("/api/thu-ngan/reservations")
    public List<DayReservation> day(@RequestParam(defaultValue = "") String date) {
        LocalDate d = Times.parseDate(date);
        return service.day(d == null ? Times.today() : d);
    }

    @PostMapping("/api/thu-ngan/reservations")
    @ResponseStatus(HttpStatus.CREATED)
    public Reservation create(@RequestBody CreateInput in) {
        return service.create(new Candidate(in.customerName(), in.phone(), in.guests(), in.date(), in.time(), in.areaId(),
            in.tableId(), in.note()), in.source());
    }

    @PutMapping("/api/thu-ngan/reservations/{id}")
    public Reservation update(@PathVariable String id, @RequestBody Candidate in) {
        return service.update(id, in);
    }

    @PatchMapping("/api/thu-ngan/reservations/{id}/status")
    public Reservation status(@PathVariable String id, @RequestBody Map<String, String> body) {
        String status = body == null ? null : body.get("status");
        if (!STATUSES.contains(status)) throw new BusinessException("Khách đã đến thì bấm Mở bàn trên sơ đồ", HttpStatus.CONFLICT);
        return service.setStatus(id, status);
    }
}
