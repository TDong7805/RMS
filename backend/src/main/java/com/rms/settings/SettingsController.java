package com.rms.settings;

import com.rms.settings.SettingsService.BackupSchedule;
import com.rms.settings.SettingsService.OpeningDay;
import com.rms.settings.SettingsService.RestaurantInfo;
import com.rms.settings.SettingsService.RestaurantInfoInput;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/settings")
public class SettingsController {
    private final SettingsService service;

    public SettingsController(SettingsService service) {
        this.service = service;
    }

    @GetMapping("/restaurant")
    public RestaurantInfo info() {
        return service.getInfo();
    }

    @PutMapping("/restaurant")
    public RestaurantInfo updateInfo(@RequestBody RestaurantInfoInput input) {
        return service.updateInfo(input);
    }

    @GetMapping("/opening-hours")
    public List<OpeningDay> hours() {
        return service.getOpeningHours();
    }

    @PutMapping("/opening-hours")
    public List<OpeningDay> updateHours(@RequestBody List<OpeningDay> input) {
        return service.updateOpeningHours(input);
    }

    @GetMapping("/backup-schedule")
    public BackupSchedule schedule() {
        return service.getSchedule();
    }

    @PutMapping("/backup-schedule")
    public BackupSchedule updateSchedule(@RequestBody BackupSchedule input) {
        return service.updateSchedule(input);
    }
}
