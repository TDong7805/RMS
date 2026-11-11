package com.rms.reservation;

import com.rms.common.Paged;
import com.rms.reservation.ReservationFormConfigService.FormConfig;
import com.rms.reservation.ReservationFormConfigService.FormConfigInput;
import com.rms.reservation.ReservationRules.Candidate;
import com.rms.reservation.ReservationService.Reservation;
import com.rms.reservation.ReservationService.Summary;
import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/reservations")
public class ReservationController {
    private final ReservationService service;
    private final ReservationFormConfigService formConfig;

    public ReservationController(ReservationService service, ReservationFormConfigService formConfig) {
        this.service = service;
        this.formConfig = formConfig;
    }

    @GetMapping
    public Paged<Reservation> list(
        @RequestParam(defaultValue = "") String keyword,
        @RequestParam(defaultValue = "") String date,
        @RequestParam(defaultValue = "") String areaId,
        @RequestParam(defaultValue = "all") String status,
        @RequestParam(defaultValue = "1") int page) {
        return service.list(keyword, date, areaId, status, page);
    }

    @GetMapping("/summary")
    public Summary summary() {
        return service.summary();
    }

    @GetMapping("/form-config")
    public FormConfig getFormConfig() {
        return formConfig.get();
    }

    @PutMapping("/form-config")
    public FormConfig updateFormConfig(@RequestBody FormConfigInput in) {
        return formConfig.update(in);
    }

    @GetMapping("/{id}")
    public Reservation get(@PathVariable String id) {
        return service.get(id);
    }

    @PutMapping("/{id}")
    public Reservation update(@PathVariable String id, @RequestBody Candidate in) {
        return service.update(id, in);
    }

    @PatchMapping("/{id}/status")
    public Reservation status(@PathVariable String id, @RequestBody Map<String, String> body) {
        return service.setStatus(id, body.get("status"));
    }
}
