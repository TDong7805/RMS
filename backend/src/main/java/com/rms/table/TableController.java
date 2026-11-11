package com.rms.table;

import com.rms.table.TableService.Area;
import com.rms.table.TableService.AreaInput;
import com.rms.table.TableService.DiningTable;
import com.rms.table.TableService.Position;
import com.rms.table.TableService.TableInput;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
public class TableController {
    private final TableService service;

    public TableController(TableService service) {
        this.service = service;
    }

    /** Kích thước lưới sơ đồ — frontend dùng để vẽ. */
    @GetMapping("/floor-plan")
    public Map<String, Integer> floor() {
        return Map.of("cols", TableService.FLOOR_COLS, "rows", TableService.FLOOR_ROWS);
    }

    @GetMapping("/areas")
    public List<Area> areas() {
        return service.areas();
    }

    @PostMapping("/areas")
    @ResponseStatus(HttpStatus.CREATED)
    public Area createArea(@RequestBody AreaInput in) {
        return service.createArea(in);
    }

    @PutMapping("/areas/{id}")
    public Area updateArea(@PathVariable String id, @RequestBody AreaInput in) {
        return service.updateArea(id, in);
    }

    @DeleteMapping("/areas/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteArea(@PathVariable String id) {
        service.deleteArea(id);
    }

    @GetMapping("/tables")
    public List<DiningTable> tables() {
        return service.tables();
    }

    @PostMapping("/tables")
    @ResponseStatus(HttpStatus.CREATED)
    public DiningTable createTable(@RequestBody TableInput in) {
        return service.createTable(in);
    }

    @PutMapping("/tables/{id}")
    public DiningTable updateTable(@PathVariable String id, @RequestBody TableInput in) {
        return service.updateTable(id, in);
    }

    @PatchMapping("/tables/{id}/position")
    public DiningTable move(@PathVariable String id, @RequestBody Position pos) {
        return service.moveTable(id, pos);
    }

    @DeleteMapping("/tables/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteTable(@PathVariable String id) {
        service.deleteTable(id);
    }
}
